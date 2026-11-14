import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort } from "./port.ts"
import type { createReviewThreadComments } from "./thread-access.ts"

export type ReviewCurrentThread = {
  threadId: string
  kind: "comment" | "review"
  view: "current"
  messages: readonly { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string }[]
}

/** Opens the actual current C06 conversation from an authorized preserved comment.
 * Both the immutable review and current thread are reread before any body leaves.
 */
export function createReviewCurrentThread(input: {
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  threads: Parameters<typeof createReviewThreadComments>[0]["threads"]
  host: Pick<DomainPortHost, "revalidate">
}) {
  return async (reviewRef: string, commentId: string, context: TrustedDomainContext): Promise<PortResult<ReviewCurrentThread>> => {
    if (typeof reviewRef !== "string" || !reviewRef.trim() || typeof commentId !== "string" || !commentId.trim()) return { status: "needs-input", reason: "invalid-review-comment" }
    const match = /^thread-message:([^:]+):([^:]+):([^:]+):([a-f0-9]{64})$/.exec(commentId)
    if (!match) return { status: "unavailable", reason: "current-thread-unavailable" }
    const parts = match.slice(1, 4).map((part) => { try { return decodeURIComponent(part!) } catch { return "" } })
    if (parts.some((part, index) => !part || encodeURIComponent(part) !== match[index + 1])) return { status: "unavailable", reason: "current-thread-unavailable" }
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "current-thread-unavailable" }
    const first = await input.reviews.read(reviewRef, context)
    if (first.status !== "ok" || first.value.comments.filter((comment) => comment.id === commentId).length !== 1) return { status: "denied", reason: "current-thread-unavailable" }
    const review = structuredClone(first.value)
    const opened = await input.threads.read(parts[0]!, context)
    if (opened.status !== "ok" || opened.value.id !== parts[0] || !["comment", "review"].includes(opened.value.kind) || !Array.isArray(opened.value.messages)) return { status: "unavailable", reason: "current-thread-unavailable" }
    const thread = structuredClone(opened.value)
    if (thread.messages.some((message) => !message || [message.id, message.incarnation, message.authorRef].some((value) => typeof value !== "string" || !value.trim()) || !Number.isSafeInteger(message.version) || message.version < 1 || typeof message.body !== "string" || typeof message.createdAt !== "string" || !Number.isFinite(Date.parse(message.createdAt))) || new Set(thread.messages.map((message) => message.id)).size !== thread.messages.length || !thread.messages.some((message) => message.id === parts[1] && message.incarnation === parts[2])) return { status: "unavailable", reason: "current-thread-unavailable" }
    const [again, current] = await Promise.all([input.reviews.read(reviewRef, context), input.threads.read(parts[0]!, context)])
    if (again.status !== "ok" || current.status !== "ok" || digestSfValue(again.value) !== digestSfValue(review) || digestSfValue(current.value) !== digestSfValue(thread) || !await input.host.revalidate(context)) return { status: "denied", reason: "current-thread-unavailable" }
    return { status: "ok", value: { threadId: thread.id, kind: thread.kind as "comment" | "review", view: "current", messages: thread.messages.map(({ id, incarnation, version, authorRef, body, createdAt }) => ({ id, incarnation, version, authorRef, body, createdAt })) } }
  }
}
