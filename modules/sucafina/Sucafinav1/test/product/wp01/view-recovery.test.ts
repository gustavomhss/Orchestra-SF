import { expect, test } from "bun:test"
import type { Browser, Page } from "@playwright/test"
import type { SfPersonalViewRecord } from "../../../product/interface/personal-views.ts"
import { decisionCreateForm, decisionCreateScript } from "../../../product/ui/decision-create.ts"
import { personalViewsScript, personalViewsWidget } from "../../../product/ui/personal-views.ts"
import { documentHtml, pageMain } from "../../../src/screen-shell.ts"
import { fields, form } from "../../../runtime/ui.ts"

const browsers = new WeakMap<Page, Browser>()

async function within<T>(operation: Promise<T>, step: string, timeout = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`View recovery fixture timed out: ${step}`)), timeout) })])
  } finally { clearTimeout(timer) }
}

type FixtureServer = { stop(closeActiveConnections?: boolean): void | Promise<void> }
async function fixturePage(server: FixtureServer) {
  let browser: Browser | undefined
  try {
    const { chromium } = await import("@playwright/test")
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 8_000 })
    const page = await within(browser.newPage(), "open browser page")
    browsers.set(page, browser)
    page.setDefaultTimeout(5_000)
    page.setDefaultNavigationTimeout(8_000)
    return page
  } catch (error) {
    try { if (browser) await within(browser.close(), "close unopened browser") }
    finally { await within(Promise.resolve(server.stop(true)), "stop unopened fixture server") }
    throw error
  }
}
async function closeFixture(page: Page, server: FixtureServer) {
  const browser = browsers.get(page)
  browsers.delete(page)
  try { await within(browser ? browser.close() : page.close({ runBeforeUnload: false }), "close isolated browser") }
  finally { await within(Promise.resolve(server.stop(true)), "stop fixture server") }
}

async function finishRead(page: Page, pending: ReturnType<Page["waitForResponse"]>) {
  const response = await pending
  expect(await within(response.finished(), "complete the released HTTP response")).toBeNull()
  // Let the consumer finish parsing and handling this response before testing that
  // it did not repopulate or navigate. Unrelated polling is not a readiness signal.
  await within(page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))), "settle the released read in the browser")
}

function pageHtml(body: string, script: string) {
  return documentHtml("Budget Planner", "planner", "", pageMain({ drawn: true, key: "OPEX", index: 1 }, body), "").replace("</body>", `<script>${script}</script></body>`)
}
async function fillDecision(page: Page) {
  await page.getByText("Create a decision", { exact: true }).click()
  await page.getByLabel("Decision objective").fill("Review renewal")
  await page.getByLabel("Start", { exact: true }).fill("2027-01-01")
  await page.getByLabel("End", { exact: true }).fill("2027-12-31")
  await page.getByLabel("Currency", { exact: true }).fill("USD")
  await page.getByLabel("Criteria, one per line").fill("Cost\nDelivery")
}

// These HTTP fixtures inject transport/rejection outcomes into the actual browser consumer.
// They prove request identity and recovery behavior, not native domain execution or resident AI.
test.each(["lost", "stale"])("creation freezes its request after a %s outcome and retains uncertainty on a subsequent 409", async (outcome) => {
  const requests: { key: string | null; body: string }[] = []
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(new URL(request.url).searchParams.has("caseRef") ? "<h1>Created decision</h1>" : pageHtml(decisionCreateForm, decisionCreateScript), { headers: { "Content-Type": "text/html" } })
    requests.push({ key: request.headers.get("Idempotency-Key"), body: await request.text() })
    if (requests.length === 1 && outcome === "stale") return Response.json({ status: "stale" }, { status: 409 })
    return requests.length === 2 ? Response.json({ status: "conflict" }, { status: 409 }) : Response.json({ status: "ok", outputRef: "case-reference-1" })
  } })
  const page = await fixturePage(server)
  const network = { dropped: false }
  try {
    if (outcome === "lost") await page.route("**/*?sf=workbench-command", async (route) => {
      if (network.dropped) { await route.continue(); return }
      network.dropped = true
      await route.fetch()
      await route.abort("failed")
    })
    await page.goto(new URL("planner?sf=workbench", server.url).href)
    await fillDecision(page)
    await page.getByRole("button", { name: "Create decision", exact: true }).click()
    await page.getByRole("button", { name: "Retry same creation" }).waitFor()
    expect(await page.getByLabel("Decision objective").isDisabled()).toBe(true)
    expect(await page.getByLabel("Decision objective").inputValue()).toBe("Review renewal")
    await page.getByRole("button", { name: "Retry same creation" }).click()
    await page.getByText("Creation is unconfirmed.", { exact: false }).waitFor()
    expect(await page.getByLabel("Decision objective").isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry same creation" }).click()
    await page.waitForURL((url) => url.searchParams.get("caseRef") === "case-reference-1")
    expect(requests.length).toBe(3)
    expect(new Set(requests.map((request) => request.key)).size).toBe(1)
    expect(new Set(requests.map((request) => request.body)).size).toBe(1)
    expect(JSON.parse(requests[0]!.body).input.objective).toBe("Review renewal")
  } finally { await closeFixture(page, server) }
}, 30000)

test("a confirmed creation rejection unlocks correction and creates a new intention", async () => {
  const requests: { key: string | null; body: string }[] = []
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(new URL(request.url).searchParams.has("caseRef") ? "<h1>Created decision</h1>" : pageHtml(decisionCreateForm, decisionCreateScript), { headers: { "Content-Type": "text/html" } })
    requests.push({ key: request.headers.get("Idempotency-Key"), body: await request.text() })
    return requests.length === 1 ? Response.json({ status: "invalid" }, { status: 400 }) : Response.json({ status: "ok", outputRef: "corrected-case" })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?sf=workbench", server.url).href)
    await fillDecision(page)
    await page.getByRole("button", { name: "Create decision", exact: true }).click()
    await page.getByText("Creation was rejected.", { exact: false }).waitFor()
    expect(await page.getByLabel("Decision objective").isDisabled()).toBe(false)
    await page.getByLabel("Decision objective").fill("Corrected objective")
    await page.getByRole("button", { name: "Create decision", exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get("caseRef") === "corrected-case")
    expect(requests[0]!.key).not.toBe(requests[1]!.key)
    expect(JSON.parse(requests[1]!.body).input.objective).toBe("Corrected objective")
  } finally { await closeFixture(page, server) }
}, 30000)

test.each([401, 403])("creation %i removes its inputs and does not echo the denied payload", async (status) => {
  const server = Bun.serve({ port: 0, fetch: (request) => request.method === "GET" ? new Response(pageHtml(decisionCreateForm, decisionCreateScript), { headers: { "Content-Type": "text/html" } }) : Response.json({ status: "denied", detail: "PRIVATE-DENIAL" }, { status }) })
  const page = await fixturePage(server)
  try {
    await page.goto(server.url.href)
    await fillDecision(page)
    await page.getByRole("button", { name: "Create decision", exact: true }).click()
    await page.getByText("Your access changed. Reload before creating a decision.").waitFor()
    expect(await page.locator("[data-decision-create] input, [data-decision-create] textarea").count()).toBe(0)
    expect(await page.content()).not.toContain("PRIVATE-DENIAL")
  } finally { await closeFixture(page, server) }
}, 30000)

test.each(["save-503", "save-409", "preferred-503", "preferred-409", "remove-503", "remove-409"])("%s view mutation freezes density, version, payload and idempotency key until reconciliation", async (selection) => {
  const [kind, firstStatus] = selection.split("-")
  const initial: SfPersonalViewRecord = { view: { id: kind === "preferred" ? "preferred-planner" : "saved-view-01", title: "Existing plan", surface: "planner", page: "OPEX", density: "comfortable" }, version: 3 }
  const records = { value: [initial] }
  const requests: { key: string | null; body: string }[] = []
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    const body = await request.text(); const command = JSON.parse(body)
    if (command.action === "list") return Response.json({ status: "ok", value: records.value })
    requests.push({ key: request.headers.get("Idempotency-Key"), body })
    if (requests.length === 1) return Response.json({ status: firstStatus === "503" ? "unavailable" : "stale" }, { status: Number(firstStatus) })
    if (requests.length === 2) return Response.json({ status: "conflict" }, { status: 409 })
    records.value = kind === "remove" ? [] : [{ view: command.input.view, version: kind === "preferred" ? 4 : 1 }]
    return Response.json({ status: "ok", value: kind === "remove" ? { removed: true } : records.value[0] })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?page=OPEX&year=2027&version=v3", server.url).href)
    await page.getByText(kind === "preferred" ? "No saved views yet." : "Existing plan", { exact: true }).waitFor()
    if (kind === "save") {
      await page.getByLabel("View name").fill("New plan")
      await page.getByLabel("Display density").selectOption("compact")
      await page.getByRole("button", { name: "Save this page and filters" }).click()
    }
    if (kind === "preferred") await page.getByRole("button", { name: "Use this page as my starting page" }).click()
    if (kind === "remove") await page.getByRole("button", { name: "Remove Existing plan" }).click()
    await page.getByRole("button", { name: "Retry same request" }).waitFor()
    expect(await page.getByLabel("Display density").isDisabled()).toBe(true)
    expect(await page.getByLabel("View name").isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry same request" }).click()
    await page.getByText("The previous change is unconfirmed.", { exact: false }).waitFor()
    expect(await page.getByLabel("Display density").isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry same request" }).click()
    await page.getByText(kind === "remove" ? "Saved view removed." : kind === "preferred" ? "Starting page saved." : "View saved.", { exact: true }).waitFor()
    expect(await page.getByLabel("Display density").isDisabled()).toBe(false)
    expect(new Set(requests.map((request) => request.key)).size).toBe(1)
    expect(new Set(requests.map((request) => request.body)).size).toBe(1)
    expect(requests.length).toBe(3)
    if (kind === "save") expect(JSON.parse(requests[0]!.body).input.view.density).toBe("compact")
    if (kind !== "save") expect(JSON.parse(requests[0]!.body).input.expectedVersion).toBe(3)
  } finally { await closeFixture(page, server) }
}, 30000)

test("a confirmed saved-view rejection permits an edited payload with a new key", async () => {
  const requests: { key: string | null; body: string }[] = []
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    const body = await request.text(); const command = JSON.parse(body)
    if (command.action === "list") return Response.json({ status: "ok", value: [] })
    requests.push({ key: request.headers.get("Idempotency-Key"), body })
    return requests.length === 1 ? Response.json({ status: "invalid" }, { status: 400 }) : Response.json({ status: "ok", value: { view: command.input.view, version: 1 } })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?page=OPEX", server.url).href)
    await page.getByText("No saved views yet.").waitFor()
    await page.getByLabel("View name").fill("First title")
    await page.getByRole("button", { name: "Save this page and filters" }).click()
    await page.getByText("The view change was rejected.", { exact: false }).waitFor()
    expect(await page.getByLabel("View name").isDisabled()).toBe(false)
    await page.getByLabel("View name").fill("Corrected title")
    await page.getByRole("button", { name: "Save this page and filters" }).click()
    await page.getByText("View saved.", { exact: true }).waitFor()
    expect(requests[0]!.key).not.toBe(requests[1]!.key)
    expect(JSON.parse(requests[1]!.body).input.view.title).toBe("Corrected title")
  } finally { await closeFixture(page, server) }
}, 30000)

test.each([401, 403])("saved-view %i clears old titles and fences a late earlier read", async (status) => {
  const state: { calls: number; started?: () => void; release?: () => void } = { calls: 0 }
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const entry: SfPersonalViewRecord = { view: { id: "private-view-01", title: "PRIVATE-VIEW", surface: "planner", page: "OPEX" }, version: 1 }
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    state.calls++
    if (state.calls === 2) { await new Promise<void>((resolve) => { state.release = resolve; state.started?.() }); return Response.json({ status: "ok", value: [entry] }, { headers: { "X-Late-Fixture": "yes" } }) }
    return state.calls === 1 ? Response.json({ status: "ok", value: [entry] }) : Response.json({ status: "denied" }, { status })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?page=OPEX", server.url).href)
    await page.getByRole("button", { name: "PRIVATE-VIEW", exact: true }).waitFor()
    await page.getByRole("button", { name: "Refresh saved views" }).click()
    await within(started, "request entered the delayed fixture handler")
    await page.getByRole("button", { name: "Refresh saved views" }).click()
    await page.getByText("Your access changed. Reload before opening or changing saved views.").waitFor()
    const late = page.waitForResponse((response) => response.headers()["x-late-fixture"] === "yes")
    state.release?.()
    await finishRead(page, late)
    expect(await page.content()).not.toContain("PRIVATE-VIEW")
    expect(await page.locator("[data-personal-views] button, [data-personal-views] input").count()).toBe(0)
  } finally { state.release?.(); await closeFixture(page, server) }
}, 30000)

test("opening an authorized saved view requires an explicit decision to discard current edits", async () => {
  const entry: SfPersonalViewRecord = { view: { id: "saved-view-01", title: "Saved destination", surface: "planner", page: "CAPEX" }, version: 1 }
  const body = form("OPEX", "save", "line", 1, fields([{ name: "note", label: "Business note", value: "Original" }])) + personalViewsWidget({ surface: "planner", page: "OPEX" })
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(new URL(request.url).searchParams.has("view") ? "<h1>Restored saved view</h1>" : pageHtml(body, personalViewsScript), { headers: { "Content-Type": "text/html" } })
    const command = await request.json()
    return Response.json({ status: "ok", value: command.action === "list" ? [entry] : entry })
  } })
  const page = await fixturePage(server)
  try {
    const original = new URL("planner?page=OPEX", server.url).href
    await page.goto(original)
    await page.getByRole("button", { name: "Saved destination", exact: true }).waitFor()
    await page.getByLabel("Business note").fill("Local draft")
    const dialogs: string[] = []
    const decision = { accept: false }
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type())
      if (decision.accept) await dialog.accept()
      else await dialog.dismiss()
    })
    await page.getByRole("button", { name: "Saved destination", exact: true }).click()
    expect(dialogs).toEqual(["confirm"])
    expect(page.url()).toBe(original)
    expect(await page.getByLabel("Business note").inputValue()).toBe("Local draft")
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
    decision.accept = true
    await page.getByRole("button", { name: "Saved destination", exact: true }).click()
    await page.getByRole("heading", { name: "Restored saved view" }).waitFor()
    expect(dialogs).toEqual(["confirm", "confirm"])
    expect(new URL(page.url()).searchParams.get("view")).toBe(entry.view.id)
    expect(new URL(page.url()).searchParams.get("page")).toBe("CAPEX")
  } finally { await closeFixture(page, server) }
}, 30000)

test("a newer authorized list cannot be repopulated by an older filtered read", async () => {
  const state: { calls: number; started?: () => void; release?: () => void } = { calls: 0 }
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const entry: SfPersonalViewRecord = { view: { id: "private-view-01", title: "Previously authorized", surface: "planner", page: "OPEX" }, version: 1 }
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    state.calls++
    if (state.calls === 2) { await new Promise<void>((resolve) => { state.release = resolve; state.started?.() }); return Response.json({ status: "ok", value: [entry] }, { headers: { "X-Late-Fixture": "yes" } }) }
    return Response.json({ status: "ok", value: state.calls === 1 ? [entry] : [] })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?page=OPEX", server.url).href)
    await page.getByRole("button", { name: "Previously authorized", exact: true }).waitFor()
    await page.getByRole("button", { name: "Refresh saved views" }).click()
    await within(started, "request entered the delayed fixture handler")
    await page.getByRole("button", { name: "Refresh saved views" }).click()
    await page.getByText("No saved views yet.").waitFor()
    const late = page.waitForResponse((response) => response.headers()["x-late-fixture"] === "yes")
    state.release?.(); await finishRead(page, late)
    expect(await page.getByRole("button", { name: "Previously authorized", exact: true }).count()).toBe(0)
    expect(await page.getByText("No saved views yet.").count()).toBe(1)
  } finally { state.release?.(); await closeFixture(page, server) }
}, 30000)

test("an older open response cannot replace the user's newer destination choice", async () => {
  const state: { started?: () => void; release?: () => void } = {}
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const first: SfPersonalViewRecord = { view: { id: "saved-view-01", title: "First destination", surface: "planner", page: "CAPEX" }, version: 1 }
  const second: SfPersonalViewRecord = { view: { id: "saved-view-02", title: "Second destination", surface: "planner", page: "OPEX", currency: "USD" }, version: 1 }
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(new URL(request.url).searchParams.has("view") ? "<h1>Older destination opened</h1>" : pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    const command = await request.json()
    if (command.action === "list") return Response.json({ status: "ok", value: [first, second] })
    if (command.input.id === first.view.id) { await new Promise<void>((resolve) => { state.release = resolve; state.started?.() }); return Response.json({ status: "ok", value: first }, { headers: { "X-Late-Fixture": "yes" } }) }
    return Response.json({ status: "ok", value: second })
  } })
  const page = await fixturePage(server)
  try {
    const original = new URL("planner?page=OPEX", server.url).href
    await page.goto(original)
    await page.getByRole("button", { name: "First destination", exact: true }).click()
    await within(started, "request entered the delayed fixture handler")
    await page.getByRole("button", { name: "Second destination", exact: true }).click()
    await page.getByText("This view has a currency context that cannot be restored here.", { exact: false }).waitFor()
    const late = page.waitForResponse((response) => response.headers()["x-late-fixture"] === "yes")
    state.release?.(); await finishRead(page, late)
    expect(page.url()).toBe(original)
    expect(await page.getByText("This view has a currency context that cannot be restored here.", { exact: false }).count()).toBe(1)
  } finally { state.release?.(); await closeFixture(page, server) }
}, 30000)

test("an arriving saved density cannot overwrite edits made while its authorized read was pending", async () => {
  const state: { started?: () => void; release?: () => void } = {}
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const entry: SfPersonalViewRecord = { view: { id: "saved-view-01", title: "Stored view", surface: "planner", page: "OPEX", density: "comfortable" }, version: 1 }
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(pageHtml(personalViewsWidget({ surface: "planner", page: "OPEX" }), personalViewsScript), { headers: { "Content-Type": "text/html" } })
    const command = await request.json()
    if (command.action === "list") return Response.json({ status: "ok", value: [entry] })
    await new Promise<void>((resolve) => { state.release = resolve; state.started?.() })
    return Response.json({ status: "ok", value: entry }, { headers: { "X-Late-Fixture": "yes" } })
  } })
  const page = await fixturePage(server)
  try {
    await page.goto(new URL("planner?page=OPEX&view=" + entry.view.id, server.url).href)
    await within(started, "request entered the delayed fixture handler")
    await page.getByLabel("View name").fill("My pending view")
    await page.getByLabel("Display density").selectOption("compact")
    const late = page.waitForResponse((response) => response.headers()["x-late-fixture"] === "yes")
    state.release?.(); await finishRead(page, late)
    expect(await page.getByLabel("View name").inputValue()).toBe("My pending view")
    expect(await page.getByLabel("Display density").inputValue()).toBe("compact")
    expect(await page.locator("html").getAttribute("data-sf-density")).toBe("compact")
  } finally { state.release?.(); await closeFixture(page, server) }
}, 30000)
