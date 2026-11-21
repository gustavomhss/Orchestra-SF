import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { Effect, Schema } from "effect"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { ResidentProfile, SkillLoadReceipt } from "../../product/contracts/resident-ai.ts"
import { selection } from "../product/wp10/resident-runtime/fixture.ts"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../product/integration/product-authority.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../product/decisions/case-port.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { sfTransactionBelongsTo, sfTransactionIdentity, sfTransactionProfileMatches } from "../../product/host-binding/state-provider.ts"
import { object } from "../../runtime/contract.ts"
import { emptyMap } from "../../src/identity.ts"
import { group, oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"
import { barrier, installationId, profileA, profileB, teamA, teamB } from "./installation-fixture.ts"
import { productGrant, productRoleGroup, teamProductFixture } from "./product-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(input: Parameters<typeof teamProductFixture>[0] = {}) {
  const f = await teamProductFixture(input)
  cleanups.push(f.close)
  return f
}
const principalId = Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)
const digest = digestSfValue({ kind: "authority-test" })
const payload = {
  objective: "A deliberately shared business resource", horizon: { start: "2027-01-01", end: "2027-12-31" },
  currency: "USD", criteria: ["cost", "risk"], sourceRefs: [],
}

async function lease(authority: ReturnType<typeof createSfProductAuthority>, request: Request, operation: string, value: unknown) {
  const hash = digestSfValue(value)
  const admitted = await authority.ui.admit(request, operation, hash)
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") throw new Error("Real Microsoft product lease required")
  expect(await authority.ui.validate(admitted.value, operation, hash)).toBe(true)
  return admitted.value
}

function cases(f: Awaited<ReturnType<typeof teamProductFixture>>, authority = f.authority) {
  return createDecisionCasePort({
    state: authority.state, host: authority.host, creationTarget: authority.creationTarget,
    operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await authority.host.revalidate(context),
    verifyScenarioOperations: async (value, context) => !value.alternatives.length && !value.choices.length && await authority.host.revalidate(context),
    evidence: {
      context: async () => [], recall: async () => [],
      resolve: async () => { throw new Error("No external evidence requested by this case fixture") },
      emitFromLedger: async () => { throw new Error("No ledger emission requested by this case fixture") },
    },
    createId: randomUUID, now: () => new Date(f.provider.clock.value).toISOString(),
  })
}

async function stored(f: Awaited<ReturnType<typeof teamProductFixture>>) {
  return f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) }))
}

async function seed(f: Awaited<ReturnType<typeof teamProductFixture>>) {
  const request = f.businessRequest(profileA, f.cookie, { method: "POST", headers: { "Idempotency-Key": "seed-real-case" } })
  const context = await lease(f.authority, request, "sf_case_draft", payload)
  const created = await cases(f).draft(payload, context)
  expect(created.status).toBe("ok")
  if (created.status !== "ok") throw new Error("Real case creation required")
  f.authority.ui.finish(context)
  return created.value
}

test("product-authority-01: current signed principal, Team, all 15 canonical roles and private grant form one effective context", async () => {
  const f = await fixture()
  const before = await Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    f.store.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.roleMap) }))))
  const context = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Current Team context required")
  expect(Schema.decodeUnknownSync(TeamProfile.Authenticated)(context.projection)).toEqual(context.projection)
  expect(context.binding?.owner.profile).toEqual(profileA)
  expect(context.binding?.owner.principal.principalObjectId).toBe(principalId(oid))
  expect(context.binding?.revisions.accessRevision).toBe(context.technical.accessRevision)
  expect(context.projection.accessRevision).toMatch(/^[a-f0-9]{64}$/)
  expect(context.pages.length).toBeGreaterThan(0)
  expect(context.technical.projectId).toBe("synthetic-technical-project")
  expect(context.technical.projectId).not.toBe(teamA)
  const serialized = JSON.stringify(context)
  for (const forbidden of ["grants", "groupIds", "accessToken", "refreshToken", "admission", "verifyCurrent", "roleMap", "synthetic-access-"])
    expect(serialized).not.toContain(forbidden)
  const after = await Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    f.store.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.roleMap) }))))
  expect(after).toEqual(before)
  expect(before.flat()).toHaveLength(15)
  expect(emptyMap().map((row) => row.role)).toEqual([
    "admin", "domain leader", "contributor", "viewer", "admin", "finance", "hr", "budget owner", "viewer",
    "requester", "buyer", "approver", "supplier admin", "admin", "viewer",
  ])
})

for (const scenario of ["no-membership", "no-enabled-profile", "directory-disabled"] as const) {
  test(`product-authority-01: ${scenario} preserves authenticated independent administration but grants no business`, async () => {
    const f = await fixture(scenario === "no-membership" ? { direct: [] } :
      scenario === "no-enabled-profile" ? { enabled: [], direct: [profileA] } : { teams: false })
    const context = await f.authority.readTeamContextAdmission(f.contextRequest())
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Authenticated empty context required")
    expect(context.projection.administration).toEqual({ status: "available" })
    expect(context.projection.teams.status).toBe(scenario === "directory-disabled" ? "unavailable" : "no-teams")
    expect(context.projection.accessRevision).toMatch(/^[a-f0-9]{64}$/)
    expect(context).not.toHaveProperty("binding")
    expect(context.pages).toEqual([])
    expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
    expect(await f.authority.humanActions(f.businessRequest())).toEqual([])
    const work = { calls: 0 }
    const result = await f.authority.state.transaction(f.businessRequest(), {
      namespace: "cases", expectedStorageVersion: 0, targetRef: f.authority.creationTarget.ref,
      targetIncarnation: f.authority.creationTarget.incarnation, idempotencyKey: "must-not-create", commandDigest: digest,
    }, async () => { work.calls += 1; return { commit: true, value: "private-value" } })
    expect(result.status).toBe("denied")
    expect(result).not.toHaveProperty("value")
    expect(work.calls).toBe(0)
    expect(await stored(f)).toBeUndefined()
  })
}

for (const absent of ["roles", "grants"] as const) {
  test(`product-authority-01: a ready Team with no ${absent} has a current empty authority and no invented business destinations`, async () => {
    const f = await fixture(absent === "roles" ? { roles: false } : { grants: [] })
    const context = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Authenticated zero-rights projection required")
    expect(context.projection.teams.status).toBe("ready")
    expect(context.projection.administration.status).toBe("available")
    expect(context).not.toHaveProperty("binding")
    expect(context.pages).toEqual([])
    expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
    if (absent === "roles") {
      for (const surface of ["dashboard", "planner", "procurement"] as const)
        expect(await f.store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.roleMap }))).toEqual([])
    }
  })
}

test("product-authority-01: current surface administration never substitutes for the independent supreme group", async () => {
  const f = await fixture()
  f.provider.account.groups = [productRoleGroup]
  const context = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Business context required")
  expect(context.projection.administration).toEqual({ status: "denied" })
  expect(context.binding?.owner.profile).toEqual(profileA)
  expect(await f.resolver.list(f.request(undefined, f.cookie))).toEqual({ status: "denied" })
})

test("product-authority-03: Microsoft Team authority requires a live grant reader and never falls back when it fails", async () => {
  const f = await fixture()
  expect(() => createSfProductAuthority({ ...f.options, readGrants: undefined })).toThrow("CONFIG_INVALID")
  const unavailable = createSfProductAuthority({ ...f.options, readGrants: async () => { throw new Error("Private policy unavailable") } })
  expect((await unavailable.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
  expect((await unavailable.readTeamContextAdmission(f.contextRequest("team"))).status).toBe("unavailable")
  expect(await stored(f)).toBeUndefined()
})

test("product-authority: a failed repeated role observation cannot publish a Team context", async () => {
  const f = await fixture()
  const authenticateAll = f.options.authenticateAll
  if (!authenticateAll) throw new Error("Microsoft batch identity required")
  const calls = { value: 0 }
  const authority = createSfProductAuthority({ ...f.options, authenticateAll: async (request, contexts) => {
    calls.value += 1
    if (calls.value === 2) return null
    return authenticateAll(request, contexts)
  } })
  const context = await authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(calls.value).toBe(2)
  expect(context.status).toBe("unavailable")
  expect(context).not.toHaveProperty("binding")
  expect(context).not.toHaveProperty("pages")
})

test("product-authority: mutation of a reused role observation cannot change its comparison baseline", async () => {
  const f = await fixture()
  const authenticateAll = f.options.authenticateAll
  if (!authenticateAll) throw new Error("Microsoft batch identity required")
  const shared: { value?: Awaited<ReturnType<typeof authenticateAll>> } = {}
  const calls = { value: 0 }
  const authority = createSfProductAuthority({ ...f.options, authenticateAll: async (request, contexts) => {
    if (shared.value) return shared.value
    shared.value = await authenticateAll(request, contexts)
    return shared.value
  } })
  f.hooks.beforeGrants = async () => {
    if (++calls.value !== 2) return
    if (!shared.value) throw new Error("Initial role observation required")
    for (const entry of shared.value) if (entry.actor) {
      entry.actor.roles = []
      entry.actor.canWrite = false
    }
  }
  const context = await authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(calls.value).toBe(2)
  expect(context.status).toBe("unavailable")
  expect(context).not.toHaveProperty("binding")
  expect(context).not.toHaveProperty("pages")
})

test("product-authority-03: editing persisted grants after construction revokes old leases and admits exactly current rights", async () => {
  const f = await fixture()
  await seed(f)
  const source = f.businessRequest()
  const old = await f.authority.ui.admit(source, "sf_context_get", digest)
  expect(old.status).toBe("ok")
  if (old.status !== "ok") throw new Error("Initial lease required")
  const before = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  const narrowed: SfProductGrant = { principalRef: oid, namespaces: ["cases"], operations: ["sf_case_read"], humanActions: [] }
  await f.writeGrants([narrowed, productGrant(other)])
  expect(await f.authority.ui.revalidate(old.value)).toBe(false)
  expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
  expect((await f.authority.ui.admit(f.businessRequest(), "sf_case_read", digest)).status).toBe("ok")
  expect((await f.authority.state.read(f.businessRequest(), "preferences", () => "private")).status).toBe("denied")
  expect(await f.authority.humanActions(f.businessRequest())).toEqual([])
  const after = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(after.status).toBe("ok")
  if (before.status !== "ok" || after.status !== "ok") throw new Error("Current policy projections required")
  expect(after.technical.accessRevision).not.toBe(before.technical.accessRevision)
  await f.writeGrants([])
  const empty = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(empty.status).toBe("ok")
  if (empty.status !== "ok") throw new Error("Current empty policy projection required")
  expect(empty.pages).toEqual([])
  expect(empty).not.toHaveProperty("binding")
  expect(empty.technical.accessRevision).not.toBe(after.technical.accessRevision)
})

for (const boundary of ["read", "commit"] as const) {
  test(`product-authority: role changes during final grant observation deny ${boundary}`, async () => {
    const f = await fixture()
    await seed(f)
    const before = await stored(f)
    const gate = barrier()
    const calls = { value: 0 }
    f.hooks.beforeGrants = async () => { if (++calls.value === 2) await gate.hold() }
    const request = f.businessRequest()
    const pending = boundary === "read"
      ? f.authority.state.read(request, "preferences", () => "private-result")
      : f.authority.state.transaction(request, {
          namespace: "preferences", expectedStorageVersion: 0, targetRef: f.authority.creationTarget.ref,
          targetIncarnation: f.authority.creationTarget.incarnation, idempotencyKey: "role-observation", commandDigest: digest,
        }, async (state) => {
          state.preferences["role-observation"] = { value: "must-not-commit" }
          return { commit: true, value: "private-result" }
        })
    await gate.entered
    f.provider.account.groups = [group]
    gate.release()
    const result = await pending
    expect(result.status).toBe("denied")
    expect(result).not.toHaveProperty("value")
    expect(await stored(f)).toEqual(before)
  })

  for (const change of ["grants", "roles", "membership"] as const) {
    test(`product-authority-04: ${change} revoked while ${boundary} awaits yields no output, receipt or persisted effect`, async () => {
      const f = await fixture()
      await seed(f)
      const before = await stored(f)
      const gate = barrier()
      const request = f.businessRequest()
      const pending = boundary === "read"
        ? f.authority.state.read(request, "preferences", async () => { await gate.hold(); return "private-result-must-not-escape" })
        : f.authority.state.transaction(request, {
            namespace: "preferences", expectedStorageVersion: 0, targetRef: f.authority.creationTarget.ref,
            targetIncarnation: f.authority.creationTarget.incarnation, idempotencyKey: `pending-${change}`, commandDigest: digest,
          }, async (state) => {
            state.preferences["pending-private"] = { value: "must-not-commit" }
            await gate.hold()
            return { commit: true, value: "private-result-must-not-escape" }
          })
      await gate.entered
      if (change === "grants") await f.writeGrants([])
      if (change === "roles") f.provider.account.groups = [group]
      if (change === "membership") f.provider.directTeams.set(oid, [])
      gate.release()
      const result = await pending
      expect(result.status).toBe("denied")
      expect(result).not.toHaveProperty("value")
      expect(JSON.stringify(result)).not.toContain("private-result")
      expect(await stored(f)).toEqual(before)
    })
  }
}

test("product-authority-04: profile disable/re-enable advances the effective revision and cannot revive a retained request", async () => {
  const f = await fixture()
  const request = f.businessRequest()
  const old = await f.authority.ui.admit(request, "sf_context_get", digest)
  expect(old.status).toBe("ok")
  if (old.status !== "ok") throw new Error("Initial admission required")
  expect(await f.resolver.configure(f.request(undefined, f.cookie), { action: "disable", profile: profileA, expectedRevision: 1 })).toMatchObject({ status: "ok", configRevision: 2 })
  expect(await f.authority.ui.revalidate(old.value)).toBe(false)
  expect(await f.resolver.configure(f.request(undefined, f.cookie), { action: "enable", profile: profileA, expectedRevision: 2 })).toMatchObject({ status: "ok", configRevision: 3 })
  expect((await f.authority.ui.admit(request, "sf_context_get", digest)).status).toBe("denied")
  const fresh = await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)
  expect(fresh.status).toBe("ok")
  if (fresh.status === "ok") expect(fresh.value.binding.accessRevision).not.toBe(old.value.binding.accessRevision)
})

test("product-authority-04: explicit roleMap empty remains empty across reopen and never restores configured defaults", async () => {
  const f = await fixture()
  const first = await f.authority.readTeamContextAdmission(f.contextRequest("team"))
  expect(first.status).toBe("ok")
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await f.store.transaction(surface, async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
  }
  expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
  await f.store.dispose()
  const reopened = await f.reopen()
  const current = f.makeAuthority(reopened)
  expect((await current.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
  for (const surface of ["dashboard", "planner", "procurement"] as const)
    expect(await reopened.store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.roleMap }))).toEqual([])
})

test("product-authority-02: two Teams share technical placement without sharing revisions, leases or a global selection", async () => {
  const f = await fixture({ enabled: [profileA, profileB] })
  const requestA = f.businessRequest(profileA)
  const requestB = f.businessRequest(profileB)
  const a = await lease(f.authority, requestA, "sf_context_get", { team: "A" })
  const b = await lease(f.authority, requestB, "sf_context_get", { team: "B" })
  expect(a.binding.projectId).toBe(b.binding.projectId)
  expect(a.binding.principalRef).toBe(b.binding.principalRef)
  expect(a.binding.accessRevision).not.toBe(b.binding.accessRevision)
  expect(f.authority.ui.requestFor(a)).toBe(requestA)
  expect(f.authority.ui.requestFor(b)).toBe(requestB)
  expect(await f.authority.ui.revalidate(a)).toBe(true)
  expect(await f.authority.ui.revalidate(b)).toBe(true)
  expect(await f.authority.ui.revalidate(JSON.parse(JSON.stringify(a)))).toBe(false)
  const unresolved = await f.authority.readTeamContextAdmission(f.contextRequest())
  expect(unresolved.status).toBe("ok")
  if (unresolved.status === "ok") {
    expect(unresolved.projection.teams.status).toBe("selection-required")
    expect(unresolved).not.toHaveProperty("binding")
    expect(unresolved.pages).toEqual([])
  }
})

test("product-authority-02: shared Team membership never grants another principal's existing private case", async () => {
  const f = await fixture()
  const created = await seed(f)
  const secondCookie = await f.login(other)
  const secondRequest = f.businessRequest(profileA, secondCookie)
  const context = await lease(f.authority, secondRequest, "sf_case_read", { caseRef: encodeCaseRef(created) })
  expect(context.binding.principalRef).toBe(other)
  const denied = await cases(f).read({ caseRef: encodeCaseRef(created) }, context)
  expect(denied.status).toBe("denied")
  expect(denied).not.toHaveProperty("value")
  const before = await stored(f)
  const calls = { value: 0 }
  const mutation = await f.authority.state.transaction(secondRequest, {
    namespace: "cases", expectedStorageVersion: 1, targetRef: created.id, targetIncarnation: created.incarnation,
    idempotencyKey: "known-private-case", commandDigest: digest,
  }, async () => { calls.value += 1; return { commit: true, value: "private" } })
  expect(mutation.status).toBe("denied")
  expect(calls.value).toBe(0)
  expect(await stored(f)).toEqual(before)
})

test("product-authority-05: absent, forged, duplicate and foreign selectors never reach business or acquire directory authority", async () => {
  const f = await fixture()
  const requests = [
    f.request("/dashboard", f.cookie),
    f.businessRequest(profileA, f.cookie, { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: { ...profileA, tenantId: other } }) } }),
    f.businessRequest(profileA, f.cookie, { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA, principalObjectId: oid }) } }),
    f.businessRequest(profileA, f.cookie, { headers: { "x-sf-team-profile": '{"contractRevision":"sf-team-profile/1","kind":"team","kind":"administration","profile":' + JSON.stringify(profileA) + '}' } }),
    f.businessRequest(profileA, f.cookie, { headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "administration", installationId, tenantId: tenant }) } }),
  ]
  const before = f.provider.requests.length
  for (const request of requests) expect((await f.authority.ui.admit(request, "sf_context_get", digest)).status).toBe("denied")
  expect(f.provider.requests).toHaveLength(before)
  expect(await stored(f)).toBeUndefined()
})

test("product-authority-05: selection is sealed before the first await and later Request mutation cannot retarget it", async () => {
  const f = await fixture({ enabled: [profileA, profileB] })
  const gate = barrier()
  f.hooks.beforeGrants = async () => { f.hooks.beforeGrants = undefined; await gate.hold() }
  const request = f.businessRequest(profileA)
  const pending = f.authority.ui.admit(request, "sf_context_get", digest)
  await gate.entered
  request.headers.set("x-sf-team-profile", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileB }))
  gate.release()
  expect((await pending).status).toBe("denied")
  expect((await f.authority.ui.admit(request, "sf_context_get", digest)).status).toBe("denied")
  expect((await f.authority.ui.admit(f.businessRequest(profileB), "sf_context_get", digest)).status).toBe("ok")
})

test("product-authority-04: changing immutable private tenant binding after construction closes current business authority", async () => {
  const f = await fixture()
  const old = await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)
  expect(old.status).toBe("ok")
  if (old.status !== "ok") throw new Error("Initial admission required")
  await writeFile(f.file, JSON.stringify({ ...f.config, grants: f.grants, tenantId: other }))
  expect(await f.authority.ui.revalidate(old.value)).toBe(false)
  expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("denied")
})

for (const cause of ["logout", "expiry", "abort"] as const) {
  test(`product-authority-04: ${cause} while an admitted read awaits discards the late private result`, async () => {
    const f = await fixture()
    await seed(f)
    const controller = new AbortController()
    const gate = barrier()
    const pending = f.authority.state.read(f.businessRequest(profileA, f.cookie, { signal: controller.signal }),
      "cases", async () => { await gate.hold(); return "late-private-result" })
    await gate.entered
    if (cause === "logout") await f.logout(f.cookie)
    if (cause === "expiry") f.provider.clock.value += 3_601_000
    if (cause === "abort") controller.abort()
    gate.release()
    const result = await pending.catch(() => ({ status: "unavailable" as const }))
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
    expect(JSON.stringify(result)).not.toContain("late-private")
  })
}

test("product-authority-04: refresh cannot reopen an old Request; a new request obtains independently current admission", async () => {
  const f = await fixture({ tokenSeconds: 120 })
  const request = f.businessRequest()
  const old = await f.authority.ui.admit(request, "sf_context_get", digest)
  expect(old.status).toBe("ok")
  if (old.status !== "ok") throw new Error("Initial admission required")
  f.provider.clock.value += 121_000
  await f.identity.prepare(f.businessRequest())
  expect(await f.authority.ui.revalidate(old.value)).toBe(false)
  expect((await f.authority.ui.admit(request, "sf_context_get", digest)).status).toBe("denied")
  expect((await f.authority.ui.admit(f.businessRequest(), "sf_context_get", digest)).status).toBe("ok")
})

test("product-authority-06: same-Team retries and recovery retain one genuine case; another Team cannot borrow or repeat its receipt", async () => {
  const f = await fixture({ enabled: [profileA, profileB] })
  const port = cases(f)
  const key = randomUUID()
  const requestA = f.businessRequest(profileA, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })
  const contextA = await lease(f.authority, requestA, "sf_case_draft", payload)
  const original = await port.draft(payload, contextA)
  expect(original.status).toBe("ok")
  const before = await stored(f)
  const retryRequest = f.businessRequest(profileA, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })
  expect(await port.draft(payload, await lease(f.authority, retryRequest, "sf_case_draft", payload))).toEqual(original)
  const recoveryA = await lease(f.authority, f.businessRequest(profileA), "sf_case_read", { recovery: key })
  expect(await port.recoverCreation(key, recoveryA)).toMatchObject({ status: "ok", value: { state: "committed" } })
  const foreignRequest = f.businessRequest(profileB, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })
  const denied = await port.draft(payload, await lease(f.authority, foreignRequest, "sf_case_draft", payload))
  expect(denied.status).toBe("denied")
  expect(denied).not.toHaveProperty("value")
  const recoveryB = await lease(f.authority, f.businessRequest(profileB), "sf_case_read", { recovery: key })
  const foreign = await port.recoverCreation(key, recoveryB)
  expect(foreign.status).not.toBe("ok")
  expect(foreign).not.toHaveProperty("value")
  expect(await stored(f)).toEqual(before)
  const keys = Object.keys(object(object(before).transactions))
  expect(keys).toHaveLength(1)
  const identity = sfTransactionIdentity(keys[0])
  expect(identity?.profile).toEqual(profileA)
  expect(sfTransactionBelongsTo({ principalRef: oid, profile: profileA }, keys[0])).toBe(true)
  expect(sfTransactionBelongsTo({ principalRef: other, profile: profileA }, keys[0])).toBe(false)
  expect(sfTransactionProfileMatches(profileA, keys[0])).toBe(true)
  expect(sfTransactionProfileMatches(profileB, keys[0])).toBe(false)
})

test("product-authority-06: an actual unscoped legacy receipt stays immutable and suspends a Team retry and recovery", async () => {
  const f = await fixture()
  const legacy = createSfProductAuthority({ ...f.options, teamProfiles: undefined })
  const port = cases(f, legacy)
  const key = randomUUID()
  const request = f.businessRequest(profileA, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })
  const created = await port.draft(payload, await lease(legacy, request, "sf_case_draft", payload))
  expect(created.status).toBe("ok")
  const before = await stored(f)
  const keys = Object.keys(object(object(before).transactions))
  expect(keys).toHaveLength(1)
  expect(sfTransactionIdentity(keys[0])?.profile).toBeUndefined()
  const current = cases(f)
  const retried = await current.draft(payload, await lease(f.authority,
    f.businessRequest(profileA, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } }), "sf_case_draft", payload))
  expect(retried.status).toBe("denied")
  expect(retried).not.toHaveProperty("value")
  const recovered = await current.recoverCreation(key, await lease(f.authority, f.businessRequest(), "sf_case_read", { key }))
  expect(recovered.status).not.toBe("ok")
  expect(recovered).not.toHaveProperty("value")
  expect(await stored(f)).toEqual(before)
})

test("product-authority-07: reopening real SQLite never adopts an old UI lease, while a newly admitted same owner may read original data", async () => {
  const f = await fixture()
  const created = await seed(f)
  const old = await lease(f.authority, f.businessRequest(), "sf_case_read", { caseRef: encodeCaseRef(created) })
  await f.store.dispose()
  const reopened = await f.reopen()
  const current = f.makeAuthority(reopened)
  expect(await current.authority.ui.revalidate(old)).toBe(false)
  const fresh = await lease(current.authority, f.businessRequest(), "sf_case_read", { caseRef: encodeCaseRef(created) })
  const projection = await cases(f, current.authority).read({ caseRef: encodeCaseRef(created) }, fresh)
  expect(projection.status).toBe("ok")
  if (projection.status === "ok") {
    expect(projection.value.case.id).toBe(created.id)
    expect(projection.value.context.owner).toEqual(Schema.decodeUnknownSync(TeamProfile.Owner)({
      profile: profileA, principal: { tenantId: tenant, principalObjectId: oid },
    }))
    expect(projection.value.context.owner?.profile.teamObjectId).not.toBe(profileB.teamObjectId)
    expect(current.authority.ui.requestFor(JSON.parse(JSON.stringify(projection.value.context)))).toBeUndefined()
  }
  expect(current.authority.ui.requestFor(old)).toBeUndefined()
})

test("product-authority-04: empty-context administrator proof is rechecked after awaits and serialized resolutions never authorize", async () => {
  const f = await fixture({ enabled: [], direct: [], roles: false, grants: [] })
  const resolution = await f.resolver.resolve(f.contextRequest(), { contractRevision: "sf-team-profile/1", kind: "selection", installationId, tenantId: tenant })
  expect(resolution.status).toBe("authenticated")
  expect(await f.resolver.revalidateResolution(resolution)).toBe(true)
  expect(await f.resolver.revalidateResolution(JSON.parse(JSON.stringify(resolution)))).toBe(false)
  const gate = barrier()
  f.hooks.beforeGrants = async () => { f.hooks.beforeGrants = undefined; await gate.hold() }
  const pending = f.authority.readTeamContextAdmission(f.contextRequest())
  await gate.entered
  f.provider.account.groups = []
  gate.release()
  const result = await pending
  expect(result.status).toBe("unavailable")
  expect(result).not.toHaveProperty("projection")
  expect(await f.resolver.revalidateResolution(resolution)).toBe(false)
  const fresh = await f.authority.readTeamContextAdmission(f.contextRequest())
  expect(fresh.status).toBe("ok")
  if (fresh.status === "ok") {
    expect(fresh.projection.administration).toEqual({ status: "denied" })
    expect(fresh.pages).toEqual([])
  }
})

test("product-authority-05: raw selector mutation during Graph cannot replace its already verified Team intent", async () => {
  const f = await fixture({ enabled: [profileA, profileB] })
  const gate = barrier()
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname !== "/v1.0/me") return undefined
    f.provider.hooks.before = undefined
    await gate.hold()
  }
  const selector = { contractRevision: "sf-team-profile/1", kind: "team", profile: { installationId, tenantId: tenant, teamObjectId: teamA } }
  const pending = f.resolver.resolve(f.request(undefined, f.cookie), selector)
  await gate.entered
  selector.profile.teamObjectId = teamB
  gate.release()
  const resolved = await pending
  expect(resolved).toMatchObject({ status: "authenticated", teams: { status: "ready", selected: profileA } })
  if (resolved.status !== "authenticated" || !resolved.admission) throw new Error("Original admitted selection required")
  expect(Object.isFrozen(resolved.admission.profile)).toBe(true)
  expect(Object.isFrozen(resolved.admission.principal)).toBe(true)
  expect(await f.resolver.revalidate(resolved.admission)).toBe(true)
})

test("product-authority-01: zero eligible Teams deny native binding before private runtime proofs or session inspection", async () => {
  const f = await fixture({ enabled: [], direct: [] })
  const calls = { selection: 0, session: 0 }
  const authority = createSfProductAuthority({
    ...f.options,
    verifySelection: async () => { calls.selection += 1; return false },
    inspectSession: async () => { calls.session += 1; return undefined },
  })
  const profile: ResidentProfile = {
    id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
    allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [],
    contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh",
  }
  const selected = selection(profile)
  const sessionID = SessionSchema.ID.make("ses_unadmitted_team")
  const receipt: SkillLoadReceipt = {
    runId: "unadmitted-run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64),
    instructionsDigest: "c".repeat(64), loadedMessageId: "msg_unadmitted", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: selected.manifestDigest,
  }
  const result = await authority.native.bind({
    request: f.businessRequest(), selected, sessionID, runId: receipt.runId, profile, manifestDigest: selected.manifestDigest,
    caseRef: { id: "known-case", incarnation: "known-incarnation", version: 1 }, skillReceipts: [receipt], entryMode: "interactive",
  })
  expect(result.status).toBe("denied")
  expect(calls).toEqual({ selection: 0, session: 0 })
  expect(await stored(f)).toBeUndefined()
})

test("Core admission excludes a native run when its exact case belongs to a different Team or loses provenance", async () => {
  const f = await fixture({ enabled: [profileA, profileB], grants: [{ ...productGrant(), sessionActions: ["read"] }] })
  const decision = await seed(f)
  const sessionID = SessionSchema.ID.make("ses_case_origin")
  await f.store.transaction("dashboard", async (snapshot) => {
    const product = object(snapshot.data.__sfProductV1)
    // The real C08 draft provides provenance. Seed only the derivative link
    // examined by Core admission, without starting a model or creating a session.
    product.nativeRuns = {
      originRun: { principalRef: oid, caseRef: { id: decision.id, incarnation: decision.incarnation }, native: { sessionID } },
    }
    return { commit: true, value: undefined }
  })
  const own = await f.authority.readCoreSessionAdmission(f.businessRequest(profileA))
  const foreign = await f.authority.readCoreSessionAdmission(f.businessRequest(profileB))
  if (!own || !foreign) throw new Error("Current admission for both eligible Teams required")
  expect(await Effect.runPromise(own.authorize("read", sessionID))).toBe(true)
  expect(await Effect.runPromise(foreign.authorize("read", sessionID))).toBe(false)
  expect(await Effect.runPromise(foreign.excludedSessions())).toEqual([sessionID])

  await f.store.transaction("dashboard", async (snapshot) => {
    object(snapshot.data.__sfProductV1).transactions = {}
    return { commit: true, value: undefined }
  })
  expect(await Effect.runPromise(own.authorize("read", sessionID))).toBe(false)
  expect(await Effect.runPromise(own.excludedSessions())).toEqual([sessionID])
})

test("document readiness requires the complete current Team binding", async () => {
  const f = await fixture({
    enabled: [profileA, profileB],
    grants: [{ ...productGrant(), operations: ["sf_document_extract", "sf_evidence_get"],
      humanActions: ["documents.schema"] }],
  })
  const request = f.contextRequest("team")
  const context = await f.authority.readTeamContextAdmission(request)
  if (context.status !== "ok" || !context.binding) throw new Error("Current Team document context required")
  const expected = { ...context.technical, team: context.binding }
  expect(await f.authority.readDocumentGrants(request, expected)).toEqual({
    extract: true, open: true, search: false, schema: true, confirm: false,
  })
  expect(await f.authority.readDocumentGrants(f.contextRequest("team", profileB), expected)).toBeUndefined()
  expect(await f.authority.readDocumentGrants(request, { ...expected, team: {
    ...expected.team, owner: { ...expected.team.owner, profile: profileB },
  } })).toBeUndefined()
  expect(await f.authority.readDocumentGrants(request, context.technical)).toBeUndefined()
})
