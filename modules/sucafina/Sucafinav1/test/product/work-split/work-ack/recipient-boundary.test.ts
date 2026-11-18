import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createBrowserHostFixture } from "../../ui-split/ui-work/browser-host-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

test("recipient reply delivery loss stays pending until a revoked retry purges the attempt; fresh reload does not resend it", async () => {
  const app = await createBrowserHostFixture(browser)
  try {
    const body = "The recipient reply whose delivery was lost."
    expect((await app.page.goto(`${app.origin}/product`))?.status()).toBe(200)
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await app.page.getByLabel("Reply", { exact: true }).fill(body)
    let damaged = false
    await app.page.route("**/*?sf=collaboration-thread-reply", async (route) => {
      const response = await route.fetch()
      if (damaged || response.status() !== 200) { await route.fulfill({ response }); return }
      // The real recipient producer has committed before transport is damaged.
      // This is neither a successful ACK nor a fabricated producer result.
      damaged = true
      await route.fulfill({ response, body: "{" })
    })
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    await app.page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(damaged).toBe(true)
    expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    const committed = await app.inspect()
    if (committed.status !== "ok" || !committed.value) throw new Error("Committed recipient reply unavailable")
    expect(committed.value.messages).toHaveLength(2)
    expect(committed.value.messages.filter((message) => message.body === body)).toHaveLength(1)
    const exact = committed.value.messages[1]!
    expect(exact.authorRef).toBe("reader-b")
    expect(exact.version).toBe(1)

    // This delta tests revocation while the uncertain mutation is still frozen,
    // before retry/reload can be mistaken for confirmation of the append.
    app.actors["reader-b"]!.enabled = false
    app.actors["reader-b"]!.access = "b2"
    const retry = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await retry).status()).toBe(403)
    await app.page.getByText("Conversation access changed. Reopen the decision with your current access.", { exact: true }).waitFor()
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await app.page.locator("[data-case-thread] textarea, [data-case-thread] button, [data-case-thread] form").count()).toBe(0)
    const attributes = await app.page.locator("[data-case-thread]").evaluate((entry) => [...entry.attributes].map((attribute) => attribute.name))
    for (const name of ["data-case", "data-case-summary", "data-access-revision", "data-thread", "data-answer", "data-question-state", "data-principal", "data-dirty"]) expect(attributes).not.toContain(name)
    const denied = await app.inspect()
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain(body)
    const attempts = app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")
    expect(attempts).toHaveLength(2)
    expect(attempts.map((attempt) => attempt.status)).toEqual([200, 403])
    expect(attempts[1]!.body).toBe(attempts[0]!.body)
    expect(attempts[1]!.key).toBe(attempts[0]!.key)

    app.actors["reader-b"]!.enabled = true
    const fresh = await app.admitRead("reader-b")
    expect(fresh).not.toBe(app.recipient)
    expect(fresh.binding.accessRevision).toBe("b2")
    // The case retains its b1 source reference. This fixture does not grant
    // historical case-source reissue, so b2 must not turn that GET into success.
    const reloaded = await app.page.reload().then(
      (response) => ({ status: response?.status(), failure: undefined }),
      (error: unknown) => ({ status: undefined, failure: error instanceof Error ? error.message : String(error) }),
    )
    // Chromium rejects an empty 503 document as a navigation failure. Keep that
    // specific failure explicit and independently observe the real HTTP refusal.
    if (reloaded.failure) expect(reloaded.failure).toContain("net::ERR_HTTP_RESPONSE_CODE_FAILURE")
    else expect(reloaded.status).toBe(503)
    const blockedCase = await app.context.request.get(`${app.origin}/product`, { timeout: 5_000 })
    expect(blockedCase.status()).toBe(503)
    expect(await blockedCase.text()).not.toContain(body)
    expect(await app.page.getByText(body, { exact: true }).count()).toBe(0)
    expect(await app.page.locator("[data-case], [data-thread], [data-principal], [data-case-thread] textarea").count()).toBe(0)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")).toHaveLength(2)
    // The recipient reader independently reissues current sources. This read
    // proves current authorization, never the lost mutation's exact ACK.
    const reread = await app.send("thread-read", { id: app.thread.id })
    expect(reread.status).toBe(200)
    if (reread.result.status !== "ok") throw new Error("Fresh recipient read unavailable")
    const current = reread.result.value as Awaited<ReturnType<typeof app.reply>>
    expect(current).toHaveProperty("current")
    expect(current).not.toHaveProperty("mutationReceipt")
    expect(current.messages).toEqual(committed.value.messages)
    expect(await app.inspect()).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("WORK_ACK_REVOKED_PENDING_REPLY", JSON.stringify({ threadId: app.thread.id, message: { id: exact.id, incarnation: exact.incarnation, version: exact.version }, attempts: 2, statuses: [200, 403], storageVersion: committed.storageVersion, freshAccessRevision: fresh.binding.accessRevision, caseReloadStatus: reloaded.status ?? null, caseReloadFailure: reloaded.failure ? "ERR_HTTP_RESPONSE_CODE_FAILURE" : null, caseReadStatus: blockedCase.status(), freshThreadReadStatus: reread.status, acknowledged: false, reloadResent: false }))
  } finally { await app.close() }
}, 60_000)

test("the initial recipient projection marker prevents ACK from a stripped current projection or a legacy Boolean outcome", async () => {
  const app = await createBrowserHostFixture(browser)
  try {
    const body = "Identical text does not identify the recipient mutation."
    await app.reply(body)
    expect((await app.page.goto(`${app.origin}/product`))?.status()).toBe(200)
    const opened = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-read")
    await app.page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const baseline = (await (await opened).json()).value as Awaited<ReturnType<typeof app.reply>>
    expect(baseline).toHaveProperty("current")
    expect(baseline.messages).toHaveLength(2)
    await app.page.getByLabel("Reply", { exact: true }).fill(body)
    const returned: Awaited<ReturnType<typeof app.reply>>[] = []
    await app.page.route("**/*?sf=collaboration-thread-reply", async (route) => {
      const response = await route.fetch()
      if (response.status() !== 200) { await route.fulfill({ response }); return }
      const actual = await response.json() as { status: "ok"; value: Awaited<ReturnType<typeof app.reply>> }
      returned.push(actual.value)
      // Damage only the delivery shape after a real append/replay. Neither form
      // may upgrade RecipientThread.current into an exact mutation receipt.
      const stripped: Record<string, unknown> = { ...actual.value }
      delete stripped.current
      await route.fulfill({ response, body: JSON.stringify({ ...actual, value: returned.length === 1 ? stripped : true }) })
    })
    const first = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    const damaged = (await (await first).json()).value as Record<string, unknown>
    expect(damaged).not.toHaveProperty("current")
    await app.page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(returned).toHaveLength(1)
    expect(returned[0]).toHaveProperty("current")
    expect(returned[0]).not.toHaveProperty("mutationReceipt")
    expect(returned[0]!.messages).toHaveLength(baseline.messages.length + 1)
    expect(returned[0]!.messages.slice(0, baseline.messages.length)).toEqual([...baseline.messages])
    const exact = returned[0]!.messages[baseline.messages.length]!
    expect(exact.authorRef).toBe("reader-b")
    expect(exact.body).toBe(body)
    expect(exact.version).toBe(1)
    const committed = await app.inspect()
    if (committed.status !== "ok" || !committed.value) throw new Error("Recipient projection state unavailable")
    expect(committed.value.messages).toHaveLength(3)
    expect(committed.value.messages.filter((message) => message.body === body)).toHaveLength(2)
    expect(new Set(committed.value.messages.map((message) => message.id)).size).toBe(3)
    const firstAttempt = app.attempts.find((attempt) => attempt.route === "collaboration-thread-reply")
    if (!firstAttempt?.key) throw new Error("Original mutation identity unavailable")
    expect(JSON.parse(firstAttempt.body).mutation.idempotencyKey).toBe(firstAttempt.key)
    const durable = await app.state.read(app.request("reader-b"), "threads", (state) =>
      state.transactions[JSON.stringify(["reader-b", "threads", app.creationTarget.ref, firstAttempt.key])])
    if (durable.status !== "ok" || !durable.value) throw new Error("Durable C08 outcome unavailable")
    // The legacy outcome is observed in the real protected store, independently
    // of the Boolean response used below as a transport counterexample.
    expect(durable.value.value).toBe(true)

    const retry = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-thread-reply")
    await app.page.getByRole("button", { name: "Send reply", exact: true }).click()
    expect((await (await retry).json()).value).toBe(true)
    await app.page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.", { exact: true }).waitFor()
    expect(returned).toHaveLength(2)
    expect(returned[1]).toHaveProperty("current")
    expect(returned[1]!.messages).toEqual(returned[0]!.messages)
    expect(await app.page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await app.page.getByLabel("Reply", { exact: true }).inputValue()).toBe(body)
    expect(await app.page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    const attempts = app.attempts.filter((attempt) => attempt.route === "collaboration-thread-reply")
    expect(attempts).toHaveLength(2)
    expect(attempts.map((attempt) => attempt.status)).toEqual([200, 200])
    expect(attempts[1]!.body).toBe(attempts[0]!.body)
    expect(attempts[1]!.key).toBe(attempts[0]!.key)
    expect(await app.inspect()).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("WORK_ACK_PROJECTION_NOT_RECEIPT", JSON.stringify({ threadId: app.thread.id, message: { id: exact.id, incarnation: exact.incarnation, version: exact.version }, deliveryForms: ["current-field-removed", "legacy-Boolean"], equalTextReplies: 2, attempts: 2, storageVersion: committed.storageVersion, acknowledged: false }))
  } finally { await app.close() }
}, 60_000)
