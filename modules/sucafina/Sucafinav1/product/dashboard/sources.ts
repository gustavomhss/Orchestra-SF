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
import { dashboardRecordIssuanceReader } from "../integration/dashboard-sources.ts"

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

type DashboardRecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type DashboardRecordObservation = { evidence: DashboardRecordRef; projection: DomainProjection }
type DashboardRecordObservationReader = <Value>(reference: string, context: TrustedDomainContext, consumer: {
  current: () => boolean
  before: (evidence: DashboardRecordRef) => Promise<boolean>
  project: (observation: DashboardRecordObservation) => PortResult<Value>
  after: () => Promise<boolean>
}) => Promise<PortResult<Value>>
const recordObservationReaders = new WeakMap<object, {
  host: DomainPortHost; resolve: object; read: object; observe: DashboardRecordObservationReader
}>()

/** Composition belongs only to the original factory and its unchanged methods.
 * The registry retains capabilities, never a source observation or authorization. */
export function dashboardRecordObservationReader(records: object, host: DomainPortHost): DashboardRecordObservationReader | undefined {
  const owned = recordObservationReaders.get(records)
  return owned?.host === host && Object.getOwnPropertyDescriptor(records, "resolve")?.value === owned.resolve &&
    Object.getOwnPropertyDescriptor(records, "read")?.value === owned.read ? owned.observe : undefined
}

/** Scoped record references are opaque selectors; each resolution reauthenticates the caller. */
export function createDashboardRecordEvidenceHost(input: {
  host: DomainPortHost
  scopedSources: SfScopedSourcePort
  issueRecord: (selection: { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => Promise<{ scope: SfSourceScope; source: SourceRef } | undefined>
}) {
  const host = input.host, scopedSources = input.scopedSources
  type RecordObservation = { evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; projection: Record<string, unknown> }
  const resolveCurrent = async <T>(reference: string, context: TrustedDomainContext,
    project: (value: RecordObservation, request: Request) => PortResult<T> | Promise<PortResult<T>>,
    complete?: { publish: (result: PortResult<T>) => Promise<PortResult<T>>; current: () => boolean }): Promise<PortResult<T>> => {
    const parts = /^sf-source:([^:]+):([1-9]\d*)$/.exec(reference)
    const incarnation = parts && safeDecode(parts[1]!)
    if (!incarnation || encodeURIComponent(incarnation) !== parts?.[1] || !Number.isSafeInteger(Number(parts[2]))) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
    const request = host.requestFor(context), lease = context.lease
    const binding = digestSfValue([context.kind, context.binding])
    const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
    const currentAuthority = () => !!request && !request.signal.aborted && host.requestFor(context) === request && context.lease === lease &&
      digestSfValue([context.kind, context.binding]) === binding &&
      digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) === requestDigest
    if (!request || !currentAuthority() || !await host.revalidate(context) || !currentAuthority()) return { status: "denied", reason: "source-authority-unavailable" }
    const read = () => scopedSources.resolveScopedSource("dashboard", incarnation, async (snapshot, scope) => {
      if (request.signal.aborted || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType === "dashboard-page") return false
      const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return digestSfValue(object(scope.selector).actor) === digestSfValue(actor)
    })
    const observed = await read().catch(() => undefined)
    if (!observed || !await host.revalidate(context)) return { status: "denied", reason: "source-unavailable" }
    const current = structuredClone(observed)
    const sourceDigest = digestSfValue(current)
    if (current.version !== Number(parts[2])) return { status: "stale", reason: "source-replaced-or-changed" }
    const selector = object(current.scope.selector)
    if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || !selector.fields.length || selector.fields.some((field) => typeof field !== "string" || !field) || new Set(selector.fields).size !== selector.fields.length || !isSfPeriod(selector.period)) return { status: "unavailable", reason: "invalid-source-scope" }
    const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: current.scope.recordType, recordId: current.scope.recordId, incarnation, version: current.version, fields: selector.fields, period: selector.period, projectionDigest: current.inputDigest } }
    const projection = object(current.projection)
    const projected: PortResult<T> = !current.projection || typeof current.projection !== "object" || Array.isArray(current.projection) ||
      digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...selector.fields].sort())
      ? { status: "unavailable", reason: "invalid-record-projection" }
      : await project({ evidence: { ...value, refDigest: digestSfEvidenceRef(value) }, projection }, request)
    // Projection work belongs between the source producer's independent
    // observations. Reopening that entire producer twice repeats the same proof.
    const again = await read().catch(() => undefined)
    if (!again || digestSfValue(again) !== sourceDigest || !await host.revalidate(context) ||
      digestSfValue(again) !== sourceDigest || !currentAuthority())
      return { status: "stale", reason: "source-or-authority-changed" }
    if (!complete) return projected
    // The consumer's independent final authorization may await. Neither borrowed
    // source body nor the request may change after the producer's last check.
    const completed = await complete.publish(projected)
    if (!currentAuthority() || !complete.current() || digestSfValue(observed) !== sourceDigest || digestSfValue(again) !== sourceDigest)
      return { status: "stale", reason: "source-or-authority-changed" }
    return completed
  }
  const projectRecord = async ({ evidence: ref, projection }: RecordObservation, request: Request,
    context: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
    const environment = await host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
    const period = ref.target.period
    if (!period) return { status: "unavailable", reason: "source-period-unavailable" }
    if (ref.target.recordType === "hotTopics" && (period.start !== new Date(environment.at).toISOString().slice(0, 10) || period.end !== period.start)) return { status: "stale", reason: "source-observation-day-changed" }
    const values: DomainProjection["values"][number][] = []
    const missing: DomainProjection["missing"][number][] = []
    for (const field of ref.target.fields) {
      const value = projection[field] === undefined ? null : projection[field]
      if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value))) return { status: "unavailable", reason: "non-scalar-record-field" }
      const id = `${ref.target.recordType}:${encodeURIComponent(ref.target.recordId)}:${encodeURIComponent(field)}`
      values.push({ id, value, period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: value === null ? "absent" : "confirmed" })
      if (value === null) missing.push({ field: id, reason: "missing" })
    }
    const source = { surface: "dashboard" as const, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation, version: ref.target.version, fields: ref.target.fields, period, observedAt: new Date(environment.at).toISOString() }
    return { status: "ok", value: { context: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "dashboard", period, currency: "unspecified", sourceRefs: [source], capabilities: [] }, version: ref.target.version, engineVersion: "dashboard-record-v1", components: [], values, missing } }
  }
  const resolve = async (reference: string, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    return resolveCurrent(reference, context, ({ evidence }) => ({ status: "ok", value: evidence }))
  }
  const read = (reference: string, context: TrustedDomainContext): Promise<PortResult<DomainProjection>> =>
    resolveCurrent(reference, context, (value, request) => projectRecord(value, request, context))
  const records = {
    resolve,
    read,
    issue: async (selection: { page: string; recordType: string; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
      if (!selection || typeof selection.page !== "string" || !selection.page || typeof selection.recordType !== "string" || !selection.recordType || typeof selection.recordId !== "string" || !selection.recordId || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !field) || new Set(selection.fields).size !== selection.fields.length || !isSfPeriod(selection.period)) return { status: "needs-input", reason: "invalid-source-selection" }
      const issueRecord = input.issueRecord
      const read = dashboardRecordIssuanceReader(issueRecord, host, scopedSources)
      const request = read && host.requestFor(context), lease = context.lease
      const binding = digestSfValue([context.kind, context.binding]), selectionDigest = digestSfValue(selection)
      const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
      const completed = read && await read(selection, context).catch(() => undefined)
      const issued = read ? completed?.issued : await issueRecord(selection, context).catch(() => undefined)
      if (!issued || issued.source.surface !== "dashboard" || issued.source.type !== selection.recordType || issued.source.id !== selection.recordId || digestSfValue([...issued.source.fields].sort()) !== digestSfValue([...selection.fields].sort()) || digestSfValue(issued.source.period) !== digestSfValue(selection.period) || object(issued.scope.selector).page !== selection.page) return { status: "denied", reason: "source-unavailable" }
      // Only the original factory and its exact host/source pair can complete
      // this path. A substituted issuer still goes through resolveCurrent.
      if (read && (!completed || !request || request.signal.aborted || host.requestFor(context) !== request || context.lease !== lease ||
        input.issueRecord !== issueRecord || dashboardRecordIssuanceReader(issueRecord, host, scopedSources) !== read ||
        digestSfValue([context.kind, context.binding]) !== binding || digestSfValue(selection) !== selectionDigest ||
        digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) !== requestDigest))
        return { status: "stale", reason: "source-or-authority-changed" }
      const resolved: PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>> = completed
        ? { status: "ok", value: structuredClone(completed.evidence) }
        : await resolve(dashboardSourceSelector(issued.source.incarnation, issued.source.version), context)
      if (resolved.status !== "ok") return resolved
      if (resolved.value.target.recordType !== selection.recordType || resolved.value.target.recordId !== selection.recordId || digestSfValue(resolved.value.target.fields) !== digestSfValue([...selection.fields].sort()) || digestSfValue(resolved.value.target.period) !== digestSfValue(selection.period)) return { status: "stale", reason: "source-or-authority-changed" }
      return resolved
    },
  }
  const observe: DashboardRecordObservationReader = async (reference, context, consumer) => {
    const { current: consumerCurrent, before, project, after } = consumer
    const current = () => consumerCurrent() && dashboardRecordObservationReader(records, host) === observe
    const denied = (): PortResult<never> => ({ status: "denied", reason: "source-authority-unavailable" })
    if (!current()) return denied()
    return resolveCurrent(reference, context, async (observation, request) => {
      // Callbacks receive detached, frozen values; the private source bodies and
      // their comparison digest never leave this invocation.
      const evidence = freezeRecordObservation(structuredClone(observation.evidence))
      if (!current() || !await before(evidence) || !current()) return denied()
      const projection = await projectRecord(observation, request, context)
      if (projection.status !== "ok") return projection
      if (!current()) return denied()
      return project(freezeRecordObservation(structuredClone({ evidence, projection: projection.value })))
    }, { current, publish: async (result) => {
      if (result.status !== "ok") return result
      if (!current() || !await after() || !current()) return denied()
      return result
    } })
  }
  recordObservationReaders.set(records, { host, resolve, read, observe })
  return records
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}

function freezeRecordObservation<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value)
    for (const child of Object.values(value)) freezeRecordObservation(child, seen)
    Object.freeze(value)
  }
  return value
}
