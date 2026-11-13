import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { ReviewWaterfall } from "./port.ts"

/** Verify producer-resolved endpoints against the captured projection, without recomputing domain values. */
export function validateReviewWaterfall(projection: DomainProjection, waterfall: ReviewWaterfall | undefined) {
  if (!waterfall) return true
  if (waterfall.status === "unavailable") return typeof waterfall.reason === "string" && !!waterfall.reason
  if (waterfall.status !== "ok" || !Array.isArray(waterfall.segments) || typeof waterfall.finalValueId !== "string" || !["reconciled", "unreconciled", "unavailable"].includes(waterfall.reconciliation) || !Array.isArray(projection.values)) return false
  type Value = DomainProjection["values"][number]
  type Segment = Extract<ReviewWaterfall, { status: "ok" }>["segments"][number]
  if (projection.values.some((value: Value) => !value || typeof value.id !== "string" || !isSfPeriod(value.period))) return false
  const values = new Map(projection.values.map((value: Value) => [value.id, value]))
  if (values.size !== projection.values.length || !values.has(waterfall.finalValueId)) return false
  const number = (value: Value | undefined) => typeof value?.value === "number" && Number.isFinite(value.value) ? value.value : null
  if (number(values.get(waterfall.finalValueId)) !== waterfall.final) return false
  if (waterfall.segments.some((segment: Segment) => !segment || typeof segment.label !== "string" || !values.has(segment.startValueId) || !values.has(segment.endValueId) || !values.has(segment.componentValueId) || number(values.get(segment.startValueId)) !== segment.start || number(values.get(segment.endValueId)) !== segment.end || number(values.get(segment.componentValueId)) !== segment.amount || digestSfValue(values.get(segment.componentValueId)) !== digestSfValue(segment.source))) return false
  const referenced = [waterfall.finalValueId, ...waterfall.segments.flatMap((segment: Segment) => [segment.startValueId, segment.endValueId, segment.componentValueId])].map((id) => values.get(id)!)
  if (new Set(referenced.map((value: Value) => `${value.period.start}/${value.period.end}`)).size > 1 || new Set(referenced.flatMap((value: Value) => value.currency ? [value.currency] : [])).size > 1 || new Set(referenced.flatMap((value: Value) => value.unit ? [value.unit] : [])).size > 1) return false
  if (waterfall.reconciliation === "reconciled" && (waterfall.final === null || !waterfall.segments.length || waterfall.segments.some((segment: Segment, index: number) => segment.start === null || segment.end === null || segment.amount === null || (index > 0 && waterfall.segments[index - 1]?.end !== segment.start)) || waterfall.segments.at(-1)?.end !== waterfall.final)) return false
  return true
}
