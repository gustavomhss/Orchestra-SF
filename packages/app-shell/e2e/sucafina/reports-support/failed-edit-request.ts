import { expect } from "@playwright/test"
import type { Locator, Page, Request, Route, TestInfo } from "@playwright/test"
import type { ReportsCollaboration, ReviewAnswer } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, responseFor, text } from "./model.ts"

/** A transport failure before the real edit reaches the server must preserve
 * the editor. Only the explicit retry after authorized reconciliation may edit.
 */
export async function recoverFailedEditRequest(input: {
  page: Page
  app: ReportsInstallation
  api: ReportsCollaboration
  discussion: Locator
  article: Locator
  answer: ReviewAnswer
  body: string
  expectedStorageVersion: number
  info: TestInfo
}) {
  const { page, app, api, discussion, article, answer } = input
  const feedback = discussion.getByRole("status")
  const previousFeedback = await feedback.textContent()
  const mode = "collaboration-thread-edit"
  const base = new URL(app.dashboardURL)
  const matches = (url: URL) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === mode
  const before = await api.thread(answer.questionId)
  const writes: string[] = []
  const record = (request: Request) => {
    if (request.method() === "POST" && matches(new URL(request.url()))) writes.push(text(request.postData()))
  }
  type Attempt = { serialized: string; key: string; payload: Record<string, unknown> }
  let resolve!: (value: Attempt) => void, reject!: (reason: unknown) => void
  const attempted = new Promise<Attempt>((yes, no) => { resolve = yes; reject = no })
  const drop = async (route: Route) => {
    try {
      const request = route.request()
      expect(request.method()).toBe("POST")
      resolve({ serialized: text(request.postData()), key: text(await request.headerValue("idempotency-key")), payload: object(request.postDataJSON()) })
      // Do not forward this failed attempt or synthesize a server response.
      await route.abort("failed")
    } catch (error) {
      reject(error)
      await route.abort("failed").catch(() => {})
    }
  }
  page.on("request", record)
  await page.route(matches, drop, { times: 1 })
  try {
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.method() === "POST" && matches(new URL(request.url())) })
    await article.getByRole("button", { name: "Save answer edit", exact: true }).click()
    const [attempt] = await Promise.all([attempted, failed])
    expect(attempt.payload).toMatchObject({ id: answer.questionId, messageId: answer.message.id, expectedVersion: answer.message.version, body: input.body })
    const mutation = object(attempt.payload.mutation)
    expect(mutation.expectedStorageVersion).toBe(input.expectedStorageVersion)
    expect(mutation.idempotencyKey).toBe(attempt.key)

    const editor = article.getByRole("textbox", { name: "Edited answer", exact: true })
    await expect(editor, "A failed edit request must retain the typed answer").toHaveValue(input.body)
    const reconcile = discussion.getByRole("button", { name: "Reconcile action", exact: true })
    await expect(reconcile).toBeEnabled()
    await expect(feedback, "The recoverable edit failure must give visible feedback").not.toHaveText(previousFeedback ?? "")
    expect(writes).toEqual([attempt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion)
    expect((await api.thread(answer.questionId)).messages).toEqual(before.messages)

    const reread = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    await reconcile.click()
    const authorized = await reread
    expect(authorized.status()).toBe(200)
    expect(authorized.request().postDataJSON()).toEqual({ id: answer.questionId })
    expect(object(object(await authorized.json()).value).messages).toEqual(before.messages)
    await expect(discussion.getByRole("status")).toHaveText("Action reconciled. Retry the same action explicitly to recover its receipt.")
    await expect(editor).toHaveValue(input.body)
    const retry = discussion.getByRole("button", { name: "Retry same action", exact: true })
    await expect(retry).toBeEnabled()
    expect(writes, "Reconciliation must not submit the retained edit").toEqual([attempt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion)

    const recovered = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
    await retry.click()
    const response = await recovered
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    expect(response.request().postData()).toBe(attempt.serialized)
    expect(await response.request().headerValue("idempotency-key")).toBe(attempt.key)
    const result = object(await response.json())
    expect(result.status).toBe("ok")
    await expect(discussion.getByRole("status")).toHaveText("Answer edited. Its previous version remains protected history; review the new answer before confirming again.")
    await expect(editor).toHaveValue(input.body)
    expect(writes).toEqual([attempt.serialized, attempt.serialized])
    expect(await api.version(), "The explicit retry commits exactly one edit").toBe(input.expectedStorageVersion + 1)
    const current = await api.thread(answer.questionId)
    expect(current.messages).toHaveLength((before.messages as unknown[]).length)
    expect((current.messages as unknown[]).map(object).filter((message) => message.id === answer.message.id))
      .toMatchObject([{ version: answer.message.version + 1, body: input.body }])
    await input.info.attach("reports-real-failed-edit-request", {
      body: JSON.stringify({
        questionId: answer.questionId, messageId: answer.message.id,
        originalStorageVersion: input.expectedStorageVersion, committedStorageVersion: input.expectedStorageVersion + 1,
        idempotencyKey: attempt.key, originalPayload: attempt.payload, retryPayload: object(response.request().postDataJSON()),
        editCount: 1, networkWrites: writes.length, automaticRetry: false,
        failure: "request aborted before the actual server; no positive response fabricated",
        reconciliation: "authorized thread reread before an explicit same-intent retry",
      }, null, 2), contentType: "application/json",
    })
    return { payload: attempt.payload, value: result.value }
  } finally {
    page.off("request", record)
    await page.unroute(matches, drop)
  }
}
