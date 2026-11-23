import { expect, type Browser, type Page, type TestInfo } from "@playwright/test"
import type { SfContext, SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { DesignInstallation } from "./design-support/installation"
import { ServerConnection } from "../../src/context/server-connection"
import { originalRead, originalReads, type OriginalRead } from "./design-support/original-read"
import { waveTwoTest, observePage, ready, scheme, scrollPageTop, reflow, reviewActions, capture } from "./design-support/wave-two"

// Keep the original enrollment and scoped session out of traces in every test file.
waveTwoTest.use({ trace: "off", video: "off" })
waveTwoTest.describe.configure({ retries: 0 })

const screens = [
  { id: "CAP02", path: "/orchestra/sf-dashboard/hot-topics", title: "Hot Topics & Actions", br: "Hot Topics e ações" },
  { id: "CAP03", path: "/orchestra/sf-dashboard/budget", title: "Budget Overview", br: "Visão do orçamento" },
  { id: "CAP04", path: "/orchestra/sf-dashboard/opex", title: "OPEX Detail", br: "Detalhamento de OPEX" },
] as const
const newTopic = "Dados de teste · Consolidar a previsão de despesas regionais"
const topicNotes = "Conferir os registros de origem e registrar a decisão antes de concluir a revisão."

waveTwoTest("installed native second-wave design · topic collections, keyboard and source filters", async ({ page, installation, owner }, info) => {
  const check = beginWaveTwoCheck(page, installation, owner, info)
  await check.enter(screens[0])
  await captureCollection(page, info, screens[0])
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  const access = page.getByRole("button", { name: "Context and access", exact: true })
  await access.focus()
  await page.keyboard.press("Enter")
  const accessMenu = page.getByRole("menu", { name: "Context and access", exact: true })
  await expect(accessMenu.getByRole("menuitem", { name: "Refresh access", exact: true })).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(accessMenu).toBeHidden()
  await expect(access).toBeFocused()

  await waveTwoTest.step("original topic filters retain the empty and blocked states", async () => {
    const filter = page.getByLabel("Filter by status", { exact: true })
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02", query: { topicStatus: "done" } }, () => filter.selectOption("done"))
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(0)
    await expect(filter).toBeVisible()
    await expect(page.locator("[data-sf-topic-list] .sf-topics-empty")).toBeVisible()
    await expect(page.getByRole("button", { name: "New topic", exact: true })).toBeEnabled()
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02", query: { topicStatus: "" } }, () => filter.selectOption(""))
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(3)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02", query: { topicStatus: "blocked" } }, () => filter.selectOption("blocked"))
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(1)
    await expect(page.locator("[data-sf-topic-list]")).toContainText("Dados de teste · Validar plano de continuidade do fornecedor")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02", query: { topicStatus: "" } }, () => filter.selectOption(""))
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(3)
  })
  await finishWaveTwoCheck(info, check, installation, ["CAP02"], 0, ["en-US"])
})

waveTwoTest("installed native second-wave design · topic creation, revision and two genuine writes", async ({ page, installation, owner }, info) => {
  const check = beginWaveTwoCheck(page, installation, owner, info)
  const mutations = check.mutations
  const context = await check.enter(screens[0])
  const references = topicReferenceReads(context)
  await scheme(page, "dark")
  await waveTwoTest.step("topic create and update confirmation, cancellation and fresh edit", async () => {
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      page.getByRole("button", { name: "New topic", exact: true }).click())
    const editor = page.locator("[data-sf-topic-editor]")
    await fillTopic(page, installation.year, false)
    await reflow(page)
    await scrollPageTop(page)
    await capture(page, info, "CAP02-dark-desktop-editor-test-data")
    await editor.getByRole("button", { name: "Review save", exact: true }).click()
    const review = editor.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText(newTopic)
    await expect(editor.getByRole("textbox", { name: "Action", exact: true })).toBeHidden()
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Action", { exact: true })).toHaveValue(newTopic)
    await expect(editor.getByLabel("Owner", { exact: true })).toHaveValue("Operações regionais")
    await expect(editor.getByLabel("Due date", { exact: true })).toHaveValue(installation.year + "-12-22")
    await expect(editor.getByLabel("Status", { exact: true })).toHaveValue("open")
    await expect(editor.getByLabel("Priority", { exact: true })).toHaveValue("high")
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(topicNotes)
    await editor.getByRole("button", { name: "Review save", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await reviewActions(page)
    await capture(page, info, "CAP02-dark-desktop-review-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "CAP02-dark-320-review-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      review.getByRole("button", { name: "Confirm save", exact: true }).click())
    const saved = page.locator("[data-sf-topic-confirmed]")
    await expect(saved.locator('[data-topic-feedback="saved"]')).toBeVisible()
    await expect(editor).toHaveCount(0)
    expect(mutations).toHaveLength(1)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      saved.getByRole("button", { name: "Back to topics", exact: true }).click())
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(4)
    const created = page.locator("[data-sf-topic-list] [data-sf-topic]").filter({ hasText: newTopic })
    await originalReads(page, owner, [{ path: "/api/ui/pages/CAP02" }, ...references], () =>
      created.getByRole("button", { name: "View details", exact: true }).click())
    const detail = page.locator("[data-sf-topic-detail]")
    await expect(detail.getByRole("heading", { name: newTopic, exact: true })).toBeVisible()
    await expect(detail).toContainText(topicNotes)
    await scrollPageTop(page)
    await capture(page, info, "CAP02-dark-desktop-detail-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    const related = detail.locator(".sf-topics-related select")
    await expect(related).toBeEnabled()
    await expect(related).toContainText(installation.riskName)
    await related.focus()
    await expect(related).toBeFocused()
    await expect(related).toBeInViewport({ ratio: 1 })
    await capture(page, info, "CAP02-dark-320-related-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await detail.getByRole("button", { name: "Delete topic", exact: true }).click()
    const deletion = detail.locator('[data-component="sf-change-review"]')
    await expect(deletion.getByRole("button", { name: "Delete topic", exact: true })).toBeEnabled()
    await deletion.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(deletion).toHaveCount(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      detail.getByRole("button", { name: "Edit topic", exact: true }).click())
    const existing = page.locator("[data-sf-topic-editor]")
    await expect(existing.getByLabel("Action", { exact: true })).toHaveValue(newTopic)
    await existing.getByLabel("Notes", { exact: true }).fill(topicNotes + " Rascunho de edição.")
    await existing.getByRole("button", { name: "Review save", exact: true }).click()
    await expect(existing.locator('[data-component="sf-change-review"]')).toContainText("Rascunho de edição.")
    await reviewActions(page)
    await capture(page, info, "CAP02-dark-desktop-existing-review-test-data")
    await existing.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(existing.getByLabel("Notes", { exact: true })).toHaveValue(topicNotes + " Rascunho de edição.")
    await existing.getByRole("button", { name: "Discard draft", exact: true }).click()
    await expect(existing.getByLabel("Notes", { exact: true })).toHaveValue(topicNotes)
    expect(mutations).toHaveLength(1)
    const updatedNotes = topicNotes + " Revisão confirmada na instalação de teste."
    await existing.getByLabel("Notes", { exact: true }).fill(updatedNotes)
    await existing.getByRole("button", { name: "Review save", exact: true }).click()
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      existing.getByRole("button", { name: "Confirm save", exact: true }).click())
    await expect(saved.locator('[data-topic-feedback="saved"]')).toBeVisible()
    await expect(existing).toHaveCount(0)
    expect(mutations).toHaveLength(2)
    await scrollPageTop(page)
    await capture(page, info, "CAP02-dark-desktop-saved-test-data")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      saved.getByRole("button", { name: "Back to topics", exact: true }).click())
    await expect(page.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(4)
    await originalReads(page, owner, [{ path: "/api/ui/pages/CAP02" }, ...references], () =>
      page.locator("[data-sf-topic-list] [data-sf-topic]").filter({ hasText: newTopic })
        .getByRole("button", { name: "View details", exact: true }).click())
    await expect(detail).toContainText(updatedNotes)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP02" }, () =>
      detail.getByRole("button", { name: "Edit topic", exact: true }).click())
    await expect(existing.getByLabel("Notes", { exact: true })).toHaveValue(updatedNotes)
    await expect(existing.getByRole("button", { name: "Review save", exact: true })).toBeEnabled()
  })
  await finishWaveTwoCheck(info, check, installation, ["CAP02"], 2, ["en-US"])
})

waveTwoTest("installed native second-wave design · Portuguese topic source detail and retained draft", async ({ page, browser, installation, owner }, info) => {
  const check = beginWaveTwoCheck(page, installation, owner, info)
  await withPortuguese(page, browser, installation, info, check, async (localized) => {
    const context = await check.enter(screens[0], localized, true)
    const references = topicReferenceReads(context)
    await scheme(localized, "dark")
    await capture(localized, info, "CAP02-pt-BR-dark-desktop-test-data")
    await originalReads(localized, owner, [{ path: "/api/ui/pages/CAP02" }, ...references], () =>
      localized.locator("[data-sf-topic-list] [data-sf-topic]").filter({ hasText: installation.topicName })
        .getByRole("button", { name: "Ver detalhes", exact: true }).click())
    await expect(localized.locator("[data-sf-topic-detail]")).toBeVisible()
    await expect(localized.locator("[data-sf-topic-detail]").getByRole("heading", { name: installation.topicName, exact: true })).toBeVisible()
    await scrollPageTop(localized)
    await capture(localized, info, "CAP02-pt-BR-dark-desktop-detail-test-data")
    await originalRead(localized, owner, { path: "/api/ui/pages/CAP02" }, () =>
      localized.getByRole("button", { name: "Voltar aos tópicos", exact: true }).click())
    await expect(localized.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(3)
    await originalRead(localized, owner, { path: "/api/ui/pages/CAP02" }, () =>
      localized.getByRole("button", { name: "Novo tópico", exact: true }).click())
    await fillTopic(localized, installation.year, true)
    await scrollPageTop(localized)
    await capture(localized, info, "CAP02-pt-BR-dark-desktop-editor-test-data")
    await localized.getByRole("button", { name: "Revisar salvamento", exact: true }).click()
    await reviewActions(localized)
    await capture(localized, info, "CAP02-pt-BR-dark-desktop-review-test-data")
    await localized.getByRole("button", { name: "Cancelar revisão", exact: true }).click()
    await localized.getByRole("button", { name: "Descartar rascunho", exact: true }).click()
    await expect(localized.getByLabel("Ação", { exact: true })).toHaveValue("")
  })
  await finishWaveTwoCheck(info, check, installation, ["CAP02"], 0, ["pt-BR"])
})

waveTwoTest("installed native second-wave design · budget source scope and localized before-after review", async ({ page, browser, installation, owner }, info) => {
  const check = beginWaveTwoCheck(page, installation, owner, info)
  const mutations = check.mutations
  await check.enter(screens[1])
  await captureCollection(page, info, screens[1])
  await page.setViewportSize({ width: 1440, height: 1100 })
  await waveTwoTest.step("budget source scope and annual editor review preserve the source", async () => {
    await scheme(page, "dark")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP03", query: { year: String(installation.year) } }, () =>
      page.getByLabel("Year", { exact: true }).selectOption(String(installation.year)))
    await expect(page.locator('[data-sf-metric="budget"]')).toHaveAttribute("data-sf-scope", "unscoped")
    await expect(page.locator('[data-sf-metric="revenue"]')).toContainText("2,400,000")
    await scrollPageTop(page)
    await capture(page, info, "CAP03-dark-desktop-annual-test-data")
    await page.locator("summary").filter({ hasText: "Edit current month" }).click()
    const month = page.locator('[data-sf-u02-edit="save-month"]')
    await expect(month.getByLabel("Current month", { exact: true })).toHaveValue("6")
    await month.getByLabel("Current month", { exact: true }).fill("7")
    await month.getByRole("button", { name: "Review source change", exact: true }).click()
    const review = month.locator('[data-component="sf-change-review"]')
    await expect(review.getByRole("button", { name: "Confirm save", exact: true })).toBeEnabled()
    await expect(month.getByRole("textbox", { name: "Current month", exact: true })).toBeHidden()
    const disclosure = page.locator('.sf-budget-input:has([data-sf-u02-edit="save-month"]) .sf-budget-edit > summary')
    await disclosure.click()
    await expect(review).toBeHidden()
    await expect(page.locator('[data-sf-metric="current-month"]')).toBeVisible()
    await expect(page.locator('[data-sf-metric="revenue"]')).toBeVisible()
    await expect(page.locator('[data-sf-metric="current-month"]')).toContainText("6")
    await expect(page.locator('[data-sf-metric="revenue"]')).toContainText("2,400,000")
    await disclosure.click()
    await expect(review.getByRole("region", { name: "Current month", exact: true })
      .locator('[data-version="proposed"] .sf-s03-field-value')).toHaveText("July " + installation.year)
    await expect(review.getByRole("region", { name: "Current month", exact: true })
      .locator('[data-version="base"] .sf-s03-field-value')).toHaveText("June " + installation.year)
    await expect(review.getByRole("region", { name: "Current month", exact: true })
      .locator('[data-version="current"] .sf-s03-field-value')).toHaveText("June " + installation.year)
    await reviewActions(page)
    await capture(page, info, "CAP03-dark-desktop-review-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "CAP03-dark-320-review-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(month.getByLabel("Current month", { exact: true })).toHaveValue("7")
    await month.getByRole("button", { name: "Discard draft", exact: true }).click()
    await expect(month.getByLabel("Current month", { exact: true })).toHaveValue("6")
    await page.locator("summary").filter({ hasText: "Edit revenue" }).click()
    const revenue = page.locator('[data-sf-u02-edit="save-revenue"]')
    await expect(revenue.getByLabel("Annual revenue", { exact: true })).toHaveValue("2400000")
    await revenue.getByLabel("Annual revenue", { exact: true }).fill("2600000")
    await revenue.getByRole("button", { name: "Review source change", exact: true }).click()
    const revenueReview = revenue.locator('[data-component="sf-change-review"]')
    await expect(revenueReview).toContainText("2,600,000")
    await expect(revenueReview.locator('[data-version="base"] .sf-s03-field-value')).toContainText("2,400,000")
    await expect(revenueReview.locator('[data-version="current"] .sf-s03-field-value')).toContainText("2,400,000")
    await expect(revenueReview.locator('[data-version="proposed"] .sf-s03-field-value')).toContainText("Source currency not specified")
    await revenueReview.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(revenue.getByLabel("Annual revenue", { exact: true })).toHaveValue("2600000")
    await revenue.getByRole("button", { name: "Discard draft", exact: true }).click()
    await expect(revenue.getByLabel("Annual revenue", { exact: true })).toHaveValue("2400000")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP03" }, () =>
      page.getByLabel("Year", { exact: true }).selectOption(""))
    await expect(page.locator('[data-sf-metric="budget"]')).toHaveAttribute("data-sf-value", "number")
    await expect(page.getByLabel("Year", { exact: true })).toHaveValue("")
    await expect(page).toHaveURL((url) => !url.searchParams.has("year") && url.searchParams.get("installation") === owner.installationId)
    expect(mutations).toHaveLength(0)
  })

  await withPortuguese(page, browser, installation, info, check, async (localized) => {
    await check.enter(screens[1], localized, true)
    await scheme(localized, "dark")
    await capture(localized, info, "CAP03-pt-BR-dark-desktop-test-data")
    await originalRead(localized, owner, { path: "/api/ui/pages/CAP03", query: { year: String(installation.year) } }, () =>
      localized.getByLabel("Ano", { exact: true }).selectOption(String(installation.year)))
    await expect(localized.locator('[data-sf-metric="revenue"]')).toContainText("2.400.000")
    await localized.locator("summary").filter({ hasText: "Editar mês corrente" }).click()
    const month = localized.locator('[data-sf-u02-edit="save-month"]')
    await month.getByLabel("Mês atual", { exact: true }).fill("7")
    await scrollPageTop(localized)
    await capture(localized, info, "CAP03-pt-BR-dark-desktop-editor-test-data")
    await month.getByRole("button", { name: "Revisar alteração da fonte", exact: true }).click()
    const localizedMonth = month.getByRole("region", { name: "Mês atual", exact: true })
    await expect(localizedMonth.locator('[data-version="base"] .sf-s03-field-value')).toHaveText("junho de " + installation.year)
    await expect(localizedMonth.locator('[data-version="current"] .sf-s03-field-value')).toHaveText("junho de " + installation.year)
    await expect(localizedMonth.locator('[data-version="proposed"] .sf-s03-field-value')).toHaveText("julho de " + installation.year)
    await reviewActions(localized)
    await capture(localized, info, "CAP03-pt-BR-dark-desktop-review-test-data")
    await month.getByRole("button", { name: "Cancelar revisão", exact: true }).click()
    await month.getByRole("button", { name: "Descartar rascunho", exact: true }).click()
    await expect(month.getByLabel("Mês atual", { exact: true })).toHaveValue("6")
  })
  await finishWaveTwoCheck(info, check, installation, ["CAP03"], 0, ["en-US","pt-BR"])
})

waveTwoTest("installed native second-wave design · OPEX source write and localized complete periods", async ({ page, browser, installation, owner }, info) => {
  const check = beginWaveTwoCheck(page, installation, owner, info)
  const mutations = check.mutations
  await check.enter(screens[2])
  await captureCollection(page, info, screens[2])
  await page.setViewportSize({ width: 1440, height: 1100 })
  await waveTwoTest.step("OPEX detail, preserved monthly draft and one genuine confirmed write", async () => {
    await scheme(page, "dark")
    const filter = page.getByLabel("Name", { exact: true })
    await filter.fill("no matching test record")
    await expect(page.locator('[data-sf-budget="CAP04"] tr[data-sf-row]')).toHaveCount(0)
    await filter.fill("")
    await page.getByRole("button", { name: "New line", exact: true }).click()
    const lineEditor = page.locator('.sf-budget-editor[data-sf-action="save"]')
    await lineEditor.getByLabel("Owner name", { exact: true }).fill("Dados de teste · Planejamento regional")
    await lineEditor.getByLabel("Annual budget", { exact: true }).fill("72000")
    await reflow(page)
    await scrollPageTop(page)
    await capture(page, info, "CAP04-dark-desktop-new-line-test-data")
    await lineEditor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(lineEditor.locator('[data-component="sf-change-review"]')).toContainText("72,000")
    await lineEditor.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(lineEditor.getByLabel("Owner name", { exact: true })).toHaveValue("Dados de teste · Planejamento regional")
    await lineEditor.getByRole("button", { name: "Discard draft", exact: true }).click()
    await lineEditor.getByRole("group", { name: "Discard the draft and change context?", exact: true })
      .getByRole("button", { name: "Discard draft", exact: true }).click()
    await expect(lineEditor).toHaveCount(0)
    await expect(page.locator('[data-sf-budget="CAP04"] tr[data-sf-row]')).toHaveCount(3)
    const row = page.locator('[data-sf-budget="CAP04"] tr[data-sf-row]').filter({ hasText: installation.opexName })
    await row.getByRole("button", { name: "Open record", exact: true }).click()
    const detail = page.locator("[data-sf-opex-detail]")
    await expect(detail).toBeVisible()
    await expect(detail.getByRole("heading", { name: installation.opexName, exact: true })).toBeVisible()
    const january = detail.locator('tr[data-sf-month="1"]')
    await expect(january).toContainText("14,200")
    await expect(detail.locator('tr[data-sf-month="7"]')).toContainText("Not available")
    await scrollPageTop(page)
    await capture(page, info, "CAP04-dark-desktop-detail-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await scrollPageTop(page)
    await capture(page, info, "CAP04-dark-320-detail-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await readablePeriods(page, info, installation.year, false)
    await january.getByRole("button", { name: "Save month", exact: true }).click()
    const editor = page.locator('.sf-budget-editor[data-sf-action="save-entry"]')
    await expect(editor.getByLabel("Month", { exact: true })).toHaveValue("January " + installation.year)
    await expect(editor.getByLabel("Budget", { exact: true })).toHaveValue("15000")
    await expect(editor.getByLabel("Actual", { exact: true })).toHaveValue("12400")
    await expect(editor.getByLabel("Forecast", { exact: true })).toHaveValue("14200")
    await editor.getByLabel("Forecast", { exact: true }).fill("14600")
    await scrollPageTop(page)
    await capture(page, info, "CAP04-dark-desktop-editor-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = editor.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText("14,600")
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Forecast", { exact: true })).toHaveValue("14600")
    await expect(editor.getByLabel("Actual", { exact: true })).toHaveValue("12400")
    await editor.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await january.getByRole("button", { name: "Save month", exact: true }).click()
    await expect(editor.getByLabel("Forecast", { exact: true })).toHaveValue("14600")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await reviewActions(page)
    await capture(page, info, "CAP04-dark-desktop-review-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "CAP04-dark-320-review-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    expect(mutations).toHaveLength(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP04" }, () =>
      review.getByRole("button", { name: "Save", exact: true }).click())
    await expect(editor).toHaveCount(0)
    await expect(january).toContainText("14,600")
    expect(mutations).toHaveLength(1)
  })

  await withPortuguese(page, browser, installation, info, check, async (localized) => {
    await check.enter(screens[2], localized, true)
    await scheme(localized, "dark")
    await capture(localized, info, "CAP04-pt-BR-dark-desktop-test-data")
    await localized.locator('tr[data-sf-row]').filter({ hasText: installation.opexName })
      .getByRole("button", { name: "Abrir registro", exact: true }).click()
    await expect(localized.locator('[data-sf-opex-detail] tr[data-sf-month="1"]')).toContainText("14.600")
    await scrollPageTop(localized)
    await capture(localized, info, "CAP04-pt-BR-dark-desktop-detail-test-data")
    await readablePeriods(localized, info, installation.year, true)
    await localized.locator('tr[data-sf-month="1"]').getByRole("button", { name: "Salvar mês", exact: true }).click()
    const opex = localized.locator('.sf-budget-editor[data-sf-action="save-entry"]')
    await expect(opex.getByLabel("Mês", { exact: true })).toHaveValue("janeiro de " + installation.year)
    await expect.poll(() => opex.getByLabel("Mês", { exact: true }).evaluate((input) => input.scrollWidth - input.clientWidth), {
      message: "the complete localized read-only period fits inside its field",
    }).toBeLessThanOrEqual(1)
    await opex.getByLabel("Previsão", { exact: true }).fill("14800")
    await scrollPageTop(localized)
    await capture(localized, info, "CAP04-pt-BR-dark-desktop-editor-test-data")
    await opex.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await reviewActions(localized)
    await capture(localized, info, "CAP04-pt-BR-dark-desktop-review-test-data")
    await opex.getByRole("button", { name: "Revisar", exact: true }).click()
    await expect(opex.getByLabel("Previsão", { exact: true })).toHaveValue("14800")
  })
  await finishWaveTwoCheck(info, check, installation, ["CAP04"], 1, ["en-US","pt-BR"])
})

function beginWaveTwoCheck(page: Page, installation: DesignInstallation, owner: SfInstallationDescriptor, info: TestInfo) {
  // Each independent source journey keeps the original deadline and fixture.
  waveTwoTest.setTimeout(240_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle, "use the existing production runner").toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const sourceOrigins = new Set<string>()
  const watch = (target: Page) => target.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith(installation.mount + "/")) sourceOrigins.add(url.origin)
    if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/"))
      mutations.push(url.pathname)
  })
  watch(page)
  const href = (pathname: string) => {
    const url = new URL(pathname, installation.origin)
    url.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: installation.origin } }))
    url.searchParams.set("project", owner.projectId)
    url.searchParams.set("installation", owner.installationId)
    return url.href
  }
  const enter = async (screen: typeof screens[number], target = page, portuguese = false, topics = 3) => {
    const admitted = await originalReads(target, owner, [
      { path: "/api/ui/context" }, { path: "/api/ui/pages/" + screen.id },
    ], () => target.goto(href(screen.path)))
    const context = (admitted.receipts[0]!.body as { value: SfContext }).value
    expect(context.stamp).toMatchObject({
      installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
    })
    await ready(target, portuguese ? screen.br : screen.title)
    await expect(target).toHaveURL((url) => url.origin === installation.origin && url.pathname === screen.path &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    if (screen.id === "CAP02") {
      await expect(target.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(topics)
      await expect(target.locator("[data-sf-topic-list]")).toContainText(installation.topicName)
    }
    if (screen.id === "CAP03") {
      await expect(target.locator('[data-sf-surface="CAP03"] [data-sf-metric="budget"]')).toHaveAttribute("data-sf-value", "number")
      await expect(target.locator('[data-sf-surface="CAP03"] [data-sf-metric="forecast"]')).toHaveAttribute("data-sf-value", "number")
    }
    if (screen.id === "CAP04") {
      await expect(target.locator('[data-sf-budget="CAP04"] tr[data-sf-row]')).toHaveCount(3)
      await expect(target.locator('[data-sf-budget="CAP04"] tr[data-sf-row]').filter({ hasText: installation.opexName })).toHaveCount(1)
    }
    await reflow(target)
    await scrollPageTop(target)
    return context
  }
  return { messages, mutations, sourceOrigins, watch, enter }
}

function topicReferenceReads(context: SfContext): readonly OriginalRead[] {
  // The actual F01 response decides which original catalogues the detail will read.
  const capabilities = ["CAP13", "CAP15"].filter((capability) =>
    context.destinations.some((destination) => destination.capabilityId === capability && destination.canRead) &&
    context.availability.some((resource) => resource.operations.some((operation) =>
      operation.operationId === "domain.page." + capability && operation.state === "ready" && operation.operational)))
  expect(capabilities, "the canonical fixture's seeded risk is admitted by its original owner").toContain("CAP13")
  return capabilities.map((capability) => ({ path: "/api/ui/pages/" + capability }))
}

async function captureCollection(page: Page, info: TestInfo, screen: typeof screens[number]) {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await capture(page, info, screen.id + "-dark-desktop-test-data")
  await page.setViewportSize({ width: 1440, height: 800 })
  await reflow(page)
  await capture(page, info, screen.id + "-dark-1440x800-test-data")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "light")
  await capture(page, info, screen.id + "-light-desktop-test-data")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await expect(page.locator('[data-sf-source-navigation="sf-dashboard"] a[aria-current="page"]')).toBeInViewport({ ratio: 1 })
  await scrollPageTop(page)
  await capture(page, info, screen.id + "-light-320-test-data")
}

async function withPortuguese(
  page: Page, browser: Browser, installation: DesignInstallation, info: TestInfo,
  check: ReturnType<typeof beginWaveTwoCheck>, action: (localized: Page) => Promise<void>,
) {
  const localizedCookies = await page.context().cookies(installation.origin + installation.mount)
  expect(localizedCookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name)).length).toBe(1)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies: localizedCookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const localizedMessages = observePage(localized)
    check.watch(localized)
    await action(localized)
    expect(localizedMessages.pageErrors).toEqual([])
    await info.attach("native-wave-two-localized-diagnostics", { body: JSON.stringify(localizedMessages, null, 2), contentType: "application/json" })
  } finally {
    await portuguese.close()
  }
}

async function finishWaveTwoCheck(
  info: TestInfo, check: ReturnType<typeof beginWaveTwoCheck>, installation: DesignInstallation,
  views: readonly string[], writes: number, locales: readonly string[],
) {
  expect([...check.sourceOrigins]).toEqual([installation.origin])
  expect(check.mutations).toHaveLength(writes)
  expect(check.messages.pageErrors).toEqual([])
  await info.attach("native-wave-two-evidence", {
    body: JSON.stringify({ source: "isolated canonical producer data and original browser-confirmed commands",
      views, widths: [1440, 320], heights: [1100, 800, 900],
      schemes: ["dark", "light"], locales, actualBrowserZoom: "not measured",
      writes: check.mutations.length, ...check.messages }, null, 2),
    contentType: "application/json",
  })
}

async function readablePeriods(page: Page, info: TestInfo, year: number, br: boolean) {
  const months = [
    { month: 1, label: br ? "janeiro de " : "January " },
    { month: 9, label: br ? "setembro de " : "September " },
    { month: 12, label: br ? "dezembro de " : "December " },
  ]
  for (const period of months) {
    await page.locator('tr[data-sf-month="' + period.month + '"]')
      .getByRole("button", { name: br ? "Salvar mês" : "Save month", exact: true }).click()
    const editor = page.locator('.sf-budget-editor[data-sf-action="save-entry"]')
    const field = editor.getByLabel(br ? "Mês" : "Month", { exact: true })
    await expect(field).toHaveValue(period.label + year)
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 900 : 1100 })
      await reflow(page)
      await field.scrollIntoViewIfNeeded()
      await expect(field).toBeInViewport()
      await expect.poll(() => field.evaluate((input) => input.scrollWidth - input.clientWidth), {
        message: "the complete read-only month and year fit at " + width + "px",
      }).toBeLessThanOrEqual(1)
      if (period.month === 9)
        await capture(page, info, "CAP04-" + (br ? "pt-BR" : "en-US") + "-dark-" + width + "-complete-period-test-data")
    }
    await editor.getByRole("button", { name: br ? "Cancelar" : "Cancel", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1100 })
  }
}

async function fillTopic(page: Page, year: number, br: boolean) {
  const editor = page.locator("[data-sf-topic-editor]")
  await editor.getByLabel(br ? "Ação" : "Action", { exact: true }).fill(newTopic)
  await editor.getByLabel(br ? "Responsável" : "Owner", { exact: true }).fill("Operações regionais")
  await editor.getByLabel(br ? "Prazo" : "Due date", { exact: true }).fill(year + "-12-22")
  await editor.getByLabel(br ? "Situação" : "Status", { exact: true }).selectOption("open")
  await editor.getByLabel(br ? "Prioridade" : "Priority", { exact: true }).selectOption("high")
  await editor.getByLabel(br ? "Notas" : "Notes", { exact: true }).fill(topicNotes)
}
