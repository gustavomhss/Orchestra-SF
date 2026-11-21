import { registerReviewEvidenceBatch } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/authority.ts"
import type { ReviewThreadReadLeg } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/authority.ts"
import type { BusinessContextService, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ReviewThreadContextAuthorizer } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/thread-context.ts"
import type { ReviewThreadRecipientAuthority } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts"
import type { createReviewAnswerSource } from "../../../../modules/sucafina/Sucafinav1/product/reviews/review-answer-source.ts"

export type SfReviewCollaborationBinding = {
  evidence: BusinessContextService
  authorizeReviewThreadContext: ReviewThreadContextAuthorizer
  readLeg?: ReviewThreadReadLeg
  reviewRecipientAuthority: ReviewThreadRecipientAuthority
  reviewAnswerSource: ReturnType<typeof createReviewAnswerSource>
}

/** Collaboration is built before Review. Bind its stable producer callbacks once,
 * after the real application exists; no ID/directory entry supplies authority. */
export function createSfReviewCollaborationBinding(original: BusinessContextService) {
  const holder: { current?: SfReviewCollaborationBinding; resolve?: BusinessContextService["resolve"]; closed: boolean } = { closed: false }
  const unavailable: BusinessContextService["resolve"] = async (ref, call) => ({
    state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString(),
  })
  const resolve: BusinessContextService["resolve"] = async (ref, call) => {
    if (holder.closed) return unavailable(ref, call)
    const bound = holder.current
    const producer = bound?.evidence ?? original
    const read = producer.resolve
    const result: BusinessEvidenceResolution = await read.call(producer, ref, call)
    return !holder.closed && holder.current === bound && producer.resolve === read ? result : unavailable(ref, call)
  }
  const evidence: BusinessContextService = { ...original, resolve,
    context: (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))) }
  const authorizeReviewThreadContext: ReviewThreadContextAuthorizer = async (pin, basis, call, purpose) => {
    const bound = holder.current, authorize = bound?.authorizeReviewThreadContext
    return !!bound && !!authorize && await authorize(pin, basis, call, purpose) && holder.current === bound && !holder.closed && bound.authorizeReviewThreadContext === authorize
  }
  const readLeg: ReviewThreadReadLeg = async (pin, basis, call, complete, before) => {
    const bound = holder.current, run = bound?.readLeg
    if (!bound || holder.closed) return false
    if (!run) return undefined
    const producer = bound.evidence, resolve = holder.resolve
    const current = () => !holder.closed && holder.current === bound && bound.readLeg === run &&
      bound.evidence === producer && producer.resolve === resolve
    if (!current()) return false
    const result = await run(pin, basis, call, async () => current() && await complete() && current(),
      before && (async () => current() && await before() && current()))
    return current() ? result : false
  }
  const reviewRecipientAuthority: ReviewThreadRecipientAuthority = {
    authorize: async (recipient, basis, call) => {
      const bound = holder.current, provider = bound?.reviewRecipientAuthority, authorize = provider?.authorize
      return !!bound && !!provider && !!authorize && await authorize.call(provider, recipient, basis, call) &&
        !holder.closed && holder.current === bound && bound.reviewRecipientAuthority === provider && provider.authorize === authorize
    },
    checkAtCommit: (recipient, basis, call) => {
      const bound = holder.current, provider = bound?.reviewRecipientAuthority, check = provider?.checkAtCommit
      return !!bound && !!provider && !!check && !holder.closed && check.call(provider, recipient, basis, call) &&
        holder.current === bound && bound.reviewRecipientAuthority === provider && provider.checkAtCommit === check
    },
  }
  const reviewAnswerSource: ReturnType<typeof createReviewAnswerSource> = {
    resolve: async (basis, call) => {
      const bound = holder.current, provider = bound?.reviewAnswerSource, read = provider?.resolve
      if (!bound || !provider || !read || holder.closed) return { status: "unavailable", reason: "review-answer-producer-unavailable" }
      const result = await read.call(provider, basis, call)
      return !holder.closed && holder.current === bound && bound.reviewAnswerSource === provider && provider.resolve === read
        ? result : { status: "unavailable", reason: "review-answer-producer-unavailable" }
    },
    observe: async (scope, basis, call) => {
      const bound = holder.current, provider = bound?.reviewAnswerSource, observe = provider?.observe
      if (!bound || !provider || !observe || holder.closed) return { state: "access-unavailable", sourceVersion: 0 }
      const result = await observe.call(provider, scope, basis, call)
      return !holder.closed && holder.current === bound && bound.reviewAnswerSource === provider && provider.observe === observe
        ? result : { state: "access-unavailable", sourceVersion: 0 }
    },
    fence: async (scope, observation, basis, call) => {
      const bound = holder.current, provider = bound?.reviewAnswerSource, fence = provider?.fence
      return !!bound && !!provider && !!fence && !holder.closed && await fence.call(provider, scope, observation, basis, call) &&
        !holder.closed && holder.current === bound && bound.reviewAnswerSource === provider && provider.fence === fence
    },
    prepareThreadFence: async (basis, call) => {
      const bound = holder.current, provider = bound?.reviewAnswerSource, prepare = provider?.prepareThreadFence
      if (!bound || !provider || !prepare || holder.closed) return undefined
      const current = () => !holder.closed && holder.current === bound && bound.reviewAnswerSource === provider && provider.prepareThreadFence === prepare
      const fence = await prepare.call(provider, basis, call)
      return fence && current() ? async () => current() && await fence() && current() : undefined
    },
  }
  return { evidence, authorizeReviewThreadContext, reviewRecipientAuthority, reviewAnswerSource,
    bind: (binding: SfReviewCollaborationBinding) => {
      if (holder.current || holder.closed) throw new Error("SF_REVIEW_COLLABORATION_ALREADY_BOUND")
      holder.current = Object.freeze({ ...binding })
      holder.resolve = binding.evidence.resolve
      registerReviewEvidenceBatch(evidence, reviewAnswerSource, authorizeReviewThreadContext, reviewRecipientAuthority, readLeg)
    },
    dispose: () => { holder.closed = true; holder.current = undefined; holder.resolve = undefined },
  }
}
