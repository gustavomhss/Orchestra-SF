import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortfolioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionComparisonService } from "../../../product/decisions/comparison.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createPortfolioResultBindings } from "../../../product/decisions/portfolio-bindings.ts"
import { createDecisionPortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { createPortfolioSelectionResolver } from "../../../product/portfolio/selection.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

test("portfolio consumes canonical source scenarios and preserves the same human choice after training is confirmed", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const before = await composePortfolio(history, history.before)
    expect(history.before.baselineScenario.operations).toEqual([])
    expect(history.before.baselineResult.id.startsWith("source-scenario:")).toBe(true)
    expect(history.before.baselineResult).toMatchObject({ total: 240000, comparisonStatus: "complete" })
    const baseline = await before.product.port.evaluate({ ...before.request, candidateRefs: [before.baselineCandidateRef], constraints: [] }, history.fixture.context)
    if (baseline.status !== "ok") throw new Error(`Source-only baseline portfolio: ${JSON.stringify(baseline)}`)
    expect(baseline.value.combinations).toHaveLength(1)
    expect(baseline.value.combinations[0]!.components).toEqual(history.before.baselineResult.components)
    expect(baseline.value.combinations[0]!.restrictions).toContain("analysis-unavailable")
    expect(baseline.value.combinations[0]!.eligibility).toBe("conditioned")

    const omitted = await before.persistent.evaluateAndStore(before.request, history.before.caseRef, history.fixture.context)
    if (omitted.status !== "ok") throw new Error(`Omitted-training portfolio: ${JSON.stringify(omitted)}`)
    const original = omitted.value.portfolio.combinations[0]!
    expect(omitted.value.portfolio.combinations).toHaveLength(1)
    expect(original).toMatchObject({ eligibility: "conditioned", comparisonStatus: "conditioned", analysis: { scenario: { knownSubtotal: 210000, total: null, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } }, comparison: { knownDifference: -30000, completeDifference: null, comparisonStatus: "conditioned" } } })
    expect(original.restrictions.some((reason) => reason.includes("training"))).toBe(true)
    expect(original.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    if (!original.analysis) throw new Error("Portfolio comparison was not persisted")
    expect((await history.before.results.read({ kind: "comparison", resultRef: original.analysis.comparisonRef }, history.fixture.context)).status).toBe("ok")
    expect((await before.comparisonBindings.read({ caseRef: history.before.caseRef, resultRef: original.analysis.comparisonRef }, history.fixture.context)).status).toBe("ok")
    const originalStored = await history.state.read(history.fixture.request, "cases", (state) => state.decisionResults?.[omitted.value.portfolioResultRef])
    if (originalStored.status !== "ok" || !originalStored.value) throw new Error("Original portfolio C08 unavailable")
    const originalDigest = digestSfValue(originalStored.value)

    const chosen = await history.choose()
    const choiceDigest = digestSfValue(chosen.choice)
    expect(chosen.choice.result).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned" })
    expect((await history.readCase()).choices).toHaveLength(1)
    expect((await history.readCase()).preparedChanges).toEqual([])
    expect((await history.readCase()).receipts).toEqual([])

    const phase = await history.resolveTraining()
    expect(phase.caseRef.id).toBe(history.before.caseRef.id)
    expect(phase.caseRef.incarnation).toBe(history.before.caseRef.incarnation)
    expect(phase.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
    expect(phase.scenario).toMatchObject({ operations: [], assumptions: [] })
    expect(phase.selectedResult.id.startsWith("source-scenario:")).toBe(true)
    const after = await composePortfolio(history, phase)
    const confirmed = await after.persistent.evaluateAndStore(after.request, phase.caseRef, history.fixture.context)
    if (confirmed.status !== "ok") throw new Error(`Confirmed-training source portfolio: ${JSON.stringify(confirmed)}`)
    const current = confirmed.value.portfolio.combinations[0]!
    expect(current).toMatchObject({ eligibility: "ineligible", comparisonStatus: "complete", analysis: { scenario: { knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } }, comparison: { knownDifference: 10000, completeDifference: 10000, comparisonStatus: "complete", criterionResults: [{ criterionId: "renewal-difference", state: "failed" }] } } })
    expect(current.components.find((component) => component.id === "training:11")?.amount).toBe(40000)
    expect(new Set(current.components.map((component) => component.id)).size).toBe(current.components.length)
    if (!current.analysis) throw new Error("Confirmed portfolio comparison unavailable")
    const entries = current.analysis.scenario.costCoverage.entries
    expect(entries.filter((entry) => entry.status === "not-applicable").map((entry) => entry.categoryId)).toEqual(["contract_exit", "internal_costs", "other_relevant_costs"])
    const implementation = entries.find((entry) => entry.categoryId === "implementation")
    const migration = entries.find((entry) => entry.categoryId === "migration")
    expect(implementation?.status === "included" && migration?.status === "included" && implementation.componentRefs).toEqual(migration?.status === "included" ? migration.componentRefs : undefined)
    expect(current.analysis.scenario).toEqual(phase.selectedResult)
    expect(current.analysis.comparison).toEqual(phase.comparison)
    expect(confirmed.value.portfolioResultRef).not.toBe(omitted.value.portfolioResultRef)
    expect(current.analysis.comparisonRef).not.toBe(original.analysis.comparisonRef)
    expect(await after.persistent.read(confirmed.value.portfolioResultRef, history.fixture.context)).toEqual(confirmed)
    expect(await after.persistent.evaluateAndStore(after.request, phase.caseRef, history.fixture.context)).toEqual(confirmed)
    const persisted = await history.state.read(history.fixture.request, "cases", (state) => ({ original: state.decisionResults?.[omitted.value.portfolioResultRef], current: state.decisionResults?.[confirmed.value.portfolioResultRef], decision: state.cases[phase.caseRef.id] }))
    if (persisted.status !== "ok") throw new Error("Persisted portfolio history unavailable")
    expect(digestSfValue(persisted.value.original)).toBe(originalDigest)
    expect(persisted.value.current?.caseRef).toEqual(phase.caseRef)
    expect(persisted.value.decision?.choices).toHaveLength(1)
    expect(digestSfValue(persisted.value.decision?.choices[0])).toBe(choiceDigest)
    expect(persisted.value.decision?.preparedChanges).toEqual([])
    expect(persisted.value.decision?.receipts).toEqual([])
    expect(persisted.value.decision?.state).toBe("reconsidering")
    expect(await chosen.retry()).toEqual({ status: "ok", value: { caseRef: chosen.caseRef } })
  } finally { await history.cleanup() }
}, 180000)

async function composePortfolio(history: Awaited<ReturnType<typeof createRenewalChoiceHistory>>, phase: Awaited<ReturnType<typeof createRenewalChoiceHistory>>["before"]) {
  const host = history.fixture.host
  const context = history.fixture.context
  const writes = new WeakSet<object>()
  const state = createSfProductState({ persistence: history.fixture.store, proposalCoverageWrites: writes, createId: () => "wp13-source-consumer", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === phase.caseRef.id ? { incarnation: phase.caseRef.incarnation } : undefined, authorize: async (request) => request === history.fixture.request && await host.revalidate(context) ? context.binding : undefined })
  const authorizeCase = async (decision: DecisionCase, trusted: TrustedDomainContext) => decision.id === phase.caseRef.id && decision.incarnation === phase.caseRef.incarnation && decision.participants.includes(trusted.binding.principalRef) && await host.revalidate(trusted)
  const evidenceCurrent = async (refs: readonly BusinessEvidenceRef[], trusted: TrustedDomainContext) => {
    const observed = await phase.evidence.context({ refs }, trusted)
    return observed.length === refs.length && observed.every((item, index) => item.state === "fresh" && item.accessRevision === trusted.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index]))
  }
  const fence = await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
  const verifySnapshot = (snapshot: Snapshot) => sfRunSourceFence(snapshot) === fence
  const caseFor = async () => ({ status: "ok" as const, value: phase.caseRef })
  const now = () => "2026-11-14T10:00:00Z"
  // Grants are synthetic fixture authority. Rules are persisted WP11 inputs; Planner computes every financial metric.
  const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase, authorizeRule: async () => false, verifyEvidence: (rule, trusted) => evidenceCurrent(rule.evidenceRefs, trusted), verifySnapshot, readMetric: (request, trusted) => { if (!metrics.read) throw new Error("Canonical criterion metric not composed"); return metrics.read(request, trusted) }, verifyMetric: (metric, trusted) => evidenceCurrent(metric.evidenceRefs, trusted), operationIdentity: () => `source-rule-reader-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  metrics.read = createPlannerCriterionMetric({ host, rules, units: phase.issuer, preview: phase.preview })
  const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results: phase.results, authorizeCase, verifyBinding: async (binding, result, trusted) => {
    const compared = await phase.planner.compareScenarios(binding.request, trusted)
    return result.kind === "comparison" && compared.status === "ok" && digestSfValue(compared.value) === result.resultDigest
  }, verifySnapshot, operationIdentity: () => `source-comparison-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const compare = createDecisionComparisonService({ cases: phase.cases, state, results: phase.results, planner: phase.planner, host })
  const selection = createDecisionPortfolioSelection({ state, host, compare, authorizeCase, authorizeSelection: async (_request, trusted) => trusted.kind === "ui" && await host.revalidate(trusted), verifySnapshot, operationIdentity: () => `source-selection-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const inspected = await selection.inspect({ caseRef: phase.caseRef }, context)
  if (inspected.status !== "ok") throw new Error(`Selection inspection: ${JSON.stringify(inspected)}`)
  const selected = await selection.register({ caseRef: phase.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: inspected.value.version }, context)
  if (selected.status !== "ok") throw new Error(`Human portfolio selection: ${JSON.stringify(selected)}`)
  const scenarios = createStoredPlannerScenarioHost({ store: phase.results, cases: phase.cases, planner: phase.planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
  const analysis = createPortfolioAnalysis({ planner: phase.planner, results: phase.results, bindings: comparisonBindings, persist: createPlannerResultPersistence({ store: phase.results, scenarios, comparisonBindings, replay: phase.planner, resolveCase: caseFor }), select: createPortfolioSelectionResolver({ selection, results: phase.results, caseFor }), idempotencyKey: async (digest) => `source-analysis-${phase.caseRef.version}:${digest}` })
  const resolveCandidate = createDecisionCandidateResolver(phase.cases)
  const bindings = createPortfolioResultBindings({ state, host, results: phase.results, selection, resolveCandidate, authorizeCase, verifyBinding: async (_binding, result, trusted) => result.kind === "portfolio" && (await Promise.all(result.result.combinations.map((combination) => combination.analysis ? analysis.revalidate(combination.analysis, trusted) : Promise.resolve(false)))).every(Boolean), verifySnapshot, operationIdentity: () => `source-portfolio-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, trusted) => {
      const source = phase.sourceRefs.find((ref) => ref.kind === "record" && ref.refId === reference && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
      return source?.kind === "record" && await evidenceCurrent([source], trusted) ? { status: "ok", value: { versionId: source.target.recordId, evidence: source } } : { status: "unavailable", reason: "planner-source-unavailable" }
    },
    resolveForecastCoverage: createDecisionCoverageAccess({ state, host, authorizeCase, verifyEvidence: (basis, assessment, trusted) => evidenceCurrent([...basis.sourceRefs, ...assessment.evaluatedSourceRefs], trusted) }),
  }
  const product = createProductionPortfolio({ cases: phase.cases, planner: phase.planner, sources, evidence: phase.evidence, revalidate: host.revalidate, analysis, candidateCoverageRefFor: async (candidate) => {
    const ref = parseCaseRef(candidate.caseRef)
    return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" }
  }, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "separate-human-application-required" }) }, createReceipt: async () => undefined, persistence: { results: phase.results, portfolioBindings: bindings, caseFor, idempotencyKey: async (digest) => `source-portfolio-${phase.caseRef.version}:${digest}` }, enabledOperations: ["sf_portfolio_evaluate"] })
  if (!product.persistent) throw new Error("Portfolio persistence unavailable")
  const request: PortfolioRequest = { scope: { horizon: phase.selectedResult.horizon, currency: phase.selectedResult.currency }, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(phase.caseRef), caseVersion: phase.caseRef.version, alternativeId: "selected", alternativeVersion: phase.selectedResult.costCoverage.alternativeVersion })], operations: [], constraints: ["renewal-difference"], priorities: [], explorationLimit: 1 }
  return { product, persistent: product.persistent, request, comparisonBindings, baselineCandidateRef: portfolioCandidateRef({ caseRef: encodeCaseRef(phase.caseRef), caseVersion: phase.caseRef.version, alternativeId: "baseline", alternativeVersion: phase.baselineResult.costCoverage.alternativeVersion }) }
}
