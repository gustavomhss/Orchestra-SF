import { afterEach, expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEntraClient } from "../runtime/entra-client.ts"
import { createLocalIdentity, createMicrosoftIdentity } from "../runtime/local-identity.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { clientId, group, microsoftFixture, oid, other, tenant } from "./microsoft-login/oidc-fixture.ts"

const origin = "https://sucafina.synthetic.example"
const mount = "/sucafina"
const cleanups: (() => Promise<void>)[] = []
const context = { surface: "planner" as const, roleMap: [
  { surface: "planner" as const, role: "viewer", entra: `group:${group}`, version: 0, by: "synthetic-owner" },
  { surface: "dashboard" as const, role: "admin", entra: `group:${group}`, version: 0, by: "synthetic-owner" },
] }

afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

async function fixture(input: { sessionSeconds?: number; loginSeconds?: number; tokenSeconds?: number; teams?: "direct"; grantedScopes?: string | null } = {}) {
  const provider = await microsoftFixture({ tokenSeconds: input.tokenSeconds, teams: input.teams, grantedScopes: input.grantedScopes })
  const directory = await mkdtemp(join(tmpdir(), "sf-microsoft-session-"))
  const store = await openLocalStore(directory)
  cleanups.push(async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) })
  const key = randomBytes(32)
  const options = { origin, mount, tenantId: tenant, clientId, client: provider.client, secrets: store.secrets, key, now: () => new Date(provider.clock.value), ...input }
  const identity = createMicrosoftIdentity(options)
  const request = (path: string, cookies?: string, init?: RequestInit) => new Request(`${origin}${mount}${path}`, { ...init, headers: { ...(cookies ? { cookie: cookies } : {}), ...init?.headers } })
  const start = async (user = oid, returnTo = `${mount}/planner`, previous?: string) => {
    const response = await identity.handle(request(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, previous))
    expect(response?.status).toBe(303)
    const location = response!.headers.get("location")!
    const code = await provider.issueCode(location, user)
    const state = new URL(location).searchParams.get("state")!
    const cookie = response!.headers.getSetCookie()[0].split(";")[0]
    const cookies = [cookie, ...(previous ? [previous] : [])].join("; ")
    return { state, code, cookie, response: response!, callback: () => identity.handle(request(`/auth/callback?code=${encodeURIComponent(code)}&state=${state}`, cookies)) }
  }
  const login = async (user = oid, returnTo = `${mount}/planner`, previous?: string) => {
    const begun = await start(user, returnTo, previous)
    const response = await begun.callback()
    expect(response?.status).toBe(303)
    const cookie = response!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
    return { ...begun, response: response!, cookie }
  }
  const logout = (cookie: string) => identity.handle(request("/auth/logout", cookie, { method: "POST", headers: { origin } }))
  return { identity, options, provider, directory, store, key, request, start, login, logout }
}

function barrier() {
  const state: { entered?: () => void; release?: () => void } = {}
  const entered = new Promise<void>((resolve) => { state.entered = resolve })
  const waiting = new Promise<void>((resolve) => { state.release = resolve })
  return { entered, release: () => state.release!(), hold: () => { state.entered!(); return waiting } }
}

test("HTTPS uses opaque scoped cookies and actual encrypted private persistence", async () => {
  const f = await fixture()
  const login = await f.login()
  const cookies = login.response.headers.getSetCookie().join(";")
  expect(cookies).toContain("__Secure-sucafina_")
  expect(cookies).toContain(`Path=${mount}; HttpOnly; SameSite=Lax`)
  expect(cookies).toContain("; Secure")
  expect(cookies).not.toContain("Domain=")
  expect(cookies).not.toContain("synthetic-access-")
  expect(login.response.headers.get("cache-control")).toBe("no-store")
  expect(login.response.headers.get("referrer-policy")).toBe("no-referrer")
  expect(await f.identity.person(f.request("/planner", login.cookie))).toEqual({ id: oid, name: f.provider.account.name })
  for (const name of await readdir(f.directory)) {
    const bytes = await readFile(join(f.directory, name))
    expect(bytes.includes(Buffer.from("synthetic-access-"))).toBe(false)
    expect(bytes.includes(Buffer.from("synthetic-refresh-"))).toBe(false)
    expect(bytes.includes(Buffer.from(f.provider.account.name))).toBe(false)
  }
  const rotated = await f.login(oid, `${mount}/planner`, login.cookie)
  expect(rotated.cookie).not.toBe(login.cookie)
  expect(await f.identity.person(f.request("/planner", login.cookie))).toBeNull()
  expect(await f.identity.person(f.request("/planner", rotated.cookie))).not.toBeNull()
  expect((await login.callback())?.status).toBe(403)
})

test("HTTPS identity rejects insecure origins, wrong client profile and unbounded lifetimes", async () => {
  const f = await fixture()
  for (const bad of ["http://sucafina.synthetic.example", "https://localhost", "https://localhost.", "https://foo.localhost.",
    "https://127.0.0.1", "https://[::1]", "https://10.0.0.1", "https://internal", "https://app.local", "https://app.localhost", "https://bad..example",
    "https://sucafina.synthetic.example:8443", "https://sucafina.synthetic.example/path", "https://sucafina.synthetic.example/"]) {
    expect(() => createMicrosoftIdentity({ ...f.options, origin: bad })).toThrow()
  }
  expect(() => createMicrosoftIdentity({ ...f.options, tenantId: other })).toThrow()
  expect(() => createMicrosoftIdentity({ ...f.options, clientId: other })).toThrow()
  expect(() => createMicrosoftIdentity({ ...f.options, sessionSeconds: 28801 })).toThrow()
  expect(() => createMicrosoftIdentity({ ...f.options, loginSeconds: 601 })).toThrow()
  expect(() => createMicrosoftIdentity({ ...f.options, sessionSeconds: 0 })).toThrow()
  const publicClient = createEntraClient({ ...f.provider.options, profile: "local-public", clientSecret: undefined })
  expect(() => createMicrosoftIdentity({ ...f.options, client: publicClient })).toThrow()
  expect(() => createLocalIdentity(f.options)).toThrow("Explicit loopback origin required")
})

test("browser state, callback parameters and expiry fail closed before token redemption", async () => {
  const f = await fixture({ loginSeconds: 3 })
  const begun = await f.start()
  const path = `/auth/callback?code=${begun.code}&state=${begun.state}`
  expect((await f.identity.handle(f.request(path)))?.status).toBe(403)
  expect((await f.identity.handle(f.request(`/auth/callback?code=${begun.code}&state=${"a".repeat(64)}`, begun.cookie)))?.status).toBe(403)
  expect((await f.identity.handle(f.request(`${path}&state=${begun.state}`, begun.cookie)))?.status).toBe(403)
  expect((await f.identity.handle(f.request(path, `${begun.cookie}; ${begun.cookie}`)))?.status).toBe(403)
  f.provider.clock.value += 3001
  expect((await begun.callback())?.status).toBe(403)
  expect(f.provider.requests.some((entry) => entry.url === f.provider.metadata.token_endpoint)).toBe(false)
})

test("provider error, missing or duplicate code consume the one-time callback", async () => {
  const f = await fixture()
  for (const query of ["error=access_denied", "", "code=synthetic-one&code=synthetic-two"]) {
    const begun = await f.start()
    expect((await f.identity.handle(f.request(`/auth/callback?state=${begun.state}&${query}`, begun.cookie)))?.status).toBe(403)
    expect((await begun.callback())?.status).toBe(403)
  }
  expect(f.provider.requests.some((entry) => entry.url === f.provider.metadata.token_endpoint)).toBe(false)
})

test.each(["tenant", "audience", "nonce", "expired", "signature", "algorithm"] as const)("HTTPS confidential callback rejects invalid %s without establishing a private session", async (fault) => {
  const f = await fixture()
  const claims: Record<string, Record<string, unknown>> = {
    tenant: { tid: other }, audience: { aud: other }, nonce: { nonce: "synthetic-wrong-nonce" },
    expired: { exp: Math.floor(f.provider.clock.value / 1000) - 1 },
  }
  Object.assign(f.provider.claims, claims[fault])
  if (fault === "signature" || fault === "algorithm") {
    f.provider.hooks.before = async (request) => {
      if (request.url !== f.provider.metadata.token_endpoint) return undefined
      f.provider.hooks.before = undefined
      // Redeem the real one-use code with confidential credentials and PKCE before corrupting its signed result.
      const response = await f.provider.fetch(request)
      const body = await response.json() as { id_token: string }
      const parts = body.id_token.split(".")
      if (fault === "signature") parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1)
      else parts[0] = Buffer.from(JSON.stringify({ alg: "HS256", kid: "synthetic-rsa-key" })).toString("base64url")
      return Response.json({ ...body, id_token: parts.join(".") })
    }
  }
  const begun = await f.start()
  const response = await begun.callback()
  expect(response?.status).toBe(403)
  expect(response!.headers.getSetCookie().some((cookie) => cookie.includes("_session="))).toBe(false)
  expect(f.provider.requests.some((request) => request.url === f.provider.metadata.token_endpoint)).toBe(true)
  const copied = begun.cookie.replace("_login=", "_session=")
  expect(await f.identity.person(f.request("/planner", copied))).toBeNull()
  expect(await f.identity.authenticate(f.request("/planner", copied), context)).toBeNull()
  expect((await begun.callback())?.status).toBe(403)
})

test("unsafe return targets stay within real Sucafina surfaces", async () => {
  const f = await fixture()
  for (const returnTo of ["https://attacker.example", "//attacker.example", "/sucafina/../api", "/sucafina/planner\\@attacker.example", "/sucafina/auth/logout"]) {
    expect((await f.login(oid, returnTo)).response.headers.get("location")).toBe(`${mount}/dashboard`)
  }
  expect((await f.login(oid, `${mount}/procurement?page=pending`)).response.headers.get("location")).toBe(`${mount}/procurement?page=pending`)
})

test("immutable individual subjects receive only current assigned surface roles", async () => {
  const f = await fixture()
  const first = await f.login()
  const second = await f.login(other)
  expect(await f.identity.authenticate(f.request("/planner", first.cookie), context)).toEqual({ id: oid, canWrite: false, roles: [{ surface: "planner", role: "viewer" }] })
  expect((await f.identity.authenticate(f.request("/planner", second.cookie), context))?.id).toBe(other)
  f.provider.account.groups = []
  expect(await f.identity.authenticate(f.request("/planner", first.cookie), context)).toBeNull()
  expect((await f.identity.authenticate(f.request("/planner", second.cookie), context))?.id).toBe(other)
  expect(await f.identity.authenticate(f.request("/planner", second.cookie), { surface: "planner", roleMap: [] })).toBeNull()
  expect(await f.identity.directory(f.request("/planner", second.cookie))).toEqual([{ id: other, name: f.provider.second.name }])
  expect(f.provider.requests.some((entry) => new URL(entry.url).pathname === "/v1.0/users")).toBe(false)
})

test("copied cookie stays revoked after reopening the actual private store", async () => {
  const f = await fixture()
  const login = await f.login()
  expect((await f.logout(login.cookie))?.status).toBe(204)
  await f.store.dispose()
  const reopened = await openLocalStore(f.directory)
  cleanups.unshift(() => reopened.dispose())
  const identity = createMicrosoftIdentity({ ...f.options, secrets: reopened.secrets })
  expect(await identity.person(f.request("/planner", login.cookie))).toBeNull()
  expect(await identity.authenticate(f.request("/planner", login.cookie), context)).toBeNull()
})

test("absolute session expiry cannot be extended by refresh", async () => {
  const f = await fixture({ sessionSeconds: 120, tokenSeconds: 90 })
  const login = await f.login()
  f.provider.clock.value += 80000
  await f.identity.prepare(f.request("/planner", login.cookie))
  expect(await f.identity.person(f.request("/planner", login.cookie))).not.toBeNull()
  f.provider.clock.value += 40001
  await f.identity.prepare(f.request("/planner", login.cookie))
  expect(await f.identity.person(f.request("/planner", login.cookie))).toBeNull()
  expect(await f.identity.authenticate(f.request("/planner", login.cookie), context)).toBeNull()
})

test("logout wins an in-flight refresh and the copied cookie never revives", async () => {
  const f = await fixture({ tokenSeconds: 90 })
  const login = await f.login()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  f.provider.clock.value += 40000
  const refreshing = f.identity.prepare(f.request("/planner", login.cookie))
  await gate.entered
  expect((await f.logout(login.cookie))?.status).toBe(204)
  gate.release()
  await refreshing
  expect(await f.identity.person(f.request("/planner", login.cookie))).toBeNull()
  expect(await f.identity.authenticate(f.request("/planner", login.cookie), context)).toBeNull()
})

test("logout cancels callback redemption even before a session exists", async () => {
  const f = await fixture({ sessionSeconds: 1 })
  const begun = await f.start()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  const pending = begun.callback()
  await gate.entered
  expect((await f.logout(begun.cookie))?.status).toBe(204)
  f.provider.clock.value += 2000
  gate.release()
  const result = await pending
  expect(result?.status).toBe(403)
  expect(result!.headers.getSetCookie().some((value) => value.includes("_session="))).toBe(false)
  expect((await begun.callback())?.status).toBe(403)
})

test("callback expiry while the provider is pending cannot create a session", async () => {
  const f = await fixture({ loginSeconds: 3 })
  const begun = await f.start()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  const pending = begun.callback()
  await gate.entered
  f.provider.clock.value += 3001
  gate.release()
  expect((await pending)?.status).toBe(403)
})

test("authorization awaiting Graph cannot emit identity after logout or session expiry", async () => {
  for (const cause of ["logout", "expiry"]) {
    const f = await fixture({ sessionSeconds: 30 })
    const login = await f.login()
    const gate = barrier()
    f.provider.hooks.before = async (request) => { if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") await gate.hold(); return undefined }
    const authorizing = f.identity.authenticate(f.request("/planner", login.cookie), context)
    await gate.entered
    if (cause === "logout") expect((await f.logout(login.cookie))?.status).toBe(204)
    if (cause === "expiry") f.provider.clock.value += 30001
    gate.release()
    expect(await authorizing).toBeNull()
  }
})

test("directory lookup cannot return private identity after logout", async () => {
  const f = await fixture()
  const login = await f.login()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (new URL(request.url).pathname === "/v1.0/me") await gate.hold(); return undefined }
  const reading = f.identity.directory(f.request("/planner", login.cookie))
  await gate.entered
  expect((await f.logout(login.cookie))?.status).toBe(204)
  gate.release()
  expect(await reading).toEqual([])
})

test("logout fences a pending authorization inside the real business transaction", async () => {
  const f = await fixture()
  const login = await f.login()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") await gate.hold(); return undefined }
  const authorizing = f.store.transaction("planner", async () => ({ commit: false, value: await f.identity.authenticate(f.request("/planner", login.cookie), context) }))
  await gate.entered
  const loggingOut = f.logout(login.cookie)
  gate.release()
  expect(await authorizing).toBeNull()
  expect((await loggingOut)?.status).toBe(204)
  expect(await f.identity.person(f.request("/planner", login.cookie))).toBeNull()
})

test("durable logout wins between refresh validation and the real private-store write", async () => {
  const f = await fixture({ tokenSeconds: 90 })
  const login = await f.login()
  const gate = barrier()
  const pending = { storageKey: "" }
  // Delay only persistence scheduling; bytes and all operations use the actual private SQLite store.
  const identity = createMicrosoftIdentity({ ...f.options, secrets: { ...f.store.secrets,
    async put(storageKey, value, expiresAt) {
      if (storageKey.includes(":session:")) { pending.storageKey = storageKey; await gate.hold() }
      await f.store.secrets.put(storageKey, value, expiresAt)
    },
  } })
  f.provider.clock.value += 40000
  const refreshing = identity.prepare(f.request("/planner", login.cookie))
  await gate.entered
  expect((await f.logout(login.cookie))?.status).toBe(204)
  gate.release()
  await refreshing
  expect(await identity.person(f.request("/planner", login.cookie))).toBeNull()
  expect(await f.store.secrets.get(pending.storageKey, f.provider.clock.value)).toBeUndefined()
})

test("origin, installation and resource-tenant boundaries reject the same opaque cookie", async () => {
  const f = await fixture()
  const login = await f.login()
  const foreign = new Request(`https://attacker.example${mount}/planner`, { headers: { cookie: login.cookie } })
  expect(await f.identity.person(foreign)).toBeNull()
  expect(await f.identity.authenticate(foreign, context)).toBeNull()
  expect(await f.identity.directory(foreign)).toEqual([])
  const wrongOrigin = createMicrosoftIdentity({ ...f.options, origin: "https://other.synthetic.example" })
  expect(await wrongOrigin.person(new Request(`https://other.synthetic.example${mount}/planner`, { headers: { cookie: login.cookie } }))).toBeNull()
  const wrongTenant = createMicrosoftIdentity({ ...f.options, tenantId: other, client: createEntraClient({ ...f.provider.options, tenantId: other }) })
  expect(await wrongTenant.person(f.request("/planner", login.cookie))).toBeNull()
  const wrongClient = createMicrosoftIdentity({ ...f.options, clientId: other, client: createEntraClient({ ...f.provider.options, clientId: other }) })
  expect(await wrongClient.person(f.request("/planner", login.cookie))).toBeNull()
  const wrongKey = createMicrosoftIdentity({ ...f.options, key: randomBytes(32) })
  expect(await wrongKey.person(f.request("/planner", login.cookie))).toBeNull()
})

test("identity pins caller configuration and method references for its full lifetime", async () => {
  const f = await fixture()
  const login = await f.login()
  const config = { ...f.options, client: { ...f.provider.client }, secrets: { ...f.store.secrets } }
  const identity = createMicrosoftIdentity(config)
  config.origin = "https://attacker.example"
  config.mount = "/other"
  config.client.resolve = async () => ({ id: other, canWrite: true, roles: [{ surface: "planner", role: "admin" }] })
  config.secrets.get = async () => undefined
  expect(await identity.authenticate(f.request("/planner", login.cookie), context)).toEqual({ id: oid, canWrite: false, roles: [{ surface: "planner", role: "viewer" }] })
  expect(await identity.person(f.request("/planner", login.cookie))).toEqual({ id: oid, name: f.provider.account.name })
  expect(await identity.person(new Request("https://attacker.example/other/planner", { headers: { cookie: login.cookie } }))).toBeNull()
})

test("logout requires exact same-origin POST and ignores forwarded origins", async () => {
  const f = await fixture()
  const login = await f.login()
  expect((await f.identity.handle(f.request("/auth/logout", login.cookie)))?.status).toBe(405)
  expect((await f.identity.handle(f.request("/auth/logout", login.cookie, { method: "POST", headers: { origin: "https://attacker.example", "x-forwarded-host": new URL(origin).host } })))?.status).toBe(403)
  expect((await f.identity.handle(f.request("/auth/logout", login.cookie, { method: "POST", headers: { origin, "sec-fetch-site": "cross-site" } })))?.status).toBe(403)
  expect(await f.identity.person(f.request("/planner", login.cookie))).not.toBeNull()
  expect((await f.logout(login.cookie))?.headers.getSetCookie().every((value) => value.includes("Max-Age=0") && value.includes("Secure"))).toBe(true)
})

async function teamsFixture(input: { sessionSeconds?: number; tokenSeconds?: number; grantedScopes?: string | null } = {}) {
  const f = await fixture({ ...input, teams: "direct" })
  const read = f.identity.teamDirectory
  if (!read) throw new Error("Explicit Microsoft Teams capability was not composed")
  return { ...f, read, readTeams: (cookie?: string) => read(f.request("/planner", cookie)) }
}

test("Teams directory capability is absent from the minimum Microsoft login", async () => {
  const f = await fixture()
  const login = await f.login()
  expect(f.identity.teamDirectory).toBeUndefined()
  expect(f.provider.client.joinedTeams).toBeUndefined()
  expect(f.provider.requests.some((request) => new URL(request.url).pathname.endsWith("/joinedTeams"))).toBe(false)
  expect(await f.identity.person(f.request("/planner", login.cookie))).not.toBeNull()
})

test("Teams directory binds verified private-session identity and exposes no credential", async () => {
  const f = await teamsFixture()
  const before = f.provider.requests.length
  expect(await f.readTeams()).toEqual({ state: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
  const team = { id: group, tenantId: tenant, displayName: "Synthetic Finance", isArchived: false }
  f.provider.directTeams.set(oid, [team])
  const login = await f.login()
  const observed = await f.readTeams(login.cookie)
  expect(observed).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: oid,
    source: "joinedTeams", membership: "direct",
    teams: [{ teamObjectId: group, name: team.displayName, archived: false }],
  })
  const serialized = JSON.stringify(observed)
  for (const forbidden of ["accessToken", "refreshToken", "idToken", "grantedScopes", "synthetic-access-", "synthetic-refresh-", login.cookie])
    expect(serialized).not.toContain(forbidden)
  // Selectors are not consulted by this server-only reader.
  expect(await f.read(new Request(`${origin}${mount}/planner?tenantId=${other}&principalObjectId=${other}&teamObjectId=${other}`, {
    headers: { cookie: login.cookie, "x-principal-id": other },
  }))).toEqual(observed)
})

test("Teams directory rejects missing, duplicate, foreign-origin and wrong-mount cookies before Graph", async () => {
  const f = await teamsFixture()
  const login = await f.login()
  const before = f.provider.requests.length
  for (const request of [
    f.request("/planner"),
    f.request("/planner", `${login.cookie}; ${login.cookie}`),
    new Request(`https://foreign.synthetic.example${mount}/planner`, { headers: { cookie: login.cookie } }),
    new Request(`${origin}/outside/planner`, { headers: { cookie: login.cookie } }),
  ]) expect(await f.read(request)).toEqual({ state: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
  const otherInstallation = createMicrosoftIdentity({ ...f.options, mount: "/other" })
  const otherRead = otherInstallation.teamDirectory
  if (!otherRead) throw new Error("Explicit capability missing")
  expect(await otherRead(new Request(`${origin}/other/planner`, { headers: { cookie: login.cookie } })))
    .toEqual({ state: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
})

test("Teams directory preserves missing consent and provider failure as errors instead of empty membership", async () => {
  const reduced = await teamsFixture({ grantedScopes: "User.Read" })
  const login = await reduced.login()
  const before = reduced.provider.requests.length
  expect(await reduced.readTeams(login.cookie)).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(reduced.provider.requests.length).toBe(before)

  const f = await teamsFixture()
  const signedIn = await f.login()
  f.provider.hooks.before = async (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
    ? Response.json({ error: "Authorization_RequestDenied" }, { status: 403 }) : undefined
  expect(await f.readTeams(signedIn.cookie)).toEqual({ state: "unavailable", reason: "forbidden" })
})

test("Teams directory re-reads membership and separates two principals in the same installation", async () => {
  const f = await teamsFixture()
  f.provider.directTeams.set(oid, [{ id: group, tenantId: tenant, displayName: "Same label", isArchived: false }])
  f.provider.directTeams.set(other, [{ id: clientId, tenantId: tenant, displayName: "Same label", isArchived: false }])
  const first = await f.login(oid)
  const second = await f.login(other)
  const a = await f.readTeams(first.cookie)
  const b = await f.readTeams(second.cookie)
  if (a.state !== "complete" || b.state !== "complete") throw new Error("Current Teams observations required")
  expect(a.principalObjectId).toBe(oid)
  expect(b.principalObjectId).toBe(other)
  expect(a.teams.map((team) => team.teamObjectId)).toEqual([group])
  expect(b.teams.map((team) => team.teamObjectId)).toEqual([clientId])
  f.provider.directTeams.set(oid, [])
  expect(await f.readTeams(first.cookie)).toEqual({ ...a, teams: [] })
  expect(await f.readTeams(second.cookie)).toEqual(b)
})

test("Teams directory cannot publish a pending result after logout or absolute expiry", async () => {
  for (const cause of ["logout", "expiry"]) {
    const f = await teamsFixture({ sessionSeconds: 30 })
    f.provider.directTeams.set(oid, [{ id: group, tenantId: tenant, displayName: "Private team", isArchived: false }])
    const login = await f.login()
    const gate = barrier()
    f.provider.hooks.before = async (request) => {
      if (new URL(request.url).pathname === "/v1.0/me/joinedTeams") await gate.hold()
      return undefined
    }
    const reading = f.readTeams(login.cookie)
    await gate.entered
    if (cause === "logout") expect((await f.logout(login.cookie))?.status).toBe(204)
    if (cause === "expiry") f.provider.clock.value += 30001
    gate.release()
    expect(await reading).toEqual({ state: "unauthenticated" })
  }
})

test("Teams directory fences the prior token when refresh finishes during its Graph read", async () => {
  const f = await teamsFixture({ tokenSeconds: 90 })
  const login = await f.login()
  f.provider.clock.value += 40000
  const gate = barrier()
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/joinedTeams") await gate.hold()
    return undefined
  }
  const reading = f.readTeams(login.cookie)
  await gate.entered
  await f.identity.prepare(f.request("/planner", login.cookie))
  gate.release()
  expect(await reading).toEqual({ state: "unauthenticated" })
  f.provider.hooks.before = undefined
  expect((await f.readTeams(login.cookie)).state).toBe("complete")
})

test("Teams directory cannot revive a copied cookie after reopening the real private store", async () => {
  const f = await teamsFixture()
  const login = await f.login()
  expect((await f.logout(login.cookie))?.status).toBe(204)
  await f.store.dispose()
  const reopened = await openLocalStore(f.directory)
  cleanups.unshift(() => reopened.dispose())
  const identity = createMicrosoftIdentity({ ...f.options, secrets: reopened.secrets })
  const read = identity.teamDirectory
  if (!read) throw new Error("Explicit capability missing")
  const before = f.provider.requests.length
  expect(await read(f.request("/planner", login.cookie))).toEqual({ state: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
})

test("Teams directory never retains prior consent when refreshed credentials omit scope", async () => {
  const f = await teamsFixture({ grantedScopes: null, tokenSeconds: 90 })
  const login = await f.login()
  expect((await f.readTeams(login.cookie)).state).toBe("complete")
  f.provider.clock.value += 40000
  await f.identity.prepare(f.request("/planner", login.cookie))
  const before = f.provider.requests.length
  expect(await f.readTeams(login.cookie)).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(f.provider.requests.length).toBe(before)
})

async function corporateObservation(f: Awaited<ReturnType<typeof fixture>>, cookie: string, init?: RequestInit) {
  const capture = f.identity.microsoftSession
  if (!capture) throw new Error("Microsoft session observation capability missing")
  const value = await capture(f.request("/profiles", cookie, init))
  if (!value) throw new Error("Verified Microsoft session required by this test")
  return value
}

test("Microsoft session observation exposes only the verified principal and private read closures", async () => {
  const f = await fixture()
  const login = await f.login()
  const value = await corporateObservation(f, login.cookie)
  expect(value.principal).toEqual({ tenantId: tenant, principalObjectId: oid })
  expect(Object.isFrozen(value)).toBe(true)
  expect(Object.isFrozen(value.principal)).toBe(true)
  expect(JSON.parse(JSON.stringify(value))).toEqual({ principal: value.principal })
  expect(await value.verifyCurrent()).toBe(true)
  expect(await value.teams()).toEqual({ state: "unavailable", reason: "capability_disabled" })
  expect(await value.team(group)).toEqual({ state: "unavailable", reason: "capability_disabled" })
  expect(await value.groupMembership(group)).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: oid, groupObjectId: group,
    source: "checkMemberGroups", membership: "transitive", member: true,
  })
  // A verified group observation neither selects a Team nor manufactures a business role.
  expect(await f.identity.authenticate(f.request("/planner", login.cookie), { surface: "planner", roleMap: [] })).toBeNull()
  expect(f.provider.requests.some((request) => request.url.includes("/joinedTeams"))).toBe(false)
  const publicClient = createEntraClient({ ...f.provider.options, profile: "local-public", clientSecret: undefined })
  expect(createLocalIdentity({ ...f.options, origin: "http://localhost:4110", client: publicClient }).microsoftSession).toBeUndefined()
})

test("Microsoft session capture rejects wrong transport, duplicate cookies and cancelled requests before Graph", async () => {
  const f = await teamsFixture()
  const login = await f.login()
  const capture = f.identity.microsoftSession
  if (!capture) throw new Error("Microsoft session observation capability missing")
  const controller = new AbortController()
  controller.abort()
  const before = f.provider.requests.length
  for (const request of [
    f.request("/profiles"),
    f.request("/profiles", login.cookie + "; " + login.cookie),
    f.request("/profiles", login.cookie, { signal: controller.signal }),
    f.request("/profiles", login.cookie, { headers: { origin: "https://foreign.synthetic.example" } }),
    f.request("/profiles", login.cookie, { headers: { "sec-fetch-site": "cross-site" } }),
    new Request("https://foreign.synthetic.example/sucafina/profiles", { headers: { cookie: login.cookie } }),
    new Request(origin + "/outside/profiles", { headers: { cookie: login.cookie } }),
  ]) expect(await capture(request)).toBeUndefined()
  expect(f.provider.requests.length).toBe(before)
  const value = await capture(f.request("/profiles?principalObjectId=" + other + "&tenantId=" + other, login.cookie, { headers: { "x-principal-id": other } }))
  expect(value?.principal).toEqual({ tenantId: tenant, principalObjectId: oid })
})

test("Microsoft group verification stays independent of failed or empty Teams enumeration", async () => {
  const f = await teamsFixture()
  const login = await f.login()
  const value = await corporateObservation(f, login.cookie)
  f.provider.hooks.before = async (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
    ? Response.json({ error: "Authorization_RequestDenied" }, { status: 403 }) : undefined
  expect(await value.teams()).toEqual({ state: "unavailable", reason: "forbidden" })
  expect(await value.groupMembership(group)).toMatchObject({ state: "complete", member: true, principalObjectId: oid })
  f.provider.hooks.before = undefined
  expect(await value.teams()).toMatchObject({ state: "complete", teams: [] })
  expect(await value.groupMembership(group)).toMatchObject({ state: "complete", member: true })
  expect(await value.verifyCurrent()).toBe(true)
})

test("Microsoft group observation rechecks current membership and never unites two principals", async () => {
  const f = await fixture()
  const first = await f.login(oid)
  const second = await f.login(other)
  const a = await corporateObservation(f, first.cookie)
  const b = await corporateObservation(f, second.cookie)
  f.provider.second.groups.splice(0)
  expect(await a.groupMembership(group)).toMatchObject({ state: "complete", principalObjectId: oid, member: true })
  expect(await b.groupMembership(group)).toMatchObject({ state: "complete", principalObjectId: other, member: false })
  f.provider.account.groups.splice(0)
  expect(await a.groupMembership(group)).toMatchObject({ state: "complete", member: false })
  f.provider.account.groups.push(group)
  expect(await a.groupMembership(group)).toMatchObject({ state: "complete", member: true })
  expect(a).not.toBe(b)
})

test("Microsoft session can verify a provider-readable Team without asserting membership", async () => {
  const f = await teamsFixture()
  const login = await f.login()
  const value = await corporateObservation(f, login.cookie)
  f.provider.hooks.before = async (request) => new URL(request.url).pathname === "/v1.0/teams/" + group
    ? Response.json({ id: group, tenantId: tenant, displayName: "Verified provider team", isArchived: false }) : undefined
  expect(await value.teams()).toMatchObject({ state: "complete", teams: [] })
  expect(await value.team(group)).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: oid, source: "team",
    team: { teamObjectId: group, name: "Verified provider team", archived: false },
  })
  // Provider refusal remains an error; administration in this product cannot grant Graph access.
  f.provider.hooks.before = async (request) => new URL(request.url).pathname === "/v1.0/teams/" + group
    ? Response.json({ error: "Authorization_RequestDenied" }, { status: 403 }) : undefined
  expect(await value.team(group)).toEqual({ state: "unavailable", reason: "forbidden" })
})

test.each(["logout", "expiry", "refresh", "abort", "replace-login"])("Microsoft captured session is fenced after %s", async (cause) => {
  const f = await teamsFixture({ tokenSeconds: 90, sessionSeconds: 300 })
  const login = await f.login()
  const controller = new AbortController()
  const value = await corporateObservation(f, login.cookie, { signal: controller.signal })
  if (cause === "logout") expect((await f.logout(login.cookie))?.status).toBe(204)
  if (cause === "expiry") f.provider.clock.value += 300001
  if (cause === "abort") controller.abort()
  if (cause === "refresh") {
    f.provider.clock.value += 40000
    await f.identity.prepare(f.request("/profiles", login.cookie))
    expect(await (await corporateObservation(f, login.cookie)).verifyCurrent()).toBe(true)
  }
  if (cause === "replace-login") await f.login(oid, mount + "/planner", login.cookie)
  const before = f.provider.requests.length
  expect(await value.verifyCurrent()).toBe(false)
  expect(await value.teams()).toEqual({ state: "unauthenticated" })
  expect(await value.groupMembership(group)).toEqual({ state: "unauthenticated" })
  expect(await value.team(group)).toEqual({ state: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
})

test.each(["group", "team"])("Microsoft pending %s observation cannot outlive its captured session", async (kind) => {
  const f = await teamsFixture()
  const login = await f.login()
  const value = await corporateObservation(f, login.cookie)
  const gate = barrier()
  const target = kind === "group" ? "/v1.0/me/checkMemberGroups" : "/v1.0/teams/" + group
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== target) return undefined
    await gate.hold()
    return kind === "team" ? Response.json({ id: group, tenantId: tenant, displayName: "Late private team", isArchived: false }) : undefined
  }
  const pending = kind === "group" ? value.groupMembership(group) : value.team(group)
  await gate.entered
  expect((await f.logout(login.cookie))?.status).toBe(204)
  gate.release()
  expect(await pending).toEqual({ state: "unauthenticated" })
  expect(await value.verifyCurrent()).toBe(false)
})

test("Microsoft observation recheck sees logout inside an older real business transaction", async () => {
  const f = await fixture()
  const login = await f.login()
  const value = await corporateObservation(f, login.cookie)
  const gate = barrier()
  const reading = f.store.transaction("planner", async () => {
    await gate.hold()
    return { commit: false, value: await value.verifyCurrent() }
  })
  await gate.entered
  const logout = f.logout(login.cookie)
  gate.release()
  expect(await reading).toBe(false)
  expect((await logout)?.status).toBe(204)
})

test("Microsoft group observation refuses a refreshed token whose scopes are no longer confirmed", async () => {
  const f = await fixture({ tokenSeconds: 90, grantedScopes: null })
  const login = await f.login()
  const before = await corporateObservation(f, login.cookie)
  expect(await before.groupMembership(group)).toMatchObject({ state: "complete", member: true })
  f.provider.clock.value += 40000
  await f.identity.prepare(f.request("/profiles", login.cookie))
  expect(await before.verifyCurrent()).toBe(false)
  const current = await corporateObservation(f, login.cookie)
  expect(await current.verifyCurrent()).toBe(true)
  const requests = f.provider.requests.length
  expect(await current.groupMembership(group)).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(f.provider.requests.length).toBe(requests)
})
