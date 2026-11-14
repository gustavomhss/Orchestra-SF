import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createThreadDomainFixture } from "../../wp01/thread-domain-fixture.ts"
import { createBrowserHostFixture } from "./browser-host-fixture.ts"
import { available } from "./domain-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

test("an exact C08 reply snapshot survives lost delivery and identical concurrent replies without a duplicate after retry or reload", async () => {
  const app = await createThreadDomainFixture()
  let context: BrowserContext | undefined
  try {
    const body = "The same recipient answer."
    await app.concurrentReply(body)
    context = await browser.newContext()
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(5_000)
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(`${app.origin}/sucafina/auth/local?code=${await app.identity.enroll()}`))?.status()).toBe(200)
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill(body)
    let original: Awaited<ReturnType<typeof app.concurrentReply>> | undefined
    await page.route("**/*?sf=collaboration-thread-reply", async (route) => {
      const response = await route.fetch()
      if (original || response.status() !== 200) { await route.fulfill({ response }); return }
      original = (await response.json()).value
      await app.concurrentReply(body)
      // Delivery damage only: all three equal-text replies are real producer writes.
      await route.fulfill({ response, body: "{" })
    })
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    const committed = await app.inspect()
    if (committed.status !== "ok" || !committed.value || !original) throw new Error("Exact C08 reply unavailable")
    expect(committed.value.messages.filter((message) => message.body === body)).toHaveLength(3)
    expect(new Set(committed.value.messages.map((message) => message.id)).size).toBe(4)
    expect(original.messages).toHaveLength(3)
    const exact = original.messages[2]!
    expect(committed.value.messages[2]).toEqual(exact)
    const replayed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await (await replayed).json()).value).toEqual(original)
    await page.waitForFunction(() => {
      const reply = document.querySelector("[data-case-thread] textarea") as HTMLTextAreaElement | null
      return !!reply && !reply.disabled && reply.value === ""
    })
    expect(await app.inspect()).toEqual(committed)
    expect(app.attempts).toHaveLength(2)
    expect(app.attempts[1]!.body).toBe(app.attempts[0]!.body)
    expect(app.attempts[1]!.key).toBe(app.attempts[0]!.key)
    await page.reload()
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).waitFor()
    expect(await page.getByText(body, { exact: true }).count()).toBe(3)
    expect(app.attempts).toHaveLength(2)
    expect(await app.inspect()).toEqual(committed)
    expect(errors).toEqual([])
    console.info("UI_WORK_EXACT_REPLY", JSON.stringify({ threadId: app.initial.id, message: { id: exact.id, incarnation: exact.incarnation, version: exact.version }, attempts: 2, storageVersion: committed.storageVersion, equalTextReplies: 3 }))
  } finally {
    await context?.close()
    await app.close()
  }
}, 45_000)

test("shared recipient current projections stay unconfirmed across exact retries, reload and fresh distinct-recipient admission", async () => {
  const app = await createBrowserHostFixture(browser)
  try {
    const body = "Repeated answer by the distinct recipient."
    await app.reply(body)
    expect((await app.page.goto(`${app.origin}/product`))?.status()).toBe(200)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByLabel("Reply", { exact: true }).fill(body)
    let currentResponse: unknown
    await app.page.route("**/*?sf=collaboration-thread-reply", async (route) => {
      const response = await route.fetch()
      if (!currentResponse && response.status() === 200) {
        currentResponse = (await response.json()).value
        await app.reply(body)
      }
      await route.fulfill({ response })
    })
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    await app.page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(currentResponse).toHaveProperty("current")
    expect(currentResponse).toMatchObject({ messages: [{}, {}, {}] })
    const committed = await app.inspect()
    if (committed.status !== "ok" || !committed.value) throw new Error("Real recipient state unavailable")
    expect(committed.value.messages.filter((message) => message.body === body)).toHaveLength(3)
    const replay = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await replay).status()).toBe(200)
    await app.page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(await app.page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    const writes = app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")
    expect(writes).toHaveLength(2)
    expect(writes.map(({ body, key }) => ({ body, key }))).toEqual([{ body: writes[0]!.body, key: writes[0]!.key }, { body: writes[0]!.body, key: writes[0]!.key }])
    expect(await app.inspect()).toEqual(committed)
    await app.page.reload()
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByLabel("Reply", { exact: true }).waitFor()
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(3)
    app.actors["reader-b"]!.enabled = false
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByText("Conversation access changed. Reopen the decision with your current access.", { exact: true }).waitFor()
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    const other = await app.send("thread-read", { id: app.thread.id }, "reader-c")
    expect(other.result.status).not.toBe("ok")
    expect(JSON.stringify(other.result)).not.toContain(body)
    app.actors["reader-b"]!.enabled = true
    const fresh = await app.admitRead("reader-b")
    expect(fresh).not.toBe(app.recipient)
    expect((await app.page.reload())?.status()).toBe(200)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByLabel("Reply", { exact: true }).waitFor()
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(3)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")).toHaveLength(2)
    expect(await app.inspect()).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("UI_WORK_RECIPIENT_ACK_DEPENDENCY", JSON.stringify({ threadId: app.thread.id, producerShape: "RecipientThread.current", recipient: fresh.binding.principalRef, author: app.thread.messages[0]!.authorRef, exactAttempts: 2, storedMessages: committed.value.messages.length, acknowledged: false }))
  } finally { await app.close() }
}, 60_000)

test("confirmation selects the exact latest message despite an old equal-text selector and replays a lost confirmation once", async () => {
  const app = await createBrowserHostFixture(browser)
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
    await confirm.last().click()
    await app.page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    const prepared = app.attempts.find((attempt) => attempt.route === "collaboration-answer-prepare-message")!
    expect(prepared.status).toBe(200)
    expect(JSON.parse(prepared.body)).toEqual({ questionId: app.thread.id, messageId: latest.id, incarnation: latest.incarnation, version: latest.version })
    const receipt = JSON.parse(prepared.response).value
    expect(receipt.answerRef).not.toBe(app.view.savedAnswerRef)
    expect(app.attempts.some((attempt) => attempt.route === "collaboration-answer-prepare")).toBe(false)
    expect(app.attempts.some((attempt) => attempt.route === "decision-answer-question")).toBe(false)
    const before = await app.state.read(app.request("reader-b"), "threads", (state) => state.threads)
    const confirmations = await app.state.read(app.request("reader-b"), "confirmations", (state) => state.confirmations)
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
    await app.page.reload()
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByText(body, { exact: true }).last().waitFor()
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-answer-confirm")).toHaveLength(2)
    expect(app.attempts.filter((attempt) => attempt.route === "decision-answer-question")).toHaveLength(1)
    expect(app.errors).toEqual([])
    console.info("UI_WORK_EXACT_CONFIRMATION", JSON.stringify({ questionId: app.thread.id, selected: { id: latest.id, incarnation: latest.incarnation, version: latest.version }, oldAnswerRef: app.view.savedAnswerRef, confirmedAnswerRef: receipt.answerRef, exactAttempts: 2, attachment: "UNMOUNTED_404" }))
  } finally { await app.close() }
}, 60_000)
