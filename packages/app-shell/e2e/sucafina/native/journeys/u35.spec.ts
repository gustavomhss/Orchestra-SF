import { expect, test } from "@playwright/test"

// Read from the actual A15 producer. This test supplies no canned resident
// list, invented 5/18/8/39 cardinality or synthetic loaded-state fixtures.
function installed(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(name + " must be a currently authorized installation fixture")
  return value
}
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe("N29 U35 current resident projection", () => {
  test.describe.configure({ retries: 0 })

  test("UI70 lists exactly the producer-provided authorized profiles and refuses inferred load receipts", async ({ page }) => {
    const identifiers = JSON.parse(installed("SF_NATIVE_U35_EXPECTED_PROFILE_IDS")) as string[]
    expect(identifiers.length).toBeGreaterThan(0)
    await page.goto(installed("SF_NATIVE_U35_URL"))
    const surface = page.locator('[data-sf-surface="UI70"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    const cards = surface.getByRole("article").filter({ has: page.getByRole("button", { name: /Open resident details|Abrir detalhes do residente/ }) })
    await expect(cards).toHaveCount(identifiers.length)
    for (const id of identifiers) {
      const card = cards.filter({ has: page.getByRole("heading", { name: id, exact: true }) })
      await expect(card).toBeVisible()
      await card.getByRole("button", { name: /Open resident details|Abrir detalhes do residente/ }).click()
      await expect(surface.getByText(/Load receipt not exposed|Recibo de carregamento não exposto/)).toBeVisible()
      await card.getByRole("button", { name: /Open resident details|Abrir detalhes do residente/ }).click()
    }
    await expect(surface.getByText(/Pack inventory is not in this projection|Esta projeção não expõe inventário/)).toBeVisible()
  })

  test("UI70 keeps active filter when empty and retains accessible reflow in five viewports", async ({ page }) => {
    await page.goto(installed("SF_NATIVE_U35_URL"))
    const surface = page.locator('[data-sf-surface="UI70"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    const search = surface.getByRole("searchbox", { name: /Filter residents and skills|Filtrar residentes e skills/ })
    await search.fill("n29-no-matching-resident-assertion")
    await expect(surface).toHaveAttribute("data-state", "filtered-empty")
    await expect(search).toHaveValue("n29-no-matching-resident-assertion")
    await search.fill("")
    await expect(surface).toHaveAttribute("data-state", "ready")
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 850 })
      await expect(search).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
    }
    await page.setViewportSize({ width: 1280, height: 850 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await page.setViewportSize({ width: 320, height: 850 })
    await expect(search).toBeVisible()
  })
})
