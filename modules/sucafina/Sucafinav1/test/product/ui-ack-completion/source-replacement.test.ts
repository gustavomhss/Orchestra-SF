import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { createAckBrowserFixture } from "./browser-fixture.ts"
import { loseCommittedReply, replyWrites } from "./proof-helpers.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)


test("physical source replacement refuses the old recipient intent and reload cannot render its protected text", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Pending contribution to the previous physical source."
    const lost = await loseCommittedReply(app, body), committed = await app.inspect()
    const replacement = await app.replaceSource()
    expect(replacement.current.incarnation).not.toBe(replacement.previous.incarnation)
    const result = await app.send("thread-reply", lost.payload)
    expect(result.status).not.toBe(200)
    expect(result.result.status).not.toBe("ok")
    expect(JSON.stringify(result.result)).not.toContain(body)
    expect(JSON.stringify(result.result)).not.toContain("mutationReceipt")
    expect(await app.inspect()).toEqual(committed)
    // A Chromium navigation to this actual empty 503 may reject rather than
    // return a Response. Observe the HTTP result independently and tolerate
    // only that documented navigation failure, never an authorization success.
    const deniedDocument = await app.context.request.get(app.origin + "/product")
    expect(deniedDocument.status()).toBe(503)
    expect((await deniedDocument.body()).byteLength).toBe(0)
    try { expect((await app.page.reload())?.status()).toBe(503) }
    catch (error) {
      if (!(error instanceof Error) || !/^page\.reload: net::ERR_HTTP_RESPONSE_CODE_FAILURE(?:\s|$)/.test(error.message)) throw error
    }
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await app.page.getByRole("button", { name: "Retry same reply", exact: true }).count()).toBe(0)
    expect(replyWrites(app)).toHaveLength(2)
    expect(await app.inspect()).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_SOURCE_REPLACED", JSON.stringify({ threadId: app.thread.id, sourceReplaced: true,
      replayStatus: result.status, automaticWrites: 0, protectedRendered: false }))
  } finally { await app.close() }
}, 60_000)

