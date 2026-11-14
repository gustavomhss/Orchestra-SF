import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createCollaborationMutationFence } from "./mutation-fence.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Internal only: A's protected ref selects physical identity, never authority for B. */
export function createCollaborationReissuer(input: {
  host: DomainPortHost
  issueForActor: (target: RecordEvidence["target"], context: TrustedDomainContext) => Promise<PortResult<RecordEvidence>>
  authorize: (ref: RecordEvidence, context: TrustedDomainContext) => Promise<boolean>
  prepareMaterialScope?: (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext) => Promise<PortResult<{ fence: () => Promise<boolean> }>>
}) {
  const transactionAll = input.host.persistence.transactionAll
  const mutationFence = createCollaborationMutationFence(input.host)
  const issuedRefs = new Map<string, RecordEvidence>()
  const inspect = (snapshot: Snapshot, ref: RecordEvidence, binding?: TrustedDomainContext["binding"]) => {
    const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => (!binding || entry.alive) && entry.incarnation === ref.target.incarnation && (binding ? entry.version === ref.target.version : entry.version >= ref.target.version) && entry.scope.recordType === ref.target.recordType && entry.scope.recordId === ref.target.recordId && (!binding || entry.scope.principalRef === binding.principalRef && entry.scope.accessRevision === binding.accessRevision && entry.scope.policyVersion === binding.policyVersion))
    if (entries.length !== 1) return undefined
    const entry = entries[0]!
    const source = sfSourceIdentity(snapshot, ref.target.recordType, ref.target.recordId)
    const selector = object(entry.scope.selector)
    const fieldsMatch = Array.isArray(selector.fields) ? digestSfValue([...selector.fields].sort()) === digestSfValue([...ref.target.fields].sort()) : ref.target.surface === "planner" && ref.target.recordType === "planner-version" && selector.kind === "planner-source-v1"
    if (!source || source.incarnation !== entry.sourceIncarnation || !fieldsMatch || (selector.period !== undefined && digestSfValue(selector.period) !== digestSfValue(ref.target.period))) return undefined
    return entry.sourceIncarnation
  }
  const capture = async (ref: RecordEvidence) => {
    if (!transactionAll) return undefined
    return transactionAll(async (snapshots: Record<Surface, Snapshot>) => ({ commit: false, value: inspect(snapshots[ref.target.surface], ref) })).catch(() => undefined)
  }
  return async (ref: RecordEvidence, context: TrustedDomainContext): Promise<PortResult<RecordEvidence>> => {
    const selected = structuredClone(ref)
    if (!transactionAll || !input.host.requestFor(context) || !await input.host.revalidate(context) || selected.installationId !== context.binding.installationId || selected.projectId !== context.binding.projectId || selected.refDigest !== digestSfEvidenceRef(selected) || !selected.target.period) return { status: "denied", reason: "source-reissue-unavailable" }
    const physical = await capture(selected)
    if (!physical) return { status: "unavailable", reason: "source-reissue-unavailable" }
    const cacheKey = digestSfValue({ installationId: selected.installationId, projectId: selected.projectId, physical, surface: selected.target.surface, recordType: selected.target.recordType, recordId: selected.target.recordId, fields: [...selected.target.fields].sort(), period: selected.target.period, projectionDigest: selected.target.projectionDigest, evidenceLevel: selected.evidenceLevel, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion })
    const cached = issuedRefs.get(cacheKey)
    const issued = cached && await input.authorize(cached, context) ? { status: "ok" as const, value: cached } : await input.authorize(selected, context) ? { status: "ok" as const, value: selected } : await input.issueForActor(structuredClone(selected.target), context)
    if (issued.status !== "ok") return issued
    const current = issued.value
    if (current.installationId !== selected.installationId || current.projectId !== selected.projectId || current.refDigest !== digestSfEvidenceRef(current) || current.evidenceLevel !== selected.evidenceLevel || current.target.surface !== selected.target.surface || current.target.recordType !== selected.target.recordType || current.target.recordId !== selected.target.recordId || digestSfValue([...current.target.fields].sort()) !== digestSfValue([...selected.target.fields].sort()) || digestSfValue(current.target.period) !== digestSfValue(selected.target.period) || !await input.authorize(current, context)) return { status: "unavailable", reason: "source-reissue-unavailable" }
    if (current.target.projectionDigest !== selected.target.projectionDigest) return { status: "unavailable", reason: "source-material-scope-unavailable" }
    if (!input.prepareMaterialScope) return { status: "unavailable", reason: "source-material-scope-unavailable" }
    const proof = await input.prepareMaterialScope(selected, current, context)
    if (proof.status !== "ok") return { status: "unavailable", reason: "source-material-scope-unavailable" }
    const sourceFence = await mutationFence.prepare(() => input.authorize(current, context))
    if (!sourceFence) return { status: "unavailable", reason: "source-material-scope-unavailable" }
    const samePhysical = await transactionAll(async (snapshots: Record<Surface, Snapshot>) => ({ commit: false, value: mutationFence.check(sourceFence) && await proof.value.fence() && inspect(snapshots[selected.target.surface], selected) === physical && inspect(snapshots[current.target.surface], current, context.binding) === physical })).catch(() => false)
    if (!samePhysical || !await input.host.revalidate(context)) { issuedRefs.delete(cacheKey); return { status: "stale", reason: "source-replaced-or-inaccessible" } }
    issuedRefs.set(cacheKey, structuredClone(current))
    if (issuedRefs.size > 512) issuedRefs.delete(issuedRefs.keys().next().value!)
    return { status: "ok", value: structuredClone(current) }
  }
}

