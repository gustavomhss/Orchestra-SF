import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { PortfolioPort } from "../../../product/portfolio/port.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createPortfolioSelectionResolver } from "../../../product/portfolio/selection.ts"
import { createDecisionComparisonService } from "../../../product/decisions/comparison.ts"
import { createDecisionPortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const november = { start: "2027-11-01", end: "2027-11-30" }
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
const initial = (): Snapshot => ({
  data: {
    roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
    versions: [{ id: "v0", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100000), a: Array(12).fill(null), f: [null, null, null, null, null, null, null, null, null, 100000, 112000, 100000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
  },
  versions: {}, sequences: {}, audit: [], notices: [],
})

export async function createWp13SensitivityFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-boundary-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true, historical: false }
  const store = await openLocalStore(directory)
  const cleanup = async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  try {
    const seededPlanner = await store.transaction("planner", async (snapshot) => { snapshot.data = initial().data; return { commit: true, value: true } })
    if (seededPlanner !== true) throw new Error("planner was not seeded")
    const snapshot = initial()
    const projection = projectPlannerSource(snapshot, actor, "v0")!
    const evidenceIdentity: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "v0", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "planner-v0", version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: "v0", projection }) } }
    const evidence = { ...evidenceIdentity, refDigest: digestSfEvidenceRef(evidenceIdentity) }
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [evidence] }
    const sourceCoverage: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: "v0", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [evidence], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending" as const, categoryId, reason: "missing-category" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES] }
    const coverageAccess: { resolve?: PlannerSourceHost["resolveForecastCoverage"] } = {}
    const host: DomainPortHost = { persistence: store, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => request, revalidate: async () => access.allowed }
    const sources: PlannerSourceHost = { resolveForecastSource: async (reference) => reference === "v0" ? { status: "ok", value: { versionId: "v0", evidence } } : { status: "unavailable", reason: "planner-source-unavailable" }, resolveForecastCoverage: async (reference, trusted) => reference === "v0" ? { status: "ok", value: { coverageRef: "source-coverage", basis, assessment: sourceCoverage } } : coverageAccess.resolve ? coverageAccess.resolve(reference, trusted) : { status: "unavailable", reason: "planner-coverage-unavailable" } }
    const planner = createPlannerPort({ host, sources })
    const forecast = await planner.compareForecast({ baseRef: "v0", candidateRef: "v0", period: horizon, currency: "USD" }, context)
    if (forecast.status !== "ok") throw new Error("forecast comparison unavailable")
    const proposalCoverageWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => access.allowed ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined })
    const evidenceService: BusinessContextService = { resolve: async (ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }), context: async ({ refs }) => refs.map((ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected memory") } }
    const scenario = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", amount: 112000, currency: "EUR", period: november }], assumptions: [] }
    const baselineScenario = { ...scenario, operations: [{ ...scenario.operations[0], amount: 100000 }] }
    const selectedPreview = await planner.simulateScenario(scenario, context)
    const baselinePreview = await planner.simulateScenario(baselineScenario, context)
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok" || selectedPreview.value.comparisonStatus !== "conditioned" || baselinePreview.value.comparisonStatus !== "conditioned") throw new Error("expected conditioned Planner previews")
    const selectedResult: ScenarioResult = { ...selectedPreview.value, costCoverage: { ...selectedPreview.value.costCoverage, alternativeId: "selected", alternativeVersion: 1 } }
    const baselineResult: ScenarioResult = { ...baselinePreview.value, costCoverage: { ...baselinePreview.value.costCoverage, alternativeId: "baseline", alternativeVersion: 1 } }
    const decision = { ...caseRef, state: "comparing" as const, objective: "renewal", currency: "USD", horizon, criteria: [{ id: "renewal-difference", description: "Explicit criterion", required: true }], participants: ["finance"], sourceRefs: [evidence], alternatives: [{ id: "selected", version: 1, title: "Selected", scenario, result: selectedResult }, { id: "baseline", version: 1, title: "Baseline", scenario: baselineScenario, result: baselineResult }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seededCase = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "c".repeat(64), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; value.cases.other = { ...decision, id: "other" }; return { commit: true, value: true } })
    if (seededCase.status !== "ok") throw new Error("case was not seeded")
    const ids = { value: 0 }
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.allowed, verifySources: async (_value, refs) => access.allowed && refs.every((ref) => ref.refDigest === evidence.refDigest), createId: () => `decision-result-${++ids.value}`, now: () => "2026-11-13T00:00:00Z" })
    const selectedStored = await results.write({ kind: "scenario", result: selectedResult, caseRef, requestDigest: digestSfValue(scenario), sourceRefs: [evidence], idempotencyKey: "sensitivity-selected" }, context)
    const baselineStored = await results.write({ kind: "scenario", result: baselineResult, caseRef, requestDigest: digestSfValue(baselineScenario), sourceRefs: [evidence], idempotencyKey: "sensitivity-baseline" }, context)
    if (selectedStored.status !== "ok" || baselineStored.status !== "ok") throw new Error("scenarios were not stored")
    const selectedRef = selectedStored.value.resultRef
    const baselineRef = baselineStored.value.resultRef
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => "case-op", authorizeCase: async () => access.allowed, verifyScenarioOperations: async () => access.allowed, evidence: evidenceService, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    coverageAccess.resolve = createDecisionCoverageAccess({ state, host, authorizeCase: async () => access.allowed, verifyEvidence: async () => access.allowed })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
    const ruleOperation = { id: "criterion-op" }
    const rules = createCriterionRuleRegistry({ state, host, authorizeCase: async () => access.allowed, authorizeRule: async () => access.allowed, verifyEvidence: async () => access.allowed, verifySnapshot: () => access.allowed, readMetric: async () => ({ status: "unavailable", reason: "not-needed-for-unit-issuance" }), verifyMetric: async () => access.allowed, operationIdentity: () => ruleOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const issuer = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence: evidenceService, rules })
    const issued = await issuer.issue({ scenarioRef: selectedRef, baselineRef, parameterRef: "line:11" }, context)
    if (issued.status !== "ok") throw new Error("sensitivity units unavailable")
    const registered = await rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "gte", value: 0, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 0, sensitivity: issued.value.units }, context)
    if (registered.status !== "ok") throw new Error("criterion rule was not registered")
    const plannerWithCriteria = createPlannerPort({ host, sources, scenarios, criteria: { evaluate: (input, trusted) => rules.evaluate({ caseRef, ...input }, trusted) } })
    const comparisonOperation = { id: "portfolio-comparison-binding" }
    const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => comparisonOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const compareCases = createDecisionComparisonService({ cases, state, results, planner: plannerWithCriteria, host })
    const selectionOperation = { id: "portfolio-selection" }
    const selection = createDecisionPortfolioSelection({ state, host, compare: compareCases, authorizeCase: async () => access.allowed, authorizeSelection: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => selectionOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const expectedRules = await comparisonBindings.proofs(caseRef, ["renewal-difference"], context)
    if (expectedRules.status !== "ok") throw new Error("comparison rules unavailable")
    const derived = await compareCases({ caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"] }, context)
    if (derived.status !== "ok" || derived.value.request.scenarioRefs[0] !== baselineRef || derived.value.request.scenarioRefs[1] !== selectedRef || derived.value.comparison.baselineResultRef !== baselineRef || derived.value.comparison.alternativeResultRef !== selectedRef) throw new Error("comparison was not bound to the stored scenario refs")
    const storedComparison = await results.write({ kind: "comparison", result: derived.value.comparison, caseRef, requestDigest: digestSfValue(derived.value.request), sourceRefs: [evidence], idempotencyKey: "bound-comparison" }, context)
    if (storedComparison.status !== "ok") throw new Error("comparison was not stored")
    const boundComparison = await comparisonBindings.bind({ caseRef, resultRef: storedComparison.value.resultRef, request: derived.value.request, expectedRules: expectedRules.value }, context)
    if (boundComparison.status !== "ok") throw new Error("comparison was not bound")
    comparisonOperation.id = "portfolio-comparison-binding-analysis"
    const sensitivityBindingOperation = { id: "sensitivity-binding-op" }
    const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => sensitivityBindingOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    let exactCalls = 0
    const evaluate = createPlannerSensitivity({ results, resolve: issuer.resolve, revalidate: issuer.revalidate, preview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted), exactThreshold: async () => { exactCalls += 1; return { status: "ok", value: { value: 110000, evidenceRefs: [evidence] } } }, idempotencyKey: async (digest) => `sensitivity-${digest}` })
    const portfolio: PortfolioPort = { evaluate: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-test" }), sensitivity: evaluate }
    const persistent = createPersistentSensitivityPort({ portfolio, results, bindings, resolveBinding: issuer.resolve, idempotencyKey: async (digest) => `persisted-${digest}` })
    const sensitivityRequest: SensitivityRequest = { scenarioRef: selectedRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
    const saved = await persistent.evaluateAndStore(sensitivityRequest, caseRef, context)
    if (saved.status !== "ok") throw new Error(`sensitivity was not stored: ${saved.reason}`)
    const exact = createPlannerExactThreshold({ units: issuer, preview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted) })
    const portfolioBindingOperation = { id: "portfolio-binding" }
    const analysisRequest = { portfolio: { scope: { horizon, currency: "USD" }, candidateRefs: ["selected"], operations: [], constraints: ["renewal-difference"], priorities: [], explorationLimit: 1 }, candidates: [], scenario, result: selectedResult, costCoverageRefs: [] }
    const selectPortfolio = createPortfolioSelectionResolver({ selection, results, caseFor: async () => ({ status: "ok", value: caseRef }) })
    return { cleanup, results, persistent, saved: saved.value, selectedRef, baselineRef, caseRef, context, request, store, ids, access, evidence, evidenceService, host, sources, planner, plannerWithCriteria, scenarios, cases, state, proposalCoverageWrites, issuer, issued, rules, ruleOperation, comparisonBindings, comparisonRef: storedComparison.value.resultRef, boundComparison: boundComparison.value, bindings, sensitivityRequest, exact, get exactCalls() { return exactCalls }, portfolioBindingOperation, analysisRequest, selectPortfolio, selection, forecastMissingFx: forecast.value.baseline.missing.some((item) => item.reason === "missing-fx"), issuedUnits: issued.value.units, reviseRule: async () => { ruleOperation.id = "criterion-revision"; return rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "gte", value: 1, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 1, sensitivity: issued.value.units }, context) } }
  } catch (error) { await cleanup(); throw error }
}
