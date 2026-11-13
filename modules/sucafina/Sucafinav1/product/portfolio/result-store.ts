import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioPort } from "./port.ts"

/** Persist real producer results through the cases-owned C08 store; never mint references here. */
export function createPersistentPortfolioPort(input: {
  portfolio: PortfolioPort
  results: ReturnType<typeof createSfDecisionResultStore>
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}) {
  const validateAnalysis = async (portfolio: PortfolioResult, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext): Promise<PortResult<readonly BusinessEvidenceRef[]>> => {
    const refs: BusinessEvidenceRef[] = []
    for (const combination of portfolio.combinations) {
      if (!combination.analysis) continue
      const scenario = await input.results.read({ kind: "scenario", resultRef: combination.analysis.scenarioResultRef }, context)
      if (scenario.status !== "ok") return scenario
      const comparison = await input.results.read({ kind: "comparison", resultRef: combination.analysis.comparisonRef }, context)
      if (comparison.status !== "ok") return comparison
      refs.push(...scenario.value.sourceRefs, ...comparison.value.sourceRefs)
      if (scenario.value.kind !== "scenario" || comparison.value.kind !== "comparison" || (digestSfValue(scenario.value.caseRef) !== digestSfValue(caseRef) && !combination.caseRefs.includes(`case:${encodeURIComponent(scenario.value.caseRef.id)}:${encodeURIComponent(scenario.value.caseRef.incarnation)}`)) || digestSfValue(comparison.value.caseRef) !== digestSfValue(scenario.value.caseRef) || digestSfValue(scenario.value.result) !== digestSfValue(combination.analysis.scenario) || digestSfValue(comparison.value.result) !== digestSfValue(combination.analysis.comparison) || comparison.value.result.alternativeResultRef !== scenario.value.resultRef) return { status: "stale", reason: "portfolio-analysis-changed" }
    }
    return { status: "ok", value: refs.filter((ref, index) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index) }
  }
  const read = async (resultRef: string, context: TrustedDomainContext) => {
    const result = await input.results.read({ kind: "portfolio", resultRef }, context)
    if (result.status !== "ok") return result
    if (result.value.kind !== "portfolio" || result.value.resultRef !== resultRef) return { status: "unavailable", reason: "portfolio-reference-mismatch" } as const
    const analysis = await validateAnalysis(result.value.result, result.value.caseRef, context)
    if (analysis.status !== "ok") return analysis
    const latest = await input.results.read({ kind: "portfolio", resultRef }, context)
    if (latest.status !== "ok") return latest
    if (latest.value.kind !== "portfolio" || digestSfValue(latest.value) !== digestSfValue(result.value)) return { status: "stale", reason: "portfolio-result-changed" } as const
    const finalAnalysis = await validateAnalysis(latest.value.result, latest.value.caseRef, context)
    if (finalAnalysis.status !== "ok") return finalAnalysis
    return { status: "ok", value: { portfolioResultRef: latest.value.resultRef, portfolio: latest.value.result, caseRef: latest.value.caseRef } } as const
  }
  return {
    read,
    evaluateAndStore: async (request: PortfolioRequest, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext): Promise<PortResult<{ portfolioResultRef: string; portfolio: PortfolioResult; caseRef: typeof caseRef }>> => {
      const requestDigest = digestSfValue(request)
      const key = await input.idempotencyKey(requestDigest, context)
      if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" }
      const evaluated = await input.portfolio.evaluate(request, context)
      if (evaluated.status !== "ok") return evaluated
      const analysis = await validateAnalysis(evaluated.value, caseRef, context)
      if (analysis.status !== "ok") return analysis
      const sourceRefs = [...evaluated.value.evidenceRefs, ...analysis.value].filter((ref, index, refs) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
      const saved = await input.results.write({ kind: "portfolio", result: evaluated.value, caseRef, requestDigest, sourceRefs, idempotencyKey: key }, context)
      if (saved.status !== "ok") return saved
      if (saved.value.kind !== "portfolio" || saved.value.requestDigest !== requestDigest || digestSfValue(saved.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(saved.value.result) !== digestSfValue(evaluated.value)) return { status: "conflict", reason: "portfolio-result-mismatch" }
      return read(saved.value.resultRef, context)
    },
  }
}
