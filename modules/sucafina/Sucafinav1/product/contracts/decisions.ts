import type { Period, ProjectionComponent, SourceRef, PreparedCommand, CommandReceipt } from "./context.ts"
import type { BusinessEvidenceRef } from "./business-context.ts"

export const RENEWAL_TRANSITION_CATEGORIES = ["service", "service_overlap", "implementation", "contract_exit", "migration", "taxes", "training", "internal_costs", "other_relevant_costs"] as const

export type CostCoverageBasis = {
  id: string
  version: number
  decisionType: string
  categoryIds: readonly string[]
  sourceRefs: readonly BusinessEvidenceRef[]
  additionalCategoryIds: readonly string[]
}
export type CostCoverageEntry =
  | { status: "included"; categoryId: string; componentRefs: readonly string[]; evidenceRefs: readonly BusinessEvidenceRef[]; scopeNote: string }
  | { status: "not-applicable"; categoryId: string; justification: string; evidenceRefs: readonly BusinessEvidenceRef[] }
  | { status: "pending"; categoryId: string; reason: string; questionRef?: string }
type CoverageAssessmentBase = {
  basisId: string
  basisVersion: number
  alternativeId: string
  alternativeVersion: number
  currency: string
  horizon: Period
  issues: readonly string[]
  evaluatedSourceRefs: readonly BusinessEvidenceRef[]
}
export type CostCoverageAssessment = CoverageAssessmentBase & (
  | { coverageState: "complete"; entries: readonly Exclude<CostCoverageEntry, { status: "pending" }>[]; derivedMissingCategoryIds: readonly never[] }
  | { coverageState: "pending" | "unavailable"; entries: readonly CostCoverageEntry[]; derivedMissingCategoryIds: readonly string[] }
)
type ScenarioBase = {
  id: string
  version: number
  components: readonly ProjectionComponent[]
  currency: string
  horizon: Period
  sourceRefs: readonly BusinessEvidenceRef[]
  unresolvedConditions: readonly string[]
  restrictions: readonly string[]
}
export type ScenarioResult = ScenarioBase & (
  | { comparisonStatus: "complete"; costCoverage: Extract<CostCoverageAssessment, { coverageState: "complete" }>; knownSubtotal: number; total: number }
  | { comparisonStatus: "conditioned" | "incompatible" | "unavailable"; costCoverage: CostCoverageAssessment; knownSubtotal: number | null; total: null }
)
type ComparisonBase = {
  baselineResultRef: string
  alternativeResultRef: string
  costCoverageRefs: readonly string[]
  criterionResults: readonly { criterionId: string; state: "satisfied" | "failed" | "unknown"; reason: string }[]
  unresolvedConditions: readonly string[]
}
export type ScenarioComparison = ComparisonBase & (
  | { comparisonStatus: "complete"; knownDifference: number; completeDifference: number }
  | { comparisonStatus: "conditioned" | "incompatible" | "unavailable"; knownDifference: number | null; completeDifference: null }
)
export type ChoiceRecord = {
  id: string
  alternativeId: string
  alternativeVersion: number
  basisVersion: number
  costCoverage: CostCoverageAssessment
  comparisonStatus: ScenarioResult["comparisonStatus"]
  criteria: readonly string[]
  values: readonly { criterionRef: string; value: number | null; unit: string; currency: string; horizon: Period }[]
  evidenceRefs: readonly BusinessEvidenceRef[]
  principalRef: string
  reason: string
  at: string
}
export type PreparedChange = {
  id: string
  caseId: string
  caseVersion: number
  target: SourceRef
  expectedVersion: number
  operation: PreparedCommand
  preview: ScenarioResult
  requiredAuthority: readonly string[]
  idempotencyKey: string
  state: "planned" | "applied" | "awaiting-approval" | "conflict" | "failed" | "cancelled"
  receipt?: CommandReceipt
}
export type PreparedChangeView = Omit<PreparedChange, "operation" | "receipt"> & { operationRef: string; receiptRef?: string }
export type DecisionCase = {
  id: string
  incarnation: string
  version: number
  state: "draft" | "investigating" | "comparing" | "chosen" | "partially-applied" | "applied" | "reconsidering" | "closed"
  objective: string
  horizon: Period
  currency: string
  criteria: readonly { id: string; description: string; required: boolean }[]
  participants: readonly string[]
  sourceRefs: readonly BusinessEvidenceRef[]
  alternatives: readonly { id: string; version: number; title: string; result: ScenarioResult }[]
  assumptions: readonly { id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[]; state: "open" | "confirmed" | "rejected" }[]
  questions: readonly { id: string; text: string; state: "open" | "answered"; answerRef?: string }[]
  choices: readonly ChoiceRecord[]
  preparedChanges: readonly PreparedChange[]
  receipts: readonly CommandReceipt[]
}
export type ChangeImpact = {
  id: string
  conditionId: string
  changeDigest: string
  state: "material" | "irrelevant" | "unknown"
  chosen: readonly BusinessEvidenceRef[]
  current: readonly BusinessEvidenceRef[]
  reason: string
}
export type CaseLedgerEvent = {
  id: string
  caseRef: { id: string; incarnation: string; version: number }
  kind: "analysis-accepted" | "choice-recorded" | "reconsideration-accepted"
  principalRef: string
  at: string
  analysisRunId?: string
  consideredActions: readonly string[]
  factualGaps: readonly string[]
  lifecycleState: DecisionCase["state"]
  rationale: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  outputDigest: string
}
export type ObservedResultProjection = {
  caseRef: { id: string; version: number; incarnation: string }
  expected: number | null
  observed: number | null
  cutoff: string
  currency: string
  sourceRefs: readonly BusinessEvidenceRef[]
  limitations: readonly string[]
}
export type DocumentEvidence = {
  id: string
  fileRef: string
  version: number
  location: string
  textRange: { start: number; end: number; unit: "utf16" }
  fieldCandidate: string
  value: string | number | boolean | null
  unit?: string
  status: "extracted" | "confirmed" | "rejected" | "stale"
  ref: Extract<BusinessEvidenceRef, { kind: "document" }>
}
type PortfolioCombinationBase = { id: string; caseRefs: readonly string[]; components: readonly ProjectionComponent[]; costCoverageRefs: readonly string[]; conflicts: readonly string[]; restrictions: readonly string[] }
export type PortfolioCombination = PortfolioCombinationBase & (
  | { eligibility: "eligible-complete"; comparisonStatus: "complete" }
  | { eligibility: "conditioned" | "unavailable"; comparisonStatus: "conditioned" | "incompatible" | "unavailable" }
  | { eligibility: "ineligible"; comparisonStatus: ScenarioResult["comparisonStatus"] }
)
export type PortfolioResult = {
  combinations: readonly PortfolioCombination[]
  limitations: readonly string[]
  evidenceRefs: readonly BusinessEvidenceRef[]
}
