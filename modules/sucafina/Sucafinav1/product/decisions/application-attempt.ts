import { digestSfValue } from "../contracts/canonical.ts"
import type { PreparedChange } from "../contracts/decisions.ts"
import type { SfProductState, SfStateAuthority, SfStateResult } from "../contracts/state.ts"
import { sfTransactionIdentity, sfTransactionLookup, sfTransactionProfileMatches } from "../host-binding/state-provider.ts"
import { object } from "../../runtime/contract.ts"
import { receiptProofKey, receiptReviewBinding, type PreparedApplyRequest } from "./receipt-review-binding.ts"

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

export function applicationAbortKey(request: PreparedApplyRequest, ordinal: number) {
  return `decision-application-abort:${digestSfValue({ caseId: request.caseRef.id, caseIncarnation: request.caseRef.incarnation, changeId: request.changeId })}:${ordinal}`
}

export function applicationDispatchKey(request: PreparedApplyRequest, ordinal: number) {
  return ordinal === 0 ? applicationAttemptKey(request) : `${applicationAttemptKey(request)}:dispatch:${ordinal}`
}

export function applicationDispatchAttempt(request: PreparedApplyRequest, attempt: ReturnType<typeof applicationAttempt>, ordinal: number, previousAbortDigest: string) {
  return {
    schema: "sf-decision-application-dispatch-v1" as const, state: "receipt-required" as const,
    caseRef: structuredClone(request.caseRef), changeId: request.changeId, choiceId: request.choiceId,
    requestDigest: digestSfValue(request), attemptDigest: digestSfValue(attempt),
    principalRef: attempt.principalRef, operationIdentity: attempt.operationIdentity, ordinal, previousAbortDigest,
  }
}

export function applicationAbort(request: PreparedApplyRequest, attempt: ReturnType<typeof applicationAttempt>, ordinal: number, reservation: SfProductState["transactions"][string]) {
  return {
    schema: "sf-decision-application-abort-v1" as const, state: "rolled-back" as const,
    caseRef: structuredClone(request.caseRef), changeId: request.changeId, choiceId: request.choiceId,
    requestDigest: digestSfValue(request), attemptDigest: digestSfValue(attempt),
    ordinal, reservationDigest: digestSfValue(reservation),
  }
}

/** Reconstruct the complete C08 reservation envelope returned by this successful CAS. */
export function applicationReservation(request: PreparedApplyRequest, principalRef: string, value: unknown, reserved: Extract<SfStateResult<unknown>, { status: "ok" | "preview" }>): SfProductState["transactions"][string] {
  return {
    namespace: "cases", scopeDigest: digestSfValue(["cases"]), principalRef,
    targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation,
    commandDigest: digestSfValue(value), storageVersion: reserved.storageVersion,
    aggregateRevision: reserved.aggregateRevision, incarnation: reserved.incarnation, value: structuredClone(value),
  }
}

type ApplicationDispatchState =
  | { state: "new"; ordinal: 0 }
  | { state: "pending"; ordinal: number; reservation: SfProductState["transactions"][string] }
  | { state: "aborted"; ordinal: number; reservation: SfProductState["transactions"][string]; abort: SfProductState["transactions"][string] }
  | { state: "indeterminate" }

/** An immutable base attempt plus a contiguous, authenticated abort/dispatch chain.
 * Absence of a receipt, an ordinary failure, or a missing journal never permits redispatch. */
export function applicationDispatchState(state: Readonly<SfProductState>, request: PreparedApplyRequest, attempt: ReturnType<typeof applicationAttempt>, change: PreparedChange, authority: SfStateAuthority): ApplicationDispatchState {
  const selected = applicationAttempts(state, request, authority)
  if (selected.status === "ambiguous") return { state: "indeterminate" }
  const attempts = selected.entries
  const dispatchPrefix = `${applicationAttemptKey(request)}:dispatch:`
  const abortPrefix = applicationAbortKey(request, 0).slice(0, -1)
  const related = Object.keys(state.transactions).filter((key) => key.includes(`"${dispatchPrefix}`) || key.includes(`"${abortPrefix}`))
  const indeterminate = { state: "indeterminate" as const }
  if (!attempts.length) return related.length ? indeterminate : { state: "new", ordinal: 0 }
  if (attempts.length !== 1) return indeterminate
  const valid = (proof: SfProductState["transactions"][string]) => proof.namespace === "cases" && proof.scopeDigest === digestSfValue(["cases"]) &&
    proof.principalRef === attempt.principalRef && proof.targetRef === request.caseRef.id && proof.targetIncarnation === request.caseRef.incarnation &&
    proof.incarnation === state.incarnation && proof.commandDigest === digestSfValue(proof.value) &&
    Number.isSafeInteger(proof.storageVersion) && proof.storageVersion > 0 && proof.storageVersion <= state.versions.cases &&
    Number.isSafeInteger(proof.aggregateRevision) && proof.aggregateRevision > 0 && proof.aggregateRevision <= state.revision
  const original = attempts[0]!
  if (!valid(original) || digestSfValue(original.value) !== digestSfValue(attempt)) return indeterminate
  const lookup = (idempotencyKey: string) => sfTransactionLookup(state, authority, { namespace: "cases", targetRef: request.caseRef.id, idempotencyKey })
  const observed = { reservation: original, ordinal: 0, related: 0 }
  const transactions = new Set<string>()
  while (observed.ordinal <= related.length) {
    const abort = lookup(applicationAbortKey(request, observed.ordinal))
    if (abort.status === "ambiguous") return indeterminate
    const aborted = abort.status === "found" ? abort.receipt : undefined
    if (!aborted) return observed.related === related.length ? { state: "pending", ordinal: observed.ordinal, reservation: observed.reservation } : indeterminate
    observed.related++
    const value = object(aborted.value)
    const rollback = object(value.rollback)
    const command = object(rollback.command)
    const envelope = object(rollback.envelope)
    const versions = object(envelope.versions)
    if (!valid(aborted) || digestSfValue(value) !== digestSfValue({ ...applicationAbort(request, attempt, observed.ordinal, observed.reservation), rollback }) ||
      typeof rollback.storageIdentity !== "string" || !/^[a-f0-9]{64}$/.test(rollback.storageIdentity) ||
      typeof rollback.transactionId !== "string" || !/^[a-f0-9-]{36}$/.test(rollback.transactionId) || transactions.has(rollback.transactionId) ||
      command.namespace !== "receipts" || command.domainSurface !== change.target.surface || command.targetRef !== change.target.id ||
      command.targetIncarnation !== change.target.incarnation || command.idempotencyKey !== receiptProofKey(change.idempotencyKey) || command.commandDigest !== attempt.reviewBinding ||
      command.sourceFence !== undefined || command.checkNamespaces !== undefined || command.expectedStorageVersion !== versions.receipts ||
      digestSfValue(command.additionalNamespaces) !== digestSfValue([{ namespace: "cases", expectedStorageVersion: observed.reservation.storageVersion }]) ||
      envelope.incarnation !== state.incarnation || digestSfValue(Object.keys(versions).sort()) !== digestSfValue(Object.keys(state.versions).sort()) ||
      Object.values(versions).some((version) => typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) || versions.cases !== observed.reservation.storageVersion ||
      typeof envelope.aggregateRevision !== "number" || !Number.isSafeInteger(envelope.aggregateRevision) || envelope.aggregateRevision < observed.reservation.aggregateRevision ||
      aborted.storageVersion !== observed.reservation.storageVersion + 1 || aborted.aggregateRevision <= envelope.aggregateRevision) return indeterminate
    transactions.add(rollback.transactionId)
    const dispatch = lookup(applicationDispatchKey(request, observed.ordinal + 1))
    if (dispatch.status === "ambiguous") return indeterminate
    const next = dispatch.status === "found" ? dispatch.receipt : undefined
    if (!next) return observed.related === related.length ? { state: "aborted", ordinal: observed.ordinal, reservation: observed.reservation, abort: aborted } : indeterminate
    observed.related++
    const expected = applicationDispatchAttempt(request, attempt, observed.ordinal + 1, digestSfValue(aborted))
    if (!valid(next) || digestSfValue(next.value) !== digestSfValue(expected) || next.storageVersion <= aborted.storageVersion || next.aggregateRevision <= aborted.aggregateRevision) return indeterminate
    observed.ordinal++
    observed.reservation = next
  }
  return indeterminate
}
