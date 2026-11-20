import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createDashboardAgendaSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/agenda.ts"
import { dashboardReviewTitle } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { ReviewAgendaItem } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { DashboardAgendaSection } from "./dashboard-services.ts"

type Business = Pick<ReturnType<typeof createSfBusinessServices>, "host" | "dashboard" | "dashboardSources" | "dashboardRecords">
export type SfDashboardReviewItem = Extract<ReviewAgendaItem, { kind: "dashboard" }> & {
  title: string
  recordOptions: readonly { recordRef: string; recordId: string; label: string }[]
}

/** Keep UI-only labels and record options out of the canonical C04 command. */
export function sfDashboardReviewAgendaItem(section: DashboardAgendaSection): Extract<ReviewAgendaItem, { kind: "dashboard" }> {
  return { kind: "dashboard", id: section.id, topic: section.topic, selectionRef: section.selectionRef,
    period: { start: section.period.start, end: section.period.end },
    ...(section.recordRefs === undefined ? {} : { recordRefs: section.recordRefs }) }
}

/** Resolve original C17 record selectors under the same admitted source and principal. */
export async function projectSfDashboardReviewItem(
  business: Business, section: DashboardAgendaSection, call: TrustedDomainContext,
): Promise<PortResult<SfDashboardReviewItem>> {
  const item = sfDashboardReviewAgendaItem(section)
  const title = dashboardReviewTitle(item.topic)
  if (!title) return { status: "needs-input", reason: "invalid-agenda-topic" }
  const selected = await createDashboardAgendaSelector({
    host: business.host, dashboard: business.dashboard,
    sources: business.dashboardSources, recordEvidence: business.dashboardRecords,
  })(item, call)
  if (selected.status !== "ok") return selected
  const recordOptions: { recordRef: string; recordId: string; label: string }[] = []
  for (const recordRef of selected.value.recordRefs) {
    const resolved = await business.dashboardRecords.resolve(recordRef, call)
    if (resolved.status !== "ok") return resolved
    const target = resolved.value.target
    const prefix = target.recordType === "itperf-item"
      ? `itperf.items[id:${encodeURIComponent(target.recordId)}].`
      : `${target.recordType}[id:${encodeURIComponent(target.recordId)}].`
    const label = ["name", "title", "action", "owner"].map((field) =>
      selected.value.projection.values.find((value) => value.id === prefix + field)?.value,
    ).find((value): value is string => typeof value === "string" && value.trim().length > 0)
    recordOptions.push({ recordRef, recordId: target.recordId, label: label ?? target.recordId })
  }
  if (!await business.host.revalidate(call)) return { status: "denied", reason: "agenda-authority-unavailable" }
  return { status: "ok", value: { ...item, title, recordRefs: selected.value.recordRefs, recordOptions } }
}
