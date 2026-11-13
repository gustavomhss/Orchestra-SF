import { createReviewBrowser } from "../../../product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../product/reviews/workspace.ts"
import type { ReviewAgendaItem } from "../../../product/reviews/selection.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"

// Test mount only: the UI, browser client and HTTP handlers are the production implementations.
const root = document.querySelector("main")
const source = document.querySelector('script[type="application/json"]')
if (!root || !source?.textContent) throw new Error("WP07_BROWSER_TEST_MOUNT_UNAVAILABLE")
const items: ReviewAgendaItem[] = JSON.parse(source.textContent)
const page = new URL(window.location.href)
const reviewRef = page.searchParams.get("review")
const host = (operation: string, values: Record<string, string>) => {
  const url = new URL("/sucafina/test-review-host", page)
  url.search = new URLSearchParams({ operation, ...values }).toString()
  return fetch(url, { credentials: "same-origin", cache: "no-store" })
}
if (reviewRef) {
  root.append(createReviewBrowser({
    reviewRef,
    checkUpdate: async (reference): Promise<PortResult<{ available: boolean }>> => {
      const response = await host("check-update", { reviewRef: reference })
      return await response.json() as PortResult<{ available: boolean }>
    },
    requestUpdate: (reference) => { window.location.assign(`${window.location.pathname}?previousReviewRef=${encodeURIComponent(reference)}`) },
    openSource: async (reference) => {
      // The test host rechecks the opaque reference. No source DOM or C17 history is simulated.
      const response = await host("open-source", { reviewRef, refDigest: reference.refDigest })
      if (!response.ok) throw new Error("WP07_TEST_HOST_SOURCE_DENIED")
    },
    openReviewSection: async (reference, sectionId) => {
      const response = await host("open-review", { reviewRef: reference, sectionId })
      if (!response.ok) throw new Error("WP07_TEST_HOST_REVIEW_DENIED")
      // The exercised destination is the first selected section in the preserved order.
      window.location.assign(`${window.location.pathname}?review=${encodeURIComponent(reference)}`)
    },
  }).element)
} else {
  root.append(createReviewPreparationView({
    items,
    ...(page.searchParams.get("previousReviewRef") ? { previousReviewRef: page.searchParams.get("previousReviewRef")! } : {}),
    openReview: (reference) => { window.location.assign(`${window.location.pathname}?review=${encodeURIComponent(reference)}`) },
  }).element)
}
