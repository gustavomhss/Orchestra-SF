import { expect, type Locator, type Page, type Route } from "@playwright/test"
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
  const versionRows = page.locator('[data-sf-surface="CAP23"] tr[data-sf-row]')
  const detail = page.locator("[data-sf-record-detail]")
  const installed = await page.goto("/orchestra/sf-planner/versions/new")
  expect(installed?.status(), "Original Planner Versions route must be installed").toBe(200)
  await expect(page.getByRole("heading", { name: "Versions", exact: true })).toBeVisible()
  await confirmVersion(page, origin, page.locator('[data-sf-surface="CAP23"]').getByRole("button", { name: "Create first version", exact: true }), "save", observations)
  // This journey starts with a private, empty installation. The command
  // acknowledges creation; the fresh authorized list supplies the identity.
  await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === "/orchestra/sf-planner/versions")
  await expect(versionRows).toHaveCount(1)
  await expect(versionRows).toHaveAttribute("data-sf-row", /\S+/)
  const createdBaseline = (await versionRows.getAttribute("data-sf-row"))!
  await versionRows.getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  const baseline = await versionIdentity(detail)
  expect(baseline).toBe(createdBaseline)
  const versionName = detail.locator("#sf-u46-name")
  const year = detail.locator("#sf-u46-year")
  await expect(versionName).toBeEnabled()
  await versionName.fill(sourceNames.baseline)
  await expect(year).toBeEnabled()
  await year.fill("2027")
  await confirmVersion(page, origin, detail.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(detail.getByRole("heading", { name: sourceNames.baseline, exact: true })).toBeVisible()
  await expect(detail.locator('[data-sf-field="year"] dd')).toHaveText(/^2,?027 Year$/)
  await detail.getByRole("button", { name: "Back", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-planner/versions" && url.searchParams.get("year") === "2027")
  await expect(versionRow(baseline)).toHaveCount(1)
  await expect(versionRow(baseline).locator(".sf-s01-cell-value")).toHaveText(sourceNames.baseline)
  await expect(versionRow(baseline).getByRole("cell").nth(1)).toHaveText("2027")

  expect((await page.goto(planner("OPEX", baseline)))?.status(), "Original OPEX route must be installed").toBe(200)
  const budget = page.locator('[data-sf-surface="CAP18"]')
  await expect(budget).toHaveCount(1)
  const name = budget.getByRole("textbox", { name: "Name", exact: true })
  await expect(name).toHaveCount(1)
  await name.fill(sourceNames.line)
  const owner = budget.getByRole("combobox", { name: "Owner", exact: true })
  await expect(owner).toHaveCount(1)
  await expect(owner.locator(`option[value="${actorId}"]`)).toHaveCount(1)
  await owner.selectOption(actorId)
  const element = budget.getByRole("combobox", { name: "Element", exact: true })
  await expect(element).toHaveCount(1)
  await element.selectOption("licenses")
  const currency = budget.getByRole("combobox", { name: "Currency", exact: true })
  await expect(currency).toHaveCount(1)
  await expect(currency).toHaveValue("USD")
  await budget.getByRole("textbox", { name: "Annual budget", exact: true }).fill("1200")
  await confirmLine(page, budget.getByRole("button", { name: "Save", exact: true }), {
    version: 0,
    values: { versionId: baseline, collection: "lines", name: sourceNames.line, owner: actorId, el: "licenses", cur: "USD", annual: "1200" },
  }, observations)
  const created = lineRow(page)
  await expect(created).toHaveCount(1)
  await expect(created.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  await expect(created.getByRole("cell", { name: actorId, exact: true })).toHaveCount(1)
  await expect(created.getByRole("cell", { name: "licenses", exact: true })).toHaveCount(1)
  await expect(created.getByRole("cell", { name: "USD", exact: true })).toHaveCount(1)
  await expect(created.locator('[data-sf-field="annual"]')).toHaveText("1200")

  expect((await page.goto("/orchestra/sf-planner/versions?year=2027"))?.status(), "Original Planner Versions route must remain admitted").toBe(200)
  await expect(versionRows).toHaveCount(1)
  await versionRow(baseline).getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  await confirmVersion(page, origin, detail.getByRole("button", { name: "copy", exact: true }), "copy", observations, baseline)
  const copiedName = `${sourceNames.baseline} — Copy`
  await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === "/orchestra/sf-planner/versions" && url.searchParams.get("year") === "2027")
  await expect(versionRows).toHaveCount(2)
  await expect(versionRow(baseline).locator(".sf-s01-cell-value")).toHaveText(sourceNames.baseline)
  const copyRow = versionRows.filter({ has: page.getByText(copiedName, { exact: true }) })
  await expect(copyRow).toHaveCount(1)
  await expect(copyRow.locator(".sf-s01-cell-value")).toHaveText(copiedName)
  await expect(copyRow).toHaveAttribute("data-sf-row", /\S+/)
  const createdCandidate = (await copyRow.getAttribute("data-sf-row"))!
  await copyRow.getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail.getByRole("heading", { name: copiedName, exact: true })).toBeVisible()
  const candidate = await versionIdentity(detail)
  expect(candidate).toBe(createdCandidate)
  expect(candidate).not.toBe(baseline)
  await expect(detail.locator('[data-sf-field="year"] dd')).toHaveText(/^2,?027 Year$/)
  await expect(detail.locator("#sf-u46-name")).toBeEnabled()
  await detail.locator("#sf-u46-name").fill(sourceNames.candidate)
  await confirmVersion(page, origin, detail.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await expect(detail.getByRole("heading", { name: sourceNames.candidate, exact: true })).toBeVisible()
  expect(await versionIdentity(detail)).toBe(candidate)
  await detail.getByRole("button", { name: "Back", exact: true }).click()
  await expect(versionRow(candidate)).toHaveCount(1)
  await expect(versionRow(candidate).locator(".sf-s01-cell-value")).toHaveText(sourceNames.candidate)
  await expect(versionRow(candidate).getByRole("cell").nth(1)).toHaveText("2027")
  expect((await page.goto(planner("OPEX", candidate)))?.status(), "Original candidate OPEX route must be installed").toBe(200)
  const copiedLine = lineRow(page)
  await expect(copiedLine).toHaveCount(1)
  await expect(copiedLine.getByRole("cell", { name: actorId, exact: true })).toHaveCount(1)
  await expect(copiedLine.getByRole("cell", { name: "licenses", exact: true })).toHaveCount(1)
  await expect(copiedLine.getByRole("cell", { name: "USD", exact: true })).toHaveCount(1)
  await expect(copiedLine.locator('[data-sf-field="annual"]')).toHaveText("1200")
  await copiedLine.getByRole("button", { name: "Manage", exact: true }).click()
  const manager = lineManager(page)
  await expect(manager).toHaveCount(1)
  await expect(manager.locator('[data-sf-field="owner"] dd')).toHaveText(actorId)
  await expect(manager.locator('[data-sf-field="element"] dd')).toHaveText("licenses")
  await expect(manager.locator('[data-sf-field="currency"] dd')).toHaveText("USD")
  await expect(manager.locator('[data-sf-field="annual"] dd')).toHaveText("1200")
  await expect(manager.getByRole("combobox", { name: "Currency", exact: true })).toHaveValue("USD")
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue("1200")
  const copiedRevision = await sourceRevision(manager)
  await manager.getByLabel("Annual budget", { exact: true }).fill("2400")
  await confirmLine(page, manager.getByRole("button", { name: "Save", exact: true }), {
    version: copiedRevision,
    values: { versionId: candidate, collection: "lines", annual: "2400" },
  }, observations)
  await expect(copiedLine).toHaveCount(1)
  await expect(copiedLine.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  await expect(copiedLine.locator('[data-sf-field="annual"]')).toHaveText("2400")
  await copiedLine.getByRole("button", { name: "Manage", exact: true }).click()
  expect(await sourceRevision(manager)).toBeGreaterThan(copiedRevision)
  observations.push({ stage: "planner-sources-created-through-ui", baselineVersion: baseline, candidateVersion: candidate,
    baselineAnnualInput: 1200, candidateAnnualInput: 2400, currency: "USD", year: 2027 })
  return { baseline, candidate }
}

/** A real source revision, independent of the saved ChoiceRecord. */
export async function changePlannerSource(page: Page, origin: string, versionId: string, annualBudget: number, observations: Record<string, unknown>[]) {
  await page.goto(`/orchestra/sf-planner/opex?${new URLSearchParams({ version: versionId })}`)
  const row = lineRow(page)
  await expect(row).toHaveCount(1)
  await expect(row.locator('[data-sf-field="annual"]')).toHaveText("2400")
  await row.getByRole("button", { name: "Manage", exact: true }).click()
  const manager = lineManager(page)
  await expect(manager).toHaveCount(1)
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue("2400")
  await expect(manager.getByRole("combobox", { name: "Currency", exact: true })).toHaveValue("USD")
  await expect(manager.locator('[data-sf-field="currency"] dd')).toHaveText("USD")
  const previousRevision = await sourceRevision(manager)
  await manager.getByLabel("Annual budget", { exact: true }).fill(String(annualBudget))
  await confirmLine(page, manager.getByRole("button", { name: "Save", exact: true }), {
    version: previousRevision,
    values: { versionId, collection: "lines", annual: String(annualBudget) },
  }, observations)
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell", { name: sourceNames.line, exact: true })).toBeVisible()
  await expect(row.locator('[data-sf-field="annual"]')).toHaveText(String(annualBudget))
  await row.getByRole("button", { name: "Manage", exact: true }).click()
  await expect(manager.getByLabel("Annual budget", { exact: true })).toHaveValue(String(annualBudget))
  await expect(manager.getByRole("combobox", { name: "Currency", exact: true })).toHaveValue("USD")
  const revision = await sourceRevision(manager)
  expect(revision).toBeGreaterThan(previousRevision)
  observations.push({ stage: "planner-source-revised-through-ui", versionId, previousAnnualInput: 2400, annualInput: annualBudget, currency: "USD", previousRevision, revision })
}

async function confirmVersion(page: Page, origin: string, opener: Locator, action: string, observations: Record<string, unknown>[], sourceId?: string) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  await expect(confirm).toBeEnabled()
  const { result, command, httpStatus } = await observePlannerCommand(page, origin, "Versions", action, confirm)
  expect(command.confirmed).toBe(true)
  if (sourceId !== undefined) expect(command.id).toBe(sourceId)
  expect(result.ok).toBe(true)
  observations.push({ stage: "planner-human-command", action, httpStatus, ok: result.ok })
  return result
}

async function versionIdentity(detail: Locator) {
  const id = detail.locator("p.sf-s01-secondary bdi")
  await expect(id).toHaveText(/\S+/)
  return (await id.innerText()).trim()
}

function lineRow(page: Page) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: sourceNames.line, exact: true }) })
}

function lineManager(page: Page) {
  return page.getByRole("region", { name: "Manage record", exact: true })
}

async function sourceRevision(manager: Locator) {
  const shown = manager.getByText(/Source revision: \d+/)
  await expect(shown).toBeVisible()
  const match = (await shown.innerText()).match(/Source revision: (\d+)/)
  expect(match).not.toBeNull()
  return Number(match![1])
}

async function confirmLine(page: Page, opener: Locator, expected: { version: number; values: Record<string, unknown> }, observations: Record<string, unknown>[]) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  await expect(confirm).toBeEnabled()
  const origin = new URL(page.url()).origin
  const { result, command: body, httpStatus } = await observePlannerCommand(page, origin, "OPEX", "save", confirm)
  expect(result.ok).toBe(true)
  expect(body.page).toBe("OPEX")
  expect(body.action).toBe("save")
  expect(body.confirmed).toBe(true)
  expect(body.version).toBe(expected.version)
  expect(asRecord(body.values)).toMatchObject(expected.values)
  observations.push({ stage: "planner-human-command", action: "save", httpStatus, ok: result.ok, version: body.version })
  return result
}


// Retain the original producer response before an installed refresh can evict it
// from Chromium. A matched command reaches the server once and keeps its body.
async function observePlannerCommand(page: Page, origin: string, name: "Versions" | "OPEX", action: string, confirm: Locator) {
  const endpoint = `${origin}/sucafina/planner?page=${name}`
  const match = (url: URL) => url.href === endpoint
  const captured = Promise.withResolvers<{ result: Record<string, unknown>; command: Record<string, unknown>; httpStatus: number }>()
  let requests = 0
  const handle = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()
    try {
      const command = asRecord(request.postDataJSON())
      if (command.page !== name || command.action !== action) return route.fallback()
      expect(++requests, "one original Planner command").toBe(1)
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
      const result = await response.json().finally(() => route.fulfill({ response }))
      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toContain("application/json")
      captured.resolve({ result: asRecord(result), command, httpStatus: response.status() })
    } catch (error) {
      captured.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(match, handle)
  try {
    const [result] = await Promise.all([captured.promise, confirm.click()])
    return result
  } finally { await page.unroute(match, handle) }
}
