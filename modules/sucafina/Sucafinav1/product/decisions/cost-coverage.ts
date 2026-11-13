import { digestSfValue } from "../contracts/canonical.ts"
import { requiredSfCostCategories } from "../contracts/coverage-inventory.ts"
import type { BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { Period, ProjectionComponent } from "../contracts/context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, CostCoverageEntry } from "../contracts/decisions.ts"

/** Coverage classifies evidence; monetary totals remain the responsibility of the domain engine. */
export function assessCostCoverage(input: {
  basis: CostCoverageBasis
  alternativeId: string
  alternativeVersion: number
  currency: string
  horizon: Period
  entries: readonly CostCoverageEntry[]
  components: readonly ProjectionComponent[]
  evidence: readonly BusinessEvidenceResolution[]
  supports: (entry: Exclude<CostCoverageEntry, { status: "pending" }>, resolutions: readonly BusinessEvidenceResolution[]) => boolean
}): CostCoverageAssessment {
  const categories = requiredSfCostCategories(input.basis)
  const base = { basisId: input.basis.id, basisVersion: input.basis.version, alternativeId: input.alternativeId, alternativeVersion: input.alternativeVersion, currency: input.currency, horizon: input.horizon, evaluatedSourceRefs: input.evidence.filter((item) => item.state === "fresh").map((item) => item.ref) }
  if (!categories) return { ...base, entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], coverageState: "pending" }
  if (input.evidence.some((item) => item.state === "revoked" || item.state === "unavailable")) return { ...base, entries: [], derivedMissingCategoryIds: [], issues: ["evidence-unavailable"], coverageState: "unavailable" }
  const issues: string[] = []
  if (!input.basis.sourceRefs.length || input.basis.sourceRefs.some((ref) => !input.evidence.some((item) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(ref)))) issues.push("basis-evidence-unavailable")
  const missing = categories.filter((category) => !input.entries.some((entry) => entry.categoryId === category))
  const entries: CostCoverageEntry[] = categories.map((categoryId) => {
    const matches = input.entries.filter((entry) => entry.categoryId === categoryId)
    if (!matches.length) return { categoryId, status: "pending", reason: "missing-category" }
    if (matches.length !== 1) return { categoryId, status: "pending", reason: "duplicate-category" }
    const entry = matches[0]!
    if (entry.status === "pending") return entry
    const supported = entry.evidenceRefs.length > 0 && entry.evidenceRefs.every((ref) => input.evidence.some((item) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(ref)))
    if (!supported) return { categoryId, status: "pending", reason: "evidence-unavailable" }
    if (!input.supports(entry, input.evidence)) return { categoryId, status: "pending", reason: "scope-not-supported" }
    if (entry.status === "not-applicable") return entry.justification.trim() ? entry : { categoryId, status: "pending", reason: "missing-justification" }
    const components = entry.componentRefs.map((ref) => input.components.find((component) => component.id === ref))
    if (!entry.scopeNote.trim() || !components.length || components.some((component) => !component || component.amount === null || !Number.isFinite(component.amount) || component.currency !== input.currency || component.period.start < input.horizon.start || component.period.end > input.horizon.end || component.evidenceState === "absent" || !component.sourceRefs.length || component.sourceRefs.some((source) => !entry.evidenceRefs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period !== undefined && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))))) return { categoryId, status: "pending", reason: "component-unresolved" }
    return entry
  })
  if (input.entries.some((entry) => !categories.includes(entry.categoryId))) issues.push("unexpected-category")
  if (new Set(input.components.map((item) => item.id)).size !== input.components.length) issues.push("duplicate-component")
  if (entries.some((entry) => entry.status === "pending") || issues.length) return { ...base, entries, derivedMissingCategoryIds: missing, issues, coverageState: "pending" }
  return { ...base, entries: entries.filter((entry): entry is Exclude<CostCoverageEntry, { status: "pending" }> => entry.status !== "pending"), derivedMissingCategoryIds: [], issues, coverageState: "complete" }
}

/** Producer output must carry the same assessment and a complete inventory before claiming completeness. */
export function validateScenarioCoverage(scenario: import("../contracts/decisions.ts").ScenarioResult, basis: CostCoverageBasis, assessment: CostCoverageAssessment): string | undefined {
  if (digestSfValue(scenario.costCoverage) !== digestSfValue(assessment) || scenario.costCoverage.basisId !== basis.id || scenario.costCoverage.basisVersion !== basis.version) return "alternative-basis-mismatch"
  if (scenario.comparisonStatus !== "complete") return undefined
  const categories = requiredSfCostCategories(basis)
  if (!scenario.sourceRefs.some((ref) => ref.kind === "record" && ref.target.surface === "planner" && scenario.costCoverage.evaluatedSourceRefs.some((evidence) => digestSfValue(evidence) === digestSfValue(ref)))) return "planner-coverage-source-mismatch"
  if (!categories || scenario.costCoverage.coverageState !== "complete" || scenario.costCoverage.entries.length !== categories.length || categories.some((category) => scenario.costCoverage.entries.filter((entry) => entry.categoryId === category).length !== 1) || scenario.total !== scenario.knownSubtotal || scenario.components.some((component) => component.amount === null || !Number.isFinite(component.amount) || component.evidenceState !== "confirmed" || component.currency !== scenario.currency || !component.sourceRefs.length)) return "incomplete-cost-coverage"
  return undefined
}
