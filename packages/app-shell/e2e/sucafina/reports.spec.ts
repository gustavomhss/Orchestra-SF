import { expect } from "@playwright/test"
import { reportsTest } from "./reports-support/fixture.ts"
import { changeForecast, expectCapturedBudget, exportReview, followBudgetSource, openAndReopenMeeting, prepareReview, preserveNewRevision, readSourceData } from "./reports-support/review-flow.ts"
import { expectReusedReviewAnswer } from "./reports-support/confirmation.ts"
import { confirmHumanAnswer, editHumanAnswer, expectConfirmedAnswerVisible, observed } from "./reports-support/human-answer-flow.ts"
import { object, readReview, responseFor } from "./reports-support/model.ts"
import { revokeReportsSession } from "./reports-support/revocation.ts"

// Nominal CI-UI-REPORTS: e2e/playwright.production.config.ts, this file only,
// workers=1, retries=0. The fixture launches the real CLI installation in Actions.
// These four scenarios exercise coherent C6 plus the owned Reports changes.
// Missing authority resources fail the assertions; no scenario becomes skip/xfail.
// These worker options must be set at file scope. Real operator credentials
// must never enter retained Playwright API/network traces; explicit synthetic
// content receipts and downloaded reports remain the evidence.
reportsTest.use({ trace: "off", video: "off", screenshot: "off" })

reportsTest.describe("CI-UI-REPORTS · real preserved dossier", () => {
  reportsTest.describe.configure({ retries: 0, timeout: 180_000 })

  reportsTest("RPT-01 preserves authorized sources, exports 25 real projects and reopens before following the current source", async ({ page, reports }, info) => {
    const { app, corpus } = reports
    const { saved } = await reportsTest.step("Prepare and explicitly preserve the authorized dossier", () => prepareReview(page, app, corpus, info))
    await reportsTest.step("Edit the real January source once without refreshing the capture", () => changeForecast(page, app, corpus))
    expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
    const docx = await reportsTest.step("Download DOCX and assert values, periods, all identities and the long-note tail", () => exportReview(page, app, saved, corpus, "docx", info))
    const pptx = await reportsTest.step("Download PPTX and inspect every content slide", () => exportReview(page, app, saved, corpus, "pptx", info))
    expect(docx.artifact).not.toBe(pptx.artifact)
    expect(docx.sha256).not.toBe(pptx.sha256)
    await reportsTest.step("Open and reload the real meeting URL", () => openAndReopenMeeting(page, app, saved))
    await expectCapturedBudget(page, corpus)
    await reportsTest.step("Follow the captured source reference to current data with the same reporting year", () => followBudgetSource(page, app, saved, corpus))
  })

  reportsTest("RPT-02 confirms and reuses the exact human answer under C05, then rejects its edited version", async ({ page, reports }, info) => {
    const { app, corpus } = reports
    const { saved } = await prepareReview(page, app, corpus, info)
    await changeForecast(page, app, corpus)
    await openAndReopenMeeting(page, app, saved)
    const { api, answer } = await reportsTest.step("Confirm through the installed Review controls against the exact visible preserved projection", () => confirmHumanAnswer(page, app, saved, corpus, info, { loseReplyResponse: true }))
    const beforeReload = await api.version()
    const read = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
    const answerRead = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-answer-read", "POST"))
    await page.reload()
    const reopened = await read
    expect(reopened.status()).toBe(200)
    expect(object(await reopened.json()).value).toEqual(saved)
    const meeting = page.getByRole("region", { name: "Preserved review meeting", exact: true })
    await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Projects")
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expectCapturedBudget(page, corpus)
    await reportsTest.step("Reuse after reopening without writing a new confirmation", async () => {
      const observedRead = await observed(await answerRead, "collaboration-answer-read")
      expect(observedRead.payload).toEqual({ questionId: answer.questionId })
      expect(observedRead.value).toEqual(await expectReusedReviewAnswer(api, answer))
      expect(await api.version()).toBe(beforeReload)
      await expectConfirmedAnswerVisible(page, answer)
    })
    const edited = await reportsTest.step("Edit once through Review; reject old selector/reuse and read the exact original through history", () => editHumanAnswer(page, app, api, answer,
      `Edited human answer: the current source is ${corpus.after}. REPORTS_HUMAN_EDITED`, { recoverRequestFailure: true, info }))
    expect(edited.incarnation).toBe(answer.message.incarnation)
    expect(edited.version).toBe(answer.message.version + 1)
    expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectCapturedBudget(page, corpus)
    await info.attach("human-answer-edit-negative", { body: JSON.stringify({
      reviewRef: saved.id, questionId: answer.questionId, messageId: answer.message.id,
      originalVersion: answer.message.version, currentVersion: edited.version,
      oldSelector: "stale", oldConfirmation: "unavailable", historicalMessage: "unchanged", preservedReview: "unchanged",
    }, null, 2), contentType: "application/json" })
  })

  reportsTest("RPT-03 removes one authorized record without editing its source and creates only an explicit new revision", async ({ page, reports }, info) => {
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

  reportsTest("RPT-04 revokes the real session and clears cached meeting data, export and answer access", async ({ browser, page, reports }, info) => {
    const { app, corpus } = reports
    const { saved } = await prepareReview(page, app, corpus, info)
    const artifact = await exportReview(page, app, saved, corpus, "docx", info)
    await openAndReopenMeeting(page, app, saved)
    const { answer } = await confirmHumanAnswer(page, app, saved, corpus, info)
    await reportsTest.step("Revoke, deny retained old credentials, and verify a fresh positive control", () => revokeReportsSession({ browser, page, app, saved, answer, artifact, info }))
  })
})
