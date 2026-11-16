import { Schema } from "effect"
import { SfOperations } from "@orchestra/schema/sucafina/operations"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { SF_OPERATIONS_PAGES, SF_OPERATIONS_ACTIONS, projectSfOperationsData, projectSfOperationsVersions } from "./operations/projection.ts"
import type { SfOperationsCapability } from "./operations/projection.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
const response = (body: object, status: number) => Response.json(body, { status, headers })
const denied = () => response({ status: "denied" }, 403)
const unavailable = (reason: string) => response({ status: "unavailable", reason }, 503)
const invalid = () => response({ status: "needs-input", reason: "invalid-page-selection" }, 400)
const stale = (reason: string) => response({ status: "stale", reason }, 409)

function actorFor(principal: Awaited<ReturnType<SfNativeHostDependencies["application"]["authenticate"]>>, data: Record<string, unknown>): Actor | undefined {
  if (!principal?.id || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((item) => item.surface === "dashboard").map((item) => item.role)
  const access = object(object(data.access)[principal.id])
  return { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
}

function selection(url: URL, cap: SfOperationsCapability) {
  const allowed = cap === "CAP11" ? ["year", "own", "opsYear", "month", "operationsMonth"] : ["year", "own", "secYear", "month", "securityMonth"]
  if (url.search.length > 4096 || [...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return undefined
  const entries = [...url.searchParams.entries()]
  if (entries.some(([key, value]) => !(key.toLowerCase().includes("month") ? /^(?:[1-9]|1[0-2])$/ : /^202[4-7]$/).test(value))) return undefined
  const value = Object.fromEntries(entries.map(([key, value]) => [key, Number(value)]))
  if (!(cap === "CAP11" ? Schema.is(SfOperations.operations["domain.page.CAP11"].input)(value)
    : Schema.is(SfOperations.operations["domain.page.CAP12"].input)(value))) return undefined
  return value
}

async function page(deps: SfNativeHostDependencies, request: Request, cap: SfOperationsCapability): Promise<Response> {
  const url = new URL(request.url)
  const pageName = SF_OPERATIONS_PAGES[cap]
  if (url.origin !== deps.origin || url.pathname !== `${deps.mount}/api/ui/pages/${cap}` || url.username || url.password || url.hash ||
    request.headers.get("sec-fetch-site") === "cross-site" || request.headers.has("origin") && request.headers.get("origin") !== deps.origin) return denied()
  if (request.method !== "GET") return response({ status: "denied" }, 405)
  if (request.body || request.headers.has("transfer-encoding") || request.headers.has("content-length") && request.headers.get("content-length") !== "0") return invalid()
  const selected = selection(url, cap)
  if (!selected) return invalid()
  if (request.signal.aborted) return unavailable("request-cancelled")
  try {
    const context = await deps.readContext(request)
    if (context.status !== "ok") return context.status === "unauthenticated" ? response({ status: "unauthenticated" }, 401)
      : context.status === "denied" ? denied() : unavailable(context.reason)
    const destination = context.value.destinations.find((item) => item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!destination?.canRead) return denied()
    const source = deps.application.domains.dashboard.find((item) => item.pages.includes(pageName))
    if (!source) return unavailable("domain-producer-missing")
    const environment = await deps.application.environment(request)
    const now = new Date(environment.at)
    if (!Number.isFinite(now.getTime())) return unavailable("domain-environment-invalid")
    const year = selected[cap === "CAP11" ? "opsYear" : "secYear"] ?? selected.own ?? Math.min(2027, Math.max(2024, now.getFullYear()))
    const month = selected[cap === "CAP11" ? "operationsMonth" : "securityMonth"] ?? selected.month ?? now.getMonth() + 1
    const outcome = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      const actor = actorFor(principal, snapshot.data)
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
      if (!actor || actor.id !== context.value.stamp.principalRef || !dashboardPages(actor, summaries).includes(pageName) || request.signal.aborted)
        return { commit: false, value: undefined }
      const beforeAudit = snapshot.audit.length
      const view = source.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
      const data = projectSfOperationsData(cap, publicSfData(view.data), year, month)
      return { commit: snapshot.audit.length !== beforeAudit, value: { data, versions: projectSfOperationsVersions(cap, view.versions, data, year, month),
        actor: digestSfValue(actor), versionFence: JSON.stringify(snapshot.versions),
        canWrite: actor.canWrite && (actor.roles.includes("admin") || actor.roles.includes("contributor") &&
          actor.assigned?.includes(cap === "CAP11" ? "Operations" : "security") === true) } }
    }, { signal: request.signal })
    if (!outcome) return denied()
    const current = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      const actor = actorFor(principal, snapshot.data)
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
      return { commit: false, value: !!actor && actor.id === context.value.stamp.principalRef &&
        dashboardPages(actor, summaries).includes(pageName) && digestSfValue(actor) === outcome.actor &&
        JSON.stringify(snapshot.versions) === outcome.versionFence &&
        deps.application.domains.dashboard.find((item) => item.pages.includes(pageName)) === source }
    }, { signal: request.signal })
    if (!current) return stale("domain-source-changed")
    const refreshed = await deps.readContext(request)
    if (refreshed.status !== "ok") return refreshed.status === "unauthenticated" ? response({ status: "unauthenticated" }, 401)
      : refreshed.status === "denied" ? denied() : unavailable(refreshed.reason)
    if (digestSfValue(context.value.stamp) !== digestSfValue(refreshed.value.stamp)) return stale("domain-authority-changed")
    const fresh = refreshed.value.destinations.find((item) => item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!fresh?.canRead || digestSfValue(fresh.allowedActionIds) !== digestSfValue(destination.allowedActionIds) ||
      deps.application.domains.dashboard.find((item) => item.pages.includes(pageName)) !== source) return denied()
    if (request.signal.aborted) return unavailable("request-cancelled")
    const actions: readonly string[] = SF_OPERATIONS_ACTIONS[cap]
    const output = { status: "ok", context: refreshed.value.stamp, value: { capabilityId: cap,
      selection: { ...selected, year, month }, data: outcome.data, versions: outcome.versions,
      allowedActionIds: outcome.canWrite ? fresh.allowedActionIds.filter((id) => actions.includes(id)) : [] } }
    if (!(cap === "CAP11" ? Schema.is(SfOperations.operations["domain.page.CAP11"].output)(output)
      : Schema.is(SfOperations.operations["domain.page.CAP12"].output)(output))) return unavailable("operations-projection-invalid")
    return response(output, 200)
  } catch {
    return unavailable("operations-projection-unavailable")
  }
}

export function createSfOperationsProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return [
    { operationId: "domain.page.CAP11", handle: (request) => page(deps, request, "CAP11") },
    { operationId: "domain.page.CAP12", handle: (request) => page(deps, request, "CAP12") },
  ]
}
