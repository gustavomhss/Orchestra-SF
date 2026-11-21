import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfFinancePairObservation } from "../../../../../../../apps/cli/src/sucafina-product/finance-pair-observation.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { resolvePlannerScenarioBatch } from "../../../../product/planner/scenario-comparison-port.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("Finance observes the exact candidate and baseline with fewer physical reads and closes on revocation or source change", async () => {
  const deadline = compositionTestDeadline("finance-pair-observation")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-finance-pair-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const physical = new AsyncLocalStorage<boolean>()
  const control: { active: boolean; counts?: { physical: number; roots: number; work: number }; afterRoot?: () => Promise<void> } = { active: true }
  const transaction = store.transaction, all = store.transactionAll, root = store.readSnapshotRoot
  store.transaction = (surface, work, options) => {
    if (control.counts && !physical.getStore()) control.counts.physical++
    return transaction(surface, (...args) => physical.run(true, () => work(...args)), options)
  }
  store.transactionAll = (work, options) => {
    if (control.counts && !physical.getStore()) control.counts.physical++
    return all((...args) => physical.run(true, () => work(...args)), options)
  }
  store.readSnapshotRoot = async (work, options) => {
    if (control.counts) {
      control.counts.roots++
      if (!physical.getStore()) control.counts.physical++
    }
    const value = await root(() => physical.run(true, work), options)
    const after = control.afterRoot
    control.afterRoot = undefined
    await after?.()
    return value
  }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
  const identity = { installationId: "finance-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "finance-policy", persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: [] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence })
  deadline.own(() => business.dispose())
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [100, 80].map((amount, index) => ({ id: `v${index}`, name: `Forecast ${index}`, year: 2027, closed: 0,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
        officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const admissionDigest = digestSfValue({})
    const admitted = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
    deadline.own(() => authority.ui.finish(admitted))
    expect(await authority.ui.validate(admitted, "sf_scenario_simulate", admissionDigest)).toBe(true)
    const baseline = ok(await business.plannerProduct.issueSource("v0", admitted)).evidence
    const candidate = ok(await business.plannerProduct.issueSource("v1", admitted)).evidence
    const ref = { id: "finance-case", incarnation: "case-inc", version: 1 }
    const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: ["training"],
      additionalCategoryIds: [], sourceRefs: [baseline, candidate] }
    business.bindForecastCoverage(async (reference, call) => {
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:pending-coverage", basis, assessment: {
        basisId: basis.id, basisVersion: basis.version, alternativeId: source.value.versionId === "v0" ? "baseline" : "candidate",
        alternativeVersion: 1, currency: "USD", horizon: period, issues: ["training-pending"], evaluatedSourceRefs: [source.value.evidence],
        coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "No training evidence" }],
        derivedMissingCategoryIds: ["training"],
      } } }
    })
    const decision: DecisionCase = { ...ref, state: "comparing", objective: "Compare forecasts", horizon: period, currency: "USD",
      criteria: [], participants: ["person"], sourceRefs: basis.sourceRefs, alternatives: [], costCoverageBases: [basis],
      assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "seed-case", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[ref.id] = decision
      return { commit: true, value: true }
    })
    expect(seed.status).toBe("ok")
    const results = []
    for (const [id, source] of [["baseline", baseline], ["candidate", candidate]] as const) {
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const result = ok(await business.withCase(admitted, ref, {}, () => business.planner.simulateScenario(scenario, admitted)))
      const saved = ok(await business.withCase(admitted, ref, {}, () => business.results.write({ kind: "scenario", result, caseRef: ref,
        requestDigest: digestSfValue(scenario), sourceRefs: result.sourceRefs, idempotencyKey: id }, admitted)))
      results.push({ reference: saved.resultRef, alternative: { id, version: 1, title: id, scenario, result } })
    }
    const current = await authority.state.read(request(), "cases", () => true)
    if (current.status !== "ok") throw new Error("Case version unavailable")
    const bound = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: ref.id, targetIncarnation: ref.incarnation, idempotencyKey: "bind-alternatives", commandDigest: digestSfValue(results) }, async (state) => {
      state.cases[ref.id] = { ...decision, alternatives: results.map((result) => result.alternative) }
      return { commit: true, value: true }
    })
    expect(bound.status).toBe("ok")
    const scenarios = business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical scenario reader unavailable")
    const pair = { scenarioRefs: [results[1]!.reference, results[0]!.reference], criteria: [] }
    const observe = createSfFinancePairObservation({ host: business.host, state: authority.state, lockedSourceFences: business.lockedSourceFences,
      selectedScope: (call) => call === admitted ? { ref, current: () => true } : undefined,
      readerIdentities: () => [scenarios.resolveMany, scenarios.resolve, business.cases.read, business.plannerSources.resolveForecastSource] })
    const measure = async (grouped: boolean, afterRoot?: () => Promise<void>) => {
      const counts = { physical: 0, roots: 0, work: 0 }
      const result = await business.withCase(admitted, ref, {}, async () => {
        control.counts = counts
        control.afterRoot = afterRoot
        try {
          const work = async () => {
            counts.work++
            return { status: "ok" as const, value: await resolvePlannerScenarioBatch(scenarios, pair.scenarioRefs, admitted) }
          }
          return grouped ? await observe(pair, admitted, work) : await work()
        } finally { control.counts = undefined; control.afterRoot = undefined }
      })
      return { result, counts }
    }
    const scalar = await measure(false)
    const value = ok(scalar.result)
    expect(value.map((entry) => ok(entry).result)).toEqual([results[1]!.alternative.result, results[0]!.alternative.result])
    const grouped = await measure(true)
    expect(ok(grouped.result).map((entry) => ok(entry).result)).toEqual(value.map((entry) => ok(entry).result))
    expect(grouped.counts.work).toBe(1)
    expect(grouped.counts.roots).toBe(2)
    expect(grouped.counts.physical).toBeLessThan(scalar.counts.physical)
    const typedFailure = { status: "stale", reason: "fixture-canonical-stale" } as const
    expect(await business.withCase(admitted, ref, {}, () => observe(pair, admitted, async () => typedFailure))).toEqual(typedFailure)
    const revoked = await measure(true, async () => { control.active = false })
    expect(revoked.result.status).not.toBe("ok")
    expect(revoked.counts.work).toBe(1)
    control.active = true
    const changed = await measure(true, async () => {
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data.financeObservationMarker = "changed-after-close"
        return { commit: true, value: undefined }
      })
    })
    expect(changed.result.status).not.toBe("ok")
    expect(changed.counts.work).toBe(1)
  } finally { await deadline.close() }
}, 120_000)

function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
