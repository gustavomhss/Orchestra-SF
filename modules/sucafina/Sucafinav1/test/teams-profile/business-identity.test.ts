import { afterEach, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import { emptyMap } from "../../src/identity.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"
import { group, oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"
import { barrier, installationId, profileA, profileB, teamA, teamB, teamProfileFixture, teamRow } from "./installation-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(input: Parameters<typeof teamProfileFixture>[0] = {}) {
  const f = await teamProfileFixture(input)
  cleanups.push(f.close)
  const boundary = createTeamProfileIdentityBoundary({
    identity: f.identity, resolver: f.resolver, installationId, tenantId: tenant,
    origin: publicOrigin, mount: f.config.mount,
  })
  const cookie = await f.login()
  const enable = async (profile = profileA, expectedRevision = 0) => {
    f.provider.teamResources.set(profile.teamObjectId, teamRow(profile.teamObjectId))
    expect(await f.resolver.configure(f.request(undefined, cookie), { action: "enable", profile, expectedRevision }))
      .toMatchObject({ status: "ok", configRevision: expectedRevision + 1 })
  }
  const business = (profile = profileA, session = cookie) => f.request("/api/work", session, {
    headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }) },
  })
  const context = (kind = "selection") => f.request("/api/ui/context?" + new URLSearchParams({
    contractRevision: "sf-team-profile/1", installationId, tenantId: tenant, hostId: "synthetic-host", kind,
  }), cookie)
  return { ...f, boundary, cookie, enable, business, context }
}
const roles = { surface: "dashboard" as const, roleMap: emptyMap().filter((row) => row.surface === "dashboard")
  .map((row) => ({ ...row, entra: row.role === "admin" ? `group:${group}` : null })) }

test("business-identity-01: original corporate identity remains available with zero Teams; business identity does not", async () => {
  const f = await fixture()
  expect((await f.identity.authenticate(f.request("/api/work", f.cookie), roles))?.id).toBe(oid)
  const before = f.provider.requests.length
  expect(await f.boundary.identity.authenticate(f.request("/api/work", f.cookie), roles)).toBeNull()
  expect(f.provider.requests.length).toBe(before)
  expect(await f.boundary.profiles.resolve(f.context())).toMatchObject({
    status: "authenticated", administration: { status: "available" }, teams: { status: "no-teams" },
  })
  expect(await f.resolver.list(f.request(undefined, f.cookie))).toEqual({ status: "ok", configRevision: 0, profiles: [] })
})

test("business-identity-02: a verified selected Team and current real RoleRows admit the same principal", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const request = f.business()
  const actor = await f.boundary.identity.authenticate(request, roles)
  expect(actor).toMatchObject({ id: oid, canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] })
  const resolution = await f.boundary.profiles.resolve(request)
  expect(resolution).toMatchObject({ status: "authenticated", teams: { status: "ready", selected: profileA } })
  if (resolution.status !== "authenticated" || !resolution.admission) throw new Error("Actual resolver admission required")
  expect(await f.boundary.profiles.revalidate(resolution.admission)).toBe(true)
  expect(await f.boundary.profiles.revalidate({ ...resolution.admission })).toBe(false)
  expect(await f.boundary.profiles.revalidateResolution({ ...resolution })).toBe(false)
})

test("business-identity-03: selection creates no roles and preserves an intentionally empty role map", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  expect(await f.boundary.identity.authenticate(f.business(), { surface: "dashboard", roleMap: [] })).toBeNull()
  expect(await f.boundary.identity.authenticate(f.business())).toBeNull()
  expect(await f.boundary.admit(f.business())).toMatchObject({ profile: profileA })
})

test("business-identity-04: Team eligibility and business roles remain independent of supreme administration", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  f.provider.account.groups = []
  expect(await f.boundary.identity.authenticate(f.business(), roles)).toBeNull()
  expect(await f.boundary.profiles.resolve(f.context())).toMatchObject({ administration: { status: "denied" }, teams: { status: "ready" } })
})

test.each([
  ["missing", undefined],
  ["foreign tenant", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: { ...profileA, tenantId: other } })],
  ["foreign installation", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: { ...profileA, installationId: "another-installation" } })],
  ["administration", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "administration", installationId, tenantId: tenant })],
  ["legacy project", JSON.stringify({ projectId: "legacy" })],
] as const)("business-identity-05: %s selector denies before Graph or directory work", async (_name, selector) => {
  const f = await fixture()
  const request = f.request("/api/work", f.cookie)
  if (selector !== undefined) request.headers.set("x-sf-team-profile", selector)
  const before = f.provider.requests.length
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  await expect(f.boundary.identity.directory(request)).rejects.toThrow("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
  expect(f.provider.requests.length).toBe(before)
})

test("business-identity-06: unconfigured and revoked Teams never fall back to another eligible Team", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow(), teamRow(teamB)])
  expect(await f.boundary.identity.authenticate(f.business(profileB), roles)).toBeNull()
  const request = f.business()
  expect((await f.boundary.identity.authenticate(request, roles))?.id).toBe(oid)
  f.provider.directTeams.set(oid, [teamRow(teamB)])
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  expect(await f.boundary.identity.authenticate(f.business(), roles)).toBeNull()
})

test("business-identity-07: a reused Request cannot switch Teams; independent window Requests can", async () => {
  const f = await fixture()
  await f.enable()
  await f.enable(profileB, 1)
  f.provider.directTeams.set(oid, [teamRow(), teamRow(teamB)])
  const request = f.business()
  const first = await f.boundary.profiles.resolve(request)
  const original = request.headers.get("x-sf-team-profile")!
  request.headers.set("x-sf-team-profile", f.business(profileB).headers.get("x-sf-team-profile")!)
  expect(await f.boundary.profiles.resolve(request)).toEqual({ status: "denied" })
  request.headers.set("x-sf-team-profile", original)
  expect(await f.boundary.profiles.revalidateResolution(first)).toBe(false)
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  expect((await f.boundary.identity.authenticate(f.business(profileB), roles))?.id).toBe(oid)
  expect((await f.boundary.identity.authenticate(f.business(), roles))?.id).toBe(oid)
})

test("business-identity-08: changing the session cookie cannot rebind an already observed Request", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  f.provider.directTeams.set(other, [teamRow()])
  const second = await f.login(other)
  const request = f.business()
  const held = await f.boundary.profiles.resolve(request)
  request.headers.set("cookie", second)
  expect(await f.boundary.profiles.revalidateResolution(held)).toBe(false)
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  expect((await f.boundary.identity.authenticate(f.business(profileA, second), roles))?.id).toBe(other)
})

test.each(["selector", "origin", "cookie", "abort"] as const)(
  "business-identity-09: %s mutation during Graph observation cannot publish a holder", async (mutation) => {
    const f = await fixture()
    await f.enable()
    f.provider.directTeams.set(oid, [teamRow()])
    const wait = barrier()
    f.provider.hooks.before = async (request) => {
      if (new URL(request.url).pathname.endsWith("/joinedTeams")) await wait.hold()
      return undefined
    }
    const controller = new AbortController()
    const request = new Request(f.business(), { signal: controller.signal })
    const reading = f.boundary.profiles.resolve(request)
    await wait.entered
    if (mutation === "selector") request.headers.delete("x-sf-team-profile")
    if (mutation === "origin") request.headers.set("origin", "https://foreign.invalid")
    if (mutation === "cookie") request.headers.delete("cookie")
    if (mutation === "abort") controller.abort()
    wait.release()
    expect(await reading).toEqual({ status: "denied" })
    expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  },
)

test("business-identity-10: logout invalidates retained admission and does not reauthenticate it", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const request = f.business()
  const held = await f.boundary.profiles.resolve(request)
  expect(held.status).toBe("authenticated")
  await f.logout(f.cookie)
  expect(await f.boundary.profiles.revalidateResolution(held)).toBe(false)
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
})

test("business-identity-11: refreshed credentials require a new Request and a new profile observation", async () => {
  const f = await fixture({ tokenSeconds: 120 })
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const request = f.business()
  expect((await f.boundary.identity.authenticate(request, roles))?.id).toBe(oid)
  f.provider.clock.value += 90_000
  await f.identity.prepare(f.request("/api/work", f.cookie))
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
  expect((await f.boundary.identity.authenticate(f.business(), roles))?.id).toBe(oid)
})

test("business-identity-12: a current policy change invalidates the retained business admission", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const request = f.business()
  expect((await f.boundary.identity.authenticate(request, roles))?.id).toBe(oid)
  await writeFile(f.file, JSON.stringify({ ...f.config, teams: undefined }))
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
})

test("business-identity-13: directory output is withheld when Team membership changes during the read", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const wait = barrier()
  const boundary = createTeamProfileIdentityBoundary({
    identity: { ...f.identity, directory: async (request) => {
      const people = await f.identity.directory(request)
      await wait.hold()
      return people
    } },
    resolver: f.resolver, installationId, tenantId: tenant, origin: publicOrigin, mount: f.config.mount,
  })
  const reading = boundary.identity.directory(f.business())
  await wait.entered
  f.provider.directTeams.set(oid, [])
  wait.release()
  await expect(reading).rejects.toThrow("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
})

test("business-identity-14: explicit administration context cannot be reused as business admission", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  const request = f.context("administration")
  const result = await f.boundary.profiles.resolve(request)
  expect(result).toMatchObject({ status: "authenticated", administration: { status: "available" }, teams: { status: "ready" } })
  expect(result).not.toHaveProperty("admission")
  expect(await f.boundary.admit(request)).toBeUndefined()
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
})

test("business-identity-15: an unavailable Teams observation remains unavailable and never grants business", async () => {
  const f = await fixture()
  await f.enable()
  f.provider.directTeams.set(oid, [teamRow()])
  f.provider.hooks.before = (request) => new URL(request.url).pathname.endsWith("/joinedTeams")
    ? Response.json({ error: "ServiceUnavailable" }, { status: 503 }) : undefined
  const request = f.business()
  expect(await f.boundary.profiles.resolve(request)).toMatchObject({
    status: "authenticated", administration: { status: "available" }, teams: { status: "unavailable" },
  })
  expect(await f.boundary.identity.authenticate(request, roles)).toBeNull()
})
