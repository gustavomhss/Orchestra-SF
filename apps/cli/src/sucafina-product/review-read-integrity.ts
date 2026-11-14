import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

/** Every consumer reopens the body's own C08 receipt, in addition to producer ACL checks. */
export function protectSfReviewReads(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  reviews: ReturnType<typeof createReviewPort>
}) {
  const { authority, reviews } = input
  const read = reviews.read.bind(reviews)
  reviews.read = async (id: string, call: TrustedDomainContext): Promise<PortResult<PreservedReview>> => {
    const denied = (): PortResult<PreservedReview> => ({ status: "denied", reason: "review-integrity-unavailable" })
    try {
      const request = authority.host.requestFor(call)
      if (!request || request.signal.aborted || !await authority.host.revalidate(call)) return denied()
      const binding = digestSfValue([call.kind, call.binding])
      const first = await read(id, call)
      if (first.status !== "ok") return first
      const digest = digestSfValue(first.value)
      const proof = () => authority.state.read(request, "reviews", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
          !state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return undefined
        // The original writer may differ from the current authorized reader.
        // Current read rights are still checked by the real Review producer.
        const receipts = Object.values(state.transactions).filter((receipt) => {
          if (receipt.namespace !== "reviews" || !receipt.principalRef.trim() || receipt.targetRef !== authority.creationTarget.ref ||
            receipt.targetIncarnation !== authority.creationTarget.incarnation || !receipt.value || typeof receipt.value !== "object" || Array.isArray(receipt.value)) return false
          const value = receipt.value
          if ("schema" in value) return value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 &&
            "reviewRef" in value && value.reviewRef === id && "reviewDigest" in value && value.reviewDigest === digest
          return "id" in value && value.id === id && digestSfValue(value) === digest
        })
        return receipts.length ? digestSfValue(receipts) : undefined
      })
      const before = await proof()
      if (before.status !== "ok" || !before.value) return denied()
      const current = await read(id, call)
      const after = await proof()
      if (current.status !== "ok" || digestSfValue(current.value) !== digest || after.status !== "ok" || after.value !== before.value ||
        request.signal.aborted || binding !== digestSfValue([call.kind, call.binding]) || !await authority.host.revalidate(call)) return denied()
      return first
    } catch { return denied() }
  }
}
