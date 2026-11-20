import type { Host } from "@orchestra/core/host"
import type { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import type { SessionMessage } from "@orchestra/core/session/message"
import type { Application } from "../../runtime/application.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import type { CurrentChoiceFence } from "../decisions/current-choice-preview.ts"
import type { CaseCreationRecovery } from "../decisions/case-port.ts"
import type { createSfProductAuthority, SfProductGrant } from "../integration/product-authority.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "./runtime.ts"
import type { BusinessPorts, PortResult } from "./ports.ts"
import type { TrustedDomainContext, TrustedExecutionBinding } from "./sf-execution.ts"
import type { Period } from "./context.ts"
import type { createCollaborationWorkPort, WorkPresentationItem } from "../collaboration/work-port.ts"
import type { createSfDocumentHost } from "../documents/host.ts"
import type { createSfRoutineProduct } from "../routines/factory.ts"
import type { createSfPersonalViews } from "../interface/personal-views.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"
import type { SfNativeRunRecord } from "./state.ts"
import type { TrustedUiContext } from "./sf-execution.ts"
import type { ForecastExplainInput, SourcingComparisonInput } from "./skill-inputs.ts"
import type { ForecastCompareRequest, WorkListRequest } from "./operations.ts"
import type { MonthlyDraft } from "../planner/monthly-edit.ts"
import type { View, Result } from "../../runtime/contract.ts"
import type { runSfAnalysis } from "../ai/analysis-port.ts"

export type SfPlannerMonthlyInput = { page: "OPEX" | "CAPEX"; versionId: string; drafts: readonly MonthlyDraft[] }
export type SfPlannerMonthlyResult = { view: View; rows: readonly { draft: MonthlyDraft; errors: readonly { cell?: MonthlyDraft["cells"][number]; reason: string }[]; result?: Result }[] }

/** Human-authorized preparation shared by import, document and other analysis consumers. */
export type SfAnalysisInputPort = {
  prepare: (context: TrustedUiContext, input: {
    request: Omit<Parameters<typeof runSfAnalysis>[0]["request"], "contextFingerprint">
    selection: Record<string, unknown>
  }) => Promise<PortResult<unknown>>
}

/** In-process host API. Neither this object nor its bindings are serialized into a model request. */
export type SfHostSessionPort = {
  prepare: (input: { request: Request; selected: SfSelectedRuntime; location: Location.Ref; model: ModelV2.Ref; skillId: string; prompt: string;
    runId: string; caseRef: SfNativeAdmission["caseRef"]; entryMode: SfNativeAdmission["entryMode"]; toolCallBudget: number; skillLoadBudget: number }) => Promise<PortResult<{
    binding: TrustedExecutionBinding; sessionID: SfNativeAdmission["sessionID"]; skillReceipt: SfNativeAdmission["skillReceipts"][number]
  }>>
  execute: (binding: TrustedExecutionBinding) => Promise<PortResult<true>>
  collect: (binding: TrustedExecutionBinding) => Promise<PortResult<readonly { seq: number; message: SessionMessage.Message }[]>>
  interrupt: (binding: TrustedExecutionBinding) => Promise<PortResult<true>>
}
export type SfHostServices = ReturnType<typeof createSfProductAuthority> & {
  dispatch: BusinessPorts["dispatch"]
  /** Private, human-admitted key-only C08 recovery; never model-visible. */
  caseCreationRecovery?: (key: string, context: TrustedUiContext) => Promise<PortResult<CaseCreationRecovery>>
  /** Private HTTP adapters mounted in the existing local application. */
  productHttp?: NonNullable<Application["product"]>
  /** Private page projection prepared before the page lock and fenced inside it. */
  productView?: NonNullable<Application["productView"]>
  /** Private UI discovery; absent until its real collection registry is mounted. */
  procurementSelections?: {
    create: (context: TrustedDomainContext, period: Period) => Promise<PortResult<{ selectionRef: string; label: string; period: Period }>>
  }
  work?: Pick<ReturnType<typeof createCollaborationWorkPort>, "listPresentation">
  /** Exact C58 human-authorized destination reader and its terminal witness.
   * Never expose producer authority, a grant factory or its resolver to UI. */
  /** Authorized, host-owned A07 projection. Never serializes authority or source ports. */
  nativeReviewProjection?: Readonly<{
    operationId: "projection.review"
    handle: (request: Request) => Promise<Response>
  }>
  workDestinations?: Readonly<{
    read: (selection: WorkListRequest, actionRef: string, call: TrustedDomainContext) =>
      Promise<PortResult<{
        view: Readonly<{
          item: WorkPresentationItem
          details: readonly Readonly<{ label: string; value: string }>[]
          links: readonly Readonly<{ label: string; url: string }>[]
        }>
        verify: () => Promise<boolean>
      }>>
  }>
  documents?: Pick<ReturnType<typeof createSfDocumentHost>, "resolvePresentation">
  routineRuns?: Pick<ReturnType<typeof createSfRoutineProduct>, "discoverRuns">
  personalViews?: ReturnType<typeof createSfPersonalViews>
  forecastInputs?: {
    prepare: (context: TrustedUiContext, input: ForecastCompareRequest & { caseRef: { id: string; incarnation: string; version: number } }) => Promise<PortResult<ForecastExplainInput>>
  }
  sourcingInputs?: {
    prepare: (context: TrustedUiContext, input: { requestRef: string; caseRef: { id: string; incarnation: string; version: number } }) => Promise<PortResult<SourcingComparisonInput>>
  }
  analysisInputs?: SfAnalysisInputPort
  plannerMonthly?: {
    preview: (context: TrustedUiContext, input: SfPlannerMonthlyInput) => Promise<PortResult<SfPlannerMonthlyResult>>
    apply: (context: TrustedUiContext, input: SfPlannerMonthlyInput) => Promise<PortResult<SfPlannerMonthlyResult>>
  }
  /** Human-authorized product operations; native tickets and bindings never cross this boundary. */
  analyses?: {
    start: (context: TrustedUiContext, input: Omit<Parameters<typeof runSfAnalysis>[0], "host" | "request"> & { request: Omit<Parameters<typeof runSfAnalysis>[0]["request"], "contextFingerprint">; model: ModelV2.Ref }) => Promise<PortResult<{ runRef: string }>>
    list: (context: TrustedUiContext, caseRef: { id: string; incarnation: string; version: number }) => Promise<PortResult<readonly { runRef: string; state: SfNativeRunRecord["state"]; version: number; outputRef?: string }[]>>
    read: (context: TrustedUiContext, runRef: string) => Promise<PortResult<SfNativeRunRecord>>
    output: (context: TrustedUiContext, runRef: string) => Promise<PortResult<ContributionEnvelope>>
    cancel: (context: TrustedUiContext, runRef: string) => Promise<PortResult<{ cancelled: boolean }>>
  }
  sessions: SfHostSessionPort
  selected: readonly SfSelectedRuntime[]
  models: () => Promise<readonly ModelV2.Ref[]>
}

/** Root-owned functions, never a serialized request or a caller-provided identity. */
export type SfHostRuntime = {
  identity: () => Readonly<{ installationId: string; hostId: string; projectId: string; location: Location.Ref }> | undefined
  contributions: ReadonlyArray<Host.Contribution>
  services?: () => SfHostServices | undefined
}
export type CreateSfHostRuntime = (input: {
  /** Host-private observation from the installation which actually mounts the producers. */
  operational?: (request: Request, stamp: import("@orchestra/schema/sucafina/context").SfContextStamp) => Promise<readonly import("@orchestra/schema/sucafina/context").SfOperationAvailability[]>
  /** Exact installed binding identity; not an authorization or a serialized readiness claim. */
  nativeReadBinding?: (operationId:
    | "projection.review" | "dashboard.dashboard-review"
    | "decisions.command.sf_case_draft" | "decisions.decision-edit" | "decisions.controls.read"
    | "decisions.decision-review" | "decisions.decision-apply" | "decisions.decision-recover"
    | "bi.bi-options" | "bi.bi-data" | "bi.bi-source" | "bi.bi-decision", producer: object) => object | undefined
  nativeActions?: (request: Request, stamp: import("@orchestra/schema/sucafina/context").SfContextStamp,
    pages: readonly Readonly<{ surface: "dashboard" | "planner" | "procurement"; page: string }>[]) =>
    Promise<readonly Readonly<{ surface: "dashboard" | "planner" | "procurement"; page: string; allowedActionIds: readonly string[] }>[]>
  installationId: string
  directory: string
  sourceRoot: string
  origin: string
  mount: string
  /** Only the configured identity producer can supply this; never a URL claim. */
  authMode?: "microsoft" | "local-operator"
  /** Configured Microsoft resource tenant; independent of technical placement. */
  tenantId?: string
  /** Server-only resolver capabilities preserve the original admission object across awaits. */
  teamProfiles?: Parameters<typeof createSfProductAuthority>[0]["teamProfiles"]
  readGrants?: () => Promise<readonly SfProductGrant[]>
  /** Same original Request; bool only, no person or credential leaves this callback. */
  isAuthenticated?: (request: Request) => Promise<boolean>
  persistence: Application["persistence"] & SfScopedSourcePort
  /** Installed below source lifecycle; shared by the real C08 and Planner producers. */
  currentChoiceFence?: CurrentChoiceFence
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  /** Explicit installation policy, distinct from financial roles and inaccessible to model input. */
  grants?: readonly SfProductGrant[]
  assets?: Application["assets"]
}) => Promise<SfHostRuntime>
