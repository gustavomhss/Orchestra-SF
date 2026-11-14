import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../contracts/context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"

type Decision = NonNullable<DomainProjection["decision"]>

/** Preserve the producer's coverage and comparison state; never infer a complete result. */
export function validReviewDecision(decision: DomainProjection["decision"]) {
  if (decision === undefined) return true
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return false
  if (decision.kind === "scenario") {
    const sensitivityRef = (decision as typeof decision & { sensitivityResultRef?: string }).sensitivityResultRef
    return Object.keys(decision).every((key) => ["kind", "scenarioResultRef", "scenario", "comparisonRef", "comparison", "sensitivity", "sensitivityResultRef"].includes(key)) && !!decision.scenarioResultRef && !!decision.comparisonRef && decodeSfOperationOutput("sf_scenario_simulate", decision.scenario).ok && decodeSfOperationOutput("sf_scenario_compare", decision.comparison).ok && (decision.comparison.baselineResultRef === decision.scenarioResultRef || decision.comparison.alternativeResultRef === decision.scenarioResultRef) && (decision.comparison.comparisonStatus !== "complete" || decision.scenario.comparisonStatus === "complete") && (decision.sensitivity ? typeof sensitivityRef === "string" && !!sensitivityRef.trim() && decodeSfOperationOutput("sf_sensitivity_evaluate", decision.sensitivity).ok : sensitivityRef === undefined)
  }
  if (decision.kind === "portfolio") return Object.keys(decision).every((key) => ["kind", "portfolioResultRef", "portfolio"].includes(key)) && !!decision.portfolioResultRef && decodeSfOperationOutput("sf_portfolio_evaluate", decision.portfolio).ok && decision.portfolio.combinations.every((combination) => !combination.analysis || ((combination.analysis.comparison.baselineResultRef === combination.analysis.scenarioResultRef || combination.analysis.comparison.alternativeResultRef === combination.analysis.scenarioResultRef) && (combination.analysis.comparison.comparisonStatus !== "complete" || combination.analysis.scenario.comparisonStatus === "complete") && (combination.eligibility !== "eligible-complete" || (combination.analysis.scenario.comparisonStatus === "complete" && combination.analysis.comparison.comparisonStatus === "complete"))))
  return false
}

export function reviewDecisionEvidence(decision: DomainProjection["decision"]): readonly BusinessEvidenceRef[] {
  if (!decision) return []
  const scenarios = decision.kind === "scenario" ? [decision.scenario] : decision.portfolio.combinations.flatMap((item) => item.analysis ? [item.analysis.scenario] : [])
  const sensitivity = decision.kind === "scenario" ? decision.sensitivity : undefined
  return [
    ...(decision.kind === "portfolio" ? decision.portfolio.evidenceRefs : []),
    ...scenarios.flatMap((scenario) => [...scenario.sourceRefs, ...scenario.costCoverage.evaluatedSourceRefs, ...scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]),
    ...(sensitivity ? [...sensitivity.evidenceRefs, ...sensitivity.unresolvedConditions.flatMap((condition) => condition.evidenceRefs), ...(sensitivity.thresholdEvidence.state === "unavailable" ? [] : sensitivity.thresholdEvidence.evidenceRefs)] : []),
  ]
}

export function reviewDecisionSources(decision: DomainProjection["decision"]): readonly SourceRef[] {
  if (!decision) return []
  if (decision.kind === "scenario") return decision.scenario.components.flatMap((component) => component.sourceRefs)
  return decision.portfolio.combinations.flatMap((item) => [...item.components.flatMap((component) => component.sourceRefs), ...(item.analysis?.scenario.components.flatMap((component) => component.sourceRefs) ?? [])])
}

export function reviewDecisionLines(decision: Decision): string[] {
  const scenarioLines = (scenario: ScenarioResult) => [
    `Scenario ${scenario.id} v${scenario.version} · ${scenario.horizon.start} – ${scenario.horizon.end} · ${scenario.currency} · ${scenario.comparisonStatus} · known subtotal ${scenario.knownSubtotal ?? "unavailable"} · total ${scenario.total ?? "unavailable"}`,
    `Coverage ${scenario.costCoverage.basisId} v${scenario.costCoverage.basisVersion}: ${scenario.costCoverage.coverageState} · missing ${scenario.costCoverage.derivedMissingCategoryIds.join(", ") || "none"}`,
    ...scenario.costCoverage.entries.map((entry) => `Cost category ${entry.categoryId}: ${entry.status}${entry.status === "pending" ? ` · ${entry.reason}` : entry.status === "not-applicable" ? ` · ${entry.justification}` : ` · ${entry.scopeNote}`}`),
    ...scenario.components.map((component) => `Component ${component.id}: ${component.amount ?? "unavailable"} ${component.currency} · ${component.period.start} – ${component.period.end} · ${component.evidenceState} · sources ${component.sourceRefs.map((ref) => `${ref.surface}:${ref.type}:${ref.id}@${ref.version}`).join(", ") || "unavailable"}`),
    ...scenario.sourceRefs.map((ref) => `Decision source: ${ref.refId}`),
    ...scenario.costCoverage.issues, ...scenario.unresolvedConditions, ...scenario.restrictions,
  ]
  if (decision.kind === "scenario") return [
    `Decision scenario ${decision.scenarioResultRef} · comparison ${decision.comparisonRef}`,
    ...scenarioLines(decision.scenario),
    `Comparison ${decision.comparison.comparisonStatus} · known difference ${decision.comparison.knownDifference ?? "unavailable"}`,
    `Complete difference: ${decision.comparison.completeDifference ?? "unavailable"}`,
    ...decision.comparison.costCoverageRefs.map((ref) => `Coverage reference: ${ref}`), ...decision.comparison.unresolvedConditions,
    ...decision.comparison.criterionResults.map((item) => `${item.criterionId}: ${item.state} · ${item.reason}`),
  ]
  return [`Portfolio ${decision.portfolioResultRef}`, ...decision.portfolio.limitations, ...decision.portfolio.combinations.flatMap((item) => [
    `Combination ${item.id} · ${item.eligibility} · ${item.comparisonStatus}`,
    ...item.costCoverageRefs.map((ref) => `Coverage reference: ${ref}`), ...item.conflicts, ...item.restrictions,
    ...(item.analysis ? [`Scenario ${item.analysis.scenarioResultRef} · comparison ${item.analysis.comparisonRef}`, ...scenarioLines(item.analysis.scenario), `Comparison ${item.analysis.comparison.comparisonStatus} · known difference ${item.analysis.comparison.knownDifference ?? "unavailable"}`, `Complete difference: ${item.analysis.comparison.completeDifference ?? "unavailable"}`, ...item.analysis.comparison.unresolvedConditions] : []),
  ])]
}

