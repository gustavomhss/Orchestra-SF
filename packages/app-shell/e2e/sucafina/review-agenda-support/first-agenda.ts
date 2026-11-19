import { expect } from "@playwright/test"
import type { Locator, Page, TestInfo } from "@playwright/test"
import type { Period } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAgendaDomain, ReviewAgendaOption } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { ReportsInstallation } from "../reports-support/production-installation.ts"
import type { ReportsCorpus } from "../reports-support/corpus.ts"
import { agendaResult, object, projection, readReview, responseFor, review } from "../reports-support/model.ts"
import { readSourceData, readNativeReportResponse } from "../reports-support/review-flow.ts"
import { firstAgendaCorpus } from "./source-corpus.ts"

/** Extends the existing RPT-01 journey; there is no new test or nominal CI selection. */
export async function prepareFirstAgenda(page: Page, app: ReportsInstallation, corpus: ReportsCorpus, info: TestInfo) {
  await page.goto("/orchestra/sf-dashboard/budget?" + new URLSearchParams({ year: String(corpus.year) }))
  await expect(page.locator('[data-sf-surface="CAP03"]')).toBeVisible()
  const sourceBefore = await readSourceData(page.request, app)
  const reportsEntry = page.getByRole("link", { name: "Reports and backup", exact: true })
  await expect(reportsEntry).toHaveAttribute("href", "/orchestra/sf-reviews/agenda?year=" + String(corpus.year))
  await reportsEntry.click()
  await expect(page.locator('[data-sf-surface="UI47"]')).toBeVisible()
  await page.getByRole("button", { name: "Choose agenda domains", exact: true }).click()
  const preparation = page.locator("[data-sf-multi-agenda]")
  const picker = preparation.getByRole("region", { name: "Agenda topics", exact: true })
  const chosen = preparation.getByRole("list", { name: "Agenda order and periods", exact: true })
  await expect(preparation).toHaveCount(1)
  await expect(preparation).toBeVisible()
  await expect(picker).toBeVisible()
  await expect(preparation.getByRole("button", { name: "Confirm preservation", exact: true })).toHaveCount(0)
  let selectedCount = 0
  const selections: ReviewAgendaOption[] = []
  const discover = async (domain: ReviewAgendaDomain, period: Period) => {
    await picker.getByLabel("Period start", { exact: true }).fill(period.start)
    await picker.getByLabel("Period end", { exact: true }).fill(period.end)
    await picker.getByLabel("Domain", { exact: true }).selectOption(domain)
    const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "GET"))
    await picker.getByRole("button", { name: "Discover agenda topics", exact: true }).click()
    const response = await pending
    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toContain("no-store")
    const query = new URL(response.url()).searchParams
    expect({ domain: query.get("domain"), start: query.get("start"), end: query.get("end") }).toEqual({ domain, ...period })
    const result = object(await readNativeReportResponse(response))
    expect(result.status).toBe("ok")
    const value = object(result.value)
    expect(Array.isArray(value.options)).toBe(true)
    const options = value.options as ReviewAgendaOption[]
    expect(options.every((option) => option.domain === domain)).toBe(true)
    // Discovery and changing a period must never replace or add human choices.
    await expect(chosen.getByRole("listitem")).toHaveCount(selectedCount)
    await expect(picker.getByRole("button", { name: "Discover agenda topics", exact: true })).toBeEnabled()
    return options
  }
  const add = async (options: ReviewAgendaOption[], label: string) => {
    const matching = options.filter((option) => option.label === label)
    expect(matching, `The real authorized catalog must offer ${label}`).toHaveLength(1)
    const option = matching[0]!
    await picker.getByRole("button", { name: `Add ${label}`, exact: true }).click()
    selectedCount++
    await expect(chosen.getByRole("listitem")).toHaveCount(selectedCount)
    await expect(picker.getByRole("button", { name: `Refresh ${label}`, exact: true })).toBeEnabled()
    selections.push(option)
    return option
  }

  const dashboard = await discover("dashboard", corpus.annual)
  await add(dashboard, "Budget Overview")
  await expect(chosen.getByRole("listitem")).toHaveCount(1)
  await expect(chosen.getByRole("button", { name: "Remove selected Budget Overview", exact: true })).toBeVisible()
  await expect(picker.getByRole("button", { name: "Refresh Budget Overview", exact: true })).toBeEnabled()
  const projects = await add(dashboard, "Portfolio Dashboard")
  const hotTopics = await add(dashboard, "Hot Topics & Actions")
  const removed = await add(dashboard, "IT Risks")
  const operations = await add(await discover("dashboard", corpus.january), "IT Operations")
  const comparisonLabel = `${firstAgendaCorpus.baselineName} → ${firstAgendaCorpus.candidateName}`
  const comparison = await add(await discover("planner", corpus.annual), comparisonLabel)
  const procurement = await add(await discover("procurement", corpus.annual), `Request · ${firstAgendaCorpus.requestTitle}`)
  expect(comparison.item.kind).toBe("forecast-comparison")
  expect(procurement.item.kind).toBe("procurement-request")
  await expect(chosen.getByRole("listitem")).toHaveCount(7)
  await expect(chosen.getByText(`IT Operations · dashboard · ${corpus.january.start} – ${corpus.january.end}`, { exact: true })).toBeVisible()
  await expect(chosen.getByText(`Budget Overview · dashboard · ${corpus.annual.start} – ${corpus.annual.end}`, { exact: true })).toBeVisible()

  const pendingAgenda = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  const agendaResponse = await pendingAgenda
  const submitted = object(agendaResponse.request().postDataJSON())
  expect(Array.isArray(submitted.items)).toBe(true)
  const submittedItems = submitted.items as ReviewAgendaOption["item"][]
  expect(submittedItems).toHaveLength(7)
  for (const option of selections) expect(submittedItems).toContainEqual(option.item)
  expect(submitted.previousReviewRef).toBeUndefined()
  const preview = await agendaResult(agendaResponse)
  const baselineTitle = `${comparisonLabel} · baseline`
  const candidateTitle = `${comparisonLabel} · candidate`
  const titles = ["Budget", "Projects", "Hot Topics", "IT Risks", "IT Operations", baselineTitle, candidateTitle, procurement.label]
  expect(preview.sections.map((section) => section.title)).toEqual(titles)
  expect(preview.sectionRefs).toEqual(preview.sections.map((section) => section.id))
  expect(new Set(preview.sections.flatMap((section) => section.projection.context.sourceRefs.map((source) => source.surface))))
    .toEqual(new Set(["dashboard", "planner", "procurement"]))
  await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(titles)
  await expect(preparation.getByRole("status")).toHaveText("Review the selection, order and periods, then explicitly preserve it.")
  await expectCompletePreview(page, preparation, preview)

  const projectSection = sectionNamed(preview, "Projects")
  expect(projectSection.id).toBe(projects.item.id)
  expect(projectSection.recordCount).toBe(25)
  const names = projectSection.projection.values.filter((value) => /^projects\[id:reports-project-\d{2}\]\.name$/.test(value.id))
  expect(names.map((value) => value.value)).toEqual(corpus.projects.map((project) => project.name))
  names.forEach((value) => expect(value.period).toEqual({ start: corpus.today, end: corpus.today }))
  expect(sectionNamed(preview, "Hot Topics")).toMatchObject({ id: hotTopics.item.id, recordCount: 0, period: corpus.annual })
  await expect(preparation.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Hot Topics", exact: true }) })
    .getByText("No selected records in this section.", { exact: true })).toBeVisible()
  expect(sectionNamed(preview, "Budget").projection.values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  expect(sectionNamed(preview, "Budget").projection.values.filter((value) => value.id === `budget:${corpus.year}-01:forecast`))
    .toMatchObject([{ value: 110, period: corpus.january, currency: "unspecified" }])
  const month = sectionNamed(preview, "IT Operations")
  expect(month).toMatchObject({ id: operations.item.id, period: corpus.january })
  expect(month.projection.values.filter((value) => value.id === `tickets:${corpus.year}-01:Infrastructure|Incidents|Open`))
    .toMatchObject([{ value: 3, period: corpus.january, unit: "tickets" }])
  expect(month.projection.values.filter((value) => value.id === `tickets:${corpus.year}-01:Infrastructure|Service Requests|Open`))
    .toMatchObject([{ value: 0, period: corpus.january, unit: "tickets" }])
  for (const [title, amount] of [[baselineTitle, 100], [candidateTitle, 110]] as const) {
    const source = sectionNamed(preview, title)
    expect(source.period).toEqual(corpus.annual)
    expect(source.projection.values.filter((value) => value.id === "reports-agenda-license:1:forecast"))
      .toMatchObject([{ value: amount, period: corpus.january, currency: "USD" }])
  }
  expect(sectionNamed(preview, procurement.label).projection.values.filter((value) => value.id === "subject"))
    .toMatchObject([{ value: firstAgendaCorpus.requestTitle, period: corpus.annual }])
  expect(sectionNamed(preview, procurement.label).projection.values.filter((value) => value.id === "baseAmount"))
    .toMatchObject([{ value: 75, period: corpus.annual }])

  // Remove an explicitly added topic, then retain the owner's required first two topics.
  // RPT-03 continues to cover removal of one of the 25 individual project records.
  await preparation.getByRole("button", { name: "Remove IT Risks", exact: true }).click()
  await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(titles.filter((title) => title !== "IT Risks"))
  await expect(chosen.getByRole("button", { name: "Remove selected IT Risks", exact: true })).toHaveCount(0)
  await preparation.getByRole("button", { name: "Move up: Projects", exact: true }).click()
  const orderedTitles = ["Projects", "Budget", "Hot Topics", "IT Operations", baselineTitle, candidateTitle, procurement.label]
  await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(orderedTitles)
  const selectedSections = orderedTitles.map((title) => sectionNamed(preview, title))
  expect(selectedSections.some((section) => section.id === removed.item.id)).toBe(false)
  expect(await readSourceData(page.request, app)).toEqual(sourceBefore)

  const pendingPreserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  await preparation.getByRole("button", { name: "Confirm preservation", exact: true }).click()
  const preserved = await pendingPreserve
  expect(preserved.status()).toBe(200)
  expect(preserved.request().postDataJSON()).toEqual({ selectionRef: preview.selectionRef, sectionRefs: selectedSections.map((section) => section.id) })
  const body = object(await readNativeReportResponse(preserved))
  expect(body.status).toBe("ok")
  const saved = review(body.value)
  expect(saved.previousReviewRef).toBeUndefined()
  expect(saved.sections.map((section) => section.title)).toEqual(orderedTitles)
  expect(saved.sections.map((section) => section.id)).toEqual(selectedSections.map((section) => section.id))
  expect(saved.sections.map((section) => section.count)).toEqual(selectedSections.map((section) => section.recordCount))
  saved.sections.forEach((section, index) => {
    expect(section.period).toEqual(selectedSections[index]!.period)
    expect(projection(section.content)).toEqual(selectedSections[index]!.projection)
  })
  expect(saved.sections[0]!.count).toBe(25)
  await expect(preparation.locator("[data-sf-preserved-confirmed] p")).toHaveText("The producer confirmed that the review was preserved.")
  expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  expect(await readSourceData(page.request, app)).toEqual(sourceBefore)
  await info.attach("first-agenda-explicit-selection", { body: JSON.stringify({
    firstUse: true, previousReviewRef: null, discovery: selections, removedTopic: removed.item.id,
    selectionRef: preview.selectionRef, selectedRecords: preview.sectionRecordRefs.filter((entry) => entry.sectionRef !== removed.item.id),
    saved,
  }, null, 2), contentType: "application/json" })
  return { preparation, saved }
}

function sectionNamed(preview: ReviewAgendaPreview, title: string) {
  const sections = preview.sections.filter((section) => section.title === title)
  expect(sections, `Expected exactly one authorized section named ${title}`).toHaveLength(1)
  return sections[0]!
}

async function expectCompletePreview(page: Page, preparation: Locator, preview: ReviewAgendaPreview) {
  for (const section of preview.sections) {
    const row = preparation.getByRole("listitem").filter({ has: page.getByRole("heading", { name: section.title, exact: true }) })
    await expect(row).toHaveCount(1)
    await expect(row.getByText(`Section reference: ${section.id}`, { exact: true })).toBeVisible()
    await expect(row.getByText(`${section.period.start} – ${section.period.end} · ${section.recordCount} selected records`, { exact: true })).toBeVisible()
    for (const source of section.projection.context.sourceRefs)
      await expect(row.getByText(`Source: ${source.surface} · ${source.type} · ${source.id} · version ${source.version} · incarnation ${source.incarnation}`, { exact: true })).toBeVisible()
    await expect(row.getByRole("table", { name: `${section.title} · selected source values`, exact: true }).getByRole("cell"))
      .toHaveText(section.projection.values.flatMap((value) => [
        value.id, `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim(),
        `${value.period.start} – ${value.period.end}`,
        ({ confirmed: "Confirmed", estimated: "Estimated", hypothetical: "Hypothetical", absent: "Absent" })[value.evidenceState],
      ]))
  }
}
