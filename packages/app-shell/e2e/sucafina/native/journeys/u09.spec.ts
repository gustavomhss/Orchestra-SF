import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test, armLostResponse } from "../fixture"

// U09/N20. The F04 fixture is the only admissible installed-host source.
// No route mocking, fake role, fixture-generated ACL, or producer response stub.
test.use({ trace: "off" })

test("CAP21 edits shared catalogs through the real owner-bound producer and rereads CAS", async ({ page, nativeHarness }, info) => {
  const target = nativeHarness.manifest.target
  await page.goto(new URL("/orchestra/sf-planner/allocations", target.shellOrigin).toString())
  const surface = page.locator('[data-sf-surface="CAP21"]')
  await expect(surface, "Requires an authenticated N20 CAP21 installation in the CI120 candidate").toBeVisible()
  const entities = surface.locator('[data-sf-catalog="entities"]')
  const allocations = surface.locator('[data-sf-catalog="allocations"]')
  await expect(entities.getByRole("table")).toBeVisible()
  await expect(allocations.getByRole("table")).toBeVisible()
  const add = entities.getByRole("button", { name: "Add entity", exact: true })
  await expect(add, "The real runner must admit the authorized admin actor; no role impersonation").toBeEnabled()
  const name = "N20 catalog " + randomUUID()
  await add.click()
  const editor = surface.locator("form.sf-n20-editor")
  await expect(editor).toBeVisible()
  await editor.getByRole("textbox", { name: "Name", exact: true }).fill(name)
  await editor.getByRole("textbox", { name: "Details", exact: true }).fill("N20-CAS")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  await expect(review).toContainText(name)
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeEnabled()

  const saved = page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false
    const url = new URL(response.url())
    return url.origin === target.publicOrigin && url.pathname === target.mount + "/planner" &&
      response.request().postDataJSON()?.page === "Entities & allocations" &&
      response.request().postDataJSON()?.action === "save"
  })
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(200)
  const outcome = await response.json() as { ok: boolean; value?: unknown }
  expect(outcome.ok).toBe(true)
  expect(typeof outcome.value).toBe("string")
  const rowId = outcome.value as string
  const row = entities.locator('[data-sf-row]').filter({ has: entities.getByText(name, { exact: true }) })
  await expect(row).toHaveAttribute("data-sf-row", rowId)
  await expect(row).toContainText("N20-CAS")

  await surface.getByRole("textbox", { name: "Filter records", exact: true }).fill(name)
  await expect(entities.locator('[data-sf-row]')).toHaveCount(1)
  await surface.getByRole("textbox", { name: "Filter records", exact: true }).fill("N20-no-match-" + randomUUID())
  await expect(entities.getByText("No results for these filters.")).toBeVisible()
  await entities.getByRole("button", { name: "Clear filters", exact: true }).click()
  await expect(row).toBeVisible()

  await page.setViewportSize({ width: 320, height: 740 })
  await expect(entities).toBeVisible()
  await expect(allocations).toBeVisible()
  // Tables may scroll within their own container, never force body horizontal scrolling.
  const bodyOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(bodyOverflow).toBe(false)

  const deleteBtn = row.getByRole("button", { name: "Delete", exact: true })
  await expect(deleteBtn).toBeEnabled()
  await deleteBtn.click()
  await expect(review.getByRole("button", { name: "Delete", exact: true })).toBeEnabled()
  const removed = page.waitForResponse((reply) => {
    if (reply.request().method() !== "POST") return false
    const url = new URL(reply.url())
    return url.origin === target.publicOrigin && url.pathname === target.mount + "/planner" &&
      reply.request().postDataJSON()?.page === "Entities & allocations" &&
      reply.request().postDataJSON()?.action === "delete"
  })
  await review.getByRole("button", { name: "Delete", exact: true }).click()
  expect((await removed).status()).toBe(200)
  await expect(entities.locator('[data-sf-row="' + rowId + '"]')).toHaveCount(0)
  await info.attach("u09-cap21-320.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
})

test("CAP21 response-loss is outcome-unknown without automatic mutation replay", async ({ page, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  await page.goto(new URL("/orchestra/sf-planner/allocations", target.shellOrigin).toString())
  const surface = page.locator('[data-sf-surface="CAP21"]')
  await expect(surface).toBeVisible()
  const add = surface.locator('[data-sf-catalog="entities"]').getByRole("button", { name: "Add entity", exact: true })
  await expect(add).toBeEnabled()
  await add.click()
  const editor = surface.locator("form.sf-n20-editor")
  await editor.getByRole("textbox", { name: "Name", exact: true }).fill("N20 response-loss " + randomUUID())
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  const loss = await armLostResponse(page, {
    origin: target.publicOrigin, pathname: target.mount + "/planner", method: "POST",
  })
  try {
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
    await review.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.locator('[data-sf-state="outcome-unknown"]')).toBeVisible()
    expect(loss.observations().attempts).toBe(1)
    await expect(surface.getByRole("button", { name: "Add entity", exact: true })).toHaveCount(0)
  } finally {
    await loss.dispose()
  }
})

test("CAP21 anonymous browser never receives the authenticated catalog", async ({ browser, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  const anonymous = await browser.newContext()
  try {
    const page = await anonymous.newPage()
    await page.goto(new URL("/orchestra/sf-planner/allocations", target.shellOrigin).toString())
    await expect(page.locator('[data-sf-surface="CAP21"]')).toHaveCount(0)
    await expect(page.locator('[data-sf-catalog="entities"] [data-sf-row]')).toHaveCount(0)
  } finally {
    await anonymous.close()
  }
})
