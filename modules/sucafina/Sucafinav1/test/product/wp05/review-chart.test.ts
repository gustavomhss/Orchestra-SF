import { expect, test } from "bun:test"
import { captureBiReviewChart } from "../../../product/analytics/review-chart.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", components: [], missing: [], values: [["initial", 100], ["up", 20], ["middle", 120], ["down", -5], ["end", 115], ["final", 115]].map(([id, value]) => ({ id: String(id), value, currency: "USD", period, granularity: "aggregate" as const, sourceRefs: [], drilldown: null, evidenceState: "confirmed" as const })) }
const presentation: BiPresentation = { viewId: "BI02", series: [{ id: "change", label: "Change", role: "contribution", unit: "USD", valueIds: ["up", "down"] }], limitations: [], waterfall: { segments: [{ label: "Increase", startValueId: "initial", endValueId: "middle", componentValueId: "up" }, { label: "Decrease", startValueId: "middle", endValueId: "end", componentValueId: "down" }], finalValueId: "final", reconciliation: "reconciled" } }

test("review capture keeps producer values, endpoints and reconciliation without residuals", () => {
  const chart = captureBiReviewChart(projection, presentation)
  expect(chart.status).toBe("ok")
  if (chart.status !== "ok") return
  expect(chart.series[0]?.values.map((value) => value.value)).toEqual([20, -5])
  expect(chart.waterfall).toMatchObject({ status: "ok", finalValueId: "final", final: 115, reconciliation: "reconciled" })
  const changed = captureBiReviewChart({ ...projection, values: projection.values.map((value) => value.id === "final" ? { ...value, value: 116 } : value) }, presentation)
  expect(changed.status === "ok" && changed.waterfall?.status === "ok" && changed.waterfall.reconciliation).toBe("unreconciled")
  if (changed.status === "ok" && changed.waterfall?.status === "ok") expect(changed.waterfall.segments).toHaveLength(2)
})

test("review capture rejects dangling series and does not promote absent values", () => {
  expect(captureBiReviewChart(projection, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["not-projected"] }] })).toEqual({ status: "unavailable", reason: "unknown-series-value" })
  const invalid = { ...projection, values: projection.values.map((value) => value.id === "up" ? { ...value, evidenceState: "absent" as const } : value) }
  expect(captureBiReviewChart(invalid, presentation)).toEqual({ status: "unavailable", reason: "waterfall-evidence-invalid" })
})


test("review capture does not advertise absent charts or misaligned capacity", () => {
  expect(captureBiReviewChart(projection, { viewId: "BI02", series: [], limitations: [] })).toEqual({ status: "unavailable", reason: "waterfall-unavailable" })
  expect(captureBiReviewChart(projection, { viewId: "BI08", series: [], limitations: [] })).toEqual({ status: "unavailable", reason: "timeline-unavailable" })
  expect(captureBiReviewChart(projection, { viewId: "BI04", series: [], limitations: [] })).toEqual({ status: "unavailable", reason: "capacity-alignment-unavailable" })
})
