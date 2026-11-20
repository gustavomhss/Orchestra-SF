import { expect, test } from "bun:test"
import type { ModuleServices } from "../../index.ts"
import { roleMap } from "../../runtime/admin.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createAuthorizedComponentRenderer } from "../product/wp01/component-renderer-fixture.ts"
import { createMicrosoftComponentFixture } from "../product/wp01/microsoft-component-fixture.ts"
import { createRecoveryFixture } from "../product/wp02/workbench-recovery-fixture.ts"
import { createDashboardRecordEvidenceHost } from "../../product/dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../../product/integration/dashboard-sources.ts"
import type { SfScopedSourcePort } from "../../product/integration/source-lifecycle.ts"
import { createSfDashboardRecordSourceAccess } from "../../product/decision-memory/source-access.ts"
import { oid, other } from "../microsoft-login/oidc-fixture.ts"
import { randomUUID } from "node:crypto"
import type { TrustedDomainContext } from "../../product/contracts/sf-execution.ts"
import { createFixtureBusiness } from "../product/wp02/business-services-fixture.ts"
import { createCollaborationHost } from "../../product/collaboration/host.ts"
import { createProcurementCollectionMemberIssuer } from "../../product/procurement/collection-member.ts"

// Integration contracts for the G04 composition. These are not browser-pool
// declarations and do not count toward its fixed 40-source/206-body evidence.
test("component HTTP client verifies the actual fixture CA through the closed proxy", async () => {
  const fixture = await createMicrosoftComponentFixture()
  try {
    const response = await fixture.fetch(fixture.origin + "/sucafina/dashboard?component-session=1", {
      headers: { cookie: fixture.cookie },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<h1>Component session ready</h1>")
    expect(() => fixture.fetch("https://foreign.example/sucafina/dashboard")).toThrow("exact installed fixture origin")
    expect(() => fixture.fetch(fixture.origin + "/foreign/dashboard")).toThrow("exact installed fixture origin")
  } finally { await fixture.close() }
}, 15_000)

test("component projection refuses a RoleMap revision change even when roles and record versions stay equal", async () => {
  const fixture = await createMicrosoftComponentFixture()
  let change = false, transactions = 0
  try {
    const capture = () => fixture.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false, value: { actorRoles: roleMap(snapshot, "dashboard").map(({ role, entra }) => ({ role, entra })),
        versions: digestSfValue(snapshot.versions), roleMap: digestSfValue(roleMap(snapshot, "dashboard")) },
    }))
    const persistence: ModuleServices["persistence"] = {
      ...fixture.persistence,
      transaction: async (surface, work, options) => {
        transactions++
        if (change && transactions === 2) {
          await fixture.store.transaction(surface, async (snapshot) => {
            snapshot.data.roleMap = roleMap(snapshot, surface).map((row) => row.role === "admin"
              ? { ...row, version: row.version + 1 } : row)
            return { commit: true, value: undefined }
          })
        }
        return fixture.persistence.transaction(surface, work, options)
      },
    }
    const renderer = createAuthorizedComponentRenderer({
      ...fixture.binding, boundary: fixture.boundary,
      services: { persistence, authenticate: fixture.boundary.identity.authenticate, environment: fixture.environment, maxJsonBytes: 100000 },
    })
    const positive = await renderer(fixture.request("/dashboard?page=Budget+Overview&year=2026"), "dashboard")
    expect(positive.status).toBe(200)
    expect(positive.headers.get("x-sf-access-revision")).toMatch(/^[a-f0-9]{64}$/)
    await positive.text()
    const before = await capture()
    transactions = 0; change = true
    const denied = await renderer(fixture.request("/dashboard?page=Budget+Overview&year=2026"), "dashboard")
    expect(denied.status).toBe(403)
    expect(await denied.text()).toBe("")
    expect(denied.headers.has("x-sf-access-revision")).toBe(false)
    expect(transactions).toBe(2)
    const after = await capture()
    expect(after.actorRoles).toEqual(before.actorRoles)
    expect(after.versions).toBe(before.versions)
    expect(after.roleMap).not.toBe(before.roleMap)
  } finally { await fixture.close() }
}, 15_000)

test("component Hot Topic discovery shares the business clock with durable scoped source projections", async () => {
  const fixture = await createRecoveryFixture()
  try {
    const result = await fixture.read((context) => fixture.dashboard.discover({ page: "Hot Topics & Actions" }, context))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Actual scoped discovery failed: " + result.status + " " + result.reason)
    const source = result.value.records.find((entry) => entry.label === "Original action")?.draft
    expect(source).toBeDefined()
    expect(source?.target.period).toEqual({ start: fixture.clock.at.slice(0, 10), end: fixture.clock.at.slice(0, 10) })
    expect(source?.fields.action).toBe("Original action")
    expect(source?.targetEvidence.refDigest).toMatch(/^[a-f0-9]{64}$/)
  } finally { await fixture.close() }
}, 15_000)

// Count the real scoped reader without replacing its projection, identity checks,
// source transaction or current policy. Fault hooks run between real observations.
async function recordObservationFixture() {
  const fixture = await createMicrosoftComponentFixture({
    grants: [oid, other].map((principalRef) => ({
      principalRef, namespaces: ["cases"], operations: ["sf_dashboard_read"],
    })),
  })
  let release: (() => void) | undefined
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const)
      await fixture.persistence.initializeSources(surface)
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.contracts = [{ id: "observed-contract", vendor: "Observed vendor", amount: 120, currency: "USD" }]
      return { commit: true, value: undefined }
    })
    const authority = fixture.productAuthority()
    const payload = { page: "Vendor Contracts" }, digest = digestSfValue(payload)
    const admit = async (cookie = fixture.cookie) => {
      const request = fixture.request("/dashboard?sf=dashboard-workbench", cookie, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      })
      const admitted = await authority.ui.admit(request, "sf_dashboard_read", digest)
      if (admitted.status !== "ok") throw new Error("Actual record read admission failed: " + admitted.status)
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) {
        authority.ui.finish(admitted.value)
        throw new Error("Actual record read validation failed")
      }
      return admitted.value
    }
    const call = await admit()
    release = () => authority.ui.finish(call)
    const hooks: { beforeRead?: (index: number) => Promise<void> } = {}
    let reads = 0
    const scopedSources: SfScopedSourcePort = {
      ...fixture.persistence,
      resolveScopedSource: async (surface, incarnation, authorize) => {
        reads++
        await hooks.beforeRead?.(reads)
        return fixture.persistence.resolveScopedSource(surface, incarnation, authorize)
      },
    }
    const records = createDashboardRecordEvidenceHost({
      host: authority.host, scopedSources,
      issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: fixture.persistence }),
    })
    const issued = await records.issue({
      page: "Vendor Contracts", recordType: "contracts", recordId: "observed-contract",
      fields: ["amount", "vendor"], period: { start: "2026-01-01", end: "2026-12-31" },
    }, call)
    if (issued.status !== "ok") throw new Error("Actual record source issuance failed: " + issued.status + " " + issued.reason)
    reads = 0
    const read = createSfDashboardRecordSourceAccess({ host: authority.host, records })
    const legacy = createSfDashboardRecordSourceAccess({
      host: authority.host, records: { resolve: records.resolve, read: records.read },
    })
    return {
      ...fixture, authority, admit, call, ref: issued.value, records, read, legacy, hooks,
      get reads() { return reads },
      reset() { reads = 0; hooks.beforeRead = undefined },
      async close() { release?.(); await fixture.close() },
    }
  } catch (error) {
    release?.()
    await fixture.close()
    throw error
  }
}

test("record observation projects all fields between two real source reads and each call observes afresh", async () => {
  const f = await recordObservationFixture()
  try {
    const providerStart = f.provider.requests.length
    const observed = await f.read(f.ref, f.call)
    expect(observed.state).toBe("fresh")
    expect(f.reads).toBe(2)
    if (observed.state !== "fresh" || !observed.authorizedProjection) throw new Error("Actual joint projection unavailable")
    expect(observed.currentRef).toEqual(f.ref)
    expect(observed.authorizedProjection.values.map(({ value }) => value)).toEqual([120, "Observed vendor"])
    const jointProviderReads = f.provider.requests.length - providerStart
    f.reset()
    const legacyStart = f.provider.requests.length
    const legacy = await f.legacy(f.ref, f.call)
    expect(legacy).toEqual(observed)
    expect(f.reads).toBe(6)
    const legacyProviderReads = f.provider.requests.length - legacyStart
    f.reset()
    expect(await f.read(f.ref, f.call)).toEqual(observed)
    expect(f.reads).toBe(2)
    expect(await f.read(f.ref, f.call)).toEqual(observed)
    expect(f.reads).toBe(4)
    console.info("G04 actual record observation counts", { jointScopedReads: 2, legacyScopedReads: 6,
      jointProviderReads, legacyProviderReads })
  } finally { await f.close() }
}, 15_000)

test("record observation refuses a persisted field change between the two source reads", async () => {
  const f = await recordObservationFixture()
  try {
    f.hooks.beforeRead = async (index) => {
      if (index !== 2) return
      await f.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.contracts = [{ id: "observed-contract", vendor: "Changed vendor", amount: 240, currency: "USD" }]
        return { commit: true, value: undefined }
      })
    }
    const result = await f.read(f.ref, f.call)
    expect(result.state).toBe("unavailable")
    expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    expect(f.reads).toBe(2)
    const current = await f.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false, value: snapshot.data.contracts,
    }))
    expect(current).toEqual([{ id: "observed-contract", vendor: "Changed vendor", amount: 240, currency: "USD" }])
  } finally { await f.close() }
}, 15_000)

test("record observation refuses a current RoleMap revision change even when the same actor retains the same roles", async () => {
  const f = await recordObservationFixture()
  try {
    const before = await f.store.transaction("dashboard", async (snapshot) => ({
      commit: false, value: { roles: roleMap(snapshot, "dashboard").map(({ role, entra }) => ({ role, entra })),
        versions: digestSfValue(snapshot.versions), map: digestSfValue(roleMap(snapshot, "dashboard")) },
    }))
    f.hooks.beforeRead = async (index) => {
      if (index !== 2) return
      await f.store.transaction("dashboard", async (snapshot) => {
        snapshot.data.roleMap = roleMap(snapshot, "dashboard").map((row) =>
          row.role === "admin" ? { ...row, version: row.version + 1 } : row)
        return { commit: true, value: undefined }
      })
    }
    const result = await f.read(f.ref, f.call)
    expect(result.state).toBe("unavailable")
    expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    const after = await f.store.transaction("dashboard", async (snapshot) => ({
      commit: false, value: { roles: roleMap(snapshot, "dashboard").map(({ role, entra }) => ({ role, entra })),
        versions: digestSfValue(snapshot.versions), map: digestSfValue(roleMap(snapshot, "dashboard")) },
    }))
    expect(after.roles).toEqual(before.roles)
    expect(after.versions).toBe(before.versions)
    expect(after.map).not.toBe(before.map)
  } finally { await f.close() }
}, 15_000)

test("record observation accepts clock progress within its UTC day and refuses a day change during the final read", async () => {
  const f = await recordObservationFixture()
  try {
    f.hooks.beforeRead = async (index) => { if (index === 2) f.clock.at = "2026-11-13T08:00:01Z" }
    const sameDay = await f.read(f.ref, f.call)
    expect(sameDay.state).toBe("fresh")
    expect(f.reads).toBe(2)
    f.reset()
    f.hooks.beforeRead = async (index) => { if (index === 2) f.clock.at = "2026-11-14T08:00:01Z" }
    const nextDay = await f.read(f.ref, f.call)
    expect(nextDay.state).toBe("unavailable")
    expect(Object.hasOwn(nextDay, "authorizedProjection")).toBe(false)
    expect(f.reads).toBe(2)
  } finally { await f.close() }
}, 15_000)

test("record observation refuses current Team membership loss and does not fall back after an observer refusal", async () => {
  const f = await recordObservationFixture()
  let fallbackReads = 0
  try {
    expect((await f.read(f.ref, f.call)).state).toBe("fresh")
    f.reset()
    const read = createSfDashboardRecordSourceAccess({ host: f.authority.host, records: {
      ...f.records,
      resolve: async (reference, call) => { fallbackReads++; return f.records.resolve(reference, call) },
      read: async (reference, call) => { fallbackReads++; return f.records.read(reference, call) },
    } })
    f.hooks.beforeRead = async (index) => { if (index === 2) f.policy.readable = false }
    const result = await read(f.ref, f.call)
    expect(result.state).toBe("unavailable")
    expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    expect(fallbackReads).toBe(0)
    expect(f.reads).toBe(2)
  } finally { await f.close() }
}, 15_000)

test("record observation refuses an actual logout between the two source reads", async () => {
  const f = await recordObservationFixture()
  try {
    f.hooks.beforeRead = async (index) => {
      if (index === 2) expect((await f.logout(f.cookie))?.status).toBe(204)
    }
    const result = await f.read(f.ref, f.call)
    expect(result.state).toBe("unavailable")
    expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    expect(f.reads).toBe(2)
  } finally { await f.close() }
}, 15_000)

test("record observation cannot reuse an issued scope for another real Microsoft principal", async () => {
  const f = await recordObservationFixture()
  try {
    const otherCookie = await f.login(other)
    const otherCall = await f.admit(otherCookie)
    try {
      expect(otherCall.binding.principalRef).toBe(other)
      expect(otherCall.binding.principalRef).not.toBe(f.call.binding.principalRef)
      const result = await f.read(f.ref, otherCall)
      expect(result.state).toBe("unavailable")
      expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    } finally { f.authority.ui.finish(otherCall) }
    f.reset()
    expect((await f.read(f.ref, f.call)).state).toBe("fresh")
    expect(f.reads).toBe(2)
  } finally { await f.close() }
}, 15_000)

test("record observation rejects a changed selector on the original request during an await", async () => {
  const f = await recordObservationFixture()
  try {
    const request = f.authority.host.requestFor(f.call)
    if (!request) throw new Error("Original admitted request required")
    f.hooks.beforeRead = async (index) => {
      if (index === 2) request.headers.set("x-sf-team-profile", "{}")
    }
    const result = await f.read(f.ref, f.call)
    expect(result.state).toBe("unavailable")
    expect(Object.hasOwn(result, "authorizedProjection")).toBe(false)
    expect(f.reads).toBe(2)
  } finally { await f.close() }
}, 15_000)


// This producer proof is separate from the fixed browser inventory. It mounts
// actual Work/Procurement/BCS over the same private grants, OIDC and SQLite.
async function workObservationFixture() {
  const fixture = await createMicrosoftComponentFixture({
    at: "2026-11-14T08:00:00Z",
    grants: [{ principalRef: oid, namespaces: ["cases", "threads", "relations", "confirmations", "preferences"],
      operations: ["sf_work_list"] }],
  })
  let business: Awaited<ReturnType<typeof createFixtureBusiness>> | undefined
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const)
      await fixture.persistence.initializeSources(surface)
    const changeSubject = (title: string) => fixture.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", fxRates: [] }, suppliers: [], requests: {
        "PR-observed": { version: 1, request: {
          number: "PR-observed", createdBy: oid, status: "pr_pending", pr: { title, currency: "USD", total: 100 },
          prApprovalBaseCurrency: "USD", prApproval: { amount: 100, steps: [{ status: "pending", holderId: oid, levelName: "Review" }] },
          history: [{ action: "Requisition submitted for approval", at: "2026-11-01T08:00:00Z" }],
        } },
      } }
      return { commit: true, value: undefined }
    })
    await changeSubject("Current approval")
    const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
    const authority = fixture.productAuthority({ proposalCoverageWrites, dashboardHostWrites })
    const services = business = await createFixtureBusiness({
      authority, persistence: fixture.persistence, proposalCoverageWrites, dashboardHostWrites,
    })
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const withCall = async <T>(payload: unknown, work: (call: TrustedDomainContext) => Promise<T>) => {
      const request = fixture.request("/dashboard?sf=workbench-work", fixture.cookie, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      })
      const digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(request, "sf_work_list", digest)
      if (admitted.status !== "ok") throw new Error("Actual Work admission failed: " + admitted.status)
      try {
        if (!await authority.ui.validate(admitted.value, "sf_work_list", digest)) throw new Error("Actual Work validation failed")
        return await work(admitted.value)
      } finally { authority.ui.finish(admitted.value) }
    }
    const selected = await withCall({ purpose: "work-selection", period },
      (call) => services.procurementSelections.create(call, period))
    if (selected.status !== "ok") throw new Error("Actual Procurement selection failed: " + selected.status + " " + selected.reason)
    const selection = { selectionRef: selected.value.selectionRef, period }
    const counts = { initialSources: 0, initialApproved: 0, captured: 0, laterSources: 0 }
    const hooks: { afterInitial?: () => Promise<void> } = {}
    let phase = "before-list"
    const capture = createProcurementCollectionMemberIssuer({
      collection: services.registry, individual: services.individual, revalidate: authority.host.revalidate,
    })
    const collaboration = createCollaborationHost({
      host: authority.host, state: authority.state, creationTarget: authority.creationTarget,
      scopedSources: fixture.persistence, evidence: services.context,
      procurement: { list: async (reference, call) => {
        const result = await services.procurement.list(reference, call)
        if (result.status === "ok") phase = "projected"
        return result
      } },
      collections: services.registry, cases: services.cases, authority: authority.authority, human: authority.human,
      captureWorkSource: async (reference, call) => {
        phase = "capture"; counts.captured++
        try { return await capture(reference, call) }
        finally { phase = "after-capture" }
      },
      requiredAuthority: { sf_work_list: ["threads:read", "relations:read", "confirmations:read"],
        sf_question_prepare: ["threads:read", "cases:read"], sf_answer_read: ["threads:read"],
        sf_relation_read: ["relations:read"], sf_handoff_prepare: ["threads:read", "relations:read"] },
      createId: randomUUID, now: () => fixture.clock.at,
    })
    const sources = collaboration.authority.sources
    collaboration.authority.sources = async (refs, call) => {
      const initial = phase === "projected"
      if (initial) counts.initialSources++
      if (phase === "after-capture") counts.laterSources++
      const allowed = await sources(refs, call)
      if (initial && allowed) {
        counts.initialApproved++
        const hook = hooks.afterInitial
        hooks.afterInitial = undefined
        await hook?.()
      }
      return allowed
    }
    return { ...fixture, counts, hooks, changeSubject,
      read: () => withCall(selection, (call) => collaboration.work.listPresentation(selection, call)),
      async close() { try { services.dispose() } finally { await fixture.close() } },
    }
  } catch (error) {
    try { business?.dispose() } finally { await fixture.close() }
    throw error
  }
}

test("Work projects identical complete Procurement evidence once per item and keeps independent capture and final checks", async () => {
  const f = await workObservationFixture()
  try {
    const providerStart = f.provider.requests.length
    const result = await f.read()
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Actual Work projection unavailable: " + result.reason)
    expect(result.value.items).toHaveLength(1)
    const item = result.value.items[0]!
    expect(item.kind).toBe("procurement")
    expect(item.title).toBe("Current approval")
    expect(item.approvalStage).toBe("Review")
    expect(item.ownerRef).toBe(oid)
    expect(item.destination?.kind).toBe("procurement-request")
    expect(f.counts.initialSources).toBe(1)
    expect(f.counts.initialApproved).toBe(1)
    expect(f.counts.captured).toBe(1)
    expect(f.counts.laterSources).toBeGreaterThan(0)
    console.info("G04 actual Work observation counts", { ...f.counts,
      providerReads: f.provider.requests.length - providerStart })
  } finally { await f.close() }
}, 15_000)

test("Work refuses changed Procurement material after its first actual source check", async () => {
  const f = await workObservationFixture()
  try {
    f.hooks.afterInitial = async () => { await f.changeSubject("Changed after current observation") }
    const result = await f.read()
    expect(f.counts.initialApproved).toBe(1)
    expect(["denied", "unavailable", "stale"]).toContain(result.status)
    expect(Object.hasOwn(result, "value")).toBe(false)
    expect(f.counts.captured).toBe(1)
  } finally { await f.close() }
}, 15_000)

test("Work refuses current Team revocation after its first actual source check", async () => {
  const f = await workObservationFixture()
  try {
    f.hooks.afterInitial = async () => { f.policy.readable = false }
    const result = await f.read()
    expect(f.counts.initialApproved).toBe(1)
    expect(["denied", "unavailable", "stale"]).toContain(result.status)
    expect(Object.hasOwn(result, "value")).toBe(false)
    expect(f.counts.captured).toBe(1)
  } finally { await f.close() }
}, 15_000)
