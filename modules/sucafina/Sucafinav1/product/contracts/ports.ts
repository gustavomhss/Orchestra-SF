import type { Application } from "../../runtime/application.ts"
import type { Actor, Environment, Persistence, Snapshot } from "../../runtime/contract.ts"
import type { ForecastCompareRequest, CaseDraftRequest, CaseReadRequest, DashboardReadRequest, RequestReadRequest, JsonValue } from "./operations.ts"
import type { DomainProjection, ImportManifest, PreservedReview, RoutineResult } from "./context.ts"
import type { DecisionCase, ScenarioResult, ScenarioComparison, PortfolioResult, ObservedResultProjection } from "./decisions.ts"
import type { BusinessEvidenceRef, BusinessContextService } from "./business-context.ts"
import type { TrustedExecutionBinding, CapabilityResult } from "./sf-execution.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"
import type { SfProductStatePort } from "./state.ts"

export type DomainPortHost = {
  persistence: Persistence
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  requestFor: (binding: TrustedExecutionBinding) => Request | undefined
  revalidate: (binding: TrustedExecutionBinding) => Promise<boolean>
}
export type PortResult<T> =
  | { status: "ok"; value: T }
  | { status: "needs-input" | "stale" | "denied" | "unavailable" | "conflict" | "failed"; reason: string }
export type FinancialAnalysis = {
  baseline: DomainProjection
  candidate: DomainProjection
  comparison: ScenarioComparison
  knownDifference: number | null
  completeDifference: number | null
  sourceRefs: readonly BusinessEvidenceRef[]
  gaps: readonly string[]
  explanation: string
  analysisBasis: "domain" | "import-preview"
  domainApplied: boolean
  importPreviewRef?: string
}
export type PlannerPort = {
  compareForecast: (request: ForecastCompareRequest, binding: TrustedExecutionBinding) => Promise<PortResult<FinancialAnalysis>>
}
export type DecisionCasePort = {
  draft: (request: CaseDraftRequest, binding: TrustedExecutionBinding) => Promise<PortResult<DecisionCase>>
  read: (request: CaseReadRequest, binding: TrustedExecutionBinding) => Promise<PortResult<DecisionCase>>
}
export type DashboardPort = {
  read: (request: DashboardReadRequest, binding: TrustedExecutionBinding) => Promise<PortResult<DomainProjection>>
}
export type ProcurementPort = {
  read: (request: RequestReadRequest, binding: TrustedExecutionBinding) => Promise<PortResult<DomainProjection>>
}
export type PreparedDomainMutation = {
  surface: "dashboard" | "planner" | "procurement"
  idempotencyKey: string
  commandDigest: string
  targetIncarnation: string
  expectedVersion: number
  execute: (snapshot: Snapshot, actor: Actor, environment: Environment) => { commit: boolean; value: JsonValue }
}
export type BusinessPorts = {
  identity: Readonly<{ installationId: string; hostId: string; projectId: string; locationId: string; policyVersion: string }>
  state: SfProductStatePort
  planner: PlannerPort
  cases: DecisionCasePort
  dashboard: DashboardPort
  procurement: ProcurementPort
  context: BusinessContextService
  analysis: {
    create: (request: { caseRef: { id: string; version: number; incarnation: string }; profileId: string; skillId: string; manifestDigest: string; objective: string; contextFingerprint: string }, binding: TrustedExecutionBinding) => Promise<PortResult<ContributionEnvelope>>
    read: (runRef: string, binding: TrustedExecutionBinding) => Promise<PortResult<ContributionEnvelope>>
    cancel: (runRef: string, binding: TrustedExecutionBinding) => Promise<PortResult<{ cancelled: boolean }>>
  }
  routines: {
    catalog: (purpose: string, binding: TrustedExecutionBinding) => Promise<PortResult<readonly { documentId: string; publishedVersion: string; title: string }[]>>
    prepareAdmission: (request: { publishedRecipeRef: string; inputRefs: readonly string[]; parameters: Readonly<Record<string, JsonValue>> }, binding: TrustedExecutionBinding) => Promise<PortResult<RoutineResult>>
    readAdmission: (admissionRef: string, binding: TrustedExecutionBinding) => Promise<PortResult<RoutineResult>>
    readRun: (runRef: string, binding: TrustedExecutionBinding) => Promise<PortResult<RoutineResult>>
  }
  directory: { lookup: (ids: readonly string[], binding: TrustedExecutionBinding) => Promise<PortResult<readonly { id: string; name: string }[]>> }
  dispatch: (name: string, input: unknown, binding: TrustedExecutionBinding) => Promise<CapabilityResult>
}

// Producers own implementation and validation; these aliases keep domain outputs common across UI/MCP.
export type ProductOutput = DomainProjection | FinancialAnalysis | DecisionCase | ScenarioResult | ScenarioComparison | PortfolioResult | ObservedResultProjection | ImportManifest | PreservedReview | RoutineResult | ContributionEnvelope
