import type { HandoffPrepareRequest } from "../contracts/operations.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessPorts } from "../contracts/ports.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { HandoffProposal } from "../contracts/outputs.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort } from "./port.ts"

export type ReviewMeetingClosure =
  | { status: "ok"; review: PreservedReview; handoff: HandoffProposal }
  | { status: "unavailable"; reason: string; review?: PreservedReview; handoff: HandoffPrepareRequest }
  | { status: "denied" | "stale" | "conflict" | "failed" | "needs-input" | "provider-conflict"; reason: string; handoff: HandoffPrepareRequest }

/** Close a meeting against its preserved financial review and prepare its canonical handoff. */
export async function closeReviewMeeting(input: {
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  reviewRef: string
  context: TrustedDomainContext
  handoffContext: TrustedDomainContext
  handoff: HandoffPrepareRequest
  dispatch: BusinessPorts["dispatch"]
  authorizeHandoff: (review: PreservedReview, handoff: HandoffPrepareRequest, context: TrustedDomainContext) => Promise<boolean>
}): Promise<ReviewMeetingClosure> {
  if ((["principalRef", "installationId", "projectId", "accessRevision", "policyVersion"] as const).some((key) => input.context.binding[key] !== input.handoffContext.binding[key])) return { status: "denied", reason: "handoff-context-mismatch", handoff: input.handoff }
  if (!decodeSfOperationInput("sf_handoff_prepare", input.handoff).ok) return { status: "needs-input", reason: "invalid-handoff", handoff: input.handoff }
  const review = await input.reviews.read(input.reviewRef, input.context)
  if (review.status !== "ok") return {
    status: review.status === "unavailable" ? "unavailable" : review.status,
    reason: review.reason,
    handoff: input.handoff,
  }

  if (!await input.authorizeHandoff(review.value, input.handoff, input.context)) return { status: "denied", reason: "handoff-access-unavailable", handoff: input.handoff }
  const result = await input.dispatch("sf_handoff_prepare", input.handoff, input.handoffContext)
  const fresh = await input.reviews.read(input.reviewRef, input.context)
  if (fresh.status !== "ok" || digestSfValue(fresh.value) !== digestSfValue(review.value) || !await input.authorizeHandoff(fresh.value, input.handoff, input.context)) return { status: "denied", reason: "review-access-unavailable", handoff: input.handoff }
  if (result.status !== "ok") return {
    status: result.status === "unavailable" ? "unavailable" : result.status,
    reason: result.reason,
    review: review.value,
    handoff: input.handoff,
  }
  const proposal = decodeSfOperationOutput("sf_handoff_prepare", result.result)
  if (!proposal.ok || proposal.value.domainApplied !== false || digestSfValue({ caseRef: proposal.value.caseRef, actionRef: proposal.value.actionRef, ...(proposal.value.recipientRef === undefined ? {} : { recipientRef: proposal.value.recipientRef }), sourceRefs: proposal.value.sourceRefs }) !== digestSfValue(input.handoff)) return {
    status: "unavailable",
    reason: "handoff-producer-returned-invalid-proposal",
    review: review.value,
    handoff: input.handoff,
  }
  return { status: "ok", review: review.value, handoff: proposal.value }
}
