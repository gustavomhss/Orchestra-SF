import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"

export type ReviewDiscussionPin = { reviewRef: string; reviewVersion: number; reviewDigest: string; sectionId: string }
export type ReviewDiscussionBasis = { sourceRef: string; sourceIncarnation: string; observedVersion: number; period: Period; evidenceRefs: readonly BusinessEvidenceRef[] }
export type ReviewDiscussionMessage = { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string; sourceContext: ReviewDiscussionBasis & { reviewContext: ReviewDiscussionPin } }
export type ReviewDiscussionThread = { id: string; recipientRef: string; state: string; messages: ReviewDiscussionMessage[] }
export type ReviewPreparedAnswer = { answerRef: string; answer: string; authorRef: string; observationRef: string; observedSourceVersion: number; expectedScopeFingerprint: string; reviewContext: ReviewDiscussionPin; projection: DomainProjection }

/** Presentation transport only. Every call is admitted by the installed host;
 * neither URL selections nor the principal shown by the UI confer authority.
 */
export function createReviewDiscussionClient(accessLost: () => void) {
  const pending = new Set<AbortController>()
  let disposed = false
  const post = async (mode: string, payload: unknown, key?: string) => {
    if (disposed) throw new Error("Review discussion unavailable")
    const url = new URL(location.href)
    url.search = new URLSearchParams({ sf: mode }).toString()
    url.hash = ""
    const controller = new AbortController()
    const bodyText = JSON.stringify(payload)
    pending.add(controller)
    const deadline = setTimeout(() => controller.abort(), 30_000)
    const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: bodyText,
    }).catch(() => undefined)
    const body: unknown = await response?.json().catch(() => undefined)
    clearTimeout(deadline)
    pending.delete(controller)
    if (disposed || controller.signal.aborted) throw new Error("Review discussion unavailable")
    if (response?.status === 401 || response?.status === 403) accessLost()
    const result = discussionObject(body)
    if (!response?.ok || result.status !== "ok") throw new Error(typeof result.reason === "string" ? result.reason : "Review discussion unavailable")
    return result.value
  }
  const mutation = async () => ({ expectedStorageVersion: discussionVersion(await post("collaboration-storage-version", { namespace: "threads" }), 0), idempotencyKey: crypto.randomUUID() })
  return {
    post,
    mutation,
    async recipients() {
      const value = await post("collaboration-recipients", {})
      if (!Array.isArray(value)) throw new Error("Recipient directory unavailable")
      return value.map((entry) => { const item = discussionObject(entry); return { id: discussionText(item.id), name: discussionText(item.name) } })
    },
    async thread(id: string) {
      const thread = discussionThread(await post("collaboration-thread-read", { id }))
      if (thread.id !== id) throw new Error("Review discussion unavailable")
      return thread
    },
    dispose() { disposed = true; pending.forEach((controller) => controller.abort()); pending.clear() },
  }
}

export function discussionObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review discussion unavailable")
  return value as Record<string, unknown>
}

export function discussionText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Review discussion unavailable")
  return value
}

export function discussionVersion(value: unknown, minimum = 1): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new Error("Review discussion unavailable")
  return value
}

export function discussionPin(value: unknown): ReviewDiscussionPin {
  const pin = discussionObject(value)
  const reviewDigest = discussionText(pin.reviewDigest)
  if (!/^[a-f0-9]{64}$/.test(reviewDigest)) throw new Error("Review context unavailable")
  return { reviewRef: discussionText(pin.reviewRef), reviewVersion: discussionVersion(pin.reviewVersion), reviewDigest, sectionId: discussionText(pin.sectionId) }
}

export function discussionMessage(value: unknown): ReviewDiscussionMessage {
  const message = discussionObject(value)
  const basis = discussionObject(message.sourceContext)
  const period = discussionObject(basis.period)
  if (!Array.isArray(basis.evidenceRefs)) throw new Error("Review evidence unavailable")
  return { id: discussionText(message.id), incarnation: discussionText(message.incarnation), version: discussionVersion(message.version), authorRef: discussionText(message.authorRef), body: discussionText(message.body), createdAt: discussionText(message.createdAt), sourceContext: {
    sourceRef: discussionText(basis.sourceRef), sourceIncarnation: discussionText(basis.sourceIncarnation), observedVersion: discussionVersion(basis.observedVersion), period: { start: discussionText(period.start), end: discussionText(period.end) }, evidenceRefs: basis.evidenceRefs as BusinessEvidenceRef[], reviewContext: discussionPin(basis.reviewContext),
  } }
}

export function discussionThread(value: unknown): ReviewDiscussionThread {
  const thread = discussionObject(value)
  if (!Array.isArray(thread.messages) || !thread.messages.length) throw new Error("Review discussion unavailable")
  return { id: discussionText(thread.id), recipientRef: discussionText(thread.recipientRef), state: discussionText(thread.state), messages: thread.messages.map(discussionMessage) }
}

export function discussionAnswer(value: unknown): ReviewPreparedAnswer {
  const answer = discussionObject(value)
  const projection = discussionObject(answer.projection)
  if (!Array.isArray(projection.values) || !Array.isArray(projection.components) || !Array.isArray(projection.missing) || !projection.context) throw new Error("Preserved projection unavailable")
  return { answerRef: discussionText(answer.answerRef), answer: discussionText(answer.answer), authorRef: discussionText(answer.authorRef), observationRef: discussionText(answer.observationRef), observedSourceVersion: discussionVersion(answer.observedSourceVersion), expectedScopeFingerprint: discussionText(answer.expectedScopeFingerprint), reviewContext: discussionPin(answer.reviewContext), projection: projection as DomainProjection }
}
