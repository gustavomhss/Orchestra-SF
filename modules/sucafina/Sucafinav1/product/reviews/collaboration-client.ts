import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"

export type ReviewDiscussionPin = { reviewRef: string; reviewVersion: number; reviewDigest: string; sectionId: string }
export type ReviewDiscussionBasis = { sourceRef: string; sourceIncarnation: string; observedVersion: number; period: Period; evidenceRefs: readonly BusinessEvidenceRef[] }
export type ReviewDiscussionMessage = { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string; sourceContext: ReviewDiscussionBasis & { reviewContext: ReviewDiscussionPin } }
export type ReviewDiscussionThread = { id: string; recipientRef: string; state: string; messages: ReviewDiscussionMessage[] }
export type ReviewPreparedAnswer = { answerRef: string; answer: string; authorRef: string; observationRef: string; observedSourceVersion: number; expectedScopeFingerprint: string; reviewContext: ReviewDiscussionPin; projection: DomainProjection }

export type ReviewDiscussionTransport = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  url: () => string
  binding: () => string | undefined
}

export class ReviewDiscussionError extends Error {
  constructor(message: string, readonly kind: "access" | "recoverable" | "conflict" | "invalid", readonly outcome: "rejected" | "unknown") {
    super(message)
    this.name = "ReviewDiscussionError"
  }
}

/** Presentation transport only. The binding is an equality guard, never a grant.
 * The installed host must check it before invoking an action and echo it.
 * Missing support closes this discussion, including its recipients preflight.
 */
export function createReviewDiscussionClient(accessLost: () => void, transport: ReviewDiscussionTransport = {
  fetch: (...args) => fetch(...args),
  url: () => location.href,
  binding: () => document.querySelector<HTMLMetaElement>('meta[name="sf-access-revision"]')?.content,
}) {
  const pending = new Set<AbortController>()
  const binding = transport.binding()
  const endpoint = new URL(transport.url())
  let disposed = false
  const dispose = () => { disposed = true; pending.forEach((controller) => controller.abort()); pending.clear() }
  const lost = () => {
    if (!disposed) { dispose(); accessLost() }
    return new ReviewDiscussionError("Review discussion access changed. Reopen an authorized review.", "access", "rejected")
  }
  const unverified = () => {
    // An unsupported host is not evidence that the independent meeting was revoked.
    dispose()
    return new ReviewDiscussionError("Review discussion binding could not be verified. Reopen an authorized review.", "access", "rejected")
  }
  const checkBinding = () => {
    if (disposed) throw new ReviewDiscussionError("Review discussion unavailable", "access", "rejected")
    if (!binding || !/^[a-f0-9]{64}$/.test(binding)) throw unverified()
    if (transport.binding() !== binding) throw lost()
    const current = new URL(transport.url())
    if (current.origin !== endpoint.origin || current.pathname !== endpoint.pathname) throw lost()
  }
  const post = async (mode: string, payload: unknown, key?: string) => {
    checkBinding()
    const url = new URL(transport.url())
    url.search = new URLSearchParams({ sf: mode }).toString()
    url.hash = ""
    const controller = new AbortController()
    const bodyText = JSON.stringify(payload)
    pending.add(controller)
    const deadline = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await transport.fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-SF-Review-Binding": binding!, ...(key ? { "Idempotency-Key": key } : {}) }, body: bodyText,
      }).catch(() => undefined)
      checkBinding()
      if (!response || controller.signal.aborted) throw new ReviewDiscussionError("The response was not received. Your draft and action are retained.", "recoverable", "unknown")
      const destination = response.url ? new URL(response.url, url) : undefined
      if (response.status === 401 || response.status === 403 || (response.redirected && (destination?.origin !== url.origin || /\/auth\/login\/?$/.test(destination.pathname)))) throw lost()
      const body: unknown = await response.json().catch(() => undefined)
      checkBinding()
      if (controller.signal.aborted) throw new ReviewDiscussionError("The response was not received. Your draft and action are retained.", "recoverable", "unknown")
      const result = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : undefined
      if (result?.status === "denied") throw lost()
      // C6's reader can mask denial as unavailable. Only this read is terminal;
      // an action returning the same legacy 503 still has an unknown outcome.
      if (mode === "collaboration-thread-read" && result?.reason === "thread-access-unavailable") throw lost()
      if (response.status === 409 || result?.status === "stale" || result?.status === "conflict" || result?.status === "provider-conflict") {
        // Only these producer results establish a precommit CAS rejection.
        // Idempotency/target conflicts can refer to an earlier durable commit.
        const rejected = result?.reason === "product-state-changed" || result?.reason === "thread-changed"
        throw new ReviewDiscussionError(typeof result?.reason === "string" ? result.reason : "The action conflicts with a newer version.", "conflict", rejected ? "rejected" : "unknown")
      }
      if (response.status >= 500)
        throw new ReviewDiscussionError(typeof result?.reason === "string" ? result.reason : "The action outcome is unavailable.", "recoverable", "unknown")
      if (!response.ok || result?.status !== "ok")
        throw new ReviewDiscussionError(typeof result?.reason === "string" ? result.reason : "Review discussion response unavailable", "invalid", "unknown")
      const echo = response.headers.get("X-SF-Review-Binding")
      if (echo === null) throw unverified()
      if (echo !== binding) throw lost()
      return result.value
    } finally {
      clearTimeout(deadline)
      pending.delete(controller)
    }
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
      if (thread.id !== id) throw lost()
      return thread
    },
    dispose,
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

