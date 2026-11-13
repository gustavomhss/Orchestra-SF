import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioPort } from "./port.ts"
import type { createPortfolioResultBindings } from "../decisions/portfolio-bindings.ts"
import { plannerComponentDigest } from "../planner/comparison.ts"
import { plannerScenarioDigest } from "../planner/preview-comparison.ts"

/** Persist real producer results through the cases-owned C08 store; never mint references here. */
export function createPersistentPortfolioPort(input: {
  portfolio: PortfolioPort
  bindings?: ReturnType<typeof createPortfolioResultBindings>
  requireBindings?: boolean
  results: ReturnType<typeof createSfDecisionResultStore> & { readByRequest?: (request: { caseRef: { id: string; incarnation: string; version: number }; kind: "portfolio"; idempotencyKey: string; requestDigest: string }, context: TrustedDomainContext) => Promise<PortResult<{ state: "found"; result: import("../decisions/result-store.ts").StoredDecisionResult } | { state: "not-found" }>>; readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
  revalidatePortfolio?: (portfolio: PortfolioResult, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => Promise<boolean>
  revalidateAnalysis?: (analysis: NonNullable<PortfolioResult["combinations"][number]["analysis"]>, context: TrustedDomainContext) => Promise<boolean>
}) {
  const validateAnalysis = async (portfolio: PortfolioResult, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext): Promise<PortResult<readonly BusinessEvidenceRef[]>> => {
    const refs: BusinessEvidenceRef[] = []
    const ownerRef = `case:${encodeURIComponent(caseRef.id)}:${encodeURIComponent(caseRef.incarnation)}`
    if (portfolio.combinations.some((combination) => combination.caseRefs.some((ref) => ref !== ownerRef))) {
      if (!input.bindings && !input.revalidatePortfolio) return { status: "unavailable", reason: "portfolio-candidate-validation-unavailable" }
      if (input.revalidatePortfolio && !await input.revalidatePortfolio(portfolio, caseRef, context)) return { status: "stale", reason: "portfolio-candidate-changed" }
    }
    for (const combination of portfolio.combinations) {
      if (!combination.analysis) continue
      const scenario = input.results.readHistoricalScenario ? await input.results.readHistoricalScenario({ resultRef: combination.analysis.scenarioResultRef }, context) : await input.results.read({ kind: "scenario", resultRef: combination.analysis.scenarioResultRef }, context)
      if (scenario.status !== "ok") return scenario
      const comparison = await input.results.read({ kind: "comparison", resultRef: combination.analysis.comparisonRef }, context)
      if (comparison.status !== "ok") return comparison
      refs.push(...scenario.value.sourceRefs, ...comparison.value.sourceRefs)
      if (scenario.value.kind !== "scenario" || comparison.value.kind !== "comparison" || (digestSfValue(scenario.value.caseRef) !== digestSfValue(caseRef) && !combination.caseRefs.includes(`case:${encodeURIComponent(scenario.value.caseRef.id)}:${encodeURIComponent(scenario.value.caseRef.incarnation)}`)) || (comparison.value.caseRef.id !== scenario.value.caseRef.id || comparison.value.caseRef.incarnation !== scenario.value.caseRef.incarnation || comparison.value.caseRef.version < scenario.value.caseRef.version) || digestSfValue(scenario.value.result) !== digestSfValue(combination.analysis.scenario) || digestSfValue(comparison.value.result) !== digestSfValue(combination.analysis.comparison) || comparison.value.result.alternativeResultRef !== scenario.value.resultRef) return { status: "stale", reason: "portfolio-analysis-changed" }
      if (!input.bindings || !input.revalidateAnalysis) return { status: "unavailable", reason: "portfolio-analysis-validation-unavailable" }
      if (!await input.revalidateAnalysis(combination.analysis, context)) return { status: "stale", reason: "portfolio-analysis-changed" }
    }
    return { status: "ok", value: refs.filter((ref, index) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index) }
  }
  const read = async (resultRef: string, context: TrustedDomainContext) => {
    const result = await input.results.read({ kind: "portfolio", resultRef }, context)
    if (result.status !== "ok") return result
    if (result.value.kind !== "portfolio" || result.value.resultRef !== resultRef) return { status: "unavailable", reason: "portfolio-reference-mismatch" } as const
    if (input.requireBindings && !input.bindings) return { status: "unavailable", reason: "portfolio-binding-unavailable" } as const
    if (input.bindings) {
      const binding = await input.bindings.read({ caseRef: result.value.caseRef, resultRef }, context)
      if (binding.status !== "ok") return binding
    }
    const analysis = await validateAnalysis(result.value.result, result.value.caseRef, context)
    if (analysis.status !== "ok") return analysis
    const latest = await input.results.read({ kind: "portfolio", resultRef }, context)
    if (latest.status !== "ok") return latest
    if (latest.value.kind !== "portfolio" || digestSfValue(latest.value) !== digestSfValue(result.value)) return { status: "stale", reason: "portfolio-result-changed" } as const
    if (input.bindings) {
      const binding = await input.bindings.read({ caseRef: latest.value.caseRef, resultRef }, context)
      if (binding.status !== "ok") return binding
    }
    const finalAnalysis = await validateAnalysis(latest.value.result, latest.value.caseRef, context)
    if (finalAnalysis.status !== "ok") return finalAnalysis
    return { status: "ok", value: { portfolioResultRef: latest.value.resultRef, portfolio: latest.value.result, caseRef: latest.value.caseRef } } as const
  }
  return {
    read,
    evaluateAndStore: async (request: PortfolioRequest, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext): Promise<PortResult<{ portfolioResultRef: string; portfolio: PortfolioResult; caseRef: typeof caseRef }>> => {
      if (input.requireBindings && !input.bindings) return { status: "unavailable", reason: "portfolio-binding-unavailable" }
      const requestDigest = digestSfValue(request)
      const key = await input.idempotencyKey(requestDigest, context)
      if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" }
      const proof = input.bindings ? await input.bindings.proofs({ caseRef, request }, context) : undefined
      if (proof && proof.status !== "ok") return proof
      const evaluated = await input.portfolio.evaluate(request, context)
      if (evaluated.status !== "ok") return evaluated
      const analysis = await validateAnalysis(evaluated.value, caseRef, context)
      if (analysis.status !== "ok") return analysis
      const sourceRefs = [...evaluated.value.evidenceRefs, ...analysis.value].filter((ref, index, refs) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
      const existing = input.results.readByRequest ? await input.results.readByRequest({ kind: "portfolio", caseRef, requestDigest, idempotencyKey: key }, context) : undefined
      if (existing && existing.status !== "ok") return existing
      const saved = existing?.status === "ok" && existing.value.state === "found" ? { status: "ok" as const, value: existing.value.result } : await input.results.write({ kind: "portfolio", result: evaluated.value, caseRef, requestDigest, sourceRefs, idempotencyKey: key }, context)
      if (saved.status !== "ok") return saved
      if (saved.value.kind !== "portfolio" || saved.value.requestDigest !== requestDigest || digestSfValue(saved.value.caseRef) !== digestSfValue(caseRef) || portfolioResultDigest(saved.value.result) !== portfolioResultDigest(evaluated.value)) return { status: "conflict", reason: "portfolio-result-mismatch" }
      if (input.bindings && proof?.status === "ok" && !(existing?.status === "ok" && existing.value.state === "found")) {
        const binding = await input.bindings.bind({ caseRef, resultRef: saved.value.resultRef, request, expectedProof: proof.value }, context)
        if (binding.status !== "ok") return binding
      }
      return read(saved.value.resultRef, context)
    },
  }
}

export function portfolioResultDigest(portfolio: PortfolioResult) {
  return digestSfValue({ ...portfolio, combinations: portfolio.combinations.map((combination) => ({ ...combination, components: plannerComponentDigest(combination.components), ...(combination.analysis ? { analysis: { ...combination.analysis, scenario: plannerScenarioDigest(combination.analysis.scenario) } } : {}) })) })
}
