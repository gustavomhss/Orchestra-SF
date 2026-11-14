import { expect } from "@playwright/test"
import type { Locator, Page, Request, Route, TestInfo } from "@playwright/test"
import type { ReportsCollaboration } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, responseFor, text } from "./model.ts"

/** The create receipt reaches the browser. Only its first authorized follow-up
 * read is lost; reconciling must adopt that known thread before a focus refresh.
 */
export async function recoverCreatedQuestionAfterReadLoss(input: {
  page: Page
  app: ReportsInstallation
  api: ReportsCollaboration
  discussion: Locator
  body: string
  expectedStorageVersion: number
  info: TestInfo
}) {
  const { page, app, api, discussion } = input
  const mode = "collaboration-thread-create", readMode = "collaboration-thread-read"
  const base = new URL(app.dashboardURL)
  const matches = (url: URL, expected: string) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === expected
  const matchesRead = (url: URL) => matches(url, readMode)
  const writes: string[] = []
  const record = (request: Request) => {
    if (request.method() === "POST" && matches(new URL(request.url()), mode)) writes.push(text(request.postData()))
  }
  expect(new URL(page.url()).searchParams.get("reviewThread")).toBeNull()
  const createdResponse = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
  const receipt = createdResponse.then(async (response) => {
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    const result = object(await response.json())
    expect(result.status).toBe("ok")
    const request = response.request(), payload = object(request.postDataJSON())
    const key = text(await request.headerValue("idempotency-key"))
    expect(object(payload.draft).body).toBe(input.body)
    expect(object(payload.mutation)).toMatchObject({ expectedStorageVersion: input.expectedStorageVersion, idempotencyKey: key })
    return { serialized: text(request.postData()), payload, key, value: object(result.value) }
  })
  let resolve!: () => void, reject!: (reason: unknown) => void
  const droppedRead = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  const loseRead = async (route: Route) => {
    try {
      const created = await receipt
      expect(route.request().method()).toBe("POST")
      expect(route.request().postDataJSON()).toEqual({ id: text(created.value.id) })
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      expect(response.status()).toBe(200)
      expect(response.headers()["cache-control"]).toContain("no-store")
      const result = object(await response.json())
      expect(result.status).toBe("ok")
      expect(object(result.value).id).toBe(created.value.id)
      resolve()
      await route.abort("failed")
    } catch (error) {
      reject(error)
      await route.abort("failed").catch(() => {})
    }
  }
  page.on("request", record)
  await page.route(matchesRead, loseRead, { times: 1 })
  try {
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.method() === "POST" && matchesRead(new URL(request.url())) })
    await discussion.getByRole("button", { name: "Ask about this review", exact: true }).click()
    const [created] = await Promise.all([receipt, droppedRead, failed])
    const questionId = text(created.value.id), question = discussion.getByRole("textbox", { name: "Question", exact: true })
    const saved = await api.thread(questionId)
    expect(saved.messages).toHaveLength(1)
    expect(saved.messages).toEqual(created.value.messages)
    await expect(question).toHaveValue(input.body)
    await expect(question).not.toBeEditable()
    await expect(discussion.getByRole("button", { name: "Reconcile action", exact: true })).toBeEnabled()
    expect(new URL(page.url()).searchParams.get("reviewThread")).toBeNull()
    expect(writes).toEqual([created.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)

    const reconciliation = page.waitForResponse(responseFor(app.dashboardURL, readMode, "POST"))
    await discussion.getByRole("button", { name: "Reconcile action", exact: true }).click()
    const authorized = await reconciliation
    expect(authorized.status()).toBe(200)
    expect(authorized.request().postDataJSON()).toEqual({ id: questionId })
    expect(object(object(await authorized.json()).value).messages).toEqual(saved.messages)
    await expect(page).toHaveURL((url) => url.searchParams.get("reviewThread") === questionId)
    await expect(discussion.getByRole("status")).toHaveText("Action reconciled. Retry the same action explicitly to recover its receipt.")
    await expect(question).toHaveValue(input.body)
    await expect(question).not.toBeEditable()

    // Exercise the installed host's real access probe and collaboration refresh.
    // The event supplies no data or permission and cannot submit the intent.
    const focusURL = page.url()
    const probe = page.waitForResponse((response) => response.request().method() === "GET" && response.url() === focusURL)
    const refreshed = page.waitForResponse(responseFor(app.dashboardURL, readMode, "POST"))
    const answerRead = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-answer-read", "POST"))
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")) })
    const [probed, reread, unanswered] = await Promise.all([probe, refreshed, answerRead])
    expect(probed.status()).toBe(200)
    expect(reread.status()).toBe(200)
    expect(reread.request().postDataJSON()).toEqual({ id: questionId })
    expect(object(object(await reread.json()).value).messages).toEqual(saved.messages)
    expect(unanswered.status()).toBe(503)
    expect(await unanswered.json()).toEqual({ status: "unavailable", reason: "answer-reuse-unavailable" })
    await expect(discussion).toHaveJSProperty("inert", false)
    await expect(discussion).toBeVisible()
    await expect(question).toHaveValue(input.body)
    await expect(question).not.toBeEditable()
    await expect(discussion.getByRole("button", { name: "Ask about this review", exact: true })).toBeDisabled()
    const retry = discussion.getByRole("button", { name: "Retry same action", exact: true })
    await expect(retry).toBeEnabled()
    await expect(page).toHaveURL((url) => url.searchParams.get("reviewThread") === questionId)
    expect(writes, "Focus refresh must preserve the retained create without sending it").toEqual([created.serialized])
    expect(await api.version()).toBe(input.expectedStorageVersion + 1)

    const recovered = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
    await retry.click()
    const response = await recovered
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    expect(response.request().postData()).toBe(created.serialized)
    expect(await response.request().headerValue("idempotency-key")).toBe(created.key)
    const result = object(await response.json())
    expect(result.status).toBe("ok")
    expect(result.value).toEqual(created.value)
    await expect(discussion.getByRole("status")).toHaveText("Question saved against the preserved review.")
    await expect(question).toHaveValue("")
    expect(writes).toEqual([created.serialized, created.serialized])
    expect(await api.version(), "Recovering a known create receipt must not create another thread").toBe(input.expectedStorageVersion + 1)
    expect((await api.thread(questionId)).messages).toEqual(saved.messages)
    await input.info.attach("reports-created-thread-read-loss", {
      body: JSON.stringify({
        questionId, idempotencyKey: created.key, originalPayload: created.payload,
        retryPayload: object(response.request().postDataJSON()),
        originalStorageVersion: input.expectedStorageVersion, resultingStorageVersion: input.expectedStorageVersion + 1,
        createRequests: writes.length, threadWrites: 1, automaticRetry: false,
        failure: "first real authorized thread read after received create200 discarded",
        reconciliation: "explicit authorized read adopts known thread; real focus probe/read retains draft and intent before exact explicit receipt replay",
      }, null, 2), contentType: "application/json",
    })
    return { payload: created.payload, value: result.value }
  } finally {
    page.off("request", record)
    await page.unroute(matchesRead, loseRead)
  }
}
