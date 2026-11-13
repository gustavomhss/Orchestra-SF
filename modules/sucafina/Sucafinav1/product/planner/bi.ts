import type { DomainProjection } from "../contracts/context.ts"

/** Keep aggregate IDs distinct from every domain line ID, even legacy user IDs. */
export function plannerMonthlyPrefix(components: DomainProjection["components"]) {
  let prefix = "month"
  while (components.some((component) => component.id.startsWith(`${prefix}:`))) prefix += "~"
  return prefix
}

/** Presentation metadata for the monthly values produced by the Planner port. */
export function plannerMonthlyPresentation(projection: DomainProjection) {
  const prefix = plannerMonthlyPrefix(projection.components)
  return {
    viewId: "BI01" as const,
    series: ([
      { id: "budget", label: "Budget", role: "budget" },
      { id: "actual", label: "Actual", role: "actual" },
      { id: "outlook", label: "Outlook", role: "outlook" },
    ] as const).map((series) => ({ ...series, unit: "USD", valueIds: projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(`:${series.id}`)).sort((a, b) => a.period.start.localeCompare(b.period.start)).map((value) => value.id) })),
    limitations: ["Outlook uses closed-month actuals and open-month forecast or budget. Missing inputs and exchange rates remain unavailable."],
  }
}

/** FTE is planned capacity; cost remains the Planner's monthly HR budget in USD. */
export function plannerCapacityPresentation(projection: DomainProjection) {
  const prefix = plannerMonthlyPrefix(projection.components)
  const fte = projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(":fte")).sort((a, b) => a.period.start.localeCompare(b.period.start))
  const cost = projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(":hr-budget")).sort((a, b) => a.period.start.localeCompare(b.period.start))
  return {
    viewId: "BI04" as const,
    series: [
      { id: "fte", label: "Capacidade planejada", role: "fte" as const, unit: "fte", valueIds: fte.map((value) => value.id), alignmentKeys: fte.map((value) => value.period.start) },
      { id: "cost", label: "Orçamento de pessoas", role: "cost" as const, unit: "USD", valueIds: cost.map((value) => value.id), alignmentKeys: cost.map((value) => value.period.start) },
    ],
    limitations: ["Capacidade planejada não é disponibilidade real; custo indisponível permanece ausente."],
  }
}
