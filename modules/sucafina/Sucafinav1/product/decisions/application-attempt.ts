import { digestSfValue } from "../contracts/canonical.ts"
import type { PreparedChange } from "../contracts/decisions.ts"
import type { SfProductState } from "../contracts/state.ts"
import { receiptReviewBinding, type PreparedApplyRequest } from "./receipt-review-binding.ts"

/** The reservation is global to the change, even though transaction receipts are actor-scoped. */
export function applicationAttemptKey(request: PreparedApplyRequest) {
  return `decision-application-attempt:${digestSfValue({ caseId: request.caseRef.id, caseIncarnation: request.caseRef.incarnation, changeId: request.changeId })}`
}

export function applicationAttempts(state: Readonly<SfProductState>, request: PreparedApplyRequest) {
  const key = applicationAttemptKey(request)
  return Object.entries(state.transactions).filter(([identity, value]) => identity === JSON.stringify([value.principalRef, "cases", request.caseRef.id, key])).map(([, value]) => value)
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
