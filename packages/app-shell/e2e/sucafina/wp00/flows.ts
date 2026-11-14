import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const flowNames = [
  "dashboard-budget-filter", "procurement-volume-open", "planner-scenario-compare", "procurement-sourcing-rank",
  "report-search-docx", "report-search-pptx", "import-preview-exact-reimport",
] as const
export type Flow = typeof flowNames[number]
export type UiCorpusReceipt = {
  schema: string
  datasetDigest: string
  counts: { financialLines: number; purchaseOrders: number; projects: number }
  expected: { actual2027: string; forecast2027: string; openRequests: number; firstRequest: string; firstAmount: string; lastRequest: string; lastAmount: string }
  planner: { baseId: string; baseName: string; alternative84Id: string; alternative78Id: string; alternative78Name: string; baseOutlook: string; outlook84: string; outlook78: string; budget: string; actual: string }
  sourcing: { requestId: string; title: string }
  report: { names: string[]; search: string }
  runtimeVersion: string
  authentication: string
  provider: string
}

const origin = "http://localhost:4110"

/** Preconditions are outside the timer; only subsequent user actions and their usable outcomes are measured. */
export async function prepareUiFlow(flow: Flow, page: Page, corpus: UiCorpusReceipt, directory: string) {
  const selected = flow.startsWith("report-") ? "/sucafina/dashboard?page=All+Projects&year=2027"
    : flow === "planner-scenario-compare" ? "/sucafina/planner?page=Overview&version=" + corpus.planner.baseId
    : flow === "import-preview-exact-reimport" ? "/sucafina/planner?page=Overview&version=" + corpus.planner.alternative78Id
    : "/sucafina/dashboard?page=Budget+Overview&year=2026"
  expect((await page.goto(origin + selected))?.status()).toBe(200)
  if (flow === "dashboard-budget-filter") await expect(page.getByRole("combobox", { name: "FY", exact: true })).toHaveValue("2026")
  if (flow === "planner-scenario-compare") await expectMetric(page, "Full-year outlook", corpus.planner.baseOutlook)
  if (flow.startsWith("report-")) {
    expect(corpus.report.names).toHaveLength(corpus.counts.projects)
    expect(new Set(corpus.report.names).size).toBe(corpus.counts.projects)
    const projects = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Project", exact: true }) })
    await expect(projects.getByRole("row")).toHaveCount(corpus.counts.projects + 1)
    await expect(projects.getByRole("cell", { name: corpus.report.search, exact: true })).toBeVisible()
  }
  if (flow !== "import-preview-exact-reimport") return
  await expectMetric(page, "Full-year outlook", corpus.planner.outlook78)
  await downloadVersionWorkbook(page, corpus.planner.alternative78Id, path.join(directory, "roundtrip.xlsx"))
}

export async function runUiFlow(flow: Flow, page: Page, corpus: UiCorpusReceipt, directory: string, testInfo: TestInfo, repetition: number, visual: () => void) {
  if (flow === "dashboard-budget-filter") {
    const response = page.waitForResponse((entry) => entry.request().method() === "GET"
      && new URL(entry.url()).pathname === "/sucafina/dashboard" && new URL(entry.url()).searchParams.get("year") === "2027")
    await page.getByRole("combobox", { name: "FY", exact: true }).selectOption("2027")
    expect((await response).status()).toBe(200)
    await expect(page.getByRole("combobox", { name: "FY", exact: true })).toHaveValue("2027")
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "OPEX", exact: true }) })
    await expect(row.getByRole("cell", { name: corpus.expected.actual2027, exact: true })).toBeVisible()
    visual()
    await expect(row.getByRole("cell", { name: corpus.expected.forecast2027, exact: true })).toBeVisible()
    await expect(page.getByRole("img", { name: "Effective monthly budget", exact: true })).toBeVisible()
    const months = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Flat reference (annual allocations / 12)", exact: true }) })
    await expect(months.getByRole("row")).toHaveCount(13)
    return
  }
  if (flow === "procurement-volume-open") {
    expect((await page.goto(origin + "/sucafina/procurement?page=Dashboard"))?.status()).toBe(200)
    await expect(page.getByRole("link", { name: "Download request register", exact: true })).toBeEnabled()
    const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Request", exact: true }) })
    const first = table.getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.expected.firstRequest, exact: true }) })
    await expect(first.getByRole("cell", { name: corpus.expected.firstAmount, exact: true })).toBeVisible()
    visual()
    await expect(table.getByRole("row")).toHaveCount(corpus.expected.openRequests + 1)
    const last = table.getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.expected.lastRequest, exact: true }) })
    await expect(last.getByRole("cell", { name: corpus.expected.lastAmount, exact: true })).toBeVisible()
    return
  }
  if (flow === "planner-scenario-compare") {
    await page.getByRole("combobox", { name: "Plan", exact: true }).selectOption(corpus.planner.alternative84Id)
    await page.getByRole("button", { name: "Open plan", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Plan", exact: true })).toHaveValue(corpus.planner.alternative84Id)
    await expectMetric(page, "Full-year outlook", corpus.planner.outlook84)
    visual()
    await expectMetric(page, "Total budget OPEX + CAPEX USD", corpus.planner.budget)
    await expectMetric(page, "Actual YTD", corpus.planner.actual)
    await page.getByRole("combobox", { name: "Plan", exact: true }).selectOption(corpus.planner.alternative78Id)
    await page.getByRole("button", { name: "Open plan", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Plan", exact: true })).toHaveValue(corpus.planner.alternative78Id)
    await expectMetric(page, "Full-year outlook", corpus.planner.outlook78)
    await expectMetric(page, "Total budget OPEX + CAPEX USD", corpus.planner.budget)
    await expectMetric(page, "Actual YTD", corpus.planner.actual)
    await page.getByRole("combobox", { name: "Compare budget", exact: true }).selectOption(corpus.planner.baseId)
    await page.getByRole("button", { name: "Compare budgets", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Plan", exact: true })).toHaveValue(corpus.planner.alternative78Id)
    await expect(page).toHaveURL((url) => url.pathname === "/sucafina/planner"
      && url.searchParams.get("version") === corpus.planner.alternative78Id && url.searchParams.get("filter") === corpus.planner.baseId)
    const comparison = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "FTE December", exact: true }) })
    await expect(comparison.getByRole("columnheader")).toHaveText(["Version", "Budget USD", "FTE December"])
    await expect(comparison.getByRole("row")).toHaveCount(3)
    for (const name of [corpus.planner.baseName, corpus.planner.alternative78Name]) {
      const row = comparison.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) })
      await expect(row).toHaveCount(1)
      await expect(row.getByRole("cell")).toHaveText([name, corpus.planner.budget, "0"])
    }
    await page.getByRole("combobox", { name: "Plan", exact: true }).selectOption(corpus.planner.baseId)
    await page.getByRole("button", { name: "Open plan", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Plan", exact: true })).toHaveValue(corpus.planner.baseId)
    await expectMetric(page, "Full-year outlook", corpus.planner.baseOutlook)
    await expectMetric(page, "Total budget OPEX + CAPEX USD", corpus.planner.budget)
    await expectMetric(page, "Actual YTD", corpus.planner.actual)
    return
  }
  if (flow === "procurement-sourcing-rank") {
    expect((await page.goto(origin + "/sucafina/procurement?page=Requests&q=" + encodeURIComponent(corpus.sourcing.title)))?.status()).toBe(200)
    const request = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: corpus.sourcing.requestId + " · " + corpus.sourcing.title }) })
    await expect(request).toHaveCount(1)
    if (!await request.evaluate((element) => element.hasAttribute("open"))) await request.locator("summary").click()
    const table = request.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Proposal", exact: true }) })
    const a = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "Synthetic Supplier A", exact: true }) })
    const b = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "Synthetic Supplier B", exact: true }) })
    const c = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "Synthetic Supplier C", exact: true }) })
    await expect(b.getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toBeVisible()
    visual()
    await expect(a.getByRole("cell", { name: "87.9", exact: true })).toBeVisible()
    await expect(b.getByRole("cell", { name: "85.0", exact: true })).toBeVisible()
    await expect(table.getByRole("columnheader")).toHaveText([
      "Proposal", "Stated total", "Quantity × unit price", "Base amount / FX", "Technical", "Price", "Commercial", "Overall", "Rank",
    ])
    await expect(a.getByRole("cell").nth(8)).toHaveText("1")
    await expect(b.getByRole("cell").nth(8)).toHaveText("2")
    await expect(c.getByRole("cell").nth(8)).toHaveText("Unavailable")
    await expect(table.getByRole("row")).toHaveCount(4)
    return
  }
  if (flow === "report-search-docx" || flow === "report-search-pptx") {
    const format = flow === "report-search-docx" ? "docx" : "pptx"
    await page.getByRole("textbox", { name: "Search", exact: true }).fill(corpus.report.search)
    await page.getByRole("button", { name: "Apply filters", exact: true }).click()
    const projects = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Project", exact: true }) })
    await expect(projects.getByRole("row")).toHaveCount(2)
    await expect(projects.getByRole("cell", { name: corpus.report.search, exact: true })).toBeVisible()
    visual()
    const panel = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Reports and backup$/ }) })
    if (!await panel.evaluate((element) => element.hasAttribute("open"))) await panel.locator("summary").click()
    const form = panel.locator("form").filter({ has: page.getByRole("button", { name: "Generate Report", exact: true }) })
    await form.getByRole("combobox", { name: "Format", exact: true }).selectOption(format)
    await form.getByRole("combobox", { name: "Year", exact: true }).selectOption("2027")
    await form.getByRole("textbox", { name: "Title", exact: true }).fill("WP00 all 100 projects")
    for (const checkbox of await form.getByRole("checkbox").all()) await checkbox.setChecked(false)
    await form.getByRole("checkbox", { name: "All Projects", exact: true }).check()
    const downloading = page.waitForEvent("download")
    await form.getByRole("button", { name: "Generate Report", exact: true }).click()
    const artifact = await downloading
    expect(await artifact.failure()).toBeNull()
    expect(artifact.suggestedFilename()).toMatch(new RegExp("\\." + format + "$"))
    const output = path.join(directory, "report." + format)
    await artifact.saveAs(output)
    const { inspectUiReport } = await import("../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/verify-ui-artifact.ts")
    const rendered = await inspectUiReport(await readFile(output), format)
    for (const name of corpus.report.names) expect(rendered.xml.split(name).length - 1, "Every explicitly selected project must survive the real download once").toBe(1)
    if (repetition === 30) await testInfo.attach("wp00-" + flow, { path: output, contentType: format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
    return
  }
  const { inspectUiWorkbook } = await import("../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/verify-ui-artifact.ts")
  const original = await inspectUiWorkbook(await readFile(path.join(directory, "roundtrip.xlsx")))
  const panel = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Import with preview$/ }) })
  if (!await panel.evaluate((element) => element.hasAttribute("open"))) await panel.locator("summary").click()
  const section = panel.locator("[data-import-preview]")
  await section.getByLabel("Period start", { exact: true }).fill("2027-01-01")
  await section.getByLabel("Period end", { exact: true }).fill("2027-12-31")
  const targets = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "import-targets")
  await section.getByRole("button", { name: "Find destinations", exact: true }).click()
  expect((await targets).status()).toBe(200)
  const target = section.getByRole("combobox", { name: "Destination", exact: true }).locator("option").filter({ hasText: corpus.planner.alternative78Name })
  await expect(target).toHaveCount(1)
  const value = await target.getAttribute("value")
  if (!value) throw new Error("The actual host did not publish the selected import destination")
  await section.getByRole("combobox", { name: "Destination", exact: true }).selectOption(value)
  await section.getByLabel("File", { exact: true }).setInputFiles(path.join(directory, "roundtrip.xlsx"))
  const preview = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "import-preview")
  await section.getByRole("button", { name: "Preview import", exact: true }).click()
  const previewResponse = await preview
  expect(previewResponse.status()).toBe(200)
  expect(await previewResponse.json()).toMatchObject({
    status: "ok", value: {
      format: "xlsx", state: "preview", domainApplied: false, receipts: [],
      baseIdentity: expect.arrayContaining([expect.objectContaining({ surface: "planner", id: corpus.planner.alternative78Id })]),
    },
  })
  await expect(section.getByRole("status")).toHaveText("Preview preview. No changes have been applied.")
  await expect(section.getByRole("heading", { name: "Changes to review", exact: true })).toBeVisible()
  await expectMetric(page, "Full-year outlook", corpus.planner.outlook78)
  visual()
  // Re-read through the real authorized UI/export. The original DOM predates the preview request.
  // This checks the exported business cells, not hidden storage versions or receipt idempotency.
  const reread = await page.context().newPage()
  try {
    expect((await reread.goto(origin + "/sucafina/planner?page=Overview&version=" + corpus.planner.alternative78Id))?.status()).toBe(200)
    await expectMetric(reread, "Full-year outlook", corpus.planner.outlook78)
    await expectMetric(reread, "Total budget OPEX + CAPEX USD", corpus.planner.budget)
    await downloadVersionWorkbook(reread, corpus.planner.alternative78Id, path.join(directory, "roundtrip-preview.xlsx"))
    expect(await inspectUiWorkbook(await readFile(path.join(directory, "roundtrip-preview.xlsx")))).toEqual(original)
  } finally {
    await reread.close()
    await page.bringToFront()
  }
  const applied = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "import-apply")
  await section.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  const result = await applied
  expect(result.status()).toBe(200)
  expect(await result.json()).toMatchObject({ status: "ok", value: { state: "applied", domainApplied: true } })
  await expect(section.getByRole("status")).toHaveText("Import applied.")
  expect((await page.goto(origin + "/sucafina/planner?page=Overview&version=" + corpus.planner.alternative78Id))?.status()).toBe(200)
  await expectMetric(page, "Full-year outlook", corpus.planner.outlook78)
  await expectMetric(page, "Total budget OPEX + CAPEX USD", corpus.planner.budget)
  await downloadVersionWorkbook(page, corpus.planner.alternative78Id, path.join(directory, "roundtrip-after.xlsx"))
  expect(await inspectUiWorkbook(await readFile(path.join(directory, "roundtrip-after.xlsx")))).toEqual(original)
}

async function downloadVersionWorkbook(page: Page, versionId: string, output: string) {
  const href = "?download=xlsx&version=" + versionId
  const link = page.getByRole("link", { name: "Export Excel", exact: true }).and(page.locator("a[href=" + JSON.stringify(href) + "]"))
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute("href", href)
  const downloading = page.waitForEvent("download")
  await link.click()
  const workbook = await downloading
  expect(await workbook.failure()).toBeNull()
  expect(workbook.suggestedFilename()).toMatch(/\.xlsx$/)
  await workbook.saveAs(output)
}

async function expectMetric(page: Page, label: string, value: string) {
  const metric = page.getByRole("article").filter({ has: page.getByText(label, { exact: true }) })
  await expect(metric).toHaveCount(1)
  await expect(metric.locator("strong")).toHaveText(value)
}
