import { expect, test } from "bun:test"
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
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPortfolioSelectionResolver } from "../../../product/portfolio/selection.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createDecisionComparisonService } from "../../../product/decisions/comparison.ts"
import { createDecisionPortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createPortfolioResultBindings } from "../../../product/decisions/portfolio-bindings.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPortfolioProofVerifier } from "../../../product/portfolio/verification.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createPortfolioProduct } from "../../../product/portfolio/product.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
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

test("real Planner sensitivity keeps EUR input separate from USD output and leaves missing FX conditioned in C08", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-boundary-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true, historical: false }
  const store = await openLocalStore(directory)
  try {
    const seededPlanner = await store.transaction("planner", async (snapshot) => {
      snapshot.data = initial().data
      return { commit: true, value: true }
    })
    expect(seededPlanner).toBe(true)
    const snapshot = initial()
    const projection = projectPlannerSource(snapshot, actor, "v0")!
    const evidenceIdentity: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "v0", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "planner-v0", version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: "v0", projection }) } }
    const evidence = { ...evidenceIdentity, refDigest: digestSfEvidenceRef(evidenceIdentity) }
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [evidence] }
    const sourceCoverage: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: "v0", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [evidence], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending" as const, categoryId, reason: "missing-category" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES] }
    const coverageAccess: { resolve?: PlannerSourceHost["resolveForecastCoverage"] } = {}
    const host: DomainPortHost = {
      persistence: store,
      authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"),
      environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }),
      requestFor: () => request,
      revalidate: async () => access.allowed,
    }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference) => reference === "v0" ? { status: "ok", value: { versionId: "v0", evidence } } : { status: "unavailable", reason: "planner-source-unavailable" },
      resolveForecastCoverage: async (reference, trusted) => reference === "v0"
        ? { status: "ok", value: { coverageRef: "source-coverage", basis, assessment: sourceCoverage } }
        : coverageAccess.resolve ? coverageAccess.resolve(reference, trusted) : { status: "unavailable", reason: "planner-coverage-unavailable" },
    }
    const planner = createPlannerPort({ host, sources })
    const comparison = await planner.compareForecast({ baseRef: "v0", candidateRef: "v0", period: horizon, currency: "USD" }, context)
    expect(comparison.status).toBe("ok")
    if (comparison.status !== "ok") return
    expect(comparison.value.baseline.missing.some((item) => item.reason === "missing-fx")).toBe(true)
    const proposalCoverageWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => access.allowed ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined })
    const evidenceService: BusinessContextService = { resolve: async (ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }), context: async ({ refs }) => refs.map((ref) => ({ state: access.allowed ? access.historical ? "historical" : "fresh" : "revoked", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected memory") } }
    const scenario = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", amount: 112000, currency: "EUR", period: november }], assumptions: [] }
    const baselineScenario = { ...scenario, operations: [{ ...scenario.operations[0], amount: 100000 }] }
    const selectedPreview = await planner.simulateScenario(scenario, context)
    const baselinePreview = await planner.simulateScenario(baselineScenario, context)
    expect(selectedPreview).toMatchObject({ status: "ok" })
    expect(baselinePreview.status).toBe("ok")
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok") return
    if (selectedPreview.value.comparisonStatus !== "conditioned" || baselinePreview.value.comparisonStatus !== "conditioned") throw new Error("expected conditioned Planner previews")
    const selectedResult: ScenarioResult = { ...selectedPreview.value, costCoverage: { ...selectedPreview.value.costCoverage, alternativeId: "selected", alternativeVersion: 1 } }
    const baselineResult: ScenarioResult = { ...baselinePreview.value, costCoverage: { ...baselinePreview.value.costCoverage, alternativeId: "baseline", alternativeVersion: 1 } }
    const decision = { ...caseRef, state: "comparing" as const, objective: "renewal", currency: "USD", horizon, criteria: [{ id: "renewal-difference", description: "Explicit criterion", required: true }], participants: ["finance"], sourceRefs: [evidence], alternatives: [{ id: "selected", version: 1, title: "Selected", scenario, result: selectedResult }, { id: "baseline", version: 1, title: "Baseline", scenario: baselineScenario, result: baselineResult }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seededCase = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "c".repeat(64), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; value.cases.other = { ...decision, id: "other" }; return { commit: true, value: true } })
    expect(seededCase.status).toBe("ok")
    const ids = { value: 0 }
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.allowed, verifySources: async (_value, refs) => access.allowed && refs.every((ref) => ref.refDigest === evidence.refDigest), createId: () => `decision-result-${++ids.value}`, now: () => "2026-11-13T00:00:00Z" })
    const selectedStored = await results.write({ kind: "scenario", result: selectedResult, caseRef, requestDigest: digestSfValue(scenario), sourceRefs: [evidence], idempotencyKey: "sensitivity-selected" }, context)
    const baselineStored = await results.write({ kind: "scenario", result: baselineResult, caseRef, requestDigest: digestSfValue(baselineScenario), sourceRefs: [evidence], idempotencyKey: "sensitivity-baseline" }, context)
    expect(selectedStored.status).toBe("ok")
    expect(baselineStored.status).toBe("ok")
    if (selectedStored.status !== "ok" || baselineStored.status !== "ok") return
    const selectedRef = selectedStored.value.resultRef
    const baselineRef = baselineStored.value.resultRef
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => "case-op", authorizeCase: async () => access.allowed, verifyScenarioOperations: async () => access.allowed, evidence: evidenceService, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    coverageAccess.resolve = createDecisionCoverageAccess({ state, host, authorizeCase: async () => access.allowed, verifyEvidence: async () => access.allowed })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
    const ruleOperation = { id: "criterion-op" }
    const rules = createCriterionRuleRegistry({ state, host, authorizeCase: async () => access.allowed, authorizeRule: async () => access.allowed, verifyEvidence: async () => access.allowed, verifySnapshot: () => access.allowed, readMetric: async () => ({ status: "unavailable", reason: "not-needed-for-unit-issuance" }), verifyMetric: async () => access.allowed, operationIdentity: () => ruleOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const issuer = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence: evidenceService, rules })
    const issued = await issuer.issue({ scenarioRef: selectedRef, baselineRef, parameterRef: "line:11" }, context)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    expect(issued.value.units.parameterUnit).toBe("EUR")
    expect(issued.value.units.resultUnit).toBe("USD")
    const registered = await rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "gte", value: 0, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 0, sensitivity: issued.value.units }, context)
    expect(registered.status).toBe("ok")
    const plannerWithCriteria = createPlannerPort({ host, sources, scenarios, criteria: { evaluate: (input, trusted) => rules.evaluate({ caseRef, ...input }, trusted) } })
    const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "portfolio-comparison-binding", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const compareCases = createDecisionComparisonService({ cases, state, results, planner: plannerWithCriteria, host })
    const selection = createDecisionPortfolioSelection({ state, host, compare: compareCases, authorizeCase: async () => access.allowed, authorizeSelection: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "portfolio-selection", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const analysisRequest = { portfolio: { scope: { horizon, currency: "USD" }, candidateRefs: ["selected"], operations: [], constraints: ["renewal-difference"], priorities: [], explorationLimit: 1 }, candidates: [], scenario, result: selectedResult, costCoverageRefs: [] }
    const selectPortfolio = createPortfolioSelectionResolver({ selection, results, caseFor: async () => ({ status: "ok", value: caseRef }) })
    expect(await selectPortfolio(analysisRequest, context)).toEqual({ status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" })
    expect((await selection.register({ caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, context)).status).toBe("ok")
    const analysis = createPortfolioAnalysis({ planner: plannerWithCriteria, results, bindings: comparisonBindings, persist: createPlannerResultPersistence({ store: results, scenarios, comparisonBindings, replay: plannerWithCriteria, resolveCase: async () => ({ status: "ok", value: caseRef }) }), select: selectPortfolio, idempotencyKey: async (digest) => `portfolio-${digest}` })
    const compared = await analysis.evaluate(analysisRequest, context)
    expect(compared.status).toBe("ok")
    if (compared.status !== "ok") return
    expect(compared.value.constraints[0].state).toBe("unknown")
    expect(await analysis.revalidate(compared.value.analysis, context)).toBe(true)
    expect(await analysis.revalidate({ ...compared.value.analysis, scenarioResultRef: baselineRef }, context)).toBe(false)
    expect(await analysis.revalidate({ ...compared.value.analysis, scenario: { ...compared.value.analysis.scenario, knownSubtotal: 1 } }, context)).toBe(false)
    const orphanComparison = await results.write({ kind: "comparison", result: compared.value.analysis.comparison, caseRef, requestDigest: digestSfValue({ scenarioRefs: [baselineRef, selectedRef], criteria: ["renewal-difference"] }), sourceRefs: [evidence], idempotencyKey: "orphan-comparison" }, context)
    expect(orphanComparison.status).toBe("ok")
    if (orphanComparison.status === "ok") expect(await analysis.revalidate({ ...compared.value.analysis, comparisonRef: orphanComparison.value.resultRef }, context)).toBe(false)
    const resolveCandidate = createDecisionCandidateResolver(cases)
    const portfolioBindingOperation = { id: "portfolio-binding" }
    const portfolioBindings = createPortfolioResultBindings({ state, host, results, selection, resolveCandidate, authorizeCase: async () => access.allowed, verifyBinding: async (_binding, value, trusted) => value.kind === "portfolio" && (await Promise.all(value.result.combinations.map((item) => item.analysis ? analysis.revalidate(item.analysis, trusted) : Promise.resolve(true)))).every(Boolean), verifySnapshot: () => access.allowed, operationIdentity: () => portfolioBindingOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const contribution = createProductionPortfolio({ cases, planner, sources, evidence: evidenceService, revalidate: host.revalidate, analysis, candidateCoverageRefFor: async (candidate) => { const ref = parseCaseRef(candidate.caseRef); return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" } }, createReceipt: async () => undefined, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, persistence: { results, portfolioBindings, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `portfolio-result-${digest}` }, enabledOperations: ["sf_portfolio_evaluate"] })
    if (!contribution.persistent) throw new Error("portfolio store unavailable")
    const portfolioRequest = { ...analysisRequest.portfolio, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(caseRef), caseVersion: caseRef.version, alternativeId: "selected", alternativeVersion: 1 })] }
    const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "sensitivity-binding-op", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const product = createPortfolioProduct({ host, cases, evidence: evidenceService, planner: { planner: plannerWithCriteria, sources, scenarios }, results, rules, selection, portfolioBindings, comparisonBindings, sensitivityBindings: bindings, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, createReceipt: async () => undefined, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `portfolio-${digest}` })
    const otherCase = { ...caseRef, id: "other" }
    const productCatalog = await product.http.catalog([otherCase, caseRef], context)
    expect(productCatalog.status === "ok" && productCatalog.value.cases.map((entry) => entry.caseRef)).toEqual([otherCase, caseRef])
    if (productCatalog.status === "ok") expect(new Set(productCatalog.value.cases.map((entry) => entry.alternatives[0].candidateRef)).size).toBe(2)
    access.historical = true
    expect((await product.http.catalog([caseRef], context)).status).toBe("unavailable")
    access.historical = false
    expect((await product.http.preview(portfolioRequest, { ...caseRef, version: 2 }, context)).status).toBe("denied")
    expect((await product.http.preview(portfolioRequest, caseRef, context)).status).toBe("ok")
    const unitsFromHttp = await product.http.sensitivityUnits({ caseRef, scenarioRef: selectedRef, baselineRef, parameterRef: "line:11" }, context)
    expect(unitsFromHttp.status === "ok" && unitsFromHttp.value.units.parameterUnit).toBe("EUR")
    expect((await product.http.sensitivityUnits({ caseRef: { ...caseRef, version: 2 }, scenarioRef: selectedRef, baselineRef, parameterRef: "line:11" }, context)).status).toBe("denied")
    const catalog = await contribution.catalog({ caseRefs: [encodeCaseRef(caseRef)] }, context)
    expect(catalog.status).toBe("ok")
    if (catalog.status === "ok") {
      expect(catalog.value.cases[0].alternatives.some((item) => item.candidateRef === portfolioRequest.candidateRefs[0])).toBe(true)
      expect(catalog.value.parameterBounds.state).toBe("unavailable")
    }
    const portfolioSaved = await contribution.persistent.evaluateAndStore(portfolioRequest, caseRef, context)
    expect(portfolioSaved.status).toBe("ok")
    if (portfolioSaved.status !== "ok") return
    expect(portfolioSaved.value.portfolio.combinations[0].eligibility).toBe("conditioned")
    expect(portfolioSaved.value.portfolio.combinations[0].costCoverageRefs).toContain(decisionCoverageRef(caseRef, "selected", 1))
    expect((await contribution.persistent.read(portfolioSaved.value.portfolioResultRef, context)).status).toBe("ok")
    const listed = await product.http.list(caseRef, context)
    expect(listed.status === "ok" && listed.value.some((item) => item.resultRef === portfolioSaved.value.portfolioResultRef)).toBe(true)
    expect((await product.http.read(portfolioSaved.value.portfolioResultRef, caseRef, context)).status).toBe("ok")
    expect(await contribution.persistent.evaluateAndStore(portfolioRequest, caseRef, context)).toEqual(portfolioSaved)
    portfolioBindingOperation.id = "cross-case-binding"
    const otherCandidate = portfolioCandidateRef({ caseRef: encodeCaseRef(otherCase), caseVersion: otherCase.version, alternativeId: "selected", alternativeVersion: 1 })
    const crossRequest = { ...portfolioRequest, candidateRefs: [...portfolioRequest.candidateRefs, otherCandidate], explorationLimit: 3 }
    const crossSaved = await contribution.persistent.evaluateAndStore(crossRequest, caseRef, context)
    expect(crossSaved.status).toBe("ok")
    if (crossSaved.status !== "ok") return
    expect(crossSaved.value.portfolio.combinations.some((item) => item.conflicts.some((conflict) => conflict.startsWith("duplicate-target:")))).toBe(true)
    const caseState = await state.read(request, "cases", (value) => value.cases.other)
    if (caseState.status !== "ok") throw new Error("case unavailable")
    const changedCase = await state.transaction(request, { namespace: "cases", expectedStorageVersion: caseState.storageVersion, idempotencyKey: "change-other", commandDigest: "d".repeat(64), targetRef: otherCase.id, targetIncarnation: otherCase.incarnation }, async (value) => { value.cases.other = { ...value.cases.other, version: 2 }; return { commit: true, value: true } })
    expect(changedCase.status).toBe("ok")
    expect((await contribution.persistent.read(crossSaved.value.portfolioResultRef, context)).status).toBe("stale")
    let exactCalls = 0
    const evaluate = createPlannerSensitivity({ results, resolve: issuer.resolve, revalidate: issuer.revalidate, preview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted), exactThreshold: async () => { exactCalls++; return { status: "ok", value: { value: 110000, evidenceRefs: [evidence] } } }, idempotencyKey: async (digest) => `sensitivity-${digest}` })
    const portfolio: PortfolioPort = { evaluate: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-test" }), sensitivity: evaluate }
    const persistent = createPersistentSensitivityPort({ portfolio, results, bindings, resolveBinding: issuer.resolve, idempotencyKey: async (digest) => `persisted-${digest}` })
    const sensitivityRequest: SensitivityRequest = { scenarioRef: selectedRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
    const exact = createPlannerExactThreshold({ units: issuer, preview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted) })
    expect(await exact(sensitivityRequest, baselineRef, context)).toEqual({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
    const saved = await persistent.evaluateAndStore(sensitivityRequest, caseRef, context)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    expect(saved.value.sensitivity.parameterUnit).toBe("EUR")
    expect(saved.value.sensitivity.resultUnit).toBe("USD")
    expect(saved.value.sensitivity.unit).toBe("USD")
    expect(saved.value.sensitivity.evaluated.map((point) => point.parameterValue)).toEqual([100000, 110000, 120000])
    expect(saved.value.sensitivity.evaluated.every((point) => point.value === null)).toBe(true)
    expect(saved.value.sensitivity.threshold).toBeNull()
    expect(exactCalls).toBe(0)
    expect(saved.value.sensitivity.thresholdEvidence).toEqual({ state: "unavailable", reason: "sample-value-unavailable" })
    expect(saved.value.sensitivity.costCoverageRefs).toEqual([decisionCoverageRef(caseRef, "baseline", 1), decisionCoverageRef(caseRef, "selected", 1)])
    expect(saved.value.sensitivity.comparisonStatus).toBe("conditioned")
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason.includes("unresolved coverage can change the decision"))).toBe(true)
    expect((await persistent.read(saved.value.sensitivityResultRef, context)).status).toBe("ok")
    const beforeRead = ids.value
    expect((await product.http.readSensitivity(saved.value.sensitivityResultRef, caseRef, context)).status).toBe("ok")
    expect(ids.value).toBe(beforeRead)
    const verifier = createPortfolioProofVerifier({ cases, planner: plannerWithCriteria, sources, evidence: evidenceService, results, revalidate: host.revalidate, readSourceFences: async () => access.allowed ? store.transactionAll(async (snapshots) => ({ commit: false, value: { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) } })) : undefined, lockedSourceFences: () => { const snapshots = store.currentSnapshots?.(); return snapshots ? { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) } : undefined }, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `verify-${digest}`, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, createReceipt: async () => undefined, candidateCoverageRefFor: async (candidate) => { const ref = parseCaseRef(candidate.caseRef); return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" } }, revalidateAnalysis: analysis.revalidate, units: issuer, sensitivityPreview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted) })
    const portfolioProof = await portfolioBindings.read({ caseRef, resultRef: portfolioSaved.value.portfolioResultRef }, context)
    const portfolioRecord = await results.read({ kind: "portfolio", resultRef: portfolioSaved.value.portfolioResultRef }, context)
    const comparisonProof = await comparisonBindings.read({ caseRef, resultRef: compared.value.analysis.comparisonRef }, context)
    const comparisonRecord = await results.read({ kind: "comparison", resultRef: compared.value.analysis.comparisonRef }, context)
    const sensitivityProof = await bindings.read({ caseRef, resultRef: saved.value.sensitivityResultRef }, context)
    const sensitivityRecord = await results.read({ kind: "sensitivity", resultRef: saved.value.sensitivityResultRef }, context)
    if (portfolioProof.status !== "ok" || portfolioRecord.status !== "ok" || comparisonProof.status !== "ok" || comparisonRecord.status !== "ok" || sensitivityProof.status !== "ok" || sensitivityRecord.status !== "ok") throw new Error("proof unavailable")
    const beforeVerification = ids.value
    expect(await verifier.verifyPortfolio(portfolioProof.value, portfolioRecord.value, context)).toBe(true)
    expect(await verifier.verifyComparison(comparisonProof.value, comparisonRecord.value, context)).toBe(true)
    expect(await verifier.verifySensitivity(sensitivityProof.value, sensitivityRecord.value, context)).toBe(true)
    const fence = await store.transactionAll(async (snapshots) => ({ commit: false, value: { current: verifier.verifySnapshot(snapshots.planner, portfolioProof.value, context), changed: verifier.verifySnapshot({ ...snapshots.planner, data: { ...snapshots.planner.data, changed: true } }, portfolioProof.value, context) } }))
    expect(fence).toEqual({ current: true, changed: false })
    expect(ids.value).toBe(beforeVerification)
    expect(await persistent.evaluateAndStore(sensitivityRequest, caseRef, context)).toEqual(saved)
    const orphan = await results.write({ kind: "sensitivity", result: saved.value.sensitivity, caseRef, requestDigest: digestSfValue(sensitivityRequest), sourceRefs: [evidence], idempotencyKey: "orphan" }, context)
    expect(orphan.status).toBe("ok")
    if (orphan.status === "ok") expect((await persistent.read(orphan.value.resultRef, context)).status).toBe("unavailable")
    expect((await issuer.issue({ scenarioRef: selectedRef, baselineRef, parameterRef: "line:10" }, context)).status).toBe("needs-input")
    expect((await issuer.resolve({ ...sensitivityRequest, criterion: { ...sensitivityRequest.criterion, value: 1 } }, context)).status).toBe("needs-input")
    ruleOperation.id = "criterion-revision"
    const revised = await rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "gte", value: 1, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 1, sensitivity: issued.value.units }, context)
    expect(revised.status).toBe("ok")
    expect((await persistent.read(saved.value.sensitivityResultRef, context)).status).toBe("stale")
    expect(await analysis.revalidate(compared.value.analysis, context)).toBe(false)
    expect((await contribution.persistent.read(portfolioSaved.value.portfolioResultRef, context)).status).toBe("stale")
    access.allowed = false
    expect((await contribution.catalog({ caseRefs: [encodeCaseRef(caseRef)] }, context)).status).toBe("denied")
    expect((await persistent.read(saved.value.sensitivityResultRef, context)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
