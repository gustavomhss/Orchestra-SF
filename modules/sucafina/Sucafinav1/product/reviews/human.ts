import { digestSfValue } from "../contracts/canonical.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createReviewPort } from "./port.ts"

/** Human-only durable admission; the operation identity is obtained from the authenticated host. */
export function createReviewHumanPort(input: {
  state: SfProductStatePort
  reviews: ReturnType<typeof createReviewPort>
  human: ReturnType<typeof createSfHumanAuthority>
  ui: Pick<ReturnType<typeof createSfUiAuthority>, "operationIdentity">
  creationTarget: { ref: string; incarnation: string }
}) {
  return {
    async preserve(request: Request, payload: unknown): Promise<PortResult<PreservedReview>> {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { status: "needs-input", reason: "invalid-selection" }
      const value = payload as Record<string, unknown>
      if (Object.keys(value).some((key) => !["selectionRef", "sectionRefs", "previousReviewRef"].includes(key)) || typeof value.selectionRef !== "string" || !value.selectionRef.trim() || !Array.isArray(value.sectionRefs) || !value.sectionRefs.length || !value.sectionRefs.every((id) => typeof id === "string" && !!id.trim()) || new Set(value.sectionRefs).size !== value.sectionRefs.length || (value.previousReviewRef !== undefined && (typeof value.previousReviewRef !== "string" || !value.previousReviewRef.trim()))) return { status: "needs-input", reason: "invalid-selection" }
      const admitted = await input.human.admit(request, "reviews.preserve", payload)
      if (admitted.status !== "ok") return admitted
      const context = admitted.value
      try {
        const operation = input.ui.operationIdentity(context)
        if (!operation || !await input.human.authorize(context, "reviews.preserve", payload)) return { status: "denied", reason: "review-access-unavailable" }
        const before = await input.state.read(request, "reviews", () => null)
        if (before.status !== "ok" && !(before.status === "unavailable" && before.reason === "product-state-uninitialized")) return { status: "unavailable", reason: "review-storage-unavailable" }
        const result = await input.reviews.preserve({ id: `review:${digestSfValue({ principal: context.binding.principalRef, operation })}`, selectionRef: value.selectionRef, sectionRefs: value.sectionRefs, ...(typeof value.previousReviewRef === "string" ? { previousReviewRef: value.previousReviewRef } : {}), expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0, idempotencyKey: operation, targetIncarnation: input.creationTarget.incarnation }, context)
        if (result.status !== "ok") return result
        if (!await input.human.authorize(context, "reviews.preserve", payload)) return { status: "denied", reason: "review-access-unavailable" }
        return { status: "ok", value: result.value }
      } finally {
        input.human.finish(context)
      }
    },
  }
}
