import { expect, type Locator, type Page } from "@playwright/test"
import { asRecord, decisionsChapterURL } from "./journey"

export const sourceNames = { baseline: "Decisions baseline plan", candidate: "Decisions candidate plan", line: "Decision annual service" }

/** Build the financial source records through the installed Planner controls. */
export async function createPlannerSources(page: Page, origin: string, actorId: string, observations: Record<string, unknown>[]) {
  const planner = (name: string, version?: string) => {
    const url = decisionsChapterURL(page, origin, name === "OPEX" ? "/orchestra/sf-planner/opex" : "/orchestra/sf-planner/versions")
    if (version) url.searchParams.set("version", version)
    return url.href
  }
  const versionRows = page.locator('[data-sf-surface="CAP23"] tr[data-sf-row]')
  const versionRow = (id: string) => versionRows.and(page.locator(`tr[data-sf-row="${id}"]`))
  const detail = page.locator("[data-sf-record-detail]")
  const installed = await page.goto(decisionsChapterURL(page, origin, "/orchestra/sf-planner/versions/new").href)
  expect(installed?.status(), "Original Planner Versions route must be installed").toBe(200)
  await expect(page.getByRole("heading", { name: "Versions", exact: true })).toBeVisible()
  const first = await confirmVersion(page, page.locator('[data-sf-surface="CAP23"]').getByRole("button", { name: "Create first version", exact: true }), "save", observations)
  const baseline = await openPublishedVersion(page, detail, versionRows, first, { count: 1 })
  const versionName = detail.locator("#sf-u46-name")
  const year = detail.locator("#sf-u46-year")
  await expect(versionName).toBeEnabled()
  await versionName.fill(sourceNames.baseline)
  await expect(year).toBeEnabled()
  await year.fill("2027")
  await confirmVersion(page, detail.getByRole("button", { name: "Save", exact: true }), "save", observations, baseline)
  await expect(detail.getByRole("heading", { name: sourceNames.baseline, exact: true })).toBeVisible()
  await expect(detail.locator('[data-sf-field="year"]')).toContainText("2027")
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

  expect((await page.goto(decisionsChapterURL(page, origin, "/orchestra/sf-planner/versions?year=2027").href))?.status(), "Original Planner Versions route must remain admitted").toBe(200)
  await versionRow(baseline).getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  const copied = await confirmVersion(page, detail.getByRole("button", { name: "copy", exact: true }), "copy", observations, baseline)
  const copiedName = `${sourceNames.baseline} — Copy`
  const candidate = await openPublishedVersion(page, detail, versionRows, copied, { count: 2, copyName: copiedName })
  await expect(detail.getByRole("heading", { name: copiedName, exact: true })).toBeVisible()
  expect(candidate).not.toBe(baseline)
  await expect(detail.locator('[data-sf-field="year"]')).toContainText("2027")
  await expect(detail.locator("#sf-u46-name")).toBeEnabled()
  await detail.locator("#sf-u46-name").fill(sourceNames.candidate)
  await confirmVersion(page, detail.getByRole("button", { name: "Save", exact: true }), "save", observations, candidate)
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
  await page.goto(decisionsChapterURL(page, origin, `/orchestra/sf-planner/opex?${new URLSearchParams({ version: versionId })}`).href)
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

async function confirmVersion(page: Page, opener: Locator, action: "save" | "copy", observations: Record<string, unknown>[], versionId?: string) {
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
  const sent = asRecord(response.request().postDataJSON())
  expect(sent).toMatchObject({ page: "Versions", action, confirmed: true, version: expect.any(Number) })
  expect(sent.id).toBe(versionId)
  if (!versionId) expect(sent.version).toBe(0)
  observations.push({ stage: "planner-human-command", action, httpStatus: response.status(), ok: result.ok, version: sent.version })
  return result
}

/** A successful Versions command can return only ok/warnings. Follow the authorized list in that case. */
async function openPublishedVersion(page: Page, detail: Locator, rows: Locator, reply: Record<string, unknown>, expected: { count: number; copyName?: string }) {
  if (typeof reply.value === "string" && reply.value.trim()) {
    await expect(detail).toHaveCount(1)
    expect(await versionIdentity(detail)).toBe(reply.value)
    return reply.value
  }
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-planner/versions")
  await expect(rows).toHaveCount(expected.count)
  const target = expected.copyName ? rows.filter({ has: page.getByRole("cell", { name: expected.copyName, exact: true }) }) : rows
  await expect(target).toHaveCount(1)
  const ref = await target.getAttribute("data-sf-row")
  expect(ref).toBeTruthy()
  await target.getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  expect(await versionIdentity(detail)).toBe(ref)
  return ref!
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
  const pending = page.waitForResponse((response) => {
    if (response.request().method() !== "POST" || new URL(response.url()).pathname !== "/sucafina/planner") return false
    const body = response.request().postDataJSON()
    return body?.page === "OPEX" && body?.action === "save"
  })
  await confirm.click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = asRecord(await response.json())
  expect(result.ok).toBe(true)
  const body = asRecord(response.request().postDataJSON())
  expect(body.page).toBe("OPEX")
  expect(body.action).toBe("save")
  expect(body.confirmed).toBe(true)
  expect(body.version).toBe(expected.version)
  expect(asRecord(body.values)).toMatchObject(expected.values)
  observations.push({ stage: "planner-human-command", action: "save", httpStatus: response.status(), ok: result.ok, version: body.version })
  return result
}
