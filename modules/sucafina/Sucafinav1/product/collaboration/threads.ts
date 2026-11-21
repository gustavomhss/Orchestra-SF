import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfStateMutation } from "../contracts/state.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import { createRecipientCommitCheck } from "./recipient-authority.ts"
import type { CollaborationRecipientCommitCheck } from "./recipient-authority.ts"
import { threadMessageContext } from "./thread-context.ts"
import { isReviewThreadContext } from "../reviews/thread-context.ts"
import type { ReviewThreadContext } from "../reviews/thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"
import type { PrepareReviewThreadFence } from "./review-source-fence.ts"
import { probeSfReviewMutationReceipt, selectSfReviewAuthority, stageSfReviewThreadWrite } from "../host-binding/state-provider.ts"

export type CollaborationThread = {
  id: string
  kind: "comment" | "clarification" | "review"
  sourceRef: string
  sourceIncarnation: string
  observedVersion: number
  period: Period
  recipientRef?: string
  state: "open" | "resolved"
  messages: readonly { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string; sourceContext?: ThreadSourceContext }[]
  evidenceRefs: readonly BusinessEvidenceRef[]
}
type Draft = Pick<CollaborationThread, "kind" | "sourceRef" | "sourceIncarnation" | "observedVersion" | "period" | "recipientRef" | "evidenceRefs"> & { body: string; reviewContext?: ReviewThreadContext }
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

type RoutedReply = {
  request: Request
  threadDigest: string
  current: () => boolean
  sameScope: (thread: CollaborationThread) => boolean
  prepareContinuity: () => Promise<(() => boolean) | undefined>
}

/** The host authorizes the source and recipient by identity without granting either new access. */
export function createThreadPort(input: {
  state: SfProductStatePort
  replayCurrent?: () => boolean
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  creationTarget: { ref: string; incarnation: string }
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  authorize: (thread: Draft | CollaborationThread, context: TrustedDomainContext, mode: "read" | "write") => Promise<boolean>
  authorizePreparedWrite?: (thread: Draft | CollaborationThread, context: TrustedDomainContext) => Promise<boolean>
  checkRecipientAtCommit?: CollaborationRecipientCommitCheck
  checkReviewRecipientAtCommit?: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => boolean
  prepareReviewThreadFence?: PrepareReviewThreadFence
  createId: () => string
  now: () => string
}) {
  const checkRecipient = input.checkRecipientAtCommit ?? createRecipientCommitCheck()
  const checkThreadRecipient = (recipientRef: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext, basis?: ThreadSourceContext, reviewCheck?: typeof input.checkReviewRecipientAtCommit) => {
    if (!basis?.reviewContext) return checkRecipient(recipientRef, refs, context)
    if (input.checkReviewRecipientAtCommit !== reviewCheck) return false
    if (!reviewCheck) return recipientRef === context.binding.principalRef
    return reviewCheck(recipientRef, basis, context) && input.checkReviewRecipientAtCommit === reviewCheck
  }
  const prepareMutation = (thread: Draft | CollaborationThread, context: TrustedDomainContext, reviewed: boolean) => {
    const framework = input.replayCurrent
    const prepared = input.authorizePreparedWrite
    if (!reviewed || !prepared || !framework?.() || thread.recipientRef !== context.binding.principalRef)
      return input.mutationFence.prepare(() => input.authorize(structuredClone(thread), context, "write"))
    // The explicit review lease is already prepared for the final C08 check.
    // The two independent preflight observations still authorize the sources.
    const current = () => input.replayCurrent === framework && framework() && input.authorizePreparedWrite === prepared
    return input.mutationFence.prepare(async () => current() && await prepared(structuredClone(thread), context) && current())
  }
  const readReceipt = async (thread: CollaborationThread, request: Request, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
    const readable = await input.authorize(thread, context, "read").catch(() => undefined)
    if (readable === false || input.host.requestFor(context) !== request || !await input.host.revalidate(context) || input.host.requestFor(context) !== request) return { status: "denied", reason: "thread-access-unavailable" }
    if (readable !== true) return { status: "unavailable", reason: "thread-read-unavailable" }
    return { status: "ok", value: publicThreadProjection(thread) }
  }
  const recoverReceipt = async (request: Request, command: SfStateMutation, context: TrustedDomainContext, check: (thread: CollaborationThread) => boolean) => {
    const framework = input.replayCurrent
    if (!framework?.()) return undefined
    const state = input.state
    const read = state.read
    const transaction = state.transaction
    const host = input.host
    const requestFor = host.requestFor
    const revalidate = host.revalidate
    const authorize = input.authorize
    const denied = { status: "denied" as const, reason: "thread-access-unavailable" }
    const unavailable = { status: "unavailable" as const, reason: "thread-read-unavailable" }
    const current = () => input.replayCurrent === framework && framework() && input.state === state && state.read === read && state.transaction === transaction &&
      input.host === host && host.requestFor === requestFor && host.revalidate === revalidate && input.authorize === authorize &&
      !request.signal.aborted && requestFor.call(host, context) === request
    const existing = await probeSfReviewMutationReceipt<CollaborationThread>(state, request, command, context, current)
    if (!existing) return undefined
    if (!current()) return denied
    if ("reason" in existing) return existing
    if (existing.status !== "ok" || !isThread(existing.value) || !check(existing.value)) return unavailable
    const authorized = await readReceipt(existing.value, request, context)
    return current() ? authorized : denied
  }
  return {
    create: async (draft: Draft, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-action-required" }
      if (!draft || !["comment", "clarification", "review"].includes(draft.kind) || typeof draft.sourceRef !== "string" || !draft.sourceRef.trim() || typeof draft.sourceIncarnation !== "string" || !draft.sourceIncarnation.trim() || !Number.isSafeInteger(draft.observedVersion) || draft.observedVersion < 1 || !isSfPeriod(draft.period) || typeof draft.body !== "string" || !draft.body.trim() || !Array.isArray(draft.evidenceRefs) || !draft.evidenceRefs.length || (draft.recipientRef !== undefined && (typeof draft.recipientRef !== "string" || !draft.recipientRef.trim())) || (draft.kind !== "comment" && !draft.recipientRef) || (draft.reviewContext !== undefined && !isReviewThreadContext(draft.reviewContext)) || !validMutation(mutation)) return { status: "needs-input", reason: "invalid-thread" }
      const selected = structuredClone({ draft, mutation })
      const sources = selected.draft.evidenceRefs.filter((ref) => ref && typeof ref === "object" && ref.refId === selected.draft.sourceRef)
      const source = sources[0]
      if (sources.length !== 1 || !source || source.kind !== "record" || !source.target || typeof source.target !== "object" || source.target.incarnation !== selected.draft.sourceIncarnation || source.target.version !== selected.draft.observedVersion || (!isSfPeriod(source.target.period) || source.target.period.start > selected.draft.period.start || source.target.period.end < selected.draft.period.end)) return { status: "needs-input", reason: "thread-source-mismatch" }
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.thread.create", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
      const review = selected.draft.reviewContext ? await input.state.read(request, "reviews", selectSfReviewAuthority((authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)) : undefined
      if (review && (input.host.requestFor(context) !== request || !await input.host.revalidate(context) || input.host.requestFor(context) !== request)) return { status: "denied", reason: "review-thread-context-unavailable" }
      if (review && "reason" in review) return review
      if (selected.draft.reviewContext && review?.status !== "ok") return { status: "unavailable", reason: "review-thread-context-unavailable" }
      if (review?.status === "ok" && !review.value) return { status: "denied", reason: "review-thread-context-unavailable" }
      const sourceContext: ThreadSourceContext | undefined = selected.draft.reviewContext ? { sourceRef: selected.draft.sourceRef, sourceIncarnation: selected.draft.sourceIncarnation, observedVersion: selected.draft.observedVersion, period: selected.draft.period, evidenceRefs: selected.draft.evidenceRefs, reviewContext: selected.draft.reviewContext } : undefined
      const command = { namespace: "threads" as const, ...selected.mutation, ...(review?.status === "ok" ? { sourceFence: "all" as const, checkNamespaces: [{ namespace: "reviews" as const, expectedStorageVersion: review.storageVersion }] } : {}), commandDigest: digestSfValue(selected.draft), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }
      if (sourceContext && selected.draft.recipientRef === context.binding.principalRef) {
        const recovered = await recoverReceipt(request, command, context, (thread) => {
          const message = thread.messages[0]
          return !!message && thread.recipientRef === selected.draft.recipientRef && thread.kind === selected.draft.kind &&
            message.authorRef === context.binding.principalRef && message.body === selected.draft.body &&
            digestSfValue(threadMessageContext(thread, message)) === digestSfValue(sourceContext)
        })
        if (recovered) return recovered
      }
      const prepareReviewFence = input.prepareReviewThreadFence
      const checkReviewRecipient = input.checkReviewRecipientAtCommit
      const reviewFence = sourceContext && prepareReviewFence ? await prepareReviewFence(sourceContext, context) : undefined
      if (sourceContext && !reviewFence) return { status: "unavailable", reason: "review-thread-source-fence-unavailable" }
      const fence = await prepareMutation(selected.draft, context, !!reviewFence)
      if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      const thread: CollaborationThread = { id: input.createId(), kind: selected.draft.kind, sourceRef: selected.draft.sourceRef, sourceIncarnation: selected.draft.sourceIncarnation, observedVersion: selected.draft.observedVersion, period: selected.draft.period, ...(selected.draft.recipientRef ? { recipientRef: selected.draft.recipientRef } : {}), state: "open", messages: [{ id: input.createId(), incarnation: input.createId(), version: 1, authorRef: context.binding.principalRef, body: selected.draft.body, createdAt: input.now(), ...(sourceContext ? { sourceContext } : {}) }], evidenceRefs: selected.draft.evidenceRefs }
      if (!thread.id.trim() || !thread.messages[0]?.id.trim() || !thread.messages[0]?.incarnation.trim() || !isThread(thread)) return { status: "unavailable", reason: "identity-unavailable" }
      const saved = await input.state.transaction(request, command, stageSfReviewThreadWrite<CollaborationThread | null>(async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.thread.create", selected) || sourceContext && (input.prepareReviewThreadFence !== prepareReviewFence || !reviewFence || !await reviewFence() || input.prepareReviewThreadFence !== prepareReviewFence) || !input.mutationFence.check(fence) || selected.draft.recipientRef && !checkThreadRecipient(selected.draft.recipientRef, selected.draft.evidenceRefs, context, sourceContext, checkReviewRecipient) || state.threads[thread.id]) return { commit: false, value: null }
        state.threads[thread.id] = thread
        return { commit: true, value: thread }
      }))
      if (saved.status === "preview") return { status: "conflict", reason: "thread-not-committed" }
      if ("reason" in saved) return saved
      if (!saved.value) return { status: "unavailable", reason: "thread-read-unavailable" }
      return readReceipt(saved.value, request, context)
    },
    reply: (id: string, body: string, mutation: Mutation, context: TrustedDomainContext, route?: RoutedReply) => change(id, { kind: "reply", body }, mutation, context, route),
    resolve: (id: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "resolve" }, mutation, context),
    read: async (id: string, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
      if (typeof id !== "string" || !id.trim()) return { status: "needs-input", reason: "invalid-thread-reference" }
      const request = input.host.requestFor(context)
      const current = async () => !!request && input.host.requestFor(context) === request && await input.host.revalidate(context) && input.host.requestFor(context) === request
      try {
        if (!request || !await current()) return { status: "denied", reason: "thread-access-unavailable" }
        const read = () => input.state.read(request, "threads", (state, authority) => {
          const bound = authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion
          return { bound, thread: bound ? state.threads[id] : undefined }
        })
        const first = await read()
        if (!await current()) return { status: "denied", reason: "thread-access-unavailable" }
        if (first.status !== "ok") return "reason" in first ? first : { status: "unavailable", reason: "thread-read-unavailable" }
        if (!first.value.bound) return { status: "denied", reason: "thread-access-binding-changed" }
        if (first.value.thread === undefined) return { status: "denied", reason: "thread-target-changed" }
        if (!isThread(first.value.thread)) return { status: "unavailable", reason: "thread-read-unavailable" }
        const thread = first.value.thread
        if (thread.id !== id || !await input.authorize(thread, context, "read") || !await current()) return { status: "denied", reason: "thread-access-unavailable" }
        const again = await read()
        // A new read may fail or observe a legitimate reply. Neither proves that
        // access was revoked; actual authority loss takes precedence over drift.
        if (!await current()) return { status: "denied", reason: "thread-access-unavailable" }
        if (again.status !== "ok") return "reason" in again ? again : { status: "unavailable", reason: "thread-read-unavailable" }
        if (!again.value.bound) return { status: "denied", reason: "thread-access-binding-changed" }
        if (again.value.thread === undefined) return { status: "denied", reason: "thread-target-changed" }
        if (!isThread(again.value.thread)) return { status: "unavailable", reason: "thread-read-unavailable" }
        if (!sameThreadReadScope(thread, again.value.thread) || !await input.authorize(again.value.thread, context, "read") || !await current()) return { status: "denied", reason: "thread-access-unavailable" }
        if (digestSfValue(again.value.thread) !== digestSfValue(thread)) return { status: "stale", reason: "thread-content-changed" }
        return { status: "ok", value: publicThreadProjection(thread) }
      } catch {
        const authorized = await current().catch(() => undefined)
        if (authorized === false) return { status: "denied", reason: "thread-access-unavailable" }
        return { status: "unavailable", reason: "thread-read-unavailable" }
      }
    },
  }

  async function change(id: string, action: { kind: "reply"; body: string } | { kind: "resolve" }, mutation: Mutation, context: TrustedDomainContext, route?: RoutedReply): Promise<PortResult<CollaborationThread>> {
    if (context.kind !== "ui") return { status: "denied", reason: "human-action-required" }
    if (typeof id !== "string" || !id.trim() || !validMutation(mutation) || (action.kind === "reply" && (typeof action.body !== "string" || !action.body.trim()))) return { status: "needs-input", reason: "invalid-thread-action" }
    const selected = structuredClone({ action, mutation })
    const humanAction = selected.action.kind === "reply" ? "collaboration.thread.reply" : "collaboration.thread.resolve"
    const payload = selected.action.kind === "reply" ? { id, body: selected.action.body, mutation: selected.mutation } : { id, mutation: selected.mutation }
    const request = input.host.requestFor(context)
    const routeCurrent = () => !route || route.request === request && !!input.replayCurrent?.() && route.current()
    if (!request || !routeCurrent() || !await input.human.authorize(context, humanAction, payload) || !await input.host.revalidate(context) || !routeCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
    const read = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    if (read.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
    if ("reason" in read) return read
    if (!isThread(read.value) || read.value.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const prior = read.value
    if (!routeCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
    const routedRow = !route || digestSfValue(prior) === route.threadDigest
    if (!routedRow && !route?.sameScope(prior)) return { status: "conflict", reason: "thread-changed" }
    const continuity = route && await route.prepareContinuity()
    if (!routeCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
    if (route && !continuity) return { status: "unavailable", reason: "thread-source-unavailable" }
    const review = prior.messages[0]?.sourceContext?.reviewContext ? await input.state.read(request, "reviews", selectSfReviewAuthority((authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)) : undefined
    if (review && (input.host.requestFor(context) !== request || !await input.host.revalidate(context) || input.host.requestFor(context) !== request)) return { status: "denied", reason: "review-thread-context-unavailable" }
    if (review && "reason" in review) return review
    if (prior.messages[0]?.sourceContext?.reviewContext && review?.status !== "ok") return { status: "unavailable", reason: "review-thread-context-unavailable" }
    if (review?.status === "ok" && !review.value) return { status: "denied", reason: "review-thread-context-unavailable" }
    const reviewBasis = prior.messages[0]?.sourceContext?.reviewContext ? prior.messages[0].sourceContext : undefined
    const command = { namespace: "threads" as const, ...selected.mutation, ...(review?.status === "ok" ? { sourceFence: "all" as const, checkNamespaces: [{ namespace: "reviews" as const, expectedStorageVersion: review.storageVersion }] } : {}), commandDigest: digestSfValue({ id, action: selected.action }), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }
    if (reviewBasis && prior.recipientRef === context.binding.principalRef) {
      const recovered = await recoverReceipt(request, command, context, (thread) => {
        if (thread.id !== id || thread.recipientRef !== context.binding.principalRef || !sameThreadReadScope(thread, prior)) return false
        if (selected.action.kind === "resolve") return thread.state === "resolved"
        const reply = thread.messages.at(-1)
        return !!reply && thread.messages.length > 1 && reply.authorRef === context.binding.principalRef && reply.body === selected.action.body &&
          digestSfValue(threadMessageContext(thread, reply)) === digestSfValue(reviewBasis)
      })
      if (recovered) return routeCurrent() ? recovered : { status: "denied", reason: "thread-access-unavailable" }
    }
    // A concurrent identical reply can recover its receipt. A changed
    // routing row cannot admit a new write.
    if (!routedRow) return { status: "conflict", reason: "thread-changed" }
    if (!routeCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
    const prepareReviewFence = input.prepareReviewThreadFence
    const checkReviewRecipient = input.checkReviewRecipientAtCommit
    const reviewFence = reviewBasis && prepareReviewFence ? await prepareReviewFence(reviewBasis, context) : undefined
    if (reviewBasis && !reviewFence) return { status: "unavailable", reason: "review-thread-source-fence-unavailable" }
    const fence = await prepareMutation(prior, context, !!reviewFence)
    if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
    const messageId = selected.action.kind === "reply" ? input.createId() : undefined
    const incarnation = selected.action.kind === "reply" ? input.createId() : undefined
    if (selected.action.kind === "reply" && (!messageId?.trim() || !incarnation?.trim() || prior.messages.some((message) => message.id === messageId || message.incarnation === incarnation))) return { status: "unavailable", reason: "identity-unavailable" }
    const saved = await input.state.transaction(request, command, stageSfReviewThreadWrite<CollaborationThread | null>(async (state, authority) => {
      if (!routeCurrent() || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, humanAction, payload) || reviewBasis && (input.prepareReviewThreadFence !== prepareReviewFence || !reviewFence || !await reviewFence() || input.prepareReviewThreadFence !== prepareReviewFence) || !input.mutationFence.check(fence) || prior.recipientRef && !checkThreadRecipient(prior.recipientRef, prior.evidenceRefs, context, reviewBasis, checkReviewRecipient) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || prior.state !== "open" ||
        route && (!routeCurrent() || !continuity?.())) return { commit: false, value: null }
      const next: CollaborationThread = selected.action.kind === "reply" ? { ...prior, messages: [...prior.messages, { id: messageId!, incarnation: incarnation!, version: 1, authorRef: context.binding.principalRef, body: selected.action.body, createdAt: input.now(), ...(prior.messages[0]?.sourceContext?.reviewContext ? { sourceContext: structuredClone(prior.messages[0].sourceContext) } : {}) }] } : { ...prior, state: "resolved" }
      if (!isThread(next)) return { commit: false, value: null }
      state.threads[id] = next
      return { commit: true, value: next }
    }))
    if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
    if ("reason" in saved) return saved
    if (!saved.value) return { status: "unavailable", reason: "thread-read-unavailable" }
    const receipt = await readReceipt(saved.value, request, context)
    return routeCurrent() ? receipt : { status: "denied", reason: "thread-access-unavailable" }
  }
}

/** Replies and edits may change content, but cannot retarget the retained discussion. */
export function sameThreadReadScope(previous: CollaborationThread, current: CollaborationThread) {
  const scope = (thread: CollaborationThread) => ({ id: thread.id, kind: thread.kind, sourceRef: thread.sourceRef, sourceIncarnation: thread.sourceIncarnation, observedVersion: thread.observedVersion, period: thread.period, recipientRef: thread.recipientRef ?? null, evidenceRefs: thread.evidenceRefs })
  return digestSfValue(scope(previous)) === digestSfValue(scope(current)) && previous.messages.every((message) => {
    const next = current.messages.find((entry) => entry.id === message.id)
    return !!next && next.incarnation === message.incarnation && next.authorRef === message.authorRef && digestSfValue(threadMessageContext(previous, message)) === digestSfValue(threadMessageContext(current, next))
  })
}

/** Case provenance and stored revisions have separate, currently authorized readers. */
function publicThreadProjection(thread: CollaborationThread): CollaborationThread {
  return {
    id: thread.id,
    kind: thread.kind,
    sourceRef: thread.sourceRef,
    sourceIncarnation: thread.sourceIncarnation,
    observedVersion: thread.observedVersion,
    period: thread.period,
    ...(thread.recipientRef ? { recipientRef: thread.recipientRef } : {}),
    state: thread.state,
    messages: thread.messages.map(({ id, incarnation, version, authorRef, body, createdAt, sourceContext }) => ({ id, incarnation, version, authorRef, body, createdAt, ...(sourceContext ? { sourceContext } : {}) })),
    evidenceRefs: thread.evidenceRefs,
  }
}

function validMutation(value: Mutation) {
  return !!value && Number.isSafeInteger(value.expectedStorageVersion) && value.expectedStorageVersion >= 0 && typeof value.idempotencyKey === "string" && !!value.idempotencyKey.trim()
}

export function isThread(value: unknown): value is CollaborationThread {
  if (!value || typeof value !== "object") return false
  const thread = value as Record<string, unknown>
  if (Object.hasOwn(thread, "reviewContext")) return false
  if (typeof thread.id !== "string" || !thread.id.trim() || typeof thread.sourceRef !== "string" || !thread.sourceRef.trim() || typeof thread.sourceIncarnation !== "string" || !thread.sourceIncarnation.trim() || !["comment", "clarification", "review"].includes(String(thread.kind)) || !["open", "resolved"].includes(String(thread.state)) || !Number.isSafeInteger(thread.observedVersion) || Number(thread.observedVersion) < 1 || !isSfPeriod(thread.period) || !Array.isArray(thread.messages) || !thread.messages.length || !Array.isArray(thread.evidenceRefs) || !thread.evidenceRefs.length || (thread.recipientRef !== undefined && (typeof thread.recipientRef !== "string" || !thread.recipientRef.trim())) || (thread.kind !== "comment" && !thread.recipientRef)) return false
  const sources = thread.evidenceRefs.filter((ref: unknown) => !!ref && typeof ref === "object" && "refId" in ref && ref.refId === thread.sourceRef)
  const source = sources[0] as Extract<BusinessEvidenceRef, { kind: "record" }> | undefined
  if (sources.length !== 1 || !source || source.kind !== "record" || !source.target || source.target.incarnation !== thread.sourceIncarnation || source.target.version !== thread.observedVersion || !isSfPeriod(source.target.period) || source.target.period.start > thread.period.start || source.target.period.end < thread.period.end) return false
  return thread.messages.every((value: unknown) => {
    if (!value || typeof value !== "object") return false
    const message = value as Record<string, unknown>
    return [message.id, message.incarnation, message.authorRef, message.body, message.createdAt].every((part) => typeof part === "string" && !!part.trim()) && Number.isSafeInteger(message.version) && Number(message.version) > 0
  }) && new Set(thread.messages.map((message: unknown) => (message as Record<string, unknown>).id)).size === thread.messages.length && new Set(thread.messages.map((message: unknown) => (message as Record<string, unknown>).incarnation)).size === thread.messages.length && thread.messages.every((message) => !!threadMessageContext(value as CollaborationThread, message as CollaborationThread["messages"][number]))
}
