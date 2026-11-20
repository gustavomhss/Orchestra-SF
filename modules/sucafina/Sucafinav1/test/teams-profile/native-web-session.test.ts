import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { OrchestraEventTransport } from "../../../../../packages/protocol/src/groups/event.ts"
import { nativeTeamWebFixture } from "./native-web-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { oid, other } from "../microsoft-login/oidc-fixture.ts"

const actions = ["read", "create", "prompt", "run", "control"] as const
const Info = Schema.Struct({ data: Session.Info, namespace: TeamProfile.SessionNamespace })
const List = Schema.Struct({ data: Schema.Array(Session.Info), namespace: TeamProfile.SessionNamespace,
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }) })
const decode = async <A>(response: Response, schema: Schema.Decoder<A>) =>
  Schema.decodeUnknownSync(Schema.toCodecJson(schema))(await response.json())
type Fixture = Awaited<ReturnType<typeof nativeTeamWebFixture>>
const request = (f: Fixture, suffix: string, profile = profileA, cookie = f.cookie, body?: unknown) =>
  f.request(suffix, cookie, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }),
      ...(body === undefined ? {} : { origin: f.binding.origin, "content-type": "application/json" }),
    },
  })

test("native-session-fixture-01: real HTTP remains live for create, recorded prompt and owner-scoped lists", async () => {
  await using f = await nativeTeamWebFixture({ enabled: [profileA, profileB], sessionActions: actions })
  expect(f.runtimeState).toEqual({ opened: true, closed: false })
  expect(f.configured).toEqual([profileA, profileB])
  const empty = await f.handle(request(f, "/api/session"))
  expect(empty.status).toBe(200)
  const initial = await decode(empty, List)
  expect(initial.data).toEqual([])
  expect(initial.namespace.owner.profile).toEqual(profileA)
  expect(initial.namespace.owner.principal).toEqual(Schema.decodeUnknownSync(TeamProfile.Principal)({
    tenantId: profileA.tenantId, principalObjectId: oid,
  }))
  const original = request(f, "/api/session", profileA, f.cookie, { id: "ses_native_factory_a" })
  const response = await f.handle(original)
  expect(response.status).toBe(200)
  const created = await decode(response, Info)
  expect(f.sessionRequests).toContain(original)
  expect(created.data.namespace).toEqual(created.namespace)
  expect(created.namespace).toEqual(initial.namespace)
  expect(created.data.location).toEqual(f.location)
  const prompt = await f.handle(request(f, "/api/session/" + created.data.id + "/prompt", profileA, f.cookie, {
    id: "msg_native_fixture_prompt", prompt: { text: "Durably admitted, recording-only prompt." },
  }))
  expect(prompt.status).toBe(200)
  expect(f.sessionCalls.wakes).toBe(1)
  expect(f.sessionCalls.resumes).toBe(0)
  expect(f.business.all("SELECT session_id FROM session_input")).toEqual([{ session_id: created.data.id }])
  const own = await decode(await f.handle(request(f, "/api/session")), List)
  expect(own.data.map((session) => session.id)).toEqual([created.data.id])
  const team = await decode(await f.handle(request(f, "/api/session", profileB)), List)
  expect(team.data).toEqual([])
  expect(team.namespace.owner.profile).toEqual(profileB)
  const person = await decode(await f.handle(request(f, "/api/session", profileA, await f.login(other))), List)
  expect(person.data).toEqual([])
  expect(person.namespace.owner.principal.principalObjectId).toBe(
    Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)(other),
  )
  expect(f.metadataCalls.locations).toBe(0)
})

test("native-session-fixture-02: an already open SSE sees a later real Created and close drains its graph", async () => {
  const f = await nativeTeamWebFixture({ sessionActions: actions })
  const stream = reader(await f.handle(request(f, "/api/event")))
  try {
    const connected = await stream.next()
    expect(connected?.event.type).toBe("server.connected")
    expect(connected?.namespace.owner.profile).toEqual(profileA)
    const response = await f.handle(request(f, "/api/session", profileA, f.cookie, { id: "ses_native_factory_incremental" }))
    expect(response.status).toBe(200)
    const created = await decode(response, Info)
    const event = await stream.next()
    expect(event?.event.type).toBe("session.next.created")
    if (!event || event.event.type !== "session.next.created") throw new Error("Actual incremental Created event required")
    expect(event.event.data.sessionID).toBe(created.data.id)
    expect(event.namespace).toEqual(created.namespace)
    const ended = stream.next().catch(() => undefined)
    await f.close()
    expect(await ended).toBeUndefined()
    expect(f.runtimeState).toEqual({ opened: true, closed: true })
    expect(() => f.business.all("SELECT 1")).toThrow()
    await f.close()
  } finally {
    await stream.cancel().catch(() => undefined)
    await f.close()
  }
})

test("native-session-fixture-03: the existing no-Team admin fixture gains neither chat grants nor business content", async () => {
  await using f = await nativeTeamWebFixture({ teams: false, enabled: [], direct: [], roles: false, grants: [] })
  expect(f.configured).toEqual([])
  expect(f.sessionActions).toEqual([])
  const context = await f.handle(f.contextRequest("administration"))
  expect(context.status).toBe(200)
  const value = await context.json()
  expect(value.context.profile.administration.available).toBe(true)
  const denied = await f.handle(request(f, "/api/session"))
  expect(denied.status).toBe(401)
  expect(f.sessionCalls.projects).toBe(0)
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})

function reader(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/event-stream")
  if (!response.body) throw new Error("Actual event response body required")
  const input = response.body.getReader()
  const decoder = new TextDecoder()
  const state = { buffer: "" }
  return {
    async next() {
      while (true) {
        const delimiter = state.buffer.indexOf("\n\n")
        if (delimiter >= 0) {
          const frame = state.buffer.slice(0, delimiter)
          state.buffer = state.buffer.slice(delimiter + 2)
          const data = frame.split("\n").filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim()).join("\n")
          if (!data) continue
          const value = Schema.decodeUnknownSync(Schema.toCodecJson(OrchestraEventTransport))(JSON.parse(data))
          if (!("event" in value)) throw new Error("Canonical corporate event namespace required")
          return value
        }
        const chunk = await input.read()
        if (chunk.done) return undefined
        state.buffer += decoder.decode(chunk.value, { stream: true })
      }
    },
    cancel: () => input.cancel(),
  }
}
