import { test } from "bun:test"
import { expect } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "../../fixture/local-browser.ts"

test("chart and equivalent table preserve selection through keyboard and period brush", async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const decisionBuilt = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/decision-view.ts")], target: "browser", format: "esm" })
  if (!decisionBuilt.success || !decisionBuilt.outputs[0]) throw new Error("decision browser bundle failed")
  const decisionUrl = `data:text/javascript;base64,${Buffer.from(await decisionBuilt.outputs[0].text()).toString("base64")}`
  const portfolioBuilt = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/portfolio-view.ts")], target: "browser", format: "esm" })
  if (!portfolioBuilt.success || !portfolioBuilt.outputs[0]) throw new Error("portfolio browser bundle failed")
  const portfolioUrl = `data:text/javascript;base64,${Buffer.from(await portfolioBuilt.outputs[0].text()).toString("base64")}`
  const period = { start: "2027-01-01", end: "2027-02-28" }
  const ref = { schema: "sf-evidence-v1", refId: "ref", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "metric", recordId: "m", incarnation: "inc", version: 7, fields: ["value"], period, projectionDigest: "digest" } }
  const projection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 7, engineVersion: "engine", components: [], missing: [], values: [{ id: "jan", value: 0, currency: "USD", period: { start: "2027-01-01", end: "2027-01-31" }, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }, { id: "feb", value: null, currency: "USD", period: { start: "2027-02-01", end: "2027-02-28" }, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: "absent" }] }
  const presentation = { viewId: "BI01", series: [{ id: "actual", label: "Actual", unit: "USD", role: "actual", valueIds: ["jan", "feb"] }], limitations: [] }
  const fixture = await localBrowser()
  try {
    const page = await fixture.browser.newPage()
    await page.goto("about:blank")
    await page.evaluate(async (input) => {
      const module = await import(input.url)
      document.body.append(module.renderBiView({ viewId: "BI01", selectionRef: "selection", period: input.projection.context.period }, input.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, input.presentation))
    }, { url, projection, presentation })
    await expect(page.getByRole("row").filter({ hasText: "jan" })).toContainText("0")
    await expect(page.getByRole("row").filter({ hasText: "feb" })).toContainText("Indisponível")
    const mark = page.getByRole("button", { name: /jan: 0/ })
    await mark.focus()
    await page.keyboard.press("Enter")
    const selected = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(selected.selectionRef).toBe("selection")
    expect(selected.projectionVersion).toBe(7)
    expect(selected.reference.refId).toBe("ref")
    await page.getByRole("button", { name: "Aplicar filtro" }).focus()
    const restored = await page.evaluate(async (moduleUrl) => {
      const module = await import(moduleUrl)
      const selection = JSON.parse(document.body.dataset.selection ?? "null")
      const container = document.querySelector("section")
      return container ? module.restoreBiFocus(container, selection) : false
    }, url)
    expect(restored).toBe(true)
    await expect(mark).toBeFocused()
    await page.getByLabel("Arrastar início do período").focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByLabel("Início do período", { exact: true })).toHaveValue("2027-01-02")
    await page.getByLabel("Início do período", { exact: true }).fill("2027-02-01")
    await page.getByRole("button", { name: "Aplicar filtro" }).click()
    await expect(page.getByRole("row").filter({ hasText: "jan" })).toHaveCount(0)
    await expect(page.getByRole("row").filter({ hasText: "feb" })).toHaveCount(1)
    await expect(page.getByRole("status")).toContainText("Não há valores numéricos")
    await page.getByRole("button", { name: "Abrir origem" }).click()
    const brushed = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(brushed.valueId).toBe("feb")
    expect(brushed.context.period).toEqual({ start: "2027-02-01", end: "2027-02-28" })
    expect(brushed.reference.refId).toBe("ref")
    await page.evaluate(async (input) => {
      const module = await import(input.url)
      const horizon = { start: "2027-01-01", end: "2027-12-31" }
      const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, entries: [{ status: "pending", categoryId: "training", reason: "missing", questionRef: "question-1" }], derivedMissingCategoryIds: ["training"], coverageState: "pending", issues: [], evaluatedSourceRefs: [] }
      const scenario = { id: "alternative", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["training"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: coverage }
      const comparison = { baselineResultRef: "base", alternativeResultRef: "alternative", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null, criterionResults: [], unresolvedConditions: ["training"] }
      const sensitivity = { scenarioRef: "alternative", parameterRef: "training", bounds: { minimum: 0, maximum: 40000, steps: 2 }, evaluated: [{ parameterValue: 0, value: 30000, resultRef: "result-0" }], threshold: null, thresholdEvidence: { state: "unavailable", reason: "pending" }, unit: "unknown", engineVersion: "v1", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
      const unlabelled = module.renderDecisionView(scenario, comparison, sensitivity)
      unlabelled.id = "unlabelled-sensitivity"
      document.body.append(unlabelled)
      const container = module.renderDecisionView(scenario, comparison, { ...sensitivity, parameterUnit: "USD", resultUnit: "USD" }, undefined, undefined, undefined, undefined, (ref: string) => { document.body.dataset.result = ref })
      container.id = "decision-view"
      document.body.append(container)
      const portfolioModule = await import(input.portfolioUrl)
      const combination = { id: "with-analysis", caseRefs: [], components: [], costCoverageRefs: ["coverage"], conflicts: [], restrictions: [], eligibility: "conditioned", comparisonStatus: "conditioned" }
      const portfolio = portfolioModule.renderPortfolioView({ combinations: [{ ...combination, analysis: { scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison } }, { ...combination, id: "legacy" }], limitations: [], evidenceRefs: [] })
      portfolio.id = "portfolio-view"
      document.body.append(portfolio)
    }, { url: decisionUrl, portfolioUrl })
    await expect(page.locator("#unlabelled-sensitivity")).toContainText("unidades dos eixos não fornecidas")
    await expect(page.locator("#unlabelled-sensitivity")).toContainText("Cobertura: coverage")
    await expect(page.locator("#unlabelled-sensitivity")).toContainText("Pergunta: question-1")
    await expect(page.locator("#portfolio-view")).toContainText("Cenário: scenario-ref; comparação: comparison-ref")
    await expect(page.locator("#portfolio-view")).toContainText("subtotal conhecido: 210000")
    await expect(page.locator("#portfolio-view")).toContainText("Análise de cenário e comparação indisponível")
    await expect(page.locator("#decision-view")).toContainText("Eixo X: USD; eixo Y: USD")
    const sensitivityMark = page.locator('#decision-view svg g[role="button"]')
    await sensitivityMark.focus()
    await page.keyboard.press("Enter")
    expect(await page.locator("body").getAttribute("data-result")).toBe("result-0")
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  } finally {
    await fixture.dispose()
  }
}, 180000)
