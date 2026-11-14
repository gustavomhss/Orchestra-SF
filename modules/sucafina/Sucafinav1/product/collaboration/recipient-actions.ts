import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfProductState, SfStateAuthority, SfStateResult } from "../contracts/state.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { RecipientThread, createRecipientThreadReader } from "./recipient-thread.ts"
import { isThread } from "./threads.ts"
import { validThreadSourceContext } from "./thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"
import type { AnswerWork } from "./answer-work.ts"
import type { PrepareReviewThreadFence } from "./review-source-fence.ts"

type Mutation = { expectedStorageVersion: number; idempotencyKey: string }
export type RecipientMutationReceipt = {
  kind: "recipient-thread-action-v1"
  threadId: string
  principalRef: string
  idempotencyKey: string
  commandDigest: string
  intentDigest: string
  sourceIncarnation: string
} & ({ action: "reply"; reply: { id: string; incarnation: string; version: number } } | { action: "resolve" })
export type RecipientMutationResult = PortResult<RecipientThread & { mutationReceipt: RecipientMutationReceipt }>

/** The protected historical thread remains unchanged except for the explicitly admitted action. */
export function createRecipientThreadActions(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  read: ReturnType<typeof createRecipientThreadReader>
  prepareReviewThreadFence?: PrepareReviewThreadFence
  authorizeReviewRecipient?: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext, requireSelfLease?: boolean) => Promise<boolean>
  checkReviewRecipientAtCommit?: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext, requireSelfLease?: boolean) => boolean
  answerWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<AnswerWork>>
  creationTarget: { ref: string; incarnation: string }
  createId: () => string
  now: () => string
}) {
  const change = async (id: string, action: { kind: "reply"; body: string } | { kind: "resolve" }, mutation: Mutation, context: TrustedDomainContext): Promise<RecipientMutationResult> => {
    if (context.kind !== "ui" || typeof id !== "string" || !id.trim() || !mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim() || (action.kind === "reply" && (typeof action.body !== "string" || !action.body.trim()))) return { status: "denied", reason: "human-action-required" }
    const selected = structuredClone({ id, action, mutation })
    const humanAction = selected.action.kind === "reply" ? "collaboration.thread.reply" : "collaboration.thread.resolve"
    const payload = selected.action.kind === "reply" ? { id: selected.id, body: selected.action.body, mutation: selected.mutation } : { id: selected.id, mutation: selected.mutation }
    const commandDigest = digestSfValue({ id, action: selected.action })
    const intentDigest = digestSfValue(payload)
    const request = input.host.requestFor(context)
    if (!request || !await input.human.authorize(context, humanAction, payload) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
    const projected = await input.read(id, context)
    if (projected.status !== "ok" || projected.value.recipientRef !== context.binding.principalRef && !projected.value.messages.some((message) => message.authorRef === context.binding.principalRef)) return { status: "unavailable", reason: "thread-access-unavailable" }
    const stored = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? { thread: state.threads[id], replay: Object.hasOwn(state.transactions, JSON.stringify([context.binding.principalRef, "threads", input.creationTarget.ref, selected.mutation.idempotencyKey])) } : undefined)
    if (stored.status !== "ok" || !stored.value || !isThread(stored.value.thread) || stored.value.thread.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const prior = stored.value.thread
    if (digestSfValue({ id: prior.id, kind: prior.kind, recipientRef: prior.recipientRef, state: prior.state, messages: prior.messages, version: prior.observedVersion, period: prior.period }) !== digestSfValue({ id: projected.value.id, kind: projected.value.kind, recipientRef: projected.value.recipientRef, state: projected.value.state, messages: projected.value.messages, version: projected.value.observed.version, period: projected.value.observed.period })) return { status: "stale", reason: "thread-changed" }
    const original = prior.evidenceRefs.find((ref) => ref.refId === prior.sourceRef)
    const reviewBasis = prior.messages[0]?.sourceContext?.reviewContext ? prior.messages[0].sourceContext : undefined
    const review = reviewBasis ? await input.state.read(request, "reviews", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion) : undefined
    if (reviewBasis && (review?.status !== "ok" || !review.value)) return { status: "denied", reason: "review-thread-context-unavailable" }
    const transaction = { namespace: "threads" as const, ...selected.mutation, ...(review?.status === "ok" ? { sourceFence: "all" as const, checkNamespaces: [{ namespace: "reviews" as const, expectedStorageVersion: review.storageVersion }] } : {}), commandDigest, targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }
    const prepareReviewFence = input.prepareReviewThreadFence
    const authorizeReviewRecipient = input.authorizeReviewRecipient
    const checkReviewRecipient = input.checkReviewRecipientAtCommit
    const reviewRecipients = reviewBasis ? [...new Set([context.binding.principalRef, ...(prior.recipientRef ? [prior.recipientRef] : [])])] : []
    const reviewFence = reviewBasis && prepareReviewFence ? await prepareReviewFence(reviewBasis, context) : undefined
    if (reviewBasis && (!reviewFence || !authorizeReviewRecipient || !checkReviewRecipient || !(await Promise.all(reviewRecipients.map((recipient) => authorizeReviewRecipient(recipient, reviewBasis, context, true)))).every(Boolean))) return { status: "unavailable", reason: "review-thread-source-fence-unavailable" }
    const finish = async (saved: SfStateResult<RecipientMutationReceipt | null>): Promise<RecipientMutationResult> => {
      if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
      if ("reason" in saved) return saved
      const outcome: unknown = saved.value
      // A legacy boolean or thread snapshot cannot identify this mutation.
      if (!isRecipientMutationReceipt(outcome) || outcome.threadId !== id || outcome.principalRef !== context.binding.principalRef || outcome.idempotencyKey !== selected.mutation.idempotencyKey || outcome.commandDigest !== commandDigest || outcome.action !== selected.action.kind) return { status: "unavailable", reason: "thread-mutation-receipt-unavailable" }
      if (outcome.intentDigest !== intentDigest) return { status: "conflict", reason: "idempotency-content-changed" }
      const host = input.host
      const persistence = host.persistence
      const transactionAll = persistence.transactionAll
      const read = input.read
      const human = input.human
      const authorizeHuman = human.authorize
      const revalidate = host.revalidate
      const requestFor = host.requestFor
      const mutationFence = input.mutationFence
      const prepare = mutationFence.prepare
      const check = mutationFence.check
      const unchanged = () => input.host === host && host.persistence === persistence && persistence.transactionAll === transactionAll && input.read === read && input.human === human && human.authorize === authorizeHuman && host.revalidate === revalidate && host.requestFor === requestFor && requestFor.call(host, context) === request && !request.signal.aborted && input.mutationFence === mutationFence && mutationFence.prepare === prepare && mutationFence.check === check && input.prepareReviewThreadFence === prepareReviewFence && input.authorizeReviewRecipient === authorizeReviewRecipient && input.checkReviewRecipientAtCommit === checkReviewRecipient
      if (!transactionAll || !unchanged()) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      // Pin physical sources before the final reader; the release below checks
      // the same sources, exact thread and review ACL under protected snapshots.
      const releaseFence = await prepare.call(mutationFence, async () => unchanged())
      if (!releaseFence || !unchanged()) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      const current = await read(id, context)
      if (current.status !== "ok") return current
      if (current.value.id !== id) return { status: "unavailable", reason: "thread-mutation-receipt-unavailable" }
      if (selected.action.kind === "reply") {
        if (outcome.action !== "reply") return { status: "unavailable", reason: "thread-mutation-receipt-unavailable" }
        const matches = current.value.messages.filter((message) => message.id === outcome.reply.id && message.incarnation === outcome.reply.incarnation && message.version === outcome.reply.version)
        // Identity selects the result. Text and author only verify that exact version.
        if (matches.length !== 1 || matches[0]!.body !== selected.action.body || matches[0]!.authorRef !== outcome.principalRef || matches[0]!.sourceContext?.sourceIncarnation !== outcome.sourceIncarnation) return { status: "unavailable", reason: "thread-mutation-receipt-unavailable" }
      }
      const released = await transactionAll.call(persistence, async (snapshots) => {
        if (!unchanged() || !await authorizeHuman.call(human, context, humanAction, payload) || !unchanged() || !await revalidate.call(host, context) || !unchanged()) return { commit: false, value: false }
        if (reviewBasis && (!reviewFence || !await reviewFence() || !unchanged() || !checkReviewRecipient || !reviewRecipients.every((recipient) => checkReviewRecipient(recipient, reviewBasis, context, true)))) return { commit: false, value: false }
        const product = object(snapshots.dashboard.data.__sfProductV1)
        const thread = object(product.threads)[id]
        const durable = object(object(product.transactions)[JSON.stringify([context.binding.principalRef, "threads", transaction.targetRef, selected.mutation.idempotencyKey])])
        const sameThread = isThread(thread) && digestSfValue({ id: thread.id, kind: thread.kind, recipientRef: thread.recipientRef, state: thread.state, messages: thread.messages, version: thread.observedVersion, period: thread.period }) === digestSfValue({ id: current.value.id, kind: current.value.kind, recipientRef: current.value.recipientRef, state: current.value.state, messages: current.value.messages, version: current.value.observed.version, period: current.value.observed.period })
        return { commit: false, value: unchanged() && check.call(mutationFence, releaseFence) && sameThread && digestSfValue(durable.value) === digestSfValue(outcome) }
      }, { signal: request.signal })
      if (!released || !unchanged()) return { status: "denied", reason: "thread-access-unavailable" }
      return { status: "ok", value: { ...current.value, mutationReceipt: outcome } }
    }
    if (stored.value.replay) {
      // Recovery still passes through C08: it authenticates the target, actor,
      // scope and command before returning the original durable value. The
      // callback cannot append if the observed receipt disappears meanwhile.
      return finish(await input.state.transaction<RecipientMutationReceipt | null>(request, transaction, async () => ({ commit: false, value: null })))
    }
    const currentPeriod = projected.value.current.sourceRef.target.period
    const rollover = !reviewBasis && !!projected.value.historical && original?.kind === "record" && !!currentPeriod && digestSfValue(original.target.period) !== digestSfValue(currentPeriod)
    const answer = prior.state === "resolved" && selected.action.kind === "reply" && !rollover && input.answerWork ? await input.answerWork(id, context) : undefined
    const reopen = prior.state === "resolved" && selected.action.kind === "reply" && prior.recipientRef === context.binding.principalRef && (rollover || answer?.status === "ok" && answer.value.state === "stale")
    if (prior.state !== "open" && !reopen) return { status: "conflict", reason: "thread-resolved" }
    const period = currentPeriod && (currentPeriod.start > prior.period.start || currentPeriod.end < prior.period.end) ? currentPeriod : prior.period
    const basis: ThreadSourceContext = reviewBasis ? structuredClone(reviewBasis) : { sourceRef: projected.value.current.sourceRef.refId, sourceIncarnation: projected.value.current.sourceRef.target.incarnation, observedVersion: projected.value.current.sourceRef.target.version, period, evidenceRefs: projected.value.current.evidenceRefs }
    if (!validThreadSourceContext(basis)) return { status: "unavailable", reason: "thread-source-unavailable" }
    const fence = await input.mutationFence.prepare(async () => {
      const current = await input.read(id, context)
      if (current.status !== "ok" || digestSfValue(current.value.current) !== digestSfValue(projected.value.current) || digestSfValue({ id: current.value.id, kind: current.value.kind, recipientRef: current.value.recipientRef, state: current.value.state, messages: current.value.messages, version: current.value.observed.version, period: current.value.observed.period }) !== digestSfValue({ id: prior.id, kind: prior.kind, recipientRef: prior.recipientRef, state: prior.state, messages: prior.messages, version: prior.observedVersion, period: prior.period })) return false
      const stillPending = reopen && !rollover && input.answerWork ? await input.answerWork(id, context) : undefined
      return !reopen || rollover && !!current.value.historical || stillPending?.status === "ok" && stillPending.value.state === "stale" && answer?.status === "ok" && digestSfValue(stillPending.value) === digestSfValue(answer.value)
    })
    if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
    const messageId = selected.action.kind === "reply" ? input.createId() : undefined
    const incarnation = selected.action.kind === "reply" ? input.createId() : undefined
    if (selected.action.kind === "reply" && (!messageId?.trim() || !incarnation?.trim() || prior.messages.some((message) => message.id === messageId || message.incarnation === incarnation))) return { status: "unavailable", reason: "identity-unavailable" }
    const message = selected.action.kind === "reply" ? { id: messageId!, incarnation: incarnation!, version: 1, authorRef: context.binding.principalRef, body: selected.action.body, createdAt: input.now(), sourceContext: basis } : undefined
    const next = message ? { ...prior, state: "open" as const, messages: [...prior.messages, message] } : { ...prior, state: "resolved" as const }
    if (!isThread(next)) return { status: "unavailable", reason: "thread-source-context-invalid" }
    const receipt: RecipientMutationReceipt = {
      kind: "recipient-thread-action-v1", threadId: id, principalRef: context.binding.principalRef,
      idempotencyKey: selected.mutation.idempotencyKey, commandDigest, intentDigest,
      sourceIncarnation: basis.sourceIncarnation,
      ...(message ? { action: "reply", reply: { id: message.id, incarnation: message.incarnation, version: message.version } } : { action: "resolve" }),
    }
    const work = async (state: SfProductState, authority: SfStateAuthority): Promise<{ commit: boolean; value: RecipientMutationReceipt | null }> => {
      if (!await input.human.authorize(context, humanAction, payload)) return { commit: false, value: null }
      if (reviewBasis && (input.prepareReviewThreadFence !== prepareReviewFence || !reviewFence || !await reviewFence() || input.prepareReviewThreadFence !== prepareReviewFence || input.authorizeReviewRecipient !== authorizeReviewRecipient || input.checkReviewRecipientAtCommit !== checkReviewRecipient || !checkReviewRecipient || !reviewRecipients.every((recipient) => checkReviewRecipient(recipient, reviewBasis, context, true)) || input.checkReviewRecipientAtCommit !== checkReviewRecipient)) return { commit: false, value: null }
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !input.mutationFence.check(fence) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || prior.state !== "open" && !reopen || !isThread(next)) return { commit: false, value: null }
      if (reopen) state.threads[`sf:thread-resolution-history:${digestSfValue(prior)}`] = { kind: "thread-resolution-history-v1", messages: [{ resolution: structuredClone(prior) }] }
      state.threads[id] = next
      return { commit: true, value: receipt }
    }
    return finish(await input.state.transaction(request, transaction, work))
  }
  return {
    reply: (id: string, body: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "reply", body }, mutation, context),
    resolve: (id: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "resolve" }, mutation, context),
  }
}

function isRecipientMutationReceipt(value: unknown): value is RecipientMutationReceipt {
  if (!value || typeof value !== "object") return false
  const receipt = value as Record<string, unknown>
  if (receipt.kind !== "recipient-thread-action-v1" || ![receipt.threadId, receipt.principalRef, receipt.idempotencyKey, receipt.sourceIncarnation].every((part) => typeof part === "string" && !!part.trim()) || ![receipt.commandDigest, receipt.intentDigest].every((part) => typeof part === "string" && /^[a-f0-9]{64}$/.test(part))) return false
  if (receipt.action === "resolve") return receipt.reply === undefined
  if (receipt.action !== "reply" || !receipt.reply || typeof receipt.reply !== "object") return false
  const reply = receipt.reply as Record<string, unknown>
  return [reply.id, reply.incarnation].every((part) => typeof part === "string" && !!part.trim()) && Number.isSafeInteger(reply.version) && Number(reply.version) > 0
}
