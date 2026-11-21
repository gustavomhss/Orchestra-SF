import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import type { CollaborationWorkSourceRefresh } from "./work-source-refresh.ts"
import type { ThreadSourceContext } from "./thread-context.ts"
import { validThreadSourceContext } from "./thread-context.ts"

/** Host-private mapping from preserved message sources to a currently selected actor-scoped source.
 * Logical IDs select a producer lookup; only its physical proof and current authorization allow the mapping.
 */
export function createThreadSourceContinuity(input: {
  host: Pick<DomainPortHost, "revalidate">
  reissue: ReturnType<typeof createCollaborationReissuer>
  refresh?: CollaborationWorkSourceRefresh
  authorizeHistorical: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (basis: ThreadSourceContext, selected: readonly SourceRef[], context: TrustedDomainContext): Promise<boolean> => {
    if (!validThreadSourceContext(basis) || !Array.isArray(selected) || !selected.length || selected.some((source) => !source || !Array.isArray(source.fields) || !source.fields.length || source.fields.some((field: unknown) => typeof field !== "string" || !field) || !isSfPeriod(source.period) || !Number.isSafeInteger(source.version) || source.version < 1) || !await input.host.revalidate(context)) return false
    const records = basis.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
    const supplements = basis.evidenceRefs.filter((ref) => ref.kind !== "record")
    if (records.length !== selected.length || supplements.length && !await input.authorizeHistorical(supplements, context)) return false
    const renew = () => Promise.all(records.map(async (ref) => {
      const same = await input.reissue(ref, context)
      if (same.status === "ok") return same
      if (!input.refresh || !await input.authorizeHistorical([ref], context)) return same
      return input.refresh(ref, context)
    }))
    const issued = await renew()
    if (issued.some((result) => result.status !== "ok")) return false
    const currents = issued.flatMap((result) => result.status === "ok" ? [result.value] : [])
    const selectionKey = (source: SourceRef) => digestSfValue({ surface: source.surface, type: source.type, id: source.id, incarnation: source.incarnation, version: source.version, fields: [...source.fields].sort(), period: source.period })
    const matches = currents.map((ref) => digestSfValue({ surface: ref.target.surface, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation, version: ref.target.version, fields: [...ref.target.fields].sort(), period: ref.target.period })).sort()
    if (digestSfValue(matches) !== digestSfValue(selected.map(selectionKey).sort())) return false
    const again = await renew()
    return digestSfValue(again) === digestSfValue(issued) && (!supplements.length || await input.authorizeHistorical(supplements, context)) && await input.host.revalidate(context)
  }
}
