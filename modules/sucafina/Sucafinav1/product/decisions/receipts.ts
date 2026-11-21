import { digestSfValue } from "../contracts/canonical.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"

/** The domain owns the atomic mutation and receipt; this only correlates an observed receipt. */
export function reconcileDomainReceipt(input: {
  change: PreparedChange
  receipt: CommandReceipt
  principalRef: string
  state: "applied" | "awaiting-approval" | "conflict" | "failed" | "cancelled"
}): { status: "ok"; change: PreparedChange } | { status: "conflict"; reason: string } {
  const change = input.change
  const receipt = input.receipt
  if (change.operation.idempotencyKey !== change.idempotencyKey || change.operation.target.incarnation !== change.target.incarnation || change.operation.target.surface !== change.target.surface || receipt.principalRef !== input.principalRef || receipt.surface !== change.target.surface || receipt.targetIncarnation !== change.target.incarnation || receipt.idempotencyKey !== change.idempotencyKey || receipt.commandDigest !== change.operation.commandDigest) return { status: "conflict", reason: "receipt-identity-mismatch" }
  if (receipt.result.ok !== (input.state === "applied" || input.state === "awaiting-approval") || (!receipt.result.ok && (input.state === "conflict") !== (receipt.result.status === 409))) return { status: "conflict", reason: "receipt-outcome-mismatch" }
  if (change.receipt && (digestSfValue(change.receipt) !== digestSfValue(receipt) || change.state !== input.state)) return { status: "conflict", reason: "receipt-already-recorded" }
  return { status: "ok", change: { ...change, state: input.state, receipt: structuredClone(receipt) } }
}

export function caseApplicationState(changes: readonly PreparedChange[]): DecisionCase["state"] {
  if (changes.length && changes.every((change) => change.state === "applied")) return "applied"
  if (changes.some((change) => change.state === "applied")) return "partially-applied"
  return "chosen"
}
