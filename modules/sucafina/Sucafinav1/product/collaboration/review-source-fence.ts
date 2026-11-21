import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewAnswerSource } from "../reviews/review-answer-source.ts"
import type { ThreadSourceContext } from "./thread-context.ts"

/** Prepared outside C08; the returned check only reads protected snapshots and
 * current authenticated ACL leases, without collecting sources or issuing refs. */
export type PrepareReviewThreadFence = (basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<(() => Promise<boolean>) | undefined>

export function createReviewThreadSourceFence(input: { source: () => ReturnType<typeof createReviewAnswerSource> | undefined }): PrepareReviewThreadFence {
  return async (basis, context) => {
    try {
      const getSource = input.source
      const source = getSource()
      if (!source || !basis.reviewContext) return undefined
      const prepare = source.prepareThreadFence
      const selected = structuredClone({ ...basis, reviewContext: basis.reviewContext })
      const current = () => input.source === getSource && getSource() === source && source.prepareThreadFence === prepare
      const fence = await prepare.call(source, selected, context)
      if (!current() || !fence) return undefined
      return async () => {
        try { return current() && await fence() && current() } catch { return false }
      }
    } catch { return undefined }
  }
}
