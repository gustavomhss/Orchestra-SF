import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CommercialComparison } from "../contracts/outputs.ts"
import type { PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** Read-only material for the purchase dossier; it never prepares or applies a command. */
export function createProcurementDecisionPreparation(port: ProcurementPort) {
  return async (requestRef: string, binding: TrustedDomainContext): Promise<PortResult<{ request: DomainProjection; comparison: CommercialComparison | null; limitations: readonly string[] }>> => {
    const request = await port.read({ requestRef }, binding)
    if (request.status !== "ok") return request
    const comparison = await port.compareSourcing({ requestRef, proposalRefs: [], criteria: [] }, binding)
    if (comparison.status !== "ok" && comparison.status !== "needs-input") return comparison
    const current = await port.read({ requestRef }, binding)
    if (current.status !== "ok") return current
    const stable = (value: DomainProjection) => ({ ...value, values: value.values.filter((item) => item.id !== "ageDays") })
    if (digestSfValue(stable(current.value)) !== digestSfValue(stable(request.value))) return { status: "stale", reason: "Request changed during preparation" }
    if (comparison.status === "ok") {
      const evidence = request.value.values.flatMap((value) => value.sourceRefs)
      if (comparison.value.requestVersion !== request.value.version || !comparison.value.sourceRefs.length || comparison.value.sourceRefs.some((ref) => !evidence.some((item) => item.refDigest === ref.refDigest))) return { status: "stale", reason: "Comparison source changed" }
    }
    return { status: "ok", value: { request: current.value, comparison: comparison.status === "ok" ? comparison.value : null, limitations: comparison.status === "needs-input" ? [comparison.reason] : [] } }
  }
}
