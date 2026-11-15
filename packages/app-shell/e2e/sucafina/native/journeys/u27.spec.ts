import { expect, test } from "@playwright/test"

// N29/U27. The 120 dispatcher supplies authenticated, installed URLs and
// original producer fixtures. No route interception, fake responses or skip.
function installed(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(name + " must be an authorized installed F01 route for the 120 surgical runner")
  return value
}
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe("N29 U27 native routine admission and run", () => {
  test.describe.configure({ retries: 0 })

  test("UI64 resolves a real case/recipe and requires explicit review before prepare", async ({ page }) => {
    const route = installed("SF_NATIVE_U27_CATALOG_URL")
    const caseLabel = installed("SF_NATIVE_U27_CASE_OPTION")
    const recipeLabel = installed("SF_NATIVE_U27_RECIPE_OPTION")
    const purpose = installed("SF_NATIVE_U27_PURPOSE")

    await page.goto(route)
    const surface = page.locator('[data-sf-surface="UI64"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    const caseSelect = surface.getByRole("combobox", { name: /Choose an existing authorized case|Escolher um caso existente autorizado/ })
    await caseSelect.selectOption({ label: caseLabel })
    await surface.getByRole("textbox", { name: /Task \/ purpose|Tarefa \/ finalidade/ }).fill(purpose)
    await surface.getByRole("button", { name: /Find published recipes|Buscar receitas publicadas/ }).click()
    await expect(surface.getByRole("combobox", { name: /Select a published recipe|Selecionar receita publicada/ })).toBeVisible()
    await surface.getByRole("combobox", { name: /Select a published recipe|Selecionar receita publicada/ }).selectOption({ label: recipeLabel })
    await expect(surface.getByRole("button", { name: /Prepare routine|Preparar rotina/ })).toBeEnabled()
    await expect(surface.getByRole("button", { name: /Run admitted routine|Executar rotina admitida/ })).toHaveCount(0)
    await surface.getByRole("button", { name: /Prepare routine|Preparar rotina/ }).click()
    await expect(surface).toHaveAttribute("data-phase", "reviewing")
    await expect(surface.getByRole("group", { name: /Review admission|Revisar admissão/ })).toBeVisible()
    await expect(surface.getByRole("button", { name: /Prepare admission|Preparar admissão/ })).toBeEnabled()
  })

  test("UI65 reads the original installed run without claiming completion or a cancel capability", async ({ page }) => {
    await page.goto(installed("SF_NATIVE_U27_RUN_URL"))
    const originalRef = installed("SF_NATIVE_U27_RUN_REF")
    const surface = page.locator('[data-sf-surface="UI65"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    await expect(surface.getByText(originalRef, { exact: true })).toBeVisible()
    await expect(surface.getByText(/Admission is not evidence of a completed run|A admissão não comprova a conclusão/)).toBeVisible()
    await expect(surface.getByRole("button", { name: /^Cancel run$|^Cancelar execução$/ })).toHaveCount(0)
  })

  test("UI64 maintains controls and no document-wide horizontal overflow at five widths", async ({ page }) => {
    await page.goto(installed("SF_NATIVE_U27_CATALOG_URL"))
    const surface = page.locator('[data-sf-surface="UI64"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 850 })
      await expect(surface.getByRole("combobox", { name: /Choose an existing authorized case|Escolher um caso existente autorizado/ })).toBeVisible()
      const horizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(horizontalOverflow, "whole-page horizontal scroll at width " + width).toBe(false)
    }
    await page.setViewportSize({ width: 1280, height: 850 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await page.setViewportSize({ width: 320, height: 850 })
    await expect(surface.getByRole("combobox", { name: /Choose an existing authorized case|Escolher um caso existente autorizado/ })).toBeVisible()
  })
})
