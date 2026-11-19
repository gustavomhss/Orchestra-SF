import { expect, test, type Locator, type Page, type Request, type Response } from "@playwright/test"
import { Schema } from "effect"
import { SfDomainPageCap18, SfDomainPageCap19, SfDomainPageCap23, SfPlannerMonthlyPreview, SfPlannerMonthlyApply } from "@orchestra/schema/sucafina/planner"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { startPlannerInstallation } from "./installation-fixture"

// The real local enrollment, CLI and durable store are exercised through the
// built shell. Never retain the original session cookie in browser traces.
test.use({ trace: "off" })

test("real mounted Planner preserves monthly edits, filters and official-version controls", async ({ page, browser }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  const planner = (name: "Versions" | "OPEX" | "CAPEX", version?: string) =>
    "/orchestra/sf-planner/" + ({ Versions: "versions", OPEX: "opex", CAPEX: "capex" }[name]) +
    (version ? "?" + new URLSearchParams({ year: "2027", version }) : "")
  const versionRow = (id: string) => page.locator('tr[data-sf-row="' + id + '"]')
  const api = (cap: string, query: Record<string, string> = {}) =>
    installation.origin + "/sucafina/api/ui/pages/" + cap + "?" + new URLSearchParams(query)
  const readVersions = async () => {
    const response = await page.request.get(api("CAP23"))
    expect(response.status()).toBe(200)
    const body = Schema.decodeUnknownSync(SfDomainPageCap23.output)(await response.json())
    if (body.status !== "ok") throw new Error("Authorized versions were not supplied")
    return body.value
  }
  const readOpex = async (version: string) => {
    const response = await page.request.get(api("CAP18", { year: "2027", version }))
    expect(response.status()).toBe(200)
    const body = Schema.decodeUnknownSync(SfDomainPageCap18.output)(await response.json())
    if (body.status !== "ok" || !body.value.data.grid) throw new Error("Authorized monthly grid was not supplied")
    return body.value
  }
  const readCapex = async (version: string, query: Record<string, string> = {}) => {
    const response = await page.request.get(api("CAP19", { year: "2027", version, ...query }))
    expect(response.status()).toBe(200)
    const body = Schema.decodeUnknownSync(SfDomainPageCap19.output)(await response.json())
    if (body.status !== "ok") throw new Error("Authorized CAPEX records were not supplied")
    return body.value
  }
  try {
    await test.step("enroll and create the fiscal version through original commands and authorized reads", async () => {
      await installation.signIn(page)
      await page.goto(planner("Versions"))
      await expect(page).toHaveURL(/\/orchestra\/sf-planner\/versions$/)
      await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
    })
    const beforeFirst = (await readVersions()).data.versions
    await page.goto("/orchestra/sf-planner/versions/new")
    await command(page, page.getByRole("button", { name: "Create first version", exact: true }), "save")
    const added = (await readVersions()).data.versions.filter((record) => !beforeFirst.some((old) => old.id === record.id))
    expect(added).toHaveLength(1)
    const createdVersion = added[0]!
    expect(createdVersion.id).toMatch(/\S+/)
    expect(createdVersion.name).toMatch(/\S+/)
    expect(Number.isInteger(createdVersion.year)).toBe(true)
    const versionId = createdVersion.id
    await expect(versionRow(versionId)).toHaveCount(1)
    await versionRow(versionId).locator('button[data-sf-action="select"]').click()
    await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(versionId))
    await expect(page.locator("#sf-u46-name")).toHaveValue(createdVersion.name)
    await page.locator("#sf-u46-name").fill("WP03 Browser Plan")
    await page.locator("#sf-u46-year").fill("2027")
    await command(page, page.getByRole("button", { name: "Save", exact: true }), "save")
    await page.goto(planner("Versions"))
    await expect(versionRow(versionId).getByRole("cell", { name: "WP03 Browser Plan", exact: true })).toBeVisible()

    await test.step("keep invalid pasted text, exclude that row from partial apply, correct both rows and reload", async () => {
      await page.goto(planner("OPEX", versionId))
      const firstId = await addLine(page, "OPEX", "WP03 License A", "1200", installation.actorId)
      const secondId = await addLine(page, "OPEX", "WP03 License B", "2400", installation.actorId)
      const monthly = monthlyEditor(page)
      const grid = monthly.getByRole("grid", { name: "Monthly values", exact: true })
      await expect(grid.locator(".sf-s02-row")).toHaveCount(2)
      const firstJanuary = monthlyCell(page, "WP03 License A", 1, "Forecast")
      await expect(firstJanuary.getByRole("button", { name: "Edit monthly value", exact: true })).toBeEnabled()
      await firstJanuary.click()
      await expect(grid).toBeFocused()
      await page.keyboard.press("ArrowRight")
      await expect(monthlyCell(page, "WP03 License A", 2, "Forecast")).toHaveAttribute("data-active", "true")
      await page.keyboard.press("ArrowLeft")
      await expect(firstJanuary).toHaveAttribute("data-active", "true")

      let applied = 0
      const countApply = (request: Request) => {
        if (monthlyRequest(request, "apply")) applied++
      }
      page.on("request", countApply)
      try {
        const original = await readOpex(versionId)
        const initialA = original.data.grid!.rows.find((row) => row.id === firstId)!
        const initialB = original.data.grid!.rows.find((row) => row.id === secondId)!
        expect(initialA).toBeDefined()
        expect(initialB).toBeDefined()
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: installation.origin })
        const invalid = await pasteMonthly(page, "0\t125\n75\tbad")
        expect(invalid.value.rows).toHaveLength(2)
        expect(invalid.value.rows[0]!.draft.rowId).toBe(firstId)
        expect(invalid.value.rows[0]!.errors).toEqual([])
        expect(invalid.value.rows[0]!.result?.ok).toBe(true)
        expect(invalid.value.rows[1]!.draft.rowId).toBe(secondId)
        expect(invalid.value.rows[1]!.errors.length).toBeGreaterThan(0)
        expect(invalid.value.rows[1]!.result?.ok).not.toBe(true)
        const preview = monthly.locator(".sf-s02-preview")
        await expect(preview.locator("pre")).toHaveText("0\t125\n75\tbad")
        await expect(preview.locator(".sf-s02-preview-row").nth(0)).toHaveAttribute("data-result", "ready")
        await expect(preview.locator(".sf-s02-preview-row").nth(1)).toHaveAttribute("data-result", "invalid")
        await expect(preview.locator("code")).toHaveText(["0", "125", "75", "bad"])
        expect(applied).toBe(0)
        const afterPreview = await readOpex(versionId)
        expect(afterPreview.data.grid!.rows).toEqual(original.data.grid!.rows)

        // S02 supports explicit partial apply. The invalid row must never enter
        // that command; the remaining raw text survives the valid-row commit.
        const partial = await applyMonthly(page)
        expect(partial.input.input.drafts.map((row) => row.rowId)).toEqual([firstId])
        expect(partial.value.rows).toHaveLength(1)
        expect(partial.value.rows[0]!.draft.rowId).toBe(firstId)
        expect(partial.value.rows[0]!.errors).toEqual([])
        expect(partial.value.rows[0]!.result?.ok).toBe(true)
        expect(applied).toBe(1)
        await expect(preview.locator(".sf-s02-preview-row").nth(0)).toHaveAttribute("data-result", "applied")
        await expect(preview.locator(".sf-s02-preview-row").nth(1)).toHaveAttribute("data-result", "invalid")
        await expect(preview.locator("pre")).toHaveText("0\t125\n75\tbad")
        await expect(monthly.getByRole("button", { name: "Apply reviewed rows", exact: true })).toBeDisabled()
        const afterPartial = await readOpex(versionId)
        const partialA = afterPartial.data.grid!.rows.find((row) => row.id === firstId)!
        const partialB = afterPartial.data.grid!.rows.find((row) => row.id === secondId)!
        expect(partialA.revision).toBeGreaterThan(initialA.revision)
        expect(partialA.cells.slice(0, 2).map((cell) => cell.forecast.stored)).toEqual([0, 125])
        expect(partialB).toEqual(initialB)

        await firstJanuary.click()
        const corrected = await pasteMonthly(page, "0\t125\n75\t150")
        expect(corrected.value.rows.map((row) => row.draft.rowId)).toEqual([firstId, secondId])
        expect(corrected.value.rows.every((row) => row.result?.ok && row.errors.length === 0)).toBe(true)
        await expect(preview.locator(".sf-s02-preview-row")).toHaveCount(2)
        for (let row = 0; row < 2; row++)
          await expect(preview.locator(".sf-s02-preview-row").nth(row)).toHaveAttribute("data-result", "ready")
        await expect(preview.locator("code")).toHaveText(["0", "125", "75", "150"])
        expect(applied).toBe(1)
        const saved = await applyMonthly(page)
        expect(saved.input.input.drafts.map((row) => row.rowId)).toEqual([firstId, secondId])
        expect(saved.value.rows).toHaveLength(2)
        expect(saved.value.rows.every((row) => row.result?.ok && row.errors.length === 0)).toBe(true)
        expect(applied).toBe(2)
        await expect(monthly.getByRole("status")).toContainText("The producer confirmed the applied rows.")
        await page.reload()
        const persisted = await readOpex(versionId)
        const savedA = persisted.data.grid!.rows.find((row) => row.id === firstId)!
        const savedB = persisted.data.grid!.rows.find((row) => row.id === secondId)!
        expect(savedA.revision).toBeGreaterThan(partialA.revision)
        expect(savedB.revision).toBeGreaterThan(initialB.revision)
        expect(savedA.cells.slice(0, 2).map((cell) => cell.forecast.stored)).toEqual([0, 125])
        expect(savedB.cells.slice(0, 2).map((cell) => cell.forecast.stored)).toEqual([75, 150])
        for (const [name, month, value] of [
          ["WP03 License A", 1, "0.00"], ["WP03 License A", 2, "125.00"],
          ["WP03 License B", 1, "75.00"], ["WP03 License B", 2, "150.00"],
        ] as const) {
          await expect(monthlyCell(page, name, month, "Forecast").locator(".sf-s02-cell-amount")).toHaveText(value)
          await expect(monthlyCell(page, name, month, "Forecast").locator(".sf-s02-cell-source")).toHaveCount(0)
        }
        expect(savedA.cells[0]!.forecast).toMatchObject({ value: 0, stored: 0, source: "explicit" })
        expect(savedB.cells[2]!.forecast).toMatchObject({ value: 200, stored: null, source: "inherited-budget" })
        await expect(monthlyCell(page, "WP03 License B", 3, "Forecast").locator(".sf-s02-cell-source")).toHaveText("Inherited value")
      } finally { page.off("request", countApply) }
    })

    await test.step("filter actual CAPEX rows by project owner, classification and normalized text", async () => {
      await page.goto(planner("CAPEX", versionId))
      const before = (await readCapex(versionId)).data.projects
      const form = page.locator("form[data-sf-create-project]")
      await form.getByLabel("Project name", { exact: true }).fill("WP03 Browser Project")
      await command(page, form.getByRole("button", { name: "Add project", exact: true }), "save")
      const projects = (await readCapex(versionId)).data.projects.filter((project) => !before.some((old) => old.id === project.id))
      expect(projects).toHaveLength(1)
      expect(projects[0]!.name).toBe("WP03 Browser Project")
      const projectId = projects[0]!.id
      expect(projectId).toMatch(/\S+/)
      await page.locator('button[data-sf-project="' + projectId + '"]').click()
      const detail = page.locator(".sf-u07-detail[data-sf-record-detail]")
      await expect(detail.getByRole("heading", { name: "WP03 Browser Project", exact: true })).toBeVisible()
      await detail.getByLabel("Owner", { exact: true }).fill(installation.actorId)
      await command(page, detail.getByRole("button", { name: "Review changes", exact: true }), "save")
      expect((await readCapex(versionId)).data.projects.find((project) => project.id === projectId)?.owner).toBe(installation.actorId)
      const asset = await addLine(page, "CAPEX", "WP03 Asset", "1200", "", projectId, "capex")
      await addLine(page, "CAPEX", "WP03 Service", "600", "", projectId, "opex")
      const filters = page.locator("form[data-sf-planner-filters]")
      await filters.getByLabel("Owner", { exact: true }).selectOption(installation.actorId)
      await filters.getByLabel("Class", { exact: true }).selectOption("capex")
      await filters.getByLabel("Search", { exact: true }).fill("  wp03 ASSET  ")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toBeVisible()
      await expect(page.getByRole("cell", { name: "WP03 Service", exact: true })).toHaveCount(0)
      await expect(monthlyEditor(page).getByRole("rowheader", { name: "WP03 Asset", exact: true })).toBeVisible()
      const filtered = await readCapex(versionId, { owner: installation.actorId, class: "capex", q: "  wp03 ASSET  " })
      expect(filtered.data.lines.map((line) => line.id)).toEqual([asset])
      await filters.getByLabel("Search", { exact: true }).fill("no matching planner record")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toHaveCount(0)
      await expect(monthlyEditor(page)).toHaveCount(0)
      await filters.getByLabel("Search", { exact: true }).fill("")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toBeVisible()
      await filters.getByRole("checkbox", { name: "Compare annual values", exact: true }).check()
      const comparison = page.locator("table[data-sf-planner-comparison]")
      await expect(comparison.getByRole("columnheader", { name: "Budget FY (USD)", exact: true })).toBeVisible()
      await expect(comparison.getByRole("columnheader", { name: "Outlook FY (USD)", exact: true })).toBeVisible()
      const source = await readCapex(versionId, { owner: installation.actorId, class: "capex", mode: "compare" })
      expect(source.data.lines).toHaveLength(1)
      expect(source.data.lines[0]).toMatchObject({ id: asset, budgetFY: 1200, outlookFY: 1200 })
      await expect(comparison.locator('tr[data-sf-comparison-row="' + asset + '"]').getByRole("cell")).toHaveText(["1200", "1200"])
    })

    await test.step("copy persisted forecast and protect the official plan", async () => {
      await page.goto(planner("Versions"))
      const before = (await readVersions()).data.versions
      await command(page, versionRow(versionId).getByRole("button", { name: "copy", exact: true }), "copy")
      const added = (await readVersions()).data.versions.filter((record) => !before.some((old) => old.id === record.id))
      expect(added).toHaveLength(1)
      const copy = added[0]!
      expect(copy.id).toMatch(/\S+/)
      expect(copy.id).not.toBe(versionId)
      expect(copy.name).toBe("WP03 Browser Plan — Copy")
      expect(copy.year).toBe(2027)
      await expect(versionRow(copy.id)).toBeVisible()
      await page.goto(planner("OPEX", copy.id))
      await expect(monthlyCell(page, "WP03 License A", 1, "Forecast").locator(".sf-s02-cell-amount")).toHaveText("0.00")
      await expect(monthlyCell(page, "WP03 License B", 2, "Forecast").locator(".sf-s02-cell-amount")).toHaveText("150.00")
      await page.goto(planner("Versions"))
      await command(page, versionRow(versionId).getByRole("button", { name: "official", exact: true }), "official")
      await page.reload()
      await expect(versionRow(versionId).getByRole("cell", { name: "Official", exact: true })).toBeVisible()
      await expect(versionRow(versionId).getByRole("button", { name: "delete", exact: true })).toBeDisabled()
      await expect(versionRow(versionId).getByRole("button", { name: "unlock", exact: true })).toBeDisabled()
      await versionRow(versionId).locator('button[data-sf-action="select"]').click()
      await expect(page.locator("#sf-u46-year")).toBeDisabled()
      await page.goto(planner("OPEX", versionId))
      const budget = monthlyCell(page, "WP03 License A", 1, "Budget")
      await expect(budget.getByRole("button", { name: "Edit monthly value", exact: true })).toHaveCount(0)
      const forecast = monthlyCell(page, "WP03 License A", 1, "Forecast")
      await expect(forecast.getByRole("button", { name: "Edit monthly value", exact: true })).toBeEnabled()
      await expect(forecast.locator(".sf-s02-cell-amount")).toHaveText("0.00")
      const protectedPlan = await readOpex(versionId)
      expect(protectedPlan.data.selectedVersion).toMatchObject({ id: versionId, official: true, locked: true })
      const license = protectedPlan.data.grid!.rows.find((row) => row.label === "WP03 License A")!
      expect(license.cells[0]!.budget.editable).toBe(false)
      expect(license.cells[0]!.forecast).toMatchObject({ editable: true, stored: 0 })
    })

    await test.step("deny a separate anonymous browser read and write", async () => {
      const anonymous = await browser.newContext()
      try {
        const read = await anonymous.request.get(api("CAP18", { year: "2027", version: versionId }))
        expect(read.status()).toBe(401)
        expect(await read.json()).toEqual({ status: "unauthenticated" })
        const write = await anonymous.request.post(installation.origin + "/sucafina/planner?page=Versions", {
          headers: { origin: installation.origin },
          data: { page: "Versions", action: "delete", id: versionId, version: 0, values: {}, confirmed: true },
        })
        expect(write.status()).toBe(403)
      } finally { await anonymous.close() }
      await page.goto(planner("Versions"))
      await expect(versionRow(versionId).getByRole("cell", { name: "Official", exact: true })).toBeVisible()
    })
    expect(pageErrors).toEqual([])
    await info.attach("wp03-planner-official.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  } finally { await installation.stop() }
})

function monthlyEditor(page: Page) {
  return page.locator(".sf-u07 section.sf-s02")
}
function monthlyCell(page: Page, name: string, month: number, measure: "Budget" | "Forecast") {
  return monthlyEditor(page).locator(".sf-s02-row")
    .filter({ has: page.getByRole("rowheader", { name, exact: true }) })
    .getByRole("gridcell").nth(month - 1).locator(".sf-s02-measure")
    .filter({ has: page.getByText(measure, { exact: true }) })
}
async function responseBody(response: Response) {
  expect(response.status()).toBe(200)
  expect(await response.finished()).toBeNull()
  expect(response.request().failure()).toBeNull()
  return response.json()
}
async function command(page: Page, button: Locator, action: string) {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/sucafina/planner" && !new URL(response.url()).searchParams.has("sf") &&
    response.request().postDataJSON()?.action === action)
  await button.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const confirm = review.getByRole("button", { name: /^(Confirm|Review changes)$/ })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  const body = await responseBody(await pending) as { ok: boolean }
  expect(body.ok).toBe(true)
  await expect(review).toHaveCount(0)
}
function monthlyRequest(request: Request, action: "preview" | "apply") {
  return request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === "workbench-planner" &&
    request.postDataJSON()?.action === action
}
async function pasteMonthly(page: Page, text: string) {
  const grid = monthlyEditor(page).getByRole("grid", { name: "Monthly values", exact: true })
  await page.evaluate((value) => navigator.clipboard.writeText(value), text)
  const pending = page.waitForResponse((response) => monthlyRequest(response.request(), "preview"))
  await grid.focus()
  await page.keyboard.press("Control+V")
  const body = Schema.decodeUnknownSync(Schema.toType(SfPlannerMonthlyPreview.output))(await responseBody(await pending))
  if (body.status !== "ok") throw new Error("The original monthly preview was unavailable")
  return body
}
async function applyMonthly(page: Page) {
  const pending = page.waitForResponse((response) => monthlyRequest(response.request(), "apply"))
  await monthlyEditor(page).getByRole("button", { name: "Apply reviewed rows", exact: true }).click()
  const response = await pending
  const input = Schema.decodeUnknownSync(SfPlannerMonthlyApply.input)(response.request().postDataJSON())
  const body = Schema.decodeUnknownSync(Schema.toType(SfPlannerMonthlyApply.output))(await responseBody(response))
  if (body.status !== "ok") throw new Error("The original monthly apply was unavailable")
  return { input, value: body.value }
}
async function addLine(page: Page, surface: "OPEX" | "CAPEX", name: string, annual: string, owner: string, project?: string, classification?: string) {
  const form = page.locator('form[data-page="' + surface + '"][data-command="save"][data-record=""]')
  await form.getByLabel("Name", { exact: true }).fill(name)
  await form.getByLabel("Owner", { exact: true }).selectOption(owner)
  await form.getByLabel("Element", { exact: true }).selectOption("licenses")
  await form.getByLabel("Annual budget", { exact: true }).fill(annual)
  if (project) await form.getByLabel("Project", { exact: true }).selectOption(project)
  if (classification) await form.getByLabel("Class", { exact: true }).selectOption(classification)
  await command(page, form.getByRole("button", { name: "Save", exact: true }), "save")
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toBeVisible()
  const id = await row.getAttribute("data-sf-row")
  if (!id) throw new Error("The created Planner line has no authorized identity")
  return id
}
