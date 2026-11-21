import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { createLocalIdentity } from "../runtime/local-identity.ts"
import type { EntraClient, EntraTeamsInput, EntraTeamsResult, LocalSecrets } from "../runtime/local-contract.ts"

const origin = "http://localhost:4110"
const mount = "/sucafina"
const tenantId = "11111111-2222-4333-8444-555555555555"
const teamId = "77777777-7777-4777-8777-777777777777"
const person = { id: "0fe3ac10-c944-4eb6-8812-c67f5202a32f", name: "Directory Person" }

function fixture(joinedTeams?: EntraClient["joinedTeams"]) {
  const records = new Map<string, { value: Uint8Array; expires: number }>()
  const reads: string[] = []
  const writes: string[] = []
  const calls = { exchange: 0, refresh: 0, resolve: 0, readActive: 0, state: "", nonce: "", challenge: "", verifier: "", wrongPerson: false, refreshWithSameToken: false }
  const clock = { value: 1800000000000 }
  const originalTokenExpiry = clock.value + 120000
  const secrets: LocalSecrets = {
    async put(key, value, expires) { writes.push(key); records.set(key, { value: new Uint8Array(value), expires }) },
    async get(key, at) { reads.push(key); const record = records.get(key); return record && record.expires > at ? new Uint8Array(record.value) : undefined },
    async getActive(key, revokedKey, at) {
      calls.readActive++
      const revocation = records.get(revokedKey)
      const record = records.get(key)
      if (revocation && revocation.expires > at) return undefined
      return record && record.expires > at ? new Uint8Array(record.value) : undefined
    },
    async take(key, at) { const value = await secrets.get(key, at); records.delete(key); return value },
    async remove(key) { writes.push(key); records.delete(key) },
  }
  const tokens = (expiresAt = clock.value + 120000) => ({
    accessToken: "PRIVATE_ACCESS_TOKEN", refreshToken: "PRIVATE_REFRESH_TOKEN", expiresAt,
    ...(joinedTeams ? { grantedScopes: ["Team.ReadBasic.All"] } : {}),
  })
  const client: EntraClient = {
    ...(joinedTeams ? { tenantId, joinedTeams } : {}),
    async authorization(input) { calls.state = input.state; calls.nonce = input.nonce; calls.challenge = input.challenge; return `https://login.microsoftonline.com/authorize?state=${input.state}` },
    async exchange(input) { calls.exchange++; calls.verifier = input.verifier; expect(input.nonce).toBe(calls.nonce); return { person, tokens: tokens() } },
    async refresh() { calls.refresh++; return tokens(calls.refreshWithSameToken ? originalTokenExpiry : undefined) },
    async person() { return calls.wrongPerson ? { ...person, id: "1fe3ac10-c944-4eb6-8812-c67f5202a32f" } : person },
    async directory() { return [person] },
    async resolve(_token, map) { calls.resolve++; return { id: person.id, canWrite: true, roles: map.filter((row) => row.entra).map((row) => ({ surface: row.surface, role: row.role })) } },
  }
  const key = randomBytes(32)
  const identity = createLocalIdentity({ origin, mount, client, secrets, key, now: () => new Date(clock.value) })
  const request = (path: string, cookie?: string, init?: RequestInit) => new Request(`${origin}${mount}${path}`, { ...init, headers: { ...(cookie ? { cookie } : {}), ...init?.headers } })
  const login = async (returnTo = `${mount}/planner?page=budget`) => {
    const begin = await identity.handle(request(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`))
    expect(begin?.status).toBe(303)
    const loginCookie = begin!.headers.getSetCookie()[0].split(";")[0]
    const callback = () => identity.handle(request(`/auth/callback?code=provider-code&state=${calls.state}`, loginCookie))
    const response = await callback()
    expect(response?.status).toBe(303)
    const cookie = response!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
    return { cookie, response: response!, callback, loginCookie }
  }
  return { identity, records, reads, writes, calls, clock, secrets, request, login, key, client }
}

test("PKCE credentials stay encrypted, cookies scoped and callback single-use", async () => {
  const f = fixture()
  const result = await f.login()
  expect(f.calls.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(f.calls.challenge).toBe(Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(f.calls.verifier))).toString("base64url"))
  expect(result.response.headers.get("location")).toBe(`${mount}/planner?page=budget`)
  expect(result.response.headers.get("cache-control")).toBe("no-store")
  expect(result.response.headers.getSetCookie().join(";")).toContain(`Path=${mount}; HttpOnly; SameSite=Lax`)
  expect(result.cookie).not.toContain("PRIVATE")
  expect((await result.callback())?.status).toBe(403)
  expect(f.calls.exchange).toBe(1)
  for (const record of f.records.values()) {
    expect(Buffer.from(record.value).toString()).not.toContain("PRIVATE")
    expect(Buffer.from(record.value).toString()).not.toContain(person.name)
  }
})

test.each(["https://attacker.example", "//attacker.example", "/sucafina/auth/logout", "/sucafina/../api", "/sucafina/planner\\@attacker.example"])("unsafe return destination %s falls back inside module", async (destination) => {
  const f = fixture()
  expect((await f.login(destination)).response.headers.get("location")).toBe(`${mount}/dashboard`)
})

test("callback requires matching browser state and expiry", async () => {
  const f = fixture()
  const begin = await f.identity.handle(f.request("/auth/login"))
  const cookie = begin!.headers.getSetCookie()[0].split(";")[0]
  expect((await f.identity.handle(f.request(`/auth/callback?code=x&state=${f.calls.state}`)))?.status).toBe(403)
  expect((await f.identity.handle(f.request(`/auth/callback?code=x&state=${"a".repeat(64)}`, cookie)))?.status).toBe(403)
  f.clock.value += 601000
  expect((await f.identity.handle(f.request(`/auth/callback?code=x&state=${f.calls.state}`, cookie)))?.status).toBe(403)
  expect(f.calls.exchange).toBe(0)
})

test("authentication reads only, refresh is explicit and membership resolves fresh in selected surface", async () => {
  const f = fixture()
  const { cookie } = await f.login()
  const request = f.request("/planner", cookie)
  const context = { surface: "planner" as const, roleMap: [{ surface: "planner" as const, role: "admin", entra: "Actual group", version: 0, by: "" }] }
  f.writes.length = 0
  expect((await f.identity.authenticate(request, context))?.id).toBe(person.id)
  expect((await f.identity.authenticate(request, context))?.roles).toEqual([{ surface: "planner", role: "admin" }])
  expect(f.calls.resolve).toBe(2)
  expect(f.writes).toEqual([])
  f.clock.value += 121000
  expect(await f.identity.authenticate(request, context)).toBeNull()
  expect(f.calls.refresh).toBe(0)
  await Promise.all([f.identity.prepare(request), f.identity.prepare(request)])
  expect(f.calls.refresh).toBe(1)
  expect((await f.identity.authenticate(request, context))?.id).toBe(person.id)
})

test("refresh cannot adopt a different directory identity", async () => {
  const f = fixture()
  const { cookie } = await f.login()
  f.clock.value += 121000
  f.calls.wrongPerson = true
  await f.identity.prepare(f.request("/planner", cookie))
  expect(await f.identity.person(f.request("/planner", cookie))).toBeNull()
})

test("tampering or a different installation key fails closed", async () => {
  const f = fixture()
  const { cookie } = await f.login()
  const other = createLocalIdentity({ origin, mount, client: f.client, secrets: f.secrets, key: randomBytes(32), now: () => new Date(f.clock.value) })
  expect(await other.person(f.request("/planner", cookie))).toBeNull()
  for (const record of f.records.values()) record.value[record.value.length - 1] ^= 1
  expect(await f.identity.person(f.request("/planner", cookie))).toBeNull()
})

test("logout requires same-origin POST and revokes copied browser cookie", async () => {
  const f = fixture()
  const { cookie } = await f.login()
  expect((await f.identity.handle(f.request("/auth/logout", cookie)))?.status).toBe(405)
  expect((await f.identity.handle(f.request("/auth/logout", cookie, { method: "POST", headers: { origin: "https://attacker.example" } })))?.status).toBe(403)
  expect(await f.identity.person(f.request("/planner", cookie))).toEqual(person)
  const response = await f.identity.handle(f.request("/auth/logout", cookie, { method: "POST", headers: { origin } }))
  expect(response?.status).toBe(204)
  expect(response!.headers.getSetCookie().join(";")).toContain("Max-Age=0")
  expect(await f.identity.person(f.request("/planner", cookie))).toBeNull()
})

const directMembership = (principalObjectId = person.id): Extract<EntraTeamsResult, { state: "complete" }> => ({
  state: "complete", tenantId, principalObjectId, source: "joinedTeams", membership: "direct",
  teams: [{ teamObjectId: teamId, name: "Finance", archived: false }],
})

test("Team membership reads only the Microsoft principal stored with the opaque session", async () => {
  const observed: EntraTeamsInput[] = []
  const f = fixture(async (input) => { observed.push(input); return directMembership() })
  const read = f.identity.teamDirectory
  if (!read) throw new Error("Team observation must be available for the configured client")
  const { cookie } = await f.login()
  const headers = { "x-sf-team-profile": JSON.stringify({ tenantId: teamId, principalObjectId: teamId }) }
  f.reads.length = 0
  const result = await read(f.request("/planner?tenantId=" + teamId + "&principalObjectId=" + teamId, cookie, { headers }))
  expect(result).toEqual(directMembership())
  expect(observed).toEqual([{
    principal: { tenantId, principalObjectId: person.id },
    tokens: expect.objectContaining({ accessToken: "PRIVATE_ACCESS_TOKEN", grantedScopes: ["Team.ReadBasic.All"] }),
  }])
  expect(JSON.stringify(result)).not.toContain("PRIVATE")
  expect(f.calls.resolve).toBe(0)
  expect(f.calls.readActive).toBe(2)
  expect(f.reads).toEqual([])
})

test("Team membership requires a current session on the original installation request", async () => {
  const observed: EntraTeamsInput[] = []
  const f = fixture(async (input) => { observed.push(input); return directMembership() })
  const read = f.identity.teamDirectory
  if (!read) throw new Error("Team observation must be available for the configured client")
  const { cookie } = await f.login()
  const aborted = new AbortController()
  aborted.abort()
  for (const request of [
    f.request("/planner"),
    new Request("https://foreign.example/sucafina/planner", { headers: { cookie } }),
    new Request(origin + "/different-installation/planner", { headers: { cookie } }),
    f.request("/planner", cookie, { headers: { origin: "https://foreign.example" } }),
    f.request("/planner", cookie, { signal: aborted.signal }),
  ]) expect((await read(request)).state).not.toBe("complete")
  expect(observed).toHaveLength(0)
  expect(fixture().identity.teamDirectory).toBeUndefined()
})

test("Team membership discards another principal returned by the provider", async () => {
  const f = fixture(async () => directMembership(teamId))
  const read = f.identity.teamDirectory
  if (!read) throw new Error("Team observation must be available for the configured client")
  const { cookie } = await f.login()
  expect(await read(f.request("/planner", cookie))).toEqual({ state: "unavailable", reason: "identity_mismatch" })
})

for (const action of ["logout", "a refresh with identical token fields"] as const) {
  test(`Team membership discards Graph results when ${action} changes the session in flight`, async () => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const f = fixture(async () => {
      entered.resolve()
      await release.promise
      return directMembership()
    })
    const read = f.identity.teamDirectory
    if (!read) throw new Error("Team observation must be available for the configured client")
    const { cookie } = await f.login()
    const request = f.request("/planner", cookie)
    const pending = read(request)
    await Promise.race([entered.promise, pending.then(() => { throw new Error("Team observation settled before Graph") })])
    try {
      if (action === "logout") {
        const response = await f.identity.handle(f.request("/auth/logout", cookie, { method: "POST", headers: { origin } }))
        expect(response?.status).toBe(204)
      } else {
        f.calls.refreshWithSameToken = true
        f.clock.value += 61000
        await f.identity.prepare(request)
        expect(f.calls.refresh).toBe(1)
        expect(await f.identity.person(request)).toEqual(person)
      }
    } finally {
      release.resolve()
    }
    expect(await pending).toEqual({ state: "unauthenticated" })
  })
}
