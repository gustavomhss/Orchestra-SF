import { expect, test } from "bun:test"
import { brushPeriod, chartGeometry } from "../../../product/analytics/geometry.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

const value = (id: string, amount: number | null, month: string): DomainProjection["values"][number] => ({
  id, value: amount, period: { start: `2027-${month}-01`, end: `2027-${month}-28` }, granularity: "month", sourceRefs: [], drilldown: null, evidenceState: amount === null ? "absent" : "confirmed",
})

test("geometry preserves missing values, observed zero, signs and the selected period", () => {
  const values = [value("unknown", null, "01"), value("zero", 0, "02"), value("positive", 40, "03"), value("negative", -30, "04")]
  const chart = chartGeometry(values, 400, 100)
  expect(chart.marks[0]?.y).toBeNull()
  expect(chart.marks[1]?.y).toBe(chart.zero)
  expect(chart.marks[2]!.y!).toBeLessThan(chart.zero)
  expect(chart.marks[3]!.y!).toBeGreaterThan(chart.zero)
  expect(brushPeriod(values, "2027-02-01", "2027-03-28").map((item) => item.id)).toEqual(["zero", "positive"])
})

test("sensitivity never interpolates missing points", async () => {
  const { sensitivityGeometry } = await import("../../../product/analytics/geometry.ts")
  const marks = sensitivityGeometry([{ parameterValue: 0, value: 10, resultRef: "a" }, { parameterValue: 1, value: null, resultRef: "gap" }, { parameterValue: 2, value: -10, resultRef: "b" }], 100, 100)
  expect(marks.map((mark) => mark.y)).toEqual([0, null, 100])
  expect(marks.map((mark) => mark.resultRef)).toEqual(["a", "gap", "b"])
})

test("waterfall geometry uses supplied endpoints and leaves missing endpoints blank", async () => {
  const { waterfallGeometry } = await import("../../../product/analytics/geometry.ts")
  const marks = waterfallGeometry([{ id: "increase", start: 100, end: 120 }, { id: "gap", start: 120, end: null }, { id: "decrease", start: 120, end: 115 }], 300, 120)
  expect(marks[0]!.start!).toBeGreaterThan(marks[0]!.end!)
  expect(marks[1]!.end).toBeNull()
  expect(marks[2]!.end!).toBeGreaterThan(marks[2]!.start!)
})

test("timeline positions only declared dates and reports unavailable or clipped periods", async () => {
  const { timelineGeometry } = await import("../../../product/analytics/geometry.ts")
  const marks = timelineGeometry([{ id: "inside", start: "2027-01-01", end: "2027-01-11" }, { id: "invalid", start: "", end: "" }, { id: "clipped", start: "2026-12-31", end: "2027-01-05" }], { start: "2027-01-01", end: "2027-01-11" }, 100)
  expect(marks[0]).toEqual({ id: "inside", x1: 0, x2: 100, clipped: false })
  expect(marks[1]?.x1).toBeNull()
  expect(marks[2]?.clipped).toBe(true)
})

test("temporal position preserves a missing month as space instead of interpolation", async () => {
  const { temporalPosition } = await import("../../../product/analytics/geometry.ts")
  const period = { start: "2027-01-01", end: "2027-04-01" }
  expect(temporalPosition("2027-01-01", period, 900)).toBe(0)
  expect(temporalPosition("2027-03-01", period, 900)).toBe(590)
  expect(temporalPosition("2027-04-02", period, 900)).toBeNull()
})

test("shared scale keeps equal values at equal positions", () => {
  const first = chartGeometry([value("first", 40, "01")], 100, 100, { minimum: 0, maximum: 100 })
  const second = chartGeometry([value("second", 40, "02"), value("larger", 100, "03")], 100, 100, { minimum: 0, maximum: 100 })
  expect(first.marks[0]?.y).toBe(second.marks[0]?.y)
  expect(first.marks[0]?.y).toBe(60)
})
