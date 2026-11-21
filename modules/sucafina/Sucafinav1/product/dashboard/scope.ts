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
  if (selector.fields.some((field) => ["executive", "members", "leaders", "cio", "projects", "risks", "contracts", "stakeholders", "itperf", "signals", "hotTopics", "secActions", "secIncidents", "secPhishing"].includes(field)) && (day < selector.period.start || day > selector.period.end)) return undefined
  const year = Number(selector.period.start.slice(0, 4))
  if (year < 2024 || year > 2027) return undefined
  const monthly = ["opsTickets", "opsSLA", "opsHeatmap", "secKpi", "itUsersMonthly", "opexEntries", "capexEntries", "executiveMonths", "budgetSeries"]
  if (selector.fields.some((field) => monthly.includes(field)) && (selector.period.start.slice(8) !== "01" || Number(selector.period.end.slice(8)) !== new Date(Date.UTC(year, Number(selector.period.end.slice(5, 7)), 0)).getUTCDate())) return undefined
  if (selector.fields.includes("budgetMetrics") && (selector.period.start.slice(5) !== "01-01" || selector.period.end.slice(5) !== "12-31")) return undefined
  const observed = structuredClone(snapshot)
  const projection = projectDashboardSource(observed, actor, { at: `${day}T00:00:00Z`, id: () => "", directory: [] }, selector.page)
  if (!projection || selector.fields.some((field) => !Object.hasOwn(projection, field))) return undefined
  const selected = Object.fromEntries([...selector.fields].sort().map((field) => {
    const value = projection[field]
    if (field === "budgetMetrics") return [field, { [year]: object(value)[year] }]
    if (field === "budgetSeries") return [field, { [year]: (Array.isArray(object(value)[year]) ? object(value)[year] as unknown[] : []).map((amount, index) => index + 1 >= Number(selector.period.start.slice(5, 7)) && index + 1 <= Number(selector.period.end.slice(5, 7)) ? amount : null) }]
    if (field === "milestoneDates") return [field, rows(value).flatMap((row) => {
      const valid = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Date.parse(row.date)) && new Date(row.date).toISOString().slice(0, 10) === row.date
      const current = day >= selector.period.start && day <= selector.period.end ? row : Object.fromEntries(Object.entries(row).filter(([key]) => key !== "status"))
      if (!valid) return [{ ...current, date: null }]
      return (row.date as string) >= selector.period.start && (row.date as string) <= selector.period.end ? [current] : []
    })]
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
  const seriesDependencies = selector.fields.includes("budgetSeries") && !selector.fields.includes("budgetMetrics") ? Object.fromEntries(["opexOwners", "opexEntries", "capexProjects", "capexEntries"].map((field) => [field, rows(projection[field]).filter((row) => !field.endsWith("Entries") || (row.year === year && typeof row.month === "number" && row.month >= Number(selector.period.start.slice(5, 7)) && row.month <= Number(selector.period.end.slice(5, 7)) && rows(projection[field === "opexEntries" ? "opexOwners" : "capexProjects"]).some((owner) => field === "opexEntries" ? row.ownerId == owner.id : row.projId == owner.id || row.projectId == owner.id))).map((row) => {
    if (field.endsWith("Entries")) return Object.fromEntries(Object.entries(row).filter(([key]) => ["id", "ownerId", "projId", "projectId", "year", "month", "budget", "actual", "forecast"].includes(key)))
    const entries = rows(projection[field === "opexOwners" ? "opexEntries" : "capexEntries"])
    const fallback = Array.from({ length: Number(selector.period.end.slice(5, 7)) - Number(selector.period.start.slice(5, 7)) + 1 }, (_, index) => Number(selector.period.start.slice(5, 7)) + index).some((month) => {
      const periodEntries = entries.filter((entry) => entry.year === year && entry.month === month)
      const direct = periodEntries.find((entry) => field === "opexOwners" ? entry.ownerId == row.id : (entry.projId ?? entry.projectId) == row.id)
      const effective = periodEntries.find((entry) => field === "opexOwners" ? String(entry.ownerId ?? "") === String(row.id ?? "") : String(entry.projId ?? entry.projectId ?? "") === String(row.id ?? "") || entry.projectId == String(row.id ?? ""))
      return [direct, effective].some((entry) => !(typeof entry?.budget === "number" && Number.isFinite(entry.budget) && entry.budget > 0))
    })
    return Object.fromEntries(Object.entries(row).filter(([key]) => key === "id" || (key === "budget" && fallback)))
  })])) : {}
  const operationView = selector.fields.includes("executiveMonths") ? DashboardOperations.domain.view(observed, actor, { at: `${day}T00:00:00Z`, id: () => "", directory: [] }).data : projection
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
  const allowed = dashboardPages(actor, summaries)
  const operationalFields = selector.fields.includes("executiveMonths") ? [...(allowed.includes("IT Operations") ? ["opsTickets", "opsSLA", "opsHeatmap", "opsCats"] : []), ...(allowed.includes("IT Security KPIs") ? ["secKpi", ...(day >= selector.period.start && day <= selector.period.end ? ["secIncidents"] : [])] : [])] : selector.fields.includes("opsTickets") ? ["opsCats"] : []
  const operationalDependencies = Object.fromEntries(operationalFields.filter((field) => Object.hasOwn(operationView, field)).map((field) => [field, ["opsTickets", "opsSLA", "opsHeatmap", "secKpi"].includes(field) ? rows(operationView[field]).filter((row) => row.year === year && typeof row.month === "number" && row.month >= Number(selector.period.start.slice(5, 7)) && row.month <= Number(selector.period.end.slice(5, 7))) : operationView[field]]))
  const currentFields = ["executive", "executiveByYear", "members", "leaders", "cio", "projects", "risks", "contracts", "stakeholders", "itperf", "signals", "hotTopics", "secActions", "secIncidents", "secPhishing"]
  const today = day
  const observesToday = today >= selector.period.start && today <= selector.period.end && (selector.fields.some((field) => currentFields.includes(field)) || selector.fields.includes("milestoneDates") || (selector.fields.includes("executiveMonths") && allowed.includes("IT Security KPIs")))
  const privateDependencyDigest = digestSfValue({ ...budgetDependencies, ...seriesDependencies, ...operationalDependencies, ...(observesToday ? { observationDay: today } : {}) })
  // The host uses this digest for versioning only and returns selected values, never this private field.
  return { selected, privateDependencyDigest }
}
