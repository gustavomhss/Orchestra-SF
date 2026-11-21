import type { CapabilityResult, TrustedCallContext } from "../contracts/sf-execution.ts"

/** Host-private observation after receipt, transport and authority validation.
 * This optional composition hook never grants permission or replaces dispatch.
 */
export type SfVerifiedCallObserver = (operation: string, payload: unknown,
  result: Extract<CapabilityResult, { status: "ok" }>, context: TrustedCallContext) => boolean
