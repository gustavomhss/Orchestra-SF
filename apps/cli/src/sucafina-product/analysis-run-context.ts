import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Reenter a run under its original human intent without upgrading its selected case.
 * Lifecycle readers may reach a newer version of the same authorized case. The
 * selector stays at the original version, so fresh domain execution still refuses drift. */
export function createSfAnalysisRunContext(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "human">
  business: Pick<ReturnType<typeof createSfBusinessServices>, "withAnalysisCase">
  request: Request
  runRef: string
  caseRef: SfNativeRunRecord["caseRef"]
  start: unknown
  active: () => boolean
  replayContexts: WeakMap<TrustedDomainContext, string>
}) {
  const selected = structuredClone(input.caseRef)
  const start = structuredClone(input.start)
  return async <T>(id: string, action: (call: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const denied = (): PortResult<T> => ({ status: "denied", reason: "analysis-authority-unavailable" })
    if (id !== input.runRef || input.request.signal.aborted || !input.active()) return denied()
    const admitted = await input.authority.human.admit(input.request, "analysis.start", start)
    if (admitted.status !== "ok") return admitted
    const call = admitted.value
    input.replayContexts.set(call, input.runRef)
    try {
      const current = () => !input.request.signal.aborted && input.active() && input.authority.host.requestFor(call) === input.request &&
        input.replayContexts.get(call) === input.runRef
      const result = await input.business.withAnalysisCase(call, selected, async () => {
        const value = await action(call)
        const authorized = await input.authority.human.authorize(call, "analysis.start", start)
        return authorized && current() ? value : denied()
      })
      // Lifecycle membership is fenced after the final asynchronous intent check.
      return current() ? result : denied()
    } finally {
      input.replayContexts.delete(call)
      input.authority.human.finish(call)
    }
  }
}
