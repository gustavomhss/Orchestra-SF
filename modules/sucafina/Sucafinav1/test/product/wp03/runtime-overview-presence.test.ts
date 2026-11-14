import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { domain, render } from "../../../runtime/planner.ts"
import { inspectWp05Browser } from "../wp05/browser.ts"
import { plannerAt, plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

function initial(kind: "missing" | "zero" | "missing-fx" | "hr-no-rate") {
  const snapshot = plannerSnapshot()
  const version = rows(snapshot.data.versions)[0]!
  version.closed = 2
  const actual = [kind === "missing" ? null : 0, 0, 0]
  version.lines = [{ id: "line", sec: "opex", el: "licenses", cur: kind === "missing-fx" ? "EUR" : "USD", b: Array(12).fill(100), a: actual, f: [] }]
  version.fx = kind === "missing-fx" ? [{ id: "EUR", cur: "EUR", rate: null }] : []
  if (kind === "hr-no-rate") {
    version.lines = []
    version.hc = { positions: [{ id: "unpriced", name: "Unpriced role", include: true, fte: 1, start: 1, end: 12, domain: "Finance", type: "Employee", location: "Unknown" }], rates: [], hrAF: { Finance: { a: [0, 0, 0], f: [] } } }
  }
  snapshot.data.versions = [version]
  return snapshot
}

// Browser inspection of the actual runtime render export. It does not claim that
// the installed Planner HTTP path or a resident session has been exercised.
test("runtime Overview table and SVG agree with C02 on missing actual, closed/open zero, FX and independent HR actual", async () => {
  await inspectWp05Browser("wp03-runtime-overview-presence", async (page) => {
    for (const kind of ["missing", "zero", "missing-fx", "hr-no-rate"] as const) {
      const snapshot = initial(kind)
      const fixture = await plannerFixture(snapshot)
      try {
        const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
        const source = await fixture.issueSource("v0", context)
        if (source.status !== "ok") throw new Error(source.reason)
        const compared = await fixture.planner.compareForecast({ baseRef: source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
        if (compared.status !== "ok") throw new Error(compared.reason)
        const before = await fixture.readSnapshot()
        const view = domain.view(before, actor, { at: plannerAt, id: () => "unused", directory: [] })
        const summary = object(rows(view.data.versions)[0]!.summary)
        expect((summary.actual as number[]).slice(0, 3)).toEqual([0, 0, 0])
        const html = render("Overview", view.data, { actor, year: 2027, month: 2, at: plannerAt, versions: view.versions })
        if (!html) throw new Error("Runtime Overview unavailable")
        await page.setContent(html)
        for (const month of [1, 2, 3]) {
          const known = kind !== "missing-fx" && (kind !== "missing" || month !== 1)
          const value = compared.value.baseline.values.find((entry) => entry.id === `month:${month}:actual`)
          expect(value).toMatchObject({ value: known ? 0 : null, evidenceState: known ? "confirmed" : "absent" })
          const cell = page.locator(`[data-planner-actual-month="${month}"]`)
          expect(await cell.getAttribute("data-evidence-state")).toBe(known ? "confirmed" : "absent")
          expect(await cell.getAttribute("data-domain-value")).toBe("0")
          expect(await cell.innerText()).toContain(known ? "$0.00" : "Unavailable")
          expect(await cell.innerText()).toContain(known ? "Observed zero" : "Actual data is missing or unpriced")
          const point = page.locator(`svg circle[data-planner-series="actual"][data-month="${month}"]`)
          expect(await point.count()).toBe(known ? 1 : 0)
          if (known) expect(await point.locator("title").textContent()).toBe(`Actual ${month}: $0.00`)
        }
        if (kind === "hr-no-rate") {
          expect(compared.value.baseline.values.find((entry) => entry.id === "HR:Finance:1:budget-usd")).toMatchObject({ value: null, evidenceState: "absent" })
          expect(compared.value.baseline.missing).toContainEqual({ field: "HR:Finance:1:budget", reason: "missing-rate" })
        }
        expect(await fixture.readSnapshot()).toEqual(before)
      } finally { await fixture.close() }
    }
  })
}, 180000)
