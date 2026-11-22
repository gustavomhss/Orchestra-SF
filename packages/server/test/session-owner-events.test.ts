import { expect, test } from "bun:test"
import { DateTime, Effect, Exit, Fiber, Queue, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
import { EventV2 } from "@orchestra/core/event"
import { SessionV2 } from "@orchestra/core/session"
import { SessionOwner } from "@orchestra/core/session/owner"
import { Event } from "@orchestra/schema/event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { OrchestraEventTransport } from "@orchestra/protocol/groups/event"
import { encodeEvent, eventFrames, eventStream } from "../src/handlers/event"
import { ownerA, ownerB, ownerPerson, sessionHttpFixture } from "./fixture/session-http"

const corporate = test.skipIf(process.platform === "win32")
function reader(response: Response) {
  if (!response.body) throw new Error("Actual event stream required")
  const stream = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  return {
    async next() {
      while (true) {
        const delimiter = buffer.indexOf("\n\n")
        if (delimiter >= 0) {
          const frame = buffer.slice(0, delimiter)
          buffer = buffer.slice(delimiter + 2)
          const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n")
          if (data) {
            const decoded = Schema.decodeUnknownSync(Schema.toCodecJson(OrchestraEventTransport))(JSON.parse(data))
            if (!("event" in decoded)) throw new Error("Corporate stream namespace required")
            return decoded
          }
          continue
        }
        const chunk = await stream.read()
        if (chunk.done) return undefined
        buffer += decoder.decode(chunk.value, { stream: true })
      }
    },
    cancel: () => stream.cancel(),
  }
}

corporate("real HTTP SSE subscribers filter by their captured owner independently of the publisher's scope", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const a = yield* f.seed("ses_stream_a")
    const b = yield* f.seed("ses_stream_b", ownerB)
    const person = yield* f.seed("ses_stream_person", ownerPerson)
    const identities = [[ownerA, a.id], [ownerB, b.id], [ownerPerson, person.id]] as const
    const streams: Array<ReturnType<typeof reader>> = []
    try {
      for (const [owner] of identities) {
        const response = yield* Effect.promise(() => http.mounted(http.request("/api/event", owner)))
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toContain("text/event-stream")
        const incoming = reader(response)
        streams.push(incoming)
        expect((yield* Effect.promise(() => incoming.next()))?.event.type).toBe("server.connected")
      }
      for (const [owner, id] of identities.toReversed())
        yield* f.admitted(owner, sessions.rename({ sessionID: id, title: "private:" + id }))
      for (const [index, incoming] of streams.entries()) {
        const value = yield* Effect.promise(() => incoming.next())
        expect(value?.event.type).toBe("session.next.renamed")
        if (!value || value.event.type !== "session.next.renamed") throw new Error("Actual owned rename event required")
        expect(value.event.data.sessionID).toBe(identities[index]![1])
        expect(value.event.data.title).toBe("private:" + identities[index]![1])
        expect(value.namespace.owner).toEqual(identities[index]![0])
        expect(value.namespace.authorityGeneration).toBe(1)
      }
    } finally {
      yield* Effect.promise(() => Promise.all(streams.map((stream) => stream.cancel())))
    }
  }))
})

corporate("owner filtering precedes serialization and a publisher cannot forge the connected exception", async () => {
  await using f = await sessionHttpFixture()
  await f.run(() => Effect.gen(function* () {
    const own = yield* f.seed("ses_stream_encode_own")
    const foreign = yield* f.seed("ses_stream_encode_foreign", ownerB)
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(ownerA, owners.open())
    const encoded: string[] = []
    const frame = eventFrames((data) => {
      const payload = data && typeof data === "object" && "event" in data ? data.event : data
      if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string")
        throw new Error("Canonical event identifier required")
      encoded.push(payload.id)
      return encodeEvent(data)
    })
    const pull = yield* Stream.toPull(eventStream(events, frame, { owners, scope }))
    let ready = ""
    while (!ready.includes("server.connected")) ready += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    const first = encoded.length
    const forbidden = yield* f.admitted(ownerB, events.publish(SessionEvent.Renamed, {
      sessionID: foreign.id, timestamp: DateTime.nowUnsafe(), title: "foreign-secret",
    }))
    const spoof = yield* f.admitted(ownerA, events.publish(Event.define({ type: "server.connected", schema: {} }), {}))
    const allowed = yield* f.admitted(ownerA, events.publish(SessionEvent.Renamed, {
      sessionID: own.id, timestamp: DateTime.nowUnsafe(), title: "owned-visible",
    }))
    let text = ""
    while (!text.includes(allowed.id)) text += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    expect(text).toContain("owned-visible")
    expect(text).not.toContain("foreign-secret")
    expect(encoded).not.toContain(forbidden.id)
    expect(encoded).not.toContain(spoof.id)
    expect(encoded.slice(first)).toEqual([allowed.id])
  }))
})

corporate("revocation closes the original HTTP SSE stream on a late foreign event and refuses reconnect", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    yield* f.seed("ses_stream_revoked")
    const foreign = yield* f.seed("ses_stream_late", ownerPerson)
    const response = yield* Effect.promise(() => http.mounted(http.request("/api/event")))
    const incoming = reader(response)
    expect((yield* Effect.promise(() => incoming.next()))?.event.type).toBe("server.connected")
    try {
      f.revoke()
      yield* f.admitted(ownerPerson, sessions.rename({ sessionID: foreign.id, title: "late-private" }))
      const ended = yield* Effect.promise(() => incoming.next()).pipe(Effect.exit)
      expect(Exit.isFailure(ended) || Exit.isSuccess(ended) && ended.value === undefined).toBe(true)
      expect((yield* Effect.promise(() => http.mounted(http.request("/api/event")))).status).toBe(401)
    } finally {
      yield* Effect.promise(() => incoming.cancel()).pipe(Effect.catchCause(() => Effect.void))
    }
  }))
})

corporate("idle corporate SSE rechecks its retained authority on the existing 15-second heartbeat", async () => {
  await using f = await sessionHttpFixture()
  await f.run(() => Effect.gen(function* () {
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(ownerA, owners.open())
    const received = yield* Queue.unbounded<string>()
    const listening = yield* Stream.runForEach(eventStream(events, eventFrames(), { owners, scope }),
      (bytes) => Queue.offer(received, new TextDecoder().decode(bytes))).pipe(Effect.exit, Effect.forkChild)
    let connected = ""
    while (!connected.includes("server.connected")) connected += yield* Queue.take(received)
    yield* TestClock.adjust(0)
    f.revoke()
    yield* TestClock.adjust(15_000)
    expect(Exit.isFailure(yield* Fiber.join(listening))).toBe(true)
  }).pipe(Effect.provide(TestClock.layer())))
})

corporate("SSE burst order and HTTP history preserve canonical payloads without leaking private owner records", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed("ses_stream_order")
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(ownerA, owners.open())
    const pull = yield* Stream.toPull(eventStream(events, eventFrames(), { owners, scope }))
    let ready = ""
    while (!ready.includes("server.connected")) ready += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    const ids: string[] = []
    for (let index = 0; index < 12; index++) {
      const event = yield* f.admitted(ownerA, events.publish(SessionEvent.Renamed, {
        sessionID: own.id, timestamp: DateTime.nowUnsafe(), title: "burst-" + index,
      }))
      ids.push(event.id)
    }
    let text = ""
    while (!text.includes(ids.at(-1)!)) text += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    expect(ids.map((id) => text.indexOf(id))).toEqual(ids.map((id) => text.indexOf(id)).toSorted((a, b) => a - b))
    for (const id of ids) expect(text.split(id)).toHaveLength(2)
    expect(text).not.toContain("session.owner.bound")
    const history = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + own.id + "/history?after=0&limit=50")))
    expect(history.status).toBe(200)
    const json = yield* Effect.promise(() => history.text())
    expect(json).toContain("burst-11")
    expect(json).not.toContain("session.owner.bound")
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session/" + own.id + "/history?after=0", ownerB)))).status).toBe(401)
  }))
})
