/**
 * U16/N24 hosted journey. Run only by 120 with an authorized native-ui
 * installation, source-backed case fixture and F01 route composition.
 * Never run local tests or substitute a fixture backend on the author branch.
 */
import { test, expect } from "@playwright/test"

test.describe("N24 U16 – authorized decision cases and intent", () => {
  test("case list, reversible filtered-empty and authorized detail @sf-u16", async ({ page }) => {
    await page.goto("/orchestra/sf-decisions")
    await expect(page.getByRole("heading", { name: /Decisions|Decisões/ })).toBeVisible()
    const open = page.getByRole("link", { name: /Open decision|Abrir decisão/ }).first()
    await expect(open).toBeVisible()
    const search = page.getByRole("searchbox", { name: /Filter decisions|Filtrar decisões/ })
    await search.fill("sf-n24-match-no-case-99320")
    await expect(page.getByText(/No decisions match these filters|Nenhuma decisão corresponde aos filtros/)).toBeVisible()
    await expect(search).toHaveValue("sf-n24-match-no-case-99320")
    await page.getByRole("button", { name: /Clear filter|Limpar filtro/ }).click()
    await expect(open).toBeVisible()
    await open.click()
    await expect(page.getByRole("heading", { name: /Case summary|Resumo do caso/ })).toBeVisible()
    for (const section of [/Question|Pergunta/, /Objectives|Objetivos/, /Criteria|Critérios/, /Participants|Participantes/, /Source references|Referências das fontes/]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible()
    }
  })

  test("create intent requires explicit review and never sends on preview @sf-u16", async ({ page }) => {
    await page.goto("/orchestra/sf-decisions/new")
    const objective = page.getByRole("textbox", { name: /Decision objective/ })
    await objective.fill("Verified U16 intent")
    await page.getByLabel(/^Start$/).fill("2026-11-15")
    await page.getByLabel(/^End$/).fill("2026-12-15")
    await page.getByRole("textbox", { name: /Currency/ }).fill("USD")
    await page.getByRole("textbox", { name: /Criteria, one per line/ }).fill("Evidence coverage")
    await page.getByRole("button", { name: /Review creation|Revisar criação/ }).click()
    await expect(page.getByRole("group", { name: /Review creation|Revisar criação/ })).toContainText("Verified U16 intent")
    await expect(page.getByRole("button", { name: /Confirm this decision creation|Confirmar a criação desta decisão/ })).toBeEnabled()
    await page.getByRole("button", { name: /Cancel|Cancelar/ }).click()
    await expect(objective).toHaveValue("Verified U16 intent")
  })

  for (const width of [320, 768, 1024, 1280, 1440]) {
    test("reflows without document-level horizontal overflow at " + width + "px @sf-u16", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/orchestra/sf-decisions")
      await expect(page.getByRole("heading", { name: /Decisions|Decisões/ })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})
