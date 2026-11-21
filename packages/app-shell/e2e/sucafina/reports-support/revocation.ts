import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { APIRequestContext, Browser, Page, Request, Route, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAnswer } from "./confirmation.ts"
import { expectReusedReviewAnswer, reportsCollaboration } from "./confirmation.ts"
import { expectConfirmedAnswerVisible, observed } from "./human-answer-flow.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, productURL, readReview, responseFor, text } from "./model.ts"

export async function revokeReportsSession(input: {
  browser: Browser; page: Page; app: ReportsInstallation; saved: PreservedReview; answer: ReviewAnswer
  artifact: { href: string; sha256: string }; info: TestInfo
}) {
  const { browser, page, app, saved, answer, artifact, info } = input
  // A second context retains the old, real credential after logout clears the first.
  // Never persist this state or attach cookies/enrollment codes to the receipt.
  const old = await browser.newContext({ storageState: await page.context().storageState() })
  const fresh = await browser.newContext()
  const cleanup: (() => Promise<void>)[] = []
  try {
    const retained = await old.newPage()
    const retainedApi = reportsCollaboration(old.request, app.dashboardURL)
    const versionBeforeReopen = await retainedApi.version()
    const browserAnswer = retained.waitForResponse(responseFor(app.dashboardURL, "collaboration-answer-read", "POST"))
    const [savedAgain, response] = await test.step("Reopen the real retained session and read its confirmed answer", () =>
      Promise.all([
        readReview(old.request, app.dashboardURL, saved.id),
        browserAnswer,
        retained.goto(page.url()),
      ]))
    expect(savedAgain).toEqual(saved)
    const browserRead = await observed(response, "collaboration-answer-read")
    expect(browserRead.payload).toEqual({ questionId: answer.questionId })
    expect(browserRead.value).toEqual({ answerRef: answer.answerRef, answer: answer.message.body, authorRef: answer.message.authorRef,
      observedVersion: answer.observedSourceVersion, reviewContext: answer.pin })
    expect(await retainedApi.version(), "Retained browser reuse must not write another confirmation").toBe(versionBeforeReopen)
    const meeting = retained.getByRole("region", { name: "Preserved review meeting", exact: true })
    await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Projects")
    await expectConfirmedAnswerVisible(retained, answer)
    const cookieName = `sucafina_operator_${createHash("sha256").update(JSON.stringify([app.mount, app.actorId])).digest("hex").slice(0, 24)}`
    const [localCookies, retainedCookies] = await Promise.all([
      page.context().cookies(app.dashboardURL),
      old.cookies(app.dashboardURL),
    ])
    const localSession = localCookies.filter((cookie) => cookie.name === cookieName && cookie.path === app.mount)
    const retainedSession = retainedCookies.filter((cookie) => cookie.name === cookieName && cookie.path === app.mount)
    // Assert the contexts share the installed operator session without printing credentials on failure.
    expect(localSession.length === 1 && retainedSession.length === 1 && !!localSession[0]?.value &&
      localSession[0].value === retainedSession[0]?.value, "Both browsers must share the same installed operator session").toBe(true)
    const [storageVersion, beforeThread] = await Promise.all([retainedApi.version(), retainedApi.thread(answer.questionId)])
    const retain = async (target: Page, purpose: string) => {
      const pending = await retainUnsentReply(target, app, answer, purpose, storageVersion)
      cleanup.push(pending.cleanup)
      return pending
    }
    const { localPending, retainedPending } = await test.step("Retain both unsent intents and verify they changed no stored data", async () => {
      const [local, remote] = await Promise.allSettled([retain(page, "logout"), retain(retained, "retained")])
      if (local.status === "rejected") throw local.reason
      if (remote.status === "rejected") throw remote.reason
      const [currentVersion, currentThread] = await Promise.all([retainedApi.version(), retainedApi.thread(answer.questionId)])
      expect(currentVersion).toBe(storageVersion)
      expect(currentThread.messages).toEqual(beforeThread.messages)
      return { localPending: local.value, retainedPending: remote.value }
    })
    expect(retainedPending.key).not.toBe(localPending.key)
    const pendingLogout = page.waitForResponse((response) => response.url() === `${app.origin}${app.mount}/auth/logout` && response.request().method() === "POST")
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    const logout = await test.step("Observe the installed logout response", () => pendingLogout)
    expect(logout.status()).toBe(204)
    expect(logout.headers()["cache-control"]).toContain("no-store")
    await expect(page).toHaveURL((url) => url.origin === app.origin && url.pathname === `${app.mount}/auth/login`)
    await expect(page.getByRole("region", { name: "Preserved review meeting", exact: true })).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Review discussion", exact: true })).toHaveCount(0)
    await expectPrivateAttemptCleared(page, localPending.drafts)
    const deniedRead = retained.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    await retained.getByRole("region", { name: "Review discussion", exact: true })
      .getByRole("button", { name: "Reconcile action", exact: true }).click()
    const forbidden = await test.step("Observe the real refusal for the retained credential", () => deniedRead)
    expect(forbidden.status()).toBe(403)
    expect(forbidden.request().postDataJSON()).toEqual({ id: answer.questionId })
    expect(forbidden.headers()["cache-control"]).toContain("no-store")
    // The browser discards the response body as it removes the private view.
    // Verify the same denied read through the retained context's real cookie.
    const binding = text(await forbidden.request().headerValue("x-sf-review-binding"))
    const directDenial = await old.request.post(productURL(app.dashboardURL, "collaboration-thread-read").href, {
      headers: { Origin: app.origin, "X-SF-Review-Binding": binding }, data: { id: answer.questionId }, maxRedirects: 0,
    }).catch(() => { throw new Error("The revoked session's direct thread read did not complete") })
    expect(directDenial.status()).toBe(403)
    expect(directDenial.headers()["cache-control"]).toContain("no-store")
    const deniedBody = await directDenial.text()
    for (const secret of [saved.id, answer.message.body, answer.pin.reviewDigest, ...Object.values(retainedPending.drafts)])
      expect(deniedBody, "The real denied read must not return protected content or drafts").not.toContain(secret)
    const cleared = retained.locator("main[data-access-unavailable]")
    await expect(cleared.getByRole("status").filter({ hasText: "The previous view was removed." }))
      .toHaveText("The previous view was removed. Reload to continue with your current permissions.")
    await expect(cleared.getByRole("heading")).toHaveText(/^(Your session has expired|Your access has changed)$/)
    const clearedReview = retained.locator("[data-sf-review-workspace]")
    // The installed host now disposes all protected views on denied access.
    // Removing navigation entirely is stronger than retaining a disabled button.
    await expect(meeting).toHaveCount(0)
    await expect(meeting.getByRole("heading")).toHaveCount(0)
    await expect(meeting.getByRole("listitem")).toHaveCount(0)
    await expect(clearedReview.getByRole("heading")).toHaveCount(0)
    await expect(clearedReview.getByRole("listitem")).toHaveCount(0)
    await expect(clearedReview.getByRole("button")).toHaveCount(0)
    await expect(retained.getByRole("region", { name: "Review discussion", exact: true })).toHaveCount(0)
    await expect(retained.getByRole("region", { name: "Confirmed answer", exact: true })).toHaveCount(0)
    await expect(retained.getByRole("button", { name: "Next topic", exact: true })).toHaveCount(0)
    await expectPrivateAttemptCleared(retained, retainedPending.drafts)
    for (const secret of [answer.message.body, answer.pin.reviewDigest, "REPORTS_LONG_NOTE_END", "reports-project-01", "totalForecast", "1320"])
      await expect(cleared, "Revocation must remove cached review and answer content").not.toContainText(secret)
    await test.step("Deny the previous credential before fresh enrollment", () =>
      denied(old.request, app, saved, answer, artifact.href, true))

    // Positive controls distinguish actual credential revocation from an absent
    // route/artifact or a broken server. A new legitimate enrollment cannot revive it.
    const control = await fresh.newPage()
    await test.step("Enroll a fresh real local-operator session", () => app.signIn(control))
    const current = reportsCollaboration(control.request, app.dashboardURL)
    const [freshReview, download] = await test.step("Read the same review, Office bytes and answer under fresh authority", () =>
      Promise.all([
        readReview(control.request, app.dashboardURL, saved.id),
        control.request.get(artifact.href, { maxRedirects: 0 }),
        expectReusedReviewAnswer(current, answer),
      ]))
    expect(freshReview).toEqual(saved)
    const [freshVersion, freshThread] = await Promise.all([current.version(), current.thread(answer.questionId)])
    expect(freshVersion, "Logout and the fresh controls must not add a reply").toBe(storageVersion)
    expect(freshThread.messages).toEqual(beforeThread.messages)
    expect(localPending.writes).toEqual([localPending.serialized])
    expect(retainedPending.writes).toEqual([retainedPending.serialized])
    expect(download.status()).toBe(200)
    expect(download.headers()["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(createHash("sha256").update(await download.body()).digest("hex")).toBe(artifact.sha256)
    await test.step("Deny the previous credential after fresh enrollment", () =>
      denied(old.request, app, saved, answer, artifact.href, false))
    await expectPrivateAttemptCleared(page, localPending.drafts)
    await expectPrivateAttemptCleared(retained, retainedPending.drafts)
    expect(localPending.writes).toEqual([localPending.serialized])
    expect(retainedPending.writes).toEqual([retainedPending.serialized])
    await info.attach("session-revocation", { body: JSON.stringify({
      reviewRef: saved.id, answerRef: answer.answerRef, oldSession: "denied before and after fresh enrollment",
      cachedMeeting: "cleared", freshSession: "same review, answer and artifact digest",
      logoutRoute: "installed Sign out control", clearedViews: ["meeting", "discussion", "confirmed answer", "topic navigation"],
      clearedDrafts: ["question", "reply", "edit"], clearedPendingAttempts: ["logout", "retained real403"],
      attempts: [localPending, retainedPending].map((attempt) => ({
        idempotencyKey: attempt.key, originalPayload: attempt.payload, requests: attempt.writes.length,
        outcome: "aborted before sending; no retry on logout, denied read or fresh enrollment",
      })),
      scope: "durable operator-session revocation", selectiveTalentRevocation: "NOT_PROVEN",
    }, null, 2), contentType: "application/json" })
  } finally {
    try { for (const stop of cleanup) await stop() }
    finally { await fresh.close(); await old.close() }
  }
}

async function retainUnsentReply(page: Page, app: ReportsInstallation, answer: ReviewAnswer, scope: string, storageVersion: number) {
  const discussion = page.getByRole("region", { name: "Review discussion", exact: true })
  const drafts = {
    question: `Private question before ${scope}. REPORTS_REVOKED_QUESTION_${scope}`,
    reply: `Private reply before ${scope}. REPORTS_REVOKED_REPLY_${scope}`,
    edit: `Private edit before ${scope}. REPORTS_REVOKED_EDIT_${scope}`,
  }
  await discussion.getByRole("textbox", { name: "Question", exact: true }).fill(drafts.question)
  await discussion.getByRole("textbox", { name: "Reply", exact: true }).fill(drafts.reply)
  await discussion.getByRole("article", { name: `Message ${answer.message.id}`, exact: true })
    .getByRole("textbox", { name: "Edited answer", exact: true }).fill(drafts.edit)
  const base = new URL(app.dashboardURL), mode = "collaboration-thread-reply"
  const matches = (url: URL) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === mode
  const writes: string[] = []
  const record = (request: Request) => {
    if (request.method() === "POST" && matches(new URL(request.url()))) writes.push(text(request.postData()))
  }
  let resolve!: (attempt: { serialized: string; key: string; payload: Record<string, unknown> }) => void, reject!: (reason: unknown) => void
  const attempted = new Promise<{ serialized: string; key: string; payload: Record<string, unknown> }>((yes, no) => { resolve = yes; reject = no })
  const abort = async (route: Route) => {
    try {
      const request = route.request(), payload = object(request.postDataJSON())
      const key = text(await request.headerValue("idempotency-key"))
      expect(request.method()).toBe("POST")
      expect(payload).toMatchObject({ id: answer.questionId, body: drafts.reply })
      expect(object(payload.mutation)).toMatchObject({ expectedStorageVersion: storageVersion, idempotencyKey: key })
      resolve({ serialized: text(request.postData()), key, payload })
      // Deliberately do not call route.fetch/continue: no mutation reaches the producer.
      await route.abort("failed")
    } catch (error) {
      reject(error)
      await route.abort("failed").catch(() => {})
    }
  }
  page.on("request", record)
  await page.route(matches, abort, { times: 1 })
  const cleanup = async () => { page.off("request", record); await page.unroute(matches, abort) }
  try {
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.method() === "POST" && matches(new URL(request.url())) })
    await discussion.getByRole("button", { name: "Send reply", exact: true }).click()
    const [attempt] = await Promise.all([attempted, failed])
    for (const [label, draft] of [["Question", drafts.question], ["Reply", drafts.reply], ["Edited answer", drafts.edit]] as const) {
      const field = discussion.getByRole("textbox", { name: label, exact: true })
      await expect(field).toHaveValue(draft)
      await expect(field).not.toBeEditable()
    }
    await expect(discussion.getByRole("button", { name: "Reconcile action", exact: true })).toBeEnabled()
    await expect(discussion.getByRole("button", { name: "Retry same action", exact: true })).toHaveCount(0)
    expect(writes).toEqual([attempt.serialized])
    return { ...attempt, drafts, writes, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}

async function expectPrivateAttemptCleared(page: Page, drafts: { question: string; reply: string; edit: string }) {
  for (const label of ["Question", "Reply", "Edited answer"])
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Action recovery", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Reconcile action", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Retry same action", exact: true })).toHaveCount(0)
  for (const draft of Object.values(drafts)) await expect(page.locator("body")).not.toContainText(draft)
}

async function denied(request: APIRequestContext, app: ReportsInstallation, saved: PreservedReview, answer: ReviewAnswer, artifactURL: string, checkExport: boolean) {
  const requests = [
    { mode: "review-read", url: productURL(app.dashboardURL, "review-read", { reviewRef: saved.id }).href },
    { mode: "review-download", url: artifactURL },
    { mode: "review-report", url: productURL(app.dashboardURL, "review-report").href,
      data: { reviewRef: saved.id, sectionRefs: saved.sections.map((section) => section.id), format: "docx" } },
    { mode: "collaboration-answer-read", url: productURL(app.dashboardURL, "collaboration-answer-read").href,
      data: { questionId: answer.questionId } },
  ]
  for (const call of requests) {
    // Probe the rejected export once; later reads verify durable denial after reenrollment.
    if (call.mode === "review-report" && !checkExport) continue
    const response = call.data
      ? await request.post(call.url, { headers: { Origin: app.origin }, data: call.data, maxRedirects: 0 })
      : await request.get(call.url, { maxRedirects: 0 })
    expect(response.status(), `${call.mode} must use the real installation's access boundary`).toBe(call.data ? 403 : 303)
    expect(response.headers()["cache-control"], call.mode).toContain("no-store")
    if (!call.data) {
      const target = new URL(call.url)
      expect(response.headers().location).toBe(`${app.mount}/auth/login?returnTo=${encodeURIComponent(target.pathname + target.search)}`)
    }
    const body = await response.text()
    for (const secret of [saved.id, answer.message.body, answer.pin.reviewDigest, "REPORTS_LONG_NOTE_END", "reports-project-01", "totalForecast", "1320"])
      expect(body, `${call.mode} must not leak captured business content`).not.toContain(secret)
  }
}
