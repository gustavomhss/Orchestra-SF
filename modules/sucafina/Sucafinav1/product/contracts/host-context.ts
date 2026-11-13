import type { Host } from "@orchestra/core/host"
import type { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import type { SessionMessage } from "@orchestra/core/session/message"
import type { Application } from "../../runtime/application.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import type { createSfProductAuthority, SfProductGrant } from "../integration/product-authority.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "./runtime.ts"
import type { BusinessPorts, PortResult } from "./ports.ts"
import type { TrustedDomainContext, TrustedExecutionBinding } from "./sf-execution.ts"
import type { Period } from "./context.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"
import type { SfNativeRunRecord } from "./state.ts"
import type { TrustedUiContext } from "./sf-execution.ts"
import type { ForecastExplainInput } from "./skill-inputs.ts"
import type { ForecastCompareRequest } from "./operations.ts"
import type { MonthlyDraft } from "../planner/monthly-edit.ts"
import type { View, Result } from "../../runtime/contract.ts"
import type { runSfAnalysis } from "../ai/analysis-port.ts"

export type SfPlannerMonthlyInput = { page: "OPEX" | "CAPEX"; versionId: string; drafts: readonly MonthlyDraft[] }
export type SfPlannerMonthlyResult = { view: View; rows: readonly { draft: MonthlyDraft; errors: readonly { cell?: MonthlyDraft["cells"][number]; reason: string }[]; result?: Result }[] }

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
  /** Private UI discovery; absent until its real collection registry is mounted. */
  procurementSelections?: {
    create: (context: TrustedDomainContext, period: Period) => Promise<PortResult<{ selectionRef: string; label: string; period: Period }>>
  }
  forecastInputs?: {
    prepare: (context: TrustedUiContext, input: ForecastCompareRequest & { caseRef: { id: string; incarnation: string; version: number } }) => Promise<PortResult<ForecastExplainInput>>
  }
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
  installationId: string
  directory: string
  sourceRoot: string
  origin: string
  mount: string
  persistence: Application["persistence"] & SfScopedSourcePort
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  /** Explicit installation policy, distinct from financial roles and inaccessible to model input. */
  grants?: readonly SfProductGrant[]
  assets?: Application["assets"]
}) => Promise<SfHostRuntime>
