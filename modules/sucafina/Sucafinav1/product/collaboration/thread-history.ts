import { probeSfReviewMutationReceipt, stageSfReviewThreadWrite } from "../host-binding/state-provider.ts"
import { createAnswerStateFence } from "./answer-state-fence.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort, SfProductState, SfStateAuthority } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { createRecipientAwareThreadReads } from "./thread-reads.ts"
import { isThread, sameThreadReadScope } from "./threads.ts"
import type { CollaborationThread } from "./threads.ts"
import { threadMessageContext } from "./thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"
import type { PrepareReviewThreadFence } from "./review-source-fence.ts"

type Message = CollaborationThread["messages"][number]
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }
type RevisionThread = CollaborationThread & { messageRevisions?: readonly Message[] }

/** Historical content stays with the canonical thread and is shown only under current source access. */
export function createThreadHistory(input: {
  state: SfProductStatePort
  replayCurrent?: () => boolean
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">
  read: ReturnType<typeof createRecipientAwareThreadReads>["read"]
  readHistorical?: ReturnType<typeof createRecipientAwareThreadReads>["readHistorical"]
  authorizeSources?: (basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  authorizeEditBasis?: (thread: CollaborationThread, basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  prepareReviewThreadFence?: PrepareReviewThreadFence
  authorizeReviewRecipient?: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  checkReviewRecipientAtCommit?: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => boolean
  prepareEditReceipt?: (thread: CollaborationThread, basis: ThreadSourceContext, context: TrustedDomainContext, current: () => boolean) =>
    Promise<(() => boolean) | "reissue" | undefined>
  human: CollaborationHumanAuthority
  fence: CollaborationMutationFence
  target: { ref: string; incarnation: string }
  threadHistoryWrites: WeakSet<object>
}) {
  const captureReceipt = createAnswerStateFence(input.host)
  const load = async (id: string, context: TrustedDomainContext, historical = false): Promise<PortResult<{ thread: RevisionThread; visible: CollaborationThread }>> => {
    const request = input.host.requestFor(context)
    const currentAccess = async () => !!request && input.host.requestFor(context) === request && await input.host.revalidate(context) && input.host.requestFor(context) === request
    try {
      if (!request || !await currentAccess()) return { status: "denied", reason: "thread-access-unavailable" }
      const visible = await (historical && input.readHistorical ? input.readHistorical : input.read)(id, context)
      if (visible.status !== "ok") return visible
      const raw = await input.state.read(request, "threads", (state, authority) => {
        const bound = authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion
        return { bound, thread: bound ? state.threads[id] : undefined }
      })
      if (input.host.requestFor(context) !== request || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
      if ("reason" in raw) return raw
      if (raw.status !== "ok") return { status: "unavailable", reason: "thread-read-unavailable" }
      if (!raw.value.bound) return { status: "denied", reason: "thread-access-binding-changed" }
      if (raw.value.thread === undefined) return { status: "denied", reason: "thread-target-changed" }
      if (!isThread(raw.value.thread)) return { status: "unavailable", reason: "thread-read-unavailable" }
      if (raw.value.thread.id !== id || raw.value.thread.kind !== visible.value.kind || raw.value.thread.recipientRef !== visible.value.recipientRef || raw.value.thread.observedVersion !== visible.value.observedVersion || digestSfValue(raw.value.thread.period) !== digestSfValue(visible.value.period) || visible.value.messages[0]?.sourceContext?.reviewContext && !sameThreadReadScope(visible.value, raw.value.thread)) return { status: "denied", reason: "thread-target-changed" }
      if (digestSfValue(raw.value.thread.messages) !== digestSfValue(visible.value.messages)) return { status: "stale", reason: "thread-content-changed" }
      const thread = raw.value.thread as RevisionThread
      if (thread.messageRevisions !== undefined && (!Array.isArray(thread.messageRevisions) || thread.messageRevisions.some((message) => !message || typeof message.id !== "string" || typeof message.incarnation !== "string" || !Number.isSafeInteger(message.version) || message.version < 1 || typeof message.body !== "string" || typeof message.authorRef !== "string" || typeof message.createdAt !== "string"))) return { status: "unavailable", reason: "thread-history-unavailable" }
      return { status: "ok", value: { thread, visible: visible.value } }
    } catch {
      const authorized = await currentAccess().catch(() => undefined)
      if (authorized === false) return { status: "denied", reason: "thread-access-unavailable" }
      return { status: "unavailable", reason: "thread-read-unavailable" }
    }
  }
  return {
    edit: async (id: string, messageId: string, expectedVersion: number, body: string, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<{ id: string; messageId: string; version: number }>> => {
      if (context.kind !== "ui" || typeof id !== "string" || !id.trim() || typeof messageId !== "string" || !messageId.trim() || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || typeof body !== "string" || !body.trim() || !mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim()) return { status: "needs-input", reason: "invalid-thread-edit" }
      const selected = structuredClone({ id, messageId, expectedVersion, body, mutation })
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.thread.edit", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
      const loaded = await load(id, context)
      if (loaded.status !== "ok") return loaded
      const prior = loaded.value.thread
      const message = prior.messages.find((entry) => entry.id === selected.messageId)
      if (!message || message.authorRef !== context.binding.principalRef || message.version >= Number.MAX_SAFE_INTEGER) return { status: "denied", reason: "thread-access-unavailable" }
      const basis = threadMessageContext(prior, message)
      if (!basis) return { status: "unavailable", reason: "thread-history-unavailable" }
      const authorizeEditBasis = input.authorizeEditBasis
      const authorizeSelected = () => authorizeEditBasis?.(prior, basis, context) ?? input.authorizeSources?.(basis, context) ?? Promise.resolve(true)
      const readable = await authorizeSelected().catch(() => undefined)
      if (readable === false || input.host.requestFor(context) !== request || !await input.host.revalidate(context) || input.host.requestFor(context) !== request) return { status: "denied", reason: "thread-history-unavailable" }
      if (readable !== true) return { status: "unavailable", reason: "thread-read-unavailable" }
      const review = basis.reviewContext ? await input.state.read(request, "reviews", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion) : undefined
      if (review && (input.host.requestFor(context) !== request || !await input.host.revalidate(context) || input.host.requestFor(context) !== request)) return { status: "denied", reason: "review-thread-context-unavailable" }
      if (review && "reason" in review) return review
      if (basis.reviewContext && review?.status !== "ok") return { status: "unavailable", reason: "review-thread-context-unavailable" }
      if (review?.status === "ok" && !review.value) return { status: "denied", reason: "review-thread-context-unavailable" }
      const command = { namespace: "threads" as const, ...selected.mutation, ...(review?.status === "ok" ? { sourceFence: "all" as const, checkNamespaces: [{ namespace: "reviews" as const, expectedStorageVersion: review.storageVersion }] } : {}), commandDigest: digestSfValue({ id, messageId, expectedVersion, body }), targetRef: input.target.ref, targetIncarnation: input.target.incarnation }
      const state = input.state
      const readState = state.read
      const transaction = state.transaction
      const framework = input.replayCurrent
      const host = input.host
      const requestFor = host.requestFor
      const revalidate = host.revalidate
      const read = input.read
      const authorizeSources = input.authorizeSources
      const current = () => input.state === state && state.read === readState && state.transaction === transaction && input.host === host && host.requestFor === requestFor && host.revalidate === revalidate &&
        input.read === read && input.authorizeSources === authorizeSources && input.authorizeEditBasis === authorizeEditBasis && requestFor.call(host, context) === request && !request.signal.aborted
      const releaseReceipt = async (version: number, installedReview = false): Promise<PortResult<{ id: string; messageId: string; version: number }>> => {
        const loaded = await load(id, context)
        if (loaded.status !== "ok") return loaded
        if (!current() || !await revalidate.call(host, context) || !current() || installedReview && (input.replayCurrent !== framework || !framework?.()) || !sameThreadReadScope(prior, loaded.value.thread)) return { status: "denied", reason: "thread-access-unavailable" }
        if (!loaded.value.thread.messages.some((entry) => entry.id === message.id && entry.incarnation === message.incarnation && entry.version === version && entry.body === selected.body)) return { status: "stale", reason: "thread-content-changed" }
        return { status: "ok", value: { id, messageId, version } }
      }
      if (basis.reviewContext && prior.recipientRef === context.binding.principalRef && framework?.()) {
        const replay = await probeSfReviewMutationReceipt<number>(state, request, command, context, () => current() && input.replayCurrent === framework && framework())
        if (replay) {
          if ("reason" in replay) return replay
          if (replay.status !== "ok" || !Number.isSafeInteger(replay.value) || replay.value !== expectedVersion + 1) return { status: "unavailable", reason: "thread-read-unavailable" }
          return releaseReceipt(replay.value, true)
        }
      }
      const prepareReviewFence = input.prepareReviewThreadFence
      const prepareEditReceipt = input.prepareEditReceipt
      const checkReviewRecipient = input.checkReviewRecipientAtCommit
      const reviewFence = basis.reviewContext && prepareReviewFence ? await prepareReviewFence(basis, context) : undefined
      const ownReview = !!reviewFence && !!framework?.() && !!authorizeSources && prior.recipientRef === context.binding.principalRef
      if (basis.reviewContext && (!reviewFence || prior.recipientRef && (!checkReviewRecipient ||
        !ownReview && (!input.authorizeReviewRecipient || !await input.authorizeReviewRecipient(prior.recipientRef, basis, context))))) return { status: "unavailable", reason: "review-thread-source-fence-unavailable" }
      const priorDigest = digestSfValue(prior)
      const fence = await input.fence.prepare(async () => {
        if (ownReview) {
          if (!current() || input.replayCurrent !== framework || !framework?.() || !await revalidate.call(host, context)) return false
          const observed = await state.read(request, "threads", (stored, actor) =>
            actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision &&
            actor.policyVersion === context.binding.policyVersion ? digestSfValue(stored.threads[id]) : undefined)
          return current() && observed.status === "ok" && observed.value === priorDigest &&
            !!authorizeSources && await authorizeSelected() && current() && framework()
        }
        const observed = await load(id, context)
        return observed.status === "ok" && digestSfValue(observed.value.thread) === priorDigest && (!input.authorizeSources || await input.authorizeSources(basis, context))
      })
      if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      const revised = { ...prior, messages: prior.messages.map((entry) => entry.id === message.id ? { ...entry, body: selected.body, version: entry.version + 1, sourceContext: basis } : entry), messageRevisions: [...(prior.messageRevisions ?? []), message] }
      const installedCurrent = () => ownReview && current() && input.replayCurrent === framework && framework?.() === true &&
        input.prepareEditReceipt === prepareEditReceipt && input.prepareReviewThreadFence === prepareReviewFence
      const work = async (state: SfProductState, authority: SfStateAuthority) => {
        if (ownReview && !installedCurrent()) return { commit: false, value: 0 }
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.thread.edit", selected) || basis.reviewContext && (input.prepareReviewThreadFence !== prepareReviewFence || !reviewFence || !await reviewFence() || input.prepareReviewThreadFence !== prepareReviewFence || prior.recipientRef && (input.checkReviewRecipientAtCommit !== checkReviewRecipient || !checkReviewRecipient || !checkReviewRecipient(prior.recipientRef, basis, context) || input.checkReviewRecipientAtCommit !== checkReviewRecipient)) || !input.fence.check(fence) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || message.version !== selected.expectedVersion || prior.state !== "open") return { commit: false, value: 0 }
        if (ownReview && !installedCurrent()) return { commit: false, value: 0 }
        state.threads[id] = revised
        return { commit: true, value: message.version + 1 }
      }
      if (ownReview) stageSfReviewThreadWrite(work)
      input.threadHistoryWrites.add(work)
      const saved = await input.state.transaction(request, command, work).finally(() => input.threadHistoryWrites.delete(work))
      if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
      if ("reason" in saved) return saved
      if (!saved.value) return { status: "unavailable", reason: "thread-access-unavailable" }
      // A fresh installed self edit returns only its receipt. Reobserve its
      // entire committed row and its live source independently under a seal.
      const basisDigest = digestSfValue(basis)
      if (ownReview && reviewFence && prepareEditReceipt && saved.value === selected.expectedVersion + 1 &&
        [...prior.messages, ...(prior.messageRevisions ?? [])].every((entry) => digestSfValue(threadMessageContext(prior, entry)) === basisDigest)) {
        if (!installedCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
        const continuity = await prepareEditReceipt(prior, basis, context, installedCurrent)
        if (!installedCurrent() || !continuity) return { status: "denied", reason: "thread-access-unavailable" }
        if (continuity !== "reissue") {
          const confirmed = await captureReceipt({ questionId: id, threadDigest: digestSfValue(revised) }, async () =>
            installedCurrent() && continuity() && await reviewFence() && continuity() &&
            await revalidate.call(host, context) && installedCurrent(), request.signal)
          if (!confirmed || !await revalidate.call(host, context) || !installedCurrent()) return { status: "stale", reason: "thread-content-changed" }
          return { status: "ok", value: { id, messageId, version: saved.value } }
        }
      }
      return releaseReceipt(saved.value, ownReview)
    },
    readVersion: async (id: string, messageId: string, incarnation: string, version: number, context: TrustedDomainContext): Promise<PortResult<{ message: Message } & ThreadSourceContext>> => {
      const request = input.host.requestFor(context)
      const currentAccess = async () => !!request && input.host.requestFor(context) === request && await input.host.revalidate(context) && input.host.requestFor(context) === request
      try {
        if (typeof id !== "string" || !id.trim() || typeof messageId !== "string" || !messageId.trim() || typeof incarnation !== "string" || !incarnation.trim() || !Number.isSafeInteger(version) || version < 1) return { status: "needs-input", reason: "invalid-message-version" }
        const first = await load(id, context, true)
        if (first.status !== "ok") return first
        const matches = [...first.value.thread.messages, ...(first.value.thread.messageRevisions ?? [])].filter((message) => message.id === messageId && message.incarnation === incarnation && message.version === version)
        if (matches.length !== 1) return { status: "unavailable", reason: "thread-history-unavailable" }
        const basis = threadMessageContext(first.value.thread, matches[0]!)
        if (!basis) return { status: "unavailable", reason: "thread-history-unavailable" }
        if (input.authorizeSources && !await input.authorizeSources(basis, context) || !input.authorizeSources && digestSfValue(basis.evidenceRefs) !== digestSfValue(first.value.visible.evidenceRefs)) return { status: "denied", reason: "thread-history-unavailable" }
        const again = await load(id, context, true)
        if (again.status !== "ok") return again
        if (!sameThreadReadScope(first.value.thread, again.value.thread) || input.authorizeSources && !await input.authorizeSources(basis, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-history-unavailable" }
        if (digestSfValue(again.value.thread) !== digestSfValue(first.value.thread) || digestSfValue(again.value.visible.evidenceRefs) !== digestSfValue(first.value.visible.evidenceRefs)) return { status: "stale", reason: "thread-content-changed" }
        return { status: "ok", value: { message: matches[0]!, ...basis } }
      } catch {
        const authorized = await currentAccess().catch(() => undefined)
        if (authorized === false) return { status: "denied", reason: "thread-access-unavailable" }
        return { status: "unavailable", reason: "thread-read-unavailable" }
      }
    },
  }
}
