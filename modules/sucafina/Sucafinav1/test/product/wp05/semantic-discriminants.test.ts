import { test } from "bun:test"
import { chromium, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import path from "node:path"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, ProjectionComponent, SourceRef } from "../../../product/contracts/context.ts"
import type { ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"

// These are renderer discriminants over producer-supplied projections. They neither
// certify upstream event/financial engines nor an installed host or C17 resolver.
let renderer: Promise<string> | undefined
function rendererUrl() {
  return renderer ??= (async () => {
    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("BI semantic renderer bundle failed")
    return `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  })()
}

async function withRenderer(run: (page: Page, moduleUrl: string) => Promise<void>) {
  const moduleUrl = await rendererUrl()
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    await run(page, moduleUrl)
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
}

test("Top N stays partial; a producer-supplied other group preserves its contribution and C17 component references", async () => {
  await withRenderer(async (page, moduleUrl) => {
    await page.evaluate(async (url) => {
      const module = await import(url)
      const period = { start: "2027-01-01", end: "2027-12-31" }
      const record = (id: string): BusinessEvidenceRef => ({ schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: `fixture-${id}`, evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast-component", recordId: id, incarnation: `${id}-inc`, version: 7, fields: ["contribution"], period, projectionDigest: `fixture-projection-${id}` } })
      const other: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "producer-other-group", installationId: "i", projectId: "p", refDigest: "fixture-other-group", evidenceLevel: "observed", kind: "calculation", target: { calculationId: "producer-other-group", runId: "producer-run", engineVersion: "producer-fixture", inputDigest: "fixture-input", resultDigest: "fixture-result", sourceRefs: [record("other-component-a"), record("other-component-b")], period, currency: "USD" } }
      const value = (id: string, amount: number, ref = record(id)): DomainProjection["values"][number] => ({ id, value: amount, unit: "USD", currency: "USD", period, granularity: "aggregate", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" })
      const projection = (values: DomainProjection["values"]): DomainProjection => ({ context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", currency: "USD", period, sourceRefs: [], capabilities: [] }, version: 7, engineVersion: "producer-fixture", values, components: [], missing: [] })
      const open = (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }
      const partial: BiPresentation = { viewId: "BI03", series: [{ id: "change", label: "Top N", unit: "USD", role: "contribution", valueIds: ["positive", "negative"] }], limitations: ["Top N fornecido pelo produtor; restante não agregado."] }
      const partialView = module.renderBiView({ viewId: "BI03", selectionRef: "partial-selection", period }, projection([value("positive", 40), value("negative", -30)]), open, partial)
      partialView.id = "partial"
      const fullValues = [value("initial", 100), value("positive", 40), value("after-positive", 140), value("negative", -30), value("after-negative", 110), value("others", -5, other), value("end", 105), value("final", 105)]
      const full: BiPresentation = { viewId: "BI03", series: [
        { id: "base", label: "Base", unit: "USD", role: "baseline", valueIds: ["initial"] },
        { id: "change", label: "Contribuições", unit: "USD", role: "contribution", valueIds: ["positive", "negative", "others"] },
        { id: "result", label: "Resultado do produtor", unit: "USD", role: "result", valueIds: ["final"] },
      ], limitations: ["Outros é um agregado fornecido pelo produtor."], waterfall: { segments: [
        { label: "Aumento", componentValueId: "positive", startValueId: "initial", endValueId: "after-positive" },
        { label: "Redução", componentValueId: "negative", startValueId: "after-positive", endValueId: "after-negative" },
        { label: "Outros", componentValueId: "others", startValueId: "after-negative", endValueId: "end" },
      ], finalValueId: "final", reconciliation: "reconciled" } }
      const fullView = module.renderBiView({ viewId: "BI03", selectionRef: "full-selection", period }, projection(fullValues), open, full)
      fullView.id = "with-others"
      document.body.dataset.expectedOther = JSON.stringify(other)
      document.body.append(partialView, fullView)
    }, moduleUrl)
    const partial = page.locator("#partial")
    await expect(partial).toContainText("não são um total reconciliado")
    const partialTable = partial.getByRole("table", { name: "Dados e referências" })
    await expect(partialTable.getByRole("row")).toHaveCount(3)
    await expect(partialTable.getByRole("cell", { name: "10", exact: true })).toHaveCount(0)
    await expect(partialTable.getByRole("row").filter({ hasText: "positive" }).getByRole("cell").nth(1)).toHaveText("40")
    await expect(partialTable.getByRole("row").filter({ hasText: "negative" }).getByRole("cell").nth(1)).toHaveText("-30")
    const full = page.locator("#with-others")
    await expect(full).not.toContainText("não são um total reconciliado")
    await expect(full.getByRole("table", { name: "Dados e referências" }).getByRole("row").filter({ hasText: "others" }).getByRole("cell").nth(1)).toHaveText("-5")
    const mark = full.getByRole("button", { name: /change · others: -5/ })
    await mark.focus()
    await page.keyboard.press("Enter")
    const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    const expectedOther = JSON.parse(await page.locator("body").getAttribute("data-expected-other") ?? "null")
    expect(selection).toMatchObject({ selectionRef: "full-selection", valueId: "others", projectionVersion: 7, engineVersion: "producer-fixture", context: { currency: "USD", period: { start: "2027-01-01", end: "2027-12-31" } } })
    expect(selection.reference).toEqual(expectedOther)
    expect(selection.reference.target.sourceRefs.map((ref: { target: { recordId: string } }) => ref.target.recordId)).toEqual(["other-component-a", "other-component-b"])
  })
}, 90000)

test("changing only current ticket status cannot rewrite supplied opening and closing periods", async () => {
  await withRenderer(async (page, moduleUrl) => {
    await page.evaluate(async (url) => {
      const module = await import(url)
      const period = { start: "2027-01-01", end: "2027-02-28" }
      const january = { start: "2027-01-01", end: "2027-01-31" }
      const february = { start: "2027-02-01", end: "2027-02-28" }
      const ref = (id: string, version = 1): BusinessEvidenceRef => ({ schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: `fixture-${id}-${version}`, evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dated-ticket-projection", recordId: id, incarnation: `${id}-inc`, version, fields: ["count", "period"], period, projectionDigest: `fixture-${id}` } })
      const event = (id: string, count: number, eventPeriod: typeof period): DomainProjection["values"][number] => ({ id, value: count, unit: "tickets", period: eventPeriod, granularity: "month", evidenceState: "confirmed", sourceRefs: [ref(id)], drilldown: ref(id) })
      const dated = [event("opened-january", 3, january), event("closed-february", 2, february)]
      const presentation: BiPresentation = { viewId: "BI07", series: [
        { id: "opened", label: "Aberturas fornecidas", unit: "tickets", role: "opened", valueIds: ["opened-january"] },
        { id: "closed", label: "Conclusões fornecidas", unit: "tickets", role: "closed", valueIds: ["closed-february"] },
      ], limitations: ["Série datada fornecida pelo produtor; este teste de componente não prova eventos individuais do domínio."] }
      const render = (id: string, currentStatus: string, version: number) => {
        const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", currency: "USD", period, sourceRefs: [], capabilities: [] }, version, engineVersion: "producer-fixture", components: [], missing: [], values: [...dated, { id: "current-status", value: currentStatus, period, granularity: "record", sourceRefs: [ref("current-status", version)], drilldown: ref("current-status", version), evidenceState: "confirmed" }] }
        const view = module.renderBiView({ viewId: "BI07", selectionRef: `ticket-selection-${id}`, period }, projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, presentation)
        view.id = id
        document.body.append(view)
      }
      render("before-status", "open", 7)
      render("after-status", "closed", 8)
    }, moduleUrl)
    const before = page.locator("#before-status")
    const after = page.locator("#after-status")
    for (const view of [before, after]) {
      const table = view.getByRole("table", { name: "Dados e referências" })
      await expect(table.getByRole("row").filter({ hasText: "opened-january" }).getByRole("cell").nth(1)).toHaveText("3")
      await expect(table.getByRole("row").filter({ hasText: "opened-january" })).toContainText("2027-01-01 – 2027-01-31")
      await expect(table.getByRole("row").filter({ hasText: "closed-february" }).getByRole("cell").nth(1)).toHaveText("2")
      await expect(table.getByRole("row").filter({ hasText: "closed-february" })).toContainText("2027-02-01 – 2027-02-28")
      await expect(view.locator('svg g[role="button"]')).toHaveCount(2)
    }
    await expect(before.getByRole("row").filter({ hasText: "current-status" }).getByRole("cell").nth(1)).toHaveText("open")
    await expect(after.getByRole("row").filter({ hasText: "current-status" }).getByRole("cell").nth(1)).toHaveText("closed")
    const geometry = await page.evaluate(() => ["before-status", "after-status"].map((id) => [...document.querySelectorAll(`#${id} svg g[role="button"]`)].map((mark) => ({ id: mark.getAttribute("data-bi-focus"), label: mark.getAttribute("aria-label"), x: mark.querySelector("circle")?.getAttribute("cx"), y: mark.querySelector("circle")?.getAttribute("cy") }))))
    expect(geometry[1]).toEqual(geometry[0])
    await after.getByRole("button", { name: /closed · closed-february: 2/ }).focus()
    await page.keyboard.press("Enter")
    const selected = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(selected).toMatchObject({ valueId: "closed-february", projectionVersion: 8, reference: { refId: "closed-february", target: { version: 1 } } })
  })
}, 90000)

test("a projected date change moves the timeline but cannot create savings or remove supplied obligations", async () => {
  await withRenderer(async (page, moduleUrl) => {
    await page.evaluate(async (url) => {
      const module = await import(url)
      const horizon = { start: "2027-01-01", end: "2027-12-31" }
      const source = (id: string): SourceRef => ({ surface: "planner", type: "projected-component", id, incarnation: `${id}-inc`, version: 1, fields: ["amount", "period"], period: horizon, observedAt: "2026-11-13T00:00:00Z" })
      const comparison: ScenarioComparison = { baselineResultRef: "baseline", alternativeResultRef: "alternative", costCoverageRefs: ["producer-coverage"], criterionResults: [], unresolvedConditions: ["Nenhuma regra financeira foi fornecida para alterar datas."], comparisonStatus: "conditioned", knownDifference: 5, completeDifference: null }
      const render = (id: string, implementationPeriod: typeof horizon, version: number) => {
        const components: ProjectionComponent[] = [
          { id: "bridge-obligation", amount: 10, currency: "USD", period: { start: "2027-01-01", end: "2027-03-31" }, sourceRefs: [source("bridge-source")], evidenceState: "confirmed" },
          { id: "implementation", amount: 20, currency: "USD", period: implementationPeriod, sourceRefs: [source("implementation-source")], evidenceState: "confirmed" },
        ]
        const scenario: ScenarioResult = { id: "alternative", version, currency: "USD", horizon, components, sourceRefs: [], restrictions: [], knownSubtotal: 30, total: null, comparisonStatus: "conditioned", unresolvedConditions: ["Nenhuma regra financeira foi fornecida para alterar datas."], costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: version, currency: "USD", horizon, coverageState: "pending", entries: [{ categoryId: "training", status: "pending", reason: "missing-category" }], derivedMissingCategoryIds: ["training"], issues: [], evaluatedSourceRefs: [] } }
        const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", currency: "USD", period: horizon, sourceRefs: [], capabilities: [] }, version, engineVersion: "producer-fixture", components, values: [], missing: [], decision: { kind: "scenario", scenarioResultRef: `scenario-${version}`, scenario, comparisonRef: "comparison", comparison } }
        const view = module.renderBiView({ viewId: "BI10", selectionRef: `date-selection-${id}`, period: horizon }, projection, () => {}, undefined, { openSource: (reference: SourceRef) => { document.body.dataset.source = JSON.stringify(reference) } })
        view.id = id
        document.body.append(view)
      }
      render("before-date", { start: "2027-04-01", end: "2027-04-30" }, 1)
      render("after-date", { start: "2027-05-01", end: "2027-05-31" }, 2)
    }, moduleUrl)
    const before = page.locator("#before-date")
    const after = page.locator("#after-date")
    for (const view of [before, after]) {
      await expect(view).toContainText("subtotal conhecido: 30 · total: indisponível · diferença conhecida (alternativa − referência): 5")
      await expect(view).toContainText("Nenhuma regra financeira foi fornecida para alterar datas.")
      const table = view.getByRole("table", { name: "Componentes fornecidos pelo domínio" })
      await expect(table.getByRole("row")).toHaveCount(3)
      await expect(table.getByRole("row").filter({ hasText: "bridge-obligation" }).getByRole("cell").nth(1)).toHaveText("10")
      await expect(table.getByRole("row").filter({ hasText: "implementation" }).getByRole("cell").nth(1)).toHaveText("20")
    }
    await expect(before.getByRole("table").getByRole("row").filter({ hasText: "implementation" })).toContainText("2027-04-01 – 2027-04-30")
    await expect(after.getByRole("table").getByRole("row").filter({ hasText: "implementation" })).toContainText("2027-05-01 – 2027-05-31")
    const timeline = await page.evaluate(() => ["before-date", "after-date"].map((id) => [...document.querySelectorAll(`#${id} svg g[role="button"]`)].map((mark) => ({ id: mark.getAttribute("data-bi-focus"), start: mark.querySelector("line")?.getAttribute("x1"), end: mark.querySelector("line")?.getAttribute("x2") }))))
    expect(timeline[0]).toHaveLength(2)
    expect(timeline[1]).toHaveLength(2)
    expect(timeline[1]?.[0]).toEqual(timeline[0]?.[0])
    expect(timeline[1]?.[1]?.start).not.toEqual(timeline[0]?.[1]?.start)
    expect(timeline[1]?.[1]?.end).not.toEqual(timeline[0]?.[1]?.end)
    await after.getByRole("button", { name: /implementation: 2027-05-01 – 2027-05-31/ }).focus()
    await page.keyboard.press("Enter")
    const source = JSON.parse(await page.locator("body").getAttribute("data-source") ?? "null")
    expect(source).toMatchObject({ id: "implementation-source", version: 1, fields: ["amount", "period"] })
  })
}, 90000)
