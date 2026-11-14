import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createBrowserHostFixture } from "./browser-host-fixture.ts"
import { available } from "./domain-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

// Isolated after run 43621603578 failed before observing attachment. No deadline
// or prior assertion is relaxed; retain intermediate HTTP outcomes on failure.
test("confirmation selects the exact latest message despite an old equal-text selector and replays a lost confirmation once", async () => {
  const app = await createBrowserHostFixture(browser)
  let phase = "setup"
  try {
    const body = "Same text, different message identity."
    const first = await app.reply(body), old = first.messages.at(-1)!
    app.view.savedAnswerRef = available(await app.port.answerEvidence.issue(app.thread.id, old.id, app.recipient)).refId
    const latest = (await app.reply(body)).messages.at(-1)!
    expect(latest.id).not.toBe(old.id)
    expect(latest.incarnation).not.toBe(old.incarnation)
    expect((await app.page.goto(`${app.origin}/product`))?.status()).toBe(200)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const confirm = app.page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true })
    await confirm.last().waitFor()
    expect(await confirm.count()).toBe(2)
    expect(await confirm.first().isDisabled()).toBe(true)
    let damaged = false
    await app.page.route("**/*?sf=collaboration-answer-confirm", async (route) => {
      const response = await route.fetch()
      if (!damaged && response.status() === 200) { damaged = true; await route.fulfill({ response, body: "{" }); return }
      await route.fulfill({ response })
    })
    phase = "first-confirmation"
    await confirm.last().click()
    await app.page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    const prepared = app.attempts.find((attempt) => attempt.route === "collaboration-answer-prepare-message")!
    expect(prepared.status).toBe(200)
    expect(JSON.parse(prepared.body)).toEqual({ questionId: app.thread.id, messageId: latest.id, incarnation: latest.incarnation, version: latest.version })
    const receipt = JSON.parse(prepared.response).value
    expect(receipt.answerRef).not.toBe(app.view.savedAnswerRef)
    expect(receipt.answerRef).toBe(available(await app.port.answerEvidence.issue(app.thread.id, latest.id, app.recipient)).refId)
    expect(damaged).toBe(true)
    expect(app.attempts.find((attempt) => attempt.route === "collaboration-answer-confirm")?.status).toBe(200)
    expect(app.attempts.some((attempt) => attempt.route === "collaboration-answer-prepare")).toBe(false)
    expect(app.attempts.some((attempt) => attempt.route === "decision-answer-question")).toBe(false)
    const before = await app.state.read(app.request("reader-b"), "threads", (state) => state.threads)
    const confirmations = await app.state.read(app.request("reader-b"), "confirmations", (state) => state.confirmations)
    phase = "confirmation-replay-to-attachment"
    const attachment = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-answer-question")
    await confirm.last().click()
    // The real case-attachment mount is outside this composition and write lease.
    expect((await attachment).status()).toBe(404)
    await app.page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    const writes = app.attempts.filter((attempt) => attempt.route === "collaboration-answer-confirm")
    expect(writes).toHaveLength(2)
    expect(writes.every((attempt) => attempt.status === 200)).toBe(true)
    expect(writes[1]!.body).toBe(writes[0]!.body)
    expect(writes[1]!.key).toBe(writes[0]!.key)
    expect(await app.state.read(app.request("reader-b"), "threads", (state) => state.threads)).toEqual(before)
    expect(await app.state.read(app.request("reader-b"), "confirmations", (state) => state.confirmations)).toEqual(confirmations)
    const reused = await app.send("answer-read", { questionId: app.thread.id })
    expect(reused).toMatchObject({ status: 200, result: { status: "ok", value: { answerRef: receipt.answerRef, answer: body, authorRef: "reader-b", observedVersion: receipt.observedSourceVersion } } })
    phase = "reload"
    await app.page.reload()
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByText(body, { exact: true }).last().waitFor()
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-answer-confirm")).toHaveLength(2)
    expect(app.attempts.filter((attempt) => attempt.route === "decision-answer-question")).toHaveLength(1)
    expect(app.errors).toEqual([])
    console.info("UI_WORK_EXACT_CONFIRMATION", JSON.stringify({ questionId: app.thread.id, selected: { id: latest.id, incarnation: latest.incarnation, version: latest.version }, oldAnswerRef: app.view.savedAnswerRef, confirmedAnswerRef: receipt.answerRef, exactAttempts: 2, attachment: "UNMOUNTED_404" }))
  } finally {
    try {
      console.info("UI_WORK_CONFIRMATION_PHASE", JSON.stringify({ phase, statuses: await app.page.locator('[role="status"]').allTextContents(), errors: app.errors }))
      console.info("UI_WORK_CONFIRMATION_HTTP", JSON.stringify(app.attempts.map((attempt) => ({ route: attempt.route, status: attempt.status, key: attempt.key,
        body: attempt.route?.includes("answer") ? attempt.body : undefined, response: attempt.route?.includes("answer") ? attempt.response : undefined }))))
    } finally { await app.close() }
  }
}, 60_000)
