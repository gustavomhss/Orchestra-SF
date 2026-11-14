import type { Snapshot } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { BiViewRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPlannerScenarioBiHost } from "../../../product/planner/scenario-bi.ts"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { bindStoredScenarioBiPort } from "../../../product/analytics/scenario.ts"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { sameBiProjection } from "../../../product/analytics/projection.ts"
import { plannerAt, plannerFixture, plannerPeriod } from "./planner-fixture.ts"

export async function scenarioBiFixture(options: { training?: number | null; missingFx?: boolean; defer?: boolean } = {}) {
  const line = (id: string, amount: number | null, currency = "USD") => ({ id, sec: "opex", el: "licenses", cur: currency, b: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0), a: Array(12).fill(null), f: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0) })
  const version = (id: string, lines: ReturnType<typeof line>[], currency = "USD") => ({ id, year: 2027, closed: 0, lines, fx: currency === "USD" ? [] : [{ id: "EUR", cur: "EUR", rate: null }], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
  const currency = options.missingFx ? "EUR" : "USD"
  const initial: Snapshot = { data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [version("renewal", [line("renewal", 240000)]), version("transition", [line("bridge", 60000, currency), line("implementation", 45000, currency), line("new-service", 105000, currency), ...(options.training === undefined ? [] : [line("training", options.training, currency)])], currency)] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const fixture = await plannerFixture(initial)
  try {
    // Planner bootstrap initializes its surface. C08 state and the protected
    // cross-surface read need the remaining canonical source registries too.
    for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
    const payload: BiViewRequest = { viewId: "BI09", selectionRef: "scenario-bi-selection", period: plannerPeriod }
    const context = await fixture.admit("sf_bi_view", payload, "finance", true)
    const baselineId = options.defer ? "transition" : "renewal"
    const records: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
    for (const id of [...new Set([baselineId, "transition"])]) {
      const issued = await fixture.issueSource(id, context)
      if (issued.status !== "ok") throw new Error(`Source issue failed: ${issued.status}`)
      records.push(issued.value.evidence)
    }
    const refFor = (id: string) => records.find((ref) => ref.target.recordId === id)!
    const basis: CostCoverageBasis = { id: "scenario-bi-coverage", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: records }
    const assessment = (alternativeId: string, source: BusinessEvidenceRef): CostCoverageAssessment => ({ basisId: basis.id, basisVersion: basis.version, alternativeId, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [source], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "Human cost classification not supplied" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"] })
    const coverages = new Map<string, CostCoverageAssessment>()
    for (const source of records) coverages.set(source.refId, assessment(source.target.recordId, source))
    const sources: PlannerSourceHost = { resolveForecastSource: fixture.sources.resolveForecastSource, resolveForecastCoverage: async (reference, binding) => {
      const value = coverages.get(reference)
      if (!value) return { status: "unavailable", reason: "coverage-unavailable" }
      for (const source of value.evaluatedSourceRefs) {
        const current = await fixture.sources.resolveForecastSource(source.refId, binding)
        if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(source)) return { status: "stale", reason: "coverage-source-changed" }
      }
      return { status: "ok", value: { coverageRef: reference, basis, assessment: value } }
    } }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const baselineRequest: ScenarioRequest = { baseRef: refFor(baselineId).refId, operations: [], assumptions: [] }
    const candidateRequest: ScenarioRequest = { baseRef: refFor("transition").refId, operations: options.defer ? [{ kind: "defer", targetRef: "implementation:11", period: { start: "2027-12-01", end: "2027-12-31" } }] : [], assumptions: [] }
    const base = await planner.simulateScenario(baselineRequest, context), next = await planner.simulateScenario(candidateRequest, context)
    if (base.status !== "ok" || next.status !== "ok") throw new Error(`Planner failed: ${JSON.stringify({ base, next })}`)
    // Bind the case's alternative identity without changing any value or coverage state.
    const bindAlternative = (result: ScenarioResult, alternativeId: string): ScenarioResult => result.comparisonStatus === "complete" ? { ...result, costCoverage: { ...result.costCoverage, alternativeId } } : { ...result, costCoverage: { ...result.costCoverage, alternativeId } }
    const baseline = bindAlternative(base.value, "baseline")
    const candidate = bindAlternative(next.value, "candidate")
    coverages.set("case-coverage:baseline", baseline.costCoverage)
    coverages.set("case-coverage:candidate", candidate.costCoverage)
    const caseRef = { id: "scenario-bi-case", incarnation: "scenario-bi-inc", version: 1 }
    const request = fixture.host.requestFor(context)!
    const state = createSfProductState({ persistence: fixture.persistence, createId: () => "scenario-bi-state", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (http) => fixture.access.allowed && http.headers.get("authorization") === "finance" ? { principalRef: "finance", accessRevision: fixture.access.revision, policyVersion: "1" } : undefined })
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Canonical scenario BI", currency: "USD", horizon: plannerPeriod, criteria: [], participants: ["finance"], sourceRefs: records, alternatives: [{ id: "baseline", version: 1, title: "Base", scenario: baselineRequest, result: baseline }, { id: "candidate", version: 1, title: "Candidate", scenario: candidateRequest, result: candidate }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-scenario-bi", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error(`Case seed failed: ${seeded.status}`)
    const verify = async (ref: BusinessEvidenceRef, binding: TrustedDomainContext) => {
      const current = await fixture.sources.resolveForecastSource(ref.refId, binding)
      return current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(ref)
    }
    let sequence = 0
    const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase: async (value, binding) => value.id === caseRef.id && value.incarnation === caseRef.incarnation && value.participants.includes(binding.binding.principalRef), verifySources: async (_value, refs, binding) => {
      for (const ref of refs) if (!await verify(ref, binding)) return false
      return true
    }, createId: () => `scenario-bi-${++sequence}`, now: () => plannerAt })
    const savedBase = await results.write({ kind: "scenario", caseRef, result: baseline, requestDigest: digestSfValue(baselineRequest), sourceRefs: baseline.sourceRefs, idempotencyKey: "baseline" }, context)
    const savedCandidate = await results.write({ kind: "scenario", caseRef, result: candidate, requestDigest: digestSfValue(candidateRequest), sourceRefs: candidate.sourceRefs, idempotencyKey: "candidate" }, context)
    if (savedBase.status !== "ok" || savedCandidate.status !== "ok") throw new Error(`Scenario write failed: ${JSON.stringify({ savedBase, savedCandidate })}`)
    const baselineRef = savedBase.value.resultRef, candidateRef = savedCandidate.value.resultRef
    const evidence: BusinessContextService = { resolve: async (ref, binding) => ({ state: await verify(ref, binding) ? "fresh" : "revoked", ref, accessRevision: binding.binding.accessRevision, checkedAt: plannerAt }), context: async ({ refs }, binding) => Promise.all(refs.map((ref) => evidence.resolve(ref, binding))), recall: async () => [], emitFromLedger: async () => { throw new Error("Unexpected memory write") } }
    const inputs = createPlannerScenarioInputs({ planner, sources, verifyAssumption: async () => ({ status: "unavailable", reason: "unused-assumption" }) })
    const verifyOperations = createPlannerOperationVerifier({ host: fixture.host, planner, sources, scenarioInputs: inputs })
    const cases = createDecisionCasePort({ state, host: fixture.host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => "scenario-bi", authorizeCase: async (value) => value.id === caseRef.id && value.incarnation === caseRef.incarnation, verifyScenarioOperations: async (value, binding) => {
      for (const alternative of value.alternatives) if (!await verifyOperations(alternative.scenario, binding)) return false
      return true
    }, evidence, createId: () => "unused", now: () => plannerAt })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner, coverageRefFor: (_caseRef, alternative) => `case-coverage:${alternative.id}` })
    const comparedPlanner = createPlannerPort({ host: fixture.host, sources, scenarios })
    const compared = await comparedPlanner.compareScenarios({ scenarioRefs: [baselineRef, candidateRef], criteria: [] }, context)
    const inverse = await comparedPlanner.compareScenarios({ scenarioRefs: [candidateRef, baselineRef], criteria: [] }, context)
    if (compared.status !== "ok" || inverse.status !== "ok") throw new Error(`Comparison failed: ${JSON.stringify({ compared, inverse })}`)
    const savedComparison = await results.write({ kind: "comparison", caseRef, result: compared.value, requestDigest: digestSfValue([baselineRef, candidateRef]), sourceRefs: records, idempotencyKey: "comparison" }, context)
    const savedInverse = await results.write({ kind: "comparison", caseRef, result: inverse.value, requestDigest: digestSfValue([candidateRef, baselineRef]), sourceRefs: records, idempotencyKey: "inverse" }, context)
    if (savedComparison.status !== "ok" || savedInverse.status !== "ok") throw new Error("Comparison write failed")
    const selection = { selectionRef: payload.selectionRef, scenarioResultRef: candidateRef, comparisonRef: savedComparison.value.resultRef, advantageComparisonRef: savedInverse.value.resultRef }
    const readCurrent = (binding: TrustedDomainContext) => planner.compareForecast({ baseRef: candidateRequest.baseRef, candidateRef: candidateRequest.baseRef, period: plannerPeriod, currency: "USD" }, binding)
    const readProjection = createStoredScenarioBiProjection({ results, readProjection: async (reference, binding) => {
      if (reference !== selection.selectionRef) return { status: "unavailable", reason: "unknown-selection" }
      const current = await readCurrent(binding)
      return current.status === "ok" ? { status: "ok", value: current.value.candidate } : current
    }, revalidateProjection: async (selected, observed, selectedCase, binding) => {
      const current = await readCurrent(binding)
      return digestSfValue(selected) === digestSfValue(selection) && digestSfValue(selectedCase) === digestSfValue(caseRef) && current.status === "ok" && sameBiProjection(current.value.candidate, observed) && await fixture.host.revalidate(binding)
    } })
    const scenario = bindStoredScenarioBiPort({ readProjection, resolve: async (selected) => selected.selectionRef === selection.selectionRef ? { status: "ok", value: { ...selection, present: () => ({ viewId: selected.viewId === "BI10" ? "BI10" : "BI09", series: [], limitations: [] }) } } : { status: "unavailable", reason: "unknown-selection" }, revalidate: (_selected, binding) => fixture.host.revalidate(binding) })
    const plan = createPlannerScenarioBiHost({ host: fixture.host, results, scenarios, scenario })
    const factory = createSfBiFactory({ authority: fixture.authority, projectedScenario: { views: ["BI09", "BI10"], host: plan } })
    const snapshot = () => fixture.store.transaction("dashboard", async () => ({ commit: false, value: digestSfValue(fixture.store.currentSnapshots!()) }))
    return { ...fixture, payload, context, request, records, sources, planner, cases, state, results, scenarios, scenario, plan, factory, baseline, candidate, baselineRef, candidateRef, comparison: compared.value, inverse: inverse.value, selection, snapshot }
  } catch (error) { await fixture.close(); throw error }
}
