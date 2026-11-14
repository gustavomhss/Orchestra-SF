import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDecisionPortfolioSelection } from "../decisions/portfolio-selection.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { createPortfolioAnalysis } from "./analysis.ts"

/** Use only the currently authorized human selection for the exact candidate scenario. */
export function createPortfolioSelectionResolver(input: {
  selection: ReturnType<typeof createDecisionPortfolioSelection>
  results: ReturnType<typeof createSfDecisionResultStore>
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
}): Parameters<typeof createPortfolioAnalysis>[0]["select"] {
  return async (request, context) => {
    const caseRef = await input.caseFor(context)
    if (caseRef.status !== "ok") return caseRef
    const selection = await input.selection.read({ caseRef: caseRef.value }, context)
    if (selection.status === "needs-input" && selection.reason === "selection-not-created") return { status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" }
    if (selection.status !== "ok") return selection
    if (digestSfValue(selection.value.caseRef) !== digestSfValue(caseRef.value)) return { status: "stale", reason: "portfolio-selection-changed" }
    const alternative = await input.results.readHistoricalScenario({ resultRef: selection.value.alternativeRef }, context)
    if (alternative.status !== "ok") return alternative
    const baseline = await input.results.readHistoricalScenario({ resultRef: selection.value.baselineRef }, context)
    if (baseline.status !== "ok") return baseline
    if (baseline.value.kind !== "scenario" || baseline.value.resultRef !== selection.value.baselineRef || baseline.value.caseRef.id !== caseRef.value.id || baseline.value.caseRef.incarnation !== caseRef.value.incarnation || baseline.value.caseRef.version > caseRef.value.version) return { status: "stale", reason: "portfolio-selection-changed" }
    if (alternative.value.kind !== "scenario" || alternative.value.resultRef !== selection.value.alternativeRef || alternative.value.caseRef.id !== caseRef.value.id || alternative.value.caseRef.incarnation !== caseRef.value.incarnation || alternative.value.caseRef.version > caseRef.value.version) return { status: "stale", reason: "portfolio-alternative-changed" }
    if (alternative.value.requestDigest !== digestSfValue(request.scenario)) return { status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" }
    if (digestSfValue(selection.value.criteria) !== digestSfValue(request.portfolio.constraints)) return { status: "needs-input", reason: "portfolio-selection-criteria-mismatch" }
    const current = await input.selection.read({ caseRef: caseRef.value }, context)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(selection.value)) return { status: "stale", reason: "portfolio-selection-changed" }
    return { status: "ok", value: { caseRef: caseRef.value, baselineRef: selection.value.baselineRef, alternativeRef: selection.value.alternativeRef, selectionDigest: selection.value.selectionDigest, criteria: selection.value.criteria } }
  }
}
