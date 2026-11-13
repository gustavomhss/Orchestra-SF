import { requiredSfCostCategories } from "../contracts/coverage-inventory.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { CostCoverageAssessment, CostCoverageBasis } from "../contracts/decisions.ts"

/** Structural checks complement the host's current-evidence authorization. */
export function plannerCoverageComplete(basis: CostCoverageBasis, assessment: CostCoverageAssessment, projection: DomainProjection, source: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  const categories = requiredSfCostCategories(basis)
  if (!categories || assessment.coverageState !== "complete" || assessment.basisId !== basis.id || assessment.basisVersion !== basis.version || assessment.currency !== projection.context.currency || assessment.horizon.start !== projection.context.period.start || assessment.horizon.end !== projection.context.period.end || assessment.derivedMissingCategoryIds.length || assessment.issues.length || projection.missing.length) return false
  if (!assessment.evaluatedSourceRefs.some((ref) => ref.kind === "record" && ref.installationId === source.installationId && ref.projectId === source.projectId && ref.refId === source.refId && ref.refDigest === source.refDigest && ref.target.surface === "planner" && ref.target.recordId === source.target.recordId && ref.target.incarnation === source.target.incarnation && ref.target.version === source.target.version && ref.target.projectionDigest === source.target.projectionDigest)) return false
  if (assessment.entries.length !== categories.length || new Set(assessment.entries.map((entry) => entry.categoryId)).size !== categories.length || !categories.every((category) => assessment.entries.some((entry) => entry.categoryId === category))) return false
  if (projection.components.some((component) => component.amount === null || !Number.isFinite(component.amount) || component.evidenceState !== "confirmed" || component.currency !== projection.context.currency || component.period.start < projection.context.period.start || component.period.end > projection.context.period.end)) return false
  if (projection.components.some((component) => !assessment.entries.some((entry) => entry.status === "included" && entry.componentRefs.includes(component.id)))) return false
  return assessment.entries.every((entry) => {
    if (!entry.evidenceRefs.length) return false
    if (entry.status === "not-applicable") return !!entry.justification.trim()
    if (!entry.scopeNote.trim() || !entry.componentRefs.length) return false
    return entry.componentRefs.every((id) => projection.components.some((component) => component.id === id && component.amount !== null && component.evidenceState === "confirmed"))
  })
}
