import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ThreadSourceContext } from "./thread-context.ts"

/** Host-private proof of the selected person's current access to every source field and period.
 * Directory membership, a role name, and the caller's access are not this proof.
 * The implementation must read current domain authority; it must not forge a recipient Request.
 */
export type CollaborationRecipientAuthority = {
  authorize: (recipientRef: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  /** Checks a current host-private authority lease without I/O or a nested source transaction.
   * The host must bind the lease to this recipient, caller, every selected ref and current ACL.
   * Directory membership and a previously successful authorize() are not a current lease.
   */
  checkAtCommit?: CollaborationRecipientCommitCheck
}

/** A C05 recipient grant binds the immutable review pin and every historical source
 * basis to the caller, recipient and their current authority. The host owns the
 * recipient principal; an ID or a caller-authorized review cannot create a grant.
 */
export type ReviewThreadRecipientAuthority = {
  authorize: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  /** No I/O: verify the same review/source/ACL lease in the protected snapshot. */
  checkAtCommit: (recipientRef: string, basis: ThreadSourceContext, context: TrustedDomainContext) => boolean
}

export type CollaborationRecipientCommitCheck = (recipientRef: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => boolean

/** The source snapshot fence and current caller authority are checked by the transaction owner. */
export function createRecipientCommitCheck(authority?: CollaborationRecipientAuthority): CollaborationRecipientCommitCheck {
  return (recipientRef, refs, context) => {
    if (!recipientRef.trim() || !refs.length) return false
    if (recipientRef === context.binding.principalRef) return true
    try { return authority?.checkAtCommit?.(recipientRef, structuredClone(refs), context) === true } catch { return false }
  }
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

