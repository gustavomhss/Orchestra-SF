import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort, SfProductState, SfStateAuthority } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { createRecipientAwareThreadReads } from "./thread-reads.ts"
import { isThread } from "./threads.ts"
import type { CollaborationThread } from "./threads.ts"
import { threadMessageContext } from "./thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"

type Message = CollaborationThread["messages"][number]
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }
type RevisionThread = CollaborationThread & { messageRevisions?: readonly Message[] }

/** Historical content stays with the canonical thread and is shown only under current source access. */
export function createThreadHistory(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  read: ReturnType<typeof createRecipientAwareThreadReads>["read"]
  readHistorical?: ReturnType<typeof createRecipientAwareThreadReads>["readHistorical"]
  authorizeSources?: (basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  human: CollaborationHumanAuthority
  fence: CollaborationMutationFence
  target: { ref: string; incarnation: string }
  threadHistoryWrites: WeakSet<object>
}) {
  const load = async (id: string, context: TrustedDomainContext, historical = false): Promise<PortResult<{ thread: RevisionThread; visible: CollaborationThread }>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
    const visible = await (historical && input.readHistorical ? input.readHistorical : input.read)(id, context)
    if (visible.status !== "ok") return visible
    const raw = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    if (raw.status !== "ok" || !isThread(raw.value) || raw.value.id !== id || digestSfValue(raw.value.messages) !== digestSfValue(visible.value.messages) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
    const thread = raw.value as RevisionThread
    if (thread.messageRevisions !== undefined && (!Array.isArray(thread.messageRevisions) || thread.messageRevisions.some((message) => !message || typeof message.id !== "string" || typeof message.incarnation !== "string" || !Number.isSafeInteger(message.version) || message.version < 1 || typeof message.body !== "string" || typeof message.authorRef !== "string" || typeof message.createdAt !== "string"))) return { status: "unavailable", reason: "thread-history-unavailable" }
    return { status: "ok", value: { thread, visible: visible.value } }
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
      if (!basis || input.authorizeSources && !await input.authorizeSources(basis, context)) return { status: "unavailable", reason: "thread-history-unavailable" }
      const fence = await input.fence.prepare(async () => {
        const current = await load(id, context)
        return current.status === "ok" && digestSfValue(current.value.thread) === digestSfValue(prior) && (!input.authorizeSources || await input.authorizeSources(basis, context))
      })
      if (!fence) return { status: "unavailable", reason: "thread-source-fence-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.thread.edit", selected) || !input.fence.check(fence) || digestSfValue(state.threads[id]) !== digestSfValue(prior) || message.version !== selected.expectedVersion || prior.state !== "open") return { commit: false, value: 0 }
        state.threads[id] = { ...prior, messages: prior.messages.map((entry) => entry.id === message.id ? { ...entry, body: selected.body, version: entry.version + 1, sourceContext: basis } : entry), messageRevisions: [...(prior.messageRevisions ?? []), message] }
        return { commit: true, value: message.version + 1 }
      }
      input.threadHistoryWrites.add(work)
      const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, commandDigest: digestSfValue({ id, messageId, expectedVersion, body }), targetRef: input.target.ref, targetIncarnation: input.target.incarnation }, work).finally(() => input.threadHistoryWrites.delete(work))
      if (saved.status === "preview") return { status: "conflict", reason: "thread-changed" }
      if (saved.status !== "ok" || !saved.value) return { status: "unavailable", reason: "thread-access-unavailable" }
      const current = await load(id, context)
      if (current.status !== "ok" || !current.value.thread.messages.some((entry) => entry.id === message.id && entry.incarnation === message.incarnation && entry.version === saved.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
      return { status: "ok", value: { id, messageId, version: saved.value } }
    },
    readVersion: async (id: string, messageId: string, incarnation: string, version: number, context: TrustedDomainContext): Promise<PortResult<{ message: Message } & ThreadSourceContext>> => {
      if (typeof id !== "string" || !id.trim() || typeof messageId !== "string" || !messageId.trim() || typeof incarnation !== "string" || !incarnation.trim() || !Number.isSafeInteger(version) || version < 1) return { status: "needs-input", reason: "invalid-message-version" }
      const first = await load(id, context, true)
      if (first.status !== "ok") return first
      const matches = [...first.value.thread.messages, ...(first.value.thread.messageRevisions ?? [])].filter((message) => message.id === messageId && message.incarnation === incarnation && message.version === version)
      if (matches.length !== 1) return { status: "unavailable", reason: "thread-history-unavailable" }
      const basis = threadMessageContext(first.value.thread, matches[0]!)
      if (!basis || input.authorizeSources && !await input.authorizeSources(basis, context) || !input.authorizeSources && digestSfValue(basis.evidenceRefs) !== digestSfValue(first.value.visible.evidenceRefs)) return { status: "unavailable", reason: "thread-history-unavailable" }
      const again = await load(id, context, true)
      if (again.status !== "ok" || digestSfValue(again.value.thread) !== digestSfValue(first.value.thread) || digestSfValue(again.value.visible.evidenceRefs) !== digestSfValue(first.value.visible.evidenceRefs) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-history-unavailable" }
      if (input.authorizeSources && !await input.authorizeSources(basis, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-history-unavailable" }
      return { status: "ok", value: { message: matches[0]!, ...basis } }
    },
  }
}


