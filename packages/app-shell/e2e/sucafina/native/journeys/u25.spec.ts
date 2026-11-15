import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture.ts"

/**
 * U25 surgical proof: requires a real installed authenticated SF host and
 * a dashboard source with at least one authorized agenda item. The F04 fixture
 * rejects a missing private manifest; no mocked route, role, or 200 response.
 */
test("U25 keeps reviewed agenda separate from preserved result at 320 and 1280 CSSpx", async ({ page, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  const url = new URL(target.chapterHref, target.shellOrigin)
  url.pathname = "/orchestra/sf-reviews/agenda"
  await page.goto(url.toString())
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda).toBeVisible()
  await expect(agenda.locator('[data-sf-preserved-confirmed]')).toHaveCount(0)
  await expect(agenda.locator('[data-sf-state="ready"]')).toBeVisible()
  const add = agenda.locator('[data-sf-state="ready"] button').filter({ hasText: /Add to agenda|Adicionar à pauta/ })
  await expect(add.first()).toBeEnabled()
  await add.first().click()
  const order = agenda.locator('[data-sf-agenda-order] > li')
  await expect(order).toHaveCount(1)
  await expect(agenda.locator('[data-sf-preserved-confirmed]')).toHaveCount(0)
  for (const width of [320, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(order).toBeVisible()
    const fits = await agenda.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)
    expect(fits, "U25 should reflow within its usable container").toBe(true)
  }
  await page.getByRole("button", { name: /Review selected sections|Revisar seções selecionadas/ }).click()
  await expect(agenda.locator('[data-sf-agenda-preview]')).toBeVisible()
  await expect(agenda.locator('[data-sf-preserved-confirmed]')).toHaveCount(0)
  // Preserving mutates the actual product; only 120's isolated write campaign
  // may execute the final confirmation and recovery matrices.
})
