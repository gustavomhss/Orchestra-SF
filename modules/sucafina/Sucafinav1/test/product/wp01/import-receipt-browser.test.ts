import { expect, test } from "bun:test"
import { documentHtml, pageMain } from "../../../src/screen-shell.ts"
import { importPreviewScript, importPreviewWidget } from "../../../product/ui/import-preview.ts"

test("import reports the persisted unchanged outcome after an uncertain response", async () => {
  const html = documentHtml("Dashboard", "dashboard", "", pageMain({ drawn: true, key: "Budget Overview", index: 2 }, `${importPreviewWidget}<script>${importPreviewScript}</script>`), "")
  let applies = 0
  const server = Bun.serve({ port: 0, fetch: (request) => {
    const mode = new URL(request.url).searchParams.get("sf")
    if (!mode) return new Response(html, { headers: { "Content-Type": "text/html" } })
    if (mode === "import-targets") return Response.json({ status: "ok", value: [{ label: "Budget", surface: "dashboard", selectionRef: "selection", formats: ["json"] }] })
    if (mode === "import-admit") return Response.json({ status: "ok", value: { ref: "file" } })
    if (mode === "import-preview") return Response.json({ status: "ok", value: { id: "manifest", version: 1, state: "preview", issues: [] } })
    if (mode === "import-apply") { applies++; return new Response("unavailable", { status: 503 }) }
    if (mode === "import-detail") return Response.json({ status: "ok", value: { detail: { changes: [] }, ...(applies ? { receipt: { manifestId: "manifest", outcome: "unchanged", changedFields: 0 } } : {}) } })
    return new Response(null, { status: 404 })
  } })
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    await page.goto(server.url.href)
    await page.getByText("Import with preview").click()
    await page.getByRole("button", { name: "Find destinations" }).click()
    await page.getByLabel("Destination").selectOption("0")
    await page.locator("[data-import-form]").getByLabel("File", { exact: true }).setInputFiles({ name: "budget.json", mimeType: "application/json", buffer: Buffer.from("{}") })
    await page.getByRole("button", { name: "Preview import" }).click()
    await page.getByRole("button", { name: "Apply reviewed import" }).click()
    await page.getByText("Import completed; no fields needed changing.").waitFor()
    expect(applies).toBe(1)
  } finally {
    await browser.close()
    await server.stop(true)
  }
}, 30000)
