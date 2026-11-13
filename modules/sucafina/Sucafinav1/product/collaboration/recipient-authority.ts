import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** Host-private proof of the selected person's current access to every source field and period.
 * Directory membership, a role name, and the caller's access are not this proof.
 * The implementation must read current domain authority; it must not forge a recipient Request.
 */
export type CollaborationRecipientAuthority = {
  authorize: (recipientRef: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
}

export function createRecipientSourceAuthorizer(input: {
  sources: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  recipientAuthority?: CollaborationRecipientAuthority
}) {
  return async (recipientRef: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!recipientRef.trim() || !refs.length) return false
    const selected = structuredClone(refs)
    if (!await input.sources(selected, context)) return false
    if (recipientRef !== context.binding.principalRef) {
      const proof = input.recipientAuthority
      if (!proof || !await proof.authorize(recipientRef, structuredClone(selected), context).catch(() => false)) return false
      if (!await input.sources(selected, context) || !await proof.authorize(recipientRef, structuredClone(selected), context).catch(() => false)) return false
    }
    return await input.sources(selected, context) && await input.revalidate(context)
  }
}
