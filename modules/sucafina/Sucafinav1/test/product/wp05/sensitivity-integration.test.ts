import { expect, test } from "bun:test"
import path from "node:path"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { localBrowser } from "../../fixture/local-browser.ts"
import { createWp05SensitivityFixture } from "./engine-fixture.ts"

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
