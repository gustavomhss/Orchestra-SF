/**
 * U17/N24 hosted journeys. 120 owns execution against a real authorized
 * source-backed fixture; these tests do not mock ACL, evidence, case or receipts.
 */
import { test, expect } from "@playwright/test"

async function openCase(page: import("@playwright/test").Page) {
  await page.goto("/orchestra/sf-decisions")
  await page.getByRole("link", { name: /Open decision|Abrir decisão/ }).first().click()
  await expect(page.getByRole("heading", { name: /Case summary|Resumo do caso/ })).toBeVisible()
}

test.describe("N24 U17 – alternatives, assumptions and question cycles", () => {
  test("alternatives preserve coverage and do not promote a choice @sf-u17", async ({ page }) => {
    await openCase(page)
    await page.getByRole("link", { name: /Alternatives|Alternativas/ }).click()
    await expect(page.getByRole("heading", { name: /Alternatives|Alternativas/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Recorded choice|Escolha registrada/ })).toBeVisible()
    // Choice promotion is exclusively UI38/U18; a comparison cannot silently mutate it.
    await expect(page.getByRole("button", { name: /Promote choice|Promover escolha/ })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Back to case|Voltar ao caso/ })).toBeVisible()
  })

  test("assumption filtering keeps evidence access @sf-u17", async ({ page }) => {
    await openCase(page)
    await page.getByRole("link", { name: /Assumptions|Premissas/ }).click()
    await expect(page.getByRole("heading", { name: /Assumptions|Premissas/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Missing cost categories|Categorias de custo ausentes/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Divergences|Divergências/ })).toBeVisible()
    const filter = page.getByRole("combobox", { name: /State|Estado/ })
    await filter.selectOption("open")
    await expect(filter).toHaveValue("open")
    await filter.selectOption("all")
    await expect(filter).toHaveValue("all")
  })

  test("preparing a question requires a separate confirmation and never asserts a recorded thread @sf-u17", async ({ page }) => {
    await openCase(page)
    await page.getByRole("link", { name: /Questions|Perguntas/ }).click()
    await expect(page.getByRole("heading", { name: /Questions|Perguntas/ })).toBeVisible()
    const field = page.getByRole("textbox", { name: /Question text|Texto da pergunta/ })
    await field.fill("What evidence determines the cost basis?")
    await page.getByRole("button", { name: /Prepare question|Preparar pergunta/ }).click()
    await expect(page.getByRole("group", { name: /Confirm preparation|Confirmar preparação/ })).toBeVisible()
    await expect(field).toHaveValue("What evidence determines the cost basis?")
    // Do not submit/consume a question in a generic read journey.
  })

  for (const width of [320, 768, 1024, 1280, 1440]) {
    test("decision surfaces reflow at " + width + "px @sf-u17", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openCase(page)
      await page.getByRole("link", { name: /Questions|Perguntas/ }).click()
      await expect(page.getByRole("heading", { name: /Questions|Perguntas/ })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
  test("keeps question source fields available at 200% root text resize @sf-u17", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openCase(page)
    await page.getByRole("link", { name: /Questions|Perguntas/ }).click()
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await expect(page.getByRole("textbox", { name: /Question text|Texto da pergunta/ })).toBeVisible()
    await expect(page.getByRole("combobox", { name: /Related criterion|Critério relacionado/ })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

})
