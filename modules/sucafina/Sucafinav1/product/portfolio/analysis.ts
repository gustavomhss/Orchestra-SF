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
  const revalidate: Analysis["revalidate"] = async (analysis, context) => {
    const expected = structuredClone(analysis)
    const inspect = async () => {
      const stored = structuredClone(await input.results.read({ kind: "comparison", resultRef: expected.comparisonRef }, context))
      if (stored.status !== "ok" || stored.value.kind !== "comparison" || stored.value.resultRef !== expected.comparisonRef || stored.value.resultDigest !== digestSfValue(expected.comparison) || digestSfValue(stored.value.result) !== stored.value.resultDigest || expected.comparison.alternativeResultRef !== expected.scenarioResultRef || expected.comparison.baselineResultRef === expected.scenarioResultRef) return undefined
      const binding = structuredClone(await input.bindings.read({ caseRef: stored.value.caseRef, resultRef: expected.comparisonRef }, context))
      if (binding.status !== "ok" || binding.value.resultRef !== stored.value.resultRef || binding.value.resultDigest !== stored.value.resultDigest || binding.value.requestDigest !== stored.value.requestDigest || binding.value.requestDigest !== digestSfValue(binding.value.request) || digestSfValue(binding.value.caseRef) !== digestSfValue(stored.value.caseRef) || digestSfValue(binding.value.request.scenarioRefs) !== digestSfValue([expected.comparison.baselineResultRef, expected.scenarioResultRef])) return undefined
      const scenarios = structuredClone(await Promise.all(binding.value.request.scenarioRefs.map((resultRef) => input.results.readHistoricalScenario({ resultRef }, context))))
      if (scenarios.some((item, index) => item.status !== "ok" || item.value.kind !== "scenario" || item.value.resultRef !== binding.value.request.scenarioRefs[index] || item.value.resultDigest !== digestSfValue(item.value.result) || item.value.caseRef.id !== stored.value.caseRef.id || item.value.caseRef.incarnation !== stored.value.caseRef.incarnation || item.value.caseRef.version > stored.value.caseRef.version)) return undefined
      const alternative = scenarios[1]
      if (!alternative || alternative.status !== "ok" || digestSfValue(alternative.value.result) !== digestSfValue(expected.scenario)) return undefined
      return { stored: stored.value, binding: binding.value, scenarios }
    }
    const first = await inspect()
    if (!first) return false
    const replay = await input.planner.compareScenarios(structuredClone(first.binding.request), context)
    if (replay.status !== "ok" || digestSfValue(replay.value) !== first.stored.resultDigest) return false
    const second = await inspect()
    return !!second && digestSfValue(first) === digestSfValue(second)
  }
  return {
    evaluate: async (incoming, context) => {
      const request = structuredClone(incoming)
      const selection = structuredClone(await input.select(structuredClone(request), context))
      if (selection.status !== "ok") return selection
      const selected = selection.value
      if (!selected.baselineRef.trim() || !selected.alternativeRef.trim() || selected.baselineRef === selected.alternativeRef || !/^[a-f0-9]{64}$/.test(selected.selectionDigest) || digestSfValue(selected.criteria) !== digestSfValue(request.portfolio.constraints)) return { status: "needs-input", reason: "portfolio-baseline-selection-required" }
      const scenario = structuredClone(await input.results.readHistoricalScenario({ resultRef: selected.alternativeRef }, context))
      if (scenario.status !== "ok") return scenario
      if (scenario.value.kind !== "scenario" || scenario.value.resultRef !== selected.alternativeRef || scenario.value.resultDigest !== digestSfValue(scenario.value.result) || scenario.value.caseRef.id !== selected.caseRef.id || scenario.value.caseRef.incarnation !== selected.caseRef.incarnation || scenario.value.caseRef.version > selected.caseRef.version || scenario.value.requestDigest !== digestSfValue(request.scenario)) return { status: "stale", reason: "portfolio-alternative-changed" }
      const compare = { scenarioRefs: [selected.baselineRef, selected.alternativeRef], criteria: request.portfolio.constraints }
      const proofs = structuredClone(await input.bindings.proofs(selected.caseRef, compare.criteria, context))
      if (proofs.status !== "ok") return proofs
      const comparison = structuredClone(await input.planner.compareScenarios(structuredClone(compare), context))
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
      const stored = structuredClone(await input.results.read({ kind: "comparison", resultRef: saved.value.resultRef }, context))
      if (stored.status !== "ok") return stored
      if (stored.value.kind !== "comparison" || stored.value.resultRef !== saved.value.resultRef || stored.value.requestDigest !== requestDigest || digestSfValue(stored.value.caseRef) !== digestSfValue(selected.caseRef) || stored.value.resultDigest !== digestSfValue(stored.value.result) || digestSfValue(stored.value.result) !== digestSfValue(comparison.value)) return { status: "stale", reason: "portfolio-comparison-changed" }
      const previousBinding = resultRef ? await input.bindings.read({ caseRef: selected.caseRef, resultRef: saved.value.resultRef }, context) : undefined
      if (!previousBinding || previousBinding.status !== "ok") {
        const binding = await input.bindings.bind({ caseRef: selected.caseRef, resultRef: saved.value.resultRef, request: compare, expectedRules: proofs.value }, context)
        if (binding.status !== "ok") return binding
      }
      const binding = await input.bindings.read({ caseRef: selected.caseRef, resultRef: saved.value.resultRef }, context)
      if (binding.status !== "ok") return binding
      if (digestSfValue(binding.value.request) !== requestDigest || digestSfValue(binding.value.rules) !== digestSfValue(proofs.value)) return { status: "stale", reason: "portfolio-criteria-changed" }
      const selectionAgain = await input.select(request, context)
      if (selectionAgain.status !== "ok" || digestSfValue(selectionAgain.value) !== digestSfValue(selected)) return { status: "stale", reason: "portfolio-selection-changed" }
      const compared = stored.value.result
      const analysis = { scenarioResultRef: selected.alternativeRef, scenario: scenario.value.result, comparisonRef: saved.value.resultRef, comparison: compared }
      if (!await revalidate(analysis, context)) return { status: "stale", reason: "portfolio-analysis-changed" }
      return { status: "ok", value: { analysis, constraints: compare.criteria.map((ref) => { const criterion = compared.criterionResults.find((item) => item.criterionId === ref)!; return { ref, state: criterion.state, reason: criterion.reason } }) } }
    },
    revalidate,
  }
}
