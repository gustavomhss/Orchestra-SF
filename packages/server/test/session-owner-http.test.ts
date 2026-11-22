import { expect, test } from "bun:test"
import { Effect, Fiber, Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { BodyLimit } from "../src/body-limit"
import { barrier, decode, Info, List, ownerA, ownerB, ownerPerson, sessionHttpFixture } from "./fixture/session-http"

const corporate = test.skipIf(process.platform === "win32")
const Messages = Schema.Struct({ data: Schema.Array(SessionMessage.Message), namespace: Schema.optional(TeamProfile.SessionNamespace),
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }) })
const History = Schema.Struct({ data: Schema.Array(SessionEvent.Durable), hasMore: Schema.Boolean, namespace: Schema.optional(TeamProfile.SessionNamespace) })
const ErrorBody = Schema.Struct({ _tag: Schema.String, message: Schema.String })

corporate("installed HTTP preserves the server's original Request and records real owned CRUD at the configured placement", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const request = http.json("/api/session", { id: "ses_http_original" })
    const response = yield* Effect.promise(() => http.mounted(request))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(http.received).toHaveLength(1)
    expect(http.originals[0]).toBe(http.received[0])
    expect(http.originals[0]?.url).toBe(request.url)
    const created = (yield* decode(response, Info)).data
    expect(created.location).toEqual(f.location)
    expect(yield* f.create(http, created.id)).toEqual(created)
    const read = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id)))
    expect(read.status).toBe(200)
    expect((yield* decode(read, Info)).data.id).toBe(created.id)
    const renamed = yield* Effect.promise(() => http.mounted(http.json("/api/session/" + created.id + "/rename", { title: "Owned title" })))
    expect(renamed.status).toBe(204)
    const messages = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id + "/message")))
    expect((yield* decode(messages, Messages)).data).toEqual([])
    const history = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id + "/history")))
    const events = (yield* decode(history, History)).data
    expect(events.map((entry) => entry.type)).toContain("session.next.renamed")
    expect(JSON.stringify(events)).not.toContain("session.owner.bound")
  }))
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([{ session_id: "ses_http_original" }])
})

corporate("two Teams and two people sharing placement have separate SQL pages and uniform denials before payload decoding", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed("ses_http_person_a")
    const team = yield* f.seed("ses_http_team_b", ownerB)
    const person = yield* f.seed("ses_http_person_b", ownerPerson)
    expect(team.location).toEqual(own.location)
    expect(person.projectID).toBe(own.projectID)
    for (const [owner, id] of [[ownerA, own.id], [ownerB, team.id], [ownerPerson, person.id]] as const) {
      const response = yield* Effect.promise(() => http.mounted(http.request("/api/session?limit=1", owner)))
      expect(response.status).toBe(200)
      expect((yield* decode(response, List)).data.map((item) => item.id)).toEqual([id])
    }
    const before = f.calls.projects
    const refused: unknown[] = []
    for (const owner of [ownerB, ownerPerson]) {
      for (const suffix of ["", "/message", "/history", "/event", "/context", "/todo"]) {
        const response = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + own.id + suffix, owner)))
        expect(response.status).toBe(401)
        refused.push(yield* decode(response, ErrorBody))
      }
      const response = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + own.id + "/rename", owner,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{invalid" })))
      expect(response.status).toBe(401)
      refused.push(yield* decode(response, ErrorBody))
    }
    const missing = yield* Effect.promise(() => http.mounted(http.request("/api/session/ses_http_unknown")))
    expect(missing.status).toBe(401)
    const missingBody = yield* decode(missing, ErrorBody)
    for (const value of refused) expect(value).toEqual(missingBody)
    expect(f.calls.projects).toBe(before)
  }))
})

corporate("Basic, query credentials and public owner labels cannot replace a private admission", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const basic = "Basic " + btoa("orchestra:component-only")
    for (const request of [
      http.request("/api/session", ownerA, { headers: { authorization: basic } }),
      http.request("/api/session?auth_token=" + btoa("orchestra:component-only")),
      http.raw("/api/session", { headers: { "x-orchestra-operator": "*", "x-sf-owner": JSON.stringify(ownerA),
        "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: ownerA.profile }) } }),
    ]) expect((yield* Effect.promise(() => http.mounted(request))).status).toBe(401)
    f.producer.state = "missing"
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session")))).status).toBe(401)
    expect(f.calls.projects).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})

corporate("Session action denials precede execution and references stay closed without their source ACL producer", async () => {
  await using f = await sessionHttpFixture({ actions: ["read", "create"] })
  await f.run((http) => Effect.gen(function* () {
    const created = yield* f.create(http, "ses_http_actions")
    for (const [suffix, body] of [
      ["/rename", { title: "forbidden" }], ["/prompt", { prompt: { text: "forbidden" }, resume: false }],
      ["/synthetic", { text: "forbidden", resume: false }], ["/fork", {}], ["/move", { location: f.location }],
      ["/shell", { command: "echo forbidden" }], ["/subagent-models", { policy: {} }],
    ] as const) {
      const response = yield* Effect.promise(() => http.mounted(http.json("/api/session/" + created.id + suffix, body)))
      expect(response.status).toBe(401)
    }
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/reference")))).status).toBe(401)
    expect(f.calls.resumes).toBe(0)
    expect(f.calls.wakes).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session_input")).toEqual([])
})

corporate("caller placement and body/query owner labels cannot retarget an owned Session", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const before = f.calls.projects
    const create = yield* Effect.promise(() => http.mounted(http.json("/api/session", {
      id: "ses_http_foreign_placement", location: { directory: "/not-the-installed-placement" },
    })))
    expect(create.status).toBe(401)
    expect(f.calls.projects).toBe(before)
    const own = yield* f.create(http, "ses_http_fixed_placement")
    const move = yield* Effect.promise(() => http.mounted(http.json("/api/session/" + own.id + "/move",
      { location: { directory: "/not-the-installed-placement" } })))
    expect(move.status).toBe(401)
    const rename = yield* Effect.promise(() => http.mounted(http.json("/api/session/" + own.id + "/rename?teamObjectId=" + ownerA.profile.teamObjectId,
      { title: "retargeted", owner: ownerA }, ownerB)))
    expect(rename.status).toBe(401)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([{ id: "ses_http_fixed_placement" }])
})

corporate("owner pagination cursors reject another Team, person, purpose, generation, revision and tampered bytes", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    yield* f.seed("ses_http_page_1")
    yield* f.seed("ses_http_page_foreign", ownerB)
    yield* f.seed("ses_http_page_2")
    yield* f.seed("ses_http_page_person", ownerPerson)
    yield* f.seed("ses_http_page_3")
    const response = yield* Effect.promise(() => http.mounted(http.request("/api/session?limit=1&order=asc")))
    const first = yield* decode(response, List)
    expect(first.data.map((item) => item.id)).toEqual([Session.ID.make("ses_http_page_1")])
    const cursor = first.cursor.next
    expect(cursor?.startsWith("sf1.")).toBe(true)
    if (!cursor) throw new Error("Actual page cursor required")
    const suffix = "/api/session?limit=1&cursor=" + encodeURIComponent(cursor)
    const next = yield* Effect.promise(() => http.mounted(http.request(suffix)))
    expect((yield* decode(next, List)).data.map((item) => item.id)).toEqual([Session.ID.make("ses_http_page_2")])
    for (const owner of [ownerB, ownerPerson])
      expect((yield* Effect.promise(() => http.mounted(http.request(suffix, owner)))).status).toBe(400)
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session/ses_http_page_1/message?cursor=" + encodeURIComponent(cursor))))).status).toBe(400)
    const tampered = cursor.slice(0, -1) + (cursor.endsWith("a") ? "b" : "a")
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session?cursor=" + encodeURIComponent(tampered))))).status).toBe(400)
    f.advance()
    expect((yield* Effect.promise(() => http.mounted(http.request(suffix)))).status).toBe(400)
    const refreshed = yield* Effect.promise(() => http.mounted(http.request("/api/session?limit=1&order=asc")))
    const currentCursor = (yield* decode(refreshed, List)).cursor.next
    if (!currentCursor) throw new Error("Current-generation cursor required")
    f.producer.revision++
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session?cursor=" + encodeURIComponent(currentCursor))))).status).toBe(400)
  }))
})

corporate("revocation while Project resolution waits prevents SQL creation and releases every writer permit", async () => {
  await using f = await sessionHttpFixture()
  const pause = barrier()
  f.hooks.beforeProject = pause.hold
  await f.run((http) => Effect.gen(function* () {
    const pending = yield* Effect.promise(() => http.mounted(http.json("/api/session", { id: "ses_http_revoked_create" }))).pipe(Effect.forkChild)
    try { yield* Effect.promise(() => pause.entered); f.revoke() }
    finally { pause.release() }
    expect((yield* Fiber.join(pending)).status).toBe(401)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
  expect(f.control.pendingWriters(f.storage)).toEqual([])
})

corporate("a private resource exclusion filters SQL before pagination and lookup", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const hidden = yield* f.seed("ses_http_acl_1")
    const visible = yield* f.seed("ses_http_acl_2")
    f.exclude(ownerA, [hidden.id])
    const response = yield* Effect.promise(() => http.mounted(http.request("/api/session?limit=1&order=asc")))
    expect((yield* decode(response, List)).data.map((item) => item.id)).toEqual([visible.id])
    expect((yield* Effect.promise(() => http.mounted(http.request("/api/session/" + hidden.id)))).status).toBe(401)
  }))
})

corporate("Origin, cross-site and Host denials happen before private admission", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const absent = http.json("/api/session", { id: "ses_http_origin" })
    absent.headers.delete("origin")
    const foreign = http.json("/api/session", { id: "ses_http_origin" })
    foreign.headers.set("origin", "https://cross-site.example.test")
    const crossSite = http.request("/api/session", ownerA, { headers: { "sec-fetch-site": "cross-site" } })
    const host = http.request("/api/session", ownerA, { headers: { host: "foreign.example.test" } })
    for (const request of [absent, foreign, crossSite])
      expect((yield* Effect.promise(() => http.mounted(request))).status).toBe(401)
    expect((yield* Effect.promise(() => http.direct(host))).status).toBe(401)
    expect(http.originals).toEqual([])
    expect(f.calls.projects).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT id FROM event")).toEqual([])
})

corporate("the prefixed production adapter preserves declared JSON and upload body limits", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed("ses_http_body_limit")
    // Direct Web Requests exercise the actual adapter: fetch itself forbids a fabricated Content-Length.
    for (const [suffix, length, status] of [
      ["/rename", BodyLimit.DEFAULT_LIMIT + 1, 413],
      ["/prompt", BodyLimit.DEFAULT_LIMIT + 1, 400],
      ["/prompt", BodyLimit.UPLOAD_LIMIT + 1, 413],
    ] as const) {
      const request = http.request("/api/session/" + own.id + suffix, ownerA, { method: "POST",
        headers: { "content-type": "application/json", "content-length": String(length) }, body: "{invalid" })
      const response = yield* Effect.promise(() => http.direct(request))
      expect(response.status).toBe(status)
      if (status === 413) expect((yield* decode(response, ErrorBody))._tag).toBe("PayloadTooLargeError")
    }
    expect(f.calls.resumes).toBe(0)
    expect(f.calls.wakes).toBe(0)
  }))
})

corporate("response namespaces carry the full owner and current generation without changing durable event bytes", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const expected = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({ version: 1, owner: ownerA, authorityGeneration: 1 })
    const empty = yield* Effect.promise(() => http.mounted(http.request("/api/session")))
    const listed = yield* decode(empty, List)
    expect(listed.data).toEqual([])
    expect(listed.namespace).toEqual(expected)
    const created = yield* f.create(http, "ses_http_namespace")
    expect(created.namespace).toEqual(expected)
    const bytes = JSON.stringify(f.business.all("SELECT * FROM event"))
    const read = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id)))
    expect((yield* decode(read, Info)).data.namespace).toEqual(expected)
    const messages = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id + "/message")))
    expect((yield* decode(messages, Messages)).namespace).toEqual(expected)
    const history = yield* Effect.promise(() => http.mounted(http.request("/api/session/" + created.id + "/history")))
    const replay = yield* decode(history, History)
    expect(replay.namespace).toEqual(expected)
    expect(JSON.stringify(replay.data)).not.toContain('"namespace":')
    const active = yield* Effect.promise(() => http.mounted(http.request("/api/session/active")))
    expect(yield* Effect.promise(() => active.json())).toEqual({ data: {}, namespace: expected })
    expect(JSON.stringify(f.business.all("SELECT * FROM event"))).toBe(bytes)
  }))
  f.advance()
  await f.run((http) => Effect.gen(function* () {
    const response = yield* Effect.promise(() => http.mounted(http.request("/api/session/ses_http_namespace")))
    const info = yield* decode(response, Info)
    expect(info.data.namespace?.owner).toEqual(ownerA)
    expect(info.data.namespace?.authorityGeneration).toBe(2)
  }))
})

corporate("the original prefixed Web adapter cuts actual JSON bytes without trusting Content-Length", async () => {
  await using f = await sessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed("ses_http_real_body_cap")
    const before = JSON.stringify(f.business.all("SELECT * FROM event"))
    const chunk = new Uint8Array(1024 * 1024).fill(97)
    const streamed = (size: number, prefix: string, suffix: string) => {
      const state = { stage: 0, payload: 0, bytes: 0, cancelled: 0, completed: false }
      const encode = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          const bytes = state.stage === 0 ? encode.encode(prefix)
            : state.payload < size ? chunk.subarray(0, Math.min(chunk.byteLength, size - state.payload))
            : state.stage === 1 ? encode.encode(suffix) : undefined
          if (!bytes) {
            state.completed = true
            controller.close()
            return
          }
          if (state.stage === 0) state.stage = 1
          else if (state.payload < size) state.payload += bytes.byteLength
          else state.stage = 2
          state.bytes += bytes.byteLength
          controller.enqueue(bytes)
        },
        cancel() { state.cancelled++ },
      }, { highWaterMark: 0 })
      return { body, state }
    }
    for (const [suffix, limit, forgedLength] of [
      ["/rename", BodyLimit.DEFAULT_LIMIT, false],
      ["/rename", BodyLimit.DEFAULT_LIMIT, true],
      ["/prompt", BodyLimit.UPLOAD_LIMIT, false],
    ] as const) {
      const body = suffix === "/rename"
        ? streamed(limit + chunk.byteLength, '{"title":"', '"}')
        : streamed(limit + chunk.byteLength, '{"prompt":{"text":"', '"},"resume":false}')
      const original = http.request("/api/session/" + own.id + suffix, ownerA, {
        method: "POST", body: body.body,
        headers: { "content-type": "application/json", ...(forgedLength ? { "content-length": "1" } : {}) },
      })
      expect(original.headers.get("content-length")).toBe(forgedLength ? "1" : null)
      const response = yield* Effect.promise(() => http.direct(original))
      expect(response.status).toBe(413)
      expect((yield* decode(response, ErrorBody))._tag).toBe("PayloadTooLargeError")
      expect(http.originals).toContain(original)
      expect(body.state.cancelled).toBe(1)
      expect(body.state.completed).toBe(false)
      expect(body.state.bytes).toBeGreaterThan(limit)
      expect(body.state.bytes).toBeLessThanOrEqual(limit + chunk.byteLength)
      expect(f.calls.resumes).toBe(0)
      expect(f.calls.wakes).toBe(0)
      expect(f.business.all("SELECT id FROM session_input")).toEqual([])
      expect(JSON.stringify(f.business.all("SELECT * FROM event"))).toBe(before)
      expect(f.control.pendingWriters(f.storage)).toEqual([])
    }
    // Actual bytes above the JSON cap still use the original 64 MiB upload cap.
    const insideUpload = streamed(BodyLimit.DEFAULT_LIMIT + chunk.byteLength, "{invalid", "")
    const allowedBytes = http.request("/api/session/" + own.id + "/prompt", ownerA, {
      method: "POST", headers: { "content-type": "application/json" }, body: insideUpload.body,
    })
    const malformed = yield* Effect.promise(() => http.direct(allowedBytes))
    expect(malformed.status).toBe(400)
    expect((yield* decode(malformed, ErrorBody))._tag).toBe("InvalidRequestError")
    expect(http.originals).toContain(allowedBytes)
    expect(insideUpload.state.completed).toBe(true)
    expect(insideUpload.state.cancelled).toBe(0)
    expect(f.calls.resumes).toBe(0)
    expect(f.calls.wakes).toBe(0)
    expect(f.business.all("SELECT id FROM session_input")).toEqual([])
    expect(JSON.stringify(f.business.all("SELECT * FROM event"))).toBe(before)
  }))
})
