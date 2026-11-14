import { createReviewBrowser } from "../../../../modules/sucafina/Sucafinav1/product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../../modules/sucafina/Sucafinav1/product/reviews/workspace.ts"
import type { ReviewAgendaItem } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"

const root = document.querySelector<HTMLElement>("[data-sf-review-workspace]")
const bootstrap = document.querySelector<HTMLScriptElement>("script[data-sf-review-bootstrap]")
if (root && bootstrap) {
  const value: unknown = JSON.parse(bootstrap.textContent ?? "null")
  if (value && typeof value === "object" && "reviewRef" in value && typeof value.reviewRef === "string") {
    const view = createReviewBrowser({ reviewRef: value.reviewRef,
      checkUpdate: async () => ({ status: "unavailable", reason: "choose-current-sources-for-new-revision" }),
      requestUpdate: () => { const url = new URL(location.href); url.searchParams.delete("reviewRef"); location.assign(url) },
    })
    root.replaceChildren(view.element)
    window.addEventListener("pagehide", () => view.dispose(), { once: true })
  } else if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) {
    // Only the authenticated host emits this bootstrap. The agenda endpoint validates it again.
    const view = createReviewPreparationView({ items: value.items as ReviewAgendaItem[], openReview: (reviewRef) => {
      const url = new URL(location.href)
      url.search = new URLSearchParams({ sf: "review", reviewRef }).toString()
      location.assign(url)
    } })
    root.replaceChildren(view.element)
    window.addEventListener("pagehide", () => view.dispose(), { once: true })
  }
}
