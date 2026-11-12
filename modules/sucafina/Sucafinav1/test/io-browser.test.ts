import { test } from "bun:test"
import { Workbook } from "exceljs"
import { expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"

test("browser previews/applies Planner XLSX and exports persisted monthly values and totals", async () => {
  console.info("browser IO: opening private installation")
  const fixture = await localBrowser()
  try {
    console.info("browser IO: private installation authenticated")
    const page = fixture.page
    page.setDefaultTimeout(10000)
    page.on("dialog", (dialog) => dialog.accept())
    page.on("response", (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        console.info("browser IO: main navigation response", response.status(), new URL(response.url()).pathname)
      }
    })
    page.on("domcontentloaded", () => console.info("browser IO: DOMContentLoaded", new URL(page.url()).pathname))
    page.on("load", () => console.info("browser IO: load", new URL(page.url()).pathname))
    page.on("requestfailed", (request) => console.info("browser IO: request failed", request.method(), new URL(request.url()).pathname))
    console.info("browser IO: Versions navigation starting")
    try {
      const response = await page.goto("http://localhost:4110/sucafina/planner?page=Versions", { waitUntil: "load", timeout: 10000 })
      console.info("browser IO: Versions navigation complete", response?.status(), new URL(page.url()).pathname)
    } catch (error) {
      console.info("browser IO: Versions navigation failed", error instanceof Error ? error.name : "unknown", new URL(page.url()).pathname)
      // The page can be unresponsive. Inspect only business text under main, with a separate hard bound.
      const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
      try {
        const text = await Promise.race([
          page.locator('body[data-surface="planner"] main').innerText({ timeout: 1000 }),
          new Promise<never>((_, reject) => { deadline.timer = setTimeout(() => reject(new Error("Versions diagnostic text deadline")), 1500) }),
        ])
        console.info("browser IO: Versions business text", text.slice(0, 2000))
      } catch {
        console.info("browser IO: Versions business text unavailable within bound")
      } finally {
        if (deadline.timer) clearTimeout(deadline.timer)
      }
      throw error
    }
    await submit(page, page.locator('form[data-command="save"][data-record=""]'))
    await page.goto("http://localhost:4110/sucafina/planner?page=OPEX")
    const book = new Workbook()
    const sheet = book.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Description", "Currency", "Measure", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    sheet.addRow(["", "Services", "Browser OPEX fixture", "Temporary acceptance record", "USD", "Budget", ...Array.from({ length: 12 }, () => 125)])
    await page.getByText("Import workbook", { exact: true }).click()
    const planner = page.locator('form[data-command="import-workbook"]')
    console.info("browser IO: Planner workbook preview")
    console.info("browser IO: Planner XLSX generation starting")
    const plannerBytes = Buffer.from(await book.xlsx.writeBuffer())
    console.info("browser IO: Planner XLSX generation complete")
    const plannerFile = path.join(fixture.root, "browser-opex.xlsx")
    await Bun.write(plannerFile, plannerBytes)
    const [previewResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 }),
      planner.locator('input[type="file"]').setInputFiles(plannerFile),
    ])
    const previewBody = await previewResponse.json()
    console.info("browser IO: Planner preview response", previewResponse.status())
    expect(previewResponse.status(), JSON.stringify(previewBody)).toBe(200)
    expect(previewBody).toMatchObject({ ok: true })
    await expect(planner.locator("[data-import-notice]")).toContainText("OPEX (1)")
    await submit(page, planner)
    const importedLine = page.getByRole("row").filter({ hasText: "Browser OPEX fixture" }).first()
    await expect(importedLine).toBeVisible()
    // The grid renders month inputs; its annual total is verified in the exported workbook below.
    for (const month of Array.from({ length: 12 }, (_, index) => index)) await expect(importedLine.locator(`[name="b${month}"]`)).toHaveValue("125")
    const exported = new Workbook()
    const plannerDownload = await expectDownload(page, page.getByRole("link", { name: "Export Excel", exact: true }).first())
    console.info("browser IO: Planner XLSX parse starting")
    await exported.xlsx.load(await plannerDownload.arrayBuffer())
    console.info("browser IO: Planner XLSX parse complete")
    const exportedOpex = exported.getWorksheet("OPEX")
    expect(exportedOpex).toBeDefined()
    const rows: unknown[][] = []
    exportedOpex!.eachRow((row) => { if (row.getCell(3).text === "Browser OPEX fixture") rows.push(Array.from({ length: 22 }, (_, column) => row.getCell(column + 1).value)) })
    const budget = rows.find((row) => String(row[8]).startsWith("Budget"))
    expect(budget).toBeDefined()
    expect(budget!.slice(9, 21)).toEqual(Array.from({ length: 12 }, () => 125))
    expect(budget![21]).toMatchObject({ formula: expect.stringMatching(/^SUM\(J\d+:U\d+\)$/), result: 1500 })
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-opex.png"), fullPage: true, timeout: 10000, animations: "disabled" })

    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser IO: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser IO: cleanup starting")
    await fixture.dispose()
    console.info("browser IO: cleanup complete")
  }
}, 90000)

test("browser roundtrips private document bytes, supplier CSV and Members XLSX", async () => {
  console.info("browser IO: opening private installation")
  const fixture = await localBrowser()
  try {
    console.info("browser IO: private installation authenticated")
    const page = fixture.page
    page.setDefaultTimeout(10000)
    page.on("dialog", (dialog) => dialog.accept())
    await page.goto("http://localhost:4110/sucafina/procurement?page=Settings")
    await page.locator("details").filter({ has: page.locator('form[data-command="reset"]') }).locator("summary").click()
    await submit(page, page.locator('form[data-command="reset"]'))
    const policy = page.locator('form[data-command="save"]')
    await policy.getByLabel("Attachment limit (bytes)", { exact: true }).fill("1048576")
    await policy.locator('[name="levels.0.holderId"]').selectOption(fixture.actorId)
    await policy.locator('[name="levels.1.holderId"]').selectOption(fixture.actorId)
    await submit(page, policy)
    await expect(policy.getByLabel("Attachment limit (bytes)", { exact: true })).toHaveValue("1048576")
    await page.goto("http://localhost:4110/sucafina/procurement?page=Suppliers")
    const supplier = page.locator('form[data-command="create"]')
    await supplier.getByLabel("Legal name", { exact: true }).fill("Private asset fixture vendor")
    await submit(page, supplier)
    const bytes = Buffer.from("Private disposable browser acceptance document\n")
    const upload = page.locator('form[data-private-upload="supplier"]')
    await upload.locator('input[type="file"]').setInputFiles({ name: "browser-clean.txt", mimeType: "text/plain", buffer: bytes })
    // Real private HTTP asset path; INSTREAM loopback scanner is a fixture, not production AV proof.
    await submit(page, upload)
    const document = await expectDownload(page, page.getByRole("link", { name: "browser-clean.txt", exact: true }))
    console.info("browser IO: private document byte verification starting")
    expect(Buffer.from(await document.arrayBuffer())).toEqual(bytes)
    console.info("browser IO: private document byte verification complete")
    const csv = await (await expectDownload(page, page.getByRole("link", { name: "Download suppliers CSV", exact: true }))).text()
    console.info("browser IO: supplier CSV parse starting")
    const records = csv.split(/\r?\n/).map((line) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((cell) => cell[1]!.replaceAll('""', '"')))
    expect(records).toHaveLength(2)
    expect(records[1]![records[0]!.indexOf("legalName")]).toBe("Private asset fixture vendor")
    expect(records[1]![records[0]!.indexOf("status")]).toBe("pending")
    console.info("browser IO: supplier CSV parse complete")

    await page.goto("http://localhost:4110/sucafina/dashboard?page=Talent%20Review")
    const membersBook = new Workbook()
    membersBook.addWorksheet("All Members").addRows([
      ["Name", "Title", "Type", "Status", "Notes"],
      ["Browser acceptance member fixture", "Test record", "Employee", "Active", "Synthetic business data; no corporate identity"],
    ])
    const members = page.locator('form[data-command="import"]')
    console.info("browser IO: Members workbook preview")
    console.info("browser IO: Members XLSX generation starting")
    const memberBytes = Buffer.from(await membersBook.xlsx.writeBuffer())
    console.info("browser IO: Members XLSX generation complete")
    const memberFile = path.join(fixture.root, "browser-members.xlsx")
    await Bun.write(memberFile, memberBytes)
    const [memberResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 }),
      members.locator('input[type="file"]').setInputFiles(memberFile),
    ])
    const memberBody = await memberResponse.json()
    console.info("browser IO: Members preview response", memberResponse.status())
    expect(memberResponse.status(), JSON.stringify(memberBody)).toBe(200)
    expect(memberBody).toMatchObject({ ok: true })
    // Must expose a real preview and apply path; do not inject a missing output control.
    await expect(members.locator("[data-import-notice]")).toContainText("All Members (1)")
    await submit(page, members)
    await expect(page.getByRole("row").filter({ hasText: "Browser acceptance member fixture" })).toHaveCount(1)
    const membersExport = new Workbook()
    const memberDownload = await expectDownload(page, page.getByRole("link", { name: "Export All Members", exact: true }))
    console.info("browser IO: Members XLSX parse starting")
    await membersExport.xlsx.load(await memberDownload.arrayBuffer())
    console.info("browser IO: Members XLSX parse complete")
    const allMembers = membersExport.getWorksheet("All Members")
    expect(allMembers?.rowCount).toBe(2)
    expect(allMembers!.getCell("A2").text).toBe("Browser acceptance member fixture")
    expect(allMembers!.getCell("I2").text).toBe("Active")
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-members.png"), fullPage: true, timeout: 10000, animations: "disabled" })
    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser IO: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser IO: cleanup starting")
    await fixture.dispose()
    console.info("browser IO: cleanup complete")
  }
}, 90000)

async function submit(page: Page, form: Locator) {
  console.info("browser IO: checking submit control")
  await expect(form).toHaveCount(1)
  await expect(form.locator('button[type="submit"]')).toHaveCount(1)
  await expect(form.locator('button[type="submit"]')).toBeVisible()
  await expect(form.locator('button[type="submit"]')).toBeEnabled()
  const command = { page: await form.getAttribute("data-page"), action: await form.getAttribute("data-command") ?? await form.getAttribute("data-private-upload") }
  console.info("browser IO: submit", JSON.stringify(command))
  const [saved] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 }),
    form.locator('button[type="submit"]').click(),
  ])
  console.info("browser IO: submit response", JSON.stringify(command), saved.status())
  const payload = await saved.json()
  if (saved.status() !== 200) console.error("browser acceptance response", JSON.stringify({ ...command, status: saved.status(), response: payload }))
  expect(saved.status(), `${command.page} / ${command.action}: ${JSON.stringify(payload)}`).toBe(200)
  expect(payload).toMatchObject({ ok: true })
  await page.reload()
  console.info("browser IO: persisted", JSON.stringify(command))
}
async function expectDownload(page: Page, link: Locator) {
  console.info("browser IO: download", await link.innerText())
  const [downloaded] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    link.click(),
  ])
  console.info("browser IO: download event received", downloaded.suggestedFilename())
  expect(await downloaded.failure()).toBeNull()
  const file = await downloaded.path()
  expect(file).not.toBeNull()
  console.info("browser IO: downloaded", downloaded.suggestedFilename())
  return Bun.file(file!)
}
