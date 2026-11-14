import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, Frame } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createAckBrowserFixture } from "./browser-fixture.ts"
import { assertNoContentInNavigation, loseCommittedReply, replyWrites, retainedPayloads, waitForClearedReply } from "./proof-helpers.ts"
import type { ReplyResponse } from "./proof-helpers.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

test("recipient ACK selects the committed identity among equal messages and exact retry never appends twice", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Identical recipient contribution."
    await app.reply(body)
    const lost = await loseCommittedReply(app, body)
    await app.reply(body)
    const committed = await app.inspect()
    if (committed.status !== "ok" || !committed.value) throw new Error("Committed thread unavailable")
    expect(committed.value.messages.filter((message) => message.body === body)).toHaveLength(3)
    expect(new Set(committed.value.messages.map((message) => message.id)).size).toBe(4)
    expect(lost.receipt).toMatchObject({
      kind: "recipient-thread-action-v1", action: "reply", principalRef: "reader-b",
      threadId: app.thread.id, idempotencyKey: lost.payload.mutation.idempotencyKey,
      commandDigest: digestSfValue({ id: app.thread.id, action: { kind: "reply", body } }),
      intentDigest: digestSfValue(lost.payload),
    })
    const exact = committed.value.messages.filter((message) => message.id === lost.receipt.reply.id &&
      message.incarnation === lost.receipt.reply.incarnation && message.version === lost.receipt.reply.version)
    expect(exact).toHaveLength(1)
    expect(exact[0]!.authorRef).toBe("reader-b")
    expect(exact[0]!.sourceContext?.sourceIncarnation).toBe(lost.receipt.sourceIncarnation)
    const replay = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    const replayed = await (await replay).json() as ReplyResponse
    expect(replayed.status).toBe("ok")
    expect(replayed.value.mutationReceipt).toEqual(lost.receipt)
    expect(replayed.value.messages).toHaveLength(4)
    await waitForClearedReply(app.page)
    expect(replyWrites(app)).toHaveLength(2)
    expect(replyWrites(app).map(({ body, key }) => ({ body, key }))).toEqual([
      { body: lost.wire.body, key: lost.wire.key }, { body: lost.wire.body, key: lost.wire.key },
    ])
    expect(await app.inspect()).toEqual(committed)
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(app.attempts.some((attempt) => /answer-confirm|decision-answer/.test(attempt.route ?? ""))).toBe(false)
    await assertNoContentInNavigation(app.page, body)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_EXACT_RETRY", JSON.stringify({ threadId: app.thread.id, reply: lost.receipt.reply,
      intentDigest: lost.receipt.intentDigest, attempts: 2, equalTextReplies: 3, storageVersion: committed.storageVersion }))
  } finally { await app.close() }
}, 60_000)

test("pagehide removes protected pending content and persisted pageshow reauthorizes by GET without autosend", async () => {
  const app = await createAckBrowserFixture(browser)
  const release = Promise.withResolvers<void>()
  let navigationCommits = 0
  const countCommit = (frame: Frame) => { if (frame === app.page.mainFrame()) navigationCommits++ }
  app.page.on("framenavigated", countCommit)
  try {
    const body = "Private pending contribution across page lifecycle."
    const lost = await loseCommittedReply(app, body), committed = await app.inspect()
    const reads = app.attempts.filter((attempt) => attempt.route === "collaboration-thread-read").length
    await app.page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })))
    expect(await app.page.locator("[data-case-thread]").isHidden()).toBe(true)
    expect(await app.page.locator("[data-thread-messages]").textContent()).toBe("")
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await retainedPayloads(app.page, body)).toBe(1)
    expect(replyWrites(app)).toHaveLength(1)
    // Ignore the initial authorized document; observe only pageshow's reload.
    navigationCommits = 0
    const reading = Promise.withResolvers<void>()
    await app.page.route(app.origin + "/product", async (route) => {
      if (!route.request().isNavigationRequest()) return route.continue()
      expect(route.request().method()).toBe("GET")
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      reading.resolve()
      await release.promise
      await route.fulfill({ response })
    })
    // PageTransitionEvent controls the browser lifecycle only, without
    // synthesizing domain reads, authority or receipts.
    await app.page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
    await reading.promise
    // The old document was already proved hidden and empty above. Locator
    // queries during a pending navigation can wait for its new context, so
    // observe the commit boundary while the real GET response is gated.
    expect(navigationCommits).toBe(0)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-thread-read")).toHaveLength(reads)
    expect(replyWrites(app)).toHaveLength(1)
    const navigated = app.page.waitForEvent("framenavigated", { predicate: (frame) => frame === app.page.mainFrame() })
    release.resolve()
    await navigated
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).waitFor()
    expect(navigationCommits).toBe(1)
    await app.page.unroute(app.origin + "/product")
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-thread-read")).toHaveLength(reads)
    expect(replyWrites(app)).toHaveLength(1)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).waitFor()
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(replyWrites(app)).toHaveLength(1)
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    await waitForClearedReply(app.page)
    expect(replyWrites(app).map(({ body, key }) => ({ body, key }))).toEqual([
      { body: lost.wire.body, key: lost.wire.key }, { body: lost.wire.body, key: lost.wire.key },
    ])
    expect(await app.inspect()).toEqual(committed)
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_PAGE_LIFECYCLE", JSON.stringify({ hiddenBeforeReload: true, freshGet: true,
      automaticWrites: 0, originalRecovered: true }))
  } finally { release.resolve(); app.page.off("framenavigated", countCommit); await app.close() }
}, 60_000)

test("reload reauthorizes before showing pending content and replays a resolved thread without reopening or autosend", async () => {
  const app = await createAckBrowserFixture(browser)
  const release = Promise.withResolvers<void>()
  try {
    const body = "Durable pending recipient contribution."
    const lost = await loseCommittedReply(app, body)
    await app.reply(body)
    await app.resolveThread()
    const committed = await app.inspect(), history = await app.historyCount()
    if (committed.status !== "ok" || !committed.value) throw new Error("Resolved thread unavailable")
    expect(committed.value.state).toBe("resolved")
    expect(committed.value.messages).toHaveLength(3)
    await app.reopen()
    expect(await app.inspect()).toEqual(committed)
    expect(await retainedPayloads(app.page, body)).toBe(1)
    expect((await app.page.reload())?.status()).toBe(200)
    expect(replyWrites(app)).toHaveLength(1)
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    const reading = Promise.withResolvers<void>()
    await app.page.route("**/*?sf=collaboration-thread-read", async (route) => {
      const response = await route.fetch()
      reading.resolve()
      await release.promise
      await route.fulfill({ response })
    })
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await reading.promise
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    expect(replyWrites(app)).toHaveLength(1)
    release.resolve()
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).waitFor()
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(replyWrites(app)).toHaveLength(1)
    await app.page.unroute("**/*?sf=collaboration-thread-read")
    const replay = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    const result = await (await replay).json() as ReplyResponse
    expect(result.status).toBe("ok")
    expect(result.value.mutationReceipt).toEqual(lost.receipt)
    expect(result.value.state).toBe("resolved")
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).waitFor({ state: "hidden" })
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(await app.inspect()).toEqual(committed)
    expect(await app.historyCount()).toEqual(history)
    expect(replyWrites(app).map(({ body, key }) => ({ body, key }))).toEqual([
      { body: lost.wire.body, key: lost.wire.key }, { body: lost.wire.body, key: lost.wire.key },
    ])
    expect(app.attempts.some((attempt) => /answer-confirm|decision-answer/.test(attempt.route ?? ""))).toBe(false)
    await assertNoContentInNavigation(app.page, body)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_RELOAD_RESOLVED", JSON.stringify({ threadId: app.thread.id, reply: lost.receipt.reply,
      intentDigest: lost.receipt.intentDigest, attempts: 2, state: "resolved", storageVersion: committed.storageVersion,
      reloadReauthorized: true, sqliteReopened: true, automaticWrites: 0 }))
  } finally { release.resolve(); await app.close() }
}, 60_000)

