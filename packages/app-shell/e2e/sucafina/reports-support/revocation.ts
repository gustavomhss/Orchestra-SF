import { createHash } from "node:crypto"
import { expect } from "@playwright/test"
import type { APIRequestContext, Browser, Page, Request, Response, Route, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAnswer } from "./confirmation.ts"
import { expectReusedReviewAnswer, reportsCollaboration } from "./confirmation.ts"
import { expectConfirmedAnswerVisible } from "./human-answer-flow.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, productURL, readReview, responseFor, text } from "./model.ts"
import { observePreservedReview } from "./review-flow.ts"

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
    expect(await readReview(old.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectReusedReviewAnswer(reportsCollaboration(old.request, app.dashboardURL), answer)
    const retained = await old.newPage()
    const isContext = (response: Response) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === app.origin && url.pathname === `${app.mount}/api/ui/context`
    }
    const [admitted] = await Promise.all([
      retained.waitForResponse((response) => isContext(response) && response.status() === 200),
      observePreservedReview(retained, app, saved, () => retained.goto(page.url())),
    ])
    const binding = new URL(admitted.url()).searchParams
    expect([...binding.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
    const sameContext = (response: Response) => {
      if (!isContext(response)) return false
      const query = new URL(response.url()).searchParams
      return query.size === binding.size && [...binding].every(([key, value]) => query.get(key) === value)
    }
    const meeting = retained.getByRole("region", { name: "Preserved review meeting", exact: true })
    const heading = meeting.getByRole("heading", { level: 2 })
    await expect(heading).toHaveText(saved.sections[0]!.title)
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expect(heading).toHaveText(saved.sections[1]!.title)
    await expectConfirmedAnswerVisible(retained, answer)
    const localPending = await retainUnsentReply(page, app, answer, "logout")
    cleanup.push(localPending.cleanup)
    const retainedPending = await retainUnsentReply(retained, app, answer, "retained")
    cleanup.push(retainedPending.cleanup)
    expect(retainedPending.storageVersion).toBe(localPending.storageVersion)
    expect(retainedPending.key).not.toBe(localPending.key)
    const [logout, loggedOutContext] = await Promise.all([
      page.waitForResponse((response) => response.url() === `${app.origin}${app.mount}/auth/logout` && response.request().method() === "POST"),
      page.waitForResponse(sameContext),
      page.getByRole("button", { name: "Sign out", exact: true }).click(),
    ])
    expect(logout.status()).toBe(204)
    expect(logout.headers()["cache-control"]).toContain("no-store")
    expect(loggedOutContext.status()).toBe(401)
    expect(loggedOutContext.headers()["cache-control"]).toContain("no-store")
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(page.locator('[data-sf-surface="UI48"]')).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Preserved review meeting", exact: true })).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Review discussion", exact: true })).toHaveCount(0)
    await expectPrivateAttemptCleared(page, localPending.drafts)
    const [forbidden, revokedContext] = await Promise.all([
      retained.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST")),
      retained.waitForResponse(sameContext),
      retained.getByRole("region", { name: "Review discussion", exact: true })
        .getByRole("button", { name: "Reconcile action", exact: true }).click(),
    ])
    expect(forbidden.status()).toBe(403)
    expect(forbidden.request().postDataJSON()).toEqual({ id: answer.questionId })
    expect(forbidden.headers()["cache-control"]).toContain("no-store")
    const deniedBody = await forbidden.text()
    for (const secret of [answer.message.body, answer.pin.reviewDigest, ...Object.values(retainedPending.drafts)])
      expect(deniedBody, "The real denied read must not return protected content or drafts").not.toContain(secret)
    expect(revokedContext.status()).toBe(401)
    expect(revokedContext.headers()["cache-control"]).toContain("no-store")
    const retainedOwner = retained.locator('[data-sf-host="owner-runtime231"]')
    await expect(retainedOwner).toHaveAttribute("data-sf-provider-state", "unavailable")
    await expect(retainedOwner).toHaveAttribute("data-sf-provider-reason", "connection-auth-unavailable")
    const cleared = retained.locator('[data-sf-surface="UI48"]')
    // The installed host now disposes all protected views on denied access.
    // Removing navigation entirely is stronger than retaining a disabled button.
    await expect(meeting).toHaveCount(0)
    await expect(cleared).toHaveCount(0)
    await expect(retained.getByRole("region", { name: "Review discussion", exact: true })).toHaveCount(0)
    await expect(retained.getByRole("region", { name: "Confirmed answer", exact: true })).toHaveCount(0)
    await expect(retained.getByRole("button", { name: "Next topic", exact: true })).toHaveCount(0)
    await expectPrivateAttemptCleared(retained, retainedPending.drafts)
    for (const secret of [answer.message.body, answer.pin.reviewDigest, "REPORTS_LONG_NOTE_END", "reports-project-01", "totalForecast", "1320"])
      await expect(retainedOwner, "Revocation must remove cached review and answer content").not.toContainText(secret)
    await denied(old.request, app, saved, answer, artifact.href, true)

    // Positive controls distinguish actual credential revocation from an absent
    // route/artifact or a broken server. A new legitimate enrollment cannot revive it.
    const control = await fresh.newPage()
    await app.signIn(control)
    expect(await readReview(control.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectReusedReviewAnswer(reportsCollaboration(control.request, app.dashboardURL), answer)
    const current = reportsCollaboration(control.request, app.dashboardURL)
    expect(await current.version(), "Logout and denied reconciliation must not submit either retained reply").toBe(localPending.storageVersion)
    expect((await current.thread(answer.questionId)).messages).toEqual(localPending.messages)
    expect(localPending.writes).toEqual([localPending.serialized])
    expect(retainedPending.writes).toEqual([retainedPending.serialized])
    const download = await control.request.get(artifact.href, { maxRedirects: 0 })
    expect(download.status()).toBe(200)
    expect(download.headers()["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(createHash("sha256").update(await download.body()).digest("hex")).toBe(artifact.sha256)
    await denied(old.request, app, saved, answer, artifact.href, false)
    await expectPrivateAttemptCleared(page, localPending.drafts)
    await expectPrivateAttemptCleared(retained, retainedPending.drafts)
    expect(localPending.writes).toEqual([localPending.serialized])
    expect(retainedPending.writes).toEqual([retainedPending.serialized])
    await info.attach("session-revocation", { body: JSON.stringify({
      reviewRef: saved.id, answerRef: answer.answerRef, oldSession: "denied before and after fresh enrollment",
      cachedMeeting: "cleared", freshSession: "same review, answer and artifact digest",
      contextBinding: Object.fromEntries(binding), logoutContextStatus: loggedOutContext.status(), retainedContextStatus: revokedContext.status(),
      logoutRoute: "installed Sign out control", clearedViews: ["meeting", "discussion", "confirmed answer", "topic navigation"],
      clearedDraftFields: ["question", "reply", "edit"], clearedPendingAttempts: ["logout", "retained unauthenticated"],
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

async function retainUnsentReply(page: Page, app: ReportsInstallation, answer: ReviewAnswer, scope: string) {
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
  const api = reportsCollaboration(page.request, app.dashboardURL)
  const storageVersion = await api.version(), before = await api.thread(answer.questionId)
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
    expect(await api.version()).toBe(storageVersion)
    expect((await api.thread(answer.questionId)).messages).toEqual(before.messages)
    return { ...attempt, drafts, storageVersion, messages: before.messages, writes, cleanup }
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
