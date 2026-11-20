import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { SfProductState, SfStateAuthority } from "../contracts/state.ts"
import { sfTransactionLookup } from "../host-binding/state-provider.ts"
import type { ApplicationAttemptSelection } from "./application-attempt.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type PreparedApplyRequest = { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }
export type ReviewDigestFor = (context: TrustedDomainContext, request: PreparedApplyRequest, change: PreparedChange) => string | undefined
export type AdmittedApply = PreparedApplyRequest & { reviewDigest: string }

export function isReviewDigest(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
}
export function receiptProofKey(idempotencyKey: string) {
  return `prepared:${idempotencyKey}`
}
/** Historical unscoped key encoder; reading its bytes also requires current backend profile authority. */
export function receiptProofTransactionKey(principalRef: string, targetId: string, idempotencyKey: string) {
  return JSON.stringify([principalRef, "receipts", targetId, receiptProofKey(idempotencyKey)])
}
export function receiptProofLookup(state: Pick<SfProductState, "transactions">, authority: SfStateAuthority, targetId: string, idempotencyKey: string) {
  return sfTransactionLookup(state, authority, { namespace: "receipts", targetRef: targetId, idempotencyKey: receiptProofKey(idempotencyKey) })
}
export function receiptReviewBinding(change: PreparedChange, reviewDigest: string) {
  return digestSfValue({
    schema: "sf-receipt-review-binding-v1",
    reviewDigest,
    commandDigest: change.operation.commandDigest,
    idempotencyKey: change.idempotencyKey,
    surface: change.target.surface,
    targetId: change.target.id,
    targetIncarnation: change.target.incarnation,
  })
}
export function proposalReviewDigest(input: {
  caseId: string
  caseIncarnation: string
  changeCaseVersion: number
  choiceDigest: string
  change: PreparedChange
  fields: readonly { field: string; before: string | number | boolean | null; after: string | number | boolean | null; beforeCurrency?: string; afterCurrency?: string }[]
  sourceRefDigest: string
}) {
  return digestSfValue({
    schema: "sf-prepared-review-v1",
    caseId: input.caseId, caseIncarnation: input.caseIncarnation, changeCaseVersion: input.changeCaseVersion,
    choiceDigest: input.choiceDigest, changeId: input.change.id, choiceId: input.change.choiceId,
    expectedVersion: input.change.expectedVersion, idempotencyKey: input.change.idempotencyKey,
    commandDigest: input.change.operation.commandDigest, targetDigest: digestSfValue(input.change.target),
    requiredAuthority: [...input.change.requiredAuthority], fields: input.fields, sourceRefDigest: input.sourceRefDigest,
  })
}
export function sameApplyRequest(left: PreparedApplyRequest, right: PreparedApplyRequest) {
  return left.changeId === right.changeId && left.choiceId === right.choiceId && digestSfValue(left.caseRef) === digestSfValue(right.caseRef)
}

/** Retained inside the existing application attempt; canonical receipt proofs remain raw. */
export function preparedOriginalIntent(request: PreparedApplyRequest, change: PreparedChange, choice: DecisionCase["choices"][number], reviewDigest: string, context: TrustedDomainContext) {
  return {
    schema: "sf-prepared-original-intent-v1" as const,
    request: structuredClone(request),
    changeDigest: digestSfValue({ ...change, state: "planned", receipt: null }),
    choiceDigest: digestSfValue(choice),
    reviewBinding: receiptReviewBinding(change, reviewDigest),
    binding: {
      installationId: context.binding.installationId,
      projectId: context.binding.projectId,
      principalRef: context.binding.principalRef,
      policyVersion: context.binding.policyVersion,
      accessRevision: context.binding.accessRevision,
    },
  }
}

export function preparedOriginalIntentState(state: Readonly<SfProductState>, request: PreparedApplyRequest, change: PreparedChange, choices: readonly DecisionCase["choices"][number][], reviewDigest: string, context: TrustedDomainContext, attempts: ApplicationAttemptSelection) {
  if (attempts.status === "ambiguous") return "mismatch"
  const entries = attempts.entries
  if (!entries.length) return "missing"
  if (entries.length !== 1 || choices.length !== 1) return "mismatch"
  const proof = entries[0]!
  const attempt = proof.value
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt) || !("originalIntent" in attempt)) return "missing"
  const expected = preparedOriginalIntent(request, change, choices[0]!, reviewDigest, context)
  return proof.namespace === "cases" && proof.scopeDigest === digestSfValue(["cases"]) && proof.incarnation === state.incarnation &&
    proof.principalRef === context.binding.principalRef && proof.targetRef === request.caseRef.id && proof.targetIncarnation === request.caseRef.incarnation &&
    proof.commandDigest === digestSfValue(attempt) && digestSfValue(attempt.originalIntent) === digestSfValue(expected) ? "matched" : "mismatch"
}

/** Shared raw-receipt fence. The domain reader must still revalidate current access. */
export function receiptProofMatches(state: Readonly<SfProductState>, target: { surface: CommandReceipt["surface"]; id: string; incarnation: string }, receipt: CommandReceipt, authority: SfStateAuthority) {
  const principalRef = authority.principalRef
  const stored = state.receipts[receipt.id]
  const selected = receiptProofLookup(state, authority, target.id, receipt.idempotencyKey)
  if (selected.status !== "found") return false
  const proof = selected.receipt
  const matches = Object.values(state.receipts).filter((item) => item.surface === target.surface && item.targetIncarnation === target.incarnation && item.idempotencyKey === receipt.idempotencyKey && item.principalRef === principalRef)
  const scope = target.surface === "dashboard" ? ["cases", "receipts"] : { namespaces: ["cases", "receipts"], domainSurface: target.surface }
  return matches.length === 1 && !!stored && !!proof && proof.namespace === "receipts" && proof.scopeDigest === digestSfValue(scope) &&
    proof.principalRef === principalRef && proof.targetRef === target.id && proof.targetIncarnation === target.incarnation && proof.incarnation === state.incarnation &&
    digestSfValue(stored) === digestSfValue(receipt) && digestSfValue(proof.value) === digestSfValue(receipt)
}
