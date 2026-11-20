import { expect, test } from "bun:test"
import { Effect, Fiber, Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { SessionAccess } from "@orchestra/schema/session-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import { barrier } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"
import { basic, decode, Info, List, teamSessionHttpFixture, profileA, profileB, oid, other } from "./fixture/team-session-http"

const Messages = Schema.Struct({ data: Schema.Array(SessionMessage.Message), namespace: Schema.optional(TeamProfile.SessionNamespace),
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }) })
const History = Schema.Struct({ data: Schema.Array(SessionEvent.Durable), hasMore: Schema.Boolean, namespace: Schema.optional(TeamProfile.SessionNamespace) })
const ErrorBody = Schema.Struct({ _tag: Schema.String, message: Schema.String })

test("http-owner-01: original Microsoft Request reaches admission and CRUD uses the configured placement", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const original = f.jsonRequest("/api/session", { id: "ses_http_original" })
    const response = yield* Effect.promise(() => http.mounted(original))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(http.originals[0]).toBe(original)
    const created = (yield* decode(response, Info)).data
    expect(created.location).toEqual(f.location)
    const again = yield* f.create(http, created.id)
    expect(again).toEqual(created)
    const read = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id)))
    expect(read.status).toBe(200)
    expect((yield* decode(read, Info)).data.id).toBe(created.id)
    const renamed = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session/" + created.id + "/rename", { title: "Owned title" })))
    expect(renamed.status).toBe(204)
    const messages = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id + "/message")))
    expect(messages.status).toBe(200)
    expect((yield* decode(messages, Messages)).data).toEqual([])
    const history = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id + "/history")))
    expect(history.status).toBe(200)
    const events = (yield* decode(history, History)).data
    expect(events.map((entry) => entry.type)).toContain("session.next.renamed")
    expect(JSON.stringify(events)).not.toContain("session.owner.bound")
  }))
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([{ session_id: "ses_http_original" }])
})

test("http-owner-02: two people and two Teams sharing the same placement have separate lists and uniform foreign denials", async () => {
  await using f = await teamSessionHttpFixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed( "ses_http_person_a")
    const team = yield* f.seed( "ses_http_team_b", profileB)
    const person = yield* f.seed( "ses_http_person_b", profileA, secondCookie)
    expect(team.location).toEqual(own.location)
    expect(person.projectID).toBe(own.projectID)
    for (const [profile, cookie, expected] of [[profileA, f.cookie, own.id], [profileB, f.cookie, team.id], [profileA, secondCookie, person.id]] as const) {
      const list = yield* Effect.promise(() => http.mounted(f.request("/api/session?limit=1", profile, cookie)))
      expect(list.status).toBe(200)
      expect((yield* decode(list, List)).data.map((item) => item.id)).toEqual([expected])
    }
    const before = f.calls.projects
    const refusals: unknown[] = []
    for (const [profile, cookie] of [[profileB, f.cookie], [profileA, secondCookie]] as const) {
      for (const suffix of ["", "/message", "/history", "/event", "/context", "/todo"]) {
        const denied = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + own.id + suffix, profile, cookie)))
        expect(denied.status).toBe(401)
        refusals.push(yield* decode(denied, ErrorBody))
      }
      const update = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + own.id + "/rename", profile, cookie,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{invalid" })))
      expect(update.status).toBe(401)
      refusals.push(yield* decode(update, ErrorBody))
    }
    const missing = yield* Effect.promise(() => http.mounted(f.request("/api/session/ses_http_unknown")))
    expect(missing.status).toBe(401)
    const missingBody = yield* decode(missing, ErrorBody)
    for (const value of refusals) expect(value).toEqual(missingBody)
    expect(f.calls.projects).toBe(before)
  }))
})

test("http-owner-03: Basic, query credentials, operator wildcard and fabricated owner metadata cannot replace Microsoft admission", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const requests = [
      f.rawRequest("/api/session", "", { headers: { authorization: basic } }),
      f.rawRequest("/api/session", "", { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }),
        "x-orchestra-operator": "*", "x-sf-principal": oid, "x-sf-access-revision": "invented" } }),
      f.rawRequest("/api/session?auth_token=" + btoa("orchestra:installed-test-secret"), f.cookie),
      f.rawRequest("/api/session", f.cookie, { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "administration",
        installationId: profileA.installationId, tenantId: profileA.tenantId }) } }),
      f.rawRequest("/api/session", f.cookie, { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team",
        profile: { ...profileA, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }) } }),
    ]
    for (const request of requests) {
      const response = yield* Effect.promise(() => http.mounted(request))
      expect(response.status).toBe(401)
    }
    expect(f.calls.projects).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})

test("http-owner-04: compiled generic groups deny even valid Basic before Location or payload decoding", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const owned = yield* f.create(http, "ses_http_generic_closed")
    const before = f.calls.projects
    const routes = [
      ["GET", "/api/session/" + owned.id], ["GET", "/api/event"], ["GET", "/api/reference"],
      ["GET", "/api/config"], ["PATCH", "/api/config"], ["GET", "/api/mcp"], ["PUT", "/api/mcp/known"],
      ["GET", "/api/provider"], ["PATCH", "/api/credential/known"], ["GET", "/api/trust"],
      ["POST", "/api/trust/approve"], ["GET", "/api/inbox"], ["POST", "/api/inbox"],
      ["GET", "/api/lean"], ["PATCH", "/api/lean"],
    ]
    for (const [method, path] of routes) {
      const response = yield* Effect.promise(() => http.generic(new Request(f.binding.origin + path + "?directory=" + encodeURIComponent(f.workspaceDirectory), {
        method, headers: { authorization: basic, "content-type": "application/json", cookie: f.cookie,
          "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }) },
        ...(method === "GET" ? {} : { body: "{invalid" }),
      })))
      expect(response.status).toBe(401)
    }
    expect(f.calls.projects).toBe(before)
    expect(f.metadata.locations).toBe(0)
    const health = yield* Effect.promise(() => http.generic(new Request(f.binding.origin + "/api/health", { headers: { authorization: basic } })))
    expect(health.status).toBe(200)
  }))
})

test("http-owner-05: unavailable installed metadata never falls back to generic Basic", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    for (const mode of ["missing", "failed"] as const) {
      f.metadata.mode = mode
      const response = yield* Effect.promise(() => http.generic(new Request(f.binding.origin + "/api/config", { headers: { authorization: basic } })))
      expect(response.status).toBe(401)
    }
    expect(f.calls.projects).toBe(0)
  }))
})

test("http-owner-06: private Session actions are explicit and references remain closed without a source ACL", async () => {
  await using f = await teamSessionHttpFixture({ actions: ["read", "create"] })
  await f.run((http) => Effect.gen(function* () {
    const created = yield* f.create(http, "ses_http_actions")
    for (const [suffix, body] of [
      ["/rename", { title: "forbidden" }], ["/prompt", { prompt: { text: "forbidden" }, resume: false }],
      ["/synthetic", { text: "forbidden", resume: false }], ["/fork", {}], ["/move", { location: f.location }],
      ["/shell", { command: "echo forbidden" }], ["/subagent-models", { policy: {} }],
    ] as const) {
      const response = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session/" + created.id + suffix, body)))
      expect(response.status).toBe(401)
    }
    yield* Effect.promise(() => f.writeGrants([{ ...productGrant(oid), sessionActions: SessionAccess.Actions, referenceActions: ["list"] }]))
    const reference = yield* Effect.promise(() => http.mounted(f.request("/api/reference?directory=" + encodeURIComponent(f.workspaceDirectory))))
    expect(reference.status).toBe(401)
    expect(f.calls.resumes).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session_input")).toEqual([])
})

test("http-owner-07: foreign placement is refused for creation and movement", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const before = f.calls.projects
    const create = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session", {
      id: "ses_http_foreign_placement", location: { directory: "/not-the-installed-placement" },
    })))
    expect(create.status).toBe(401)
    expect(f.calls.projects).toBe(before)
    const owned = yield* f.create(http, "ses_http_placement")
    const move = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session/" + owned.id + "/move", {
      location: { directory: "/not-the-installed-placement" },
    })))
    expect(move.status).toBe(401)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([{ id: "ses_http_placement" }])
})

test("http-owner-08: SQL pages contain only the current owner and cursors cannot change Team, person, revision or purpose", async () => {
  await using f = await teamSessionHttpFixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    yield* f.seed( "ses_http_page_1")
    yield* f.seed( "ses_http_page_foreign", profileB)
    yield* f.seed( "ses_http_page_2")
    yield* f.seed( "ses_http_page_person", profileA, secondCookie)
    yield* f.seed( "ses_http_page_3")
    const first = yield* Effect.promise(() => http.mounted(f.request("/api/session?limit=1&order=asc")))
    const page = yield* decode(first, List)
    expect(page.data.map((item) => item.id)).toEqual(["ses_http_page_1"])
    const token = page.cursor.next
    expect(token?.startsWith("sf1.")).toBe(true)
    if (!token) throw new Error("Actual pagination token required")
    const next = yield* Effect.promise(() => http.mounted(f.request("/api/session?limit=1&cursor=" + encodeURIComponent(token))))
    expect((yield* decode(next, List)).data.map((item) => item.id)).toEqual(["ses_http_page_2"])
    for (const [profile, cookie] of [[profileB, f.cookie], [profileA, secondCookie]] as const) {
      const foreign = yield* Effect.promise(() => http.mounted(f.request("/api/session?cursor=" + encodeURIComponent(token), profile, cookie)))
      expect(foreign.status).toBe(400)
    }
    const spliced = yield* Effect.promise(() => http.mounted(f.request("/api/session/ses_http_page_1/message?cursor=" + encodeURIComponent(token))))
    expect(spliced.status).toBe(400)
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")
    const forged = yield* Effect.promise(() => http.mounted(f.request("/api/session?cursor=" + encodeURIComponent(tampered))))
    expect(forged.status).toBe(400)
    yield* Effect.promise(() => f.writeGrants([{ ...productGrant(oid), sessionActions: ["read", "create"] }]))
    const stale = yield* Effect.promise(() => http.mounted(f.request("/api/session?cursor=" + encodeURIComponent(token))))
    expect(stale.status).toBe(400)
  }))
})

test("http-owner-09: logout while Project acquisition awaits prevents creation and clears writer permits", async () => {
  await using f = await teamSessionHttpFixture()
  const pause = barrier()
  f.hooks.beforeProject = pause.hold
  await f.run((http) => Effect.gen(function* () {
    const pending = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session", { id: "ses_http_after_logout" }))).pipe(Effect.forkChild)
    try {
      yield* Effect.promise(() => pause.entered)
      expect((yield* Effect.promise(() => f.logout(f.cookie)))?.status).toBe(204)
    } finally { pause.release() }
    const response = yield* Fiber.join(pending)
    expect(response.status).toBe(401)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
  expect(f.control.pendingWriters(f.storage)).toEqual([])
})

test("http-owner-10: a current Case resource exclusion is applied before pagination and Session lookup", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const hidden = yield* f.seed( "ses_http_acl_1")
    const visible = yield* f.seed( "ses_http_acl_2")
    const linked = yield* Effect.promise(() => f.linkCaseResource(hidden.id))
    yield* Effect.promise(() => linked.participants([other]))
    const page = yield* Effect.promise(() => http.mounted(f.request("/api/session?limit=1&order=asc")))
    expect((yield* decode(page, List)).data.map((item) => item.id)).toEqual([visible.id])
    const read = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + hidden.id)))
    expect(read.status).toBe(401)
  }))
})

test("http-owner-11: body/query owners and an old cookie cannot retarget a saved session", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const id = Session.ID.make("ses_http_no_retarget")
    yield* f.create(http, id)
    const rejected = yield* Effect.promise(() => http.mounted(f.jsonRequest("/api/session/" + id + "/rename?teamObjectId=" + profileA.teamObjectId,
      { title: "wrong Team", owner: { profile: profileA, principal: { tenantId: profileA.tenantId, principalObjectId: oid } } }, profileB)))
    expect(rejected.status).toBe(401)
    yield* Effect.promise(() => f.logout(f.cookie))
    const denied = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + id)))
    expect(denied.status).toBe(401)
  }))
})

test("http-owner-12: mutations require the exact Origin before admission even with a valid cookie and Team selector", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    for (const origin of [undefined, "https://cross-site.example.test"]) {
      const headers = { "content-type": "application/json",
        "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }),
        ...(origin ? { origin } : {}),
      }
      const response = yield* Effect.promise(() => http.mounted(f.rawRequest("/api/session", f.cookie, {
        method: "POST", headers, body: JSON.stringify({ id: "ses_origin_required" }),
      })))
      expect(response.status).toBe(401)
    }
    const crossSite = yield* Effect.promise(() => http.mounted(f.request("/api/session", profileA, f.cookie, {
      headers: { "sec-fetch-site": "cross-site" },
    })))
    expect(crossSite.status).toBe(401)
    expect(http.originals).toEqual([])
    expect(f.calls.projects).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT id FROM event")).toEqual([])
})

test("http-owner-13: admitted empty collections and Session responses label the current full owner and generation without changing durable bytes", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const expected = { version: 1, owner: { profile: profileA,
      principal: { tenantId: profileA.tenantId, principalObjectId: oid } }, authorityGeneration: 1 }
    const empty = yield* Effect.promise(() => http.mounted(f.request("/api/session")))
    const listed = yield* decode(empty, List)
    expect(listed.data).toEqual([])
    expect(listed.namespace).toEqual(expected)
    const created = yield* f.create(http, "ses_http_namespace")
    expect(created.namespace).toEqual(expected)
    const bytes = JSON.stringify(f.business.all("SELECT * FROM event"))
    const read = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id)))
    const info = yield* decode(read, Info)
    expect(info.data.namespace?.owner).toEqual(expected.owner)
    expect(info.data.namespace).toEqual(expected)
    const messages = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id + "/message")))
    expect((yield* decode(messages, Messages)).namespace).toEqual(expected)
    const history = yield* Effect.promise(() => http.mounted(f.request("/api/session/" + created.id + "/history")))
    const replay = yield* decode(history, History)
    expect(replay.namespace).toEqual(expected)
    expect(JSON.stringify(replay.data)).not.toContain('"namespace":')
    const active = yield* Effect.promise(() => http.mounted(f.request("/api/session/active")))
    expect(yield* Effect.promise(() => active.json())).toEqual({ data: {}, namespace: expected })
    expect(JSON.stringify(f.business.all("SELECT * FROM event"))).toBe(bytes)
  }))
  f.advance()
  await f.run((http) => Effect.gen(function* () {
    const response = yield* Effect.promise(() => http.mounted(f.request("/api/session/ses_http_namespace")))
    const info = yield* decode(response, Info)
    expect(info.data.namespace?.owner.profile).toEqual(profileA)
    expect(info.data.namespace?.authorityGeneration).toBe(2)
  }))
})


test("http-owner-14: an installed local operator cannot substitute generic Basic for Microsoft Session admission", async () => {
  await using f = await teamSessionHttpFixture()
  f.metadata.authMode = "local-operator"
  await f.run((http) => Effect.gen(function* () {
    for (const [method, path] of [
      ["GET", "/api/session"], ["POST", "/api/session"],
      ["GET", "/api/session/ses_known/message"], ["GET", "/api/session/ses_known/history"],
      ["GET", "/api/event"], ["GET", "/api/reference"],
    ]) {
      const response = yield* Effect.promise(() => http.generic(new Request(f.binding.origin + path, {
        method, headers: { authorization: basic, "content-type": "application/json" },
        ...(method === "POST" ? { body: "{invalid" } : {}),
      })))
      expect(response.status).toBe(401)
    }
    expect(f.calls.projects).toBe(0)
    expect(f.metadata.locations).toBe(0)
    expect((yield* Effect.promise(() => http.generic(new Request(f.binding.origin + "/api/health", {
      headers: { authorization: basic },
    })))).status).toBe(200)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
})
