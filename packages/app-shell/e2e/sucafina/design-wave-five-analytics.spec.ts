import { expect, type Page, type Request } from "@playwright/test"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import { prepareParameterizedScenario } from "./design-support/wave-five-analytics-source"
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
  observeAnalyticsOperations(page)
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
  const limit = scenarios.getByLabel("Exploration limit", { exact: true })
  await limit.fill("4")
  await limit.focus()
  await expect(limit).toHaveCSS("outline-style", "solid")
  await captureAnalytics(page, info, "UI42-configure-focused-candidate-test-data")
  const previewResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-portfolio-preview"), { timeout: 60_000 })
  await page.getByRole("button", { name: "Preview combinations", exact: true }).click()
  expect((await previewResponse).status()).toBe(200)
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
  await scenarios.locator(".sf-u19-combination > summary").click()
  await expect(scenarios.locator(".sf-u19-facts")).toContainText(sourceText(combinations[0]!.costCoverageRefs && array(combinations[0]!.costCoverageRefs)[0]))
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
  const unitsResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-sensitivity-units"), { timeout: 60_000 })
  await sensitivity.getByRole("button", { name: "Unit", exact: true }).click()
  expect((await unitsResponse).status()).toBe(200)
  await expect(sensitivity.locator(".sf-u19-criterion")).toBeVisible()
  await sensitivity.getByRole("combobox", { name: "Criterion", exact: true }).selectOption({ index: 1 })
  await sensitivity.getByLabel("Criterion value", { exact: true }).fill("2000")
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

async function assertBiSource(page: Page, url: string, view: string) {
  const response = await page.request.get(url)
  expect(response.status()).toBe(200)
  const body = object(await response.json())
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
  for (const value of numeric)
    await expect(page.locator(".sf-chart-table")).toContainText(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value.value as number))
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
    http: response.status(), rows: valueIds.length, numericValues: numeric.length, missing: values.filter((entry) => entry.value === null || entry.evidenceState === "absent").length }))
  return values
}

async function chooseBi(page: Page, year: number) {
  await page.locator('[data-sf-field="start"]').fill(year + "-01-01")
  await page.locator('[data-sf-field="end"]').fill(year + "-12-31")
  const response = page.waitForResponse((entry) => new URL(entry.url()).searchParams.get("sf") === "bi-options", { timeout: 60_000 })
  await page.getByRole("button", { name: "Choose context", exact: true }).click()
  expect((await response).status()).toBe(200)
}

analyticsTest("wave five analytics: question catalog and original contextual BI", async ({ page, browser, installation, owner }, info) => {
  analyticsTest.setTimeout(660_000)
  page.setDefaultTimeout(20_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostics = observePage(page)
  const writeOperations: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST") {
      const mode = new URL(request.url()).searchParams.get("sf")
      if (mode) writeOperations.push(mode)
    }
  })
  await enter(page, owner, installation.origin + "/orchestra/sf-bi", "Analytics", 40_000)
  const catalog = page.locator('[data-sf-catalog]')
  await expect(catalog).toHaveAttribute("data-sf-stage", "catalog")
  await expect(catalog.locator(".sf-bi-catalog-entry")).toHaveCount(11)
  await expect(catalog.locator(".sf-bi-family")).toHaveCount(3)
  await captureModes(page, info, "UI45-question-catalog")
  await catalog.locator(".sf-bi-catalog-entry").filter({ hasText: "BI01" }).click()
  await expect(catalog).toHaveAttribute("data-sf-stage", "context")
  await expect(catalog.locator('[data-sf-field="view"]')).toHaveValue("BI01")
  await chooseBi(page, installation.year)
  const selection = catalog.locator('[data-sf-field="selection"]')
  await expect(selection).toBeVisible()
  expect(await selection.locator('option:not([value=""])').count()).toBeGreaterThan(0)
  await selection.selectOption({ index: 1 })
  await captureAnalytics(page, info, "UI45-authorized-financial-context-test-data")
  const financialResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data", { timeout: 60_000 })
  await catalog.getByRole("button", { name: "View data", exact: true }).click()
  expect((await financialResponse).status()).toBe(200)
  await expect(catalog.locator('[data-sf-bi-view="BI01"]')).toBeVisible()
  await expect(catalog).toHaveAttribute("data-sf-stage", "result")
  await expect(catalog.locator(".sf-chart-table tbody tr").first()).toBeVisible()
  await captureAnalytics(page, info, "UI45-financial-source-values-test-data")
  await catalog.getByRole("button", { name: "Choose an authorized view", exact: true }).click()
  await expect(catalog.locator(".sf-bi-catalog-entry")).toHaveCount(11)
  await expect(catalog.locator(".sf-chart-frame")).toHaveCount(0)

  await enter(page, owner, installation.origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"), "Analysis details", 40_000)
  await expect(catalog.locator('[data-sf-field="view"]')).toBeDisabled()
  await chooseBi(page, installation.year)
  await catalog.locator('[data-sf-field="selection"]').selectOption({ index: 1 })
  const readData = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data", { timeout: 60_000 })
  await catalog.getByRole("button", { name: "View data", exact: true }).click()
  const originalDataResponse = await readData
  expect(originalDataResponse.status()).toBe(200)
  await expect(catalog.locator('[data-sf-bi-view="BI01"]')).toBeVisible()
  const financialValues = await assertBiSource(page, originalDataResponse.url(), "BI01")
  expect(financialValues.length).toBeGreaterThan(0)
  await captureAnalytics(page, info, "UI46-financial-selected-context-test-data")
  await captureModes(page, info, "UI46-financial-original-values", catalog.locator(".sf-bi-series").first())
  const tableRegion = catalog.locator(".sf-chart-table-region")
  await captureModes(page, info, "UI46-financial-source-table", tableRegion)
  await tableRegion.focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(tableRegion).toBeFocused()
  await expect(tableRegion).toHaveCSS("outline-style", "solid")
  const actionIds = await catalog.locator(".sf-bi-source-action-list button[data-sf-source-value-id]")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-sf-source-value-id")))
  const sourceRows = financialValues.flatMap((value) => {
    if (!actionIds.includes(sourceText(value.id))) return []
    const refs = array(value.sourceRefs).map(object)
    const pointer = value.drilldown ? object(value.drilldown) : refs.length === 1 ? refs[0] : undefined
    return pointer?.refId ? [{ valueId: sourceText(value.id), referenceId: sourceText(pointer.refId),
      referenceDigest: sourceText(pointer.refDigest) }] : []
  })
  expect(sourceRows.length).toBeGreaterThan(0)
  const sharedSource = sourceRows.find((row) => sourceRows.some((other) =>
    other.referenceId === row.referenceId && other.valueId !== row.valueId))
  const selectedSources = sharedSource
    ? sourceRows.filter((row) => row.referenceId === sharedSource.referenceId)
      .filter((row, index, all) => all.findIndex((other) => other.valueId === row.valueId) === index).slice(0, 2)
    : sourceRows.slice(0, 1)
  expect(selectedSources).toHaveLength(sharedSource ? 2 : 1)
  const originalProjectionText = await catalog.locator('[data-sf-bi-view="BI01"]').textContent()
  const originalSelection = await catalog.locator('[data-sf-field="selection"]').inputValue()
  for (const [index, selected] of selectedSources.entries()) {
    const sourceAction = catalog.locator(".sf-bi-source-action-list button[data-sf-source-value-id=" + JSON.stringify(selected.valueId) + "]")
    await expect(sourceAction).toHaveCount(1)
    const disclosure = sourceAction.locator("xpath=ancestor::details[1]")
    if (await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click()
    await expect(sourceAction).toBeVisible()
    const sourceResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-source", { timeout: 60_000 })
    await sourceAction.click()
    const originalSourceResponse = await sourceResponse
    expect(originalSourceResponse.status()).toBe(200)
    const requested = new URL(originalSourceResponse.url())
    expect(requested.origin).toBe(owner.publicOrigin)
    expect(requested.pathname).toBe(owner.mount + "/dashboard")
    expect(requested.searchParams.get("viewId")).toBe("BI01")
    expect(requested.searchParams.get("selectionRef")).toBe(originalSelection)
    expect(requested.searchParams.get("valueId")).toBe(selected.valueId)
    expect(requested.searchParams.get("referenceDigest")).toBe(selected.referenceDigest)
    const sourceLinks = array(object(await originalSourceResponse.json()).links).map(object)
    expect(sourceLinks.length).toBeGreaterThan(0)
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({
      operation: "bi-source-original-destinations", selectedValueId: selected.valueId,
      installedOrigin: owner.publicOrigin, installedMount: owner.mount,
      links: sourceLinks.map((link) => {
        const destination = new URL(sourceText(link.url), owner.publicOrigin + owner.mount + "/dashboard")
        expect(destination.username).toBe("")
        expect(destination.password).toBe("")
        return { label: sourceText(link.label), url: destination.href }
      }),
    }))
    const navigation = catalog.getByRole("navigation", { name: "Authorized source links", exact: true })
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole("link")).toHaveCount(sourceLinks.length)
    for (const [linkIndex, link] of sourceLinks.entries()) {
      const sourceLink = navigation.getByRole("link").nth(linkIndex)
      await expect(sourceLink).toHaveText(sourceText(link.label))
      const published = new URL(sourceText(link.url), owner.publicOrigin + owner.mount + "/dashboard")
      const rendered = new URL(sourceText(await sourceLink.getAttribute("href")), page.url())
      expect(rendered.origin).toBe(published.origin)
      expect(rendered.pathname).toBe(published.pathname)
      expect(rendered.hash).toBe(published.hash)
      if (published.pathname.startsWith("/orchestra/")) {
        const ownerKeys = ["server", "project", "installation"]
        expect([...published.searchParams.keys()].some((key) => ownerKeys.includes(key))).toBe(false)
        expect([...rendered.searchParams.entries()].filter(([key]) => !ownerKeys.includes(key)))
          .toEqual([...published.searchParams.entries()])
        expect(rendered.searchParams.size).toBe(published.searchParams.size + ownerKeys.length)
        expect(rendered.searchParams.get("server")).toBe(sourceText(new URL(page.url()).searchParams.get("server")))
        expect(rendered.searchParams.get("project")).toBe(owner.projectId)
        expect(rendered.searchParams.get("installation")).toBe(owner.installationId)
      } else {
        expect(rendered.href).toBe(published.href)
      }
    }
    expect(await catalog.locator('[data-sf-bi-view="BI01"]').textContent()).toBe(originalProjectionText)
    await navigation.scrollIntoViewIfNeeded()
    await captureAnalytics(page, info, "UI46-resolved-original-source-" + (index + 1) + "-test-data")
  }
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-source-identity-regression",
    selectedValues: selectedSources.map((source) => source.valueId), samePublishedReference: !!sharedSource,
    exactValueAndDigestQueries: selectedSources.length, originalProjectionRetained: true }))
  await catalog.locator('[data-sf-field="start"]').fill(installation.year + "-02-01")
  await expect(catalog.locator(".sf-chart-frame")).toHaveCount(0)
  await expect(catalog.getByRole("navigation", { name: "Authorized source links", exact: true })).toHaveCount(0)

  await enter(page, owner, installation.origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI06"), "Analysis details", 40_000)
  await chooseBi(page, installation.year)
  const operationsSelection = catalog.locator('[data-sf-field="selection"]')
  if (await operationsSelection.isVisible()) await operationsSelection.selectOption({ index: 1 })
  const operationalResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data", { timeout: 60_000 })
  await catalog.getByRole("button", { name: "View data", exact: true }).click()
  const originalOperationsResponse = await operationalResponse
  expect(originalOperationsResponse.status()).toBe(200)
  await expect(catalog.locator('[data-sf-bi-view="BI06"]')).toBeVisible()
  await assertBiSource(page, originalOperationsResponse.url(), "BI06")
  await catalog.locator(".sf-chart-visual").scrollIntoViewIfNeeded()
  await captureAnalytics(page, info, "UI46-operations-original-coverage-test-data")
  await page.setViewportSize({ width: 320, height: 800 })
  await catalog.locator(".sf-chart-table caption").scrollIntoViewIfNeeded()
  await captureAnalytics(page, info, "UI46-operations-dark-320-test-data")
  await page.setViewportSize({ width: 1440, height: 1100 })

  await enter(page, owner, installation.origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI11"), "Analysis details", 40_000)
  await chooseBi(page, installation.year)
  // This fixture has no persisted sensitivity evaluation. Preserve the source's
  // empty selection catalog; a view title is not evidence of a recorded result.
  const optionsResponse = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
    params: { sf: "bi-options", viewId: "BI11", start: installation.year + "-01-01", end: installation.year + "-12-31" },
  })
  expect(optionsResponse.status()).toBe(200)
  const originalOptions = object(object(await optionsResponse.json()).value)
  const originalChoices = array(originalOptions.choices)
  expect(originalChoices).toHaveLength(0)
  await expect(catalog.getByText("No authorized selections match these filters.", { exact: true })).toBeVisible()
  await expect(catalog.locator('[data-sf-bi-view="BI11"]')).toHaveCount(0)
  await captureAnalytics(page, info, "UI46-source-empty-sensitivity-catalog-test-data")

  await withPortuguese(page, browser, installation, async (localized) => {
    const localizedDiagnostics = observePage(localized)
    await enter(localized, owner, installation.origin + "/orchestra/sf-bi", "Análises", 40_000)
    await expect(localized.locator(".sf-bi-catalog-entry")).toHaveCount(11)
    await captureAnalytics(localized, info, "UI45-pt-BR-dark-desktop-catalog-test-data")
    await enter(localized, owner, installation.origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"), "Detalhe da análise", 40_000)
    await localized.locator('[data-sf-field="start"]').fill(installation.year + "-01-01")
    await localized.locator('[data-sf-field="end"]').fill(installation.year + "-12-31")
    const options = localized.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
    await localized.getByRole("button", { name: "Escolher contexto", exact: true }).click()
    expect((await options).status()).toBe(200)
    await localized.locator('[data-sf-field="selection"]').selectOption({ index: 1 })
    const data = localized.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await localized.getByRole("button", { name: "Ver dados", exact: true }).click()
    expect((await data).status()).toBe(200)
    await expect(localized.locator('[data-sf-bi-view="BI01"]')).toBeVisible()
    await localized.locator(".sf-bi-series").first().scrollIntoViewIfNeeded()
    await captureAnalytics(localized, info, "UI46-pt-BR-dark-desktop-values-test-data")
    await localized.setViewportSize({ width: 320, height: 800 })
    await localized.locator(".sf-chart-table caption").scrollIntoViewIfNeeded()
    await captureAnalytics(localized, info, "UI46-pt-BR-dark-320-values-test-data")
    expect(localizedDiagnostics.pageErrors).toEqual([])
    expect(localizedDiagnostics.consoleErrors).toEqual([])
  })
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  // BI read endpoints are GETs; no case/portfolio write is triggered by browsing.
  expect(writeOperations.filter((mode) => mode !== "bi-decision")).toEqual([])
  console.info("SF_ANALYTICS_SCOPE " + JSON.stringify({
    surfaces: ["UI45", "UI46"], catalogViews: 11, originalFinancialRead: true,
    originalOperationalRead: true, originalSourceResolution: true, originalSensitivityChoices: originalChoices.length,
    invalidatedOnPeriodChange: true, fabricatedResult: false,
  }))
})
