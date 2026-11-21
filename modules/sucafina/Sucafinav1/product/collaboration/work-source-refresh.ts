import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { createCollaborationMutationFence } from "./mutation-fence.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type CollaborationWorkSourceRefresh = (original: RecordEvidence, context: TrustedDomainContext) => Promise<PortResult<RecordEvidence>>

/** Current queue membership may survive material change. This is not answer reuse or proof that an old reference is fresh. */
export function createWorkSourceRefresh(input: {
  host: DomainPortHost
  issueForActor: (target: RecordEvidence["target"], context: TrustedDomainContext) => Promise<PortResult<RecordEvidence>>
  authorize: (ref: RecordEvidence, context: TrustedDomainContext) => Promise<boolean>
}): CollaborationWorkSourceRefresh {
  const fence = createCollaborationMutationFence(input.host)
  const inspect = (snapshot: Snapshot, ref: RecordEvidence, context?: TrustedDomainContext) => {
    const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === ref.target.incarnation && entry.scope.recordType === ref.target.recordType && entry.scope.recordId === ref.target.recordId)
    if (entries.length !== 1) return undefined
    const entry = entries[0]!
    const selector = object(entry.scope.selector)
    const physical = sfSourceIdentity(snapshot, ref.target.recordType, ref.target.recordId)
    if (!physical || entry.sourceIncarnation !== physical.incarnation || entry.version < ref.target.version || !Array.isArray(selector.fields) || digestSfValue([...selector.fields].sort()) !== digestSfValue([...ref.target.fields].sort()) || digestSfValue(selector.period) !== digestSfValue(ref.target.period)) return undefined
    if (context && (!entry.alive || entry.version !== ref.target.version || entry.inputDigest !== ref.target.projectionDigest || entry.scope.principalRef !== context.binding.principalRef || entry.scope.accessRevision !== context.binding.accessRevision || entry.scope.policyVersion !== context.binding.policyVersion)) return undefined
    return physical.incarnation
  }
  return async (original, context) => {
    const unavailable = { status: "unavailable" as const, reason: "work-source-continuity-unavailable" }
    try {
      const selected = structuredClone(original)
      const request = input.host.requestFor(context)
      if (!request || request.signal.aborted || !await input.host.revalidate(context) || selected.kind !== "record" || selected.installationId !== context.binding.installationId || selected.projectId !== context.binding.projectId || selected.refDigest !== digestSfEvidenceRef(selected) || !isSfPeriod(selected.target.period) || !selected.target.fields.length || new Set(selected.target.fields).size !== selected.target.fields.length || !Number.isSafeInteger(selected.target.version) || selected.target.version < 1) return unavailable
      const physical = await input.host.persistence.transaction(selected.target.surface, async (snapshot) => ({ commit: false, value: inspect(snapshot, selected) }), { signal: request.signal })
      if (!physical) return unavailable
      const issued = await input.issueForActor(structuredClone(selected.target), context)
      if (issued.status !== "ok") return unavailable
      const current = issued.value
      if (current.kind !== "record" || current.installationId !== selected.installationId || current.projectId !== selected.projectId || current.refDigest !== digestSfEvidenceRef(current) || current.evidenceLevel !== selected.evidenceLevel || current.target.surface !== selected.target.surface || current.target.recordType !== selected.target.recordType || current.target.recordId !== selected.target.recordId || digestSfValue([...current.target.fields].sort()) !== digestSfValue([...selected.target.fields].sort()) || digestSfValue(current.target.period) !== digestSfValue(selected.target.period) || !await input.authorize(current, context)) return unavailable
      const prepared = await fence.prepare(() => input.authorize(current, context))
      if (!prepared) return unavailable
      const same = await input.host.persistence.transaction(selected.target.surface, async (snapshot) => ({ commit: false, value: fence.check(prepared) && inspect(snapshot, selected) === physical && inspect(snapshot, current, context) === physical }), { signal: request.signal })
      if (!same || !await input.authorize(current, context) || !await input.host.revalidate(context)) return unavailable
      return { status: "ok", value: structuredClone(current) }
    } catch {
      return unavailable
    }
  }
}
