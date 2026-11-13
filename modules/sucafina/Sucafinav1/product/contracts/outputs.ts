import type { BusinessEvidenceRef, BusinessEvidenceResolution, AuthorizedCaseProjection } from "./business-context.ts"
import type { DomainProjection, ImportManifest, RoutineResult, CommandReceiptView } from "./context.ts"
import type { DecisionCase, ScenarioResult, ScenarioComparison, PortfolioResult, DocumentEvidence, ChangeImpact, CostCoverageBasis } from "./decisions.ts"
import type { FinancialAnalysis } from "./ports.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"

/** Transport envelopes have the same closed schemas as their payloads. Authority stays host-owned. */
export type SfEnvelopeMap = { ContributionEnvelope: ContributionEnvelope }

export type UnresolvedCondition = { id: string; category: string; reason: string; evidenceRefs: readonly BusinessEvidenceRef[]; questionRef?: string }
type IntentFrameBase = { objective: string; horizon: { start: string; end: string }; currency: string; criteria: DecisionCase["criteria"]; sourceRefs: readonly BusinessEvidenceRef[]; gaps: readonly UnresolvedCondition[]; domainApplied: false }
export type IntentFrame = IntentFrameBase & ({ analysisBasis: "domain"; importPreviewRef?: never } | { analysisBasis: "import-preview"; importPreviewRef: string })
export type AnalysisPlan = { objective: string; steps: readonly { profileId: string; skillId: string; operationIds: readonly string[]; expectedOutputTypes: readonly string[]; sourceRefs: readonly BusinessEvidenceRef[] }[]; gaps: readonly UnresolvedCondition[] }
export type DecisionBrief = { caseRef: string; caseVersion: number; objective: string; orderedResultRefs: readonly string[]; evidenceRefs: readonly BusinessEvidenceRef[]; conditions: readonly UnresolvedCondition[]; choiceRef?: string; runRef?: string; resultRef?: string }
export type QuestionProposal = { caseRef: string; question: string; criterionRef?: string; recipientRef?: string; evidenceRefs: readonly BusinessEvidenceRef[]; expectedCaseVersion: number }
export type SensitivityResult = { scenarioRef: string; parameterRef: string; bounds: { minimum: number; maximum: number; steps: number }; evaluated: readonly { parameterValue: number; resultRef: string; value: number | null }[]; threshold: number | null; thresholdEvidence: { state: "exact"; value: number; evidenceRefs: readonly BusinessEvidenceRef[] } | { state: "sampled"; interval: { minimum: number; maximum: number }; evidenceRefs: readonly BusinessEvidenceRef[] } | { state: "unavailable"; reason: string }; unit: string; parameterUnit?: string; resultUnit?: string; engineVersion: string; costCoverageRefs: readonly string[]; comparisonStatus: ScenarioComparison["comparisonStatus"]; unresolvedConditions: readonly UnresolvedCondition[]; evidenceRefs: readonly BusinessEvidenceRef[] }
export type CommercialComparison = { requestRef: string; requestVersion: number; currency: string; proposals: readonly { proposalRef: string; eligible: boolean; score: number | null; convertedAmount: number | null; evidenceRefs: readonly BusinessEvidenceRef[]; issues: readonly string[] }[]; ranking: readonly string[]; conditions: readonly UnresolvedCondition[]; sourceRefs: readonly BusinessEvidenceRef[] }
export type CommercialGap = { recordRef: string; field: string; issue: "missing" | "expired" | "contradictory" | "unconfirmed" | "unavailable"; evidenceRefs: readonly BusinessEvidenceRef[]; question: string }
export type EvidenceCandidate = { id: string; value: string | number | boolean | null; unit?: string; evidenceRefs: readonly BusinessEvidenceRef[]; state: "claim" | "extracted" | "needs-confirmation" | "rejected" }
export type PreparedChangeSet = { caseRef: string; caseVersion: number; changes: readonly { changeRef: string; targetRef: BusinessEvidenceRef; expectedVersion: number; operationRef: string; previewRef: string; requiredAuthority: readonly string[] }[]; conditions: readonly UnresolvedCondition[] }
export type DossierDraft = { requestRef: string; requestVersion: number; alternatives: readonly string[]; conditions: readonly UnresolvedCondition[]; sourceRefs: readonly BusinessEvidenceRef[]; gaps: readonly string[]; domainApplied: false }
export type DeliveryAssessment = { caseRef: string; candidateRefs: readonly string[]; dependencies: readonly { fromRef: string; toRef: string; state: "confirmed" | "assumed" | "unknown"; sourceRefs: readonly BusinessEvidenceRef[] }[]; capacityConstraints: readonly string[]; unresolvedConditions: readonly UnresolvedCondition[] }
export type DependencyConflict = { fromRef: string; toRef: string; constraintRef: string; reason: string; evidenceRefs: readonly BusinessEvidenceRef[]; state: "conflict" | "needs-input" | "unavailable" }
export type PortfolioComparison = PortfolioResult
export type ReconsiderationProposal = { caseRef: string; choiceRef: string; impacts: readonly ChangeImpact[]; affectedConditionRefs: readonly string[]; beforeResultRef: string; currentResultRef: string; evidenceRefs: readonly BusinessEvidenceRef[]; choiceChanged: false }
export type ClaimIssue = { claimRef: string; kind: "unsupported" | "contradiction" | "stale" | "missing-category" | "invalid-digest" | "access-unavailable"; reason: string; evidenceRefs: readonly BusinessEvidenceRef[] }
export type CritiqueReport = { targetRunId: string; targetOutputDigest: string; reviewerRunId: string; reviewerSessionId: string; claimIssues: readonly ClaimIssue[]; unresolvedConditions: readonly UnresolvedCondition[]; evidenceRefs: readonly BusinessEvidenceRef[] }
export type ContextualBIProposal = { approvedViewId: string; canonicalProjectionRefs: readonly string[]; filters: readonly { field: string; values: readonly string[] }[]; tableRef: string; sourceRefs: readonly BusinessEvidenceRef[] }
export type MeetingMaterialProposal = { reviewSelectionRef: string; orderedResultRefs: readonly string[]; coverage: readonly { sectionRef: string; includedCount: number; totalCount: number }[]; gaps: readonly UnresolvedCondition[] }
export type MatchExplanation = { candidateCaseRef: { id: string; incarnation: string; version: number }; matchedCriteria: readonly string[]; currentDifferences: readonly string[]; sourceStates: readonly BusinessEvidenceResolution["state"][]; limitations: readonly string[] }
export type CaseRecall = { matches: readonly { caseRef: { id: string; incarnation: string; version: number }; memoryRecordRef: string; explanation: MatchExplanation; evidenceRefs: readonly BusinessEvidenceRef[] }[]; limitations: readonly string[]; accessRevision: string }

export type SfContributionOutputMap = {
  IntentFrame: IntentFrame
  AnalysisPlan: AnalysisPlan
  DecisionBrief: DecisionBrief
  QuestionProposal: QuestionProposal
  FinancialAnalysis: FinancialAnalysis
  ScenarioComparison: ScenarioComparison
  SensitivityResult: SensitivityResult
  CommercialComparison: CommercialComparison
  CommercialGap: CommercialGap
  EvidenceCandidate: EvidenceCandidate
  PreparedChangeSet: PreparedChangeSet
  DossierDraft: DossierDraft
  DeliveryAssessment: DeliveryAssessment
  DependencyConflict: DependencyConflict
  PortfolioComparison: PortfolioComparison
  ReconsiderationProposal: ReconsiderationProposal
  CritiqueReport: CritiqueReport
  UnresolvedCondition: UnresolvedCondition
  ClaimIssue: ClaimIssue
  DocumentEvidence: DocumentEvidence
  ContextualBIProposal: ContextualBIProposal
  MeetingMaterialProposal: MeetingMaterialProposal
  CaseRecall: CaseRecall
  MatchExplanation: MatchExplanation
}
export type AuthorizedArtifact = { artifactRef: string; format: string; recordCount: number; evidenceRefs: readonly BusinessEvidenceRef[]; accessRevision: string }
export type AuthorizedRoutineCatalog = { recipes: readonly { documentId: string; publishedVersion: string; planRevisionId: string; title: string; writeScope: readonly string[] }[]; limitations: readonly string[] }
export type SfOperationOutputMap = {
  sf_dashboard_read: DomainProjection
  sf_kpi_explain: DomainProjection
  sf_bi_view: DomainProjection
  sf_source_get: BusinessEvidenceResolution
  sf_forecast_compare: FinancialAnalysis
  sf_scenario_simulate: ScenarioResult
  sf_scenario_compare: ScenarioComparison
  sf_sensitivity_evaluate: SensitivityResult
  sf_portfolio_evaluate: PortfolioComparison
  sf_request_read: DomainProjection
  sf_supplier_read: DomainProjection
  sf_contract_read: DomainProjection
  sf_sourcing_compare: CommercialComparison
  sf_case_read: AuthorizedCaseProjection
  sf_case_draft: IntentFrame
  sf_alternative_draft: { caseRef: string; proposal: DecisionCase["alternatives"][number]; costCoverageBasis: CostCoverageBasis; coverageRef: string; domainApplied: false }
  sf_change_prepare: PreparedChangeSet
  sf_receipt_get: { receipts: readonly CommandReceiptView[] }
  sf_work_list: { items: readonly { actionRef: string; sourceRefs: readonly BusinessEvidenceRef[]; state: string; ownerRef: string }[] }
  sf_question_prepare: QuestionProposal
  sf_answer_read: { questionRef: string; answer: string; evidenceRefs: readonly BusinessEvidenceRef[]; state: "confirmed" | "unconfirmed" | "stale" }
  sf_relation_read: { relations: readonly { id: string; fromRef: string; toRef: string; kind: string; confirmedBy: string; confirmedAt: string; evidenceRefs: readonly BusinessEvidenceRef[] }[] }
  sf_handoff_prepare: { caseRef: string; actionRef: string; recipientRef?: string; sourceRefs: readonly BusinessEvidenceRef[]; domainApplied: false }
  sf_document_extract: DocumentEvidence
  sf_import_preview: ImportManifest
  sf_review_prepare: { selectionRef: string; sectionRefs: readonly string[]; sourceRefs: readonly BusinessEvidenceRef[]; gaps: readonly UnresolvedCondition[] }
  sf_report_prepare: MeetingMaterialProposal
  sf_artifact_get: AuthorizedArtifact
  sf_context_get: { resolutions: readonly BusinessEvidenceResolution[]; accessRevision: string }
  sf_knowledge_search: { matches: readonly { documentRef: BusinessEvidenceRef; text: string; lexicalScore: number }[]; limitations: readonly string[] }
  sf_evidence_get: BusinessEvidenceResolution
  sf_decision_recall: CaseRecall
  sf_freshness_check: { resolutions: readonly BusinessEvidenceResolution[] }
  sf_routine_catalog: AuthorizedRoutineCatalog
  sf_routine_prepare: RoutineResult
  sf_routine_run: RoutineResult
  sf_routine_status: RoutineResult
  sf_routine_result: RoutineResult
  sf_watch_prepare: { caseRef: string; conditionRef: string; recurrence: string; recipientRef?: string; state: "prepared" | "needs-review" | "unavailable"; admissionRef?: string }
}

export type { BusinessEvidenceResolution, AuthorizedCaseProjection } from "./business-context.ts"
export type { DomainProjection, ImportManifest, RoutineResult } from "./context.ts"
export type { ScenarioResult, ScenarioComparison, PortfolioResult, DocumentEvidence } from "./decisions.ts"
export type { FinancialAnalysis } from "./ports.ts"
export type AuthorizedDashboard = SfOperationOutputMap["sf_dashboard_read"]
export type KpiBreakdown = SfOperationOutputMap["sf_kpi_explain"]
export type ContextualBIView = SfOperationOutputMap["sf_bi_view"]
export type AuthorizedRequest = SfOperationOutputMap["sf_request_read"]
export type AuthorizedSupplier = SfOperationOutputMap["sf_supplier_read"]
export type AuthorizedContract = SfOperationOutputMap["sf_contract_read"]
export type AlternativeDraft = SfOperationOutputMap["sf_alternative_draft"]
export type ChangeReceiptSet = SfOperationOutputMap["sf_receipt_get"]
export type AuthorizedWorkList = SfOperationOutputMap["sf_work_list"]
export type AnswerProjection = SfOperationOutputMap["sf_answer_read"]
export type ConfirmedRelations = SfOperationOutputMap["sf_relation_read"]
export type HandoffProposal = SfOperationOutputMap["sf_handoff_prepare"]
export type ReviewDraft = SfOperationOutputMap["sf_review_prepare"]
export type AuthorizedBusinessContext = SfOperationOutputMap["sf_context_get"]
export type EvidenceSearchResult = SfOperationOutputMap["sf_knowledge_search"]
export type FreshnessResult = SfOperationOutputMap["sf_freshness_check"]
export type AdmissionProposal = SfOperationOutputMap["sf_routine_prepare"]
export type AuthorizedRunReceipt = SfOperationOutputMap["sf_routine_run"]
export type RunStatus = SfOperationOutputMap["sf_routine_status"]
export type AuthorizedRoutineResult = SfOperationOutputMap["sf_routine_result"]
export type ScheduleProposal = SfOperationOutputMap["sf_watch_prepare"]
