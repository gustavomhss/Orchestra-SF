import { expect } from "@playwright/test"
import type { APIRequestContext, Page, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAgendaPreview } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { agendaResult, object, projection, readReview, responseFor, review, text } from "./model.ts"
import { inspectReport } from "./ooxml.ts"

export async function prepareReview(page: Page, app: ReportsInstallation, corpus: ReportsCorpus, info: TestInfo, options: { removeOne?: boolean } = {}) {
  await page.goto(app.workbenchURL)
  await expect(page.locator("#content").getByRole("heading", { name: "Decisions", exact: true }),
    "The real installation must enter Workbench before Reports").toBeVisible()
  await page.goto(`${app.dashboardURL}?page=Budget%20Overview&year=${corpus.year}`)
  await page.getByText("Reports and backup", { exact: true }).click()
  const form = page.locator("form.report-form")
  await expect(form).toHaveCount(1)
  await form.getByLabel("Format", { exact: true }).selectOption("docx")
  await form.getByLabel("Year", { exact: true }).selectOption(String(corpus.year))
  await form.getByLabel("Title", { exact: true }).fill("Isolated Reports preserved dossier")
  for (const checkbox of await form.getByRole("checkbox").all()) await checkbox.uncheck()
  for (const title of ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"])
    await form.getByRole("checkbox", { name: title, exact: true }).check()
  await form.getByRole("button", { name: "Generate Report", exact: true }).click()

  // WP07 already exports this exact view. WP10 must mount it from the existing entry;
  // a legacy live-data download is not accepted as a preserved-review journey.
  const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  await expect(preparation, "BLOCKED_COMPOSITION: Generate Report must mount the real ReviewPreparationView").toBeVisible()
  const load = preparation.getByRole("button", { name: "Load selection", exact: true })
  await expect(load).toBeEnabled()
  const pendingAgenda = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  await load.click()
  const selected = await agendaResult(await pendingAgenda)
  expect(selected.sections.map((section) => section.title).sort()).toEqual(["Budget", "Hot Topics", "Projects"])
  const projects = selected.sections.filter((section) => section.title === "Projects")
  expect(projects).toHaveLength(1)
  expect(projects[0]!.recordCount).toBe(25)
  expect(selected.sections.filter((section) => section.title === "Hot Topics").map((section) => section.recordCount)).toEqual([0])
  expect(selected.sections.flatMap((section) => section.projection.values)
    .filter((value) => value.id === corpus.forecastField)).toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  expect(selected.sections.flatMap((section) => section.projection.values)
    .filter((value) => value.id === `budget:${corpus.year}-01:forecast`)).toMatchObject([{ value: 110, period: corpus.january, currency: "unspecified" }])
  const projectNames = projects[0]!.projection.values.filter((value) => /^projects\[id:reports-project-\d{2}\]\.name$/.test(value.id))
  expect(projectNames.map((value) => value.value)).toEqual(corpus.projects.map((project) => project.name))
  projectNames.forEach((value) => expect(value.period).toEqual({ start: corpus.today, end: corpus.today }))
  await expect(preparation.getByRole("status")).toHaveText("Review the selection, order and periods, then explicitly preserve it.")
  await expect(preparation.getByRole("table", { name: "Budget · selected source values", exact: true })
    .getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.forecastField, exact: true }) }).getByRole("cell"))
    .toHaveText([corpus.forecastField, `${corpus.before} unspecified`, `${corpus.annual.start} – ${corpus.annual.end}`])
  const retained = options.removeOne ? await removeOneProject(page, app, selected) : selected
  const order = ["Projects", "Budget", "Hot Topics"]
  for (const [index, title] of order.entries()) {
    const shown = await preparation.getByRole("heading", { level: 3 }).allTextContents()
    const moves = shown.indexOf(title) - index
    expect(moves).toBeGreaterThanOrEqual(0)
    for (const _move of Array.from({ length: moves }))
      await preparation.getByRole("button", { name: `Move ${title} up`, exact: true }).click()
  }
  await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(order)
  const pendingPreserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  await preparation.getByRole("button", { name: "Preserve this review", exact: true }).click()
  const response = await pendingPreserve
  expect(response.status()).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const saved = review(body.value)
  expect(saved.sections.map((section) => section.title)).toEqual(order)
  expect(saved.sections.map((section) => section.id)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.id))
  expect(saved.sections.map((section) => section.count)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.recordCount))
  expect(saved.sections[0]!.count).toBe(options.removeOne ? 24 : 25)
  expect(projection(saved.sections[0]!.content).values).toEqual(retained.sections.find((section) => section.title === "Projects")!.projection.values)
  await expect(preparation.getByRole("status")).toHaveText("Review preserved. Source updates will not replace this meeting's captured values.")
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  await info.attach("preserved-selection", { body: JSON.stringify({ selectionRef: retained.selectionRef, selectedRecords: retained.sectionRecordRefs, saved }, null, 2), contentType: "application/json" })
  return { preparation, saved }
}

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
  try {
    await source.goto(`${app.dashboardURL}?page=OPEX%20Detail&year=${corpus.year}`)
    const form = source.locator('form[data-command="save-entry"][data-record="reports-opex-01"]')
    await expect(form).toHaveCount(1)
    const row = source.getByRole("row").filter({ has: form })
    await expect(row).toHaveCount(1)
    await row.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = source.getByRole("dialog", { name: "Edit record", exact: true })
    await expect(editor).toBeVisible()
    await expect(form.getByLabel("Forecast", { exact: true })).toHaveValue("110")
    const version = Number(await form.getAttribute("data-version"))
    expect(Number.isSafeInteger(version) && version >= 1).toBe(true)
    await form.getByLabel("Forecast", { exact: true }).fill("190")
    const previewed = source.waitForResponse((response) => response.url() === source.url() &&
      response.request().method() === "POST" && object(response.request().postDataJSON()).action === "preview-change")
    await form.getByRole("button", { name: "Save month", exact: true }).click()
    const previewResponse = await previewed
    expect(previewResponse.status()).toBe(200)
    expect(object(previewResponse.request().postDataJSON())).toMatchObject({
      page: "OPEX Detail", action: "preview-change", values: { command: {
        page: "OPEX Detail", action: "save-entry", id: "reports-opex-01", version,
        values: { ownerId: "reports-opex", month: 1, budget: 100, actual: 100, forecast: 190 },
      } },
    })
    const previewBody = object(await previewResponse.json())
    expect(previewBody.ok).toBe(true)
    const preview = object(previewBody.value)
    expect(preview.status).toBe("preview")
    const previewRef = text(preview.previewRef)
    const confirmation = form.getByRole("region", { name: "Review changes", exact: true })
    await expect(confirmation).toHaveAttribute("data-preview-ref", previewRef)
    await expect(confirmation.getByRole("heading", { name: "Review changes before applying", exact: true })).toBeVisible()
    await expect(confirmation.getByRole("listitem").filter({ hasText: /forecast: 110 → 190$/ })).toHaveCount(1)
    const beforeApply = await readSourceData(source.request, app)
    expect(beforeApply.opexEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reports-opex-01", forecast: 110 }),
    ]))
    const applied = source.waitForResponse((response) => response.url() === source.url() &&
      response.request().method() === "POST" && object(response.request().postDataJSON()).action === "apply-preview")
    await confirmation.getByRole("button", { name: "Confirm and apply", exact: true }).click()
    const applyResponse = await applied
    expect(applyResponse.status()).toBe(200)
    expect(object(applyResponse.request().postDataJSON())).toMatchObject({ page: "OPEX Detail", action: "apply-preview", values: { previewRef } })
    expect(object(await applyResponse.json())).toMatchObject({ ok: true, value: { applied: true, previewRef } })
    await expect(editor).not.toBeVisible()
    await expect(form).toHaveAttribute("data-version", String(version + 1))
    await source.reload()
    await expect(form).toHaveAttribute("data-version", String(version + 1))
    await expect(form.getByLabel("Forecast", { exact: true })).toHaveValue("190")
  } finally { await source.close() }
}

export async function exportReview(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus, format: "docx" | "pptx", info: TestInfo) {
  const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  const button = preparation.getByRole("button", { name: `Generate ${format.toUpperCase()}`, exact: true })
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-report", "POST"))
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ reviewRef: saved.id, sectionRefs: saved.sections.map((section) => section.id), format })
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const material = object(body.result)
  expect(material.reviewSelectionRef).toBe(saved.id)
  expect(Array.isArray(material.orderedResultRefs)).toBe(true)
  const refs = material.orderedResultRefs as string[]
  expect(refs).toHaveLength(1)
  const artifact = text(refs[0])
  expect(artifact).toMatch(/^report:[a-f0-9]{64}$/)
  const link = preparation.getByRole("link", { name: "Download generated report", exact: true })
  await expect(link).toHaveCount(1)
  const href = new URL(text(await link.getAttribute("href")), page.url())
  expect(href.origin).toBe(app.origin)
  expect(href.pathname).toBe(new URL(app.dashboardURL).pathname)
  expect(Object.fromEntries(href.searchParams)).toEqual({ sf: "review-download", artifactRef: artifact })
  const downloaded = page.waitForEvent("download")
  await link.click()
  const download = await downloaded
  expect(download.url()).toBe(href.href)
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`))
  expect(await download.failure()).toBeNull()
  const file = info.outputPath(`preserved-${format}.${format}`)
  await download.saveAs(file)
  await info.attach(`preserved-${format}`, { path: file, contentType: format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
  const semantics = await inspectReport(file, format, saved, corpus, info)
  return { artifact, href: href.href, ...semantics }
}

export async function openAndReopenMeeting(page: Page, app: ReportsInstallation, saved: PreservedReview) {
  const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
  await page.getByRole("region", { name: "Prepare review", exact: true }).getByRole("button", { name: "Open meeting", exact: true }).click()
  expect(object(await (await pending).json()).value).toEqual(saved)
  const meeting = page.getByRole("region", { name: "Preserved review meeting", exact: true })
  await expect(meeting).toHaveCount(1)
  await expect(meeting.getByRole("status")).toContainText(`Preserved review ${saved.id} v${saved.version}`)
  const url = page.url()
  const reload = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
  await page.reload()
  expect(object(await (await reload).json()).value).toEqual(saved)
  await expect(meeting.getByRole("status")).toContainText(`Preserved review ${saved.id} v${saved.version}`)
  expect(page.url()).toBe(url)
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Projects")
  await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Budget")
  return { meeting, url }
}

export async function expectCapturedBudget(page: Page, corpus: ReportsCorpus, amount = corpus.before) {
  const meeting = page.getByRole("region", { name: "Preserved review meeting", exact: true })
  await expect(meeting.getByRole("heading", { level: 2 })).toHaveText("Budget")
  await expect(meeting.getByRole("listitem").filter({ hasText: new RegExp(`^budgetMetrics\\.${corpus.year}\\.totalForecast:`) }))
    .toHaveText(new RegExp(`^budgetMetrics\\.${corpus.year}\\.totalForecast: ${amount} unspecified · ${corpus.annual.start} – ${corpus.annual.end} · sf-source:`))
  await expect(meeting.getByRole("listitem").filter({ hasText: new RegExp(`^budget:${corpus.year}-01:forecast:`) }))
    .toHaveText(new RegExp(`^budget:${corpus.year}-01:forecast: 110 unspecified · ${corpus.january.start} – ${corpus.january.end} · sf-source:`))
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
  const read = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
  await link.click()
  expect(object(await (await read).json()).value).toEqual(saved)
  await expect(page.locator("#content").getByRole("heading", { name: "Budget Overview", exact: true })).toBeVisible()
  const target = new URL(page.url())
  expect(target.origin).toBe(app.origin)
  expect(target.pathname).toBe(new URL(app.dashboardURL).pathname)
  expect(target.searchParams.get("page")).toBe("Budget Overview")
  expect(target.searchParams.get("year")).toBe(String(corpus.year))
  await expect(page.locator("article.metric").filter({ has: page.getByText("Known forecast — 12 months", { exact: true }) }).locator("strong"))
    .toHaveText(`$${corpus.after}`)
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
}
