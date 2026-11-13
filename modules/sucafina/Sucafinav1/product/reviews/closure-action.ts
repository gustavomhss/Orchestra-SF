import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopic, HotTopicIntent } from "../dashboard/hot-topics.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import { reviewChartEvidence } from "./port.ts"
import { reviewDecisionEvidence } from "./decision.ts"
import type { ReviewChart, createReviewPort } from "./port.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"

export type ReviewActionHandoff = { intent: HotTopicIntent; sourceRef: string; recipientRef?: string; relationKey: string }
export type ReviewActionClosure = { kind: "sf-review-action-v1"; id: string; reviewRef: string; reviewDigest: string; principalRef: string; handoff: ReviewActionHandoff; topic: HotTopic; relationId: string }
export type ReviewActionClosureRead = { closure: ReviewActionClosure; review: PreservedReview; currentAction: HotTopic }

/** An explicit human handoff uses WP08/WP02, then records its relation to the immutable review. */
export function createReviewClosurePort(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  human: Pick<ReturnType<typeof createSfHumanAuthority>, "authorize">
  ui: Pick<ReturnType<typeof createSfUiAuthority>, "matchesIntent" | "requestFor" | "revalidate">
  creationTarget: { ref: string; incarnation: string }
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  handoff: { create: (request: ReviewActionHandoff, context: TrustedDomainContext) => Promise<PortResult<{ topic: HotTopic; state: "created" | "existing"; relationId: string }>> }
  verifyHandoff: (handoff: ReviewActionHandoff, topic: HotTopic, relationId: string, context: TrustedDomainContext) => Promise<boolean>
  readAction: (id: string, sourceRefs: HotTopicIntent["sourceRefs"], context: TrustedDomainContext) => Promise<PortResult<HotTopic>>
}) {
  const read = async (closureRef: string, context: TrustedDomainContext): Promise<PortResult<ReviewActionClosureRead>> => {
      const request = input.host.requestFor(context)
      if (!request || !/^review-closure:[a-f0-9]{64}$/.test(closureRef) || !await input.host.revalidate(context)) return { status: "denied", reason: "closure-unavailable" }
      const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[closureRef] : undefined)
      if (loaded.status !== "ok" || !loaded.value || typeof loaded.value !== "object") return { status: "denied", reason: "closure-unavailable" }
      const closure = loaded.value as ReviewActionClosure
      if (!validClosure(closure) || closure.id !== closureRef || closure.principalRef !== context.binding.principalRef) return { status: "denied", reason: "closure-unavailable" }
      const review = await input.reviews.read(closure.reviewRef, context)
      if (review.status !== "ok" || digestSfValue(review.value) !== closure.reviewDigest || !await input.verifyHandoff(closure.handoff, closure.topic, closure.relationId, context)) return { status: "denied", reason: "closure-unavailable" }
      const action = await input.readAction(closure.topic.id, closure.handoff.intent.sourceRefs, context)
      if (action.status !== "ok" || !validAction(action.value) || action.value.id !== closure.topic.id) return { status: "denied", reason: "closure-unavailable" }
      const again = await input.reviews.read(closure.reviewRef, context)
      const currentAction = await input.readAction(closure.topic.id, closure.handoff.intent.sourceRefs, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== closure.reviewDigest || currentAction.status !== "ok" || digestSfValue(currentAction.value) !== digestSfValue(action.value) || !await input.verifyHandoff(closure.handoff, closure.topic, closure.relationId, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "closure-unavailable" }
      const storedAgain = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[closureRef] : undefined)
      if (storedAgain.status !== "ok" || digestSfValue(storedAgain.value) !== digestSfValue(closure) || !await input.host.revalidate(context)) return { status: "denied", reason: "closure-unavailable" }
      return { status: "ok", value: { closure: structuredClone(closure), review: again.value, currentAction: currentAction.value } }
  }
  return {
    read,
    async listByReview(reviewRef: string, context: TrustedDomainContext): Promise<PortResult<{ entries: readonly ReviewActionClosureRead[]; coverage: "complete" | "partial"; limitations: readonly string[] }>> {
      const request = input.host.requestFor(context)
      if (!request || typeof reviewRef !== "string" || !reviewRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "closure-unavailable" }
      const review = await input.reviews.read(reviewRef, context)
      if (review.status !== "ok") return { status: "denied", reason: "closure-unavailable" }
      const index = () => input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.documents).filter(([id, value]) => /^review-closure:[a-f0-9]{64}$/.test(id) && !!value && typeof value === "object" && "principalRef" in value && value.principalRef === context.binding.principalRef && "reviewRef" in value && value.reviewRef === reviewRef).map(([id]) => id).sort() : undefined)
      const before = await index()
      if (before.status !== "ok" || !before.value) return { status: "unavailable", reason: "closure-unavailable" }
      const first = await Promise.all(before.value.map((ref) => read(ref, context)))
      const second = await Promise.all(before.value.map((ref) => read(ref, context)))
      const after = await index()
      const current = await input.reviews.read(reviewRef, context)
      if (after.status !== "ok" || digestSfValue(before.value) !== digestSfValue(after.value) || current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(review.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "closure-unavailable" }
      const entries = second.flatMap((entry, position) => {
        const prior = first[position]
        return entry.status === "ok" && prior?.status === "ok" && digestSfValue(entry.value) === digestSfValue(prior.value) ? [entry.value] : []
      })
      const partial = entries.length !== before.value.length
      return { status: "ok", value: { entries, coverage: partial ? "partial" : "complete", limitations: partial ? ["Some forwarding references are unavailable under current access."] : [] } }
    },
    async confirm(reviewRef: string, incoming: ReviewActionHandoff, reviewContext: TrustedDomainContext, context: TrustedDomainContext): Promise<PortResult<{ closureRef: string; review: PreservedReview; topic: HotTopic; relationId: string }>> {
      if (context.kind !== "ui" || reviewContext.kind !== "ui" || !validHandoff(incoming)) return { status: "needs-input", reason: "human-handoff-required" }
      const handoff = structuredClone(incoming)
      if ((["principalRef", "installationId", "projectId", "accessRevision", "policyVersion"] as const).some((key) => context.binding[key] !== reviewContext.binding[key])) return { status: "denied", reason: "handoff-context-mismatch" }
      const request = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!request || input.ui.requestFor(reviewContext) !== request || !input.ui.matchesIntent(reviewContext, "sf_review_prepare", digestSfValue({ reviewRef })) || !await input.ui.revalidate(reviewContext) || !operation || !await input.human.authorize(context, "collaboration.handoff.confirm", handoff) || !await input.host.revalidate(context)) return { status: "denied", reason: "handoff-unavailable" }
      const review = await input.reviews.read(reviewRef, context)
      if (review.status !== "ok") return review
      const id = `review-closure:${digestSfValue({ principal: context.binding.principalRef, operation })}`
      const prior = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? { closure: state.documents[id] } : undefined)
      if (prior.status !== "ok" || !prior.value) return { status: "unavailable", reason: "closure-storage-unavailable" }
      if (prior.value.closure !== undefined) {
        const existing = prior.value.closure as ReviewActionClosure
        if (!validClosure(existing) || existing.reviewRef !== reviewRef || existing.reviewDigest !== digestSfValue(review.value) || digestSfValue(existing.handoff) !== digestSfValue(handoff)) return { status: "conflict", reason: "closure-content-changed" }
        const reopened = await read(id, context)
        if (reopened.status !== "ok") return reopened
        if (!await input.human.authorize(context, "collaboration.handoff.confirm", handoff) || !await input.ui.revalidate(reviewContext)) return { status: "denied", reason: "closure-access-unavailable" }
        return { status: "ok", value: { closureRef: id, review: reopened.value.review, topic: reopened.value.closure.topic, relationId: reopened.value.closure.relationId } }
      }
      const refs = review.value.sections.flatMap((section) => {
        const projection = section.content as DomainProjection & { reviewChart?: ReviewChart; reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison }
        return [...projection.values.flatMap((value) => value.sourceRefs), ...reviewChartEvidence(projection.reviewChart), ...reviewDecisionEvidence(projection.decision), ...(projection.reviewOutcome?.sourceRefs ?? []), ...(projection.reviewOutcomeComparison?.baselineRefs ?? []), ...(projection.reviewOutcomeComparison?.sourceRefs ?? [])]
      })
      const permitted = new Set(refs.map((ref) => digestSfValue(ref)))
      if (handoff.intent.sourceRefs.some((ref) => !permitted.has(digestSfValue(ref))) || handoff.intent.sourceRefs.filter((ref) => ref.refId === handoff.sourceRef).length !== 1) return { status: "denied", reason: "handoff-source-outside-review" }
      const created = await input.handoff.create(handoff, context)
      if (created.status !== "ok") return created
      const current = await input.reviews.read(reviewRef, context)
      if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(review.value) || !await input.verifyHandoff(handoff, created.value.topic, created.value.relationId, context) || !await input.human.authorize(context, "collaboration.handoff.confirm", handoff) || !input.ui.matchesIntent(reviewContext, "sf_review_prepare", digestSfValue({ reviewRef })) || !await input.ui.revalidate(reviewContext) || !await input.host.revalidate(context)) return { status: "conflict", reason: "action-created-review-or-link-unavailable" }
      const before = await input.state.read(request, "documents", () => null)
      if (before.status !== "ok") return { status: "unavailable", reason: "action-created-closure-storage-unavailable" }
      const closure: ReviewActionClosure = { kind: "sf-review-action-v1", id, reviewRef, reviewDigest: digestSfValue(current.value), principalRef: context.binding.principalRef, handoff, topic: created.value.topic, relationId: created.value.relationId }
      if (!validClosure(closure)) return { status: "unavailable", reason: "action-created-closure-invalid" }
      const saved = await input.state.transaction(request, { namespace: "documents", expectedStorageVersion: before.storageVersion, targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation, idempotencyKey: operation, commandDigest: digestSfValue({ id, reviewRef, reviewDigest: closure.reviewDigest, handoff }) }, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || state.documents[id]) return { commit: false, value: false }
        state.documents[id] = structuredClone(closure)
        return { commit: true, value: true }
      })
      if (saved.status !== "ok" || !saved.value) return { status: "conflict", reason: "action-created-closure-unconfirmed" }
      const final = await read(id, context)
      if (final.status !== "ok" || final.value.closure.reviewDigest !== closure.reviewDigest || digestSfValue(final.value.closure.handoff) !== digestSfValue(handoff) || !await input.human.authorize(context, "collaboration.handoff.confirm", handoff) || !input.ui.matchesIntent(reviewContext, "sf_review_prepare", digestSfValue({ reviewRef })) || !await input.ui.revalidate(reviewContext) || !await input.host.revalidate(context)) return { status: "denied", reason: "closure-access-unavailable" }
      return { status: "ok", value: { closureRef: id, review: final.value.review, topic: final.value.closure.topic, relationId: final.value.closure.relationId } }
    },
  }
}

function validHandoff(value: ReviewActionHandoff) {
  return !!value && !!value.intent && [value.sourceRef, value.relationKey, value.intent.correlationKey, value.intent.action].every((part) => typeof part === "string" && !!part.trim()) && [value.intent.owner, value.intent.due, value.intent.notes].every((part) => typeof part === "string") && ["critical", "high", "normal"].includes(value.intent.priority) && (value.recipientRef === undefined || typeof value.recipientRef === "string" && !!value.recipientRef.trim()) && Array.isArray(value.intent.sourceRefs) && value.intent.sourceRefs.length > 0 && value.intent.sourceRefs.every((ref) => !!ref && typeof ref === "object" && typeof ref.refId === "string" && !!ref.refId.trim())
}

function validAction(value: HotTopic) {
  return !!value && typeof value.id === "string" && !!value.id.trim() && Number.isSafeInteger(value.version) && value.version >= 0 && [value.action, value.owner, value.due, value.status, value.priority, value.notes].every((part) => typeof part === "string")
}

function validClosure(value: ReviewActionClosure) {
  return !!value && value.kind === "sf-review-action-v1" && typeof value.id === "string" && /^review-closure:[a-f0-9]{64}$/.test(value.id) && typeof value.principalRef === "string" && !!value.principalRef.trim() && typeof value.reviewRef === "string" && !!value.reviewRef.trim() && typeof value.reviewDigest === "string" && /^[a-f0-9]{64}$/.test(value.reviewDigest) && typeof value.relationId === "string" && !!value.relationId.trim() && validHandoff(value.handoff) && validAction(value.topic)
}
