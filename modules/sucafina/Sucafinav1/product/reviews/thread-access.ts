import { canonicalSfValue, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { validThreadSourceContext } from "../collaboration/thread-context.ts"
import type { ThreadSourceContext } from "../collaboration/thread-context.ts"
import type { ReviewHost, ReviewSection } from "./port.ts"

type Message = { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string; sourceContext?: ThreadSourceContext }
type Thread = { id: string; kind: "comment" | "clarification" | "review"; sourceRef: string; sourceIncarnation: string; observedVersion: number; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; messages: readonly Message[] }
type HistoricalMessage = { message: Message; evidenceRefs: readonly BusinessEvidenceRef[]; period: Period } & Partial<Pick<ThreadSourceContext, "sourceRef" | "sourceIncarnation" | "observedVersion">>

/** Explicit thread selection only: no identity is inferred from text or names. */
export function createReviewThreadComments(input: {
  host: Pick<DomainPortHost, "revalidate">
  threads: {
    read: (threadId: string, context: TrustedDomainContext) => Promise<PortResult<Thread>>
    readHistorical?: (threadId: string, context: TrustedDomainContext) => Promise<PortResult<Thread>>
  }
  authorizeSourceMapping: (thread: Thread, selectedSources: readonly SourceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeSourceContinuity?: (basis: ThreadSourceContext, selectedSources: readonly SourceRef[], context: TrustedDomainContext) => Promise<boolean>
  history?: { readVersion: (threadId: string, messageId: string, incarnation: string, version: number, context: TrustedDomainContext) => Promise<PortResult<HistoricalMessage>> }
  maxMessages: number
}) {
  if (!Number.isSafeInteger(input.maxMessages) || input.maxMessages < 1) throw new Error("SF_REVIEW_COMMENT_LIMIT_INVALID")
  // Historical reads retain the original thread basis and each message's protected
  // sourceContext. A current overlay cannot authorize a legacy message's old basis.
  const read = input.threads.readHistorical ?? input.threads.read
  const provenHistory = !!input.threads.readHistorical && !!input.authorizeSourceContinuity
  const stable = async (threadId: string, context: TrustedDomainContext, check: (thread: Thread) => Promise<boolean>): Promise<Thread | undefined> => {
    if (typeof threadId !== "string" || !threadId.trim()) return undefined
    const first = await read(threadId, context)
    if (first.status !== "ok" || !first.value || first.value.id !== threadId || !["comment", "review"].includes(first.value.kind) || !Array.isArray(first.value.messages)) return undefined
    const snapshot = structuredClone(first.value)
    if (!await check(snapshot)) return undefined
    const second = await read(threadId, context)
    if (second.status !== "ok" || digestSfValue(snapshot) !== digestSfValue(second.value) || !await check(structuredClone(second.value))) return undefined
    return snapshot
  }
  // Per-pass caching avoids one complete C17/source read for every message in a
  // long thread. Neither data nor an authorization decision survives the pass.
  const mapping = (context: TrustedDomainContext) => {
    const checked = new Map<string, Promise<boolean>>()
    return (thread: Thread, basis: ThreadSourceContext, sources: readonly SourceRef[]) => {
      const key = canonicalSfValue([basis, sources])
      const pending = checked.get(key) ?? input.authorizeSourceMapping(structuredClone({ ...thread, ...basis }), structuredClone(sources), context)
      checked.set(key, pending)
      return pending
    }
  }
  const authorizeComments: ReviewHost["authorizeComments"] = async (context, incoming) => {
    if (!Array.isArray(incoming) || incoming.some((comment) => !comment || typeof comment.id !== "string" || !Number.isSafeInteger(comment.version) || comment.version < 1 || typeof comment.content !== "string" || typeof comment.authorRef !== "string" || typeof comment.createdAt !== "string" || !Array.isArray(comment.sourceRefs))) return false
    const comments = structuredClone(incoming)
    if (!await input.host.revalidate(context)) return false
    const grouped = new Map<string, { comment: typeof comments[number]; messageId: string; incarnation: string; digest: string }[]>()
    for (const comment of comments) {
      const key = /^thread-message:([^:]+):([^:]+):([^:]+):([a-f0-9]{64})$/.exec(comment.id)
      if (!key) return false
      const parts = key.slice(1, 4).map((value) => { try { return decodeURIComponent(value!) } catch { return "" } })
      if (parts.some((value, index) => !value || encodeURIComponent(value) !== key[index + 1])) return false
      const group = grouped.get(parts[0]!) ?? []
      group.push({ comment, messageId: parts[1]!, incarnation: parts[2]!, digest: key[4]! })
      grouped.set(parts[0]!, group)
    }
    const checked = await Promise.all([...grouped].map(async ([threadId, selected]) => !!await stable(threadId, context, async (thread) => {
      const authorize = mapping(context)
      const accepted = await Promise.all(selected.map(async ({ comment, messageId, incarnation, digest }) => {
        const found = thread.messages.filter((message) => message.id === messageId && message.incarnation === incarnation && message.version === comment.version)
        if (found.length > 1) return false
        const historical = found.length === 0 && input.history ? await input.history.readVersion(threadId, messageId, incarnation, comment.version, context) : undefined
        const message = found[0] ?? (historical?.status === "ok" ? historical.value.message : undefined)
        if (!message || message.id !== messageId || message.incarnation !== incarnation || message.version !== comment.version || digestSfValue(message) !== digest || message.body !== comment.content || message.authorRef !== comment.authorRef || message.createdAt !== comment.createdAt) return false
        let basis = messageBasis(thread, message)
        if (historical?.status === "ok") {
          const value = historical.value
          if (["sourceRef", "sourceIncarnation", "observedVersion"].some((key) => key in value)) {
            if (!validThreadSourceContext(value)) return false
            basis = contextOf(value)
          } else if (digestSfValue(value.evidenceRefs) !== digestSfValue(thread.evidenceRefs) || digestSfValue(value.period) !== digestSfValue(thread.period)) return false
        }
        if (!basis || !sameThreadSelector(thread, basis, provenHistory)) return false
        return authorize(thread, basis, comment.sourceRefs)
      }))
      return accepted.every(Boolean)
    })))
    return checked.every(Boolean) && await input.host.revalidate(context)
  }
  return {
    async capture(threadId: string, incoming: readonly SourceRef[], context: TrustedDomainContext): Promise<PortResult<NonNullable<ReviewSection["comments"]>>> {
      if (!Array.isArray(incoming) || !incoming.length) return { status: "unavailable", reason: "thread-access-unavailable" }
      const sources = structuredClone(incoming)
      if (!await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
      let reason = "thread-access-unavailable"
      const thread = await stable(threadId, context, async (snapshot) => {
        if (snapshot.messages.length > input.maxMessages) { reason = "thread-capture-limit-exceeded"; return false }
        if (snapshot.messages.some((message) => !validMessage(message)) || new Set(snapshot.messages.map((message) => JSON.stringify([message.id, message.incarnation, message.version]))).size !== snapshot.messages.length) { reason = "invalid-thread-snapshot"; return false }
        const authorize = mapping(context)
        const continuity = new Map<string, Promise<boolean>>()
        // Even an empty thread needs its source association authorized.
        const messages = snapshot.messages.length ? snapshot.messages : [undefined]
        const allowed = await Promise.all(messages.map(async (message) => {
          const basis = message ? messageBasis(snapshot, message) : contextOf(snapshot)
          if (!basis || !sameThreadSelector(snapshot, basis, provenHistory)) return false
          let captured = captureSources(sources, basis, false)
          if (!captured && provenHistory) {
            const key = canonicalSfValue([basis, sources])
            const permitted = continuity.get(key) ?? input.authorizeSourceContinuity!(structuredClone(basis), structuredClone(sources), context)
            continuity.set(key, permitted)
            if (await permitted) captured = captureSources(sources, basis, true)
          }
          return !!captured && await authorize(snapshot, basis, captured)
        }))
        return allowed.every(Boolean)
      })
      if (!thread) return { status: "unavailable", reason }
      const comments = thread.messages.map((message) => ({
        id: `thread-message:${encodeURIComponent(thread.id)}:${encodeURIComponent(message.id)}:${encodeURIComponent(message.incarnation)}:${digestSfValue(message)}`,
        version: message.version, content: message.body, authorRef: message.authorRef, createdAt: message.createdAt,
        // Preserve the message's observed version, even when selected with a newer
        // version of the same physical source. The review also revalidates these refs.
        sourceRefs: captureSources(sources, messageBasis(thread, message)!, provenHistory)!,
      }))
      return await input.host.revalidate(context) ? { status: "ok", value: comments } : { status: "denied", reason: "thread-access-unavailable" }
    },
    authorizeComments,
  }
}

function contextOf(value: ThreadSourceContext): ThreadSourceContext {
  return { sourceRef: value.sourceRef, sourceIncarnation: value.sourceIncarnation, observedVersion: value.observedVersion, period: value.period, evidenceRefs: value.evidenceRefs }
}

function messageBasis(thread: Thread, message: Message): ThreadSourceContext | undefined {
  if (message.sourceContext === undefined) return contextOf(thread)
  return validThreadSourceContext(message.sourceContext) ? contextOf(message.sourceContext) : undefined
}

function sameThreadSelector(thread: Thread, basis: ThreadSourceContext, continuityProven: boolean) {
  if (digestSfValue(thread.period) !== digestSfValue(basis.period)) return false
  const selector = (ref: BusinessEvidenceRef) => ref.kind === "record" ? { installationId: ref.installationId, projectId: ref.projectId, surface: ref.target.surface, type: ref.target.recordType, id: ref.target.recordId, ...(continuityProven ? {} : { incarnation: ref.target.incarnation }), fields: [...ref.target.fields].sort(), period: ref.target.period } : ref
  return digestSfValue(thread.evidenceRefs.map(selector).map(digestSfValue).sort()) === digestSfValue(basis.evidenceRefs.map(selector).map(digestSfValue).sort())
}

function captureSources(sources: readonly SourceRef[], basis: ThreadSourceContext, continuityProven: boolean): SourceRef[] | undefined {
  const records = basis.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
  // Existing producer mappings can cover non-record sources. They still authorize
  // the complete original body; this branch never creates a continuity claim.
  if (!records.length) return structuredClone([...sources])
  const matches = (source: SourceRef, ref: typeof records[number]) => source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && (continuityProven || source.incarnation === ref.target.incarnation) && digestSfValue([...source.fields].sort()) === digestSfValue([...ref.target.fields].sort()) && digestSfValue(source.period) === digestSfValue(ref.target.period)
  if (sources.some((source) => !records.some((ref) => matches(source, ref))) || records.some((ref) => !sources.some((source) => matches(source, ref)))) return undefined
  return sources.map((source) => {
    const matched = records.find((ref) => matches(source, ref))!
    return { ...structuredClone(source), incarnation: matched.target.incarnation, version: matched.target.version }
  })
}

function validMessage(message: Message) {
  return !!message && typeof message.id === "string" && !!message.id && typeof message.incarnation === "string" && !!message.incarnation && Number.isSafeInteger(message.version) && message.version > 0 && typeof message.authorRef === "string" && !!message.authorRef && typeof message.body === "string" && typeof message.createdAt === "string" && Number.isFinite(Date.parse(message.createdAt))
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

