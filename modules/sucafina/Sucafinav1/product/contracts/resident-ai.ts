import type { BusinessEvidenceRef } from "./business-context.ts"

export type ResidentProfile = {
  id: "sf_maestro" | "sf_finance" | "sf_procurement" | "sf_portfolio" | "sf_reviewer"
  version: string
  mission: string
  allowedSkills: readonly string[]
  allowedOperations: readonly string[]
  outputTypes: readonly string[]
  contextBudgetTokens: number
  maxSteps: number
  maxDelegations: number
  modelClass: string
  resumePolicy: string
  sourcePath: string
  sourceDigest: string
}
export type SkillManifest = {
  id: string
  version: string
  sourcePath: string
  sourceDigest: string
  instructionsDigest: string
  inputSchemaRef: string
  outputSchemaRefs: readonly string[]
  allowedProfiles: readonly ResidentProfile["id"][]
  allowedOperations: readonly string[]
  workflow: readonly string[]
  limits: { maxSteps: number; contextBudgetTokens: number }
  positiveAcceptance: readonly string[]
  negativeAcceptance: readonly string[]
}
export type SkillLoadReceipt = {
  runId: string
  nativeSessionId: string
  profileId: ResidentProfile["id"]
  profileVersion: string
  profileDigest: string
  skillId: string
  skillVersion: string
  sourceDigest: string
  instructionsDigest: string
  loadedMessageId: string
  loadedAt: string
  manifestDigest: string
}
export type ContributionEnvelope = {
  id: string
  caseRef: { id: string; version: number; incarnation: string }
  kind: string
  schemaVersion: string
  state: "queued" | "running" | "needs-input" | "ready" | "stale" | "cancelled" | "failed" | "unavailable"
  payload: unknown
  evidenceRefs: readonly BusinessEvidenceRef[]
  runProvenance: SkillLoadReceipt & { actualModel: string; contextFingerprint: string; reviewerRunId?: string; targetRunId?: string; targetOutputDigest?: string }
  accessRevision: string
  createdAt: string
  outputDigest: string
}
export type ConsumptionReceipt = {
  outputRef: string
  outputDigest: string
  consumerTask: string
  consumerRef: string
  observedAction: string
  observedAt: string
  authorizedPrincipalRef: string
  caseVersion: number
}
