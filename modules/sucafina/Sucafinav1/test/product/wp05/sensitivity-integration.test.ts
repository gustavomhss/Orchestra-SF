import { expect, test } from "bun:test"
import path from "node:path"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { localBrowser } from "../../fixture/local-browser.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "./engine-fixture.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"

test("BI consumes the persisted Planner sensitivity and rejects a changed criterion", async () => {
  const fixture = await createWp05SensitivityFixture()
  try {
    const projection: DomainProjection = {
      context: { installationId: "install", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access", surface: "planner", period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] },
      version: 1,
      engineVersion: "planner",
      values: [],
      components: [],
      missing: [],
    }
    const read = createStoredScenarioBiProjection({
      results: fixture.results,
      readSensitivity: fixture.persistent.read,
      readProjection: async (selection) => selection === "authorized-selection" ? { status: "ok", value: projection } : { status: "unavailable", reason: "selection-unavailable" },
      revalidateProjection: async (selection, _projection, caseRef, context) => selection.selectionRef === "authorized-selection" && selection.comparisonRef === fixture.comparisonRef && (await fixture.comparisonBindings.read({ caseRef, resultRef: selection.comparisonRef }, context)).status === "ok",
    })
    const selection = { selectionRef: "authorized-selection", scenarioResultRef: fixture.selectedRef, comparisonRef: fixture.comparisonRef, sensitivityResultRef: fixture.saved.sensitivityResultRef }
    const result = await read(selection, fixture.context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok" || result.value.decision?.kind !== "scenario") throw new Error("scenario projection unavailable")
    expect(result.value.decision.comparison.alternativeResultRef).toBe(fixture.selectedRef)
    expect(result.value.decision.sensitivity).toEqual(fixture.saved.sensitivity)
    expect(result.value.decision.sensitivity?.parameterUnit).toBe("EUR")
    expect(result.value.decision.sensitivity?.resultUnit).toBe("USD")
    expect(result.value.decision.sensitivity?.comparisonStatus).toBe("conditioned")
    expect(result.value.decision.sensitivity?.threshold).toBeNull()
    expect("sensitivityResultRef" in result.value.decision && result.value.decision.sensitivityResultRef).toBe(fixture.saved.sensitivityResultRef)
    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
    const browser = await localBrowser()
    try {
      const page = await browser.browser.newPage()
      await page.goto("about:blank")
      await page.evaluate(async (input) => {
        const module = await import(input.url)
        document.body.append(module.renderBiView({ viewId: "BI11", selectionRef: "authorized-selection", period: input.projection.context.period }, input.projection, () => {}, { viewId: "BI11", series: [], limitations: [] }))
      }, { url: `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`, projection: result.value })
      const text = await page.locator("body").innerText()
      expect(text).toContain("Eixo X: EUR; eixo Y: USD")
      expect(text).toContain("limiar indisponível")
      expect(text).toContain("conditioned")
    } finally {
      await browser.dispose()
    }
    expect((await fixture.reviseRule()).status).toBe("ok")
    expect((await read(selection, fixture.context)).status).toBe("stale")
  } finally {
    await fixture.cleanup()
  }
}, 180000)


test("persisted zero and unknown training keep every component and sensitivity point equal in marks, table and navigation", async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const browser = await localBrowser()
  try {
    for (const training of ["zero", "null"] as const) {
      const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training })
      try {
        const projected = await fixture.planner.compareForecast({ baseRef: fixture.scenario.baseRef, candidateRef: fixture.scenario.baseRef, period: wp05Horizon, currency: "USD" }, fixture.context)
        expect(projected.status).toBe("ok")
        if (projected.status !== "ok") throw new Error("Real Planner projection unavailable")
        const selection = { selectionRef: "authorized-selection", scenarioResultRef: fixture.selectedRef, comparisonRef: fixture.comparisonRef, sensitivityResultRef: fixture.saved.sensitivityResultRef }
        const read = createStoredScenarioBiProjection({
          results: fixture.results,
          readSensitivity: fixture.persistent.read,
          readProjection: async (reference) => reference === selection.selectionRef ? { status: "ok", value: projected.value.candidate } : { status: "unavailable", reason: "selection-unavailable" },
          revalidateProjection: async (incoming, actual, caseRef, context) => digestSfValue(incoming) === digestSfValue(selection) && digestSfValue(actual) === digestSfValue(projected.value.candidate) && await fixture.host.revalidate(context) && (await fixture.comparisonBindings.read({ caseRef, resultRef: incoming.comparisonRef }, context)).status === "ok",
        })
        const result = await read(selection, fixture.context)
        expect(result.status).toBe("ok")
        if (result.status !== "ok" || result.value.decision?.kind !== "scenario") throw new Error("Persisted BI decision unavailable")
        expect(result.value.decision.scenario).toEqual(fixture.selectedResult)
        expect(result.value.decision.sensitivity).toEqual(fixture.saved.sensitivity)
        const page = await browser.browser.newPage()
        try {
          await page.goto("about:blank")
          await page.evaluate(async (input) => {
            const module = await import(input.url)
            const opened = document.createElement("output")
            opened.setAttribute("data-opened-result", "")
            document.body.append(opened)
            document.body.append(module.renderBiView({ viewId: "BI11", selectionRef: "authorized-selection", period: input.projection.context.period }, input.projection, () => {}, { viewId: "BI11", series: [], limitations: [] }, {
              openResult: (reference: string) => { opened.textContent = reference },
            }))
          }, { url, projection: result.value })
          const componentRows = await page.getByRole("table", { name: "Componentes fornecidos pelo domínio", exact: true }).locator("tbody tr").evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("td")).slice(0, 5).map((cell) => cell.textContent)))
          expect(componentRows).toEqual(fixture.selectedResult.components.map((component) => [
            component.id,
            component.amount === null || component.evidenceState === "absent" ? "Indisponível" : String(component.amount),
            component.currency,
            `${component.period.start} – ${component.period.end}`,
            component.evidenceState,
          ]))
          const trainingRow = componentRows.find((row) => row[0] === "training:11")
          expect(trainingRow?.[1]).toBe(training === "zero" ? "0" : "Indisponível")
          expect(trainingRow?.[4]).toBe(training === "zero" ? "confirmed" : "absent")
          const points = fixture.saved.sensitivity.evaluated
          const table = page.getByRole("table", { name: "Pontos de sensibilidade fornecidos pelo motor", exact: true })
          const values = await table.locator("tbody tr").evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent)))
          expect(values).toEqual(points.map((point) => [String(point.parameterValue), point.value === null ? "indisponível" : String(point.value), `Abrir resultado ${point.resultRef}`]))
          const marks = page.locator('svg[aria-label="Pontos de sensibilidade; valores e referências na tabela equivalente"] [role="button"]')
          const plotted = points.filter((point) => point.value !== null && Number.isFinite(point.value) && Number.isFinite(point.parameterValue))
          expect(plotted.length).toBeGreaterThan(0)
          expect(await marks.count()).toBe(plotted.length)
          for (const [index, point] of plotted.entries()) {
            const mark = marks.nth(index)
            expect(await mark.getAttribute("aria-label")).toBe(`${point.parameterValue}: ${point.value}; abrir resultado`)
            expect(await mark.getAttribute("data-bi-focus")).toBe(point.resultRef)
            await mark.click()
            expect(await page.locator("[data-opened-result]").textContent()).toBe(point.resultRef)
            await page.locator("[data-opened-result]").evaluate((element) => { element.textContent = "" })
            await mark.focus()
            await page.keyboard.press("Enter")
            expect(await page.locator("[data-opened-result]").textContent()).toBe(point.resultRef)
            await page.locator("[data-opened-result]").evaluate((element) => { element.textContent = "" })
            await table.getByRole("button", { name: `Abrir resultado ${point.resultRef}`, exact: true }).click()
            expect(await page.locator("[data-opened-result]").textContent()).toBe(point.resultRef)
          }
          const visible = await page.locator("body").innerText()
          expect(visible).toContain("condicionado à cobertura e às premissas informadas")
          expect(visible).not.toContain("Gráfico indisponível para esta visão ou período.")
          expect(fixture.saved.sensitivity.threshold).toBeNull()
          expect(fixture.selectedResult.total).toBeNull()
          expect(fixture.saved.sensitivity.comparisonStatus).toBe("conditioned")
        } finally {
          await page.close()
        }
      } finally {
        await fixture.cleanup()
      }
    }
  } finally {
    await browser.dispose()
  }
}, 180000)
