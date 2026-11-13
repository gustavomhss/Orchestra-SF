import type { SkillLoadReceipt, ResidentProfile } from "./resident-ai.ts"
import type { HostBoundEntryMode } from "./context.ts"
import type { SfOperationOutputMap } from "./outputs.ts"

declare const bindingBrand: unique symbol
declare const callLeaseBrand: unique symbol
declare const uiLeaseBrand: unique symbol

// Brands describe host-only registry objects. Runtime admission MUST also check registry identity.
export type TrustedExecutionBinding = Readonly<{
  readonly [bindingBrand]: true
  installationId: string
  hostId: string
  projectId: string
  locationId: string
  nativeSessionId: string
  runId: string
  caseId: string
  caseVersion: number
  caseIncarnation: string
  principalRef: string
  profileId: ResidentProfile["id"]
  profileVersion: string
  manifestDigest: string
  skillReceipts: readonly SkillLoadReceipt[]
  policyVersion: string
  accessRevision: string
  providerGeneration: number
  expiresAt: string
  entryMode: HostBoundEntryMode
}>
export type TrustedCallLease = { readonly [callLeaseBrand]: true }
export type TrustedCallContext = { readonly kind: "native"; readonly binding: TrustedExecutionBinding; readonly lease: TrustedCallLease }
export type TrustedUiLease = { readonly [uiLeaseBrand]: true }
export type TrustedUiContext = {
  readonly kind: "ui"
  readonly binding: Readonly<{ installationId: string; projectId: string; principalRef: string; requestId: string; policyVersion: string; accessRevision: string; expiresAt: string }>
  readonly lease: TrustedUiLease
}
// UI keeps direct operation without an AI session. The host privately validates BOTH registry kinds.
export type TrustedDomainContext = TrustedCallContext | TrustedUiContext
export type BoundCapabilityReceipt = { operation: string; handlerExport: string; inputDigest: string; resultDigest?: string; principalRef: string; callId: string; accessRevision: string; at: string } & (
  | { kind: "native"; runId: string; nativeSessionId: string; providerGeneration: number }
  | { kind: "ui"; requestId: string }
)
export type CapabilityReceipt = BoundCapabilityReceipt | { kind: "unbound"; operation: string; code: "invalid-binding" | "provider-conflict" | "invalid-input" | "unavailable"; callId?: string; at: string }
export type CapabilityResult<T = SfOperationOutputMap[keyof SfOperationOutputMap]> = (
  | { status: "ok"; outputRef?: string; result: T; receipt: BoundCapabilityReceipt }
  | { status: "needs-input" | "stale" | "denied" | "unavailable" | "provider-conflict" | "failed"; reason: string; result?: never; receipt: CapabilityReceipt }
)
export type CapabilityDescriptor = {
  id: string
  pack: string
  mode: "read" | "simulate" | "prepare" | "execute_admitted"
  inputSchema: Readonly<Record<string, unknown>>
  outputSchema: Readonly<Record<string, unknown>>
  handler: (input: unknown, trustedContext: TrustedDomainContext) => Promise<CapabilityResult>
  handlerExport: string
  producerTask: string
  grantProfiles: readonly ResidentProfile["id"][]
  requiredAuthority: readonly string[]
}
