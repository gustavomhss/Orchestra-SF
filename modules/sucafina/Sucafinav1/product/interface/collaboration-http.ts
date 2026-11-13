import type { createCollaborationHost } from "../collaboration/host.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"

type Host = ReturnType<typeof createCollaborationHost>
type HumanAction = "collaboration.relation.confirm" | "collaboration.handoff.confirm" | "collaboration.thread.create" | "collaboration.thread.reply" | "collaboration.thread.resolve" | "collaboration.thread.edit" | "collaboration.confirmation.confirm" | "collaboration.answer.confirm" | "collaboration.selection.create"
type ReadAction = "work-list" | "work-destination" | "relation-read" | "thread-read" | "thread-history" | "confirmation-prepare" | "confirmation-inspect" | "answer-evidence" | "answer-reuse" | "recipient-list" | "selection-list" | "selection-version" | "storage-version" | "cycle-read"

/** Private UI boundary; the host binds the admitted request and the complete payload. */
export function createCollaborationHttp(input: {
  origin: string
  mount: string
  host: Host
  human: { admit: (request: Request, action: HumanAction, payload: unknown) => Promise<PortResult<TrustedUiContext>>; finish: (context: TrustedUiContext) => void }
  admitRead: (request: Request, action: ReadAction, payload: unknown) => Promise<PortResult<TrustedUiContext>>
  finishRead: (context: TrustedUiContext) => void
}) {
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.origin !== input.origin || url.pathname !== input.mount) return undefined
    const name = url.searchParams.get("sf")
    if (!name?.startsWith("collaboration-")) return undefined
    const action = name.slice("collaboration-".length)
    const reads: readonly string[] = ["work-list", "work-destination", "relation-read", "thread-read", "thread-history", "confirmation-prepare", "confirmation-inspect", "answer-evidence", "answer-reuse", "recipient-list", "selection-list", "selection-version", "storage-version", "cycle-read"]
    const writes: Record<string, HumanAction> = { "relation-create": "collaboration.relation.confirm", "relation-remove": "collaboration.relation.confirm", "handoff-create": "collaboration.handoff.confirm", "handoff-update": "collaboration.handoff.confirm", "thread-create": "collaboration.thread.create", "thread-reply": "collaboration.thread.reply", "thread-resolve": "collaboration.thread.resolve", "thread-edit": "collaboration.thread.edit", "confirmation-confirm": "collaboration.confirmation.confirm", "answer-confirm": "collaboration.answer.confirm", "selection-create": "collaboration.selection.create" }
    if (!reads.includes(action) && !Object.hasOwn(writes, action)) return response({ status: "unavailable", reason: "collaboration-action-unavailable" }, 404)
    if (request.method !== "POST") return response({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (request.headers.get("origin") !== input.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response({ status: "denied", reason: "request-origin-unavailable" }, 403)
    try {
      const text = await request.text()
      if (text.length > 131072) return response({ status: "needs-input", reason: "request-too-large" }, 413)
      const payload: unknown = JSON.parse(text)
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response({ status: "needs-input", reason: "invalid-collaboration-request" })
      const body = payload as Record<string, unknown>
      if ((action === "relation-create" && body.operation !== "create") || (action === "relation-remove" && body.operation !== "remove")) return response({ status: "needs-input", reason: "invalid-collaboration-request" })
      const keys: Record<string, readonly string[]> = { "relation-create": ["operation", "pair", "mutation"], "relation-remove": ["operation", "id", "pair", "mutation"], "thread-create": ["draft", "mutation"], "thread-reply": ["id", "body", "mutation"], "thread-resolve": ["id", "mutation"], "thread-edit": ["id", "messageId", "expectedVersion", "body", "mutation"], "confirmation-confirm": ["scope", "observedSourceVersion", "expectedScopeFingerprint", "expectedStorageVersion", "idempotencyKey"], "answer-confirm": ["questionId", "answerRef", "mutation"], "selection-create": ["draft", "mutation"], "handoff-create": ["intent", "sourceRef", "relationKey", ...(body.recipientRef === undefined ? [] : ["recipientRef"])], "handoff-update": ["topicId", "expectedVersion", "idempotencyKey", "values", "sourceRefs", "sourceRef", "relationKey", ...(body.recipientRef === undefined ? [] : ["recipientRef"])] }
      const required = keys[action]
      if (required && (Object.keys(body).length !== required.length || required.some((key) => !Object.hasOwn(body, key)))) return response({ status: "needs-input", reason: "invalid-collaboration-request" })
      const read = reads.includes(action)
      const admitted = read ? await input.admitRead(request, action as ReadAction, payload) : await input.human.admit(request, writes[action]!, payload)
      if (admitted.status !== "ok") return response(admitted)
      const context = admitted.value
      try {
        if (action === "work-list") return response(await input.host.work.listPresentation(body.selection as Parameters<Host["work"]["listPresentation"]>[0], context))
        if (action === "work-destination") return response(input.host.resolveWorkDestination && typeof body.actionRef === "string" ? await input.host.resolveWorkDestination(body.selection as Parameters<NonNullable<Host["resolveWorkDestination"]>>[0], body.actionRef, context) : { status: "unavailable", reason: "destination-unavailable" })
        if (action === "relation-read") return response(Array.isArray(body.recordRefs) && body.recordRefs.every((ref) => typeof ref === "string") ? await input.host.relations.read(body.recordRefs, context) : { status: "needs-input", reason: "invalid-relation-selection" })
        if (action === "relation-create") return response(await input.host.relations.create(body.pair as Parameters<Host["relations"]["create"]>[0], body.mutation as Parameters<Host["relations"]["create"]>[1], context))
        if (action === "relation-remove") return response(typeof body.id === "string" ? await input.host.relations.remove(body.id, body.pair as Parameters<Host["relations"]["remove"]>[1], body.mutation as Parameters<Host["relations"]["remove"]>[2], context) : { status: "needs-input", reason: "invalid-relation" })
        if (action === "handoff-create") return response(await input.host.handoff.create(payload as Parameters<Host["handoff"]["create"]>[0], context))
        if (action === "handoff-update") return response(await input.host.handoff.update(payload as Parameters<Host["handoff"]["update"]>[0], context))
        if (action === "thread-create") return response(await input.host.threads.create(body.draft as Parameters<Host["threads"]["create"]>[0], body.mutation as Parameters<Host["threads"]["create"]>[1], context))
        if (action === "thread-edit") return response(input.host.threadHistory && typeof body.id === "string" && typeof body.messageId === "string" && typeof body.expectedVersion === "number" && typeof body.body === "string" ? await input.host.threadHistory.edit(body.id, body.messageId, body.expectedVersion, body.body, body.mutation as Parameters<NonNullable<Host["threadHistory"]>["edit"]>[4], context) : { status: "unavailable", reason: "thread-history-unavailable" })
        if (action === "thread-history") return response(input.host.threadHistory && typeof body.id === "string" && typeof body.messageId === "string" && typeof body.incarnation === "string" && typeof body.version === "number" ? await input.host.threadHistory.readVersion(body.id, body.messageId, body.incarnation, body.version, context) : { status: "unavailable", reason: "thread-history-unavailable" })
        if (action === "thread-read") {
          if (typeof body.id !== "string") return response({ status: "needs-input", reason: "invalid-thread" })
          const thread = await input.host.threads.read(body.id, context)
          if (thread.status === "ok" && thread.value.messages[0]?.authorRef === context.binding.principalRef) return response(thread)
          return response(input.host.recipientThread ? await input.host.recipientThread(body.id, context) : { status: "unavailable", reason: "thread-access-unavailable" })
        }
        if (action === "thread-reply") {
          if (typeof body.id !== "string" || typeof body.body !== "string") return response({ status: "needs-input", reason: "invalid-thread" })
          const mutation = body.mutation as Parameters<Host["threads"]["reply"]>[2]
          const thread = await input.host.threads.read(body.id, context)
          if (thread.status === "ok" && thread.value.messages[0]?.authorRef === context.binding.principalRef) return response(await input.host.threads.reply(body.id, body.body, mutation, context))
          return response(input.host.recipientActions ? await input.host.recipientActions.reply(body.id, body.body, mutation, context) : { status: "unavailable", reason: "thread-access-unavailable" })
        }
        if (action === "thread-resolve") {
          if (typeof body.id !== "string") return response({ status: "needs-input", reason: "invalid-thread" })
          const mutation = body.mutation as Parameters<Host["threads"]["resolve"]>[1]
          const thread = await input.host.threads.read(body.id, context)
          if (thread.status === "ok" && thread.value.messages[0]?.authorRef === context.binding.principalRef) return response(await input.host.threads.resolve(body.id, mutation, context))
          return response(input.host.recipientActions ? await input.host.recipientActions.resolve(body.id, mutation, context) : { status: "unavailable", reason: "thread-access-unavailable" })
        }
        if (action === "confirmation-prepare") return response(input.host.confirmation ? await input.host.confirmation.prepare(body.scope as Parameters<NonNullable<Host["confirmation"]>["prepare"]>[0], context) : { status: "unavailable", reason: "confirmation-unavailable" })
        if (action === "confirmation-confirm") return response(input.host.confirmation ? await input.host.confirmation.confirm(payload as Parameters<NonNullable<Host["confirmation"]>["confirm"]>[0], context) : { status: "unavailable", reason: "confirmation-unavailable" })
        if (action === "confirmation-inspect") return response(input.host.confirmation && typeof body.id === "string" ? await input.host.confirmation.inspect(body.id, context) : { status: "unavailable", reason: "confirmation-unavailable" })
        if (action === "answer-confirm") return response(input.host.answerReuse && typeof body.questionId === "string" && typeof body.answerRef === "string" ? await input.host.answerReuse.confirm(body.questionId, body.answerRef, body.mutation as Parameters<NonNullable<Host["answerReuse"]>["confirm"]>[2], context) : { status: "unavailable", reason: "answer-reuse-unavailable" })
        if (action === "answer-evidence") {
          if (typeof body.questionId !== "string" || typeof body.messageId !== "string") return response({ status: "needs-input", reason: "invalid-answer" })
          const issued = await input.host.answerEvidence.issue(body.questionId, body.messageId, context)
          return response(issued.status === "ok" ? { status: "ok", value: { answerRef: issued.value.refId } } : issued)
        }
        if (action === "answer-reuse") return response(input.host.answerReuse && typeof body.questionId === "string" ? await input.host.answerReuse.read(body.questionId, context) : { status: "unavailable", reason: "answer-reuse-unavailable" })
        if (action === "recipient-list") return response(await input.host.listRecipients(context))
        if (action === "selection-version") return response(input.host.caseSelection ? await input.host.caseSelection.storageVersion(context) : { status: "unavailable", reason: "selection-unavailable" })
        if (action === "selection-list") return response(input.host.caseSelection && typeof body.caseRef === "string" ? await input.host.caseSelection.list(body.caseRef, context) : { status: "unavailable", reason: "selection-unavailable" })
        if (action === "storage-version") return response(body.namespace === "threads" || body.namespace === "relations" || body.namespace === "confirmations" ? await input.host.storageVersion(body.namespace, context) : { status: "needs-input", reason: "invalid-namespace" })
        if (action === "selection-create") return response(input.host.caseSelection ? await input.host.caseSelection.create(body.draft as Parameters<NonNullable<Host["caseSelection"]>["create"]>[0], body.mutation as Parameters<NonNullable<Host["caseSelection"]>["create"]>[1], context) : { status: "unavailable", reason: "selection-unavailable" })
        return response(await input.host.cycle.read(payload as Parameters<Host["cycle"]["read"]>[0], context))
      } finally {
        if (read) input.finishRead(context)
        if (!read) input.human.finish(context)
      }
    } catch {
      return response({ status: "unavailable", reason: "collaboration-request-unavailable" })
    }
  }
}

function response(result: PortResult<unknown>, status?: number) {
  return Response.json(result, { status: status ?? (result.status === "ok" ? 200 : result.status === "needs-input" ? 400 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : 503), headers: { "cache-control": "no-store" } })
}
