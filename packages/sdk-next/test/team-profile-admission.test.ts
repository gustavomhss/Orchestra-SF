import { expect, test } from "bun:test"
import { Orchestra } from "@orchestra/client/effect"
import { CapabilityOperator } from "@orchestra/core/capability/operator/index"
import { Session } from "@orchestra/schema/session"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Effect, Option, Stream } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { teamSessionHttpFixture, profileA, profileB, other, oid } from "../../server/test/fixture/team-session-http"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import { makeOperatorTransport } from "../src/operator-transport"
import { requireTechnicalClient } from "../src/technical-client"

type Fixture = Awaited<ReturnType<typeof teamSessionHttpFixture>>

function installedClient(
  fixture: Fixture,
  handler: (original: Request) => Promise<Response>,
  profile: TeamProfile.Ref = profileA,
  cookie = fixture.cookie,
  requests: Request[] = [],
) {
  const fetch = Object.assign((input: RequestInfo | URL, init?: RequestInit) => {
    // This is the first server Request, constructed exactly where fetch would
    // deliver it; the installation captures and revalidates this same object.
    const original = new Request(input, init)
    requests.push(original)
    return handler(original)
  }, { preconnect: () => undefined }) satisfies typeof globalThis.fetch
  return Orchestra.make({
    baseUrl: fixture.binding.origin + fixture.config.mount,
    headers: { cookie, origin: fixture.binding.origin,
      "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }) },
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.provideService(FetchHttpClient.Fetch, fetch))
}

test("sdk-team-01: the official Effect client preserves the installed prefix, original request and current full Session namespace", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const requests: Request[] = []
    const client = yield* installedClient(f, http.mounted, profileA, f.cookie, requests)
    const owner = { profile: profileA, principal: { tenantId: profileA.tenantId, principalObjectId: oid } }
    const empty = yield* client.sessions.list()
    expect(empty.data).toEqual([])
    expect(empty.namespace).toEqual({ version: 1, owner, authorityGeneration: 1 })
    const session = yield* client.sessions.create({ id: Session.ID.make("ses_sdk_installed") })
    expect(session.namespace).toEqual(empty.namespace)
    expect((yield* client.sessions.get({ sessionID: session.id })).namespace).toEqual(empty.namespace)
    expect((yield* client.messages.list({ sessionID: session.id })).namespace).toEqual(empty.namespace)
    const history = yield* client.sessions.history({ sessionID: session.id })
    expect(history.namespace).toEqual(empty.namespace)
    expect(history.data.map((event) => event.type)).toContain("session.next.created")
    expect(JSON.stringify(history.data)).not.toContain('"namespace":')
    const active = yield* client.sessions.active()
    expect(active).toEqual({ data: {}, namespace: empty.namespace })
    expect(requests).toHaveLength(6)
    expect(http.originals[0]).toBe(requests[0])
    expect(http.originals.every((request) => requests.includes(request))).toBe(true)
    for (const request of requests) {
      expect(new URL(request.url).pathname.startsWith(f.config.mount + "/api/")).toBe(true)
      expect(request.headers.get("cookie")).toBe(f.cookie)
      expect(request.headers.has("authorization")).toBe(false)
      expect(request.headers.has("x-orchestra-location")).toBe(false)
    }
  }))
})

test("sdk-team-02: a known Session cannot be read through another person or Team, nor retried after current grant removal", async () => {
  await using f = await teamSessionHttpFixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    const own = yield* f.seed("ses_sdk_owned")
    const before = f.calls.projects
    for (const [profile, cookie] of [[profileB, f.cookie], [profileA, secondCookie]] as const) {
      const client = yield* installedClient(f, http.mounted, profile, cookie)
      const failure = yield* client.sessions.get({ sessionID: own.id }).pipe(Effect.flip)
      expect(failure._tag).toBe("UnauthorizedError")
      expect((yield* client.sessions.list()).data).toEqual([])
    }
    expect(f.calls.projects).toBe(before)
    const original = yield* installedClient(f, http.mounted)
    expect((yield* original.sessions.get({ sessionID: own.id })).id).toBe(own.id)
    yield* Effect.promise(() => f.writeGrants([{ ...productGrant(oid), sessionActions: [] }]))
    expect((yield* original.sessions.get({ sessionID: own.id }).pipe(Effect.flip))._tag).toBe("UnauthorizedError")
    expect((yield* original.sessions.list().pipe(Effect.flip))._tag).toBe("UnauthorizedError")
  }))
})

test("sdk-team-03: actual wildcard operator renewal cannot replace Microsoft admission on generic or mounted routes", async () => {
  await using f = await teamSessionHttpFixture({}, { genericPassword: null })
  await f.run((http) => Effect.gen(function* () {
    const clock = { now: 1 }
    const issued: string[] = []
    const operator = yield* CapabilityOperator.make({
      principal: "sdk-technical-host", scope: { placements: "instance", actions: ["*"] },
      now: () => clock.now, ttlMillis: 10, maxCapabilities: 2,
    })
    const transport = yield* makeOperatorTransport(async (original) => {
      const bearer = original.headers.get("authorization")?.slice(7) ?? ""
      // This token is genuinely issued and valid in its owning operator scope.
      await Effect.runPromise(operator.authenticate(bearer))
      issued.push(bearer)
      return new URL(original.url).pathname.startsWith(f.config.mount + "/")
        ? http.mounted(original) : http.generic(original)
    }, operator)
    const client = yield* installedClient(f, http.mounted)
    expect((yield* client.sessions.list()).data).toEqual([])
    yield* Effect.promise(() => f.logout(f.cookie))
    for (const round of [0, 1]) {
      if (round) clock.now += 11
      for (const path of ["/api/session", f.config.mount + "/api/session"]) {
        const response = yield* Effect.promise(() => transport.fetch(f.binding.origin + path, {
          headers: { ...transport.headers, cookie: f.cookie, origin: f.binding.origin,
            "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }) },
        }))
        expect(response.status).toBe(401)
      }
    }
    expect(issued).toHaveLength(4)
    expect(issued[0]).toBe(issued[1])
    expect(issued[2]).toBe(issued[3])
    expect(issued[0]).not.toBe(issued[2])
    expect((yield* client.sessions.list().pipe(Effect.flip))._tag).toBe("UnauthorizedError")
    expect(f.calls.projects).toBe(0)
  }))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})

test("sdk-team-04: the embedded technical adapter rejects admitted corporate envelopes before exposing data or stream frames", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const session = yield* f.seed("ses_sdk_technical_fence")
    const client = requireTechnicalClient(yield* installedClient(f, http.mounted))
    for (const read of [
      client.sessions.get({ sessionID: session.id }),
      client.sessions.list(),
      client.sessions.history({ sessionID: session.id }),
      client.messages.list({ sessionID: session.id }),
      client.sessions.active(),
    ]) expect((yield* read.pipe(Effect.flip))._tag).toBe("UnauthorizedError")
    const exposed: unknown[] = []
    for (const stream of [client.events.subscribe(), client.sessions.events({ sessionID: session.id })]) {
      const failure = yield* stream.pipe(
        Stream.tap((value) => Effect.sync(() => { exposed.push(value) })),
        Stream.runHead,
        Effect.flip,
      )
      expect(failure._tag).toBe("UnauthorizedError")
    }
    expect(exposed).toEqual([])
  }))
})

test("sdk-team-05: the official live stream carries the admitted namespace and closes when its Microsoft session is revoked", async () => {
  await using f = await teamSessionHttpFixture()
  await f.run((http) => Effect.gen(function* () {
    const client = yield* installedClient(f, http.mounted)
    const first = yield* client.events.subscribe().pipe(Stream.runHead, Effect.map(Option.getOrThrow))
    if (!("event" in first)) throw new Error("Installed stream namespace required")
    expect(first.event.type).toBe("server.connected")
    expect(first.namespace.owner.profile).toEqual(profileA)
    expect(first.namespace.owner.principal.principalObjectId).toBe(oid)
    expect(first.namespace.authorityGeneration).toBe(1)
    yield* Effect.promise(() => f.logout(f.cookie))
    expect((yield* client.events.subscribe().pipe(Stream.runHead, Effect.flip))._tag).toBe("UnauthorizedError")
  }))
})
