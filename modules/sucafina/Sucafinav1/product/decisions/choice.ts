import { requiredSfCostCategories } from "../contracts/coverage-inventory.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioComparison } from "../contracts/decisions.ts"

/** Takes an already-authorized, domain-produced comparison and freezes the chosen basis. */
export function createChoiceSnapshot(input: {
  case: DecisionCase
  alternativeId: string
  alternativeVersion: number
  comparison: ScenarioComparison
  criteria: readonly string[]
  values: ChoiceRecord["values"]
  evidenceRefs: readonly BusinessEvidenceRef[]
  id: string
  principalRef: string
  reason: string
  at: string
}): { status: "ok"; choice: ChoiceRecord } | { status: "conflict"; reason: string } {
  const alternative = input.case.alternatives.find((item) => item.id === input.alternativeId && item.version === input.alternativeVersion)
  if (!alternative || input.case.choices.some((choice) => choice.id === input.id) || !input.id.trim() || !input.principalRef.trim() || !input.reason.trim() || !Number.isFinite(Date.parse(input.at))) return { status: "conflict", reason: "invalid-choice-basis" }
  if (!input.criteria.length || new Set(input.criteria).size !== input.criteria.length || input.case.criteria.some((criterion) => criterion.required && !input.criteria.includes(criterion.id)) || input.criteria.some((id) => !input.case.criteria.some((criterion) => criterion.id === id)) || input.values.some((value) => !input.criteria.includes(value.criterionRef) || (value.value !== null && !Number.isFinite(value.value)) || value.currency !== input.case.currency || value.horizon.start !== input.case.horizon.start || value.horizon.end !== input.case.horizon.end)) return { status: "conflict", reason: "invalid-choice-criteria" }
  if (input.comparison.alternativeResultRef !== alternative.result.id) return { status: "conflict", reason: "comparison-alternative-mismatch" }
  const basis = input.case.costCoverageBases.find((item) => item.id === alternative.result.costCoverage.basisId && item.version === alternative.result.costCoverage.basisVersion)
  if (!basis) return { status: "conflict", reason: "coverage-inventory-unavailable" }
  if (alternative.result.currency !== input.case.currency || alternative.result.horizon.start !== input.case.horizon.start || alternative.result.horizon.end !== input.case.horizon.end) return { status: "conflict", reason: "scenario-basis-mismatch" }
  if (alternative.result.costCoverage.alternativeId !== alternative.id || alternative.result.costCoverage.alternativeVersion !== alternative.version) return { status: "conflict", reason: "coverage-basis-mismatch" }
  const base = structuredClone({ id: input.id, alternativeId: alternative.id, alternativeVersion: alternative.version, basisVersion: alternative.result.costCoverage.basisVersion, scenario: alternative.scenario, result: alternative.result, comparison: input.comparison, criteria: input.criteria, values: input.values, evidenceRefs: [...input.evidenceRefs, ...alternative.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs), ...alternative.result.sourceRefs].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index), principalRef: input.principalRef, reason: input.reason, at: input.at })
  if (input.comparison.comparisonStatus === "complete") {
    const categories = requiredSfCostCategories(basis)
    if (!categories || !basis.sourceRefs.length || basis.sourceRefs.some((ref) => !alternative.result.costCoverage.evaluatedSourceRefs.some((item) => item.refDigest === ref.refDigest)) || alternative.result.comparisonStatus !== "complete" || alternative.result.costCoverage.coverageState !== "complete" || alternative.result.costCoverage.entries.length !== categories.length || categories.some((category) => alternative.result.costCoverage.entries.filter((entry) => entry.categoryId === category).length !== 1) || alternative.result.total !== alternative.result.knownSubtotal || alternative.result.components.some((component) => component.amount === null || !Number.isFinite(component.amount) || component.evidenceState !== "confirmed" || component.currency !== alternative.result.currency || !component.sourceRefs.length) || input.comparison.completeDifference !== input.comparison.knownDifference) return { status: "conflict", reason: "comparison-coverage-mismatch" }
    return { status: "ok", choice: { ...base, comparisonStatus: "complete", costCoverage: structuredClone(alternative.result.costCoverage) } }
  }
  return { status: "ok", choice: { ...base, comparisonStatus: input.comparison.comparisonStatus, costCoverage: structuredClone(alternative.result.costCoverage) } }
}
