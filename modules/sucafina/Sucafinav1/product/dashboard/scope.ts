import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { Period } from "../contracts/context.ts"
import { projectDashboardSource } from "./port.ts"
import { DashboardOperations } from "../../runtime/dashboard-operations.ts"
import { dashboardPages } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"

export type DashboardScopeSelector = { page: string; fields: readonly string[]; period: Period }

// The host supplies actor and asOf from its authenticated, versioned authority; selector is not a grant.
export function projectDashboardScope(snapshot: Snapshot, actor: Actor, selector: DashboardScopeSelector, asOf: string) {
  if (!selector || typeof selector.page !== "string" || !Array.isArray(selector.fields) || !selector.fields.length || selector.fields.some((field) => typeof field !== "string" || !field) || new Set(selector.fields).size !== selector.fields.length || !selector.period || !/^\d{4}-\d{2}-\d{2}$/.test(selector.period.start) || !/^\d{4}-\d{2}-\d{2}$/.test(selector.period.end) || selector.period.start > selector.period.end || selector.period.start.slice(0, 4) !== selector.period.end.slice(0, 4) || [selector.period.start, selector.period.end].some((date) => !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) || typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(asOf) || !Number.isFinite(Date.parse(asOf))) return undefined
  const day = new Date(asOf).toISOString().slice(0, 10)
  if (selector.fields.some((field) => ["executive", "members", "leaders", "cio", "projects", "risks", "contracts", "stakeholders", "itperf", "signals", "hotTopics"].includes(field)) && (day < selector.period.start || day > selector.period.end)) return undefined
  const year = Number(selector.period.start.slice(0, 4))
  if (year < 2024 || year > 2027) return undefined
  const monthly = ["opsTickets", "opsSLA", "opsHeatmap", "secKpi", "itUsersMonthly", "opexEntries", "capexEntries", "executiveMonths"]
  if (selector.fields.some((field) => monthly.includes(field)) && (selector.period.start.slice(8) !== "01" || Number(selector.period.end.slice(8)) !== new Date(Date.UTC(year, Number(selector.period.end.slice(5, 7)), 0)).getUTCDate())) return undefined
  if (selector.fields.includes("budgetMetrics") && (selector.period.start.slice(5) !== "01-01" || selector.period.end.slice(5) !== "12-31")) return undefined
  const observed = structuredClone(snapshot)
  const projection = projectDashboardSource(observed, actor, { at: `${day}T00:00:00Z`, id: () => "", directory: [] }, selector.page)
  if (!projection || selector.fields.some((field) => !Object.hasOwn(projection, field))) return undefined
  const selected = Object.fromEntries([...selector.fields].sort().map((field) => {
    const value = projection[field]
    if (field === "budgetMetrics") return [field, { [year]: object(value)[year] }]
    if (field === "executiveByYear") {
      const current = object(object(value)[year])
      const inYear = selector.period.start.slice(5) === "01-01" && selector.period.end.slice(5) === "12-31"
      const today = day
      return [field, { [year]: {
        ...(inYear ? { departures: current.departures } : {}),
        ...(today >= selector.period.start && today <= selector.period.end ? { active: current.active } : {}),
        ...(Array.isArray(current.monthlyDepartures) ? { monthlyDepartures: current.monthlyDepartures.map((value, index) => index + 1 >= Number(selector.period.start.slice(5, 7)) && index + 1 <= Number(selector.period.end.slice(5, 7)) ? value : null) } : { monthlyDepartures: current.monthlyDepartures }),
      } }]
    }
    if (field === "executiveMonths") return [field, Object.fromEntries(Object.entries(object(value)).filter(([key]) => {
      const [entryYear, entryMonth] = key.split(":")
      return Number(entryYear) === year && Number(entryMonth) >= Number(selector.period.start.slice(5, 7)) && Number(entryMonth) <= Number(selector.period.end.slice(5, 7))
    }).map(([key, entry]) => [key, selector.period.start.slice(5) === "01-01" ? entry : Object.fromEntries(Object.entries(object(entry)).filter(([name]) => !["incYtd", "svcYtd"].includes(name)))]))]
    if (Array.isArray(value) && monthly.includes(field)) return [field, rows(value).filter((row) => row.year === year && (typeof row.month !== "number" || (row.month >= Number(selector.period.start.slice(5, 7)) && row.month <= Number(selector.period.end.slice(5, 7)))))]
    return [field, value]
  }))
  // Derived annual totals alone cannot detect compensating line edits; include the authorized components.
  const budgetDependencies = selector.fields.includes("budgetMetrics") ? Object.fromEntries(["opexOwners", "opexEntries", "capexProjects", "capexEntries"].map((field) => [field, field.endsWith("Entries") ? rows(projection[field]).filter((row) => row.year === year) : projection[field]])) : {}
  const operationView = selector.fields.includes("executiveMonths") ? DashboardOperations.domain.view(observed, actor, { at: `${day}T00:00:00Z`, id: () => "", directory: [] }).data : projection
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
  const allowed = dashboardPages(actor, summaries)
  const operationalFields = selector.fields.includes("executiveMonths") ? [...(allowed.includes("IT Operations") ? ["opsTickets", "opsSLA", "opsHeatmap", "opsCats"] : []), ...(allowed.includes("IT Security KPIs") ? ["secKpi", ...(day >= selector.period.start && day <= selector.period.end ? ["secIncidents"] : [])] : [])] : selector.fields.includes("opsTickets") ? ["opsCats"] : []
  const operationalDependencies = Object.fromEntries(operationalFields.filter((field) => Object.hasOwn(operationView, field)).map((field) => [field, ["opsTickets", "opsSLA", "opsHeatmap", "secKpi"].includes(field) ? rows(operationView[field]).filter((row) => row.year === year && typeof row.month === "number" && row.month >= Number(selector.period.start.slice(5, 7)) && row.month <= Number(selector.period.end.slice(5, 7))) : operationView[field]]))
  const currentFields = ["executive", "executiveByYear", "members", "leaders", "cio", "projects", "risks", "contracts", "stakeholders", "itperf", "signals", "hotTopics"]
  const today = day
  const observesToday = today >= selector.period.start && today <= selector.period.end && (selector.fields.some((field) => currentFields.includes(field)) || (selector.fields.includes("executiveMonths") && allowed.includes("IT Security KPIs")))
  const privateDependencyDigest = digestSfValue({ ...budgetDependencies, ...operationalDependencies, ...(observesToday ? { observationDay: today } : {}) })
  // The host uses this digest for versioning only and returns selected values, never this private field.
  return { selected, privateDependencyDigest }
}
