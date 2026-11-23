import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfReviewDomainProjection, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import { waveFourTest, enter, observePage, capture, reflow, scheme, scrollPageTop } from "./design-support/wave-four"
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

async function open(page: Page, owner: WorkflowOwner, path: string, title: string, surface: string) {
  await enter(page, owner, owner.publicOrigin + path, title, 40_000)
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
  const scenarios = await open(page, owner, "/orchestra/sf-portfolio/scenarios/" + encoded, "Portfolio scenarios", "UI42")
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
  const sensitivity = await open(page, owner, "/orchestra/sf-portfolio/sensitivity", "Sensitivity", "UI44")
  if (sensitivityInputsAdmitted) {
    const chooseCase = sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true })
    await expect(chooseCase.locator("option").filter({ hasText: sourceText(selected.selected.objective) })).toHaveCount(1)
    await chooseCase.selectOption(selected.ref)
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
  await record(page, info, "UI46", "original-financial-chart", "Original BI values and exact contextual response were verified before scrolling to the first financial series; no new computation or source is introduced.", '[data-sf-bi-view="BI01"] > .sf-bi-series:first-of-type .sf-bi-chart-scroll')

  const chartViewport = page.viewportSize()
  const chartScheme = await page.locator("html").getAttribute("data-color-scheme")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await page.setViewportSize({ width: 320, height: 800 })
  await reflow(page)
  const chartScroll = detail.locator('[data-sf-bi-view="BI01"] > .sf-bi-series:first-of-type .sf-bi-chart-scroll')
  await expect(chartScroll).toHaveCount(1)
  await expect(chartScroll).toHaveAttribute("tabindex", "0")
  await chartScroll.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }))
  await expect(chartScroll).toHaveJSProperty("scrollLeft", 0)
  const chartText = await chartScroll.locator(".sf-bi-svg").evaluate((element) => {
    const labels = [...element.querySelectorAll("text")].filter((text) => text.textContent?.trim())
    const sizes = labels.map((text) => {
      const matrix = text.getScreenCTM()
      if (!matrix) throw new Error("An original chart label is not rendered")
      return Number.parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b)
    })
    return { labelCount: labels.length, minimumFontPx: Math.min(...sizes) }
  })
  expect(chartText.labelCount).toBeGreaterThan(0)
  expect(chartText.minimumFontPx).toBeGreaterThanOrEqual(11)
  await chartScroll.hover()
  await page.mouse.wheel(10_000, 0)
  await expect.poll(() => chartScroll.evaluate((element) =>
    Math.abs(element.scrollWidth - element.clientWidth - element.scrollLeft))).toBeLessThanOrEqual(1)
  const chartPosition = await chartScroll.evaluate((element) => ({
    viewportWidth: element.clientWidth, contentWidth: element.scrollWidth, scrollLeft: element.scrollLeft,
  }))
  expect(chartPosition.scrollLeft).toBeGreaterThan(0)
  await info.attach("UI46-mobile-chart-original-value-proof", { contentType: "application/json",
    body: JSON.stringify({ source: "original contextual BI01 response", selectionRef: choice.selectionRef,
      period: sourceObject(data.request).period, viewport: { width: 320, height: 800 },
      text: chartText, horizontalScroll: chartPosition, input: "native horizontal wheel", recomputedValues: false }) })
  await capture(page, info, "UI46-original-financial-chart-values-dark-320")
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
    await current.getByRole("button", { name: "Find authorized sections", exact: true }).click()
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
  await prepare()
  const current = await preserve()
  expect(current).not.toBe(previous)

  const review = await open(page, owner, "/orchestra/sf-reviews/reviews/" + encodeSfRouteRef(previous), "Preserved review", "UI48")
  await expect(review.getByRole("region", { name: "Preserved section sequence", exact: true })).toBeVisible()
  await expect(review).toContainText(previous)
  const originalValues = sourceReviews.get(previous)!.sections.flatMap((section) =>
    Schema.decodeUnknownSync(SfReviewDomainProjection)(section.content).values)
  await expect(review.locator(".sf-n28-values > div")).toHaveCount(originalValues.length)
  await expect(review.getByText("This preserved section cannot be displayed as an authorized domain projection.", { exact: true })).toHaveCount(0)
  await record(page, info, "UI48", "original-preserved-review", "Original review re-read after its producer confirmed preservation; every original projection value is rendered after the unchanged closed schema validates the source.")
  await page.getByRole("button", { name: "Present review", exact: true }).click()
  await expect(review).toHaveAttribute("data-sf-presentation", "true")
  await record(page, info, "UI48", "presentation", "Presentation mode of the same authorized preserved review, with original source provenance.", '[aria-label="Preserved review meeting"]')

  const compare = await open(page, owner, "/orchestra/sf-reviews/compare?" +
    new URLSearchParams({ previousReview: previous, currentReview: current }), "Compare reviews", "UI49")
  await compare.getByRole("button", { name: "Read and compare authorized reviews", exact: true }).click()
  await expect(compare.locator("[data-sf-comparison-compatibility]")).toHaveAttribute("data-sf-comparison-compatibility", "compatible", { timeout: 40_000 })
  await expect(compare.locator('[data-change-numeric="true"]')).toHaveCount(0)
  await record(page, info, "UI49", "compatible-original-revisions", "Two separately preserved original reviews of the same material; compatibility is verified and no numeric change is invented.")
  await record(page, info, "UI49", "original-comparison-detail",
    "The first comparison rows of the original budget section are visible; source-only differences remain nonnumeric and the wide table keeps its own horizontal scroll.",
    '[data-sf-comparison-diff="authorized"] > [data-section-id] > .sf-n28-scroll > table > tbody > tr:first-child')

  const report = await open(page, owner, "/orchestra/sf-reviews/reports/" + encodeSfRouteRef(previous), "Report", "UI50")
  const selectedSections = report.locator("[data-section-id] input[type=checkbox]")
  await expect(selectedSections).toHaveCount(1)
  await expect(selectedSections).toBeChecked()
  await expect(report.getByRole("combobox", { name: "Office format", exact: true })).toBeVisible()
  await record(page, info, "UI50", "authorized-report-selection", "Original preserved content and one selected section; no DOCX/PPTX artifact or download is claimed.")
  await record(page, info, "UI50", "authorized-report-content-and-notes",
    "The original authorized section and preserved notes remain available below the original report controls. No Office generation or download is claimed.",
    'section[aria-label="Preserved notes and comments"] > h2')
  await selectedSections.uncheck()
  await expect(page.getByRole("button", { name: "Generate report", exact: true })).toBeDisabled()
  await record(page, info, "UI50", "empty-report-selection", "The explicit empty section selection keeps report generation disabled.")
  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: original relationships, discussion, confirmation and follow-up draft", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(720_000)
  const diagnostics = observePage(page)
  const sourceRequest = async (pathname: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (init?.method === "POST") headers.set("Origin", installation.origin)
    const response = await page.request.fetch(installation.origin + installation.mount + pathname, {
      method: init?.method ?? "GET", headers: Object.fromEntries(headers),
      ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000, maxRetries: 0,
    })
    return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
  }
  const seeded = await seedWorkflowCollab({ actorId: installation.actorId, request: sourceRequest }, installation.year)
  if (await admitted(page, owner, info, "/orchestra/sf-work/relations/" + encodeSfRouteRef(seeded.relation.id), "UI51",
    [{ operationId: "collaboration.relation-read" }])) {
    const relation = await open(page, owner, "/orchestra/sf-work/relations/" + encodeSfRouteRef(seeded.relation.id),
      "Record relationships", "UI51")
    await expect(relation.locator("[data-sf-relations-source]")).toHaveValue(seeded.relation.fromRef)
    await expect(relation).toContainText(seeded.relation.toRef)
    await record(page, info, "UI51", "original-relationship", "Original handoff relationship, source and target identities; no relationship mutation is submitted.")
    await relation.getByRole("button", { name: "Remove relationship", exact: true }).click()
    const removal = relation.locator("[data-sf-relation-remove-review]")
    await expect(removal).toContainText(seeded.relation.id)
    await record(page, info, "UI51", "removal-review", "Review of the existing exact relationship before any removal; the review is then cancelled.", "[data-sf-relation-remove-review]")
    await removal.getByRole("button", { name: "Keep editing", exact: true }).click()
    await expect(removal).toHaveCount(0)
  }

  if (await admitted(page, owner, info, "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id), "UI52",
    [{ operationId: "collaboration.thread-read" }])) {
    const thread = await open(page, owner, "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id),
      "Discussion", "UI52")
    await expect(thread.getByText(workflowCollabData.comment, { exact: true })).toBeVisible()
    await thread.getByRole("textbox", { name: "Comment", exact: true }).fill(workflowCollabData.draft)
    await thread.getByRole("button", { name: "Open originating record", exact: true }).click()
    await expect(thread.locator("[data-sf-thread-origin]")).toContainText(seeded.thread.sourceRef)
    await expect(thread.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(workflowCollabData.draft)
    await record(page, info, "UI52", "origin-and-unsent-draft", "Original unaddressed local test comment and source provenance; the new composer text remains unsent.")
  }

  const prepared = sourceObject(sourceObject(await seeded.post("collaboration-confirmation-prepare", { scope: seeded.scope })).value)
  if (await admitted(page, owner, info, "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(sourceText(prepared.selectionRef)), "UI53",
    [{ operationId: "collaboration.confirmation-project" }])) {
    const confirmation = await open(page, owner, "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(sourceText(prepared.selectionRef)),
      "Confirm no change", "UI53")
    await expect(confirmation.locator("[data-sf-confirm-material]")).toBeVisible()
    await expect(confirmation.locator("[data-sf-confirm-fingerprint]")).toHaveText(sourceText(prepared.scopeFingerprint))
    await expect(confirmation.locator("[data-sf-confirm-receipt]")).toHaveCount(0)
    await record(page, info, "UI53", "original-material-review", "Current material and exact fingerprint were prepared by the original producer; no no-change confirmation is submitted.")
  }

  const workbench = await forwardOnce(page, installation.origin + installation.mount + "/dashboard?sf=dashboard-workbench", "POST")
  const [{ response }] = await Promise.all([
    workbench.completed,
    open(page, owner, "/orchestra/sf-dashboard/hot-topics/proposals/" +
      encodeSfRouteRef("design-test-before-proposal-source"), "Follow-up proposal", "UI54"),
  ]).finally(workbench.close)
  expect(response.status()).toBe(200)
  const originalWorkbench = sourceObject(await response.json())
  expect(originalWorkbench.status).toBe("ok")
  const draft = await seedWorkflowProposal(page.request, installation, owner, originalWorkbench)
  const proposal = await open(page, owner, "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(draft.draftRef),
    "Follow-up proposal", "UI54")
  await expect(proposal).toContainText(draft.action)
  await expect(proposal.locator('[data-component="sf-change-review"]')).toHaveCount(0)
  await record(page, info, "UI54", "original-follow-up-draft", "Original authenticated draft and source evidence; no preparation, application or receipt is manufactured.")
  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: original memory inputs and explicit missing observations", async ({ page, owner }, info) => {
  waveFourTest.setTimeout(480_000)
  const diagnostics = observePage(page)
  const selected = await workflowCase(page, owner)
  for (const screen of [
    { id: "UI61", path: "/orchestra/sf-memory/signals", title: "Signals" },
    { id: "UI63", path: "/orchestra/sf-memory/outcomes", title: "Expected and observed" },
  ]) {
    if (!await admitted(page, owner, info, screen.path, screen.id,
      [{ operationId: "intelligence.memory-catalog" }])) continue
    const memory = await open(page, owner, screen.path, screen.title, screen.id)
    const read = memory.getByRole("button", { name: "Read authorized case", exact: true })
    await expect(read).toBeDisabled()
    await memory.getByLabel("Case ID", { exact: true }).fill(selected.id)
    await memory.getByLabel("Case incarnation", { exact: true }).fill(selected.incarnation)
    await memory.getByLabel("Case version", { exact: true }).fill(String(selected.version))
    await expect(read).toBeEnabled()
    const observed = ["memory-conditions", "memory-signals"].map((mode) =>
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin === owner.publicOrigin && url.pathname === owner.mount + "/dashboard" &&
          url.searchParams.get("sf") === mode
      }, { timeout: 40_000 }).then(async (response) => {
        expect(response.status()).toBe(200)
        const body = sourceObject(await response.json())
        expect(body.status).toBe("ok")
        return { mode, body }
      }))
    const [readings] = await Promise.all([Promise.all(observed), read.click()])
    const conditions = sourceArray(readings.find((entry) => entry.mode === "memory-conditions")!.body.value)
    const signals = sourceArray(readings.find((entry) => entry.mode === "memory-signals")!.body.signals)
    await expect(memory.locator(".sf-state-panel")).toHaveAttribute("data-sf-state",
      conditions.length || signals.length ? "ready" : "empty")
    await expect(memory.locator("[data-sf-condition-id]")).toHaveCount(conditions.length)
    await record(page, info, screen.id, "original-case-observations",
      "Exact identity and version came from original decision-controls; the native memory read determines the recorded conditions or explicit absence. No signal, outcome or causal attribution is created.")
  }
  if (await admitted(page, owner, info, "/orchestra/sf-memory/cases", "UI62",
    [{ operationId: "projection.cases" }, { operationId: "intelligence.memory-similar-cases" }])) {
    const similar = await open(page, owner, "/orchestra/sf-memory/cases", "Similar cases", "UI62")
    const selector = similar.locator(".sf-memory-similarity-form").getByRole("combobox")
    await expect(selector).toHaveCount(1)
    const option = selector.getByRole("option", { name: selected.title + " — " + selected.version, exact: true })
    await expect(option).toHaveCount(1)
    await expect(option).toHaveAttribute("value", selected.ref)
    await selector.selectOption(selected.ref)
    await expect(similar.locator(".sf-memory-candidates")).toBeVisible({ timeout: 40_000 })
    await record(page, info, "UI62", "authorized-source-and-candidates", "Original authorized case and candidate choices; no similarity search result is inferred from another screen.")
  }

  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: routines, schedules, exports and local context", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(660_000)
  const diagnostics = observePage(page)
  if (await admitted(page, owner, info, "/orchestra/sf-routines", "UI64",
    [{ operationId: "intelligence.analysis.choices", family: "intelligence" },
      { operationId: "routines.catalog", family: "intelligence" }])) {
    await open(page, owner, "/orchestra/sf-routines", "Routines", "UI64")
    await expect(page.getByRole("button", { name: "Prepare routine", exact: true })).toBeDisabled()
    await record(page, info, "UI64", "original-admission-prerequisites",
      "Native case/recipe admission state. No routine is prepared or run and a missing producer is recorded as missing.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/runs", "UI65",
    [{ operationId: "projection.routine", family: "intelligence" }])) {
    const runs = await open(page, owner, "/orchestra/sf-routines/runs", "Routine result", "UI65")
    await expect(runs.getByText("Select an authorized routine run.", { exact: true })).toBeVisible()
    await expect(runs.locator("[data-sf-native-execution]")).toHaveCount(0)
    await record(page, info, "UI65", "no-selected-run", "No run reference was selected; no execution or verified result is claimed.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/schedules", "UI66",
    [{ operationId: "schedules.list", family: "intelligence" }])) {
    const schedules = await open(page, owner, "/orchestra/sf-routines/schedules", "Schedule", "UI66")
    await expect(schedules.getByRole("heading", { name: "Schedules", exact: true })).toBeVisible()
    await expect(schedules.getByRole("heading", { name: "Occurrences", exact: true })).toBeVisible()
    await record(page, info, "UI66", "original-schedule-list", "Original installed schedule list or its explicit unavailable state; no recurrence is synthesized.")
    const newSchedule = await open(page, owner, "/orchestra/sf-routines/schedules/new", "Schedule", "UI66")
    await expect(newSchedule.getByLabel("Condition reference", { exact: true })).toHaveValue("")
    await expect(newSchedule.getByRole("button", { name: "Review proposed changes", exact: true })).toBeDisabled()
    await record(page, info, "UI66", "new-recurrence-prerequisites", "Empty original condition, recipe, recurrence and timezone fields keep review disabled; no schedule is created.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/residents", "UI70",
    [{ operationId: "projection.residents", family: "intelligence" }])) {
    const residents = await open(page, owner, "/orchestra/sf-routines/residents", "Contributions", "UI70")
    await expect(residents).toHaveAttribute("data-state", /^(ready|empty|unavailable|denied)$/)
    await record(page, info, "UI70", "original-resident-inventory",
      "Installed original resident inventory and its actual access state. Listing is not evidence of execution, contribution or a loaded skill pack.")

    const profileTitles = await residents.locator(".sf-n29-resident-list article > h2").allTextContents()
    if (profileTitles.length) {
      // Choose the first source-ordered profile by its observed unique identity, never by a guessed resident name.
      const profile = sourceText(profileTitles[0]).trim()
      const card = residents.locator(".sf-n29-resident-list article")
        .filter({ has: page.getByRole("heading", { name: profile, exact: true }) })
      await expect(card).toHaveCount(1)
      await card.getByRole("button", { name: "Open resident details", exact: true }).click()
      await expect(residents.locator(".sf-n29-resident-detail")).toContainText(profile)
      await record(page, info, "UI70", "original-resident-detail",
        "Selected original profile, skills and explicit case prerequisite; no verified contribution or run is manufactured.", ".sf-n29-resident-detail")
    }
  }

  const history = await open(page, owner, "/orchestra/sf-imports", "Import result", "UI57")
  const historyRead = history.locator('[data-sf-history="authorized-reference"]')
  await expect(historyRead).toBeVisible()
  await expect(historyRead.getByRole("button", { name: "Refresh receipt", exact: true })).toBeDisabled()
  await record(page, info, "UI57", "history-reference-prerequisite",
    "No authorized manifest reference has been selected. The applied receipt and actual denial are covered by operations.spec.ts.")

  const exports = await open(page, owner, "/orchestra/sf-imports/exports", "Exports", "UI68")
  await expect(exports.getByRole("combobox", { name: "File format", exact: true })).toBeVisible()
  await record(page, info, "UI68", "original-export-availability", "Original export controls and current prerequisite reasons; no file or download is claimed.")

  const context = await open(page, owner, "/orchestra/sf-home/context", "Context and access", "UI67")
  const identity = context.locator('[data-sf-context="authorized"]')
  await expect(identity).toContainText(owner.projectId)
  await expect(identity).toContainText(owner.installationId)
  await expect(identity).toContainText(installation.actorId)
  await record(page, info, "UI67", "original-local-operator-context", "Real local-operator enrollment; project, installation and principal match the original bound owner. No live Microsoft identity is simulated.")
  const summaryWrites: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === installation.origin &&
      url.pathname === installation.mount + "/api/ui/local-admin/configure-summaries") summaryWrites.push(url.pathname)
  })
  const administration = await open(page, owner, "/orchestra/sf-home/administration", "Local administration", "UI69")
  const summaries = administration.locator("[data-sf-summary-settings]")
  const form = summaries.locator("[data-sf-summary-form]")
  await expect(form).toBeVisible()
  const unavailable = administration.getByRole("region", { name: "Currently unavailable", exact: true })
  await expect(unavailable).toBeVisible()

  // Observe explicit original read actions after the owner and form have settled.
  // Bootstrap reads can be cancelled by context resolution and are not a delivery receipt.
  const observeOriginalRead = async (endpoint: string, trigger: () => Promise<void>) => {
    const read = await forwardOnce(page, (url) =>
      url.origin === installation.origin && url.pathname === installation.mount + endpoint, "GET")
    try {
      const [{ response }] = await Promise.all([read.completed, trigger()])
      return response
    } finally {
      await read.close()
    }
  }
  const adminResponse = await observeOriginalRead("/api/ui/projections/local-admin", () =>
    unavailable.getByRole("button", { name: "Try again", exact: true }).click())
  const adminBody = Schema.decodeUnknownSync(SfDomain.operations["projection.local-admin"].output)(await adminResponse.json())
  // The original private jobs/backups reader port is deliberately unbound.
  // A local-operator identity is not evidence that this separate producer returned data.
  expect(adminResponse.status()).toBe(503)
  expect(adminBody).toEqual({ status: "unavailable", reason: "local-operator-reader-not-bound" })
  await expect(administration).toHaveAttribute("data-sf-owner", "not-authorized")
  await expect(administration.getByRole("heading", { name: "Profile", exact: true })).toHaveCount(0)
  await expect(administration.getByRole("region", { name: "Currently unavailable", exact: true })).toBeVisible()

  const summaryResponse = await observeOriginalRead("/api/ui/local-admin/summary-settings", () =>
    summaries.getByRole("button", { name: "Current source", exact: true }).click())
  const summaryBody = Schema.decodeUnknownSync(SfDomain.operations["local-admin.summary-read"].output)(await summaryResponse.json())
  expect(summaryResponse.status()).toBe(200)
  if (summaryBody.status !== "ok") throw new Error("Original summary settings read required")
  expect(summaryBody.context.projectId).toBe(owner.projectId)
  expect(summaryBody.context.installationId).toBe(owner.installationId)
  expect(summaryBody.context.principalRef).toBe(installation.actorId)
  expect(summaryBody.value.canConfigure).toBe(true)
  expect(summaryBody.value.availablePages.length).toBeGreaterThan(0)
  await expect(form).toBeVisible()
  await expect(form).toHaveAttribute("data-version", String(summaryBody.value.version))
  const choices = form.locator('input[name="pages"]')
  expect(await choices.evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value)))
    .toEqual(summaryBody.value.availablePages)
  expect(await choices.evaluateAll((elements) => elements.filter((element) => (element as HTMLInputElement).checked)
    .map((element) => (element as HTMLInputElement).value))).toEqual(summaryBody.value.availablePages.filter((value) => summaryBody.value.pages.includes(value)))
  await info.attach("UI69-original-administration-readers", { contentType: "application/json",
    body: JSON.stringify({ profile: { httpStatus: adminResponse.status(), body: adminBody },
      summaries: { httpStatus: summaryResponse.status(), context: summaryBody.context, value: summaryBody.value },
      profileRendered: false, summarySettingsRendered: true, writes: summaryWrites }) })
  await record(page, info, "UI69", "original-summary-settings-and-unbound-profile",
    "The original summary-settings reader returned authorized data. The separate private jobs/backups projection returned503 local-operator-reader-not-bound; no Profile or backup data is fabricated.")
  await record(page, info, "UI69", "original-summary-settings-actions",
    "Original configurable summary choices and review action; no configuration write is submitted.", "[data-sf-summary-form] button[type=submit]")
  const first = summaryBody.value.availablePages[0]!
  await expect(choices.first()).toHaveValue(first)
  await choices.first().setChecked(!summaryBody.value.pages.includes(first))
  await form.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = summaries.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review.locator('.sf-s03-comparison-field[data-difference="changed"]')).toHaveCount(1)
  await expect(review.locator('.sf-s03-version[data-version="proposed"] .sf-s03-value-list')).toHaveCount(1)
  await record(page, info, "UI69", "summary-selection-review",
    "Original summary values compared with an unsent one-choice change; typed display keys preserve identity and order. The producer version and configure command remain unchanged.")
  await record(page, info, "UI69", "summary-selection-review-actions",
    "Review and cancel remain reachable in the original summary editor; no configuration, maintenance, restore or Teams write is invoked.", '[data-component="sf-change-review"] .sf-s03-actions')
  await review.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(review).toHaveCount(0)
  await expect(form).toBeVisible()
  expect(summaryWrites).toEqual([])
  expect(diagnostics.pageErrors).toEqual([])
})
