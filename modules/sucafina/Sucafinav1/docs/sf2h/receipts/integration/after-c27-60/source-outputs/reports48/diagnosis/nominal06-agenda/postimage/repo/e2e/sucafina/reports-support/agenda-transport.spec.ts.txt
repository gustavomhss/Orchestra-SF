import { reportsTest } from "./fixture.ts"
import { prepareReview } from "./review-flow.ts"

// Surgical transport diagnosis through the same real CLI, authority and corpus.
// This one preparation/preserve gate does not replace any of the four nominals.
reportsTest.use({ trace: "off", video: "off", screenshot: "off" })

reportsTest.describe("CI-UI-REPORTS · agenda transport diagnosis", () => {
  reportsTest.describe.configure({ retries: 0, timeout: 180_000 })

  reportsTest("RPT-DIAG-AGENDA-01 observes actual agenda transport and preserves the authorized dossier", async ({ page, reports }, info) => {
    await prepareReview(page, reports.app, reports.corpus, info)
  })
})
