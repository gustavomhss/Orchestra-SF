import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { decisionEditScript } from "../../../product/ui/decision-edit.ts"
import { decisionApplyScript } from "../../../product/ui/decision-apply.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

// These are transport fault fixtures for the shipped consumers. A fixture's
// acknowledgement/counter is not a domain receipt or proof of durable idempotence.
let browser: Browser
async function within<T>(operation: Promise<T>, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Decision fixture timed out: ${step}`)), 5000) })]) }
  finally { clearTimeout(timer) }
}
beforeAll(async () => {
  browser = await launchWp01Browser()
}, 35000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25000)

const caseRef = { id: "consumer-case", incarnation: "consumer-incarnation", version: 1 }
const editContext = { caseRef, sourceRefs: [], criteria: [{ id: "criterion", required: true }] }
const edit = (objective = "Original objective", version = 1) => `<form data-decision-edit data-context='${JSON.stringify({ ...editContext, caseRef: { ...caseRef, version } })}'><label>Decision objective<input name="objective" required value="${objective}"></label><label>Start<input name="start" type="date" required value="2027-01-01"></label><label>End<input name="end" type="date" required value="2027-12-31"></label><label>Currency<input name="currency" required value="USD"></label><label>Criterion<input name="criterion-0" required value="Cost"></label><input name="unavailable" value="Restricted control" disabled><button>Save decision</button><p role="status"></p></form><script>${decisionEditScript}</script>`
const applyContext = { caseRef, choiceId: "choice", changeId: "change", surface: "planner", expectedVersion: 7 }
const apply = `<article data-decision-apply data-context='${JSON.stringify(applyContext)}'><h4>Prepared change</h4><button type="button" data-review-change>Review current changes</button><div data-change-review></div><label><input type="checkbox" data-change-confirm disabled>I reviewed these changes</label><button type="button" data-apply-change disabled>Apply reviewed change</button><p data-change-status role="status"></p><form data-change-guard hidden></form></article><script>${decisionApplyScript}</script>`
const review = { changeId: "change", choiceId: "choice", surface: "planner", target: { type: "line", id: "line", label: "Authorized planning line" }, expectedVersion: 7, state: "planned", fields: [{ field: "amount", before: 100, after: 120 }] }
const ok = (value: unknown = {}) => Response.json({ status: "ok", value })
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
async function fixture(body: string, respond: (request: Request) => Response | undefined | Promise<Response | undefined>, check: (page: Page) => Promise<void>, release?: () => void) {
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`
  const server = Bun.serve({ hostname: "localhost", port: 0, idleTimeout: 30, fetch: async (request) => {
    if (new URL(request.url).pathname === "/favicon.ico") return new Response(null, { status: 204 })
    return await respond(request) ?? new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  } })
  let context: BrowserContext | undefined
  let page: Page | undefined
  let failure: unknown
  try {
    context = await within(browser.newContext(), "open context")
    page = await within(context.newPage(), "open page")
    page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(8000)
    await page.goto(server.url.href)
    expect(await within(page.evaluate(() => document.characterSet), "document encoding")).toBe("UTF-8")
    await check(page)
  }
  catch (error) { failure = error; throw error }
  finally {
    release?.()
    const errors: unknown[] = []
    try { if (page) await within(page.close({ runBeforeUnload: false }), "close page") } catch (error) { errors.push(error) }
    try { if (context) await within(context.close(), "close context") } catch (error) { errors.push(error) }
    try { await within(Promise.resolve(server.stop(true)), "stop server") } catch (error) { errors.push(error) }
    if (errors.length) throw new AggregateError(failure ? [failure, ...errors] : errors, "Decision fixture cleanup failed")
  }
}

for (const outcome of ["confirmed", "conflict"] as const) test(`decision edit replays its frozen request after uncertainty and ${outcome}`, async () => {
  const seen: { body: string; key: string | null }[] = []
  let saved = false
  let release!: () => void
  let entered!: () => void
  const started = new Promise<void>((resolve) => { entered = resolve })
  const wait = new Promise<void>((resolve) => { release = resolve })
  await fixture(edit(), async (request) => {
    if (request.method === "GET") return saved ? new Response('<p data-saved>Saved decision reopened</p>', { headers: { "Content-Type": "text/html" } }) : undefined
    seen.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
    if (seen.length === 1) { entered(); await wait; return new Response("delivery interrupted") }
    if (outcome === "conflict") return Response.json({ status: "stale" }, { status: 409 })
    saved = true; return ok({ caseRef: { ...caseRef, version: 2 } })
  }, async (page) => {
    const form = page.locator("[data-decision-edit]")
    const objective = page.getByLabel("Decision objective", { exact: true })
    await objective.fill("Unconfirmed edit")
    await form.getByRole("button", { name: "Save decision", exact: true }).click()
    await within(started, "edit request entered")
    await form.evaluate((node) => node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    await frames(page); expect(seen).toHaveLength(1)
    expect(await objective.isDisabled()).toBe(true)
    release()
    await form.getByText("Could not confirm the save.", { exact: false }).waitFor()
    await objective.evaluate((node) => { (node as HTMLInputElement).value = "Changed after loss"; node.dispatchEvent(new Event("input", { bubbles: true })) })
    expect(await objective.inputValue()).toBe("Unconfirmed edit")
    await form.getByRole("button", { name: "Retry same save", exact: true }).click()
    if (outcome === "confirmed") await page.locator("[data-saved]").waitFor()
    else {
      await form.getByText("the earlier save is still unconfirmed", { exact: false }).waitFor()
      expect(await objective.isDisabled()).toBe(true)
      expect(await form.getAttribute("data-dirty")).toBe("true")
      expect(await form.textContent()).not.toContain("Decision saved.")
    }
    expect(seen).toHaveLength(2); expect(seen[1]).toEqual(seen[0])
    expect(JSON.parse(seen[0]!.body).objective).toBe("Unconfirmed edit")
  }, release)
}, 30000)

test("a definite edit conflict compares current values without discarding the user's draft or enabling a restricted field", async () => {
  let reads = 0
  await fixture(edit(), (request) => {
    if (request.method === "POST") return Response.json({ status: "conflict" }, { status: 409 })
    if (++reads > 1) return new Response(`<!doctype html><html><body>${edit("Current objective", 2)}</body></html>`, { headers: { "Content-Type": "text/html" } })
  }, async (page) => {
    await page.getByLabel("Decision objective", { exact: true }).fill("My retained objective")
    await page.getByRole("button", { name: "Save decision", exact: true }).click()
    await page.locator("[data-decision-conflict]").getByText("Objective: current Current objective; yours My retained objective", { exact: true }).waitFor()
    expect(await page.getByLabel("Decision objective", { exact: true }).isEnabled()).toBe(true)
    expect(await page.getByLabel("Decision objective", { exact: true }).inputValue()).toBe("My retained objective")
    expect(await page.locator('input[name="unavailable"]').isDisabled()).toBe(true)
  })
}, 30000)

for (const status of [401, 403]) test(`decision edit ${status} scrubs its fields, source context and future submissions`, async () => {
  let calls = 0
  await fixture(edit(), (request) => { if (request.method === "POST") { calls++; return Response.json({ status: "denied" }, { status }) } }, async (page) => {
    await page.getByLabel("Decision objective", { exact: true }).fill("Private draft")
    await page.getByRole("button", { name: "Save decision", exact: true }).click()
    await page.getByText("Your access changed. Reload before editing this decision.", { exact: true }).waitFor()
    expect(await page.locator("[data-context], input, [data-decision-conflict]").count()).toBe(0)
    expect(await page.locator("body").innerText()).not.toContain("Private draft")
    await page.locator("[data-decision-edit]").evaluate((node) => node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    await frames(page); expect(calls).toBe(1)
  })
}, 30000)

test("a delayed current-value read cannot restore an edit after access revocation", async () => {
  let currentUrl: string | undefined
  let release!: () => void
  let entered!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  await fixture(edit(), async (request) => {
    if (request.method === "POST") return Response.json({ status: "conflict" }, { status: 409 })
    if (request.method === "GET" && request.url === currentUrl && request.headers.get("sec-fetch-dest") === "empty") {
      entered(); await wait
      return new Response(`<!doctype html><html><body>${edit("Formerly authorized values", 2)}</body></html>`, { headers: { "Content-Type": "text/html" } })
    }
  }, async (page) => {
    currentUrl = page.url()
    const [request] = await Promise.all([
      page.waitForRequest((request) => request.method() === "GET" && request.url() === currentUrl && request.resourceType() === "fetch"),
      page.getByRole("button", { name: "Save decision", exact: true }).click(),
    ])
    await within(started, "conflict read entered")
    await page.evaluate(() => dispatchEvent(new CustomEvent("sf-access-revoked")))
    release()
    const response = await within(request.response(), "exact conflict response received")
    if (!response) throw new Error("The observed conflict read did not complete with a response")
    expect(await within(response.finished(), "conflict read finished")).toBeNull(); await frames(page)
    expect(await page.locator("[data-context], input, [data-decision-conflict]").count()).toBe(0)
    expect(await page.locator("body").innerText()).not.toContain("Formerly authorized values")
  }, release)
}, 30000)

for (const outcome of ["confirmed", "conflict"] as const) test(`prepared application retains its reviewed request after uncertainty and ${outcome}`, async () => {
  const seen: { body: string; key: string | null }[] = []
  let applied = false
  let reviewReads = 0
  let release!: () => void
  let entered!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  await fixture(apply, async (request) => {
    if (request.method === "GET") return applied ? new Response('<p data-receipt>Current receipt reopened</p>', { headers: { "Content-Type": "text/html" } }) : undefined
    const body = await request.text()
    if (new URL(request.url).searchParams.get("sf") === "decision-review") { reviewReads++; return ok(review) }
    seen.push({ body, key: request.headers.get("idempotency-key") })
    if (seen.length === 1) { entered(); await wait; return new Response("delivery interrupted") }
    if (outcome === "conflict") return Response.json({ status: "conflict" }, { status: 409 })
    applied = true; return ok({ receiptId: "consumer-receipt", surface: "planner", version: 8 })
  }, async (page) => {
    await page.getByRole("button", { name: "Review current changes", exact: true }).click()
    await page.getByText("amount: 100 → 120", { exact: true }).waitFor()
    await page.getByLabel("I reviewed these changes", { exact: true }).check()
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
    await within(started, "apply request entered")
    await page.locator("[data-apply-change]").evaluate((node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await frames(page); expect(seen).toHaveLength(1)
    release()
    await page.getByText("Could not confirm application.", { exact: false }).waitFor()
    expect(await page.locator("[data-review-change]").isDisabled()).toBe(true)
    expect(await page.locator("[data-change-confirm]").isDisabled()).toBe(true)
    await page.locator("[data-decision-apply]").evaluate((node) => node.setAttribute("data-context", JSON.stringify({ caseRef: { id: "forged", incarnation: "forged", version: 99 }, choiceId: "forged", changeId: "forged" })))
    await page.getByRole("button", { name: "Retry same application", exact: true }).click()
    if (outcome === "confirmed") await page.locator("[data-receipt]").waitFor()
    else {
      await page.getByText("its outcome is still unconfirmed", { exact: false }).waitFor()
      expect(await page.locator("[data-change-confirm]").isDisabled()).toBe(true)
      expect(await page.locator("[data-change-guard]").getAttribute("data-dirty")).toBe("true")
    }
    expect(seen).toHaveLength(2); expect(seen[1]).toEqual(seen[0]); expect(reviewReads).toBe(1)
    expect(JSON.parse(seen[0]!.body)).toEqual({ caseRef, choiceId: "choice", changeId: "change" })
    expect(JSON.parse(seen[0]!.body)).not.toHaveProperty("reviewDigest")
  }, release)
}, 30000)

for (const status of [401, 403]) test(`prepared application ${status} clears its former review and blocks another write`, async () => {
  let applies = 0
  await fixture(apply, (request) => {
    if (request.method !== "POST") return
    if (new URL(request.url).searchParams.get("sf") === "decision-review") return ok(review)
    applies++; return Response.json({ status: "denied" }, { status })
  }, async (page) => {
    await page.getByRole("button", { name: "Review current changes", exact: true }).click()
    await page.getByText("amount: 100 → 120", { exact: true }).waitFor()
    await page.getByLabel("I reviewed these changes", { exact: true }).check()
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
    await page.getByText("Your access changed. Reload before reviewing or applying this change.", { exact: true }).waitFor()
    expect(await page.locator("[data-context], [data-change-review], button, input").count()).toBe(0)
    expect(await page.locator("body").innerText()).not.toContain("100 → 120")
    expect(applies).toBe(1)
  })
}, 30000)

test("a late prepared-change review cannot repopulate the revoked entry", async () => {
  let release!: () => void
  let entered!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  await fixture(apply, async (request) => { if (request.method === "POST") { entered(); await wait; return ok(review) } }, async (page) => {
    await page.getByRole("button", { name: "Review current changes", exact: true }).click()
    await within(started, "review entered")
    const pending = page.waitForResponse((response) => response.request().method() === "POST")
    await page.evaluate(() => dispatchEvent(new CustomEvent("sf-access-revoked")))
    release(); const response = await pending; expect(await within(response.finished(), "review finished")).toBeNull(); await frames(page)
    expect(await page.locator("[data-context], [data-change-review], button, input").count()).toBe(0)
    expect(await page.locator("body").innerText()).not.toContain("Authorized planning line")
  }, release)
}, 30000)

test("a malformed edit acknowledgement cannot unlock the unconfirmed intention or report a saved decision", async () => {
  await fixture(edit(), (request) => request.method === "POST" ? ok() : undefined, async (page) => {
    await page.getByLabel("Decision objective", { exact: true }).fill("Unconfirmed acknowledgement")
    await page.getByRole("button", { name: "Save decision", exact: true }).click()
    await page.getByText("Could not confirm the save.", { exact: false }).waitFor()
    expect(await page.getByLabel("Decision objective", { exact: true }).isDisabled()).toBe(true)
    expect(await page.locator("[data-decision-edit]").getAttribute("data-dirty")).toBe("true")
    expect(await page.locator("body").innerText()).not.toContain("Decision saved.")
  })
}, 30000)

test("an initial apply conflict after domain receipt observation remains unconfirmed and replays the same intention", async () => {
  const seen: { body: string; key: string | null }[] = []
  await fixture(apply, async (request) => {
    if (request.method !== "POST") return
    if (new URL(request.url).searchParams.get("sf") === "decision-review") return ok(review)
    seen.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
    return Response.json({ status: "conflict", reason: "receipt-outcome-mismatch" }, { status: 409 })
  }, async (page) => {
    await page.getByRole("button", { name: "Review current changes", exact: true }).click()
    await page.getByText("amount: 100 → 120", { exact: true }).waitFor()
    await page.getByLabel("I reviewed these changes", { exact: true }).check()
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
    await page.getByText("its outcome is still unconfirmed", { exact: false }).waitFor()
    expect(await page.locator("[data-review-change]").isDisabled()).toBe(true)
    expect(await page.locator("[data-change-confirm]").isDisabled()).toBe(true)
    expect(await page.locator("[data-change-guard]").getAttribute("data-dirty")).toBe("true")
    expect(await page.locator("body").innerText()).not.toContain("Application was rejected.")
    await page.getByRole("button", { name: "Retry same application", exact: true }).click()
    await page.getByText("its outcome is still unconfirmed", { exact: false }).waitFor()
    expect(seen).toHaveLength(2); expect(seen[1]).toEqual(seen[0])
  })
}, 30000)
