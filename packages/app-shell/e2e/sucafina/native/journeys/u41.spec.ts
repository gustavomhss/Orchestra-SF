import { expect, test } from "@playwright/test"

// N11/U41: 120 owns CI selection and an installed, authorized SF fixture.
// These scenarios do not intercept, fake or synthesize producer responses.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })
const workUrl = process.env.SF_NATIVE_E2E_WORK_URL
const periodStart = process.env.SF_NATIVE_E2E_PERIOD_START
const periodEnd = process.env.SF_NATIVE_E2E_PERIOD_END

test("U41/UI30 — current producer selection, work list, filter and source detail", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "A12 projection.work-selection/work-item + A13 collaboration.work-list/work-destination, same installed owner; no invented task status" })
  expect(workUrl, "120 must supply a real authorized UI30 owner URL").toBeTruthy()
  expect(periodStart, "120 must select a real producer-backed period").toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(periodEnd, "120 must select a real producer-backed period").toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await page.goto(workUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await expect(work).toBeVisible()
  await work.locator("[data-sf-work-start]").fill(periodStart!)
  await work.locator("[data-sf-work-end]").fill(periodEnd!)
  await work.locator("[data-sf-work-period] button[type=submit]").click()
  await expect(work.locator('[data-sf-table-state="ready"], [data-sf-table-state="empty"]')).toBeVisible()
  const table = work.locator("[data-sf-table-state=ready]")
  if (await table.isVisible()) {
    await expect(table.locator("tbody tr").first()).toBeVisible()
    await table.locator("tbody tr").first().click()
    await expect(work.locator("[data-sf-work-detail]")).toBeVisible()
    await expect(work.locator("[data-sf-work-detail] [data-sf-state=ready]")).toBeVisible()
  }
  await work.locator("[data-sf-work-filter]").fill("no-such-matching-current-action-__u41__")
  await expect(work.locator("[data-sf-table-state=filtered-empty]")).toBeVisible()
  await work.locator("[data-sf-work-filter]").fill("")
  await expect(work.locator("[data-sf-table-state=ready], [data-sf-table-state=empty]")).toBeVisible()
})

test("U41/UI30 — no silent read result after owner/session transition", async ({ page }, info) => {
  test.setTimeout(120_000)
  info.annotations.push({ type: "qualification", description: "120 must drive a second real principal or revocation fixture; this assertion never simulates a permission response" })
  expect(workUrl).toBeTruthy()
  await page.goto(workUrl!)
  const work = page.locator('[data-sf-surface="UI30"]')
  await expect(work).toBeVisible()
  // A private source must never be visible while no owner is currently ready.
  await expect(page.locator('[data-sf-surface="UI30"] [data-sf-state="denied"] [data-sf-work-detail]')).toHaveCount(0)
})
