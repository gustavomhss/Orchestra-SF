import { afterEach, expect, test } from "bun:test"
import { Effect } from "effect"
import type { RoleRow, Surface } from "../../src/identity.ts"
import { roleMap } from "../../runtime/admin.ts"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { oid, other } from "../microsoft-login/oidc-fixture.ts"
import { barrier, profileB } from "./installation-fixture.ts"
import { productGrant, productRoleGroup, teamProductFixture } from "./product-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(input: Parameters<typeof teamProductFixture>[0] = {}) {
  const f = await teamProductFixture(input)
  cleanups.push(f.close)
  return f
}
type Fixture = Awaited<ReturnType<typeof teamProductFixture>>
type Maps = { surface: Surface; roleMap: RoleRow[] }[]
const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]

async function currentMaps(f: Fixture): Promise<Maps> {
  const transaction = f.store.transactionAll
  if (!transaction) throw new Error("Actual atomic current snapshots required")
  return transaction(async (snapshots) => ({ commit: false,
    value: surfaces.map((surface) => ({ surface, roleMap: roleMap(snapshots[surface], surface) })),
  }))
}
function reader(f: Fixture) {
  const authenticateAll = f.identity.authenticateAll
  if (!authenticateAll) throw new Error("Actual Microsoft batch reader required")
  return authenticateAll
}
function graphCount(f: Fixture) {
  return f.provider.requests.filter((request) => new URL(request.url).origin === "https://graph.microsoft.com").length
}
async function duringResolve(f: Fixture, request: Request, maps: Maps, change: () => Promise<void>) {
  const held = barrier()
  let armed = true
  f.provider.hooks.before = async (incoming) => {
    if (new URL(incoming.url).pathname !== "/v1.0/me/checkMemberGroups" || !armed) return undefined
    armed = false
    await held.hold()
    return undefined
  }
  const pending = reader(f)(request, maps)
  try {
    await held.entered
    await change()
    held.release()
    return await pending
  } finally {
    held.release()
    await pending
    f.provider.hooks.before = undefined
  }
}

test("batch-identity-01: one real directory observation preserves each surface actor and reduces six Graph calls to two", async () => {
  const f = await fixture()
  await f.store.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = roleMap(snapshot, "planner").map((row) => ({
      ...row, entra: row.role === "viewer" ? `group:${productRoleGroup}` : null, version: row.version + 1, by: oid,
    }))
    return { commit: true, value: undefined }
  })
  await f.store.transaction("procurement", async (snapshot) => {
    snapshot.data.roleMap = roleMap(snapshot, "procurement").map((row) => ({ ...row, entra: null, version: row.version + 1, by: oid }))
    return { commit: true, value: undefined }
  })
  const maps = await currentMaps(f)
  const original = structuredClone(maps)
  const request = f.businessRequest()
  const start = graphCount(f)
  const separate = await Promise.all(maps.map(async (context) => ({ surface: context.surface,
    actor: await f.identity.authenticate(request, context),
  })))
  const separateCalls = graphCount(f) - start
  const next = graphCount(f)
  const combined = await reader(f)(request, maps)
  const combinedCalls = graphCount(f) - next
  // Procurement has no mapped groups and reads only /me. The common nonempty
  // three-map case below demonstrates the exact six-to-two reduction.
  expect(separateCalls).toBe(5)
  expect(combinedCalls).toBe(2)
  expect(combined).toEqual(separate)
  expect(combined?.[0]?.actor?.canWrite).toBe(true)
  expect(combined?.[1]?.actor).toEqual({ id: oid, roles: [{ surface: "planner", role: "viewer" }], canWrite: false })
  expect(combined?.[2]?.actor).toBeNull()
  expect(maps).toEqual(original)
  for (const forbidden of ["synthetic-access-", "synthetic-refresh-", "grantedScopes", "groupIds", productRoleGroup])
    expect(JSON.stringify(combined)).not.toContain(forbidden)
  const allMapped = await fixture()
  const allMaps = await currentMaps(allMapped)
  const allRequest = allMapped.businessRequest()
  const before = graphCount(allMapped)
  const actors = await Promise.all(allMaps.map(async (context) => ({ surface: context.surface,
    actor: await allMapped.identity.authenticate(allRequest, context),
  })))
  expect(graphCount(allMapped) - before).toBe(6)
  const batchBefore = graphCount(allMapped)
  expect(await reader(allMapped)(allRequest, allMaps)).toEqual(actors)
  expect(graphCount(allMapped) - batchBefore).toBe(2)
  console.info("Microsoft surface observation: separateGraph=6 batchGraph=2; partial separateGraph=5 batchGraph=2")
})

test("batch-identity-02: every invocation observes current groups and concurrent principals remain independent", async () => {
  const f = await fixture()
  const maps = await currentMaps(f)
  const request = f.businessRequest()
  expect((await reader(f)(request, maps))?.every((entry) => entry.actor?.id === oid)).toBe(true)
  const cookie = await f.login(other)
  const before = graphCount(f)
  const [first, second] = await Promise.all([
    reader(f)(request, maps),
    reader(f)(f.businessRequest(undefined, cookie), maps),
  ])
  expect(first?.every((entry) => entry.actor?.id === oid)).toBe(true)
  expect(second?.every((entry) => entry.actor?.id === other)).toBe(true)
  expect(graphCount(f) - before).toBe(4)
  f.provider.account.groups = f.provider.account.groups.filter((id) => id !== productRoleGroup)
  const afterRevocation = graphCount(f)
  expect((await reader(f)(request, maps))?.every((entry) => entry.actor === null)).toBe(true)
  expect(graphCount(f) - afterRevocation).toBe(2)
  expect((await reader(f)(f.businessRequest(undefined, cookie), maps))?.every((entry) => entry.actor?.id === other)).toBe(true)
})

for (const change of ["map-version", "map-group", "request-intent"] as const) {
  test(`batch-identity-03: ${change} during the real provider await invalidates all projected surfaces`, async () => {
    const f = await fixture()
    const maps = await currentMaps(f)
    const request = f.businessRequest()
    const result = await duringResolve(f, request, maps, async () => {
      if (change === "request-intent") {
        request.headers.set("x-sf-team-profile", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileB }))
        return
      }
      const row = maps[0]?.roleMap.find((row) => row.role === "admin")
      if (!row) throw new Error("Current persisted admin row required")
      if (change === "map-version") row.version++
      if (change === "map-group") row.entra = null
    })
    expect(result).toBeNull()
    expect((await reader(f)(f.businessRequest(), await currentMaps(f)))?.every((entry) => entry.actor?.id === oid)).toBe(true)
  })
}

for (const change of ["logout", "session-expiry", "token-expiry", "refresh"] as const) {
  test(`batch-identity-04: ${change} while groups are pending refuses the captured session generation`, async () => {
    const f = await fixture({ tokenSeconds: change === "refresh" || change === "token-expiry" ? 120 : 3600,
      sessionSeconds: change === "session-expiry" ? 60 : 3600 })
    const request = f.businessRequest()
    const result = await duringResolve(f, request, await currentMaps(f), async () => {
      if (change === "logout") {
        expect((await f.logout(f.cookie))?.status).toBe(204)
        return
      }
      f.provider.clock.value += change === "token-expiry" ? 121000 : 61000
      if (change === "refresh") await f.identity.prepare(request)
    })
    expect(result).toBeNull()
    if (change === "refresh")
      expect((await reader(f)(request, await currentMaps(f)))?.every((entry) => entry.actor?.id === oid)).toBe(true)
    else expect(await reader(f)(request, await currentMaps(f))).toBeNull()
  })
}

test("batch-identity-05: missing, duplicate or cross-surface maps and foreign origin never start a Graph observation", async () => {
  const f = await fixture()
  const maps = await currentMaps(f)
  const original = structuredClone(maps)
  const request = f.businessRequest()
  const count = graphCount(f)
  expect(await reader(f)(request, [])).toBeNull()
  const first = maps[0]
  const last = maps[2]
  if (!first || !last) throw new Error("All three current maps required")
  expect(await reader(f)(request, [first, first, last])).toBeNull()
  const cross = structuredClone(maps)
  if (!cross[0]?.roleMap[0]) throw new Error("Actual dashboard role row required")
  cross[0].roleMap[0].surface = "planner"
  expect(await reader(f)(request, cross)).toBeNull()
  const foreign = new Request("https://foreign.example.test/sucafina/dashboard", { headers: request.headers })
  expect(await reader(f)(foreign, maps)).toBeNull()
  const controller = new AbortController()
  controller.abort()
  expect(await reader(f)(new Request(request, { signal: controller.signal }), maps)).toBeNull()
  expect(graphCount(f)).toBe(count)
  expect(maps).toEqual(original)
})

test("batch-identity-06: the business wrapper still requires the real selected Team and current private admission", async () => {
  const f = await fixture()
  const boundary = createTeamProfileIdentityBoundary({ ...f.binding, identity: f.identity, resolver: f.resolver })
  const authenticateAll = boundary.identity.authenticateAll
  if (!authenticateAll) throw new Error("Guarded Microsoft batch reader required")
  const maps = await currentMaps(f)
  expect((await authenticateAll(f.businessRequest(), maps))?.every((entry) => entry.actor?.id === oid)).toBe(true)
  expect(await authenticateAll(f.businessRequest(profileB), maps)).toBeNull()
  f.provider.directTeams.set(oid, [])
  expect(await authenticateAll(f.businessRequest(), maps)).toBeNull()
})

test("batch-identity-07: effective authority invokes a fresh batch per boundary and invalidates a retained lease after a persisted RoleMap edit", async () => {
  const f = await fixture({ grants: [{ ...productGrant(), sessionActions: ["read"] }] })
  const actual = reader(f)
  const calls = { batch: 0, separate: 0 }
  const authority = createSfProductAuthority({ ...f.options,
    authenticate: async () => { calls.separate++; throw new Error("No legacy fallback in a Microsoft batch") },
    authenticateAll: async (request, maps) => { calls.batch++; return actual(request, maps) },
  })
  const request = f.businessRequest()
  const current = await authority.readCoreSessionAdmission(request)
  if (!current) throw new Error("Real current Core admission required")
  const admittedCalls = calls.batch
  expect(admittedCalls).toBeGreaterThan(0)
  expect(await Effect.runPromise(current.verifyCurrent())).toBe(true)
  expect(calls.batch).toBeGreaterThan(admittedCalls)
  await f.store.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = roleMap(snapshot, "planner").map((row) => ({ ...row, version: row.version + 1, by: oid }))
    return { commit: true, value: undefined }
  })
  expect(await Effect.runPromise(current.verifyCurrent())).toBe(false)
  const fresh = await authority.readCoreSessionAdmission(f.businessRequest())
  if (!fresh) throw new Error("Fresh current RoleMap admission required")
  expect(fresh.binding.revisions.accessRevision).not.toBe(current.binding.revisions.accessRevision)
  expect(calls.separate).toBe(0)
  const failed = createSfProductAuthority({ ...f.options, authenticate: async () => {
    calls.separate++
    throw new Error("A refused batch never falls back")
  }, authenticateAll: async () => null })
  expect(await failed.readCoreSessionAdmission(f.businessRequest())).toBeUndefined()
  expect(calls.separate).toBe(0)
})
