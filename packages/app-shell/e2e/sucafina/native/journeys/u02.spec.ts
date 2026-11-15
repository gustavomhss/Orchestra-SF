import { expect, test } from "@playwright/test"

// N12/U02: installed/native, owner-authorized, producer-backed only. 120 owns
// selection/dispatch after I00 integration; never mock finances or auth.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })
const executiveUrl = process.env.SF_NATIVE_E2E_EXECUTIVE_URL
const budgetUrl = process.env.SF_NATIVE_E2E_BUDGET_URL
const selectedYear = process.env.SF_NATIVE_E2E_DASHBOARD_YEAR
const selectedMonth = process.env.SF_NATIVE_E2E_DASHBOARD_MONTH

test("U02/CAP01 — executive source values, independent period, absent value and attention", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "A01 domain.page.CAP01 + F01 owner binding; no invented actual, forecast or currency" })
  expect(executiveUrl, "120 must provide an installed CAP01 URL for the authorized owner").toBeTruthy()
  await page.goto(executiveUrl!)
  const dashboard = page.locator('[data-sf-surface="CAP01"]')
  await expect(dashboard).toBeVisible()
  await expect(dashboard.locator('[data-sf-state="ready"]')).toBeVisible()
  await expect(dashboard.getByRole("heading", { name: /financial overview|visão financeira/i })).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="budget"]')).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="actual"]')).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="forecast"]')).toBeVisible()
  await expect(dashboard.locator('[data-sf-bi-slot="BI01"] table')).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="pmo-active"]')).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="it-users"]')).toBeVisible()
  await expect(dashboard.locator('[data-sf-metric="p1"]')).toBeVisible()
  // Reading never creates a topic, runs a command or automatically selects a case.
  await expect(dashboard.locator('[data-sf-topic-editor]')).toHaveCount(0)
})

test("U02/CAP01 — changing executive filters does not change a different chapter or save", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "qualification", description: "Real authorized year/month and source read; no automatic write on selector change" })
  expect(executiveUrl).toBeTruthy()
  expect(selectedYear, "120 supplies a year supported by this installation").toMatch(/^202[4-7]$/)
  expect(selectedMonth, "120 supplies an authorized calendar month").toMatch(/^(?:[1-9]|1[0-2])$/)
  await page.goto(executiveUrl!)
  const dashboard = page.locator('[data-sf-surface="CAP01"]')
  await expect(dashboard.locator('[data-sf-state="ready"]')).toBeVisible()
  await dashboard.getByLabel(/^(?:year|ano)$/i).selectOption(selectedYear!)
  await dashboard.getByLabel(/^(?:month|mês)$/i).selectOption(selectedMonth!)
  await expect(dashboard.locator('[data-sf-state="ready"]')).toBeVisible()
  await expect(dashboard.getByLabel(/^(?:year|ano)$/i)).toHaveValue(selectedYear!)
  await expect(dashboard.getByLabel(/^(?:month|mês)$/i)).toHaveValue(selectedMonth!)
  await expect(dashboard.locator('[data-sf-bi-slot="BI01"] table')).toBeVisible()
  await expect(dashboard.locator('[data-edit-result="saved"]')).toHaveCount(0)
})

test("U02/CAP03 — source-backed budget and explicit versioned edit review", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "A01 domain.page.CAP03, producer-only totals and save-month/save-revenue" })
  expect(budgetUrl, "120 must supply an authorized CAP03 URL").toBeTruthy()
  await page.goto(budgetUrl!)
  const budget = page.locator('[data-sf-surface="CAP03"]')
  await expect(budget).toBeVisible()
  await expect(budget.locator('[data-sf-state="ready"]')).toBeVisible()
  await expect(budget.locator('[data-sf-metric="budget"]')).toBeVisible()
  await expect(budget.locator('[data-sf-metric="actual"]')).toBeVisible()
  await expect(budget.locator('[data-sf-metric="forecast"]')).toBeVisible()
  await expect(budget.getByRole("table", { name: /budget, actual and outlook|orçamento, realizado e perspectiva/i })).toBeVisible()
  // If the real role grants editing, its control cannot post merely on open.
  const revenueEditor = budget.locator('[data-sf-u02-edit="save-revenue"]')
  if (await revenueEditor.isVisible()) {
    await expect(revenueEditor.getByRole("button", { name: /review source change|revisar alteração da fonte/i })).toBeVisible()
    await expect(budget.locator('[data-edit-result="saved"]')).toHaveCount(0)
  } else {
    await expect(budget.getByText(/read only|somente leitura/i)).toBeVisible()
  }
})

test("U02 — private source does not remain visible in a denied state", async ({ page }) => {
  test.setTimeout(120_000)
  expect(executiveUrl).toBeTruthy()
  await page.goto(executiveUrl!)
  const dashboard = page.locator('[data-sf-surface="CAP01"]')
  await expect(dashboard).toBeVisible()
  // The real owner/session transitions are supplied by 120's installed harness.
  // This assertion ensures no data child is attached inside denied content.
  await expect(dashboard.locator('[data-sf-state="denied"] [data-sf-metric]')).toHaveCount(0)
  await expect(dashboard.locator('[data-sf-state="session-expired"] [data-sf-metric]')).toHaveCount(0)
})
