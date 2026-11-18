import { expect, type Locator, type Page } from "@playwright/test"
import { asRecord } from "./journey"

export const sourceNames = { baseline: "Decisions baseline plan", candidate: "Decisions candidate plan", line: "Decision annual service" }

/** Build the financial source records through the installed Planner controls. */
export async function createPlannerSources(page: Page, origin: string, actorId: string, observations: Record<string, unknown>[]) {
  const planner = (name: string, version?: string) => `${origin}/sucafina/planner?${new URLSearchParams({ page: name, ...(version ? { version } : {}) })}`
  const versionRow = (id: string) => page.getByRole("row").filter({ has: page.locator(`form[data-page="Versions"][data-command="save"][data-record="${id}"]`) })
  await page.goto(planner("Versions"))
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
  await expect(versionRow(baseline).getByRole("cell", { name: sourceNames.baseline, exact: true })).toBeVisible()

  await page.goto(planner("OPEX", baseline))
  const line = page.locator('form[data-page="OPEX"][data-command="save"][data-record=""]').filter({ has: page.getByLabel("Name", { exact: true }) })
  await expect(line).toHaveCount(1)
  await line.getByLabel("Name", { exact: true }).fill(sourceNames.line)
  // Native select option text participates in the enclosing label's name.
  // Require the actual submitted controls and their contract values.
  const owner = line.locator('select[name="owner"]')
  await expect(owner).toHaveCount(1)
  await expect(owner.locator(`option[value="${actorId}"]`)).toHaveCount(1)
  observations.push({ stage: "trace-owner-before", url: receiptUrl(page.url()), ownerCount: await page.locator('select[name="owner"]').count(),
    options: await owner.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ value: (node as HTMLOptionElement).value, label: node.textContent ?? null, disabled: (node as HTMLOptionElement).disabled }))) })
  try {
    await owner.selectOption(actorId)
  } catch (error) {
    observations.push({ stage: "trace-owner-stall", url: receiptUrl(page.url()), actorId, ownerHtml: await owner.evaluate((node) => node.outerHTML).catch(() => null),
      formHtml: await line.evaluate((node) => node.outerHTML).catch(() => null),
      ownerValues: await page.locator('select[name="owner"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLSelectElement).value)) })
    throw error
  }
  const element = line.locator('select[name="el"]')
  await expect(element).toHaveCount(1)
  await element.selectOption("licenses")
  const currency = line.locator('select[name="cur"]')
  await expect(currency).toHaveCount(1)
  await expect(currency).toHaveValue("USD")
  await line.getByLabel("Annual budget", { exact: true }).fill("1200")
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
  await expect(manager.locator('select[name="cur"]')).toHaveValue("USD")
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
  await expect(manager.locator('select[name="cur"]')).toHaveValue("USD")
  await manager.getByLabel("Annual budget", { exact: true }).fill(String(annualBudget))
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(page.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  await row.getByRole("button", { name: "Manage", exact: true }).click()
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue(String(annualBudget))
  observations.push({ stage: "planner-source-revised-through-ui", versionId, previousAnnualInput: 2400, annualInput: annualBudget, currency: "USD" })
}

function receiptUrl(value: string) {
  return value.replace(/([?&]code=)[^&\s]*/gi, "$1redacted")
}

async function plannerCommand(page: Page, button: Locator, action: string, observations: Record<string, unknown>[]) {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/sucafina/planner" && response.request().postDataJSON()?.action === action)
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = asRecord(await response.json())
  expect(result.ok).toBe(true)
  observations.push({ stage: "planner-human-command", action, httpStatus: response.status(), ok: result.ok })
  return result
}
