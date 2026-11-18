import { expect, test } from "bun:test"
import path from "node:path"
import { dispatchBiPresentation, readBiDestination } from "../../../product/analytics/consumer.ts"
import type { BiSelection } from "../../../product/analytics/catalog.ts"
import { bindProjectedPlannerBiPort, createProjectedPlannerBiSource } from "../../../product/analytics/planner-projected.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { plannerDifferencePresentation } from "../../../product/planner/bi-difference.ts"
import { plannerFixture, plannerPeriod } from "../wp03/planner-fixture.ts"
import { inspectWp05Browser } from "./browser.ts"

test("real Planner zero and nonzero contributions expose explicit A/B origins through waterfall, bars, tables and current C17 selection", async () => {
  const fixture = await plannerFixture()
  try {
    const sourceContext = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const issued = []
    for (const version of ["v0", "v1", "v2"]) issued.push(await fixture.issueSource(version, sourceContext))
    const refs = issued.map((value) => { if (value.status !== "ok") throw new Error(`Planner source unavailable: ${value.reason}`); return value.value.evidence })
    const comparison = { baseRef: refs[0]!.refId, candidateRef: refs[1]!.refId, period: plannerPeriod, currency: "USD" }
    const source = createProjectedPlannerBiSource(bindProjectedPlannerBiPort({
      planner: fixture.planner,
      resolve: async (request) => request.selectionRef === "versions-A-B" && (request.viewId === "BI02" || request.viewId === "BI03")
        ? { status: "ok", value: { comparison, project: (analysis) => plannerDifferencePresentation(analysis, request.viewId as "BI02" | "BI03") } }
        : { status: "unavailable", reason: "selection-unavailable" },
      revalidate: (_request, context) => fixture.host.revalidate(context),
    }))
    // C17 boundary harness delegates the selected scope and every financial value to canonical Planner ports.
    // It is not the installed HTTP/Atlas source service or a native-runtime witness.
    const business: Pick<BusinessContextService, "resolve"> = { resolve: async (ref, context) => {
      const current = await fixture.sources.resolveForecastSource(ref.refId, context)
      if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref)) return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
      const projection = await fixture.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: plannerPeriod, currency: "USD" }, context)
      return projection.status === "ok"
        ? { state: "fresh", ref, currentRef: current.value.evidence, authorizedProjection: projection.value.candidate, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
        : { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
    } }
    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("Planner origins bundle unavailable")
    const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    for (const viewId of ["BI02", "BI03"] as const) {
      const request = { viewId, selectionRef: "versions-A-B", period: plannerPeriod }
      const presented = await dispatchBiPresentation(request, await fixture.admit("sf_bi_view", request), source, fixture.authority)
      if (presented.status !== "ok") throw new Error(`Comparison BI unavailable: ${presented.reason}`)
      const value = presented.value
      expect(value.projection.values.find((row) => row.id === "difference:baseline")?.value).toBe(590000)
      expect(value.projection.values.find((row) => row.id === "difference:candidate-total")?.value).toBe(602000)
      const candidates = value.projection.values.filter((row) => row.id.startsWith("difference:component:") && row.sourceRefs.length === 2)
      const chosen = [candidates.find((row) => row.value === 0), candidates.find((row) => typeof row.value === "number" && row.value !== 0)]
      if (chosen.some((row) => !row)) throw new Error("Canonical A/B zero and nonzero rows required")
      const rows = chosen.filter((row): row is NonNullable<typeof row> => !!row)
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(row.drilldown).toBeNull()
        expect(row.sourceRefs).toEqual(refs.slice(0, 2))
      }
      const selections: BiSelection[] = []
      await inspectWp05Browser(`${viewId} explicit A/B origins`, async (page, phase) => {
        phase("module-import")
        await page.evaluate(async (url) => { const module = await import(url); if (typeof module.renderBiView !== "function") throw new Error("BI renderer export unavailable") }, url)
        phase("render")
        await page.evaluate(async ({ url, value }) => {
          const module = await import(url)
          document.body.append(module.renderBiView(value.request, value.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, value.presentation))
        }, { url, value })
        const table = page.getByRole("table", { name: "Dados e referências", exact: true })
        for (const row of rows) {
          const mark = viewId === "BI02" ? page.locator(`svg g[data-bi-value="${row.id}"]`) : page.locator(`svg g[data-bi-focus="${row.id}"]`)
          expect(await mark.count()).toBe(1)
          expect(await mark.getAttribute("role")).toBe("button")
          expect(await mark.getAttribute("aria-label")).toMatch(/escolher origem/i)
          const tableRow = table.getByRole("row").filter({ has: page.getByRole("cell", { name: row.id, exact: true }) })
          expect(await tableRow.getByRole("cell").nth(1).textContent()).toBe(String(row.value))
          expect(await tableRow.getByRole("button").count()).toBe(2)
          for (const [index, reference] of row.sourceRefs.entries()) {
            if (reference.kind !== "record") throw new Error("Expected canonical Planner record reference")
            const label = `Abrir origem ${index === 0 ? "A" : "B"} · ${reference.target.recordType} ${reference.target.recordId} · v${reference.target.version}`
            phase(`${row.id}:origin-${index}:mouse`)
            await page.evaluate(() => { delete document.body.dataset.selection })
            await mark.click()
            expect(await page.locator("body").getAttribute("data-selection")).toBeNull()
            const chooser = page.locator("[data-bi-source-chooser]:visible")
            expect(await chooser.count()).toBe(1)
            await chooser.getByRole("button", { name: label, exact: true }).click()
            const clicked: BiSelection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
            expect(clicked).toEqual({ valueId: row.id, selectionRef: request.selectionRef, context: value.projection.context, visualPeriod: plannerPeriod, projectionVersion: value.projection.version, engineVersion: value.projection.engineVersion, reference })
            selections.push(clicked)
            phase(`${row.id}:origin-${index}:keyboard`)
            await page.evaluate(() => { delete document.body.dataset.selection })
            await mark.focus()
            await page.keyboard.press("Enter")
            expect(await page.locator("body").getAttribute("data-selection")).toBeNull()
            await chooser.getByRole("button", { name: label, exact: true }).focus()
            await page.keyboard.press("Enter")
            expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(clicked)
            phase(`${row.id}:origin-${index}:table`)
            await page.evaluate(() => { delete document.body.dataset.selection })
            await tableRow.getByRole("button", { name: label, exact: true }).click()
            expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(clicked)
            if (viewId === "BI02") {
              const segment = value.presentation.waterfall?.segments.find((segment) => segment.componentValueId === row.id)
              if (!segment) throw new Error("Canonical waterfall segment required")
              const composition = page.getByRole("table", { name: "Composição e origens", exact: true })
              const compositionRow = composition.getByRole("row").filter({ has: page.getByRole("cell", { name: segment.label, exact: true }) })
              expect(await compositionRow.getByRole("button").count()).toBe(2)
              await compositionRow.getByRole("button", { name: label, exact: true }).click()
              expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(clicked)
            }
          }
          phase(`${row.id}:cancel`)
          await page.evaluate(() => { delete document.body.dataset.selection })
          await mark.focus()
          await page.keyboard.press("Space")
          await page.keyboard.press("Escape")
          expect(await page.locator("[data-bi-source-chooser]:visible").count()).toBe(0)
          expect(await mark.evaluate((element) => document.activeElement === element)).toBe(true)
          expect(await page.locator("body").getAttribute("data-selection")).toBeNull()
        }
      })
      for (const selection of selections) {
        const reference = selection.reference
        if (!reference || reference.kind !== "record") throw new Error("Explicit Planner record origin required")
        const result = await readBiDestination({ request, selection, context: await fixture.admit("sf_bi_view", request), source, authority: fixture.authority, business })
        expect(result.status).toBe("ok")
        if (result.status !== "ok") throw new Error(result.reason)
        expect(result.value.selection).toEqual(selection)
        expect(result.value.source.ref).toEqual(reference)
        expect(result.value.source.currentRef).toEqual(reference)
        const origin = result.value.source.authorizedProjection
        if (!origin || !("values" in origin) || !("components" in origin)) throw new Error("Exact authorized source projection required")
        const originSource = origin.context.sourceRefs[0]
        if (!originSource) throw new Error("Authorized Planner source identity required")
        expect(originSource.id).toBe(reference.target.recordId)
      }
      let resolved = false
      const wrong = await readBiDestination({ request, selection: { ...selections[0]!, reference: refs[2]! }, context: await fixture.admit("sf_bi_view", request), source, authority: fixture.authority, business: { resolve: async (ref, context) => { resolved = true; return business.resolve(ref, context) } } })
      expect(wrong).toEqual({ status: "stale", reason: "selection-source-changed" })
      expect(resolved).toBe(false)
    }
  } finally { await fixture.close() }
}, 180000)
