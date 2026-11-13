import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Command, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { plannerKeys } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerCatalogs, previewPlannerCatalog } from "./catalogs.ts"

export type CatalogRequest =
  | { action: "fx-save"; versionId: string; id: string; revision: number; currency: string; rate: string }
  | { action: "fx-delete"; versionId: string; id: string; revision: number }
  | { action: "entity-save"; versionId: string; id: string; revision: number; name: string; code: string }
  | { action: "entity-delete"; versionId: string; id: string; revision: number }
  | { action: "allocation-save"; versionId: string; id: string; revision: number; name: string; description: string }
  | { action: "allocation-delete"; versionId: string; id: string; revision: number }
  | { action: "allocation-common"; versionId: string; revision: number }

export type CatalogOutcome =
  | { ok: true; warnings: string[] }
  | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 503; errors: string[] }

export type CatalogHostResult = {
  catalogs: NonNullable<ReturnType<typeof plannerCatalogs>>
  outcome: CatalogOutcome
  /** Uncommitted domain view of the catalogs after a successful preview. */
  preview?: NonNullable<ReturnType<typeof plannerCatalogs>>
}

const ACTIONS = ["fx-save", "fx-delete", "entity-save", "entity-delete", "allocation-save", "allocation-delete", "allocation-common"] as const

/** Browser sends a closed catalog action. Actor, snapshot and command are host-side. */
export function createPlannerCatalogHost(input: { host: DomainPortHost; humanAuthorize: (context: TrustedDomainContext, action: "planner.preview" | "planner.apply", payload: CatalogRequest) => Promise<boolean> }) {
  const identify = async (snapshot: Snapshot, http: Request, context: TrustedDomainContext) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const keys = plannerKeys(actor)
    return keys.includes("FX rates") && keys.includes("Entities & allocations") ? actor : undefined
  }
  const read = async (versionId: string, context: TrustedDomainContext): Promise<PortResult<NonNullable<ReturnType<typeof plannerCatalogs>>>> => {
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http || http.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "catalog-authority-unavailable" }
    if (typeof versionId !== "string" || !versionId.trim()) return { status: "needs-input", reason: "invalid-version-id" }
    const environment = await input.host.environment(http)
    const load = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context)
      return { commit: false, value: actor ? plannerCatalogs(snapshot, actor, environment, versionId) : undefined }
    }, { signal: http.signal }).catch(() => undefined)
    const current = await load()
    const latest = await load()
    if (!current || !latest || digestSfValue(current) !== digestSfValue(latest) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "catalog-authority-unavailable" }
    return { status: "ok", value: current }
  }
  const run = async (incoming: CatalogRequest, context: TrustedDomainContext, gate: "planner.preview" | "planner.apply"): Promise<PortResult<CatalogHostResult>> => {
    const request = structuredClone(incoming)
    if (!validCatalogRequest(request)) return { status: "needs-input", reason: "invalid-catalog-request" }
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http) return { status: "denied", reason: "catalog-authority-unavailable" }
    const allowed = async () => !http.signal.aborted && await input.host.revalidate(context).catch(() => false) && await input.humanAuthorize(context, gate, request).catch(() => false)
    if (!await allowed()) return { status: "denied", reason: "catalog-authority-unavailable" }
    const environment = await input.host.environment(http).catch(() => undefined)
    if (!environment) return { status: "unavailable", reason: "catalog-environment-unavailable" }
    const result = await input.host.persistence.transaction<PortResult<CatalogHostResult>>("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context).catch(() => undefined)
      if (!actor || !await allowed()) return { commit: false, value: { status: "denied", reason: "catalog-authority-unavailable" } }
      const command = commandFor(request)
      const current = plannerCatalogs(snapshot, actor, environment, request.versionId)
      if (!current || !knownTarget(current, request)) return { commit: false, value: { status: "needs-input", reason: "catalog-target-unavailable" } }
      if (gate === "planner.preview") {
        const preview = previewPlannerCatalog(snapshot, actor, environment, request.versionId, command)
        if (!preview || digestSfValue(await identify(snapshot, http, context).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied", reason: "catalog-authority-changed" } }
        const outcome = sanitize(preview.result)
        return { commit: false, value: { status: "ok", value: { catalogs: preview.before, outcome, ...(preview.after ? { preview: preview.after } : {}) } } }
      }
      const executed = domain.execute(snapshot, actor, command, environment)
      const catalogs = plannerCatalogs(snapshot, actor, environment, request.versionId)
      if (!catalogs || digestSfValue(await identify(snapshot, http, context).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied", reason: "catalog-authority-changed" } }
      return { commit: executed.ok === true, value: { status: "ok", value: { catalogs, outcome: sanitize(executed.ok ? { ok: true, warnings: executed.warnings ?? [] } : { ok: false, status: executed.status, errors: executed.errors ?? [] }) } } }
    }, { signal: http.signal }).catch(() => ({ status: "unavailable" as const, reason: "catalog-storage-unavailable" }))
    if (!await allowed()) return gate === "planner.apply" && result.status === "ok" && result.value.outcome.ok ? { status: "unavailable", reason: "catalog-apply-outcome-requires-reconciliation" } : { status: "denied", reason: "catalog-authority-changed" }
    return result
  }
  return { read, preview: (request: CatalogRequest, context: TrustedDomainContext) => run(request, context, "planner.preview"), apply: (request: CatalogRequest, context: TrustedDomainContext) => run(request, context, "planner.apply") }
}

function commandFor(request: CatalogRequest): Command {
  if (request.action === "fx-save") return { page: "FX rates", action: "save", id: request.id, version: request.revision, values: { versionId: request.versionId, cur: request.currency, rate: request.rate } }
  if (request.action === "fx-delete") return { page: "FX rates", action: "delete", id: request.id, version: request.revision, values: { versionId: request.versionId } }
  if (request.action === "entity-save") return { page: "Entities & allocations", action: "save", id: request.id, version: request.revision, values: { collection: "entities", name: request.name, code: request.code } }
  if (request.action === "entity-delete") return { page: "Entities & allocations", action: "delete", id: request.id, version: request.revision, values: { collection: "entities" } }
  if (request.action === "allocation-save") return { page: "Entities & allocations", action: "save", id: request.id, version: request.revision, values: { collection: "allocations", name: request.name, desc: request.description } }
  if (request.action === "allocation-delete") return { page: "Entities & allocations", action: "delete", id: request.id, version: request.revision, values: { collection: "allocations" } }
  return { page: "Entities & allocations", action: "common", id: "", version: request.revision, values: { collection: "allocations" } }
}

function knownTarget(catalogs: NonNullable<ReturnType<typeof plannerCatalogs>>, request: CatalogRequest) {
  if (request.action === "fx-save") return request.id === "" || catalogs.fx.rates.some((rate) => rate.id === request.id)
  if (request.action === "fx-delete") return catalogs.fx.rates.some((rate) => rate.id === request.id)
  if (request.action === "entity-save") return request.id === "" || catalogs.shared.entities.some((entry) => entry.id === request.id)
  if (request.action === "entity-delete") return catalogs.shared.entities.some((entry) => entry.id === request.id)
  if (request.action === "allocation-save") return request.id === "" || catalogs.shared.allocations.some((entry) => entry.id === request.id)
  if (request.action === "allocation-delete") return catalogs.shared.allocations.some((entry) => entry.id === request.id)
  return catalogs.fx.versionId === request.versionId
}

function sanitize(result: { ok: true; warnings?: readonly string[] } | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 503; errors?: readonly string[] }): CatalogOutcome {
  if (result.ok) return { ok: true, warnings: (result.warnings ?? []).filter((warning): warning is string => typeof warning === "string") }
  return { ok: false, status: result.status, errors: (result.errors ?? []).filter((error): error is string => typeof error === "string") }
}

function validCatalogRequest(request: CatalogRequest) {
  if (!request || typeof request !== "object" || !ACTIONS.includes(request.action)) return false
  const keys = Object.keys(request)
  const revision = "revision" in request && Number.isSafeInteger(request.revision) && request.revision >= 0
  const versionId = "versionId" in request && typeof request.versionId === "string" && !!request.versionId.trim()
  if (!revision || !versionId) return false
  if (request.action === "fx-save") return keys.length === 6 && keys.every((key) => ["action", "versionId", "id", "revision", "currency", "rate"].includes(key)) && typeof request.id === "string" && typeof request.currency === "string" && typeof request.rate === "string"
  if (request.action === "fx-delete") return keys.length === 4 && keys.every((key) => ["action", "versionId", "id", "revision"].includes(key)) && typeof request.id === "string" && !!request.id.trim()
  if (request.action === "entity-save") return keys.length === 6 && keys.every((key) => ["action", "versionId", "id", "revision", "name", "code"].includes(key)) && typeof request.id === "string" && typeof request.name === "string" && typeof request.code === "string"
  if (request.action === "entity-delete") return keys.length === 4 && keys.every((key) => ["action", "versionId", "id", "revision"].includes(key)) && typeof request.id === "string" && !!request.id.trim()
  if (request.action === "allocation-save") return keys.length === 6 && keys.every((key) => ["action", "versionId", "id", "revision", "name", "description"].includes(key)) && typeof request.id === "string" && typeof request.name === "string" && typeof request.description === "string"
  if (request.action === "allocation-delete") return keys.length === 4 && keys.every((key) => ["action", "versionId", "id", "revision"].includes(key)) && typeof request.id === "string" && !!request.id.trim()
  return keys.length === 3 && keys.every((key) => ["action", "versionId", "revision"].includes(key))
}
