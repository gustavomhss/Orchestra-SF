import type { DomainProjection } from "../contracts/context.ts"

// Structurally compatible with WP05 BiPresentation. Roles are declared by the producer.
export function dashboardBiPresentation(viewId: "BI01" | "BI07" | "BI08", projection: DomainProjection) {
  if (viewId === "BI01") {
    const year = projection.context.period.start.slice(0, 4)
    const series = ([{ measure: "effective", role: "budget", label: "Effective budget" }, { measure: "actual", role: "actual", label: "Actual" }, { measure: "forecast", role: "other", label: "Forecast" }] as const).map((item) => ({ id: item.measure, label: item.label, unit: "unspecified", role: item.role, valueIds: Array.from({ length: 12 }, (_, index) => `budget:${year}-${String(index + 1).padStart(2, "0")}:${item.measure}`).filter((id) => projection.values.some((value) => value.id === id)) }))
    return { viewId, series, limitations: ["Currency is unspecified in Dashboard; missing actual or forecast stays unknown.", "Forecast is the recorded field; an outlook combining closed actual and open forecast is unavailable.", "Effective budget follows the Dashboard monthly override rule."] }
  }
  if (viewId === "BI07") {
    const groups = [...new Set(projection.values.flatMap((value) => {
      const match = /^tickets:\d{4}-\d{2}:(.+)\|(Incidents|Service Requests)\|(Open|Closed)$/.exec(value.id)
      return match ? [`${match[1]}|${match[2]}|${match[3]}`] : []
    }))]
    const series = groups.map((group) => {
      const match = /^(.*)\|(Incidents|Service Requests)\|(Open|Closed)$/.exec(group)!
      const category = match[1]
      const type = match[2]
      const measure = match[3]
      return { id: group, label: `${category} — ${type} — ${measure === "Open" ? "Opened" : "Closed"}`, unit: "tickets", role: measure === "Open" ? "opened" as const : "closed" as const, valueIds: projection.values.filter((value) => value.id.startsWith("tickets:") && value.id.endsWith(`:${group}`)).sort((a, b) => a.period.start.localeCompare(b.period.start)).map((value) => value.id) }
    })
    return { viewId, series, limitations: ["Monthly register counts, grouped by category and request type; they are not an event log or a backlog.", "Missing cells remain unknown."] }
  }
  const dates = projection.values.filter((value) => value.id.startsWith("milestone:") && value.id.endsWith(":date"))
  const items = dates.map((date) => {
    const prefix = date.id.slice(0, -5)
    const name = projection.values.find((value) => value.id === `${prefix}:name`)
    const status = projection.values.find((value) => value.id === `${prefix}:status`)
    return { label: typeof name?.value === "string" && name.value ? name.value : "Milestone", dateValueId: date.id, state: ["upcoming", "in-progress", "late"].includes(String(status?.value)) ? "planned" as const : "unknown" as const }
  })
  return { viewId, series: [{ id: "milestones", label: "Milestone dates", unit: "date", role: "planned" as const, valueIds: dates.map((date) => date.id) }], timeline: { items }, limitations: ["Milestone names are current; stored dates do not establish historical status or completion dates. Undated milestones and milestones with missing or duplicate identifiers are excluded.", "Drilldown currently identifies the authorized page source; record-level evidence requires the host registry."] }
}
