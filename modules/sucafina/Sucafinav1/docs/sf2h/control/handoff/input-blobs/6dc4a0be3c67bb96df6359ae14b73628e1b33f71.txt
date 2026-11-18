import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CostCoverageBasis, ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import { plannerCoverageComplete } from "./coverage.ts"

/** Compare already-authorized, current scenario results without recalculating the domain. */
export function comparePlannerScenarios(input: { baselineRef: string; alternativeRef: string; baselineCoverageRef: string; alternativeCoverageRef: string; baseline: ScenarioResult; alternative: ScenarioResult; baselineProof?: { basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> }; alternativeProof?: { basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> } }): ScenarioComparison {
  const base = { baselineResultRef: input.baselineRef, alternativeResultRef: input.alternativeRef, costCoverageRefs: [input.baselineCoverageRef, input.alternativeCoverageRef], criterionResults: [] }
  if (![input.baselineRef, input.alternativeRef, input.baselineCoverageRef, input.alternativeCoverageRef].every((value) => value.trim()))
    return { ...base, comparisonStatus: "unavailable", knownDifference: null, completeDifference: null, unresolvedConditions: ["missing-reference"] }
  if (input.baseline.currency !== input.alternative.currency || input.baseline.horizon.start !== input.alternative.horizon.start || input.baseline.horizon.end !== input.alternative.horizon.end)
    return { ...base, comparisonStatus: "incompatible", knownDifference: null, completeDifference: null, unresolvedConditions: ["currency-or-horizon-mismatch"] }
  if (input.baseline.comparisonStatus === "unavailable" || input.alternative.comparisonStatus === "unavailable")
    return { ...base, comparisonStatus: "unavailable", knownDifference: null, completeDifference: null, unresolvedConditions: ["scenario-unavailable"] }
  if (input.baseline.comparisonStatus === "incompatible" || input.alternative.comparisonStatus === "incompatible")
    return { ...base, comparisonStatus: "incompatible", knownDifference: null, completeDifference: null, unresolvedConditions: ["scenario-incompatible"] }
  const knownDifference = input.baseline.knownSubtotal === null || input.alternative.knownSubtotal === null ? null : input.alternative.knownSubtotal - input.baseline.knownSubtotal
  if (input.baselineProof && input.alternativeProof && plannerCoverageComplete(input.baselineProof.basis, input.baseline.costCoverage, input.baselineProof.projection, input.baselineProof.source) && plannerCoverageComplete(input.alternativeProof.basis, input.alternative.costCoverage, input.alternativeProof.projection, input.alternativeProof.source) && plannerComponentDigest(input.baseline.components) === plannerComponentDigest(input.baselineProof.projection.components) && plannerComponentDigest(input.alternative.components) === plannerComponentDigest(input.alternativeProof.projection.components) && input.baseline.comparisonStatus === "complete" && input.alternative.comparisonStatus === "complete" && input.baseline.costCoverage.basisId === input.alternative.costCoverage.basisId && input.baseline.costCoverage.basisVersion === input.alternative.costCoverage.basisVersion && !input.baseline.unresolvedConditions.length && !input.alternative.unresolvedConditions.length && !input.baseline.restrictions.length && !input.alternative.restrictions.length && [...input.baseline.components, ...input.alternative.components].every((component) => component.amount !== null && Number.isFinite(component.amount) && component.evidenceState === "confirmed") && input.baseline.total === input.baseline.knownSubtotal && input.alternative.total === input.alternative.knownSubtotal && input.baseline.total === input.baseline.components.reduce((sum, component) => sum + (component.amount ?? 0), 0) && input.alternative.total === input.alternative.components.reduce((sum, component) => sum + (component.amount ?? 0), 0))
    return { ...base, comparisonStatus: "complete", knownDifference: input.alternative.total - input.baseline.total, completeDifference: input.alternative.total - input.baseline.total, unresolvedConditions: [] }
  return { ...base, comparisonStatus: "conditioned", knownDifference, completeDifference: null, unresolvedConditions: [...new Set([...input.baseline.unresolvedConditions, ...input.alternative.unresolvedConditions, "comparison-requires-complete-current-coverage"])] }
}

/** A read timestamp is not part of a component's financial or source identity. */
export function plannerComponentDigest(components: DomainProjection["components"]) {
  return digestSfValue(components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) })))
}
