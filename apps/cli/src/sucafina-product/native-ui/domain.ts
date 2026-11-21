import { createSfSummarySettingsHandlers } from "./summary-settings.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages, sidebarYear } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import {
  SF_DOMAIN_PAGES, projectSfDomainData, projectSfDomainVersions,
} from "./domain/projection"
import type { SfDomainCapability } from "./domain/projection"

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const
const selectionKeys = ["year", "month", "execYear", "executiveMonth", "opsMonth", "own", "q", "status", "filter", "owner", "risk", "priority", "tab"] as const
const actions: Readonly<Record<SfDomainCapability, readonly string[]>> = {
  CAP01: ["save-users", "save-benchmark"],
  CAP03: ["save-month", "save-revenue"],
  CAP04: ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount", "import"],
  CAP05: ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"],
  CAP09: ["save", "delete", "import", "save-milestone", "delete-milestone"],
  CAP10: ["save", "delete", "import", "save-milestone", "delete-milestone"],
  CAP13: ["save", "delete"],
  CAP14: ["save", "delete"],
  CAP15: ["save", "delete"],
  CAP16: ["save", "save-item", "delete-item", "save-sub", "delete-sub"],
}

type SfDomainReadOutcome =
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{
      kind: "ok"
      data: NonNullable<ReturnType<typeof projectSfDomainData>>
      versions: ReturnType<typeof projectSfDomainVersions>
      versionFence: string
    }>

// Pair each admitted capability with the exact frozen SfOperationId literal.
// The mapped union rejects a mismatched CAP-to-operation pairing at compile time.
type SfDomainPageRoute = {
  [Capability in SfDomainCapability]: readonly [Capability, `domain.page.${Capability}`]
}[SfDomainCapability]

const domainPageRoutes: readonly SfDomainPageRoute[] = [
  ["CAP01", "domain.page.CAP01"],
  ["CAP03", "domain.page.CAP03"],
  ["CAP04", "domain.page.CAP04"],
  ["CAP05", "domain.page.CAP05"],
  ["CAP09", "domain.page.CAP09"],
  ["CAP10", "domain.page.CAP10"],
  ["CAP13", "domain.page.CAP13"],
  ["CAP14", "domain.page.CAP14"],
  ["CAP15", "domain.page.CAP15"],
  ["CAP16", "domain.page.CAP16"],
]

const json = (body: object, status: number) =>
  Response.json(body, { status, headers })
const denied = () => json({ status: "denied" }, 403)
const unavailable = (reason: string) => json({ status: "unavailable", reason }, 503)
const needsInput = (reason: string) => json({ status: "needs-input", reason }, 400)
const stale = (reason: string) => json({ status: "stale", reason }, 409)

function mapContextFailure(result: Exclude<Awaited<ReturnType<SfNativeHostDependencies["readContext"]>>, { status: "ok" }>) {
  if (result.status === "unauthenticated") return json({ status: "unauthenticated" }, 401)
  if (result.status === "denied") return denied()
  return unavailable(result.reason)
}
function stampEqual(
  left: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>,
  right: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>,
) {
  return left.installationId === right.installationId && left.projectId === right.projectId &&
    left.hostId === right.hostId && left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion && left.accessRevision === right.accessRevision
}

function sourceSelection(url: URL): Record<string, string | number> | undefined {
  if (url.search.length > 4096 || [...url.searchParams.keys()].some(
    (key) => !selectionKeys.some((allowed) => allowed === key) ||
      url.searchParams.getAll(key).length !== 1 || (url.searchParams.get(key)?.length ?? 0) > 512,
  )) return undefined
  const selection: Record<string, string | number> = {}
  for (const key of selectionKeys) {
    const value = url.searchParams.get(key)
    if (value === null) continue
    if (["year", "month", "execYear", "executiveMonth", "opsMonth", "own"].includes(key)) {
      if (!/^\d+$/.test(value)) return undefined
      const parsed = Number(value)
      if (!Number.isSafeInteger(parsed) ||
        (key === "year" || key === "execYear" || key === "own") && (parsed < 2024 || parsed > 2027) ||
        (key === "month" || key === "executiveMonth" || key === "opsMonth") && (parsed < 1 || parsed > 12)) return undefined
      selection[key] = parsed
    } else selection[key] = value
  }
  return selection
}

/** Original Source roles/access inside the same durable dashboard snapshot. */
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

async function page(deps: SfNativeHostDependencies, request: Request, cap: SfDomainCapability): Promise<Response> {
  const pageName = SF_DOMAIN_PAGES[cap]
  const url = new URL(request.url)
  if (url.origin !== deps.origin || url.pathname !== `${deps.mount}/api/ui/pages/${cap}`) return denied()
  if (request.method !== "GET") return json({ status: "denied" }, 405)
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.has("origin") && request.headers.get("origin") !== deps.origin)) return denied()
  const selection = sourceSelection(url)
  if (!selection) return needsInput("invalid-page-selection")
  if (request.signal.aborted) return unavailable("request-cancelled")

  try {
    // F01 owns identity.prepare/bootstrap and the source context admission.
    const context = await deps.readContext(request)
    if (context.status !== "ok") return mapContextFailure(context)
    const destination = context.value.destinations.find((item) =>
      item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!destination?.canRead) return denied()
    if (!deps.application.domains.dashboard.some((item) => item.pages.includes(pageName)))
      return unavailable("domain-producer-missing")

    // Environment/directory resolution may do IO; it must never reenter the read lock.
    const environment = await deps.application.environment(request)
    const now = new Date(environment.at)
    if (!Number.isFinite(now.getTime())) return unavailable("domain-environment-invalid")
    const calendarYear = Math.min(2027, Math.max(2024, now.getFullYear()))
    const year = cap === "CAP01"
      ? (typeof selection.execYear === "number" ? selection.execYear
        : typeof selection.own === "number" ? selection.own : calendarYear)
      : typeof selection.year === "number" ? selection.year : sidebarYear()
    const month = cap === "CAP01"
      ? (typeof selection.executiveMonth === "number" ? selection.executiveMonth
        : typeof selection.month === "number" ? selection.month : now.getMonth() + 1)
      : typeof selection.month === "number" ? selection.month : now.getMonth() + 1
    const outcome = await deps.application.persistence.transaction<SfDomainReadOutcome>("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = authorizedActor(principal, snapshot.data)
      if (!actor || actor.id !== context.value.stamp.principalRef) {
        return { commit: false, value: { kind: "denied" } }
      }
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
      if (!dashboardPages(actor, summaries).includes(pageName)) {
        return { commit: false, value: { kind: "denied" } }
      }
      const contribution = deps.application.domains.dashboard.find((item) => item.pages.includes(pageName))
      if (!contribution) return { commit: false, value: { kind: "unavailable" } }

      const beforeAudit = snapshot.audit.length
      // The producer owns visibility and business calculations. A private snapshot
      // may only be passed to Domain.view inside this current auth transaction.
      const view = contribution.domain.view(
        { ...snapshot, data: publicSfData(snapshot.data) }, actor, environment,
      )
      const data = projectSfDomainData(cap, publicSfData(view.data), year, month)
      if (!data) return { commit: snapshot.audit.length > beforeAudit, value: { kind: "unavailable" } }
      const versions = projectSfDomainVersions(cap, view.versions, data)
      // This is a server-private fence, not a DTO. No actor, raw audit, role map,
      // full business snapshot, version.by or private data crosses the boundary.
      const versionFence = JSON.stringify(snapshot.versions)
      return {
        commit: snapshot.audit.length > beforeAudit,
        value: { kind: "ok", data, versions, versionFence },
      }
    }, { signal: request.signal })
    if (outcome.kind === "denied") return denied()
    if (outcome.kind === "unavailable") return unavailable("domain-view-unavailable")
    if (request.signal.aborted) return unavailable("request-cancelled")

    // Recheck after the lock. Any owner/grant switch or missing admission hides data.
    const refreshed = await deps.readContext(request)
    if (refreshed.status !== "ok") return mapContextFailure(refreshed)
    const freshDestination = refreshed.value.destinations.find((item) =>
      item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!freshDestination?.canRead) return denied()
    if (!stampEqual(refreshed.value.stamp, context.value.stamp)) {
      if (refreshed.value.stamp.principalRef !== context.value.stamp.principalRef ||
        refreshed.value.stamp.hostId !== context.value.stamp.hostId ||
        refreshed.value.stamp.installationId !== context.value.stamp.installationId ||
        refreshed.value.stamp.projectId !== context.value.stamp.projectId) return denied()
      return stale("domain-authority-changed")
    }

    // Source versions may change while preparing the response. Check current
    // snapshot independently (never nest this read in Domain.view's transaction).
    const fenceOk = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = authorizedActor(principal, snapshot.data)
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
      return { commit: false, value:
        !!actor && actor.id === refreshed.value.stamp.principalRef &&
        dashboardPages(actor, summaries).includes(pageName) &&
        JSON.stringify(snapshot.versions) === outcome.versionFence,
      }
    }, { signal: request.signal })
    if (!fenceOk) return stale("domain-source-changed")
    if (request.signal.aborted) return unavailable("request-cancelled")

    // F01 grants actions; a destination cannot add undocumented commands here.
    const listed = new Set(actions[cap])
    const allowedActionIds = freshDestination.allowedActionIds.filter((id) => listed.has(id))
    return json({
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
    return unavailable("domain-projection-unavailable")
  }
}

/**
 * The local entry producer keeps operator jobs/backups in a private closure.
 * SfNativeHostDependencies does NOT export a reader for that closure. Returning
 * a synthetic list or forwarding an internally constructed Request would be a
 * privacy and admission bypass. The I00 host owner must add the actual private
 * reader port before this projection can ever return an "ok" value.
 */
async function localAdmin(deps: SfNativeHostDependencies, request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (url.origin !== deps.origin || url.pathname !== `${deps.mount}/api/ui/projections/local-admin`) return denied()
  if (request.method !== "GET") return json({ status: "denied" }, 405)
  if (url.search || request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.has("origin") && request.headers.get("origin") !== deps.origin)) return denied()
  if (request.signal.aborted) return unavailable("request-cancelled")
  try {
    const context = await deps.readContext(request)
    if (context.status !== "ok") return mapContextFailure(context)
    if (context.value.authMode !== "local-operator") return denied()
    return unavailable("local-operator-reader-not-bound")
  } catch {
    return unavailable("local-operator-reader-unavailable")
  }
}

export function createSfDomainProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return [
    ...domainPageRoutes.map(([cap, operationId]) => ({
      operationId,
      handle: (request: Request) => page(deps, request, cap),
    })),
    { operationId: "projection.local-admin", handle: (request: Request) => localAdmin(deps, request) },
    ...createSfSummarySettingsHandlers(deps),
  ]
}
