import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { ConfirmationScope, DomainProjection, SourceRef } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../integration/source-lifecycle.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { dashboardSourceSelector } from "./sources.ts"

type ScopedExpected = { scope: SfSourceScope; incarnation: string; version: number; inputDigest: string }
export type DashboardConfirmationObservation =
  | { state: "available"; sourceVersion: number; incarnation: string; scopeFingerprint: string; sourceFingerprint: string; dependencyFingerprint: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; projection: DomainProjection }
  | { state: "access-unavailable" | "dependency-unavailable"; sourceVersion: number }

/** Host-private scope material and read-only transactional fence for C06. */
export function createDashboardConfirmationObserver(input: {
  host: DomainPortHost
  scopedSources: SfScopedSourcePort
  readProjection: (selection: { reference: string; recordType: string; fields: readonly string[]; period: ConfirmationScope["period"] }, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
}) {
  const fences = new Map<string, readonly ScopedExpected[]>()
  const key = (scope: ConfirmationScope, context: TrustedDomainContext, fingerprint: string) => digestSfValue({ scope, principal: context.binding.principalRef, access: context.binding.accessRevision, policy: context.binding.policyVersion, fingerprint })
  const authorize = (request: Request, context: TrustedDomainContext, reference: Pick<SourceRef, "surface" | "type" | "id" | "incarnation">, fields: readonly string[], period: ConfirmationScope["period"]) => async (snapshot: Snapshot, scope: SfSourceScope) => {
    if (request.signal.aborted || reference.surface !== "dashboard" || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== reference.type || scope.recordId !== reference.id) return false
    const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
    const access = object(object(snapshot.data.access)[principal.id])
    const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const selector = object(scope.selector)
    return digestSfValue(selector.actor) === digestSfValue(actor) && digestSfValue(selector.fields) === digestSfValue([...fields].sort()) && digestSfValue(selector.period) === digestSfValue(period)
  }
  const observe = async (scope: ConfirmationScope, context: TrustedDomainContext): Promise<DashboardConfirmationObservation> => {
    const unavailable = { state: "access-unavailable" as const, sourceVersion: 0 }
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context) || !scope || scope.sourceRef.surface !== "dashboard" || !scope.sourceRef.type || !scope.sourceRef.id || !scope.sourceRef.incarnation || !isSfPeriod(scope.period) || !scope.scopeDefinitionVersion || !scope.fields.length || scope.fields.some((field) => typeof field !== "string" || !field) || new Set(scope.fields).size !== scope.fields.length || !Array.isArray(scope.materialDependencies)) return unavailable
    const source = await input.scopedSources.resolveScopedSource("dashboard", scope.sourceRef.incarnation, authorize(request, context, scope.sourceRef, scope.fields, scope.period)).catch(() => undefined)
    if (!source || !await input.host.revalidate(context)) return unavailable
    const dependencies = await Promise.all(scope.materialDependencies.map(async (reference) => {
      if (reference.surface !== "dashboard" || !isSfPeriod(reference.period) || !reference.fields.length || new Set(reference.fields).size !== reference.fields.length) return undefined
      return input.scopedSources.resolveScopedSource("dashboard", reference.incarnation, authorize(request, context, reference, reference.fields, reference.period)).catch(() => undefined)
    }))
    if (dependencies.some((entry) => !entry) || !await input.host.revalidate(context)) return { state: "dependency-unavailable", sourceVersion: source.version }
    const sourceProjection = source.scope.recordType === "dashboard-page" ? object(source.projection) : undefined
    if (sourceProjection && (!Object.hasOwn(sourceProjection, "selected") || typeof sourceProjection.privateDependencyDigest !== "string" || !/^[a-f0-9]{64}$/.test(sourceProjection.privateDependencyDigest))) return unavailable
    const selectedFields = [...scope.fields].sort()
    const selectionRef = dashboardSourceSelector(source.incarnation, source.version)
    const read = await input.readProjection({ reference: selectionRef, recordType: scope.sourceRef.type, fields: selectedFields, period: scope.period }, context).catch(() => undefined)
    if (!read || read.status !== "ok") return unavailable
    const projection = read.value
    if (projection.context.surface !== "dashboard" || projection.context.installationId !== context.binding.installationId || projection.context.projectId !== context.binding.projectId || projection.context.principalRef !== context.binding.principalRef || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion || digestSfValue(projection.context.period) !== digestSfValue(scope.period) || projection.version !== source.version || projection.context.sourceRefs.length !== 1 || projection.context.sourceRefs[0]!.incarnation !== source.incarnation || projection.context.sourceRefs[0]!.version !== source.version || projection.context.sourceRefs[0]!.type !== scope.sourceRef.type || projection.context.sourceRefs[0]!.id !== scope.sourceRef.id || digestSfValue([...projection.context.sourceRefs[0]!.fields].sort()) !== digestSfValue(selectedFields) || digestSfValue(projection.context.sourceRefs[0]!.period) !== digestSfValue(scope.period) || new Set(projection.values.map((value) => value.id)).size !== projection.values.length) return unavailable
    if (projection.values.some((value) => !value.sourceRefs.length || value.sourceRefs.some((reference) => reference.kind !== "record" || reference.refDigest !== digestSfEvidenceRef(reference) || reference.refId !== selectionRef || reference.installationId !== context.binding.installationId || reference.projectId !== context.binding.projectId || digestSfValue(reference.target.fields) !== digestSfValue(selectedFields) || digestSfValue(reference.target.period) !== digestSfValue(scope.period) || reference.target.surface !== "dashboard" || reference.target.recordType !== scope.sourceRef.type || reference.target.recordId !== scope.sourceRef.id || reference.target.incarnation !== source.incarnation || reference.target.version !== source.version || reference.target.projectionDigest !== source.inputDigest))) return unavailable
    const sourceFingerprint = digestSfValue({ values: projection.values.map((value) => ({ id: value.id, value: value.value, unit: value.unit, currency: value.currency, period: value.period, granularity: value.granularity, evidenceState: value.evidenceState })).sort((a, b) => a.id.localeCompare(b.id)), missing: [...projection.missing].sort((a, b) => a.field.localeCompare(b.field) || a.reason.localeCompare(b.reason)) })
    const external = scope.materialDependencies.map((reference, index) => ({ surface: reference.surface, type: reference.type, id: reference.id, incarnation: reference.incarnation, fields: [...reference.fields].sort(), period: reference.period, projection: dependencies[index]!.inputDigest })).sort((a, b) => digestSfValue(a).localeCompare(digestSfValue(b)))
    if (new Set(external.map((entry) => digestSfValue({ ...entry, projection: undefined }))).size !== external.length) return { state: "dependency-unavailable", sourceVersion: source.version }
    const dependencyFingerprint = digestSfValue({ internal: sourceProjection?.privateDependencyDigest, external })
    const scopeFingerprint = digestSfValue({ sourceRef: scope.sourceRef, fields: [...scope.fields].sort(), period: scope.period, scopeDefinitionVersion: scope.scopeDefinitionVersion, sourceFingerprint, dependencyFingerprint })
    const current = await input.scopedSources.resolveScopedSource("dashboard", scope.sourceRef.incarnation, authorize(request, context, scope.sourceRef, scope.fields, scope.period)).catch(() => undefined)
    if (!current || digestSfValue(current) !== digestSfValue(source) || !await input.host.revalidate(context)) return unavailable
    const expected = [source, ...dependencies].map((entry) => ({ scope: entry!.scope, incarnation: entry!.incarnation, version: entry!.version, inputDigest: entry!.inputDigest }))
    const check = input.scopedSources.checkScopedSource
    const transactionAll = input.host.persistence.transactionAll
    if (!check || !transactionAll) return unavailable
    const references = [scope.sourceRef, ...scope.materialDependencies]
    const selections = [{ fields: scope.fields, period: scope.period }, ...scope.materialDependencies]
    const stable = await transactionAll(async () => {
      for (const [index, entry] of expected.entries()) {
        const allowed = authorize(request, context, references[index]!, selections[index]!.fields, selections[index]!.period)
        if (!await check("dashboard", entry.scope, (snapshot) => allowed(snapshot, entry.scope), entry)) return { commit: false, value: false }
      }
      return { commit: false, value: true }
    }).catch(() => false)
    if (!stable || !await input.host.revalidate(context)) return unavailable
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: dashboardSourceSelector(source.incarnation, source.version), installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: scope.sourceRef.type, recordId: scope.sourceRef.id, incarnation: source.incarnation, version: source.version, fields: [...scope.fields].sort(), period: scope.period, projectionDigest: source.inputDigest } }
    fences.set(key(scope, context, scopeFingerprint), expected)
    if (fences.size > 512) fences.delete(fences.keys().next().value!)
    return { state: "available", sourceVersion: source.version, incarnation: source.incarnation, scopeFingerprint, sourceFingerprint, dependencyFingerprint, evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) }, projection: structuredClone(projection) }
  }
  const fence = async (scope: ConfirmationScope, observation: Extract<DashboardConfirmationObservation, { state: "available" }>, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    const check = input.scopedSources.checkScopedSource
    const expected = fences.get(key(scope, context, observation.scopeFingerprint))
    if (!request || request.signal.aborted || !check || !expected || expected.length !== scope.materialDependencies.length + 1 || observation.incarnation !== expected[0]!.incarnation || observation.sourceVersion !== expected[0]!.version) return false
    const references = [scope.sourceRef, ...scope.materialDependencies]
    const selections = [{ fields: scope.fields, period: scope.period }, ...scope.materialDependencies]
    for (const [index, entry] of expected.entries()) {
      const allowed = authorize(request, context, references[index]!, selections[index]!.fields, selections[index]!.period)
      if (!await check("dashboard", entry.scope, (snapshot) => allowed(snapshot, entry.scope), entry)) return false
    }
    return true
  }
  return { observe, fence }
}

/** Baselines come from a protected displayed-observation receipt, never from a model. */
export function classifyDashboardConfirmationChange(current: Pick<Extract<DashboardConfirmationObservation, { state: "available" }>, "scopeFingerprint" | "sourceFingerprint" | "dependencyFingerprint">, baseline: Pick<Extract<DashboardConfirmationObservation, { state: "available" }>, "scopeFingerprint" | "sourceFingerprint" | "dependencyFingerprint">) {
  if (current.scopeFingerprint === baseline.scopeFingerprint) return "unchanged-scope" as const
  if (current.sourceFingerprint !== baseline.sourceFingerprint) return "material-change" as const
  if (current.dependencyFingerprint !== baseline.dependencyFingerprint) return "dependency-change" as const
  return "material-change" as const
}
