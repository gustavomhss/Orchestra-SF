import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { ReviewThreadRecipientAuthority } from "../../../product/collaboration/recipient-authority.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import type { createReviewServices } from "../../../product/reviews/services.ts"
import type { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"

type ThreadFixture = Awaited<ReturnType<typeof createThreadActorsFixture>>

/** The real C05/C08 and historical-source protocol used by the WP08 answers
 * fixture, restricted here to the admitted author. Review ACL and the principal
 * directory remain explicit fixture boundaries, not an installed-host witness.
 */
export function createReviewThreadRecipientFixture(input: {
  fixture: () => ThreadFixture
  services: () => ReturnType<typeof createReviewServices> | undefined
  allowed: () => boolean
}): ReviewThreadRecipientAuthority {
  const leases = new Map<string, { snapshotDigest: string; reviewDigest: string; recipient: TrustedUiContext; actorDigest: string }>()
  const key = (id: string, basis: ThreadSourceContext, context: TrustedDomainContext) => digestSfValue({ id, basis, caller: context.binding })
  const fingerprint = (f: ThreadFixture) => {
    const snapshots = f.persistence.currentSnapshots?.()
    return snapshots ? digestSfValue(Object.entries(snapshots).map(([surface, snapshot]) => [surface, { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([name]) => name !== "__sfProductV1")) }])) : undefined
  }
  return {
    authorize: async (id, basis, context) => {
      const f = input.fixture()
      const services = input.services()
      const recipient = id === "person" && f.author.binding.principalRef === id ? f.author : undefined
      const pin = basis.reviewContext
      if (!recipient || !pin || !services || !input.allowed() || !await f.host.revalidate(recipient) || !await services.threadContext.authorize(pin, basis, recipient)) return false
      const review = await services.reviews.read(pin.reviewRef, recipient)
      if (review.status !== "ok" || digestSfValue(review.value) !== pin.reviewDigest) return false
      const references = [...new Map(review.value.sections.flatMap((section) => reviewProjectionEvidence(section.content as DomainProjection)).map((ref) => [digestSfValue(ref), ref])).values()]
      if (!references.length || references.some((ref) => ref.kind !== "record")) return false
      const records = references.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
      const proofs = await Promise.all(records.map((ref) => f.observer.prepareHistoricalReissue(ref, recipient)))
      if (proofs.some((proof) => proof.status !== "ok")) return false
      const snapshotDigest = await f.persistence.transactionAll!(async () => ({ commit: false, value: (await Promise.all(proofs.map((proof) => proof.status === "ok" ? proof.value.fence() : false))).every(Boolean) ? fingerprint(f) : undefined }))
      if (!snapshotDigest || !input.allowed() || !await f.host.revalidate(recipient)) return false
      leases.set(key(id, basis, context), { snapshotDigest, reviewDigest: pin.reviewDigest, recipient, actorDigest: digestSfValue(f.actors[id]) })
      return true
    },
    checkAtCommit: (id, basis, context) => {
      const f = input.fixture()
      const lease = leases.get(key(id, basis, context))
      const snapshot = f.persistence.currentSnapshots?.()?.dashboard
      const product = snapshot?.data.__sfProductV1 as { reviews?: Record<string, unknown> } | undefined
      return id === "person" && !!lease && !!basis.reviewContext && input.allowed() && f.actors[id]?.enabled === true && f.actors[id]!.access === lease.recipient.binding.accessRevision && digestSfValue(f.actors[id]) === lease.actorDigest && fingerprint(f) === lease.snapshotDigest && digestSfValue(product?.reviews?.[basis.reviewContext.reviewRef]) === lease.reviewDigest
    },
  }
}
