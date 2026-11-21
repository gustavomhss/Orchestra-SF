import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfProcurementRecordReadScope } from "./procurement-record-read-scope.ts"
import type { SfProcurementRecordReadScopeInput } from "./procurement-record-read-scope.ts"
export { createSfProcurementRecordReadScope } from "./procurement-record-read-scope.ts"

type Resolve = (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution | undefined>

/** Run one complete canonical producer in a real read scope, without reusing its result or authority. */
export function createSfProcurementEvidenceReadScope(input: SfProcurementRecordReadScopeInput & { resolve: Resolve }): Resolve {
  const observe = createSfProcurementRecordReadScope(input)
  return async (incoming, call) => {
    if (call.kind !== "ui" || !input.host.persistence.currentSnapshots || incoming.kind !== "record" ||
      incoming.target.surface !== "procurement" || incoming.target.recordType !== "procurement-request" || !incoming.refId.startsWith("sf-procurement:"))
      return input.resolve(incoming, call)
    const selected = structuredClone(incoming)
    const result = await observe([incoming], call, () => input.resolve(selected, call))
    // Unsupported is returned only before canonical execution. Missing archive
    // state/authority preserves the producer's original fresh-source fallthrough.
    if (result.kind === "unsupported") return input.resolve(incoming, call)
    if (result.kind === "observed") return result.value
    return { state: "unavailable", ref: structuredClone(selected),
      accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
  }
}
