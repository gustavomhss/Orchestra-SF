import { createReviewPreparationBrowser } from "../../../product/reviews/browser.ts"
import { createReviewContributionView } from "../../../product/reviews/workspace.ts"
import type { ReviewContributionRequest } from "../../../product/reviews/contribution.ts"

// Test-only mount of the production browser client and contribution view. The HTTP
// server supplies display fixtures, not a verified resident run or native receipt.
const root = document.querySelector("main")
const source = document.querySelector('script[type="application/json"]')
if (!root || !source?.textContent) throw new Error("WP07_CONTRIBUTION_MOUNT_UNAVAILABLE")
const request: ReviewContributionRequest = JSON.parse(source.textContent)
const client = createReviewPreparationBrowser()
const completed = document.createElement("p")
completed.setAttribute("role", "status")
completed.setAttribute("aria-label", "Contribution HTTP completions")
completed.textContent = "0"
const observations = { completed: 0 }
const completion = new MessageChannel()
completion.port1.onmessage = () => { completed.textContent = String(++observations.completed) }
const navigation = document.createElement("p")
navigation.setAttribute("role", "status")
navigation.setAttribute("aria-label", "Host navigation")
navigation.textContent = "No navigation"
const open = async (kind: "contribution" | "decision-result" | "review", reference: string) => {
  const response = await fetch("/test-contribution-host", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, reference }) })
  if (!response.ok) throw new Error("WP07_TEST_DESTINATION_DENIED")
  navigation.textContent = `Opened ${kind} ${reference}`
}
const view = createReviewContributionView({
  request,
  client: { ...client, contribution: (input) => {
    const pending = client.contribution(input)
    // Observe the unchanged real HTTP Promise after its continuation microtasks.
    // This lets the test await completion of a stale read without a timed sleep.
    void pending.then(() => completion.port2.postMessage(null), () => completion.port2.postMessage(null))
    return pending
  } },
  openContribution: (reference) => open("contribution", reference),
  openDecisionResult: (reference) => open("decision-result", reference),
  openReview: (reference) => open("review", reference),
})
const refresh = document.createElement("button")
refresh.type = "button"
refresh.textContent = "Host refresh"
refresh.addEventListener("click", () => { void view.refresh() })
const dispose = document.createElement("button")
dispose.type = "button"
dispose.textContent = "Host dispose"
dispose.addEventListener("click", () => { view.dispose() })
root.append(refresh, dispose, completed, navigation, view.element)
void view.refresh()
