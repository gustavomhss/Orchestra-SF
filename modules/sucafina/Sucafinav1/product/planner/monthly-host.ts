import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Result, Snapshot, View } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { plannerKeys } from "../../src/nav.ts"
import { OPEX_ELEMENTS } from "../../src/planner-accounts.ts"
import { projectMonthlyGrid } from "./monthly-grid.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { prepareMonthlyDrafts, previewMonthlyDrafts, previewMonthlyOperation } from "./monthly-edit.ts"
import type { MonthlyDraft, MonthlySpreadPreview } from "./monthly-edit.ts"

export type MonthlyEntityOperation = { collection: "lines" | "projects"; kind: "create" | "edit" | "delete"; id?: string; revision: number; values?: Record<string, unknown> }
export type MonthlySetting = { kind: "closed-through"; revision: number; closed: number } | { kind: "breakdown"; revision: number; element: string; split: boolean }
export type MonthlyRequest = { page: "OPEX" | "CAPEX"; versionId: string; drafts?: readonly MonthlyDraft[]; operation?: { rowId: string; revision: number; kind: "annual" | "spread" | "reset"; annual?: number }; entity?: MonthlyEntityOperation; setting?: MonthlySetting }
export type MonthlyResult = { view: View; before?: ReturnType<typeof projectMonthlyGrid>; after?: ReturnType<typeof projectMonthlyGrid>; rows: readonly { draft: MonthlyDraft; errors: readonly { cell?: MonthlyDraft["cells"][number]; reason: string }[]; result?: Result }[]; operation?: Omit<MonthlySpreadPreview, "command">; settingResult?: { ok: boolean; status?: number; errors?: readonly string[] }; entityResult?: { ok: boolean; status?: number; errors?: readonly string[] } }

/** Host-private entrypoint: the browser supplies edits, never the actor or snapshot. */
export function createPlannerMonthlyHost(input: { host: DomainPortHost; humanAuthorize: (context: TrustedDomainContext, action: "planner.preview" | "planner.apply", payload: MonthlyRequest) => Promise<boolean> }) {
  const run = async (incoming: MonthlyRequest, context: TrustedDomainContext, action: "planner.preview" | "planner.apply"): Promise<PortResult<MonthlyResult>> => {
    const request = structuredClone(incoming)
    if (!validMonthlyRequest(request)) return { status: "needs-input" as const, reason: "invalid-monthly-request" }
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http) return { status: "denied" as const, reason: "monthly-authority-unavailable" }
    const allowed = async () => !http.signal.aborted && await input.host.revalidate(context).catch(() => false) && await input.humanAuthorize(context, action, request).catch(() => false)
    if (!await allowed()) return { status: "denied" as const, reason: "monthly-authority-unavailable" }
    const environment = await input.host.environment(http).catch(() => undefined)
    if (!environment) return { status: "unavailable" as const, reason: "monthly-environment-unavailable" }
    const identify = async (snapshot: Snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
      const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return plannerKeys(actor).length ? actor : undefined
    }
    const result = await input.host.persistence.transaction<PortResult<MonthlyResult>>("planner", async (snapshot) => {
      const actor = await identify(snapshot).catch(() => undefined)
      if (!actor || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-unavailable" } }
      const version = rows(domain.view(snapshot, actor, environment).data.versions).find((item) => item.id === request.versionId)
      if (!version) return { commit: false, value: { status: "needs-input" as const, reason: "planner-version-unavailable" } }
      if (request.setting) {
        const setting = request.setting
        const command: import("../../runtime/contract.ts").Command = { page: "OPEX", action: "save", version: setting.revision, values: { versionId: request.versionId, ...(setting.kind === "closed-through" ? { closed: setting.closed } : { el: setting.element, split: setting.split }) } }
        const target = action === "planner.preview" ? structuredClone(snapshot) : snapshot
        const executed = domain.execute(target, actor, command, environment)
        if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
        return { commit: action === "planner.apply" && executed.ok, value: { status: "ok" as const, value: { view: monthlyView(domain.view(target, actor, environment), actor), rows: [], settingResult: sanitizeEntityResult(executed) } } }
      }
      if (request.entity) {
        const entity = request.entity
        if (entity.collection === "projects" && request.page !== "CAPEX" || entity.collection === "lines" && entity.id?.startsWith("HR:")) return { commit: false, value: { status: "needs-input" as const, reason: "entity-unavailable" } }
        if (entity.kind !== "create") {
          const entries = entity.collection === "projects" ? rows(version.projects) : rows(object(version.summary).lines).filter((line) => line.sec === (request.page === "OPEX" ? "opex" : "capex") && line.synthetic !== true)
          if (entries.filter((entry) => entry.id === entity.id).length !== 1) return { commit: false, value: { status: "needs-input" as const, reason: "entity-unavailable" } }
        }
        const command: import("../../runtime/contract.ts").Command = { page: request.page, action: entity.kind === "delete" ? "delete" : "save", ...(entity.kind !== "create" && entity.id ? { id: entity.id } : {}), version: entity.revision, values: { versionId: request.versionId, collection: entity.collection, ...entity.values } }
        if (action === "planner.preview") {
          const previewSnapshot = structuredClone(snapshot)
          const simulated = domain.execute(previewSnapshot, actor, command, environment)
          if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
          return { commit: false, value: { status: "ok" as const, value: { view: monthlyView(domain.view(previewSnapshot, actor, environment), actor), rows: [], entityResult: sanitizeEntityResult(simulated) } } }
        }
        const entityResult = domain.execute(snapshot, actor, command, environment)
        if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
        return { commit: entityResult.ok, value: { status: "ok" as const, value: { view: monthlyView(domain.view(snapshot, actor, environment), actor), rows: [], entityResult: sanitizeEntityResult(entityResult) } } }
      }
      if (request.operation) {
        if (request.operation.rowId.startsWith("HR:")) return { commit: false, value: { status: "needs-input" as const, reason: "row-unavailable" } }
        const operation = previewMonthlyOperation(snapshot, actor, environment, request.page, request.versionId, request.operation.rowId, request.operation.revision, request.operation.kind, request.operation.annual)
        if (operation.errors.length) {
          if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
          return { commit: false, value: { status: "ok" as const, value: { view: monthlyView(domain.view(snapshot, actor, environment), actor), rows: [], operation: omitCommand(operation) } } }
        }
        if (action === "planner.preview") {
          if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
          return { commit: false, value: { status: "ok" as const, value: { view: monthlyView(domain.view(snapshot, actor, environment), actor), rows: [], operation: omitCommand(operation) } } }
        }
        const applied = operation.command ? domain.execute(snapshot, actor, operation.command, environment) : undefined
        if (!applied?.ok) {
          if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
          return { commit: false, value: { status: "ok" as const, value: { view: monthlyView(domain.view(snapshot, actor, environment), actor), rows: [], operation: { ...omitCommand(operation), errors: ["operation-rejected"] } } } }
        }
        if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
        return { commit: true, value: { status: "ok" as const, value: { view: monthlyView(domain.view(snapshot, actor, environment), actor), rows: [], operation: omitCommand(operation) } } }
      }
      if (!request.drafts?.length) return { commit: false, value: { status: "needs-input" as const, reason: "monthly-drafts-required" } }
      const visible = rows(object(version.summary).lines).filter((line) => line.sec === (request.page === "OPEX" ? "opex" : "capex"))
      const prepared = prepareMonthlyDrafts(request.page, request.versionId, request.drafts).map((row) => visible.filter((line) => line.id === row.draft.rowId).length === 1 ? row : { ...row, command: undefined, errors: [...row.errors, { reason: "row-unavailable" }] })
      const admitted = prepared.filter((row) => row.command !== undefined)
      if (action === "planner.preview") {
        const preview = previewMonthlyDrafts(snapshot, actor, environment, request.page, request.versionId, admitted.map((row) => row.draft))
        if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
        return { commit: false, value: { status: "ok" as const, value: { view: monthlyView(preview.view, actor), before: preview.before, after: preview.after, rows: prepared.map((row) => ({ draft: row.draft, errors: row.errors, ...(row.command && preview.rows[admitted.indexOf(row)]?.result ? { result: sanitizeMonthlyResult(preview.rows[admitted.indexOf(row)]!.result!, snapshot, actor, environment, request.versionId, row.draft.rowId) } : {}) })) } } }
      }
      const results = prepared.map((row) => {
        if (!row.command) return { ...row, result: undefined }
        const result = domain.execute(snapshot, actor, row.command, environment)
        return { ...row, result: sanitizeMonthlyResult(result, snapshot, actor, environment, request.versionId, row.draft.rowId) }
      })
      if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
      const commit = results.some((row) => row.result?.ok === true)
      const response = { rows: results.map((row) => ({ draft: row.draft, errors: row.errors, ...(row.result ? { result: row.result } : {}) })), view: monthlyView(domain.view(snapshot, actor, environment), actor) }
      return { commit, value: { status: "ok" as const, value: response } }
    }, { signal: http.signal }).catch(() => ({ status: "unavailable" as const, reason: "monthly-storage-unavailable" }))
    if (action === "planner.apply" && result.status === "ok" && !await allowed()) return { status: "unavailable" as const, reason: "monthly-apply-outcome-requires-reconciliation" }
    if (!await allowed()) {
      const applied = action === "planner.apply" && result.status === "ok" && (result.value.settingResult?.ok === true || result.value.entityResult?.ok === true || result.value.rows.some((row) => row.result?.ok === true) || !!result.value.operation && !result.value.operation.errors.length)
      return applied ? { status: "unavailable" as const, reason: "monthly-apply-outcome-requires-reconciliation" } : { status: "denied" as const, reason: "monthly-authority-changed" }
    }
    return result
  }
  return { preview: (request: MonthlyRequest, context: TrustedDomainContext) => run(request, context, "planner.preview"), apply: (request: MonthlyRequest, context: TrustedDomainContext) => run(request, context, "planner.apply") }
}

export function validMonthlyRequest(request: MonthlyRequest) {
  if (!request || Object.keys(request).some((key) => !["page", "versionId", "drafts", "operation", "entity", "setting"].includes(key)) || (request.page !== "OPEX" && request.page !== "CAPEX") || typeof request.versionId !== "string" || !request.versionId.trim()) return false
  if ([request.entity, request.operation, request.drafts, request.setting].filter((value) => value !== undefined).length !== 1) return false
  if (request.setting) {
    const setting = request.setting
    if (request.page !== "OPEX" || !Number.isSafeInteger(setting.revision) || setting.revision < 0) return false
    if (setting.kind === "closed-through") return Object.keys(setting).every((key) => ["kind", "revision", "closed"].includes(key)) && Number.isInteger(setting.closed) && setting.closed >= 0 && setting.closed <= 12
    return setting.kind === "breakdown" && Object.keys(setting).every((key) => ["kind", "revision", "element", "split"].includes(key)) && OPEX_ELEMENTS.includes(setting.element as (typeof OPEX_ELEMENTS)[number]) && setting.element !== "hr" && typeof setting.split === "boolean"
  }
  if (request.entity) {
    const entity = request.entity
    if (Object.keys(entity).some((key) => !["collection", "kind", "id", "revision", "values"].includes(key)) || !["lines", "projects"].includes(entity.collection) || !["create", "edit", "delete"].includes(entity.kind) || !Number.isSafeInteger(entity.revision) || entity.revision < 0) return false
    if (entity.kind === "create" ? entity.id !== undefined : typeof entity.id !== "string" || !entity.id.trim()) return false
    const fields = entity.collection === "lines" ? ["name", "desc", "owner", "entity", "alloc", "cls", "cur", "annual", "b", "a", "f", "el", "proj", "domain", "month", "value"] : ["name", "desc", "owner", "code"]
    if (entity.kind === "delete") return entity.values === undefined && !request.drafts && !request.operation
    if (!entity.values || typeof entity.values !== "object" || Array.isArray(entity.values) || Object.keys(entity.values).some((key) => !fields.includes(key) && !(entity.collection === "lines" && /^[baf](?:[0-9]|1[01])$/.test(key))) || !validEntityValues(entity.values)) return false
    return !request.drafts && !request.operation
  }
  if (request.operation) return Object.keys(request.operation).every((key) => ["rowId", "revision", "kind", "annual"].includes(key)) && typeof request.operation.rowId === "string" && !!request.operation.rowId.trim() && Number.isSafeInteger(request.operation.revision) && request.operation.revision >= 0 && ["annual", "spread", "reset"].includes(request.operation.kind) && (request.operation.kind !== "annual" || typeof request.operation.annual === "number" && Number.isFinite(request.operation.annual)) && !request.drafts
  return Array.isArray(request.drafts) && request.drafts.length > 0 && request.drafts.length <= 500 && request.drafts.every((incoming: unknown) => {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return false
    const draft = object(incoming)
    return Object.keys(draft).every((key) => ["rowId", "revision", "cells"].includes(key)) && typeof draft.rowId === "string" && typeof draft.revision === "number" && Number.isSafeInteger(draft.revision) && draft.revision >= 0 && Array.isArray(draft.cells) && draft.cells.length > 0 && draft.cells.length <= 36 && draft.cells.every((incomingCell: unknown) => {
      if (!incomingCell || typeof incomingCell !== "object" || Array.isArray(incomingCell)) return false
      const cell = object(incomingCell)
      return Object.keys(cell).every((key) => ["measure", "month", "text"].includes(key)) && typeof cell.measure === "string" && ["budget", "actual", "forecast"].includes(cell.measure) && typeof cell.month === "number" && Number.isInteger(cell.month) && typeof cell.text === "string"
    })
  })
}

function validEntityValues(values: Record<string, unknown>) {
  return Object.values(values).every((value) => value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || Array.isArray(value) && value.every((item) => item === null || typeof item === "number" && Number.isFinite(item)))
}

function monthlyView(view: View, actor: Actor): View {
  if (actor.roles.includes("admin") || actor.roles.includes("hr") || actor.roles.includes("finance")) return view
  // The domain already removes rates and individual costs while retaining permitted HR aggregates.
  return { ...view, data: { ...view.data, roster: [] } }
}

function omitCommand(operation: MonthlySpreadPreview): Omit<MonthlySpreadPreview, "command"> {
  const { command: _command, ...safe } = operation
  return safe
}

function sanitizeEntityResult(result: Result): MonthlyResult["entityResult"] {
  return result.ok ? { ok: true } : { ok: false, status: result.status, errors: result.errors }
}

function sanitizeMonthlyResult(result: Result, snapshot: Snapshot, actor: Actor, environment: Parameters<typeof domain.view>[2], versionId: string, rowId: string): Result {
  if (result.ok || result.stored === undefined) return result
  const view = monthlyView(domain.view(snapshot, actor, environment), actor)
  const version = rows(view.data.versions).find((entry) => entry.id === versionId)
  const line = rows(object(version?.summary).lines).find((entry) => entry.id === rowId)
  return { ...result, stored: line ? { id: line.id, b: line.b, bm: line.bm, a: line.a, f: line.f, annual: line.annual } : undefined }
}
