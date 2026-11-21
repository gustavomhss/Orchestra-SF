// T2a parity fence: native UI48/UI50 are real Orchestra routes, but the
// currently committed U32/U33 proof does not replace RPT-01 Office bytes or
// RPT-02 C05 historical human-answer selectors. Preserve the four red/green
// contracts until the native issuer and same-owner installed browser prove them.
import { expect, type Request, type Response } from "@playwright/test"
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
    // This case includes three installed routes and two different Office exports.
    info.setTimeout(240_000)
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — UI48/UI50 U32/U33 exibem review preservado e 25 registros; U33 exige download Office indisponivel. Falta prova de DOCX/PPTX de bytes originais e follow do source versionado." })
    const { app, corpus } = reports
    const { saved, budgetSection } = await reportsTest.step("Prepare and explicitly preserve the authorized dossier", () => prepareReview(page, app, corpus, info))
    await reportsTest.step("Edit the real January source once without refreshing the capture", () => changeForecast(page, app, corpus))
    const docx = await reportsTest.step("Download DOCX and assert values, periods, all identities and the long-note tail", () => exportReview(page, app, saved, corpus, "docx", info))
    const pptx = await reportsTest.step("Download PPTX and inspect every content slide", () => exportReview(page, app, saved, corpus, "pptx", info))
    expect(docx.artifact).not.toBe(pptx.artifact)
    expect(docx.sha256).not.toBe(pptx.sha256)
    await reportsTest.step("Open and reload the real meeting URL", () => openAndReopenMeeting(page, app, saved, budgetSection))
    await expectCapturedBudget(page, corpus, budgetSection)
    await reportsTest.step("Follow the captured source reference to current data with the same reporting year", () => followBudgetSource(page, app, saved, corpus, budgetSection))
  })

  reportsTest("RPT-02 confirms and reuses the exact human answer under C05, then rejects its edited version", async ({ page, reports }, info) => {
    // The full C05 journey includes explicit recovery and multiple authorized reopenings.
    info.setTimeout(240_000)
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — UI48 confirmations/resumo nao provam a resposta humana C05 exata, reuso sem nova escrita, rejeicao do seletor apos edit e historia intacta." })
    const { app, corpus } = reports
    const { saved, budgetSection } = await prepareReview(page, app, corpus, info)
    await changeForecast(page, app, corpus)
    const { reloadMeeting } = await openAndReopenMeeting(page, app, saved, budgetSection)
    const { api, answer } = await reportsTest.step("Confirm through the installed Review controls against the exact visible preserved projection", () => confirmHumanAnswer(page, app, saved, corpus, budgetSection, info, { loseReplyResponse: true, loseCreatedThreadRead: true }))
    const beforeReload = await api.version()
    const matchesAnswer = responseFor(app.dashboardURL, "collaboration-answer-read", "POST")
    const endpoint = new URL(app.dashboardURL)
    const withoutConfirmation = async (check: () => Promise<void>) => {
      let confirmations = 0
      const countConfirm = (request: Request) => {
        const url = new URL(request.url())
        if (request.method() === "POST" && url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
          url.searchParams.get("sf") === "collaboration-answer-confirm") confirmations++
      }
      page.on("request", countConfirm)
      try {
        await check()
        expect(confirmations, "Reopening must not submit a new confirmation").toBe(0)
      } finally {
        page.off("request", countConfirm)
      }
    }
    await reportsTest.step("Reuse after reopening without writing a new confirmation", () => withoutConfirmation(async () => {
      const [observedRead] = await Promise.all([
        page.waitForResponse((response) => matchesAnswer(response) &&
          object(response.request().postDataJSON()).questionId === answer.questionId)
          .then((response) => observed(response, "collaboration-answer-read")),
        reloadMeeting(),
      ])
      await expectCapturedBudget(page, corpus, budgetSection)
      expect(observedRead.payload).toEqual({ questionId: answer.questionId })
      expect(observedRead.value).toEqual(await expectReusedReviewAnswer(api, answer))
      await expectConfirmedAnswerVisible(page, answer)
      expect(await api.version()).toBe(beforeReload)
    }))
    await reportsTest.step("Keep question, reply and edit drafts through repeated authorized read loss without sending", () =>
      reconcilePrivateDraftsAfterReadLoss(page, app, api, answer, info))
    const edited = await reportsTest.step("Edit once through Review; reject old selector/reuse and read the exact original through history", () => editHumanAnswer(page, app, api, answer,
      `Edited human answer: the current source is ${corpus.after}. REPORTS_HUMAN_EDITED`, { recoverRequestFailure: true, info }))
    expect(edited.incarnation).toBe(answer.message.incarnation)
    expect(edited.version).toBe(answer.message.version + 1)
    expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectCapturedBudget(page, corpus, budgetSection)
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
    const matchesThread = responseFor(app.dashboardURL, "collaboration-thread-read", "POST")
    await withoutConfirmation(async () => {
      const [currentThread] = await Promise.all([
        page.waitForResponse((response) => matchesThread(response) &&
          object(response.request().postDataJSON()).id === answer.questionId).then(async (response) => {
          const read = await observed(response, "collaboration-thread-read")
          expect(read.payload).toEqual({ id: answer.questionId })
          return object(read.value)
        }),
        reloadMeeting(),
      ])
      expect(currentThread.id).toBe(answer.questionId)
      const reopenedMessages = (currentThread.messages as unknown[]).map(object).filter((message) => message.id === answer.message.id)
      expect(reopenedMessages).toHaveLength(1)
      expect(reopenedMessages).toMatchObject([recovered])
      await expect(page.getByRole("region", { name: "Review discussion", exact: true })
        .getByRole("article", { name: `Message ${answer.message.id}`, exact: true })).toContainText(recovered.body)
      expect(await api.version(), "Reopening after receipt recovery cannot write another edit").toBe(beforeReopen)
    })
    for (const prior of [answer.message, edited]) {
      const historical = object(await api.ok("collaboration-thread-history", {
        id: answer.questionId, messageId: prior.id, incarnation: prior.incarnation, version: prior.version,
      }))
      expect(historical.message).toMatchObject(prior)
    }
  })

  reportsTest("RPT-03 removes one authorized record without editing its source and creates only an explicit new revision", async ({ page, reports }, info) => {
    info.annotations.push({ type: "t2a-native-parity", description: "UI47 removes one record; UI48 reissues the exact preserved selection before a separately confirmed successor." })
    const { app, corpus } = reports
    const source = await readSourceData(page.request, app)
    const { saved } = await prepareReview(page, app, corpus, info, { removeOne: true })
    expect(saved.previousReviewRef).toBeUndefined()
    expect(await readSourceData(page.request, app)).toEqual(source)
    await changeForecast(page, app, corpus)
    const changedSource = await readSourceData(page.request, app)
    expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
    const next = await preserveNewRevision(page, app, saved, corpus)
    expect(await readSourceData(page.request, app)).toEqual(changedSource)
    await info.attach("explicit-new-revision", { body: JSON.stringify({
      previousReviewRef: next.previousReviewRef, reviewRef: next.id, projectCount: 24,
      preservedForecast: corpus.before, newForecast: corpus.after, period: corpus.annual,
      removedFromSelectionOnly: true,
    }, null, 2), contentType: "application/json" })
  })

  reportsTest("RPT-04 revokes the real session and clears cached meeting data, export and answer access", async ({ browser, page, reports }, info) => {
    info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — falta prova nativa de revogacao real e invalidacao dos caches de meeting, Office e resposta C05 para principal anterior, mais controle positivo com novo owner." })
    const { app, corpus } = reports
    const events: unknown[] = []
    const pending = new Set<Promise<void>>()
    const started = Date.now()
    let phase = "prepare"
    let dropped = 0
    const observe = (response: Response) => {
      const url = new URL(response.url())
      if (response.request().method() !== "GET" || url.origin !== app.origin) return
      const kind = url.pathname === "/api/sucafina/installations" ? "discovery"
        : url.pathname === `${app.mount}/api/ui/context` ? "context" : undefined
      if (!kind) return
      if (events.length >= 100) { events.shift(); dropped++ }
      const entry: { kind: string; phase: string; elapsedMs: number; http: number; result?: string; count?: number; operations?: unknown[] } =
        { kind, phase, elapsedMs: Date.now() - started, http: response.status() }
      events.push(entry)
      const work = response.json().then((body: unknown) => {
        if (!body || typeof body !== "object") return
        const value = body as Record<string, unknown>
        if (kind === "discovery") {
          if (Array.isArray(value.installations)) entry.count = value.installations.length
          return
        }
        if (typeof value.status === "string" && ["ok", "denied", "unauthenticated", "unavailable", "invalid"].includes(value.status)) entry.result = value.status
        const context = value.value && typeof value.value === "object" ? value.value as Record<string, unknown> : value
        if (!Array.isArray(context.availability)) return
        entry.operations = context.availability.flatMap((resource: unknown) => {
          if (!resource || typeof resource !== "object") return []
          const item = resource as Record<string, unknown>
          if (!Array.isArray(item.operations)) return []
          return item.operations.flatMap((operation: unknown) => {
            if (!operation || typeof operation !== "object") return []
            const op = operation as Record<string, unknown>
            if (!((item.family === "reviews" && op.operationId === "dashboard.dashboard-review") ||
              (item.family === "reviews" && item.resource === "report-export" && op.operationId === "reviews.report.prepare") ||
              (item.family === "files" && item.resource === "exports" && op.operationId === "files.export.review"))) return []
            return [{ id: op.operationId, state: ["ready", "unavailable", "denied", "degraded"].includes(String(op.state)) ? op.state : "other", operational: op.operational === true }]
          })
        })
      }).catch(() => undefined).finally(() => pending.delete(work))
      pending.add(work)
    }
    page.on("response", observe)
    try {
      const { saved, budgetSection } = await prepareReview(page, app, corpus, info)
      phase = "export"
      const artifact = await exportReview(page, app, saved, corpus, "docx", info)
      phase = "meeting"
      await openAndReopenMeeting(page, app, saved, budgetSection)
      phase = "answer"
      const { answer } = await confirmHumanAnswer(page, app, saved, corpus, budgetSection, info)
      phase = "revocation"
      await reportsTest.step("Revoke, deny retained old credentials, and verify a fresh positive control", () => revokeReportsSession({ browser, page, app, saved, answer, artifact, info }))
    } finally {
      page.off("response", observe)
      const cli = app.lifecycle?.() ?? null
      const f01 = await page.locator('[data-sf-host="owner-runtime231"]').evaluateAll((nodes) => nodes.map((node) => ({
        discovery: node.getAttribute("data-sf-discovery-state"), provider: node.getAttribute("data-sf-provider-state"),
        view: node.getAttribute("data-sf-view-state"),
      }))).catch(() => [])
      await Promise.race([Promise.allSettled([...pending]), new Promise((resolve) => setTimeout(resolve, 1000))])
      await info.attach("rpt-04-readiness", { contentType: "application/json", body: JSON.stringify({ phase, cli, f01, events, dropped, pending: pending.size }, null, 2) }).catch(() => undefined)
    }
  })
})
