import { digestSfValue } from "../contracts/canonical.ts"
import type { PreparedChange } from "../contracts/decisions.ts"
import type { SfProductState, SfStateAuthority } from "../contracts/state.ts"
import { sfTransactionIdentity, sfTransactionProfileMatches } from "../host-binding/state-provider.ts"
import { receiptReviewBinding, type PreparedApplyRequest } from "./receipt-review-binding.ts"

/** The reservation is global to the change, even though transaction receipts are actor-scoped. */
export function applicationAttemptKey(request: PreparedApplyRequest) {
  return `decision-application-attempt:${digestSfValue({ caseId: request.caseRef.id, caseIncarnation: request.caseRef.incarnation, changeId: request.changeId })}`
}

export type ApplicationAttemptSelection =
  | { status: "verified"; entries: readonly SfProductState["transactions"][string][] }
  | { status: "ambiguous" }

/** Keep reservations global across actors, but never adopt a different profile's outcome. */
export function applicationAttempts(state: Readonly<SfProductState>, request: PreparedApplyRequest, authority: SfStateAuthority): ApplicationAttemptSelection {
  return applicationIntentReceipts(state, authority, { targetRef: request.caseRef.id, idempotencyKey: applicationAttemptKey(request) })
}

/** Metadata selection only; exact intent, resource, current grants and receipt bytes remain the caller's checks. */
export function applicationIntentReceipts(state: Readonly<SfProductState>, authority: SfStateAuthority, command: { targetRef: string; idempotencyKey: string }): ApplicationAttemptSelection {
  const entries: SfProductState["transactions"][string][] = []
  for (const [storedKey, receipt] of Object.entries(state.transactions)) {
    const identity = sfTransactionIdentity(storedKey)
    const legacyKey = JSON.stringify([receipt.principalRef, "cases", command.targetRef, command.idempotencyKey])
    const matches = identity?.namespace === "cases" && identity.targetRef === command.targetRef && identity.idempotencyKey === command.idempotencyKey
    // An unknown suffix on the same durable intention is uncertain, not absent.
    if (!matches && storedKey !== legacyKey && !storedKey.startsWith(`${legacyKey.slice(0, -1)},`)) continue
    if (!identity || identity.principalRef !== receipt.principalRef || !sfTransactionProfileMatches(authority.profile, storedKey))
      return { status: "ambiguous" }
    entries.push(receipt)
  }
  return { status: "verified", entries }
}

/** An ambiguous reservation is still a reason to refuse another dispatch. */
export function hasApplicationAttempt(state: Readonly<SfProductState>, request: PreparedApplyRequest, authority: SfStateAuthority) {
  const selected = applicationAttempts(state, request, authority)
  return selected.status === "ambiguous" || selected.entries.length > 0
}

/** A reservation proves dispatch may have begun. Only an authoritative receipt proves its effect. */
export function applicationAttempt(request: PreparedApplyRequest, change: PreparedChange, reviewDigest: string, principalRef: string, operationIdentity: string) {
  return {
    schema: "sf-decision-application-attempt-v1" as const,
    state: "receipt-required" as const,
    caseRef: structuredClone(request.caseRef),
    changeId: request.changeId,
    choiceId: request.choiceId,
    changeDigest: digestSfValue(change),
    reviewBinding: receiptReviewBinding(change, reviewDigest),
    principalRef,
    operationIdentity,
  }
}
