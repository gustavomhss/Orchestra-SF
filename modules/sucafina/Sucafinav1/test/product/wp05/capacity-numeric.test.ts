import { expect, test } from "bun:test"
import path from "node:path"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { plannerCapacityPresentation } from "../../../product/planner/bi.ts"
import { rows } from "../../../runtime/contract.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "../wp03/planner-fixture.ts"
import { inspectWp05Browser } from "./browser.ts"

test("real scoped Planner capacity and cost remain numeric in aligned filtered BI panels without personal data", async () => {
  const snapshot = plannerSnapshot()
  const version = rows(snapshot.data.versions)[0]!
  version.closed = 0
  version.lines = []
  version.hc = { positions: [
    { id: "one", name: "PRIVATE_CAPACITY_NAME_ONE", include: true, fte: 1, start: 1, end: 3, domain: "IT", type: "Employee", location: "Brazil", rateId: "standard", talentReview: "PRIVATE_CAPACITY_REVIEW" },
    { id: "two", name: "PRIVATE_CAPACITY_NAME_TWO", include: true, fte: 0.5, start: 3, end: 3, domain: "IT", type: "Employee", location: "Brazil", rateId: "specialist" },
  ], rates: [{ id: "standard", name: "Standard", locs: "Brazil", annual: 120000, cur: "USD" }, { id: "specialist", name: "Specialist", locs: "Brazil", annual: 240000, cur: "USD" }], hrAF: {} }
  const fixture = await plannerFixture(snapshot)
  try {
    const sourceContext = await fixture.admit("sf-human:planner.read", {}, "viewer", true)
    const issued = await fixture.issueSource("v0", sourceContext)
    if (issued.status !== "ok") throw new Error(`Capacity source unavailable: ${JSON.stringify(issued)}`)
    const comparison = { baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period: plannerPeriod, currency: "USD" }
    const request = { viewId: "BI04", selectionRef: `capacity:${issued.value.evidence.refId}`, period: plannerPeriod }
    const factory = createSfBiFactory({ authority: fixture.authority, planner: { views: ["BI04"], host: {
      planner: fixture.planner,
      resolve: async (incoming) => incoming.selectionRef === request.selectionRef ? { status: "ok", value: { comparison, side: "candidate", present: (analysis) => plannerCapacityPresentation(analysis.candidate) } } : { status: "unavailable", reason: "selection-unavailable" },
      revalidate: (_incoming, context) => fixture.host.revalidate(context),
    } } })
    const result = await factory.dispatchPresentation(request, await fixture.admit("sf_bi_view", request, "viewer"))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(`Capacity BI unavailable: ${JSON.stringify(result)}`)
    const projection = result.value.projection
    for (const [month, fte, cost] of [[2, 1, 10000], [3, 1.5, 20000]]) {
      expect(projection.values.find((value) => value.id === `month:${month}:fte`)).toMatchObject({ value: fte, unit: "fte", evidenceState: "confirmed" })
      expect(projection.values.find((value) => value.id === `month:${month}:hr-budget`)).toMatchObject({ value: cost, currency: "USD", evidenceState: "confirmed" })
    }
    expect(result.value.presentation.series[0]?.alignmentKeys).toEqual(result.value.presentation.series[1]?.alignmentKeys)
    expect(result.value.presentation.series.map((series) => series.unit)).toEqual(["fte", "USD"])
    for (const privateValue of ["PRIVATE_CAPACITY_NAME_ONE", "PRIVATE_CAPACITY_NAME_TWO", "PRIVATE_CAPACITY_REVIEW", '"rateId"', '"rates"']) expect(JSON.stringify(projection)).not.toContain(privateValue)
    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("Capacity BI bundle unavailable")
    const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    await inspectWp05Browser("numeric FTE and cost", async (page, phase) => {
      phase("module-import")
      await page.evaluate(async (url) => { const module = await import(url); if (typeof module.renderBiView !== "function") throw new Error("BI renderer export unavailable") }, url)
      phase("render")
      await page.evaluate(async ({ url, value }) => {
        const module = await import(url)
        document.body.append(module.renderBiView(value.request, value.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, value.presentation))
      }, { url, value: result.value })
      phase("filter")
      const filtered = { start: "2027-02-01", end: "2027-03-31" }
      await page.getByLabel("Início do período", { exact: true }).fill(filtered.start)
      await page.getByLabel("Fim do período", { exact: true }).fill(filtered.end)
      await page.getByRole("button", { name: "Aplicar filtro" }).click()
      phase("numeric-panels")
      const fteMarks = page.locator('svg [data-bi-series="fte"]')
      const costMarks = page.locator('svg [data-bi-series="cost"]')
      expect(await fteMarks.count()).toBe(2)
      expect(await costMarks.count()).toBe(2)
      expect(await fteMarks.locator("circle").evaluateAll((points) => points.map((point) => point.getAttribute("cx")))).toEqual(await costMarks.locator("circle").evaluateAll((points) => points.map((point) => point.getAttribute("cx"))))
      const text = await page.locator("body").innerText()
      expect(text).toContain("Escala: 0 a 1.5 Capacidade planejada · fte")
      expect(text).toContain("Escala: 0 a 20000 Orçamento de pessoas · USD")
      expect(text).not.toContain("Painéis indisponíveis")
      for (const [month, fte, cost] of [[2, 1, 10000], [3, 1.5, 20000]]) {
        for (const [suffix, expected, series] of [["fte", fte, "fte"], ["hr-budget", cost, "cost"]] as const) {
          const id = `month:${month}:${suffix}`
          const canonical = projection.values.find((value) => value.id === id)!
          const mark = page.locator(`svg [data-bi-focus="${id}"]`)
          const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: id, exact: true }) })
          expect(await row.getByRole("cell").nth(1).textContent()).toBe(String(expected))
          expect(await mark.getAttribute("aria-label")).toContain(`${series} · ${id}: ${expected} `)
          phase(`navigate:${id}`)
          await mark.click()
          const clicked = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
          await page.evaluate(() => { delete document.body.dataset.selection })
          await mark.focus()
          await page.keyboard.press("Enter")
          expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(clicked)
          await page.evaluate(() => { delete document.body.dataset.selection })
          await row.getByRole("button", { name: "Abrir origem", exact: true }).click()
          expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(clicked)
          expect(clicked).toMatchObject({ valueId: id, selectionRef: request.selectionRef, context: projection.context, visualPeriod: filtered, projectionVersion: projection.version, engineVersion: projection.engineVersion, reference: canonical.drilldown })
          expect(clicked.reference).toEqual(issued.value.evidence)
        }
      }
      phase("private-data-exclusion")
      for (const privateValue of ["PRIVATE_CAPACITY_NAME_ONE", "PRIVATE_CAPACITY_NAME_TWO", "PRIVATE_CAPACITY_REVIEW"]) expect(await page.content()).not.toContain(privateValue)
    })
    expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
  } finally { await fixture.close() }
}, 180000)
