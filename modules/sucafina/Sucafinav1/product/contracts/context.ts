import type { Surface } from "../../src/identity.ts"
import type { Command, Result } from "../../runtime/contract.ts"

export type Period = { start: string; end: string }
export type SourceRef = {
  surface: Surface
  type: string
  id: string
  incarnation: string
  version: number
  fields: readonly string[]
  period: Period
  observedAt: string
}
export type ProductContext = {
  installationId: string
  projectId: string
  principalRef: string
  accessRevision: string
  policyVersion: string
  surface: Surface
  period: Period
  currency: string
  sourceRefs: readonly SourceRef[]
  capabilities: readonly string[]
}
export type EvidenceState = "confirmed" | "estimated" | "hypothetical" | "absent"
export type ProjectionComponent = {
  id: string
  amount: number | null
  currency: string
  period: Period
  sourceRefs: readonly SourceRef[]
  evidenceState: EvidenceState
}
export type DomainProjection = {
  context: ProductContext
  version: number
  engineVersion: string
  components: readonly ProjectionComponent[]
  values: Readonly<Record<string, unknown>>
  missing: readonly { field: string; reason: string }[]
}
export type PreparedCommand = {
  id: string
  target: SourceRef
  command: Command
  idempotencyKey: string
  commandDigest: string
  requiredAuthority: readonly string[]
  preview: DomainProjection
}
export type CommandReceipt = {
  id: string
  idempotencyKey: string
  commandDigest: string
  targetIncarnation: string
  principalRef: string
  surface: Surface
  version: number
  result: Result
  at: string
}
export type ImportManifest = {
  id: string
  version: number
  sourceDigest: string
  format: string
  context: ProductContext
  baseIdentity: readonly SourceRef[]
  commands: readonly PreparedCommand[]
  issues: readonly { row: number; field: string; reason: string }[]
  state: "preview" | "stale" | "blocked" | "applied"
  domainApplied: boolean
  receipts: readonly CommandReceipt[]
}
export type ConfirmationScope = {
  sourceRef: Pick<SourceRef, "surface" | "type" | "id" | "incarnation">
  fields: readonly string[]
  period: Period
  materialDependencies: readonly SourceRef[]
  scopeDefinitionVersion: string
}
export type ConfirmationRecord = {
  id: string
  sourceRef: ConfirmationScope["sourceRef"]
  observedSourceVersion: number
  observedScopeFingerprint: string
  scope: ConfirmationScope
  authorId: string
  confirmedAt: string
  auditRef: string
}
export type ConfirmationCommand = {
  scope: ConfirmationScope
  observedSourceVersion: number
  expectedScopeFingerprint: string
  expectedStorageVersion: number
  idempotencyKey: string
}
export type ConfirmationValidityProjection = {
  confirmationId: string
  state: "valid" | "stale" | "unavailable"
  evaluatedSourceVersion: number
  evaluatedAt: string
  scopeFingerprint?: string
  reason: "unchanged-scope" | "material-change" | "dependency-change" | "source-removed" | "source-replaced" | "access-unavailable" | "dependency-unavailable"
}
export type PreservedReview = {
  id: string
  version: number
  createdAt: string
  sourceRefs: readonly SourceRef[]
  sections: readonly { id: string; title: string; period: Period; content: unknown; count: number }[]
  comments: readonly { id: string; version: number; content: string; sourceRefs: readonly SourceRef[] }[]
  previousReviewRef?: string
}
export type HostBoundEntryMode = "interactive" | "routine-result"
export type RoutineResult = {
  documentId: string
  publishedVersion: string
  principalRef: string
  projectId: string
  admission: "preparing" | "needs-review" | "admitted" | "denied" | "unavailable" | "stale"
  runRef?: string
  resultRef?: string
  authorizationId?: string
  armRef?: string
  childSessionId?: string
  correlationId: string
  sourceRefs: readonly SourceRef[]
  pending: readonly string[]
}
