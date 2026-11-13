import type { Surface } from "../../src/identity.ts"
import type { Period } from "./context.ts"
import type { TrustedExecutionBinding } from "./sf-execution.ts"
import type { DecisionCase, CaseLedgerEvent } from "./decisions.ts"

type Digest = { algorithm: "sha256"; value: string }
type EvidenceIdentity = {
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
}
export type BusinessEvidenceRef = EvidenceIdentity & (
  | { kind: "record"; target: { surface: Surface; recordType: string; recordId: string; incarnation: string; version: number; fields: readonly string[]; period?: Period; projectionDigest: string } }
  | { kind: "document"; target: { documentId: string; incarnation: string; revision: number; blobDigest: Digest; segment: { start: number; end: number; unit: "utf16"; textDigest: Digest }; ragSourceId?: string; ragRevisionId?: string; ragSourceHash?: { algorithm: "blake3"; value: string }; fieldCandidateId?: string; confirmationVersion?: number } }
  | { kind: "calculation"; target: { calculationId: string; runId: string; engineVersion: string; inputDigest: string; resultDigest: string; sourceRefs: readonly BusinessEvidenceRef[]; period: Period; currency: string } }
  | { kind: "receipt"; target: { surface: Surface; receiptId: string; idempotencyKey: string; targetIncarnation: string; commandDigest: string; version: number } }
  | { kind: "case-event"; target: { caseId: string; caseIncarnation: string; caseVersion: number; eventId: string; outputDigest: string; evidenceRefs: readonly BusinessEvidenceRef[] } }
  | { kind: "policy"; target: { packageId: string; version: string; sourceDigest: string; ruleId: string; reviewRef: string; scope: string } }
)
export type BusinessEvidenceResolution = {
  state: "fresh" | "historical" | "stale" | "revoked" | "replaced" | "missing" | "invalid" | "unavailable"
  ref: BusinessEvidenceRef
  currentRef?: BusinessEvidenceRef
  authorizedProjection?: unknown
  differences?: readonly { field: string; before: unknown; after: unknown }[]
  accessRevision: string
  checkedAt: string
}
export type BusinessMemoryEnvelope = {
  schemaVersion: 1
  eventId: string
  owner: string
  kind: "task" | "project"
  caseRef?: { id: string; incarnation: string; version: number }
  sourceEventId: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  dependencies: readonly BusinessEvidenceRef[]
  sourceVersions: Readonly<Record<string, number>>
  sourceIncarnations: Readonly<Record<string, string>>
  projectionDigest: string
  writerPrincipalRef: string
  accessRevision: string
  scannerReceipt: { name: string; version: string; status: "clean"; digest: string }
  createdAt: string
}
export type MemoryWriteReceipt = {
  status: "committed" | "already-committed" | "refused" | "conflict" | "unavailable"
  sourceEventId: string
  eventId?: string
  recordDigest?: string
  committedRevision?: number
  scanner: { name: string; version: string; status: "clean" | "hit" | "unavailable" }
  reason?: string
}
export type BusinessContextService = {
  resolve: (ref: BusinessEvidenceRef, trustedCall: TrustedExecutionBinding) => Promise<BusinessEvidenceResolution>
  context: (request: { refs: readonly BusinessEvidenceRef[] }, trustedCall: TrustedExecutionBinding) => Promise<readonly BusinessEvidenceResolution[]>
  recall: (request: { caseRefs: readonly { id: string; incarnation: string }[]; query: string }, trustedCall: TrustedExecutionBinding) => Promise<readonly { envelope: BusinessMemoryEnvelope; entry: unknown }[]>
  emitFromLedger: (sourceEventRef: BusinessEvidenceRef, trustedCall: TrustedExecutionBinding) => Promise<MemoryWriteReceipt>
}
export type AuthorizedCaseProjection = {
  context: { installationId: string; projectId: string; principalRef: string; profileId: string; policyVersion: string; accessRevision: string }
  case: DecisionCase
  events: readonly CaseLedgerEvent[]
  evidenceRefs: readonly BusinessEvidenceRef[]
  checkedAt: string
}
// Pure WP14 output precedes scanning; only WP10 may turn it into a committed envelope.
export type SfAtlasProjection = {
  kind: "task"
  owner: string
  entry: { taskId: string; attempted: readonly string[]; failedWith: readonly string[]; stoppedAt: string; lesson: string; ref: string }
  sourceEventId: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  projectionDigest: string
} | {
  kind: "project"
  owner: string
  entry: { rule: string; scope: string; frecency: number; grounding?: string }
  sourceEventId: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  projectionDigest: string
}
