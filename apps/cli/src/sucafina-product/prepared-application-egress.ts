import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { AdmittedApply } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

/** Keep the human lease live through the producer's final asynchronous receipt read. */
export function createSfPreparedApplicationEgress(authority: ReturnType<typeof createSfProductAuthority>) {
  return async <T>(incoming: AdmittedApply, call: TrustedDomainContext,
    work: (request: AdmittedApply) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const request = structuredClone(incoming)
    const source = authority.host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const intent = digestSfValue(request)
    const denied = (): PortResult<T> => ({ status: "denied", reason: "application-authority-changed" })
    const current = () => call.kind === "ui" && !!source && !source.signal.aborted && authority.host.requestFor(call) === source &&
      digestSfValue([call.kind, call.binding]) === binding && digestSfValue(incoming) === intent && digestSfValue(request) === intent
    if (!current() || !await authority.human.authorize(call, "decisions.apply", request) || !current()) return denied()
    const result = await work(request)
    if (!current() || !await authority.human.authorize(call, "decisions.apply", request) || !current() ||
      !await authority.host.revalidate(call) || !current()) return denied()
    return result
  }
}
