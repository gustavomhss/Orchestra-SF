import { digestSfValue } from "../contracts/canonical.ts"
import type { PreparedChange } from "../contracts/decisions.ts"
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
export function receiptProofTransactionKey(principalRef: string, targetId: string, idempotencyKey: string) {
  return JSON.stringify([principalRef, "receipts", targetId, receiptProofKey(idempotencyKey)])
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
