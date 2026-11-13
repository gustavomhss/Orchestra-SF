import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementCollectionRegistry } from "../procurement/sources.ts"
import type { createCollaborationAuthority } from "./authority.ts"

/** Token is host-private, canonically serializable selection evidence, never an authority grant. */
export type WorkSelection = { selectionRef: string; period: Period; token: unknown; procurement: { state: "selected"; selectionRef: string } | { state: "not-in-scope" } }
export type WorkSelectionPort = {
  resolve: (selectionRef: string, period: Period, context: TrustedDomainContext) => Promise<PortResult<WorkSelection>>
  contains: (selection: WorkSelection, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<PortResult<boolean>>
}

/** A Procurement selection proves only its own current, authorized member projections. */
export function createWorkSelectionPort(input: {
  collections: Pick<ReturnType<typeof createProcurementCollectionRegistry>, "resolveRequestCollection">
  authority: ReturnType<typeof createCollaborationAuthority>
}): WorkSelectionPort {
  return {
    resolve: async (selectionRef, period, context) => {
      const result = await input.collections.resolveRequestCollection(selectionRef, context)
      if (result.status !== "ok") return result
      if (digestSfValue(result.value.context.period) !== digestSfValue(period)) return { status: "unavailable", reason: "work-period-mismatch" }
      return { status: "ok", value: { selectionRef, period, token: result.value, procurement: { state: "selected", selectionRef } } }
    },
    contains: async (selection, refs, context) => {
      if (!refs.length || !await input.authority.sources(refs, context)) return { status: "unavailable", reason: "work-source-unavailable" }
      const current = await input.collections.resolveRequestCollection(selection.selectionRef, context)
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== digestSfValue(selection.token)) return { status: "stale", reason: "work-selection-changed" }
      const records = refs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
      const matching = records.some((ref) => current.value.requests.some((member) => member.target.surface === ref.target.surface && member.target.recordType === ref.target.recordType && member.target.recordId === ref.target.recordId && member.target.incarnation === ref.target.incarnation && member.target.version === ref.target.version))
      if (matching) return { status: "ok", value: true }
      if (records.length !== refs.length || records.some((ref) => ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request")) return { status: "unavailable", reason: "work-selection-membership-unavailable" }
      // A different scoped incarnation may represent a replacement; ID equality alone cannot prove exclusion.
      if (records.some((ref) => current.value.requests.some((member) => member.target.recordId === ref.target.recordId))) return { status: "unavailable", reason: "work-source-continuity-unavailable" }
      return { status: "ok", value: false }
    },
  }
}
