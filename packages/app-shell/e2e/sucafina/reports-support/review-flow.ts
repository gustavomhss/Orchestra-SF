import { readFile, writeFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import type { APIRequestContext, Page, TestInfo, Request, Response, ConsoleMessage } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAgendaPreview } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { agendaResult, object, projection, readReview, responseFor, review, text } from "./model.ts"
import { inspectReport, officePackageText } from "./ooxml.ts"

const reportPages = ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"] as const
const reportPageTopics = {
  "Budget Overview": "budget",
  "Portfolio Dashboard": "projects",
  "Hot Topics & Actions": "hot-topics",
} as const

export async function prepareReview(page: Page, app: ReportsInstallation, corpus: ReportsCorpus, info: TestInfo, options: { removeOne?: boolean } = {}) {
  await page.goto(`/orchestra/sf-dashboard/budget?${new URLSearchParams({ year: String(corpus.year) })}`)
  const reportsEntry = page.getByRole("link", { name: "Reports and backup", exact: true })
  await expect(reportsEntry).toBeVisible()
  await expect(reportsEntry).toHaveAttribute("href", "/orchestra/sf-reviews/agenda")
  await reportsEntry.click()
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda).toBeVisible()
  if (options.removeOne) {
    throw new Error("UNBOUND WP1: UI47 can remove a section, but has no control to remove one authorized record (reviews/agenda/index.tsx:308).")
  }
  for (const pageName of reportPages) {
    await agenda.getByLabel(/Source dashboard page|Página de origem do dashboard/).fill(pageName)
    const found = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.pathname.endsWith("/api/ui/projections/review") &&
        url.searchParams.get("page") === pageName
    })
    await agenda.getByRole("button", { name: /Find authorized sections|Buscar seções autorizadas/ }).click()
    const discovery = await found
    expect(discovery.status()).toBe(200)
    const discovered = object(await discovery.json())
    expect(discovered.status).toBe("ok")
    const items = object(discovered.value).items
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(1)
    expect(object((items as unknown[])[0]).topic).toBe(reportPageTopics[pageName])
    const add = agenda.getByRole("button", { name: /Add to agenda|Adicionar à pauta/ })
    await expect(add).toHaveCount(1)
    await expect(add).toBeEnabled()
    await add.click()
    await expect(agenda.locator("[data-sf-agenda-order] > li").last().locator("strong")).toHaveText(reportPageTopics[pageName])
  }
  const selectedRows = agenda.locator("[data-sf-agenda-order] > li")
  await expect(selectedRows).toHaveCount(reportPages.length)
  await expect(selectedRows.locator("strong")).toHaveText(reportPages.map((pageName) => reportPageTopics[pageName]))
  const sectionIds = (await selectedRows.evaluateAll((items) => items.map((item) => item.getAttribute("data-section-id"))))
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  expect(sectionIds).toHaveLength(reportPages.length)
  const preview = page.getByRole("button", { name: /Review selected sections|Revisar seções selecionadas/ })
  await expect(preview).toBeEnabled()
  const pendingAgenda = page.waitForResponse(responseFor(app.dashboardURL, "dashboard-agenda", "POST"))
  await preview.click()
  const agendaResponse = await pendingAgenda
  expect(agendaResponse.status()).toBe(200)
  const agendaBody = object(await agendaResponse.json())
  expect(agendaBody.status).toBe("ok")
  const agendaValue = object(agendaBody.value)
  const selectionRef = text(agendaValue.selectionRef)
  expect(Array.isArray(agendaValue.sections)).toBe(true)
  const previewSections = (agendaValue.sections as unknown[]).map(object)
  expect(previewSections.map((section) => text(section.id))).toEqual(sectionIds)
  const counts = previewSections.map((section) => section.recordCount)
  expect(counts[reportPages.indexOf("Portfolio Dashboard")]).toBe(25)
  expect(counts[reportPages.indexOf("Hot Topics & Actions")]).toBe(0)
  const shown = agenda.locator("[data-sf-agenda-preview]")
  await expect(shown).toBeVisible()
  await expect(shown.locator("li").nth(reportPages.indexOf("Portfolio Dashboard"))).toContainText(/Authorized records: 25|Registros autorizados: 25/)
  await expect(shown.locator("li").nth(reportPages.indexOf("Hot Topics & Actions"))).toContainText(/Authorized records: 0|Registros autorizados: 0/)
  const confirm = agenda.getByRole("button", { name: /Confirm preservation|Confirmar preservação/ })
  await expect(confirm).toBeEnabled()
  const pendingPreserve = page.waitForResponse(responseFor(app.dashboardURL, "dashboard-review-preserve", "POST"))
  await confirm.click()
  const response = await pendingPreserve
  expect(response.status()).toBe(200)
  expect(object(response.request().postDataJSON())).toEqual({ selectionRef, sectionRefs: sectionIds })
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const saved = review(body.value)
  expect(saved.sections.map((section) => section.id)).toEqual(sectionIds)
  expect(saved.sections.map((section) => section.count)).toEqual(counts)
  expect(saved.sections[reportPages.indexOf("Portfolio Dashboard")]!.count).toBe(25)
  const confirmed = agenda.locator("[data-sf-preserved-confirmed]")
  await expect(confirmed).toBeVisible()
  await expect(confirmed.locator("dd").first()).toHaveText(saved.id)
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  await page.goto("/orchestra/sf-reviews/reviews/" + encodeReviewRef(saved.id))
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
  await info.attach("preserved-selection", { body: JSON.stringify({ selectionRef, sectionRefs: sectionIds, saved, removeOne: options.removeOne === true }, null, 2), contentType: "application/json" })
  return { preparation, saved }
}

// UNBOUND: UI47 currently removes whole sections only; retain the record-level contract.
async function removeOneProject(page: Page, app: ReportsInstallation, selected: ReviewAgendaPreview) {
  const section = selected.sections.filter((entry) => entry.title === "Projects")
  expect(section).toHaveLength(1)
  const choices = selected.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)
  expect(choices).toHaveLength(1)
  expect(choices[0]!.recordRefs).toHaveLength(25)
  expect(new Set(choices[0]!.recordRefs).size).toBe(25)
  // The opaque identity comes from the actual authorized selector. Do not invent
  // a ref encoding or pretend the page-level evidence identifies one project.
  const reference = choices[0]!.recordRefs[0]!
  const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  await preparation.getByRole("button", { name: `Remove record ${reference}`, exact: true }).click()
  const retained = await agendaResult(await pending)
  expect(retained.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)).toEqual([
    { sectionRef: section[0]!.id, recordRefs: choices[0]!.recordRefs.filter((entry) => entry !== reference) },
  ])
  const after = retained.sections.filter((entry) => entry.id === section[0]!.id)
  expect(after).toHaveLength(1)
  expect(after[0]!.recordCount).toBe(24)
  const beforeIds = section[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  const afterIds = after[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  expect(beforeIds).toHaveLength(25)
  expect(afterIds).toHaveLength(24)
  const removed = beforeIds.filter((value) => !afterIds.some((current) => current.id === value.id))
  expect(removed).toHaveLength(1)
  const prefix = removed[0]!.id.slice(0, -2)
  expect(after[0]!.projection.values.map((value) => ({ id: value.id, value: value.value, period: value.period }))).toEqual(
    section[0]!.projection.values.filter((value) => !value.id.startsWith(prefix))
      .map((value) => ({ id: value.id, value: value.value, period: value.period })),
  )
  await expect(preparation.getByRole("status")).toHaveText("Selection refreshed from the authorized sources. Check the new counts and values before preserving.")
  return retained
}

export async function readSourceData(request: APIRequestContext, app: ReportsInstallation) {
  const response = await request.get(`${app.dashboardURL}?download=json`, { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const data = object(await response.json())
  return { projects: data.projects, opexOwners: data.opexOwners, opexEntries: data.opexEntries, hotTopics: data.hotTopics }
}

// UNBOUND: UI48 reads successor availability, but does not create/preserve a revision.
export async function preserveNewRevision(page: Page, app: ReportsInstallation, prior: PreservedReview, corpus: ReportsCorpus) {
  const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  const load = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  await preparation.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
  const selected = await agendaResult(await load)
  expect(selected.sections.flatMap((section) => section.projection.values).filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.after, period: corpus.annual }])
  expect(selected.sections.filter((section) => section.title === "Projects").map((section) => section.recordCount)).toEqual([24])
  const preserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  await preparation.getByRole("button", { name: "Preserve this review", exact: true }).click()
  const response = await preserve
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ previousReviewRef: prior.id, selectionRef: selected.selectionRef })
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const next = review(body.value)
  expect(next.id).not.toBe(prior.id)
  expect(next.previousReviewRef).toBe(prior.id)
  expect(next.sections.map((section) => section.title)).toEqual(prior.sections.map((section) => section.title))
  expect(next.sections.map((section) => section.count)).toEqual(prior.sections.map((section) => section.count))
  expect(projection(next.sections[1]!.content).values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.after, period: corpus.annual }])
  await expect(preparation.getByRole("status")).toHaveText("Review preserved. Source updates will not replace this meeting's captured values.")
  await expect(preparation.getByRole("table", { name: "Budget · selected source values", exact: true })
    .getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.forecastField, exact: true }) }).getByRole("cell"))
    .toHaveText([corpus.forecastField, `${corpus.after} unspecified`, `${corpus.annual.start} – ${corpus.annual.end}`])
  expect(await readReview(page.request, app.dashboardURL, prior.id)).toEqual(prior)
  expect(await readReview(page.request, app.dashboardURL, next.id)).toEqual(next)
  return next
}

export async function changeForecast(page: Page, app: ReportsInstallation, corpus: ReportsCorpus) {
  const source = await page.context().newPage()
  const pageRead = (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === app.origin &&
      url.pathname === app.mount + "/api/ui/pages/CAP04" && url.searchParams.get("year") === String(corpus.year)
  }
  const mutations: Request[] = []
  const recordMutation = (request: Request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === app.origin &&
        url.pathname === new URL(app.dashboardURL).pathname && !url.searchParams.has("sf") &&
        object(request.postDataJSON()).action === "save-entry") mutations.push(request)
  }
  source.on("request", recordMutation)
  try {
    const loaded = source.waitForResponse(pageRead)
    await source.goto("/orchestra/sf-dashboard/opex/" + encodeReviewRef("reports-opex") +
      "?" + new URLSearchParams({ year: String(corpus.year) }))
    const loadedResponse = await loaded
    expect(loadedResponse.status()).toBe(200)
    const loadedBody = object(await loadedResponse.json())
    expect(loadedBody.status).toBe("ok")
    const versions = object(object(loadedBody.value).versions)
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
    const beforeApply = await readSourceData(source.request, app)
    expect(beforeApply.opexEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reports-opex-01", forecast: 110 }),
    ]))
    const applied = source.waitForResponse((response) => {
      const request = response.request()
      const url = new URL(response.url())
      return request.method() === "POST" && url.origin === app.origin &&
        url.pathname === new URL(app.dashboardURL).pathname && url.searchParams.get("page") === "OPEX Detail" &&
        object(request.postDataJSON()).action === "save-entry"
    })
    const refreshed = source.waitForResponse(pageRead)
    await expect(confirmation.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
    await confirmation.getByRole("button", { name: "Save", exact: true }).click()
    const applyResponse = await applied
    expect(applyResponse.status()).toBe(200)
    expect(object(applyResponse.request().postDataJSON())).toMatchObject({
      page: "OPEX Detail", action: "save-entry", id: "reports-opex-01", version,
      values: { ownerId: "reports-opex", year: corpus.year, month: 1, budget: 100, actual: 100, forecast: 190, versions },
    })
    expect(object(await applyResponse.json())).toMatchObject({ ok: true })
    const refreshedResponse = await refreshed
    expect(refreshedResponse.status()).toBe(200)
    const refreshedBody = object(await refreshedResponse.json())
    expect(refreshedBody.status).toBe("ok")
    expect(object(object(refreshedBody.value).versions)["opexEntries:reports-opex-01"]).toBe(version + 1)
    expect(mutations, "One explicit confirmation must submit once").toHaveLength(1)
    await expect(editor).toHaveCount(0)
    const reloaded = source.waitForResponse(pageRead)
    await source.reload()
    const reloadedResponse = await reloaded
    expect(reloadedResponse.status()).toBe(200)
    const reloadedBody = object(await reloadedResponse.json())
    expect(reloadedBody.status).toBe("ok")
    expect(object(object(reloadedBody.value).versions)["opexEntries:reports-opex-01"]).toBe(version + 1)
    await expect(month.getByRole("button", { name: "Save month", exact: true })).toBeEnabled()
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    await expect(form.getByLabel("forecast", { exact: true })).toHaveValue("190")
  } finally {
    source.off("request", recordMutation)
    await source.close()
  }
}

export async function exportReview(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus, format: "docx" | "pptx", info: TestInfo) {
  await page.goto("/orchestra/sf-reviews/reports/" + encodeReviewRef(saved.id))
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
  const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-report", "POST"))
  const downloaded = page.waitForResponse(responseFor(app.dashboardURL, "review-download", "GET"))
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({ reviewRef: saved.id, sectionRefs, format })
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const material = object(body.result)
  expect(material.reviewSelectionRef).toBe(saved.id)
  expect(Array.isArray(material.orderedResultRefs)).toBe(true)
  const refs = material.orderedResultRefs as string[]
  expect(refs).toHaveLength(1)
  const artifact = text(refs[0])
  expect(artifact).toMatch(/^report:[a-f0-9]{64}$/)
  expect(text(body.outputRef)).toBe(artifact)
  const download = await downloaded
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
  await writeFile(file, Buffer.from(await download.body()))
  await info.attach(`preserved-${format}`, { path: file, contentType: mime })
  const semantics = await inspectReport(file, format, saved, corpus, info)
  const packaged = officePackageText(await readFile(file), format)
  expect(packaged).toContain(saved.id)
  for (const comment of saved.comments) expect(packaged).toContain(comment.content.replace(/\s+/g, " ").trim())
  return { artifact, href: href.href, ...semantics }
}

export async function openAndReopenMeeting(page: Page, app: ReportsInstallation, saved: PreservedReview) {
  const pending = page.waitForResponse(responseFor(app.dashboardURL, "dashboard-review", "GET"))
  await page.goto("/orchestra/sf-reviews/reviews/" + encodeReviewRef(saved.id))
  const response = await pending
  expect(response.status()).toBe(200)
  expect(object(await response.json()).value).toEqual(saved)
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
  const reload = page.waitForResponse(responseFor(app.dashboardURL, "dashboard-review", "GET"))
  await page.reload()
  const reopened = await reload
  expect(reopened.status()).toBe(200)
  expect(object(await reopened.json()).value).toEqual(saved)
  await expect(surface).toHaveAttribute("data-sf-presentation", "false")
  await expect(article).toHaveAttribute("data-review-version", String(saved.version))
  await expect(meeting.getByRole("status")).toContainText("Preserved review " + saved.id + " v" + saved.version)
  expect(page.url()).toBe(url)
  expect(saved.sections.length).toBeGreaterThan(0)
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText(saved.sections[0]!.title)
  const budgetIndex = saved.sections.findIndex((section) => section.title === "Budget")
  expect(budgetIndex).toBeGreaterThanOrEqual(0)
  for (const section of saved.sections.slice(1, budgetIndex + 1)) {
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expect(meeting.getByRole("heading", { level: 2 })).toHaveText(section.title)
  }
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Budget")
  return { meeting, url }
}

export async function expectCapturedBudget(page: Page, corpus: ReportsCorpus, amount = corpus.before) {
  const meeting = page.getByRole("region", { name: "Preserved review meeting", exact: true })
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Budget")
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

export async function followBudgetSource(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus) {
  const sections = saved.sections.filter((section) => section.title === "Budget")
  expect(sections).toHaveLength(1)
  const forecast = projection(sections[0]!.content).values.filter((value) => value.id === corpus.forecastField)
  expect(forecast).toHaveLength(1)
  expect(forecast[0]!.sourceRefs).toHaveLength(1)
  const reference = forecast[0]!.sourceRefs[0]!
  expect(reference).toMatchObject({ kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview", period: corpus.annual } })
  const navigation = page.getByRole("list", { name: "Preserved source navigation", exact: true })
  const link = navigation.getByRole("button", { name: `Open source ${reference.refId}`, exact: true })
  await expect(link, "The installed meeting must use the existing authorized source resolver").toBeEnabled()
  const read = page.waitForResponse(responseFor(app.dashboardURL, "dashboard-review", "GET"))
  const resolution = page.waitForResponse(responseFor(app.dashboardURL, "review-source", "GET"))
  await link.click()
  expect(object(await (await read).json()).value).toEqual(saved)
  const resolved = await resolution
  expect(resolved.status()).toBe(200)
  expect(resolved.headers()["cache-control"]).toBe("no-store")
  const links = object(await resolved.json()).links
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
  await open.click()
  await expect(page).toHaveURL(destination.toString())
  const dashboard = page.locator('[data-sf-surface="CAP03"]')
  await expect(dashboard).toBeVisible()
  const target = new URL(page.url())
  expect(target.origin).toBe(nativeOrigin)
  expect(target.pathname).toBe("/orchestra/sf-dashboard/budget")
  expect(target.searchParams.get("year")).toBe(String(corpus.year))
  await expect(dashboard.locator('[data-sf-metric="forecast"] dd'),
    "UNBOUND WP1: the native year-selected forecast must expose the producer total instead of an unscoped warning").toHaveText(String(corpus.after))
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
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
