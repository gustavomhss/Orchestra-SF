import type { DomainProjection } from "../contracts/context.ts"
import { isSfPeriod } from "../contracts/validation.ts"

/** Scale only observed finite numbers; unknowns remain gaps. */
export function chartGeometry(values: DomainProjection["values"], width: number, height: number, sharedScale?: { minimum: number; maximum: number }) {
  const finite = values.flatMap((value) => value.evidenceState !== "absent" && typeof value.value === "number" && Number.isFinite(value.value) ? [value.value] : [])
  const shared = sharedScale && Number.isFinite(sharedScale.minimum) && Number.isFinite(sharedScale.maximum) && sharedScale.minimum <= sharedScale.maximum ? [sharedScale.minimum, sharedScale.maximum] : []
  const minimum = finite.reduce((lowest, value) => Math.min(lowest, value), Math.min(0, ...shared))
  const maximum = finite.reduce((highest, value) => Math.max(highest, value), Math.max(0, ...shared))
  const span = maximum - minimum || 1
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0
  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0
  const zero = safeHeight * maximum / span
  return { minimum, maximum, zero, marks: values.map((value, index) => {
    const amount = value.evidenceState !== "absent" && typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null
    const y = amount === null ? null : safeHeight * (maximum - amount) / span
    return { id: value.id, x: safeWidth * (index + 0.5) / Math.max(1, values.length), y, zero, height: y === null ? null : Math.abs(zero - y), value: amount, drilldown: value.drilldown }
  }) }
}

export function brushPeriod<T extends DomainProjection["values"][number]>(values: readonly T[], start: string, end: string) {
  if (!isSfPeriod({ start, end })) return []
  return values.filter((value) => isSfPeriod(value.period) && value.period.start <= end && value.period.end >= start)
}

export function sensitivityGeometry(points: readonly { parameterValue: number | null; value: number | null; resultRef: string }[], width: number, height: number) {
  const finite = points.filter((point) => point.parameterValue !== null && Number.isFinite(point.parameterValue) && point.value !== null && Number.isFinite(point.value))
  if (!finite.length || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
  const minX = Math.min(...finite.flatMap((point) => point.parameterValue === null ? [] : [point.parameterValue]))
  const maxX = Math.max(...finite.flatMap((point) => point.parameterValue === null ? [] : [point.parameterValue]))
  const minY = Math.min(...finite.flatMap((point) => point.value === null ? [] : [point.value]))
  const maxY = Math.max(...finite.flatMap((point) => point.value === null ? [] : [point.value]))
  return points.map((point) => ({ ...point, x: point.parameterValue !== null && Number.isFinite(point.parameterValue) && point.value !== null && Number.isFinite(point.value) ? width * (point.parameterValue - minX) / (maxX - minX || 1) : null, y: point.value !== null && Number.isFinite(point.value) && point.parameterValue !== null && Number.isFinite(point.parameterValue) ? height * (maxY - point.value) / (maxY - minY || 1) : null }))
}

/** Waterfall coordinates are projected values, not accumulated financial calculations. */
export function waterfallGeometry(segments: readonly { id: string; start: number | null; end: number | null }[], width: number, height: number) {
  const finite = segments.flatMap((segment) => [segment.start, segment.end].filter((value): value is number => value !== null && Number.isFinite(value)))
  if (!finite.length || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
  const minimum = Math.min(0, ...finite)
  const maximum = Math.max(0, ...finite)
  const scale = maximum - minimum || 1
  return segments.map((segment, index) => {
    const start = segment.start !== null && Number.isFinite(segment.start) ? height * (maximum - segment.start) / scale : null
    const end = segment.end !== null && Number.isFinite(segment.end) ? height * (maximum - segment.end) / scale : null
    return { id: segment.id, x: width * (index + 0.5) / Math.max(1, segments.length), start, end }
  })
}

/** Date positions only; no financial effect is assigned to moving a date. */
export function timelineGeometry(periods: readonly { id: string; start: string; end: string }[], horizon: { start: string; end: string }, width: number) {
  if (!isSfPeriod(horizon)) return []
  const from = Date.parse(`${horizon.start}T00:00:00Z`)
  const to = Date.parse(`${horizon.end}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || !Number.isFinite(width) || width <= 0) return []
  const span = to - from || 1
  return periods.map((period) => {
    if (!isSfPeriod({ start: period.start, end: period.end })) return { id: period.id, x1: null, x2: null, clipped: false }
    const start = Date.parse(`${period.start}T00:00:00Z`)
    const end = Date.parse(`${period.end}T00:00:00Z`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end < from || start > to) return { id: period.id, x1: null, x2: null, clipped: false }
    return { id: period.id, x1: width * (Math.max(from, start) - from) / span, x2: width * (Math.min(to, end) - from) / span, clipped: start < from || end > to }
  })
}

export function temporalPosition(date: string, horizon: { start: string; end: string }, width: number) {
  if (!isSfPeriod(horizon) || !isSfPeriod({ start: date, end: date }) || date < horizon.start || date > horizon.end || !Number.isFinite(width) || width <= 0) return null
  const from = Date.parse(`${horizon.start}T00:00:00Z`)
  const to = Date.parse(`${horizon.end}T00:00:00Z`)
  return width * (Date.parse(`${date}T00:00:00Z`) - from) / (to - from || 1)
}
