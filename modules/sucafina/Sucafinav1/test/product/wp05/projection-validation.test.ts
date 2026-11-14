import { expect, test } from "bun:test"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"
import { brushPeriod, chartGeometry } from "../../../product/analytics/geometry.ts"
import { resolveBiPresentation } from "../../../product/analytics/semantics.ts"
import { presentTickets } from "../../../product/analytics/tickets.ts"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const projection: DomainProjection = {
  context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] },
  version: 7, engineVersion: "planner", components: [], missing: [], values: [],
}
const value = (id: string, amount: number | null): DomainProjection["values"][number] => ({ id, value: amount, currency: "USD", period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: amount === null ? "absent" : "confirmed" })

test("absent evidence cannot affect geometry even when its numeric field remains populated", () => {
  const chart = chartGeometry([{ ...value("absent", 999), evidenceState: "absent" }, value("zero", 0), value("observed", 10)], 300, 100)
  expect(chart.maximum).toBe(10)
  expect(chart.marks.map((mark) => mark.value)).toEqual([null, 0, 10])
  expect(chart.marks[0]?.y).toBeNull()
  expect(chart.marks[1]?.y).toBe(chart.zero)
  expect(brushPeriod([value("valid", 10)], "2027-02-30", "2027-03-01")).toEqual([])
})

test("financial and ticket series refuse overlapping or backwards competencies", () => {
  const first = { ...value("first", 10), period: { start: "2027-01-01", end: "2027-01-31" }, granularity: "month" as const }
  const second = { ...value("second", 20), period: { start: "2027-01-15", end: "2027-02-28" }, granularity: "month" as const }
  const presentation: BiPresentation = { viewId: "BI01", series: [{ id: "actual", label: "Actual", unit: "USD", role: "actual", valueIds: ["first", "second"] }], limitations: [] }
  expect(resolveBiPresentation({ ...projection, values: [first, second] }, presentation)).toEqual({ status: "unavailable", reason: "overlapping-or-unordered-periods" })
  const dated = { ...second, period: { start: "2027-02-01", end: "2027-02-28" } }
  expect(resolveBiPresentation({ ...projection, values: [first, dated] }, presentation).status).toBe("ok")
  expect(resolveBiPresentation({ ...projection, values: [first, dated] }, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["second", "first"] }] })).toEqual({ status: "unavailable", reason: "overlapping-or-unordered-periods" })
  const tickets = { ...projection, values: [first, second].map((entry) => ({ ...entry, currency: undefined, unit: "tickets" })) }
  expect(presentTickets(tickets, { mode: "dated-series", series: [{ id: "opened", label: "Opened", unit: "tickets", role: "opened", valueIds: ["first", "second"] }] })).toBeNull()
})

test("waterfall retains supplied endpoints and refuses incompatible context instead of relabelling it", () => {
  const values = [value("initial", 100), value("up", 20), value("middle", 120), value("down", -5), value("end", 115), value("final", 115)]
  const plan = { segments: [{ label: "Increase", startValueId: "initial", endValueId: "middle", componentValueId: "up" }, { label: "Decrease", startValueId: "middle", endValueId: "end", componentValueId: "down" }], finalValueId: "final", reconciliation: "reconciled" as const }
  const result = resolveWaterfall({ ...projection, values }, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Supplied waterfall was rejected")
  expect(result.initial).toBe(100)
  expect(result.initialSource?.id).toBe("initial")
  expect(result.final).toBe(115)
  expect(result.finalSource.id).toBe("final")
  expect(resolveWaterfall({ ...projection, context: { ...projection.context, currency: "EUR" }, values }, plan)).toEqual({ status: "unavailable", reason: "incompatible-unit-or-currency" })
  expect(resolveWaterfall({ ...projection, values: values.map((entry) => entry.id === "up" ? { ...entry, period: { start: "2026-01-01", end: "2026-12-31" } } : entry) }, plan)).toEqual({ status: "unavailable", reason: "incompatible-period" })
  const unknown = resolveWaterfall({ ...projection, values: values.map((entry) => entry.id === "up" ? { ...entry, evidenceState: "absent" as const } : entry) }, plan)
  expect(unknown.status === "ok" && unknown.segments[0]?.amount).toBeNull()
  expect(unknown.status === "ok" && unknown.reconciliation).toBe("unavailable")
})
