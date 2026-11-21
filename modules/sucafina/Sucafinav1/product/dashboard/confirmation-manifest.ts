/** Explicit producer-owned dependency declarations; unlisted derived fields are not confirmable. */
export function dashboardConfirmationManifest(recordType: string, fields: readonly string[]) {
  if (!fields.length || fields.some((field) => typeof field !== "string" || !field) || new Set(fields).size !== fields.length) return undefined
  if (recordType === "dashboard-page") {
    const rules: Record<string, readonly string[]> = {
      budgetMetrics: ["dashboard-effective-budget-v1", "authorized-budget-lines", "selected-year-entries"],
      budgetSeries: ["dashboard-effective-budget-v1", "authorized-budget-lines", "selected-month-entries"],
      opsTickets: ["dashboard-ticket-categories-v1", "selected-month-tickets"],
      executiveMonths: ["dashboard-executive-periods-v1", "authorized-operational-inputs"],
      milestoneDates: ["dashboard-milestone-dates-v1", "authorized-selected-dates"],
      hotTopics: ["dashboard-hot-topic-view-v1", "authorized-current-topics"],
      opexEntries: ["dashboard-record-view-v1", "selected-month-records"],
      capexEntries: ["dashboard-record-view-v1", "selected-month-records"],
      opexOwners: ["dashboard-record-view-v1", "authorized-record-fields"],
      capexProjects: ["dashboard-record-view-v1", "authorized-record-fields"],
      members: ["dashboard-record-view-v1", "authorized-record-fields"],
      leaders: ["dashboard-record-view-v1", "authorized-record-fields"],
      projects: ["dashboard-record-view-v1", "authorized-record-fields"],
      risks: ["dashboard-record-view-v1", "authorized-record-fields"],
      contracts: ["dashboard-record-view-v1", "authorized-record-fields"],
      stakeholders: ["dashboard-record-view-v1", "authorized-record-fields"],
      secKpi: ["dashboard-record-view-v1", "selected-month-records"],
    }
    if (fields.some((field) => !Object.hasOwn(rules, field))) return undefined
    return { version: "dashboard-c06-v1", internal: [...new Set(fields.flatMap((field) => rules[field]!))].sort(), requiredExternal: [] as readonly never[] }
  }
  const records = ["hotTopics", "opexOwners", "opexEntries", "capexProjects", "capexEntries", "budgetYtd", "deviations", "budgetCurrentMonth", "revenueByYear", "members", "leaders", "itUsersMonthly", "projects", "risks", "contracts", "stakeholders", "itperf", "itperf-item", "opsTickets", "opsSLA", "opsHeatmap", "secKpi", "secActions", "secIncidents", "secPhishing"]
  if (!records.includes(recordType)) return undefined
  return { version: "dashboard-c06-v1", internal: ["authorized-record-fields-v1"], requiredExternal: [] as readonly never[] }
}
