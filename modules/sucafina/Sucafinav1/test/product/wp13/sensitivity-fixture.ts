import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, CostCoverageEntry, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { PortfolioPort } from "../../../product/portfolio/port.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createDecisionBaselineCoverage } from "../../../product/decisions/baseline-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createPortfolioSelectionResolver } from "../../../product/portfolio/selection.ts"
import { createDecisionComparisonService } from "../../../product/decisions/comparison.ts"
import { createDecisionPortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
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
type FixtureOptions = { renewal?: { training?: 40000 } }
const initial = (options: FixtureOptions): Snapshot => ({
  data: {
    roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
    versions: [{ id: "v0", year: 2027, closed: 9, lines: options.renewal ? ["service", "implementation", "migration", ...(options.renewal.training === undefined ? [] : ["training"])].map((id) => ({ id, sec: "opex", el: "licenses", cur: "USD", b: Array.from({ length: 12 }, (_, month) => id === "service" && month === 10 ? 240000 : 0), a: Array(12).fill(0), f: Array(12).fill(null) })) : [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100000), a: Array(12).fill(null), f: [null, null, null, null, null, null, null, null, null, 100000, 112000, 100000] }], fx: options.renewal ? [] : [{ id: "EUR", cur: "EUR", rate: null }], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
  },
  versions: {}, sequences: {}, audit: [], notices: [],
})

/** Seed only the real Planner scenarios and their durable case/result evidence. */
export async function createWp13PortfolioFixture(options: FixtureOptions = {}) {
  const started = Date.now()
  const stage = (name: string) => process.stderr.write(`SF_WP13_FIXTURE_STAGE:${name}:elapsedMs=${Date.now() - started}\n`)
  stage("base-start")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-boundary-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true, historical: false }
  const store = await openLocalStore(directory)
  const cleanup = async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  try {
    const seededPlanner = await store.transaction("planner", async (snapshot) => { snapshot.data = initial(options).data; return { commit: true, value: true } })
    if (seededPlanner !== true) throw new Error("planner was not seeded")
    const snapshot = initial(options)
    const projection = projectPlannerSource(snapshot, actor, "v0")!
    const evidenceIdentity: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "v0", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "planner-v0", version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: "v0", projection }) } }
    const evidence = { ...evidenceIdentity, refDigest: digestSfEvidenceRef(evidenceIdentity) }
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [evidence] }
    let sourceCoverage: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: "v0", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [evidence], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending" as const, categoryId, reason: "missing-category" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES] }
    const coverageAccess: { resolve?: PlannerSourceHost["resolveForecastCoverage"]; baseline?: PlannerSourceHost["resolveForecastCoverage"] } = {}
    const host: DomainPortHost = { persistence: store, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => request, revalidate: async () => access.allowed }
    const sources: PlannerSourceHost = { resolveForecastSource: async (reference) => reference === "v0" ? { status: "ok", value: { versionId: "v0", evidence } } : { status: "unavailable", reason: "planner-source-unavailable" }, resolveForecastCoverage: async (reference, trusted) => reference === "v0" ? coverageAccess.baseline ? coverageAccess.baseline(reference, trusted) : { status: "ok", value: { coverageRef: "source-coverage", basis, assessment: sourceCoverage } } : coverageAccess.resolve ? coverageAccess.resolve(reference, trusted) : { status: "unavailable", reason: "planner-coverage-unavailable" } }
    const planner = createPlannerPort({ host, sources })
    const forecast = await planner.compareForecast({ baseRef: "v0", candidateRef: "v0", period: horizon, currency: "USD" }, context)
    if (forecast.status !== "ok") throw new Error("forecast comparison unavailable")
    const classify = (result: Pick<ScenarioResult, "components">, alternativeId: string, baseline: boolean): CostCoverageAssessment => {
      // Category assignments are explicit fixture inputs. Amounts come only from Planner components.
      const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.flatMap((categoryId): CostCoverageEntry[] => {
        if (categoryId === "training" && !baseline && options.renewal?.training === undefined) return []
        const componentPrefix = categoryId === "training" && baseline ? "service" : categoryId
        const componentRefs = result.components.filter((component) => component.id.startsWith(`${componentPrefix}:`) || baseline && categoryId === "training" && component.id.startsWith("training:")).map((component) => component.id)
        return componentRefs.length ? [{ status: "included", categoryId, componentRefs, evidenceRefs: [evidence], scopeNote: `Reviewed fixture scope for ${categoryId}; each priced component is counted by Planner once.` }] : [{ status: "not-applicable", categoryId, justification: `Reviewed fixture supply explicitly excludes ${categoryId}.`, evidenceRefs: [evidence] }]
      })
      const classification = classifyCoverage({ caseRef, source: evidence, basis, entries, expectedVersion: 0 }, { ...forecast.value.baseline, components: result.components }, 1)
      return assessCostCoverage({ basis, alternativeId, alternativeVersion: 1, currency: "USD", horizon, entries, components: result.components, evidence: [{ state: "fresh", ref: evidence, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }], supports: (entry, resolutions) => supportsCoverageClassification(classification, entry, resolutions) })
    }
    if (options.renewal) sourceCoverage = classify(forecast.value.baseline, "v0", true)
    const proposalCoverageWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => access.allowed ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined })
    const evidenceService: BusinessContextService = { resolve: async (ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }), context: async ({ refs }) => refs.map((ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected memory") } }
    const parameterRef = options.renewal ? "implementation:11" : "line:11"
    const criterion = { id: "renewal-difference", operator: options.renewal ? "lte" as const : "gte" as const, value: options.renewal ? -20000 : 0 }
    const scenario: ScenarioRequest = options.renewal ? { baseRef: "v0", operations: [{ kind: "replace", targetRef: "service:11", amount: 150000, currency: "USD", period: november }, { kind: "replace", targetRef: "implementation:11", amount: 45000, currency: "USD", period: november }, { kind: "replace", targetRef: "migration:11", amount: 15000, currency: "USD", period: november }, ...(options.renewal.training === undefined ? [] : [{ kind: "replace" as const, targetRef: "training:11", amount: options.renewal.training, currency: "USD", period: november }])], assumptions: [] } : { baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 112000, currency: "EUR", period: november }], assumptions: [] }
    const baselineScenario: ScenarioRequest = options.renewal ? { baseRef: "v0", operations: [{ kind: "replace", targetRef: "service:11", amount: 240000, currency: "USD", period: november }], assumptions: [] } : { ...scenario, operations: [{ ...scenario.operations[0]!, amount: 100000 }] }
    const selectedPreview = await planner.simulateScenario(scenario, context)
    const baselinePreview = await planner.simulateScenario(baselineScenario, context)
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok") throw new Error(`Planner preview rejected: selected=${selectedPreview.status === "ok" ? "ok" : selectedPreview.reason}, baseline=${baselinePreview.status === "ok" ? "ok" : baselinePreview.reason}`)
    if (selectedPreview.value.comparisonStatus !== "conditioned" || baselinePreview.value.comparisonStatus !== "conditioned") throw new Error("expected conditioned Planner previews")
    const selectedResult: ScenarioResult = { ...selectedPreview.value, costCoverage: options.renewal ? classify(selectedPreview.value, "selected", false) : { ...selectedPreview.value.costCoverage, alternativeId: "selected", alternativeVersion: 1 } }
    const baselineResult: ScenarioResult = { ...baselinePreview.value, costCoverage: options.renewal ? classify(baselinePreview.value, "baseline", true) : { ...baselinePreview.value.costCoverage, alternativeId: "baseline", alternativeVersion: 1 } }
    const decision = { ...caseRef, state: "comparing" as const, objective: "renewal", currency: "USD", horizon, criteria: [{ id: "renewal-difference", description: "Explicit criterion", required: true }], participants: ["finance"], sourceRefs: [evidence], alternatives: [{ id: "selected", version: 1, title: "Selected", scenario, result: selectedResult }, { id: "baseline", version: 1, title: "Baseline", scenario: baselineScenario, result: baselineResult }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seededCase = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "c".repeat(64), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seededCase.status !== "ok") throw new Error("case was not seeded")
    if (options.renewal) {
      const baselineCoverage = createDecisionBaselineCoverage({ state, host, resolveCase: async () => ({ status: "ok", value: caseRef }), authorizeCase: async () => access.allowed, authorizeCoverage: async () => access.allowed, projectForecast: async (reference, _case, trusted) => { const current = await planner.compareForecast({ baseRef: reference, candidateRef: reference, period: horizon, currency: "USD" }, trusted); return current.status === "ok" ? { status: "ok", value: current.value.baseline } : current }, resolveEvidence: (refs, trusted) => evidenceService.context({ refs }, trusted), supports: (entry, resolutions) => sourceCoverage.entries.some((accepted) => digestSfValue(accepted) === digestSfValue(entry)) && entry.evidenceRefs.every((ref) => resolutions.some((resolution) => resolution.state === "fresh" && digestSfValue(resolution.ref) === digestSfValue(ref))), verifySnapshot: (snapshot, request) => { const projection = projectPlannerSource(snapshot, actor, "v0"); return access.allowed && !!projection && digestSfValue({ versionId: "v0", projection }) === request.source.target.projectionDigest }, operationIdentity: () => "renewal-baseline-coverage", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
      const registeredCoverage = await baselineCoverage.register({ caseRef, source: evidence, basis, entries: sourceCoverage.entries, expectedVersion: 0 }, context)
      if (registeredCoverage.status !== "ok") throw new Error(`baseline coverage was not persisted: ${registeredCoverage.reason}`)
      coverageAccess.baseline = baselineCoverage.resolveForecastCoverage
    }
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
    const preview = (request: Parameters<typeof comparePlannerPreview>[1], trusted: Parameters<typeof comparePlannerPreview>[2]) => comparePlannerPreview({ host, sources, scenarios, planner }, request, trusted)
    const analysisRequest = { portfolio: { scope: { horizon, currency: "USD" }, candidateRefs: ["selected"], operations: [], constraints: ["renewal-difference"], priorities: [], explorationLimit: 1 }, candidates: [], scenario, result: selectedResult, costCoverageRefs: [] }
    stage("base-ready")
    return { cleanup, directory, stage, scenario, baselineScenario, selectedResult, baselineResult, results, selectedRef, baselineRef, caseRef, context, request, store, ids, access, evidence, evidenceService, host, sources, planner, scenarios, cases, state, proposalCoverageWrites, parameterRef, criterion, analysisRequest, preview, classifyFixtureCoverage: classify, forecastMissingFx: forecast.value.baseline.missing.some((item) => item.reason === "missing-fx") }
  } catch (error) { await cleanup(); throw error }
}

/** Add the real rule, unit issuer and comparison services, without calculating unused results. */
export async function createWp13AnalysisFixture(options: FixtureOptions = {}) {
  const world = await createWp13PortfolioFixture(options)
  const { state, host, access, proposalCoverageWrites, evidenceService, results, cases, scenarios, selectedRef, baselineRef, caseRef, context, parameterRef, criterion, evidence, planner, sources, preview } = world
  try {
    world.stage("criteria-start")
    const ruleOperation = { id: "criterion-op" }
    let metric: ReturnType<typeof createPlannerCriterionMetric> | undefined
    const rules = createCriterionRuleRegistry({ state, host, authorizeCase: async () => access.allowed, authorizeRule: async () => access.allowed, verifyEvidence: async () => access.allowed, verifySnapshot: () => access.allowed, readMetric: async (request, trusted) => metric ? metric(request, trusted) : { status: "unavailable", reason: "not-needed-for-unit-issuance" }, verifyMetric: async () => access.allowed, operationIdentity: () => ruleOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const issuer = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence: evidenceService, rules })
    const issued = await issuer.issue({ scenarioRef: selectedRef, baselineRef, parameterRef }, context)
    if (issued.status !== "ok") throw new Error("sensitivity units unavailable")
    const registered = await rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: criterion.operator, value: criterion.value, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 0, sensitivity: issued.value.units }, context)
    if (registered.status !== "ok") throw new Error("criterion rule was not registered")
    if (options.renewal) metric = createPlannerCriterionMetric({ host, rules, units: issuer, preview })
    const plannerWithCriteria = createPlannerPort({ host, sources, scenarios, criteria: { evaluate: (input, trusted) => rules.evaluate({ caseRef, ...input }, trusted) } })
    const comparisonOperation = { id: "portfolio-comparison-binding" }
    const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => comparisonOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const compareCases = createDecisionComparisonService({ cases, state, results, planner: plannerWithCriteria, host })
    const selectionOperation = { id: "portfolio-selection" }
    const selection = createDecisionPortfolioSelection({ state, host, compare: compareCases, authorizeCase: async () => access.allowed, authorizeSelection: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => selectionOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const portfolioBindingOperation = { id: "portfolio-binding" }
    const selectPortfolio = createPortfolioSelectionResolver({ selection, results, caseFor: async () => ({ status: "ok", value: caseRef }) })
    world.stage("criteria-ready")
    return { ...world, plannerWithCriteria, issuer, issued, rules, ruleOperation, comparisonBindings, portfolioBindingOperation, selectPortfolio, selection, issuedUnits: issued.value.units, reviseRule: async () => { ruleOperation.id = "criterion-revision"; return rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: criterion.operator, value: criterion.value + 1, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 1, sensitivity: issued.value.units }, context) } }
  } catch (error) { await world.cleanup(); throw error }
}

/** Compose real sensitivity services without performing an unrelated positive calculation first. */
export async function createWp13SensitivityRuntimeFixture(options: FixtureOptions = {}) {
  const world = await createWp13AnalysisFixture(options)
  const { state, host, access, rules, results, proposalCoverageWrites, issuer, preview, selectedRef, parameterRef, criterion } = world
  const sensitivityBindingOperation = { id: "sensitivity-binding-op" }
  const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => sensitivityBindingOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
  const exact = createPlannerExactThreshold({ units: issuer, preview })
  let exactCalls = 0
  const evaluate = createPlannerSensitivity({ results, resolve: issuer.resolve, revalidate: issuer.revalidate, preview, exactThreshold: async (request, binding, trusted) => { exactCalls += 1; return exact(request, binding.baselineRef, trusted) }, idempotencyKey: async (digest) => `sensitivity-${digest}` })
  const portfolio: PortfolioPort = { evaluate: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-test" }), sensitivity: evaluate }
  const persistent = createPersistentSensitivityPort({ portfolio, results, bindings, resolveBinding: issuer.resolve, idempotencyKey: async (digest) => `persisted-${digest}` })
  const sensitivityRequest: SensitivityRequest = { scenarioRef: selectedRef, parameterBounds: { parameterRef, minimum: options.renewal ? 0 : 100000, maximum: options.renewal ? 100000 : 120000, steps: 2 }, criterion }
  return { ...world, evaluate, persistent, bindings, sensitivityRequest, exact, get exactCalls() { return exactCalls } }
}

/** The positive fixture deliberately computes and persists the requested real sensitivity. */
export async function createWp13SensitivityFixture(options: FixtureOptions = {}) {
  const world = await createWp13SensitivityRuntimeFixture(options)
  try {
    world.stage("sensitivity-start")
    const saved = await world.persistent.evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)
    if (saved.status !== "ok") throw new Error(`sensitivity was not stored: ${saved.reason}`)
    world.stage("sensitivity-ready")
    return { ...world, saved: saved.value, get exactCalls() { return world.exactCalls } }
  } catch (error) { await world.cleanup(); throw error }
}
