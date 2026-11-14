import { test } from "bun:test"
import { expect } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "../../fixture/local-browser.ts"

test("contribution and capacity panels preserve signs, missing values, selection and focus", async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const fixture = await localBrowser()
  try {
    const page = await fixture.browser.newPage()
    await page.goto("about:blank")
    await page.evaluate(async (moduleUrl) => {
      const module = await import(moduleUrl)
      const period = { start: "2027-01-01", end: "2027-03-31" }
      const ref = { schema: "sf-evidence-v1", refId: "ref", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v", incarnation: "inc", version: 1, fields: ["lines"], period, projectionDigest: "digest" } }
      const context = { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", currency: "USD", period, sourceRefs: [], capabilities: [] }
      const value = (id: string, amount: number | null, unit = "USD", evidenceState = "confirmed") => ({ id, value: amount, ...(unit === "fte" ? { unit } : { currency: unit }), period, granularity: "aggregate", sourceRefs: [ref], drilldown: ref, evidenceState })
      const projection = { context, version: 7, engineVersion: "engine", components: [], missing: [], values: [value("base", 1000), value("positive", 40), value("negative", -30)] }
      const presentation = { viewId: "BI03", series: [{ id: "base", label: "Base", unit: "USD", role: "baseline", valueIds: ["base"] }, { id: "change", label: "Contribuições", unit: "USD", role: "contribution", valueIds: ["positive", "negative"] }], limitations: [] }
      const contributions = module.renderBiView({ viewId: "BI03", selectionRef: "selection", period }, projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, presentation)
      contributions.id = "contributions"
      const unproven = module.renderBiView({ viewId: "BI03", selectionRef: "selection", period }, projection, () => {}, { ...presentation, series: [{ ...presentation.series[0], role: "result" }, presentation.series[1]], waterfall: { segments: [], finalValueId: "base", reconciliation: "reconciled" } })
      unproven.id = "unproven-reconciliation"
      const capacityValues = [value("fte", 0, "fte"), value("cost", null, "USD", "absent")]
      const capacityPresentation = { viewId: "BI04", series: [{ id: "fte", label: "Capacidade", unit: "fte", role: "fte", valueIds: ["fte"], alignmentKeys: ["team"] }, { id: "cost", label: "Custo", unit: "USD", role: "cost", valueIds: ["cost"], alignmentKeys: ["team"] }], limitations: [] }
      const capacity = module.renderBiView({ viewId: "BI04", selectionRef: "selection", period }, { ...projection, values: capacityValues }, () => {}, capacityPresentation)
      capacity.id = "capacity"
      const misaligned = module.renderBiView({ viewId: "BI04", selectionRef: "selection", period }, { ...projection, values: capacityValues }, () => {}, { ...capacityPresentation, series: [capacityPresentation.series[0], { ...capacityPresentation.series[1], alignmentKeys: ["other"] }] })
      misaligned.id = "misaligned-capacity"
      document.body.append(contributions, capacity, unproven, misaligned)
    }, url)
    const chart = page.locator("#contributions")
    await expect(chart).toContainText("não são um total reconciliado")
    await expect(chart).toContainText("Escala: -30 a 40 Contribuições · USD")
    await expect(chart).toContainText("Escala: 0 a 1000 Base · USD")
    const negative = chart.getByRole("button", { name: /change · negative: -30/ })
    await negative.focus()
    await page.keyboard.press("Enter")
    const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(selection.valueId).toBe("negative")
    expect(selection.selectionRef).toBe("selection")
    expect(selection.context.period).toEqual({ start: "2027-01-01", end: "2027-03-31" })
    expect(selection.reference.refId).toBe("ref")
    await chart.getByRole("button", { name: "Aplicar filtro" }).focus()
    const restored = await page.evaluate(async (moduleUrl) => {
      const module = await import(moduleUrl)
      const element = document.querySelector("#contributions")
      return element ? module.restoreBiFocus(element, JSON.parse(document.body.dataset.selection ?? "null")) : false
    }, url)
    expect(restored).toBe(true)
    await expect(negative).toBeFocused()
    await expect(page.locator("#unproven-reconciliation")).toContainText("não são um total reconciliado")
    await expect(page.locator("#misaligned-capacity")).toContainText("alinhamento entre capacidade e custo não fornecido")
    const capacity = page.locator("#capacity")
    await expect(capacity).toContainText("Custo · USD: indisponível")
    await expect(capacity.getByRole("button", { name: /fte · fte: 0/ })).toHaveCount(1)
    await expect(capacity.getByRole("row").filter({ hasText: "cost" })).toContainText("Indisponível")
  } finally {
    await fixture.dispose()
  }
}, 180000)
