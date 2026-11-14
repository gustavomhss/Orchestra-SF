import type { BusinessEvidenceRef } from "./business-context.ts"
import type { Period, ProductContext, SourceRef, RoutineResult, ConfirmationValidityProjection } from "./context.ts"
import type { DecisionCase, CostCoverageBasis, CostCoverageAssessment, ScenarioResult, ScenarioComparison, ChoiceRecord, DocumentEvidence, ChangeImpact } from "./decisions.ts"
import type { FinancialAnalysis } from "./ports.ts"
import type { ImportPreviewRequest, ReviewPrepareRequest, RoutinePrepareRequest, ScenarioOperation, PortfolioRequest, DashboardReadRequest } from "./operations.ts"
import type { UnresolvedCondition, CommercialComparison } from "./outputs.ts"

// These are host-assembled, authorized job inputs. A decoder verifies shape, never authority.
// Request/Session identity, grants, current authorization and entry mode stay in the private binding.
type CaseVersion = Pick<DecisionCase, "id" | "incarnation" | "version">
type Selection = Pick<ProductContext, "surface" | "period" | "currency" | "sourceRefs">
type ConfirmedRelation = { id: string; version: number; from: BusinessEvidenceRef; to: BusinessEvidenceRef; state: "confirmed"; evidenceRefs: readonly BusinessEvidenceRef[] }
type Criterion = { id: string; description: string; required: boolean }
type ParameterRange = { parameterRef: string; minimum: number; maximum: number; steps: number }
type FieldSchema = { id: string; version: string; fields: readonly { id: string; type: "string" | "number" | "boolean" | "date"; unit?: string }[] }

export type DecisionIntentInput = {
  intentText: string; context: Selection; case: CaseVersion; selectedSourceRefs: readonly BusinessEvidenceRef[]; importPreview?: ImportPreviewRequest
}
export type ExecutiveReviewInput = {
  reviewSelection: ReviewPrepareRequest; factualRoutineResults: readonly RoutineResult[]; decisionRefs: readonly CaseVersion[]
  confirmations: readonly ConfirmationValidityProjection[]; routinePreparation?: RoutinePrepareRequest
  admittedRun?: { runRef: string; expectedAdmissionVersion: number }
}
export type QuestionPlanningInput = {
  case: CaseVersion; unresolvedConditions: readonly UnresolvedCondition[]; relations: readonly ConfirmedRelation[]; authorizedDirectoryRefs: readonly string[]
}
export type ForecastExplainInput = {
  forecastComparison: FinancialAnalysis; selectedPeriod: Period; currency: string; sourceRefs: readonly BusinessEvidenceRef[]
  registeredReasons: readonly { id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[] }[]; importPreview?: ImportPreviewRequest
}
export type ScenarioComparisonInput = {
  alternatives: readonly { id: string; version: number; title: string; result: ScenarioResult }[]
  costCoverageBases: readonly CostCoverageBasis[]; operations: readonly ScenarioOperation[]; currency: string; horizon: Period
}
export type SensitivityInput = {
  comparison: ScenarioComparison; criteria: readonly Criterion[]; parameterRanges: readonly ParameterRange[]; costCoverageRefs: readonly string[]
}
export type SourcingComparisonInput = {
  request: { requestRef: string; version: number; stage: string }
  authorizedOffers: readonly { offerRef: string; version: number; currency: string; amount: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  submittedFx: readonly { from: string; to: string; period: Period; rate: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  weightsAndEligibility: readonly { criterionRef: string; weight: number; required: boolean; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  sourceRefs: readonly BusinessEvidenceRef[]
}
export type ContractReviewInput = {
  documentEvidence: readonly DocumentEvidence[]; contractProjectionRef: BusinessEvidenceRef
  decisionScope: { case: CaseVersion; horizon: Period; currency: string }; costCoverage: CostCoverageAssessment
}
export type PurchasePreparationInput = {
  choice: ChoiceRecord; request: { requestRef: string; version: number; stage: string }; allowedChangeTargets: readonly SourceRef[]
  commercialComparisons: readonly CommercialComparison[]
}
export type DependencyReviewInput = {
  relations: readonly ConfirmedRelation[]; commitments: readonly { id: string; case: CaseVersion; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  milestones: readonly { id: string; projectRef: BusinessEvidenceRef; at: string; state: string }[]; declaredConstraints: readonly string[]
}
export type PortfolioCompositionInput = {
  request: PortfolioRequest; candidates: readonly { case: CaseVersion; alternativeRef: string; result: ScenarioResult }[]
  constraints: readonly string[]; costCoverageRefs: readonly string[]
}
export type CommitmentReevaluationInput = {
  changes: readonly ChangeImpact[]; originalChoice: ChoiceRecord; currentComparison: ScenarioComparison; confirmedDependencyRefs: readonly BusinessEvidenceRef[]
}
export type DecisionCritiqueInput = {
  alternativeRefs: readonly string[]; choiceRefs: readonly string[]; comparison: ScenarioComparison
  authorAnalysis: { runRef: string; outputDigest: string }; authorizedEvidenceRefs: readonly BusinessEvidenceRef[]
}
export type EvidenceReviewInput = {
  claims: readonly { id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[] }[]; documentEvidence: readonly DocumentEvidence[]
  businessEvidenceRefs: readonly BusinessEvidenceRef[]; currentSourceRevisions: readonly { ref: BusinessEvidenceRef; incarnation: string; version: number }[]
}
export type EvidenceExtractionInput = {
  authorizedFileRef: string; documentRevision: number; targetFieldSchema: FieldSchema
  limits: { formats: readonly ("text/plain" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document")[]; maxBytes: number; maxPages: number; maxTextLength: number; maxXmlBytes: number; maxZipEntries: number; timeoutMs: number }
}
export type ContextualBIInput = {
  businessQuestion: string; approvedViews: readonly { id: string; version: number; allowedFilters: readonly string[] }[]
  projectionRefs: readonly BusinessEvidenceRef[]; authorizedFilters: readonly { field: string; values: readonly string[] }[]; dashboardSelection: DashboardReadRequest
}
export type MeetingMaterialInput = {
  preservedReviewRef: { id: string; version: number }; decisionRefs: readonly CaseVersion[]; factualRoutineResults: readonly RoutineResult[]; authorizedSections: readonly string[]
}
export type DecisionRecallInput = {
  currentCase: CaseVersion; recallScope: { cases: readonly CaseVersion[]; period: Period; includeHistorical: boolean }; query: string
}
export type SfSkillInputMap = {
  DecisionIntentInput: DecisionIntentInput
  ExecutiveReviewInput: ExecutiveReviewInput
  QuestionPlanningInput: QuestionPlanningInput
  ForecastExplainInput: ForecastExplainInput
  ScenarioComparisonInput: ScenarioComparisonInput
  SensitivityInput: SensitivityInput
  SourcingComparisonInput: SourcingComparisonInput
  ContractReviewInput: ContractReviewInput
  PurchasePreparationInput: PurchasePreparationInput
  DependencyReviewInput: DependencyReviewInput
  PortfolioCompositionInput: PortfolioCompositionInput
  CommitmentReevaluationInput: CommitmentReevaluationInput
  DecisionCritiqueInput: DecisionCritiqueInput
  EvidenceReviewInput: EvidenceReviewInput
  EvidenceExtractionInput: EvidenceExtractionInput
  ContextualBIInput: ContextualBIInput
  MeetingMaterialInput: MeetingMaterialInput
  DecisionRecallInput: DecisionRecallInput
}
