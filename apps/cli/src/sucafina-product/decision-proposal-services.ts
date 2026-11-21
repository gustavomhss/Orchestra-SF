import { createDecisionCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/decisions/capabilities.ts"
import { createSfDecisionAlternativeServices } from "./decision-alternative-services.ts"
import { createSfDecisionChangeServices } from "./decision-change-services.ts"

/** Assemble only the two proposal descriptors; the host already owns case read/draft/receipt. */
export function createSfDecisionProposalServices(input: Parameters<typeof createSfDecisionAlternativeServices>[0]) {
  const alternatives = createSfDecisionAlternativeServices(input)
  const changes = createSfDecisionChangeServices(input)
  const descriptors = createDecisionCapabilities({ cases: input.business.cases, createReceipt: input.business.receipt,
    alternative: alternatives.alternative, change: changes.change,
    requiredAuthority: { read: ["cases:read"], draft: ["cases:write"], receipt: ["cases:read"], alternative: ["cases:read"], change: ["cases:read"] },
  }).filter((descriptor) => descriptor.id === "sf_alternative_draft" || descriptor.id === "sf_change_prepare")
  return { ...alternatives, ...changes, descriptors }
}
