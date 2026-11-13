import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { sfRunSourceFence } from "../ai/run-store.ts"
import type { StoredDecisionResult, createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioBinding } from "../decisions/portfolio-bindings.ts"
import type { CriterionResultBinding } from "../decisions/criterion-rules.ts"
import type { createPlannerSensitivityUnits } from "../planner/sensitivity-units.ts"
import { plannerScenarioDigest } from "../planner/preview-comparison.ts"
import { createSensitivityEvaluator } from "./sensitivity.ts"
import { finalizePlannerSensitivity } from "./planner-sensitivity.ts"
import type { createPlannerSensitivity } from "./planner-sensitivity.ts"
import type { CriterionComparisonBinding } from "../decisions/criterion-comparison.ts"
import { createProductionPortfolio } from "./production.ts"
import { portfolioResultDigest } from "./result-store.ts"

/** Reproduce a bound portfolio or comparison using only authorized reads and Planner previews. */
export function createPortfolioProofVerifier(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  evidence: BusinessContextService
  results: ReturnType<typeof createSfDecisionResultStore>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  readSourceFences: (context: TrustedDomainContext) => Promise<{ dashboard: string; planner: string; procurement: string } | undefined>
  lockedSourceFences: () => { dashboard: string; planner: string; procurement: string } | undefined
  caseFor: Parameters<typeof createProductionPortfolio>[0]["persistence"]["caseFor"]
  idempotencyKey: Parameters<typeof createProductionPortfolio>[0]["persistence"]["idempotencyKey"]
  decisions: Parameters<typeof createProductionPortfolio>[0]["decisions"]
  createReceipt: Parameters<typeof createProductionPortfolio>[0]["createReceipt"]
  candidateCoverageRefFor: NonNullable<Parameters<typeof createProductionPortfolio>[0]["candidateCoverageRefFor"]>
  coverageRefFor?: Parameters<typeof createProductionPortfolio>[0]["coverageRefFor"]
  revalidateAnalysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]>["revalidate"]
  units: ReturnType<typeof createPlannerSensitivityUnits>
  sensitivityPreview: Parameters<typeof createPlannerSensitivity>[0]["preview"]
  exactThreshold?: Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]
}) {
  const fences = new Map<string, { digest: string; planner: string; expires: number }>()
  const key = (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => digestSfValue({ binding: binding.bindingDigest, installation: context.binding.installationId, project: context.binding.projectId, principal: context.binding.principalRef, revision: context.binding.accessRevision, policy: context.binding.policyVersion })
  const capture = async (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext, expected: string) => {
    const current = await input.readSourceFences(context)
    if (!current || digestSfValue(current) !== expected || !await input.revalidate(context)) return false
    const now = Date.now()
    for (const [ref, fence] of fences) if (fence.expires <= now) fences.delete(ref)
    if (fences.size >= 2048 && !fences.has(key(binding, context))) return false
    fences.set(key(binding, context), { digest: expected, planner: current.planner, expires: now + 30_000 })
    return await input.revalidate(context)
  }
  const replayPortfolio = async (request: PortfolioRequest, portfolio: PortfolioResult, context: TrustedDomainContext) => {
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const analysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]> = {
      evaluate: async (request, trusted) => {
        const id = digestSfValue({ candidates: request.candidates.map((candidate) => candidate.ref), operations: request.scenario.operations })
        const found = portfolio.combinations.filter((combination) => combination.id === id)
        if (found.length !== 1) return { status: "stale", reason: "portfolio-combination-changed" }
        const item = found[0]!
        if (!item.analysis) return { status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" }
        if (!await input.revalidateAnalysis(item.analysis, trusted)) return { status: "stale", reason: "portfolio-analysis-changed" }
        const comparison = item.analysis.comparison
        if (request.portfolio.constraints.some((ref) => !comparison.criterionResults.some((criterion) => criterion.criterionId === ref))) return { status: "stale", reason: "portfolio-criteria-changed" }
        return { status: "ok", value: { analysis: item.analysis, constraints: request.portfolio.constraints.map((ref) => { const criterion = comparison.criterionResults.find((value) => value.criterionId === ref)!; return { ref, state: criterion.state, reason: criterion.reason } }) } }
      },
      revalidate: input.revalidateAnalysis,
    }
    const port = createProductionPortfolio({ cases: input.cases, planner: input.planner, sources: input.sources, evidence: input.evidence, revalidate: input.revalidate, analysis, candidateCoverageRefFor: input.candidateCoverageRefFor, coverageRefFor: input.coverageRefFor, decisions: input.decisions, createReceipt: input.createReceipt, persistence: { results: input.results, caseFor: input.caseFor, idempotencyKey: input.idempotencyKey }, enabledOperations: [] }).port
    const replay = await port.evaluate(request, context)
    const latest = await input.readSourceFences(context)
    return replay.status === "ok" && portfolioResultDigest(replay.value) === portfolioResultDigest(portfolio) && !!latest && digestSfValue(latest) === initialFence && await input.revalidate(context)
  }
  const verifyPortfolio = async (binding: PortfolioBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "portfolio" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    return await replayPortfolio(binding.request, stored.result, context) && await capture(binding, context, initialFence)
  }
  const verifyComparison = async (binding: CriterionComparisonBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "comparison" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const current = await input.planner.compareScenarios(binding.request, context)
    return current.status === "ok" && digestSfValue(current.value) === stored.resultDigest && await capture(binding, context, initialFence)
  }
  const verifySensitivity = async (binding: CriterionResultBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "sensitivity" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const expectedResult = stored.result
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const issued = await input.units.resolve(binding.request, context)
    if (issued.status !== "ok" || issued.value.ruleRef !== binding.ruleRef || issued.value.ruleVersion !== binding.ruleVersion || digestSfValue(issued.value.caseRef) !== digestSfValue(binding.caseRef)) return false
    const unitBinding = issued.value
    const source = await input.results.readHistoricalScenario({ resultRef: binding.request.scenarioRef }, context)
    const baseline = await input.results.readHistoricalScenario({ resultRef: unitBinding.baselineRef }, context)
    if (source.status !== "ok" || baseline.status !== "ok" || source.value.kind !== "scenario" || baseline.value.kind !== "scenario" || source.value.requestDigest !== digestSfValue(unitBinding.scenario)) return false
    const sourceCoverage = source.value.result.costCoverage
    const baselineCoverage = baseline.value.result.costCoverage
    const samples: { resultRef: string; coverageRefs: readonly string[]; conditions: readonly string[]; complete: boolean }[] = []
    const exact: { value?: { value: number | null; evidenceRefs: readonly import("../contracts/business-context.ts").BusinessEvidenceRef[] } } = {}
    const evaluate = createSensitivityEvaluator({
      sample: async (_request, value, trusted) => {
        const point = expectedResult.evaluated[samples.length]
        if (!point || point.parameterValue !== value) return { status: "stale", reason: "sensitivity-sample-changed" }
        const scenario = { ...unitBinding.scenario, operations: unitBinding.scenario.operations.map((operation) => operation.targetRef === binding.request.parameterBounds.parameterRef ? { ...operation, amount: value } : operation) }
        const saved = await input.results.read({ kind: "scenario", resultRef: point.resultRef }, trusted)
        if (saved.status !== "ok") return saved
        const preview = await input.sensitivityPreview({ baselineRef: unitBinding.baselineRef, scenario }, trusted)
        if (preview.status !== "ok") return preview
        if (saved.value.kind !== "scenario" || digestSfValue(saved.value.caseRef) !== digestSfValue(binding.caseRef) || saved.value.requestDigest !== digestSfValue(scenario) || plannerScenarioDigest(saved.value.result) !== plannerScenarioDigest(preview.value.sample) || preview.value.metric.metricRef !== "planner:known-subtotal-difference" || preview.value.metric.state !== "conditioned" || !preview.value.metric.evidenceRefs.length || digestSfValue(preview.value.metric.period) !== digestSfValue(preview.value.sample.horizon) || digestSfValue(preview.value.comparison.costCoverageRefs) !== digestSfValue([unitBinding.baselineCoverageRef]) || preview.value.comparison.comparisonStatus === "incompatible" || preview.value.comparison.comparisonStatus === "unavailable" || preview.value.metric.unit !== unitBinding.resultUnit || preview.value.metric.engineVersion !== unitBinding.engineVersion || preview.value.metric.value !== point.value || preview.value.comparison.knownDifference !== point.value || preview.value.comparison.baselineResultRef !== unitBinding.baselineRef || preview.value.comparison.alternativeResultRef !== preview.value.sample.id) return { status: "stale", reason: "sensitivity-sample-changed" }
        samples.push({ resultRef: point.resultRef, coverageRefs: preview.value.comparison.costCoverageRefs, conditions: preview.value.comparison.unresolvedConditions, complete: preview.value.comparison.comparisonStatus === "complete" && preview.value.sample.costCoverage.coverageState === "complete" })
        return { status: "ok", value: { resultRef: point.resultRef, scenario: saved.value.result, criterionValue: point.value, parameterUnit: unitBinding.parameterUnit, resultUnit: unitBinding.resultUnit, unitMetadataRef: unitBinding.unitMetadataRef, unitMetadataVersion: unitBinding.unitMetadataVersion } }
      },
      exactThreshold: async (_request, trusted) => {
        if (!input.exactThreshold || samples.some((sample) => !sample.complete) || baselineCoverage.coverageState !== "complete" || sourceCoverage.coverageState !== "complete") return { status: "unavailable", reason: "exact-threshold-not-proven" }
        const result = await input.exactThreshold(binding.request, unitBinding, trusted)
        if (result.status === "ok") exact.value = result.value
        return result
      },
      revalidate: async (_samples, _threshold, trusted) => {
        if (!await input.units.revalidate(unitBinding, trusted) || samples.length !== expectedResult.evaluated.length) return false
        if (!exact.value) return true
        if (!input.exactThreshold) return false
        const current = await input.exactThreshold(binding.request, unitBinding, trusted)
        return current.status === "ok" && digestSfValue(current.value) === digestSfValue(exact.value)
      },
    })
    const sampled = await evaluate(binding.request, context)
    if (sampled.status !== "ok") return false
    const result = finalizePlannerSensitivity({ request: binding.request, binding: unitBinding, result: sampled.value, samples, baselineRefs: baseline.value.sourceRefs, exact: exact.value })
    return result.status === "ok" && digestSfValue(result.value) === stored.resultDigest && await capture(binding, context, initialFence)
  }
  const verifySnapshot = (snapshot: Snapshot, binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => {
    const saved = fences.get(key(binding, context))
    const current = input.lockedSourceFences()
    return !!saved && !!current && saved.expires > Date.now() && saved.planner === sfRunSourceFence(snapshot) && saved.digest === digestSfValue(current)
  }
  return { replayPortfolio, verifyPortfolio, verifyComparison, verifySensitivity, verifySnapshot }
}
