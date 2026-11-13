import type { DomainProjection } from "../contracts/context.ts"
import type { BiPresentation } from "./semantics.ts"

export type TicketSeries = { id: string; label: string; unit: string; role: "opened" | "closed"; valueIds: readonly string[] }
export type TicketPlan = { mode: "snapshot" | "dated-series"; series: readonly TicketSeries[] }

/** Builds presentation metadata only from producer-declared projected values and time semantics. */
export function presentTickets(projection: DomainProjection, plan: TicketPlan): BiPresentation | null {
  if ((plan.mode !== "snapshot" && plan.mode !== "dated-series") || !plan.series.length || new Set(plan.series.map((series) => series.id)).size !== plan.series.length || plan.series.some((series) => !series.id.trim() || !series.label.trim() || !series.unit.trim() || !series.valueIds.length || new Set(series.valueIds).size !== series.valueIds.length)) return null
  const values = new Map(projection.values.map((value) => [value.id, value]))
  if (values.size !== projection.values.length) return null
  const allIds = plan.series.flatMap((series) => series.valueIds)
  if (new Set(allIds).size !== allIds.length || allIds.some((id) => !values.has(id))) return null
  if (plan.series.some((series) => series.valueIds.some((id) => {
    const value = values.get(id)!
    return (value.unit || value.currency) && value.unit !== series.unit && value.currency !== series.unit
  }))) return null
  if (plan.mode === "snapshot" && allIds.length !== plan.series.length) return null
  if (plan.mode === "dated-series" && plan.series.some((series) => series.valueIds.some((id) => {
    const value = values.get(id)!
    return value.granularity !== "month" && value.granularity !== "year"
  }))) return null
  if (plan.series.some((series) => new Set(series.valueIds.map((id) => `${values.get(id)!.period.start}/${values.get(id)!.period.end}`)).size !== series.valueIds.length)) return null
  if (plan.mode === "snapshot" && new Set(allIds.map((id) => `${values.get(id)!.period.start}/${values.get(id)!.period.end}`)).size !== 1) return null
  return {
    viewId: "BI07",
    series: plan.series.map((series) => ({ ...series, valueIds: [...series.valueIds] })),
    limitations: plan.mode === "snapshot" ? ["Fotografia atual; não representa histórico de entradas ou conclusões."] : [],
  }
}
