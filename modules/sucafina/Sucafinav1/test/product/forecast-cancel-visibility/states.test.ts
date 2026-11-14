import { expect, test } from "bun:test"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import { withForecastRun } from "./journey.ts"

const terminals = ["ready", "needs-input", "unavailable", "failed", "cancelled", "stale"] as const satisfies readonly SfNativeRunRecord["state"][]

for (const terminal of terminals) {
  test("Forecast controls hide after " + terminal + " and preserve the selected EUR input", async () => {
    await withForecastRun("terminal-" + terminal, async (context) => {
      context.scenario.state = terminal === "ready" ? "preparing" : "running"
      await context.phase("start once", () => context.submit.click())
      const activeStates = terminal === "ready" ? ["preparing", "queued", "running"] as const : ["running"] as const
      for (const [index, state] of activeStates.entries()) {
        if (index) { context.scenario.state = state; await context.phase("refresh " + state, () => context.retry.click()) }
        await context.status("Analysis: " + state + ".")
        const controls = await context.capture(state)
        expect(controls.cancel).toMatchObject({ hidden: false, hiddenAttribute: null, display: "flex", disabled: false })
        expect(controls.cancel!.rectangles).toBeGreaterThan(0)
        expect(controls.retry).toMatchObject({ hidden: false, hiddenAttribute: null, display: "flex", disabled: false })
        expect(controls.start).toMatchObject({ display: "flex", disabled: true })
        expect(await context.phase("locked fields", () => context.form.locator("input,select,textarea").evaluateAll((nodes) =>
          nodes.length === 6 && nodes.every((node) => (node as HTMLInputElement).disabled)))).toBe(true)
      }
      context.scenario.state = terminal
      await context.phase("refresh terminal", () => context.retry.click())
      await context.status("Analysis: " + terminal + ".")
      const controls = await context.capture(terminal)
      expect(controls.cancel).toMatchObject({ hidden: true, hiddenAttribute: "", display: "none", rectangles: 0 })
      expect(controls.retry).toMatchObject({ hidden: true, hiddenAttribute: "", display: "none", rectangles: 0 })
      expect(controls.start).toMatchObject({ hidden: false, display: "flex", disabled: false })
      expect(controls.currency).toBe("EUR")
      expect(await context.phase("unlocked fields", () => context.form.locator("input,select,textarea").evaluateAll((nodes) =>
        nodes.length === 6 && nodes.every((node) => !(node as HTMLInputElement).disabled)))).toBe(true)
      expect(await context.phase("no fabricated output", () => context.page.locator("[data-analysis-body]").count())).toBe(0)
      expect(context.requests.filter((request) => request.action === "cancel")).toHaveLength(0)
      expect(context.requests.filter((request) => request.action === "output")).toHaveLength(0)
      expect(context.requests.find((request) => request.mode === "workbench-forecast")?.payload).toEqual({
        caseRef: context.fixture.caseRef, baseRef: context.fixture.sources[0]!.refId, candidateRef: context.fixture.sources[1]!.refId,
        period: { start: "2027-02-01", end: "2027-11-30" }, currency: "EUR",
      })
    })
  }, 30_000)
}
