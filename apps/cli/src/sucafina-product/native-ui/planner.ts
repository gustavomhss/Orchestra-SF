import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { domain } from "../../../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import { object, rows, text } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, View } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { plannerKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { OPEX_ELEMENTS } from "../../../../../modules/sucafina/Sucafinav1/src/planner-accounts.ts"
import { projectMonthlyGrid } from "../../../../../modules/sucafina/Sucafinav1/product/planner/monthly-grid.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"

/** Seven closed JSON projections. Existing domain POST, Planner monthly and forecast
 * routes remain with their canonical producers; this is not another router or store.
 */
const PAGES = [
  { id: "CAP17", page: "Overview", query: ["year", "version", "filter"] },
  { id: "CAP18", page: "OPEX", query: ["year", "version", "mode", "owner", "class", "q"] },
  { id: "CAP19", page: "CAPEX", query: ["year", "version", "mode", "owner", "class", "q"] },
  { id: "CAP20", page: "Headcount", query: ["year", "version"] },
  { id: "CAP21", page: "Entities & allocations", query: ["year"] },
  { id: "CAP22", page: "FX rates", query: ["year", "version"] },
  { id: "CAP23", page: "Versions", query: ["year"] },
] as const
type Cap = (typeof PAGES)[number]["id"]
type Page = (typeof PAGES)[number]
type Selection = { year: number; versionId?: string; mode?: string; owner?: string; class?: string; q?: string; filter?: string }
type Projection = { selection: Selection; data: object; versions: Record<string, { version: number }> }
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" }
function json(body: object, status: number): Response { return Response.json(body, { status, headers }) }
function failure(status: "unauthenticated" | "denied" | "unavailable" | "invalid" | "needs-input" | "stale", reason?: string) {
  const http = { unauthenticated: 401, denied: 403, unavailable: 503, invalid: 400, "needs-input": 422, stale: 409 }[status]
  return json(reason ? { status, reason } : { status }, http)
}
function id(value: unknown): string {
  return typeof value === "string" || typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}
function money(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null }
function string(value: unknown): string | undefined { return typeof value === "string" ? value : undefined }
function months(value: unknown) {
  return Array.from({ length: 12 }, (_, index) => money(Array.isArray(value) ? value[index] : undefined))
}
function select(request: Request, spec: Page): Selection | undefined {
  const params = new URL(request.url).searchParams
  const allowed = new Set<string>(spec.query)
  for (const key of params.keys()) if (!allowed.has(key) || params.getAll(key).length !== 1) return undefined
  const year = params.get("year"), version = params.get("version"), mode = params.get("mode")
  const owner = params.get("owner"), cls = params.get("class"), filter = params.get("filter")
  if (year !== null && !/^202[4-7]$/.test(year)) return undefined
  if (mode !== null && mode !== "" && !["budget", "actual", "forecast", "compare"].includes(mode)) return undefined
  if (cls !== null && cls !== "" && !["capex", "opex"].includes(cls)) return undefined
  return {
    year: year === null ? 2026 : Number(year),
    ...(version !== null && version.trim() ? { versionId: version } : {}),
    ...(mode !== null && mode.trim() ? { mode } : {}),
    ...(owner !== null && owner.trim() ? { owner } : {}),
    ...(cls !== null && cls.trim() ? { class: cls } : {}),
    ...(params.has("q") ? { q: params.get("q") ?? "" } : {}),
    ...(filter !== null && filter.trim() ? { filter } : {}),
  }
}
function planVersions(view: View) {
  const officials = object(view.data.officials)
  return rows(view.data.versions).map((v) => ({
    id: id(v.id), name: text(v.name), year: Number(v.year),
    locked: v.locked === true, closed: Number(v.closed),
    official: id(officials[String(v.year)]) === id(v.id),
  })).filter((v) => v.id !== "" && Number.isFinite(v.year))
}
function chosen(view: View, selection: Selection) {
  const versions = rows(view.data.versions)
  return selection.versionId !== undefined
    ? versions.find((v) => id(v.id) === selection.versionId)
    : versions.find((v) => Number(v.year) === selection.year) ?? versions[0]
}
function revision(view: View, key: string) { return view.versions[key]?.version ?? 0 }
function owner(row: Record<string, unknown>) { return id(object(row.owner).id) || id(row.owner) }
function cas(view: View, cap: Cap, current: Record<string, unknown> | undefined, data: object) {
  const keys = new Set<string>()
  const add = (key: string) => { if (Object.hasOwn(view.versions, key)) keys.add(key) }
  const versionId = id(current?.id)
  if (cap === "CAP23" || cap === "CAP17") {
    add("versions:first")
    for (const item of rows(view.data.versions)) {
      add("versions:" + id(item.id))
      add("officials:" + String(item.year))
    }
  }
  if (cap === "CAP21") {
    for (const col of ["entities", "allocations"] as const) {
      for (const row of rows(view.data[col])) add(col + ":" + id(row.id))
      add(col + ":")
    }
    add("allocations:common")
  }
  if (versionId) {
    add("versions:" + versionId)
    if (cap === "CAP18") {
      add(versionId + ":closed")
      for (const el of OPEX_ELEMENTS) add(versionId + ":lists:" + el)
    }
    if (cap === "CAP18" || cap === "CAP19") {
      for (const row of rows(object((data as { grid?: object }).grid).rows)) {
        const rowId = id(row.id)
        if (rowId) add(versionId + ":" + (rowId.startsWith("HR:") ? "hrAF" : "lines") + ":" + rowId)
      }
      if (cap === "CAP19") for (const p of rows(current?.projects)) add(versionId + ":projects:" + id(p.id))
    }
    if (cap === "CAP20") {
      const hc = object(current?.hc)
      for (const p of rows(hc.positions)) add(versionId + ":positions:" + id(p.id))
      if (Array.isArray((data as { rates?: unknown }).rates))
        for (const r of rows(hc.rates)) add(versionId + ":rates:" + id(r.id))
      for (const key of ["increase", "leaderDomains", "positions:sync"]) add(versionId + ":" + key)
    }
    if (cap === "CAP22") for (const r of rows(current?.fx)) add(versionId + ":fx:" + id(r.id))
  }
  return Object.fromEntries([...keys].map((key) => [key, { version: view.versions[key]!.version }]))
}
function project(view: View, actor: Actor, cap: Cap, selection: Selection, current: Record<string, unknown> | undefined): object {
  const versions = planVersions(view)
  const selectedVersion = current ? versions.find((v) => v.id === id(current.id)) : undefined
  if (cap === "CAP23") return { versions }
  if (cap === "CAP21") {
    const list = (key: "entities" | "allocations") => rows(view.data[key]).map((v) => ({
      id: id(v.id), name: text(v.name), revision: revision(view, key + ":" + id(v.id)),
      ...(string(v.code) !== undefined ? { code: v.code } : {}),
      ...(string(v.desc) !== undefined ? { desc: v.desc } : {}),
    })).filter((v) => v.id !== "")
    return { entities: list("entities"), allocations: list("allocations") }
  }
  const base = { versions, ...(selectedVersion ? { selectedVersion } : {}) }
  if (cap === "CAP17") {
    const summary = current ? object(current.summary) : undefined
    const comparisons = rows(view.data.versions)
      .filter((v) => current && Number(v.year) === Number(current.year) &&
        (!selection.filter || id(v.id) === id(current.id) || id(v.id) === selection.filter))
      .map((v) => ({ id: id(v.id), name: text(v.name), year: Number(v.year),
        total: money(object(v.summary).total), fte: money(object(v.summary).fte) }))
      .filter((v) => v.id !== "")
    return { ...base,
      ...(summary ? { summary: {
        total: money(summary.total), actualYTD: money(summary.actualYTD),
        fullYear: money(summary.fullYear), hrTotal: money(summary.hrTotal), fte: money(summary.fte),
        budget: months(summary.budget), actual: months(summary.actual), outlook: months(summary.outlook),
        warnings: Array.isArray(summary.warnings) ? summary.warnings.filter((v): v is string => typeof v === "string") : [],
      } } : {}),
      comparisons,
    }
  }
  if (cap === "CAP18" || cap === "CAP19") {
    const versionId = id(current?.id)
    // Canonical producer owns currency math, inherited forecast and editable state.
    const filtered: View = { data: {
      ...view.data,
      ...(selection.owner !== undefined ? { owner: selection.owner } : {}),
      ...(selection.class !== undefined ? { class: selection.class } : {}),
      ...(selection.q !== undefined ? { q: selection.q } : {}),
    }, versions: view.versions }
    const grid = versionId ? projectMonthlyGrid(filtered, actor, cap === "CAP18" ? "OPEX" : "CAPEX", versionId) : undefined
    const summaries = rows(object(current?.summary).lines)
    const lines = (grid?.rows ?? []).map((row) => {
      const original = object(summaries.find((line) => id(line.id) === row.id))
      return {
        id: row.id, name: text(original.name) || row.label, revision: row.revision,
        ...(string(original.desc) !== undefined ? { desc: original.desc } : {}),
        ...(string(original.el) !== undefined ? { el: original.el } : {}),
        ...(string(original.cls) !== undefined ? { cls: original.cls } : {}),
        ...(string(original.cur) !== undefined ? { cur: original.cur } : {}),
        ...(owner(original) ? { owner: owner(original) } : {}),
        ...(string(original.entity) !== undefined ? { entity: original.entity } : {}),
        ...(string(original.alloc) !== undefined ? { alloc: original.alloc } : {}),
        ...(string(original.proj) !== undefined ? { proj: original.proj } : {}),
        synthetic: row.synthetic,
      }
    })
    if (cap === "CAP19") {
      const projects = rows(current?.projects).map((p) => ({
        id: id(p.id), name: text(p.name), revision: revision(view, versionId + ":projects:" + id(p.id)),
        ...(string(p.code) !== undefined ? { code: p.code } : {}),
        ...(string(p.desc) !== undefined ? { desc: p.desc } : {}),
        ...(owner(p) ? { owner: owner(p) } : {}),
      })).filter((p) => p.id !== "")
      return { ...base, ...(grid ? { grid } : {}), lines, projects }
    }
    const lists = object(current?.lists)
    const split = OPEX_ELEMENTS.filter((el) => el !== "hr").map((el) => ({
      element: el,
      split: typeof object(lists[el]).split === "boolean"
        ? object(lists[el]).split === true : ["licenses", "services", "hwo", "te"].includes(el),
      revision: revision(view, versionId + ":lists:" + el),
    }))
    return { ...base, ...(grid ? { grid } : {}), lines, split }
  }
  if (cap === "CAP20") {
    const versionId = id(current?.id), hc = object(current?.hc), summary = object(current?.summary)
    const privileged = actor.roles.some((role) => ["admin", "finance", "hr"].includes(role))
    const positions = rows(hc.positions).map((p) => ({
      id: id(p.id), name: text(p.name), revision: revision(view, versionId + ":positions:" + id(p.id)),
      ...(typeof p.include === "boolean" ? { include: p.include } : {}),
      ...(string(p.domain) !== undefined ? { domain: p.domain } : {}),
      ...(string(p.type) !== undefined ? { type: p.type } : {}),
      ...(string(p.location) !== undefined ? { location: p.location } : {}),
      ...(typeof p.fte === "number" && Number.isFinite(p.fte) ? { fte: p.fte } : {}),
      ...(typeof p.start === "number" && Number.isFinite(p.start) ? { start: p.start } : {}),
      ...(typeof p.end === "number" && Number.isFinite(p.end) ? { end: p.end } : {}),
      ...(privileged && string(p.rateId) !== undefined ? { rateId: p.rateId } : {}),
      ...(privileged && (p.rateOverride === null || typeof p.rateOverride === "string" || typeof p.rateOverride === "number" && Number.isFinite(p.rateOverride)) ? { rateOverride: p.rateOverride } : {}),
      ...(typeof p.hasRate === "boolean" ? { hasRate: p.hasRate } : {}),
      ...(string(p.src) !== undefined ? { src: p.src } : {}),
      ...(typeof p.left === "boolean" ? { left: p.left } : {}),
      ...(privileged && Array.isArray(p.months) ? { months: p.months.map(money) } : {}),
    })).filter((p) => p.id !== "")
    const rates = privileged ? rows(hc.rates).map((r) => ({
      id: id(r.id), name: text(r.name), cur: text(r.cur), annual: money(r.annual),
      revision: revision(view, versionId + ":rates:" + id(r.id)),
      ...(typeof r.locs === "string" || Array.isArray(r.locs) && r.locs.every((v) => typeof v === "string") ? { locs: r.locs } : {}),
    })).filter((r) => r.id !== "") : undefined
    return { ...base, positions,
      ...(rates ? { rates } : {}),
      ...(privileged && hc.leaderDomains && typeof hc.leaderDomains === "object" ? {
        leaderDomains: Object.fromEntries(Object.entries(object(hc.leaderDomains)).filter(([, v]) => typeof v === "string")),
      } : {}),
      ...(privileged && typeof hc.inc === "number" && Number.isFinite(hc.inc) &&
        Number.isInteger(hc.incMonth) && Number(hc.incMonth) >= 1 && Number(hc.incMonth) <= 12 ?
        { increase: { inc: hc.inc, incMonth: hc.incMonth } } : {}),
      ...(current ? { metrics: { fte: money(summary.fte), hrTotal: money(summary.hrTotal) } } : {}),
    }
  }
  const rates = rows(current?.fx).map((r) => ({
    id: id(r.id), cur: text(r.cur), rate: typeof r.rate === "string" ? r.rate : money(r.rate),
    revision: revision(view, id(current?.id) + ":fx:" + id(r.id)),
  })).filter((r) => r.id !== "")
  const raw = object(current?.summary).warnings
  const warnings = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []
  return { ...base, rates, warnings }
}
function sameStamp(a: { installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string },
  b: typeof a) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}
function permitted(context: { destinations: readonly { capabilityId: string; surface: string; canRead: boolean; allowedActionIds: readonly string[] }[] }, cap: Cap) {
  return context.destinations.find((entry) => entry.capabilityId === cap && entry.surface === "planner" && entry.canRead)
}
export function createSfPlannerProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return PAGES.map((spec): SfProjectionHandler => ({
    operationId: ("domain.page." + spec.id) as SfProjectionHandler["operationId"],
    handle: async (request) => {
      if (request.method !== "GET") return failure("invalid", "method-not-allowed")
      const url = new URL(request.url)
      if (url.pathname !== deps.mount + "/api/ui/pages/" + spec.id || url.origin !== deps.origin ||
        request.headers.has("transfer-encoding") || Number(request.headers.get("content-length") ?? "0") > 0)
        return failure("invalid", "projection-request-invalid")
      const selection = select(request, spec)
      if (!selection) return failure("invalid", "projection-selection-invalid")
      if (request.signal.aborted) return failure("unavailable", "request-aborted")
      const first = await deps.readContext(request).catch(() => undefined)
      if (!first || first.status !== "ok") {
        if (first?.status === "unauthenticated") return failure("unauthenticated")
        return first?.status === "denied" ? failure("denied") :
          failure("unavailable", first?.status === "unavailable" ? first.reason : "context-unavailable")
      }
      const admit = permitted(first.value, spec.id)
      if (!admit) return failure("denied")
      const environment = await deps.application.environment(request).catch(() => undefined)
      if (!environment) return failure("unavailable", "planner-environment-unavailable")
      const result = await deps.application.persistence.transaction<Projection | undefined>("planner", async (snapshot) => {
        if (request.signal.aborted) return { commit: false, value: undefined }
        const principal = await deps.application.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") }).catch(() => null)
        if (!principal || !principal.id || principal.id.startsWith("local:") || principal.id !== first.value.stamp.principalRef)
          return { commit: false, value: undefined }
        const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
        const access = object(object(snapshot.data.access)[principal.id])
        const actor: Actor = {
          id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((v): v is string => typeof v === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((v): v is string => typeof v === "string") : [],
        }
        if (!plannerKeys(actor).includes(spec.page)) return { commit: false, value: undefined }
        const view = domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
        const current = chosen(view, selection)
        if (selection.versionId !== undefined && !current)
          return { commit: false, value: { selection, data: { status: "selection-unavailable" }, versions: {} } }
        const data = project(view, actor, spec.id, selection, current)
        return { commit: false, value: {
          selection: { ...selection, ...(current ? { versionId: id(current.id) } : {}) },
          data, versions: cas(view, spec.id, current, data),
        } }
      }, { signal: request.signal }).then((value) => ({ state: "complete" as const, value }), () => ({ state: "unavailable" as const }))
      if (result.state === "unavailable") return failure("unavailable", "planner-store-unavailable")
      const projected = result.value
      if (!projected) return failure("denied")
      if ("status" in projected.data) return failure("needs-input", "version-unavailable")
      const fresh = await deps.readContext(request).catch(() => undefined)
      if (fresh?.status === "unauthenticated") return failure("unauthenticated")
      if (fresh?.status === "denied") return failure("denied")
      if (!fresh || fresh.status !== "ok") return failure("unavailable", fresh?.status === "unavailable" ? fresh.reason : "context-unavailable")
      if (!sameStamp(first.value.stamp, fresh.value.stamp)) return failure("stale", "authority-changed")
      const currentAdmit = permitted(fresh.value, spec.id)
      if (!currentAdmit || currentAdmit.allowedActionIds.join("|") !== admit.allowedActionIds.join("|")) return failure("denied")
      if (request.signal.aborted) return failure("unavailable", "request-aborted")
      return json({ status: "ok", context: fresh.value.stamp, value: {
        capabilityId: spec.id, selection: projected.selection,
        data: projected.data, versions: projected.versions, allowedActionIds: currentAdmit.allowedActionIds,
      } }, 200)
    },
  }))
}

/**
 * Invoked only by the installation which mounted these handlers. Execute the
 * same read-only Planner view and projection using the original context
 * Request; no synthetic route request, write, or authorization is created.
 */
export async function observeSfPlannerPages(
  application: SfNativeHostDependencies["application"], request: Request, stamp: SfContextStamp,
) {
  const environment = await application.environment(request)
  if (request.signal.aborted) return []
  return application.persistence.transaction("planner", async (snapshot) => {
    const principal = await application.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || !principal.id || principal.id.startsWith("local:") ||
        principal.id !== stamp.principalRef || request.signal.aborted) return { commit: false, value: [] }
    const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = {
      id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((v): v is string => typeof v === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((v): v is string => typeof v === "string") : [],
    }
    const allowed = plannerKeys(actor)
    const view = domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
    const selection = { year: 2026 }
    const current = chosen(view, selection)
    const observations = (["CAP17", "CAP23"] as const).flatMap((cap) => {
      const spec = PAGES.find((entry) => entry.id === cap)
      if (!spec || !allowed.includes(spec.page)) return []
      const data = project(view, actor, cap, selection, current)
      const value = { capabilityId: cap, selection: { ...selection, ...(current ? { versionId: id(current.id) } : {}) },
        data, versions: cas(view, cap, current, data), allowedActionIds: [] }
      const output = { status: "ok", context: stamp, value }
      if (!(cap === "CAP17" ? Schema.is(SfPlanner.operations["domain.page.CAP17"].output)(output)
        : Schema.is(SfPlanner.operations["domain.page.CAP23"].output)(output))) return []
      return [{ operationId: `domain.page.${cap}` as const, state: "ready" as const, reason: null, operational: true as const }]
    })
    return { commit: false, value: observations }
  }, { signal: request.signal })
}
