/**
 * N10/U43 real installed legacy-list and native-V2 HOLD journey.
 * V1 records remain versioned; absence of V2 is never a fabricated write.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test("UI32 reads legacy personal views and explicitly blocks uninstalled native V2", async ({ page, nativeHarness }) => {
  const destination = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  destination.pathname = "/orchestra/sf-work/views"
  await page.goto(destination.toString())
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  const legacy = page.getByRole("heading", { name: /Existing personal views|Vistas pessoais existentes/ })
  await expect(legacy).toBeVisible()
  const native = page.getByRole("heading", { name: /Native views and preferred entry|Vistas nativas e entrada preferida/ })
  await expect(native).toBeVisible()
  const nativeSection = page.locator(".mx-card").filter({ has: native })
  await expect(nativeSection.locator('[data-sf-state="unavailable"]')).toBeVisible()
  await expect(nativeSection).toContainText(/Legacy views are not native routes|Vistas legadas não são rotas nativas/)
})

test("UI32 never treats a missing native producer as saved preferences", async ({ page, nativeHarness }) => {
  const destination = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  destination.pathname = "/orchestra/sf-work/views/new"
  await page.goto(destination.toString())
  await expect(page.getByRole("heading", { name: /Saved views|Vistas salvas/ })).toBeVisible()
  await expect(page.locator('[data-sf-state="unavailable"]')).toBeVisible()
  await expect(page.getByText(/No new view, entry preference, or migration has been saved|Nenhuma nova vista, preferência de entrada ou migração foi salva/)).toBeVisible()
})
