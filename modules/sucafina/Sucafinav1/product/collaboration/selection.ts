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
  captureMember?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
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
      if (records.length !== refs.length) return { status: "unavailable", reason: "work-selection-membership-unavailable" }
      const requests = records.filter((ref) => ref.target.surface === "procurement" && ref.target.recordType === "procurement-request")
      const candidates = requests.flatMap((ref) => current.value.requests.filter((member) => member.target.recordId === ref.target.recordId).map((member) => ({ ref, member })))
      if (!candidates.length) return records.length === requests.length ? { status: "ok", value: false } : { status: "unavailable", reason: "work-selection-membership-unavailable" }
      if (!input.captureMember) return { status: "unavailable", reason: "work-source-continuity-unavailable" }
      const captured = await Promise.all(candidates.map((candidate) => input.captureMember!(candidate.member.refId, context)))
      if (captured.some((entry) => entry.status !== "ok")) return { status: "unavailable", reason: "work-source-continuity-unavailable" }
      const same = captured.some((entry, index) => entry.status === "ok" && digestSfValue(entry.value.target) === digestSfValue(candidates[index]!.ref.target))
      const again = await input.collections.resolveRequestCollection(selection.selectionRef, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(selection.token)) return { status: "stale", reason: "work-selection-changed" }
      return { status: "ok", value: same }
    },
  }
}
