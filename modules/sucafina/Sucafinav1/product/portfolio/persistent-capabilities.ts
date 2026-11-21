import { createPortfolioCapabilities } from "./capabilities.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { PortfolioPort } from "./port.ts"
import type { createPersistentPortfolioPort } from "./result-store.ts"
import type { createPersistentSensitivityPort } from "./sensitivity-store.ts"

/** Configure the canonical capability with the shared persisted evaluator. */
export function createPersistentPortfolioCapabilities(input: {
  portfolio: PortfolioPort
  persistent: ReturnType<typeof createPersistentPortfolioPort>
  sensitivity?: ReturnType<typeof createPersistentSensitivityPort>
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
  createReceipt: (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => Promise<BoundCapabilityReceipt | undefined>
}): readonly CapabilityDescriptor[] {
  return createPortfolioCapabilities(input.portfolio, input.createReceipt, { evaluateAndStore: input.persistent.evaluateAndStore, caseFor: input.caseFor }, input.sensitivity ? { evaluateAndStore: input.sensitivity.evaluateAndStore, caseFor: input.caseFor } : undefined).filter((descriptor) => descriptor.id !== "sf_sensitivity_evaluate" || !!input.sensitivity)
}
