import type { Snapshot } from "../../runtime/contract.ts"
import type { DecisionCase, ScenarioResult, ScenarioComparison, PortfolioResult } from "./decisions.ts"
import type { SensitivityResult } from "./outputs.ts"
import type { PreservedReview, ConfirmationRecord, CommandReceipt } from "./context.ts"
import type { ContributionEnvelope, ResidentProfile, SkillManifest, SkillLoadReceipt } from "./resident-ai.ts"
import type { BusinessEvidenceRef, MemoryWriteReceipt } from "./business-context.ts"

export type SfAtlasOutboxEntry = {
  eventRef: Extract<BusinessEvidenceRef, { kind: "case-event" }>
  writerPrincipalRef: string
  accessRevision: string
  createdAt: string
  attempts: number
} & (
  | { state: "pending"; receipt?: never }
  | { state: "settled"; receipt: MemoryWriteReceipt }
)

/** Private admission state, distinct from a contribution whose load provenance must already exist. */
export type SfNativeRunRecord = {
  schema: "sf-native-run-v1"
  runRef: string
  version: number
  requestDigest: string
  skillInputDigest: string
  principalRef: string
  accessRevision: string
  policyVersion: string
  caseRef: { id: string; incarnation: string; version: number }
  selection: { profile: ResidentProfile; skills: readonly SkillManifest[]; operationIds: readonly string[]; manifestDigest: string }
  model: { providerID: string; id: string; variant?: string }
  skillId: string
  objective: string
  contextFingerprint: string
  createdAt: string
  updatedAt: string
  reviewTarget?: { targetRunId: string; targetSessionId: string; targetOutputDigest: string; caseRef: { id: string; incarnation: string; version: number } }
} & (
  | { state: "preparing" | "needs-input" | "unavailable" | "failed" | "cancelled"; reason?: string; native?: never; outputRef?: never }
  | { state: "queued" | "running" | "ready" | "stale" | "needs-input" | "unavailable" | "failed" | "cancelled"; reason?: string; native: { sessionID: string; skillReceipt: SkillLoadReceipt }; outputRef?: string }
)

/** Deterministic domain results are versioned with cases, without inventing AI provenance. */
export type SfStoredDecisionResult = {
  schema: "sf-decision-result-v1"
  resultRef: string
  caseRef: { id: string; incarnation: string; version: number }
  principalRef: string
  accessRevision: string
  policyVersion: string
  requestDigest: string
  resultDigest: string
  sourceRefs: readonly BusinessEvidenceRef[]
  createdAt: string
} & (
  | { kind: "scenario"; result: ScenarioResult }
  | { kind: "comparison"; result: ScenarioComparison }
  | { kind: "sensitivity"; result: SensitivityResult }
  | { kind: "portfolio"; result: PortfolioResult }
)

export type SfProductState = {
  schemaVersion: 1
  revision: number
  versions: Record<SfStateNamespace, number>
  incarnation: string
  preferences: Record<string, unknown>
  reviews: Record<string, PreservedReview>
  relations: Record<string, unknown>
  threads: Record<string, unknown>
  confirmations: Record<string, ConfirmationRecord>
  cases: Record<string, DecisionCase>
  /** Owned by the existing cases namespace; older stores omit it. */
  decisionResults?: Record<string, SfStoredDecisionResult>
  contributions: Record<string, ContributionEnvelope>
  /** Owned and versioned by the existing contributions namespace; omitted only in pre-admission stores. */
  nativeRuns?: Record<string, SfNativeRunRecord>
  documents: Record<string, unknown>
  receipts: Record<string, CommandReceipt>
  atlas: Record<string, unknown>
  outbox: Record<string, SfAtlasOutboxEntry>
  transactions: Record<string, { namespace: SfStateNamespace; scopeDigest: string; principalRef: string; targetRef: string; targetIncarnation: string; commandDigest: string; storageVersion: number; aggregateRevision: number; incarnation: string; value: unknown }>
}
export type SfStateNamespace = "preferences" | "reviews" | "relations" | "threads" | "confirmations" | "cases" | "contributions" | "documents" | "receipts" | "atlas" | "outbox"
export type SfStateAuthority = { principalRef: string; accessRevision: string; policyVersion: string }
export type SfStateMutation = {
  namespace: SfStateNamespace
  expectedStorageVersion: number
  additionalNamespaces?: readonly { namespace: SfStateNamespace; expectedStorageVersion: number }[]
  idempotencyKey: string
  commandDigest: string
  targetRef: string
  targetIncarnation: string
}
export type SfStateResult<T> =
  | { status: "ok" | "preview"; storageVersion: number; aggregateRevision: number; incarnation: string; value: T }
  | { status: "denied" | "unavailable" | "conflict"; reason: string }
export type SfProductStatePort = {
  read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) => Promise<SfStateResult<T>>
  transaction: <T>(request: Request, input: SfStateMutation, work: (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>) => Promise<SfStateResult<T>>
}
