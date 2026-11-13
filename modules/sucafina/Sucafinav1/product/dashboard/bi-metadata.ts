import type { DomainProjection, Period } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { dashboardBiPresentation } from "./bi.ts"

export type DashboardBiViewId = "BI01" | "BI07" | "BI08"
export type DashboardBiPresentation = ReturnType<typeof dashboardBiPresentation>

/** Fixed producer routing; selecting a page or field here never grants access to it. */
export function resolveDashboardBiSelection(viewId: string, period: Period): { page: string; fields: readonly string[] } | undefined {
  if (!isSfPeriod(period) || period.start.slice(0, 4) !== period.end.slice(0, 4) || Number(period.start.slice(0, 4)) < 2024 || Number(period.start.slice(0, 4)) > 2027) return undefined
  if (viewId === "BI01") return period.start.slice(8) === "01" && Number(period.end.slice(8)) === new Date(Date.UTC(Number(period.end.slice(0, 4)), Number(period.end.slice(5, 7)), 0)).getUTCDate() ? { page: "Budget Overview", fields: ["budgetSeries"] } : undefined
  if (viewId === "BI07") return period.start.slice(8) === "01" && Number(period.end.slice(8)) === new Date(Date.UTC(Number(period.end.slice(0, 4)), Number(period.end.slice(5, 7)), 0)).getUTCDate() ? { page: "IT Operations", fields: ["opsTickets"] } : undefined
  if (viewId === "BI08") return { page: "Portfolio Dashboard", fields: ["projects"] }
  return undefined
}

/** Presentation semantics are declared by the Dashboard producer, without recalculation. */
export function presentDashboardBi(viewId: DashboardBiViewId, projection: DomainProjection): PortResult<DashboardBiPresentation> {
  const selection = resolveDashboardBiSelection(viewId, projection.context.period)
  if (!selection || projection.context.surface !== "dashboard" || !projection.context.sourceRefs.length || projection.context.sourceRefs.some((ref) => ref.surface !== "dashboard" || ref.type !== "dashboard-page" || ref.id !== selection.page || selection.fields.some((field) => !ref.fields.includes(field)) || ref.period.start !== projection.context.period.start || ref.period.end !== projection.context.period.end)) return { status: "unavailable", reason: "dashboard-bi-source-mismatch" }
  if (new Set(projection.values.map((value) => value.id)).size !== projection.values.length) return { status: "unavailable", reason: "duplicate-value-id" }
  const presentation = dashboardBiPresentation(viewId, projection)
  return { status: "ok", value: { ...presentation, limitations: [...presentation.limitations, ...(projection.missing.length ? ["Some requested measurements are missing or unavailable; consult the data table."] : []), ...(presentation.series.every((series) => !series.valueIds.length) ? ["No measurements are available for this selection."] : [])] } }
}
