import { expect, test } from "bun:test"
import { withForecastRun } from "./journey.ts"

for (const source of ["http-403", "shell-event"] as const) {
  test("Forecast removes cancellation controls after revocation through " + source, async () => {
    await withForecastRun("revocation-" + source, async (context) => {
      context.scenario.state = source === "shell-event" ? "ready" : "running"
      await context.phase("start once", () => context.submit.click())
      await context.status("Analysis: " + context.scenario.state + ".")
      if (source === "shell-event") {
        const result = context.page.locator('[data-analysis-history] article[data-run-ref="' + context.runRef + '"]')
        await context.phase("open ready output", () => result.getByRole("button", { name: "Open result", exact: true }).click())
        await context.phase("output rendered", () => result.locator("[data-analysis-body]").getByText("Forecast result supplied by the explicit UI fixture.", { exact: true }).waitFor())
        // This is the shell's real access-revoked event contract. Its source here
        // is an explicit fixture signal, not a claim about authentication/ACL.
        await context.phase("shell revocation signal", () => context.page.evaluate(() => dispatchEvent(new Event("sf-access-revoked"))))
      }
      if (source === "http-403") {
        expect((await context.capture("active-before-revoke")).cancel).toMatchObject({ hidden: false, display: "flex" })
        context.scenario.denyReads = true
        await context.phase("read denied", () => context.retry.click())
      }
      await context.status("Analysis access changed. Reopen the decision with your current access.")
      const revoked = await context.capture("revoked")
      expect(revoked.cancel).toBeNull()
      expect(revoked.retry).toBeNull()
      expect(revoked.start).toMatchObject({ hidden: false, display: "flex", disabled: true })
      expect(revoked.currency).toBe("")
      expect(await context.phase("config removed", () => context.form.getAttribute("data-config"))).toBeNull()
      expect(await context.phase("restricted controls cleared", () => context.form.locator("input,select,textarea").evaluateAll((nodes) =>
        nodes.length === 6 && nodes.every((node) => (node as HTMLInputElement).disabled && (node as HTMLInputElement).value === "")))).toBe(true)
      expect(await context.phase("cancel removed", () => context.cancel.count())).toBe(0)
      expect(await context.phase("retry removed", () => context.retry.count())).toBe(0)
      if (source === "shell-event") {
        expect(await context.phase("history cleared", () => context.page.locator("[data-analysis-history] [data-results]").textContent())).toBe("")
        expect(await context.phase("output removed", () => context.page.locator("[data-analysis-body]").count())).toBe(0)
      }
      expect(context.requests.filter((request) => request.action === "cancel")).toHaveLength(0)
    })
  }, 30_000)
}
