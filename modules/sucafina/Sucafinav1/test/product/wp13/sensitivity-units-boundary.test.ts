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
    // A registered currency with no rate remains missing FX while allowing canonical forecast edits.
    versions: [{ id: "v0", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100000), a: Array(12).fill(null), f: [null, null, null, null, null, null, null, null, null, 100000, 112000, 100000] }], fx: [{ id: "EUR", cur: "EUR", rate: null }], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
  },
  versions: {}, sequences: {}, audit: [], notices: [],
})

test("real Planner sensitivity keeps EUR input separate from USD output and leaves missing FX conditioned in C08", async () => {
  const fixture = await createUnitsBoundaryFixture()
  try {
    expect(fixture.comparison.value.baseline.missing.some((item) => item.reason === "missing-fx")).toBe(true)
    const units = await fixture.product.http.sensitivityUnits({ caseRef, scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:11" }, fixture.context)
    expect(units.status === "ok" && units.value.units.parameterUnit).toBe("EUR")
    expect((await fixture.product.http.sensitivityUnits({ caseRef: { ...caseRef, version: 2 }, scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:11" }, fixture.context)).status).toBe("denied")
    const calls = { exact: 0 }
    const evaluate = createPlannerSensitivity({ results: fixture.results, resolve: fixture.issuer.resolve, revalidate: fixture.issuer.revalidate, preview: fixture.preview, exactThreshold: async () => { calls.exact++; return { status: "ok", value: { value: 110000, evidenceRefs: [fixture.evidence] } } }, idempotencyKey: async (digest) => `sensitivity-${digest}` })
    const persistent = createPersistentSensitivityPort({ portfolio: { evaluate: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-test" }), sensitivity: evaluate }, results: fixture.results, bindings: fixture.bindings, resolveBinding: fixture.issuer.resolve, idempotencyKey: async (digest) => `persisted-${digest}` })
    const sensitivityRequest: SensitivityRequest = { scenarioRef: fixture.selectedRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
    const exact = createPlannerExactThreshold({ units: fixture.issuer, preview: fixture.preview })
    expect(await exact(sensitivityRequest, fixture.baselineRef, fixture.context)).toEqual({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
    const saved = await persistent.evaluateAndStore(sensitivityRequest, caseRef, fixture.context)
    if (saved.status !== "ok") throw new Error(`Persisted EUR sensitivity unavailable: ${JSON.stringify(saved)}`)
    expect(saved.value.sensitivity.parameterUnit).toBe("EUR")
    expect(saved.value.sensitivity.resultUnit).toBe("USD")
    expect(saved.value.sensitivity.unit).toBe("USD")
    expect(saved.value.sensitivity.evaluated.map((point) => point.parameterValue)).toEqual([100000, 110000, 120000])
    expect(saved.value.sensitivity.evaluated.every((point) => point.value === null)).toBe(true)
    expect(saved.value.sensitivity.threshold).toBeNull()
    expect(calls.exact).toBe(0)
    expect(saved.value.sensitivity.thresholdEvidence).toEqual({ state: "unavailable", reason: "sample-value-unavailable" })
    expect(saved.value.sensitivity.costCoverageRefs).toEqual([decisionCoverageRef(caseRef, "baseline", 1), decisionCoverageRef(caseRef, "selected", 1)])
    expect(saved.value.sensitivity.comparisonStatus).toBe("conditioned")
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason.includes("unresolved coverage can change the decision"))).toBe(true)
    const beforeRead = fixture.ids.value
    expect((await fixture.product.http.readSensitivity(saved.value.sensitivityResultRef, caseRef, fixture.context)).status).toBe("ok")
    expect(fixture.ids.value).toBe(beforeRead)
    const proof = await fixture.bindings.read({ caseRef, resultRef: saved.value.sensitivityResultRef }, fixture.context)
    const record = await fixture.results.read({ kind: "sensitivity", resultRef: saved.value.sensitivityResultRef }, fixture.context)
    if (proof.status !== "ok" || record.status !== "ok") throw new Error("Sensitivity proof unavailable")
    expect(await fixture.verifier.verifySensitivity(proof.value, record.value, fixture.context)).toBe(true)
    expect(fixture.ids.value).toBe(beforeRead)
    expect(await persistent.evaluateAndStore(sensitivityRequest, caseRef, fixture.context)).toEqual(saved)
    const orphan = await fixture.results.write({ kind: "sensitivity", result: saved.value.sensitivity, caseRef, requestDigest: digestSfValue(sensitivityRequest), sourceRefs: [fixture.evidence], idempotencyKey: "orphan" }, fixture.context)
    expect(orphan.status).toBe("ok")
    if (orphan.status === "ok") expect((await persistent.read(orphan.value.resultRef, fixture.context)).status).toBe("unavailable")
    expect((await fixture.issuer.issue({ scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:10" }, fixture.context)).status).toBe("needs-input")
    expect((await fixture.issuer.resolve({ ...sensitivityRequest, criterion: { ...sensitivityRequest.criterion, value: 1 } }, fixture.context)).status).toBe("needs-input")
    expect((await fixture.reviseRule()).status).toBe("ok")
    expect((await persistent.read(saved.value.sensitivityResultRef, fixture.context)).status).toBe("stale")
    fixture.access.allowed = false
    expect((await persistent.read(saved.value.sensitivityResultRef, fixture.context)).status).toBe("denied")
  } finally { await fixture.cleanup() }
}, 120000)

test("real Planner portfolio and comparison stay conditioned with missing FX across persisted HTTP consumers and replay fences", async () => {
  const fixture = await createUnitsBoundaryFixture()
  try {
    expect(await fixture.selectPortfolio(fixture.analysisRequest, fixture.context)).toEqual({ status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" })
    expect((await fixture.selection.register({ caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, fixture.context)).status).toBe("ok")
    const compared = await fixture.analysis.evaluate(fixture.analysisRequest, fixture.context)
    if (compared.status !== "ok") throw new Error(`Real comparison unavailable: ${JSON.stringify(compared)}`)
    expect(compared.value.constraints[0].state).toBe("unknown")
    expect(await fixture.analysis.revalidate(compared.value.analysis, fixture.context)).toBe(true)
    expect(await fixture.analysis.revalidate({ ...compared.value.analysis, scenarioResultRef: fixture.baselineRef }, fixture.context)).toBe(false)
    expect(await fixture.analysis.revalidate({ ...compared.value.analysis, scenario: { ...compared.value.analysis.scenario, knownSubtotal: 1 } }, fixture.context)).toBe(false)
    const orphan = await fixture.results.write({ kind: "comparison", result: compared.value.analysis.comparison, caseRef, requestDigest: digestSfValue({ scenarioRefs: [fixture.baselineRef, fixture.selectedRef], criteria: ["renewal-difference"] }), sourceRefs: [fixture.evidence], idempotencyKey: "orphan-comparison" }, fixture.context)
    expect(orphan.status).toBe("ok")
    if (orphan.status === "ok") expect(await fixture.analysis.revalidate({ ...compared.value.analysis, comparisonRef: orphan.value.resultRef }, fixture.context)).toBe(false)
    const otherCase = { ...caseRef, id: "other" }
    const catalog = await fixture.product.http.catalog([otherCase, caseRef], fixture.context)
    expect(catalog.status === "ok" && catalog.value.cases.map((entry) => entry.caseRef)).toEqual([otherCase, caseRef])
    if (catalog.status === "ok") expect(new Set(catalog.value.cases.map((entry) => entry.alternatives[0].candidateRef)).size).toBe(2)
    fixture.access.historical = true
    expect((await fixture.product.http.catalog([caseRef], fixture.context)).status).toBe("unavailable")
    fixture.access.historical = false
    expect((await fixture.product.http.preview(fixture.portfolioRequest, { ...caseRef, version: 2 }, fixture.context)).status).toBe("denied")
    expect((await fixture.product.http.preview(fixture.portfolioRequest, caseRef, fixture.context)).status).toBe("ok")
    const contributionCatalog = await fixture.contribution.catalog({ caseRefs: [encodeCaseRef(caseRef)] }, fixture.context)
    expect(contributionCatalog.status).toBe("ok")
    if (contributionCatalog.status === "ok") {
      expect(contributionCatalog.value.cases[0].alternatives.some((item) => item.candidateRef === fixture.portfolioRequest.candidateRefs[0])).toBe(true)
      expect(contributionCatalog.value.parameterBounds.state).toBe("unavailable")
    }
    const saved = await fixture.persistentPortfolio.evaluateAndStore(fixture.portfolioRequest, caseRef, fixture.context)
    if (saved.status !== "ok") throw new Error(`Real portfolio unavailable: ${JSON.stringify(saved)}`)
    expect(saved.value.portfolio.combinations[0].eligibility).toBe("conditioned")
    expect(saved.value.portfolio.combinations[0].costCoverageRefs).toContain(decisionCoverageRef(caseRef, "selected", 1))
    const listed = await fixture.product.http.list(caseRef, fixture.context)
    expect(listed.status === "ok" && listed.value.some((item) => item.resultRef === saved.value.portfolioResultRef)).toBe(true)
    expect((await fixture.product.http.read(saved.value.portfolioResultRef, caseRef, fixture.context)).status).toBe("ok")
    expect(await fixture.persistentPortfolio.evaluateAndStore(fixture.portfolioRequest, caseRef, fixture.context)).toEqual(saved)
    const portfolioProof = await fixture.portfolioBindings.read({ caseRef, resultRef: saved.value.portfolioResultRef }, fixture.context)
    const portfolioRecord = await fixture.results.read({ kind: "portfolio", resultRef: saved.value.portfolioResultRef }, fixture.context)
    const comparisonProof = await fixture.comparisonBindings.read({ caseRef, resultRef: compared.value.analysis.comparisonRef }, fixture.context)
    const comparisonRecord = await fixture.results.read({ kind: "comparison", resultRef: compared.value.analysis.comparisonRef }, fixture.context)
    if (portfolioProof.status !== "ok" || portfolioRecord.status !== "ok" || comparisonProof.status !== "ok" || comparisonRecord.status !== "ok") throw new Error("Portfolio/comparison proof unavailable")
    const beforeVerification = fixture.ids.value
    expect(await fixture.verifier.verifyPortfolio(portfolioProof.value, portfolioRecord.value, fixture.context)).toBe(true)
    expect(await fixture.verifier.verifyComparison(comparisonProof.value, comparisonRecord.value, fixture.context)).toBe(true)
    const fence = await fixture.transactionAll(async (snapshots) => ({ commit: false, value: { current: fixture.verifier.verifySnapshot(snapshots.planner, portfolioProof.value, fixture.context), changed: fixture.verifier.verifySnapshot({ ...snapshots.planner, data: { ...snapshots.planner.data, changed: true } }, portfolioProof.value, fixture.context) } }))
    expect(fence).toEqual({ current: true, changed: false })
    expect(fixture.ids.value).toBe(beforeVerification)
    expect((await fixture.reviseRule()).status).toBe("ok")
    expect(await fixture.analysis.revalidate(compared.value.analysis, fixture.context)).toBe(false)
    expect((await fixture.persistentPortfolio.read(saved.value.portfolioResultRef, fixture.context)).status).toBe("stale")
    fixture.access.allowed = false
    expect((await fixture.contribution.catalog({ caseRefs: [encodeCaseRef(caseRef)] }, fixture.context)).status).toBe("denied")
  } finally { await fixture.cleanup() }
}, 120000)

test("real Planner cross-case portfolio retains duplicate targets and becomes stale when the other case advances", async () => {
  const fixture = await createUnitsBoundaryFixture()
  try {
    expect((await fixture.selection.register({ caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, fixture.context)).status).toBe("ok")
    const otherCase = { ...caseRef, id: "other" }
    const otherCandidate = portfolioCandidateRef({ caseRef: encodeCaseRef(otherCase), caseVersion: otherCase.version, alternativeId: "selected", alternativeVersion: 1 })
    const request = { ...fixture.portfolioRequest, candidateRefs: [...fixture.portfolioRequest.candidateRefs, otherCandidate], explorationLimit: 3 }
    const saved = await fixture.persistentPortfolio.evaluateAndStore(request, caseRef, fixture.context)
    if (saved.status !== "ok") throw new Error(`Cross-case portfolio unavailable: ${JSON.stringify(saved)}`)
    expect(saved.value.portfolio.combinations.some((item) => item.conflicts.some((conflict) => conflict.startsWith("duplicate-target:")))).toBe(true)
    const current = await fixture.state.read(fixture.request, "cases", (value) => value.cases.other)
    if (current.status !== "ok") throw new Error("Other case unavailable")
    const changed = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, idempotencyKey: "change-other", commandDigest: "d".repeat(64), targetRef: otherCase.id, targetIncarnation: otherCase.incarnation }, async (value) => { value.cases.other = { ...value.cases.other, version: 2 }; return { commit: true, value: true } })
    expect(changed.status).toBe("ok")
    expect((await fixture.persistentPortfolio.read(saved.value.portfolioResultRef, fixture.context)).status).toBe("stale")
  } finally { await fixture.cleanup() }
}, 120000)

async function createUnitsBoundaryFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-boundary-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true, historical: false }
  const store = await openLocalStore(directory)
  try {
    const transactionAll = store.transactionAll
    if (!transactionAll) throw new Error("sensitivity fixture requires atomic cross-surface reads")
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
    if (comparison.status !== "ok") throw new Error("Canonical forecast unavailable")
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
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok") throw new Error("Canonical scenarios unavailable")
    if (selectedPreview.value.comparisonStatus !== "conditioned" || baselinePreview.value.comparisonStatus !== "conditioned") throw new Error(`Expected conditioned Planner previews: ${JSON.stringify({ selectedPreview, baselinePreview })}`)
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
    if (selectedStored.status !== "ok" || baselineStored.status !== "ok") throw new Error("Stored scenarios unavailable")
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
    if (issued.status !== "ok") throw new Error("Canonical sensitivity units unavailable")
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
    const analysis = createPortfolioAnalysis({ planner: plannerWithCriteria, results, bindings: comparisonBindings, persist: createPlannerResultPersistence({ store: results, scenarios, comparisonBindings, replay: plannerWithCriteria, resolveCase: async () => ({ status: "ok", value: caseRef }) }), select: selectPortfolio, idempotencyKey: async (digest) => `portfolio-${digest}` })
    const resolveCandidate = createDecisionCandidateResolver(cases)
    const portfolioBindingOperation = { id: "portfolio-binding" }
    const portfolioBindings = createPortfolioResultBindings({ state, host, results, selection, resolveCandidate, authorizeCase: async () => access.allowed, verifyBinding: async (_binding, value, trusted) => value.kind === "portfolio" && (await Promise.all(value.result.combinations.map((item) => item.analysis ? analysis.revalidate(item.analysis, trusted) : Promise.resolve(true)))).every(Boolean), verifySnapshot: () => access.allowed, operationIdentity: () => portfolioBindingOperation.id, proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const contribution = createProductionPortfolio({ cases, planner, sources, evidence: evidenceService, revalidate: host.revalidate, analysis, candidateCoverageRefFor: async (candidate) => { const ref = parseCaseRef(candidate.caseRef); return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" } }, createReceipt: async () => undefined, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, persistence: { results, portfolioBindings, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `portfolio-result-${digest}` }, enabledOperations: ["sf_portfolio_evaluate"] })
    const portfolioRequest = { ...analysisRequest.portfolio, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(caseRef), caseVersion: caseRef.version, alternativeId: "selected", alternativeVersion: 1 })] }
    const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "sensitivity-binding-op", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const product = createPortfolioProduct({ host, cases, evidence: evidenceService, planner: { planner: plannerWithCriteria, sources, scenarios }, results, rules, selection, portfolioBindings, comparisonBindings, sensitivityBindings: bindings, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, createReceipt: async () => undefined, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `portfolio-${digest}` })
    const verifier = createPortfolioProofVerifier({ cases, planner: plannerWithCriteria, sources, evidence: evidenceService, results, revalidate: host.revalidate, readSourceFences: async () => access.allowed ? transactionAll(async (snapshots) => ({ commit: false, value: { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) } })) : undefined, lockedSourceFences: () => { const snapshots = store.currentSnapshots?.(); return snapshots ? { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) } : undefined }, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async (digest) => `verify-${digest}`, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused" }) }, createReceipt: async () => undefined, candidateCoverageRefFor: async (candidate) => { const ref = parseCaseRef(candidate.caseRef); return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" } }, revalidateAnalysis: analysis.revalidate, units: issuer, sensitivityPreview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted) })
    if (!contribution.persistent) throw new Error("Portfolio store unavailable")
    const persistentPortfolio = contribution.persistent
    const preview = (input: Parameters<typeof comparePlannerPreview>[1], trusted: Parameters<typeof comparePlannerPreview>[2]) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted)
    const reviseRule = () => {
      ruleOperation.id = "criterion-revision"
      return rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "gte", value: 1, unit: "USD", period: horizon, evidenceRefs: [evidence], expectedRuleVersion: 1, sensitivity: issued.value.units }, context)
    }
    return { request, context, access, store, transactionAll, state, evidence, ids, results, selectedRef, baselineRef, issuer, issued: issued.value, comparison, selection, analysisRequest, selectPortfolio, analysis, portfolioBindings, contribution, persistentPortfolio, portfolioRequest, bindings, product, comparisonBindings, verifier, preview, reviseRule,
      cleanup: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
    }
  } catch (error) {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
