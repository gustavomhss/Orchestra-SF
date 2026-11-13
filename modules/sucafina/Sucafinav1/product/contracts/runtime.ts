import type { AgentV2 } from "@orchestra/core/agent"
import type { SkillV2 } from "@orchestra/core/skill"
import type { SessionV2 } from "@orchestra/core/session"
import type { Tool } from "@orchestra/core/tool/tool"
import type { Mcp } from "@orchestra/core/mcp"
import type { Host } from "@orchestra/core/host"
import type { Effect, Scope } from "effect"
import type { ResidentProfile, SkillManifest, SkillLoadReceipt } from "./resident-ai.ts"
import type { CapabilityDescriptor, CapabilityResult, BoundCapabilityReceipt, TrustedExecutionBinding, TrustedCallContext, TrustedDomainContext } from "./sf-execution.ts"
import type { PortResult } from "./ports.ts"

export type SfRuntimeError = { readonly code: "invalid-manifest" | "invalid-skill" | "invalid-binding" | "provider-conflict" | "denied" | "unavailable" | "failed"; readonly reason: string }
export type SfNativeAdmission = Readonly<{
  request: Request
  sessionID: Parameters<SessionV2.Interface["get"]>[0]
  runId: string
  caseRef: { id: string; version: number; incarnation: string }
  profile: ResidentProfile
  manifestDigest: string
  skillReceipts: readonly SkillLoadReceipt[]
  entryMode: TrustedExecutionBinding["entryMode"]
}>
export type SfBindingRegistry = {
  bind: (admission: SfNativeAdmission) => Promise<PortResult<TrustedExecutionBinding>>
  lease: (context: Tool.Context, operation: string, inputDigest: string) => Promise<PortResult<TrustedCallContext>>
  consume: (context: TrustedCallContext, operation: string, inputDigest: string) => boolean
  requestFor: (context: TrustedCallContext) => Request | undefined
  receiptFor: (context: TrustedCallContext, operation: string, inputDigest: string, resultDigest?: string) => BoundCapabilityReceipt | undefined
  revalidate: (context: TrustedCallContext) => Promise<boolean>
  finish: (context: TrustedCallContext) => void
  invalidateGeneration: (generation: number) => void
  revoke: (binding: TrustedExecutionBinding) => void
}
export type SfDomainValidation = {
  validateDomainContext: (context: TrustedDomainContext, operation: string, inputDigest: string) => Promise<boolean>
  revalidateDomainContext: (context: TrustedDomainContext) => Promise<boolean>
}
export type SfResidentRegistration = { agents: AgentV2.Interface; skills: SkillV2.Interface; profiles: readonly ResidentProfile[]; source: SkillV2.Source }
export type RegisterSfResidentAgents = (input: SfResidentRegistration) => Effect.Effect<void, SfRuntimeError, Scope.Scope>
export type LoadSfSkill = (input: {
  session: SessionV2.Interface
  skills: SkillV2.Interface
  sessionID: Parameters<SessionV2.Interface["get"]>[0]
  profile: ResidentProfile
  skill: SkillManifest
  runId: string
  manifestDigest: string
}) => Effect.Effect<SkillLoadReceipt, SfRuntimeError>
export type CreateSfExecutionBindingRegistry = (input: {
  authenticateAndResolve: (admission: SfNativeAdmission) => Promise<{
    installationId: string; hostId: string; projectId: string; locationId: string; principalRef: string
    policyVersion: string; accessRevision: string; providerGeneration: number; expiresAt: string
  } | undefined>
  revalidateAdmission: (admission: SfNativeAdmission, binding: TrustedExecutionBinding) => Promise<boolean>
}) => SfBindingRegistry
export type BindSfExecution = (input: { registry: SfBindingRegistry; admission: SfNativeAdmission }) => ReturnType<SfBindingRegistry["bind"]>
export type CreateSfBusinessMcpBridge = (input: {
  registry: SfBindingRegistry
  mcp: Mcp.Interface
  descriptors: readonly CapabilityDescriptor[]
  dispatch: (operation: string, input: unknown, context: TrustedDomainContext) => Promise<CapabilityResult>
}) => {
  list: (context: Tool.Context) => Promise<PortResult<readonly CapabilityDescriptor[]>>
  call: (context: Tool.Context, operation: string, input: unknown) => Promise<CapabilityResult>
}
export type DispatchSfCapability = (input: {
  operation: string; payload: unknown; context: TrustedDomainContext; descriptors: readonly CapabilityDescriptor[]
  authority: SfDomainValidation
  validateInput: (descriptor: CapabilityDescriptor, payload: unknown) => boolean
  validateOutput: (descriptor: CapabilityDescriptor, result: CapabilityResult) => boolean
}) => Promise<CapabilityResult>
export type CreateSfProductContribution = (input: { registry: SfBindingRegistry; descriptors: readonly CapabilityDescriptor[]; authority: SfDomainValidation; profiles: readonly ResidentProfile[]; source: SkillV2.Source }) => Host.Contribution
