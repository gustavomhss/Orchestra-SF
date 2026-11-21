import { expect } from "@playwright/test"
import type { Locator, Page, Request, Route, TestInfo } from "@playwright/test"
import type { ReportsCollaboration, ReviewAnswer } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { observeReviewTransport } from "./review-flow.ts"
import { object, responseFor, text } from "./model.ts"

/** Lose a real committed edit's response. A fresh authorized read must retain
 * the exact old CAS/payload/key until the human explicitly recovers its receipt.
 */
export async function recoverLostEditResponse(input: {
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
  const mode = "collaboration-thread-edit"
  const base = new URL(app.dashboardURL)
  const matches = (url: URL) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === mode
  const before = await api.thread(answer.questionId)
  const writes: string[] = []
  const record = (request: Request) => {
    if (request.method() === "POST" && matches(new URL(request.url()))) writes.push(text(request.postData()))
  }
  type Receipt = { serialized: string; key: string; payload: Record<string, unknown>; value: unknown }
  let resolve!: (value: Receipt) => void, reject!: (reason: unknown) => void
  const committed = new Promise<Receipt>((yes, no) => { resolve = yes; reject = no })
  const drop = async (route: Route) => {
    try {
      const request = route.request()
      expect(request.method()).toBe("POST")
      const serialized = text(request.postData()), payload = object(request.postDataJSON())
      const key = text(await request.headerValue("idempotency-key"))
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      expect(response.status(), "Only an actual successful edit response may be discarded").toBe(200)
      expect(response.headers()["cache-control"]).toContain("no-store")
      const result = object(await response.json())
      expect(result.status).toBe("ok")
      resolve({ serialized, payload, key, value: result.value })
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
    const [receipt] = await Promise.all([committed, failed])
    expect(receipt.payload).toMatchObject({ id: answer.questionId, messageId: answer.message.id, expectedVersion: answer.message.version, body: input.body })
    expect(object(receipt.payload.mutation)).toMatchObject({ expectedStorageVersion: input.expectedStorageVersion, idempotencyKey: receipt.key })
    expect(receipt.value).toEqual({ id: answer.questionId, messageId: answer.message.id, version: answer.message.version + 1 })
    const editor = article.getByRole("textbox", { name: "Edited answer", exact: true })
    await expect(editor).toHaveValue(input.body)
    await expect(editor).not.toBeEditable()
    const reconcile = discussion.getByRole("button", { name: "Reconcile action", exact: true })
    await expect(reconcile).toBeEnabled()
    expect(writes).toEqual([receipt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)
    const saved = await api.thread(answer.questionId)
    expect(saved.messages).toHaveLength((before.messages as unknown[]).length)
    expect((saved.messages as unknown[]).map(object).filter((message) => message.id === answer.message.id))
      .toMatchObject([{ version: answer.message.version + 1, body: input.body }])

    const reread = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    await reconcile.click()
    const authorized = await reread
    expect(authorized.status()).toBe(200)
    expect(authorized.request().postDataJSON()).toEqual({ id: answer.questionId })
    expect(object(object(await authorized.json()).value).messages).toEqual(saved.messages)
    await expect(discussion.getByRole("status")).toHaveText("Action reconciled. Retry the same action explicitly to recover its receipt.")
    await expect(editor).toHaveValue(input.body)
    await expect(editor).not.toBeEditable()
    const retry = discussion.getByRole("button", { name: "Retry same action", exact: true })
    await expect(retry).toBeEnabled()
    expect(writes, "A newer authorized version must never silently rebase and send the retained edit").toEqual([receipt.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)

    const transport = observeReviewTransport(page, app, mode)
    const recovered = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
    void recovered.catch(() => undefined)
    const response = await (async () => {
      try {
        await retry.click()
        return await Promise.race([recovered, transport.failed])
      } finally {
        await transport.finish(input.info)
      }
    })()
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    expect(response.request().postData()).toBe(receipt.serialized)
    expect(await response.request().headerValue("idempotency-key")).toBe(receipt.key)
    const result = object(await response.json())
    expect(result.status).toBe("ok")
    expect(result.value).toEqual(receipt.value)
    await expect(discussion.getByRole("status")).toHaveText("Answer edited. Its previous version remains protected history; review the new answer before confirming again.")
    await expect(editor).toHaveValue(input.body)
    expect(writes).toEqual([receipt.serialized, receipt.serialized])
    expect(await api.version(), "Recovering the committed receipt cannot write another answer version").toBe(input.expectedStorageVersion + 1)
    expect((await api.thread(answer.questionId)).messages).toEqual(saved.messages)
    await input.info.attach("reports-real-lost-edit-response", {
      body: JSON.stringify({
        questionId: answer.questionId, messageId: answer.message.id,
        originalStorageVersion: input.expectedStorageVersion, committedStorageVersion: input.expectedStorageVersion + 1,
        idempotencyKey: receipt.key, originalPayload: receipt.payload, retryPayload: object(response.request().postDataJSON()),
        editCount: 1, networkWrites: writes.length, automaticRetry: false,
        failure: "real successful edit response discarded after route.fetch; no positive response fabricated",
        reconciliation: "current authorized thread read before explicit replay with original payload, key and expected versions",
      }, null, 2), contentType: "application/json",
    })
    return { payload: receipt.payload, value: result.value }
  } finally {
    page.off("request", record)
    await page.unroute(matches, drop)
  }
}
