import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult, PlannerPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { createCriterionComparisonBindings } from "../decisions/criterion-comparison.ts"
import type { createPlannerResultPersistence } from "../planner/persistence.ts"
import type { createProductionPortfolio } from "./production.ts"

type Analysis = NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]>

/** Use a human-selected baseline, real Planner comparison and case-owned C08 proof. */
export function createPortfolioAnalysis(input: {
  planner: Pick<PlannerPort, "compareScenarios">
  results: ReturnType<typeof createSfDecisionResultStore>
  bindings: ReturnType<typeof createCriterionComparisonBindings>
  persist: ReturnType<typeof createPlannerResultPersistence>
  select: (request: Parameters<Analysis["evaluate"]>[0], context: TrustedDomainContext) => Promise<PortResult<{ caseRef: { id: string; incarnation: string; version: number }; baselineRef: string; alternativeRef: string; selectionDigest: string; criteria: readonly string[] }>>
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}): Analysis {
  return {
    evaluate: async (request, context) => {
      const selection = await input.select(request, context)
      if (selection.status !== "ok") return selection
      const selected = selection.value
      if (!selected.baselineRef.trim() || !selected.alternativeRef.trim() || selected.baselineRef === selected.alternativeRef || !/^[a-f0-9]{64}$/.test(selected.selectionDigest) || digestSfValue(selected.criteria) !== digestSfValue(request.portfolio.constraints)) return { status: "needs-input", reason: "portfolio-baseline-selection-required" }
      const scenario = await input.results.readHistoricalScenario({ resultRef: selected.alternativeRef }, context)
      if (scenario.status !== "ok") return scenario
      if (scenario.value.kind !== "scenario" || scenario.value.caseRef.id !== selected.caseRef.id || scenario.value.caseRef.incarnation !== selected.caseRef.incarnation || scenario.value.caseRef.version > selected.caseRef.version || scenario.value.requestDigest !== digestSfValue(request.scenario)) return { status: "stale", reason: "portfolio-alternative-changed" }
      const compare = { scenarioRefs: [selected.baselineRef, selected.alternativeRef], criteria: request.portfolio.constraints }
      const proofs = await input.bindings.proofs(selected.caseRef, compare.criteria, context)
      if (proofs.status !== "ok") return proofs
      const comparison = await input.planner.compareScenarios(compare, context)
      if (comparison.status !== "ok") return comparison
      if (comparison.value.baselineResultRef !== selected.baselineRef || comparison.value.alternativeResultRef !== selected.alternativeRef || compare.criteria.some((ref) => !comparison.value.criterionResults.some((item) => item.criterionId === ref))) return { status: "unavailable", reason: "portfolio-comparison-incomplete" }
      const requestDigest = digestSfValue(compare)
      const key = await input.idempotencyKey(requestDigest, context)
      if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" }
      const idempotencyKey = `portfolio-comparison:${key}:${requestDigest}`
      const existing = await input.results.readByRequest({ caseRef: selected.caseRef, kind: "comparison", idempotencyKey, requestDigest }, context)
      if (existing.status !== "ok") return existing
      const resultRef = existing.value.state === "found" ? existing.value.result.resultRef : undefined
      const saved = resultRef ? { status: "ok" as const, value: { resultRef } } : await input.persist({ kind: "comparison", request: compare, result: comparison.value }, idempotencyKey, context)
      if (saved.status !== "ok") return saved
      const stored = await input.results.read({ kind: "comparison", resultRef: saved.value.resultRef }, context)
      if (stored.status !== "ok") return stored
      if (stored.value.kind !== "comparison" || digestSfValue(stored.value.result) !== digestSfValue(comparison.value)) return { status: "stale", reason: "portfolio-comparison-changed" }
      if (!resultRef) {
        const binding = await input.bindings.bind({ caseRef: selected.caseRef, resultRef: saved.value.resultRef, request: compare, expectedRules: proofs.value }, context)
        if (binding.status !== "ok") return binding
      }
      const binding = await input.bindings.read({ caseRef: selected.caseRef, resultRef: saved.value.resultRef }, context)
      if (binding.status !== "ok") return binding
      if (digestSfValue(binding.value.request) !== requestDigest || digestSfValue(binding.value.rules) !== digestSfValue(proofs.value)) return { status: "stale", reason: "portfolio-criteria-changed" }
      const selectionAgain = await input.select(request, context)
      if (selectionAgain.status !== "ok" || digestSfValue(selectionAgain.value) !== digestSfValue(selected)) return { status: "stale", reason: "portfolio-selection-changed" }
      const compared = stored.value.result
      return { status: "ok", value: { analysis: { scenarioResultRef: selected.alternativeRef, scenario: scenario.value.result, comparisonRef: saved.value.resultRef, comparison: compared }, constraints: compare.criteria.map((ref) => { const criterion = compared.criterionResults.find((item) => item.criterionId === ref)!; return { ref, state: criterion.state, reason: criterion.reason } }) } }
    },
    revalidate: async (analysis, context) => {
      const stored = await input.results.read({ kind: "comparison", resultRef: analysis.comparisonRef }, context)
      if (stored.status !== "ok" || stored.value.kind !== "comparison" || digestSfValue(stored.value.result) !== digestSfValue(analysis.comparison)) return false
      const binding = await input.bindings.read({ caseRef: stored.value.caseRef, resultRef: analysis.comparisonRef }, context)
      if (binding.status !== "ok") return false
      const current = await input.planner.compareScenarios(binding.value.request, context)
      return current.status === "ok" && digestSfValue(current.value) === digestSfValue(analysis.comparison) && (await input.bindings.read({ caseRef: stored.value.caseRef, resultRef: analysis.comparisonRef }, context)).status === "ok"
    },
  }
}
