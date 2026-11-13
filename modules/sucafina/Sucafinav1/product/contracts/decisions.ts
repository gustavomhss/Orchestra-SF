import type { Period, ProjectionComponent, SourceRef, PreparedCommand, CommandReceipt } from "./context.ts"
import type { BusinessEvidenceRef } from "./business-context.ts"

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
export type CostCoverageAssessment = {
  basisId: string
  basisVersion: number
  alternativeId: string
  alternativeVersion: number
  currency: string
  horizon: Period
  entries: readonly CostCoverageEntry[]
  derivedMissingCategoryIds: readonly string[]
  coverageState: "complete" | "pending" | "unavailable"
  issues: readonly string[]
  evaluatedSourceRefs: readonly BusinessEvidenceRef[]
}
export type ScenarioResult = {
  id: string
  version: number
  components: readonly ProjectionComponent[]
  knownSubtotal: number
  total: number | null
  currency: string
  horizon: Period
  sourceRefs: readonly BusinessEvidenceRef[]
  costCoverage: CostCoverageAssessment
  comparisonStatus: "complete" | "conditioned" | "incompatible" | "unavailable"
  unresolvedConditions: readonly string[]
  restrictions: readonly string[]
}
export type ScenarioComparison = {
  baselineResultRef: string
  alternativeResultRef: string
  costCoverageRefs: readonly string[]
  comparisonStatus: ScenarioResult["comparisonStatus"]
  knownDifference: number | null
  completeDifference: number | null
  criterionResults: readonly { criterionId: string; state: "satisfied" | "failed" | "unknown"; reason: string }[]
  unresolvedConditions: readonly string[]
}
export type ChoiceRecord = {
  id: string
  alternativeId: string
  alternativeVersion: number
  basisVersion: number
  costCoverage: CostCoverageAssessment
  comparisonStatus: ScenarioResult["comparisonStatus"]
  criteria: readonly string[]
  values: Readonly<Record<string, unknown>>
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
  value: unknown
  unit?: string
  status: "extracted" | "confirmed" | "rejected" | "stale"
  ref: Extract<BusinessEvidenceRef, { kind: "document" }>
}
export type PortfolioRequest = {
  caseRefs: readonly { id: string; version: number; incarnation: string }[]
  operations: readonly { id: string; kind: "include" | "exclude" | "defer" | "replace"; targetRef: string; replacementRef?: string }[]
  horizon: Period
  currency: string
  restrictions: readonly { id: string; kind: string; limit: number | string; required: boolean }[]
  priorities: readonly string[]
}
export type PortfolioResult = {
  combinations: readonly { id: string; caseRefs: readonly string[]; components: readonly ProjectionComponent[]; costCoverageRefs: readonly string[]; comparisonStatus: ScenarioResult["comparisonStatus"]; eligibility: "eligible-complete" | "conditioned" | "ineligible" | "unavailable"; conflicts: readonly string[]; restrictions: readonly string[] }[]
  limitations: readonly string[]
  evidenceRefs: readonly BusinessEvidenceRef[]
}
