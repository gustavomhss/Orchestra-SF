import { observeSfSummarySettingsHealth } from "./summary-settings.ts"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardBudget } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-people.ts"
import { DashboardOperations } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-operations.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { dashboardPages, procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { procurementQueueIntent } from "../../../../../modules/sucafina/Sucafinav1/product/procurement/queue-page.ts"
import { sfSourceIdentity } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

// Closed source identities, not a claim that a selected record will be readable.
const dashboard = [
  { id: "CAP01", page: "Executive Dashboard", domain: DashboardBudget.domain },
  { id: "CAP02", page: "Hot Topics & Actions", domain: DashboardPeople.domain },
  { id: "CAP03", page: "Budget Overview", domain: DashboardBudget.domain },
  { id: "CAP04", page: "OPEX Detail", domain: DashboardBudget.domain },
  { id: "CAP05", page: "CAPEX Projects", domain: DashboardBudget.domain },
  { id: "CAP06", page: "Headcount Overview", domain: DashboardPeople.domain },
  { id: "CAP07", page: "Team Structure", domain: DashboardPeople.domain },
  { id: "CAP08", page: "Talent Review", domain: DashboardPeople.domain },
  { id: "CAP11", page: "IT Operations", domain: DashboardOperations.domain },
  { id: "CAP12", page: "IT Security KPIs", domain: DashboardOperations.domain },
] as const
const procurement = [
  { id: "CAP24", page: "Dashboard" }, { id: "CAP25", page: "Requests" },
  { id: "CAP26", page: "My approvals" }, { id: "CAP27", page: "Suppliers" },
  { id: "CAP28", page: "Settings" },
] as const

/** Original producer infrastructure, admitted Request and source versions; no view or mutation is executed. */
export async function observeSfDomainHealth(deps: SfNativeHostDependencies, handlers: readonly SfProjectionHandler[], request: Request, stamp: SfContextStamp) {
  if (request.signal.aborted) return []
  const environment = await deps.application.environment(request)
  const now = new Date(environment.at)
  if (!Number.isFinite(now.getTime())) return []
  const installed = new Set(handlers.map((handler) => handler.operationId))
  const queue = await queueHealth(deps, request, stamp, now).catch(() => false)
  const read = async (surface: "dashboard" | "procurement") => deps.application.persistence.transaction(surface, async (snapshot) => {
    const principal = await deps.application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
    if (!principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef || request.signal.aborted ||
      !snapshot.data || !snapshot.versions || !Array.isArray(snapshot.audit)) return { commit: false, value: undefined }
    const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
    const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
    const pages = surface === "dashboard" ? dashboardPages(actor, summaries) : procurementKeys(actor)
    const queueSource = surface === "procurement" && queue ? (() => {
      try { return !!sfSourceIdentity(snapshot, "procurement-request-selection", "all") } catch { return false }
    })() : false
    const sources = surface === "dashboard" ? dashboard.flatMap((spec) => {
      const operationId = `domain.page.${spec.id}` as const
      if (!installed.has(operationId) || !pages.includes(spec.page) ||
        deps.application.domains.dashboard.find((item) => item.pages.includes(spec.page))?.domain !== spec.domain) return []
      return [operationId]
    }) : procurement.flatMap((spec) => {
      const operationId = `domain.page.${spec.id}` as const
      if (!installed.has(operationId) || !pages.includes(spec.page) || spec.id === "CAP28" && !roles.includes("admin") ||
        (spec.id === "CAP25" || spec.id === "CAP26") && !queueSource ||
        deps.application.domains.procurement.find((item) => item.pages.includes(spec.page))?.domain !== ProcurementModule.domain) return []
      return [operationId]
    })
    return { commit: false, value: { sources, fence: JSON.stringify(snapshot.versions), actor: digestSfValue(actor),
      members: surface === "dashboard" && roles.includes("admin") && pages.includes("Talent Review") && Array.isArray(snapshot.data.members) } }
  }, { signal: request.signal })
  const result = await Promise.allSettled((["dashboard", "procurement"] as const).map(async (surface) => {
    const first = await read(surface)
    if (!first || request.signal.aborted) return []
    const second = await read(surface)
    if (!second || first.fence !== second.fence || first.actor !== second.actor ||
      digestSfValue(first.sources) !== digestSfValue(second.sources) || request.signal.aborted) return []
    const queueCurrent = surface !== "procurement" || !queue || await queueHealth(deps, request, stamp, now).catch(() => false)
    const observed = second.sources.filter((id) => queueCurrent || id !== "domain.page.CAP25" && id !== "domain.page.CAP26")
      .map((operationId) => ({ operationId, state: "ready" as const, reason: null, operational: true as const }))
    if (surface !== "dashboard" || !first.members || !second.members) return observed
    const id = Object.keys(SfOperationRegistry).find((key) => key === "files.export.members")
    if (!id || !isOperation(id)) return observed
    // Load the exact download implementation/dependency, without generating a workbook or recording a private read.
    const available = await Promise.all([import("../../../../../modules/sucafina/Sucafinav1/runtime/workbooks.ts"), import("exceljs")]).catch(() => undefined)
    if (!available || typeof available[0].exportMembers !== "function" || typeof available[1].Workbook !== "function" || request.signal.aborted) return observed
    const final = await read("dashboard")
    if (!final || !final.members || final.fence !== second.fence || final.actor !== second.actor || request.signal.aborted) return observed
    return [...observed, { operationId: id, state: "ready" as const, reason: null, operational: true as const }]
  }))
  const summaries = await observeSfSummarySettingsHealth(deps, handlers, request, stamp)
  return [...result.flatMap((item): readonly SfOperationAvailability[] => item.status === "fulfilled" ? item.value : []), ...summaries]
}

function isOperation(value: string): value is SfOperationId {
  return Object.hasOwn(SfOperationRegistry, value)
}

/** Queue-backed pages also require the original sf_request_read admission. */
async function queueHealth(deps: SfNativeHostDependencies, request: Request, stamp: SfContextStamp, now: Date) {
  const runtime = deps.runtime()
  if (!runtime?.productView || !deps.application.productView || request.signal.aborted) return false
  const year = now.getUTCFullYear()
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) return false
  const period = { start: `${String(year).padStart(4, "0")}-01-01`, end: `${String(year).padStart(4, "0")}-12-31` }
  const digest = digestSfValue(procurementQueueIntent(period))
  const admitted = await runtime.ui.admit(request, "sf_request_read", digest)
  if (admitted.status !== "ok") return false
  try {
    const binding = admitted.value.binding
    return binding.installationId === stamp.installationId && binding.projectId === stamp.projectId &&
      binding.principalRef === stamp.principalRef && binding.policyVersion === stamp.policyVersion &&
      binding.accessRevision === stamp.accessRevision && await runtime.ui.validate(admitted.value, "sf_request_read", digest) &&
      !request.signal.aborted && await runtime.ui.revalidate(admitted.value)
  } finally { runtime.ui.finish(admitted.value) }
}
