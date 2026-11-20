import { afterEach, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Schema } from "effect"
import { group, oid, other } from "../microsoft-login/oidc-fixture.ts"
import { barrier, profileA, profileB, teamA, teamB, teamProfileFixture, teamRow } from "./installation-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(input: Parameters<typeof teamProfileFixture>[0] = {}) {
  const f = await teamProfileFixture(input)
  cleanups.push(f.close)
  return f
}
const enable = (expectedRevision = 0, profile = profileA) => ({ action: "enable", profile, expectedRevision })
const principalId = Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)
const select = (profile = profileA) => ({ contractRevision: "sf-team-profile/1", kind: "team", profile })

test("admin-admission-01: current corporate admin has an independent empty configuration with zero Teams", async () => {
  const f = await fixture()
  const cookie = await f.login()
  const listed = await f.resolver.list(f.request(undefined, cookie))
  expect(listed).toEqual({ status: "ok", configRevision: 0, profiles: [] })
  expect(Schema.decodeUnknownSync(TeamProfile.AdminListResult)(listed)).toEqual(listed)
  expect(f.provider.requests.some((request) => new URL(request.url).pathname.includes("/joinedTeams"))).toBe(false)
  const resolved = await f.resolver.resolve(f.request(undefined, cookie))
  expect(resolved).toMatchObject({ status: "authenticated", administration: { status: "available" }, teams: { status: "no-teams" } })
  expect(resolved).not.toHaveProperty("admission")
  expect(resolved).not.toHaveProperty("accessRevision")
})

test("admin-admission-01: enable first verified Team without membership, disable and remove last profile", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  const cookie = await f.login()
  const request = f.request(undefined, cookie)
  expect(await f.resolver.configure(request, enable())).toEqual({ status: "ok", configRevision: 1, changed: true })
  expect(f.provider.directTeams.get(oid)).toEqual([])
  expect(await f.resolver.resolve(request)).toMatchObject({ status: "authenticated", administration: { status: "available" }, teams: { status: "no-teams" } })
  const before = f.provider.requests.length
  expect(await f.resolver.configure(request, { action: "disable", profile: profileA, expectedRevision: 1 })).toEqual({ status: "ok", configRevision: 2, changed: true })
  expect(await f.resolver.configure(request, { action: "remove", profile: profileA, expectedRevision: 2 })).toEqual({ status: "ok", configRevision: 3, changed: true })
  expect(f.provider.requests.slice(before).some((entry) => new URL(entry.url).pathname.startsWith("/v1.0/teams/") || new URL(entry.url).pathname.endsWith("/joinedTeams"))).toBe(false)
  expect(await f.resolver.list(request)).toEqual({ status: "ok", configRevision: 3, profiles: [] })
  expect((await f.profiles.audit()).map((entry) => ({ action: entry.action, principal: entry.principal.principalObjectId }))).toEqual([
    { action: "enable", principal: principalId(oid) }, { action: "disable", principal: principalId(oid) }, { action: "remove", principal: principalId(oid) },
  ])
})

test("admin-admission-02: complete zero, one and many memberships never default a stale selector to another Team", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  f.provider.teamResources.set(teamB, teamRow(teamB))
  const cookie = await f.login()
  const request = f.request(undefined, cookie)
  await f.resolver.configure(request, enable())
  await f.resolver.configure(request, enable(1, profileB))
  expect(await f.resolver.resolve(request)).toMatchObject({ status: "authenticated", teams: { status: "no-teams" } })
  f.provider.directTeams.set(oid, [teamRow()])
  expect(await f.resolver.resolve(request)).toMatchObject({ status: "authenticated", teams: { status: "ready", selected: profileA } })
  f.provider.directTeams.set(oid, [teamRow(), teamRow(teamB)])
  const many = await f.resolver.resolve(request)
  expect(many).toMatchObject({ status: "authenticated", teams: { status: "selection-required" } })
  expect(many).not.toHaveProperty("admission")
  expect(await f.resolver.resolve(request, select(profileB))).toMatchObject({ teams: { status: "ready", selected: profileB } })
  f.provider.directTeams.set(oid, [teamRow(), teamRow(teamB, "Renamed corporate Team")])
  expect(await f.resolver.resolve(request, select(profileB))).toMatchObject({ teams: { status: "ready", selected: profileB } })
  f.provider.directTeams.set(oid, [teamRow()])
  expect(await f.resolver.resolve(request, select(profileB))).toMatchObject({ teams: { status: "revoked" } })
})

test("admin-admission-03: administration remains independent when Teams are disabled or unavailable", async () => {
  const minimum = await fixture({ teams: false })
  const minimalCookie = await minimum.login()
  expect(await minimum.resolver.list(minimum.request(undefined, minimalCookie))).toEqual({ status: "ok", configRevision: 0, profiles: [] })
  expect(await minimum.resolver.configure(minimum.request(undefined, minimalCookie), enable())).toEqual({ status: "unavailable", reason: "capability-disabled" })

  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  const cookie = await f.login()
  await f.resolver.configure(f.request(undefined, cookie), enable())
  f.provider.hooks.before = (request) => new URL(request.url).pathname.endsWith("/joinedTeams") || new URL(request.url).pathname.startsWith("/v1.0/teams/")
    ? Response.json({ error: "Authorization_RequestDenied" }, { status: 403 }) : undefined
  expect(await f.resolver.resolve(f.request(undefined, cookie))).toMatchObject({
    status: "authenticated", administration: { status: "available" }, teams: { status: "unavailable", reason: "forbidden" },
  })
  expect(await f.resolver.configure(f.request(undefined, cookie), { action: "disable", profile: profileA, expectedRevision: 1 }))
    .toEqual({ status: "ok", configRevision: 2, changed: true })
})

test("admin-admission-03: no configured supreme group, current nonmembership and group failure never admit administration", async () => {
  const absent = await fixture({ admin: false })
  const first = await absent.login()
  const before = absent.provider.requests.length
  expect(await absent.resolver.list(absent.request(undefined, first))).toEqual({ status: "denied" })
  expect(absent.provider.requests.length).toBe(before)

  const f = await fixture()
  const cookie = await f.login()
  f.provider.account.groups.splice(0)
  expect(await f.resolver.list(f.request(undefined, cookie))).toEqual({ status: "denied" })
  f.provider.account.groups.push(group)
  f.provider.hooks.before = (request) => new URL(request.url).pathname.endsWith("/checkMemberGroups")
    ? Response.json({ error: "service unavailable" }, { status: 503 }) : undefined
  expect(await f.resolver.list(f.request(undefined, cookie))).toEqual({ status: "unavailable", reason: "provider-unavailable" })
  expect(await f.profiles.audit()).toEqual([])
})

test("admin-admission-04: host claims, foreign tuples and surface administrator do not become supreme administration", async () => {
  const f = await fixture()
  const before = f.provider.requests.length
  for (const request of [f.request(), f.request(undefined, undefined, { headers: { authorization: "Basic c3ludGhldGljOnRlc3Q=", "x-principal-id": oid, "x-role": "admin" } })])
    expect(await f.resolver.list(request)).toEqual({ status: "unauthenticated" })
  expect(f.provider.requests.length).toBe(before)
  f.provider.second.groups.splice(0, f.provider.second.groups.length, other)
  const cookie = await f.login(other)
  expect(await f.identity.authenticate(f.request(undefined, cookie), { surface: "dashboard", roleMap: [
    { surface: "dashboard", role: "admin", entra: `group:${other}`, version: 0, by: "synthetic-installed-policy" },
  ] })).toMatchObject({ id: other, roles: [{ surface: "dashboard", role: "admin" }] })
  expect(await f.resolver.list(f.request(undefined, cookie))).toEqual({ status: "denied" })
  expect(await f.resolver.resolve(f.request(undefined, cookie))).toMatchObject({
    status: "authenticated", administration: { status: "denied" }, teams: { status: "no-teams" },
  })
  expect(await f.resolver.configure(f.request(undefined, cookie), { ...enable(), profile: { ...profileA, tenantId: other } })).toEqual({ status: "invalid-request" })
  expect(await f.resolver.configure(f.request(undefined, cookie), { ...enable(), principalObjectId: oid })).toEqual({ status: "invalid-request" })
  expect(await f.profiles.audit()).toEqual([])
})

test("admin-admission-05: profile configuration preserves empty role maps, grants and private business records", async () => {
  const f = await fixture()
  for (const surface of ["dashboard", "planner", "procurement"] as const) await f.store.transaction(surface, async (snapshot) => {
    snapshot.data.roleMap = []
    snapshot.data.marker = `original-${surface}`
    return { commit: true, value: undefined }
  })
  f.provider.teamResources.set(teamA, teamRow())
  const cookie = await f.login()
  expect(await f.resolver.configure(f.request(undefined, cookie), enable())).toMatchObject({ status: "ok" })
  expect(f.microsoft.grants).toEqual([])
  expect(await f.identity.authenticate(f.request(undefined, cookie), { surface: "dashboard", roleMap: [] })).toBeNull()
  const reopened = await f.reopen()
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    expect(await reopened.store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data })))
      .toEqual({ roleMap: [], marker: `original-${surface}` })
  }
  expect(await reopened.resolver.list(f.request(undefined, cookie))).toMatchObject({ status: "ok", configRevision: 1 })
})

test("admin-admission-06: simultaneous first-profile edits from real administrators have one CAS winner", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  f.provider.teamResources.set(teamB, teamRow(teamB))
  const first = await f.login()
  const second = await f.login(other)
  const results = await Promise.all([
    f.resolver.configure(f.request(undefined, first), enable()),
    f.resolver.configure(f.request(undefined, second), enable(0, profileB)),
  ])
  expect(results.filter((result) => result.status === "ok")).toHaveLength(1)
  expect(results.filter((result) => result.status === "conflict")).toEqual([{ status: "conflict", configRevision: 1 }])
  expect((await f.profiles.read()).profiles).toHaveLength(1)
  expect(await f.profiles.audit()).toHaveLength(1)
})

test("admin-admission-06: group removal during Team verification is observed before any policy write", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  const cookie = await f.login()
  f.provider.hooks.before = (request) => {
    if (new URL(request.url).pathname.startsWith("/v1.0/teams/")) f.provider.account.groups.splice(0)
    return undefined
  }
  expect(await f.resolver.configure(f.request(undefined, cookie), enable())).toEqual({ status: "denied" })
  expect(await f.profiles.read()).toEqual({ configRevision: 0, profiles: [] })
  expect(await f.profiles.audit()).toEqual([])
})

for (const cause of ["logout", "expiry", "refresh", "abort", "policy"] as const) {
  test(`admin-admission-06: ${cause} fences the captured session/policy during a suspended Team lookup`, async () => {
    const f = await fixture({ sessionSeconds: 60, tokenSeconds: 90 })
    f.provider.teamResources.set(teamA, teamRow())
    const cookie = await f.login()
    const gate = barrier()
    const controller = new AbortController()
    f.provider.hooks.before = async (request) => {
      if (new URL(request.url).pathname.startsWith("/v1.0/teams/")) await gate.hold()
      return undefined
    }
    const pending = f.resolver.configure(f.request(undefined, cookie, { signal: controller.signal }), enable())
    await gate.entered
    if (cause === "logout") expect((await f.logout(cookie))?.status).toBe(204)
    if (cause === "expiry") f.provider.clock.value += 60001
    if (cause === "refresh") {
      f.provider.clock.value += 40000
      await f.identity.prepare(f.request(undefined, cookie))
    }
    if (cause === "abort") controller.abort()
    if (cause === "policy") await writeFile(f.file, JSON.stringify({ ...f.config, supremeAdminGroupId: other }))
    gate.release()
    expect(await pending).toEqual(cause === "policy" ? { status: "unavailable", reason: "policy-changed" } : { status: "unauthenticated" })
    expect(await f.profiles.read()).toEqual({ configRevision: 0, profiles: [] })
    expect(await f.profiles.audit()).toEqual([])
  })
}

test("profile admission is nonserializable and remains personal even when configuration is shared", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  f.provider.directTeams.set(oid, [teamRow()])
  f.provider.directTeams.set(other, [teamRow()])
  const first = await f.login()
  const second = await f.login(other)
  await f.resolver.configure(f.request(undefined, first), enable())
  const a = await f.resolver.resolve(f.request(undefined, first), select())
  const b = await f.resolver.resolve(f.request(undefined, second), select())
  if (a.status !== "authenticated" || b.status !== "authenticated" || !a.admission || !b.admission) throw new Error("Both current principals require independently admitted profiles")
  expect(a.admission).not.toBe(b.admission)
  expect(a.admission.principal.principalObjectId).toBe(principalId(oid))
  expect(b.admission.principal.principalObjectId).toBe(principalId(other))
  expect(await f.resolver.revalidate(JSON.parse(JSON.stringify(a.admission)))).toBe(false)
  expect(await f.resolver.revalidate(a.admission)).toBe(true)
  f.provider.directTeams.set(oid, [])
  expect(await f.resolver.revalidate(a.admission)).toBe(false)
  expect(await f.resolver.revalidate(b.admission)).toBe(true)
  expect(await f.resolver.configure(f.request(undefined, first), { action: "disable", profile: profileA, expectedRevision: 1 })).toMatchObject({ status: "ok" })
  expect(await f.resolver.revalidate(b.admission)).toBe(false)
})

test("catalog edits during enumeration invalidate the pending selection, without hiding independent admin proof", async () => {
  const f = await fixture()
  f.provider.teamResources.set(teamA, teamRow())
  f.provider.directTeams.set(oid, [teamRow()])
  const cookie = await f.login()
  await f.resolver.configure(f.request(undefined, cookie), enable())
  const gate = barrier()
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname.endsWith("/joinedTeams")) await gate.hold()
    return undefined
  }
  const pending = f.resolver.resolve(f.request(undefined, cookie), select())
  await gate.entered
  expect(await f.resolver.configure(f.request(undefined, cookie), { action: "disable", profile: profileA, expectedRevision: 1 })).toMatchObject({ status: "ok" })
  gate.release()
  expect(await pending).toEqual({ status: "unavailable", reason: "policy-changed" })
  expect(await f.resolver.list(f.request(undefined, cookie))).toMatchObject({ status: "ok", configRevision: 2 })
})

test("missing lookup permission never registers a guessed Team even for a current supreme administrator", async () => {
  const f = await fixture()
  const cookie = await f.login()
  expect(await f.resolver.configure(f.request(undefined, cookie), enable())).toEqual({ status: "unavailable", reason: "provider-unavailable" })
  expect(await f.profiles.audit()).toEqual([])
  const publicResult = JSON.stringify(await f.resolver.list(f.request(undefined, cookie)))
  for (const privateValue of ["supremeAdminGroupId", "accessToken", "refreshToken", "cookie", "principal", "roles", "grants", group])
    expect(publicResult).not.toContain(privateValue)
})
