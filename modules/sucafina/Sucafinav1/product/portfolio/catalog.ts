import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { portfolioCandidateRef } from "./candidates.ts"

/** Disclose only current alternatives from cases the caller can already read. */
export function createPortfolioCatalog(input: { cases: DecisionCasePort; revalidate: (context: TrustedDomainContext) => Promise<boolean> }) {
  return async (request: { caseRefs: readonly string[] }, context: TrustedDomainContext) => {
    if (!request.caseRefs.length || request.caseRefs.length > 64 || new Set(request.caseRefs).size !== request.caseRefs.length || request.caseRefs.some((ref) => !ref.trim())) return { status: "needs-input", reason: "invalid-portfolio-cases" } as const
    if (!await input.revalidate(context)) return { status: "denied", reason: "invalid-binding" } as const
    const current = await Promise.all(request.caseRefs.map((caseRef) => input.cases.read({ caseRef }, context)))
    const failure = current.find((item) => item.status !== "ok")
    if (failure && failure.status !== "ok") return failure
    const entries = current.flatMap((item, index) => {
      if (item.status !== "ok") return []
      const decision = item.value.case
      return [{ caseRef: request.caseRefs[index], caseVersion: decision.version, objective: decision.objective, horizon: decision.horizon, currency: decision.currency, criteria: decision.criteria, alternatives: decision.alternatives.map((alternative) => ({ candidateRef: portfolioCandidateRef({ caseRef: request.caseRefs[index], caseVersion: decision.version, alternativeId: alternative.id, alternativeVersion: alternative.version }), alternativeId: alternative.id, alternativeVersion: alternative.version, title: alternative.title, operations: alternative.scenario.operations, assumptions: alternative.scenario.assumptions, comparisonStatus: alternative.result.comparisonStatus, costCoverage: alternative.result.costCoverage })) }]
    })
    const again = await Promise.all(request.caseRefs.map((caseRef) => input.cases.read({ caseRef }, context)))
    if (again.some((item, index) => { const before = current[index]; return item.status !== "ok" || !before || before.status !== "ok" || digestSfValue(item.value.case) !== digestSfValue(before.value.case) }) || !await input.revalidate(context)) return { status: "stale", reason: "portfolio-catalog-changed" } as const
    return { status: "ok", value: { cases: entries, explorationLimit: { minimum: 1, maximum: 1024 }, parameterBounds: { state: "unavailable" as const, reason: "domain-bounds-not-declared" } } } as const
  }
}
