import type { PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createCollaborationHost } from "./host.ts"
import type { CollaborationHumanAction } from "./human.ts"
import { createRecipientAwareThreadReads } from "./thread-reads.ts"

type Host = ReturnType<typeof createCollaborationHost>
type Payload = Record<string, unknown>
type Route = {
  keys: readonly string[]
  optional?: readonly string[]
  action?: CollaborationHumanAction
  read?: string
  validate?: (payload: Payload) => boolean
  invoke: (payload: Payload, context: TrustedUiContext) => Promise<PortResult<unknown>> | PortResult<unknown>
}
const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "collaboration-feature-unavailable" })

/** Route envelopes bind exactly the payload each domain method admits; they contain no authority. */
export function createCollaborationHttpRoutes(host: Host) {
  const prepareAnswer = async (questionId: string, answerRef: string, context: TrustedUiContext): Promise<PortResult<unknown>> => {
    const result = await host.answerReuse?.prepare(questionId, answerRef, context)
    if (!result) return unavailable()
    if (result.status !== "ok") return result
    const value = result.value
    const observation = value.observation
    const presented = { ...("evidence" in observation ? { evidence: observation.evidence } : {}), ...("projection" in observation ? { projection: observation.projection } : {}) }
    return { status: "ok", value: { observationRef: value.observationRef, observedSourceVersion: value.observedSourceVersion, expectedScopeFingerprint: value.expectedScopeFingerprint, answerRef: value.answerRef, answer: value.answer, authorRef: value.authorRef, scope: value.scope, ...presented } }
  }
  const threadRead = (id: string, context: TrustedUiContext) => createRecipientAwareThreadReads(host.threads, host.recipientThread).read(id, context)
  const threadChange = async (payload: Payload, context: TrustedUiContext, kind: "reply" | "resolve"): Promise<PortResult<unknown>> => {
    const found = await threadRead(payload.id as string, context)
    if (found.status !== "ok") return found
    const port = host.recipientActions && "current" in found.value ? host.recipientActions : host.threads
    if (!port) return unavailable()
    const mutation = payload.mutation as Parameters<Host["threads"]["resolve"]>[1]
    return kind === "reply" ? port.reply(payload.id as string, payload.body as string, mutation, context) : port.resolve(payload.id as string, mutation, context)
  }
  const routes = new Map<string, Route>([
    ["question-consume", { keys: ["proposal", "sourceRef", "period", "mutation"], action: "collaboration.question.confirm", invoke: (p, c) => host.questions.consume(p as Parameters<Host["questions"]["consume"]>[0], c) }],
    ["question-output", { keys: ["outputRef", "caseRef"], read: "collaboration.question.output", invoke: (p, c) => host.questions.readOutput(p.outputRef as string, p.caseRef as Parameters<Host["questions"]["readOutput"]>[1], c) }],
    ["thread-create", { keys: ["draft", "mutation"], action: "collaboration.thread.create", invoke: (p, c) => host.threads.create(p.draft as Parameters<Host["threads"]["create"]>[0], p.mutation as Parameters<Host["threads"]["create"]>[1], c) }],
    ["thread-read", { keys: ["id"], read: "collaboration.thread.read", invoke: (p, c) => threadRead(p.id as string, c) }],
    ["thread-reply", { keys: ["id", "body", "mutation"], action: "collaboration.thread.reply", invoke: (p, c) => threadChange(p, c, "reply") }],
    ["thread-resolve", { keys: ["id", "mutation"], action: "collaboration.thread.resolve", invoke: (p, c) => threadChange(p, c, "resolve") }],
    ["thread-edit", { keys: ["id", "messageId", "expectedVersion", "body", "mutation"], action: "collaboration.thread.edit", invoke: (p, c) => host.threadHistory?.edit(p.id as string, p.messageId as string, p.expectedVersion as number, p.body as string, p.mutation as Parameters<NonNullable<Host["threadHistory"]>["edit"]>[4], c) ?? unavailable() }],
    ["thread-history", { keys: ["id", "messageId", "incarnation", "version"], read: "collaboration.thread.history", invoke: (p, c) => host.threadHistory?.readVersion(p.id as string, p.messageId as string, p.incarnation as string, p.version as number, c) ?? unavailable() }],
    ["relation-create", { keys: ["operation", "pair", "mutation"], action: "collaboration.relation.confirm", validate: (p) => p.operation === "create", invoke: (p, c) => host.relations.create(p.pair as Parameters<Host["relations"]["create"]>[0], p.mutation as Parameters<Host["relations"]["create"]>[1], c) }],
    ["relation-remove", { keys: ["operation", "id", "pair", "mutation"], action: "collaboration.relation.confirm", validate: (p) => p.operation === "remove", invoke: (p, c) => host.relations.remove(p.id as string, p.pair as Parameters<Host["relations"]["remove"]>[1], p.mutation as Parameters<Host["relations"]["remove"]>[2], c) }],
    ["relation-read", { keys: ["recordRefs"], read: "collaboration.relation.read", validate: (p) => Array.isArray(p.recordRefs) && p.recordRefs.length > 0 && p.recordRefs.every((value) => typeof value === "string" && !!value.trim()), invoke: (p, c) => host.relations.read(p.recordRefs as string[], c) }],
    ["handoff-create", { keys: ["intent", "sourceRef", "relationKey"], optional: ["recipientRef"], action: "collaboration.handoff.confirm", invoke: (p, c) => host.handoff.create(p as Parameters<Host["handoff"]["create"]>[0], c) }],
    ["handoff-link", { keys: ["topicRef", "sourceRefs", "sourceRef", "relationKey"], optional: ["recipientRef"], action: "collaboration.handoff.confirm", invoke: (p, c) => host.handoff.link(p as Parameters<Host["handoff"]["link"]>[0], c) }],
    ["handoff-update", { keys: ["topicId", "expectedVersion", "idempotencyKey", "values", "sourceRefs", "sourceRef", "relationKey"], optional: ["recipientRef"], action: "collaboration.handoff.confirm", invoke: (p, c) => host.handoff.update(p as Parameters<Host["handoff"]["update"]>[0], c) }],
    ["confirmation-prepare", { keys: ["scope"], read: "collaboration.confirmation.prepare", invoke: (p, c) => host.confirmation?.prepare(p.scope as Parameters<NonNullable<Host["confirmation"]>["prepare"]>[0], c) ?? unavailable() }],
    ["confirmation-confirm", { keys: ["scope", "observedSourceVersion", "expectedScopeFingerprint", "expectedStorageVersion", "idempotencyKey"], action: "collaboration.confirmation.confirm", invoke: (p, c) => host.confirmation?.confirm(p as Parameters<NonNullable<Host["confirmation"]>["confirm"]>[0], c) ?? unavailable() }],
    ["confirmation-project", { keys: ["id"], read: "collaboration.confirmation.project", invoke: (p, c) => host.confirmation?.project(p.id as string, c) ?? unavailable() }],
    ["answer-prepare", { keys: ["questionId", "answerRef"], read: "collaboration.answer.prepare", invoke: (p, c) => prepareAnswer(p.questionId as string, p.answerRef as string, c) }],
    ["answer-prepare-message", { keys: ["questionId", "messageId", "incarnation", "version"], read: "collaboration.answer.prepare", validate: (p) => [p.questionId, p.messageId, p.incarnation].every((value) => typeof value === "string" && !!value.trim()) && Number.isSafeInteger(p.version) && (p.version as number) > 0, invoke: async (p, c) => {
      const issued = await host.answerEvidence.issue(p.questionId as string, p.messageId as string, c)
      if (issued.status !== "ok") return issued
      if (issued.value.target.recordId !== p.messageId || issued.value.target.incarnation !== p.incarnation || issued.value.target.version !== p.version) return { status: "stale", reason: "answer-selection-changed" }
      return prepareAnswer(p.questionId as string, issued.value.refId, c)
    } }],
    ["answer-confirm", { keys: ["questionId", "answerRef", "mutation"], action: "collaboration.answer.confirm", invoke: (p, c) => host.answerReuse?.confirm(p.questionId as string, p.answerRef as string, p.mutation as Parameters<NonNullable<Host["answerReuse"]>["confirm"]>[2], c) ?? unavailable() }],
    ["answer-read", { keys: ["questionId"], read: "collaboration.answer.read", invoke: (p, c) => host.answerReuse?.read(p.questionId as string, c) ?? unavailable() }],
    ["selection-create", { keys: ["draft", "mutation"], action: "collaboration.selection.create", invoke: (p, c) => host.caseSelection?.create(p.draft as Parameters<NonNullable<Host["caseSelection"]>["create"]>[0], p.mutation as Parameters<NonNullable<Host["caseSelection"]>["create"]>[1], c) ?? unavailable() }],
    ["selection-list", { keys: ["caseRef"], read: "collaboration.selection.list", invoke: (p, c) => host.caseSelection?.list(p.caseRef as string, c) ?? unavailable() }],
    ["selection-version", { keys: [], read: "collaboration.selection.version", invoke: (_p, c) => host.caseSelection?.storageVersion(c) ?? unavailable() }],
    ["cycle-read", { keys: ["caseRef", "selection"], read: "collaboration.cycle.read", invoke: (p, c) => host.cycle.read(p as Parameters<Host["cycle"]["read"]>[0], c) }],
    ["work-list", { keys: ["selectionRef", "period"], read: "collaboration.work.list", invoke: (p, c) => host.work.listPresentation(p as Parameters<Host["work"]["listPresentation"]>[0], c) }],
    ["work-destination", { keys: ["selection", "actionRef"], read: "collaboration.work.destination", invoke: (p, c) => host.resolveWorkDestination?.(p.selection as Parameters<NonNullable<Host["resolveWorkDestination"]>>[0], p.actionRef as string, c) ?? unavailable() }],
    ["recipients", { keys: [], read: "collaboration.recipients", invoke: (_p, c) => host.listRecipients(c) }],
    ["storage-version", { keys: ["namespace"], read: "collaboration.storage.version", validate: (p) => ["threads", "relations", "confirmations"].includes(String(p.namespace)), invoke: (p, c) => host.storageVersion(p.namespace as Parameters<Host["storageVersion"]>[0], c) }],
  ])
  return routes
}

