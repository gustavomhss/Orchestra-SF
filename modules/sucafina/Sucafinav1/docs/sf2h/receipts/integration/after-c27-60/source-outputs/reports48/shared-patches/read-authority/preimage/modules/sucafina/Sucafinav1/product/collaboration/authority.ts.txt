import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopicIntent } from "../dashboard/hot-topics.ts"
import type { CollaborationThread } from "./threads.ts"
import { validThreadSourceContext } from "./thread-context.ts"
import type { ThreadSourceContext, ReviewThreadContextAuthorizer } from "./thread-context.ts"
import { isAllowedRelationPair } from "./relation-catalog.ts"
import { createRecipientCommitCheck, createRecipientSourceAuthorizer } from "./recipient-authority.ts"
import type { CollaborationRecipientAuthority, ReviewThreadRecipientAuthority } from "./recipient-authority.ts"

/** Current source access and explicitly selected directory IDs are checked separately. */
export function createCollaborationAuthority(input: { host: DomainPortHost; evidence: BusinessContextService; recipientAuthority?: CollaborationRecipientAuthority; reviewRecipientAuthority?: ReviewThreadRecipientAuthority; authorizeReviewThreadContext?: ReviewThreadContextAuthorizer }) {
  type ReviewRecipientLease = { proof: ReviewThreadRecipientAuthority; authorize: ReviewThreadRecipientAuthority["authorize"]; check: ReviewThreadRecipientAuthority["checkAtCommit"] }
  const reviewRecipientLeases = new WeakMap<TrustedDomainContext, Map<string, ReviewRecipientLease>>()
  const reviewRecipientKey = (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => digestSfValue({ recipientRef, basis, authority: context.binding })
  const checkReviewRecipient = (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext, requireSelfLease = false) => {
    if (!recipientRef.trim() || !basis.reviewContext || !validThreadSourceContext(basis)) return false
    if (recipientRef === context.binding.principalRef && !requireSelfLease) return true
    const lease = reviewRecipientLeases.get(context)?.get(reviewRecipientKey(recipientRef, basis, context))
    if (!lease) return false
    const current = () => input.reviewRecipientAuthority === lease.proof && lease.proof.authorize === lease.authorize && lease.proof.checkAtCommit === lease.check
    try { return current() && lease.check.call(lease.proof, recipientRef, structuredClone(basis), context) === true && current() } catch { return false }
  }
  const sources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!refs.length || refs.some((ref) => !ref || typeof ref !== "object" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return false
    const current = await input.evidence.context({ refs: structuredClone(refs) }, context).catch(() => [])
    return current.length === refs.length && current.every((item, index) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(refs[index])) && await input.host.revalidate(context)
  }
  const historicalSources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!refs.length || refs.some((ref) => !ref || typeof ref !== "object" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) || !await input.host.revalidate(context)) return false
    const resolved = await input.evidence.context({ refs: structuredClone(refs) }, context).catch(() => [])
    return resolved.length === refs.length && resolved.every((item, index) => (item.state === "fresh" || item.state === "historical" && !!item.currentRef && !!item.authorizedProjection && !!item.differences) && item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index])) && await input.host.revalidate(context)
  }
  const reviewThreadBasis = async (basis: ThreadSourceContext, context: TrustedDomainContext) => {
    if (!basis.reviewContext) return true
    const authorize = input.authorizeReviewThreadContext
    const selected = structuredClone(basis)
    if (!authorize || !validThreadSourceContext(selected) || !await input.host.revalidate(context)) return false
    return await authorize(selected.reviewContext!, selected, context).catch(() => false) && input.authorizeReviewThreadContext === authorize && await input.host.revalidate(context)
  }
  const reviewRecipientSources = async (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext, requireSelfLease = false) => {
    const selected = structuredClone(basis)
    if (!recipientRef.trim() || !selected.reviewContext || !validThreadSourceContext(selected) || !await reviewThreadBasis(selected, context) || !await historicalSources(selected.evidenceRefs, context)) return false
    // Receipt egress requires a synchronous current ACL check for the actor
    // too; host identity alone cannot certify access to a preserved review.
    if (recipientRef === context.binding.principalRef && !requireSelfLease) return await input.host.revalidate(context)
    // C08 already owns all source snapshots. Reuse only the privately prepared
    // authority here; preparing a new recipient lease could open a nested write.
    if (input.host.persistence.currentSnapshots?.()) return checkReviewRecipient(recipientRef, selected, context, requireSelfLease)
    const proof = input.reviewRecipientAuthority
    const authorize = proof?.authorize
    const checkAtCommit = proof?.checkAtCommit
    if (!proof || !authorize || !checkAtCommit) return false
    const leaseKey = reviewRecipientKey(recipientRef, selected, context)
    const leases = reviewRecipientLeases.get(context) ?? new Map<string, ReviewRecipientLease>()
    reviewRecipientLeases.set(context, leases)
    const sameProvider = (lease: ReviewRecipientLease) => lease.proof === proof && lease.authorize === authorize && lease.check === checkAtCommit
    const current = () => input.reviewRecipientAuthority === proof && proof.authorize === authorize && proof.checkAtCommit === checkAtCommit && (!leases.has(leaseKey) || sameProvider(leases.get(leaseKey)!))
    // Never repin an outstanding operation to a replacement provider, including
    // a replay that reuses the exact same authenticated context instance.
    if (!current() || !leases.has(leaseKey) && leases.size >= 512) return false
    if (!await authorize.call(proof, recipientRef, structuredClone(selected), context).catch(() => false) || !current() || !await reviewThreadBasis(selected, context) || !await historicalSources(selected.evidenceRefs, context)) return false
    if (!await authorize.call(proof, recipientRef, structuredClone(selected), context).catch(() => false) || !current() || !await input.host.revalidate(context)) return false
    if (!current() || !leases.has(leaseKey) && leases.size >= 512) return false
    if (!leases.has(leaseKey)) leases.set(leaseKey, { proof, authorize, check: checkAtCommit })
    return true
  }
  const recipientSources = createRecipientSourceAuthorizer({ sources, revalidate: input.host.revalidate, recipientAuthority: input.recipientAuthority })
  const recipient = async (id: string, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || !id.trim() || !await input.host.revalidate(context)) return undefined
    const environment = await input.host.environment(request)
    const person = environment.directory.find((entry) => entry.id === id && !!entry.name.trim())
    if (!person || environment.directory.filter((entry) => entry.id === id).length !== 1) return undefined
    const allowed = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      const actor = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      const access = object(snapshot.data.access)
      return { commit: false, value: !!actor && actor.id === context.binding.principalRef && !actor.id.startsWith("local:") && Object.hasOwn(access, id) && !!access[id] && typeof access[id] === "object" && !Array.isArray(access[id]) }
    }, { signal: request.signal }).catch(() => false)
    if (!allowed || !await input.host.revalidate(context)) return undefined
    return { id: person.id, name: person.name }
  }
  return {
    sources,
    historicalSources,
    reviewThreadBasis,
    recipient,
    recipientSources,
    reviewRecipientSources,
    checkRecipientAtCommit: createRecipientCommitCheck(input.recipientAuthority),
    checkReviewRecipientAtCommit: checkReviewRecipient,
    authorizePair: async (pair: { fromRef: string; toRef: string; kind: string; evidenceRefs: readonly BusinessEvidenceRef[]; recipientRef?: string }, context: TrustedDomainContext) => {
      if (!Array.isArray(pair.evidenceRefs) || pair.evidenceRefs.some((ref) => !ref || typeof ref !== "object")) return false
      const from = pair.evidenceRefs.filter((ref) => ref.refId === pair.fromRef)
      const to = pair.evidenceRefs.filter((ref) => ref.refId === pair.toRef)
      if (from.length !== 1 || to.length !== 1 || !isAllowedRelationPair(pair.kind, from[0]!, to[0]!)) return false
      if (pair.recipientRef && (!await recipient(pair.recipientRef, context) || !await recipientSources(pair.recipientRef, pair.evidenceRefs, context))) return false
      return sources(pair.evidenceRefs, context)
    },
    authorizeThread: async (thread: { sourceRef: string; recipientRef?: string; evidenceRefs: readonly BusinessEvidenceRef[]; messages?: CollaborationThread["messages"] } & Partial<ThreadSourceContext>, context: TrustedDomainContext, mode: "read" | "write") => {
      if (!Array.isArray(thread.evidenceRefs) || thread.evidenceRefs.some((ref) => !ref || typeof ref !== "object")) return false
      const pin = thread.messages ? thread.messages[0]?.sourceContext?.reviewContext : thread.reviewContext
      const basis = pin ? { sourceRef: thread.sourceRef, sourceIncarnation: thread.sourceIncarnation, observedVersion: thread.observedVersion, period: thread.period, evidenceRefs: thread.evidenceRefs, reviewContext: pin } : undefined
      if (basis && (!validThreadSourceContext(basis) || !await reviewThreadBasis(basis, context) || mode === "write" && thread.recipientRef && !await reviewRecipientSources(thread.recipientRef, basis, context))) return false
      const authorizeSources = pin ? historicalSources : sources
      if (!thread.evidenceRefs.some((ref) => ref.refId === thread.sourceRef) || !await authorizeSources(thread.evidenceRefs, context)) return false
      const messageRefs = [...new Map((thread.messages ?? []).flatMap((message) => message.sourceContext?.evidenceRefs ?? []).map((ref) => [ref.refDigest, ref])).values()]
      if (messageRefs.length && !await authorizeSources(messageRefs, context)) return false
      if (thread.recipientRef && (!await recipient(thread.recipientRef, context) || mode === "write" && !pin && !await recipientSources(thread.recipientRef, thread.evidenceRefs, context))) return false
      if (!thread.messages) return mode === "write"
      return thread.recipientRef === context.binding.principalRef || thread.messages.some((message) => message.authorRef === context.binding.principalRef)
    },
    authorizeIntent: async (intent: HotTopicIntent, recipientRef: string | undefined, context: TrustedDomainContext) => {
      if (intent.notes.trim() || !await sources(intent.sourceRefs, context)) return false
      if (!recipientRef) return !intent.owner.trim()
      const person = await recipient(recipientRef, context)
      return !!person && person.name === intent.owner && await recipientSources(recipientRef, intent.sourceRefs, context)
    },
  }
}



