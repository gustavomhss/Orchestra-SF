import { selectSfReviewAuthority } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { canonicalSfValue, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
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
import { withSfScopedSourceChecks } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { SfReviewReadScope } from "./review-read-integrity.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { hasActiveSfSnapshot, hasSfDashboardSourceFence, object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { SfReviewCollaborationBinding } from "./review-collaboration-binding.ts"

type AccessLease = { fence: () => Promise<boolean>; startCheck: () => () => boolean }
type RecipientLease = { access: AccessLease; provider?: ReviewThreadRecipientAuthority;
  authorize?: ReviewThreadRecipientAuthority["authorize"]; check?: ReviewThreadRecipientAuthority["checkAtCommit"] }

/** Compose the actual C05 reader and C06 producer. This short-lived lease is
 * private to one authenticated call; it is not a persisted confirmation scope. */
export function createSfReviewCollaboration(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  application: ReturnType<typeof createReviewApplication> & { readScope?: SfReviewReadScope }
  evidence: BusinessContextService
  /** A real host-private recipient/source ACL provider; directory membership is insufficient. */
  recipientAuthority?: ReviewThreadRecipientAuthority
  /** Private registered reader identity, when composed by the resident host. */
  readerCurrent?: () => boolean
}): SfReviewCollaborationBinding {
  const host = input.authority.host
  const reviews = input.application.reviews
  const contexts = input.application.threadContext
  const readContext = contexts.read
  const target = input.authority.creationTarget
  const targetRef = target.ref, targetIncarnation = target.incarnation
  const targetCurrent = () => input.authority.creationTarget === target && target.ref === targetRef && target.incarnation === targetIncarnation
  const readerCurrent = input.readerCurrent
  const readScope = input.application.readScope
  const revalidateReview = readScope?.revalidate, currentReview = readScope?.current, prepareRevalidation = readScope?.prepareRevalidation
  const prepareCold = readScope?.prepareColdRevalidation
  const sameProducer = () => input.authority.host === host && input.application.reviews === reviews &&
    input.application.threadContext === contexts && contexts.read === readContext && input.readerCurrent === readerCurrent &&
    (!readerCurrent || readerCurrent()) && input.application.readScope === readScope &&
    readScope?.revalidate === revalidateReview && readScope?.current === currentReview &&
    readScope?.prepareRevalidation === prepareRevalidation && readScope?.prepareColdRevalidation === prepareCold &&
    (!currentReview || currentReview())
  const leases = new WeakMap<TrustedDomainContext, Map<string, AccessLease>>()
  const sealedFingerprints = new WeakMap<object, { pin: string; value: string }>()
  const key = (pin: ReviewThreadContext, basis: ThreadSourceContext, call: TrustedDomainContext) => digestSfValue({ pin, basis, authority: call.binding })
  const fingerprintReader = (pin: ReviewThreadContext, expectedRoot?: object) => {
    const persistence = host.persistence
    const fence = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const admitted = fence?.readSealed?.()
    if (expectedRoot && admitted?.identity !== expectedRoot) return () => undefined
    const observation = { first: admitted }
    return () => {
      if (host.persistence !== persistence || !targetCurrent()) return undefined
      if (!admitted) return fingerprint(persistence.currentSnapshots?.(), pin)
      if (!hasSfDashboardSourceFence(persistence) || persistence.dashboardSourceFence !== fence || !admitted.current()) return undefined
      const sealed = observation.first ?? fence?.readSealed?.()
      observation.first = undefined
      if (!sealed || sealed.identity !== admitted.identity || !sealed.current()) return undefined
      const pinDigest = digestSfValue({ pin, targetRef, targetIncarnation })
      const digestIdentity = sealed.bytesIdentity ?? sealed.identity
      const held = sealedFingerprints.get(digestIdentity)
      if (held?.pin === pinDigest) return held.value
      const value = fingerprint(sealed.read(), pin)
      if (!value || !sealed.current() || !targetCurrent()) return undefined
      sealedFingerprints.set(digestIdentity, { pin: pinDigest, value })
      return value
    }
  }
  const fingerprint = (snapshots: ReturnType<NonNullable<typeof host.persistence.currentSnapshots>>, pin: ReviewThreadContext) => {
    if (!snapshots) return undefined
    const product = object(snapshots.dashboard.data.__sfProductV1)
    const review = object(product.reviews)[pin.reviewRef]
    if (digestSfValue(review) !== pin.reviewDigest) return undefined
    const receipts = Object.values(object(product.transactions)).filter((entry) => {
      const receipt = object(entry), value = object(receipt.value)
      return receipt.namespace === "reviews" && receipt.targetRef === targetRef &&
        receipt.targetIncarnation === targetIncarnation && typeof receipt.principalRef === "string" && !!receipt.principalRef.trim() &&
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
    const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const binding = digestSfValue([call.kind, call.binding])
    const current = () => sameProducer() && targetCurrent() && host.persistence === persistence && input.authority.state === state && state.read === readState &&
      host.requestFor === requestFor && host.authenticate === authenticate && requestFor.call(host, call) === request && !!request && !request.signal.aborted &&
      reviews.read === read && host.revalidate === revalidate && persistence.currentSnapshots === snapshots && binding === digestSfValue([call.kind, call.binding]) &&
      (!atomic || persistence.dashboardSourceFence === atomic && hasSfDashboardSourceFence(persistence))
    // External outcomes/documents/comments need their producer's transaction lease.
    // Do not turn their absence into positive source authority.
    if (!request || !snapshots || hasActiveSfSnapshot(persistence) || !localRecordReview(review) || !isReviewThreadContext(pin) ||
      digestSfValue(review) !== pin.reviewDigest || !current() || !await revalidate.call(host, call)) return unavailable()
    const snapshot = async (expectedRoot?: object) => {
      const checked = await readState.call(state, request, "reviews", selectSfReviewAuthority(async (actor) => {
        if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return undefined
        const surfaces = [...new Set(review.sourceRefs.map((source) => source.surface))]
        const acl = expectedRoot && atomic?.observeAuthority?.(surfaces)
        if (expectedRoot && (!acl || acl.identity !== expectedRoot || !acl.current())) return undefined
        const held = acl ? acl.snapshots : snapshots.call(host.persistence)
        if (!held) return undefined
        for (const surface of surfaces) {
          const principal = await authenticate.call(host, request, { surface, roleMap: roleMap(held[surface], surface) })
          if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:") || !current() || acl && !acl.current()) return undefined
        }
        return fingerprintReader(pin, expectedRoot)()
      }))
      return checked.status === "ok" && current() ? checked.value : undefined
    }
    const sourceCheck = { owner: host, request, current }
    const scoped = atomic && readScope && prepareRevalidation?.call(readScope, pin.reviewRef, pin.reviewDigest, call)
    const observePair = async (expectedRoot?: object) => {
      const first = await (scoped ? withSfScopedSourceChecks(sourceCheck, scoped).then((observed) => observed.current() ? observed.value : unavailable())
        : read.call(reviews, pin.reviewRef, call))
      if (!current() || first.status !== "ok" || digestSfValue(first.value) !== pin.reviewDigest) return undefined
      const before = await snapshot(expectedRoot)
      const observation = await withSfScopedSourceChecks(sourceCheck, scoped || (() => read.call(reviews, pin.reviewRef, call))).catch(() => undefined)
      const after = observation && await snapshot(expectedRoot)
      return { before, observation, after }
    }
    // Both C05 reads and both C08 snapshots remain independent observations.
    // The installed driver holds their source preimage stable.
    const paired = scoped && atomic
      ? await atomic.transaction("dashboard", async () => {
        const root = current() ? atomic.readSealed?.() : undefined
        if (!root?.current()) return { commit: false, value: undefined }
        const observed = await observePair(root.identity)
        return { commit: false, value: current() && root.current() ? observed : undefined }
      }, { signal: request.signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
      : await observePair()
    if (!paired?.observation) return unavailable()
    const secondObservation = paired.observation
    const second = secondObservation.value
    const after = paired.after
    if (!paired.before || paired.before !== after || !current() || !secondObservation.current() || second.status !== "ok" || digestSfValue(second.value) !== pin.reviewDigest ||
      !await revalidate.call(host, call) || !current()) return unavailable()
    let sourceCurrent = secondObservation.current
    const startCheck = () => {
      if (!current() || !sourceCurrent()) return () => false
      const readFingerprint = fingerprintReader(pin)
      return () => current() && sourceCurrent() && readFingerprint() === after
    }
    const lease = { startCheck, fence: async () => {
      const check = startCheck()
      if (!check()) return false
      // Every asynchronous C05 source fence repeats the real dependency read.
      // The synchronous recipient check below only checks this lease's
      // structure/owners; transaction consumers await this source fence first.
      const strict = scoped && readScope && prepareRevalidation?.call(readScope, pin.reviewRef, pin.reviewDigest, call)
      if (scoped && !strict) return false
      const observation = await withSfScopedSourceChecks(sourceCheck, strict || (() => readScope && revalidateReview
        ? revalidateReview.call(readScope, pin.reviewRef, pin.reviewDigest, call)
        : read.call(reviews, pin.reviewRef, call))).catch(() => undefined)
      if (!observation) return false
      sourceCurrent = observation.current
      const observed = observation.value
      return observed.status === "ok" && digestSfValue(observed.value) === pin.reviewDigest &&
        check() && await revalidate.call(host, call) && check()
    } }
    const selected = leases.get(call) ?? new Map<string, AccessLease>()
    if (selected.size >= 128 && !selected.has(key(pin, basis, call))) return unavailable()
    selected.set(key(pin, basis, call), lease); leases.set(call, selected)
    return { status: "ok", value: lease }
  }
  const observePinnedContext = async (pin: ReviewThreadContext, basis: ThreadSourceContext, call: TrustedDomainContext, requireFingerprint = false, leg?: {
    complete: () => Promise<boolean>
    before?: () => Promise<boolean>
    cold?: { current: () => boolean; delegated: () => boolean }
    ineligible?: boolean
  }) => {
    const requestFor = host.requestFor
    const revalidate = host.revalidate
    const request = requestFor.call(host, call)
    const persistence = host.persistence
    const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const seal = atomic?.readSealed
    const readReview = reviews.read
    const transaction = atomic?.transaction, preimage = atomic?.holdTargetPreimage
    const prepare = readScope?.prepareRevalidation
    const binding = digestSfValue([call.kind, call.binding])
    const denied = { status: "denied" as const, reason: "review-thread-context-unavailable" }
    if (!sameProducer()) return denied
    if (!request || !atomic || !seal || !transaction || !preimage || !readScope || !prepare || hasActiveSfSnapshot(persistence))
      return requireFingerprint ? denied : readContext.call(contexts, pin, basis, call)
    const current = () => sameProducer() && host.persistence === persistence && host.requestFor === requestFor && host.revalidate === revalidate &&
      reviews.read === readReview && requestFor.call(host, call) === request && !request.signal.aborted &&
      digestSfValue([call.kind, call.binding]) === binding && persistence.dashboardSourceFence === atomic &&
      hasSfDashboardSourceFence(persistence) && atomic.readSealed === seal && atomic.transaction === transaction &&
      atomic.holdTargetPreimage === preimage && (!leg?.cold || leg.cold.current())
    const ready = prepare.call(readScope, pin.reviewRef, pin.reviewDigest, call)
    if (!ready && !leg?.cold) return requireFingerprint ? denied : readContext.call(contexts, pin, basis, call)
    // The canonical cold read may materialize source metadata. Observe it
    // outside the seal and hand its detached result to the pair exactly once.
    const initial = !ready && await (async () => {
      if (!current() || !await revalidate.call(host, call) || !current() ||
        leg?.before && (!await leg.before() || !current())) return denied
      const result = structuredClone(await readReview.call(reviews, pin.reviewRef, call))
      return current() && await revalidate.call(host, call) && current() ? result : denied
    })()
    if (initial && initial.status !== "ok") return initial
    const strict = ready ?? prepare.call(readScope, pin.reviewRef, pin.reviewDigest, call)
    if (!strict || !current()) {
      // An independently authenticated producer may mark a review outside
      // its optimized shape. Keep those reviews on the original route.
      if (!strict && initial && initial.status === "ok" && leg?.cold?.delegated()) leg.ineligible = true
      return denied
    }
    let first = initial || undefined
    const completionFailure: { error?: unknown } = {}
    const paired = await readContext.call(contexts, pin, basis, call, (run) =>
      atomic.transaction<Awaited<ReturnType<typeof readContext>>>("dashboard", async () => {
        const root = current() ? seal.call(atomic) : undefined
        if (!root?.current()) return { commit: false, value: denied }
        const fingerprint = requireFingerprint ? fingerprintReader(pin, root.identity) : undefined
        const before = fingerprint?.()
        if (fingerprint && !before) return { commit: false, value: denied }
        // Historical access comes first for recipient reads. The cold leg
        // already ran it before the real protected read outside this seal.
        if (ready && leg?.before) {
          try {
            if (!await leg.before() || !current() || !root.current()) return { commit: false, value: denied }
          } catch (error) {
            completionFailure.error = error
            return { commit: false, value: denied }
          }
        }
        const result = await run(async () => {
          if (!current() || !root.current()) return denied
          if (first) {
            const observed = first
            first = undefined
            return observed
          }
          const scoped = await strict()
          return !fingerprint || fingerprint() === before ? scoped : denied
        })
        // Keep the independent C06 callbacks in this leg's held root. A
        // later C08 authorization gets a new root and repeats the whole pair.
        if (leg && result.status === "ok") {
          if (!localRecordReview(result.value.review) || !current() || !root.current() ||
            !await revalidate.call(host, call) || !current()) return { commit: false, value: denied }
          try {
            if (!await leg.complete()) return { commit: false, value: denied }
          } catch (error) {
            // Preserve the outer thread reader's unavailable/denied handling.
            completionFailure.error = error
            return { commit: false, value: denied }
          }
        }
        return { commit: false, value: current() && root.current() && (!fingerprint || fingerprint() === before) ? result : denied }
      }, { signal: request.signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true }))
    if (Object.hasOwn(completionFailure, "error")) throw completionFailure.error
    return current() ? paired : denied
  }
  const authorizeReviewThreadContext: SfReviewCollaborationBinding["authorizeReviewThreadContext"] = async (pin, basis, call, purpose) => {
    if (!sameProducer() || !isReviewThreadContext(pin)) return false
    if (hasActiveSfSnapshot(host.persistence)) {
      const lease = leases.get(call)?.get(key(pin, basis, call))
      return !!lease && await lease.fence()
    }
    const persistence = host.persistence
    const request = host.requestFor(call)
    const readOnly = purpose === "read" && !!request && !!readerCurrent && !!readScope && !!prepareRevalidation &&
      hasSfDashboardSourceFence(persistence) && !!prepareRevalidation.call(readScope, pin.reviewRef, pin.reviewDigest, call)
    const found = await observePinnedContext(pin, basis, call, readOnly)
    if (!sameProducer() || found.status !== "ok") return false
    // C06 never consumes a mutation lease after this read-only route. Both
    // canonical C05 observations and the independently checked C08 fingerprint
    // are complete before the sealed root closes.
    if (readOnly) return localRecordReview(found.value.review) && !!request &&
      host.persistence === persistence && host.requestFor(call) === request && !request.signal.aborted &&
      await host.revalidate(call) && sameProducer() && host.persistence === persistence && host.requestFor(call) === request && !request.signal.aborted
    return (await prepareAccess(pin, basis, found.value.review, call)).status === "ok"
  }
  const readLeg: NonNullable<SfReviewCollaborationBinding["readLeg"]> = async (pin, basis, call, complete, before) => {
    if (!sameProducer() || !isReviewThreadContext(pin)) return false
    const persistence = host.persistence
    const requestFor = host.requestFor, revalidate = host.revalidate
    const request = requestFor.call(host, call)
    if (!request || request.signal.aborted) return false
    if (!readerCurrent || !readScope || !prepareRevalidation ||
      !hasSfDashboardSourceFence(persistence) || hasActiveSfSnapshot(persistence)) return undefined
    const existing = prepareRevalidation.call(readScope, pin.reviewRef, pin.reviewDigest, call)
    const cold = !existing ? prepareCold?.call(readScope, pin.reviewRef, call) : undefined
    if (!existing && !cold) return undefined
    const current = () => sameProducer() && host.persistence === persistence && host.requestFor === requestFor &&
      host.revalidate === revalidate && requestFor.call(host, call) === request && !request.signal.aborted
    const leg = { complete, before, cold, ineligible: false }
    const found = await observePinnedContext(pin, basis, call, true, leg)
    if (leg.ineligible && current()) return undefined
    return found.status === "ok" && current() && await revalidate.call(host, call) && current()
  }
  const recipientLeases = new WeakMap<TrustedDomainContext, Map<string, RecipientLease>>()
  const recipientKey = (recipient: string, basis: ThreadSourceContext, call: TrustedDomainContext) => digestSfValue({ recipient, basis, authority: call.binding })
  const reviewRecipientAuthority: ReviewThreadRecipientAuthority = {
    authorize: async (recipient, basis, call) => {
      if (!sameProducer() || !recipient.trim() || !isReviewThreadContext(basis.reviewContext) || hasActiveSfSnapshot(host.persistence)) return false
      const found = await observePinnedContext(basis.reviewContext, basis, call)
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
      if (!lease) return false
      const checkAccess = lease.access.startCheck()
      if (!checkAccess()) return false
      if (recipient === call.binding.principalRef) return true
      const provider = lease.provider, check = lease.check
      return !!provider && !!check && input.recipientAuthority === provider && provider.authorize === lease.authorize && provider.checkAtCommit === check &&
        check.call(provider, recipient, structuredClone(basis), call) === true && checkAccess() && input.recipientAuthority === provider &&
        provider.authorize === lease.authorize && provider.checkAtCommit === check
    },
  }
  return { evidence: input.evidence, authorizeReviewThreadContext, reviewRecipientAuthority, readLeg,
    reviewAnswerSource: createReviewAnswerSource({
      reviews, host, prepareAccess, readContext: observePinnedContext,
      reuseResolvedMaterial: ({ pin, review }, call) => sameProducer() && !!readScope && !!readerCurrent && localRecordReview(review) &&
        !!prepareRevalidation?.call(readScope, pin.reviewRef, pin.reviewDigest, call),
    }) }
}

/** Scope boundary, not an authorization substitute: actual reviews.read above
 * still reopens every source and C08 receipt under the current request. */
export function localRecordReview(review: PreservedReview) {
  const sourceTypes = ["dashboard-page", "hotTopics", "opexOwners", "capexProjects", "members", "leaders", "projects", "opsTickets",
    "secKpi", "risks", "contracts", "stakeholders", "itperf-item"]
  if (!review.sourceRefs.length || review.comments.length || review.sourceRefs.some((source) => source.surface !== "dashboard" || !sourceTypes.includes(source.type))) return false
  let budget = 20_000
  const evidence = new Map<string, number>()
  const visit = (value: unknown, depth = 0): boolean => {
    if (--budget < 0 || depth > 24) return false
    if (!value || typeof value !== "object") return true
    if (Array.isArray(value)) return value.every((entry) => visit(entry, depth + 1))
    if ("decision" in value && value.decision !== undefined || "reviewOutcome" in value || "reviewOutcomeComparison" in value ||
      "reviewCommentRefs" in value && (!Array.isArray(value.reviewCommentRefs) || value.reviewCommentRefs.length > 0) ||
      "sensitivity" in value && value.sensitivity !== undefined) return false
    if ("schema" in value && value.schema === "sf-evidence-v1" && (!("kind" in value) || value.kind !== "record" ||
      !("target" in value) || object(value.target).surface !== "dashboard" || !sourceTypes.includes(String(object(value.target).recordType)))) return false
    // Repeated cells/charts carry copies of the same complete record evidence.
    // Reuse only a successful structural visit in this invocation, at an equal
    // or deeper placement. A deeper occurrence must still prove the depth cap.
    // Every occurrence above spends budget; source/receipt authority is separate.
    const canonical = "schema" in value && value.schema === "sf-evidence-v1" ? canonicalSfValue(value) : undefined
    if (canonical !== undefined && (evidence.get(canonical) ?? -1) >= depth) return true
    const accepted = Object.values(value).every((entry) => visit(entry, depth + 1))
    if (accepted && canonical !== undefined) evidence.set(canonical, depth)
    return accepted
  }
  return visit(review)
}
