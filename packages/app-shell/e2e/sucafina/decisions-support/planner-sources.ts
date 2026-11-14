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
  await line.getByLabel("Owner", { exact: true }).selectOption(actorId)
  await line.getByLabel("Element", { exact: true }).selectOption("licenses")
  await expect(line.getByLabel("Currency", { exact: true })).toHaveValue("USD")
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
  await expect(manager.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await manager.getByLabel("Annual budget", { exact: true }).fill("2400")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(page.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  observations.push({ stage: "planner-sources-created-through-ui", baselineVersion: baseline, candidateVersion: candidate,
    baselineAnnualInput: 1200, candidateAnnualInput: 2400, currency: "USD", year: 2027 })
  return { baseline, candidate }
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
