import { object } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** An action may change status; its original link must still identify the same physical record. */
export async function sameHandoffWorkSource(host: DomainPortHost, previous: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext) {
  const request = host.requestFor(context)
  if (!request || !await host.revalidate(context)) return false
  const valid = [previous, current].every((ref) => ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "hotTopics" && ref.installationId === context.binding.installationId && ref.projectId === context.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref))
  if (!valid || previous.target.recordId !== current.target.recordId) return false
  const same = await host.persistence.transaction("dashboard", async (snapshot) => {
    const physical = sfSourceIdentity(snapshot, "hotTopics", current.target.recordId)
    const entries = Object.values(snapshot.sfSources?.scopes ?? {})
    const matching = (ref: RecordEvidence) => entries.filter((entry) => {
      const selector = object(entry.scope.selector)
      return entry.incarnation === ref.target.incarnation && entry.scope.recordType === "hotTopics" && entry.scope.recordId === ref.target.recordId && Array.isArray(selector.fields) && digestSfValue([...selector.fields].sort()) === digestSfValue([...ref.target.fields].sort()) && digestSfValue(selector.period) === digestSfValue(ref.target.period)
    })
    const before = matching(previous)
    const now = matching(current)
    const present = now[0]
    return { commit: false, value: !!physical && before.length === 1 && now.length === 1 && before[0]!.version >= previous.target.version && before[0]!.sourceIncarnation === physical.incarnation && !!present && present.alive && present.sourceIncarnation === physical.incarnation && present.version === current.target.version && present.inputDigest === current.target.projectionDigest && present.scope.principalRef === context.binding.principalRef && present.scope.accessRevision === context.binding.accessRevision && present.scope.policyVersion === context.binding.policyVersion }
  }, { signal: request.signal }).catch(() => false)
  return same && await host.revalidate(context)
}
