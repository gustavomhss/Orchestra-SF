import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { Period } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { createDashboardSourceHost, dashboardSourceSelector } from "../dashboard/sources.ts"
import type { SfScopedSourcePort } from "./source-lifecycle.ts"
import { projectSfSourceScope } from "./source-projections.ts"

/** Issues only scopes derived from the current authenticated request and current role map. */
export function createDashboardSourceIssuer(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }) {
  return async (selection: { page: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext): Promise<PortResult<{ selectionRef: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "source-authority-unavailable" }
    if (!selection || typeof selection.page !== "string" || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !field) || new Set(selection.fields).size !== selection.fields.length || !selection.period || typeof selection.period.start !== "string" || typeof selection.period.end !== "string") return { status: "needs-input", reason: "invalid-source-selection" }
    const wanted = { page: selection.page, fields: [...selection.fields].sort(), period: structuredClone(selection.period) }
    const authenticate = (snapshot: Snapshot) => dashboardSelector(input.host, request, context, snapshot, wanted)
    const selector = await input.host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await authenticate(snapshot) }), { signal: request.signal }).catch(() => undefined)
    if (!selector) return { status: "denied", reason: "source-authority-unavailable" }
    const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "dashboard-page", recordId: wanted.page, selector }
    const current = await input.scopedSources.readScopedSource("dashboard", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector)).catch(() => undefined)
    if (!current || !await input.host.revalidate(context)) return { status: "denied", reason: "source-unavailable" }
    const environment = await input.host.environment(request)
    const observed = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      if (digestSfValue(await authenticate(snapshot)) !== digestSfValue(selector)) return { commit: false, value: undefined }
      return { commit: false, value: projectSfSourceScope("dashboard", snapshot, scope, environment.at) }
    }, { signal: request.signal }).catch(() => undefined)
    if (observed === undefined || digestSfValue(observed) !== current.inputDigest || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-clock-changed" }
    const selectionRef = dashboardSourceSelector(current.incarnation, current.version)
    const resolved = await createDashboardSourceHost(input).resolveDashboardSource(selectionRef, context, wanted)
    if (resolved.status !== "ok") return resolved
    if (resolved.value.evidence.target.projectionDigest !== current.inputDigest || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
    return { status: "ok", value: { selectionRef, evidence: resolved.value.evidence } }
  }
}

/** The returned scope is host-private and conveys read visibility, not write authority. */
export function createDashboardRecordSourceIssuer(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }) {
  return async (selection: { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context) || !selection || !selection.page || !selection.recordType || !selection.recordId || selection.recordId === "__singleton__" || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !field) || new Set(selection.fields).size !== selection.fields.length || !selection.period) return undefined
    const wanted = { page: selection.page, fields: [...selection.fields].sort(), period: structuredClone(selection.period) }
    const authenticate = (snapshot: Snapshot) => dashboardSelector(input.host, request, context, snapshot, wanted)
    const selector = await input.host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await authenticate(snapshot) }), { signal: request.signal }).catch(() => undefined)
    if (!selector) return undefined
    const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: selection.recordType, recordId: selection.recordId, selector }
    const current = await input.scopedSources.readScopedSource("dashboard", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector)).catch(() => undefined)
    if (!current || !await input.host.revalidate(context)) return undefined
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at)) || !await input.host.revalidate(context)) return undefined
    const observed = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      if (digestSfValue(await authenticate(snapshot)) !== digestSfValue(selector)) return { commit: false, value: undefined }
      return { commit: false, value: projectSfSourceScope("dashboard", snapshot, scope, environment.at) }
    }, { signal: request.signal }).catch(() => undefined)
    if (observed === undefined || digestSfValue(observed) !== current.inputDigest) return undefined
    const again = await input.scopedSources.readScopedSource("dashboard", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector)).catch(() => undefined)
    if (!again || digestSfValue(again) !== digestSfValue(current) || !await input.host.revalidate(context)) return undefined
    return { scope, source: { surface: "dashboard" as const, type: scope.recordType, id: scope.recordId, incarnation: current.incarnation, version: current.version, fields: wanted.fields, period: wanted.period, observedAt: new Date(environment.at).toISOString() } }
  }
}

async function dashboardSelector(host: DomainPortHost, request: Request, context: TrustedDomainContext, snapshot: Snapshot, wanted: { page: string; fields: readonly string[]; period: Period }) {
  const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
  if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
  const access = object(object(snapshot.data.access)[principal.id])
  const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
  const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  return { ...wanted, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) }
}
