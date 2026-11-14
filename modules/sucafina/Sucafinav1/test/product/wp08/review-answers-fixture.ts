import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { createReviewAnswerSource } from "../../../product/reviews/review-answer-source.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

/** Actual SQLite, C05/C06/C08, Dashboard historical leases and admitted actor
 * contexts. Review ACL and the recipient principal directory are explicit
 * fixture boundaries, not an installed C08/native authority witness.
 */
export async function createReviewAnswersFixture() {
  let services: ReturnType<typeof createReviewServices> | undefined
  let answerSource: ReturnType<typeof createReviewAnswerSource> | undefined
  const access: Record<string, boolean> = { person: true, "reader-b": true, "reader-c": false }
  const contexts = new Map<string, TrustedUiContext>()
  const leases = new Map<string, { snapshotDigest: string; reviewDigest: string; recipient: TrustedUiContext; actorDigest: string }>()
  const recipientKey = (id: string, basis: ThreadSourceContext, context: TrustedDomainContext) => digestSfValue({ id, basis, caller: context.binding })
  const options: Parameters<typeof createThreadActorsFixture>[0] = {
    authorizeReviewThreadContext: (pin, basis, context) => services ? services.threadContext.authorize(pin, basis, context) : Promise.resolve(false),
    reviewAnswerSource: {
      prepareThreadFence: (basis, context) => answerSource ? answerSource.prepareThreadFence(basis, context) : Promise.resolve(undefined),
      resolve: (basis, context) => answerSource ? answerSource.resolve(basis, context) : Promise.resolve({ status: "unavailable", reason: "review-source-not-composed" }),
      observe: (scope, basis, context) => answerSource ? answerSource.observe(scope, basis, context) : Promise.resolve({ state: "dependency-unavailable", sourceVersion: 0 }),
      fence: (scope, observation, basis, context) => answerSource ? answerSource.fence(scope, observation, basis, context) : Promise.resolve(false),
    },
    reviewRecipientAuthority: {
      authorize: async (id, basis, context) => {
        const recipient = contexts.get(id)
        const pin = basis.reviewContext
        if (!recipient || !pin || !services || !access[id] || !await f.host.revalidate(recipient) || !await services.threadContext.authorize(pin, basis, recipient)) return false
        const review = await services.reviews.read(pin.reviewRef, recipient)
        if (review.status !== "ok" || digestSfValue(review.value) !== pin.reviewDigest) return false
        const references = allReferences(review.value.sections)
        if (!references.length || references.some((ref) => ref.kind !== "record")) return false
        const records = references.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
        const proofs = await Promise.all(records.map((ref) => f.observer.prepareHistoricalReissue(ref, recipient)))
        if (proofs.some((proof) => proof.status !== "ok")) return false
        const snapshotDigest = await f.persistence.transactionAll!(async () => ({ commit: false, value: (await Promise.all(proofs.map((proof) => proof.status === "ok" ? proof.value.fence() : false))).every(Boolean) ? fingerprint() : undefined }))
        if (!snapshotDigest || !access[id] || !await f.host.revalidate(recipient)) return false
        leases.set(recipientKey(id, basis, context), { snapshotDigest, reviewDigest: pin.reviewDigest, recipient, actorDigest: digestSfValue(f.actors[id]) })
        return true
      },
      checkAtCommit: (id, basis, context) => {
        const lease = leases.get(recipientKey(id, basis, context))
        const snapshot = f.persistence.currentSnapshots?.()?.dashboard
        const product = snapshot?.data.__sfProductV1 as { reviews?: Record<string, unknown> } | undefined
        return !!lease && !!basis.reviewContext && access[id] === true && f.actors[id]?.enabled === true && f.actors[id]!.access === lease.recipient.binding.accessRevision && digestSfValue(f.actors[id]) === lease.actorDigest && fingerprint() === lease.snapshotDigest && digestSfValue(product?.reviews?.[basis.reviewContext.reviewRef]) === lease.reviewDigest
      },
    },
  }
  const f: Awaited<ReturnType<typeof createThreadActorsFixture>> = await createThreadActorsFixture(options)
  function fingerprint() {
    const snapshots = f.persistence.currentSnapshots?.()
    return snapshots ? digestSfValue(Object.entries(snapshots).map(([surface, snapshot]) => [surface, { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([name]) => name !== "__sfProductV1")) }])) : undefined
  }
  contexts.set("person", f.author)
  contexts.set("reader-b", f.recipient)
  contexts.set("reader-c", f.homonym)
  const source = await f.issueProject(f.author)
  await f.capture(source, f.author)
  f.historical.allowed = true
  const projection = available(await f.records.read(source.refId, f.author))
  const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await f.host.revalidate(context)) return false
    const matches = refs.every((ref) => ref.surface === source.target.surface && ref.type === source.target.recordType && ref.id === source.target.recordId && ref.incarnation === source.target.incarnation && ref.version === source.target.version && digestSfValue(ref.fields) === digestSfValue(source.target.fields) && digestSfValue(ref.period) === digestSfValue(source.target.period))
    const resolution = await f.evidence.resolve(source, context)
    return matches && ["fresh", "historical"].includes(resolution.state) && resolution.accessRevision === context.binding.accessRevision && digestSfValue(resolution.ref) === digestSfValue(source) && await f.host.revalidate(context)
  }
  services = createReviewServices({ state: f.state, host: f.host, authority: f.domainAuthority, evidence: f.evidence, creationTarget: f.creationTarget, operationIdentity: () => "wp08-review-answer", requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z", selection: {
    select: async () => ({ status: "ok", value: [{ id: "project", title: "Preserved project answer", period: f.period, recordCount: 1, projection }] }),
    authorizeSections: async (context, sections) => access[context.binding.principalRef] === true && sections.every((section) => section.id === "project") && await sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
    authorizeComments: async (context, comments) => comments.length === 0 && await f.host.revalidate(context), authorizeDecision: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcome: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcomeComparison: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeSensitivity: async (context, values) => values.length === 0 && await f.host.revalidate(context),
  } })
  const stored = await f.state.read(f.request("person"), "reviews", () => null)
  const reviewStorageVersion = stored.status === "ok" ? stored.storageVersion : stored.status === "unavailable" && stored.reason === "product-state-uninitialized" ? 0 : undefined
  if (reviewStorageVersion === undefined) throw new Error("Review storage unavailable")
  const review = available(await services.reviews.preserve({ id: "review-answer-original", selectionRef: "project-original-selection", sectionRefs: ["project"], expectedStorageVersion: reviewStorageVersion, idempotencyKey: "review-answer-preserve", targetIncarnation: f.creationTarget.incarnation }, f.author))
  const reviewPort = services.reviews
  const composeAnswerSource = () => createReviewAnswerSource({ reviews: reviewPort, host: f.host, prepareAccess: async (pin, basis, selected, context) => {
    // The adapter has just authenticated the full C05 twice. This producer
    // prepares current ACL/physical leases for every original section source;
    // it does not repeat the complete review read or cache a successful grant.
    if (!services || !access[context.binding.principalRef] || !await f.host.revalidate(context) || digestSfValue(selected) !== pin.reviewDigest || digestSfValue(basis.reviewContext) !== digestSfValue(pin)) return { status: "denied", reason: "review-access-unavailable" }
    const references = allReferences(selected.sections)
    if (!references.length || references.some((ref) => ref.kind !== "record")) return { status: "unavailable", reason: "review-source-unavailable" }
    const records = references.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record")
    const proofs = await Promise.all(records.map((ref) => f.observer.prepareHistoricalReissue(ref, context)))
    if (proofs.some((proof) => proof.status !== "ok")) return { status: "unavailable", reason: "review-source-unavailable" }
    const actorDigest = digestSfValue(f.actors[context.binding.principalRef])
    return { status: "ok", value: { fence: async () => access[context.binding.principalRef] === true && digestSfValue(f.actors[context.binding.principalRef]) === actorDigest && await f.host.revalidate(context) && (await Promise.all(proofs.map((proof) => proof.status === "ok" ? proof.value.fence() : false))).every(Boolean) } }
  } })
  answerSource = composeAnswerSource()
  const basis: ThreadSourceContext = { sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: f.period, evidenceRefs: [source] }
  const pin = available(await services.threadContext.prepare({ reviewRef: review.id, sectionId: "project" }, basis, f.author))
  return { ...f, access, source, review, services, answerSource, basis: { ...basis, reviewContext: pin }, contexts, options,
    reopenConsumers: async () => {
      const closed = await f.reopen()
      leases.clear()
      answerSource = composeAnswerSource()
      return { closed, port: f.compose() }
    },
  }
}

function allReferences(sections: readonly { content: unknown }[]): readonly BusinessEvidenceRef[] {
  return [...new Map(sections.flatMap((section) => reviewProjectionEvidence(section.content as DomainProjection)).map((ref) => [digestSfValue(ref), ref])).values()]
}
