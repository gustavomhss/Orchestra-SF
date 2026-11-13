import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../integration/source-lifecycle.ts"
import type { DashboardSourceHost } from "./port.ts"
import type { DomainProjection, Period, SourceRef } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"

export function dashboardSourceSelector(incarnation: string, version: number) {
  return `sf-source:${encodeURIComponent(incarnation)}:${version}`
}

export function dashboardMetricSelector(selectionRef: string, metric: string) {
  return `dashboard-metric:${encodeURIComponent(selectionRef)}:${encodeURIComponent(metric)}`
}

export function createDashboardSourceHost(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }): DashboardSourceHost {
  const host = input.host
  const sources: DashboardSourceHost = {
    resolveDashboardSource: async (reference, context, selection): Promise<PortResult<{ page: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
      const parts = /^sf-source:([^:]+):([1-9]\d*)$/.exec(reference)
      const incarnation = parts && safeDecode(parts[1]!)
      if (!incarnation || encodeURIComponent(incarnation) !== parts?.[1] || !Number.isSafeInteger(Number(parts[2]))) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
      const request = host.requestFor(context)
      if (!request || !(await host.revalidate(context))) return { status: "denied", reason: "source-authority-unavailable" }
      const read = () => input.scopedSources.resolveScopedSource("dashboard", incarnation, async (snapshot, scope) => {
        if (request.signal.aborted || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== "dashboard-page") return false
        const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
        if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        const selector = object(scope.selector)
        if (scope.recordId !== selector.page || digestSfValue(selector.actor) !== digestSfValue(actor)) return false
        if (selection && (digestSfValue(selector.fields) !== digestSfValue([...selection.fields].sort()) || digestSfValue(selector.period) !== digestSfValue(selection.period))) return false
        return true
      })
      const current = await read().catch(() => undefined)
      if (!current || !(await host.revalidate(context))) return { status: "denied", reason: "source-unavailable" }
      if (current.version !== Number(parts[2])) return { status: "stale", reason: "source-replaced-or-changed" }
      const selector = object(current.scope.selector)
      const period = object(selector.period)
      if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || selector.fields.some((field) => typeof field !== "string") || typeof period.start !== "string" || typeof period.end !== "string") return { status: "unavailable", reason: "invalid-source-scope" }
      const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "dashboard-page", recordId: selector.page, incarnation, version: current.version, fields: selector.fields, period: { start: period.start, end: period.end }, projectionDigest: current.inputDigest } }
      const again = await read().catch(() => undefined)
      if (!again || digestSfValue(again) !== digestSfValue(current) || !(await host.revalidate(context))) return { status: "stale", reason: "source-or-authority-changed" }
      return { status: "ok", value: { page: selector.page, evidence: { ...value, refDigest: digestSfEvidenceRef(value) } } }
    },
    resolveDashboardMetric: async (reference, context) => {
      const parts = /^dashboard-metric:([^:]+):([^:]+)$/.exec(reference)
      const selectionRef = parts && safeDecode(parts[1]!)
      const metric = parts && safeDecode(parts[2]!)
      if (!selectionRef || !metric || encodeURIComponent(selectionRef) !== parts?.[1] || encodeURIComponent(metric) !== parts?.[2]) return { status: "needs-input", reason: "invalid-dashboard-metric-selector" }
      const result = await sources.resolveDashboardSource(selectionRef, context)
      if (result.status !== "ok") return result
      if (!result.value.evidence.target.period) return { status: "unavailable", reason: "metric-period-unavailable" }
      const year = result.value.evidence.target.period.start.slice(0, 4)
      if (metric === "total-budget" && ["Budget Overview", "Executive Dashboard"].includes(result.value.page)) return { status: "ok", value: { selectionRef, field: "budgetMetrics", valuePrefix: `budgetMetrics.${year}.totalBudget` } }
      const monthly = /^(opened|closed|netChange|backlog):(0[1-9]|1[0-2])$/.exec(metric)
      if (monthly && result.value.page === "Executive Dashboard") return { status: "ok", value: { selectionRef, field: "executiveMonths", valuePrefix: `executiveMonths.${year}:${Number(monthly[2])}.${monthly[1]}` } }
      if (metric === "active-headcount" && result.value.page === "Executive Dashboard") return { status: "ok", value: { selectionRef, field: "executive", valuePrefix: "executive.active" } }
      return { status: "unavailable", reason: "metric-not-available-for-page" }
    },
  }
  return sources
}

/** Scoped record references are opaque selectors; each resolution reauthenticates the caller. */
export function createDashboardRecordEvidenceHost(input: {
  host: DomainPortHost
  scopedSources: SfScopedSourcePort
  issueRecord: (selection: { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => Promise<{ scope: SfSourceScope; source: SourceRef } | undefined>
}) {
  const resolveCurrent = async (reference: string, context: TrustedDomainContext): Promise<PortResult<{ evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; projection: Record<string, unknown> }>> => {
    const parts = /^sf-source:([^:]+):([1-9]\d*)$/.exec(reference)
    const incarnation = parts && safeDecode(parts[1]!)
    if (!incarnation || encodeURIComponent(incarnation) !== parts?.[1] || !Number.isSafeInteger(Number(parts[2]))) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "source-authority-unavailable" }
    const read = () => input.scopedSources.resolveScopedSource("dashboard", incarnation, async (snapshot, scope) => {
      if (request.signal.aborted || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType === "dashboard-page") return false
      const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return digestSfValue(object(scope.selector).actor) === digestSfValue(actor)
    })
    const current = await read().catch(() => undefined)
    if (!current || !await input.host.revalidate(context)) return { status: "denied", reason: "source-unavailable" }
    if (current.version !== Number(parts[2])) return { status: "stale", reason: "source-replaced-or-changed" }
    const selector = object(current.scope.selector)
    if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || !selector.fields.length || selector.fields.some((field) => typeof field !== "string" || !field) || new Set(selector.fields).size !== selector.fields.length || !isSfPeriod(selector.period)) return { status: "unavailable", reason: "invalid-source-scope" }
    const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: current.scope.recordType, recordId: current.scope.recordId, incarnation, version: current.version, fields: selector.fields, period: selector.period, projectionDigest: current.inputDigest } }
    const again = await read().catch(() => undefined)
    if (!again || digestSfValue(again) !== digestSfValue(current) || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
    const projection = object(current.projection)
    if (!current.projection || typeof current.projection !== "object" || Array.isArray(current.projection) || digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...selector.fields].sort())) return { status: "unavailable", reason: "invalid-record-projection" }
    return { status: "ok", value: { evidence: { ...value, refDigest: digestSfEvidenceRef(value) }, projection } }
  }
  const resolve = async (reference: string, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    const result = await resolveCurrent(reference, context)
    return result.status === "ok" ? { status: "ok", value: result.value.evidence } : result
  }
  return {
    resolve,
    read: async (reference: string, context: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
      const result = await resolveCurrent(reference, context)
      if (result.status !== "ok") return result
      const request = input.host.requestFor(context)
      if (!request) return { status: "denied", reason: "source-authority-unavailable" }
      const environment = await input.host.environment(request)
      if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
      const ref = result.value.evidence
      const period = ref.target.period
      if (!period) return { status: "unavailable", reason: "source-period-unavailable" }
      if (ref.target.recordType === "hotTopics" && (period.start !== new Date(environment.at).toISOString().slice(0, 10) || period.end !== period.start)) return { status: "stale", reason: "source-observation-day-changed" }
      const values: DomainProjection["values"][number][] = []
      const missing: DomainProjection["missing"][number][] = []
      for (const field of ref.target.fields) {
        const value = result.value.projection[field] === undefined ? null : result.value.projection[field]
        if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value))) return { status: "unavailable", reason: "non-scalar-record-field" }
        const id = `${ref.target.recordType}:${encodeURIComponent(ref.target.recordId)}:${encodeURIComponent(field)}`
        values.push({ id, value, period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: value === null ? "absent" : "confirmed" })
        if (value === null) missing.push({ field: id, reason: "missing" })
      }
      const again = await resolveCurrent(reference, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(result.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
      const source = { surface: "dashboard" as const, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation, version: ref.target.version, fields: ref.target.fields, period, observedAt: new Date(environment.at).toISOString() }
      return { status: "ok", value: { context: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "dashboard", period, currency: "unspecified", sourceRefs: [source], capabilities: [] }, version: ref.target.version, engineVersion: "dashboard-record-v1", components: [], values, missing } }
    },
    issue: async (selection: { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
      if (!selection || typeof selection.page !== "string" || !selection.page || typeof selection.recordType !== "string" || !selection.recordType || typeof selection.recordId !== "string" || !selection.recordId || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !field) || new Set(selection.fields).size !== selection.fields.length || !isSfPeriod(selection.period)) return { status: "needs-input", reason: "invalid-source-selection" }
      const issued = await input.issueRecord(selection, context).catch(() => undefined)
      if (!issued || issued.source.surface !== "dashboard" || issued.source.type !== selection.recordType || issued.source.id !== selection.recordId || digestSfValue([...issued.source.fields].sort()) !== digestSfValue([...selection.fields].sort()) || digestSfValue(issued.source.period) !== digestSfValue(selection.period) || object(issued.scope.selector).page !== selection.page) return { status: "denied", reason: "source-unavailable" }
      const resolved = await resolve(dashboardSourceSelector(issued.source.incarnation, issued.source.version), context)
      if (resolved.status !== "ok") return resolved
      if (resolved.value.target.recordType !== selection.recordType || resolved.value.target.recordId !== selection.recordId || digestSfValue(resolved.value.target.fields) !== digestSfValue([...selection.fields].sort()) || digestSfValue(resolved.value.target.period) !== digestSfValue(selection.period)) return { status: "stale", reason: "source-or-authority-changed" }
      return resolved
    },
  }
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
