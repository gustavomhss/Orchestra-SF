import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmationScope, DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ConfirmationScopeObservation, AvailableConfirmationScopeObservation } from "../collaboration/confirmation.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createProcurementSourceResolver } from "./sources.ts"
import { procurementRequestFields } from "./source-projection.ts"

type Evidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Available = AvailableConfirmationScopeObservation & { evidence: Evidence; projection: DomainProjection }
type Observation = Available | Exclude<ConfirmationScopeObservation, AvailableConfirmationScopeObservation>

/** Observe an ordinary request through its original source and projection producers.
 * The C06 field manifest is separate: sourcing dependencies and the displayed age
 * belong to this full record scope and must not be dropped from answer reuse.
 */
export function createProcurementAnswerSource(input: {
  host: DomainPortHost
  sources: ReturnType<typeof createProcurementSourceResolver>
  procurement: Pick<ProcurementPort, "read">
}) {
  const host = input.host
  const persistence = host.persistence
  const sources = input.sources
  const procurement = input.procurement
  const issue = sources.issue
  const resolve = sources.resolveForPreparation
  const prepare = sources.prepareReissueScope
  const isCurrent = sources.isCurrent
  const read = procurement.read
  const requestFor = host.requestFor
  const revalidate = host.revalidate
  const authenticate = host.authenticate
  const environment = host.environment
  const snapshots = persistence.currentSnapshots
  const fences = new WeakMap<TrustedDomainContext, Map<string, { observation: string; fence: () => Promise<boolean> }>>()
  const current = (call: TrustedDomainContext, request: Request, binding: string) =>
    input.host === host && host.persistence === persistence && input.sources === sources && input.procurement === procurement &&
    sources.issue === issue && sources.resolveForPreparation === resolve && sources.prepareReissueScope === prepare &&
    sources.isCurrent === isCurrent && procurement.read === read && host.requestFor === requestFor &&
    host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environment &&
    persistence.currentSnapshots === snapshots && requestFor.call(host, call) === request && !request.signal.aborted &&
    digestSfValue([call.kind, call.binding]) === binding
  const valid = (scope: ConfirmationScope) => scope?.scopeDefinitionVersion === "procurement-answer-v1" &&
    scope.sourceRef?.surface === "procurement" && scope.sourceRef.type === "procurement-request" &&
    typeof scope.sourceRef.id === "string" && !!scope.sourceRef.id.trim() &&
    typeof scope.sourceRef.incarnation === "string" && !!scope.sourceRef.incarnation.trim() &&
    Array.isArray(scope.fields) && digestSfValue(scope.fields) === digestSfValue([...procurementRequestFields].sort()) &&
    isSfPeriod(scope.period) && Array.isArray(scope.materialDependencies) && scope.materialDependencies.length === 0
  const key = (scope: ConfirmationScope, call: TrustedDomainContext, fingerprint: string) => digestSfValue({
    scope, fingerprint, installation: call.binding.installationId, project: call.binding.projectId,
    principal: call.binding.principalRef, access: call.binding.accessRevision, policy: call.binding.policyVersion,
  })
  const physical = (snapshot: Snapshot, evidence: Evidence) => {
    if (!isCurrent.call(sources, snapshot, evidence)) return undefined
    const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive &&
      entry.incarnation === evidence.target.incarnation && entry.version === evidence.target.version &&
      entry.scope.recordType === evidence.target.recordType && entry.scope.recordId === evidence.target.recordId)
    const record = snapshot.sfSources?.records[JSON.stringify([evidence.target.recordType, evidence.target.recordId])]
    return entries.length === 1 && record?.alive && entries[0]!.sourceIncarnation === record.incarnation ? record.incarnation : undefined
  }
  const verifyManifest = async (scope: ConfirmationScope, call: TrustedDomainContext) => {
    const request = requestFor.call(host, call)
    const binding = digestSfValue([call.kind, call.binding])
    return valid(scope) && !!request && current(call, request, binding) && await revalidate.call(host, call) && current(call, request, binding)
  }
  const fenceManifest = async (scope: ConfirmationScope, call: TrustedDomainContext) =>
    await verifyManifest(scope, call) && !!snapshots?.call(persistence)?.procurement

  const resolveAnswerScope = async (source: Evidence, refs: readonly Evidence[], call: TrustedDomainContext): Promise<PortResult<{ scope: ConfirmationScope }>> => {
    const selected = structuredClone(source)
    const request = requestFor.call(host, call)
    const binding = digestSfValue([call.kind, call.binding])
    const unavailable = (): PortResult<{ scope: ConfirmationScope }> => ({ status: "unavailable", reason: "answer-scope-unavailable" })
    if (!request || refs.length !== 1 || digestSfValue(refs[0]) !== digestSfValue(selected) ||
      selected.schema !== "sf-evidence-v1" || selected.kind !== "record" || selected.refDigest !== digestSfEvidenceRef(selected) ||
      selected.target.surface !== "procurement" || selected.target.recordType !== "procurement-request" ||
      !selected.target.period || !current(call, request, binding)) return unavailable()
    const scope: ConfirmationScope = {
      sourceRef: { surface: "procurement", type: "procurement-request", id: selected.target.recordId, incarnation: selected.target.incarnation },
      fields: [...selected.target.fields].sort(), period: structuredClone(selected.target.period),
      materialDependencies: [], scopeDefinitionVersion: "procurement-answer-v1",
    }
    if (!valid(scope)) return unavailable()
    const resolved = await resolve.call(sources, selected.refId, call)
    if (resolved.status !== "ok" || digestSfValue(resolved.value.evidence) !== digestSfValue(selected) ||
      !current(call, request, binding) || !await revalidate.call(host, call) || !current(call, request, binding)) return unavailable()
    return { status: "ok", value: { scope } }
  }

  const observe = async (scope: ConfirmationScope, call: TrustedDomainContext): Promise<Observation> => {
    const selected = structuredClone(scope)
    const request = requestFor.call(host, call)
    const binding = digestSfValue([call.kind, call.binding])
    const unavailable = (): Observation => ({ state: "access-unavailable", sourceVersion: 0 })
    if (!valid(selected)) return { state: "dependency-unavailable", sourceVersion: 0 }
    if (!request || !current(call, request, binding) || !await verifyManifest(selected, call)) return unavailable()
    const issued = await issue.call(sources, "procurement-request", selected.sourceRef.id, call)
    if (issued.status !== "ok" || !current(call, request, binding)) return unavailable()
    const resolved = await resolve.call(sources, issued.value, call)
    if (resolved.status !== "ok" || !current(call, request, binding)) return unavailable()
    const evidence = resolved.value.evidence
    if (evidence.target.incarnation !== selected.sourceRef.incarnation) return { state: "replaced", sourceVersion: evidence.target.version }
    if (digestSfValue([...evidence.target.fields].sort()) !== digestSfValue(selected.fields) ||
      digestSfValue(evidence.target.period) !== digestSfValue(selected.period)) return unavailable()
    const projected = await read.call(procurement, { requestRef: evidence.refId }, call)
    if (projected.status !== "ok" || !current(call, request, binding) ||
      projected.value.version !== evidence.target.version || digestSfValue(projected.value.context) !== digestSfValue(resolved.value.context)) return unavailable()
    const prepared = await prepare.call(sources, evidence, evidence, call)
    if (prepared.status !== "ok" || !current(call, request, binding)) return unavailable()
    const physicalIncarnation = await persistence.transaction("procurement", async (snapshot) => ({
      commit: false, value: physical(snapshot, evidence),
    }), { signal: request.signal })
    const again = await resolve.call(sources, evidence.refId, call)
    if (!physicalIncarnation || again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(resolved.value) ||
      !current(call, request, binding) || !await revalidate.call(host, call) || !current(call, request, binding)) return unavailable()
    // Include the actual displayed age, not only the stored record digest. A
    // clock change which changes ageDays invalidates a previously confirmed answer.
    const sourceFingerprint = digestSfValue({
      engineVersion: projected.value.engineVersion,
      values: projected.value.values.map((value) => ({
        id: value.id, value: value.value, unit: value.unit, currency: value.currency,
        period: value.period, granularity: value.granularity, evidenceState: value.evidenceState,
      })),
      missing: projected.value.missing,
    })
    // The original private digest covers sourcing, rules, FX and approval history,
    // including dependencies which are intentionally absent from the public projection.
    const dependencyFingerprint = digestSfValue({ manifest: selected.scopeDefinitionVersion, source: evidence.target.projectionDigest })
    const scopeFingerprint = digestSfValue({ physical: physicalIncarnation, fields: selected.fields,
      period: selected.period, sourceFingerprint, dependencyFingerprint })
    const observation: Available = { state: "available", sourceVersion: evidence.target.version,
      incarnation: evidence.target.incarnation, physicalIncarnation, sourceFingerprint,
      dependencyFingerprint, scopeFingerprint, evidence, projection: projected.value }
    const observed = fences.get(call) ?? new Map<string, { observation: string; fence: () => Promise<boolean> }>()
    observed.set(key(selected, call, scopeFingerprint), { observation: digestSfValue(observation), fence: prepared.value.fence })
    if (observed.size > 512) observed.delete(observed.keys().next().value!)
    fences.set(call, observed)
    return observation
  }
  const fence = async (scope: ConfirmationScope, observation: Available, call: TrustedDomainContext) => {
    const request = requestFor.call(host, call)
    const binding = digestSfValue([call.kind, call.binding])
    const snapshot = snapshots?.call(persistence)?.procurement
    const proof = fences.get(call)?.get(key(scope, call, observation.scopeFingerprint))
    const validSource = () => !!snapshot && snapshots?.call(persistence)?.procurement === snapshot &&
      physical(snapshot, observation.evidence) === observation.physicalIncarnation
    return valid(scope) && !!request && !!proof && proof.observation === digestSfValue(observation) &&
      current(call, request, binding) && validSource() && await proof.fence() &&
      current(call, request, binding) && validSource() && await revalidate.call(host, call) &&
      current(call, request, binding) && validSource()
  }
  return { resolveAnswerScope, verifyManifest, fenceManifest, observe, fence }
}
