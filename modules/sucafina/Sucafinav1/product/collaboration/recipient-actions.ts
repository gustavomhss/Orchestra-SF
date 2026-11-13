import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { RecipientThread, createRecipientThreadReader } from "./recipient-thread.ts"
import { isThread } from "./threads.ts"

type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

/** The protected historical thread remains unchanged except for the explicitly admitted action. */
export function createRecipientThreadActions(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  read: ReturnType<typeof createRecipientThreadReader>
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
    if (projected.status !== "ok" || projected.value.recipientRef !== context.binding.principalRef) return { status: "unavailable", reason: "thread-access-unavailable" }
    const stored = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    if (stored.status !== "ok" || !isThread(stored.value) || stored.value.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const prior = stored.value
    if (prior.recipientRef !== context.binding.principalRef || digestSfValue({ id: prior.id, kind: prior.kind, recipientRef: prior.recipientRef, state: prior.state, messages: prior.messages, version: prior.observedVersion, period: prior.period }) !== digestSfValue({ id: projected.value.id, kind: projected.value.kind, recipientRef: projected.value.recipientRef, state: projected.value.state, messages: projected.value.messages, version: projected.value.observed.version, period: projected.value.observed.period })) return { status: "stale", reason: "thread-changed" }
    const fence = await input.mutationFence.prepare(async () => {
      const current = await input.read(id, context)
      return current.status === "ok" && current.value.recipientRef === context.binding.principalRef && digestSfValue({ id: current.value.id, kind: current.value.kind, recipientRef: current.value.recipientRef, state: current.value.state, messages: current.value.messages, version: current.value.observed.version, period: current.value.observed.period }) === digestSfValue({ id: prior.id, kind: prior.kind, recipientRef: prior.recipientRef, state: prior.state, messages: prior.messages, version: prior.observedVersion, period: prior.period })
    })
    if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
    const messageId = selected.action.kind === "reply" ? input.createId() : undefined
    const incarnation = selected.action.kind === "reply" ? input.createId() : undefined
    if (selected.action.kind === "reply" && (!messageId?.trim() || !incarnation?.trim() || prior.messages.some((message) => message.id === messageId || message.incarnation === incarnation))) return { status: "unavailable", reason: "identity-unavailable" }
    const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, commandDigest: digestSfValue({ id, action: selected.action }), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, humanAction, payload) || !input.mutationFence.check(fence) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || prior.state !== "open") return { commit: false, value: false }
      state.threads[id] = selected.action.kind === "reply" ? { ...prior, messages: [...prior.messages, { id: messageId!, incarnation: incarnation!, version: 1, authorRef: context.binding.principalRef, body: selected.action.body, createdAt: input.now() }] } : { ...prior, state: "resolved" }
      return { commit: true, value: true }
    })
    if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
    if (saved.status !== "ok") return saved
    if (!saved.value) return { status: "conflict", reason: "thread-changed" }
    return input.read(id, context)
  }
  return {
    reply: (id: string, body: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "reply", body }, mutation, context),
    resolve: (id: string, mutation: Mutation, context: TrustedDomainContext) => change(id, { kind: "resolve" }, mutation, context),
  }
}

