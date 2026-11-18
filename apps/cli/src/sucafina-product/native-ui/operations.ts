import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import {
  SF_OPERATIONS_ACTIONS, SF_OPERATIONS_PAGES,
  projectSfOperationsData, projectSfOperationsVersions,
} from "./operations/projection"
import type { SfOperationsCapability } from "./operations/projection"

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const
const reply = (body: object, status: number) => Response.json(body, { status, headers })
const denied = () => reply({ status: "denied" }, 403)
const unavailable = (reason: string) => reply({ status: "unavailable", reason }, 503)
const stale = (reason: string) => reply({ status: "stale", reason }, 409)
const needsInput = (reason: string) => reply({ status: "needs-input", reason }, 400)

function mapContextFailure(
  result: Exclude<Awaited<ReturnType<SfNativeHostDependencies["readContext"]>>, { status: "ok" }>,
) {
  if (result.status === "unauthenticated") return reply({ status: "unauthenticated" }, 401)
  if (result.status === "denied") return denied()
  return unavailable(result.reason)
}
function sameStamp(
  left: Readonly<{
    installationId: string; projectId: string; hostId: string; principalRef: string
    policyVersion: string; accessRevision: string
  }>,
  right: Readonly<{
    installationId: string; projectId: string; hostId: string; principalRef: string
    policyVersion: string; accessRevision: string
  }>,
) {
  return left.installationId === right.installationId &&
    left.projectId === right.projectId &&
    left.hostId === right.hostId &&
    left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion &&
    left.accessRevision === right.accessRevision
}
function querySelection(cap: SfOperationsCapability, url: URL) {
  const allowed = cap === "CAP11"
    ? ["year", "own", "opsYear", "month", "operationsMonth"]
    : ["year", "own", "secYear", "month", "securityMonth"]
  if (url.search.length > 4096 || /%(?![a-f0-9]{2})/i.test(url.search) ||
    [...url.searchParams.keys()].some((key) =>
      !allowed.includes(key) || url.searchParams.getAll(key).length !== 1))
    return undefined
  const selection: Record<string, number> = {}
  for (const key of allowed) {
    const value = url.searchParams.get(key)
    if (value === null) continue
    if (!/^\d{1,4}$/.test(value)) return undefined
    const numeric = Number(value)
    const isMonth = key === "month" || key === "operationsMonth" || key === "securityMonth"
    if (!Number.isSafeInteger(numeric) ||
      (isMonth ? numeric < 1 || numeric > 12 : numeric < 2024 || numeric > 2027))
      return undefined
    selection[key] = numeric
  }
  return selection
}

/** Read only the original dashboard role map, current principal, and assigned scopes. */
function authorizedActor(
  principal: Awaited<ReturnType<SfNativeHostDependencies["application"]["authenticate"]>>,
  data: Record<string, unknown>,
): Actor | undefined {
  if (!principal?.id || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
  const access = object(object(data.access)[principal.id])
  return {
    id: principal.id,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    roles,
    assigned: Array.isArray(access.assigned)
      ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
    domains: Array.isArray(access.domains)
      ? access.domains.filter((entry): entry is string => typeof entry === "string") : [],
  }
}
function authorizedPage(
  actor: Actor | undefined,
  data: Record<string, unknown>,
  page: string,
) {
  if (!actor) return false
  const summaries = Array.isArray(data.summaries)
    ? data.summaries.filter((entry): entry is string => typeof entry === "string")
    : []
  return dashboardPages(actor, summaries).includes(page)
}

async function page(
  deps: SfNativeHostDependencies, request: Request, cap: SfOperationsCapability,
): Promise<Response> {
  const pageName = SF_OPERATIONS_PAGES[cap]
  const url = new URL(request.url)
  if (url.origin !== deps.origin || url.pathname !== deps.mount + "/api/ui/pages/" + cap)
    return denied()
  if (request.method !== "GET") return reply({ status: "denied" }, 405)
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.has("origin") && request.headers.get("origin") !== deps.origin)
    return denied()
  const selection = querySelection(cap, url)
  if (!selection) return needsInput("invalid-operations-selection")
  if (request.signal.aborted) return unavailable("request-cancelled")

  try {
    // readContext owns original identity.prepare/bootstrap and admission.
    // Never infer an SF grant from a schema, capability ID, or a browser flag.
    const context = await deps.readContext(request)
    if (context.status !== "ok") return mapContextFailure(context)
    const destination = context.value.destinations.find((entry) =>
      entry.capabilityId === cap && entry.surface === "dashboard" &&
      entry.page === pageName)
    if (!destination?.canRead) return denied()
    const contribution = deps.application.domains.dashboard.find((entry) =>
      entry.pages.includes(pageName))
    if (!contribution) return unavailable("domain-producer-missing")

    // Resolve async environment OUTSIDE the domain's durable transaction lock.
    const environment = await deps.application.environment(request)
    const now = new Date(environment.at)
    if (!Number.isFinite(now.getTime())) return unavailable("domain-environment-invalid")
    // The source renderer's opsYear/secYear aliases override 'own'; sidebar
    // 'year' is not the chosen operations/security year.
    const year = selection[cap === "CAP11" ? "opsYear" : "secYear"] ??
      selection.own ?? Math.min(2027, Math.max(2024, now.getFullYear()))
    const month = selection[cap === "CAP11" ? "operationsMonth" : "securityMonth"] ??
      selection.month ?? now.getMonth() + 1

    const outcome = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = authorizedActor(principal, snapshot.data)
      if (!actor || !authorizedPage(actor, snapshot.data, pageName) ||
        actor.id !== context.value.stamp.principalRef)
        return { commit: false, value: { kind: "denied" as const } }
      const beforeAudit = snapshot.audit.length
      const view = contribution.domain.view(
        { ...snapshot, data: publicSfData(snapshot.data) }, actor, environment,
      )
      // The producer returns domain-scoped data/versions already filtered by
      // its role rules. Restrict that further to the capability fieldset.
      const data = projectSfOperationsData(cap, publicSfData(view.data), year, month)
      const versions = projectSfOperationsVersions(cap, view.versions, data, year, month)
      return {
        commit: snapshot.audit.length > beforeAudit,
        value: {
          kind: "ok" as const, data, versions,
          versionFence: JSON.stringify(snapshot.versions),
        },
      }
    }, { signal: request.signal })
    if (outcome.kind === "denied") return denied()
    if (request.signal.aborted) return unavailable("request-cancelled")

    // Current access and source version are checked again after projection.
    // A changed principal/owner is denied, a changed current source is stale.
    const refreshed = await deps.readContext(request)
    if (refreshed.status !== "ok") return mapContextFailure(refreshed)
    const currentDestination = refreshed.value.destinations.find((entry) =>
      entry.capabilityId === cap && entry.surface === "dashboard" &&
      entry.page === pageName)
    if (!currentDestination?.canRead) return denied()
    if (!sameStamp(context.value.stamp, refreshed.value.stamp)) {
      if (context.value.stamp.principalRef !== refreshed.value.stamp.principalRef ||
        context.value.stamp.hostId !== refreshed.value.stamp.hostId ||
        context.value.stamp.projectId !== refreshed.value.stamp.projectId ||
        context.value.stamp.installationId !== refreshed.value.stamp.installationId)
        return denied()
      return stale("domain-authority-changed")
    }
    const versionFence = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = authorizedActor(principal, snapshot.data)
      if (!authorizedPage(actor, snapshot.data, pageName) ||
        actor?.id !== refreshed.value.stamp.principalRef)
        return { commit: false, value: "denied" as const }
      return {
        commit: false,
        value: JSON.stringify(snapshot.versions) === outcome.versionFence
          ? "current" as const : "stale" as const,
      }
    }, { signal: request.signal })
    if (versionFence === "denied") return denied()
    if (versionFence !== "current") return stale("domain-source-changed")
    if (request.signal.aborted) return unavailable("request-cancelled")

    const admitted = new Set(SF_OPERATIONS_ACTIONS[cap] as readonly string[])
    const allowedActionIds = currentDestination.allowedActionIds.filter((name) =>
      admitted.has(name))
    return reply({
      status: "ok",
      context: refreshed.value.stamp,
      value: {
        capabilityId: cap,
        selection: { ...selection, year, month },
        data: outcome.data,
        versions: outcome.versions,
        allowedActionIds,
      },
    }, 200)
  } catch {
    // No HTML error, private exception, snapshot or actor details cross this seam.
    return unavailable("domain-projection-unavailable")
  }
}

/** Only CAP11/12 HTML projections. The 14 commands keep their original Request. */
export function createSfOperationsProjectionHandlers(
  deps: SfNativeHostDependencies,
): readonly SfProjectionHandler[] {
  return [
    { operationId: "domain.page.CAP11", handle: (request) => page(deps, request, "CAP11") },
    { operationId: "domain.page.CAP12", handle: (request) => page(deps, request, "CAP12") },
  ]
}
