import { domain } from "../../runtime/planner.ts"
import { plannerKeys } from "../../src/nav.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { projectPlannerSource } from "../planner/port.ts"
import { projectDashboardScope } from "../dashboard/scope.ts"
import type { Period } from "../contracts/context.ts"
import type { SfSourceScope } from "./source-lifecycle.ts"
import { projectSfProcurementScope } from "./procurement-projections.ts"
import { normalizeDashboardRecords } from "../dashboard/records.ts"
import { dashboardPerformanceAgendaRecords } from "../dashboard/agenda.ts"
import { projectDashboardSource } from "../dashboard/port.ts"
import { publicSfData } from "./public-state.ts"

/** Saved roles define the projection, never authenticate a later caller. Reads authenticate again. */
export function sfPlannerProjectionSelector(snapshot: Snapshot, actor: Actor) {
  return { kind: "planner-source-v1", roles: [...actor.roles].sort(), canWrite: actor.canWrite, roleMapDigest: digestSfValue(roleMap(snapshot, "planner")) }
}

export function sfPlannerRosterProjectionSelector(snapshot: Snapshot, actor: Actor, fields: readonly string[], period: Period) {
  return { ...sfPlannerProjectionSelector(snapshot, actor), kind: "planner-roster-v1", fields: [...fields].sort(), period: structuredClone(period) }
}

// The host shares this clock with its request environment; a client cannot supply it.
export function createSfSourceScopeProjector(now: () => string) {
  return (surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => projectSfSourceScope(surface, snapshot, scope, now())
}

export function projectSfSourceScope(surface: Surface, snapshot: Snapshot, scope: SfSourceScope, observedAt?: string) {
  const selector = object(scope.selector)
  if (surface === "procurement") return projectSfProcurementScope(surface, snapshot, scope)
  if (surface === "dashboard") {
    const stored = object(selector.actor)
    const access = object(object(snapshot.data.access)[scope.principalRef])
    if (stored.id !== scope.principalRef || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "dashboard")) || typeof stored.canWrite !== "boolean" || !Array.isArray(stored.roles) || !stored.roles.every((role) => typeof role === "string")) return undefined
    const actor: Actor = { id: scope.principalRef, roles: stored.roles, canWrite: stored.canWrite, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    if (digestSfValue(actor) !== digestSfValue(stored)) return undefined
    // Whole-backup authority is explicit and retains the legacy dashboard administrator boundary.
    if (scope.recordType === "dashboard-dataset") return scope.recordId === "all" && selector.kind === "dashboard-dataset-v1" && actor.canWrite && actor.roles.includes("admin") &&
      Array.isArray(selector.fields) && selector.fields.length === 1 && selector.fields[0] === "data" && selector.period === undefined
      ? { data: publicSfData(snapshot.data) } : undefined
    if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || !selector.fields.every((field) => typeof field === "string") || !selector.period || typeof selector.period !== "object") return undefined
    if (typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt))) return undefined
    const asOf = `${new Date(observedAt).toISOString().slice(0, 10)}T00:00:00Z`
    if (scope.recordType === "dashboard-page" && scope.recordId === selector.page) return projectDashboardScope(snapshot, actor, { page: selector.page, fields: selector.fields, period: selector.period as Period }, asOf)
    // Record scopes are admitted only through a page the same actor can view.
    if (scope.recordType === "dashboard-page" || scope.recordId === "__singleton__") return undefined
    if (scope.recordType === "itperf-item") {
      if (selector.page !== "IT Performance Contract" || !dashboardPerformanceAgendaRecords(snapshot.data.itperf)) return undefined
      const projection = projectDashboardScope(snapshot, actor, { page: selector.page, fields: ["itperf"], period: selector.period as Period }, asOf)
      const records = projection && dashboardPerformanceAgendaRecords(projection.selected.itperf)
      const matches = records?.filter((record) => String(record.id) === scope.recordId)
      if (!matches || matches.length !== 1 || selector.fields.some((field) => !Object.hasOwn(matches[0]!, field))) return undefined
      return Object.fromEntries([...selector.fields].sort().map((field) => [field, matches[0]![field]]))
    }
    const logical = ["budgetYtd", "deviations", "budgetCurrentMonth", "revenueByYear"].includes(scope.recordType)
    const visible = logical ? projectDashboardSource(snapshot, actor, { at: asOf, id: () => "", directory: [] }, selector.page) : undefined
    const projection = logical ? undefined : projectDashboardScope(snapshot, actor, { page: selector.page, fields: [scope.recordType], period: selector.period as Period }, asOf)
    const records = logical ? normalizeDashboardRecords(scope.recordType, snapshot.data[scope.recordType]) : projection?.selected[scope.recordType]
    if (!Array.isArray(records)) return undefined
    const matches = records.filter((entry) => String(object(entry).id ?? "") === scope.recordId)
    if (matches.length !== 1 || selector.fields.some((field) => !Object.hasOwn(object(matches[0]), field))) return undefined
    const record = object(matches[0])
    if (logical) {
      if (!visible) return undefined
      if (scope.recordType === "revenueByYear" || scope.recordType === "budgetCurrentMonth") {
        if (selector.page !== "Budget Overview" || selector.fields.some((field) => !["value", "year"].includes(field))) return undefined
      }
      if (scope.recordType === "budgetYtd" || scope.recordType === "deviations") {
        const page = record.kind === "opex" ? "OPEX Detail" : record.kind === "capex" ? "CAPEX Projects" : undefined
        const owners = page === "OPEX Detail" ? visible.opexOwners : page === "CAPEX Projects" ? visible.capexProjects : undefined
        const fields = scope.recordType === "budgetYtd" ? ["kind", "year", "ownerId", "amount", "months", "perMonth", "at"] : ["kind", "year", "month", "ownerId", "flag", "text"]
        if (selector.page !== page || !Array.isArray(owners) || !owners.some((owner) => String(object(owner).id ?? "") === record.ownerId) || selector.fields.some((field) => !fields.includes(field))) return undefined
      }
    }
    const period = object(selector.period)
    if (typeof period.start !== "string" || typeof period.end !== "string") return undefined
    if (scope.recordType === "hotTopics") {
      const today = asOf.slice(0, 10)
      if (selector.page !== "Hot Topics & Actions" || period.start !== today || period.end !== today ||
        selector.fields.some((field) => !["id", "action", "owner", "due", "status", "priority", "notes"].includes(field))) return undefined
      return Object.fromEntries([...selector.fields].sort().map((field) => [field, record[field]]))
    }
    const year = record.year === undefined ? Number(period.start.slice(0, 4)) : Number(record.year)
    const month = record.month === undefined ? undefined : Number(record.month)
    if (!Number.isInteger(year) || year < 2024 || year > 2027 || (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))) return undefined
    const start = month === undefined ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`
    const end = month === undefined ? `${year}-12-31` : `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`
    if (period.start > start || period.end < end) return undefined
    return Object.fromEntries([...selector.fields].sort().map((field) => [field, record[field]]))
  }
  if (surface !== "planner" || !["planner-source-v1", "planner-roster-v1"].includes(String(selector.kind)) ||
    selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "planner")) || typeof selector.canWrite !== "boolean" ||
    !Array.isArray(selector.roles) || !selector.roles.every((role): role is string => typeof role === "string")) return undefined
  const access = object(object(snapshot.data.access)[scope.principalRef])
  const actor: Actor = { id: scope.principalRef, roles: selector.roles, canWrite: selector.canWrite,
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  if (scope.recordType === "planner-version" && selector.kind === "planner-source-v1") return projectPlannerSource(snapshot, actor, scope.recordId)
  const fields = selector.fields
  if (scope.recordType !== "planner-roster" || scope.recordId !== "file" || selector.kind !== "planner-roster-v1" || !actor.canWrite ||
    !actor.roles.some((role) => role === "admin" || role === "hr") || !plannerKeys(actor).includes("Headcount") || !Array.isArray(snapshot.data.roster) ||
    !isSfPeriod(selector.period) || !Array.isArray(fields) || !fields.length || fields.some((field) => typeof field !== "string" || !["name", "title", "type", "leader", "location", "start", "end", "status"].includes(field)) ||
    new Set(fields).size !== fields.length || digestSfValue(fields) !== digestSfValue([...fields].sort())) return undefined
  const roster = domain.view(snapshot, actor, { at: observedAt ?? "1970-01-01T00:00:00.000Z", id: () => "", directory: [] }).data.roster
  if (!Array.isArray(roster) || roster.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return undefined
  const source = snapshot.sfSources?.records[JSON.stringify(["planner-roster", "file"])]
  if (!source?.alive || !Number.isSafeInteger(source.version) || source.version < 1) return undefined
  // The full physical revision also fences changes in fields used by roster synchronization.
  return { roster: roster.map((row) => Object.fromEntries(fields.map((field) => [field, object(row)[field]]))), sourceVersion: source.version }

}
