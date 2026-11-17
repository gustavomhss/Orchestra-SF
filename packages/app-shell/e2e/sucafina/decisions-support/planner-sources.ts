import { expect, type Locator, type Page } from "@playwright/test"
import { asRecord } from "./journey"

export const sourceNames = { baseline: "Decisions baseline plan", candidate: "Decisions candidate plan", line: "Decision annual service" }

/** Build the financial source records through the installed Planner controls. */
export async function createPlannerSources(page: Page, origin: string, actorId: string, observations: Record<string, unknown>[]) {
  const planner = (name: string, version?: string) => `${origin}/sucafina/planner?${new URLSearchParams({ page: name, ...(version ? { version } : {}) })}`
  const versionRow = (id: string) => page.getByRole("row").filter({ has: page.locator(`form[data-page="Versions"][data-command="save"][data-record="${id}"]`) })
  console.log("[sf decisions:planner] opening Versions")
  await page.goto(planner("Versions"))
  console.log("[sf decisions:planner] Versions open")
  await plannerCommand(page, page.getByRole("button", { name: "Create first version", exact: true }), "save", observations)
  // Normal runtime replies omit business values; observe the authorized refreshed UI.
  const first = page.locator('form[data-page="Versions"][data-command="save"]:not([data-record=""])')
  await expect(first).toHaveCount(1)
  await expect(first).toHaveAttribute("data-record", /\S+/)
  const baseline = (await first.getAttribute("data-record"))!
  await expect(versionRow(baseline)).toHaveCount(1)
  await versionRow(baseline).getByRole("button", { name: "Manage", exact: true }).click()
  const manager = page.getByRole("dialog", { name: "Manage record", exact: true })
  await manager.getByLabel("Name", { exact: true }).fill(sourceNames.baseline)
  await manager.getByLabel("Year", { exact: true }).fill("2027")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  console.log("[sf decisions:planner] verifying renamed baseline in Versions")
  await expect(versionRow(baseline).getByRole("cell", { name: sourceNames.baseline, exact: true })).toBeVisible()
  console.log("[sf decisions:planner] renamed baseline visible; opening OPEX")
  page.on("response", (response) => {
    const url = new URL(response.url())
    if (url.pathname === "/sucafina/planner") console.log(`[sf decisions:planner] RESPONSE ${response.request().method()} ${url.search} status=${response.status()}`)
  })
  page.on("pageerror", (error) => console.log(`[sf decisions:planner] PAGE ERROR ${error.message}`))
  const opexResponse = await page.goto(planner("OPEX", baseline))
  console.log(`[sf decisions:planner] OPEX navigated status=${opexResponse?.status()}`)
  const line = page.locator('form[data-page="OPEX"][data-command="save"][data-record=""]').filter({ has: page.getByLabel("Name", { exact: true }) })
  console.log("[sf decisions:planner] expecting OPEX add-line form")
  await expect(line).toHaveCount(1)
  console.log("[sf decisions:planner] OPEX add-line form ready")
  console.log(`[sf decisions:planner] new-line disabled=${await line.getByRole("button", { name: "Save", exact: true }).isDisabled()}`)
  console.log("[sf decisions:planner] filling new OPEX Name")
  await line.getByLabel("Name", { exact: true }).fill(sourceNames.line)
  console.log("[sf decisions:planner] Name filled")
  const ownerControl = line.getByLabel("Owner", { exact: true })
  const ownerOptions = await ownerControl.locator("option").evaluateAll((options) => options.map((option) => option.getAttribute("value") ?? ""))
  console.log(`[sf decisions:planner] Owner options count=${ownerOptions.length} includesOperator=${ownerOptions.includes(actorId)}`)
  console.log(`[sf decisions:planner] ownerLocatorCount=${await ownerControl.count()}, directNamedSelectCount=${await line.locator('select[name="owner"]').count()}, fields=${(await line.locator("label").allTextContents()).map((label) => label.trim()).join(" | ")}`)
  await expect(ownerControl).toHaveCount(1)
  await expect(ownerControl.locator("option").filter({ hasText: actorId })).toHaveCount(1)
  await ownerControl.selectOption(actorId)
  console.log("[sf decisions:planner] Owner selected; selecting Element")
  await line.getByLabel("Element", { exact: true }).selectOption("licenses")
  console.log("[sf decisions:planner] Element selected; checking Currency")
  await expect(line.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  console.log("[sf decisions:planner] Currency valid; filling Annual budget")
  await line.getByLabel("Annual budget", { exact: true }).fill("1200")
  console.log("[sf decisions:planner] Annual budget filled")
  await plannerCommand(page, line.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(page.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()

  await page.goto(planner("Versions"))
  await versionRow(baseline).getByRole("button", { name: "Manage", exact: true }).click()
  await plannerCommand(page, manager.getByRole("button", { name: "copy", exact: true }), "copy", observations)
  const copiedRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: `${sourceNames.baseline} — Copy`, exact: true }) })
  await expect(copiedRow).toHaveCount(1)
  const copied = copiedRow.locator('form[data-page="Versions"][data-command="save"]')
  await expect(copied).toHaveAttribute("data-record", /\S+/)
  const candidate = (await copied.getAttribute("data-record"))!
  expect(candidate).not.toBe(baseline)
  await expect(versionRow(candidate)).toHaveCount(1)
  await versionRow(candidate).getByRole("button", { name: "Manage", exact: true }).click()
  await manager.getByLabel("Name", { exact: true }).fill(sourceNames.candidate)
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(versionRow(candidate).getByRole("cell", { name: sourceNames.candidate, exact: true })).toBeVisible()
  await page.goto(planner("OPEX", candidate))
  const copiedLine = page.getByRole("row").filter({ has: page.getByRole("cell", { name: sourceNames.line, exact: true }) })
  await expect(copiedLine).toHaveCount(1)
  await copiedLine.getByRole("button", { name: "Manage", exact: true }).click()
  await expect(manager.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await manager.getByLabel("Annual budget", { exact: true }).fill("2400")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(page.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  observations.push({ stage: "planner-sources-created-through-ui", baselineVersion: baseline, candidateVersion: candidate,
    baselineAnnualInput: 1200, candidateAnnualInput: 2400, currency: "USD", year: 2027 })
  return { baseline, candidate }
}

/** A real source revision, independent of the saved ChoiceRecord. */
export async function changePlannerSource(page: Page, origin: string, versionId: string, annualBudget: number, observations: Record<string, unknown>[]) {
  await page.goto(`${origin}/sucafina/planner?${new URLSearchParams({ page: "OPEX", version: versionId })}`)
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: sourceNames.line, exact: true }) })
  await expect(row).toHaveCount(1)
  await row.getByRole("button", { name: "Manage", exact: true }).click()
  const manager = page.getByRole("dialog", { name: "Manage record", exact: true })
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue("2400")
  await expect(manager.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await manager.getByLabel("Annual budget", { exact: true }).fill(String(annualBudget))
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(page.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  await row.getByRole("button", { name: "Manage", exact: true }).click()
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue(String(annualBudget))
  observations.push({ stage: "planner-source-revised-through-ui", versionId, previousAnnualInput: 2400, annualInput: annualBudget, currency: "USD" })
}

async function plannerCommand(page: Page, button: Locator, action: string, observations: Record<string, unknown>[]) {
  const location = new URL(page.url())
  console.log(`[sf decisions:planner] awaiting enabled ${action} ${location.pathname} page=${location.searchParams.get("page")} button=${(await button.innerText()).trim()}`)
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/sucafina/planner" && response.request().postDataJSON()?.action === action)
  await button.click()
  console.log(`[sf decisions:planner] clicked ${action}; awaiting POST`)
  const response = await pending
  console.log(`[sf decisions:planner] POST ${action} status=${response.status()} content-type=${response.headers()["content-type"]}`)
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = asRecord(await response.json())
  expect(result.ok).toBe(true)
  observations.push({ stage: "planner-human-command", action, httpStatus: response.status(), ok: result.ok })
  return result
}
