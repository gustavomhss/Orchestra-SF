import type { DomainProjection } from "../contracts/context.ts"

/** Presentation metadata for the monthly values produced by the Planner port. */
export function plannerMonthlyPresentation(projection: DomainProjection) {
  return {
    viewId: "BI01" as const,
    series: ([
      { id: "budget", label: "Budget", role: "budget" },
      { id: "actual", label: "Actual", role: "actual" },
      { id: "outlook", label: "Outlook", role: "outlook" },
    ] as const).map((series) => ({ ...series, unit: "USD", valueIds: projection.values.filter((value) => /^month:\d+:/.test(value.id) && value.id.endsWith(`:${series.id}`)).sort((a, b) => a.period.start.localeCompare(b.period.start)).map((value) => value.id) })),
    limitations: ["Outlook uses closed-month actuals and open-month forecast or budget. Missing inputs and exchange rates remain unavailable."],
  }
}
