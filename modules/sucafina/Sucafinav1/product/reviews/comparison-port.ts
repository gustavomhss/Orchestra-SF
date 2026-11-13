import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { createReviewPort } from "./port.ts"
import type { createReviewClosurePort } from "./closure-action.ts"
import { compareReviews } from "./compare.ts"

export type ReviewComparisonRead = {
  comparison: ReturnType<typeof compareReviews>
  forwardings: readonly {
    reviewRef: string
    closureRef: string
    relationId: string
    sourceRef: string
    preservedAction: HotTopic
    currentAction: HotTopic
  }[]
  forwardingCoverage: "complete" | "partial" | "unavailable"
  limitations: readonly string[]
}

/** Compare two authorized immutable bases, with a separate fresh read of each canonical action. */
export function createReviewComparisonPort(input: {
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  closures?: Pick<ReturnType<typeof createReviewClosurePort>, "listByReview">
  host: Pick<DomainPortHost, "revalidate">
}) {
  return {
    async read(reviewRef: string, context: TrustedDomainContext): Promise<PortResult<ReviewComparisonRead>> {
      try {
        if (typeof reviewRef !== "string" || !reviewRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-access-unavailable" }
        const current = await input.reviews.read(reviewRef, context)
        if (current.status !== "ok") return { status: current.status, reason: "comparison-access-unavailable" }
        const previous = current.value.previousReviewRef ? await input.reviews.read(current.value.previousReviewRef, context) : undefined
        const references = previous?.status === "ok" ? [previous.value.id, current.value.id] : [current.value.id]
        const closures = input.closures ? await Promise.all(references.map((ref) => input.closures!.listByReview(ref, context))) : undefined
        const again = await input.reviews.read(reviewRef, context)
        const previousAgain = current.value.previousReviewRef ? await input.reviews.read(current.value.previousReviewRef, context) : undefined
        if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value) || previous?.status === "ok" && (previousAgain?.status !== "ok" || digestSfValue(previousAgain.value) !== digestSfValue(previous.value)) || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-access-unavailable" }
        const comparison = compareReviews(previous?.status === "ok" ? previous.value : null, again.value)
        if (comparison.state === "unavailable") return { status: "ok", value: { comparison, forwardings: [], forwardingCoverage: "unavailable", limitations: ["Forwardings are unavailable for this comparison."] } }
        const forwardings = (closures ?? []).flatMap((result) => result.status === "ok" ? result.value.entries.map(({ closure, currentAction }) => ({ reviewRef: closure.reviewRef, closureRef: closure.id, relationId: closure.relationId, sourceRef: closure.handoff.sourceRef, preservedAction: closure.topic, currentAction })) : [])
        const forwardingCoverage = !closures ? "unavailable" : closures.some((result) => result.status !== "ok" || result.value.coverage === "partial") ? "partial" : "complete"
        return { status: "ok", value: { comparison, forwardings, forwardingCoverage, limitations: forwardingCoverage === "complete" ? [] : ["Some forwarding references are unavailable under current access. Preserved financial values are unchanged."] } }
      } catch {
        return { status: "unavailable", reason: "comparison-unavailable" }
      }
    },
  }
}
