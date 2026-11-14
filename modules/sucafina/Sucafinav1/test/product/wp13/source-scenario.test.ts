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
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createPortfolioResultBindings } from "../../../product/decisions/portfolio-bindings.ts"
import { createDecisionPortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { createPortfolioSelectionResolver } from "../../../product/portfolio/selection.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { createWp13PolicyHistory, wp13CeilingCriterion } from "./source-scenario-fixture.ts"

const policyCriteria = ["renewal-difference", "renewal-ceiling-240000"] as const

test("portfolio replays the USD 240000 ceiling and USD 20000 advantage in the same chosen case when training is confirmed", async () => {
  const history = await createWp13PolicyHistory()
  try {
    const before = await composePortfolio(history, history.before)
    expect(history.before.baselineScenario.operations).toEqual([])
    expect(history.before.baselineResult.id.startsWith("source-scenario:")).toBe(true)
    expect(history.before.baselineResult).toMatchObject({ total: 240000, comparisonStatus: "complete" })
    expect(before.ceilingRule).toMatchObject({ metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0, unit: "USD", sensitivity: { baselineRef: history.before.baselineRef } })
    expect(history.before.rule).toMatchObject({ metricRef: "planner:known-subtotal-difference", operator: "lte", value: -20000, unit: "USD", sensitivity: { baselineRef: history.before.baselineRef } })
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
    expect(original.analysis.comparison.criterionResults).toEqual(policyCriteria.map((criterionId) => expect.objectContaining({ criterionId, state: "unknown", reason: "criterion-metric-conditioned" })))
    expect((await history.before.results.read({ kind: "comparison", resultRef: original.analysis.comparisonRef }, history.fixture.context)).status).toBe("ok")
    const originalBinding = await before.comparisonBindings.read({ caseRef: history.before.caseRef, resultRef: original.analysis.comparisonRef }, history.fixture.context)
    if (originalBinding.status !== "ok") throw new Error("Both policy criteria were not bound to the original C08 comparison")
    expect(originalBinding.value.request.criteria).toEqual(policyCriteria)
    expect(originalBinding.value.request.scenarioRefs).toEqual([history.before.baselineRef, history.before.selectedRef])
    const originalStored = await history.state.read(history.fixture.request, "cases", (state) => state.decisionResults?.[omitted.value.portfolioResultRef])
    if (originalStored.status !== "ok" || !originalStored.value) throw new Error("Original portfolio C08 unavailable")
    const originalDigest = digestSfValue(originalStored.value)

    const chosen = await before.choose()
    const choiceDigest = digestSfValue(chosen.choice)
    expect(chosen.choice.result).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned" })
    expect(chosen.choice.criteria).toEqual(policyCriteria)
    expect(chosen.choice.comparison).toEqual(original.analysis.comparison)
    expect((await history.readCase()).choices).toHaveLength(1)
    expect((await history.readCase()).preparedChanges).toEqual([])
    expect((await history.readCase()).receipts).toEqual([])

    const phase = await history.resolveTraining()
    expect(phase.caseRef.id).toBe(history.before.caseRef.id)
    expect(phase.caseRef.incarnation).toBe(history.before.caseRef.incarnation)
    expect(phase.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
    expect(phase.scenario).toMatchObject({ operations: [], assumptions: [] })
    expect(phase.selectedResult.id.startsWith("source-scenario:")).toBe(true)
    const after = await composePortfolio(history, phase, before.ceilingRule.version)
    const confirmed = await after.persistent.evaluateAndStore(after.request, phase.caseRef, history.fixture.context)
    if (confirmed.status !== "ok") throw new Error(`Confirmed-training source portfolio: ${JSON.stringify(confirmed)}`)
    const current = confirmed.value.portfolio.combinations[0]!
    expect(current).toMatchObject({ eligibility: "ineligible", comparisonStatus: "complete", analysis: { scenario: { knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } }, comparison: { knownDifference: 10000, completeDifference: 10000, comparisonStatus: "complete" } } })
    expect(current.components.find((component) => component.id === "training:11")?.amount).toBe(40000)
    expect(new Set(current.components.map((component) => component.id)).size).toBe(current.components.length)
    if (!current.analysis) throw new Error("Confirmed portfolio comparison unavailable")
    expect(current.analysis.comparison.criterionResults).toEqual(policyCriteria.map((criterionId) => expect.objectContaining({ criterionId, state: "failed" })))
    const entries = current.analysis.scenario.costCoverage.entries
    expect(entries.filter((entry) => entry.status === "not-applicable").map((entry) => entry.categoryId)).toEqual(["contract_exit", "internal_costs", "other_relevant_costs"])
    const implementation = entries.find((entry) => entry.categoryId === "implementation")
    const migration = entries.find((entry) => entry.categoryId === "migration")
    if (implementation?.status !== "included" || migration?.status !== "included") throw new Error("Shared implementation and migration coverage unavailable")
    expect(implementation.componentRefs).toEqual(migration.componentRefs)
    expect(current.analysis.scenario).toEqual(phase.selectedResult)
    const replayed = await after.planner.compareScenarios({ scenarioRefs: [phase.baselineRef, phase.selectedRef], criteria: policyCriteria }, history.fixture.context)
    if (replayed.status !== "ok") throw new Error("Canonical comparison replay unavailable")
    expect(current.analysis.comparison).toEqual(replayed.value)
    const currentBinding = await after.comparisonBindings.read({ caseRef: phase.caseRef, resultRef: current.analysis.comparisonRef }, history.fixture.context)
    if (currentBinding.status !== "ok") throw new Error("Both policy criteria were not bound to the confirmed C08 comparison")
    expect(currentBinding.value.request.criteria).toEqual(policyCriteria)
    expect(currentBinding.value.request.scenarioRefs).toEqual([phase.baselineRef, phase.selectedRef])
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

    const substitutedBaseline = await after.rules.evaluate({ caseRef: phase.caseRef, criterionId: "renewal-ceiling-240000", scenarioRef: phase.selectedRef, baselineRef: phase.selectedRef }, history.fixture.context)
    expect(substitutedBaseline).toMatchObject({ status: "ok", value: { state: "unknown", reason: "criterion-metric-unavailable" } })
    history.fixture.revokeSource(phase.baselineScenario.baseRef)
    expect((await after.rules.evaluate({ caseRef: phase.caseRef, criterionId: "renewal-ceiling-240000", scenarioRef: phase.selectedRef, baselineRef: phase.baselineRef }, history.fixture.context)).status).not.toBe("ok")
    expect((await after.persistent.read(confirmed.value.portfolioResultRef, history.fixture.context)).status).not.toBe("ok")
  } finally { await history.cleanup() }
}, 180000)

async function composePortfolio(history: Awaited<ReturnType<typeof createWp13PolicyHistory>>, phase: Awaited<ReturnType<typeof createWp13PolicyHistory>>["before"], expectedCeilingRuleVersion = 0) {
  const host = history.fixture.host
  const context = history.fixture.context
  const writes = new WeakSet<object>()
  const state = createSfProductState({ persistence: history.fixture.store, proposalCoverageWrites: writes, createId: () => "wp13-source-consumer", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === phase.caseRef.id ? { incarnation: phase.caseRef.incarnation } : undefined, authorize: async (request) => request === history.fixture.request && await host.revalidate(context) ? context.binding : undefined })
  const authorizeCase = async (decision: DecisionCase, trusted: TrustedDomainContext) => decision.id === phase.caseRef.id && decision.incarnation === phase.caseRef.incarnation && decision.participants.includes(trusted.binding.principalRef) && await host.revalidate(trusted)
  const evidenceCurrent = async (refs: readonly BusinessEvidenceRef[], trusted: TrustedDomainContext) => {
    const observed = await phase.evidence.context({ refs }, trusted)
    return observed.length === refs.length && observed.every((item, index) => item.state === "fresh" && item.accessRevision === trusted.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index]))
  }
  const configured = await state.read(history.fixture.request, "cases", (value) => value.cases[phase.caseRef.id])
  if (configured.status !== "ok" || !configured.value || configured.value.version !== phase.caseRef.version) throw new Error("Policy fixture case unavailable")
  const criterion = wp13CeilingCriterion
  if (configured.value.criteria.filter((item) => item.id === criterion.id).length !== 1 || digestSfValue(configured.value.criteria.find((item) => item.id === criterion.id)) !== digestSfValue(criterion)) throw new Error("Initial policy criterion changed")

  const baseline = await phase.results.read({ kind: "scenario", resultRef: phase.baselineRef }, context)
  if (baseline.status !== "ok" || baseline.value.kind !== "scenario" || digestSfValue(baseline.value.caseRef) !== digestSfValue(phase.caseRef) || baseline.value.requestDigest !== digestSfValue(phase.baselineScenario) || baseline.value.resultDigest !== digestSfValue(phase.baselineResult) || baseline.value.result.total !== 240000 || baseline.value.result.comparisonStatus !== "complete" || baseline.value.result.costCoverage.coverageState !== "complete" || !baseline.value.sourceRefs.length || !await evidenceCurrent(baseline.value.sourceRefs, context)) throw new Error("The ceiling requires the exact complete USD 240000 C08 baseline and current evidence")
  expect(baseline.value.result).toMatchObject({ knownSubtotal: 240000, total: 240000, currency: "USD", comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } })
  expect(baseline.value.result.sourceRefs).toEqual(phase.baselineResult.sourceRefs)
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, trusted) => {
      const source = phase.sourceRefs.find((ref) => ref.kind === "record" && ref.refId === reference && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
      return source?.kind === "record" && await evidenceCurrent([source], trusted) ? { status: "ok", value: { versionId: source.target.recordId, evidence: source } } : { status: "unavailable", reason: "planner-source-unavailable" }
    },
    resolveForecastCoverage: createDecisionCoverageAccess({ state, host, authorizeCase, verifyEvidence: (basis, assessment, trusted) => evidenceCurrent([...basis.sourceRefs, ...assessment.evaluatedSourceRefs], trusted) }),
  }
  const scenarios = createStoredPlannerScenarioHost({ store: phase.results, cases: phase.cases, planner: phase.planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
  const fence = await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
  const verifySnapshot = (snapshot: Snapshot) => sfRunSourceFence(snapshot) === fence
  const caseFor = async () => ({ status: "ok" as const, value: phase.caseRef })
  const now = () => "2026-11-14T10:00:00Z"
  // Grants are synthetic fixture authority. Both explicit human rules use the canonical Planner
  // difference metric; <= 0 is equivalent to the ceiling only for the pinned complete 240000 baseline.
  const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase, authorizeRule: async (request, trusted) => trusted.kind === "ui" && request.criterionId === criterion.id && request.metricRef === "planner:known-subtotal-difference" && request.operator === "lte" && request.value === 0 && request.unit === "USD" && request.sensitivity?.baselineRef === phase.baselineRef && await host.revalidate(trusted), verifyEvidence: (rule, trusted) => evidenceCurrent(rule.evidenceRefs, trusted), verifySnapshot, readMetric: (request, trusted) => { if (!metrics.read) throw new Error("Canonical criterion metric not composed"); return metrics.read(request, trusted) }, verifyMetric: (metric, trusted) => evidenceCurrent(metric.evidenceRefs, trusted), operationIdentity: () => `source-ceiling-rule-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  metrics.read = createPlannerCriterionMetric({ host, rules, units: phase.issuer, preview: phase.preview })
  if (!phase.rule.sensitivity) throw new Error("Canonical rule units unavailable")
  const registered = await rules.register({ caseRef: phase.caseRef, criterionId: criterion.id, metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0, unit: "USD", period: phase.selectedResult.horizon, evidenceRefs: phase.rule.sensitivity.sourceRefs, sensitivity: phase.rule.sensitivity, expectedRuleVersion: expectedCeilingRuleVersion }, context)
  if (registered.status !== "ok") throw new Error(`Ceiling policy registration: ${JSON.stringify(registered)}`)
  const ceiling = await rules.resolve({ caseRef: phase.caseRef, criterionId: criterion.id }, context)
  if (ceiling.status !== "ok") throw new Error("Persisted ceiling policy unavailable")
  const criteriaPlanner = createPlannerPort({ host, sources, scenarios, evidence: phase.evidence, criteria: { evaluate: (request, trusted) => rules.evaluate({ caseRef: phase.caseRef, ...request }, trusted) } })
  // Source simulation retains the real baseline/C10 dispatcher; the additional human policy only extends comparison.
  const planner = { ...phase.planner, compareScenarios: criteriaPlanner.compareScenarios }
  const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results: phase.results, authorizeCase, verifyBinding: async (binding, result, trusted) => {
    const compared = await planner.compareScenarios(binding.request, trusted)
    return result.kind === "comparison" && compared.status === "ok" && digestSfValue(compared.value) === result.resultDigest
  }, verifySnapshot, operationIdentity: () => `source-comparison-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const compare = createDecisionComparisonService({ cases: phase.cases, state, results: phase.results, planner, host })
  const selection = createDecisionPortfolioSelection({ state, host, compare, authorizeCase, authorizeSelection: async (_request, trusted) => trusted.kind === "ui" && await host.revalidate(trusted), verifySnapshot, operationIdentity: () => `source-selection-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const inspected = await selection.inspect({ caseRef: phase.caseRef }, context)
  if (inspected.status !== "ok") throw new Error(`Selection inspection: ${JSON.stringify(inspected)}`)
  const selected = await selection.register({ caseRef: phase.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: policyCriteria, expectedVersion: inspected.value.version }, context)
  if (selected.status !== "ok") throw new Error(`Human portfolio selection: ${JSON.stringify(selected)}`)
  const analysis = createPortfolioAnalysis({ planner, results: phase.results, bindings: comparisonBindings, persist: createPlannerResultPersistence({ store: phase.results, scenarios, comparisonBindings, replay: planner, resolveCase: caseFor }), select: createPortfolioSelectionResolver({ selection, results: phase.results, caseFor }), idempotencyKey: async (digest) => `source-analysis-${phase.caseRef.version}:${digest}` })
  const resolveCandidate = createDecisionCandidateResolver(phase.cases)
  const bindings = createPortfolioResultBindings({ state, host, results: phase.results, selection, resolveCandidate, authorizeCase, verifyBinding: async (_binding, result, trusted) => result.kind === "portfolio" && (await Promise.all(result.result.combinations.map((combination) => combination.analysis ? analysis.revalidate(combination.analysis, trusted) : Promise.resolve(false)))).every(Boolean), verifySnapshot, operationIdentity: () => `source-portfolio-${phase.caseRef.version}`, proposalCoverageWrites: writes, now })
  const product = createProductionPortfolio({ cases: phase.cases, planner, sources, evidence: phase.evidence, revalidate: host.revalidate, analysis, candidateCoverageRefFor: async (candidate) => {
    const ref = parseCaseRef(candidate.caseRef)
    return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" }
  }, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "separate-human-application-required" }) }, createReceipt: async () => undefined, persistence: { results: phase.results, portfolioBindings: bindings, caseFor, idempotencyKey: async (digest) => `source-portfolio-${phase.caseRef.version}:${digest}` }, enabledOperations: ["sf_portfolio_evaluate"] })
  if (!product.persistent) throw new Error("Portfolio persistence unavailable")
  const request: PortfolioRequest = { scope: { horizon: phase.selectedResult.horizon, currency: phase.selectedResult.currency }, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(phase.caseRef), caseVersion: phase.caseRef.version, alternativeId: "selected", alternativeVersion: phase.selectedResult.costCoverage.alternativeVersion })], operations: [], constraints: policyCriteria, priorities: [], explorationLimit: 1 }
  const nextId = { value: 0 }
  const mutations = createDecisionMutations({ state, host, planner, sources, authorizeCase, authorizeMutation: async (operation, _request, trusted) => operation === "record-choice" && trusted.kind === "ui" && await host.revalidate(trusted), verifyMutation: verifySnapshot, operationIdentity: () => `source-human-choice-${phase.caseRef.version}`, confirmChoice: async (ref, alternativeId, trusted) => digestSfValue(ref) === digestSfValue(phase.caseRef) && alternativeId === "selected" && trusted.kind === "ui" && await host.revalidate(trusted), confirmAnswer: async () => false, resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }), resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }), prepareDomainCommands: async () => ({ status: "unavailable", reason: "separate-human-application-required" }), resolveChoiceValues: async (_caseRef, comparison, trusted) => {
    const result = await planner.compareScenarios(comparison, trusted)
    return result.status === "ok" ? { status: "ok", value: comparison.criteria.map((criterionRef) => ({ criterionRef, value: result.value.knownDifference, unit: "USD", currency: "USD", horizon: phase.selectedResult.horizon })) } : result
  }, readScenarioResult: (resultRef, trusted) => phase.results.readHistoricalScenario({ resultRef }, trusted), createId: () => `wp13-source-choice-${phase.caseRef.version}-${++nextId.value}`, now })
  const choose = async () => {
    const choiceRequest = { caseRef: phase.caseRef, alternativeId: "selected", alternativeVersion: phase.selectedResult.costCoverage.alternativeVersion, comparison: { scenarioRefs: [phase.baselineRef, phase.selectedRef], criteria: policyCriteria }, criteria: policyCriteria, reason: "The human records the transition against the USD 240000 ceiling and USD 20000 advantage while training is still missing; application remains a separate confirmation." }
    const recorded = await mutations.recordChoice(choiceRequest, context)
    if (recorded.status !== "ok") throw new Error(`Both-policy human choice: ${JSON.stringify(recorded)}`)
    const decision = await history.readCase()
    const choice = decision.choices.at(-1)
    if (!choice) throw new Error("Both-policy choice was not persisted")
    return { caseRef: recorded.value.caseRef, choice: structuredClone(choice), retry: () => mutations.recordChoice(choiceRequest, context) }
  }
  return { product, persistent: product.persistent, request, comparisonBindings, planner, rules, ceilingRule: ceiling.value, choose, baselineCandidateRef: portfolioCandidateRef({ caseRef: encodeCaseRef(phase.caseRef), caseVersion: phase.caseRef.version, alternativeId: "baseline", alternativeVersion: phase.baselineResult.costCoverage.alternativeVersion }) }
}
