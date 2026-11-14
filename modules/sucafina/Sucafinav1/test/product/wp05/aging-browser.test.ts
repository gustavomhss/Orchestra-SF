import { test } from "bun:test"
import { expect } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "../../fixture/local-browser.ts"

test("unavailable ages remain in the selected population and retain request drilldown", async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const fixture = await localBrowser()
  try {
    const page = await fixture.browser.newPage()
    await page.goto("about:blank")
    await page.evaluate(async (moduleUrl) => {
      const module = await import(moduleUrl)
      const period = { start: "2027-01-01", end: "2027-12-31" }
      const ref = (id: string) => ({ schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: id, incarnation: "inc", version: 1, fields: ["ageDays"], period, projectionDigest: "digest" } })
      const rows = [{ id: "known", age: 2 }, { id: "missing-a", age: null }, { id: "missing-b", age: null }].map((item) => ({ id: `${item.id}:inc:ageDays`, value: item.age, unit: "days", period, granularity: "record", sourceRefs: [ref(item.id)], drilldown: ref(item.id), evidenceState: item.age === null ? "absent" : "confirmed" }))
      const projection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "procurement", currency: "USD", period, sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "procurement", components: [], missing: [], values: rows }
      const presentation = { viewId: "BI06", series: [{ id: "aging", label: "Idade", unit: "days", role: "aging", valueIds: rows.map((row) => row.id) }], limitations: [] }
      document.body.append(module.renderBiView({ viewId: "BI06", selectionRef: "selection", period }, projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, presentation))
    }, url)
    await expect(page.getByText("Idade indisponível: 2 de 3 pedidos nesta seleção.")).toBeVisible()
    const unavailable = page.getByRole("list", { name: "Pedidos com idade indisponível" })
    await expect(unavailable).toContainText("missing-a: idade indisponível")
    await expect(unavailable).toContainText("missing-b: idade indisponível")
    await unavailable.getByRole("button", { name: "Abrir missing-b" }).focus()
    await page.keyboard.press("Enter")
    const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(selection.reference.target.recordId).toBe("missing-b")
    expect(selection.selectionRef).toBe("selection")
    expect(selection.context.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
    await expect(page.getByRole("row").filter({ hasText: "missing-a" })).toContainText("Indisponível")
  } finally {
    await fixture.dispose()
  }
}, 180000)
