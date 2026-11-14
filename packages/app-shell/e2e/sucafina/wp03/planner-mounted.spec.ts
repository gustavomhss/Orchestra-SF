import { expect, test, type Locator, type Page } from "@playwright/test"
import { startPlannerInstallation } from "./installation-fixture"

// This journey creates a real operator session. Keep request/cookie data out of
// retained traces; the report, redacted CLI log and UI screenshot provide evidence.
test.use({ trace: "off" })

// The application under test is the existing CLI installation. The production
// Playwright config still serves the built shell; this journey uses the module's
// own mounted URL. No responses, HTML, authority handlers or domain code are mocked.
test("real mounted Planner preserves monthly edits, filters and official-version controls", async ({ page, browser }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  const planner = (name: string, version?: string, mode?: string) => `${installation.origin}/sucafina/planner?${new URLSearchParams({ page: name, ...(version ? { version } : {}), ...(mode ? { mode } : {}) })}`
  const versionRow = (id: string) => page.getByRole("row").filter({ has: page.locator(`form[data-page="Versions"][data-command="save"][data-record="${id}"]`) })
  try {
    await test.step("enroll through the production local identity and create the fiscal version", async () => {
      await page.context().addCookies([installation.cookie])
      await page.goto(`${installation.origin}/sucafina/dashboard`)
      await expect(page).toHaveURL(`${installation.origin}/sucafina/dashboard`)
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
    })

    await page.goto(planner("Versions"))
    const first = await command(page, page.getByRole("button", { name: "Create first version", exact: true }), "save")
    expect(typeof first.value).toBe("string")
    const versionId = first.value as string
    await expect(versionRow(versionId)).toBeVisible()
    await versionRow(versionId).getByRole("button", { name: "Manage", exact: true }).click()
    const versionEditor = page.getByRole("dialog", { name: "Manage record", exact: true })
    await versionEditor.getByLabel("Name", { exact: true }).fill("WP03 Browser Plan")
    await versionEditor.getByLabel("Year", { exact: true }).fill("2027")
    await command(page, versionEditor.getByRole("button", { name: "Save", exact: true }), "save")
    await expect(versionRow(versionId).getByRole("cell", { name: "WP03 Browser Plan", exact: true })).toBeVisible()

    await test.step("preview invalid pasted cells, correct them, save both rows and reload", async () => {
      await page.goto(planner("OPEX", versionId, "forecast"))
      await addLine(page, "OPEX", "WP03 License A", "1200", installation.actorId)
      await addLine(page, "OPEX", "WP03 License B", "2400", installation.actorId)
      const editor = monthlyEditor(page)
      await expect(editor).toHaveCount(1)
      await editor.getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
      const cell = (name: string, month: number) => editor.getByRole("textbox", { name: `licenses · ${name} forecast month ${month}`, exact: true })
      await expect(cell("WP03 License A", 1)).toBeEditable()
      await cell("WP03 License A", 1).focus()
      await page.keyboard.press("Tab")
      await expect(cell("WP03 License A", 2)).toBeFocused()
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: installation.origin })
      await page.evaluate(() => navigator.clipboard.writeText("0\t125\n75\tbad"))
      await cell("WP03 License A", 1).focus()
      await page.keyboard.press("Control+V")
      await expect(cell("WP03 License A", 1)).toHaveValue("0")
      await expect(cell("WP03 License A", 2)).toHaveValue("125")
      await expect(cell("WP03 License B", 1)).toHaveValue("75")
      await expect(cell("WP03 License B", 2)).toHaveValue("bad")
      await monthlyCommand(page, editor.getByRole("button", { name: "Preview changes", exact: true }), "preview")
      await expect(editor.getByRole("status")).toContainText("Some rows need attention")
      await expect(cell("WP03 License B", 2)).toHaveAttribute("aria-invalid", "true")
      await expect(editor.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
      await expect(cell("WP03 License A", 1)).toHaveValue("0")
      await cell("WP03 License B", 2).fill("150")
      await monthlyCommand(page, editor.getByRole("button", { name: "Preview changes", exact: true }), "preview")
      await expect(editor.getByRole("status")).toContainText("Preview complete")
      const saved = await monthlyCommand(page, editor.getByRole("button", { name: "Save changes", exact: true }), "apply")
      expect(saved.value.rows).toHaveLength(2)
      expect(saved.value.rows.every((row) => row.result?.ok && row.errors.length === 0)).toBe(true)
      await expect(editor.getByRole("status")).toContainText("Changes saved")
      await page.reload()
      await monthlyEditor(page).getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
      await expect(cell("WP03 License A", 1)).toHaveValue("0")
      await expect(cell("WP03 License A", 2)).toHaveValue("125")
      await expect(cell("WP03 License B", 1)).toHaveValue("75")
      await expect(cell("WP03 License B", 2)).toHaveValue("150")
      await page.getByText("OPEX forecast · WP03 Browser Plan · 2027 — saved monthly values", { exact: true }).click()
      const savedGrid = page.getByRole("region", { name: "OPEX forecast · WP03 Browser Plan · 2027", exact: true })
      await expect(savedGrid.getByRole("row").filter({ has: savedGrid.getByRole("rowheader", { name: "WP03 License A · USD", exact: true }) })).toContainText("Explicit zero")
      await expect(savedGrid.getByRole("row").filter({ has: savedGrid.getByRole("rowheader", { name: "WP03 License B · USD", exact: true }) })).toContainText("Inherited budget")
    })

    await test.step("filter actual CAPEX rows by project owner, classification and normalized text", async () => {
      await page.goto(planner("CAPEX", versionId, "forecast"))
      const addProject = page.locator('form[data-page="CAPEX"][data-command="save"][data-record=""]').filter({ has: page.getByLabel("Project name", { exact: true }) })
      await addProject.getByLabel("Project name", { exact: true }).fill("WP03 Browser Project")
      const created = await command(page, addProject.getByRole("button", { name: "Add project", exact: true }), "save")
      expect(typeof created.value).toBe("string")
      const projectId = created.value as string
      const projectRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "WP03 Browser Project", exact: true }) })
      await projectRow.getByRole("button", { name: "Manage", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: "Manage record", exact: true })
      await dialog.getByLabel("Owner", { exact: true }).selectOption(installation.actorId)
      await command(page, dialog.getByRole("button", { name: "Save", exact: true }), "save")
      await addLine(page, "CAPEX", "WP03 Asset", "1200", "", projectId, "capex")
      await addLine(page, "CAPEX", "WP03 Service", "600", "", projectId, "opex")
      const filters = page.locator('form[method="get"]').filter({ has: page.getByRole("button", { name: "Filter", exact: true }) })
      await filters.getByLabel("Owner", { exact: true }).selectOption(installation.actorId)
      await filters.getByLabel("Classification", { exact: true }).selectOption("capex")
      await filters.getByLabel("Search", { exact: true }).fill("  wp03 ASSET  ")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toBeVisible()
      await expect(page.getByRole("cell", { name: "WP03 Service", exact: true })).toHaveCount(0)
      await expect(monthlyEditor(page).getByRole("rowheader", { name: "licenses · WP03 Asset", exact: true })).toBeVisible()
      await filters.getByLabel("Search", { exact: true }).fill("no matching planner record")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toHaveCount(0)
      await expect(monthlyEditor(page)).toHaveCount(0)
      await filters.getByLabel("Search", { exact: true }).fill("")
      await filters.getByRole("button", { name: "Filter", exact: true }).click()
      await expect(page.getByRole("cell", { name: "WP03 Asset", exact: true })).toBeVisible()
      await page.getByLabel("Grid", { exact: true }).selectOption("compare")
      await page.getByRole("button", { name: "Show grid", exact: true }).click()
      await expect(page.getByRole("columnheader", { name: "Budget FY", exact: true })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Outlook FY", exact: true })).toBeVisible()
    })

    await test.step("copy persisted forecast and protect the official plan", async () => {
      await page.goto(planner("Versions"))
      await versionRow(versionId).getByRole("button", { name: "Manage", exact: true }).click()
      const copy = await command(page, page.getByRole("dialog", { name: "Manage record", exact: true }).getByRole("button", { name: "copy", exact: true }), "copy")
      expect(typeof copy.value).toBe("string")
      const copyId = copy.value as string
      await expect(versionRow(copyId)).toBeVisible()
      await page.goto(planner("OPEX", copyId, "forecast"))
      await monthlyEditor(page).getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
      await expect(monthlyEditor(page).getByRole("textbox", { name: "licenses · WP03 License A forecast month 1", exact: true })).toHaveValue("0")
      await expect(monthlyEditor(page).getByRole("textbox", { name: "licenses · WP03 License B forecast month 2", exact: true })).toHaveValue("150")
      await page.goto(planner("Versions"))
      await versionRow(versionId).getByRole("button", { name: "Manage", exact: true }).click()
      await command(page, page.getByRole("dialog", { name: "Manage record", exact: true }).getByRole("button", { name: "official", exact: true }), "official")
      await page.reload()
      await expect(versionRow(versionId).getByRole("cell", { name: "Official", exact: true })).toBeVisible()
      await versionRow(versionId).getByRole("button", { name: "Manage", exact: true }).click()
      const official = page.getByRole("dialog", { name: "Manage record", exact: true })
      await expect(official.getByRole("button", { name: "delete", exact: true })).toBeDisabled()
      await expect(official.getByRole("button", { name: "unlock", exact: true })).toBeDisabled()
      await expect(official.getByLabel("Year", { exact: true })).toBeDisabled()
      await official.getByRole("button", { name: "Close editor", exact: true }).click()
      await page.goto(planner("OPEX", versionId, "forecast"))
      await monthlyEditor(page).getByRole("combobox", { name: "Measure", exact: true }).selectOption("budget")
      await expect(monthlyEditor(page).getByRole("textbox", { name: "licenses · WP03 License A budget month 1", exact: true })).toBeDisabled()
      await monthlyEditor(page).getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
      await expect(monthlyEditor(page).getByRole("textbox", { name: "licenses · WP03 License A forecast month 1", exact: true })).toBeEditable()
      await expect(monthlyEditor(page).getByRole("textbox", { name: "licenses · WP03 License A forecast month 1", exact: true })).toHaveValue("0")
    })

    await test.step("deny a separate anonymous browser read and write", async () => {
      const anonymous = await browser.newContext()
      try {
        const read = await anonymous.request.get(planner("OPEX", versionId), { maxRedirects: 0 })
        expect(read.status()).toBe(303)
        expect(read.headers().location).toContain("/sucafina/auth/login")
        const write = await anonymous.request.post(planner("Versions"), {
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
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "Edit monthly values together", exact: true }) })
}

async function command(page: Page, button: Locator, action: string) {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/sucafina/planner" && response.request().postDataJSON()?.action === action)
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  const body = await response.json() as { ok: boolean; value?: unknown }
  expect(body.ok).toBe(true)
  return body
}

async function monthlyCommand(page: Page, button: Locator, action: "preview" | "apply") {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "workbench-planner" && response.request().postDataJSON()?.action === action)
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: { rows: { errors: unknown[]; result?: { ok: boolean } }[] } }
  expect(body.status).toBe("ok")
  return body
}

async function addLine(page: Page, surface: "OPEX" | "CAPEX", name: string, annual: string, owner: string, project?: string, classification?: string) {
  const form = page.locator(`form[data-page="${surface}"][data-command="save"][data-record=""]`).filter({ has: page.getByLabel("Name", { exact: true }) })
  await form.getByLabel("Name", { exact: true }).fill(name)
  await form.getByLabel("Owner", { exact: true }).selectOption(owner)
  await form.getByLabel("Element", { exact: true }).selectOption("licenses")
  await form.getByLabel("Annual budget", { exact: true }).fill(annual)
  if (project) await form.getByLabel("Project", { exact: true }).selectOption(project)
  if (classification) await form.getByLabel("Classification", { exact: true }).selectOption(classification)
  await command(page, form.getByRole("button", { name: "Save", exact: true }), "save")
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible()
}
