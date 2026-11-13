import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ReviewHost, ReviewSection } from "./port.ts"

type Thread = { id: string; kind: "comment" | "clarification" | "review"; sourceRef: string; sourceIncarnation: string; observedVersion: number; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; messages: readonly { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string }[] }

/** Explicit thread selection only: no identity is inferred from text or names. */
export function createReviewThreadComments(input: {
  host: Pick<DomainPortHost, "revalidate">
  threads: { read: (threadId: string, context: TrustedDomainContext) => Promise<PortResult<Thread>> }
  authorizeSourceMapping: (thread: Thread, selectedSources: readonly SourceRef[], context: TrustedDomainContext) => Promise<boolean>
  history?: { readVersion: (threadId: string, messageId: string, incarnation: string, version: number, context: TrustedDomainContext) => Promise<PortResult<{ message: Thread["messages"][number]; evidenceRefs: readonly BusinessEvidenceRef[]; period: Period }>> }
  maxMessages: number
}) {
  if (!Number.isSafeInteger(input.maxMessages) || input.maxMessages < 1) throw new Error("SF_REVIEW_COMMENT_LIMIT_INVALID")
  const load = async (threadId: string, sources: readonly SourceRef[], context: TrustedDomainContext) => {
    if (!threadId || !sources.length || !await input.host.revalidate(context)) return undefined
    const first = await input.threads.read(threadId, context)
    if (first.status !== "ok" || first.value.id !== threadId || !["comment", "review"].includes(first.value.kind) || !Array.isArray(first.value.messages) || first.value.messages.length > input.maxMessages || !await input.authorizeSourceMapping(first.value, sources, context)) return undefined
    const second = await input.threads.read(threadId, context)
    if (second.status !== "ok" || digestSfValue(first.value) !== digestSfValue(second.value) || !await input.authorizeSourceMapping(second.value, sources, context) || !await input.host.revalidate(context)) return undefined
    return second.value
  }
  const authorizeComments: ReviewHost["authorizeComments"] = async (context, comments) => {
    if (!await input.host.revalidate(context)) return false
    const checked = await Promise.all(comments.map(async (comment) => {
      const key = /^thread-message:([^:]+):([^:]+):([^:]+):([a-f0-9]{64})$/.exec(comment.id)
      if (!key) return false
      const parts = key.slice(1, 4).map((value) => { try { return decodeURIComponent(value!) } catch { return "" } })
      if (parts.some((value, index) => !value || encodeURIComponent(value) !== key[index + 1])) return false
      const thread = await load(parts[0]!, comment.sourceRefs, context)
      if (!thread) return false
      const found = thread.messages.filter((message) => message.id === parts[1] && message.incarnation === parts[2] && message.version === comment.version)
      const historical = found.length === 0 && input.history ? await input.history.readVersion(parts[0]!, parts[1]!, parts[2]!, comment.version, context) : undefined
      if (historical && (historical.status !== "ok" || digestSfValue(historical.value.evidenceRefs) !== digestSfValue(thread.evidenceRefs) || digestSfValue(historical.value.period) !== digestSfValue(thread.period))) return false
      const message = found.length === 1 ? found[0] : historical?.status === "ok" ? historical.value.message : undefined
      if (!message || message.id !== parts[1] || message.incarnation !== parts[2] || message.version !== comment.version || digestSfValue(message) !== key[4] || message.body !== comment.content || message.authorRef !== comment.authorRef || message.createdAt !== comment.createdAt) return false
      if (historical?.status !== "ok") return true
      const again = await input.history!.readVersion(parts[0]!, parts[1]!, parts[2]!, comment.version, context)
      return again.status === "ok" && digestSfValue(again.value) === digestSfValue(historical.value)
    }))
    return checked.every(Boolean) && await input.host.revalidate(context)
  }
  return {
    async capture(threadId: string, sources: readonly SourceRef[], context: TrustedDomainContext): Promise<PortResult<NonNullable<ReviewSection["comments"]>>> {
      const thread = await load(threadId, sources, context)
      if (!thread) return { status: "unavailable", reason: "thread-access-unavailable" }
      if (thread.messages.some((message) => !message.id || !message.incarnation || !Number.isSafeInteger(message.version) || message.version < 1 || !message.authorRef || typeof message.body !== "string" || !message.createdAt) || new Set(thread.messages.map((message) => JSON.stringify([message.id, message.incarnation, message.version]))).size !== thread.messages.length) return { status: "unavailable", reason: "invalid-thread-snapshot" }
      const comments = thread.messages.map((message) => ({ id: `thread-message:${encodeURIComponent(thread.id)}:${encodeURIComponent(message.id)}:${encodeURIComponent(message.incarnation)}:${digestSfValue(message)}`, version: message.version, content: message.body, authorRef: message.authorRef, createdAt: message.createdAt, sourceRefs: structuredClone(sources) }))
      return await authorizeComments(context, comments) ? { status: "ok", value: comments } : { status: "denied", reason: "thread-access-unavailable" }
    },
    authorizeComments,
  }
}

/** Exact mapping for sources with the same C17 incarnation; other mappings require the owning producer's continuity proof. */
export function createExactReviewThreadSourceMapping(input: {
  host: Pick<DomainPortHost, "revalidate">
  evidence: Pick<BusinessContextService, "resolve">
}) {
  return async (thread: Thread, sources: readonly SourceRef[], context: TrustedDomainContext) => {
    if (!sources.length || !thread.evidenceRefs.length || !await input.host.revalidate(context)) return false
    const records = thread.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
    const matches = (source: SourceRef, ref: Extract<BusinessEvidenceRef, { kind: "record" }>) => !!source && !!ref.target && !!ref.target.period && source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version && digestSfValue([...source.fields].sort()) === digestSfValue([...ref.target.fields].sort()) && digestSfValue(source.period) === digestSfValue(ref.target.period)
    if (!records.some((ref) => ref.refId === thread.sourceRef && ref.target.incarnation === thread.sourceIncarnation && ref.target.version === thread.observedVersion) || sources.some((source) => !records.some((ref) => matches(source, ref))) || records.some((ref) => !sources.some((source) => matches(source, ref)))) return false
    const resolved = await Promise.all(thread.evidenceRefs.map((ref) => input.evidence.resolve(ref, context)))
    return resolved.every((value, index) => (value.state === "fresh" || value.state === "historical") && value.accessRevision === context.binding.accessRevision && digestSfValue(value.ref) === digestSfValue(thread.evidenceRefs[index])) && await input.host.revalidate(context)
  }
}
