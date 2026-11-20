import { Option, Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { configure, roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardPortfolio } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { readRequestBody, RequestBodyError } from "../../../../../modules/sucafina/Sucafinav1/runtime/request-body.ts"
import { DASHBOARD_PAGES, dashboardPages } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

const page = "IT Risks"
const readId = "local-admin.summary-read"
const writeId = "local-admin.summary-configure"
const stampKeys = ["installationId", "projectId", "hostId", "principalRef", "policyVersion", "accessRevision"] as const
type Settings = Readonly<{ pages: readonly string[]; availablePages: typeof DASHBOARD_PAGES; version: number; canConfigure: boolean }>
type Source = Readonly<{ settings: Settings; actor: Actor }>
const json = (value: unknown, status: number) => Response.json(value, { status, headers: {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin",
} })
const denied = () => json({ status: "denied" }, 403)
const unavailable = (reason = "summary-settings-unavailable") => json({ status: "unavailable", reason }, 503)
const stale = () => json({ status: "stale", reason: "summary-settings-changed" }, 409)
const sameStamp = (a: SfContextStamp, b: SfContextStamp) => stampKeys.every((key) => a[key] === b[key])
const foreignOwner = (a: SfContextStamp, b: SfContextStamp) =>
  (["installationId", "projectId", "hostId", "principalRef"] as const).some((key) => a[key] !== b[key])
const contextFailure = (status: string) => status === "unauthenticated" ? json({ status }, 401) :
  status === "denied" ? denied() : unavailable("summary-authority-unavailable")

function settings(snapshot: Snapshot, actor: Actor, environment: Environment): Settings | undefined {
  const pages = snapshot.data.summaries === undefined ? [] : snapshot.data.summaries
  const current = snapshot.versions["config:summaries"]
  const version = current === undefined ? 0 : current.version
  if (!Array.isArray(pages) || pages.length > DASHBOARD_PAGES.length ||
      pages.some((value) => typeof value !== "string" || !(DASHBOARD_PAGES as readonly string[]).includes(value)) ||
      new Set(pages).size !== pages.length || !Number.isSafeInteger(version) || version < 0 ||
      current !== undefined && typeof current.by !== "string") return
  return { pages: [...pages], availablePages: DASHBOARD_PAGES, version,
    canConfigure: actor.canWrite && environment.directory.some((person) => person.id === actor.id && person.name.trim()) }
}

/** Original application ACL and contribution binding; no caller supplies an actor, page or action. */
async function source(deps: SfNativeHostDependencies, request: Request, snapshot: Snapshot, environment: Environment,
  stamp: SfContextStamp): Promise<Source | Response> {
  const principal = await deps.application.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
  if (!principal?.id || principal.id.startsWith("local:")) return json({ status: "unauthenticated" }, 401)
  if (principal.id !== stamp.principalRef) return denied()
  const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
  const access = object(object(snapshot.data.access)[principal.id])
  const actor: Actor = { id: principal.id, roles,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  if (!roles.includes("admin")) return denied()
  const value = settings(snapshot, actor, environment)
  if (!value) return unavailable("summary-source-invalid")
  if (!dashboardPages(actor, [...value.pages]).includes(page)) return denied()
  if (deps.application.domains.dashboard.find((item) => item.pages.includes(page))?.domain !== DashboardPortfolio.domain)
    return unavailable("summary-command-source-unavailable")
  return { settings: value, actor }
}

async function current(deps: SfNativeHostDependencies, runtime: NonNullable<ReturnType<SfNativeHostDependencies["runtime"]>>,
  request: Request, stamp: SfContextStamp): Promise<Response | undefined> {
  if (request.signal.aborted || deps.runtime() !== runtime) return unavailable("summary-owner-unavailable")
  // This original authority port uses readonly child transactions/currentSnapshots.
  // Unlike readContext(), it does not recurse through operational discovery.
  const admission = await runtime.readContextAdmission(request)
  if (request.signal.aborted || deps.runtime() !== runtime) return unavailable("summary-owner-unavailable")
  if (admission.status !== "ok") return contextFailure(admission.status)
  if (!sameStamp(admission.stamp, stamp)) return foreignOwner(admission.stamp, stamp) ? denied() : stale()
  if (!admission.pages.some((item) => item.surface === "dashboard" && item.page === page)) return denied()
}

async function snapshot(deps: SfNativeHostDependencies, request: Request, stamp: SfContextStamp,
  environment: Environment): Promise<Source | Response> {
  const runtime = deps.runtime()
  if (!runtime) return unavailable()
  return deps.application.persistence.transaction<Source | Response>("dashboard", async (value) => {
    const before = await current(deps, runtime, request, stamp)
    if (before) return { commit: false, value: before }
    const original = await source(deps, request, value, environment, stamp)
    if (original instanceof Response) return { commit: false, value: original }
    const after = await current(deps, runtime, request, stamp)
    return { commit: false, value: after ?? original }
  }, { signal: request.signal })
}

function ingress(deps: SfNativeHostDependencies, request: Request, write: boolean): Response | undefined {
  const url = new URL(request.url)
  const path = write ? "configure-summaries" : "summary-settings"
  if (url.origin !== deps.origin || url.pathname !== deps.mount + "/api/ui/local-admin/" + path ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (request.headers.has("origin") && request.headers.get("origin") !== deps.origin)) return denied()
  if (request.method !== (write ? "POST" : "GET")) return json({ status: "needs-input", reason: "method-not-allowed" }, 405)
  if (url.search || url.username || url.password || url.hash)
    return json({ status: "needs-input", reason: "summary-selection-invalid" }, 400)
  if (request.signal.aborted) return unavailable("request-cancelled")
}

async function read(deps: SfNativeHostDependencies, request: Request): Promise<Response> {
  const invalid = ingress(deps, request, false)
  if (invalid) return invalid
  try {
    const context = await deps.readContext(request)
    if (context.status !== "ok") return contextFailure(context.status)
    if (context.value.authMode !== "local-operator") return denied()
    const environment = await deps.application.environment(request)
    const first = await snapshot(deps, request, context.value.stamp, environment)
    if (first instanceof Response) return first
    const refreshed = await deps.readContext(request)
    if (refreshed.status !== "ok") return contextFailure(refreshed.status)
    if (refreshed.value.authMode !== "local-operator") return denied()
    if (!sameStamp(refreshed.value.stamp, context.value.stamp))
      return foreignOwner(refreshed.value.stamp, context.value.stamp) ? denied() : stale()
    const final = await snapshot(deps, request, refreshed.value.stamp, environment)
    if (final instanceof Response) return final
    if (JSON.stringify(first.settings) !== JSON.stringify(final.settings)) return stale()
    if (request.signal.aborted) return unavailable("request-cancelled")
    return json({ status: "ok", context: refreshed.value.stamp, value: final.settings }, 200)
  } catch { return unavailable() }
}

async function write(deps: SfNativeHostDependencies, request: Request): Promise<Response> {
  const invalid = ingress(deps, request, true)
  if (invalid) return invalid
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json")
    return json({ ok: false, status: 400 }, 415)
  try {
    const bytes = await readRequestBody(request, Math.min(16 * 1024, deps.application.maxJsonBytes))
    const body = (() => {
      try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
      catch { return undefined }
    })()
    if (body === undefined) return json({ ok: false, status: 400 }, 400)
    const parsed = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(body)
    if (Option.isNone(parsed)) return json({ ok: false, status: 400 }, 400)
    const raw = object(parsed.value)
    const context = object(raw.context)
    if (Object.keys(raw).length !== 3 || Object.keys(raw).some((key) => !["context", "version", "pages"].includes(key)) ||
        Object.keys(context).length !== stampKeys.length || Object.keys(context).some((key) => !stampKeys.some((allowed) => allowed === key)) ||
        stampKeys.some((key) => typeof context[key] !== "string" || !(context[key] as string).trim()) ||
        !Array.isArray(raw.pages) || raw.pages.length > DASHBOARD_PAGES.length)
      return json({ ok: false, status: 400 }, 400)
    // Preserve the original domain distinction: malformed envelope is 400,
    // unsupported summary names are 422, never a silently filtered partial write.
    if (raw.pages.some((value) => typeof value !== "string" || !(DASHBOARD_PAGES as readonly string[]).includes(value)))
      return json({ ok: false, status: 422 }, 422)
    const decoded = Schema.decodeUnknownOption(SfDomain.operations[writeId].input)(parsed.value)
    if (Option.isNone(decoded)) return json({ ok: false, status: 400 }, 400)
    const input = decoded.value
    const admitted = await deps.readContext(request)
    if (admitted.status !== "ok") return contextFailure(admitted.status)
    if (admitted.value.authMode !== "local-operator") return denied()
    if (!sameStamp(admitted.value.stamp, input.context))
      return foreignOwner(admitted.value.stamp, input.context) ? denied() : stale()
    const runtime = deps.runtime()
    if (!runtime) return unavailable()
    const environment = await deps.application.environment(request)
    if (!Number.isFinite(new Date(environment.at).getTime())) return unavailable("summary-environment-unavailable")
    return await deps.application.persistence.transaction<Response>("dashboard", async (value) => {
      const before = await current(deps, runtime, request, input.context)
      if (before) return { commit: false, value: before }
      const original = await source(deps, request, value, environment, input.context)
      if (original instanceof Response) return { commit: false, value: original }
      if (!original.actor.canWrite) return { commit: false, value: denied() }
      if (!original.settings.canConfigure) return { commit: false, value: unavailable("summary-directory-unavailable") }
      const auditStart = value.audit.length
      const result = configure(value, "dashboard", original.actor, {
        page, action: "configure-summaries", version: input.version, values: { pages: [...input.pages] },
      }, environment)
      // summaries is not an input to product-authority's accessRevision. The
      // actual command may change only config/data versions, never its authority.
      const after = await current(deps, runtime, request, input.context)
      if (after) return { commit: false, value: after }
      const actor = await source(deps, request, value, environment, input.context)
      if (actor instanceof Response) return { commit: false, value: actor }
      if (!actor.actor.canWrite || !actor.settings.canConfigure) return { commit: false, value: denied() }
      const terminal = await current(deps, runtime, request, input.context)
      if (terminal) return { commit: false, value: terminal }
      if (result.ok) {
        for (const audit of value.audit.slice(auditStart))
          audit.name = environment.directory.find((person) => person.id === actor.actor.id)?.name
        value.versions.dataset = { version: (value.versions.dataset?.version ?? 0) + 1, by: actor.actor.id }
      }
      return { commit: result.ok, value: json(result, result.ok ? 200 : result.status) }
    }, { signal: request.signal })
  } catch (error) {
    return error instanceof RequestBodyError ? json({ ok: false, status: 400 }, error.status) : unavailable()
  }
}

export function createSfSummarySettingsHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return [
    { operationId: readId, handle: (request) => read(deps, request) },
    { operationId: writeId, handle: (request) => write(deps, request) },
  ]
}

/** Current source/actor/config proof; no mutation, fabricated baseline or full-context recursion. */
export async function observeSfSummarySettingsHealth(deps: SfNativeHostDependencies, handlers: readonly SfProjectionHandler[],
  request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const installed = new Set(handlers.map((handler) => handler.operationId))
  if (!installed.has(readId) || request.signal.aborted) return []
  try {
    const environment = await deps.application.environment(request)
    if (!Number.isFinite(new Date(environment.at).getTime())) return []
    const first = await snapshot(deps, request, stamp, environment)
    if (first instanceof Response) return []
    const final = await snapshot(deps, request, stamp, environment)
    if (final instanceof Response || JSON.stringify(first.settings) !== JSON.stringify(final.settings) || request.signal.aborted) return []
    return [
      { operationId: readId, state: "ready", operational: true, reason: null },
      ...(installed.has(writeId) && final.settings.canConfigure ?
        [{ operationId: writeId, state: "ready", operational: true, reason: null } as const] : []),
    ]
  } catch { return [] }
}
