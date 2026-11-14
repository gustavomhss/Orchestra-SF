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
        const beforeRevocation = await context.capture("ready-before-revoke")
        expect(beforeRevocation.resultBodies).toBe(1)
        expect(beforeRevocation.start).toMatchObject({ display: "flex", disabled: false })
        // Keep read-only handles to prove controller scrubbing before the real
        // shell detaches the view in its revokeAccess microtask.
        const retained = await context.phase("retain old view", () => context.form.evaluateHandle((form) => ({
          form, history: document.querySelector("[data-analysis-history]"),
        })))
        try {
          // The signal is an explicit fixture at the shell's real event boundary.
          await context.phase("shell revocation signal", () => context.page.evaluate(() => dispatchEvent(new Event("sf-access-revoked"))))
          const unavailable = context.page.locator("main[data-access-unavailable=true]")
          await context.phase("shell removed old view", () => unavailable.getByText("The previous view was removed. Reload to continue with your current permissions.", { exact: true }).waitFor())
          const detached = await context.phase("old view scrubbed", () => retained.evaluate((old) => ({
            connected: old.form.isConnected,
            status: old.form.querySelector("[role=status]")?.textContent,
            cancelCount: old.form.querySelectorAll("[data-analysis-cancel]").length,
            retryCount: [...old.form.querySelectorAll("button")].filter((button) => button.textContent === "Refresh analysis status").length,
            startDisabled: old.form.querySelector<HTMLButtonElement>("button:not([type]),button[type=submit]")?.disabled,
            config: old.form.getAttribute("data-config"),
            currency: old.form.querySelector<HTMLInputElement>('input[name="currency"]')?.value,
            fields: [...old.form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")].map((field) => ({ disabled: field.disabled, value: field.value })),
            historyConnected: old.history?.isConnected,
            historyCase: old.history?.getAttribute("data-case"),
            historyText: old.history?.querySelector("[data-results]")?.textContent,
            historyOutputs: old.history?.querySelectorAll("[data-analysis-body]").length,
          })))
          console.info("SF_FORECAST_REVOKED_VIEW", JSON.stringify({ source, detached }))
          expect(detached.connected).toBe(false)
          expect(detached.status).toBe("Analysis access changed. Reopen the decision with your current access.")
          expect(detached.cancelCount).toBe(0)
          expect(detached.retryCount).toBe(0)
          expect(detached.startDisabled).toBe(true)
          expect(detached.config).toBeNull()
          expect(detached.currency).toBe("")
          expect(detached.fields).toHaveLength(6)
          expect(detached.fields.every((field) => field.disabled && field.value === "")).toBe(true)
          expect(detached.historyConnected).toBe(false)
          expect(detached.historyCase).toBeNull()
          expect(detached.historyText).toBe("")
          expect(detached.historyOutputs).toBe(0)
          expect(await context.phase("form removed", () => context.form.count())).toBe(0)
          expect(await context.phase("cancel removed", () => context.cancel.count())).toBe(0)
          expect(await context.phase("retry removed", () => context.retry.count())).toBe(0)
          expect(await context.phase("output removed", () => context.page.locator("[data-analysis-body]").count())).toBe(0)
          expect(await context.phase("access recovery enabled", () => unavailable.getByRole("button", { name: "Reload access", exact: true }).isEnabled())).toBe(true)
          expect(context.requests.filter((request) => request.action === "cancel")).toHaveLength(0)
        } finally { await retained.dispose() }
        return
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
      expect(context.requests.filter((request) => request.action === "cancel")).toHaveLength(0)
    })
  }, 30_000)
}
