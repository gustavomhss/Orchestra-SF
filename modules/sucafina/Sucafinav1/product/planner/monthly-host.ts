import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Result, Snapshot, View } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { plannerKeys } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { prepareMonthlyDrafts, previewMonthlyDrafts } from "./monthly-edit.ts"
import type { MonthlyDraft } from "./monthly-edit.ts"

export type MonthlyRequest = { page: "OPEX" | "CAPEX"; versionId: string; drafts: readonly MonthlyDraft[] }
export type MonthlyResult = { view: View; rows: readonly { draft: MonthlyDraft; errors: readonly { cell?: MonthlyDraft["cells"][number]; reason: string }[]; result?: Result }[] }

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
      const visible = rows(object(version.summary).lines).filter((line) => line.sec === (request.page === "OPEX" ? "opex" : "capex"))
      const prepared = prepareMonthlyDrafts(request.page, request.versionId, request.drafts).map((row) => visible.filter((line) => line.id === row.draft.rowId).length === 1 ? row : { ...row, command: undefined, errors: [...row.errors, { reason: "row-unavailable" }] })
      const admitted = prepared.filter((row) => row.command !== undefined)
      if (action === "planner.preview") {
        const preview = previewMonthlyDrafts(snapshot, actor, environment, request.page, request.versionId, admitted.map((row) => row.draft))
        if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
        return { commit: false, value: { status: "ok" as const, value: { view: preview.view, rows: prepared.map((row) => ({ draft: row.draft, errors: row.errors, ...(row.command && preview.rows[admitted.indexOf(row)]?.result ? { result: preview.rows[admitted.indexOf(row)]!.result } : {}) })) } } }
      }
      const results = prepared.map((row) => ({ ...row, result: row.command ? domain.execute(snapshot, actor, row.command, environment) : undefined }))
      if (digestSfValue(await identify(snapshot).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied" as const, reason: "monthly-authority-changed" } }
      return { commit: results.some((row) => row.result?.ok === true), value: { status: "ok" as const, value: { rows: results.map((row) => ({ draft: row.draft, errors: row.errors, ...(row.result ? { result: row.result } : {}) })), view: domain.view(snapshot, actor, environment) } } }
    }, { signal: http.signal }).catch(() => ({ status: "unavailable" as const, reason: "monthly-storage-unavailable" }))
    if (!await allowed()) return { status: "denied" as const, reason: "monthly-authority-changed" }
    return result
  }
  return { preview: (request: MonthlyRequest, context: TrustedDomainContext) => run(request, context, "planner.preview"), apply: (request: MonthlyRequest, context: TrustedDomainContext) => run(request, context, "planner.apply") }
}

function validMonthlyRequest(request: MonthlyRequest) {
  return !!request && Object.keys(request).every((key) => ["page", "versionId", "drafts"].includes(key)) && (request.page === "OPEX" || request.page === "CAPEX") && typeof request.versionId === "string" && !!request.versionId.trim() && Array.isArray(request.drafts) && request.drafts.length > 0 && request.drafts.every((draft) => !!draft && Object.keys(draft).every((key) => ["rowId", "revision", "cells"].includes(key)) && typeof draft.rowId === "string" && Number.isSafeInteger(draft.revision) && draft.revision >= 0 && Array.isArray(draft.cells) && draft.cells.length > 0 && draft.cells.every((cell: MonthlyDraft["cells"][number]) => !!cell && Object.keys(cell).every((key) => ["measure", "month", "text"].includes(key)) && ["budget", "actual", "forecast"].includes(cell.measure) && Number.isInteger(cell.month) && cell.month >= 1 && cell.month <= 12 && typeof cell.text === "string"))
}
