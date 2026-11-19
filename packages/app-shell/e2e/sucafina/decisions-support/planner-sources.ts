import { expect, type Locator, type Page } from "@playwright/test"
import { asRecord } from "./journey"

export const sourceNames = { baseline: "Decisions baseline plan", candidate: "Decisions candidate plan", line: "Decision annual service" }

/** Build the financial source records through the installed Planner controls. */
export async function createPlannerSources(page: Page, origin: string, actorId: string, observations: Record<string, unknown>[]) {
  const planner = (name: string, version?: string) => {
    const path = name === "OPEX" ? "/orchestra/sf-planner/opex" : "/orchestra/sf-planner/versions"
    if (!version) return path
    return `${path}?${new URLSearchParams({ version })}`
  }
  const versionRow = (id: string) => page.locator(`tr[data-sf-row="${id}"]`)
  const detail = page.locator("[data-sf-record-detail]")
  const installed = await page.goto("/orchestra/sf-planner/versions/new")
  expect(installed?.status(), "Original Planner Versions route must be installed").toBe(200)
  await expect(page.getByRole("heading", { name: "Versions", exact: true })).toBeVisible()
  await confirmVersion(page, page.locator('[data-sf-surface="CAP23"]').getByRole("button", { name: "Create first version", exact: true }), "save", observations)
  await expect(detail).toHaveCount(1)
  const baseline = await versionIdentity(detail)
  const name = detail.locator("#sf-u46-name")
  const year = detail.locator("#sf-u46-year")
  await expect(name).toBeEnabled()
  await name.fill(sourceNames.baseline)
  await expect(year).toBeEnabled()
  await year.fill("2027")
  await confirmVersion(page, detail.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(detail.getByRole("heading", { name: sourceNames.baseline, exact: true })).toBeVisible()
  await expect(detail.locator('[data-sf-field="year"]')).toContainText("2027")
  await detail.getByRole("button", { name: "Back", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-planner/versions" && url.searchParams.get("year") === "2027")
  await expect(versionRow(baseline)).toHaveCount(1)
  await expect(versionRow(baseline).locator(".sf-s01-cell-value")).toHaveText(sourceNames.baseline)
  await expect(versionRow(baseline).getByRole("cell").nth(1)).toHaveText("2027")

  expect((await page.goto(planner("OPEX", baseline)))?.status(), "Original OPEX route must be installed").toBe(200)
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

  expect((await page.goto("/orchestra/sf-planner/versions?year=2027"))?.status(), "Original Planner Versions route must remain admitted").toBe(200)
  await versionRow(baseline).getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  await confirmVersion(page, detail.getByRole("button", { name: "copy", exact: true }), "copy", observations)
  const copiedName = `${sourceNames.baseline} — Copy`
  await expect(detail.getByRole("heading", { name: copiedName, exact: true })).toBeVisible()
  const candidate = await versionIdentity(detail)
  expect(candidate).not.toBe(baseline)
  await expect(detail.locator('[data-sf-field="year"]')).toContainText("2027")
  await expect(detail.locator("#sf-u46-name")).toBeEnabled()
  await detail.locator("#sf-u46-name").fill(sourceNames.candidate)
  await confirmVersion(page, detail.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(detail.getByRole("heading", { name: sourceNames.candidate, exact: true })).toBeVisible()
  expect(await versionIdentity(detail)).toBe(candidate)
  await detail.getByRole("button", { name: "Back", exact: true }).click()
  await expect(versionRow(candidate)).toHaveCount(1)
  await expect(versionRow(candidate).locator(".sf-s01-cell-value")).toHaveText(sourceNames.candidate)
  await expect(versionRow(candidate).getByRole("cell").nth(1)).toHaveText("2027")
  expect((await page.goto(planner("OPEX", candidate)))?.status(), "Original candidate OPEX route must be installed").toBe(200)
  const copiedLine = page.getByRole("row").filter({ has: page.getByRole("cell", { name: sourceNames.line, exact: true }) })
  await expect(copiedLine).toHaveCount(1)
  await copiedLine.getByRole("button", { name: "Manage", exact: true }).click()
  const manager = page.getByRole("dialog", { name: "Manage record", exact: true })
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
  await page.goto(`/orchestra/sf-planner/opex?${new URLSearchParams({ version: versionId })}`)
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

async function confirmVersion(page: Page, opener: Locator, action: string, observations: Record<string, unknown>[]) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  await expect(confirm).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/sucafina/planner" && response.request().postDataJSON()?.action === action)
  await confirm.click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = asRecord(await response.json())
  expect(result.ok).toBe(true)
  observations.push({ stage: "planner-human-command", action, httpStatus: response.status(), ok: result.ok })
  return result
}

async function versionIdentity(detail: Locator) {
  const id = detail.locator("p.sf-s01-secondary bdi")
  await expect(id).toHaveText(/\S+/)
  return (await id.innerText()).trim()
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
