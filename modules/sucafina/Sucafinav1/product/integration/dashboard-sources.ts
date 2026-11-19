import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { createDashboardSourceHost, dashboardSourceSelector } from "../dashboard/sources.ts"
import type { SfScopedSourcePort, SfSourceScope } from "./source-lifecycle.ts"
import { canonicalScopedSourceCheck } from "./source-lifecycle.ts"
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

type DashboardRecordSelection = { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }
type CompletedRecordIssuance = {
  issued: { scope: SfSourceScope; source: SourceRef }
  evidence: Extract<BusinessEvidenceRef, { kind: "record" }>
}
type RecordIssuanceReader = (selection: DashboardRecordSelection, context: TrustedDomainContext) => Promise<CompletedRecordIssuance | undefined>
// Only this factory registers readers. The registry retains providers, never an
// observation or a proof from an earlier call.
const recordIssuanceReaders = new WeakMap<object, { host: DomainPortHost; sources: SfScopedSourcePort; check: ReturnType<typeof canonicalScopedSourceCheck>; read: RecordIssuanceReader }>()

/** Wrappers and other hosts keep the independent resolver path. */
export function dashboardRecordIssuanceReader(issuer: object, host: DomainPortHost, sources: SfScopedSourcePort): RecordIssuanceReader | undefined {
  const owned = recordIssuanceReaders.get(issuer)
  return owned?.host === host && owned.sources === sources && owned.check && canonicalScopedSourceCheck(sources) === owned.check ? owned.read : undefined
}

/** The returned scope is host-private and conveys read visibility, not write authority. */
export function createDashboardRecordSourceIssuer(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }) {
  const host = input.host, scopedSources = input.scopedSources
  const check = canonicalScopedSourceCheck(scopedSources)
  const read = async (selection: DashboardRecordSelection, context: TrustedDomainContext, canonicalCheck?: ReturnType<typeof canonicalScopedSourceCheck>): Promise<CompletedRecordIssuance | undefined> => {
    const request = host.requestFor(context), lease = context.lease
    const binding = digestSfValue([context.kind, context.binding])
    const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
    const selectionDigest = digestSfValue(selection)
    const currentAuthority = () => !!request && !request.signal.aborted && host.requestFor(context) === request && context.lease === lease &&
      (!canonicalCheck || canonicalScopedSourceCheck(scopedSources) === canonicalCheck) &&
      digestSfValue([context.kind, context.binding]) === binding && digestSfValue(selection) === selectionDigest &&
      digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) === requestDigest
    if (!request || !currentAuthority() || !await host.revalidate(context) || !currentAuthority() || !selection || !selection.page || !selection.recordType || selection.recordType === "dashboard-page" || !selection.recordId || selection.recordId === "__singleton__" || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !field) || new Set(selection.fields).size !== selection.fields.length || !isSfPeriod(selection.period)) return undefined
    const wanted = { page: selection.page, fields: [...selection.fields].sort(), period: structuredClone(selection.period) }
    const authenticate = (snapshot: Snapshot) => dashboardSelector(host, request, context, snapshot, wanted)
    const selector = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await authenticate(snapshot) }), { signal: request.signal }).catch(() => undefined)
    if (!selector || !currentAuthority()) return undefined
    const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: selection.recordType, recordId: selection.recordId, selector }
    const scopeDigest = digestSfValue(scope)
    const current = await scopedSources.readScopedSource("dashboard", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector)).catch(() => undefined)
    if (!current) return undefined
    const original = structuredClone(current)
    const sourceDigest = digestSfValue(original)
    if (!await host.revalidate(context) || !currentAuthority()) return undefined
    const environment = await host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at)) || !await host.revalidate(context) || !currentAuthority()) return undefined
    const observed = await host.persistence.transaction("dashboard", async (snapshot) => {
      if (digestSfValue(await authenticate(snapshot)) !== digestSfValue(selector)) return { commit: false, value: undefined }
      return { commit: false, value: projectSfSourceScope("dashboard", snapshot, scope, environment.at) }
    }, { signal: request.signal }).catch(() => undefined)
    if (observed === undefined || digestSfValue(observed) !== original.inputDigest) return undefined
    const again = await scopedSources.readScopedSource("dashboard", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector)).catch(() => undefined)
    const sameObservation = () => !!again && digestSfValue(current) === sourceDigest && digestSfValue(again) === sourceDigest && digestSfValue(scope) === scopeDigest && currentAuthority()
    if (!sameObservation() || !await host.revalidate(context) || !sameObservation()) return undefined
    const projection = object(original.projection)
    if (typeof original.incarnation !== "string" || !original.incarnation || !Number.isSafeInteger(original.version) || original.version < 1 || !/^[a-f0-9]{64}$/.test(original.inputDigest) ||
      !original.projection || typeof original.projection !== "object" || Array.isArray(original.projection) || digestSfValue(Object.keys(projection).sort()) !== digestSfValue(wanted.fields)) return undefined
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record",
      refId: dashboardSourceSelector(original.incarnation, original.version), installationId: context.binding.installationId,
      projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed",
      target: { surface: "dashboard", recordType: scope.recordType, recordId: scope.recordId, incarnation: original.incarnation,
        version: original.version, fields: wanted.fields, period: wanted.period, projectionDigest: original.inputDigest } }
    const completed = freezeRecordIssuance<CompletedRecordIssuance>(structuredClone({
      issued: { scope, source: { surface: "dashboard", type: scope.recordType, id: scope.recordId, incarnation: original.incarnation,
        version: original.version, fields: wanted.fields, period: wanted.period, observedAt: new Date(environment.at).toISOString() } },
      evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) },
    }))
    // Two returned bodies can agree about fabricated metadata. Reopen the real
    // registry through its factory-owned checker before accepting their identity.
    if (canonicalCheck && (!await canonicalCheck("dashboard", scope,
      async (snapshot) => !request.signal.aborted && digestSfValue(await authenticate(snapshot)) === digestSfValue(selector),
      { incarnation: original.incarnation, version: original.version, inputDigest: original.inputDigest }) || !sameObservation())) return undefined
    // The record consumer's final authority check remains independent. Borrowed
    // source bodies and request pins are checked again after that callback.
    if (!await host.revalidate(context) || !sameObservation()) return undefined
    return completed
  }
  const issue = async (selection: DashboardRecordSelection, context: TrustedDomainContext) => {
    const completed = await read(selection, context)
    return completed && structuredClone(completed.issued)
  }
  const complete: RecordIssuanceReader = (selection, context) => read(selection, context, check)
  recordIssuanceReaders.set(issue, { host, sources: scopedSources, check, read: complete })
  return issue
}

function freezeRecordIssuance<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeRecordIssuance)
    Object.freeze(value)
  }
  return value
}

async function dashboardSelector(host: DomainPortHost, request: Request, context: TrustedDomainContext, snapshot: Snapshot, wanted: { page: string; fields: readonly string[]; period: Period }) {
  const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
  if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
  const access = object(object(snapshot.data.access)[principal.id])
  const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
  const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  return { ...wanted, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) }
}
