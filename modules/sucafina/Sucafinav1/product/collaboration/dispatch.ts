import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { SfOperationInputMap } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CollaborationCapabilityHost } from "./capabilities.ts"
import type { createThreadPort } from "./threads.ts"
import type { createCollaborationComposition } from "./composition.ts"
import type { createAnswerReusePort } from "./answer-reuse.ts"

type Operation = "sf_work_list" | "sf_question_prepare" | "sf_answer_read" | "sf_relation_read" | "sf_handoff_prepare"

/** C16 and UI use these same domain ports; proposal handlers never commit actions. */
export function createCollaborationDispatch(input: {
  collaboration: ReturnType<typeof createCollaborationComposition>
  cases: Pick<DecisionCasePort, "read">
  threadReads?: Pick<ReturnType<typeof createThreadPort>, "read">
  answerReuse?: Pick<ReturnType<typeof createAnswerReusePort>, "read">
  createReceipt: CollaborationCapabilityHost["createReceipt"]
  requiredAuthority: CollaborationCapabilityHost["requiredAuthority"]
}): CollaborationCapabilityHost {
  const mayAssign = async (recipientRef: string | undefined, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => !recipientRef ||
    (!!await input.collaboration.authority.recipient(recipientRef, context) && await input.collaboration.authority.recipientSources(recipientRef, refs, context))
  const run = async (operation: Operation, payload: unknown, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap[Operation]>> => {
    if (operation === "sf_work_list") {
      const parsed = decodeSfOperationInput(operation, payload)
      return parsed.ok ? input.collaboration.work.list(parsed.value, context) : { status: "needs-input", reason: "invalid-input" }
    }
    if (operation === "sf_relation_read") {
      const parsed = decodeSfOperationInput(operation, payload)
      return parsed.ok ? input.collaboration.relations.read(parsed.value.recordRefs, context) : { status: "needs-input", reason: "invalid-input" }
    }
    if (operation === "sf_answer_read") {
      const parsed = decodeSfOperationInput(operation, payload)
      if (!parsed.ok) return { status: "needs-input", reason: "invalid-input" }
      const thread = await (input.threadReads ?? input.collaboration.threads).read(parsed.value.questionRef, context)
      if (thread.status !== "ok") return thread
      if (thread.value.kind === "comment" || !thread.value.recipientRef) return { status: "needs-input", reason: "answer-unavailable" }
      const answer = thread.value.messages.slice(1).reverse().find((message) => message.authorRef === thread.value.recipientRef)
      if (!answer) return { status: "needs-input", reason: "answer-unavailable" }
      const reusable = await input.answerReuse?.read(thread.value.id, context)
      if (reusable && reusable.status !== "ok" && reusable.status !== "stale" && !(reusable.status === "needs-input" && reusable.reason === "answer-unconfirmed")) return reusable
      if (reusable?.status === "ok" && (reusable.value.answer !== answer.body || reusable.value.authorRef !== answer.authorRef)) return { status: "stale", reason: "answer-changed" }
      const current = await (input.threadReads ?? input.collaboration.threads).read(parsed.value.questionRef, context)
      if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(thread.value)) return { status: "unavailable", reason: "answer-unavailable" }
      return { status: "ok", value: { questionRef: thread.value.id, answer: answer.body, evidenceRefs: current.value.evidenceRefs, state: reusable?.status === "ok" ? "confirmed" : reusable?.status === "stale" ? "stale" : "unconfirmed" } }
    }
    if (operation === "sf_question_prepare") {
      const parsed = decodeSfOperationInput(operation, payload)
      if (!parsed.ok || !parsed.value.question.text.trim()) return { status: "needs-input", reason: "invalid-input" }
      const current = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
      if (current.status !== "ok") return current
      if (parsed.value.question.criterionRef && !current.value.case.criteria.some((criterion) => criterion.id === parsed.value.question.criterionRef)) return { status: "needs-input", reason: "criterion-unavailable" }
      if (!parsed.value.sourceRefs.length || parsed.value.sourceRefs.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref))) || !await input.collaboration.authority.sources(parsed.value.sourceRefs, context)) return { status: "denied", reason: "source-access-unavailable" }
      if (!await mayAssign(parsed.value.recipientRef, parsed.value.sourceRefs, context)) return { status: "needs-input", reason: "recipient-unavailable" }
      const again = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
      if (again.status !== "ok") return again
      if (digestSfValue(again.value) !== digestSfValue(current.value) || !await input.collaboration.authority.sources(parsed.value.sourceRefs, context) || !await mayAssign(parsed.value.recipientRef, parsed.value.sourceRefs, context)) return { status: "stale", reason: "case-or-source-changed" }
      return { status: "ok", value: { caseRef: parsed.value.caseRef, question: parsed.value.question.text, ...(parsed.value.question.criterionRef ? { criterionRef: parsed.value.question.criterionRef } : {}), ...(parsed.value.recipientRef ? { recipientRef: parsed.value.recipientRef } : {}), evidenceRefs: parsed.value.sourceRefs, expectedCaseVersion: current.value.case.version } }
    }
    const parsed = decodeSfOperationInput("sf_handoff_prepare", payload)
    if (!parsed.ok) return { status: "needs-input", reason: "invalid-input" }
    const current = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
    if (current.status !== "ok") return current
    if (!parsed.value.sourceRefs.length || parsed.value.sourceRefs.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref))) || !await input.collaboration.authority.sources(parsed.value.sourceRefs, context)) return { status: "denied", reason: "source-access-unavailable" }
    if (!await mayAssign(parsed.value.recipientRef, parsed.value.sourceRefs, context)) return { status: "needs-input", reason: "recipient-unavailable" }
    const target = parsed.value.sourceRefs.find((ref) => ref.refId === parsed.value.actionRef && ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "hotTopics")
    if (!target || target.kind !== "record") return { status: "needs-input", reason: "action-unavailable" }
    const topic = await input.collaboration.hotTopics.read(target.target.recordId, parsed.value.sourceRefs, context)
    if (topic.status !== "ok") return topic
    const again = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
    if (again.status !== "ok") return again
    if (digestSfValue(again.value) !== digestSfValue(current.value) || !await input.collaboration.authority.sources(parsed.value.sourceRefs, context) || !await mayAssign(parsed.value.recipientRef, parsed.value.sourceRefs, context)) return { status: "stale", reason: "case-or-source-changed" }
    return { status: "ok", value: { ...parsed.value, domainApplied: false } }
  }
  return { createReceipt: input.createReceipt, requiredAuthority: input.requiredAuthority, execute: async <K extends Operation>(operation: K, value: SfOperationInputMap[K], context: TrustedDomainContext) => await run(operation, value, context) as PortResult<SfOperationOutputMap[K]> }
}

