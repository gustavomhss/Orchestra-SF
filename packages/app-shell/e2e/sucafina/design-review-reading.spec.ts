import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfReviewDomainProjection, SfReviewPreserved, SfReviewsReviewSource } from "@orchestra/schema/sucafina/reviews"
import { waveFourTest, enter, observePage, originalRead, originalReads, type OriginalRead, capture, reflow, scheme, scrollPageTop } from "./design-support/wave-four"
import { captureWorkflowState } from "./design-support/workflow-polish-capture"
import { workflowPolishCoverage } from "./design-support/workflow-polish-coverage"
import { workflowCase, settledSurface, sourceObject, sourceText, sourceArray, type WorkflowOwner } from "./design-support/workflow-polish-source"
import { seedWorkflowCollab, workflowCollabData } from "./design-support/workflow-polish-collab-seed"
import { seedWorkflowProposal } from "./design-support/workflow-polish-proposal-seed"
import { forwardOnce } from "./operations-support/runtime"
import { readWorkflowAdmission, captureWorkflowRefusal, type WorkflowRequirement } from "./design-support/workflow-polish-admission"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

// Each case owns a real isolated enrollment, original source readbacks and three
// captures per checkpoint. These budgets include those multi-page journeys;
// writes are never retried and a blocked read is recorded with its original reason.
waveFourTest.use({ designWave: "four-decisions", trace: "off", video: "off" })
waveFourTest.describe.configure({ retries: 0 })
waveFourTest.beforeEach(async ({}, info) => {
  expect(info.config.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  await info.attach("workflow-polish-intended-scope", { contentType: "application/json",
    body: JSON.stringify(workflowPolishCoverage, null, 2) })
})

async function open(page: Page, owner: WorkflowOwner, path: string, title: string, surface: string,
  operation?: OriginalRead | readonly OriginalRead[]) {
  await enter(page, owner, owner.publicOrigin + path, title, 40_000, operation)
  return settledSurface(page, surface)
}
async function admitted(page: Page, owner: WorkflowOwner, info: TestInfo, path: string, surface: string, required: readonly WorkflowRequirement[]) {
  const proof = await readWorkflowAdmission(page, owner, info, surface, required)
  if (proof.ready) return true
  await captureWorkflowRefusal(page, owner, info, path, surface, proof)
  return false
}
async function record(page: Page, info: TestInfo, surface: string, state: string, evidence: string, focus?: string) {
  await settledSurface(page, surface)
  await captureWorkflowState(page, info, { surface, state, evidence, focus })
}

waveFourTest("workflow polish: original portfolio inputs and contextual analytics", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(660_000)
  const diagnostics = observePage(page)
  const selected = await workflowCase(page, owner)
  const encoded = encodeSfRouteRef(selected.ref)
  const caseAdmission = await readWorkflowAdmission(page, owner, info, "UI42",
    [{ operationId: "decisions.controls.read", family: "decisions" }])
  expect(caseAdmission.ready).toBe(true)
  // The current portfolio leaf additionally requires one entire resource ready.
  // Record that stricter prerequisite; this visual test must not promote a partial resource.
  const caseInputsAdmitted = caseAdmission.requirements[0]!.observations.some((operation) =>
    operation.resourceState === "ready" && operation.state === "ready" && operation.operational)
  const scenarios = await open(page, owner, "/orchestra/sf-portfolio/scenarios/" + encoded, "Portfolio scenarios", "UI42",
    caseInputsAdmitted ? { path: "/dashboard", query: { sf: "decision-controls", format: "json", case: selected.ref } } : undefined)
  if (caseInputsAdmitted) {
    await expect(scenarios.getByRole("heading", { name: "Scenario universe", exact: true })).toBeVisible()
    const candidates = scenarios.getByRole("group", { name: "Candidate scenarios", exact: true }).getByRole("checkbox")
    expect(await candidates.count()).toBe(sourceArray(selected.selected.alternatives).length)
    expect(await candidates.count()).toBeGreaterThan(0)
    await record(page, info, "UI42", "original-case-inputs", "Exact case and candidate identities came from the original decision-controls producer. No evaluation or preview is claimed.")
  } else {
    await expect(scenarios.locator('[data-sf-state="denied"]')).toHaveCount(1)
    await expect(scenarios).toContainText("The case is not available under current authority.")
    await expect(scenarios.getByRole("group", { name: "Candidate scenarios", exact: true })).toHaveCount(0)
    await record(page, info, "UI42", "original-resource-prerequisite",
      "The original case read exists, but neither controls resource is wholly ready in F01. The current portfolio leaf refuses its input read. This captures that refusal only; no portfolio inputs or result were rendered.")
  }

  const resultPath = "/orchestra/sf-portfolio/scenarios/" + encoded + "/results/" +
    encodeSfRouteRef("design-test-missing-portfolio-result")
  if (await admitted(page, owner, info, resultPath, "UI43",
    [{ operationId: "decisions.controls.read", family: "decisions" },
      { operationId: "portfolio.decision-portfolio-read", family: "portfolio" }])) {
    const results = await open(page, owner, resultPath, "Portfolio results", "UI43")
    await expect(results.locator(".sf-u19-results")).toHaveCount(0)
    await expect(results.locator('[data-sf-state="not-found"], [data-sf-state="unavailable"], [data-sf-state="invalid"], [data-sf-state="denied"]')).toHaveCount(1)
    await record(page, info, "UI43", caseInputsAdmitted ? "missing-result-negative-control" : "original-resource-prerequisite",
      "A deliberately nonexistent result under an original authorized case remains absent. If the input resource is partial, only that prerequisite refusal is rendered. No completed portfolio result is claimed.")
  }

  const sensitivityAdmission = await readWorkflowAdmission(page, owner, info, "UI44",
    [{ operationId: "decisions.controls.read", family: "decisions" }])
  expect(sensitivityAdmission.ready).toBe(true)
  const sensitivityInputsAdmitted = sensitivityAdmission.requirements[0]!.observations.some((operation) =>
    operation.resourceState === "ready" && operation.state === "ready" && operation.operational)
  const sensitivity = await open(page, owner, "/orchestra/sf-portfolio/sensitivity", "Sensitivity", "UI44",
    sensitivityInputsAdmitted ? { path: "/dashboard", query: { sf: "decision-controls", format: "json" } } : undefined)
  if (sensitivityInputsAdmitted) {
    const chooseCase = sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true })
    await expect(chooseCase.locator("option").filter({ hasText: sourceText(selected.selected.objective) })).toHaveCount(1)
    await originalRead(page, owner, { path: "/dashboard", query: { sf: "decision-controls", format: "json", case: selected.ref } },
      () => chooseCase.selectOption(selected.ref))
    await expect(sensitivity.locator(".sf-u19-sensitivity-form")).toHaveCount(1)
    await record(page, info, "UI44", "original-case-parameters", "Original authorized scenario, baseline and parameter choices. No sensitivity result or admitted evaluation is fabricated.")
  } else {
    await expect(sensitivity.locator('[data-sf-state="denied"]')).toHaveCount(1)
    await expect(sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true })).toHaveCount(0)
    await expect(sensitivity.locator(".sf-u19-sensitivity-form")).toHaveCount(0)
    await record(page, info, "UI44", "original-resource-prerequisite",
      "The current sensitivity leaf requires the same wholly ready controls resource as UI42. Only the original partial-resource refusal is visible; no parameters or sensitivity result are claimed.")
  }

  const catalog = await open(page, owner, "/orchestra/sf-bi", "Analytics", "UI45")
  await expect(catalog.getByRole("combobox", { name: "Analysis view", exact: true })).toBeEnabled()
  await expect(catalog.getByRole("button", { name: "Choose context", exact: true })).toBeDisabled()
  await record(page, info, "UI45", "initial-context", "Native analysis catalog requires an explicit authorized view and period.")

  const detail = await open(page, owner, "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"), "Analysis details", "UI46")
  await expect(detail.getByRole("combobox", { name: "Analysis view", exact: true })).toHaveValue("BI01")
  await detail.getByLabel("Start date", { exact: true }).fill(installation.year + "-01-01")
  await detail.getByLabel("End date", { exact: true }).fill(installation.year + "-12-31")
  const options = await forwardOnce(page, (url) => url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "bi-options", "GET")
  const [{ response: optionsResponse }] = await Promise.all([
    options.completed, detail.getByRole("button", { name: "Choose context", exact: true }).click(),
  ]).finally(options.close)
  expect(optionsResponse.status()).toBe(200)
  const optionsBody = sourceObject(await optionsResponse.json())
  expect(optionsBody.status).toBe("ok")
  const choices = sourceArray(sourceObject(optionsBody.value).choices).map(sourceObject)
  expect(choices.length).toBeGreaterThan(0)
  // The first producer-ordered option is explicitly selected, then qualified by its exact reference and label.
  const choice = choices[0]!
  const selector = detail.getByRole("combobox", { name: "Selection", exact: true })
  await expect(selector.getByRole("option", { name: sourceText(choice.label), exact: true })).toHaveCount(1)
  await selector.selectOption(sourceText(choice.selectionRef))
  const original = await forwardOnce(page, (url) => url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "bi-data", "GET")
  const [{ response: dataResponse }] = await Promise.all([
    original.completed, detail.getByRole("button", { name: "View data", exact: true }).click(),
  ]).finally(original.close)
  expect(dataResponse.status()).toBe(200)
  const data = sourceObject(await dataResponse.json())
  expect(sourceObject(data.request)).toMatchObject({ viewId: "BI01", selectionRef: choice.selectionRef,
    period: { start: installation.year + "-01-01", end: installation.year + "-12-31" } })
  expect(sourceArray(sourceObject(data.projection).values).length).toBeGreaterThan(0)
  await expect(detail.locator('[data-sf-bi-view="BI01"]')).toBeVisible()
  await record(page, info, "UI46", "original-financial-values", "Original contextual BI response, exact selection and period verified before capture.")
  await record(page, info, "UI46", "original-financial-chart", "Original BI values and exact contextual response were verified before scrolling to the first financial series; no new computation or source is introduced.", '[data-sf-bi-view="BI01"] > .sf-bi-series:first-of-type')

  const chartViewport = page.viewportSize()
  const chartScheme = await page.locator("html").getAttribute("data-color-scheme")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  const originalChartValues = new Map(sourceArray(sourceObject(data.projection).values).map(sourceObject).map((value) => [value.id, value]))
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await reflow(page)
    const series = detail.locator('[data-sf-bi-view="BI01"] > .sf-bi-series:first-of-type')
    const paired = series.locator(".sf-bi-mobile-values")
    await expect(paired).toBeVisible()
    await paired.scrollIntoViewIfNeeded()
    await expect(series.locator(".sf-bi-chart-scroll")).toBeHidden()
    const rows = await paired.locator("[data-sf-mobile-value-id]").evaluateAll((elements) => elements.map((element) => {
      const period = element.querySelector("dt")
      const value = element.querySelector("dd")
      if (!period || !value) throw new Error("A mobile source pair is missing")
      const bounds = element.getBoundingClientRect()
      const left = period.getBoundingClientRect(), right = value.getBoundingClientRect()
      return { id: element.getAttribute("data-sf-mobile-value-id"), period: period.textContent,
        value: value.querySelector("strong")?.textContent, unit: value.querySelector("span")?.textContent,
        fullyPaired: left.left >= bounds.left && right.right <= bounds.right + 1,
        minimumFontPx: Math.min(Number.parseFloat(getComputedStyle(period).fontSize), Number.parseFloat(getComputedStyle(value).fontSize)),
      }
    }))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const original = originalChartValues.get(row.id)
      expect(original, row.id ?? "source identity").toBeDefined()
      expect(row.period?.trim()).not.toBe("")
      expect(row.fullyPaired).toBe(true)
      expect(row.minimumFontPx).toBeGreaterThanOrEqual(12)
      if (original && typeof original.value === "number" && original.evidenceState !== "absent")
        expect(row.value).toBe(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(original.value))
    }
    await expect.poll(() => paired.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await info.attach("UI46-mobile-chart-original-value-proof-" + width, { contentType: "application/json",
      body: JSON.stringify({ source: "original contextual BI01 response", selectionRef: choice.selectionRef,
        period: sourceObject(data.request).period, viewport: { width, height: 800 }, rows, recomputedValues: false }) })
    await capture(page, info, "UI46-original-financial-chart-pairs-dark-" + width)
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  if (chartScheme === "dark" || chartScheme === "light") await scheme(page, chartScheme)
  if (chartViewport) await page.setViewportSize(chartViewport)
  await scrollPageTop(page)
  expect(diagnostics.pageErrors).toEqual([])
  await info.attach("portfolio-qualification-limit", { contentType: "text/plain",
    body: "UI42/UI44 input capture is conditional on the original resource prerequisite. A partial resource records the actual leaf refusal instead. UI43 may be refused by original F01 or show a missing-result negative control. None of these states qualifies portfolio/sensitivity evaluation." })
})

waveFourTest("workflow polish: original agenda, preserved review, comparison and report selection", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(720_000)
  const diagnostics = observePage(page)
  const sourceReviews = new Map<string, Schema.Schema.Type<typeof SfReviewPreserved>>()
  const agendaPath = "/orchestra/sf-reviews/agenda?year=" + installation.year
  const agenda = await open(page, owner, agendaPath, "Meeting agenda", "UI47")
  await expect(agenda.getByLabel("Source dashboard page", { exact: true })).toHaveValue("")
  await expect(agenda.locator('[data-sf-state="empty"]')).toContainText("Enter a dashboard page published by the source.")
  await expect(agenda.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Review selected sections", exact: true })).toBeDisabled()
  await record(page, info, "UI47", "initial-selection", "No agenda section has been selected or preserved.")

  const prepare = async () => {
    const current = await open(page, owner, agendaPath, "Meeting agenda", "UI47")
    await current.getByLabel("Source dashboard page", { exact: true }).fill("Budget Overview")
    await originalRead(page, owner, { path: "/api/ui/projections/review", query: {
      page: "Budget Overview", start: installation.year + "-01-01", end: installation.year + "-12-31",
    } }, () => current.getByRole("button", { name: "Find authorized sections", exact: true }).click())
    const available = current.getByRole("region", { name: "Available sections", exact: true })
    await expect(available.getByRole("listitem")).toHaveCount(1, { timeout: 40_000 })
    await available.getByRole("button", { name: "Add to agenda", exact: true }).click()
    await expect(current.locator("[data-sf-agenda-order] > li")).toHaveCount(1)
    await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
    const preview = current.locator("[data-sf-agenda-preview]")
    await expect(preview).toBeVisible({ timeout: 40_000 })
    await expect(preview.locator("ol > li")).toHaveCount(1)
    return preview
  }
  const preserve = async () => {
    const preview = page.locator("[data-sf-agenda-preview]")
    await preview.getByRole("button", { name: "Confirm preservation", exact: true }).click()
    const confirmed = page.locator("[data-sf-preserved-confirmed]")
    await expect(confirmed).toBeVisible({ timeout: 40_000 })
    const reference = sourceText(await confirmed.locator("dl > dt:first-of-type + dd").innerText())
    const original = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
      params: { sf: "dashboard-review", id: reference }, maxRetries: 0,
    })
    expect(original.status()).toBe(200)
    const body = sourceObject(await original.json())
    expect(body.status).toBe("ok")
    await info.attach("preserved-original-source-" + (sourceReviews.size + 1), {
      contentType: "application/json", body: JSON.stringify(body, null, 2),
    })
    const originalReview = Schema.decodeUnknownSync(SfReviewPreserved)(body.value)
    expect(originalReview.id).toBe(reference)
    expect(originalReview.sections).toHaveLength(1)
    for (const section of originalReview.sections) {
      const projection = Schema.decodeUnknownSync(SfReviewDomainProjection)(section.content)
      expect(projection.context).toMatchObject({
        installationId: owner.installationId, projectId: owner.projectId, surface: "dashboard",
        period: section.period,
      })
      expect(section.period).toEqual({ start: installation.year + "-01-01", end: installation.year + "-12-31" })
      expect(projection.values.length).toBeGreaterThan(0)
    }
    sourceReviews.set(reference, originalReview)
    return reference
  }
  await prepare()
  await record(page, info, "UI47", "source-preservation-review", "One original Budget Overview section and its producer period are selected; preservation has not been sent.", "[data-sf-agenda-preview]")
  const previous = await preserve()
  await expect(page.locator("[data-sf-preserved-confirmed]")).toContainText(previous)
  await record(page, info, "UI47", "original-preservation-confirmed", "The original preserve response was confirmed by a separate authenticated review read.", "[data-sf-preserved-confirmed]")
  await originalRead(page, owner, { path: "/dashboard", query: { sf: "dashboard-review", id: previous } },
    () => page.locator("[data-sf-preserved-confirmed]").getByRole("button", { name: "Open preserved review", exact: true }).click())
  await expect(page.locator('[data-review-ref=' + JSON.stringify(previous) + ']')).toBeVisible()
  expect(new URL(page.url()).searchParams.get("project")).toBe(owner.projectId)
  expect(new URL(page.url()).searchParams.get("installation")).toBe(owner.installationId)
  await prepare()
  const current = await preserve()
  expect(current).not.toBe(previous)

  const reviewEntry = await open(page, owner, "/orchestra/sf-reviews/reviews", "Preserved review", "UI48")
  await reviewEntry.getByLabel("Review reference", { exact: true }).fill(previous)
  await originalRead(page, owner, { path: "/dashboard", query: { sf: "dashboard-review", id: previous } },
    () => reviewEntry.getByRole("button", { name: "Open preserved review", exact: true }).click())
  const review = await settledSurface(page, "UI48")
  await expect(review.locator("[data-review-ref]")).toHaveAttribute("data-review-ref", previous)
  await expect(review.getByRole("region", { name: "Preserved section sequence", exact: true })).toBeVisible()
  await expect(review).toContainText(previous)
  const originalValues = sourceReviews.get(previous)!.sections.flatMap((section) =>
    Schema.decodeUnknownSync(SfReviewDomainProjection)(section.content).values)
  await expect(review.locator(".sf-n28-values > div")).toHaveCount(originalValues.length)
  for (const value of originalValues.filter((item) => /\.year$/.test(item.id))) {
    const row = review.locator('[data-sf-preserved-value=' + JSON.stringify(value.id) + ']')
    await expect(row.locator("dt")).toContainText("Year")
    await expect(row.locator(".sf-preserved-value")).toHaveText(String(value.value))
  }
  await expect(review.locator(".sf-preserved-record > h5")).not.toHaveCount(0)
  await expect(review.getByText("This preserved section cannot be displayed as an authorized domain projection.", { exact: true })).toHaveCount(0)
  await record(page, info, "UI48", "original-preserved-review", "Original review re-read after its producer confirmed preservation; every original projection value is rendered after the unchanged closed schema validates the source.")
  await page.getByRole("button", { name: "Present review", exact: true }).click()
  await expect(review).toHaveAttribute("data-sf-presentation", "true")
  await record(page, info, "UI48", "presentation", "Presentation mode of the same authorized preserved review, with original source provenance.", '[aria-label="Preserved review meeting"]')

  // Negative transport control only: the retry and links still use the original producer.
  const sourceButton = review.getByRole("button", { name: "Open source", exact: true })
  await expect(sourceButton).toHaveCount(1)
  let failedRead = false
  const sourceRead = (url: URL) => url.pathname === owner.mount + "/dashboard" &&
    url.searchParams.get("sf") === "dashboard-review" && url.searchParams.get("id") === previous
  await page.route(sourceRead, async (route) => {
    if (!failedRead) { failedRead = true; await route.abort("failed"); return }
    await route.continue()
  })
  await sourceButton.click()
  const sourceResult = review.locator("[data-sf-source-state]")
  await expect(sourceResult).toHaveAttribute("data-sf-source-state", "unavailable")
  await expect(sourceResult.getByRole("link")).toHaveCount(0)
  const originalSourceRefs = [...new Set(originalValues.flatMap((value) => value.sourceRefs.map((source) => source.refId)))]
  expect(originalSourceRefs).toHaveLength(1)
  const sourceReceipt = await forwardOnce(page, (url) => url.origin === owner.publicOrigin &&
    url.pathname === owner.mount + "/dashboard" && url.searchParams.get("sf") === "review-source" &&
    url.searchParams.get("reviewRef") === previous && url.searchParams.get("referenceId") === originalSourceRefs[0], "GET")
  const [{ response: sourceResponse }] = await Promise.all([
    sourceReceipt.completed,
    originalRead(page, owner, { path: "/dashboard", query: { sf: "dashboard-review", id: previous } },
      () => sourceResult.getByRole("button", { name: "Try again", exact: true }).click()),
  ]).finally(sourceReceipt.close)
  expect(sourceResponse.status()).toBe(200)
  const originalLinks = Schema.decodeUnknownSync(SfReviewsReviewSource.output)(await sourceResponse.json())
  expect("links" in originalLinks).toBe(true)
  await expect(sourceResult).toHaveAttribute("data-sf-source-state", "ready")
  await expect(sourceResult.getByRole("link")).not.toHaveCount(0)
  if ("links" in originalLinks) {
    await expect(sourceResult.getByRole("link")).toHaveCount(originalLinks.links.length)
    for (const link of originalLinks.links)
      await expect(sourceResult.getByRole("link", { name: link.label, exact: true })).toHaveAttribute("href", link.url)
  }
  await page.unroute(sourceRead)
  await record(page, info, "UI48", "source-retry-recovered",
    "One original review read was aborted as a negative transport control; explicit read retry recovered original authorized links, without a write.", "[data-sf-source-state]")

  const compare = await open(page, owner, "/orchestra/sf-reviews/compare?" +
    new URLSearchParams({ previousReview: previous, currentReview: current }), "Compare reviews", "UI49")
  await originalReads(page, owner, [
    { path: "/dashboard", query: { sf: "dashboard-review", id: previous } },
    { path: "/dashboard", query: { sf: "dashboard-review", id: current } },
  ], () => compare.getByRole("button", { name: "Read and compare authorized reviews", exact: true }).click())
  await expect(compare.locator("[data-sf-comparison-compatibility]")).toHaveAttribute("data-sf-comparison-compatibility", "compatible", { timeout: 40_000 })
  await expect(compare.locator('[data-change-numeric="true"]')).toHaveCount(0)
  await record(page, info, "UI49", "compatible-original-revisions", "Two separately preserved original reviews of the same material; compatibility is verified and no numeric change is invented.")
  await record(page, info, "UI49", "original-comparison-detail",
    "The first comparison rows retain original source-only differences; narrow rows pair Previous and Current under the same identity.",
    '[data-sf-comparison-diff="authorized"] > [data-section-id] > .sf-n28-scroll > table > tbody > tr:first-child')

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const rows = compare.locator('[data-sf-comparison-diff="authorized"] [data-section-id] tbody > tr')
    await expect(rows).not.toHaveCount(0)
    const geometry = await rows.evaluateAll((elements) => elements.map((element) => {
      const cells = element.querySelectorAll("td")
      const bounds = element.getBoundingClientRect()
      return { labels: [...cells].map((cell) => cell.getAttribute("data-label")),
        paired: cells.length === 2 && [...cells].every((cell) => {
          const rect = cell.getBoundingClientRect()
          return rect.left >= bounds.left && rect.right <= bounds.right + 1
        }) }
    }))
    expect(geometry.every((row) => row.paired && row.labels[0] === "Previous" && row.labels[1] === "Current")).toBe(true)
    await capture(page, info, "UI49-paired-comparison-" + width)
  }
  await page.setViewportSize({ width: 1440, height: 1100 })

  const reportEntry = await open(page, owner, "/orchestra/sf-reviews/reports", "Report", "UI50")
  await reportEntry.getByLabel("Review reference", { exact: true }).fill(previous)
  await originalRead(page, owner, { path: "/dashboard", query: { sf: "dashboard-review", id: previous } },
    () => reportEntry.getByRole("button", { name: "Open review for export", exact: true }).click())
  const report = await settledSurface(page, "UI50")
  const selectedSections = report.locator("[data-section-id] input[type=checkbox]")
  await expect(selectedSections).toHaveCount(1)
  await expect(selectedSections).toBeChecked()
  await expect(report.getByRole("combobox", { name: "Office format", exact: true })).toBeVisible()
  await expect(report.getByRole("combobox")).toHaveCount(1)
  await expect(report.getByRole("textbox", { name: "Title", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Generate report", exact: true })).toHaveCount(1)
  const preservedSource = report.getByText(previous, { exact: true })
  await expect(preservedSource).toHaveCount(1)
  await expect(preservedSource).toBeHidden()
  await report.getByText("Preserved review", { exact: true }).click()
  await expect(preservedSource).toBeVisible()
  await expect(preservedSource).toHaveText(previous)
  await record(page, info, "UI50", "authorized-report-source-reference",
    "The original preserved-review identifier remains complete and accessible in the native disclosure. No source identity or report content is replaced.",
    "details.sf-technical-details")
  await report.getByText("Preserved review", { exact: true }).click()
  await expect(preservedSource).toBeHidden()
  await record(page, info, "UI50", "authorized-report-selection", "Original preserved content and one selected section; no DOCX/PPTX artifact or download is claimed.")
  await record(page, info, "UI50", "authorized-report-content-and-notes",
    "The original authorized section and preserved notes remain available below the original report controls. No Office generation or download is claimed.",
    'section[aria-label="Preserved notes and comments"] > h2')
  await selectedSections.uncheck()
  await expect(page.getByRole("button", { name: "Generate report", exact: true })).toBeDisabled()
  await record(page, info, "UI50", "empty-report-selection", "The explicit empty section selection keeps report generation disabled.")
  expect(diagnostics.pageErrors).toEqual([])
})

