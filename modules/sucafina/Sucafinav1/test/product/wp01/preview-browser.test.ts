import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { documentHtml, links, pageMain } from "../../../src/screen-shell.ts"
import { DASHBOARD_PAGES } from "../../../src/nav.ts"
import { form, fields } from "../../../runtime/ui.ts"

test("dashboard groups retain every canonical destination and its original index", () => {
  const html = links(DASHBOARD_PAGES.map((key, index) => ({ key, index })))
  expect(html).toContain("Budget and people")
  expect(html).toContain("Operations and governance")
  DASHBOARD_PAGES.forEach((key, index) => expect(html).toContain(`data-index="${index}" href="?page=${encodeURIComponent(key)}"`))
})

test("field errors identify the input and preserve the draft", async () => {
  const html = documentHtml("Dashboard", "dashboard", "", pageMain({ drawn: true, key: "OPEX Detail", index: 3 }, form("OPEX Detail", "year-amount", "line", 1, fields([{ name: "amount", label: "Amount", value: "10" }]))), "")
  const server = Bun.serve({ port: 0, fetch: (request) => request.method === "GET" ? new Response(html, { headers: { "Content-Type": "text/html" } }) : Response.json({ ok: false, fieldErrors: [{ field: "amount", message: "Enter a valid amount." }] }, { status: 422 }) })
  const browser = await launchWp01Browser()
  try {
    const page = await browser.newPage()
    await page.goto(server.url.href)
    await page.getByLabel("Amount").fill("20")
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByText("Enter a valid amount.").waitFor()
    expect(await page.getByLabel("Amount").inputValue()).toBe("20")
    expect(await page.getByLabel("Amount").getAttribute("aria-invalid")).toBe("true")
    expect(await page.getByLabel("Amount").evaluate((input) => document.activeElement === input)).toBe(true)
  } finally {
    await closeWp01Browser(browser)
    await server.stop(true)
  }
}, 30000)

test("procurement submission carries edits from its record's editor", async () => {
  let submitted: unknown
  const body = `<section>${form("Requests", "save", "request-1", 1, fields([{ name: "description", label: "Description", value: "Old" }]))}${form("Requests", "submit_pr", "request-1", 1, "", "Submit requisition")}</section>`
  const html = documentHtml("Procurement", "procurement", "", pageMain({ drawn: true, key: "Requests", index: 1 }, body), "")
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(html, { headers: { "Content-Type": "text/html" } })
    submitted = await request.json()
    return Response.json({ ok: false, errors: ["Review required."] }, { status: 422 })
  } })
  const browser = await launchWp01Browser()
  try {
    const page = await browser.newPage()
    await page.goto(server.url.href)
    await page.getByLabel("Description").fill("Revised")
    await page.getByRole("button", { name: "Submit requisition" }).click()
    await page.getByText("Review required.").waitFor()
    expect(submitted).toMatchObject({ action: "submit_pr", id: "request-1", version: 1, values: { description: "Revised" } })
    expect(await page.getByLabel("Description").inputValue()).toBe("Revised")
  } finally {
    await closeWp01Browser(browser)
    await server.stop(true)
  }
}, 30000)

test("edits made while an apply is in flight remain unsaved in the real shell", async () => {
  expectSpawn(import.meta.path)
  const state: { release?: () => void; started?: () => void; applied: number } = { applied: 0 }
  const started = new Promise<void>((resolve) => { state.started = resolve })
  const html = documentHtml("Dashboard", "dashboard", "", pageMain({ drawn: true, key: "OPEX Detail", index: 3 }, form("OPEX Detail", "year-amount", "line", 1, fields([{ name: "amount", label: "Amount", value: "10" }]))), "")
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    if (request.method === "GET") return new Response(html, { headers: { "Content-Type": "text/html" } })
    const command = await request.json()
    if (command.action === "preview-change") return Response.json({ ok: true, value: { status: "preview", previewRef: "preview", changes: [{ path: "/amount", before: { state: "value", value: 10 }, after: { state: "value", value: 20 } }], warnings: [] } })
    if (command.action === "apply-preview") {
      await new Promise<void>((resolve) => { state.release = resolve; state.started?.() })
      state.applied++
      return Response.json({ ok: true, value: { previewRef: "preview", applied: true } })
    }
    return Response.json({ ok: false }, { status: 400 })
  } })
  const browserDriver = await launchBrowserDriver("preview-in-flight").catch(async (error) => { await server.stop(true); throw error })
  const browser = browserDriver.browser
  try {
    const page = await browser.newPage()
    await page.goto(server.url.href)
    await page.getByLabel("Amount").fill("20")
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByText("/amount: 10 → 20").waitFor()
    await page.getByRole("button", { name: "Confirm and apply" }).click()
    await started
    await page.getByLabel("Amount").fill("30")
    state.release?.()
    await page.getByText("The reviewed changes were saved. New edits remain unsaved; review them before applying.").waitFor()
    expect(await page.getByLabel("Amount").inputValue()).toBe("30")
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
    expect(state.applied).toBe(1)
  } finally {
    state.release?.()
    try { await browserDriver.close() }
    finally { await server.stop(true) }
  }
  browserDriver.report()
}, 30000)
