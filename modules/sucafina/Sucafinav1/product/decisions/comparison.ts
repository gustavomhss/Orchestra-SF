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
    const comparisonProbeStarted = performance.now()
    const comparisonProbe = (phase: string, status?: string) => console.info("MIGRATION_COMPARE_DOMAIN_DIAGNOSTIC", JSON.stringify({
      phase, ms: Math.round(performance.now() - comparisonProbeStarted), clockMs: Math.round(performance.now()),
      ...(status === undefined ? {} : { status }), qualification: false,
    }))
    comparisonProbe("entered")
    try {
      if (!request.baselineAlternativeId.trim() || !request.alternativeId.trim() || request.baselineAlternativeId === request.alternativeId || new Set(request.criteria).size !== request.criteria.length) return { status: "needs-input", reason: "invalid-comparison-selection" }
      const source = input.host.requestFor(context)
      comparisonProbe("first-revalidate-start")
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-access-unavailable" }
      comparisonProbe("first-revalidate-finished")
      comparisonProbe("case-read-start")
      const current = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      comparisonProbe("case-read-finished", current.status)
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version || current.value.case.criteria.some((criterion) => criterion.required && !request.criteria.includes(criterion.id)) || request.criteria.some((criterion) => !current.value.case.criteria.some((item) => item.id === criterion))) return { status: "stale", reason: "case-or-criteria-changed" }
      const alternatives = [request.baselineAlternativeId, request.alternativeId].map((id) => current.value.case.alternatives.filter((alternative) => alternative.id === id))
      if (alternatives.some((matches) => matches.length !== 1)) return { status: "unavailable", reason: "alternative-unavailable" }
      const resolve = (matches: (typeof alternatives)[number]) =>
        lookup({ caseRef: request.caseRef, alternativeId: matches[0]!.id, alternativeVersion: matches[0]!.version }, context)
      comparisonProbe("scenario-lookup-start")
      const resolved = [await resolve(alternatives[0]!), await resolve(alternatives[1]!)]
      comparisonProbe("scenario-lookup-finished")
      if (resolved.some((value) => value.status !== "ok")) return { status: "unavailable", reason: "scenario-results-unavailable" }
      const selected = resolved.flatMap((value) => value.status === "ok" ? [value.value.resultRef] : [])
      if (selected.length !== 2 || selected[0] === selected[1]) return { status: "conflict", reason: "scenario-result-ambiguous" }
      const comparisonRequest = { scenarioRefs: selected, criteria: request.criteria }
      comparisonProbe("planner-compare-start")
      const comparison = await input.planner.compareScenarios(comparisonRequest, context)
      comparisonProbe("planner-compare-finished", comparison.status)
      if (comparison.status !== "ok") return comparison
      if (comparison.value.baselineResultRef !== selected[0] || comparison.value.alternativeResultRef !== selected[1]) return { status: "conflict", reason: "comparison-reference-mismatch" }
      comparisonProbe("case-reread-start")
      const again = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      comparisonProbe("case-reread-finished", again.status)
      comparisonProbe("scenario-relookup-start")
      const resolvedAgain = [await resolve(alternatives[0]!), await resolve(alternatives[1]!)]
      comparisonProbe("scenario-relookup-finished")
      comparisonProbe("final-fence-start")
      if (again.status !== "ok" || again.value.case.version !== request.caseRef.version || digestSfValue(again.value.case.alternatives) !== digestSfValue(current.value.case.alternatives) || resolvedAgain.some((value, index) => digestSfValue(value) !== digestSfValue(resolved[index])) || !await input.host.revalidate(context)) return { status: "stale", reason: "comparison-source-changed" }
      comparisonProbe("final-fence-finished")
      return { status: "ok", value: { request: comparisonRequest, comparison: comparison.value } }
    } catch {
      comparisonProbe("exception")
      return { status: "unavailable", reason: "comparison-unavailable" }
    } finally {
      comparisonProbe("left")
    }
  }
}
