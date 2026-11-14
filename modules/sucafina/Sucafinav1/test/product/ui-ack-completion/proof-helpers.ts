import { expect } from "bun:test"
import type { Page } from "@playwright/test"
import type { createAckBrowserFixture } from "./browser-fixture.ts"

export type AckFixture = Awaited<ReturnType<typeof createAckBrowserFixture>>
export type ReplyPayload = { id: string; body: string; mutation: { expectedStorageVersion: number; idempotencyKey: string } }
export type ReplyReceipt = { kind: string; action: string; threadId: string; principalRef: string; idempotencyKey: string; commandDigest: string; intentDigest: string; sourceIncarnation: string; reply: { id: string; incarnation: string; version: number } }
export type ReplyResponse = { status: string; value: { mutationReceipt: ReplyReceipt; messages: { id: string; incarnation: string; version: number; body: string; authorRef: string; sourceContext?: { sourceIncarnation: string } }[]; state: string }; reason?: string }

export const replyRoute = "**/*?sf=collaboration-thread-reply"
export const pendingNotice = "Could not confirm the reply. Your text is preserved; retry the same request."
export const revokedNotice = "Conversation access changed. Reopen the decision with your current access."
export const replyWrites = (app: AckFixture) => app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")

export async function openConversation(app: AckFixture) {
  expect((await app.page.goto(app.origin + "/product"))?.status()).toBe(200)
  await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
  await app.page.getByLabel("Reply", { exact: true }).waitFor()
}

/** Damage delivery only after the actual HTTP producer has committed. */
export async function loseCommittedReply(app: AckFixture, body: string) {
  await openConversation(app)
  await app.page.getByLabel("Reply", { exact: true }).fill(body)
  let delivered: ReplyResponse | undefined
  await app.page.route(replyRoute, async (route) => {
    const response = await route.fetch()
    if (response.status() !== 200) { await route.fulfill({ response }); return }
    delivered = await response.json() as ReplyResponse
    await route.fulfill({ response, body: "{" })
  })
  await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
  await app.page.getByText(pendingNotice, { exact: true }).waitFor()
  await app.page.unroute(replyRoute)
  if (!delivered || delivered.status !== "ok" || !delivered.value.mutationReceipt) throw new Error("Real receipt missing before delivery loss")
  const writes = replyWrites(app)
  expect(writes).toHaveLength(1)
  expect(writes[0]!.status).toBe(200)
  expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
  expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
  const payload = JSON.parse(writes[0]!.body) as ReplyPayload
  return { receipt: delivered.value.mutationReceipt, value: delivered.value, payload, wire: writes[0]! }
}

export async function waitForClearedReply(page: Page) {
  await page.waitForFunction(() => {
    const reply = document.querySelector("[data-case-thread] textarea") as HTMLTextAreaElement | null
    return !!reply && !reply.disabled && reply.value === ""
  })
}

export async function retainedPayloads(page: Page, body: string) {
  return page.evaluate((text) => Object.values(sessionStorage).filter((value) => value.includes(text)).length, body)
}

export async function assertNoContentInNavigation(page: Page, body: string) {
  expect(page.url()).not.toContain(body)
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(body)
}

