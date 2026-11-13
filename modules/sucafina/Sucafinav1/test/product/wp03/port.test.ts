import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { plannerOperationUnits } from "../../../product/planner/sensitivity-units.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerIntervalProof } from "../../../product/planner/interval-proof.ts"
import type { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createPlannerScenarioInputs, plannerValueRef } from "../../../product/planner/scenario-inputs.ts"
import { comparePlannerVersions } from "../../../product/planner/version-comparison.ts"
import { plannerCapacityPresentation, plannerMonthlyPresentation } from "../../../product/planner/bi.ts"
import { plannerDifferencePresentation } from "../../../product/planner/bi-difference.ts"
import { projectHeadcount, prepareHeadcountIncrease, previewHeadcountCommand } from "../../../product/planner/headcount.ts"
import { plannerCatalogs, plannerCurrencyComposition, previewPlannerCatalog } from "../../../product/planner/catalogs.ts"
import { previewMonthlyOperation } from "../../../product/planner/monthly-edit.ts"
import { createPlannerObservedProjection } from "../../../product/planner/observed.ts"
import { createPlannerForecastInsights } from "../../../product/planner/forecast-insights.ts"
import { createPlannerOperationResolver, createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageAssessment, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const initial = (): Snapshot => ({
  data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [72000, 84000].map((license, index) => ({ id: `v${index}`, year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [40000,45000,45000,50000,50000,50000,50000,50000,50000,50000,60000,60000], a: [40000,40000,45000,45000,45000,45000,45000,45000,50000,null,null,null], f: [null,null,null,null,null,null,null,null,null,38000,40000+license,40000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })) }, versions: {}, sequences: {}, audit: [], notices: [],
})

test("headcount projection follows domain visibility and increase preview is disposable", () => {
  const snapshot = initial()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]!
  version.hc = { positions: [{ id: "person", name: "Private Person", include: true, fte: 1, start: 1, end: 12, type: "Employee", location: "Brazil", domain: "IT", rateId: "rate", talentReview: "Private classification", outlook: "Private talent outlook" }], rates: [{ id: "rate", name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" }], hrAF: {}, inc: 0, incMonth: 1 }
  const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }
  expect(projectHeadcount(snapshot, { id: "none", roles: [], canWrite: false }, environment, "v0")).toBeUndefined()
  const viewer = projectHeadcount(snapshot, { id: "viewer", roles: ["viewer"], canWrite: false }, environment, "v0")
  expect(viewer?.groups[0]?.monthlyOutlookUsd?.slice(9)).toEqual([10000, 10000, 10000])
  const viewerSource = projectPlannerSource(snapshot, { id: "viewer", roles: ["viewer"], canWrite: false }, "v0")
  expect(viewerSource?.restrictedHr).toBe(false)
  expect(JSON.stringify(viewerSource)).toContain("HR:IT")
  for (const privateField of ['"rates"', '"rateId"', "Private classification", "Private talent outlook"]) expect(JSON.stringify(viewerSource)).not.toContain(privateField)
  const finance = projectHeadcount(snapshot, actor, environment, "v0")
  expect(finance?.plannedDecemberFte).toBe(1)
  expect(Array.isArray(finance?.groups[0]?.monthlyOutlookUsd)).toBe(true)
  const withoutRate = structuredClone(snapshot)
  const missingHc = (withoutRate.data.versions as { hc: { rates: unknown[] } }[])[0]!.hc
  missingHc.rates = []
  expect(projectHeadcount(withoutRate, actor, environment, "v0")?.groups[0]).toMatchObject({ costState: "partial", monthlyOutlookUsd: Array(12).fill(null) })
  const command = prepareHeadcountIncrease("v0", 0, 10, 12)!
  const before = structuredClone(snapshot)
  expect(previewHeadcountCommand(snapshot, { id: "hr", roles: ["hr"], canWrite: true }, environment, command)?.result.ok).toBe(true)
  expect(snapshot).toEqual(before)
})

test("catalog preview uses the domain without writing or inventing a missing exchange rate", () => {
  const snapshot = initial()
  const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }
  expect(plannerCatalogs(snapshot, { id: "none", roles: [], canWrite: false }, environment, "v0")).toBeUndefined()
  expect(plannerCurrencyComposition(snapshot, actor, environment, "v0", 100, "EUR")).toMatchObject({ usd: null, legacyUsd: 0, missingRate: true })
  expect(plannerCurrencyComposition(snapshot, actor, environment, "v0", 100, "USD")).toMatchObject({ usd: 100, rate: 1, missingRate: false })
  const catalogs = plannerCatalogs(snapshot, actor, environment, "v0")
  expect(catalogs).toMatchObject({ fx: { scope: "version", versionId: "v0", usd: { code: "USD", rate: 1, editable: false } }, shared: { scope: "shared", writable: false } })
  expect(catalogs?.shared.allocations.every((allocation) => allocation.classificationOnly)).toBe(true)
  const before = structuredClone(snapshot)
  const preview = previewPlannerCatalog(snapshot, actor, environment, "v0", { page: "FX rates", action: "save", id: "eur", version: 0, values: { versionId: "v0", cur: "EUR", rate: 1.25 } })
  expect(preview?.result.ok).toBe(true)
  expect(preview?.after?.fx.rates.find((rate) => rate.id === "eur")).toMatchObject({ currency: "EUR", rate: 1.25 })
  expect(snapshot).toEqual(before)
})

test("annual budget preview retains manual months and does not write the Planner", () => {
  const snapshot = initial()
  const version = (snapshot.data.versions as { closed: number; lines: { b: number[]; bm: boolean[] }[] }[])[0]!
  version.closed = 0
  version.lines[0]!.b = [200, ...Array(11).fill(0)]
  version.lines[0]!.bm = [true, ...Array(11).fill(false)]
  const before = structuredClone(snapshot)
  const preview = previewMonthlyOperation(snapshot, { id: "admin", roles: ["admin"], canWrite: true }, { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }, "OPEX", "v0", "line", 0, "annual", 1520)
  expect(preview.errors).toEqual([])
  expect(preview.after[0]).toMatchObject({ value: 200, manual: true })
  expect(preview.after.slice(1).map((month) => month.value)).toEqual(Array(11).fill(120))
  expect(snapshot).toEqual(before)
})

test("forecast port compares the real engine, and detects source changes", async () => {
  const storage = testPersistence({ planner: initial() })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    return evidence
  })
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
  const assessments = refs.map((ref): CostCoverageAssessment => ({ basisId: "basis", basisVersion: 1, alternativeId: `alternative-${ref.refId}`, alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [ref], coverageState: "complete", derivedMissingCategoryIds: [], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "included", categoryId, componentRefs: Array.from({ length: 12 }, (_, index) => `line:${index + 1}`), evidenceRefs: [ref], scopeNote: "included in source" })) }))
  const coverageMode: { available: boolean; scenario?: CostCoverageAssessment } = { available: false }
  const scenarioRecords: Record<string, { result: ScenarioResult; coverageRef: string; basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> }> = {}
  const host: DomainPortHost = { persistence: storage.persistence, authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
  const sources: PlannerSourceHost = { resolveForecastSource: async (reference) => { const evidence = refs.find((ref) => ref.refId === reference); return evidence ? { status: "ok", value: { versionId: reference, evidence } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async (reference) => coverageMode.available ? { status: "ok", value: { coverageRef: reference === "coverage-scenario" ? "coverage-scenario" : reference === "v0" || reference === "coverage-v0" ? "coverage-v0" : "coverage-v1", basis, assessment: reference === "coverage-scenario" && coverageMode.scenario ? coverageMode.scenario : assessments[reference === "v0" || reference === "coverage-v0" ? 0 : 1] } } : { status: "unavailable", reason: "missing" } }
  const scenarios = { resolve: async (reference: string) => scenarioRecords[reference] ? { status: "ok" as const, value: scenarioRecords[reference] } : { status: "unavailable" as const, reason: "missing" } }
  const port = createPlannerPort({ host, sources, scenarios })
  const futureHost = { ...host, environment: async () => ({ at: "2028-01-01T00:00:00Z", id: () => "unused", directory: [] }) }
  const observe = createPlannerObservedProjection({ host: futureHost, sources, planner: createPlannerPort({ host: futureHost, sources }) })
  const observedPeriod = { start: "2027-01-01", end: "2027-01-31" }
  const observed = await observe({ valueId: "line:1:actual-usd", period: observedPeriod, evidenceRefs: [refs[0]] }, binding)
  expect(observed).toMatchObject({ unit: "USD", cutoff: "2027-01-31T23:59:59.999Z", coverage: "complete", projection: { values: expect.arrayContaining([expect.objectContaining({ id: "line:1:actual-usd", value: 40000, unit: "USD", evidenceState: "confirmed" })]) } })
  expect(await createPlannerObservedProjection({ host, sources, planner: port })({ valueId: "line:1:actual-usd", period: observedPeriod, evidenceRefs: [refs[0]] }, binding)).toBeUndefined()
  expect(await observe({ valueId: "line:10:forecast", period: { start: "2027-10-01", end: "2027-10-31" }, evidenceRefs: [refs[0]] }, binding)).toBeUndefined()
  const scenarioInputs = createPlannerScenarioInputs({ planner: port, sources, verifyAssumption: async () => ({ status: "unavailable", reason: "human-confirmation-required" }) })
  const verifyOperations = createPlannerOperationVerifier({ host, planner: port, sources, scenarioInputs })
  expect(await verifyOperations({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] }, binding)).toBe(true)
  expect(await verifyOperations({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "missing:11", amount: 124000, currency: "USD" }], assumptions: [] }, binding)).toBe(false)
  const resolveOperation = createPlannerOperationResolver({ host, planner: port, sources, scenarioInputs })
  const operation = { kind: "replace" as const, targetRef: "line:11", amount: 124000, currency: "USD" }
  expect(await resolveOperation({ baseRef: "v0", operation }, binding)).toMatchObject({ status: "ok", value: { operationDigest: digestSfValue(operation), producer: "planner", target: refs[0], sourceVersion: 1 } })
  expect(await resolveOperation({ baseRef: "v0", operation: { ...operation, targetRef: "missing:11" } }, binding)).toMatchObject({ status: "unavailable" })
  const referenced = await scenarioInputs.resolveAmount(plannerValueRef("v0", "line:11:forecast"), binding)
  expect(referenced).toMatchObject({ status: "ok", value: { amount: 112000, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" }, evidence: refs[0] } })
  expect(await scenarioInputs.resolveAmount(plannerValueRef("v0", "line:1:forecast"), binding)).toMatchObject({ status: "unavailable" })
  const before = structuredClone(storage.state.planner)
  const result = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.knownDifference).toBe(12000)
  const insights = await createPlannerForecastInsights({ host, planner: port, sources })({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(insights).toMatchObject({ status: "ok", value: { budgetMargin: { value: 2000, currency: "USD", evidenceRefs: [refs[1]] }, absentActual: expect.arrayContaining([expect.objectContaining({ valueId: "line:10:actual" })]), responsibles: [] } })
  const waterfall = plannerDifferencePresentation(result.value, "BI02")
  expect(waterfall).toMatchObject({ status: "ok", value: { presentation: { viewId: "BI02", waterfall: { reconciliation: "reconciled" } } } })
  if (waterfall.status === "ok") {
    expect(waterfall.value.projection.values.find((value) => value.id === "difference:baseline")?.value).toBe(590000)
    expect(waterfall.value.projection.values.find((value) => value.id === "difference:candidate-total")?.value).toBe(602000)
    expect(waterfall.value.presentation.series.find((series) => series.role === "contribution")?.valueIds).toHaveLength(12)
  }
  const partialWaterfall = plannerDifferencePresentation({ ...result.value, candidate: { ...result.value.candidate, components: result.value.candidate.components.slice(1) } }, "BI03")
  expect(partialWaterfall).toMatchObject({ status: "ok", value: { presentation: { waterfall: { reconciliation: "unreconciled" } } } })
  const breakdown = comparePlannerVersions(result.value.baseline, result.value.candidate)
  expect(breakdown.status).toBe("ok")
  expect(breakdown.rows.find((row) => row.id === "line:11")).toMatchObject({ state: "matched", difference: 12000 })
  expect(breakdown.rows.find((row) => row.id === "line:11")).toMatchObject({ evidenceStates: ["confirmed"], explanation: "The projected amount changed; this comparison does not identify a cause." })
  const changes = comparePlannerVersions({ ...result.value.baseline, components: result.value.baseline.components.slice(0, 1) }, { ...result.value.candidate, components: result.value.candidate.components.slice(1, 2) })
  expect(changes.rows.map((row) => row.state)).toEqual(["removed", "added"])
  expect(changes.rows.map((row) => row.difference)).toEqual([-40000, 40000])
  expect(result.value.comparison.comparisonStatus).toBe("conditioned")
  expect(result.value.completeDifference).toBeNull()
  expect(result.value.baseline.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(590000)
  expect(result.value.baseline.values.find((value) => value.id === "month:1:budget")).toMatchObject({ value: 40000, currency: "USD", evidenceState: "confirmed", drilldown: refs[0] })
  expect(result.value.baseline.values.find((value) => value.id === "month:1:actual")).toMatchObject({ value: 40000, evidenceState: "confirmed" })
  expect(result.value.baseline.values.find((value) => value.id === "month:10:outlook")).toMatchObject({ value: 38000, evidenceState: "confirmed" })
  expect(result.value.baseline.values.find((value) => value.id === "line:10:variance-usd")).toMatchObject({ value: -12000, currency: "USD", evidenceState: "confirmed" })
  expect(plannerOperationUnits({ projection: result.value.baseline, source: refs[0], operation: { kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" } })).toMatchObject({ parameterUnit: "USD", resultUnit: "USD", period: { start: "2027-11-01", end: "2027-11-30" } })
  expect(plannerOperationUnits({ projection: result.value.baseline, source: refs[0], operation: { kind: "replace", targetRef: "line:11", amount: 124000, currency: "EUR" } })).toBeUndefined()
  expect(result.value.baseline.values.find((value) => value.id === "month:10:actual")).toMatchObject({ value: null, evidenceState: "absent" })
  const presentation = plannerMonthlyPresentation(result.value.baseline)
  expect(presentation.series.map((series) => series.role)).toEqual(["budget", "actual", "outlook"])
  expect(presentation.series[2].valueIds).toEqual(Array.from({ length: 12 }, (_, index) => `month:${index + 1}:outlook`))
  expect(storage.state.planner).toEqual(before)
  coverageMode.available = true
  const covered = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(covered.status).toBe("ok")
  if (covered.status === "ok") expect(covered.value.completeDifference).toBe(12000)
  const simulated = await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] }, binding)
  expect(simulated.status).toBe("ok")
  if (simulated.status === "ok") {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-calculation-"))
    const db = await openLocalStore(directory)
    try {
      const state = createSfProductState({ persistence: db, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "finance", policyVersion: "1", accessRevision: "1" }) })
      const source = new Request("https://example.test")
      const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "decision", currency: "USD", horizon: period, criteria: [], participants: ["finance"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
      await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
      const access = { allowed: true }
      const store = createSfDecisionResultStore({ state, host: { requestFor: () => source, revalidate: async () => access.allowed }, authorizeCase: async () => access.allowed, verifySources: async (_result, evidence) => access.allowed && evidence.every((ref) => ref.kind === "record"), createId: () => "result", now: () => "2026-11-13T00:00:00Z" })
      const persist = createPlannerResultPersistence({ store, resolveCase: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } }) })
      const request = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] }
      const saved = await persist({ kind: "scenario", request, result: simulated.value }, "call", binding)
      expect(saved.status).toBe("ok")
      if (saved.status === "ok") {
        const issuer = createPlannerCalculationEvidence({ host: { requestFor: () => source, revalidate: async () => access.allowed }, readForCalculation: store.read, loadRecordOnlyRequest: async () => ({ status: "ok", value: { resultRef: saved.value.resultRef, request, engineVersion: "planner-runtime-v1" } }), replayRecordOnly: port.simulateScenario })
        const nested = createPlannerCalculationEvidence({ host: { requestFor: () => source, revalidate: async () => access.allowed }, readForCalculation: async () => { throw new Error("nested result must not resolve") }, loadRecordOnlyRequest: async () => ({ status: "ok", value: { resultRef: saved.value.resultRef, request: { ...request, operations: [{ kind: "replace", targetRef: "line:11", replacementRef: "nested-calculation" }] }, engineVersion: "planner-runtime-v1" } }), replayRecordOnly: async () => { throw new Error("nested request must not replay") } })
        expect(await nested.issue(saved.value.resultRef, binding)).toMatchObject({ status: "unavailable", reason: "calculation-nested-evidence-unavailable" })
        const issued = await issuer.issue(saved.value.resultRef, binding)
        expect(issued).toMatchObject({ status: "ok", value: { kind: "calculation", target: { inputDigest: digestSfValue(request), resultDigest: digestSfValue(simulated.value), sourceRefs: [refs[0]] } } })
        if (issued.status === "ok") expect(await issuer.resolve(issued.value.refId, binding)).toEqual(issued)
        const version = (storage.state.planner.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!
        version.lines[0]!.f[10] = 1
        expect(await issuer.issue(saved.value.resultRef, binding)).toMatchObject({ status: "stale" })
        version.lines[0]!.f[10] = 112000
        access.allowed = false
        expect(await issuer.issue(saved.value.resultRef, binding)).toMatchObject({ status: "denied" })
      }
    } finally { await db.dispose(); await rm(directory, { recursive: true, force: true }) }
    expect(simulated.value.knownSubtotal).toBe(602000)
    expect(simulated.value.total).toBeNull()
    expect(simulated.value.costCoverage.coverageState).toBe("pending")
    expect(simulated.value.components[10].evidenceState).toBe("hypothetical")
    if (covered.status === "ok") {
      const baseline: ScenarioResult = { id: "baseline", version: 1, components: covered.value.baseline.components, currency: "USD", horizon: period, sourceRefs: [refs[0]], costCoverage: assessments[0], comparisonStatus: "conditioned", knownSubtotal: 590000, total: null, unresolvedConditions: ["hypothetical"], restrictions: [] }
      scenarioRecords.base = { result: baseline, coverageRef: "coverage-v0", basis, projection: covered.value.baseline, source: refs[0] }
      const preview = await comparePlannerPreview({ host, sources, scenarios, planner: port }, { baselineRef: "base", scenario: { baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] } }, binding)
      expect(preview).toMatchObject({ status: "ok", value: { comparison: { comparisonStatus: "conditioned", knownDifference: 12000, completeDifference: null, costCoverageRefs: ["coverage-v0"] } } })
      if (preview.status === "ok") expect(preview.value.comparison.alternativeResultRef).toBe(preview.value.sample.id)
      if (preview.status === "ok") expect(preview.value.metric).toMatchObject({ metricRef: "planner:known-subtotal-difference", value: 12000, unit: "USD", period, state: "conditioned", evidenceRefs: [refs[0]] })
      const scenario = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] }
      const units = { issue: async () => ({ status: "ok", value: { scenario, metadataDigest: "stable", units: { sourceRefs: [refs[0]], engineVersion: "planner-runtime-v1", parameterUnit: "USD", resultUnit: "USD" } } }) } as unknown as ReturnType<typeof createPlannerSensitivityUnits>
      const compare = (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => comparePlannerPreview({ host, sources, scenarios, planner: port }, request, context)
      const threshold = createPlannerExactThreshold({ units, preview: compare })
      const proof = await createPlannerIntervalProof({ units, preview: compare })({ scenarioRef: "candidate", parameterBounds: { parameterRef: "line:11", minimum: 0, maximum: 150000, steps: 3 }, criterion: { id: "cost", operator: "gte", value: -57000 } }, "base", binding)
      expect(proof).toMatchObject({ status: "ok", value: { kind: "planner-direct-usd-v1", minimum: 0, maximum: 150000, parameterRef: "line:11", sourceRefs: [refs[0]] } })
      for (const criterion of [{ id: "cost", operator: "gte" as const, value: -57000, expected: 55000 }, { id: "cost", operator: "lte" as const, value: -97000, expected: 15000 }]) {
        const solved = await threshold({ scenarioRef: "candidate", parameterBounds: { parameterRef: "line:11", minimum: 0, maximum: 150000, steps: 3 }, criterion }, "base", binding)
        expect(solved.status).toBe("ok")
        if (solved.status !== "ok") continue
        expect(solved.value.value).toBeCloseTo(criterion.expected, 6)
        expect(solved.value.evidenceRefs).toContainEqual(refs[0])
        const bytes = new DataView(new ArrayBuffer(8))
        bytes.setFloat64(0, solved.value.value)
        bytes.setBigUint64(0, bytes.getBigUint64(0) + (criterion.operator === "gte" ? -1n : 1n))
        const adjacent = bytes.getFloat64(0)
        const at = await compare({ baselineRef: "base", scenario: { ...scenario, operations: [{ ...scenario.operations[0], amount: solved.value.value }] } }, binding)
        const beyond = await compare({ baselineRef: "base", scenario: { ...scenario, operations: [{ ...scenario.operations[0], amount: adjacent }] } }, binding)
        expect(at.status).toBe("ok")
        expect(beyond.status).toBe("ok")
        if (at.status === "ok" && beyond.status === "ok") {
          expect(at.value.metric.value).not.toBeNull()
          expect(beyond.value.metric.value).not.toBeNull()
          expect(criterion.operator === "gte" ? at.value.metric.value! >= criterion.value : at.value.metric.value! <= criterion.value).toBe(true)
          expect(criterion.operator === "gte" ? beyond.value.metric.value! >= criterion.value : beyond.value.metric.value! <= criterion.value).toBe(false)
        }
      }
      expect(await threshold({ scenarioRef: "candidate", parameterBounds: { parameterRef: "line:11", minimum: 0, maximum: 150000, steps: 3 }, criterion: { id: "cost", operator: "eq", value: 0 } }, "base", binding)).toMatchObject({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
      expect(await comparePlannerPreview({ host, sources, scenarios, planner: port }, { baselineRef: "base", scenario: { baseRef: "missing", operations: [], assumptions: [] } }, binding)).toMatchObject({ status: "unavailable" })
      scenarioRecords.candidate = { result: simulated.value, coverageRef: "coverage-v0", basis, projection: covered.value.baseline, source: refs[0] }
      expect(await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)).toMatchObject({ status: "stale", reason: "scenario-source-or-coverage-changed" })
      coverageMode.scenario = simulated.value.costCoverage
      scenarioRecords.candidate.coverageRef = "coverage-scenario"
      const compared = await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)
      expect(compared).toMatchObject({ status: "ok", value: { comparisonStatus: "conditioned", knownDifference: 12000, completeDifference: null } })
      const withCriterion = await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: ["cost"] }, binding)
      expect(withCriterion).toMatchObject({ status: "ok", value: { comparisonStatus: "conditioned", criterionResults: [{ criterionId: "cost", state: "unknown" }] } })
      delete scenarioRecords.candidate
      expect(await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)).toMatchObject({ status: "unavailable" })
    }
  }
  expect(storage.state.planner).toEqual(before)
  const fresh = { value: true }
  const evidence: BusinessContextService = { resolve: async (ref) => ({ state: fresh.value ? "fresh" : "revoked", ref, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }), context: async () => [], recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
  const november = { start: "2027-11-01", end: "2027-11-30" }
  const sourced = createPlannerPort({ host, sources, evidence, scenarioInputs: { verifyAssumption: async () => ({ status: "ok", value: { fingerprint: "confirmed-scope" } }), resolveAmount: async () => ({ status: "ok", value: { amount: 124000, currency: "USD", period: november, source: { surface: "planner", type: "planner-version", id: "v0", incarnation: refs[0].target.incarnation, version: 1, fields: ["summary"], period: november, observedAt: "2026-11-13T00:00:00Z" }, evidence: refs[0] } }) } })
  const sourcedRequest = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", replacementRef: "amount-ref" }], assumptions: [{ id: "source", value: 1, evidenceRefs: [refs[0]], state: "confirmed" as const }] }
  const sourcedResult = await sourced.simulateScenario(sourcedRequest, binding)
  expect(sourcedResult).toMatchObject({ status: "ok", value: { knownSubtotal: 602000, comparisonStatus: "conditioned" } })
  fresh.value = false
  expect(await sourced.simulateScenario(sourcedRequest, binding)).toMatchObject({ status: "stale", reason: "scenario-evidence-not-current" })
  expect(await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "defer", targetRef: "line:11" }], assumptions: [] }, binding)).toMatchObject({ status: "needs-input" })
  expect(storage.state.planner).toEqual(before)
  expect(await port.simulateScenario({ baseRef: "v0", operations: [], assumptions: [{ id: "unproven", value: 1, evidenceRefs: [], state: "confirmed" }] }, binding)).toMatchObject({ status: "needs-input", reason: "confirmed-assumption-needs-evidence" })
  const validAssessment = assessments[0]
  assessments[0] = { ...validAssessment, evaluatedSourceRefs: [] }
  expect(await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000 }], assumptions: [] }, binding)).toMatchObject({ status: "needs-input", reason: "coverage-source-mismatch" })
  assessments[0] = validAssessment
  coverageMode.available = false
  const versions = storage.state.planner.data.versions as { lines: { f: (number | null)[] }[] }[]
  versions[1].lines[0].f[10] = 1
  expect(await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)).toMatchObject({ status: "stale" })
  const modified = storage.state.planner.data.versions as { lines: { cur: string }[]; fx: unknown[] }[]
  modified[1].lines[0].cur = "EUR"
  modified[1].fx = [{ id: "EUR", cur: "EUR", rate: null }]
  const current = projectPlannerSource(storage.state.planner, actor, "v1")!
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: current })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const unknownFx = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(unknownFx.status).toBe("ok")
  if (unknownFx.status === "ok") {
    expect(unknownFx.value.knownDifference).toBeNull()
    expect(unknownFx.value.candidate.missing.some((entry) => entry.reason === "missing-fx")).toBe(true)
    expect(unknownFx.value.candidate.components.every((component) => component.amount === null && component.evidenceState === "absent")).toBe(true)
    expect(unknownFx.value.candidate.values.find((value) => value.id === "month:1:budget")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(unknownFx.value.candidate.values.find((value) => value.id === "line:1:budget-usd")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(unknownFx.value.candidate.values.find((value) => value.id === "fx:EUR")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(unknownFx.value.candidate.values.find((value) => value.id === "line:1:variance-usd")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(unknownFx.value.candidate.values.find((value) => value.id === "month:1:outlook")).toMatchObject({ value: null, evidenceState: "absent" })
  }
  modified[1].lines[0].cur = "eur"
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const lowercaseFx = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(lowercaseFx.status).toBe("ok")
  if (lowercaseFx.status === "ok") expect(lowercaseFx.value.candidate.values.find((value) => value.id === "line:1:budget-usd")).toMatchObject({ value: null, evidenceState: "absent" })
  modified[1].lines[0].cur = "EUR"
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  coverageMode.available = true
  const scenarioWithoutFx = await port.simulateScenario({ baseRef: "v1", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "EUR" }], assumptions: [] }, binding)
  expect(scenarioWithoutFx.status).toBe("ok")
  if (scenarioWithoutFx.status === "ok") expect(scenarioWithoutFx.value.components[10]).toMatchObject({ amount: null, evidenceState: "absent" })
  coverageMode.available = false
  modified[1].fx = [{ id: "EUR", cur: "EUR", rate: 2 }]
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const knownFx = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(knownFx.status).toBe("ok")
  if (knownFx.status === "ok") {
    expect(knownFx.value.candidate.values.find((value) => value.id === "month:1:budget")).toMatchObject({ value: 80000, currency: "USD", evidenceState: "confirmed" })
    expect(knownFx.value.candidate.values.find((value) => value.id === "line:1:budget")).toMatchObject({ value: 40000, currency: "EUR" })
    expect(knownFx.value.candidate.values.find((value) => value.id === "line:1:budget-usd")).toMatchObject({ value: 80000, currency: "USD", evidenceState: "confirmed" })
    expect(knownFx.value.candidate.values.find((value) => value.id === "fx:EUR")).toMatchObject({ value: 2, unit: "USD/EUR", evidenceState: "confirmed" })
    expect(plannerOperationUnits({ projection: knownFx.value.candidate, source: refs[1], operation: { kind: "replace", targetRef: "line:11", amount: 124000, currency: "EUR" } })).toMatchObject({ parameterUnit: "EUR", resultUnit: "USD" })
    expect(knownFx.value.candidate.values.find((value) => value.id === "month:1:actual")).toMatchObject({ value: 80000, currency: "USD", evidenceState: "confirmed" })
    expect(knownFx.value.candidate.values.find((value) => value.id === "month:10:outlook")).toMatchObject({ value: 76000, currency: "USD", evidenceState: "confirmed" })
  }
  modified[1].lines[0].cur = "USD"
  const actual = storage.state.planner.data.versions as { lines: { a: (number | null)[] }[] }[]
  actual[1].lines[0].a[0] = null
  actual[1].lines[0].a[1] = 0
  const missingActualProjection = projectPlannerSource(storage.state.planner, actor, "v1")!
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: missingActualProjection })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const missingActual = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(missingActual.status).toBe("ok")
  if (missingActual.status === "ok") {
    expect(missingActual.value.candidate.components[0]).toMatchObject({ amount: null, evidenceState: "absent" })
    expect(comparePlannerVersions(missingActual.value.baseline, missingActual.value.candidate).rows.find((row) => row.id === "line:1")).toMatchObject({ difference: null })
    expect(missingActual.value.candidate.components[1]).toMatchObject({ amount: 0, evidenceState: "confirmed" })
    expect(missingActual.value.candidate.components[2].amount).toBe(45000)
    expect(missingActual.value.candidate.values.find((value) => value.id === "month:1:actual")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(missingActual.value.candidate.values.find((value) => value.id === "month:2:actual")).toMatchObject({ value: 0, evidenceState: "confirmed" })
    expect(missingActual.value.candidate.values.find((value) => value.id === "month:2:outlook")).toMatchObject({ value: 0, evidenceState: "confirmed" })
  }
  versions[1].lines[0].f[9] = null
  versions[1].lines[0].f[10] = 0
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const fallback = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(fallback.status).toBe("ok")
  if (fallback.status === "ok") {
    expect(fallback.value.candidate.values.find((value) => value.id === "month:10:outlook")).toMatchObject({ value: 50000, evidenceState: "estimated" })
    expect(fallback.value.candidate.values.find((value) => value.id === "month:11:outlook")).toMatchObject({ value: 0, evidenceState: "confirmed" })
  }
  const people = storage.state.planner.data.versions as { hc: { positions: { id: string; include: boolean; fte: number; start: number; end: number; type: string }[] } }[]
  people[1].hc.positions = [{ id: "position", include: true, fte: 0.5, start: 1, end: 3, type: "Employee" }]
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const fte = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(fte.status).toBe("ok")
  if (fte.status === "ok") {
    expect(fte.value.candidate.values.find((value) => value.id === "month:1:fte")).toMatchObject({ value: 0.5, unit: "fte", evidenceState: "confirmed" })
    expect(fte.value.candidate.values.find((value) => value.id === "month:4:fte")).toMatchObject({ value: 0, unit: "fte", evidenceState: "confirmed" })
    expect(plannerCapacityPresentation(fte.value.candidate).series.map((series) => series.role)).toEqual(["fte", "cost"])
    expect(plannerCapacityPresentation(fte.value.candidate).series[0].alignmentKeys).toEqual(plannerCapacityPresentation(fte.value.candidate).series[1].alignmentKeys)
    expect(fte.value.candidate.values.find((value) => value.id === "month:1:hr-budget")).toMatchObject({ value: null, evidenceState: "absent" })
  }
  delete (people[1].hc.positions[0] as { fte?: number }).fte
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const missingFte = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(missingFte.status).toBe("ok")
  if (missingFte.status === "ok") expect(missingFte.value.candidate.values.find((value) => value.id === "month:1:fte")).toMatchObject({ value: null, evidenceState: "absent" })
  people[1].hc.positions = []
  const collision = storage.state.planner.data.versions as { lines: { id: string }[] }[]
  collision[1].lines[0].id = "month"
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const collidingName = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(collidingName.status).toBe("ok")
  if (collidingName.status === "ok") {
    expect(collidingName.value.candidate.values.find((value) => value.id === "month~:1:budget")).toMatchObject({ value: 40000 })
    expect(plannerMonthlyPresentation(collidingName.value.candidate).series[0].valueIds[0]).toBe("month~:1:budget")
  }
  collision[1].lines[0].id = "line"
  delete (modified[1].lines[0] as { cur?: string }).cur
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: projectPlannerSource(storage.state.planner, actor, "v1")! })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const currencyless = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(currencyless.status).toBe("ok")
  if (currencyless.status === "ok") {
    expect(currencyless.value.candidate.values.find((value) => value.id === "line:11:currency-declared")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(plannerOperationUnits({ projection: currencyless.value.candidate, source: refs[1], operation: { kind: "replace", targetRef: "line:11", amount: 1, currency: "USD" } })).toBeUndefined()
  }
})
