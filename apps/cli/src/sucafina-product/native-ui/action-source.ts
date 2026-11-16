import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardBudget, budgetAdminCanWrite, budgetCanEditAnyLine } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts"
import { DashboardPeople, peopleCanWrite } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-people.ts"
import { DashboardOperations, operationsCanWrite } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-operations.ts"
import { DashboardPortfolio, portfolioCanWrite, portfolioCanImport } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { PlannerModule, plannerAdminSourceAvailable, plannerAdminImportAvailable, plannerCurrentPageActions } from "../../../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import { ProcurementModule, procurementCanCreateRequest, procurementCurrentRequestActions, procurementCanManageSettings, procurementSupplierRoleAllows } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { SF_OPERATIONS_ACTIONS } from "./operations/projection.ts"
import { SF_PEOPLE_ACTIONS } from "./people.ts"
import type { SfLiveAdmittedPage } from "./live-context.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

type Source = Readonly<{ surface: SfLiveAdmittedPage["surface"]; page: string; id: string; domain: object;
  actions: (actor: Actor, snapshot: Snapshot, bankKey: Uint8Array | undefined) => readonly string[] }>
const sources: readonly Source[] = [
  { surface: "dashboard", page: "Executive Dashboard", id: "CAP01", domain: DashboardBudget.domain, actions: (a) => budgetAdminCanWrite(a) ? ["save-users", "save-benchmark"] : [] },
  { surface: "dashboard", page: "Budget Overview", id: "CAP03", domain: DashboardBudget.domain, actions: (a) => budgetAdminCanWrite(a) ? ["save-month", "save-revenue"] : [] },
  { surface: "dashboard", page: "OPEX Detail", id: "CAP04", domain: DashboardBudget.domain, actions: (a, s) => budgetAdminCanWrite(a) || budgetCanEditAnyLine(s, a, "opexOwners") ? ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount", ...(budgetAdminCanWrite(a) ? ["import"] : [])] : [] },
  { surface: "dashboard", page: "CAPEX Projects", id: "CAP05", domain: DashboardBudget.domain, actions: (a, s) => budgetAdminCanWrite(a) || budgetCanEditAnyLine(s, a, "capexProjects") ? ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"] : [] },
  { surface: "dashboard", page: "Hot Topics & Actions", id: "CAP02", domain: DashboardPeople.domain, actions: (a) => peopleCanWrite(a, "Hot Topics & Actions") ? SF_PEOPLE_ACTIONS.CAP02 : [] },
  { surface: "dashboard", page: "Team Structure", id: "CAP07", domain: DashboardPeople.domain, actions: (a) => peopleCanWrite(a, "Team Structure") ? SF_PEOPLE_ACTIONS.CAP07 : [] },
  { surface: "dashboard", page: "Talent Review", id: "CAP08", domain: DashboardPeople.domain, actions: (a) => peopleCanWrite(a, "Talent Review") ? SF_PEOPLE_ACTIONS.CAP08 : [] },
  { surface: "dashboard", page: "IT Operations", id: "CAP11", domain: DashboardOperations.domain, actions: (a) => operationsCanWrite(a, "IT Operations") ? SF_OPERATIONS_ACTIONS.CAP11 : [] },
  { surface: "dashboard", page: "IT Security KPIs", id: "CAP12", domain: DashboardOperations.domain, actions: (a) => operationsCanWrite(a, "IT Security KPIs") ? SF_OPERATIONS_ACTIONS.CAP12 : [] },
  { surface: "dashboard", page: "All Projects", id: "CAP10", domain: DashboardPortfolio.domain, actions: (a) => portfolioCanWrite(a, "projects") ? ["save", "delete", ...(portfolioCanImport(a, "projects") ? ["import"] : []), "save-milestone", "delete-milestone"] : [] },
  { surface: "dashboard", page: "IT Risks", id: "CAP13", domain: DashboardPortfolio.domain, actions: (a) => portfolioCanWrite(a, "risks") ? ["save", "delete"] : [] },
  { surface: "dashboard", page: "Vendor Contracts", id: "CAP14", domain: DashboardPortfolio.domain, actions: (a) => portfolioCanWrite(a, "contracts") ? ["save", "delete"] : [] },
  { surface: "dashboard", page: "Stakeholder Management", id: "CAP15", domain: DashboardPortfolio.domain, actions: (a) => portfolioCanWrite(a, "stakeholders") ? ["save", "delete"] : [] },
  { surface: "dashboard", page: "IT Performance Contract", id: "CAP16", domain: DashboardPortfolio.domain, actions: (a) => portfolioCanWrite(a, "itperf") ? ["save", "save-item", "delete-item", "save-sub", "delete-sub"] : [] },
  { surface: "planner", page: "Overview", id: "CAP17", domain: PlannerModule.domain, actions: (a, s) => plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [] },
  { surface: "planner", page: "Entities & allocations", id: "CAP21", domain: PlannerModule.domain, actions: (a, s) => plannerAdminSourceAvailable(s, a) ? ["save", "delete", "common", ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] : [] },
  { surface: "planner", page: "OPEX", id: "CAP18", domain: PlannerModule.domain, actions: (a, s) => [...plannerCurrentPageActions(s, a, "OPEX"), ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] },
  { surface: "planner", page: "CAPEX", id: "CAP19", domain: PlannerModule.domain, actions: (a, s) => [...plannerCurrentPageActions(s, a, "CAPEX"), ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] },
  { surface: "planner", page: "Headcount", id: "CAP20", domain: PlannerModule.domain, actions: (a, s) => [...plannerCurrentPageActions(s, a, "Headcount"), ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] },
  { surface: "planner", page: "FX rates", id: "CAP22", domain: PlannerModule.domain, actions: (a, s) => [...plannerCurrentPageActions(s, a, "FX rates"), ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] },
  { surface: "planner", page: "Versions", id: "CAP23", domain: PlannerModule.domain, actions: (a, s) => plannerAdminSourceAvailable(s, a) ? ["save", "copy", "official", "lock", "unlock", "delete", ...(plannerAdminImportAvailable(s, a) ? ["import-workbook"] : [])] : [] },
  { surface: "procurement", page: "Requests", id: "CAP25", domain: ProcurementModule.domain, actions: (a, s) => [...(procurementCanCreateRequest(a) ? ["create"] : []), ...procurementCurrentRequestActions(s, a)] },
  { surface: "procurement", page: "My approvals", id: "CAP26", domain: ProcurementModule.domain, actions: (a, s) => procurementCurrentRequestActions(s, a).filter((id) => id === "approve" || id === "reject") },
  { surface: "procurement", page: "Suppliers", id: "CAP27", domain: ProcurementModule.domain, actions: (a, _s, key) => ["create", "save", "activate", "block", "inactivate", "delete", "change-bank"].filter((action) => procurementSupplierRoleAllows(a, action) && (action !== "change-bank" || key?.length === 32)) },
  { surface: "procurement", page: "Settings", id: "CAP28", domain: ProcurementModule.domain, actions: (a) => procurementCanManageSettings(a) ? ["save", "reset"] : [] },
]

/** Re-observe producer authority each time. No actor/grant is retained between calls. */
export function createSfActionSource(deps: SfNativeHostDependencies, handlers: readonly SfProjectionHandler[]) {
  const installed = new Set(handlers.map((handler) => handler.operationId))
  const observe = async (request: Request, stamp: SfContextStamp, pages: readonly SfLiveAdmittedPage[], strict: boolean) => {
    const environment = await deps.application.environment(request)
    const work = (["dashboard", "planner", "procurement"] as const).map(async (surface) => {
      const selected = pages.filter((item) => item.surface === surface)
      if (!selected.length) return []
      return deps.application.persistence.transaction(surface, async (snapshot) => {
        const principal = await deps.application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
        if (!principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef || request.signal.aborted) {
          if (strict) throw new Error("SF_ACTION_AUTHORITY_UNAVAILABLE")
          return { commit: false, value: [] }
        }
        const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
        const access = object(object(snapshot.data.access)[principal.id])
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
        const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
        const readable = surface === "dashboard" ? dashboardPages(actor, summaries) : surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
        return { commit: false, value: selected.flatMap((item) => {
          if (!readable.includes(item.page)) {
            if (strict) throw new Error("SF_ACTION_PAGE_AUTHORITY_CHANGED")
            return []
          }
          const actual = deps.application.domains[surface].find((entry) => entry.pages.includes(item.page))
          if (!actual) {
            if (strict) throw new Error("SF_ACTION_PRODUCER_UNAVAILABLE")
            return []
          }
          const spec = sources.find((entry) => entry.surface === surface && entry.page === item.page)
          if (!spec) return [{ ...item, allowedActionIds: [] as readonly string[] }]
          const pageId = `domain.page.${spec.id}`
          if (actual.domain !== spec.domain || !isOperation(pageId) || !installed.has(pageId)) {
            if (strict && actual.domain !== spec.domain) throw new Error("SF_ACTION_PRODUCER_CHANGED")
            return [{ ...item, allowedActionIds: [] as readonly string[] }]
          }
          // The original POST refuses every command without the actor's directory name.
          if (!environment.directory.some((person) => person.id === actor.id && person.name.trim()))
            return [{ ...item, allowedActionIds: [] as readonly string[] }]
          return [{ ...item, allowedActionIds: spec.actions(actor, snapshot, environment.bankKey) }]
        }) }
      }, { signal: request.signal })
    })
    const groups = strict ? await Promise.all(work) : (await Promise.allSettled(work)).flatMap((item) => item.status === "fulfilled" ? [item.value] : [])
    if (request.signal.aborted) throw new Error("SF_ACTION_REQUEST_CANCELLED")
    return groups.flat()
  }
  return {
    actions: (request: Request, stamp: SfContextStamp, pages: readonly SfLiveAdmittedPage[]) => observe(request, stamp, pages, true),
    operational: async (request: Request, stamp: SfContextStamp) => {
      const pages = sources.map((source) => ({ surface: source.surface, page: source.page }))
      const observed = await observe(request, stamp, pages, false)
      return observed.flatMap((item) => {
        const source = sources.find((entry) => entry.surface === item.surface && entry.page === item.page)
        if (!source) return []
        return item.allowedActionIds.flatMap((action) => {
          const id = `domain.command.${source.id}.${action}`
          if (!isOperation(id)) return []
          const meta = SfOperationRegistry[id]
          if (meta.method !== "POST" || meta.pathTemplate !== `{mount}/${item.surface}` || !("fixedBodyDiscriminator" in meta) ||
            object(meta.fixedBodyDiscriminator).page !== item.page || object(meta.fixedBodyDiscriminator).action !== action) return []
          return [{ operationId: id, state: "ready" as const, reason: null, operational: true as const }]
        })
      })
    },
  }
}

function isOperation(value: string): value is SfOperationId {
  return Object.hasOwn(SfOperationRegistry, value)
}
