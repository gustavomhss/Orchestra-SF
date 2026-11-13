import type { Snapshot } from "../../runtime/contract.ts"
import type { DecisionCase } from "./decisions.ts"
import type { PreservedReview, ConfirmationRecord, CommandReceipt } from "./context.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"

export type SfProductState = {
  schemaVersion: 1
  revision: number
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
  transactions: Record<string, { namespace: SfStateNamespace; principalRef: string; commandDigest: string; revision: number; incarnation: string; value: unknown }>
}
export type SfStateNamespace = Exclude<keyof SfProductState, "schemaVersion" | "revision" | "incarnation" | "transactions">
export type SfStateAuthority = { principalRef: string; accessRevision: string; policyVersion: string }
export type SfStateResult<T> =
  | { status: "ok"; revision: number; incarnation: string; value: T }
  | { status: "denied" | "unavailable" | "conflict"; reason: string }
export type SfProductStatePort = {
  read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) => Promise<SfStateResult<T>>
  transaction: <T>(request: Request, input: { namespace: SfStateNamespace; expectedVersion: number; idempotencyKey: string; commandDigest: string }, work: (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>) => Promise<SfStateResult<T>>
}
