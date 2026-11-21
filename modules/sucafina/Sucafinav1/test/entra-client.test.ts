import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { createEntraClient } from "../runtime/entra-client.ts"
import { createLocalIdentity } from "../runtime/local-identity.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { EntraOptions, EntraTokens } from "../runtime/local-contract.ts"
import type { RoleRow } from "../src/identity.ts"

const tenant = "11111111-1111-4111-8111-111111111111"
const clientId = "22222222-2222-4222-8222-222222222222"
const oid = "33333333-3333-4333-8333-333333333333"
const group = "44444444-4444-4444-8444-444444444444"
const other = "55555555-5555-4555-8555-555555555555"
const epoch = 1794398400
const authority = `https://login.microsoftonline.com/${tenant}`
const graph = "https://graph.microsoft.com/v1.0"
const redirectUri = "http://localhost:4321/auth/callback"
const input = { code: "synthetic-code", verifier: "synthetic-verifier", redirectUri, nonce: "synthetic-nonce" }
const keys = generateKeyPair("RS256", { extractable: true })
const metadata = {
  issuer: `${authority}/v2.0`,
  authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
  token_endpoint: `${authority}/oauth2/v2.0/token`,
  jwks_uri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
}
const scopes = ["openid", "profile", "offline_access", "User.Read", "User.ReadBasic.All", "GroupMember.Read.All"]
const row = (entra: string | null, role = "viewer"): RoleRow => ({ surface: "dashboard", role, entra, version: 0, by: "" })

async function token(claims: Record<string, unknown> = {}, algorithm = "RS256") {
  const pair = algorithm === "RS256" ? await keys : await generateKeyPair(algorithm)
  return new SignJWT({ tid: tenant, oid, nonce: input.nonce, iss: metadata.issuer, aud: clientId, iat: epoch, exp: epoch + 3600, ...claims })
    .setProtectedHeader({ alg: algorithm, kid: "synthetic-key" })
    .sign(pair.privateKey)
}

async function fixture(options: {
  claims?: Record<string, unknown>
  tenantId?: string
  algorithm?: string
  discovery?: Partial<typeof metadata>
  route?: (request: Request) => Response | Promise<Response | undefined> | undefined
  directoryLimit?: number
  teams?: EntraOptions["teams"]
  grantedScopes?: string
} = {}) {
  const fixtureTenant = options.tenantId ?? tenant
  const fixtureAuthority = `https://login.microsoftonline.com/${fixtureTenant.toLowerCase()}`
  const fixtureMetadata = { ...metadata, issuer: `${fixtureAuthority}/v2.0`, authorization_endpoint: `${fixtureAuthority}/oauth2/v2.0/authorize`, token_endpoint: `${fixtureAuthority}/oauth2/v2.0/token` }
  const signed = await token({ tid: fixtureTenant, iss: fixtureMetadata.issuer, ...options.claims }, options.algorithm)
  const publicKey = await exportJWK((await keys).publicKey)
  const requests: Request[] = []
  const fetch = async (request: Request) => {
    requests.push(request)
    const url = new URL(request.url)
    expect(request.redirect).toBe("error")
    if (url.origin === "https://graph.microsoft.com") expect(request.headers.get("authorization")).toBe("Bearer synthetic-access")
    if (url.origin !== "https://graph.microsoft.com") expect(request.headers.get("authorization")).toBeNull()
    const response = await options.route?.(request)
    if (response) return response
    if (request.url === `${fixtureAuthority}/v2.0/.well-known/openid-configuration`) return Response.json({ ...fixtureMetadata, ...options.discovery })
    if (request.url === metadata.jwks_uri) return Response.json({ keys: [{ ...publicKey, kid: "synthetic-key", alg: "RS256", use: "sig" }] })
    if (request.url === fixtureMetadata.token_endpoint) return Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", id_token: signed, expires_in: 3600, token_type: "Bearer", scope: options.grantedScopes })
    if (url.origin === "https://graph.microsoft.com" && url.pathname === "/v1.0/me") {
      expect(url.searchParams.get("$select")).toBe("id,displayName")
      return Response.json({ id: oid, displayName: "Actual directory person" })
    }
    throw new Error(`Unexpected fixture request: ${url.origin}${url.pathname}`)
  }
  const client = createEntraClient({ tenantId: fixtureTenant, clientId, now: () => new Date(epoch * 1000), fetch, directoryLimit: options.directoryLimit, teams: options.teams })
  return { client, requests, signed }
}

async function failure(action: () => unknown | Promise<unknown>) {
  const result = await Promise.resolve().then(action).then(() => ({ error: undefined }), (error: unknown) => ({ error }))
  expect(result.error).toBeDefined()
  return String(result.error)
}

test("authorization uses tenant discovery, exact scopes, state, nonce and PKCE S256", async () => {
  const f = await fixture()
  const url = new URL(await f.client.authorization({ state: "state", nonce: input.nonce, challenge: "challenge", redirectUri }))
  expect(`${url.origin}${url.pathname}`).toBe(metadata.authorization_endpoint)
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: clientId, response_type: "code", state: "state", nonce: input.nonce, code_challenge: "challenge", code_challenge_method: "S256", redirect_uri: redirectUri })
  expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([...scopes].sort())
})

test("exchange posts code and verifier, verifies signed identity and returns real Graph name", async () => {
  const f = await fixture()
  const result = await f.client.exchange(input)
  expect(result).toEqual({ tokens: { accessToken: "synthetic-access", refreshToken: "synthetic-refresh", idToken: f.signed, expiresAt: (epoch + 3600) * 1000 }, person: { id: oid, name: "Actual directory person" } })
  const request = f.requests.find((request) => request.url === metadata.token_endpoint)
  expect(request?.method).toBe("POST")
  expect(request?.headers.get("content-type")).toContain("application/x-www-form-urlencoded")
  expect(Object.fromEntries(new URLSearchParams(await request!.text()))).toMatchObject({ grant_type: "authorization_code", client_id: clientId, code: input.code, code_verifier: input.verifier, redirect_uri: redirectUri })
})

for (const claims of [{ nonce: "wrong" }, { iss: `${authority}/wrong` }, { aud: other }, { tid: other }, { oid: "not-a-uuid" }, { oid: null }, { exp: epoch - 300 }, { iat: epoch + 3600 }, { exp: undefined }, { iat: undefined }, { nonce: undefined }]) {
  test(`exchange rejects invalid signed claims ${JSON.stringify(claims)}`, async () => {
    const f = await fixture({ claims })
    await failure(() => f.client.exchange(input))
    expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
  })
}

test("exchange rejects a valid RSA signature with an unapproved algorithm", async () => {
  const f = await fixture({ algorithm: "RS512" })
  await failure(() => f.client.exchange(input))
})

test("exchange rejects Graph identity mismatch", async () => {
  const f = await fixture({ route: (request) => new URL(request.url).pathname === "/v1.0/me" ? Response.json({ id: other, displayName: "Wrong person" }) : undefined })
  await failure(() => f.client.exchange(input))
})

for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
  for (const endpoint of ["https://evil.example/collect", `http://login.microsoftonline.com/${tenant}/keys`, `https://login.microsoftonline.com.evil.example/${tenant}/keys`, "https://login.microsoftonline.com/unrelated/keys"]) {
    test(`rejects unsafe discovery ${field}: ${endpoint}`, async () => {
      const f = await fixture({ discovery: { [field]: endpoint } })
      await failure(() => field === "authorization_endpoint" ? f.client.authorization({ state: "s", nonce: "n", challenge: "c", redirectUri }) : f.client.exchange(input))
      expect(f.requests.every((request) => request.url === `${authority}/v2.0/.well-known/openid-configuration`)).toBe(true)
    })
  }
}

test("refresh supports rotation and does not invent an omitted id_token", async () => {
  const f = await fixture({ route: (request) => request.url === metadata.token_endpoint ? Response.json({ access_token: "synthetic-access", refresh_token: "rotated", expires_in: 1200, token_type: "Bearer" }) : undefined })
  const tokens = await f.client.refresh("old-refresh")
  expect(tokens).toEqual({ accessToken: "synthetic-access", refreshToken: "rotated", expiresAt: (epoch + 1200) * 1000 })
  expect(tokens.idToken).toBeUndefined()
  const request = f.requests.find((request) => request.url === metadata.token_endpoint)!
  expect(Object.fromEntries(new URLSearchParams(await request.text()))).toMatchObject({ grant_type: "refresh_token", client_id: clientId, refresh_token: "old-refresh", scope: scopes.join(" ") })
  expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
})

test("refresh permits omitted refresh_token", async () => {
  const f = await fixture({ route: (request) => request.url === metadata.token_endpoint ? Response.json({ access_token: "synthetic-access", expires_in: 60 }) : undefined })
  const tokens = await f.client.refresh("old-refresh")
  expect(tokens).toMatchObject({ accessToken: "synthetic-access", expiresAt: (epoch + 60) * 1000 })
  expect(tokens.idToken).toBeUndefined()
  expect(tokens.refreshToken).toBeUndefined()
})

for (const operation of ["exchange", "person", "directory"] as const) {
  test(`${operation} sanitizes provider failures and never follows redirects`, async () => {
    const secret = "sensitive-provider-token-value"
    const f = await fixture({ route: (request) => request.url === metadata.token_endpoint || request.url.startsWith(graph) ? Response.json({ error: { message: secret }, access_token: secret }, { status: 403 }) : undefined })
    const message = await failure(() => operation === "exchange" ? f.client.exchange(input) : f.client[operation]("synthetic-access"))
    expect(message).not.toContain(secret)
    expect(message).not.toContain("synthetic-access")
    const redirected = await fixture({ route: (request) => request.url.startsWith(graph) ? new Response(null, { status: 302, headers: { location: "https://evil.example/collect" } }) : undefined })
    await failure(() => redirected.client.person("synthetic-access"))
    expect(redirected.requests.every((request) => !request.url.includes("evil.example"))).toBe(true)
  })
}

test("person reads actual /me and rejects missing or blank identity data", async () => {
  expect(await (await fixture()).client.person("synthetic-access")).toEqual({ id: oid, name: "Actual directory person" })
  for (const person of [{ id: oid, displayName: "" }, { id: "", displayName: "Name" }, { id: oid }]) {
    const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json(person) : undefined })
    await failure(() => f.client.person("synthetic-access"))
  }
})

test("directory follows validated pagination and retains real names", async () => {
  const next = `${graph}/users?$select=id,displayName&$skiptoken=page2`
  const f = await fixture({ route: (request) => {
    const url = new URL(request.url)
    if (url.pathname !== "/v1.0/users") return
    expect(url.searchParams.get("$select")).toBe("id,displayName")
    return request.url === next ? Response.json({ value: [{ id: other, displayName: "Second" }] }) : Response.json({ value: [{ id: oid, displayName: "First" }], "@odata.nextLink": next })
  } })
  expect(await f.client.directory("synthetic-access")).toEqual([{ id: oid, name: "First" }, { id: other, name: "Second" }])
})

for (const next of ["https://evil.example/v1.0/users", "http://graph.microsoft.com/v1.0/users", `${graph}/groups`, "https://graph.microsoft.com/beta/users", `${graph}/users?$select=id,displayName`]) {
  test(`directory fails closed for forbidden or cyclic nextLink ${next}`, async () => {
    const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ value: [{ id: oid, displayName: "Person" }], "@odata.nextLink": next }) : undefined })
    await failure(() => f.client.directory("synthetic-access"))
    expect(f.requests.length).toBeLessThan(10)
    expect(f.requests.every((request) => new URL(request.url).origin === "https://graph.microsoft.com")).toBe(true)
  })
}

test("directory budget rejects overflow rather than truncating", async () => {
  const f = await fixture({ directoryLimit: 1, route: (request) => request.url.startsWith(graph) ? Response.json({ value: [{ id: oid, displayName: "First" }, { id: other, displayName: "Second" }] }) : undefined })
  await failure(() => f.client.directory("synthetic-access"))
})

test("directory default budget rejects more than 10000 people", async () => {
  const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ value: Array.from({ length: 10001 }, (_, index) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, "0")}`, displayName: `Person ${index}` })) }) : undefined })
  await failure(() => f.client.directory("synthetic-access"))
})

test("directory rejects malformed rows and oversized JSON", async () => {
  for (const response of [Response.json({ value: [{ id: oid, displayName: "" }] }), Response.json({ value: null }), new Response(`{"value":[],"padding":"${"x".repeat(5 * 1024 * 1024)}"}`)]) {
    const f = await fixture({ route: (request) => request.url.startsWith(graph) ? response : undefined })
    await failure(() => f.client.directory("synthetic-access"))
  }
})

async function membership(groups: { id: string; displayName: string }[], members: string[], name = "Finance's owners") {
  const f = await fixture({ route: async (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/v1.0/groups") {
      expect(url.searchParams.get("$filter")).toBe(`displayName eq '${name.replaceAll("'", "''")}'`)
      expect(url.searchParams.get("$select")).toBe("id,displayName")
      expect(url.searchParams.get("$top")).toBe("2")
      return Response.json({ value: groups })
    }
    if (url.pathname === "/v1.0/me/checkMemberGroups") {
      expect(request.method).toBe("POST")
      const body = await request.json() as { groupIds: string[] }
      expect(body.groupIds).toEqual([group])
      expect(body.groupIds.length).toBeLessThanOrEqual(20)
      return Response.json({ value: members })
    }
  } })
  return f
}

test("resolve uses exact escaped group name and actual membership; viewer cannot write", async () => {
  const name = "Finance's owners"
  const f = await membership([{ id: group, displayName: name }], [group])
  expect(await f.client.resolve("synthetic-access", [row(name), row(null, "admin"), row("", "admin")])).toEqual({ id: oid, roles: [{ surface: "dashboard", role: "viewer" }], canWrite: false })
  expect(f.requests.filter((request) => new URL(request.url).pathname === "/v1.0/groups")).toHaveLength(1)
  expect(await f.client.resolve("synthetic-access", [row(name, "admin")])).toEqual({ id: oid, roles: [{ surface: "dashboard", role: "admin" }], canWrite: true })
})

test("resolve rereads membership on each call and shares lookups for duplicate configured names", async () => {
  const members: string[] = [group]
  const f = await membership([{ id: group, displayName: "Finance's owners" }], members)
  const map = [row("Finance's owners", "admin"), row("Finance's owners")]
  expect((await f.client.resolve("synthetic-access", map)).roles).toHaveLength(2)
  members.splice(0)
  expect(await f.client.resolve("synthetic-access", map)).toEqual({ id: oid, roles: [], canWrite: false })
  expect(f.requests.filter((request) => new URL(request.url).pathname === "/v1.0/groups")).toHaveLength(2)
})

test("resolve empty configuration grants nothing and performs no group queries", async () => {
  const f = await fixture()
  expect(await f.client.resolve("synthetic-access", [row(null, "admin"), row("", "admin")])).toEqual({ id: oid, roles: [], canWrite: false })
  expect(f.requests.every((request) => new URL(request.url).pathname === "/v1.0/me")).toBe(true)
})

test("missing group grants nothing", async () => {
  const f = await membership([], [])
  expect(await f.client.resolve("synthetic-access", [row("Finance's owners", "admin")])).toEqual({ id: oid, roles: [], canWrite: false })
})

for (const groups of [[{ id: group, displayName: "Finance's owners" }, { id: other, displayName: "Finance's owners" }], [{ id: group, displayName: "finance's owners" }], [{ id: "bad-id", displayName: "Finance's owners" }]]) {
  test(`ambiguous, inexact or invalid group never grants: ${JSON.stringify(groups)}`, async () => {
    const f = await membership(groups, [group])
    const outcome = await f.client.resolve("synthetic-access", [row("Finance's owners", "admin")]).then((actor) => actor, () => null)
    if (outcome) expect(outcome).toEqual({ id: oid, roles: [], canWrite: false })
    expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups")).toBe(false)
  })
}

test("membership response cannot grant an unrequested group ID", async () => {
  const f = await membership([{ id: group, displayName: "Finance's owners" }], [other])
  await failure(() => f.client.resolve("synthetic-access", [row("Finance's owners", "admin")]))
})

for (const config of [{ tenantId: "common", clientId }, { tenantId: tenant, clientId: "invalid" }, { tenantId: "", clientId }]) {
  test(`invalid UUID configuration fails before network: ${JSON.stringify(config)}`, async () => {
    const requests: Request[] = []
    const options: EntraOptions = { ...config, fetch: async (request) => { requests.push(request); throw new Error("Network forbidden") } }
    await failure(() => createEntraClient(options).authorization({ state: "s", nonce: "n", challenge: "c", redirectUri }))
    expect(requests).toHaveLength(0)
  })
}


test("discovery issuer must equal the configured tenant v2 issuer", async () => {
  const f = await fixture({ discovery: { issuer: `https://login.microsoftonline.com/${other}/v2.0` } })
  await failure(() => f.client.exchange(input))
  expect(f.requests).toHaveLength(1)
})

test("exchange rejects an ID token signed by an unknown RSA key", async () => {
  const foreign = await generateKeyPair("RS256")
  const signed = await new SignJWT({ tid: tenant, oid, nonce: input.nonce })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer(metadata.issuer).setAudience(clientId).setIssuedAt(epoch).setExpirationTime(epoch + 3600)
    .sign(foreign.privateKey)
  const f = await fixture({ route: (request) => request.url === metadata.token_endpoint ? Response.json({ access_token: "synthetic-access", id_token: signed, expires_in: 3600 }) : undefined })
  await failure(() => f.client.exchange(input))
  expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
})

test("network exceptions are sanitized without leaking provider credentials", async () => {
  const f = await fixture({ route: (request) => {
    if (request.url.startsWith(graph)) throw new Error("provider leaked synthetic-access and synthetic-refresh")
    return undefined
  } })
  const message = await failure(() => f.client.person("synthetic-access"))
  expect(message).not.toContain("synthetic-access")
  expect(message).not.toContain("synthetic-refresh")
})


test("exchange requires an id_token even though refresh may omit it", async () => {
  const f = await fixture({ route: (request) => request.url === metadata.token_endpoint ? Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600, token_type: "Bearer" }) : undefined })
  await failure(() => f.client.exchange(input))
  expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
})


for (const stage of ["fetch", "body"] as const) {
  test(`request deadline aborts and bounds an uncooperative ${stage}`, async () => {
    const f = await fixture({ route: (request) => {
      if (!request.url.startsWith(graph)) return
      if (stage === "fetch") return new Promise<Response>(() => undefined)
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode('{"id":')) },
        // Cancellation itself must not hold the caller after the deadline.
        cancel() { return new Promise<void>(() => undefined) },
      }))
    } })
    const start = performance.now()
    const message = await failure(() => f.client.person("synthetic-access"))
    expect(message).toContain("timed out")
    expect(performance.now() - start).toBeLessThan(14000)
    expect(f.requests).toHaveLength(1)
    expect(f.requests[0].signal.aborted).toBe(true)
  }, 16000)
}

test("person requires a GUID and returns a normalized principal ID", async () => {
  for (const id of ["not-a-guid", "account@example.test", ` ${oid}`, oid.slice(1)]) {
    const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ id, displayName: "Directory person" }) : undefined })
    await failure(() => f.client.person("synthetic-access"))
  }
  const id = "abcdefab-cdef-4abc-8abc-abcdefabcdef"
  const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ id: id.toUpperCase(), displayName: "Directory person" }) : undefined })
  expect(await f.client.person("synthetic-access")).toEqual({ id, name: "Directory person" })
})

test("exchange compares signed tenant and object GUIDs without case sensitivity", async () => {
  const id = "abcdefab-cdef-4abc-8abc-abcdefabcdef"
  const tenantId = "fedcbafe-dcba-4fed-8fed-fedcbafedcba"
  const f = await fixture({ tenantId: tenantId.toUpperCase(), claims: { oid: id.toUpperCase() }, route: (request) => request.url.startsWith(graph) ? Response.json({ id, displayName: "Directory person" }) : undefined })
  expect((await f.client.exchange(input)).person).toEqual({ id, name: "Directory person" })
})

for (const acrossPages of [false, true]) {
  test(`directory rejects duplicate IDs ${acrossPages ? "across pages" : "within a page"} including case variants`, async () => {
    const id = "abcdefab-cdef-4abc-8abc-abcdefabcdef"
    const next = `${graph}/users?$select=id,displayName&$skiptoken=second`
    const f = await fixture({ route: (request) => {
      if (!request.url.startsWith(graph)) return
      const first = { id, displayName: "First" }
      const duplicate = { id: id.toUpperCase(), displayName: "Duplicate" }
      if (!acrossPages) return Response.json({ value: [first, duplicate] })
      return request.url === next ? Response.json({ value: [duplicate] }) : Response.json({ value: [first], "@odata.nextLink": next })
    } })
    await failure(() => f.client.directory("synthetic-access"))
  })
}

test("directory rejects non-GUID entries", async () => {
  const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ value: [{ id: "fake-person", displayName: "Invalid identity" }] }) : undefined })
  await failure(() => f.client.directory("synthetic-access"))
})

test("directory never returns a partial first page when continuation fails", async () => {
  const next = `${graph}/users?$select=id,displayName&$skiptoken=second`
  const f = await fixture({ route: (request) => {
    if (!request.url.startsWith(graph)) return
    return request.url === next ? Response.json({ error: { message: "denied" } }, { status: 403 }) : Response.json({ value: [{ id: oid, displayName: "First" }], "@odata.nextLink": next })
  } })
  await failure(() => f.client.directory("synthetic-access"))
  expect(f.requests).toHaveLength(2)
})

for (const continuation of [null, "", 42]) {
  test(`directory rejects incomplete continuation ${JSON.stringify(continuation)}`, async () => {
    const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ value: [{ id: oid, displayName: "First" }], "@odata.nextLink": continuation }) : undefined })
    await failure(() => f.client.directory("synthetic-access"))
  })
}

test("directory rejects a terminal page that contradicts the declared total", async () => {
  const f = await fixture({ route: (request) => request.url.startsWith(graph) ? Response.json({ value: [{ id: oid, displayName: "First" }], "@odata.count": 2 }) : undefined })
  await failure(() => f.client.directory("synthetic-access"))
})

const teamScope = "Team.ReadBasic.All"
const joinedPath = "/v1.0/me/joinedTeams"
const joinedUrl = `${graph}/me/joinedTeams`
const teamA = "77777777-7777-4777-8777-777777777777"
const teamB = "88888888-8888-4888-8888-888888888888"
const teamRow = (id = teamA) => ({ id, tenantId: tenant, displayName: "Shared display name", isArchived: false })
const teamsInput = (tokens: EntraTokens) =>
  ({ tokens, principal: { tenantId: tenant, principalObjectId: oid } })

test("Teams opt-in adds only the delegated scope and uses the signed principal across pages", async () => {
  expect((await fixture()).client.joinedTeams).toBeUndefined()
  const f = await fixture({ teams: "direct", grantedScopes: "User.Read " + teamScope, route: (request) => {
    if (request.url === joinedUrl) return Response.json({ value: [teamRow()], "@odata.nextLink": joinedUrl + "?$skiptoken=2" })
    if (request.url === joinedUrl + "?$skiptoken=2") return Response.json({ value: [teamRow(teamB)] })
  } })
  const authorize = new URL(await f.client.authorization({ state: "state", nonce: input.nonce, challenge: "challenge", redirectUri }))
  expect(authorize.searchParams.get("scope")?.split(" ")).toEqual([...scopes, teamScope])
  expect(f.client.tenantId).toBe(tenant)
  const signed = await f.client.exchange(input)
  expect(signed.tokens.grantedScopes).toEqual(["User.Read", teamScope])
  expect(await f.client.joinedTeams!(teamsInput(signed.tokens))).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: oid, source: "joinedTeams", membership: "direct",
    teams: [
      { teamObjectId: teamA, name: "Shared display name", archived: false },
      { teamObjectId: teamB, name: "Shared display name", archived: false },
    ],
  })
  expect(f.requests.filter((request) => request.url.startsWith(graph)).map((request) => new URL(request.url).pathname))
    .toEqual(["/v1.0/me", "/v1.0/me", joinedPath, joinedPath, "/v1.0/me"])
})

test("Teams consent must be observed on both initial and refreshed credentials", async () => {
  const missing = await fixture({ teams: "direct" })
  const initial = await missing.client.exchange(input)
  const initialCount = missing.requests.length
  expect(await missing.client.joinedTeams!(teamsInput(initial.tokens))).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(missing.requests).toHaveLength(initialCount)

  const granted = await fixture({ teams: "direct", grantedScopes: teamScope, route: async (request) => {
    if (request.url !== metadata.token_endpoint || new URLSearchParams(await request.clone().text()).get("grant_type") !== "refresh_token") return
    return Response.json({ access_token: "synthetic-access", expires_in: 3600, token_type: "Bearer" })
  } })
  expect((await granted.client.exchange(input)).tokens.grantedScopes).toEqual([teamScope])
  const refreshed = await granted.client.refresh("synthetic-refresh")
  const refreshRequest = granted.requests.at(-1)!
  expect(refreshRequest.url).toBe(metadata.token_endpoint)
  const form = new URLSearchParams(await refreshRequest.text())
  expect(form.get("grant_type")).toBe("refresh_token")
  expect(form.has("scope")).toBe(false)
  const refreshedCount = granted.requests.length
  expect(await granted.client.joinedTeams!(teamsInput(refreshed))).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(granted.requests).toHaveLength(refreshedCount)
})

test("Teams rejects an expired credential or a foreign tenant before Graph and fences changed /me", async () => {
  const seen = { me: 0 }
  const f = await fixture({ teams: "direct", grantedScopes: teamScope, route: (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/v1.0/me" && ++seen.me === 3) return Response.json({ id: other, displayName: "Changed person" })
    if (url.pathname === joinedPath) return Response.json({ value: [teamRow()] })
  } })
  const signed = await f.client.exchange(input)
  const count = f.requests.length
  expect(await f.client.joinedTeams!(teamsInput({ ...signed.tokens, expiresAt: epoch * 1000 })))
    .toEqual({ state: "unavailable", reason: "token_expired" })
  expect(await f.client.joinedTeams!({ tokens: signed.tokens, principal: { tenantId: other, principalObjectId: oid } }))
    .toEqual({ state: "unavailable", reason: "identity_mismatch" })
  expect(f.requests).toHaveLength(count)
  expect(await f.client.joinedTeams!(teamsInput(signed.tokens))).toEqual({ state: "unavailable", reason: "identity_mismatch" })
})

for (const scenario of [
  { name: "nextLink origin", data: { value: [teamRow()], "@odata.nextLink": "https://foreign.example/v1.0/me/joinedTeams?$skiptoken=2" }, reason: "invalid_response" },
  { name: "duplicate pagination keys", data: { value: [teamRow()], "@odata.nextLink": joinedUrl + "?$skiptoken=2&%24skiptoken=3" }, reason: "invalid_response" },
  { name: "foreign team tenant", data: { value: [teamRow(), { ...teamRow(teamB), tenantId: other }] }, reason: "invalid_response" },
  { name: "duplicate team identity", data: { value: [teamRow(), teamRow(teamA.toUpperCase())] }, reason: "invalid_response" },
  { name: "incomplete total", data: { value: [teamRow()], "@odata.count": 2 }, reason: "incomplete" },
]) {
  test(`Teams rejects ${scenario.name} without returning partial membership`, async () => {
    const f = await fixture({ teams: "direct", grantedScopes: teamScope, route: (request) =>
      request.url === joinedUrl ? Response.json(scenario.data) : undefined })
    const result = await f.client.joinedTeams!(teamsInput((await f.client.exchange(input)).tokens))
    expect(result).toEqual({ state: "unavailable", reason: scenario.reason })
    expect(f.requests.filter((request) => new URL(request.url).pathname === joinedPath)).toHaveLength(1)
  })
}

test("a signed Microsoft callback binds the private session to direct Graph memberships", async () => {
  const sessionOrigin = "http://localhost:4321"
  const mount = "/sucafina"
  const callback = { nonce: "" }
  const f = await fixture({ teams: "direct", route: async (request) => {
    if (request.url === metadata.token_endpoint) return Response.json({
      access_token: "synthetic-access", id_token: await token({ nonce: callback.nonce }),
      expires_in: 3600, token_type: "Bearer", scope: teamScope,
    })
    if (request.url === joinedUrl) return Response.json({ value: [teamRow()] })
  } })
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-entra-teams-"))
  const store = await openLocalStore(root)
  try {
    const identity = createLocalIdentity({
      origin: sessionOrigin, mount, client: f.client, secrets: store.secrets,
      key: randomBytes(32), now: () => new Date(epoch * 1000),
    })
    const begin = await identity.handle(new Request(sessionOrigin + mount + "/auth/login"))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    callback.nonce = authorize.searchParams.get("nonce")!
    const loginCookie = begin!.headers.getSetCookie()[0].split(";")[0]
    const finish = await identity.handle(new Request(sessionOrigin + mount + "/auth/callback?" + new URLSearchParams({
      state: authorize.searchParams.get("state")!, code: "synthetic-code",
    }), { headers: { cookie: loginCookie } }))
    expect(finish?.status).toBe(303)
    const cookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
    const observed = await identity.teamDirectory!(new Request(sessionOrigin + mount + "/dashboard?principalObjectId=" + other, {
      headers: { cookie },
    }))
    expect(observed).toMatchObject({
      state: "complete", tenantId: tenant, principalObjectId: oid,
      teams: [{ teamObjectId: teamA, name: "Shared display name", archived: false }],
    })
    expect(JSON.stringify(observed)).not.toContain("synthetic-access")
  } finally {
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
