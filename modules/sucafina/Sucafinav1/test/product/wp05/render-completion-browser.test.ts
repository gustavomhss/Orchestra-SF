import { test } from "bun:test"
import { chromium, expect } from "@playwright/test"
import path from "node:path"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { BiFilterControls } from "../../../product/analytics/filter-controls.ts"

// This exercises rendering and interaction only; host authorization is covered separately.
test("BI components preserve endpoints, undated rows and unknown ages through keyboard navigation", async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("BI component bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    await page.evaluate(async (moduleUrl) => {
      const module = await import(moduleUrl)
      const period = { start: "2027-01-01", end: "2027-12-31" }
      const ref = (id: string, surface: "planner" | "dashboard" | "procurement"): BusinessEvidenceRef => ({ schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface, recordType: surface === "procurement" ? "procurement-request" : "metric", recordId: id, incarnation: "inc", version: 7, fields: ["value"], period, projectionDigest: "digest" } })
      const value = (id: string, amount: string | number | null, surface: "planner" | "dashboard" | "procurement", unit: string): DomainProjection["values"][number] => ({ id, value: amount, unit, ...(unit === "USD" ? { currency: unit } : {}), period, granularity: "aggregate", sourceRefs: [ref(id, surface)], drilldown: ref(id, surface), evidenceState: amount === null ? "absent" : "confirmed" })
      const projection = (surface: "planner" | "dashboard" | "procurement", values: DomainProjection["values"]): DomainProjection => ({ context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface, period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 7, engineVersion: "producer", components: [], missing: [], values })
      const open = (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }
      const values = [value("initial", 100, "planner", "USD"), value("up", 20, "planner", "USD"), value("middle", 120, "planner", "USD"), value("down", -5, "planner", "USD"), value("end", 115, "planner", "USD"), value("final", 115, "planner", "USD")]
      const waterfall: BiPresentation = { viewId: "BI02", series: [{ id: "values", label: "Values", unit: "USD", role: "contribution", valueIds: values.map((entry) => entry.id) }], limitations: [], waterfall: { segments: [{ label: "Increase", startValueId: "initial", endValueId: "middle", componentValueId: "up" }, { label: "Decrease", startValueId: "middle", endValueId: "end", componentValueId: "down" }], finalValueId: "final", reconciliation: "reconciled" } }
      const water = module.renderBiView({ viewId: "BI02", selectionRef: "waterfall-selection", period }, projection("planner", values), open, waterfall)
      water.id = "waterfall"
      const unknown = module.renderBiView({ viewId: "BI02", selectionRef: "waterfall-selection", period }, projection("planner", values.map((entry) => entry.id === "up" ? { ...entry, evidenceState: "absent" as const } : entry)), open, waterfall)
      unknown.id = "unknown-waterfall"
      const dates = [value("planned", "2027-01-15", "dashboard", "date"), value("completed", "2027-01-20", "dashboard", "date"), { ...value("undated", null, "dashboard", "date"), period: { start: "2027-02-01", end: "2027-02-01" } }]
      const timeline: BiPresentation = { viewId: "BI08", series: [{ id: "milestones", label: "Marcos", unit: "date", role: "planned", valueIds: dates.map((entry) => entry.id) }], limitations: [], timeline: { items: [{ label: "Planejado", dateValueId: "planned", state: "planned" }, { label: "Concluído", dateValueId: "completed", state: "completed" }, { label: "Sem data", dateValueId: "undated", state: "unknown" }] } }
      const milestones = module.renderBiView({ viewId: "BI08", selectionRef: "milestone-selection", period }, projection("dashboard", dates), open, timeline)
      milestones.id = "milestones"
      const ages = [
        value("a:inc:ageDays", 2, "procurement", "days"), value("a:inc:approvalStage", "Finance", "procurement", ""), value("a:inc:holder", "approver-a", "procurement", ""),
        value("b:inc:ageDays", 0, "procurement", "days"), value("b:inc:approvalStage", "Finance", "procurement", ""), value("b:inc:holder", null, "procurement", ""),
        { ...value("c:inc:ageDays", 999, "procurement", "days"), evidenceState: "absent" as const }, value("c:inc:approvalStage", "Legal", "procurement", ""),
      ]
      const aging: BiPresentation = { viewId: "BI06", series: [{ id: "aging", label: "Idade", unit: "days", role: "aging", valueIds: ages.filter((entry) => entry.id.endsWith(":ageDays")).map((entry) => entry.id) }], limitations: [] }
      const filters: BiFilterControls = {
        options: [
          { field: "stage", label: "Etapa", values: [{ value: "pr_pending", label: "PR" }, { value: "po_pending", label: "PO" }] },
          { field: "holder", label: "Responsável", values: [{ value: "holder-a", label: "A" }, { value: "holder-b", label: "B" }] },
          { field: "buyer", label: "Buyer", values: [{ value: "buyer-a", label: "Buyer A" }] },
        ],
        selected: [{ field: "stage", values: ["pr_pending"] }],
        apply: async (selected) => { document.body.dataset.filters = JSON.stringify(selected); return { status: "denied", reason: "access-changed" } },
      }
      const age = module.renderBiView({ viewId: "BI06", selectionRef: "aging-selection", period }, projection("procurement", ages), open, aging, undefined, filters)
      age.id = "aging"
      const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, entries: [{ status: "pending", categoryId: "training", reason: "missing" }], derivedMissingCategoryIds: ["training"], coverageState: "pending", issues: [], evaluatedSourceRefs: [] }
      const scenario = { id: "alternative", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["training"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 100, total: null, costCoverage: coverage }
      const comparison = { baselineResultRef: "base", alternativeResultRef: "alternative", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", knownDifference: 20, completeDifference: null, criterionResults: [], unresolvedConditions: ["training"] }
      const sensitivity = { scenarioRef: "alternative", parameterRef: "training", bounds: { minimum: 0, maximum: 40, steps: 2 }, evaluated: [{ parameterValue: 0, value: 20, resultRef: "sample-0" }, { parameterValue: 20, value: null, resultRef: "sample-gap" }], threshold: 20, thresholdEvidence: { state: "exact", value: 20, evidenceRefs: [ref("threshold", "planner")] }, unit: "USD", parameterUnit: "USD", resultUnit: "USD", engineVersion: "producer", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
      const decision = { kind: "scenario", scenarioResultRef: "scenario", scenario, comparisonRef: "comparison", comparison, sensitivity, sensitivityResultRef: "sensitivity" }
      const sensitive = module.renderBiView({ viewId: "BI11", selectionRef: "sensitivity-selection", period }, { ...projection("planner", []), decision }, open, undefined, { openResult: (reference: string) => { document.body.dataset.result = reference } })
      sensitive.id = "sensitivity"
      document.body.append(water, unknown, milestones, age, sensitive)
    }, url)
    const water = page.locator("#waterfall")
    await expect(water.locator("svg [data-bi-value]")).toHaveCount(4)
    const final = water.getByRole("button", { name: "Total final: 115 USD; abrir origem" })
    await final.focus()
    await page.keyboard.press("Enter")
    expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toMatchObject({ valueId: "final", selectionRef: "waterfall-selection", projectionVersion: 7, reference: { refId: "final" } })
    await expect(water.getByRole("table", { name: "Composição e origens" })).toContainText("Total inicial")
    await expect(water.getByRole("table", { name: "Composição e origens" })).toContainText("+20")
    await expect(water.getByRole("table", { name: "Composição e origens" })).toContainText("-5")
    await expect(page.locator('#unknown-waterfall svg [data-bi-value="up"]')).toHaveCount(0)
    await expect(page.locator("#unknown-waterfall")).toContainText("Reconciliação: unavailable")
    const milestones = page.locator("#milestones")
    await milestones.getByLabel("Fim do período", { exact: true }).fill("2027-01-31")
    await milestones.getByRole("button", { name: "Aplicar filtro" }).click()
    await expect(milestones.getByRole("list", { name: "Marcos sem data" })).toContainText("Sem data: unknown; data indisponível")
    await expect(milestones.getByRole("table", { name: "Dados e referências" }).getByRole("row").filter({ hasText: "undated" })).toContainText("Indisponível")
    const undated = milestones.getByRole("list", { name: "Marcos sem data" }).getByRole("button", { name: "Abrir Sem data" })
    await undated.focus()
    await page.keyboard.press("Enter")
    expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toMatchObject({ valueId: "undated", context: { period: { start: "2027-01-01", end: "2027-12-31" } }, visualPeriod: { start: "2027-01-01", end: "2027-01-31" }, reference: { refId: "undated" } })
    const age = page.locator("#aging")
    await expect(age).toContainText("Idade indisponível: 1 de 3 pedidos nesta seleção.")
    await expect(age).toContainText("Finance · days")
    await expect(age).toContainText("responsável: indisponível")
    await expect(age.locator('svg g[role="button"]')).toHaveCount(2)
    await expect(age.locator('svg g[role="button"] line')).toHaveCount(0)
    await expect(age.getByRole("row").filter({ hasText: "c:inc:ageDays" })).toContainText("Indisponível")
    await expect(age).not.toContainText("999")
    await age.getByLabel("Etapa", { exact: true }).selectOption("po_pending")
    await age.getByLabel("Responsável", { exact: true }).selectOption("holder-b")
    await age.getByLabel("Buyer", { exact: true }).selectOption("buyer-a")
    await age.getByRole("button", { name: "Aplicar filtros", exact: true }).focus()
    await page.keyboard.press("Enter")
    await expect(age.getByRole("group", { name: "Filtros autorizados de pedidos" }).getByRole("status")).toHaveText("Acesso alterado. Reabra os pedidos autorizados.")
    expect(JSON.parse(await page.locator("body").getAttribute("data-filters") ?? "null")).toEqual([{ field: "stage", values: ["po_pending"] }, { field: "holder", values: ["holder-b"] }, { field: "buyer", values: ["buyer-a"] }])
    await expect(age).toContainText("Idade indisponível: 1 de 3 pedidos nesta seleção.")
    await expect(age.locator('svg g[role="button"]')).toHaveCount(2)
    const sensitive = page.locator("#sensitivity")
    await expect(sensitive).toContainText("limiar exato 20 (condicionado à cobertura")
    await expect(sensitive).not.toContainText("Gráfico indisponível")
    const samples = sensitive.getByRole("table", { name: "Pontos de sensibilidade fornecidos pelo motor" })
    await expect(samples.getByRole("row").filter({ hasText: "sample-gap" })).toContainText("indisponível")
    await samples.getByRole("button", { name: "Abrir resultado sample-0" }).focus()
    await page.keyboard.press("Enter")
    expect(await page.locator("body").getAttribute("data-result")).toBe("sample-0")
    await expect(sensitive.locator('svg g[role="button"]')).toHaveCount(1)
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
}, 90000)
