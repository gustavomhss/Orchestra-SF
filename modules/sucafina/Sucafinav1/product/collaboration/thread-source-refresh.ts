import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { createCollaborationMutationFence } from "./mutation-fence.ts"
import type { CollaborationWorkSourceRefresh } from "./work-source-refresh.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** The C17 producer selects today's reference. No period, current-state rule or historical grant is inferred here. */
export function createHistoricalThreadSourceRefresh(input: { host: DomainPortHost; evidence: BusinessContextService }): CollaborationWorkSourceRefresh {
  const fence = createCollaborationMutationFence(input.host)
  const inspect = (snapshot: Snapshot, ref: RecordEvidence, context?: TrustedDomainContext) => {
    const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === ref.target.incarnation && entry.scope.recordType === ref.target.recordType && entry.scope.recordId === ref.target.recordId)
    const entry = matches.length === 1 ? matches[0] : undefined
    const physical = sfSourceIdentity(snapshot, ref.target.recordType, ref.target.recordId)
    const selector = object(entry?.scope.selector)
    if (!entry || !physical?.alive || entry.sourceIncarnation !== physical.incarnation || entry.version < ref.target.version || !Array.isArray(selector.fields) || digestSfValue([...selector.fields].sort()) !== digestSfValue([...ref.target.fields].sort()) || digestSfValue(selector.period) !== digestSfValue(ref.target.period)) return undefined
    if (context && (!entry.alive || entry.version !== ref.target.version || entry.inputDigest !== ref.target.projectionDigest || entry.scope.principalRef !== context.binding.principalRef || entry.scope.accessRevision !== context.binding.accessRevision || entry.scope.policyVersion !== context.binding.policyVersion)) return undefined
    return physical.incarnation
  }
  return async (original, context) => {
    const unavailable = { status: "unavailable" as const, reason: "thread-historical-continuity-unavailable" }
    try {
      const selected = structuredClone(original)
      const request = input.host.requestFor(context)
      if (!request || request.signal.aborted || !await input.host.revalidate(context) || selected.kind !== "record" || selected.refDigest !== digestSfEvidenceRef(selected) || selected.installationId !== context.binding.installationId || selected.projectId !== context.binding.projectId || !isSfPeriod(selected.target.period)) return unavailable
      const resolve = () => input.evidence.resolve(structuredClone(selected), context)
      const first = structuredClone(await resolve())
      const current = first.currentRef
      if (first.state !== "historical" || !first.authorizedProjection || !first.differences || first.accessRevision !== context.binding.accessRevision || digestSfValue(first.ref) !== digestSfValue(selected) || !current || current.kind !== "record" || current.refDigest !== digestSfEvidenceRef(current) || current.installationId !== selected.installationId || current.projectId !== selected.projectId || current.evidenceLevel !== selected.evidenceLevel || current.target.surface !== selected.target.surface || current.target.recordType !== selected.target.recordType || current.target.recordId !== selected.target.recordId || !isSfPeriod(current.target.period) || digestSfValue([...current.target.fields].sort()) !== digestSfValue([...selected.target.fields].sort())) return unavailable
      const proof = (value: typeof first) => digestSfValue({ state: value.state, ref: value.ref, currentRef: value.currentRef, authorizedProjection: value.authorizedProjection, differences: value.differences, accessRevision: value.accessRevision })
      const expected = proof(first)
      const authorize = async () => {
        const [historical, fresh] = await Promise.all([resolve(), input.evidence.resolve(structuredClone(current), context)])
        return historical.state === "historical" && digestSfValue(historical.ref) === digestSfValue(selected) && proof(historical) === expected && fresh.state === "fresh" && fresh.accessRevision === context.binding.accessRevision && digestSfValue(fresh.ref) === digestSfValue(current) && await input.host.revalidate(context)
      }
      const prepared = await fence.prepare(authorize)
      if (!prepared) return unavailable
      const same = await input.host.persistence.transaction(selected.target.surface, async (snapshot) => {
        const old = inspect(snapshot, selected)
        return { commit: false, value: !!old && old === inspect(snapshot, current, context) && fence.check(prepared) }
      }, { signal: request.signal })
      if (!same || !await authorize()) return unavailable
      const final = await input.host.persistence.transaction(selected.target.surface, async (snapshot) => {
        const old = inspect(snapshot, selected)
        return { commit: false, value: !!old && old === inspect(snapshot, current, context) && fence.check(prepared) }
      }, { signal: request.signal })
      if (!final || !await input.host.revalidate(context)) return unavailable
      return { status: "ok", value: structuredClone(current) }
    } catch {
      return unavailable
    }
  }
}
