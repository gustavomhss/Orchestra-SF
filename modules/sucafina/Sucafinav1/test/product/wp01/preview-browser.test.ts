import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { documentHtml, pageMain } from "../../../src/screen-shell.ts"
import { form, fields } from "../../../runtime/ui.ts"

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
