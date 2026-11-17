// T2a parity fence: native UI48/UI50 are real Orchestra routes, but the
// currently committed U32/U33 proof does not replace RPT-01 Office bytes or
// RPT-02 C05 historical human-answer selectors. Preserve the four red/green
// contracts until the native issuer and same-owner installed browser prove them.
import { expect } from "@playwright/test"
import { reportsTest } from "./reports-support/fixture.ts"
import { changeForecast, expectCapturedBudget, exportReview, followBudgetSource, openAndReopenMeeting, prepareReview, preserveNewRevision, readSourceData } from "./reports-support/review-flow.ts"
import { expectReusedReviewAnswer } from "./reports-support/confirmation.ts"
import { confirmHumanAnswer, editHumanAnswer, expectConfirmedAnswerVisible, observed } from "./reports-support/human-answer-flow.ts"
import { object, readReview, responseFor } from "./reports-support/model.ts"
import { revokeReportsSession } from "./reports-support/revocation.ts"
import { reconcilePrivateDraftsAfterReadLoss } from "./reports-support/read-reconciliation.ts"

// Nominal CI-UI-REPORTS: e2e/playwright.production.config.ts, this file only,
// workers=1, retries=0. The fixture launches the real CLI installation in Actions.
// These four scenarios exercise the explicitly manifested composed candidate.
// Missing authority resources fail the assertions; no scenario becomes skip/xfail.
// These worker options must be set at file scope. Real operator credentials
// must never enter retained Playwright API/network traces; explicit synthetic
// content receipts and downloaded reports remain the evidence.
reportsTest.use({ trace: "off", video: "off", screenshot: "off" })

reportsTest.describe("CI-UI-REPORTS · real preserved dossier", () => {
  reportsTest.describe.configure({ retries: 0, timeout: 180_000 })

  reportsTest("RPT-01 preserves authorized sources, exports 25 real projects and reopens before following the current source", async ({ page, reports }, info) => {
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — UI48/UI50 U32/U33 exibem review preservado e 25 registros; U33 exige download Office indisponivel. Falta prova de DOCX/PPTX de bytes originais e follow do source versionado." })
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
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — UI48 confirmations/resumo nao provam a resposta humana C05 exata, reuso sem nova escrita, rejeicao do seletor apos edit e historia intacta." })
    const { app, corpus } = reports
    const { saved } = await prepareReview(page, app, corpus, info)
    await changeForecast(page, app, corpus)
    await openAndReopenMeeting(page, app, saved)
    const { api, answer } = await reportsTest.step("Confirm through the installed Review controls against the exact visible preserved projection", () => confirmHumanAnswer(page, app, saved, corpus, info, { loseReplyResponse: true, loseCreatedThreadRead: true }))
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
    await reportsTest.step("Keep question, reply and edit drafts through repeated authorized read loss without sending", () =>
      reconcilePrivateDraftsAfterReadLoss(page, app, api, answer, info))
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
    const recovered = await reportsTest.step("Recover a committed edit after its response is lost, using only the exact original intent", () =>
      editHumanAnswer(page, app, api, { ...answer, message: edited },
        "Second explicit human edit retained through response loss. REPORTS_HUMAN_EDIT_LOST_RESPONSE", { loseResponse: true, info }))
    expect(recovered.incarnation).toBe(answer.message.incarnation)
    expect(recovered.version).toBe(answer.message.version + 2)
    const beforeReopen = await api.version()
    const threadRead = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    const reviewRead = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
    await page.reload()
    const [threadResponse, reviewResponse] = await Promise.all([threadRead, reviewRead])
    expect(threadResponse.status()).toBe(200)
    expect(reviewResponse.status()).toBe(200)
    expect(object(await reviewResponse.json()).value).toEqual(saved)
    const currentThread = object(object(await threadResponse.json()).value)
    const reopenedMessages = (currentThread.messages as unknown[]).map(object).filter((message) => message.id === answer.message.id)
    expect(reopenedMessages).toHaveLength(1)
    expect(reopenedMessages).toMatchObject([recovered])
    await expect(page.getByRole("region", { name: "Review discussion", exact: true })
      .getByRole("article", { name: `Message ${answer.message.id}`, exact: true })).toContainText(recovered.body)
    expect(await api.version(), "Reopening after receipt recovery cannot write another edit").toBe(beforeReopen)
    for (const prior of [answer.message, edited]) {
      const historical = object(await api.ok("collaboration-thread-history", {
        id: answer.questionId, messageId: prior.id, incarnation: prior.incarnation, version: prior.version,
      }))
      expect(historical.message).toMatchObject(prior)
    }
  })

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

  reportsTest("RPT-04 revokes the real session and clears cached meeting data, export and answer access", async ({ browser, page, reports }, info) => {
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — falta prova nativa de revogacao real e invalidacao dos caches de meeting, Office e resposta C05 para principal anterior, mais controle positivo com novo owner." })
    const { app, corpus } = reports
    const { saved } = await prepareReview(page, app, corpus, info)
    const artifact = await exportReview(page, app, saved, corpus, "docx", info)
    await openAndReopenMeeting(page, app, saved)
    const { answer } = await confirmHumanAnswer(page, app, saved, corpus, info)
    await reportsTest.step("Revoke, deny retained old credentials, and verify a fresh positive control", () => revokeReportsSession({ browser, page, app, saved, answer, artifact, info }))
  })
})
