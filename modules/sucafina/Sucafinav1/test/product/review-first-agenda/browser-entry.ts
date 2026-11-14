import { createReviewAgendaDiscoveryBrowser } from "../../../product/reviews/agenda-picker.ts"
import { createReviewBrowser } from "../../../product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../product/reviews/workspace.ts"

declare global { interface Window { firstAgendaDiscovery?: Promise<void> } }

// The fixture supplies only this empty host mount; all rendered controls and reads
// come from production modules. Installed router ownership remains Reports E2E.
const root = document.querySelector("main")
if (!root) throw new Error("First agenda host mount missing")
const reviewRef = new URL(window.location.href).searchParams.get("reviewRef")
const openReview = (ref: string) => {
  window.location.assign(`/product?reviewRef=${encodeURIComponent(ref)}`)
}
if (reviewRef) {
  root.append(createReviewBrowser({ reviewRef, checkUpdate: async () => ({ status: "unavailable", reason: "not-selected-in-first-agenda-proof" }), requestUpdate: () => undefined }).element)
} else {
  const discover = createReviewAgendaDiscoveryBrowser()
  root.append(createReviewPreparationView({ items: [], discoveryPeriod: { start: "2026-01-01", end: "2026-12-31" },
    discover: (query) => {
      const result = discover(query)
      // Observe completion for the late-response assertion without replacing any result.
      window.firstAgendaDiscovery = result.then(() => undefined)
      return result
    }, openReview }).element)
}
