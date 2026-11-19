import type { PortResult } from "../contracts/ports.ts"
import type { ReviewAgendaItem } from "./selection.ts"
import type { ReviewAgendaCatalog, ReviewAgendaDiscovery } from "./agenda-picker.ts"
import { sameReviewAgendaItem } from "./agenda-picker.ts"

/** Refresh only an explicit preserved Dashboard selection; the agenda port rechecks every retained record. */
export async function refreshDashboardReviewAgenda(items: readonly ReviewAgendaItem[], discover: ReviewAgendaDiscovery): Promise<PortResult<Extract<ReviewAgendaItem, { kind: "dashboard" }>[]>> {
  const selected = structuredClone([...items])
  if (!selected.length || selected.some((item) => item.kind !== "dashboard" || item.recordRefs === undefined))
    return { status: "needs-input", reason: "agenda-refresh-requires-explicit-records" }
  const catalogs = new Map<string, ReviewAgendaCatalog>()
  const refreshed: Extract<ReviewAgendaItem, { kind: "dashboard" }>[] = []
  for (const item of selected) {
    if (item.kind !== "dashboard") return { status: "needs-input", reason: "agenda-refresh-source-unavailable" }
    const key = item.period.start + ":" + item.period.end
    let catalog = catalogs.get(key)
    if (!catalog) {
      const result = await discover({ domain: "dashboard", period: { ...item.period } })
      if (result.status !== "ok") return result
      catalog = result.value
      catalogs.set(key, catalog)
    }
    const matches = catalog.options.filter((option) => option.domain === "dashboard" &&
      option.item.kind === "dashboard" && sameReviewAgendaItem(item, option.item))
    const source = matches.length === 1 ? matches[0]!.item : undefined
    if (source?.kind !== "dashboard")
      return { status: "needs-input", reason: "agenda-refresh-selection-unavailable" }
    // Keep the human's topic ID, period, order, notes and exact C17 recordRefs.
    // A new source selector does not authorize an added or replaced record.
    refreshed.push({ ...item, selectionRef: source.selectionRef })
  }
  return { status: "ok", value: refreshed }
}
