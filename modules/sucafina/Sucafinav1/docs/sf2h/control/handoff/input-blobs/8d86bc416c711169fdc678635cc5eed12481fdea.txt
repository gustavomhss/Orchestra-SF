import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { ScenarioComparison } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import { encodeCaseRef } from "./case-port.ts"
import { createDecisionScenarioLookup } from "./scenario-lookup.ts"

/** Resolve the user's selected case alternatives to stored, authorized C08 results. */
export function createDecisionComparisonService(input: {
  cases: DecisionCasePort
  state: SfProductStatePort
  results: ReturnType<typeof createSfDecisionResultStore>
  planner: Pick<PlannerPort, "compareScenarios">
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
}) {
  const lookup = createDecisionScenarioLookup(input)
  return async (request: { caseRef: { id: string; incarnation: string; version: number }; baselineAlternativeId: string; alternativeId: string; criteria: readonly string[] }, context: TrustedDomainContext): Promise<PortResult<{ request: ScenarioCompareRequest; comparison: ScenarioComparison }>> => {
    try {
      if (!request.baselineAlternativeId.trim() || !request.alternativeId.trim() || request.baselineAlternativeId === request.alternativeId || new Set(request.criteria).size !== request.criteria.length) return { status: "needs-input", reason: "invalid-comparison-selection" }
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-access-unavailable" }
      const current = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version || current.value.case.criteria.some((criterion) => criterion.required && !request.criteria.includes(criterion.id)) || request.criteria.some((criterion) => !current.value.case.criteria.some((item) => item.id === criterion))) return { status: "stale", reason: "case-or-criteria-changed" }
      const alternatives = [request.baselineAlternativeId, request.alternativeId].map((id) => current.value.case.alternatives.filter((alternative) => alternative.id === id))
      if (alternatives.some((matches) => matches.length !== 1)) return { status: "unavailable", reason: "alternative-unavailable" }
      const resolved = await Promise.all(alternatives.map((matches) => lookup({ caseRef: request.caseRef, alternativeId: matches[0]!.id, alternativeVersion: matches[0]!.version }, context)))
      if (resolved.some((value) => value.status !== "ok")) return { status: "unavailable", reason: "scenario-results-unavailable" }
      const selected = resolved.flatMap((value) => value.status === "ok" ? [value.value.resultRef] : [])
      if (selected.length !== 2 || selected[0] === selected[1]) return { status: "conflict", reason: "scenario-result-ambiguous" }
      const comparisonRequest = { scenarioRefs: selected, criteria: request.criteria }
      const comparison = await input.planner.compareScenarios(comparisonRequest, context)
      if (comparison.status !== "ok") return comparison
      if (comparison.value.baselineResultRef !== selected[0] || comparison.value.alternativeResultRef !== selected[1]) return { status: "conflict", reason: "comparison-reference-mismatch" }
      const again = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const resolvedAgain = await Promise.all(alternatives.map((matches) => lookup({ caseRef: request.caseRef, alternativeId: matches[0]!.id, alternativeVersion: matches[0]!.version }, context)))
      if (again.status !== "ok" || again.value.case.version !== request.caseRef.version || digestSfValue(again.value.case.alternatives) !== digestSfValue(current.value.case.alternatives) || resolvedAgain.some((value, index) => digestSfValue(value) !== digestSfValue(resolved[index])) || !await input.host.revalidate(context)) return { status: "stale", reason: "comparison-source-changed" }
      return { status: "ok", value: { request: comparisonRequest, comparison: comparison.value } }
    } catch {
      return { status: "unavailable", reason: "comparison-unavailable" }
    }
  }
}
