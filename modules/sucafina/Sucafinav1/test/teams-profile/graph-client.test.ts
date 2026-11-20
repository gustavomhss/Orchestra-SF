import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createEntraClient } from "../../runtime/entra-client.ts"
import type { EntraClient, EntraTeamsInput } from "../../runtime/local-contract.ts"
import { group, microsoftFixture, oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"

const graph = "https://graph.microsoft.com/v1.0"
const teamA = "77777777-7777-4777-8777-777777777777"
const teamB = "88888888-8888-4888-8888-888888888888"
const row = (id = teamA, displayName = "Same display name") => ({ id, tenantId: tenant, displayName, isArchived: false })
const epoch = Math.floor(Date.UTC(2026, 10, 14, 20, 0, 0) / 1000)

async function login(f: Awaited<ReturnType<typeof microsoftFixture>>, client = f.client) {
  const verifier = "synthetic-teams-pkce-verifier-with-at-least-43-characters"
  const redirectUri = "https://mvp.example.test/sucafina/auth/callback"
  const location = await client.authorization({ state: "synthetic-teams-state", nonce: "synthetic-teams-nonce", challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri })
  return client.exchange({ code: await f.issueCode(location), verifier, redirectUri, nonce: "synthetic-teams-nonce" })
}

async function read(client: EntraClient, input: EntraTeamsInput) {
  if (!client.joinedTeams) throw new Error("Actual Teams capability reader required")
  return client.joinedTeams(input)
}

const input = (session: Awaited<ReturnType<typeof login>>) => ({ tokens: session.tokens, principal: { tenantId: tenant, principalObjectId: session.person.id } })
const joinedRequests = (f: Awaited<ReturnType<typeof microsoftFixture>>) => f.requests.filter((request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams")

test("graph-client-01: signed Microsoft resource principal precedes the direct Teams observation", async () => {
  const f = await microsoftFixture({ teams: "direct", claims: { email: "admin@example.test", roles: ["admin"], _claim_names: { groups: "src" }, _claim_sources: { src: { endpoint: "https://untrusted.example.test/overage" } } } })
  f.directTeams.set(oid, [row()])
  const session = await login(f)
  expect(joinedRequests(f)).toHaveLength(0)
  const result = await read(f.client, input(session))
  expect(result).toEqual({ state: "complete", tenantId: tenant, principalObjectId: oid, source: "joinedTeams", membership: "direct", teams: [{ teamObjectId: teamA, name: "Same display name", archived: false }] })
  expect(f.requests.findIndex((request) => request.url === f.metadata.jwks_uri)).toBeLessThan(f.requests.findIndex((request) => new URL(request.url).pathname === "/v1.0/me"))
  expect(Object.isFrozen(result)).toBe(true)
  if (result.state !== "complete") throw new Error("Complete Graph observation required")
  expect(Object.isFrozen(result.teams)).toBe(true)
  expect(Object.isFrozen(result.teams[0])).toBe(true)
  expect(JSON.stringify(result)).not.toContain(session.tokens.accessToken)
  expect(JSON.stringify(result)).not.toContain("admin@example.test")
  expect(f.requests.some((request) => request.url.startsWith("https://untrusted.example.test"))).toBe(false)
})

for (const invalid of [
  { name: "tenant", claims: { tid: other } },
  { name: "audience", claims: { aud: other } },
  { name: "nonce", claims: { nonce: "wrong" } },
  { name: "expiry", claims: { iat: epoch - 7200, exp: epoch - 3600 } },
  { name: "object identity", claims: { oid: other } },
]) {
  test(`graph-client-01: signed invalid ${invalid.name} never reaches Teams`, async () => {
    const f = await microsoftFixture({ teams: "direct", claims: invalid.claims })
    await expect(login(f)).rejects.toThrow()
    expect(joinedRequests(f)).toHaveLength(0)
    if (invalid.name !== "object identity") expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
  })
}

test("graph-client-01: a signed unsupported JWT algorithm fails before Graph", async () => {
  const f = await microsoftFixture({ teams: "direct", algorithm: "PS256" })
  await expect(login(f)).rejects.toThrow()
  expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
})

test("graph-client-01: another tenant or principal cannot label the current delegated token", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  f.directTeams.set(oid, [row()])
  const session = await login(f)
  expect(await read(f.client, { ...input(session), principal: { tenantId: other, principalObjectId: oid } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(joinedRequests(f)).toHaveLength(0)
  expect(await read(f.client, { ...input(session), principal: { tenantId: tenant, principalObjectId: other } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(joinedRequests(f)).toHaveLength(0)
})

test("graph-client-02: role group membership never creates Team membership or admin authority", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  expect(await f.client.resolve(session.tokens.accessToken, [{ surface: "dashboard", role: "admin", entra: `group:${group}`, version: 0, by: "" }])).toMatchObject({ roles: [{ surface: "dashboard", role: "admin" }] })
  expect(await read(f.client, input(session))).toEqual({ state: "complete", tenantId: tenant, principalObjectId: oid, source: "joinedTeams", membership: "direct", teams: [] })
  f.account.groups.splice(0)
  f.directTeams.set(oid, [row(group)])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: group }] })
  expect(await f.client.resolve(session.tokens.accessToken, [{ surface: "dashboard", role: "admin", entra: `group:${group}`, version: 0, by: "" }])).toEqual({ id: oid, roles: [], canWrite: false })
})

test("graph-client-03: disabled capability, missing consent and expired tokens are distinct with no Graph call", async () => {
  const minimal = await microsoftFixture()
  await login(minimal)
  expect(minimal.client.joinedTeams).toBeUndefined()
  expect(joinedRequests(minimal)).toHaveLength(0)

  for (const grantedScopes of ["openid profile offline_access User.Read"]) {
    const f = await microsoftFixture({ teams: "direct", grantedScopes })
    const session = await login(f)
    const count = f.requests.length
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "consent_required" })
    expect(f.requests).toHaveLength(count)
  }
  const legacy = await microsoftFixture({ teams: "direct" })
  const legacySession = await login(legacy)
  const observed = legacy.requests.length
  expect(await read(legacy.client, { ...input(legacySession), tokens: { accessToken: legacySession.tokens.accessToken, expiresAt: legacySession.tokens.expiresAt } })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(legacy.requests).toHaveLength(observed)

  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.clock.value = session.tokens.expiresAt
  const count = f.requests.length
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "token_expired" })
  expect(f.requests).toHaveLength(count)
})

for (const failure of [
  { status: 401, reason: "unauthenticated" },
  { status: 403, reason: "forbidden" },
  { status: 429, reason: "throttled" },
  { status: 503, reason: "provider_unavailable" },
]) {
  test(`graph-client-03: Graph ${failure.status} is not an empty eligible list`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
      ? Response.json({ error: { message: `Do not expose ${session.tokens.accessToken}` } }, { status: failure.status, ...(failure.status === 429 ? { headers: { "retry-after": "7" } } : {}) })
      : undefined
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: failure.reason, ...(failure.status === 429 ? { retryAfterMs: 7000 } : {}) })
    expect(joinedRequests(f)).toHaveLength(1)
  })
}

for (const body of ["not-json", '{"value":[', '{"value":null}', '[]']) {
  test(`graph-client-03: invalid or truncated Graph payload is unavailable (${body})`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? new Response(body) : undefined
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "invalid_response" })
  })
}

test("graph-client-03: a failed second page discards every first-page row", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => {
    const url = new URL(request.url)
    if (url.pathname !== "/v1.0/me/joinedTeams") return undefined
    return url.search ? Response.json({ error: "forbidden" }, { status: 403 }) : Response.json({ value: [row()], "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=second` })
  }
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "forbidden" })
  expect(joinedRequests(f)).toHaveLength(2)
})

test("graph-client-03: the entire paginated read has a deadline even when transport ignores abort", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? new Promise<Response>(() => {}) : undefined
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "timeout" })
  expect(joinedRequests(f)).toHaveLength(1)
}, 20000)

test("graph-client-04: consume complete pagination without requiring unsupported $count", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => {
    const url = new URL(request.url)
    if (url.pathname !== "/v1.0/me/joinedTeams") return undefined
    return url.search ? Response.json({ value: [row(teamB)] }) : Response.json({ value: [row()], "@odata.count": 2, "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=second` })
  }
  const result = await read(f.client, input(session))
  expect(result).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA }, { teamObjectId: teamB }] })
  expect(joinedRequests(f)).toEqual([{ method: "GET", url: `${graph}/me/joinedTeams` }, { method: "GET", url: `${graph}/me/joinedTeams?$skiptoken=second` }])
})

for (const next of [
  "https://untrusted.example.test/v1.0/me/joinedTeams",
  `${graph}/users`,
  `${graph}/groups`,
  `${graph}/me/checkMemberGroups`,
  `${graph}/me/associatedTeams`,
  `${graph}/teams/${teamA}/channels`,
  "https://user:secret@graph.microsoft.com/v1.0/me/joinedTeams",
  `${graph}/me/joinedTeams#fragment`,
  `${graph}/me/joinedTeams?$filter=displayName`,
  `${graph}/me/joinedTeams?$skiptoken=a&$skiptoken=b`,
  `${graph}/me/joinedTeams?$skiptoken=`,
  `${graph}/me/joinedTeams`,
]) {
  test(`graph-client-04/06: no credential or write can follow rejected nextLink ${next}`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json({ value: [row()], "@odata.nextLink": next }) : undefined
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "invalid_response" })
    expect(joinedRequests(f)).toHaveLength(1)
    expect(f.requests.every((request) => request.method === "GET" || request.url === f.metadata.token_endpoint)).toBe(true)
    expect(f.requests.some((request) => request.url.startsWith("https://untrusted.example.test"))).toBe(false)
  })
}

for (const data of [
  { value: [row(), row()] },
  { value: [row(), row(teamA.toUpperCase(), "Conflicting label")] },
  { value: [row()], "@odata.count": 0 },
  { value: [row()], "@odata.count": "1" },
  { value: [row()], "@odata.count": -1 },
  { value: [row()], "@odata.nextLink": null },
]) {
  test(`graph-client-04: reject duplicate identities and malformed totals/continuations ${JSON.stringify(data)}`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json(data) : undefined
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "invalid_response" })
  })
}

test("graph-client-04: advertised missing rows are incomplete even with no nextLink", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json({ value: [row()], "@odata.count": 2 }) : undefined
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "incomplete" })
})

test("graph-client-04: repeated identity or conflicting total on later page never yields a partial success", async () => {
  for (const second of [{ value: [row()] }, { value: [row(teamB)], "@odata.count": 3 }]) {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => {
      const url = new URL(request.url)
      if (url.pathname !== "/v1.0/me/joinedTeams") return undefined
      return Response.json(url.search ? second : { value: [row()], "@odata.count": 2, "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=second` })
    }
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "invalid_response" })
  }
})

test("graph-client-04: Team count and continuation beyond the configured bound both fail closed", async () => {
  for (const data of [{ value: [row(), row(teamB)] }, { value: [row()], "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=second` }]) {
    const f = await microsoftFixture({ teams: "direct" })
    const client = createEntraClient({ ...f.options, directoryLimit: 1 })
    const session = await login(f, client)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json(data) : undefined
    expect(await read(client, input(session))).toEqual({ state: "unavailable", reason: "limit_exceeded" })
  }
})

test("graph-client-04: unique empty pages cannot evade the page limit", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json({ value: [], "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=page-${joinedRequests(f).length}` }) : undefined
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "limit_exceeded" })
  expect(joinedRequests(f)).toHaveLength(100)
})

test("graph-client-04: total response bytes remain bounded across individually valid pages", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.hooks.before = (request) => {
    const url = new URL(request.url)
    if (url.pathname !== "/v1.0/me/joinedTeams") return undefined
    return Response.json({ value: [row(url.search ? teamB : teamA)], description: "x".repeat(1100000), ...(url.search ? {} : { "@odata.nextLink": `${graph}/me/joinedTeams?$skiptoken=second` }) })
  }
  expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "limit_exceeded" })
})

for (const invalid of [
  { ...row(), id: "not-an-object-id" },
  { ...row(), tenantId: other },
  { ...row(), tenantId: undefined },
  { ...row(), displayName: "" },
  { ...row(), isArchived: undefined },
  { ...row(), "@odata.type": "#microsoft.graph.group" },
  { ...row(), membershipType: "shared" },
  { ...row(), membershipType: "private" },
]) {
  test(`graph-client-05: unsupported identity or channel association cannot masquerade as a Team ${JSON.stringify(invalid)}`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams" ? Response.json({ value: [invalid] }) : undefined
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: "invalid_response" })
  })
}

test("graph-client-05: rename preserves ID; duplicate names and recreation preserve distinct IDs", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.directTeams.set(oid, [row()])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA }] })
  f.directTeams.set(oid, [row(teamA, "Renamed")])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA, name: "Renamed" }] })
  f.directTeams.set(oid, [row(teamA), row(teamB)])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA }, { teamObjectId: teamB }] })
  f.directTeams.set(oid, [row(teamB)])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamB }] })
})

test("graph-client-06: only GET Teams reads and existing checkMemberGroups POST are issued", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  await read(f.client, input(session))
  await f.client.resolve(session.tokens.accessToken, [{ surface: "dashboard", role: "viewer", entra: `group:${group}`, version: 0, by: "" }])
  expect(f.requests.filter((request) => request.url.startsWith(graph) && request.method !== "GET")).toEqual([{ method: "POST", url: `${graph}/me/checkMemberGroups` }])
  expect(f.requests.some((request) => ["PATCH", "PUT", "DELETE"].includes(request.method))).toBe(false)
})

test("graph-client-07: no cache promotes a removed Team or restores empty role mappings", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.directTeams.set(oid, [row()])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA }] })
  expect(await f.client.resolve(session.tokens.accessToken, [])).toEqual({ id: oid, roles: [], canWrite: false })
  f.directTeams.set(oid, [])
  f.account.groups.splice(0)
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [] })
  expect(await f.client.resolve(session.tokens.accessToken, [{ surface: "dashboard", role: "admin", entra: `group:${group}`, version: 0, by: "" }])).toEqual({ id: oid, roles: [], canWrite: false })
  expect(await f.client.resolve(session.tokens.accessToken, [])).toEqual({ id: oid, roles: [], canWrite: false })
})

test("graph-client-07: current group roles are reread after a suspended Team observation", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  f.directTeams.set(oid, [row()])
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  f.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== "/v1.0/me/joinedTeams") return undefined
    entered.resolve()
    await release.promise
    return undefined
  }
  const pending = read(f.client, input(session))
  await entered.promise
  f.account.groups.splice(0)
  release.resolve()
  expect(await pending).toMatchObject({ state: "complete", teams: [{ teamObjectId: teamA }] })
  expect(await f.client.resolve(session.tokens.accessToken, [{ surface: "dashboard", role: "admin", entra: `group:${group}`, version: 0, by: "" }])).toEqual({ id: oid, roles: [], canWrite: false })
})

test("graph-client-03/07: expiry or changed /me identity during pagination discards observed teams", async () => {
  for (const cause of ["expiry", "principal"]) {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => {
      if (new URL(request.url).pathname !== "/v1.0/me/joinedTeams") return undefined
      if (cause === "expiry") f.clock.value = session.tokens.expiresAt
      if (cause === "principal") f.account.id = other
      return Response.json({ value: [row()] })
    }
    expect(await read(f.client, input(session))).toEqual({ state: "unavailable", reason: cause === "expiry" ? "token_expired" : "identity_mismatch" })
  }
})

test("graph-client-03: omitted token scope retains the original requested scopes only at successful redemption", async () => {
  const f = await microsoftFixture({ teams: "direct", grantedScopes: null })
  const session = await login(f)
  expect(session.tokens.grantedScopes).toEqual(["openid", "profile", "offline_access", "User.Read", "Team.ReadBasic.All"])
  expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [] })
})

for (const grantedScopes of ["User.Read https://graph.microsoft.com/Team.ReadBasic.All", "User.Read https%3A%2F%2Fgraph.microsoft.com%2FTeam.ReadBasic.All"]) {
  test(`graph-client-03: exact resource-qualified returned Teams scope is understood (${grantedScopes})`, async () => {
    const f = await microsoftFixture({ teams: "direct", grantedScopes })
    const session = await login(f)
    expect(await read(f.client, input(session))).toMatchObject({ state: "complete", teams: [] })
  })
}

test("graph-client-03: omitted refresh scope cannot be inferred from newly configured capability", async () => {
  const f = await microsoftFixture({ teams: "direct", grantedScopes: null })
  const session = await login(f)
  expect(session.tokens.grantedScopes).toContain("Team.ReadBasic.All")
  if (!session.tokens.refreshToken) throw new Error("Original refresh token required")
  const refreshed = await f.client.refresh(session.tokens.refreshToken)
  expect(refreshed.grantedScopes).toBeUndefined()
  const count = f.requests.length
  expect(await read(f.client, { ...input(session), tokens: refreshed })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(f.requests).toHaveLength(count)
})
