import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { documentHtml, links, pageMain } from "../../../src/screen-shell.ts"
import { dashboardScreen } from "../../../src/dashboard-screen.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV, dashboardPages, setYear, sidebarYear } from "../../../src/nav.ts"
import { fields, form, table } from "../../../runtime/ui.ts"

const runtime: { browser?: Browser } = {}
beforeAll(async () => {
  runtime.browser = await launchWp01Browser()
}, 35_000)
afterAll(async () => { if (runtime.browser) await closeWp01Browser(runtime.browser) }, 25_000)

function editor(value = "Original", version = 1) {
  return form("Vendor Contracts", "save", "contract-1", version, fields([{ name: "description", label: "Description", value }]))
}
function html(body: string, revision = "access-1") {
  return documentHtml("Dashboard", "dashboard", links([{ key: "Vendor Contracts", index: 13 }]), pageMain({ drawn: true, key: "Vendor Contracts", index: 13 }, body), "", "", revision)
}

test.each([401, 403])("refresh %i removes the old authorized view even with unsaved edits", async (status) => {
  const state = { denied: false }
  const initial = html(`<p>PRIVATE-RECORD</p>${editor()}`)
  const server = Bun.serve({ port: 0, fetch: () => state.denied ? new Response("PRIVATE-DENIAL-BODY", { status }) : new Response(initial, { headers: { "Content-Type": "text/html" } }) })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("PRIVATE-DRAFT")
    state.denied = true
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect(await page.locator("main[data-access-unavailable]").count()).toBe(1)
    expect(await page.getByRole("button", { name: "Reload access" }).count()).toBe(1)
    expect(await page.locator("input, textarea, dialog, nav").count()).toBe(0)
    expect(await page.content()).not.toContain("PRIVATE-RECORD")
    expect(await page.content()).not.toContain("PRIVATE-DRAFT")
    expect(await page.content()).not.toContain("PRIVATE-DENIAL-BODY")
    expect(await page.locator("h1").evaluate((heading) => heading === document.activeElement)).toBe(true)
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("access revision change fails closed even when refresh returns HTTP 200", async () => {
  const state = { revision: "access-1" }
  const server = Bun.serve({ port: 0, fetch: () => new Response(html(editor("PRIVATE"), state.revision), { headers: { "Content-Type": "text/html", "X-SF-Access-Revision": state.revision } }) })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("PRIVATE-DRAFT")
    state.revision = "access-2"
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect(await page.getByRole("heading", { name: "Your access has changed" }).count()).toBe(1)
    expect(await page.content()).not.toContain("PRIVATE")
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("an expired session rendered as a sign-in document cannot retain the dirty authorized view", async () => {
  const state = { expired: false }
  const server = Bun.serve({ port: 0, fetch: () => new Response(state.expired ? documentHtml("Sign in", "signed-out", "", "<main>Sign in again</main>", "") : html(editor("PRIVATE-OLD-VIEW")), { headers: { "Content-Type": "text/html" } }) })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("PRIVATE-DRAFT")
    state.expired = true
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect(await page.getByRole("heading", { name: "Your session has expired" }).count()).toBe(1)
    expect(await page.content()).not.toContain("PRIVATE")
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("transient refresh failure and fresh data preserve a dirty form and its expected version", async () => {
  const state = { status: 200, version: 1 }
  const server = Bun.serve({ port: 0, fetch: () => new Response(html(editor("Server version " + state.version, state.version)), { status: state.status, headers: { "Content-Type": "text/html" } }) })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("Local draft")
    state.status = 503
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect(await page.getByLabel("Description").inputValue()).toBe("Local draft")
    expect(await page.locator("#notice").textContent()).toContain("Could not refresh")
    expect(await page.locator("#notice").textContent()).not.toContain("Saved")
    state.status = 200
    state.version = 2
    await page.getByRole("button", { name: "Refresh data" }).click()
    await page.getByText("Refresh received. Your unsaved edits are preserved; save or discard them before updating this view.").waitFor()
    expect(await page.getByLabel("Description").inputValue()).toBe("Local draft")
    expect(await page.locator("form[data-command]").getAttribute("data-version")).toBe("1")
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("edits typed during an ordinary save remain pending after its receipt", async () => {
  const state: { release?: () => void; started?: () => void; saved: number } = { saved: 0 }
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(html(editor()), { headers: { "Content-Type": "text/html" } })
    await request.json()
    await new Promise<void>((resolve) => { state.release = resolve; state.started?.() })
    state.saved++
    return Response.json({ ok: true })
  } })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("Submitted draft")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await started
    await page.getByLabel("Description").fill("Later draft")
    state.release?.()
    await page.getByText("The submitted changes were saved. Later edits remain unsaved; review them before continuing.").waitFor()
    expect(await page.getByLabel("Description").inputValue()).toBe("Later draft")
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
    expect(state.saved).toBe(1)
  } finally { state.release?.(); await page.close(); await server.stop(true) }
}, 30000)

test("HTTP conflict preserves the attempt and shows the server value without a duplicated body status", async () => {
  const server = Bun.serve({ port: 0, fetch: (request) => request.method === "GET"
    ? new Response(html(editor()), { headers: { "Content-Type": "text/html" } })
    : Response.json({ ok: false, stored: { description: "Other person's change" } }, { status: 409 }) })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("My attempt")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.getByText("This record changed since you opened it.", { exact: false }).waitFor()
    expect(await page.locator("#notice").textContent()).toContain("Current: description: Other person's change")
    expect(await page.locator("#notice").textContent()).toContain("Your attempt: description: My attempt")
    expect(await page.getByLabel("Description").inputValue()).toBe("My attempt")
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
    expect(await page.locator("#notice").textContent()).not.toContain("Saved")
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("navigation keeps scoped Dashboard periods and Planner version without sharing filters", async () => {
  const server = Bun.serve({ port: 0, fetch: (request) => {
    const planner = new URL(request.url).pathname === "/planner"
    const content = planner
      ? documentHtml("Budget Planner", "planner", links(PLANNER_TABS.map((key, index) => ({ key, index }))), pageMain({ drawn: true, key: "OPEX", index: 1 }), "")
      : dashboardScreen({ actor: { id: "operator", roles: ["admin"], canWrite: true }, key: "IT Operations", year: 2027, ownYear: 2025 }).html
    return new Response(content, { headers: { "Content-Type": "text/html" } })
  } })
  const page = await runtime.browser!.newPage()
  try {
    await page.goto(new URL("?page=IT+Operations&year=2027&own=2025&month=5&execYear=2024&secYear=2026&securityMonth=9", server.url).href)
    expect(await page.locator('main select[data-year="own"][data-query="opsYear"]').inputValue()).toBe("2025")
    const security = new URL((await page.locator("nav a").filter({ hasText: "IT Security KPIs" }).getAttribute("href"))!)
    expect(security.searchParams.get("opsYear")).toBe("2025")
    expect(security.searchParams.get("operationsMonth")).toBe("5")
    expect(security.searchParams.get("secYear")).toBe("2026")
    expect(security.searchParams.get("securityMonth")).toBe("9")
    expect(security.searchParams.has("own")).toBe(false)
    expect(security.searchParams.has("month")).toBe(false)
    await page.goto(new URL("planner?page=OPEX&year=2027&version=approved-v3&execYear=2024", server.url).href)
    const capex = new URL((await page.locator("nav a").filter({ hasText: "CAPEX" }).getAttribute("href"))!)
    expect(capex.searchParams.get("year")).toBe("2027")
    expect(capex.searchParams.get("version")).toBe("approved-v3")
    expect(capex.searchParams.has("execYear")).toBe(false)
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("back from a detail restores the same query and scroll position after server revalidation", async () => {
  const server = Bun.serve({ port: 0, fetch: (request) => {
    const detail = new URL(request.url).searchParams.has("record")
    const body = detail ? "<p>Current authorized record detail</p>" : '<div style="height:900px"></div><a data-detail href="?page=Vendor+Contracts&year=2027&filter=open&record=contract-1">Open record</a><div style="height:1600px"></div>'
    return new Response(html(body), { headers: { "Content-Type": "text/html" } })
  } })
  const page = await runtime.browser!.newPage({ viewport: { width: 1440, height: 700 } })
  try {
    const original = new URL("?page=Vendor+Contracts&year=2027&filter=open", server.url).href
    await page.goto(original)
    await page.locator("[data-detail]").scrollIntoViewIfNeeded()
    const position = await page.evaluate(() => scrollY)
    await page.locator("[data-detail]").click()
    await page.getByText("Current authorized record detail").waitFor()
    await page.goBack()
    await page.waitForFunction((expected) => Math.abs(scrollY - expected) < 2, position)
    expect(page.url()).toBe(original)
    expect(await page.locator("[data-detail]").count()).toBe(1)
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test.each([320, 768, 1440])("real shell detail supports keyboard, focus return and confined overflow at %i px", async (width) => {
  const rows = ["first", "second"].map((id) => ["Long authorized record " + "reference-".repeat(24), form("Vendor Contracts", "save", id, 1, fields([{ name: "description", label: "Description", value: "A long business explanation ".repeat(24), type: "textarea" }, { name: "readonly", label: "Protected value", value: "Visible but not editable", readonly: true }]))])
  const server = Bun.serve({ port: 0, fetch: () => new Response(html(table(["Record", "Edit"], rows)), { headers: { "Content-Type": "text/html" } }) })
  const page = await runtime.browser!.newPage({ viewport: { width, height: 900 } })
  try {
    await page.goto(server.url.href)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const button = page.locator("[data-open-editor]").nth(1)
    await button.focus()
    await page.keyboard.press("Enter")
    const dialog = page.locator("dialog").nth(1)
    await dialog.waitFor({ state: "visible" })
    expect(await button.getAttribute("aria-expanded")).toBe("true")
    expect(await dialog.evaluate((element) => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth })).toBe(true)
    await dialog.getByRole("button", { name: "Close editor" }).focus()
    await page.keyboard.press("Shift+Tab")
    expect(await dialog.getByRole("button", { name: "Save", exact: true }).evaluate((element) => element === document.activeElement)).toBe(true)
    await page.keyboard.press("Tab")
    expect(await dialog.getByRole("button", { name: "Close editor" }).evaluate((element) => element === document.activeElement)).toBe(true)
    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "hidden" })
    expect(await button.evaluate((element) => element === document.activeElement)).toBe(true)
    expect(await button.getAttribute("aria-expanded")).toBe("false")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { await page.close(); await server.stop(true) }
}, 30000)

test("canonical destinations retain identifiers and invalid years cannot enter navigation state", () => {
  for (const pages of [DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV]) {
    const output = links(pages.map((key, index) => ({ key, index })))
    for (const [index, key] of pages.entries()) expect(output).toContain(`data-index="${index}" href="?page=${encodeURIComponent(key)}"`)
  }
  expect(dashboardPages({ roles: ["viewer"] })).toEqual(["Executive Dashboard"])
  for (const year of [NaN, Infinity, 2026.5, 2023, 2028]) {
    expect(sidebarYear(year)).toBe(2026)
    expect(setYear("OPEX Detail", year, 2026)).toEqual({ ok: false })
  }
})
