import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { createThreadDomainFixture } from "../wp01/thread-domain-fixture.ts"

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

