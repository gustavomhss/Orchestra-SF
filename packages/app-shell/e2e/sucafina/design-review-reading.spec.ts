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
      const originalSeries = sourceArray(sourceObject(data.presentation).series).map(sourceObject)
        .find((series) => sourceArray(series.valueIds).includes(row.id))
      expect(originalSeries).toBeDefined()
      const originalCurrency = sourceObject(sourceObject(data.projection).context).currency
      expect(row.unit).toBe(originalSeries?.unit === "unspecified" && originalCurrency === "unspecified"
        ? "Currency not provided" : originalSeries?.unit)
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
