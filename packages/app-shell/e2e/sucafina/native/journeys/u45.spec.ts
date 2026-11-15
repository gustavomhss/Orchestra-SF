import { expect } from "@playwright/test"
import { nativeInstalledFixture as test, armLostResponse } from "../fixture"

// U45/N20: Actions runner 120 must supply a real installed, authenticated
// scratch plan version with finance/admin permission. No mocked FX, fake 403,
// local currency arithmetic, or synthetic response is allowed.
test.use({ trace: "off" })

test("CAP22 distinguishes missing rate, producer precision and locked/base currency", async ({ page, nativeHarness }, info) => {
  const target = nativeHarness.manifest.target
  await page.goto(new URL("/orchestra/sf-planner/fx", target.shellOrigin).toString())
  const surface = page.locator('[data-sf-surface="CAP22"]')
  await expect(surface, "Requires real installed CAP22 native projection on the candidate").toBeVisible()
  await expect(surface.locator(".sf-n20-fx-base")).toContainText("USD")
  await expect(surface.locator(".sf-n20-fx-base")).toContainText("1 (fixed)")
  const version = surface.getByRole("combobox", { name: "Plan version", exact: true })
  await expect(version).toBeVisible()
  const options = version.locator("option")
  expect(await options.count(), "CI120 must seed an authorized unlocked plan version").toBeGreaterThan(0)
  const add = page.getByRole("button", { name: "Add currency", exact: true })
  await expect(add, "A producer-locked version must never allow this command").toBeEnabled()

  await add.click()
  const editor = surface.locator("form.sf-n20-fx-editor")
  await expect(editor).toBeVisible()
  await editor.getByRole("textbox", { name: "Currency", exact: true }).fill("XQZ")
  await editor.getByRole("textbox", { name: "Rate", exact: true }).fill("")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
  const create = page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false
    const url = new URL(response.url())
    return url.origin === target.publicOrigin && url.pathname === target.mount + "/planner" &&
      response.request().postDataJSON()?.page === "FX rates" &&
      response.request().postDataJSON()?.action === "save"
  })
  await review.getByRole("button", { name: "Save", exact: true }).click()
  expect((await create).status()).toBe(200)
  const row = surface.locator('[data-sf-row]').filter({ has: surface.getByText("XQZ", { exact: true }) })
  await expect(row).toContainText("No rate")
  await expect(row.locator('[data-sf-rate-state="missing"]')).toBeVisible()
  await expect(surface.locator(".sf-n20-fx-usage")).toContainText("XQZ")

  await row.getByRole("button", { name: "Edit", exact: true }).click()
  await expect(editor).toBeVisible()
  await editor.getByRole("textbox", { name: "Rate", exact: true }).fill("1.234567")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  await expect(review).toContainText("1.234567")
  const update = page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false
    const url = new URL(response.url())
    return url.origin === target.publicOrigin && url.pathname === target.mount + "/planner" &&
      response.request().postDataJSON()?.page === "FX rates" &&
      response.request().postDataJSON()?.action === "save"
  })
  await review.getByRole("button", { name: "Save", exact: true }).click()
  expect((await update).status()).toBe(200)
  await expect(row.locator('[data-sf-rate-state="known"]')).toHaveText("1.234567")
  await expect(row.locator('[data-sf-rate-state="missing"]')).toHaveCount(0)

  await surface.getByRole("textbox", { name: "Filter currencies", exact: true }).fill("NoFXMatch")
  await expect(surface.locator(".sf-n20-fx-rates")).toContainText("No results for these filters.")
  await surface.getByRole("button", { name: "Clear filters", exact: true }).click()
  await expect(row).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(surface.locator(".sf-n20-fx-base")).toBeVisible()
  await expect(surface.locator(".sf-n20-fx-rates")).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)

  await row.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(review.getByRole("button", { name: "Delete", exact: true })).toBeEnabled()
  const deletion = page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false
    const url = new URL(response.url())
    return url.origin === target.publicOrigin && url.pathname === target.mount + "/planner" &&
      response.request().postDataJSON()?.page === "FX rates" &&
      response.request().postDataJSON()?.action === "delete"
  })
  await review.getByRole("button", { name: "Delete", exact: true }).click()
  expect((await deletion).status()).toBe(200)
  await expect(surface.getByText("XQZ", { exact: true })).toHaveCount(0)
  await info.attach("u45-fx-mobile.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
})

test("CAP22 does not replay a submitted FX mutation after response loss", async ({ page, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  await page.goto(new URL("/orchestra/sf-planner/fx", target.shellOrigin).toString())
  const surface = page.locator('[data-sf-surface="CAP22"]')
  await expect(surface).toBeVisible()
  const add = page.getByRole("button", { name: "Add currency", exact: true })
  await expect(add).toBeEnabled()
  await add.click()
  const editor = surface.locator("form.sf-n20-fx-editor")
  await editor.getByRole("textbox", { name: "Currency", exact: true }).fill("QXZ")
  await editor.getByRole("textbox", { name: "Rate", exact: true }).fill("")
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
    await expect(page.getByRole("button", { name: "Add currency", exact: true })).toBeDisabled()
  } finally {
    await loss.dispose()
  }
})

test("CAP22 anonymous browser cannot read or edit the private FX projection", async ({ browser, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  const anonymous = await browser.newContext()
  try {
    const page = await anonymous.newPage()
    await page.goto(new URL("/orchestra/sf-planner/fx", target.shellOrigin).toString())
    await expect(page.locator('[data-sf-surface="CAP22"]')).toHaveCount(0)
    await expect(page.locator('[data-sf-rate-state]')).toHaveCount(0)
  } finally { await anonymous.close() }
})
