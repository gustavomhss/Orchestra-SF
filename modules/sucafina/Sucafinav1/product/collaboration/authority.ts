import type { createReviewAnswerSource } from "../reviews/review-answer-source.ts"
import { roleMap } from "../../runtime/admin.ts"
import { hasActiveSfSnapshot, hasSfDashboardSourceFence, object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { HotTopicIntent } from "../dashboard/hot-topics.ts"
import type { CollaborationThread } from "./threads.ts"
import { validThreadSourceContext } from "./thread-context.ts"
import type { ThreadSourceContext, ReviewThreadContextAuthorizer } from "./thread-context.ts"
import { isAllowedRelationPair } from "./relation-catalog.ts"
import { createRecipientCommitCheck, createRecipientSourceAuthorizer } from "./recipient-authority.ts"
import type { CollaborationRecipientAuthority, ReviewThreadRecipientAuthority } from "./recipient-authority.ts"

/** Current source access and explicitly selected directory IDs are checked separately. */
type ReviewAnswerSource = ReturnType<typeof createReviewAnswerSource>
// Undefined means the scoped producer was ineligible before acquiring its root.
export type ReviewThreadReadLeg = (pin: NonNullable<ThreadSourceContext["reviewContext"]>, basis: ThreadSourceContext,
  context: TrustedDomainContext, complete: () => Promise<boolean>, before?: () => Promise<boolean>) => Promise<boolean | undefined>

const reviewEvidenceBatches = new WeakMap<BusinessContextService, {
  context: BusinessContextService["context"]; answerSource: ReviewAnswerSource; authorizeThread: ReviewThreadContextAuthorizer
  recipient: ReviewThreadRecipientAuthority; providersCurrent: () => boolean; readLeg: ReviewThreadReadLeg; localReview: () => ((review: PreservedReview) => boolean) | undefined
}>()

/** The resident binding resolves and authorizes each input independently. */
export function registerReviewEvidenceBatch(evidence: BusinessContextService, answerSource: ReviewAnswerSource, authorizeThread: ReviewThreadContextAuthorizer, recipient: ReviewThreadRecipientAuthority, readLeg: ReviewThreadReadLeg, localReview: () => ((review: PreservedReview) => boolean) | undefined) {
  const resolveEvidence = evidence.resolve
  const resolve = answerSource.resolve
  const observe = answerSource.observe
  const fence = answerSource.fence
  const prepare = answerSource.prepareThreadFence
  const authorizeRecipient = recipient.authorize
  const checkRecipient = recipient.checkAtCommit
  const providersCurrent = () => evidence.resolve === resolveEvidence && answerSource.resolve === resolve && answerSource.observe === observe && answerSource.fence === fence &&
    answerSource.prepareThreadFence === prepare && recipient.authorize === authorizeRecipient && recipient.checkAtCommit === checkRecipient
  reviewEvidenceBatches.set(evidence, { context: evidence.context, answerSource, authorizeThread, recipient, providersCurrent, readLeg, localReview })
}

export function registeredLocalReview(evidence: BusinessContextService) {
  const installed = reviewEvidenceBatches.get(evidence)
  return installed && installed.context === evidence.context && installed.providersCurrent() ? installed.localReview() : undefined
}

export function isRegisteredReviewMutationSource(evidence: BusinessContextService, answerSource: object, authorizeThread?: ReviewThreadContextAuthorizer, recipient?: ReviewThreadRecipientAuthority) {
  const installed = reviewEvidenceBatches.get(evidence)
  return !!installed && installed.context === evidence.context && installed.answerSource === answerSource &&
    installed.authorizeThread === authorizeThread && installed.recipient === recipient && installed.providersCurrent()
}

export function isRegisteredAnswerSource(evidence: BusinessContextService, answerSource: object) {
  const installed = reviewEvidenceBatches.get(evidence)
  return installed?.context === evidence.context && installed.answerSource === answerSource && installed.providersCurrent()
}

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
  // Read authorization preserves uncertainty separately from explicit refusal.
  // Legacy boolean probes below still negotiate actor-scoped reissue; these
  // strict readers never grant access from an incomplete provider response.
  const readSources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext, historical = false) => {
    if (!refs.length || refs.some((ref) => !ref || typeof ref !== "object" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) || !await input.host.revalidate(context)) return false
    const resolved = await input.evidence.context({ refs: structuredClone(refs) }, context)
    if (!await input.host.revalidate(context) || resolved.some((item) => ["revoked", "replaced", "missing", "invalid"].includes(item.state))) return false
    if (resolved.length !== refs.length || resolved.some((item) => item.state !== "fresh" && !(historical && item.state === "historical" && !!item.currentRef && !!item.authorizedProjection && !!item.differences))) throw new Error("COLLABORATION_SOURCE_READ_UNAVAILABLE")
    return resolved.every((item, index) => item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index])) && await input.host.revalidate(context)
  }
  const readHistoricalSources = (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => readSources(refs, context, true)
  const readReviewThreadBasis = async (basis: ThreadSourceContext, context: TrustedDomainContext) => {
    if (!basis.reviewContext) return true
    const authorize = input.authorizeReviewThreadContext
    const selected = structuredClone(basis)
    if (!validThreadSourceContext(selected) || !await input.host.revalidate(context)) return false
    if (!authorize) throw new Error("COLLABORATION_REVIEW_AUTHORITY_UNAVAILABLE")
    return await authorize(selected.reviewContext!, selected, context, "read") && input.authorizeReviewThreadContext === authorize && await input.host.revalidate(context)
  }
  const reviewRecipientSources = async (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext, requireSelfLease = false) => {
    const selected = structuredClone(basis)
    if (!recipientRef.trim() || !selected.reviewContext || !validThreadSourceContext(selected) || !await reviewThreadBasis(selected, context) || !await historicalSources(selected.evidenceRefs, context)) return false
    // Receipt egress requires a synchronous current ACL check for the actor
    // too; host identity alone cannot certify access to a preserved review.
    if (recipientRef === context.binding.principalRef && !requireSelfLease) return await input.host.revalidate(context)
    // C08 already owns all source snapshots. Reuse only the privately prepared
    // authority here; preparing a new recipient lease could open a nested write.
    if (hasActiveSfSnapshot(input.host.persistence)) return checkReviewRecipient(recipientRef, selected, context, requireSelfLease)
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
  const recipient = async (id: string, context: TrustedDomainContext, strictRead = false, sealedRead = false) => {
    const request = input.host.requestFor(context)
    if (!request || !id.trim() || !await input.host.revalidate(context)) return undefined
    const environment = await input.host.environment(request)
    const person = environment.directory.find((entry) => entry.id === id && !!entry.name.trim())
    if (!person || environment.directory.filter((entry) => entry.id === id).length !== 1) return undefined
    const allowed = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      const actor = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      const access = object(snapshot.data.access)
      return { commit: false, value: !!actor && actor.id === context.binding.principalRef && !actor.id.startsWith("local:") && Object.hasOwn(access, id) && !!access[id] && typeof access[id] === "object" && !Array.isArray(access[id]) }
    }, { signal: request.signal, ...(sealedRead ? { sealedRead: true } : {}) }).catch((error: unknown) => { if (strictRead) throw error; return false })
    if (!allowed || !await input.host.revalidate(context)) return undefined
    return { id: person.id, name: person.name }
  }
  const prepareReviewReplyContinuity = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext, routeCurrent: () => boolean) => {
    const host = input.host
    const request = host.requestFor(context)
    const persistence = host.persistence
    const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const observe = atomic?.readSealed, read = atomic?.currentSnapshot
    const evidence = input.evidence
    const resolve = evidence.context
    const current = () => routeCurrent() && !!request && !request.signal.aborted && host.requestFor(context) === request &&
      input.host === host && host.persistence === persistence && persistence.dashboardSourceFence === atomic &&
      hasSfDashboardSourceFence(persistence) && atomic?.readSealed === observe && atomic?.currentSnapshot === read &&
      input.evidence === evidence && evidence.context === resolve
    if (!request || !atomic || !observe || !read || !refs.length || !current()) return undefined
    // The resident resolver issues the live actor-scoped reference from the
    // retained record, verifies its ACL, and independently verifies freshness.
    const resolved = await resolve.call(evidence, { refs: structuredClone(refs) }, context)
    if (!current() || resolved.length !== refs.length) return undefined
    let requiresReissue = false
    const liveRefs = resolved.flatMap((item, index) => {
      const original = refs[index]!
      const live = item.state === "fresh" ? item.ref : item.state === "historical" && item.authorizedProjection && item.differences ? item.currentRef : undefined
      if (original.kind !== "record" || original.target.surface !== "dashboard" || live?.kind !== "record" ||
        item.accessRevision !== context.binding.accessRevision || digestSfValue(item.ref) !== digestSfValue(original) ||
        live.installationId !== original.installationId || live.projectId !== original.projectId || live.evidenceLevel !== original.evidenceLevel ||
        live.refDigest !== digestSfEvidenceRef(live) || live.target.surface !== "dashboard" ||
        live.target.recordType !== original.target.recordType || live.target.recordId !== original.target.recordId ||
        digestSfValue(live.target.fields) !== digestSfValue(original.target.fields)) return []
      // The recipient reader already understands legitimate scope rollovers.
      // Leave those to its full reissue path before selecting this writer.
      if (live.target.incarnation !== original.target.incarnation ||
        digestSfValue(live.target.period) !== digestSfValue(original.target.period)) {
        if (item.state !== "historical") return []
        requiresReissue = true
      } else if (live.target.version < original.target.version) return []
      return [live]
    })
    if (liveRefs.length !== refs.length) return undefined
    if (requiresReissue) return "reissue" as const
    // Retain the physical and current scoped continuity of the discarded
    // recipient projection. The staged writer checks this same proof again.
    const fingerprint = (snapshot: Snapshot | undefined) => {
      if (!snapshot) return undefined
      const scopes = Object.values(snapshot.sfSources?.scopes ?? {})
      const matched = liveRefs.flatMap((ref) => {
        const target = ref.target
        const matches = scopes.filter((entry) => entry.incarnation === target.incarnation && entry.scope.recordType === target.recordType && entry.scope.recordId === target.recordId)
        const entry = matches.length === 1 ? matches[0] : undefined
        if (!entry || entry.scope.principalRef !== context.binding.principalRef || entry.scope.accessRevision !== context.binding.accessRevision ||
          entry.scope.policyVersion !== context.binding.policyVersion) return []
        const selector = object(entry.scope.selector)
        if (!Array.isArray(selector.fields) || digestSfValue(selector.fields) !== digestSfValue(target.fields) ||
          digestSfValue(selector.period) !== digestSfValue(target.period)) return []
        const live = sfScopedSourceIdentity(snapshot, entry.scope)
        return live?.incarnation === target.incarnation && live.version === target.version && live.inputDigest === target.projectionDigest ? [entry.sourceIncarnation] : []
      })
      return matched.length === liveRefs.length ? digestSfValue(matched) : undefined
    }
    const initial = await atomic.transaction("dashboard", async (snapshot) => {
      const seal = current() ? observe.call(atomic) : undefined
      const value = seal?.current() && fingerprint(snapshot)
      return { commit: false, value: value && seal?.current() && current() ? { value, bytes: seal.bytesIdentity } : undefined }
    }, { signal: request.signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
    if (!initial || !current() || !await host.revalidate(context) || !current()) return undefined
    return () => {
      const seal = current() ? observe.call(atomic) : undefined
      if (!seal?.current()) return false
      const actual = initial.bytes && initial.bytes === seal.bytesIdentity ? initial.value : fingerprint(read.call(atomic, "dashboard"))
      return actual === initial.value && seal.current() && current()
    }
  }

  // The two C08 reads remain independent. Only this leg's installed C05
  // pair and canonical source authorization can share its held root.
  const readScopedThreadLeg = async (thread: Pick<CollaborationThread, "recipientRef"> & { messages?: CollaborationThread["messages"] },
    basis: ThreadSourceContext, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext,
    complete: () => Promise<boolean>, before?: () => Promise<boolean>) => {
    const pin = basis.reviewContext
    if (!pin || context.kind !== "ui" || thread.recipientRef !== context.binding.principalRef ||
      !thread.messages?.length || !thread.messages.every((message) => message.authorRef === thread.recipientRef) ||
      !refs.every((ref) => ref?.kind === "record" && ref.target?.surface === "dashboard")) return undefined
    const evidence = input.evidence
    const registered = reviewEvidenceBatches.get(evidence)
    const host = input.host
    const persistence = host.persistence
    const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const authorize = input.authorizeReviewThreadContext
    if (!registered || !atomic || registered.authorizeThread !== authorize || input.reviewRecipientAuthority !== registered.recipient ||
      hasActiveSfSnapshot(persistence)) return undefined
    const requestFor = host.requestFor, revalidate = host.revalidate, authenticate = host.authenticate, environment = host.environment
    const request = requestFor.call(host, context)
    const transaction = persistence.transaction
    const current = () => reviewEvidenceBatches.get(evidence) === registered && registered.providersCurrent() &&
      input.evidence === evidence && evidence.context === registered.context && input.authorizeReviewThreadContext === authorize &&
      input.reviewRecipientAuthority === registered.recipient && input.host === host && host.persistence === persistence &&
      persistence.dashboardSourceFence === atomic && hasSfDashboardSourceFence(persistence) && persistence.transaction === transaction &&
      host.requestFor === requestFor && host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environment &&
      !!request && !request.signal.aborted && requestFor.call(host, context) === request
    if (!validThreadSourceContext(basis) || !current() || !await revalidate.call(host, context) || !current()) return false
    const leg = { open: true, started: false, finished: false, began: false, heldBefore: false, authorized: !before }
    const result = await registered.readLeg(pin, basis, context, async () => {
      if (!leg.open || leg.started || !leg.authorized || !current() || !hasActiveSfSnapshot(persistence)) return false
      leg.started = true
      leg.finished = await complete() && leg.open && current()
      return leg.finished
    }, before && (async () => {
      if (!leg.open || leg.began || !current()) return false
      leg.began = true
      leg.heldBefore = hasActiveSfSnapshot(persistence)
      leg.authorized = await before() && leg.open && current()
      return leg.authorized
    })).finally(() => { leg.open = false })
    if (!current() || result === false) return false
    if (result === true) return leg.finished
    return leg.started || leg.heldBefore || leg.began && !leg.authorized ? false : undefined
  }

  return {
    sources,
    historicalSources,
    reviewThreadBasis,
    readSources,
    readHistoricalSources,
    readReviewThreadBasis,
    prepareReviewReplyContinuity,
    readRecipientReviewLeg: (thread: CollaborationThread, basis: ThreadSourceContext, refs: readonly BusinessEvidenceRef[],
      context: TrustedDomainContext, historical: () => Promise<boolean>) => readScopedThreadLeg(thread, basis, refs, context, async () => true, historical),
    recipient,
    readRecipient: (id: string, context: TrustedDomainContext) => recipient(id, context, true),
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
    authorizeThread: async (thread: { sourceRef: string; recipientRef?: string; evidenceRefs: readonly BusinessEvidenceRef[]; messages?: CollaborationThread["messages"] } & Partial<ThreadSourceContext>, context: TrustedDomainContext, mode: "read" | "write" | "prepared-write") => {
      if (!Array.isArray(thread.evidenceRefs) || thread.evidenceRefs.some((ref) => !ref || typeof ref !== "object")) return false
      const pin = thread.messages ? thread.messages[0]?.sourceContext?.reviewContext : thread.reviewContext
      const basis = pin ? { sourceRef: thread.sourceRef, sourceIncarnation: thread.sourceIncarnation, observedVersion: thread.observedVersion, period: thread.period, evidenceRefs: thread.evidenceRefs, reviewContext: pin } : undefined
      if (mode === "prepared-write" && (!basis || thread.recipientRef !== context.binding.principalRef)) return false
      const authorizeSources = mode === "read" ? pin ? readHistoricalSources : readSources : pin ? historicalSources : sources
      const messageRefs = (thread.messages ?? []).flatMap((message) => message.sourceContext?.evidenceRefs ?? [])
      const evidence = input.evidence
      const registered = reviewEvidenceBatches.get(evidence)
      const batch = registered?.context
      const complete = async (sealedRead = false) => {
        if (!thread.evidenceRefs.some((ref) => ref.refId === thread.sourceRef)) return false
        if (pin && messageRefs.length && batch && evidence.context === batch && hasSfDashboardSourceFence(input.host.persistence)) {
          // Authorize each distinct reference independently inside this observation.
          const request = input.host.requestFor(context)
          const refs = [...new Map([...thread.evidenceRefs, ...messageRefs].map((ref) => [digestSfValue(ref), ref])).values()]
          if (!request || request.signal.aborted || !await authorizeSources(refs, context) ||
            input.evidence !== evidence || evidence.context !== batch || request.signal.aborted || input.host.requestFor(context) !== request) return false
        } else {
          if (!await authorizeSources(thread.evidenceRefs, context)) return false
          const selected = [...new Map(messageRefs.map((ref) => [ref.refDigest, ref])).values()]
          if (selected.length && !await authorizeSources(selected, context)) return false
        }
        return !thread.recipientRef || !!await recipient(thread.recipientRef, context, mode === "read", sealedRead) &&
          (mode !== "write" || !!pin || await recipientSources(thread.recipientRef, thread.evidenceRefs, context))
      }
      if (basis && mode === "read" && validThreadSourceContext(basis)) {
        const scoped = await readScopedThreadLeg(thread, basis, [...thread.evidenceRefs, ...messageRefs], context, () => complete(true))
        if (scoped !== undefined) return scoped
      }
      if (basis && (!validThreadSourceContext(basis) || !await (mode === "write" ? reviewThreadBasis : readReviewThreadBasis)(basis, context) || mode === "write" && thread.recipientRef && !await reviewRecipientSources(thread.recipientRef, basis, context))) return false
      if (!await complete()) return false
      if (!thread.messages) return mode !== "read"
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
