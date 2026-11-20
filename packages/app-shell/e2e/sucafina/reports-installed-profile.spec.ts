// CI-only profile of the original complete RPT-03 on product 9bcfc9de18a0ddd0dc00edecbddc221649db07c3.
// The test body below is byte-identical to reports.spec.ts; no assertion, retry or budget changes.
import { expect } from "@playwright/test"
import { reportsTest } from "./reports-support/fixture.ts"
import { changeForecast, prepareReview, preserveNewRevision, readSourceData } from "./reports-support/review-flow.ts"
import { readReview } from "./reports-support/model.ts"

reportsTest.use({ trace: "off", video: "off", screenshot: "off" })

reportsTest.describe("CI-UI-REPORTS · real preserved dossier", () => {
  reportsTest.describe.configure({ retries: 0, timeout: 180_000 })

  reportsTest("RPT-03 removes one authorized record without editing its source and creates only an explicit new revision", async ({ page, reports }, info) => {
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — native UI48/U32 nao demonstra a exclusao da selecao (24/25), source imutavel e nova revisao apos edicao de previsao." })
    const { app, corpus } = reports
    const source = await readSourceData(page.request, app)
    const { saved } = await prepareReview(page, app, corpus, info, { removeOne: true })
    expect(await readSourceData(page.request, app)).toEqual(source)
    await changeForecast(page, app, corpus)
    expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
    const next = await preserveNewRevision(page, app, saved, corpus)
    await info.attach("explicit-new-revision", { body: JSON.stringify({
      previousReviewRef: saved.id, reviewRef: next.id, projectCount: 24,
      preservedForecast: corpus.before, newForecast: corpus.after, period: corpus.annual,
      removedFromSelectionOnly: true,
    }, null, 2), contentType: "application/json" })
  })

})
