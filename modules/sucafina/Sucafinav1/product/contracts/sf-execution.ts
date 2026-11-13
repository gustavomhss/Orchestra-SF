import type { SkillLoadReceipt, ResidentProfile } from "./resident-ai.ts"
import type { HostBoundEntryMode } from "./context.ts"

export type TrustedExecutionBinding = {
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
}
export type CapabilityResult = {
  status: "ok" | "needs-input" | "stale" | "denied" | "unavailable" | "provider-conflict" | "failed"
  outputRef?: string
  result?: unknown
  receipt: { operation: string; handlerExport: string; inputDigest: string; resultDigest?: string; runId: string; callId: string; providerGeneration: number; accessRevision: string; at: string }
}
export type CapabilityDescriptor = {
  id: string
  pack: string
  mode: "read" | "simulate" | "prepare" | "admitted-routine"
  inputSchema: Readonly<Record<string, unknown>>
  outputSchema: Readonly<Record<string, unknown>>
  handler: (input: unknown, trustedContext: TrustedExecutionBinding) => Promise<CapabilityResult>
  handlerExport: string
  producerTask: string
  grantProfiles: readonly ResidentProfile["id"][]
  requiredAuthority: readonly string[]
}
