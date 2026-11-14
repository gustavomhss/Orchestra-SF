import { expect, test } from "bun:test"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { roleMap } from "../../../../runtime/admin.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { projectSfSourceScope } from "../../../../product/integration/source-projections.ts"
import { verifyDashboardImportTarget } from "../../../../product/imports/source-fences.ts"
import { createSfPlannerEvidenceReader } from "../../../../product/planner/evidence-reader.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"
import atlasPackage from "../../../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }

const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", accessRevision: "a", policyVersion: "p", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"

test("Dashboard import fence checks the authenticated scoped incarnation and projection", () => {
  const snapshot: Snapshot = { data: { members: [{ id: "m1", name: "Ana" }], leaders: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const scope = { principalRef: "admin", accessRevision: "a", policyVersion: "p", recordType: "dashboard-page", recordId: "Talent Review", selector: { page: "Talent Review", fields: ["members"], period, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) } }
  const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
  expect(projection).toBeDefined()
  const digest = digestSfValue(projection)
  snapshot.sfSources = { schemaVersion: 1, records: { [JSON.stringify([scope.recordType, scope.recordId])]: { incarnation: "raw", version: 1, alive: true, inputDigest: digest } }, scopes: { [digestSfValue(scope)]: { scope, sourceIncarnation: "raw", incarnation: "scoped", version: 1, alive: true, inputDigest: digest } } }
  const target = { surface: "dashboard" as const, selectionRef: "sf-source:scoped:1", incarnation: "scoped", version: 1, options: { newVersion: false, removeMissing: false, preview: {} } }
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: target.selectionRef, refDigest: "ref", installationId: "i", projectId: "p", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType: scope.recordType, recordId: scope.recordId, incarnation: target.incarnation, version: 1, fields: ["members"], period, projectionDigest: digest } }
  const command = { page: scope.recordId, action: "import", version: 0, values: {} }
  expect(verifyDashboardImportTarget(snapshot, snapshot, target, actor, command, evidence, context, at)).toBe(true)
  expect(verifyDashboardImportTarget(snapshot, snapshot, { ...target, version: 2 }, actor, command, evidence, context, at)).toBe(false)
  const stale = structuredClone(snapshot)
  ;(stale.data.members as { name: string }[])[0]!.name = "Changed"
  expect(verifyDashboardImportTarget(stale, stale, target, actor, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, snapshot, target, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, context, at)).toBe(false)
})

test("dataset restoration requires the current administrator-scoped source", async () => {
  const { verifyDashboardImportEvidence } = await import("../../../../product/imports/dashboard.ts")
  const snapshot: Snapshot = { data: { risks: [{ id: "r1", name: "Before" }], __sfProductV1: { private: true } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const scope = { principalRef: "admin", accessRevision: "a", policyVersion: "p", recordType: "dashboard-dataset", recordId: "all", selector: { kind: "dashboard-dataset-v1", actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")), fields: ["data"] } }
  const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
  expect(projection).toEqual({ data: { risks: [{ id: "r1", name: "Before" }] } })
  const digest = digestSfValue(projection)
  snapshot.sfSources = { schemaVersion: 1, records: { [JSON.stringify([scope.recordType, scope.recordId])]: { incarnation: "raw-dataset", version: 1, alive: true, inputDigest: digest } }, scopes: { [digestSfValue(scope)]: { scope, sourceIncarnation: "raw-dataset", incarnation: "scoped-dataset", version: 1, alive: true, inputDigest: digest } } }
  const target = { surface: "dashboard" as const, selectionRef: "sf-dataset:scoped-dataset:1", incarnation: "scoped-dataset", version: 1, options: { newVersion: false, removeMissing: false, preview: {} } }
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: target.selectionRef, refDigest: "ref", installationId: "i", projectId: "p", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType: "dashboard-dataset", recordId: "all", incarnation: target.incarnation, version: 1, fields: ["data"], projectionDigest: digest } }
  const command = { page: "IT Risks", action: "backup-import", version: 0, values: { data: { risks: [] } } }
  const staged = structuredClone(snapshot)
  staged.data.risks = []
  expect(verifyDashboardImportTarget(snapshot, staged, target, actor, command, evidence, context, at)).toBe(true)
  expect(verifyDashboardImportEvidence(snapshot, staged, actor, command, evidence, at)).toBe(true)
  expect(verifyDashboardImportTarget(snapshot, staged, target, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportEvidence(snapshot, staged, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, staged, target, { ...actor, roles: ["finance"], canWrite: true }, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportEvidence(snapshot, staged, { ...actor, roles: ["finance"], canWrite: true }, command, evidence, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, staged, target, actor, command, { ...evidence, target: { ...evidence.target, fields: ["risks"] } }, context, at)).toBe(false)
  const changed = structuredClone(snapshot)
  changed.data.risks = [{ id: "r1", name: "Changed" }]
  expect(verifyDashboardImportTarget(changed, staged, target, actor, command, evidence, context, at)).toBe(false)
})

test("default Planner evidence preserves the real projection and refuses resealed, changed, replaced and revoked sources", async () => {
  const fixture = await plannerEvidenceFixture()
  const { app, business } = fixture
  try {
    const ref = await fixture.issue()
    const comparison = await app.uiCall("sf_forecast_compare", { baseRef: ref.refId, candidateRef: ref.refId, period: ref.target.period, currency: "USD" },
      (call) => business.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: ref.target.period!, currency: "USD" }, call))
    if (comparison.status !== "ok") throw new Error(`Real forecast comparison: ${comparison.reason}`)
    expect(comparison.value).toMatchObject({ analysisBasis: "domain", completeDifference: null, comparison: { comparisonStatus: "conditioned" } })
    const before = await fixture.snapshot()
    const observed = await fixture.withCall(ref, (call) => business.context.resolve(ref, call))
    expect(observed.state).toBe("fresh")
    expect(observed.ref).toEqual(ref)
    expect(observed.currentRef).toEqual(ref)
    expect(observed.authorizedProjection).toEqual(comparison.value.baseline)
    expect(comparison.value.baseline.values.find((value) => value.id === "known:1:actual")).toMatchObject({ value: 0, evidenceState: "confirmed" })
    expect(comparison.value.baseline.values.find((value) => value.id === "known:2:actual")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(comparison.value.baseline.values.find((value) => value.id === "fx:EUR")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(await fixture.snapshot()).toEqual(before)

    const altered: (typeof ref)[] = [
      { ...ref, evidenceLevel: "claim" },
      { ...ref, target: { ...ref.target, fields: ref.target.fields.slice(1) } },
      { ...ref, target: { ...ref.target, period: { start: "2027-02-01", end: "2027-12-31" } } },
      { ...ref, target: { ...ref.target, projectionDigest: "0".repeat(64) } },
    ]
    const extra = { ...ref, unexpected: "not issued by the source" }
    for (const candidate of [...altered, extra]) {
      candidate.refDigest = digestSfEvidenceRef(candidate)
      const denied = await fixture.withCall(candidate, (call) => business.context.resolve(candidate, call))
      expect(denied.state).toBe("unavailable")
      expect(denied.authorizedProjection).toBeUndefined()
      expect(denied.currentRef).toBeUndefined()
    }
    // Both persisted operators are admins; their scoped evidence is still not interchangeable.
    const other = await fixture.withCall(ref, (call) => business.context.resolve(ref, call), app.otherCookie)
    expect(other.state).toBe("unavailable")
    expect(other.authorizedProjection).toBeUndefined()

    await app.store.transaction("planner", async (snapshot) => {
      rows(rows(snapshot.data.versions)[0]!.lines)[0]!.name = "Changed source"
      return { commit: true, value: undefined }
    })
    expect((await fixture.withCall(ref, (call) => business.context.resolve(ref, call))).state).toBe("unavailable")
    const changed = await fixture.issue()
    expect(changed.target.incarnation).toBe(ref.target.incarnation)
    expect(changed.target.version).toBeGreaterThan(ref.target.version)
    expect((await fixture.withCall(changed, (call) => business.context.resolve(changed, call))).state).toBe("fresh")
    const source = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.versions) }))
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.versions = structuredClone(source); return { commit: true, value: undefined } })
    const replaced = await fixture.issue()
    expect(replaced.target.incarnation).not.toBe(changed.target.incarnation)
    expect(replaced.target.projectionDigest).toBe(changed.target.projectionDigest)
    expect((await fixture.withCall(changed, (call) => business.context.resolve(changed, call))).state).toBe("unavailable")
    expect((await fixture.withCall(replaced, (call) => business.context.resolve(replaced, call))).state).toBe("fresh")

    await fixture.withCall(replaced, async (call) => {
      expect((await business.context.resolve(replaced, call)).state).toBe("fresh")
      await app.store.transaction("planner", async (snapshot) => {
        snapshot.data.access = { ...object(snapshot.data.access), [app.principal.id]: { assigned: ["restricted-scope"], domains: [] } }
        return { commit: true, value: undefined }
      })
      const denied = await business.context.resolve(replaced, call)
      expect(denied.state).toBe("unavailable")
      expect(denied.authorizedProjection).toBeUndefined()
    })
    const current = await fixture.issue()
    await fixture.withCall(current, async (call) => {
      expect((await business.context.resolve(current, call)).state).toBe("fresh")
      const logout = await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
      expect(logout?.status).toBe(204)
      const denied = await business.context.resolve(current, call)
      expect(denied.state).toBe("unavailable")
      expect(denied.authorizedProjection).toBeUndefined()
    })
  } finally { business.dispose(); await app.dispose() }
}, 30_000)

test("Planner evidence rechecks durable ABA and logout across its asynchronous coverage boundary", async () => {
  const fixture = await plannerEvidenceFixture()
  const { app, business } = fixture
  try {
    const original = await fixture.issue()
    await fixture.withCall(original, async (call) => {
      const reads = { coverage: 0 }
      // Only schedule the real write at a deterministic boundary; retain the actual coverage result.
      const reader = createSfPlannerEvidenceReader({ host: app.authority.host, now: () => app.at, sources: {
        resolveForecastCoverage: async (...args) => {
          const result = await business.plannerSources.resolveForecastCoverage(...args)
          if (++reads.coverage === 2) {
            const name = await app.store.transaction("planner", async (snapshot) => {
              const line = rows(rows(snapshot.data.versions)[0]!.lines)[0]!
              const name = line.name
              line.name = "Intermediate source"
              return { commit: true, value: name }
            })
            await app.store.transaction("planner", async (snapshot) => {
              rows(rows(snapshot.data.versions)[0]!.lines)[0]!.name = name
              return { commit: true, value: undefined }
            })
          }
          return result
        },
      } })
      const stale = await reader(original, call)
      expect(reads.coverage).toBe(2)
      expect(stale.state).toBe("unavailable")
      expect(stale.authorizedProjection).toBeUndefined()
      expect(stale.currentRef).toBeUndefined()
    })
    const current = await fixture.issue()
    expect(current.target.incarnation).toBe(original.target.incarnation)
    expect(current.target.version).toBe(original.target.version + 2)
    expect(current.target.projectionDigest).toBe(original.target.projectionDigest)
    expect((await fixture.withCall(original, (call) => business.context.resolve(original, call))).state).toBe("unavailable")
    expect((await fixture.withCall(current, (call) => business.context.resolve(current, call))).state).toBe("fresh")
    await fixture.withCall(current, async (call) => {
      const reads = { coverage: 0 }
      const reader = createSfPlannerEvidenceReader({ host: app.authority.host, now: () => app.at, sources: {
        resolveForecastCoverage: async (...args) => {
          const result = await business.plannerSources.resolveForecastCoverage(...args)
          if (++reads.coverage === 2) {
            const logout = await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
            expect(logout?.status).toBe(204)
          }
          return result
        },
      } })
      const denied = await reader(current, call)
      expect(reads.coverage).toBe(2)
      expect(denied.state).toBe("unavailable")
      expect(denied.authorizedProjection).toBeUndefined()
    })
  } finally { business.dispose(); await app.dispose() }
}, 30_000)

test("Planner evidence refuses coverage failures and mutation of a reused coverage result", async () => {
  const fixture = await plannerEvidenceFixture()
  const { app, business } = fixture
  try {
    const ref = await fixture.issue()
    await fixture.withCall(ref, async (call) => {
      expect((await business.context.resolve(ref, call)).state).toBe("fresh")
      // Fault injection is confined to the coverage port; source, authority and storage remain real.
      // These negatives do not qualify a complete C10 coverage producer.
      for (const status of ["denied", "stale", "failed", "conflict", "provider-conflict"] as const) {
        const reader = createSfPlannerEvidenceReader({ host: app.authority.host, now: () => app.at,
          sources: { resolveForecastCoverage: async () => ({ status, reason: "coverage-refused" }) } })
        const refused = await reader(ref, call)
        expect(refused.state).toBe("unavailable")
        expect(refused.authorizedProjection).toBeUndefined()
      }
      const shared = { status: "unavailable" as const, reason: "coverage-first-observation" }
      const reads = { coverage: 0 }
      const reader = createSfPlannerEvidenceReader({ host: app.authority.host, now: () => app.at, sources: {
        resolveForecastCoverage: async () => {
          if (++reads.coverage === 2) shared.reason = "coverage-changed-observation"
          return shared
        },
      } })
      const changed = await reader(ref, call)
      expect(reads.coverage).toBe(2)
      expect(changed.state).toBe("unavailable")
      expect(changed.authorizedProjection).toBeUndefined()
    })
  } finally { business.dispose(); await app.dispose() }
}, 30_000)

async function plannerEvidenceFixture() {
  const root = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const app = await createWp06Runtime({ additionalOperations: ["sf_forecast_compare"] })
  const resources: { business?: ReturnType<typeof createSfBusinessServices> } = {}
  try {
    const business = createSfBusinessServices({ authority: app.authority, persistence: app.store, proposalCoverageWrites: new WeakSet(), documentRead: app.documents.documents.reader })
    resources.business = business
    // Actual SQLite and persisted local credentials. No scanner or remote provider claim is made.
    business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
      manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
    await app.store.transaction("planner", async (snapshot) => {
      const line = { sec: "opex", el: "licenses", b: Array(12).fill(10), a: [0, ...Array(11).fill(null)], f: [null, 5, ...Array(10).fill(null)] }
      snapshot.data.versions = [{ id: "v1", name: "Evidence source", year: 2027, closed: 1, locked: false,
        lines: [{ ...line, id: "known", name: "Known source", cur: "USD" }, { ...line, id: "foreign", name: "Unknown FX", cur: "EUR" }],
        projects: [], fx: [{ id: "EUR", cur: "EUR", rate: null }], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    const issue = async () => app.uiCall("sf_evidence_get", { refId: "v1" }, async (call) => {
      const source = await business.plannerProduct.issueSource("v1", call)
      if (source.status !== "ok") throw new Error(`Planner evidence issue: ${source.reason}`)
      return source.value.evidence
    })
    const withCall = async <T>(ref: BusinessEvidenceRef, work: (call: TrustedUiContext) => Promise<T>, cookie = app.cookie) => {
      const digest = digestSfValue({ refId: ref.refId })
      const request = new Request(`${app.origin}/sucafina/planner`, { method: "POST", headers: { cookie, origin: app.origin, "Idempotency-Key": randomUUID() } })
      const access = await app.authority.ui.admit(request, "sf_evidence_get", digest)
      if (access.status !== "ok") throw new Error(`Evidence UI admission: ${access.reason}`)
      try {
        if (!await app.authority.ui.validate(access.value, "sf_evidence_get", digest)) throw new Error("Evidence UI grant unavailable")
        return await work(access.value)
      } finally { app.authority.ui.finish(access.value) }
    }
    const snapshot = () => app.store.transactionAll(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
    return { app, business, issue, withCall, snapshot }
  } catch (error) { resources.business?.dispose(); await app.dispose(); throw error }
}
