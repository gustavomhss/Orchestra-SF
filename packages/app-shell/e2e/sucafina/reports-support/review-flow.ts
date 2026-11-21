import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import type { APIRequestContext, APIResponse, Page, TestInfo, Request, Response, ConsoleMessage, Route } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { object, projection, readReview, review, text } from "./model.ts"
import { inspectReport, officePackageText } from "./ooxml.ts"

const reportPages = ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"] as const
const reportPageTopics = {
  "Budget Overview": "budget",
  "Portfolio Dashboard": "projects",
  "Hot Topics & Actions": "hot-topics",
} as const
type PreservedSection = PreservedReview["sections"][number]

export async function prepareReview(page: Page, app: ReportsInstallation, corpus: ReportsCorpus, info: TestInfo, options: { removeOne?: boolean } = {}) {
  const year = String(corpus.year)
  const budgetURL = `/orchestra/sf-dashboard/budget?${new URLSearchParams({ year })}`
  // The link belongs to CAP03's ready content, which follows the authorized Budget read.
  await observeBudgetPage(page, app, corpus.year, () => page.goto(budgetURL))
  const reportsEntry = page.getByRole("link", { name: "Reports and backup", exact: true })
  await expect(reportsEntry).toBeVisible()
  await expect(reportsEntry).toHaveAttribute("href", "/orchestra/sf-reviews/agenda")
  await reportsEntry.click()
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda).toBeVisible()
  const selectedRows = agenda.locator("[data-sf-agenda-order] > li")
  const sectionIds: string[] = []
  for (const pageName of reportPages) {
    await agenda.getByLabel(/Source dashboard page|Página de origem do dashboard/).fill(pageName)
    const { response, body: discovered } = await observeOriginalJson(page, new URL(`${app.mount}/api/ui/projections/review`, app.origin),
      "GET", (url) => url.searchParams.getAll("page").length === 1 && url.searchParams.get("page") === pageName,
      () => agenda.getByRole("button", { name: /Find authorized sections|Buscar seções autorizadas/ }).click())
    expect(response.status).toBe(200)
    expect(discovered.status).toBe("ok")
    const items = object(discovered.value).items
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(1)
    const discoveredSection = object((items as unknown[])[0])
    expect(discoveredSection.topic).toBe(reportPageTopics[pageName])
    const sectionId = text(discoveredSection.id)
    sectionIds.push(sectionId)
    const add = agenda.getByRole("button", { name: /Add to agenda|Adicionar à pauta/ })
    await expect(add).toHaveCount(1)
    await expect(add).toBeEnabled()
    await add.click()
    await expect(selectedRows.last()).toHaveAttribute("data-section-id", sectionId)
    await expect(selectedRows.last().locator("strong")).toHaveText(reportPageTopics[pageName])
  }
  await expect(selectedRows).toHaveCount(reportPages.length)
  await expect(selectedRows.locator("strong")).toHaveText(reportPages.map((pageName) => reportPageTopics[pageName]))
  expect(await selectedRows.evaluateAll((items) => items.map((item) => item.getAttribute("data-section-id")))).toEqual(sectionIds)
  const preview = page.getByRole("button", { name: /Review selected sections|Revisar seções selecionadas/ })
  await expect(preview).toBeEnabled()
  const agendaResponse = await observeOriginalJson(page, new URL(app.dashboardURL), "POST",
    (url) => url.searchParams.get("sf") === "dashboard-agenda", () => preview.click())
  const original = dashboardAgendaResult(agendaResponse)
  expect(original.sections.map((section) => text(section.id))).toEqual(sectionIds)
  const projectsIndex = reportPages.indexOf("Portfolio Dashboard")
  const hotTopicsIndex = reportPages.indexOf("Hot Topics & Actions")
  expect(original.sections[projectsIndex]!.recordCount).toBe(25)
  expect(original.sections[hotTopicsIndex]!.recordCount).toBe(0)
  const shown = agenda.locator("[data-sf-agenda-preview]")
  await expect(shown).toBeVisible()
  await expect(shown.locator("ol > li").nth(projectsIndex)).toContainText(/Authorized records: 25|Registros autorizados: 25/)
  await expect(shown.locator("ol > li").nth(hotTopicsIndex)).toContainText(/Authorized records: 0|Registros autorizados: 0/)
  const prepared = options.removeOne ? await removeOneProject(page, app, agendaResponse.response.request, original, projectsIndex) : original
  const { selectionRef } = prepared
  const counts = prepared.sections.map((section) => section.recordCount)
  const confirm = agenda.getByRole("button", { name: /Confirm preservation|Confirmar preservação/ })
  await expect(confirm).toBeEnabled()
  const { response, body } = await observeOriginalJson(page, new URL(app.dashboardURL), "POST",
    (url) => url.searchParams.get("sf") === "dashboard-review-preserve", () => confirm.click())
  expect(response.status).toBe(200)
  expect(object(response.request.postDataJSON())).toEqual({ selectionRef, sectionRefs: sectionIds })
  expect(body.status).toBe("ok")
  const saved = review(body.value)
  expect(saved.sections.map((section) => section.id)).toEqual(sectionIds)
  expect(saved.sections.map((section) => section.count)).toEqual(counts)
  const budgetSections = saved.sections.filter((section) => section.id === sectionIds[reportPages.indexOf("Budget Overview")])
  expect(budgetSections).toHaveLength(1)
  const budgetSection = budgetSections[0]!
  const savedProjects = saved.sections[projectsIndex]!
  expect(savedProjects.count).toBe(options.removeOne ? 24 : 25)
  if (options.removeOne) {
    const values = (section: unknown) => projection(section).values.map(({ id, value, period }) => ({ id, value, period }))
    expect(values(savedProjects.content)).toEqual(values(prepared.sections[projectsIndex]!.projection))
  }
  const confirmed = agenda.locator("[data-sf-preserved-confirmed]")
  await expect(confirmed).toBeVisible()
  await expect(confirmed.locator("dd").first()).toHaveText(saved.id)
  const preservedPath = "/orchestra/sf-reviews/reviews/" + encodeReviewRef(saved.id)
  const openReview = confirmed.getByRole("link", { name: /^(Open preserved review|Abrir revisão preservada)$/ })
  await observePreservedReview(page, app, saved, () => openReview.click())
  await expect(page).toHaveURL((url) => url.origin === app.origin && url.pathname === preservedPath)
  const preparation = page.locator('[data-sf-surface="UI48"]')
  await expect(preparation).toBeVisible()
  const article = preparation.locator(`[data-review-ref="${saved.id}"]`)
  await expect(article).toBeVisible()
  await expect(article.locator("dd").first()).toHaveText(saved.id)
  for (const section of saved.sections) {
    const row = article.locator(`[data-section-id="${section.id}"]`)
    await expect(row.locator("h3")).toHaveText(section.title)
    await expect(row).toContainText(String(section.count))
  }
  await info.attach("preserved-selection", { body: JSON.stringify({ selectionRef, sectionRefs: sectionIds, saved, removeOne: options.removeOne ?? false }, null, 2), contentType: "application/json" })
  return { preparation, saved, budgetSection }
}

function dashboardAgendaResult({ response, body }: Awaited<ReturnType<typeof observeOriginalJson>>) {
  expect(response.status).toBe(200)
  expect(response.headers["cache-control"]).toContain("no-store")
  expect(body.status).toBe("ok")
  const value = object(body.value)
  expect(Array.isArray(value.sections)).toBe(true)
  return { selectionRef: text(value.selectionRef), sections: (value.sections as unknown[]).map(object) }
}

async function removeOneProject(page: Page, app: ReportsInstallation, originalRequest: Request,
  selected: ReturnType<typeof dashboardAgendaResult>, projectIndex: number) {
  const section = selected.sections[projectIndex]!
  expect(Array.isArray(section.recordRefs)).toBe(true)
  const refs = (section.recordRefs as unknown[]).map(text)
  expect(refs).toHaveLength(25)
  expect(new Set(refs).size).toBe(25)
  const reference = refs[0]!
  const remaining = refs.slice(1)
  const agenda = page.locator('[data-sf-surface="UI47"]')
  const projectRow = agenda.locator("[data-sf-agenda-preview] ol > li").nth(projectIndex)
  await projectRow.locator("summary").click()
  const removal = await observeOriginalJson(page, new URL(app.dashboardURL), "POST",
    (url) => url.searchParams.get("sf") === "dashboard-agenda",
    () => projectRow.getByRole("button", { name: new RegExp(`^(Remove record|Remover registro) ${reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click())
  const retained = dashboardAgendaResult(removal)
  const originalSections = (object(originalRequest.postDataJSON()).sections as unknown[]).map(object)
  expect(object(removal.response.request.postDataJSON())).toEqual({ sections: originalSections.map((entry, index) =>
    index === projectIndex ? { ...entry, recordRefs: remaining } : entry) })
  expect(retained.selectionRef).not.toBe(selected.selectionRef)
  expect(retained.sections.map((entry) => entry.id)).toEqual(selected.sections.map((entry) => entry.id))
  expect(retained.sections.map((entry) => entry.recordRefs)).toEqual(selected.sections.map((entry, index) =>
    index === projectIndex ? remaining : entry.recordRefs))
  const after = retained.sections[projectIndex]!
  expect(after.recordCount).toBe(24)
  const beforeValues = projection(section.projection).values
  const afterValues = projection(after.projection).values
  const beforeIds = beforeValues.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  const afterIds = afterValues.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  expect(beforeIds).toHaveLength(25)
  expect(afterIds).toHaveLength(24)
  const removed = beforeIds.filter((value) => !afterIds.some((current) => current.id === value.id))
  expect(removed).toHaveLength(1)
  const prefix = removed[0]!.id.slice(0, -2)
  expect(afterValues.map((value) => ({ id: value.id, value: value.value, period: value.period }))).toEqual(
    beforeValues.filter((value) => !value.id.startsWith(prefix))
      .map((value) => ({ id: value.id, value: value.value, period: value.period })),
  )
  await expect(projectRow).toContainText(/Authorized records: 24|Registros autorizados: 24/)
  await expect(agenda.getByText(/Selection refreshed\. Check the new counts before preserving\.|Seleção atualizada\. Confira as novas contagens antes de preservar\./)).toBeVisible()
  return retained
}

export async function readSourceData(request: APIRequestContext, app: ReportsInstallation) {
  const response = await request.get(`${app.dashboardURL}?download=json`, { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const data = object(await response.json())
  return { projects: data.projects, opexOwners: data.opexOwners, opexEntries: data.opexEntries, hotTopics: data.hotTopics }
}

export async function preserveNewRevision(page: Page, app: ReportsInstallation, prior: PreservedReview, corpus: ReportsCorpus) {
  const preserved = page.locator('[data-sf-surface="UI48"]')
  const save = preserved.getByRole("button", { name: "Confirm preservation", exact: true })
  await expect(save).toHaveCount(0)
  const { response: update, body: updated } = await observeOriginalJson(page, new URL(app.dashboardURL), "GET",
    (url) => url.searchParams.get("sf") === "review-update" && url.searchParams.get("reviewRef") === prior.id,
    () => preserved.getByRole("button", { name: "Check whether a new review can be prepared", exact: true }).click())
  expect(update.status).toBe(200)
  expect(updated).toMatchObject({ status: "ok", value: { previousReviewRef: prior.id, available: true, confirmations: [], unavailableSections: [] } })
  const sectionRefs = prior.sections.map((section) => section.id)
  const items = (object(updated.value).items as unknown[]).map(object)
  expect(items.map((item) => item.id)).toEqual(sectionRefs)
  const prepare = preserved.getByRole("button", { name: "Prepare current data as a new revision", exact: true })
  await expect(prepare).toBeEnabled()
  const revision = await observeOriginalJson(page, new URL(app.dashboardURL), "POST",
    (url) => url.searchParams.get("sf") === "dashboard-agenda", () => prepare.click())
  expect(revision.response.request.postDataJSON()).toEqual({ sections: items.map((item, index) => ({
    id: item.id, title: prior.sections[index]!.title, topic: item.topic, period: item.period, selectionRef: item.selectionRef, recordRefs: item.recordRefs,
  })) })
  const selected = dashboardAgendaResult(revision)
  expect(selected.sections.flatMap((section) => projection(section.projection).values).filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.after, period: corpus.annual }])
  const projectSectionRef = prior.sections.find((section) => sectionMatchesPage(section, "Portfolio Dashboard"))!.id
  const projects = selected.sections.filter((section) => section.id === projectSectionRef)
  expect(projects.map((section) => section.recordCount)).toEqual([24])
  expect(selected.sections.map((section) => section.recordRefs)).toEqual(items.map((item) => item.recordRefs))
  expect(selected.sections.map((section) => section.id)).toEqual(sectionRefs)
  const projectIds = (values: ReturnType<typeof projection>["values"]) => values
    .filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id)).map((value) => value.id).sort()
  const priorProjectIds = projectIds(projection(prior.sections.find((section) => section.id === projectSectionRef)!.content).values)
  expect(priorProjectIds).toHaveLength(24)
  expect(new Set(priorProjectIds).size).toBe(24)
  expect(projectIds(projection(projects[0]!.projection).values)).toEqual(priorProjectIds)
  const priorBudget = prior.sections.filter((section) => projection(section.content).values.some((value) => value.id === corpus.forecastField))
  expect(priorBudget).toHaveLength(1)
  expect(projection(priorBudget[0]!.content).values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.before, period: corpus.annual }])
  const preview = preserved.getByRole("region", { name: "New revision preview", exact: true })
  const budgetPreview = preview.locator(`[data-revision-section="${priorBudget[0]!.id}"]`)
  await budgetPreview.getByText(priorBudget[0]!.title, { exact: true }).click()
  const forecast = budgetPreview.locator("dl > div").filter({ has: page.getByText(corpus.forecastField, { exact: true }) })
  await expect(forecast).toBeVisible()
  await expect(forecast.locator("dd .sf-numeric")).toContainText(await formatReviewNumber(page, corpus.after, 2))
  await expect(save).toBeEnabled()
  const { response, body } = await observeOriginalJson(page, new URL(app.dashboardURL), "POST",
    (url) => url.searchParams.get("sf") === "dashboard-review-preserve", () => save.click())
  expect(response.status).toBe(200)
  expect(response.request.postDataJSON()).toEqual({ previousReviewRef: prior.id, selectionRef: selected.selectionRef, sectionRefs })
  expect(body.status).toBe("ok")
  const next = review(body.value)
  expect(next.id).not.toBe(prior.id)
  expect(next.previousReviewRef).toBe(prior.id)
  expect(next.sections.map((section) => section.id)).toEqual(sectionRefs)
  expect(next.sections.map((section) => section.title)).toEqual(prior.sections.map((section) => section.title))
  expect(next.sections.map((section) => section.count)).toEqual(prior.sections.map((section) => section.count))
  expect(projectIds(projection(next.sections.find((section) => section.id === projectSectionRef)!.content).values)).toEqual(priorProjectIds)
  const budget = next.sections.find((section) => section.id === priorBudget[0]!.id)!
  expect(projection(budget.content).values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.after, period: corpus.annual }])
  const confirmed = preserved.locator("[data-sf-revision-confirmed]")
  await expect(confirmed.getByRole("status")).toHaveText("The producer confirmed that the review was preserved.")
  await expect(confirmed.getByRole("link", { name: "Open preserved review", exact: true }))
    .toHaveAttribute("href", new RegExp(`/reviews/${encodeReviewRef(next.id)}\\?`))
  await expect(save).toHaveCount(0)
  expect(await readReview(page.request, app.dashboardURL, prior.id)).toEqual(prior)
  expect(await readReview(page.request, app.dashboardURL, next.id)).toEqual(next)
  return next
}

export async function changeForecast(page: Page, app: ReportsInstallation, corpus: ReportsCorpus) {
  const source = await page.context().newPage()
  const year = String(corpus.year)
  const opexEndpoint = new URL(`${app.mount}/api/ui/pages/CAP04`, app.origin)
  const observeOpexRead = <T>(action: () => Promise<T>) => observeOriginalJson(source, opexEndpoint, "GET",
    (url) => url.searchParams.size === 1 && url.searchParams.get("year") === year, action)
  const mutations: Request[] = []
  const recordMutation = (request: Request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === app.origin &&
        url.pathname === new URL(app.dashboardURL).pathname && !url.searchParams.has("sf") &&
        object(request.postDataJSON()).action === "save-entry") mutations.push(request)
  }
  source.on("request", recordMutation)
  try {
    const { response: loadedResponse, body: loadedBody } = await observeOpexRead(() =>
      source.goto("/orchestra/sf-dashboard/opex/" + encodeReviewRef("reports-opex") + "?" + new URLSearchParams({ year })))
    expect(loadedResponse.status).toBe(200)
    expect(loadedBody.status).toBe("ok")
    const loaded = object(loadedBody.value)
    expect(loaded.capabilityId).toBe("CAP04")
    expect(object(loaded.selection).year).toBe(corpus.year)
    expect(object(loaded.data).opexEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reports-opex-01", ownerId: "reports-opex", month: 1, year: corpus.year, forecast: 110 }),
    ]))
    const versions = object(loaded.versions)
    const version = Number(versions["opexEntries:reports-opex-01"])
    expect(Number.isSafeInteger(version) && version >= 1).toBe(true)
    const month = source.locator('.sf-budget-detail tr[data-sf-month="1"]')
    await expect(month).toHaveCount(1)
    await expect(month.getByRole("button", { name: "Save month", exact: true })).toBeEnabled()
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    const editor = source.locator('section.sf-budget-editor[data-sf-action="save-entry"]')
    const form = editor.locator("form.sf-budget-form")
    await expect(form).toHaveCount(1)
    await expect(form.getByLabel("forecast", { exact: true })).toHaveValue("110")
    await form.getByLabel("forecast", { exact: true }).fill("190")
    await form.getByRole("button", { name: /^(Review changes|Revisar alterações)$/ }).click()
    const confirmation = editor.locator('[data-component="sf-change-review"]')
    await expect(confirmation).toHaveAttribute("data-state", "ready")
    await expect(confirmation.getByRole("heading", { name: /^(Review changes|Revisar alterações)$/ })).toBeVisible()
    const current = confirmation.getByRole("region", { name: /^(Current source|Fonte atual)$/ })
    const proposed = confirmation.getByRole("region", { name: /^(Proposed values|Valores propostos)$/ })
    await expect(current.locator("dl > div").filter({ has: source.getByText("forecast", { exact: true }) }).locator("dd")).toHaveText("110")
    await expect(proposed.locator("dl > div").filter({ has: source.getByText("forecast", { exact: true }) }).locator("dd")).toHaveText("190")
    expect(mutations, "Reviewing the native draft must not write the source").toHaveLength(0)
    await expect(confirmation.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
    const { response: refreshedResponse, body: refreshedBody, actionResult: applyResponse } = await observeOpexRead(() =>
      observeOriginalJson(source, new URL(app.dashboardURL), "POST",
        (url) => !url.searchParams.has("sf") && url.searchParams.get("page") === "OPEX Detail",
        () => confirmation.getByRole("button", { name: "Save", exact: true }).click(),
        (request) => object(request.postDataJSON()).action === "save-entry"))
    expect(applyResponse.response.status).toBe(200)
    expect(object(applyResponse.response.request.postDataJSON())).toMatchObject({
      page: "OPEX Detail", action: "save-entry", id: "reports-opex-01", version,
      values: { ownerId: "reports-opex", year: corpus.year, month: 1, budget: 100, actual: 100, forecast: 190, versions },
    })
    expect(applyResponse.body).toMatchObject({ ok: true })
    expect(refreshedResponse.status).toBe(200)
    expect(refreshedBody.status).toBe("ok")
    const refreshed = object(refreshedBody.value)
    expect(refreshed.capabilityId).toBe("CAP04")
    expect(object(refreshed.selection).year).toBe(corpus.year)
    expect(object(refreshed.versions)["opexEntries:reports-opex-01"]).toBe(version + 1)
    expect(object(refreshed.data).opexEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reports-opex-01", ownerId: "reports-opex", month: 1, year: corpus.year, forecast: 190 }),
    ]))
    expect(mutations, "One explicit confirmation must submit once").toHaveLength(1)
    await expect(editor).toHaveCount(0)
    await expect(month.getByRole("button", { name: "Save month", exact: true })).toBeEnabled()
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    await expect(form.getByLabel("forecast", { exact: true })).toHaveValue("190")
  } finally {
    source.off("request", recordMutation)
    await source.close()
  }
}

export async function exportReview(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus, format: "docx" | "pptx", info: TestInfo) {
  const path = "/orchestra/sf-reviews/reports/" + encodeReviewRef(saved.id)
  const current = new URL(page.url())
  const endpoint = new URL(app.dashboardURL)
  if (current.pathname !== path) {
    const article = page.locator('[data-sf-surface="UI48"]').locator(`article[data-review-ref="${saved.id}"]`)
    const link = article.getByRole("link", { name: /^(Open report export|Abrir exportação do relatório)$/ })
    const href = await link.getAttribute("href")
    expect(href).toBeTruthy()
    const target = new URL(href!, current)
    expect(target.pathname).toBe(path)
    expect(target.origin).toBe(app.origin)
    for (const key of ["server", "project", "installation"]) {
      expect(current.searchParams.get(key)).toBeTruthy()
      expect(target.searchParams.getAll(key)).toEqual(current.searchParams.getAll(key))
    }
    await observePreservedReview(page, app, saved, () => link.click())
    await expect(page).toHaveURL(target.href)
  }
  const report = page.locator('[data-sf-surface="UI50"]')
  await expect(report).toBeVisible()
  await expect(report.locator("[data-preserved-review]")).toHaveAttribute("data-preserved-review", saved.id)
  await expect(report.getByText(/The preserved content was re-read under the current owner\.|O conteúdo preservado foi relido sob o contexto atual\./)).toBeVisible()
  const reportComments = report.getByRole("region", { name: /Preserved notes and comments|Notas e comentários preservados/ })
  await expect(reportComments).toBeVisible()
  for (const comment of saved.comments) await expect(reportComments).toContainText(comment.content)
  const form = report.locator("form.report-form")
  await expect(form).toHaveCount(1)
  const formatField = form.getByRole("combobox", { name: "Format", exact: true })
  await expect(formatField).toBeEnabled()
  await formatField.selectOption(format)
  await expect(formatField).toHaveValue(format)
  const title = form.getByRole("textbox", { name: "Title", exact: true })
  await title.fill("Isolated Reports preserved dossier")
  await expect(title).toHaveValue("Isolated Reports preserved dossier")
  const sectionRefs = sectionIdsForPages(saved, reportPages)
  for (const pageName of reportPages) expect(saved.sections.some((section) => sectionMatchesPage(section, pageName)), pageName).toBe(true)
  expect(sectionRefs).toEqual(saved.sections.map((section) => section.id))
  const contents = report.getByRole("region", { name: /Authorized report sections|Seções autorizadas do relatório/ })
  for (const box of await contents.getByRole("checkbox").all()) await box.uncheck()
  for (const pageName of reportPages) await expect(form.getByRole("checkbox", { name: pageName, exact: true })).toBeEnabled()
  for (const pageName of reportPages) await form.getByRole("checkbox", { name: pageName, exact: true }).check()
  for (const pageName of reportPages) await expect(form.getByRole("checkbox", { name: pageName, exact: true })).toBeChecked()
  const button = form.getByRole("button", { name: "Generate Report", exact: true })
  await expect(button).toBeEnabled()
  const intent = { reviewRef: saved.id, sectionRefs, format }
  const browserFile = page.waitForEvent("download").catch(() => undefined)
  const { response: download, actionResult: { response, body } } = await observeOriginalResponse(page, endpoint, "GET",
    (url) => url.searchParams.get("sf") === "review-download",
    () => observeOriginalJson(page, endpoint, "POST", (url) => url.searchParams.get("sf") === "review-report",
      () => button.click()))
  expect(response.status).toBe(200)
  expect(response.request.postDataJSON()).toEqual(intent)
  expect(body.status).toBe("ok")
  const material = object(body.result)
  expect(material.reviewSelectionRef).toBe(saved.id)
  expect(Array.isArray(material.orderedResultRefs)).toBe(true)
  const refs = material.orderedResultRefs as string[]
  expect(refs).toHaveLength(1)
  const artifact = text(refs[0])
  expect(artifact).toMatch(/^report:[a-f0-9]{64}$/)
  expect(text(body.outputRef)).toBe(artifact)
  expect(download.status()).toBe(200)
  const mime = format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  expect(download.headers()["content-type"]?.split(";")[0]?.trim().toLowerCase()).toBe(mime)
  const disposition = download.headers()["content-disposition"] ?? ""
  expect(disposition.toLowerCase()).toContain("attachment")
  expect(disposition.toLowerCase()).toContain("." + format)
  const href = new URL(download.url())
  expect(href.origin).toBe(app.origin)
  expect(href.pathname).toBe(new URL(app.dashboardURL).pathname)
  expect(Object.fromEntries(href.searchParams)).toEqual({ sf: "review-download", artifactRef: artifact })
  const file = info.outputPath(`preserved-${format}.${format}`)
  const downloaded = await browserFile
  if (!downloaded) throw new Error("The installed browser did not download the authorized report")
  expect(downloaded.suggestedFilename()).toBe(`review.${format}`)
  await downloaded.saveAs(file)
  expect(await downloaded.failure()).toBeNull()
  const bytes = await readFile(file)
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(createHash("sha256").update(await download.body()).digest("hex"))
  await info.attach(`preserved-${format}`, { path: file, contentType: mime })
  const semantics = await inspectReport(file, format, saved, corpus, info)
  const packaged = officePackageText(bytes, format)
  expect(packaged).toContain(saved.id)
  for (const comment of saved.comments) expect(packaged).toContain(comment.content.replace(/\s+/g, " ").trim())
  return { artifact, href: href.href, ...semantics }
}

export async function openAndReopenMeeting(page: Page, app: ReportsInstallation, saved: PreservedReview, budgetSection: PreservedSection) {
  const path = "/orchestra/sf-reviews/reviews/" + encodeReviewRef(saved.id)
  const current = new URL(page.url())
  if (current.origin !== app.origin || current.pathname !== path)
    await observePreservedReview(page, app, saved, () => page.goto(path))
  const article = page.locator('[data-sf-surface="UI48"]').locator('article[data-review-ref="' + saved.id + '"]')
  await expect(article).toHaveAttribute("data-review-version", String(saved.version))
  const surface = page.locator('[data-sf-surface="UI48"]')
  await expect(surface).toHaveAttribute("data-sf-presentation", "false")
  const present = page.getByRole("button", { name: /^(Present review|Apresentar revisão)$/ })
  await expect(present).toBeVisible()
  await expect(present).toBeEnabled()
  await present.click()
  await expect(surface).toHaveAttribute("data-sf-presentation", "true")
  const meeting = article.getByRole("region", { name: "Preserved review meeting", exact: true })
  await expect(meeting).toHaveCount(1)
  await expect(meeting.getByRole("status")).toContainText("Preserved review " + saved.id + " v" + saved.version)
  const url = page.url()
  expect(saved.sections.length).toBeGreaterThan(0)
  const budgetIndex = saved.sections.findIndex((section) => section.id === budgetSection.id)
  expect(budgetIndex).toBeGreaterThanOrEqual(0)
  const reloadMeeting = async () => {
    const reloadURL = page.url()
    await observePreservedReview(page, app, saved, () => page.reload())
    await expect(surface).toHaveAttribute("data-sf-presentation", "false")
    await expect(article).toHaveAttribute("data-review-version", String(saved.version))
    await expect(meeting.getByRole("status")).toContainText("Preserved review " + saved.id + " v" + saved.version)
    expect(page.url()).toBe(reloadURL)
    const heading = meeting.getByRole("heading", { level: 2 })
    await expect(heading).toHaveText(saved.sections[0]!.title)
    for (const section of saved.sections.slice(1, budgetIndex + 1)) {
      await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
      await expect(heading).toHaveText(section.title)
    }
    await expect(heading).toHaveText(budgetSection.title)
  }
  await reloadMeeting()
  return { meeting, url, reloadMeeting }
}

export async function expectCapturedBudget(page: Page, corpus: ReportsCorpus, budgetSection: PreservedSection, amount = corpus.before) {
  const meeting = page.getByRole("region", { name: "Preserved review meeting", exact: true })
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText(budgetSection.title)
  const navigation = meeting.getByRole("list", { name: "Preserved source navigation", exact: true })
  for (const value of [
    { id: "budgetMetrics." + corpus.year + ".totalForecast", amount, period: corpus.annual },
    { id: "budget:" + corpus.year + "-01:forecast", amount: 110, period: corpus.january },
  ]) {
    const prefix = value.id + ": " + value.amount + " unspecified · " + value.period.start + " – " + value.period.end + " · "
    const line = meeting.getByRole("listitem").filter({ hasText: new RegExp("^" + value.id.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&") + ":") })
    await expect(line).toHaveText(new RegExp("^" + prefix.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&") + "\\S.+$"))
    const references = text(await line.textContent()).slice(prefix.length).split(", ")
    expect(references.length).toBeGreaterThan(0)
    expect(new Set(references).size).toBe(references.length)
    for (const reference of references) {
      expect(text(reference)).not.toBe("source unavailable")
      expect(reference).toBe(reference.trim())
      const source = navigation.getByRole("button", { name: "Open source " + reference, exact: true })
      await expect(source).toHaveCount(1)
      await expect(source).toBeEnabled()
    }
  }
}

export async function followBudgetSource(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus, budgetSection: PreservedSection) {
  const forecast = projection(budgetSection.content).values.filter((value) => value.id === corpus.forecastField)
  expect(forecast).toHaveLength(1)
  expect(forecast[0]!.sourceRefs).toHaveLength(1)
  const reference = forecast[0]!.sourceRefs[0]!
  expect(reference).toMatchObject({ kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview", period: corpus.annual } })
  const navigation = page.getByRole("list", { name: "Preserved source navigation", exact: true })
  const link = navigation.getByRole("button", { name: `Open source ${reference.refId}`, exact: true })
  await expect(link, "The installed meeting must use the existing authorized source resolver").toBeEnabled()
  const { response, body } = await observeOriginalJson(page, new URL(app.dashboardURL), "GET",
    (url) => url.searchParams.size === 3 && url.searchParams.get("sf") === "review-source" &&
      url.searchParams.get("reviewRef") === saved.id && url.searchParams.get("referenceId") === reference.refId,
    () => observePreservedReview(page, app, saved, () => link.click()))
  expect(response.status).toBe(200)
  expect(response.headers["cache-control"]).toBe("no-store")
  const links = body.links
  expect(Array.isArray(links)).toBe(true)
  expect(links).toHaveLength(1)
  const authorized = object((links as unknown[])[0])
  const destination = new URL(text(authorized.url), app.dashboardURL)
  // Do not rewrite a producer URL into an invented authorized native destination.
  const nativeOrigin = new URL(page.url()).origin
  expect(destination.origin, "UNBOUND WP1: the source producer must emit a destination on the native browser origin").toBe(nativeOrigin)
  expect(destination.pathname, "UNBOUND WP1: a legacy dashboard destination is not a native source link").toBe("/orchestra/sf-dashboard/budget")
  expect(destination.searchParams.get("year")).toBe(String(corpus.year))
  // The host offers the producer-authorized destination for an explicit choice.
  // Opening the evidence button alone does not navigate away from the review.
  const sources = page.getByRole("navigation", { name: "Origens autorizadas da revisão", exact: true })
  const open = sources.getByRole("link", { name: text(authorized.label), exact: true })
  await expect(open).toHaveCount(1)
  await expect(open).toHaveAttribute("href", destination.toString())
  const current = await observeBudgetPage(page, app, corpus.year, () => open.click())
  expect(object(object(current.data).totals).totalForecast).toBe(corpus.after)
  await expect(page).toHaveURL(destination.toString())
  const dashboard = page.locator('[data-sf-surface="CAP03"]')
  await expect(dashboard).toBeVisible()
  const target = new URL(page.url())
  expect(target.origin).toBe(nativeOrigin)
  expect(target.pathname).toBe("/orchestra/sf-dashboard/budget")
  expect(target.searchParams.get("year")).toBe(String(corpus.year))
  await expect(dashboard.locator('[data-sf-metric="forecast"] dd'),
    "The native Budget must display the current producer total for the linked year").toHaveText(await formatReviewNumber(page, corpus.after))
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
}

async function formatReviewNumber(page: Page, value: number, minimumFractionDigits = 0) {
  const locale = await page.locator("html").getAttribute("lang")
  expect(locale).toBeTruthy()
  return Intl.NumberFormat(locale!, { minimumFractionDigits, maximumFractionDigits: 2 }).format(value)
}

async function observeBudgetPage(page: Page, app: ReportsInstallation, year: number, navigate: () => Promise<unknown>) {
  const budget = await observeOriginalJson(page, new URL(`${app.mount}/api/ui/pages/CAP03`, app.origin), "GET",
    (url) => url.searchParams.getAll("year").length === 1 && url.searchParams.get("year") === String(year), navigate)
  expect(budget.response.status).toBe(200)
  expect(budget.body.status).toBe("ok")
  const projection = object(budget.body.value)
  expect(projection.capabilityId).toBe("CAP03")
  expect(object(projection.selection).year).toBe(year)
  return projection
}

export async function observePreservedReview(page: Page, app: ReportsInstallation, saved: PreservedReview, action: () => Promise<unknown>) {
  const { response, body } = await observeOriginalJson(page, new URL(app.dashboardURL), "GET",
    (url) => url.searchParams.size === 2 && url.searchParams.get("sf") === "dashboard-review" &&
      url.searchParams.get("id") === saved.id, action)
  expect(response.status).toBe(200)
  expect(response.headers["cache-control"]).toContain("no-store")
  expect(body.status).toBe("ok")
  expect(body.value).toEqual(saved)
}

function encodeReviewRef(value: string) {
  return "r_" + Buffer.from(value, "utf8").toString("base64url")
}

function sectionIdsForPages(saved: PreservedReview, pages: readonly string[]) {
  const chosen = new Set(saved.sections.filter((section) => pages.some((pageName) => sectionMatchesPage(section, pageName))).map((section) => section.id))
  return saved.sections.map((section) => section.id).filter((id) => chosen.has(id))
}

function sectionMatchesPage(section: PreservedReview["sections"][number], pageName: string) {
  if (section.title === pageName) return true
  if (section.sourceRefs.some((ref) => ref.type === "dashboard-page" && ref.id === pageName)) return true
  if (!section.content || typeof section.content !== "object" || Array.isArray(section.content)) return false
  const context = (section.content as { context?: { sourceRefs?: readonly { type?: unknown; id?: unknown }[] } }).context
  return !!context?.sourceRefs?.some((ref) => ref.type === "dashboard-page" && ref.id === pageName)
}

async function observeOriginalJson<T>(page: Page, endpoint: URL, method: "GET" | "POST",
  matches: (url: URL) => boolean, action: () => Promise<T>, matchesRequest?: (request: Request) => boolean) {
  const { response, request, actionResult } = await observeOriginalResponse(page, endpoint, method, matches, action, matchesRequest)
  const headers = response.headers()
  expect(headers["content-type"]).toContain("application/json")
  return { response: { status: response.status(), request, headers }, body: object(await response.json()), actionResult }
}

async function observeOriginalResponse<T>(page: Page, endpoint: URL, method: "GET" | "POST",
  matches: (url: URL) => boolean, action: () => Promise<T>, matchesRequest?: (request: Request) => boolean) {
  const producer = Promise.withResolvers<{ response: APIResponse; request: Request }>()
  const matcher = (url: URL) => url.origin === endpoint.origin && url.pathname === endpoint.pathname && matches(url)
  let delivery: Promise<void> | undefined
  const forward = async (route: Route, request: Request) => {
    try {
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      await route.fulfill({ response })
      producer.resolve({ response, request })
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  const observe = (route: Route) => {
    const request = route.request()
    if (delivery || request.method() !== method || (matchesRequest && !matchesRequest(request))) return route.fallback()
    delivery = forward(route, request)
    return delivery
  }
  await page.route(matcher, observe)
  try {
    const [result, actionResult] = await Promise.all([producer.promise, action()])
    return { ...result, actionResult }
  } finally {
    // Do not detach an in-flight interception, even if the action fails first.
    if (delivery) await delivery
    if (!page.isClosed()) await page.unroute(matcher, observe)
  }
}

/** Observe transport only: never serialize headers, bodies, cookies or query values. */
function observeAgendaTransport(page: Page, app: ReportsInstallation) {
  const expected = new URL(app.dashboardURL)
  const started = Date.now()
  const entries: Record<string, unknown>[] = []
  let dropped = 0
  const add = (kind: string, value: Record<string, unknown>) => {
    if (entries.length >= 40) { dropped += 1; return }
    entries.push({ kind, elapsedMs: Date.now() - started, ...value })
  }
  const destination = (raw: string) => {
    try {
      const url = new URL(raw)
      const mode = url.searchParams.get("sf")
      return {
        sameOrigin: url.origin === expected.origin,
        samePath: url.pathname === expected.pathname,
        route: url.pathname === expected.pathname ? "dashboard" :
          /\/auth\/(?:login|logout|local)$/.test(url.pathname) ? "authentication" : "other",
        mode: mode && mode.length <= 64 && /^review(?:-[a-z]+)*$/.test(mode) ? mode : mode === null ? "absent" : "other",
      }
    } catch { return { sameOrigin: false, samePath: false, route: "invalid", mode: "other" } }
  }
  const matching = (request: Request) => {
    const route = destination(request.url())
    return route.sameOrigin && route.samePath && route.mode === "review-agenda" && request.method() === "POST"
  }
  const relevant = (request: Request) => request.method() === "POST" || destination(request.url()).mode.startsWith("review")
  const causes = (value: string) => ({
    codes: [...new Set(value.match(/\b(?:net::)?ERR_[A-Z0-9_]+\b/g) ?? [])].slice(0, 5).map((code) => code.slice(0, 80)),
    categories: [
      /content security policy|CSP|connect-src|default-src/i.test(value) ? "content-security-policy" : undefined,
      /CORS|cross-origin/i.test(value) ? "cross-origin" : undefined,
      /mixed content/i.test(value) ? "mixed-content" : undefined,
      /failed to fetch|NetworkError|load failed/i.test(value) ? "network-failure" : undefined,
      /abort/i.test(value) ? "aborted" : undefined,
      /timeout|timed out/i.test(value) ? "timeout" : undefined,
    ].filter((entry): entry is string => entry !== undefined),
  })
  let rejectFailure!: (error: Error) => void
  const failed = new Promise<never>((_resolve, reject) => { rejectFailure = reject })
  // The original response waiter remains the success oracle. This branch only
  // rejects sooner when its exact request has an observed transport failure.
  void failed.catch(() => undefined)
  const request = (value: Request) => {
    if (relevant(value)) add("request", { ...destination(value.url()), method: value.method(), resource: value.resourceType() })
  }
  const response = (value: Response) => {
    if (relevant(value.request())) add("response", { ...destination(value.url()), method: value.request().method(), status: value.status() })
  }
  const requestfailed = (value: Request) => {
    const failure = causes(value.failure()?.errorText ?? "")
    if (relevant(value)) add("requestfailed", { ...destination(value.url()), method: value.method(), ...failure })
    if (matching(value)) rejectFailure(new Error("Actual review-agenda POST transport failed: " +
      [...failure.codes, ...failure.categories].join(", ")))
  }
  const pageerror = (value: Error) => add("pageerror", {
    name: value.name.length <= 40 && /^[A-Za-z]*Error$/.test(value.name) ? value.name : "Error", ...causes(value.message),
  })
  const consoleEvent = (value: ConsoleMessage) => {
    if (value.type() === "error" || value.type() === "warning") add("console", { type: value.type(), ...causes(value.text()) })
  }
  const before = destination(page.url())
  page.on("request", request); page.on("response", response); page.on("requestfailed", requestfailed)
  page.on("pageerror", pageerror); page.on("console", consoleEvent)
  return {
    failed,
    finish: async (info: TestInfo) => {
      page.off("request", request); page.off("response", response); page.off("requestfailed", requestfailed)
      page.off("pageerror", pageerror); page.off("console", consoleEvent)
      await info.attach("reports-agenda-transport", { contentType: "application/json", body: JSON.stringify({
        before, after: destination(page.url()), expected: { method: "POST", mode: "review-agenda" },
        elapsedMs: Date.now() - started, entries, dropped, cli: app.diagnostics?.() ?? "diagnostics-unavailable",
      }, null, 2) }).catch(() => undefined)
    },
  }
}
