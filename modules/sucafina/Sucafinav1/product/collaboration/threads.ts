import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import { createRecipientCommitCheck } from "./recipient-authority.ts"
import type { CollaborationRecipientCommitCheck } from "./recipient-authority.ts"

export type CollaborationThread = {
  id: string
  kind: "comment" | "clarification" | "review"
  sourceRef: string
  sourceIncarnation: string
  observedVersion: number
  period: Period
  recipientRef?: string
  state: "open" | "resolved"
  messages: readonly { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string }[]
  evidenceRefs: readonly BusinessEvidenceRef[]
}
type Draft = Pick<CollaborationThread, "kind" | "sourceRef" | "sourceIncarnation" | "observedVersion" | "period" | "recipientRef" | "evidenceRefs"> & { body: string }
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

/** The host authorizes the source and recipient by identity without granting either new access. */
export function createThreadPort(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  creationTarget: { ref: string; incarnation: string }
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  authorize: (thread: Draft | CollaborationThread, context: TrustedDomainContext, mode: "read" | "write") => Promise<boolean>
  checkRecipientAtCommit?: CollaborationRecipientCommitCheck
  createId: () => string
  now: () => string
}) {
  const checkRecipient = input.checkRecipientAtCommit ?? createRecipientCommitCheck()
  return {
    create: async (draft: Draft, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-action-required" }
      if (!draft || !["comment", "clarification", "review"].includes(draft.kind) || typeof draft.sourceRef !== "string" || !draft.sourceRef.trim() || typeof draft.sourceIncarnation !== "string" || !draft.sourceIncarnation.trim() || !Number.isSafeInteger(draft.observedVersion) || draft.observedVersion < 1 || !isSfPeriod(draft.period) || typeof draft.body !== "string" || !draft.body.trim() || !Array.isArray(draft.evidenceRefs) || !draft.evidenceRefs.length || (draft.recipientRef !== undefined && (typeof draft.recipientRef !== "string" || !draft.recipientRef.trim())) || (draft.kind !== "comment" && !draft.recipientRef) || !validMutation(mutation)) return { status: "needs-input", reason: "invalid-thread" }
      const selected = structuredClone({ draft, mutation })
      const sources = selected.draft.evidenceRefs.filter((ref) => ref && typeof ref === "object" && ref.refId === selected.draft.sourceRef)
      const source = sources[0]
      if (sources.length !== 1 || !source || source.kind !== "record" || !source.target || typeof source.target !== "object" || source.target.incarnation !== selected.draft.sourceIncarnation || source.target.version !== selected.draft.observedVersion || (!isSfPeriod(source.target.period) || source.target.period.start > selected.draft.period.start || source.target.period.end < selected.draft.period.end)) return { status: "needs-input", reason: "thread-source-mismatch" }
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.thread.create", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
      const fence = await input.mutationFence.prepare(() => input.authorize(structuredClone(selected.draft), context, "write"))
      if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      const thread: CollaborationThread = { id: input.createId(), kind: selected.draft.kind, sourceRef: selected.draft.sourceRef, sourceIncarnation: selected.draft.sourceIncarnation, observedVersion: selected.draft.observedVersion, period: selected.draft.period, ...(selected.draft.recipientRef ? { recipientRef: selected.draft.recipientRef } : {}), state: "open", messages: [{ id: input.createId(), incarnation: input.createId(), version: 1, authorRef: context.binding.principalRef, body: selected.draft.body, createdAt: input.now() }], evidenceRefs: selected.draft.evidenceRefs }
      if (!thread.id.trim() || !thread.messages[0]?.id.trim() || !thread.messages[0]?.incarnation.trim()) return { status: "unavailable", reason: "identity-unavailable" }
      const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, commandDigest: digestSfValue(selected.draft), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.thread.create", selected) || !input.mutationFence.check(fence) || selected.draft.recipientRef && !checkRecipient(selected.draft.recipientRef, selected.draft.evidenceRefs, context) || state.threads[thread.id]) return { commit: false, value: null }
        state.threads[thread.id] = thread
        return { commit: true, value: thread }
      })
      if (saved.status === "preview") return { status: "conflict", reason: "thread-not-committed" }
      if ("reason" in saved) return saved
      if (!saved.value || !await input.host.revalidate(context) || !await input.authorize(saved.value, context, "read")) return { status: "unavailable", reason: "thread-access-unavailable" }
      return { status: "ok", value: publicThreadProjection(saved.value) }
    },
    reply: (id: string, body: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "reply", body }, mutation, context),
    resolve: (id: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "resolve" }, mutation, context),
    read: async (id: string, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
      if (typeof id !== "string" || !id.trim()) return { status: "needs-input", reason: "invalid-thread-reference" }
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
      const read = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
      if (read.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
      if ("reason" in read) return read
      if (!isThread(read.value) || read.value.id !== id || !await input.authorize(read.value, context, "read") || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
      const again = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
      if (again.status !== "ok" || !isThread(again.value) || again.value.id !== id || digestSfValue(again.value) !== digestSfValue(read.value) || !await input.authorize(again.value, context, "read") || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
      return { status: "ok", value: publicThreadProjection(read.value) }
    },
  }

  async function change(id: string, action: { kind: "reply"; body: string } | { kind: "resolve" }, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> {
    if (context.kind !== "ui") return { status: "denied", reason: "human-action-required" }
    if (typeof id !== "string" || !id.trim() || !validMutation(mutation) || (action.kind === "reply" && (typeof action.body !== "string" || !action.body.trim()))) return { status: "needs-input", reason: "invalid-thread-action" }
    const selected = structuredClone({ action, mutation })
    const humanAction = selected.action.kind === "reply" ? "collaboration.thread.reply" : "collaboration.thread.resolve"
    const payload = selected.action.kind === "reply" ? { id, body: selected.action.body, mutation: selected.mutation } : { id, mutation: selected.mutation }
    const request = input.host.requestFor(context)
    if (!request || !await input.human.authorize(context, humanAction, payload) || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
    const read = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    if (read.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
    if ("reason" in read) return read
    if (!isThread(read.value) || read.value.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const prior = read.value
    const fence = await input.mutationFence.prepare(() => input.authorize(structuredClone(prior), context, "write"))
    if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
    const messageId = selected.action.kind === "reply" ? input.createId() : undefined
    const incarnation = selected.action.kind === "reply" ? input.createId() : undefined
    if (selected.action.kind === "reply" && (!messageId?.trim() || !incarnation?.trim() || prior.messages.some((message) => message.id === messageId || message.incarnation === incarnation))) return { status: "unavailable", reason: "identity-unavailable" }
    const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, commandDigest: digestSfValue({ id, action: selected.action }), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, humanAction, payload) || !input.mutationFence.check(fence) || prior.recipientRef && !checkRecipient(prior.recipientRef, prior.evidenceRefs, context) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || prior.state !== "open") return { commit: false, value: null }
      const next: CollaborationThread = selected.action.kind === "reply" ? { ...prior, messages: [...prior.messages, { id: messageId!, incarnation: incarnation!, version: 1, authorRef: context.binding.principalRef, body: selected.action.body, createdAt: input.now() }] } : { ...prior, state: "resolved" }
      state.threads[id] = next
      return { commit: true, value: next }
    })
    if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
    if ("reason" in saved) return saved
    if (!saved.value || !await input.host.revalidate(context) || !await input.authorize(saved.value, context, "read")) return { status: "unavailable", reason: "thread-access-unavailable" }
    return { status: "ok", value: publicThreadProjection(saved.value) }
  }
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
    messages: thread.messages.map(({ id, incarnation, version, authorRef, body, createdAt }) => ({ id, incarnation, version, authorRef, body, createdAt })),
    evidenceRefs: thread.evidenceRefs,
  }
}

function validMutation(value: Mutation) {
  return !!value && Number.isSafeInteger(value.expectedStorageVersion) && value.expectedStorageVersion >= 0 && typeof value.idempotencyKey === "string" && !!value.idempotencyKey.trim()
}

export function isThread(value: unknown): value is CollaborationThread {
  if (!value || typeof value !== "object") return false
  const thread = value as Record<string, unknown>
  if (typeof thread.id !== "string" || !thread.id.trim() || typeof thread.sourceRef !== "string" || !thread.sourceRef.trim() || typeof thread.sourceIncarnation !== "string" || !thread.sourceIncarnation.trim() || !["comment", "clarification", "review"].includes(String(thread.kind)) || !["open", "resolved"].includes(String(thread.state)) || !Number.isSafeInteger(thread.observedVersion) || Number(thread.observedVersion) < 1 || !isSfPeriod(thread.period) || !Array.isArray(thread.messages) || !thread.messages.length || !Array.isArray(thread.evidenceRefs) || !thread.evidenceRefs.length || (thread.recipientRef !== undefined && (typeof thread.recipientRef !== "string" || !thread.recipientRef.trim())) || (thread.kind !== "comment" && !thread.recipientRef)) return false
  const sources = thread.evidenceRefs.filter((ref: unknown) => !!ref && typeof ref === "object" && "refId" in ref && ref.refId === thread.sourceRef)
  const source = sources[0] as Extract<BusinessEvidenceRef, { kind: "record" }> | undefined
  if (sources.length !== 1 || !source || source.kind !== "record" || !source.target || source.target.incarnation !== thread.sourceIncarnation || source.target.version !== thread.observedVersion || !isSfPeriod(source.target.period) || source.target.period.start > thread.period.start || source.target.period.end < thread.period.end) return false
  return thread.messages.every((value: unknown) => {
    if (!value || typeof value !== "object") return false
    const message = value as Record<string, unknown>
    return [message.id, message.incarnation, message.authorRef, message.body, message.createdAt].every((part) => typeof part === "string" && !!part.trim()) && Number.isSafeInteger(message.version) && Number(message.version) > 0
  }) && new Set(thread.messages.map((message: unknown) => (message as Record<string, unknown>).id)).size === thread.messages.length && new Set(thread.messages.map((message: unknown) => (message as Record<string, unknown>).incarnation)).size === thread.messages.length
}

