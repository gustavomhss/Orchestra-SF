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
