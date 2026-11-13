import type { Application } from "../../runtime/application.ts"
import type { Actor, Environment, Persistence, Snapshot } from "../../runtime/contract.ts"
import type { ForecastCompareRequest, CaseDraftRequest, CaseReadRequest, DashboardReadRequest, RequestReadRequest, SupplierReadRequest, ContractReadRequest, SourcingCompareRequest, ScenarioRequest, ScenarioCompareRequest, SensitivityRequest, JsonValue } from "./operations.ts"
import type { DomainProjection, ImportManifest, PreservedReview, RoutineResult, CommandReceipt } from "./context.ts"
import type { DecisionCase, ScenarioResult, ScenarioComparison, PortfolioResult, ObservedResultProjection, CostCoverageAssessment, CostCoverageBasis } from "./decisions.ts"
import type { BusinessEvidenceRef, BusinessContextService, AuthorizedCaseProjection } from "./business-context.ts"
import type { TrustedDomainContext, CapabilityResult } from "./sf-execution.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"
import type { SfProductStatePort } from "./state.ts"
import type { SensitivityResult, IntentFrame, CommercialComparison } from "./outputs.ts"

export type DomainPortHost = {
  persistence: Persistence
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  requestFor: (binding: TrustedDomainContext) => Request | undefined
  revalidate: (binding: TrustedDomainContext) => Promise<boolean>
}
export type PortResult<T> =
  | { status: "ok"; value: T }
  | { status: "needs-input" | "stale" | "denied" | "unavailable" | "conflict" | "provider-conflict" | "failed"; reason: string }
type FinancialAnalysisBase = {
  baseline: DomainProjection
  candidate: DomainProjection
  sourceRefs: readonly BusinessEvidenceRef[]
  gaps: readonly string[]
  explanation: string
}
export type FinancialAnalysis = FinancialAnalysisBase & (
  | { comparison: Extract<ScenarioComparison, { comparisonStatus: "complete" }>; knownDifference: number; completeDifference: number }
  | { comparison: Exclude<ScenarioComparison, { comparisonStatus: "complete" }>; knownDifference: number | null; completeDifference: null }
) & (
  | { analysisBasis: "domain"; domainApplied: boolean; importPreviewRef?: never }
  | { analysisBasis: "import-preview"; domainApplied: false; importPreviewRef: string }
)
export type SfDocumentReadPort = {
  read: (documentRef: string, context: TrustedDomainContext) => Promise<PortResult<{ documentId: string; incarnation: string; revision: number; fileName: string; mediaType: "text/plain" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; blobDigest: { algorithm: "sha256"; value: string }; bytes: Uint8Array }>>
  revalidate: (documentRef: string, identity: { incarnation: string; revision: number; blobDigest: string }, context: TrustedDomainContext) => Promise<boolean>
}
export type PlannerPort = {
  compareForecast: (request: ForecastCompareRequest, binding: TrustedDomainContext) => Promise<PortResult<FinancialAnalysis>>
  simulateScenario: (request: ScenarioRequest, binding: TrustedDomainContext) => Promise<PortResult<ScenarioResult>>
  compareScenarios: (request: ScenarioCompareRequest, binding: TrustedDomainContext) => Promise<PortResult<ScenarioComparison>>
  evaluateSensitivity: (request: SensitivityRequest, binding: TrustedDomainContext) => Promise<PortResult<SensitivityResult>>
}
export type PlannerSourceHost = {
  resolveForecastSource: (reference: string, context: TrustedDomainContext) => Promise<PortResult<{ versionId: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>>
  resolveForecastCoverage: (reference: string, context: TrustedDomainContext) => Promise<PortResult<{ coverageRef: string; basis: CostCoverageBasis; assessment: CostCoverageAssessment }>>
}
export type DecisionCasePort = {
  draft: (request: CaseDraftRequest, binding: TrustedDomainContext) => Promise<PortResult<DecisionCase>>
  prepareIntent: (request: CaseDraftRequest, binding: TrustedDomainContext) => Promise<PortResult<IntentFrame>>
  read: (request: CaseReadRequest, binding: TrustedDomainContext) => Promise<PortResult<AuthorizedCaseProjection>>
}
export type DashboardPort = {
  read: (request: DashboardReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
}
export type ProcurementPort = {
  read: (request: RequestReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  readSupplier: (request: SupplierReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  readContract: (request: ContractReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  compareSourcing: (request: SourcingCompareRequest, binding: TrustedDomainContext) => Promise<PortResult<CommercialComparison>>
}
export type PreparedDomainMutation = {
  surface: "dashboard" | "planner" | "procurement"
  idempotencyKey: string
  commandDigest: string
  targetIncarnation: string
  expectedVersion: number
  execute: (snapshot: Snapshot, actor: Actor, environment: Environment) => { commit: boolean; value: JsonValue }
}
export type PreparedApplyPort = {
  executePrepared: (request: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, binding: TrustedDomainContext) => Promise<PortResult<CommandReceipt>>
  readReceipt: (request: { surface: PreparedDomainMutation["surface"]; targetRef: string; targetIncarnation: string; idempotencyKey: string; commandDigest: string }, binding: TrustedDomainContext) => Promise<PortResult<{ state: "found"; receipt: CommandReceipt } | { state: "not-found" }>>
}
export type BusinessPorts = {
  identity: Readonly<{ installationId: string; hostId: string; projectId: string; locationId: string; policyVersion: string }>
  state: SfProductStatePort
  planner: PlannerPort
  cases: DecisionCasePort
  dashboard: DashboardPort
  procurement: ProcurementPort
  apply: PreparedApplyPort
  context: BusinessContextService
  analysis: {
    create: (request: { caseRef: { id: string; version: number; incarnation: string }; profileId: string; profileVersion: string; skillId: string; skillVersion: string; manifestDigest: string; outputSchemaVersion: string; requestedOperationScope: readonly string[]; objective: string; contextFingerprint: string }, binding: TrustedDomainContext) => Promise<PortResult<ContributionEnvelope>>
    read: (runRef: string, binding: TrustedDomainContext) => Promise<PortResult<ContributionEnvelope>>
    cancel: (runRef: string, binding: TrustedDomainContext) => Promise<PortResult<{ cancelled: boolean }>>
  }
  routines: {
    catalog: (purpose: string, binding: TrustedDomainContext) => Promise<PortResult<readonly { documentId: string; publishedVersion: string; planRevisionId: string; writeScope: readonly string[]; title: string }[]>>
    prepareAdmission: (request: { publishedRecipeRef: string; planRevisionId: string; writeScope: readonly string[]; inputRefs: readonly string[]; parameters: Readonly<Record<string, JsonValue>> }, binding: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
    readAdmission: (admissionRef: string, binding: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
    readRun: (runRef: string, binding: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
    run: (request: { admissionRef: string; caseRef: { id: string; incarnation: string; version: number } }, binding: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
  }
  result: { write: (request: { runRef: string; caseRef: { id: string; version: number; incarnation: string }; output: ContributionEnvelope }, binding: TrustedDomainContext) => Promise<PortResult<{ outputRef: string; caseVersion: number }>> }
  schedules: {
    create: (request: { conditionRef: string; recipeRef: string; recurrence: string; timezone: string }, binding: TrustedDomainContext) => Promise<PortResult<{ scheduleRef: string; version: number; state: "needs-review" | "active" | "paused" }>>
    update: (request: { scheduleRef: string; expectedVersion: number; recurrence: string; timezone: string }, binding: TrustedDomainContext) => Promise<PortResult<{ scheduleRef: string; version: number }>>
    pause: (request: { scheduleRef: string; expectedVersion: number }, binding: TrustedDomainContext) => Promise<PortResult<{ scheduleRef: string; version: number; state: "paused" }>>
    list: (binding: TrustedDomainContext) => Promise<PortResult<readonly { scheduleRef: string; version: number; state: string }[]>>
    readRun: (runRef: string, binding: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
  }
  directory: { lookup: (ids: readonly string[], binding: TrustedDomainContext) => Promise<PortResult<readonly { id: string }[]>> }
  dispatch: (name: string, input: unknown, binding: TrustedDomainContext) => Promise<CapabilityResult>
}

// Producers own implementation and validation; these aliases keep domain outputs common across UI/MCP.
export type ProductOutput = DomainProjection | FinancialAnalysis | DecisionCase | ScenarioResult | ScenarioComparison | PortfolioResult | ObservedResultProjection | ImportManifest | PreservedReview | RoutineResult | ContributionEnvelope
