import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sfViewQueryAllowed, sfViewSelectionKeys } from "../../../../modules/sucafina/Sucafinav1/product/interface/personal-views.ts"
import type { SfPersonalView } from "../../../../modules/sucafina/Sucafinav1/product/interface/personal-views.ts"
import { projectDashboardSource } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/port.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object, rows } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { domain as planner } from "../../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import { domain as procurement } from "../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

/** URL filters are validated against the destination's vocabulary and actor-filtered domain view. */
export function sfPersonalViewSelectionAllowed(view: SfPersonalView, data: Record<string, unknown>, principalRef: string): boolean {
  const selections = view.filters?.selections ?? {}
  const keys = sfViewSelectionKeys(view.surface, view.page)
  if (!keys.length || view.filters?.query !== undefined && !sfViewQueryAllowed(view.surface, view.page)) return false
  const values = Object.values(data).flatMap(rows)
  const same = (left: unknown, right: string) => (typeof left === "string" || typeof left === "number") && String(left) === right
  const inRows = (collection: unknown, key: string, value: string) => rows(collection).some((row) => same(row[key], value))
  for (const [key, value] of Object.entries(selections)) {
    if (!keys.some((allowed) => allowed === key) || typeof value !== "string" || value.length > 500) return false
    if (!value) continue
    if (["year", "own", "execYear", "opsYear", "secYear"].includes(key)) { if (!/^20\d{2}$/.test(value)) return false; continue }
    if (["month", "executiveMonth", "operationsMonth", "securityMonth", "opsMonth"].includes(key)) { if (!/^(?:[1-9]|1[0-2])$/.test(value)) return false; continue }
    if (view.surface === "planner") {
      if (key === "version" || key === "filter") {
        const version = rows(data.versions).find((entry) => same(entry.id, value))
        if (!version || selections.year && !same(version.year, selections.year)) return false
        if (key === "filter" && selections.version) {
          const selected = rows(data.versions).find((entry) => same(entry.id, selections.version!))
          if (!selected || selected.year !== version.year) return false
        }
      } else if (key === "owner") { if (!inRows(data.directory, "id", value)) return false }
      else if (key === "class") { if (!["capex", "opex"].includes(value)) return false }
      else if (key === "mode") { if (!["budget", "actual", "forecast", "compare"].includes(value)) return false }
      else return false
      continue
    }
    if (view.surface === "procurement") {
      if (key === "request") { if (!inRows(data.requests, "number", value)) return false }
      else if (key === "supplier") { if (!inRows(data.suppliers, "id", value)) return false }
      else if (key === "filter") { if (!["All", "Open", "Closed", "Awaiting approval", "Requisition", "Sourcing", "Purchase order"].includes(value)) return false }
      else if (key === "status") { if (!["All", "pending", "active", "blocked", "inactive"].includes(value)) return false }
      else return false
      continue
    }
    if (key === "topicStatus") { if (!["open", "progress", "blocked", "done"].includes(value)) return false }
    else if (key === "memberStatus") { if (!["Active", "On Leave", "Terminated"].includes(value)) return false }
    else if (key === "owner") {
      if (value !== principalRef && !values.some((row) => [row.id, row.owner, row.ownerId, row.name].some((field) => same(field, value)))) return false
    } else if (key === "filter") {
      const allowed = ["Portfolio Dashboard", "All Projects"].includes(view.page) ? ["watch", "at-risk"] : view.page === "IT Risks" ? ["Critical", "Very High", "High", "Medium", "Low"] : []
      if (!allowed.includes(value)) return false
    } else if (key === "status") {
      const allowed = ["Portfolio Dashboard", "All Projects"].includes(view.page) ? ["Planning", "In Progress", "On Hold", "Completed"] : view.page === "IT Risks" ? ["open", "mitigating", "monitoring", "closed"] : values.map((row) => row.status)
      if (!allowed.includes(value)) return false
    } else return false
  }
  return true
}

export function createSfPersonalViewAuthority(input: { authority: ReturnType<typeof createSfProductAuthority> }) {
  const host = input.authority.host
  return async (view: SfPersonalView, call: TrustedDomainContext): Promise<boolean> => {
    const request = host.requestFor(call)
    if (!request || call.kind !== "ui" || request.signal.aborted || !await host.revalidate(call)) return false
    const environment = await host.environment(request).catch(() => undefined)
    if (!environment) return false
    const read = () => host.persistence.transaction(view.surface, async (snapshot) => {
      const principal = await host.authenticate(request, { surface: view.surface, roleMap: roleMap(snapshot, view.surface) })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((entry) => entry.surface === view.surface).map((entry) => entry.role)
      const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [] }
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
      const pages = view.surface === "dashboard" ? dashboardPages(actor, summaries) : view.surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
      if (!pages.includes(view.page)) return { commit: false, value: undefined }
      const data = view.surface === "dashboard" ? projectDashboardSource(snapshot, actor, environment, view.page)
        : (view.surface === "planner" ? planner : procurement).view(snapshot, actor, environment).data
      return { commit: false, value: data && sfPersonalViewSelectionAllowed(view, data, principal.id) ? digestSfValue({ actor, data }) : undefined }
    }, { signal: request.signal }).catch(() => undefined)
    const first = await read(), second = await read()
    return !!first && first === second && !request.signal.aborted && await host.revalidate(call)
  }
}
