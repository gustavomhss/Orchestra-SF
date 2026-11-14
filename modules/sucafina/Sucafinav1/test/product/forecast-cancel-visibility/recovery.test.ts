import { expect, test } from "bun:test"
import { withForecastRun } from "./journey.ts"

test("Forecast status retry preserves the last cancellable state and never duplicates prepare or start", async () => {
  await withForecastRun("status-retry", async (context) => {
    context.scenario.failReads = 1
    await context.phase("start once", () => context.submit.click())
    await context.status("Analysis status unavailable. Refresh its status before starting another analysis.")
    const firstFailure = await context.capture("first-read-failure")
    expect(firstFailure.cancel).toMatchObject({ hidden: true, display: "none", rectangles: 0 })
    expect(firstFailure.retry).toMatchObject({ hidden: false, display: "flex", disabled: false })
    expect(firstFailure.start!.disabled).toBe(true)
    expect(firstFailure.currency).toBe("EUR")
    await context.phase("recover status", () => context.retry.click())
    await context.status("Analysis: running.")
    expect((await context.capture("running")).cancel).toMatchObject({ hidden: false, display: "flex", disabled: false })
    context.scenario.failReads = 1
    await context.phase("refresh fails after running", () => context.retry.click())
    await context.status("Analysis status unavailable. Refresh its status before starting another analysis.")
    const laterFailure = await context.capture("later-read-failure")
    expect(laterFailure.cancel).toMatchObject({ hidden: false, display: "flex", disabled: false })
    expect(laterFailure.retry).toMatchObject({ hidden: false, display: "flex", disabled: false })
    expect(laterFailure.start!.disabled).toBe(true)
    context.scenario.state = "ready"
    await context.phase("recover terminal status", () => context.retry.click())
    await context.status("Analysis: ready.")
    const ready = await context.capture("ready-after-retry")
    expect(ready.cancel).toMatchObject({ hidden: true, display: "none", rectangles: 0 })
    expect(ready.retry).toMatchObject({ hidden: true, display: "none", rectangles: 0 })
    expect(ready.start!.disabled).toBe(false)
    expect(ready.currency).toBe("EUR")
    expect(context.requests.filter((request) => request.action === "cancel")).toHaveLength(0)
  })
}, 30_000)

for (const lostResponse of [false, true]) {
  test("Forecast Cancel hides its controls after " + (lostResponse ? "status reconciliation" : "confirmed cancellation"), async () => {
    await withForecastRun(lostResponse ? "cancel-lost-response" : "cancel-confirmed", async (context) => {
      context.scenario.loseCancelResponse = lostResponse
      await context.phase("start once", () => context.submit.click())
      await context.status("Analysis: running.")
      expect((await context.capture("before-cancel")).cancel).toMatchObject({ hidden: false, display: "flex", disabled: false })
      await context.phase("cancel once", () => context.cancel.click())
      if (lostResponse) {
        await context.status("Could not confirm cancellation. Refresh the analysis status.")
        const pending = await context.capture("cancellation-unconfirmed")
        expect(pending.cancel).toMatchObject({ hidden: false, display: "flex", disabled: false })
        expect(pending.retry).toMatchObject({ hidden: false, display: "flex", disabled: false })
        expect(pending.start!.disabled).toBe(true)
        await context.phase("reconcile cancellation", () => context.retry.click())
      }
      await context.status("Analysis: cancelled.")
      const cancelled = await context.capture("cancelled")
      expect(cancelled.cancel).toMatchObject({ hidden: true, hiddenAttribute: "", display: "none", rectangles: 0 })
      expect(cancelled.retry).toMatchObject({ hidden: true, display: "none", rectangles: 0 })
      expect(cancelled.start!.disabled).toBe(false)
      expect(cancelled.currency).toBe("EUR")
      expect(context.requests.filter((request) => request.action === "cancel").map((request) => request.payload))
        .toEqual([{ action: "cancel", runRef: context.runRef }])
      expect(await context.phase("no cancelled output", () => context.page.locator("[data-analysis-body]").count())).toBe(0)
    })
  }, 30_000)
}
