import type { ReviewActionClosure, ReviewActionHandoff } from "./closure-action.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { createMeetingViewFromReads } from "./meeting.ts"

/** Uses the mounted application's same-origin route; each read obtains a fresh host lease. */
export function createReviewBrowser(input: {
  reviewRef: string
  checkUpdate: (reviewRef: string) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
}) {
  const read = async (reviewRef: string): Promise<PortResult<PreservedReview>> => {
    const url = new URL(window.location.href)
    url.search = ""
    url.hash = ""
    url.searchParams.set("sf", "review-read")
    url.searchParams.set("reviewRef", reviewRef)
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
    if (!response?.ok) return { status: "unavailable", reason: "review-unavailable" }
    const result: unknown = await response.json().catch(() => undefined)
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("id" in result.value) || result.value.id !== reviewRef || !("sections" in result.value) || !Array.isArray(result.value.sections) || !("comments" in result.value) || !Array.isArray(result.value.comments)) return { status: "unavailable", reason: "review-unavailable" }
    return { status: "ok", value: result.value as PreservedReview }
  }
  const view = createMeetingViewFromReads({ reviewRef: input.reviewRef, read, checkUpdate: input.checkUpdate, requestUpdate: input.requestUpdate })
  return {
    ...view,
    async confirmAction(handoff: ReviewActionHandoff): Promise<PortResult<{ closureRef: string; review: PreservedReview; topic: HotTopic; relationId: string }>> {
      const url = new URL(window.location.href)
      url.search = ""
      url.hash = ""
      url.searchParams.set("sf", "review-close")
      const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewRef: input.reviewRef, handoff }) }).catch(() => undefined)
      if (!response?.ok) return { status: "unavailable", reason: "handoff-unavailable" }
      const result: unknown = await response.json().catch(() => undefined)
      if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("closureRef" in result.value) || typeof result.value.closureRef !== "string") return { status: "unavailable", reason: "handoff-unavailable" }
      return result as PortResult<{ closureRef: string; review: PreservedReview; topic: HotTopic; relationId: string }>
    },
    async readClosure(closureRef: string): Promise<PortResult<{ closure: ReviewActionClosure; review: PreservedReview; currentAction: HotTopic }>> {
      const url = new URL(window.location.href)
      url.search = ""
      url.hash = ""
      url.searchParams.set("sf", "review-closure")
      url.searchParams.set("closureRef", closureRef)
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
      if (!response?.ok) return { status: "unavailable", reason: "closure-unavailable" }
      const result: unknown = await response.json().catch(() => undefined)
      if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("closure" in result.value) || !result.value.closure || typeof result.value.closure !== "object" || !("id" in result.value.closure) || result.value.closure.id !== closureRef) return { status: "unavailable", reason: "closure-unavailable" }
      return result as PortResult<{ closure: ReviewActionClosure; review: PreservedReview; currentAction: HotTopic }>
    },
  }
}
