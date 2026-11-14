import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { createAckBrowserFixture } from "./browser-fixture.ts"
import { assertNoContentInNavigation, loseCommittedReply, pendingNotice, replyRoute, replyWrites, retainedPayloads, revokedNotice, waitForClearedReply } from "./proof-helpers.ts"
import type { ReplyReceipt, ReplyResponse } from "./proof-helpers.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

async function pendingAgain(app: Awaited<ReturnType<typeof createAckBrowserFixture>>) {
  await app.page.waitForFunction((notice) => {
    const entry = document.querySelector("[data-case-thread]")
    const retry = [...(entry?.querySelectorAll("button") ?? [])].find((button) => button.textContent === "Retry same reply")
    return !!retry && !retry.disabled && entry?.querySelector("[role=status]")?.textContent === notice
  }, pendingNotice)
}

test("same recipient key with changed text or expected storage version conflicts and preserves the pending original", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Frozen complete reply intent."
    const lost = await loseCommittedReply(app, body), committed = await app.inspect()
    for (const payload of [
      { ...lost.payload, body: body + " Changed." },
      { ...lost.payload, mutation: { ...lost.payload.mutation, expectedStorageVersion: lost.payload.mutation.expectedStorageVersion + 1 } },
    ]) {
      const replay = await app.send("thread-reply", payload)
      expect(replay.status).toBe(409)
      expect(replay.result).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
    }
    expect(await app.inspect()).toEqual(committed)
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    await waitForClearedReply(app.page)
    expect(await app.inspect()).toEqual(committed)
    expect(replyWrites(app)).toHaveLength(4)
    expect(replyWrites(app)[3]!.body).toBe(lost.wire.body)
    expect(replyWrites(app)[3]!.key).toBe(lost.wire.key)
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_DIVERGENT_INTENT", JSON.stringify({ threadId: app.thread.id, intentDigest: lost.receipt.intentDigest,
      changedText: "conflict", changedStorageVersion: "conflict", originalRecovered: true }))
  } finally { await app.close() }
}, 60_000)

test("recovery purges a persisted intent whose project or policy scope differs from the fresh page", async () => {
  for (const field of ["projectId", "policyVersion"] as const) {
    const app = await createAckBrowserFixture(browser)
    try {
      const body = "Pending content from a different " + field + "."
      await loseCommittedReply(app, body)
      const committed = await app.inspect()
      await app.page.evaluate((field) => {
        const keys = Object.keys(sessionStorage).filter((key) => key.startsWith("sf:recipient-reply:v1:"))
        if (keys.length !== 1) throw new Error("One pending recipient intent expected")
        const key = keys[0]!, envelope = JSON.parse(sessionStorage.getItem(key)!)
        envelope.scope[field] = "foreign-scope"
        sessionStorage.setItem(key, JSON.stringify(envelope))
      }, field)
      expect((await app.page.reload())?.status()).toBe(200)
      expect(await retainedPayloads(app.page, body)).toBe(0)
      expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
      expect(replyWrites(app)).toHaveLength(1)
      await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
      await app.page.getByLabel("Reply", { exact: true }).waitFor()
      expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe("")
      expect(await app.page.getByRole("button", { name: "Retry same reply", exact: true }).count()).toBe(0)
      expect(replyWrites(app)).toHaveLength(1)
      expect(await app.inspect()).toEqual(committed)
      expect(app.errors).toEqual([])
      console.info("UI_ACK_PERSISTED_SCOPE_PURGE", JSON.stringify({ field, purged: true, automaticWrites: 0 }))
    } finally { await app.close() }
  }
}, 90_000)

test("current projection, legacy Boolean and invalid receipt fields cannot acknowledge the pending mutation", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Receipt identity counterexample."
    await app.reply(body)
    const lost = await loseCommittedReply(app, body), committed = await app.inspect()
    const earlier = lost.value.messages.find((message) => message.body === body && message.id !== lost.receipt.reply.id)
    if (!earlier) throw new Error("Equal-text earlier message unavailable")
    const variants: { name: string; receipt: (valid: ReplyReceipt) => unknown }[] = [
      { name: "missing", receipt: () => undefined },
      { name: "legacy-Boolean", receipt: () => true },
      { name: "wrong-principal", receipt: (receipt) => ({ ...receipt, principalRef: "reader-c" }) },
      { name: "wrong-key", receipt: (receipt) => ({ ...receipt, idempotencyKey: "different-operation" }) },
      { name: "wrong-thread", receipt: (receipt) => ({ ...receipt, threadId: "different-thread" }) },
      { name: "wrong-intent", receipt: (receipt) => ({ ...receipt, intentDigest: "0".repeat(64) }) },
      { name: "wrong-command", receipt: (receipt) => ({ ...receipt, commandDigest: "0".repeat(64) }) },
      { name: "missing-message", receipt: (receipt) => ({ ...receipt, reply: { ...receipt.reply, id: "missing-message" } }) },
      { name: "different-incarnation", receipt: (receipt) => ({ ...receipt, reply: { ...receipt.reply, incarnation: "different-incarnation" } }) },
      { name: "different-version", receipt: (receipt) => ({ ...receipt, reply: { ...receipt.reply, version: receipt.reply.version + 1 } }) },
      { name: "equal-text-prior-message", receipt: (receipt) => ({ ...receipt, reply: { id: earlier.id, incarnation: earlier.incarnation, version: earlier.version } }) },
      { name: "different-source", receipt: (receipt) => ({ ...receipt, sourceIncarnation: "different-source" }) },
    ]
    for (const variant of variants) {
      await app.page.route(replyRoute, async (route) => {
        const response = await route.fetch()
        const original = await response.json() as ReplyResponse
        expect(response.status()).toBe(200)
        expect(original.value.mutationReceipt).toEqual(lost.receipt)
        // Negative delivery corruption only; positive receipts always come from C08.
        await route.fulfill({ response, body: JSON.stringify({ ...original, value: { ...original.value,
          mutationReceipt: variant.receipt(original.value.mutationReceipt) } }) })
      })
      await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
      await pendingAgain(app)
      expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
      expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
      expect(await retainedPayloads(app.page, body)).toBe(1)
      expect(await app.inspect()).toEqual(committed)
      await app.page.unroute(replyRoute)
    }
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    await waitForClearedReply(app.page)
    expect(await app.inspect()).toEqual(committed)
    expect(replyWrites(app)).toHaveLength(variants.length + 2)
    expect(replyWrites(app).every((write) => write.body === lost.wire.body && write.key === lost.wire.key)).toBe(true)
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_INVALID_RECEIPTS", JSON.stringify({ threadId: app.thread.id, refused: variants.map((variant) => variant.name),
      exactAttempts: variants.length + 2, originalRecovered: true }))
  } finally { await app.close() }
}, 90_000)

test("an access-revoked event purges a pending intent even after its conversation element detaches", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Detached conversation keeps no private pending intent."
    await loseCommittedReply(app, body)
    const committed = await app.inspect()
    expect(await retainedPayloads(app.page, body)).toBe(1)
    // The lifecycle signal is synthetic; the committed reply and receipt are
    // the real producer's. A disconnected element must not bypass the purge.
    const detached = await app.page.evaluate(() => {
      const entry = document.querySelector<HTMLElement>("[data-case-thread]")
      if (!entry) throw new Error("Conversation element unavailable")
      entry.remove()
      dispatchEvent(new CustomEvent("sf-access-revoked"))
      return { connected: entry.isConnected, text: entry.textContent, attributes: { ...entry.dataset } }
    })
    expect(detached.connected).toBe(false)
    expect(detached.text).toBe(revokedNotice)
    expect(detached.text).not.toContain(body)
    for (const key of ["case", "caseSummary", "thread", "principal", "accessRevision", "installation", "project", "policy"]) {
      expect(detached.attributes[key]).toBeUndefined()
    }
    expect(await retainedPayloads(app.page, body)).toBe(0)
    expect(replyWrites(app)).toHaveLength(1)
    expect(await app.inspect()).toEqual(committed)
    expect((await app.page.reload())?.status()).toBe(200)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByLabel("Reply", { exact: true }).waitFor()
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe("")
    expect(replyWrites(app)).toHaveLength(1)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_DETACHED_PURGE", JSON.stringify({ automaticWrites: 0, purged: true, detached: true }))
  } finally { await app.close() }
}, 60_000)

test("legacy persisted Boolean remains unavailable after retry and reload without a synthetic ACK", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Legacy outcome must remain uncertain."
    const lost = await loseCommittedReply(app, body)
    await app.legacyOutcome(lost.payload.mutation.idempotencyKey)
    const committed = await app.inspect()
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    await pendingAgain(app)
    expect(replyWrites(app)).toHaveLength(2)
    expect(replyWrites(app)[1]!.status).toBe(503)
    expect(JSON.parse(replyWrites(app)[1]!.response)).toEqual({ status: "unavailable", reason: "thread-mutation-receipt-unavailable" })
    expect(await app.inspect()).toEqual(committed)
    await app.reopen()
    expect((await app.page.reload())?.status()).toBe(200)
    expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
    expect(replyWrites(app)).toHaveLength(2)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).waitFor()
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(replyWrites(app)).toHaveLength(2)
    expect(await app.inspect()).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_LEGACY_OUTCOME", JSON.stringify({ threadId: app.thread.id, status: "unavailable",
      automaticWrites: 0, sqliteReopened: true, acknowledged: false }))
  } finally { await app.close() }
}, 60_000)

test("editing the exact committed message invalidates its old version instead of matching the new text", async () => {
  const app = await createAckBrowserFixture(browser)
  try {
    const body = "Message before an authorized edit."
    const lost = await loseCommittedReply(app, body)
    await app.editMessage(lost.receipt.reply.id, lost.receipt.reply.version, body + " Edited.")
    const changed = await app.inspect()
    if (changed.status !== "ok" || !changed.value) throw new Error("Edited thread unavailable")
    const message = changed.value.messages.find((item) => item.id === lost.receipt.reply.id)
    expect(message?.incarnation).toBe(lost.receipt.reply.incarnation)
    expect(message?.version).toBe(lost.receipt.reply.version + 1)
    await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
    await pendingAgain(app)
    expect(replyWrites(app)).toHaveLength(2)
    expect(replyWrites(app)[1]!.status).toBe(503)
    expect(JSON.parse(replyWrites(app)[1]!.response)).toEqual({ status: "unavailable", reason: "thread-mutation-receipt-unavailable" })
    expect(await app.inspect()).toEqual(changed)
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(await retainedPayloads(app.page, body)).toBe(1)
    expect(app.errors).toEqual([])
    console.info("UI_ACK_EDITED_MESSAGE", JSON.stringify({ threadId: app.thread.id, original: lost.receipt.reply,
      currentVersion: message?.version, acknowledged: false }))
  } finally { await app.close() }
}, 60_000)

test("revocation and principal switch purge the scoped intent before any retry or protected render", async () => {
  for (const change of ["revocation", "principal-switch"] as const) {
    const app = await createAckBrowserFixture(browser)
    try {
      const body = "Private pending " + change + "."
      await loseCommittedReply(app, body)
      const committed = await app.inspect()
      expect(await retainedPayloads(app.page, body)).toBe(1)
      if (change === "revocation") app.actors["reader-b"]!.enabled = false
      if (change === "principal-switch") await app.context.setExtraHTTPHeaders({ actor: "reader-c" })
      await app.page.getByRole("button", { name: "Retry same reply", exact: true }).click()
      await app.page.getByText(revokedNotice, { exact: true }).waitFor()
      expect(replyWrites(app)).toHaveLength(1)
      expect(await app.page.getByLabel("Reply", { exact: true }).count()).toBe(0)
      expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
      expect(await retainedPayloads(app.page, body)).toBe(0)
      expect(await app.inspect()).toEqual(committed)
      await assertNoContentInNavigation(app.page, body)
      if (change === "revocation") app.actors["reader-b"]!.enabled = true
      await app.context.setExtraHTTPHeaders({ actor: "reader-b" })
      expect((await app.page.reload())?.status()).toBe(200)
      await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
      await app.page.getByLabel("Reply", { exact: true }).waitFor()
      expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe("")
      expect(replyWrites(app)).toHaveLength(1)
      expect(app.errors).toEqual([])
      console.info("UI_ACK_SCOPE_PURGE", JSON.stringify({ reason: change, automaticWrites: 0, purged: true }))
    } finally { await app.close() }
  }
}, 90_000)

