import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createEntraClient } from "../runtime/entra-client.ts"
import type { EntraOptions } from "../runtime/local-contract.ts"
import type { RoleRow } from "../src/identity.ts"
import { clientId, group, microsoftFixture, oid, other, syntheticSecret, tenant } from "./microsoft-login/oidc-fixture.ts"

const graph = "https://graph.microsoft.com/v1.0"
const row = (entra: string | null, role = "viewer"): RoleRow => ({ surface: "dashboard", role, entra, version: 0, by: "" })
async function failure(action: () => unknown | Promise<unknown>) {
  const result = await Promise.resolve().then(action).then(() => ({ error: undefined }), (error: unknown) => ({ error }))
  expect(result.error).toBeDefined()
  return String(result.error)
}

async function webExchange(f: Awaited<ReturnType<typeof microsoftFixture>>, client = f.client) {
  const verifier = "synthetic-pkce-verifier-with-at-least-43-characters"
  const redirectUri = "https://mvp.example.test/sucafina/auth/callback"
  const location = await client.authorization({ state: "synthetic-web-state", nonce: "synthetic-web-nonce", challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri })
  const code = await f.issueCode(location)
  return { location, ...await client.exchange({ code, verifier, redirectUri, nonce: "synthetic-web-nonce" }) }
}

test("confidential web flow requests exact consented Graph membership scopes and sends secret only to token POST", async () => {
  const f = await microsoftFixture()
  const observed: { method: string; secret: boolean; authorization: boolean }[] = []
  f.hooks.before = async (request) => {
    if (request.url !== f.metadata.token_endpoint) return undefined
    observed.push({ method: request.method, secret: new URLSearchParams(await request.clone().text()).get("client_secret") === syntheticSecret, authorization: request.headers.has("authorization") })
    return undefined
  }
  const result = await webExchange(f)
  const url = new URL(result.location)
  expect(url.searchParams.get("scope")?.split(" ")).toEqual(["openid", "profile", "offline_access", "User.Read", "User.Read.All", "GroupMember.Read.All", "Directory.Read.All"])
  expect(url.searchParams.has("client_secret")).toBe(false)
  expect(result.person.id).toBe(oid)
  const refreshed = await f.client.refresh(result.tokens.refreshToken!)
  expect(refreshed.refreshToken).not.toBe(result.tokens.refreshToken)
  expect(observed).toEqual([{ method: "POST", secret: true, authorization: false }, { method: "POST", secret: true, authorization: false }])
  expect(f.client).toMatchObject({ tenantId: tenant, clientId, profile: "web-confidential" })
  expect(Object.isFrozen(f.client)).toBe(true)
})

test("web mode accepts the guest object in the resource tenant and ignores home identity and role/name/email claims", async () => {
  const f = await microsoftFixture({ claims: { roles: ["admin"], name: "Administrator", email: "admin@example.test", preferred_username: "admin@example.test" } })
  f.account.groups.splice(0)
  const result = await webExchange(f)
  expect(result.person.id).toBe(oid)
  expect(await f.client.resolve(result.tokens.accessToken, [row(`group:${group}`, "admin")])).toEqual({ id: oid, roles: [], canWrite: false })
})

test("web directory exposes only the authenticated user and never asks for guest-forbidden directory enumeration", async () => {
  const f = await microsoftFixture()
  const result = await webExchange(f)
  expect(await f.client.directory(result.tokens.accessToken)).toEqual([result.person])
  expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/users")).toBe(false)
})

test("web authorization resolves immutable IDs and rereads removal with no display-name queries", async () => {
  const f = await microsoftFixture()
  const result = await webExchange(f)
  const map = [row(`group:${group}`, "admin"), row(null)]
  expect(await f.client.resolve(result.tokens.accessToken, map)).toEqual({ id: oid, roles: [{ surface: "dashboard", role: "admin" }], canWrite: true })
  f.account.groups.splice(0)
  expect(await f.client.resolve(result.tokens.accessToken, map)).toEqual({ id: oid, roles: [], canWrite: false })
  expect(f.requests.filter((request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups")).toHaveLength(2)
  expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/groups")).toBe(false)
})

test("role mapping cannot change privilege while a directory resolution is pending", async () => {
  const f = await microsoftFixture()
  const result = await webExchange(f)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  f.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== "/v1.0/me/checkMemberGroups") return undefined
    entered.resolve()
    await release.promise
    return undefined
  }
  const map = [row(`group:${group}`)]
  const pending = f.client.resolve(result.tokens.accessToken, map)
  await entered.promise
  map[0].role = "admin"
  map[0].surface = "planner"
  release.resolve()
  expect(await pending).toEqual({ id: oid, roles: [{ surface: "dashboard", role: "viewer" }], canWrite: false })
})

for (const mapping of ["Guest", "Administrator", group, `group:${group} `, "group:not-an-id", "person:admin@example.test"]) {
  test(`web mode refuses noncanonical or legacy mappings: ${mapping}`, async () => {
    const f = await microsoftFixture()
    const result = await webExchange(f)
    await failure(() => f.client.resolve(result.tokens.accessToken, [row(mapping, "admin")]))
    expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/groups")).toBe(false)
    expect(f.requests.some((request) => new URL(request.url).pathname === "/v1.0/me/checkMemberGroups")).toBe(false)
  })
}

test("web mode refuses invented product roles before directory lookup", async () => {
  const f = await microsoftFixture()
  const result = await webExchange(f)
  const count = f.requests.length
  await failure(() => f.client.resolve(result.tokens.accessToken, [row(`group:${group}`, "superuser")]))
  expect(f.requests).toHaveLength(count)
})

test("confidential profile cannot silently downgrade or receive a public-client secret", async () => {
  for (const options of [
    { tenantId: tenant, clientId, profile: "web-confidential" },
    { tenantId: tenant, clientId, profile: "unknown" },
    { tenantId: tenant, clientId, profile: "local-public", clientSecret: async () => syntheticSecret },
    { tenantId: tenant, clientId, clientSecret: async () => syntheticSecret },
  ]) expect(() => createEntraClient(options as EntraOptions)).toThrow("Invalid Entra client profile")
})

for (const credential of ["", " ", "synthetic\ncredential", "x".repeat(4097)]) {
  test(`invalid private credential fails before token POST (${credential.length} chars)`, async () => {
    const f = await microsoftFixture()
    const client = createEntraClient({ ...f.options, clientSecret: async () => credential })
    const error = await failure(() => webExchange(f, client))
    expect(error).toContain("credential unavailable")
    expect(f.requests.some((request) => request.url === f.metadata.token_endpoint)).toBe(false)
  })
}

test("private credential provider failure is sanitized", async () => {
  const f = await microsoftFixture()
  const client = createEntraClient({ ...f.options, clientSecret: async () => { throw new Error(`Synthetic failure ${syntheticSecret}`) } })
  expect(await failure(() => webExchange(f, client))).not.toContain(syntheticSecret)
  expect(f.requests.some((request) => request.url === f.metadata.token_endpoint)).toBe(false)
})

test("client snapshots application/profile/transport and credential provider", async () => {
  const f = await microsoftFixture()
  const client = createEntraClient(f.options)
  f.options.clientId = other
  f.options.tenantId = other
  f.options.profile = "local-public"
  f.options.clientSecret = async () => "wrong-synthetic-credential"
  f.options.fetch = async () => { throw new Error("Mutated transport must not run") }
  expect((await webExchange(f, client)).person.id).toBe(oid)
  expect(client).toMatchObject({ tenantId: tenant, clientId, profile: "web-confidential" })
})

for (const tokenType of [undefined, "MAC", "bearer"]) {
  test(`confidential profile rejects missing or unsupported token type: ${String(tokenType)}`, async () => {
    const f = await microsoftFixture()
    f.hooks.before = (request) => request.url === f.metadata.token_endpoint ? Response.json({ access_token: "synthetic-unverified", expires_in: 3600, ...(tokenType === undefined ? {} : { token_type: tokenType }) }) : undefined
    await failure(() => webExchange(f))
    expect(f.requests.some((request) => request.url.startsWith(graph))).toBe(false)
  })
}
