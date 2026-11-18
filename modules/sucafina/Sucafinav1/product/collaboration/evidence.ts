import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, ProductContext } from "../contracts/context.ts"
import { decodeProductContext } from "../contracts/validation.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createThreadPort } from "./threads.ts"

type AnswerEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** A human answer is a claim, backed by its immutable message and current source access. */
export function createThreadAnswerEvidence(threads: Pick<ReturnType<typeof createThreadPort>, "read">) {
  const issue = async (threadId: string, messageId: string, context: TrustedDomainContext): Promise<PortResult<AnswerEvidence>> => {
    const first = await threads.read(threadId, context)
    if (first.status !== "ok") return first
    const thread = first.value
    const message = thread.messages.find((item, index) => index > 0 && item.id === messageId && item.authorRef === thread.recipientRef)
    if (thread.kind === "comment" || !thread.recipientRef || !message || !thread.evidenceRefs.length) return { status: "unavailable", reason: "answer-unavailable" }
    const refId = `sf-thread-answer:${encodeURIComponent(thread.id)}:${encodeURIComponent(message.id)}:${encodeURIComponent(message.incarnation)}:${message.version}`
    const value: AnswerEvidence = { schema: "sf-evidence-v1", kind: "record", refId, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "claim", target: { surface: "dashboard", recordType: "sf-thread-answer", recordId: message.id, incarnation: message.incarnation, version: message.version, fields: ["body", "authorRef", "createdAt"], period: thread.period, projectionDigest: digestSfValue({ threadId: thread.id, message, period: thread.period, sourceRefs: thread.evidenceRefs }) } }
    const again = await threads.read(threadId, context)
    if (again.status !== "ok") return again
    const current = again.value.messages.find((item) => item.id === message.id && item.incarnation === message.incarnation && item.version === message.version)
    if (!current || again.value.recipientRef !== message.authorRef || digestSfValue({ threadId: again.value.id, message: current, period: again.value.period, sourceRefs: again.value.evidenceRefs }) !== value.target.projectionDigest) return { status: "stale", reason: "answer-changed" }
    return { status: "ok", value: { ...value, refDigest: digestSfEvidenceRef(value) } }
  }
  const resolve = async (refId: string, context: TrustedDomainContext): Promise<PortResult<AnswerEvidence>> => {
      const parts = /^sf-thread-answer:([^:]+):([^:]+):([^:]+):([1-9]\d*)$/.exec(refId)
      if (!parts || !Number.isSafeInteger(Number(parts[4]))) return { status: "needs-input", reason: "invalid-answer-reference" }
      const decoded = decode(parts.slice(1, 4))
      if (!decoded) return { status: "needs-input", reason: "invalid-answer-reference" }
      const result = await issue(decoded[0]!, decoded[1]!, context)
      if (result.status !== "ok") return result
      if (result.value.refId !== refId) return { status: "stale", reason: "answer-replaced" }
      return result
  }
  return {
    issue,
    resolve,
    belongsToQuestion: async (questionId: string, answerRef: string, context: TrustedDomainContext): Promise<boolean> => {
      const parts = /^sf-thread-answer:([^:]+):([^:]+):([^:]+):([1-9]\d*)$/.exec(answerRef)
      if (!parts) return false
      const decoded = decode(parts.slice(1, 4))
      if (!decoded || decoded[0] !== questionId) return false
      const answer = await resolve(answerRef, context)
      return answer.status === "ok"
    },
    project: async (ref: AnswerEvidence, productContext: ProductContext, context: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
      const selected = structuredClone(productContext)
      if (selected.installationId !== context.binding.installationId || selected.projectId !== context.binding.projectId || selected.principalRef !== context.binding.principalRef || selected.accessRevision !== context.binding.accessRevision || selected.policyVersion !== context.binding.policyVersion) return { status: "denied", reason: "answer-context-unavailable" }
      const validated = decodeProductContext({ surface: selected.surface, period: selected.period, currency: selected.currency, sourceRefs: selected.sourceRefs }, selected)
      if (!validated.ok) return { status: "unavailable", reason: "answer-context-unavailable" }
      const first = await resolve(ref.refId, context)
      if (first.status !== "ok") return first
      if (digestSfValue(first.value) !== digestSfValue(ref) || !first.value.target.period || selected.period.start > first.value.target.period.start || selected.period.end < first.value.target.period.end) return { status: "stale", reason: "answer-context-changed" }
      const parts = /^sf-thread-answer:([^:]+):([^:]+):([^:]+):([1-9]\d*)$/.exec(ref.refId)
      const decoded = parts && decode(parts.slice(1, 4))
      if (!decoded) return { status: "unavailable", reason: "answer-unavailable" }
      const thread = await threads.read(decoded[0]!, context)
      if (thread.status !== "ok") return thread
      const message = thread.value.messages.find((item) => item.id === decoded[1] && item.incarnation === decoded[2] && item.version === Number(parts![4]))
      if (!message || message.authorRef !== thread.value.recipientRef) return { status: "stale", reason: "answer-changed" }
      const current = await resolve(ref.refId, context)
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== digestSfValue(ref)) return { status: "stale", reason: "answer-changed" }
      return { status: "ok", value: { context: validated.value, version: message.version, engineVersion: "sf-thread-answer-v1", components: [], values: [
        { id: "body", value: message.body, period: thread.value.period, granularity: "record", sourceRefs: [current.value], drilldown: current.value, evidenceState: "confirmed" },
        { id: "authorRef", value: message.authorRef, period: thread.value.period, granularity: "record", sourceRefs: [current.value], drilldown: current.value, evidenceState: "confirmed" },
        { id: "createdAt", value: message.createdAt, period: thread.value.period, granularity: "record", sourceRefs: [current.value], drilldown: current.value, evidenceState: "confirmed" },
      ], missing: [] } }
    },
  }
}

function decode(parts: string[]) {
  try {
    const values = parts.map((part) => decodeURIComponent(part))
    return values.length === 3 && values.every((value, index) => !!value && encodeURIComponent(value) === parts[index]) ? values : undefined
  } catch {
    return undefined
  }
}
