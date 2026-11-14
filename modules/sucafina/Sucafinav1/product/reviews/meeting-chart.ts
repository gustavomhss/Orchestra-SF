import { biViews } from "../analytics/catalog.ts"
import { renderBiView } from "../analytics/view.ts"
import type { BiPresentation } from "../analytics/semantics.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { ReviewChart } from "./port.ts"

/** Render the captured producer presentation without turning preserved values into live source links. */
export function renderCapturedMeetingChart(projection: DomainProjection, chart: ReviewChart | undefined, reviewRef: string) {
  if (!chart) return undefined
  if (chart.status !== "ok") {
    const unavailable = document.createElement("p")
    unavailable.textContent = `Chart unavailable: ${chart.reason}`
    return unavailable
  }
  if (!biViews.some((view) => view.id === chart.viewId) || chart.series.some((series) => !["budget", "actual", "outlook", "baseline", "contribution", "result", "fte", "cost", "stock", "aging", "opened", "closed", "planned", "completed", "sensitivity", "other"].includes(series.role))) {
    const unavailable = document.createElement("p")
    unavailable.textContent = "Chart presentation unavailable; captured values are listed below."
    return unavailable
  }
  const presentation: BiPresentation = {
    viewId: chart.viewId as BiPresentation["viewId"],
    series: chart.series.map((series) => ({ id: series.id, label: series.label, unit: series.unit, role: series.role as BiPresentation["series"][number]["role"], valueIds: series.valueIds, ...(series.alignmentKeys ? { alignmentKeys: series.alignmentKeys } : {}) })),
    limitations: chart.limitations,
    ...(chart.waterfall?.status === "ok" ? { waterfall: { finalValueId: chart.waterfall.finalValueId, reconciliation: chart.waterfall.reconciliation, segments: chart.waterfall.segments.map((segment) => ({ label: segment.label, startValueId: segment.startValueId, endValueId: segment.endValueId, componentValueId: segment.componentValueId })) } } : {}),
    ...(chart.timeline?.status === "ok" ? { timeline: { items: chart.timeline.items.map((item) => ({ label: item.label, dateValueId: item.dateValueId, state: item.state })) } } : {}),
  }
  const detached = { ...projection, values: projection.values.map((value) => ({ ...value, drilldown: null })) }
  return renderBiView({ viewId: presentation.viewId, selectionRef: `preserved-review:${reviewRef}`, period: projection.context.period }, detached, () => {}, presentation)
}
