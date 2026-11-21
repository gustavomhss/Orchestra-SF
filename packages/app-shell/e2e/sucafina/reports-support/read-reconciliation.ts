import { expect } from "@playwright/test"
import type { Page, Request, Route, TestInfo } from "@playwright/test"
import { expectReusedReviewValue } from "./confirmation.ts"
import type { ReportsCollaboration, ReviewAnswer } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { object, responseFor } from "./model.ts"

/** Discard only authorized, successful read responses. The real producer runs
 * unchanged; the fault is transport loss, never fabricated permission or data.
 */
export async function reconcilePrivateDraftsAfterReadLoss(page: Page, app: ReportsInstallation, api: ReportsCollaboration, answer: ReviewAnswer, info: TestInfo) {
  const discussion = page.getByRole("region", { name: "Review discussion", exact: true })
  const article = discussion.getByRole("article", { name: `Message ${answer.message.id}`, exact: true })
  const question = discussion.getByRole("textbox", { name: "Question", exact: true })
  const reply = discussion.getByRole("textbox", { name: "Reply", exact: true })
  const edit = article.getByRole("textbox", { name: "Edited answer", exact: true })
  const drafts = {
    question: "Private question draft retained during authorized reconciliation. REPORTS_PRIVATE_QUESTION",
    reply: "Private reply draft retained during authorized reconciliation. REPORTS_PRIVATE_REPLY",
    edit: "Private edit draft retained during authorized reconciliation. REPORTS_PRIVATE_EDIT",
  }
  await question.fill(drafts.question)
  await reply.fill(drafts.reply)
  await edit.fill(drafts.edit)
  const original = await api.thread(answer.questionId)
  const version = await api.version()
  const mutations: string[] = []
  const mutationModes = new Set(["collaboration-thread-create", "collaboration-thread-reply", "collaboration-thread-edit", "collaboration-answer-confirm"])
  const base = new URL(app.dashboardURL)
  const record = (request: Request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === base.origin && url.pathname === base.pathname && mutationModes.has(url.searchParams.get("sf") ?? ""))
      mutations.push(request.postData() ?? "")
  }
  const losses: { mode: string; httpStatus: number; status: string }[] = []
  const pendingRoutes: { matches: (url: URL) => boolean; handler: (route: Route) => Promise<void> }[] = []
  const lose = async (mode: string) => {
    const matches = (url: URL) => url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get("sf") === mode
    let resolve!: () => void, reject!: (reason: unknown) => void
    const observed = new Promise<void>((yes, no) => { resolve = yes; reject = no })
    const handler = async (route: Route) => {
      try {
        expect(route.request().method()).toBe("POST")
        const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
        expect(response.status()).toBe(200)
        expect(response.headers()["cache-control"]).toContain("no-store")
        const body = object(await response.json())
        expect(body.status).toBe("ok")
        losses.push({ mode, httpStatus: response.status(), status: String(body.status) })
        resolve()
        await route.abort("failed")
      } catch (error) {
        reject(error)
        await route.abort("failed").catch(() => {})
      }
    }
    pendingRoutes.push({ matches, handler })
    await page.route(matches, handler, { times: 1 })
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.method() === "POST" && matches(new URL(request.url())) })
    return { observed, failed }
  }
  const retained = async () => {
    await expect(discussion).toBeVisible()
    await expect(question).toHaveValue(drafts.question)
    await expect(reply).toHaveValue(drafts.reply)
    await expect(edit).toHaveValue(drafts.edit)
    await expect(discussion.getByRole("button", { name: "Ask about this review", exact: true })).toBeDisabled()
    await expect(discussion.getByRole("button", { name: "Send reply", exact: true })).toBeDisabled()
    await expect(article.getByRole("button", { name: "Save answer edit", exact: true })).toBeDisabled()
    await expect(discussion.getByRole("button", { name: "Reconcile discussion", exact: true })).toBeEnabled()
    expect(mutations).toEqual([])
  }
  page.on("request", record)
  try {
    const historyLoss = await lose("collaboration-thread-history")
    await discussion.getByRole("region", { name: "Answer history", exact: true })
      .getByRole("button", { name: "Read original answer", exact: true }).click()
    await Promise.all([historyLoss.observed, historyLoss.failed])
    await retained()
    const pendingAnswer = () => {
      const pending = page.waitForRequest((request) => {
        const url = new URL(request.url())
        return request.method() === "POST" && url.origin === base.origin && url.pathname === base.pathname &&
          url.searchParams.get("sf") === "collaboration-answer-read"
      }).then((request) => request.response())
      void pending.catch(() => undefined)
      return pending
    }
    const threadLoss = await lose("collaboration-thread-read")
    const answerDuringLoss = pendingAnswer()
    await discussion.getByRole("button", { name: "Reconcile discussion", exact: true }).click()
    await Promise.all([threadLoss.observed, threadLoss.failed, answerDuringLoss])
    await retained()
    const reread = page.waitForResponse(responseFor(app.dashboardURL, "collaboration-thread-read", "POST"))
    const rereadAnswer = pendingAnswer()
    void reread.catch(() => undefined)
    await discussion.getByRole("button", { name: "Reconcile discussion", exact: true }).click()
    const [response, answerResponse] = await Promise.all([reread, rereadAnswer])
    if (!answerResponse) throw new Error("Installed discussion reconciliation did not receive its answer read")
    expect(answerResponse.status()).toBe(200)
    expect(answerResponse.headers()["cache-control"]).toContain("no-store")
    expect(answerResponse.request().postDataJSON()).toEqual({ questionId: answer.questionId })
    const answerBody = object(await answerResponse.json())
    expect(answerBody.status).toBe("ok")
    expectReusedReviewValue(answer, answerBody.value)
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({ id: answer.questionId })
    expect(object(object(await response.json()).value).messages).toEqual(original.messages)
    await expect(question).toHaveValue(drafts.question)
    await expect(reply).toHaveValue(drafts.reply)
    await expect(edit).toHaveValue(drafts.edit)
    await expect(discussion.getByRole("status")).toHaveText("Discussion reconciled. Your drafts are retained; send an action explicitly.")
    await expect(discussion.getByRole("button", { name: "Ask about this review", exact: true })).toBeEnabled()
    await expect(discussion.getByRole("button", { name: "Send reply", exact: true })).toBeEnabled()
    await expect(article.getByRole("button", { name: "Save answer edit", exact: true })).toBeEnabled()
    expect(mutations, "Reading and reconciling cannot submit any private draft").toEqual([])
    expect(await api.version()).toBe(version)
    expect((await api.thread(answer.questionId)).messages).toEqual(original.messages)
    expect(page.url()).not.toContain(drafts.question)
    expect(page.url()).not.toContain(drafts.reply)
    expect(page.url()).not.toContain(drafts.edit)
    await info.attach("reports-real-read-loss-reconciliation", {
      body: JSON.stringify({
        questionId: answer.questionId, losses, originalStorageVersion: version, resultingStorageVersion: version,
        retainedDrafts: ["question", "reply", "edit"], mutationRequests: mutations.length,
        reconciliations: 2, permissionSynthesized: false, privateViewPreserved: true,
      }, null, 2), contentType: "application/json",
    })
  } finally {
    page.off("request", record)
    for (const route of pendingRoutes) await page.unroute(route.matches, route.handler)
  }
}
