import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import { caseQuestionScript, caseQuestionThreads } from "../../../product/ui/work-collaboration.ts"
import { launchWp01Browser, closeWp01Browser } from "./browser-fixture.ts"
import { createThreadDomainFixture } from "./thread-domain-fixture.ts"

// Transport-component cases below use declared fault envelopes. The real
// reply cases separately compose C03/C08/source authority and encrypted sessions.
// Neither lane is WP10's composed host or proof of native execution.
// Full confirmation still needs the published host's answer selector/observation
// flow; an HTTP acknowledgement here never proves durable domain idempotence.
const projection: AuthorizedCaseProjection = {
  context: { kind: "ui", installationId: "installation", projectId: "project", principalRef: "operator", policyVersion: "policy", accessRevision: "access" },
  case: { id: "private-case", incarnation: "case-incarnation", version: 1, state: "investigating", objective: "Private decision",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["operator"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [],
    questions: [{ id: "private-question", text: "Restricted question title", state: "open" }], choices: [], preparedChanges: [], receipts: [], ledger: [] },
  events: [], evidenceRefs: [], checkedAt: "2026-11-14T00:00:00Z",
}
const thread = { state: "open", recipientRef: "recipient", messages: [
  { id: "question-message", authorRef: "operator", body: "Private question body" },
  { id: "answer-message", authorRef: "recipient", body: "Private recipient answer" },
] }
// This is an explicit authorized-renderer input for the transport tests only.
// The composed host still needs to expose the first selector for an open question.
const answerRef = "published-answer-selector"
const selectedProjection: AuthorizedCaseProjection = { ...projection, case: { ...projection.case, questions: projection.case.questions.map((question) => ({ ...question, answerRef })) } }
const preparedAnswer = { answerRef, answer: "Private recipient answer", authorRef: "recipient", observationRef: "producer-observation", observedSourceVersion: 3, expectedScopeFingerprint: "producer-scope-fingerprint" }
const ok = (value: unknown) => Response.json({ status: "ok", value })
const mode = (request: Request) => new URL(request.url).searchParams.get("sf")

let browser: Browser | undefined
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

async function bounded<T>(operation: Promise<T>, step: string, timeout = 5_000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Thread fixture timed out: " + step)), timeout) })]) }
  finally { clearTimeout(timer) }
}

function unfinished() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const response = new Response(new ReadableStream<Uint8Array>({
    start(value) { controller = value; value.enqueue(new TextEncoder().encode('{"status":"ok","value":')) },
    cancel() { controller = undefined },
  }), { headers: { "Content-Type": "application/json", "X-Thread-Body-Pending": "yes" } })
  return { response, finish: (value: unknown = {}) => {
    const current = controller; controller = undefined
    if (!current) return
    try { current.enqueue(new TextEncoder().encode(JSON.stringify(value) + '}')); current.close() }
    catch { /* The browser may already have cancelled this deliberately suspended body. */ }
  } }
}

async function browserCase(post: (request: Request) => Response | Promise<Response>, check: (page: Page) => Promise<void>, release?: () => void, view = projection) {
  const server = Bun.serve({ hostname: "localhost", port: 0, idleTimeout: 30, fetch: (request) => request.method === "GET"
    ? new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body>${caseQuestionThreads(view)}<script>${caseQuestionScript}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    : post(request) })
  let context: BrowserContext | undefined
  let failure: unknown
  try {
    if (!browser?.isConnected()) throw new Error("Thread browser unavailable")
    context = await bounded(browser.newContext(), "open isolated context")
    const page = await bounded(context.newPage(), "open page")
    page.setDefaultTimeout(5_000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(server.url.href)
    await check(page)
    expect(errors).toEqual([])
  } catch (error) { failure = error; throw error }
  finally {
    const cleanup: unknown[] = []
    try { release?.() } catch (error) { cleanup.push(error) }
    try { await bounded(Promise.resolve(server.stop(true)), "stop transport fixture") } catch (error) { cleanup.push(error) }
    try { if (context) await bounded(context.close(), "close isolated context") } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Thread fixture cleanup failed")
  }
}

async function domainBrowserCase(check: (page: Page, fixture: Awaited<ReturnType<typeof createThreadDomainFixture>>) => Promise<void>) {
  const fixture = await createThreadDomainFixture()
  let context: BrowserContext | undefined
  let failure: unknown
  try {
    if (!browser?.isConnected()) throw new Error("Thread browser unavailable")
    context = await bounded(browser.newContext(), "open domain context")
    const page = await bounded(context.newPage(), "open domain page")
    page.setDefaultTimeout(5_000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`)
    expect((await page.goto(`${fixture.origin}/sucafina/conversation`))?.status()).toBe(200)
    await check(page, fixture)
    expect(errors).toEqual([])
  } catch (error) { failure = error; throw error }
  finally {
    const cleanup: unknown[] = []
    try { await bounded(fixture.close(), "close real thread fixture") } catch (error) { cleanup.push(error) }
    try { if (context) await bounded(context.close(), "close domain context") } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Thread domain cleanup failed")
  }
}

test("conversation read deadline includes an unfinished body and restores the unsent reply controls", async () => {
  const suspended = unfinished()
  let reads = 0
  await browserCase(() => ++reads === 1 ? ok(thread) : suspended.response, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const reply = page.getByLabel("Reply", { exact: true })
    await reply.fill("My private unsent reply")
    const headers = page.waitForResponse((response) => response.headers()["x-thread-body-pending"] === "yes")
    const aborted = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "collaboration-thread-read", timeout: 15_000 })
    page.once("dialog", (dialog) => void dialog.accept())
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    expect((await headers).status()).toBe(200)
    expect(await reply.isDisabled()).toBe(true)
    await page.getByText("Conversation unavailable. Your unsent reply is preserved.", { exact: true }).waitFor({ timeout: 15_000 })
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED")
    expect(await reply.inputValue()).toBe("My private unsent reply")
    expect(await reply.isDisabled()).toBe(false)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(false)
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(false)
    expect(await reply.locator("..").locator("..").getAttribute("data-dirty")).toBe("true")
    expect(reads).toBe(2)
  }, suspended.finish)
}, 30_000)

test("conversation recovers a real C03 reply after body timeout with the same C08 effect and frozen request", async () => {
  await domainBrowserCase(async (page, fixture) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const reply = page.getByLabel("Reply", { exact: true })
    await reply.fill("Exact private reply")
    const before = await fixture.inspect()
    expect(before.status).toBe("ok")
    if (before.status !== "ok") throw new Error("C08 thread unavailable before reply")
    fixture.suspended.nextReply = true
    const headers = page.waitForResponse((response) => response.headers()["x-thread-real-commit"] === "body-pending")
    const aborted = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "collaboration-thread-reply", timeout: 15_000 })
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await headers).status()).toBe(200)
    const committed = await fixture.inspect()
    expect(committed.status).toBe("ok")
    if (committed.status !== "ok") throw new Error("C08 thread unavailable after reply commit")
    expect(committed.storageVersion).toBe(before.storageVersion + 1)
    expect(committed.value?.messages).toHaveLength(2)
    expect(committed.value?.messages[1]).toMatchObject({ body: "Exact private reply", version: 1, authorRef: fixture.initial.recipientRef })
    expect(committed.value?.messages[1]?.id).toBeTruthy()
    expect(committed.value?.messages[1]?.incarnation).toBeTruthy()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor({ timeout: 15_000 })
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED")
    expect(await reply.inputValue()).toBe("Exact private reply")
    expect(await reply.isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[data-case-thread] textarea')?.value === "")
    expect(fixture.attempts).toHaveLength(2)
    expect(fixture.attempts[1]).toEqual(fixture.attempts[0])
    expect(fixture.attempts[0]!.status).toBe(200)
    expect(fixture.attempts[0]!.key).toBeTruthy()
    expect(JSON.parse(fixture.attempts[0]!.body)).toEqual({ id: fixture.initial.id, body: "Exact private reply", mutation: { expectedStorageVersion: before.storageVersion, idempotencyKey: fixture.attempts[0]!.key } })
    const recovered = await fixture.inspect()
    expect(recovered.status).toBe("ok")
    if (recovered.status !== "ok") throw new Error("C08 thread unavailable after retry")
    expect(recovered.storageVersion).toBe(committed.storageVersion)
    expect(recovered.value).toEqual(committed.value)
    expect(await page.getByText("Exact private reply", { exact: true }).count()).toBe(1)
    expect(await page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true }).isDisabled()).toBe(true)
  })
}, 35_000)

test("conversation keeps a real committed reply uncertain when delivery replaces the producer result with an empty acknowledgement", async () => {
  await domainBrowserCase(async (page, fixture) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Acknowledge only this actual message")
    fixture.suspended.malformedNextReply = true
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Acknowledge only this actual message")
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    const committed = await fixture.inspect()
    expect(committed.status).toBe("ok")
    if (committed.status !== "ok") throw new Error("Real thread commit unavailable")
    expect(committed.value?.messages).toHaveLength(2)
    expect(committed.value?.messages[1]?.body).toBe("Acknowledge only this actual message")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[data-case-thread] textarea')?.value === "")
    expect(fixture.attempts).toHaveLength(2)
    expect(fixture.attempts[1]).toEqual(fixture.attempts[0])
    const recovered = await fixture.inspect()
    expect(recovered.status).toBe("ok")
    if (recovered.status !== "ok") throw new Error("Real thread retry unavailable")
    expect(recovered.storageVersion).toBe(committed.storageVersion)
    expect(recovered.value).toEqual(committed.value)
  })
}, 30_000)

test("conversation without a published answer selector keeps confirmation disabled after a reply preflight failure", async () => {
  const calls: string[] = []
  await browserCase((request) => {
    calls.push(mode(request)!)
    return mode(request) === "collaboration-thread-read" ? ok(thread) : Response.json({ status: "unavailable" }, { status: 503 })
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const confirm = page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true })
    expect(await confirm.isDisabled()).toBe(true)
    await page.getByText("Answer confirmation is unavailable until an authorized answer is available for this decision. You can still send a reply.", { exact: true }).waitFor()
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(false)
    await page.getByLabel("Reply", { exact: true }).fill("Keep this editable reply")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(await confirm.isDisabled()).toBe(true)
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(false)
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Keep this editable reply")
    await confirm.dispatchEvent("click")
    expect(calls).toEqual(["collaboration-thread-read", "collaboration-storage-version"])
  })
}, 30_000)

test("conversation reviews a real first C08 conflict before issuing a new reply identity and storage version", async () => {
  await domainBrowserCase(async (page, fixture) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Same words, a separate explicit reply")
    fixture.suspended.beforeNextReply = async () => { await fixture.concurrentReply("Same words, a separate explicit reply") }
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("The reply was not sent because the conversation changed. Review the current conversation; your text is preserved.", { exact: true }).waitFor()
    expect(fixture.attempts).toHaveLength(1)
    expect(fixture.attempts[0]!.status).toBe(409)
    expect(fixture.attempts[0]!.value).toEqual({ status: "conflict", reason: "product-state-changed" })
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Same words, a separate explicit reply")
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(true)
    const concurrent = await fixture.inspect()
    expect(concurrent.status).toBe("ok")
    if (concurrent.status !== "ok") throw new Error("Concurrent thread unavailable")
    expect(concurrent.value?.messages).toHaveLength(2)
    await page.getByRole("button", { name: "Review changed conversation", exact: true }).click()
    await page.getByText("Conversation updated. Review your preserved reply before sending it.", { exact: true }).waitFor()
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Same words, a separate explicit reply")
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(false)
    expect(await page.getByText("Same words, a separate explicit reply", { exact: true }).count()).toBe(1)
    expect(fixture.attempts).toHaveLength(1)
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[data-case-thread] textarea')?.value === "")
    expect(fixture.attempts).toHaveLength(2)
    expect(fixture.attempts[1]!.status).toBe(200)
    expect(fixture.attempts[1]!.key).not.toBe(fixture.attempts[0]!.key)
    expect(JSON.parse(fixture.attempts[1]!.body).mutation.expectedStorageVersion).toBe(concurrent.storageVersion)
    const committed = await fixture.inspect()
    expect(committed.status).toBe("ok")
    if (committed.status !== "ok") throw new Error("Reviewed reply unavailable")
    expect(committed.storageVersion).toBe(concurrent.storageVersion + 1)
    expect(committed.value?.messages).toHaveLength(3)
    expect(committed.value?.messages[2]?.id).not.toBe(concurrent.value?.messages[1]?.id)
    expect(committed.value?.messages[2]?.incarnation).not.toBe(concurrent.value?.messages[1]?.incarnation)
    expect(committed.value?.messages[2]?.body).toBe("Same words, a separate explicit reply")
  })
}, 30_000)

test("conversation preserves the same uncertain reply when a later real C08 conflict cannot establish the earlier outcome", async () => {
  await domainBrowserCase(async (page, fixture) => {
    const attempts: { body: string | null; key: string | undefined }[] = []
    await page.route((url) => url.searchParams.get("sf") === "collaboration-thread-reply", async (route) => {
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"] })
      // A transport outage before dispatch is indistinguishable to this consumer
      // from a lost committed response; the later conflict is produced by C08.
      if (attempts.length === 1) await route.abort("failed")
      else await route.continue()
    })
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Uncertain intention remains exact")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(fixture.attempts).toHaveLength(0)
    await fixture.concurrentReply("Intervening durable message")
    const prior = await fixture.inspect()
    expect(prior.status).toBe("ok")
    if (prior.status !== "ok") throw new Error("Concurrent durable message unavailable")
    const conflict = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await conflict).status()).toBe(409)
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(fixture.attempts[0]!.value).toEqual({ status: "conflict", reason: "product-state-changed" })
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Uncertain intention remains exact")
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Review changed conversation", exact: true }).count()).toBe(0)
    const current = await fixture.inspect()
    expect(current.status).toBe("ok")
    if (current.status !== "ok") throw new Error("Current durable thread unavailable")
    expect(current.storageVersion).toBe(prior.storageVersion)
    expect(current.value).toEqual(prior.value)
  })
}, 30_000)

test("conversation refuses a different prepared answer and does not attach or confirm an older recipient message", async () => {
  const calls: string[] = []
  const earlier = { id: "earlier-answer", authorRef: "recipient", body: "Private recipient answer" }
  await browserCase((request) => {
    calls.push(mode(request)!)
    if (mode(request) === "collaboration-thread-read") return ok({ ...thread, messages: [thread.messages[0], earlier, thread.messages[1]] })
    if (mode(request) === "collaboration-answer-prepare") return ok({ ...preparedAnswer, answerRef: "different-producer-selector" })
    throw new Error("A mismatched selector must not reach mutation")
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const confirm = page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true })
    expect(await confirm.count()).toBe(2)
    expect(await confirm.nth(0).isDisabled()).toBe(true)
    expect(await confirm.nth(1).isDisabled()).toBe(false)
    await confirm.nth(0).dispatchEvent("click")
    expect(calls).toEqual(["collaboration-thread-read"])
    await confirm.nth(1).click()
    await page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    expect(await confirm.nth(0).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(false)
    expect(calls).toEqual(["collaboration-thread-read", "collaboration-answer-prepare"])
  }, undefined, selectedProjection)
}, 30_000)

test("conversation purges an uncertain real reply on authenticated session revocation without another domain effect", async () => {
  await domainBrowserCase(async (page, fixture) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Reply committed before logout")
    fixture.suspended.nextReply = true
    const headers = page.waitForResponse((response) => response.headers()["x-thread-real-commit"] === "body-pending")
    const aborted = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "collaboration-thread-reply", timeout: 15_000 })
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await headers).status()).toBe(200)
    const committed = await fixture.inspect()
    expect(committed.status).toBe("ok")
    if (committed.status !== "ok") throw new Error("C08 thread unavailable after reply commit")
    expect(committed.value?.messages).toHaveLength(2)
    const logout = await page.request.post(`${fixture.origin}/sucafina/auth/logout`, { headers: { origin: fixture.origin } })
    expect(logout.status()).toBe(204)
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor({ timeout: 15_000 })
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED")
    const denial = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await denial).status()).toBe(403)
    await page.getByText("Conversation access changed. Reopen the decision with your current access.", { exact: true }).waitFor()
    const entry = page.locator("[data-case-thread]")
    expect(await entry.locator("input,textarea,select,button,form").count()).toBe(0)
    expect(await entry.getAttribute("data-case")).toBeNull()
    expect(await entry.getAttribute("data-thread")).toBeNull()
    expect(await entry.textContent()).not.toContain("Reply committed before logout")
    expect(fixture.attempts).toHaveLength(2)
    expect(fixture.attempts[1]!.status).toBe(403)
    expect(fixture.attempts[1]!.body).toBe(fixture.attempts[0]!.body)
    expect(fixture.attempts[1]!.key).toBe(fixture.attempts[0]!.key)
    const unchanged = await fixture.inspect()
    expect(unchanged.status).toBe("ok")
    if (unchanged.status !== "ok") throw new Error("Independent authorized C08 inspection unavailable")
    expect(unchanged.storageVersion).toBe(committed.storageVersion)
    expect(unchanged.value).toEqual(committed.value)
  })
}, 35_000)

test("conversation confirmation and decision attachment keep producer observation and exact transport bodies independently", async () => {
  const confirmations: { body: string; key: string | null }[] = []
  const attachments: { body: string; key: string | null }[] = []
  let preparations = 0, answerReads = 0, versionReads = 0
  const namespaces: unknown[] = []
  await browserCase(async (request) => {
    if (mode(request) === "collaboration-thread-read") return ok(thread)
    if (mode(request) === "collaboration-answer-prepare") { preparations++; expect(await request.json()).toEqual({ questionId: "private-question", answerRef }); return ok(preparedAnswer) }
    if (mode(request) === "collaboration-storage-version") { versionReads++; namespaces.push(await request.json()); return ok(7) }
    if (mode(request) === "collaboration-answer-confirm") {
      confirmations.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      return confirmations.length === 1 ? new Response("confirmation delivery interrupted") : ok({ answerRef, observedVersion: preparedAnswer.observedSourceVersion })
    }
    if (mode(request) === "collaboration-answer-read") { answerReads++; return ok({ answerRef, answer: preparedAnswer.answer, authorRef: preparedAnswer.authorRef, observedVersion: preparedAnswer.observedSourceVersion }) }
    if (mode(request) === "decision-answer-question") {
      attachments.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      return attachments.length === 1 ? new Response("attachment delivery interrupted") : ok({ caseRef: { id: "private-case", incarnation: "case-incarnation", version: 2 } })
    }
    throw new Error("Unexpected conversation route")
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const confirm = page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true })
    await confirm.click()
    await page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    expect(confirmations).toHaveLength(1)
    expect(attachments).toHaveLength(0)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(true)
    await confirm.click()
    await page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    expect(confirmations).toHaveLength(2)
    expect(attachments).toHaveLength(1)
    expect(confirmations[1]).toEqual(confirmations[0])
    const loaded = page.waitForEvent("load")
    await confirm.click()
    await loaded
    expect(confirmations).toHaveLength(2)
    expect(attachments).toHaveLength(2)
    expect(attachments[1]).toEqual(attachments[0])
    expect(JSON.parse(attachments[0]!.body)).toEqual({ caseRef: { id: "private-case", incarnation: "case-incarnation", version: 1 }, questionId: "private-question", answerRef })
    expect(JSON.parse(confirmations[0]!.body)).toEqual({ questionId: "private-question", answerRef, mutation: { expectedStorageVersion: 7, idempotencyKey: confirmations[0]!.key, observationRef: preparedAnswer.observationRef, observedSourceVersion: preparedAnswer.observedSourceVersion, expectedScopeFingerprint: preparedAnswer.expectedScopeFingerprint } })
    expect(confirmations[0]!.key).toBeTruthy()
    expect(attachments[0]!.key).toBeTruthy()
    expect(attachments[0]!.key).not.toBe(confirmations[0]!.key)
    expect(preparations).toBe(1)
    expect(answerReads).toBe(1)
    expect(versionReads).toBe(1)
    expect(namespaces).toEqual([{ namespace: "threads" }])
  }, undefined, selectedProjection)
}, 30_000)

test.each(["product-state-changed", "answer-scope-changed"])("conversation confirmation treats stale %s according to its commit boundary", async (reason) => {
  let preparations = 0, versions = 0
  const attempts: { body: string; key: string | null }[] = []
  await browserCase(async (request) => {
    if (mode(request) === "collaboration-thread-read") return ok(thread)
    if (mode(request) === "collaboration-answer-prepare") return ok({ ...preparedAnswer, observationRef: "observation-" + ++preparations })
    if (mode(request) === "collaboration-storage-version") return ok(7 + ++versions)
    if (mode(request) === "collaboration-answer-confirm") {
      attempts.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      return attempts.length === 1 ? Response.json({ status: "stale", reason }, { status: 409 }) : new Response("retry delivery unknown")
    }
    throw new Error("An unconfirmed answer must not reach attachment")
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const confirm = page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true })
    await confirm.click()
    const rejected = reason === "product-state-changed"
    await page.getByText(rejected ? "The answer confirmation was not saved because the conversation changed. Review this answer, then confirm again." : "Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(!rejected)
    await confirm.click()
    await page.getByText("Could not confirm the answer. Retry this same request.", { exact: true }).waitFor()
    expect(attempts).toHaveLength(2)
    if (rejected) {
      expect(attempts[1]!.key).not.toBe(attempts[0]!.key)
      expect(JSON.parse(attempts[1]!.body).mutation).toMatchObject({ expectedStorageVersion: 9, observationRef: "observation-2" })
    } else expect(attempts[1]).toEqual(attempts[0])
    expect(preparations).toBe(rejected ? 2 : 1)
    expect(versions).toBe(rejected ? 2 : 1)
  }, undefined, selectedProjection)
}, 30_000)

test.each(["collaboration-thread-read", "collaboration-thread-reply", "collaboration-answer-confirm"])("conversation revocation aborts %s and a late body cannot restore private controls", async (blocked) => {
  const suspended = unfinished()
  let reads = 0
  const calls: string[] = []
  await browserCase((request) => {
    const action = mode(request)!
    calls.push(action)
    if (action === "collaboration-thread-read") { reads++; return blocked === action && reads > 1 ? suspended.response : ok(thread) }
    if (action === blocked) return suspended.response
    if (action === "collaboration-storage-version") return ok(5)
    if (action === "collaboration-answer-prepare") return ok(preparedAnswer)
    throw new Error("Unexpected conversation route")
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Private unsent wording")
    const headers = page.waitForResponse((response) => response.headers()["x-thread-body-pending"] === "yes")
    const aborted = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === blocked })
    if (blocked !== "collaboration-thread-reply") page.once("dialog", (dialog) => void dialog.accept())
    await page.getByRole("button", { name: blocked === "collaboration-thread-read" ? "Open conversation" : blocked === "collaboration-thread-reply" ? "Send reply" : "Confirm this answer and add to decision", exact: true }).click()
    expect((await headers).status()).toBe(200)
    await page.evaluate(() => window.dispatchEvent(new Event("sf-access-revoked")))
    await page.getByText("Conversation access changed. Reopen the decision with your current access.", { exact: true }).waitFor()
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED")
    suspended.finish(blocked === "collaboration-thread-read" ? { ...thread, messages: [{ id: "late", body: "Late private content" }] } : {})
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const entry = page.locator("[data-case-thread]")
    expect(await entry.locator("input,textarea,select,button,form").count()).toBe(0)
    expect(await entry.getAttribute("data-case")).toBeNull()
    expect(await entry.getAttribute("data-thread")).toBeNull()
    expect(await entry.getAttribute("data-answer")).toBeNull()
    expect(await entry.textContent()).not.toContain("Private")
    expect(await entry.textContent()).not.toContain("Restricted")
    expect(await entry.textContent()).not.toContain("Late private content")
    expect(calls.filter((action) => action === blocked)).toHaveLength(blocked === "collaboration-thread-read" ? 2 : 1)
    expect(calls).not.toContain("decision-answer-question")
  }, suspended.finish, selectedProjection)
}, 30_000)
