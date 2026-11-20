import { expect, test } from "bun:test"
import { Context, DateTime, Effect, Exit, Fiber, Queue, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
import { EventV2 } from "@orchestra/core/event"
import { SessionV2 } from "@orchestra/core/session"
import { SessionOwner } from "@orchestra/core/session/owner"
import { Event } from "@orchestra/schema/event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { OrchestraEventTransport } from "@orchestra/protocol/groups/event"
import { encodeEvent, eventFrames, eventStream } from "../src/handlers/event"
import { teamSessionHttpFixture, profileA, profileB, other } from "./fixture/team-session-http"
import { roleMap } from "../../../modules/sucafina/Sucafinav1/runtime/admin"

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

test("http-events-01: live HTTP subscribers see only their captured person and Team, independent of publisher scope", async () => {
  await using f = await teamSessionHttpFixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const a = yield* f.seed( "ses_stream_a")
    const b = yield* f.seed( "ses_stream_b", profileB)
    const person = yield* f.seed( "ses_stream_person", profileA, secondCookie)
    const identities = [[profileA, f.cookie, a.id], [profileB, f.cookie, b.id], [profileA, secondCookie, person.id]] as const
    const streams: Array<ReturnType<typeof reader>> = []
    for (const [profile, cookie] of identities) {
      const response = yield* Effect.promise(() => http.mounted(f.request("/api/event", profile, cookie)))
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/event-stream")
      const incoming = reader(response)
      streams.push(incoming)
      expect((yield* Effect.promise(() => incoming.next()))?.event.type).toBe("server.connected")
    }
    try {
      for (const [profile, cookie, id] of identities.toReversed())
        yield* f.admitted(f.businessRequest(profile, cookie), sessions.rename({ sessionID: id, title: "private:" + id }))
      for (const [index, incoming] of streams.entries()) {
        const value = yield* Effect.promise(() => incoming.next())
        expect(value?.event.type).toBe("session.next.renamed")
        if (!value || value.event.type !== "session.next.renamed") throw new Error("Actual owned rename event required")
        expect(value.event.data.sessionID).toBe(identities[index]![2])
        expect(value.event.data.title).toBe("private:" + identities[index]![2])
        expect(value.namespace.owner.profile).toEqual(identities[index]![0])
        expect(value.namespace.authorityGeneration).toBe(1)
      }
    } finally {
      yield* Effect.promise(() => Promise.all(streams.map((stream) => stream.cancel())))
    }
  }))
})

test("http-events-02: owner filtering precedes serialization and publisher-created connected events gain no public exception", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed( "ses_stream_encode_own")
    const foreign = yield* f.seed( "ses_stream_encode_foreign", profileB)
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(f.businessRequest(), owners.open())
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
    const forbidden = yield* f.admitted(f.businessRequest(profileB), events.publish(SessionEvent.Renamed, {
      sessionID: foreign.id, timestamp: DateTime.nowUnsafe(), title: "foreign-secret",
    }))
    const spoof = yield* f.admitted(f.businessRequest(), events.publish(Event.define({ type: "server.connected", schema: {} }), {}))
    const allowed = yield* f.admitted(f.businessRequest(), events.publish(SessionEvent.Renamed, {
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

test("http-events-03: logout closes the original HTTP subscription when a different live publisher delivers a late event", async () => {
  await using f = await teamSessionHttpFixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    yield* f.seed( "ses_stream_logged_out")
    const foreign = yield* f.seed( "ses_stream_late", profileA, secondCookie)
    const response = yield* Effect.promise(() => http.mounted(f.request("/api/event")))
    const incoming = reader(response)
    expect((yield* Effect.promise(() => incoming.next()))?.event.type).toBe("server.connected")
    try {
      yield* Effect.promise(() => f.logout(f.cookie))
      yield* f.admitted(f.businessRequest(profileA, secondCookie), sessions.rename({ sessionID: foreign.id, title: "late-private" }))
      const ended = yield* Effect.promise(() => incoming.next()).pipe(Effect.exit)
      expect(Exit.isFailure(ended) || Exit.isSuccess(ended) && ended.value === undefined).toBe(true)
      const reconnect = yield* Effect.promise(() => http.mounted(f.request("/api/event")))
      expect(reconnect.status).toBe(401)
    } finally {
      yield* Effect.promise(() => incoming.cancel()).pipe(Effect.catchCause(() => Effect.void))
    }
  }))
})

test("http-events-04: an idle corporate stream revalidates on the unchanged 15-second heartbeat cadence", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run(() => Effect.gen(function* () {
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(f.businessRequest(), owners.open())
    const received = yield* Queue.unbounded<string>()
    const listening = yield* Stream.runForEach(eventStream(events, eventFrames(), { owners, scope }),
      (bytes) => Queue.offer(received, new TextDecoder().decode(bytes))).pipe(Effect.exit, Effect.forkChild)
    let connected = ""
    while (!connected.includes("server.connected")) connected += yield* Queue.take(received)
    yield* TestClock.adjust(0)
    yield* Effect.promise(() => f.logout(f.cookie))
    yield* TestClock.adjust(15_000)
    const exit = yield* Fiber.join(listening)
    expect(Exit.isFailure(exit)).toBe(true)
  }).pipe(Effect.provide(TestClock.layer())))
})

test("http-events-05: burst order and finite history replay keep canonical payloads and private owner records off the wire", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const owned = yield* f.seed( "ses_stream_order")
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const scope = yield* f.admitted(f.businessRequest(), owners.open())
    const pull = yield* Stream.toPull(eventStream(events, eventFrames(), { owners, scope }))
    let ready = ""
    while (!ready.includes("server.connected")) ready += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    const ids: string[] = []
    for (let index = 0; index < 12; index++) {
      const event = yield* f.admitted(f.businessRequest(), events.publish(SessionEvent.Renamed, {
        sessionID: owned.id, timestamp: DateTime.nowUnsafe(), title: "burst-" + index,
      }))
      ids.push(event.id)
    }
    let text = ""
    while (!text.includes(ids.at(-1)!)) text += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    expect(ids.map((id) => text.indexOf(id))).toEqual(ids.map((id) => text.indexOf(id)).toSorted((a, b) => a - b))
    for (const id of ids) expect(text.split(id)).toHaveLength(2)
    expect(text).not.toContain("session.owner.bound")
    const history = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + owned.id + "/history?after=0&limit=50")))
    expect(history.status).toBe(200)
    const json = yield* Effect.promise(() => history.text())
    expect(json).toContain("burst-11")
    expect(json).not.toContain("session.owner.bound")
    const foreign = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + owned.id + "/history?after=0", profileB)))
    expect(foreign.status).toBe(401)
  }))
})


const InPublisherListener = Context.Reference<boolean>("Server.Test.SessionEventListener", { defaultValue: () => false })

/** Instrument the actual private admission and real bus, never a substitute decision or Scope. */
const observedSubscriber = (
  f: Awaited<ReturnType<typeof teamSessionHttpFixture>>,
  owners: SessionOwner.Interface,
  events: EventV2.Interface,
  afterFirstInspection?: () => Promise<unknown>,
) => Effect.gen(function* () {
  const inspections = { listener: 0, other: 0 }
  const lease = yield* owners.capture(() => Effect.promise(() => f.authority.readCoreSessionAdmission(f.businessRequest())).pipe(
    Effect.map((admission): SessionOwner.Admission | undefined => {
      if (!admission?.inspect) throw new Error("Actual current-policy inspection required")
      const inspect = admission.inspect
      return {
        ...admission,
        inspect: (operations) => Effect.gen(function* () {
          const listener = yield* InPublisherListener
          if (listener) inspections.listener++
          else inspections.other++
          const result = yield* inspect(operations)
          if (listener && inspections.listener === 1 && afterFirstInspection)
            yield* Effect.promise(afterFirstInspection)
          return result
        }),
      }
    }),
  ))
  if (!lease) return yield* Effect.die("Actual subscriber lease required")
  const scope = yield* SessionOwner.withLease(lease, owners.open())
  const observedEvents: EventV2.Interface = {
    ...events,
    listen: (callback) => events.listen((event) => callback(event).pipe(Effect.provideService(InPublisherListener, true))),
  }
  return { scope, events: observedEvents, inspections }
})

test("http-events-06: one canonical enqueue performs two real policy inspections while egress rechecks independently", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run(() => Effect.gen(function* () {
    const session = yield* f.seed("ses_stream_two_observations")
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    const observed = yield* observedSubscriber(f, owners, events)
    const pull = yield* Stream.toPull(eventStream(observed.events, eventFrames(), { owners, scope: observed.scope }))
    let ready = ""
    while (!ready.includes("server.connected")) ready += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    expect(observed.inspections.listener).toBe(0)
    const beforeEgress = observed.inspections.other
    const sent = yield* f.admitted(f.businessRequest(), events.publish(SessionEvent.Renamed, {
      sessionID: session.id, timestamp: DateTime.nowUnsafe(), title: "current-owner-after-two-inspections",
    }))
    expect(observed.inspections.listener).toBe(2)
    let delivered = ""
    while (!delivered.includes(sent.id)) delivered += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
    expect(delivered).toContain("current-owner-after-two-inspections")
    expect(delivered).toContain('"namespace"')
    expect(observed.inspections.other).toBeGreaterThan(beforeEgress)
    expect(observed.inspections.listener).toBe(2)
    console.info("SESSION_SSE_CANONICAL_INSPECTIONS", { listener: observed.inspections.listener, egress: observed.inspections.other - beforeEgress })
  }))
})

for (const change of ["role-map", "session-expiry"] as const) {
  test("http-events-07: " + change + " between current checks prevents enqueue and encoding of a canonical event", async () => {
    await using f = await teamSessionHttpFixture({ sessionSeconds: 60 })
    await f.run((http) => Effect.gen(function* () {
      const session = yield* f.seed("ses_stream_changed_" + change.replaceAll("-", "_"))
      const events = yield* EventV2.Service
      const owners = yield* SessionOwner.Service
      let changed = false
      const observed = yield* observedSubscriber(f, owners, events, async () => {
        if (change === "session-expiry") f.provider.clock.value += 61_000
        else await f.store.transaction("dashboard", async (snapshot) => {
          snapshot.data.roleMap = roleMap(snapshot, "dashboard").map((row) => ({ ...row, version: row.version + 1 }))
          return { commit: true, value: undefined }
        })
        changed = true
      })
      const encoded: string[] = []
      const frame = eventFrames((data) => { const text = encodeEvent(data); encoded.push(text); return text })
      const pull = yield* Stream.toPull(eventStream(observed.events, frame, { owners, scope: observed.scope }))
      let ready = ""
      while (!ready.includes("server.connected")) ready += (yield* pull).map((chunk) => new TextDecoder().decode(chunk)).join("")
      const encodedBefore = encoded.length
      // The real bus invokes the listener inside this separately captured publisher lease.
      yield* f.admitted(f.businessRequest(), events.publish(SessionEvent.Renamed, {
        sessionID: session.id, timestamp: DateTime.nowUnsafe(), title: "must-not-cross-stale-listener",
      })).pipe(Effect.exit)
      expect(changed).toBe(true)
      expect(observed.inspections.listener).toBe(2)
      const ended = yield* pull.pipe(Effect.exit)
      expect(Exit.isFailure(ended)).toBe(true)
      expect(encoded).toHaveLength(encodedBefore)
      expect(encoded.join("")).not.toContain("must-not-cross-stale-listener")
      if (change === "session-expiry") {
        const reconnect = yield* Effect.promise(() => http.mounted(f.request("/api/event")))
        expect(reconnect.status).toBe(401)
      } else {
        // A new current decision is still possible: only the retained old revision was revoked.
        const current = yield* Effect.promise(() => f.authority.readCoreSessionAdmission(f.businessRequest()))
        expect(current).toBeDefined()
      }
    }))
  })
}
