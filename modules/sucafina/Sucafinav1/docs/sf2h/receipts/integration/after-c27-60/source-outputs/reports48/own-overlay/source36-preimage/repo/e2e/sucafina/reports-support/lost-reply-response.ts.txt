import { expect } from "@playwright/test"
import type { Locator, Page, Request, Route, TestInfo } from "@playwright/test"
import type { ReportsCollaboration } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, responseFor, text } from "./model.ts"

/** Drop only the response of a real admitted reply. The installed producer
 * commits once; the human must reconcile and explicitly recover its receipt.
 * No positive response, identity, recipient authority or source is synthesized.
 */
export async function recoverLostReplyResponse(input: {
  page: Page
  app: ReportsInstallation
  api: ReportsCollaboration
  discussion: Locator
  question: { id: string; messages: readonly unknown[] }
  body: string
  expectedStorageVersion: number
  info: TestInfo
}) {
  const { page, app, api, discussion, question } = input
  const feedback = discussion.getByRole("status")
  const previousFeedback = await feedback.textContent()
  const mode = "collaboration-thread-reply"
  const base = new URL(app.dashboardURL)
  const matches = (url: URL) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === mode
  const writes: string[] = []
  const record = (request: Request) => {
    if (request.method() === "POST" && matches(new URL(request.url()))) writes.push(text(request.postData()))
  }
  type Committed = { serialized: string; key: string; payload: Record<string, unknown>; value: unknown; httpStatus: number; cacheControl: string | undefined }
  let resolve!: (value: Committed) => void, reject!: (reason: unknown) => void
  const committed = new Promise<Committed>((yes, no) => { resolve = yes; reject = no })
  const drop = async (route: Route) => {
    try {
      const request = route.request()
      expect(request.method()).toBe("POST")
      const serialized = text(request.postData())
      const payload = object(request.postDataJSON())
      const key = text(await request.headerValue("idempotency-key"))
      // Forward this exact UI request once to the actual installed producer.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      const result = object(await response.json())
      expect(result.status, "The discarded response must be a successful server receipt").toBe("ok")
      resolve({ serialized, key, payload, value: result.value, httpStatus: response.status(), cacheControl: response.headers()["cache-control"] })
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
    await discussion.getByRole("button", { name: "Send reply", exact: true }).click()
    const [receipt] = await Promise.all([committed, failed])
    expect(receipt.httpStatus, "The lost response must belong to a real successful commit").toBe(200)
    expect(receipt.cacheControl).toContain("no-store")
    expect(receipt.payload).toMatchObject({ id: question.id, body: input.body })
    const mutation = object(receipt.payload.mutation)
    expect(mutation.expectedStorageVersion).toBe(input.expectedStorageVersion)
    expect(mutation.idempotencyKey).toBe(receipt.key)
    const saved = object(receipt.value)
    expect(saved.id).toBe(question.id)
    expect(Array.isArray(saved.messages)).toBe(true)
    expect(saved.messages).toHaveLength(question.messages.length + 1)

    const reply = discussion.getByRole("textbox", { name: "Reply", exact: true })
    await expect(reply, "A lost network response must retain the typed reply").toHaveValue(input.body)
    const reconcile = discussion.getByRole("button", { name: "Reconcile action", exact: true })
    await expect(reconcile).toBeEnabled()
    await expect(feedback, "The recoverable failure must explain that the action needs attention").not.toHaveText(previousFeedback ?? "")
    expect(writes).toEqual([receipt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)
    expect((await api.thread(question.id)).messages).toEqual(saved.messages)

    const reread = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    await reconcile.click()
    const authorized = await reread
    expect(authorized.status()).toBe(200)
    expect(authorized.request().postDataJSON()).toEqual({ id: question.id })
    expect(object(object(await authorized.json()).value).messages).toEqual(saved.messages)
    await expect(discussion.getByRole("status")).toHaveText("Action reconciled. Retry the same action explicitly to recover its receipt.")
    await expect(reply).toHaveValue(input.body)
    const retry = discussion.getByRole("button", { name: "Retry same action", exact: true })
    await expect(retry).toBeEnabled()
    expect(writes, "Reconciliation reads current authority without automatically sending").toEqual([receipt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)

    const recovered = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
    await retry.click()
    const response = await recovered
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    expect(response.request().postData()).toBe(receipt.serialized)
    expect(await response.request().headerValue("idempotency-key")).toBe(receipt.key)
    const result = object(await response.json())
    expect(result.status).toBe("ok")
    expect(result.value).toEqual(receipt.value)
    await expect(discussion.getByRole("status")).toHaveText("Reply saved in this preserved review.")
    await expect(reply).toHaveValue("")
    expect(writes, "Only the original intent and the explicit retry may be sent").toEqual([receipt.serialized, receipt.serialized])
    expect(await api.version(), "Recovering the original receipt must not commit a duplicate reply").toBe(input.expectedStorageVersion + 1)
    expect((await api.thread(question.id)).messages).toEqual(saved.messages)
    await infoReceipt(input.info, {
      questionId: question.id, originalStorageVersion: input.expectedStorageVersion,
      committedStorageVersion: input.expectedStorageVersion + 1, idempotencyKey: receipt.key,
      originalPayload: receipt.payload, retryPayload: object(response.request().postDataJSON()),
      replyCount: 1, networkWrites: writes.length, automaticRetry: false,
      reconciliation: "authorized thread reread before an explicit same-intent retry",
      responseLoss: "real server response discarded after route.fetch; no positive response fabricated",
    })
    return { payload: receipt.payload, value: result.value }
  } finally {
    page.off("request", record)
    await page.unroute(matches, drop)
  }
}

async function infoReceipt(info: TestInfo, receipt: Record<string, unknown>) {
  await info.attach("reports-real-lost-reply-response", {
    body: JSON.stringify(receipt, null, 2), contentType: "application/json",
  })
}
