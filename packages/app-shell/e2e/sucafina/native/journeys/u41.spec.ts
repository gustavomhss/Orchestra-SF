import { expect, test } from "@playwright/test"

// U41/UI30 installed-only journeys. 150 supplies real authenticated installations,
// periods, rows and negative principals. No interception, mock, synthetic response
// or fallback to a success fixture; absence of an admitted fixture fails visibly.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })
const workUrl = process.env.SF_NATIVE_E2E_WORK_URL
const periodStart = process.env.SF_NATIVE_E2E_PERIOD_START
const periodEnd = process.env.SF_NATIVE_E2E_PERIOD_END

test("U41/UI30 — source-backed selection preserves action, owner, version and filters", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "Installed A12 work-item/read+verify, A13 work-list, owner-scoped S01 table; not a mocked projection" })
  expect(workUrl, "150 must supply an authorized UI30 installation").toBeTruthy()
  expect(periodStart, "150 must supply a real producer-backed period").toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(periodEnd, "150 must supply a real producer-backed period").toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await page.goto(workUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await expect(work).toBeVisible()
  await work.locator("[data-sf-work-start]").fill(periodStart!)
  await work.locator("[data-sf-work-end]").fill(periodEnd!)
  await work.locator("[data-sf-work-period] button[type=submit]").click()
  const table = work.locator('[data-sf-table-state="ready"]')
  await expect(table, "A real selected work item is required, not a successful empty fixture").toBeVisible()
  // The first next action is intentionally selected, not an arbitrary strictness workaround.
  const row = table.locator('tbody tr[data-sf-row]').nth(0)
  await expect(row).toBeVisible()
  const identity = row.locator("[data-sf-work-row-action]")
  const actionRef = await identity.getAttribute("data-sf-work-row-action")
  const ownerRef = await identity.getAttribute("data-sf-work-row-owner")
  const sourceVersion = await identity.getAttribute("data-sf-work-row-source-version")
  const observedVersion = await identity.getAttribute("data-sf-work-row-observed-version")
  expect(actionRef).toBeTruthy()
  expect(ownerRef).toBeTruthy()
  await row.locator('[data-sf-action="select"]').click()
  const detail = work.locator("[data-sf-work-detail]")
  await expect(detail.locator("[data-sf-state=ready]"), "Missing work-item handler must not look like success").toBeVisible()
  await expect(detail.locator("[data-sf-work-action-ref]")).toHaveText(actionRef!)
  await expect(detail.locator("[data-sf-work-owner-ref]")).toHaveAttribute("data-sf-work-owner-ref", ownerRef!)
  if (sourceVersion !== "") await expect(detail.locator("[data-sf-work-source-version]")).toHaveText(sourceVersion!)
  else await expect(detail.locator("[data-sf-work-source-version]")).toHaveCount(0)
  if (observedVersion !== "") await expect(detail.locator("[data-sf-work-observed-version]")).toHaveText(observedVersion!)
  else await expect(detail.locator("[data-sf-work-observed-version]")).toHaveCount(0)
  await work.locator("[data-sf-work-filter]").fill("no-such-matching-current-action-__u41__")
  await expect(work.locator("[data-sf-table-state=filtered-empty]")).toBeVisible()
  await expect(detail.locator("[data-sf-work-action-ref]")).toHaveText(actionRef!)
  await work.locator("[data-sf-work-filter]").fill("")
  await expect(table).toBeVisible()
})

test("U41/UI30 — each destination check uses an approved native route or fails closed", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "Installed work-destination. Only current same-owner F01 thread route is admitted; desktop oc:// is not a publicOrigin" })
  const expectedState = process.env.SF_NATIVE_E2E_SOURCE_STATE
  expect(workUrl).toBeTruthy()
  expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(expectedState, "150 must declare source outcome of the installed producer: ready or unavailable").toMatch(/^(ready|unavailable)$/)
  await page.goto(workUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await work.locator("[data-sf-work-start]").fill(periodStart!)
  await work.locator("[data-sf-work-end]").fill(periodEnd!)
  await work.locator("[data-sf-work-period] button[type=submit]").click()
  const row = work.locator('[data-sf-table-state="ready"] tbody tr[data-sf-row]').nth(0)
  await expect(row).toBeVisible()
  await row.locator('[data-sf-action="select"]').click()
  const detail = work.locator("[data-sf-work-detail]")
  await expect(detail.locator("[data-sf-state=ready]")).toBeVisible()
  // Labels returned by the projection may be displayed but never open raw URLs.
  await expect(detail.locator("a[href]")).toHaveCount(0)
  const original = page.url()
  await detail.getByRole("button", { name: /Check current destination|Consultar destino atual/ }).click()
  if (expectedState === "unavailable") {
    await expect(detail.locator('[data-sf-work-source-state="unavailable"]')).toBeVisible()
    await expect(detail.getByRole("button", { name: /Open current source|Abrir fonte atual/ })).toHaveCount(0)
    await expect(page).toHaveURL(original)
    return
  }
  const admittedRoute = process.env.SF_NATIVE_E2E_SOURCE_ROUTE
  expect(admittedRoute, "150 must supply the expected typed F01 route from the installed producer").toMatch(/^\/orchestra\/sf-work\/threads\/[^/?#]+$/)
  const open = detail.getByRole("button", { name: /Open current source|Abrir fonte atual/ })
  await expect(open).toBeEnabled()
  await open.click() // reauthorize, do not reuse the previous check as a grant
  await expect(page).toHaveURL(new URL(admittedRoute!, original).href)
})

test("U41/UI30 — denied owner cannot see private work or source navigation", async ({ page }, info) => {
  test.setTimeout(120_000)
  info.annotations.push({ type: "qualification", description: "150 must provide a second actually denied principal/installation; no response spoofing" })
  const deniedUrl = process.env.SF_NATIVE_E2E_DENIED_WORK_URL
  expect(deniedUrl, "A distinct real denied-owner fixture is required").toBeTruthy()
  await page.goto(deniedUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await expect(work).toBeVisible()
  await expect(work.locator('[data-sf-state="denied"]')).toBeVisible()
  await expect(work.locator('[data-sf-work-detail]')).toHaveCount(0)
  await expect(work.locator('[data-sf-work-row-action]')).toHaveCount(0)
  await expect(work.getByRole("button", { name: /Open current source|Abrir fonte atual/ })).toHaveCount(0)
})

test("U41/UI30 — stale selection remains an error, never an empty authorized list", async ({ page }, info) => {
  test.setTimeout(120_000)
  info.annotations.push({ type: "qualification", description: "150 must provide real producer stale-selection fixture; no synthetic 409" })
  const staleUrl = process.env.SF_NATIVE_E2E_STALE_WORK_URL
  expect(staleUrl, "A real stale-selection fixture is required").toBeTruthy()
  expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await page.goto(staleUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await expect(work).toBeVisible()
  await work.locator("[data-sf-work-start]").fill(periodStart!)
  await work.locator("[data-sf-work-end]").fill(periodEnd!)
  await work.locator("[data-sf-work-period] button[type=submit]").click()
  await expect(work.locator('[data-sf-state="stale"]')).toBeVisible()
  await expect(work.locator('[data-sf-work-row-action]')).toHaveCount(0)
  await expect(work.locator('[data-sf-work-detail]')).toHaveCount(0)
})
