import type { Snapshot } from "../../runtime/contract.ts"
import type { DecisionCase } from "./decisions.ts"
import type { PreservedReview, ConfirmationRecord, CommandReceipt } from "./context.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"

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
  contributions: Record<string, ContributionEnvelope>
  documents: Record<string, unknown>
  receipts: Record<string, CommandReceipt>
  atlas: Record<string, unknown>
  outbox: Record<string, unknown>
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
