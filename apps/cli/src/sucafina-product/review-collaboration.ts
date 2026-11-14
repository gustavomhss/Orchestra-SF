import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createReviewApplication } from "../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { createReviewAnswerSource } from "../../../../modules/sucafina/Sucafinav1/product/reviews/review-answer-source.ts"
import type { ReviewThreadContext } from "../../../../modules/sucafina/Sucafinav1/product/reviews/thread-context.ts"
import { isReviewThreadContext } from "../../../../modules/sucafina/Sucafinav1/product/reviews/thread-context.ts"
import type { ThreadSourceContext } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/thread-context.ts"
import type { ReviewThreadRecipientAuthority } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { SfReviewCollaborationBinding } from "./review-collaboration-binding.ts"

type AccessLease = { fence: () => Promise<boolean>; check: () => boolean }
type RecipientLease = { access: AccessLease; provider?: ReviewThreadRecipientAuthority;
  authorize?: ReviewThreadRecipientAuthority["authorize"]; check?: ReviewThreadRecipientAuthority["checkAtCommit"] }

/** Compose the actual C05 reader and C06 producer. This short-lived lease is
 * private to one authenticated call; it is not a persisted confirmation scope. */
export function createSfReviewCollaboration(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  application: ReturnType<typeof createReviewApplication>
  evidence: BusinessContextService
  /** A real host-private recipient/source ACL provider; directory membership is insufficient. */
  recipientAuthority?: ReviewThreadRecipientAuthority
}): SfReviewCollaborationBinding {
  const host = input.authority.host
  const reviews = input.application.reviews
  const contexts = input.application.threadContext
  const readContext = contexts.read
  const sameProducer = () => input.authority.host === host && input.application.reviews === reviews &&
    input.application.threadContext === contexts && contexts.read === readContext
  const leases = new WeakMap<TrustedDomainContext, Map<string, AccessLease>>()
  const key = (pin: ReviewThreadContext, basis: ThreadSourceContext, call: TrustedDomainContext) => digestSfValue({ pin, basis, authority: call.binding })
  const fingerprint = (pin: ReviewThreadContext) => {
    const snapshots = host.persistence.currentSnapshots?.()
    if (!snapshots) return undefined
    const product = object(snapshots.dashboard.data.__sfProductV1)
    const review = object(product.reviews)[pin.reviewRef]
    if (digestSfValue(review) !== pin.reviewDigest) return undefined
    const receipts = Object.values(object(product.transactions)).filter((entry) => {
      const receipt = object(entry), value = object(receipt.value)
      return receipt.namespace === "reviews" && receipt.targetRef === input.authority.creationTarget.ref &&
        receipt.targetIncarnation === input.authority.creationTarget.incarnation && typeof receipt.principalRef === "string" && !!receipt.principalRef.trim() &&
        (value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 && value.reviewRef === pin.reviewRef && value.reviewDigest === pin.reviewDigest ||
          value.schema === undefined && value.id === pin.reviewRef && digestSfValue(value) === pin.reviewDigest)
    })
    if (!receipts.length) return undefined
    // Plain record reviews depend on these domain data/ACLs and source identities.
    // C06's own threads/confirmations may change inside C08; they are not source data.
    const sources = (["dashboard", "planner", "procurement"] as const).map((surface) => ({
      surface, data: Object.fromEntries(Object.entries(snapshots[surface].data).filter(([name]) => name !== "__sfProductV1")),
      identities: snapshots[surface].sfSources,
    }))
    return digestSfValue({ pin, receipts, sources })
  }
  const prepareAccess = async (pin: ReviewThreadContext, basis: ThreadSourceContext, review: PreservedReview, call: TrustedDomainContext): Promise<PortResult<AccessLease>> => {
    const unavailable = (): PortResult<AccessLease> => ({ status: "unavailable", reason: "review-current-source-authority-unavailable" })
    const persistence = host.persistence, state = input.authority.state, readState = state.read
    const requestFor = host.requestFor, authenticate = host.authenticate
    const request = requestFor.call(host, call), read = reviews.read, revalidate = host.revalidate, snapshots = persistence.currentSnapshots
    const binding = digestSfValue([call.kind, call.binding])
    const current = () => sameProducer() && host.persistence === persistence && input.authority.state === state && state.read === readState &&
      host.requestFor === requestFor && host.authenticate === authenticate && requestFor.call(host, call) === request && !!request && !request.signal.aborted &&
      reviews.read === read && host.revalidate === revalidate && persistence.currentSnapshots === snapshots && binding === digestSfValue([call.kind, call.binding])
    // External outcomes/documents/comments need their producer's transaction lease.
    // Do not turn their absence into positive source authority.
    if (!request || !snapshots || snapshots.call(host.persistence) || !localRecordReview(review) || !isReviewThreadContext(pin) ||
      digestSfValue(review) !== pin.reviewDigest || !current() || !await revalidate.call(host, call)) return unavailable()
    const snapshot = async () => {
      const checked = await readState.call(state, request, "reviews", async (_state, actor) => {
        if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return undefined
        const held = snapshots.call(host.persistence)
        if (!held) return undefined
        for (const surface of [...new Set(review.sourceRefs.map((source) => source.surface))]) {
          const principal = await authenticate.call(host, request, { surface, roleMap: roleMap(held[surface], surface) })
          if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:") || !current()) return undefined
        }
        return fingerprint(pin)
      })
      return checked.status === "ok" && current() ? checked.value : undefined
    }
    const first = await read.call(reviews, pin.reviewRef, call)
    if (!current() || first.status !== "ok" || digestSfValue(first.value) !== pin.reviewDigest) return unavailable()
    const before = await snapshot()
    const second = await read.call(reviews, pin.reviewRef, call)
    const after = await snapshot()
    if (!before || before !== after || !current() || second.status !== "ok" || digestSfValue(second.value) !== pin.reviewDigest ||
      !await revalidate.call(host, call) || !current()) return unavailable()
    const check = () => current() && fingerprint(pin) === after
    const lease = { check, fence: async () => check() && await revalidate.call(host, call) && check() }
    const selected = leases.get(call) ?? new Map<string, AccessLease>()
    if (selected.size >= 128 && !selected.has(key(pin, basis, call))) return unavailable()
    selected.set(key(pin, basis, call), lease); leases.set(call, selected)
    return { status: "ok", value: lease }
  }
  const authorizeReviewThreadContext: SfReviewCollaborationBinding["authorizeReviewThreadContext"] = async (pin, basis, call) => {
    if (!sameProducer() || !isReviewThreadContext(pin)) return false
    if (host.persistence.currentSnapshots?.()) {
      const lease = leases.get(call)?.get(key(pin, basis, call))
      return !!lease && await lease.fence()
    }
    const found = await readContext.call(contexts, pin, basis, call)
    if (!sameProducer() || found.status !== "ok") return false
    return (await prepareAccess(pin, basis, found.value.review, call)).status === "ok"
  }
  const recipientLeases = new WeakMap<TrustedDomainContext, Map<string, RecipientLease>>()
  const recipientKey = (recipient: string, basis: ThreadSourceContext, call: TrustedDomainContext) => digestSfValue({ recipient, basis, authority: call.binding })
  const reviewRecipientAuthority: ReviewThreadRecipientAuthority = {
    authorize: async (recipient, basis, call) => {
      if (!sameProducer() || !recipient.trim() || !isReviewThreadContext(basis.reviewContext) || host.persistence.currentSnapshots?.()) return false
      const found = await readContext.call(contexts, basis.reviewContext, basis, call)
      if (!sameProducer() || found.status !== "ok") return false
      const access = await prepareAccess(basis.reviewContext, basis, found.value.review, call)
      if (access.status !== "ok") return false
      const provider = recipient === call.binding.principalRef ? undefined : input.recipientAuthority
      const authorize = provider?.authorize, check = provider?.checkAtCommit
      if (recipient !== call.binding.principalRef && (!provider || !authorize || !check ||
        !await authorize.call(provider, recipient, structuredClone(basis), call) || input.recipientAuthority !== provider || provider.authorize !== authorize || provider.checkAtCommit !== check))
        return false
      if (!await host.revalidate(call)) return false
      const selected = recipientLeases.get(call) ?? new Map<string, RecipientLease>()
      if (selected.size >= 128 && !selected.has(recipientKey(recipient, basis, call))) return false
      selected.set(recipientKey(recipient, basis, call), { access: access.value, provider, authorize, check }); recipientLeases.set(call, selected)
      return true
    },
    checkAtCommit: (recipient, basis, call) => {
      const lease = recipientLeases.get(call)?.get(recipientKey(recipient, basis, call))
      if (!lease || !lease.access.check()) return false
      if (recipient === call.binding.principalRef) return true
      const provider = lease.provider, check = lease.check
      return !!provider && !!check && input.recipientAuthority === provider && provider.authorize === lease.authorize && provider.checkAtCommit === check &&
        check.call(provider, recipient, structuredClone(basis), call) === true && lease.access.check() && input.recipientAuthority === provider &&
        provider.authorize === lease.authorize && provider.checkAtCommit === check
    },
  }
  return { evidence: input.evidence, authorizeReviewThreadContext, reviewRecipientAuthority,
    reviewAnswerSource: createReviewAnswerSource({ reviews, host, prepareAccess }) }
}

/** Scope boundary, not an authorization substitute: actual reviews.read above
 * still reopens every source and C08 receipt under the current request. */
function localRecordReview(review: PreservedReview) {
  const sourceTypes = ["dashboard-page", "hotTopics", "opexOwners", "capexProjects", "members", "leaders", "projects", "opsTickets",
    "secKpi", "risks", "contracts", "stakeholders", "itperf-item"]
  if (!review.sourceRefs.length || review.comments.length || review.sourceRefs.some((source) => source.surface !== "dashboard" || !sourceTypes.includes(source.type))) return false
  let budget = 20_000
  const visit = (value: unknown, depth = 0): boolean => {
    if (--budget < 0 || depth > 24) return false
    if (!value || typeof value !== "object") return true
    if (Array.isArray(value)) return value.every((entry) => visit(entry, depth + 1))
    if ("decision" in value && value.decision !== undefined || "reviewOutcome" in value || "reviewOutcomeComparison" in value ||
      "reviewCommentRefs" in value && (!Array.isArray(value.reviewCommentRefs) || value.reviewCommentRefs.length > 0) ||
      "sensitivity" in value && value.sensitivity !== undefined) return false
    if ("schema" in value && value.schema === "sf-evidence-v1" && (!("kind" in value) || value.kind !== "record" ||
      !("target" in value) || object(value.target).surface !== "dashboard" || !sourceTypes.includes(String(object(value.target).recordType)))) return false
    return Object.values(value).every((entry) => visit(entry, depth + 1))
  }
  return visit(review)
}
