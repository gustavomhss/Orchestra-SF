import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import type { EntraClient, EntraGroupMembershipInput, EntraTeamInput } from "../../runtime/local-contract.ts"
import { group, microsoftFixture, oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"

const graph = "https://graph.microsoft.com/v1.0"
const teamId = "abcdef12-7777-4777-8777-777777777777"
const row = (id = teamId) => ({ id, tenantId: tenant, displayName: "Same Team name", isArchived: false })

async function login(f: Awaited<ReturnType<typeof microsoftFixture>>) {
  const verifier = "synthetic-admin-pkce-verifier-with-at-least-43-characters"
  const redirectUri = "https://mvp.example.test/sucafina/auth/callback"
  const location = await f.client.authorization({ state: "synthetic-admin-state", nonce: "synthetic-admin-nonce", challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri })
  const result = await f.client.exchange({ code: await f.issueCode(location), verifier, redirectUri, nonce: "synthetic-admin-nonce" })
  return { ...result, location }
}

const input = (session: Awaited<ReturnType<typeof login>>) => ({ tokens: session.tokens, principal: { tenantId: tenant, principalObjectId: session.person.id } })
const membershipRequests = (f: Awaited<ReturnType<typeof microsoftFixture>>) => f.requests.filter((request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups")
const teamRequests = (f: Awaited<ReturnType<typeof microsoftFixture>>) => f.requests.filter((request) => new URL(request.url).pathname.startsWith("/v1.0/teams/"))

async function readGroup(client: EntraClient, value: EntraGroupMembershipInput) {
  if (!client.checkGroupMembership) throw new Error("Actual confidential group capability required")
  return client.checkGroupMembership(value)
}
async function readTeam(client: EntraClient, value: EntraTeamInput) {
  if (!client.team) throw new Error("Actual explicit Team capability required")
  return client.team(value)
}

test("admin-membership: one policy-selected group uses the signed user and minimum login scopes without Teams or roles", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  expect(new URL(session.location).searchParams.get("scope")?.split(" ")).toEqual(["openid", "profile", "offline_access", "User.Read"])
  expect(session.tokens.grantedScopes).toEqual(["openid", "profile", "offline_access", "User.Read"])
  expect(membershipRequests(f)).toHaveLength(0)
  expect(f.client.joinedTeams).toBeUndefined()
  expect(f.client.team).toBeUndefined()
  const bodies: unknown[] = []
  f.hooks.before = async (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") bodies.push(await request.clone().json())
    return undefined
  }
  const before = f.requests.length
  const result = await readGroup(f.client, { ...input(session), groupObjectId: group })
  expect(result).toEqual({ state: "complete", tenantId: tenant, principalObjectId: oid, groupObjectId: group, source: "checkMemberGroups", membership: "transitive", member: true })
  expect(f.requests.slice(before).map((request) => ({ method: request.method, path: new URL(request.url).pathname }))).toEqual([
    { method: "GET", path: "/v1.0/me" }, { method: "POST", path: "/v1.0/me/checkMemberGroups" }, { method: "GET", path: "/v1.0/me" },
  ])
  expect(bodies).toEqual([{ groupIds: [group] }])
  expect(f.requests.some((request) => ["/v1.0/users", "/v1.0/groups", "/v1.0/me/joinedTeams"].includes(new URL(request.url).pathname))).toBe(false)
  expect(Object.isFrozen(result)).toBe(true)
  expect(JSON.stringify(result)).not.toContain(session.tokens.accessToken)
  expect(result).not.toHaveProperty("roles")
  expect(result).not.toHaveProperty("admitted")
})

test("admin-membership: a Team, JWT role and product role never substitute for membership of the configured group", async () => {
  const f = await microsoftFixture({ teams: "direct", claims: { roles: ["admin"], name: "Administrator", email: "admin@example.test" } })
  f.directTeams.set(oid, [row(group)])
  f.account.groups.splice(0)
  const session = await login(f)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", groupObjectId: group, member: false })
  f.account.groups.push(group)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: other })).toMatchObject({ state: "complete", groupObjectId: other, member: false })
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", groupObjectId: group, member: true })
  expect(await f.client.resolve(session.tokens.accessToken, [])).toEqual({ id: oid, roles: [], canWrite: false })
  expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams")).toBe(false)
})

test("admin-membership: unavailable hidden-group evaluation never confirms membership", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  // Microsoft can omit groups that this delegated caller cannot evaluate.
  f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups" ? Response.json({ value: [] }) : undefined
  const result = await readGroup(f.client, { ...input(session), groupObjectId: group })
  expect(result).toMatchObject({ state: "complete", member: false })
  expect(result).not.toHaveProperty("admitted")
})

test("admin-membership: local-public adapters gain neither confidential group proof nor Team lookup", async () => {
  const f = await microsoftFixture({ profile: "local-public" })
  expect(f.client.checkGroupMembership).toBeUndefined()
  expect(f.client.team).toBeUndefined()
  expect(f.requests).toHaveLength(0)
})

for (const requested of ["", "Administrator", `group:${group}`, ` ${group}`, `${group} `, `${graph}/groups/${group}`, `${group}?$expand=members`, null, 42]) {
  test(`admin-membership: rejects a nonimmutable policy group ${String(requested)} before Graph`, async () => {
    const f = await microsoftFixture()
    const session = await login(f)
    const before = f.requests.length
    expect(await readGroup(f.client, { ...input(session), groupObjectId: requested as string })).toEqual({ state: "unavailable", reason: "invalid_response" })
    expect(f.requests).toHaveLength(before)
  })
}

test("admin-membership: canonicalizes a full group GUID without changing the configured identity", async () => {
  const f = await microsoftFixture()
  f.account.groups.splice(0, f.account.groups.length, teamId)
  const session = await login(f)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: teamId.toUpperCase() })).toMatchObject({ state: "complete", groupObjectId: teamId, member: true })
})

test("admin-membership: another tenant or principal cannot relabel the signed Microsoft session", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  const before = f.requests.length
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, principal: { tenantId: other, principalObjectId: oid } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(f.requests).toHaveLength(before)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, principal: { tenantId: tenant, principalObjectId: other } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(membershipRequests(f)).toHaveLength(0)
})

for (const grantedScopes of ["openid profile", "User.ReadBasic.All", "https://untrusted.example.test/User.Read", "user.read"]) {
  test(`admin-membership: missing effective User.Read (${grantedScopes}) makes no Graph call`, async () => {
    const f = await microsoftFixture({ grantedScopes })
    const session = await login(f)
    const before = f.requests.length
    expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toEqual({ state: "unavailable", reason: "consent_required" })
    expect(f.requests).toHaveLength(before)
  })
}

for (const grantedScopes of ["https://graph.microsoft.com/User.Read", "https%3A%2F%2Fgraph.microsoft.com%2FUser.Read"]) {
  test(`admin-membership: accepts Microsoft's effective Graph scope representation ${grantedScopes}`, async () => {
    const f = await microsoftFixture({ grantedScopes })
    const session = await login(f)
    expect(session.tokens.grantedScopes).toEqual([grantedScopes])
    expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: true })
  })
}

test("admin-membership: old credentials without scope and refresh omission never inherit the initial consent", async () => {
  const f = await microsoftFixture({ grantedScopes: null })
  const session = await login(f)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: true })
  const refreshed = await f.client.refresh(session.tokens.refreshToken!)
  expect(refreshed.grantedScopes).toBeUndefined()
  const before = f.requests.length
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, tokens: refreshed })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, tokens: { accessToken: session.tokens.accessToken, expiresAt: session.tokens.expiresAt } })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(f.requests).toHaveLength(before)
})

test("admin-membership: expired and rejected bearer credentials cannot yield membership", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  const before = f.requests.length
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, tokens: { ...session.tokens, expiresAt: f.clock.value } })).toEqual({ state: "unavailable", reason: "token_expired" })
  expect(f.requests).toHaveLength(before)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group, tokens: { ...session.tokens, accessToken: "synthetic-not-issued" } })).toEqual({ state: "unavailable", reason: "unauthenticated" })
  expect(membershipRequests(f)).toHaveLength(0)
})

for (const value of [
  { label: "not a collection", data: {} },
  { label: "wrong value type", data: { value: group } },
  { label: "different group", data: { value: [other] } },
  { label: "duplicate group", data: { value: [group, group] } },
  { label: "group object", data: { value: [{ id: group }] } },
  { label: "invalid group", data: { value: ["Administrator"] } },
  { label: "partial result", data: { value: [group], "@odata.nextLink": `${graph}/groups` } },
  { label: "delta result", data: { value: [group], "@odata.deltaLink": `${graph}/groups/delta` } },
  { label: "mixed error", data: { value: [group], error: { code: "partial" } } },
  { label: "inconsistent count", data: { value: [group], "@odata.count": 2 } },
]) {
  test(`admin-membership: malformed ${value.label} fails closed`, async () => {
    const f = await microsoftFixture()
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups" ? Response.json(value.data) : undefined
    const result = await readGroup(f.client, { ...input(session), groupObjectId: group })
    expect(result).toEqual({ state: "unavailable", reason: "invalid_response" })
    expect(result).not.toHaveProperty("member")
    expect(membershipRequests(f)).toHaveLength(1)
  })
}

test("admin-membership: caller mutations cannot retarget the suspended verified observation", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  f.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== "/v1.0/me") return undefined
    entered.resolve()
    await release.promise
    return undefined
  }
  const mutable = { ...input(session), groupObjectId: group, tokens: { ...session.tokens, grantedScopes: [...session.tokens.grantedScopes!] } }
  const pending = readGroup(f.client, mutable)
  await entered.promise
  mutable.groupObjectId = other
  mutable.principal.principalObjectId = other
  mutable.principal.tenantId = other
  mutable.tokens.accessToken = "synthetic-not-issued"
  mutable.tokens.grantedScopes.splice(0)
  release.resolve()
  expect(await pending).toMatchObject({ state: "complete", principalObjectId: oid, tenantId: tenant, groupObjectId: group, member: true })
})

test("admin-membership: removal while the membership response is suspended denies, and no result is cached", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: true })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  f.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== "/v1.0/me/checkMemberGroups") return undefined
    entered.resolve()
    await release.promise
    return undefined
  }
  const pending = readGroup(f.client, { ...input(session), groupObjectId: group })
  await entered.promise
  f.account.groups.splice(0)
  release.resolve()
  expect(await pending).toMatchObject({ state: "complete", member: false })
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: false })
  expect(membershipRequests(f)).toHaveLength(3)
})

test("admin-membership: principal mismatch after a positive response discards that response", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  const observed = { group: false }
  f.hooks.before = (request) => {
    const path = new URL(request.url).pathname
    if (path === "/v1.0/me/checkMemberGroups") observed.group = true
    if (path === "/v1.0/me" && observed.group) return Response.json({ id: other, displayName: "Other person" })
    return undefined
  }
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
})

test("admin-membership: expiration during the awaited proof discards the positive result", async () => {
  const f = await microsoftFixture()
  const session = await login(f)
  f.hooks.before = (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") f.clock.value = session.tokens.expiresAt
    return undefined
  }
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toEqual({ state: "unavailable", reason: "token_expired" })
})

test("admin-team: verified lookup works without direct Team membership and never manufactures it", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  f.teamResources.set(teamId, row())
  const session = await login(f)
  expect(teamRequests(f)).toHaveLength(0)
  const result = await readTeam(f.client, { ...input(session), teamObjectId: teamId.toUpperCase() })
  expect(result).toEqual({ state: "complete", tenantId: tenant, principalObjectId: oid, source: "team", team: { teamObjectId: teamId, name: "Same Team name", archived: false } })
  expect(teamRequests(f)).toEqual([{ method: "GET", url: `${graph}/teams/${teamId}?$select=id,displayName,isArchived,tenantId` }])
  expect(result).not.toHaveProperty("membership")
  expect(result).not.toHaveProperty("roles")
  expect(Object.isFrozen(result)).toBe(true)
  if (result.state !== "complete") throw new Error("Complete Team observation required")
  expect(Object.isFrozen(result.team)).toBe(true)
  expect(JSON.stringify(result)).not.toContain(session.tokens.accessToken)
  if (!f.client.joinedTeams) throw new Error("Actual Teams capability required")
  expect(await f.client.joinedTeams(input(session))).toMatchObject({ state: "complete", teams: [] })
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: true })
  f.account.groups.splice(0)
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toMatchObject({ state: "complete", team: { teamObjectId: teamId } })
  expect(await readGroup(f.client, { ...input(session), groupObjectId: group })).toMatchObject({ state: "complete", member: false })
})

test("admin-team: same names, archived status and rename preserve the requested immutable Team identity", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  f.teamResources.set(teamId, row())
  f.teamResources.set(other, { ...row(other), isArchived: true })
  const session = await login(f)
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toMatchObject({ state: "complete", team: { teamObjectId: teamId, name: "Same Team name", archived: false } })
  expect(await readTeam(f.client, { ...input(session), teamObjectId: other })).toMatchObject({ state: "complete", team: { teamObjectId: other, name: "Same Team name", archived: true } })
  f.teamResources.set(teamId, { ...row(), displayName: "Renamed Team" })
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toMatchObject({ state: "complete", team: { teamObjectId: teamId, name: "Renamed Team", archived: false } })
})

test("admin-team: a missing effective Teams scope and expired token never reach Graph", async () => {
  const f = await microsoftFixture({ teams: "direct", grantedScopes: "User.Read" })
  const session = await login(f)
  const before = f.requests.length
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId, tokens: { ...session.tokens, expiresAt: f.clock.value } })).toEqual({ state: "unavailable", reason: "token_expired" })
  expect(f.requests).toHaveLength(before)
})

for (const requested of ["", "Same Team name", `group:${teamId}`, `${teamId}/members`, `${teamId}?$expand=members`, `${graph}/teams/${teamId}`, `${teamId} `]) {
  test(`admin-team: lookup rejects nonimmutable or injected ID ${requested} before Graph`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    const before = f.requests.length
    expect(await readTeam(f.client, { ...input(session), teamObjectId: requested })).toEqual({ state: "unavailable", reason: "invalid_response" })
    expect(f.requests).toHaveLength(before)
  })
}

for (const value of [
  { label: "missing tenant", data: { id: teamId, displayName: "Team", isArchived: false } },
  { label: "foreign tenant", data: { ...row(), tenantId: other } },
  { label: "wrong Team", data: row(other) },
  { label: "missing archive flag", data: { id: teamId, tenantId: tenant, displayName: "Team" } },
  { label: "empty label", data: { ...row(), displayName: " " } },
  { label: "security group", data: { ...row(), "@odata.type": "#microsoft.graph.group" } },
  { label: "channel association", data: { ...row(), membershipType: "shared" } },
  { label: "collection", data: { ...row(), value: [row()] } },
  { label: "pagination", data: { ...row(), "@odata.nextLink": `${graph}/teams` } },
  { label: "delta", data: { ...row(), "@odata.deltaLink": `${graph}/teams/delta` } },
  { label: "provider error", data: { ...row(), error: { message: "partial" } } },
]) {
  test(`admin-team: malformed ${value.label} cannot verify the requested Team`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => new URL(request.url).pathname.startsWith("/v1.0/teams/") ? Response.json(value.data) : undefined
    expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toEqual({ state: "unavailable", reason: "invalid_response" })
    expect(teamRequests(f)).toHaveLength(1)
  })
}

test("admin-team: another session principal or resource tenant cannot verify a selected Team", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  f.teamResources.set(teamId, row())
  const session = await login(f)
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId, principal: { tenantId: other, principalObjectId: oid } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId, principal: { tenantId: tenant, principalObjectId: other } })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(teamRequests(f)).toHaveLength(0)
})

test("admin-team: a principal change after the lookup discards that Team", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  f.teamResources.set(teamId, row())
  const session = await login(f)
  const observed = { team: false }
  f.hooks.before = (request) => {
    const path = new URL(request.url).pathname
    if (path.startsWith("/v1.0/teams/")) observed.team = true
    if (path === "/v1.0/me" && observed.team) return Response.json({ id: other, displayName: "Other person" })
    return undefined
  }
  expect(await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toEqual({ state: "unavailable", reason: "identity_mismatch" })
})

for (const operation of ["group", "team"] as const) {
  for (const failure of [
    { status: 401, reason: "unauthenticated" },
    { status: 403, reason: "forbidden" },
    { status: 404, reason: "provider_unavailable" },
    { status: 429, reason: "throttled" },
    { status: 503, reason: "provider_unavailable" },
  ]) {
    test(`admin-${operation}: HTTP ${failure.status} is unavailable, sanitized, and never retried`, async () => {
      const f = await microsoftFixture({ teams: "direct" })
      const session = await login(f)
      f.hooks.before = (request) => {
        const path = new URL(request.url).pathname
        return (operation === "group" ? path === "/v1.0/me/checkMemberGroups" : path.startsWith("/v1.0/teams/"))
          ? Response.json({ error: { message: `Never expose ${session.tokens.accessToken}` } }, { status: failure.status, ...(failure.status === 429 ? { headers: { "retry-after": "3" } } : {}) })
          : undefined
      }
      const result = operation === "group" ? await readGroup(f.client, { ...input(session), groupObjectId: group }) : await readTeam(f.client, { ...input(session), teamObjectId: teamId })
      expect(result).toEqual({ state: "unavailable", reason: failure.reason, ...(failure.status === 429 ? { retryAfterMs: 3000 } : {}) })
      expect(JSON.stringify(result)).not.toContain(session.tokens.accessToken)
      expect(operation === "group" ? membershipRequests(f) : teamRequests(f)).toHaveLength(1)
      expect(result).not.toHaveProperty(operation === "group" ? "member" : "team")
    })
  }

  test(`admin-${operation}: oversized observation never escapes the shared byte bound`, async () => {
    const f = await microsoftFixture({ teams: "direct" })
    const session = await login(f)
    f.hooks.before = (request) => {
      const path = new URL(request.url).pathname
      if (operation === "group" ? path === "/v1.0/me/checkMemberGroups" : path.startsWith("/v1.0/teams/")) return Response.json({ ...(operation === "group" ? { value: [group] } : row()), description: "x".repeat(2 * 1024 * 1024) })
      return undefined
    }
    expect(operation === "group" ? await readGroup(f.client, { ...input(session), groupObjectId: group }) : await readTeam(f.client, { ...input(session), teamObjectId: teamId })).toEqual({ state: "unavailable", reason: "limit_exceeded" })
  })
}

test("admin-observation: the operation deadline bounds an ignoring transport and a stalled body", async () => {
  const f = await microsoftFixture({ teams: "direct" })
  const session = await login(f)
  const signals: AbortSignal[] = []
  const stopped = { body: false }
  f.hooks.before = (request) => {
    const path = new URL(request.url).pathname
    if (path === "/v1.0/me/checkMemberGroups") {
      signals.push(request.signal)
      return new Promise<Response>(() => undefined)
    }
    if (path.startsWith("/v1.0/teams/")) {
      signals.push(request.signal)
      return new Response(new ReadableStream<Uint8Array>({ cancel() { stopped.body = true } }))
    }
    return undefined
  }
  const results = await Promise.all([
    readGroup(f.client, { ...input(session), groupObjectId: group }),
    readTeam(f.client, { ...input(session), teamObjectId: teamId }),
  ])
  expect(results).toEqual([{ state: "unavailable", reason: "timeout" }, { state: "unavailable", reason: "timeout" }])
  expect(signals).toHaveLength(2)
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(stopped.body).toBe(true)
}, 20000)
