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
import { createDashboardConfirmationIssuer } from "./confirmation-issuer.ts"
import { dashboardConfirmationManifest } from "./confirmation-manifest.ts"
import { projectSfSourceScope } from "../integration/source-projections.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Identity = Pick<SourceRef, "surface" | "type" | "id" | "incarnation">
type ScopedExpected = { scope: SfSourceScope; incarnation: string; version: number; inputDigest: string; original: Identity; fields: readonly string[]; period: ConfirmationScope["period"]; physicalFingerprint: string; observedAt: string }
type ScopedContinuityResult =
  | { state: "same"; index: number; fingerprints: readonly string[]; physicalIncarnations: readonly string[] }
  | { state: "replaced" | "unavailable"; index: number; fingerprints: readonly string[] }
export type DashboardConfirmationObservation =
  | { state: "available"; sourceVersion: number; incarnation: string; physicalIncarnation: string; scopeFingerprint: string; sourceFingerprint: string; dependencyFingerprint: string; evidence: RecordEvidence; projection: DomainProjection }
  | { state: "access-unavailable" | "dependency-unavailable" | "replaced"; sourceVersion: number }

/** Host-private scope material and read-only transactional fence for C06. */
export function createDashboardConfirmationObserver(input: {
  host: DomainPortHost
  scopedSources: SfScopedSourcePort
  readProjection: (selection: { reference: string; recordType: string; fields: readonly string[]; period: ConfirmationScope["period"] }, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
}) {
  const issueForActor = createDashboardConfirmationIssuer(input)
  const fences = new Map<string, readonly ScopedExpected[]>()
  const key = (scope: ConfirmationScope, context: TrustedDomainContext, fingerprint: string) => digestSfValue({ scope, principal: context.binding.principalRef, access: context.binding.accessRevision, policy: context.binding.policyVersion, fingerprint })
  const authorize = (request: Request, context: TrustedDomainContext, reference: Identity, fields: readonly string[], period: ConfirmationScope["period"]) => async (snapshot: Snapshot, scope: SfSourceScope) => {
    if (request.signal.aborted || reference.surface !== "dashboard" || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== reference.type || scope.recordId !== reference.id) return false
    const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
    const access = object(object(snapshot.data.access)[principal.id])
    const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const selector = object(scope.selector)
    return digestSfValue(selector.actor) === digestSfValue(actor) && digestSfValue(selector.fields) === digestSfValue([...fields].sort()) && digestSfValue(selector.period) === digestSfValue(period)
  }
  const continuity = (snapshot: Snapshot, original: Identity, fields: readonly string[], period: ConfirmationScope["period"], active: ScopedExpected, context: TrustedDomainContext) => {
    const entries = Object.values(snapshot.sfSources?.scopes ?? {})
    const originalEntries = entries.filter((entry) => entry.incarnation === original.incarnation && entry.scope.recordType === original.type && entry.scope.recordId === original.id)
    const activeEntries = entries.filter((entry) => entry.alive && entry.incarnation === active.incarnation && entry.scope.principalRef === context.binding.principalRef && entry.scope.accessRevision === context.binding.accessRevision && entry.scope.policyVersion === context.binding.policyVersion && entry.scope.recordType === original.type && entry.scope.recordId === original.id)
    const old = originalEntries.length === 1 ? originalEntries[0] : undefined
    const current = activeEntries.length === 1 ? activeEntries[0] : undefined
    const physical = snapshot.sfSources?.records[JSON.stringify([original.type, original.id])]
    if (!old || !current || !physical?.alive || digestSfValue(object(old.scope.selector).fields) !== digestSfValue([...fields].sort()) || digestSfValue(object(old.scope.selector).period) !== digestSfValue(period) || current.sourceIncarnation !== physical.incarnation) return { state: "unavailable" as const }
    if (old.sourceIncarnation !== physical.incarnation) return { state: "replaced" as const }
    // Compare both actors' authorized material at the same snapshot before reporting change.
    // A narrower current viewer must not learn that hidden material changed.
    const originalSelector = object(old.scope.selector)
    const originalActor = object(originalSelector.actor)
    const originalScope = { ...old.scope, selector: { ...originalSelector, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) } }
    const comparison = structuredClone(snapshot)
    const access = object(comparison.data.access)
    comparison.data.access = { ...access, [old.scope.principalRef]: { ...object(access[old.scope.principalRef]), assigned: originalActor.assigned, domains: originalActor.domains } }
    const originalProjection = projectSfSourceScope("dashboard", comparison, originalScope, active.observedAt)
    if (originalProjection === undefined || digestSfValue(originalProjection) !== active.inputDigest) return { state: "unavailable" as const }
    return { state: "same" as const, physicalIncarnation: physical.incarnation, fingerprint: digestSfValue({ surface: original.surface, type: original.type, id: original.id, incarnation: physical.incarnation }) }
  }
  const manifestFor = (scope: ConfirmationScope) => {
    if (!scope || !scope.sourceRef || scope.sourceRef.surface !== "dashboard" || !Array.isArray(scope.fields) || !Array.isArray(scope.materialDependencies) || !isSfPeriod(scope.period)) return undefined
    const manifest = dashboardConfirmationManifest(scope.sourceRef.type, scope.fields)
    if (!manifest || scope.scopeDefinitionVersion !== manifest.version || scope.materialDependencies.some((reference) => !reference || reference.surface !== "dashboard" || typeof reference.type !== "string" || !reference.type || typeof reference.id !== "string" || !reference.id || typeof reference.incarnation !== "string" || !reference.incarnation || !isSfPeriod(reference.period) || !Array.isArray(reference.fields) || !reference.fields.length || reference.fields.some((field: unknown) => typeof field !== "string" || !field) || new Set(reference.fields).size !== reference.fields.length)) return undefined
    return manifest
  }
  const verifyManifest = async (scope: ConfirmationScope, context: TrustedDomainContext) => !!manifestFor(scope) && !!input.host.requestFor(context) && await input.host.revalidate(context)
  const fenceManifest = async (scope: ConfirmationScope, context: TrustedDomainContext) => !!manifestFor(scope) && !!input.host.requestFor(context) && !!input.host.persistence.currentSnapshots?.()?.dashboard
  const observe = async (scope: ConfirmationScope, context: TrustedDomainContext): Promise<DashboardConfirmationObservation> => {
    const unavailable = { state: "access-unavailable" as const, sourceVersion: 0 }
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context) || !scope || !scope.sourceRef || scope.sourceRef.surface !== "dashboard" || !scope.sourceRef.type || !scope.sourceRef.id || !scope.sourceRef.incarnation || !isSfPeriod(scope.period) || !scope.scopeDefinitionVersion || !Array.isArray(scope.fields) || !scope.fields.length || scope.fields.some((field) => typeof field !== "string" || !field) || new Set(scope.fields).size !== scope.fields.length || !Array.isArray(scope.materialDependencies)) return unavailable
    const manifest = manifestFor(scope)
    if (!manifest) return { state: "dependency-unavailable", sourceVersion: 0 }
    const requested = [{ reference: scope.sourceRef, fields: scope.fields, period: scope.period }, ...scope.materialDependencies.map((reference) => ({ reference, fields: reference.fields, period: reference.period }))]
    if (requested.some((item) => item.reference.surface !== "dashboard" || !isSfPeriod(item.period) || !item.fields.length || new Set(item.fields).size !== item.fields.length)) return { state: "dependency-unavailable", sourceVersion: 0 }
    const logical = requested.map((item) => digestSfValue({ surface: item.reference.surface, type: item.reference.type, id: item.reference.id, fields: [...item.fields].sort(), period: item.period }))
    if (new Set(logical).size !== logical.length) return { state: "dependency-unavailable", sourceVersion: 0 }
    const issued = await Promise.all(requested.map((item) => issueForActor({ recordType: item.reference.type, recordId: item.reference.id, fields: item.fields, period: item.period }, context).catch(() => undefined)))
    if (issued[0]?.status !== "ok") return unavailable
    if (issued.some((entry) => entry?.status !== "ok") || !await input.host.revalidate(context)) return { state: "dependency-unavailable", sourceVersion: 0 }
    const references = issued.map((entry) => (entry as { status: "ok"; value: RecordEvidence }).value)
    const sources = await Promise.all(references.map((reference, index) => input.scopedSources.resolveScopedSource("dashboard", reference.target.incarnation, authorize(request, context, requested[index]!.reference, requested[index]!.fields, requested[index]!.period)).catch(() => undefined)))
    if (!sources[0] || sources.some((entry) => !entry) || !await input.host.revalidate(context)) return unavailable
    const source = sources[0]
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
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at)) || !await input.host.revalidate(context)) return unavailable
    const expected = sources.map((entry, index) => ({ scope: entry!.scope, incarnation: entry!.incarnation, version: entry!.version, inputDigest: entry!.inputDigest, original: requested[index]!.reference, fields: requested[index]!.fields, period: requested[index]!.period, physicalFingerprint: "", observedAt: new Date(environment.at).toISOString() }))
    const check = input.scopedSources.checkScopedSource
    const transactionAll = input.host.persistence.transactionAll
    if (!check || !transactionAll) return unavailable
    const stable = await transactionAll<ScopedContinuityResult>(async (snapshots) => {
      const fingerprints: string[] = []
      const physicalIncarnations: string[] = []
      for (const [index, entry] of expected.entries()) {
        const same = continuity(snapshots.dashboard, entry.original, entry.fields, entry.period, entry, context)
        if (same.state !== "same") return { commit: false, value: { state: same.state, index, fingerprints: [] as string[] } }
        const allowed = authorize(request, context, entry.original, entry.fields, entry.period)
        if (!await check("dashboard", entry.scope, (snapshot) => allowed(snapshot, entry.scope), entry)) return { commit: false, value: { state: "unavailable" as const, index, fingerprints: [] as string[] } }
        fingerprints.push(same.fingerprint)
        physicalIncarnations.push(same.physicalIncarnation)
      }
      return { commit: false, value: { state: "same" as const, index: -1, fingerprints, physicalIncarnations } }
    }).catch(() => undefined)
    if (!stable || !await input.host.revalidate(context)) return unavailable
    if (stable.state === "replaced") return stable.index === 0 ? { state: "replaced", sourceVersion: source.version } : { state: "dependency-unavailable", sourceVersion: source.version }
    if (stable.state !== "same") return unavailable
    expected.forEach((entry, index) => { entry.physicalFingerprint = stable.fingerprints[index]! })
    const external = scope.materialDependencies.map((reference, index) => ({ surface: reference.surface, type: reference.type, id: reference.id, physical: stable.fingerprints[index + 1], fields: [...reference.fields].sort(), period: reference.period, projection: sources[index + 1]!.inputDigest })).sort((a, b) => digestSfValue(a).localeCompare(digestSfValue(b)))
    const dependencyFingerprint = digestSfValue({ manifest, internal: sourceProjection?.privateDependencyDigest, external })
    const scopeFingerprint = digestSfValue({ source: stable.fingerprints[0], fields: selectedFields, period: scope.period, scopeDefinitionVersion: scope.scopeDefinitionVersion, sourceFingerprint, dependencyFingerprint })
    const evidence = references[0]!
    if (evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.target.projectionDigest !== source.inputDigest || evidence.target.incarnation !== source.incarnation || evidence.target.version !== source.version) return unavailable
    fences.set(key(scope, context, scopeFingerprint), expected)
    if (fences.size > 512) fences.delete(fences.keys().next().value!)
    return { state: "available", sourceVersion: source.version, incarnation: source.incarnation, physicalIncarnation: stable.physicalIncarnations[0]!, scopeFingerprint, sourceFingerprint, dependencyFingerprint, evidence, projection: structuredClone(projection) }
  }
  const fence = async (scope: ConfirmationScope, observation: Extract<DashboardConfirmationObservation, { state: "available" }>, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    const check = input.scopedSources.checkScopedSource
    const snapshot = input.host.persistence.currentSnapshots?.()?.dashboard
    const expected = fences.get(key(scope, context, observation.scopeFingerprint))
    if (!request || request.signal.aborted || !check || !snapshot || !expected || expected.length !== scope.materialDependencies.length + 1 || observation.incarnation !== expected[0]!.incarnation || observation.sourceVersion !== expected[0]!.version || digestSfValue({ surface: scope.sourceRef.surface, type: scope.sourceRef.type, id: scope.sourceRef.id, incarnation: observation.physicalIncarnation }) !== expected[0]!.physicalFingerprint) return false
    for (const entry of expected) {
      const same = continuity(snapshot, entry.original, entry.fields, entry.period, entry, context)
      if (same.state !== "same" || same.fingerprint !== entry.physicalFingerprint) return false
      const allowed = authorize(request, context, entry.original, entry.fields, entry.period)
      if (!await check("dashboard", entry.scope, (current) => allowed(current, entry.scope), entry)) return false
    }
    return true
  }
  const prepareReissueScope = async (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext): Promise<PortResult<{ fence: () => Promise<boolean> }>> => {
    if (!original || !current || original.kind !== "record" || current.kind !== "record" || original.refDigest !== digestSfEvidenceRef(original) || current.refDigest !== digestSfEvidenceRef(current) || original.installationId !== context.binding.installationId || original.projectId !== context.binding.projectId || current.installationId !== context.binding.installationId || current.projectId !== context.binding.projectId || original.target.surface !== "dashboard" || current.target.surface !== "dashboard" || original.target.recordType !== current.target.recordType || original.target.recordId !== current.target.recordId || !isSfPeriod(original.target.period) || digestSfValue(original.target.period) !== digestSfValue(current.target.period) || digestSfValue([...original.target.fields].sort()) !== digestSfValue([...current.target.fields].sort())) return { status: "unavailable", reason: "material-scope-unavailable" }
    const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: original.target.recordType, id: original.target.recordId, incarnation: original.target.incarnation }, fields: [...original.target.fields], period: { ...original.target.period }, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const manifest = manifestFor(scope)
    if (!manifest || manifest.requiredExternal.length) return { status: "unavailable", reason: "material-scope-unavailable" }
    const observation = await observe(scope, context)
    if (observation.state !== "available" || observation.evidence.refDigest !== current.refDigest || digestSfValue(observation.evidence.target) !== digestSfValue(current.target)) return { status: "unavailable", reason: "material-scope-unavailable" }
    return { status: "ok", value: { fence: () => fence(scope, observation, context) } }
  }
  return { issueForActor, manifestFor, verifyManifest, fenceManifest, observe, fence, prepareReissueScope }
}

/** Baselines come from a protected displayed-observation receipt, never from a model. */
export function classifyDashboardConfirmationChange(current: Pick<Extract<DashboardConfirmationObservation, { state: "available" }>, "scopeFingerprint" | "sourceFingerprint" | "dependencyFingerprint">, baseline: Pick<Extract<DashboardConfirmationObservation, { state: "available" }>, "scopeFingerprint" | "sourceFingerprint" | "dependencyFingerprint">) {
  if (current.scopeFingerprint === baseline.scopeFingerprint) return "unchanged-scope" as const
  if (current.sourceFingerprint !== baseline.sourceFingerprint) return "material-change" as const
  if (current.dependencyFingerprint !== baseline.dependencyFingerprint) return "dependency-change" as const
  return "material-change" as const
}
