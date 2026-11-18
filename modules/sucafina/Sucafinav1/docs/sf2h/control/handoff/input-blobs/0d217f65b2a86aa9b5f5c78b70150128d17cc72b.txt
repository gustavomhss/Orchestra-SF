import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmationScope, DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "./port.ts"
import { plannerMonthlyPrefix } from "./bi.ts"
import type { createPlannerSourceIssuer } from "./source-issuer.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Available = { state: "available"; sourceVersion: number; incarnation: string; physicalIncarnation: string; scopeFingerprint: string; sourceFingerprint: string; dependencyFingerprint: string; evidence: RecordEvidence; projection: DomainProjection }

/** C06 manifest for the actor-visible financial summary; external dependencies require their own producer. */
export function createPlannerConfirmationObserver(input: { host: DomainPortHost; issueSource: ReturnType<typeof createPlannerSourceIssuer>; planner: Pick<PlannerPort, "compareForecast"> }) {
  const fences = new Map<string, { source: RecordEvidence; physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string; at: string; actor: Actor }>()
  const manifestFor = (scope: ConfirmationScope) => scope?.sourceRef?.surface === "planner" && scope.sourceRef.type === "planner-version" && !!scope.sourceRef.id && !!scope.sourceRef.incarnation && scope.scopeDefinitionVersion === "planner-c06-v1" && Array.isArray(scope.fields) && scope.fields.length === 1 && scope.fields[0] === "summary" && isSfPeriod(scope.period) && Array.isArray(scope.materialDependencies) && scope.materialDependencies.length === 0 ? { version: "planner-c06-v1", fields: ["summary"], requiredExternal: [] } : undefined
  const verifyManifest = async (scope: ConfirmationScope, context: TrustedDomainContext) => !!manifestFor(scope) && !!input.host.requestFor(context) && await input.host.revalidate(context)
  const fenceManifest = async (scope: ConfirmationScope, context: TrustedDomainContext) => !!manifestFor(scope) && !!input.host.requestFor(context) && !!input.host.persistence.currentSnapshots?.()?.planner
  const issueForActor = async (target: RecordEvidence["target"], context: TrustedDomainContext): Promise<PortResult<RecordEvidence>> => {
    if (!target || target.surface !== "planner" || target.recordType !== "planner-version" || !target.recordId || !target.period || !Array.isArray(target.fields)) return { status: "unavailable", reason: "material-scope-unavailable" }
    const current = await input.issueSource(target.recordId, context)
    if (current.status !== "ok") return current
    if (digestSfValue([...current.value.evidence.target.fields].sort()) !== digestSfValue([...target.fields].sort()) || digestSfValue(current.value.evidence.target.period) !== digestSfValue(target.period)) return { status: "unavailable", reason: "material-scope-unavailable" }
    return { status: "ok", value: current.value.evidence }
  }
  const fingerprint = (projection: DomainProjection) => digestSfValue({ values: projection.values.map((value) => ({ id: value.id, value: value.value, unit: value.unit, currency: value.currency, period: value.period, granularity: value.granularity, evidenceState: value.evidenceState })), components: projection.components.map((component) => ({ id: component.id, amount: component.amount, currency: component.currency, period: component.period, evidenceState: component.evidenceState })), missing: projection.missing })
  const select = (projection: DomainProjection) => {
    const prefix = plannerMonthlyPrefix(projection.components)
    return { ...projection, values: projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && [":budget", ":actual", ":outlook"].some((suffix) => value.id.endsWith(suffix))) }
  }
  const key = (scope: ConfirmationScope, context: TrustedDomainContext, fingerprint: string) => digestSfValue({ scope, principal: context.binding.principalRef, access: context.binding.accessRevision, policy: context.binding.policyVersion, fingerprint })
  const checkActor = (snapshot: Snapshot, scope: ConfirmationScope, source: RecordEvidence, context: TrustedDomainContext, at: string, actor: Actor) => {
    const access = object(object(snapshot.data.access)[actor.id])
    const assigned = Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : []
    const domains = Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : []
    if (actor.id !== context.binding.principalRef || !actor.roles.some((role) => ["admin", "hr", "finance"].includes(role)) || digestSfValue(actor.assigned ?? []) !== digestSfValue(assigned) || digestSfValue(actor.domains ?? []) !== digestSfValue(domains)) return undefined
    const currentScope = { principalRef: actor.id, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: scope.sourceRef.id, selector: sfPlannerProjectionSelector(snapshot, actor) }
    const current = sfScopedSourceIdentity(snapshot, currentScope)
    const entries = Object.values(snapshot.sfSources?.scopes ?? {})
    const old = entries.filter((entry) => entry.incarnation === scope.sourceRef.incarnation && entry.scope.recordType === scope.sourceRef.type && entry.scope.recordId === scope.sourceRef.id)
    const active = snapshot.sfSources?.scopes?.[digestSfValue(currentScope)]
    const physical = snapshot.sfSources?.records[JSON.stringify([scope.sourceRef.type, scope.sourceRef.id])]
    const projection = projectPlannerSource(snapshot, actor, scope.sourceRef.id)
    if (old.length !== 1 || !active?.alive || !physical?.alive || !current || !projection || active.sourceIncarnation !== physical.incarnation || current.incarnation !== source.target.incarnation || current.version !== source.target.version || digestSfValue({ versionId: scope.sourceRef.id, projection }) !== source.target.projectionDigest) return undefined
    if (old[0]!.sourceIncarnation !== physical.incarnation) return { replaced: true as const, version: current.version }
    const originalProjection = projectSfSourceScope("planner", snapshot, old[0]!.scope, at)
    if (originalProjection === undefined || digestSfValue(originalProjection) !== digestSfValue(projection)) return undefined
    const financial = select(buildPlannerFinancialProjection({ projection, ref: source, period: scope.period, binding: context, at }))
    const sourceFingerprint = fingerprint(financial)
    const dependencyFingerprint = digestSfValue({ fx: projection.fx, hc: projection.hc, entities: projection.sharedEntities, allocations: projection.sharedAllocations, year: projection.year, closed: projection.closed })
    const scopeFingerprint = digestSfValue({ physical: physical.incarnation, fields: scope.fields, period: scope.period, manifest: scope.scopeDefinitionVersion, sourceFingerprint, dependencyFingerprint })
    return { replaced: false as const, version: current.version, incarnation: current.incarnation, physicalIncarnation: physical.incarnation, sourceFingerprint, dependencyFingerprint, scopeFingerprint, projection: financial }
  }
  const check = async (snapshot: Snapshot, scope: ConfirmationScope, source: RecordEvidence, context: TrustedDomainContext, at: string) => {
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted) return undefined
    const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const result = checkActor(snapshot, scope, source, context, at, actor)
    return result && !result.replaced ? { ...result, actor } : result
  }

  const observe = async (scope: ConfirmationScope, context: TrustedDomainContext) => {
    if (!await verifyManifest(scope, context)) return { state: "access-unavailable" as const, sourceVersion: 0 }
    const request = input.host.requestFor(context)!
    const source = await input.issueSource(scope.sourceRef.id, context)
    if (source.status !== "ok") return { state: "access-unavailable" as const, sourceVersion: 0 }
    if (!source.value.evidence.target.period || source.value.evidence.target.period.start > scope.period.start || source.value.evidence.target.period.end < scope.period.end) return { state: "dependency-unavailable" as const, sourceVersion: source.value.evidence.target.version }
    const compared = await input.planner.compareForecast({ baseRef: source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: scope.period, currency: "USD" }, context)
    if (compared.status !== "ok") return { state: "access-unavailable" as const, sourceVersion: source.value.evidence.target.version }
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at)) || !input.host.persistence.transactionAll) return { state: "access-unavailable" as const, sourceVersion: 0 }
    const checked = await input.host.persistence.transactionAll(async (snapshots) => ({ commit: false, value: await check(snapshots.planner, scope, source.value.evidence, context, environment.at) })).catch(() => undefined)
    if (!checked || !await input.host.revalidate(context)) return { state: "access-unavailable" as const, sourceVersion: 0 }
    if (checked.replaced) return { state: "replaced" as const, sourceVersion: checked.version }
    if (fingerprint(select(compared.value.baseline)) !== checked.sourceFingerprint) return { state: "access-unavailable" as const, sourceVersion: 0 }
    fences.set(key(scope, context, checked.scopeFingerprint), { source: source.value.evidence, physicalIncarnation: checked.physicalIncarnation, sourceFingerprint: checked.sourceFingerprint, dependencyFingerprint: checked.dependencyFingerprint, at: environment.at, actor: checked.actor })
    if (fences.size > 512) fences.delete(fences.keys().next().value!)
    return { state: "available" as const, sourceVersion: checked.version, incarnation: checked.incarnation, physicalIncarnation: checked.physicalIncarnation, scopeFingerprint: checked.scopeFingerprint, sourceFingerprint: checked.sourceFingerprint, dependencyFingerprint: checked.dependencyFingerprint, evidence: source.value.evidence, projection: checked.projection }
  }
  const fence = async (scope: ConfirmationScope, observation: Available, context: TrustedDomainContext) => {
    const snapshot = input.host.persistence.currentSnapshots?.()?.planner
    const expected = fences.get(key(scope, context, observation.scopeFingerprint))
    if (!snapshot || !expected || observation.incarnation !== expected.source.target.incarnation || observation.sourceVersion !== expected.source.target.version || observation.physicalIncarnation !== expected.physicalIncarnation || observation.sourceFingerprint !== expected.sourceFingerprint || observation.dependencyFingerprint !== expected.dependencyFingerprint || digestSfValue(observation.evidence) !== digestSfValue(expected.source) || observation.evidence.refDigest !== digestSfEvidenceRef(observation.evidence) || fingerprint(observation.projection) !== expected.sourceFingerprint) return false
    const current = await check(snapshot, scope, expected.source, context, expected.at).catch(() => undefined)
    return !!current && !current.replaced && current.scopeFingerprint === observation.scopeFingerprint && current.sourceFingerprint === expected.sourceFingerprint && current.dependencyFingerprint === expected.dependencyFingerprint && digestSfValue(current.projection) === digestSfValue(observation.projection)
  }
  const prepareReissueScope = async (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext): Promise<PortResult<{ fence: () => Promise<boolean> }>> => {
    if (!original || !current || original.refDigest !== digestSfEvidenceRef(original) || current.refDigest !== digestSfEvidenceRef(current) || original.installationId !== context.binding.installationId || original.projectId !== context.binding.projectId || current.installationId !== context.binding.installationId || current.projectId !== context.binding.projectId || original.target.surface !== "planner" || current.target.surface !== "planner" || original.target.recordType !== "planner-version" || current.target.recordType !== original.target.recordType || current.target.recordId !== original.target.recordId || !original.target.period || digestSfValue(original.target.period) !== digestSfValue(current.target.period) || digestSfValue([...original.target.fields].sort()) !== digestSfValue([...current.target.fields].sort())) return { status: "unavailable", reason: "material-scope-unavailable" }
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: original.target.recordType, id: original.target.recordId, incarnation: original.target.incarnation }, fields: ["summary"], period: original.target.period, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const observation = await observe(scope, context)
    if (observation.state !== "available" || observation.evidence.refDigest !== current.refDigest || original.target.projectionDigest !== current.target.projectionDigest) return { status: "unavailable", reason: "material-scope-unavailable" }
    return { status: "ok", value: { fence: () => fence(scope, observation, context) } }
  }
  /** Resimulation permits changed content but proves the same physical source and current viewer scope. */
  const prepareResimulationContinuity = async (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext): Promise<PortResult<{ fence: () => Promise<boolean>; fenceSnapshot: (snapshot: Snapshot) => boolean; revalidate: () => Promise<boolean> }>> => {
    if (!original || !current || original.refDigest !== digestSfEvidenceRef(original) || current.refDigest !== digestSfEvidenceRef(current) || original.installationId !== context.binding.installationId || original.projectId !== context.binding.projectId || current.installationId !== context.binding.installationId || current.projectId !== context.binding.projectId || original.target.surface !== "planner" || current.target.surface !== "planner" || original.target.recordType !== "planner-version" || current.target.recordType !== original.target.recordType || current.target.recordId !== original.target.recordId || !original.target.period || digestSfValue(original.target.period) !== digestSfValue(current.target.period) || digestSfValue([...original.target.fields].sort()) !== digestSfValue([...current.target.fields].sort())) return { status: "unavailable", reason: "resimulation-continuity-unavailable" }
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: original.target.recordType, id: original.target.recordId, incarnation: original.target.incarnation }, fields: ["summary"], period: original.target.period, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const observation = await observe(scope, context)
    if (observation.state !== "available" || observation.evidence.refDigest !== current.refDigest) return { status: "unavailable", reason: "resimulation-continuity-unavailable" }
    const checkCurrent = () => fence(scope, observation, context)
    const expected = fences.get(key(scope, context, observation.scopeFingerprint))
    if (!expected) return { status: "unavailable", reason: "resimulation-continuity-unavailable" }
    const fenceSnapshot = (snapshot: Snapshot) => {
      const request = input.host.requestFor(context)
      if (!request || request.signal.aborted) return false
      const checked = (() => { try { return checkActor(snapshot, scope, expected.source, context, expected.at, expected.actor) } catch { return undefined } })()
      return !!checked && !checked.replaced && checked.physicalIncarnation === observation.physicalIncarnation && checked.scopeFingerprint === observation.scopeFingerprint && checked.sourceFingerprint === observation.sourceFingerprint && checked.dependencyFingerprint === observation.dependencyFingerprint && digestSfValue(checked.projection) === digestSfValue(observation.projection)
    }
    return { status: "ok", value: { fence: checkCurrent, fenceSnapshot, revalidate: async () => !!input.host.persistence.transactionAll && await input.host.revalidate(context) && await input.host.persistence.transactionAll(async (snapshots) => ({ commit: false, value: fenceSnapshot(snapshots.planner) })).catch(() => false) && await input.host.revalidate(context) } }
  }
  return { issueForActor, manifestFor, verifyManifest, fenceManifest, observe, fence, prepareReissueScope, prepareResimulationContinuity }
}
