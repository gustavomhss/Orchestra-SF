import { expect, type Locator, type Page, type Request, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import { prepareParameterizedScenario } from "./design-support/wave-five-analytics-source"
import { scheme } from "./design-support/wave-four"
import {
  analyticsTest, array, object, sourceText, controls, readPortfolio, isOperation,
  enter, ready, observePage, observeAnalyticsContext, observeAnalyticsOperations,
  captureAnalytics, captureModes, withPortuguese,
} from "./design-support/wave-five-analytics"

analyticsTest("wave five analytics: native scenarios, recorded results and sensitivity", async ({ page, browser, installation, owner }, info) => {
  analyticsTest.setTimeout(780_000)
  page.setDefaultTimeout(20_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostics = observePage(page)
  const contextReads = observeAnalyticsContext(page, owner)
  observeAnalyticsOperations(page, owner)
  const writes: Request[] = []
  page.on("request", (request) => {
    if (isOperation(request, "decision-portfolio-evaluate") || isOperation(request, "decision-sensitivity-evaluate")) writes.push(request)
  })
  const listing = await controls(page, owner)
  const cases = array(listing.cases).map(object)
  const main = cases.find((item) => item.title === waveFourDecisionsData.objective)
  const empty = cases.find((item) => item.title === waveFourDecisionsData.editableObjective)
  expect(main).toBeDefined()
  expect(empty).toBeDefined()
  const prepared = await prepareParameterizedScenario(page, owner, sourceText(main!.ref))
  const source = prepared.selected
  const decision = object(source.decision)
  const caseRef = object(source.caseRef)
  expect(array(decision.alternatives)).toHaveLength(3)
  expect(array(decision.choices)).toHaveLength(1)
  expect(array(decision.alternatives).map(object).every((entry) =>
    object(entry.result).total === null && object(entry.result).comparisonStatus === "conditioned")).toBe(true)

  await enter(page, owner, installation.origin + "/orchestra/sf-portfolio/scenarios", "Portfolio scenarios", 40_000)
  const scenarios = page.locator('[data-sf-scenarios]')
  await expect(scenarios).toHaveAttribute("data-sf-wave", "five")
  await expect(scenarios.locator(".sf-u19-case-list > li")).toHaveCount(cases.length)
  await contextReads("UI42-list")
  await captureModes(page, info, "UI42-list")
  await scenarios.locator(".sf-u19-case-list > li").filter({ hasText: waveFourDecisionsData.editableObjective }).getByRole("button").click()
  await ready(page, "Portfolio scenarios", 40_000)
  await expect(scenarios.getByText("No eligible scenarios in the authorized case.", { exact: true })).toBeVisible()
  await contextReads("UI42-empty-case", true)
  await expect(page.getByRole("button", { name: "Preview combinations", exact: true })).toBeDisabled()
  await captureAnalytics(page, info, "UI42-empty-authorized-case-test-data")
  await scenarios.getByRole("button", { name: "Choose a case", exact: true }).click()
  await scenarios.locator(".sf-u19-case-list > li").filter({ hasText: waveFourDecisionsData.objective }).getByRole("button").click()
  await ready(page, "Portfolio scenarios", 40_000)
  const scenariosHref = page.url()
  await expect(scenarios.getByRole("heading", { name: waveFourDecisionsData.objective, exact: true })).toBeVisible()
  const candidate = scenarios.locator(".sf-u19-candidates").getByRole("checkbox", { name: waveFourDecisionsData.plannerCandidate + " · v1", exact: true })
  await expect(candidate).toBeVisible()
  await candidate.check()
  const constraintControls = prepared.portfolioCriteria.map((criterion) => {
    const rules = array(source.rules).map(object).filter((rule) => rule.id === criterion)
    expect(rules).toHaveLength(1)
    expect(Number.isSafeInteger(rules[0]!.expectedVersion)).toBe(true)
    return scenarios.getByRole("group", { name: "Constraints", exact: true })
      .getByRole("checkbox", { name: criterion + " · v" + rules[0]!.expectedVersion, exact: true })
  })
  for (const constraint of constraintControls) await constraint.check()
  const limit = scenarios.getByLabel("Exploration limit", { exact: true })
  await limit.fill("4")
  await limit.focus()
  await expect(limit).toHaveCSS("outline-style", "solid")
  await captureAnalytics(page, info, "UI42-configure-focused-candidate-test-data")
  const previewResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-portfolio-preview"), { timeout: 60_000 })
  await page.getByRole("button", { name: "Preview combinations", exact: true }).click()
  const originalPreview = await previewResponse
  expect(originalPreview.status()).toBe(200)
  expect(object(object(originalPreview.request().postDataJSON()).request).constraints).toEqual(prepared.portfolioCriteria)
  await expect(scenarios).toHaveAttribute("data-sf-stage", "preview")
  await expect(scenarios.locator(".sf-u19-picker")).toBeHidden()
  await expect(scenarios.locator("[data-sf-eligibility]")).toHaveCount(1)
  await expect(scenarios.locator("[data-sf-eligibility]")).toHaveText("conditioned")
  await expect(scenarios.getByText("No total is inferred from partial coverage.", { exact: true })).toBeVisible()
  await expect(scenarios.getByRole("button", { name: "Confirm evaluation", exact: true })).toBeDisabled()
  expect(writes).toHaveLength(0)
  await captureAnalytics(page, info, "UI42-preview-condition-preserved-test-data")
  await scenarios.getByRole("button", { name: "Back to scenarios", exact: true }).click()
  await expect(candidate).toBeChecked()
  for (const constraint of constraintControls) await expect(constraint).toBeChecked()
  await expect(limit).toHaveValue("4")
  const repeatedPreview = page.waitForResponse((response) => isOperation(response.request(), "decision-portfolio-preview"), { timeout: 60_000 })
  await page.getByRole("button", { name: "Preview combinations", exact: true }).click()
  expect((await repeatedPreview).status()).toBe(200)
  await scenarios.getByRole("checkbox", { name: "Review portfolio request", exact: true }).check()
  await page.setViewportSize({ width: 390, height: 844 })
  const confirmPortfolio = scenarios.getByRole("button", { name: "Confirm evaluation", exact: true })
  await confirmPortfolio.scrollIntoViewIfNeeded()
  expect((await confirmPortfolio.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await captureAnalytics(page, info, "UI42-dark-390-confirm-evaluation-test-data")
  const recordedResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-portfolio-evaluate"), { timeout: 60_000 })
  await confirmPortfolio.click()
  expect((await recordedResponse).status()).toBe(200)
  await ready(page, "Portfolio scenarios", 60_000)
  const history = array(await readPortfolio(page, owner, "decision-portfolio-results", { caseRef })).map(object)
  expect(history).toHaveLength(1)
  expect(writes.filter((request) => isOperation(request, "decision-portfolio-evaluate"))).toHaveLength(1)
  const portfolioRef = sourceText(history[0]!.resultRef)
  const recorded = object(await readPortfolio(page, owner, "decision-portfolio-read", { caseRef, resultRef: portfolioRef }))
  const combinations = array(object(recorded.portfolio).combinations).map(object)
  expect(combinations).toHaveLength(1)
  expect(combinations[0]!.eligibility).toBe("conditioned")
  expect(combinations[0]!.comparisonStatus).toBe("conditioned")
  await scenarios.locator(".sf-u19-history").getByRole("button", { name: /Open result/ }).click()
  await ready(page, "Portfolio results", 60_000)
  const resultHref = page.url()
  await expect(scenarios).toHaveAttribute("data-sf-surface", "UI43")
  await expect(scenarios.locator("[data-sf-eligibility]")).toHaveText("conditioned")
  await scenarios.locator(".sf-u19-source > summary").first().click()
  await expect(scenarios.locator(".sf-u19-source").first()).toContainText(portfolioRef)
  await scenarios.locator(".sf-u19-source > summary").first().click()
  await captureModes(page, info, "UI43-recorded-conditioned")
  const combinationId = sourceText(combinations[0]!.id)
  const combinationDetail = scenarios.locator(".sf-u19-combination[data-sf-combination=" + JSON.stringify(combinationId) + "]")
  await expect(combinationDetail).toHaveCount(1)
  await scenarios.getByRole("button", { name: "Open record", exact: true }).click()
  await expect(combinationDetail).toHaveJSProperty("open", true)
  await expect(scenarios.locator("tr[data-sf-row=" + JSON.stringify(combinationId) + "]")).toHaveAttribute("aria-selected", "true")
  await expect(combinationDetail.locator(".sf-u19-facts")).toContainText(sourceText(combinations[0]!.costCoverageRefs && array(combinations[0]!.costCoverageRefs)[0]))
  await captureAnalytics(page, info, "UI43-source-restrictions-disclosure-test-data")

  await enter(page, owner, installation.origin + "/orchestra/sf-portfolio/sensitivity", "Sensitivity", 40_000)
  const sensitivity = page.locator("[data-sf-sensitivity]")
  await expect(sensitivity).toHaveAttribute("data-sf-wave", "five")
  await sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true }).selectOption(sourceText(empty!.ref))
  await expect(sensitivity.getByText("The producer has not issued authorized sensitivity units.", { exact: true })).toBeVisible()
  await captureAnalytics(page, info, "UI44-no-source-scenarios-test-data")
  await sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true }).selectOption(sourceText(main!.ref))
  await ready(page, "Sensitivity", 40_000)
  const sourceScenarios = array(source.scenarios).map(object)
  expect(sourceScenarios).toHaveLength(3)
  const selectedScenario = sourceScenarios.find((entry) => entry.ref === prepared.scenarioRef && entry.alternativeId === prepared.alternativeId)
  const baseline = sourceScenarios.find((entry) => entry.alternativeId === prepared.baselineAlternativeId)
  expect(selectedScenario).toBeDefined()
  expect(baseline).toBeDefined()
  const parameters = array(selectedScenario!.parameters).map(object)
  expect(parameters).toEqual([expect.objectContaining({ ref: prepared.parameterRef })])
  await sensitivity.getByRole("combobox", { name: "Scenario", exact: true }).selectOption(sourceText(selectedScenario!.ref))
  await sensitivity.getByRole("combobox", { name: "Baseline", exact: true }).selectOption(sourceText(baseline!.ref))
  await sensitivity.getByRole("combobox", { name: "Parameter", exact: true }).selectOption(sourceText(parameters[0]!.ref))
  await captureAnalytics(page, info, "UI44-original-source-selection-test-data")
  const unitQuery = { case: sourceText(main!.ref), scenario: sourceText(selectedScenario!.ref),
    baseline: sourceText(baseline!.ref), parameter: prepared.parameterRef }
  const unitsResponse = page.waitForResponse((response) => {
    const request = response.request(), url = new URL(request.url())
    return request.method() === "GET" && url.origin === owner.publicOrigin && url.pathname === owner.mount + "/dashboard" &&
      url.searchParams.get("sf") === "decision-controls" && url.searchParams.get("format") === "json" &&
      Object.entries(unitQuery).every(([key, value]) => url.searchParams.get(key) === value)
  }, { timeout: 60_000 }).then(async (response) => ({ response, body: object(await response.json()) }))
  await sensitivity.getByRole("button", { name: "Unit", exact: true }).click()
  const issued = await unitsResponse
  expect(issued.response.status()).toBe(200)
  expect(issued.response.request().postData()).toBeNull()
  const issuedUrl = new URL(issued.response.url())
  expect(issuedUrl.origin).toBe(owner.publicOrigin)
  expect(issuedUrl.pathname).toBe(owner.mount + "/dashboard")
  expect([...issuedUrl.searchParams]).toHaveLength(6)
  expect(Object.fromEntries(issuedUrl.searchParams)).toEqual({ sf: "decision-controls", format: "json", ...unitQuery })
  expect(issued.body.status).toBe("ok")
  const issuedSelection = object(object(issued.body.value).selected)
  expect(issuedSelection.ref).toBe(unitQuery.case)
  expect(issuedSelection.caseRef).toEqual(caseRef)
  expect(issuedSelection.unitSelection).toEqual({ scenarioRef: unitQuery.scenario,
    baselineRef: unitQuery.baseline, parameterRef: unitQuery.parameter })
  expect(issuedSelection.units).toEqual(prepared.sensitivityRule.units)
  expect(array(issuedSelection.rules).map(object).find((rule) => rule.id === prepared.sensitivityRule.criterionId))
    .toEqual({ id: prepared.sensitivityRule.criterionId, expectedVersion: prepared.sensitivityRule.version })
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "decision-controls-sensitivity-units",
    method: issued.response.request().method(), http: issued.response.status(), selection: issuedSelection.unitSelection,
    units: issuedSelection.units, acquisition: "native-original-get-body" }))
  await expect(sensitivity.locator(".sf-u19-criterion")).toBeVisible()
  await sensitivity.getByRole("combobox", { name: "Criterion", exact: true }).selectOption(prepared.sensitivityRule.criterionId)
  await sensitivity.getByRole("combobox", { name: "Operator", exact: true }).selectOption(prepared.sensitivityRule.operator)
  await sensitivity.getByLabel("Criterion value", { exact: true }).fill(String(prepared.sensitivityRule.value))
  const minimum = String(prepared.parameterValue)
  const maximum = String(prepared.parameterValue + 2000)
  await sensitivity.getByLabel("Minimum", { exact: true }).fill(minimum)
  await sensitivity.getByLabel("Maximum", { exact: true }).fill(maximum)
  await sensitivity.getByLabel("Steps", { exact: true }).fill("2")
  await captureModes(page, info, "UI44-issued-units-editor")
  await page.getByRole("button", { name: "Evaluate sensitivity", exact: true }).click()
  await expect(sensitivity).toHaveAttribute("data-sf-stage", "review")
  await expect(sensitivity.locator(".sf-u19-unit-selection")).toBeHidden()
  await expect(sensitivity.locator(".sf-u19-criterion")).toBeHidden()
  const review = sensitivity.getByRole("region", { name: "Review sensitivity request", exact: true })
  await expect(review).toContainText(minimum + " — " + maximum + " (2)")
  await expect(review).toContainText(sourceText(parameters[0]!.ref))
  await captureAnalytics(page, info, "UI44-dark-desktop-review-test-data")
  await review.getByRole("button", { name: "Cancel review", exact: true }).click()
  await expect(sensitivity.getByLabel("Minimum", { exact: true })).toHaveValue(minimum)
  await expect(sensitivity.getByLabel("Steps", { exact: true })).toHaveValue("2")
  await page.getByRole("button", { name: "Evaluate sensitivity", exact: true }).click()
  await page.setViewportSize({ width: 320, height: 800 })
  await review.getByRole("button", { name: "Confirm sensitivity evaluation", exact: true }).scrollIntoViewIfNeeded()
  await captureAnalytics(page, info, "UI44-dark-320-review-actions-test-data")
  const evaluatedResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-sensitivity-evaluate"), { timeout: 120_000 })
  await review.getByRole("button", { name: "Confirm sensitivity evaluation", exact: true }).click()
  const evaluated = await evaluatedResponse
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "decision-sensitivity-evaluate", http: evaluated.status() }))
  expect(evaluated.status()).toBe(200)
  await ready(page, "Sensitivity", 60_000)
  await expect(sensitivity).toHaveAttribute("data-sf-stage", "result")
  await expect(sensitivity.locator(".sf-u19-sensitivity-results")).toBeVisible()
  await expect(sensitivity.getByText("Unknown is distinct from recorded zero.", { exact: true })).toBeVisible()
  const sensitivityHref = page.url()
  const sensitivityRef = sourceText(await sensitivity.locator(".sf-u19-source bdi").textContent())
  const storedSensitivity = object(await readPortfolio(page, owner, "decision-sensitivity-read", { caseRef, resultRef: sensitivityRef }))
  const actualSensitivity = object(storedSensitivity.sensitivity)
  expect(array(actualSensitivity.evaluated).length).toBeGreaterThan(0)
  expect(actualSensitivity.comparisonStatus).not.toBe("complete")
  expect(actualSensitivity.threshold).toBeNull()
  const thresholdEvidence = object(actualSensitivity.thresholdEvidence)
  expect(["sampled", "unavailable"]).toContain(thresholdEvidence.state)
  const thresholdPanel = sensitivity.locator(".sf-u19-threshold")
  if (thresholdEvidence.state === "sampled") {
    await expect(thresholdPanel).toContainText("Sampled threshold interval")
    const interval = object(thresholdEvidence.interval)
    expect(typeof interval.minimum).toBe("number")
    expect(typeof interval.maximum).toBe("number")
    expect(interval.minimum as number).toBeLessThanOrEqual(interval.maximum as number)
    await expect(thresholdPanel).toContainText(String(interval.minimum) + " — " + String(interval.maximum))
  } else {
    await expect(thresholdPanel).toContainText("Threshold unavailable")
    await expect(thresholdPanel).toContainText(sourceText(thresholdEvidence.reason))
  }
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "sensitivity-threshold-readback",
    comparisonStatus: actualSensitivity.comparisonStatus, exactThreshold: actualSensitivity.threshold,
    thresholdEvidence }))
  expect(storedSensitivity.caseRef).toEqual(caseRef)
  expect(actualSensitivity.scenarioRef).toBe(prepared.scenarioRef)
  expect(actualSensitivity.parameterRef).toBe(prepared.parameterRef)
  expect(actualSensitivity.bounds).toEqual({ minimum: prepared.parameterValue, maximum: prepared.parameterValue + 2000, steps: 2 })
  const originalSamples = array(actualSensitivity.evaluated).map(object)
  const renderedSamples = sensitivity.locator(".sf-u19-table-scroll tbody tr")
  await expect(renderedSamples).toHaveCount(originalSamples.length)
  for (const [index, sample] of originalSamples.entries()) {
    const cells = renderedSamples.nth(index).locator("td")
    await expect(cells.nth(0)).toHaveText(String(sample.parameterValue) + " " + sourceText(actualSensitivity.parameterUnit))
    await expect(cells.nth(1)).toHaveText(sample.value === null ? "Unknown result" : String(sample.value) + " " + sourceText(actualSensitivity.unit))
    await expect(cells.nth(2)).toHaveText(sourceText(sample.resultRef))
  }
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "sensitivity-sample-readback",
    sampleCount: originalSamples.length, bounds: actualSensitivity.bounds,
    parameterUnit: actualSensitivity.parameterUnit, resultUnit: actualSensitivity.unit,
    values: originalSamples.map((sample) => ({ parameterValue: sample.parameterValue, value: sample.value })),
    binding: "exact-case-scenario-parameter" }))
  const sensitivityWrite = writes.find((request) => isOperation(request, "decision-sensitivity-evaluate"))!
  expect(object(sensitivityWrite.postDataJSON()).caseRef).toEqual(caseRef)
  expect(writes.filter((request) => isOperation(request, "decision-sensitivity-evaluate"))).toHaveLength(1)
  await captureModes(page, info, "UI44-recorded-samples")
  const sampleScroller = sensitivity.getByRole("region", { name: "Evaluation table", exact: true })
  await captureModes(page, info, "UI44-recorded-sample-table", sampleScroller)
  await sampleScroller.focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(sampleScroller).toBeFocused()
  await expect(sampleScroller).toHaveCSS("outline-style", "solid")

  await withPortuguese(page, browser, installation, async (localized) => {
    const localizedDiagnostics = observePage(localized)
    for (const screen of [
      { id: "UI42", href: scenariosHref, title: "Cenários de portfólio" },
      { id: "UI43", href: resultHref, title: "Resultados do portfólio" },
      { id: "UI44", href: sensitivityHref, title: "Sensibilidade" },
    ]) {
      await enter(localized, owner, screen.href, screen.title, 60_000)
      await expect(localized.locator('[data-sf-wave="five"]')).toHaveAttribute("data-sf-surface", screen.id)
      await captureAnalytics(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
    }
    await localized.setViewportSize({ width: 320, height: 800 })
    await captureAnalytics(localized, info, "UI44-pt-BR-dark-320-recorded-test-data")
    expect(localizedDiagnostics.pageErrors).toEqual([])
    expect(localizedDiagnostics.consoleErrors).toEqual([])
  })
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  console.info("SF_ANALYTICS_SCOPE " + JSON.stringify({
    surfaces: ["UI42", "UI43", "UI44"], originalCases: cases.length,
    originalAlternatives: array(decision.alternatives).length, originalParameterPromotions: 1,
    originalPortfolioResults: history.length, combinations: combinations.length,
    portfolioWrites: 1, sensitivityWrites: 1, sourceRef: portfolioRef,
    preserved: ["conditioned comparison", "pending cost coverage", "original rule and source-issued units", "no inferred complete total"],
  }))
})

async function revealBiAgingValue(plot: Locator) {
  await plot.evaluate((element) => {
    const label = element.querySelector(".sf-bi-axis-value")
    if (!label) throw new Error("The original numeric plot label is missing")
    element.scrollLeft += label.getBoundingClientRect().left - element.getBoundingClientRect().left - 12
  })
  const [label, viewport] = await Promise.all([
    plot.locator(".sf-bi-axis-value").first().boundingBox(), plot.boundingBox(),
  ])
  if (!label || !viewport) throw new Error("The numeric plot label is not rendered")
  expect(label.x).toBeGreaterThanOrEqual(viewport.x + 8)
  expect(label.x + label.width).toBeLessThanOrEqual(viewport.x + viewport.width - 8)
}

async function captureBiAgingPlots(page: Page, info: TestInfo, figure: Locator) {
  // Tiny original ages place their labels near the axis. The global far-end
  // capture remains appropriate for other comparisons, so align this view only.
  for (const mode of [
    { theme: "dark" as const, width: 1440, height: 1100, suffix: "-dark-desktop" },
    { theme: "light" as const, width: 1440, height: 1100, suffix: "-light-desktop" },
    { theme: "dark" as const, width: 390, height: 844, suffix: "-dark-390" },
    { theme: "light" as const, width: 320, height: 800, suffix: "-light-320" },
  ]) {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, mode.theme)
    await page.setViewportSize({ width: mode.width, height: mode.height })
    await figure.scrollIntoViewIfNeeded()
    const plot = figure.locator(".sf-bi-plot-region")
    await plot.evaluate((element) => { element.scrollLeft = 0 })
    const name = "UI46-operations-original-values" + mode.suffix
    await captureAnalytics(page, info, name + "-test-data")
    if (mode.width <= 390) {
      expect(await plot.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
      await revealBiAgingValue(plot)
      await captureAnalytics(page, info, name + "-scrolled-values-test-data")
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
}

function readLocalizedScalar(text: string, locale: string): number {
  const parts = new Intl.NumberFormat(locale).formatToParts(-12345.6)
  let normalized = text.trim()
  for (const group of new Set(parts.filter((part) => part.type === "group").map((part) => part.value)))
    normalized = normalized.split(group).join("")
  const decimal = parts.find((part) => part.type === "decimal")?.value
  const minus = parts.find((part) => part.type === "minusSign")?.value
  if (decimal) normalized = normalized.replace(decimal, ".")
  if (minus) normalized = normalized.replace(minus, "-")
  expect(normalized, "A scalar cell must contain a localized number, without a currency fallback").toMatch(/^-?\d+(?:\.\d+)?$/)
  const value = Number(normalized)
  expect(Number.isFinite(value)).toBe(true)
  return value
}

async function assertOriginalScalars(page: Page, body: Record<string, unknown>, locale: string) {
  const projection = object(body.projection)
  const currency = sourceText(object(projection.context).currency)
  const values = array(projection.values).map(object)
  const observations: { id: string; original: number; table: number; plot: number; unit: string }[] = []
  for (const series of array(object(body.presentation).series).map(object)) {
    const unit = sourceText(series.unit)
    if (unit === currency) continue
    for (const id of array(series.valueIds)) {
      const value = values.find((entry) => entry.id === id)
      if (!value || value.evidenceState === "absent" || typeof value.value !== "number" || !Number.isFinite(value.value)) continue
      const row = page.locator(".sf-chart-table tbody tr[data-sf-row=" + JSON.stringify(String(series.id) + ":" + String(id)) + "]")
      await expect(row).toHaveCount(1)
      const cells = row.locator("td")
      await expect(cells.nth(2)).toHaveText(unit)
      const tableText = sourceText(await cells.nth(1).textContent())
      const mark = page.locator(".sf-bi-series [data-sf-value-id=" + JSON.stringify(String(id)) + "] .sf-bi-axis-value")
      await expect(mark).toHaveCount(1)
      const plotText = sourceText(await mark.textContent())
      expect(plotText).toBe(tableText)
      const table = readLocalizedScalar(tableText, locale)
      const plot = readLocalizedScalar(plotText, locale)
      for (const shown of [table, plot]) {
        expect(Math.sign(shown), "The original scalar sign, including nonzero, must survive display").toBe(Math.sign(value.value))
        if (Number.isInteger(value.value)) expect(shown).toBe(value.value)
        else expect(Math.abs(shown - value.value) / Math.abs(value.value)).toBeLessThanOrEqual(0.00001)
      }
      observations.push({ id: String(id), original: value.value, table, plot, unit })
    }
  }
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-original-scalar-dom", locale, observations }))
}

async function assertBiSource(page: Page, url: string, view: string, captured?: { http: number; body: unknown }, locale = "en-US") {
  const received = captured ?? await (async () => {
    const response = await page.request.get(url)
    return { http: response.status(), body: await response.json() as unknown }
  })()
  expect(received.http).toBe(200)
  const body = object(received.body)
  expect(object(body.request).viewId).toBe(view)
  const projection = object(body.projection)
  const values = array(projection.values).map(object)
  const series = array(object(body.presentation).series).map(object)
  const valueIds = series.flatMap((entry) => array(entry.valueIds))
  const publishedPointer = (value: Record<string, unknown>) => {
    const drilldown = value.drilldown ? object(value.drilldown) : undefined
    const refs = array(value.sourceRefs).map(object)
    return drilldown?.refId ? drilldown : refs.length === 1 && refs[0]?.refId ? refs[0] : undefined
  }
  const selectedValue = valueIds.map((id) => values.find((value) => value.id === id)!).find((value) => publishedPointer(value))
  if (selectedValue) {
    const pointer = publishedPointer(selectedValue)!
    const bindings = values.flatMap((value) => {
      const refs = [...(value.drilldown ? [object(value.drilldown)] : []), ...array(value.sourceRefs).map(object)]
        .filter((ref) => ref.refId === pointer.refId)
        .filter((ref, index, all) => all.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
      return refs.map((ref) => ({ valueId: value.id, period: value.period, digest: ref.refDigest,
        sourceKeys: Object.keys(ref).sort() }))
    })
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-source-binding-readback", view,
      selectedValueId: selectedValue.id, referenceId: pointer.refId,
      valueBindingCount: bindings.length, distinctReferenceDigests: new Set(bindings.map((entry) => entry.digest)).size,
      bindings: bindings.map(({ digest: _digest, ...binding }) => binding) }))
  }
  await expect(page.locator(".sf-chart-table tbody tr")).toHaveCount(valueIds.length)
  const numeric = values.filter((entry) => valueIds.includes(entry.id) && entry.evidenceState !== "absent" && typeof entry.value === "number")
  const expectedRows = series.flatMap((entry) => array(entry.valueIds).map((id) => String(entry.id) + ":" + String(id)))
  expect(await page.locator(".sf-chart-table tbody tr").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-sf-row")))).toEqual(expectedRows)
  for (const value of numeric.filter((entry) => entry.unit === object(projection.context).currency))
    await expect(page.locator(".sf-chart-table")).toContainText(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value.value as number))
  await assertOriginalScalars(page, body, locale)
  const expectedPoints = series.flatMap((entry) => array(entry.valueIds).map((id) => {
    const value = values.find((value) => value.id === id)!
    expect(value).toBeDefined()
    return { id: String(id), evidence: String(value.evidenceState),
      kind: value.evidenceState !== "absent" && typeof value.value === "number" && Number.isFinite(value.value) ? "known" : "missing" }
  }))
  expect(await page.locator(".sf-bi-series [data-sf-value-id]").evaluateAll((points) => points.map((point) => ({
    id: point.getAttribute("data-sf-value-id"), evidence: point.getAttribute("data-sf-evidence"), kind: point.getAttribute("data-sf-value-kind"),
  })))).toEqual(expectedPoints)
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-data-readback", view,
    http: received.http, rows: valueIds.length, numericValues: numeric.length, missing: values.filter((entry) => entry.value === null || entry.evidenceState === "absent").length }))
  return values
}

async function chooseBi(page: Page, year: number) {
  await page.locator('[data-sf-field="start"]').fill(year + "-01-01")
  await page.locator('[data-sf-field="end"]').fill(year + "-12-31")
  const response = page.waitForResponse((entry) => new URL(entry.url()).searchParams.get("sf") === "bi-options", { timeout: 60_000 })
  await page.getByRole("button", { name: "Choose context", exact: true }).click()
  expect((await response).status()).toBe(200)
}

