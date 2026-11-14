import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfProductState, SfStateAuthority } from "../contracts/state.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { RecipientThread, createRecipientThreadReader } from "./recipient-thread.ts"
import { isThread } from "./threads.ts"
import { validThreadSourceContext } from "./thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"
import type { AnswerWork } from "./answer-work.ts"

type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

/** The protected historical thread remains unchanged except for the explicitly admitted action. */
export function createRecipientThreadActions(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  read: ReturnType<typeof createRecipientThreadReader>
  answerWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<AnswerWork>>
  creationTarget: { ref: string; incarnation: string }
  createId: () => string
  now: () => string
}) {
  const change = async (id: string, action: { kind: "reply"; body: string } | { kind: "resolve" }, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<RecipientThread>> => {
    if (context.kind !== "ui" || typeof id !== "string" || !id.trim() || !mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim() || (action.kind === "reply" && (typeof action.body !== "string" || !action.body.trim()))) return { status: "denied", reason: "human-action-required" }
    const selected = structuredClone({ id, action, mutation })
    const humanAction = selected.action.kind === "reply" ? "collaboration.thread.reply" : "collaboration.thread.resolve"
    const payload = selected.action.kind === "reply" ? { id: selected.id, body: selected.action.body, mutation: selected.mutation } : { id: selected.id, mutation: selected.mutation }
    const request = input.host.requestFor(context)
    if (!request || !await input.human.authorize(context, humanAction, payload) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
    const projected = await input.read(id, context)
    if (projected.status !== "ok" || projected.value.recipientRef !== context.binding.principalRef && !projected.value.messages.some((message) => message.authorRef === context.binding.principalRef)) return { status: "unavailable", reason: "thread-access-unavailable" }
    const stored = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    if (stored.status !== "ok" || !isThread(stored.value) || stored.value.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const prior = stored.value
    if (digestSfValue({ id: prior.id, kind: prior.kind, recipientRef: prior.recipientRef, state: prior.state, messages: prior.messages, version: prior.observedVersion, period: prior.period }) !== digestSfValue({ id: projected.value.id, kind: projected.value.kind, recipientRef: projected.value.recipientRef, state: projected.value.state, messages: projected.value.messages, version: projected.value.observed.version, period: projected.value.observed.period })) return { status: "stale", reason: "thread-changed" }
    const original = prior.evidenceRefs.find((ref) => ref.refId === prior.sourceRef)
    const reviewBasis = prior.messages[0]?.sourceContext?.reviewContext ? prior.messages[0].sourceContext : undefined
    const currentPeriod = projected.value.current.sourceRef.target.period
    const rollover = !reviewBasis && !!projected.value.historical && original?.kind === "record" && !!currentPeriod && digestSfValue(original.target.period) !== digestSfValue(currentPeriod)
    const answer = prior.state === "resolved" && selected.action.kind === "reply" && !rollover && input.answerWork ? await input.answerWork(id, context) : undefined
    const reopen = prior.state === "resolved" && selected.action.kind === "reply" && prior.recipientRef === context.binding.principalRef && (rollover || answer?.status === "ok" && answer.value.state === "stale")
    if (prior.state !== "open" && !reopen) return { status: "conflict", reason: "thread-resolved" }
    const period = currentPeriod && (currentPeriod.start > prior.period.start || currentPeriod.end < prior.period.end) ? currentPeriod : prior.period
    const basis: ThreadSourceContext = reviewBasis ? structuredClone(reviewBasis) : { sourceRef: projected.value.current.sourceRef.refId, sourceIncarnation: projected.value.current.sourceRef.target.incarnation, observedVersion: projected.value.current.sourceRef.target.version, period, evidenceRefs: projected.value.current.evidenceRefs }
    if (!validThreadSourceContext(basis)) return { status: "unavailable", reason: "thread-source-unavailable" }
    const review = reviewBasis ? await input.state.read(request, "reviews", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion) : undefined
    if (reviewBasis && (review?.status !== "ok" || !review.value)) return { status: "denied", reason: "review-thread-context-unavailable" }
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
    const work = async (state: SfProductState, authority: SfStateAuthority) => {
      const reviewed = reviewBasis ? await input.read(id, context) : undefined
      if (reviewBasis && (reviewed?.status !== "ok" || digestSfValue(reviewed.value.messages) !== digestSfValue(prior.messages))) return { commit: false, value: false }
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, humanAction, payload) || !input.mutationFence.check(fence) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || prior.state !== "open" && !reopen || !isThread(next)) return { commit: false, value: false }
      if (reopen) state.threads[`sf:thread-resolution-history:${digestSfValue(prior)}`] = { kind: "thread-resolution-history-v1", messages: [{ resolution: structuredClone(prior) }] }
      state.threads[id] = next
      return { commit: true, value: true }
    }
    const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, ...(review?.status === "ok" ? { sourceFence: "all" as const, checkNamespaces: [{ namespace: "reviews" as const, expectedStorageVersion: review.storageVersion }] } : {}), commandDigest: digestSfValue({ id, action: selected.action }), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, work)
    if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
    if ("reason" in saved) return saved
    if (!saved.value) return { status: "conflict", reason: "thread-changed" }
    return input.read(id, context)
  }
  return {
    reply: (id: string, body: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "reply", body }, mutation, context),
    resolve: (id: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "resolve" }, mutation, context),
  }
}


