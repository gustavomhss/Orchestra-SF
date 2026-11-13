import { createReviewBrowser } from "../../../product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../product/reviews/workspace.ts"
import type { ReviewAgendaItem } from "../../../product/reviews/selection.ts"

// Test mount only: the UI, browser client and HTTP handlers are the production implementations.
const root = document.querySelector("main")
const source = document.querySelector('script[type="application/json"]')
if (!root || !source?.textContent) throw new Error("WP07_BROWSER_TEST_MOUNT_UNAVAILABLE")
const items: ReviewAgendaItem[] = JSON.parse(source.textContent)
const reviewRef = new URL(window.location.href).searchParams.get("review")
if (reviewRef) {
  root.append(createReviewBrowser({
    reviewRef,
    checkUpdate: async () => ({ status: "unavailable", reason: "update-check-not-mounted-in-test" }),
    requestUpdate: () => { window.location.assign(window.location.pathname) },
  }).element)
} else {
  root.append(createReviewPreparationView({
    items,
    openReview: (reference) => { window.location.assign(`${window.location.pathname}?review=${encodeURIComponent(reference)}`) },
  }).element)
}
