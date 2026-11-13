import type { BiPresentation, DomainProjection } from "../contracts/context.ts"
import { isSfPeriod } from "../contracts/validation.ts"

/** Producer-supplied labels and roles; no semantic meaning is inferred from a value ID. */
export type { BiPresentation } from "../contracts/context.ts"

export function resolveBiPresentation(projection: DomainProjection, presentation: BiPresentation) {
  const values = new Map(projection.values.map((value) => [value.id, value]))
  if (values.size !== projection.values.length) return { status: "unavailable", reason: "duplicate-value-id" } as const
  if (new Set(presentation.series.map((series) => series.id)).size !== presentation.series.length) return { status: "unavailable", reason: "duplicate-series-id" } as const
  if (presentation.series.some((series) => series.alignmentKeys && (series.alignmentKeys.length !== series.valueIds.length || new Set(series.alignmentKeys).size !== series.alignmentKeys.length))) return { status: "unavailable", reason: "invalid-alignment-keys" } as const
  const ids = presentation.series.flatMap((series) => series.valueIds)
  const selectedIds = new Set(ids)
  if (selectedIds.size !== ids.length) return { status: "unavailable", reason: "duplicate-series-value" } as const
  if (ids.some((id) => !values.has(id))) return { status: "unavailable", reason: "unknown-series-value" } as const
  const series = presentation.series.map((entry) => ({ ...entry, values: entry.valueIds.flatMap((id) => {
    const value = values.get(id)
    return value ? [value] : []
  }) }))
  if (series.some((entry) => entry.values.some((value) => !isSfPeriod(value.period)))) return { status: "unavailable", reason: "invalid-value-period" } as const
  if (series.some((entry) => entry.values.some((value) => (value.unit || value.currency) && value.unit !== entry.unit && value.currency !== entry.unit))) return { status: "unavailable", reason: "incompatible-unit" } as const
  if (presentation.viewId === "BI01" && series.some((entry) => entry.values.some((value) => value.granularity !== "month" && value.granularity !== "year") || new Set(entry.values.map((value) => value.granularity)).size > 1)) return { status: "unavailable", reason: "unsupported-financial-granularity" } as const
  if (series.some((entry) => entry.values.some((value) => !!value.currency) && entry.values.some((value) => typeof value.value === "number" && !value.currency))) return { status: "unavailable", reason: "currency-missing" } as const
  if (series.some((entry) => new Set(entry.values.flatMap((value) => value.currency ? [value.currency] : [])).size > 1)) return { status: "unavailable", reason: "incompatible-currency" } as const
  if ((presentation.viewId === "BI01" || presentation.viewId === "BI07") && series.some((entry) => new Set(entry.values.map((value) => `${value.period.start}/${value.period.end}`)).size !== entry.values.length)) return { status: "unavailable", reason: "duplicate-series-period" } as const
  if (presentation.viewId === "BI07" && series.some((entry) => entry.values.length > 1 && entry.values.some((value) => value.granularity === "record" || value.granularity === "aggregate"))) return { status: "unavailable", reason: "ticket-history-not-projected" } as const
  return { status: "ok", viewId: presentation.viewId, series, limitations: presentation.limitations, unassigned: projection.values.filter((value) => !selectedIds.has(value.id)) } as const
}
