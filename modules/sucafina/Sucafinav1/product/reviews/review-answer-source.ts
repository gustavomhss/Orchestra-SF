import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmationScope, DomainProjection, PreservedReview, SourceRef } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationScopeObservation } from "../collaboration/confirmation.ts"
import type { ThreadSourceContext } from "../collaboration/thread-context.ts"
import { reviewProjectionEvidence } from "./port.ts"
import type { createReviewPort } from "./port.ts"
import { createReviewThreadContext, isReviewThreadContext } from "./thread-context.ts"
import type { ReviewThreadContext, ReviewThreadSnapshot } from "./thread-context.ts"

export type ReviewAnswerBasis = ThreadSourceContext & { reviewContext: ReviewThreadContext }
export type ReviewAnswerObservation = AvailableConfirmationScopeObservation & {
  evidence: Extract<BusinessEvidenceRef, { kind: "record" }>
  projection: DomainProjection
  /** Private transport handle, excluded from persisted C06 fingerprints. */
  accessLeaseRef: string
}

/** Confirmation concerns this immutable C05 section, never the current domain.
 * The producer prepares current ACL/physical-continuity leases outside C08;
 * its fence must only inspect the protected snapshots during a transaction.
 */
export function createReviewAnswerSource(input: {
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">
  prepareAccess: (pin: ReviewThreadContext, basis: ReviewAnswerBasis, review: PreservedReview, context: TrustedDomainContext) => Promise<PortResult<{ fence: () => Promise<boolean> }>>
}) {
  const contexts = createReviewThreadContext(input)
  const leases = new Map<string, { authorityScopeDigest: string; reviewDigest: string; observationDigest: string; fence: () => Promise<boolean>; current: () => boolean }>()
  const key = (scope: ConfirmationScope, basis: ReviewAnswerBasis, context: TrustedDomainContext) => digestSfValue({ scope, basis, authority: context.binding })
  const read = async (basis: ReviewAnswerBasis, context: TrustedDomainContext) => {
    if (!basis || !isReviewThreadContext(basis.reviewContext)) return { status: "unavailable" as const, reason: "review-answer-source-unavailable" }
    return contexts.read(basis.reviewContext, basis, context)
  }
  const fence = async (scope: ConfirmationScope, observation: ReviewAnswerObservation, basis: ReviewAnswerBasis, context: TrustedDomainContext) => {
    if (!basis || !isReviewThreadContext(basis.reviewContext) || observation?.state !== "available") return false
    try {
      const lease = leases.get(observation.accessLeaseRef)
      const request = input.host.requestFor(context)
      const stored = () => {
        const snapshot = input.host.persistence.currentSnapshots?.()?.dashboard
        return snapshot && object(object(snapshot.data.__sfProductV1).reviews)[basis.reviewContext.reviewRef]
      }
      if (!lease || lease.authorityScopeDigest !== key(scope, basis, context) || !request || request.signal.aborted || !lease.current() || digestSfValue(observation) !== lease.observationDigest || digestSfValue(stored()) !== lease.reviewDigest || !await input.host.revalidate(context)) return false
      if (!await lease.fence() || !lease.current() || digestSfValue(stored()) !== lease.reviewDigest || !await input.host.revalidate(context)) return false
      return await lease.fence() && lease.current() && !request.signal.aborted && digestSfValue(stored()) === lease.reviewDigest && await input.host.revalidate(context) && lease.current() && !request.signal.aborted && digestSfValue(stored()) === lease.reviewDigest
    } catch { return false }
  }
  return {
    resolve: async (basis: ReviewAnswerBasis, context: TrustedDomainContext): Promise<PortResult<{ scope: ConfirmationScope }>> => {
      try {
        const selected = structuredClone(basis)
        const found = await read(selected, context)
        if (found.status !== "ok") return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        const material = answerMaterial(found.value, selected)
        return material ? { status: "ok", value: { scope: material.scope } } : { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
      } catch { return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" } }
    },
    // Thread writes retain the whole authenticated C05 authority. They do not
    // require the narrower record-only scope used to confirm a C06 answer.
    prepareThreadFence: async (basis: ThreadSourceContext, context: TrustedDomainContext): Promise<(() => Promise<boolean>) | undefined> => {
      try {
        if (!isReviewThreadContext(basis?.reviewContext)) return undefined
        const selected: ReviewAnswerBasis = structuredClone({ ...basis, reviewContext: basis.reviewContext })
        const reviews = input.reviews
        const readReview = reviews.read
        const host = input.host
        const revalidate = host.revalidate
        const requestFor = host.requestFor
        const persistence = host.persistence
        const transactionAll = persistence.transactionAll
        const currentSnapshots = persistence.currentSnapshots
        const prepareAccess = input.prepareAccess
        const request = requestFor.call(host, context)
        const current = () => input.reviews === reviews && reviews.read === readReview && input.host === host && host.revalidate === revalidate && host.requestFor === requestFor && host.persistence === persistence && persistence.transactionAll === transactionAll && persistence.currentSnapshots === currentSnapshots && input.prepareAccess === prepareAccess && requestFor.call(host, context) === request && !request?.signal.aborted
        if (!request || !transactionAll || !currentSnapshots || typeof prepareAccess !== "function" || currentSnapshots.call(persistence) || !current()) return undefined
        const found = await read(selected, context)
        if (!current() || found.status !== "ok") return undefined
        const access = await prepareAccess(structuredClone(found.value.pin), structuredClone(selected), structuredClone(found.value.review), context)
        if (!current() || access.status !== "ok" || typeof access.value.fence !== "function" || !await revalidate.call(host, context) || !current()) return undefined
        const accessLease = access.value
        const accessFence = accessLease.fence
        const stored = () => {
          const snapshot = currentSnapshots.call(persistence)?.dashboard
          return snapshot && object(object(snapshot.data.__sfProductV1).reviews)[selected.reviewContext.reviewRef]
        }
        const unchanged = () => current() && accessLease.fence === accessFence && digestSfValue(stored()) === found.value.pin.reviewDigest
        const threadFence = async () => {
          try {
            if (!unchanged() || !await revalidate.call(host, context) || !unchanged() || !await accessFence.call(accessLease) || !unchanged()) return false
            if (!await revalidate.call(host, context) || !unchanged() || !await accessFence.call(accessLease) || !unchanged()) return false
            return await revalidate.call(host, context) && unchanged()
          } catch { return false }
        }
        const verified = await transactionAll.call(persistence, async () => ({ commit: false, value: await threadFence() }), { signal: request.signal })
        return verified && current() && await revalidate.call(host, context) && current() ? threadFence : undefined
      } catch { return undefined }
    },
    observe: async (scope: ConfirmationScope, basis: ReviewAnswerBasis, context: TrustedDomainContext): Promise<ReviewAnswerObservation | Exclude<ConfirmationScopeObservation, AvailableConfirmationScopeObservation>> => {
      const unavailable = { state: "access-unavailable" as const, sourceVersion: 0 }
      try {
        const selected = structuredClone({ scope, basis })
        const reviews = input.reviews
        const readReview = reviews.read
        const host = input.host
        const revalidate = host.revalidate
        const requestFor = host.requestFor
        const persistence = host.persistence
        const transactionAll = persistence.transactionAll
        const currentSnapshots = persistence.currentSnapshots
        const prepareAccess = input.prepareAccess
        const request = requestFor.call(host, context)
        const current = () => input.reviews === reviews && reviews.read === readReview && input.host === host && host.revalidate === revalidate && host.requestFor === requestFor && host.persistence === persistence && persistence.transactionAll === transactionAll && persistence.currentSnapshots === currentSnapshots && input.prepareAccess === prepareAccess && requestFor.call(host, context) === request && !request?.signal.aborted
        if (!request || !transactionAll || !currentSnapshots || typeof prepareAccess !== "function" || currentSnapshots.call(persistence) || !current()) return unavailable
        const found = await read(selected.basis, context)
        if (!current() || found.status !== "ok") return unavailable
        const material = answerMaterial(found.value, selected.basis)
        if (!material || digestSfValue(material.scope) !== digestSfValue(selected.scope)) return { state: "dependency-unavailable", sourceVersion: 0 }
        const access = await prepareAccess(structuredClone(found.value.pin), structuredClone(selected.basis), structuredClone(found.value.review), context)
        if (!current() || access.status !== "ok" || typeof access.value.fence !== "function" || !await revalidate.call(host, context)) return unavailable
        const accessLease = access.value
        const accessFence = accessLease.fence
        const sourceFingerprint = digestSfValue({ reviewContext: found.value.pin, source: material.evidence, projection: material.projection })
        const dependencyFingerprint = digestSfValue({ reviewContext: found.value.pin, evidenceRefs: material.references, dependencies: material.scope.materialDependencies })
        const observation: ReviewAnswerObservation = { state: "available", sourceVersion: material.evidence.target.version, incarnation: material.evidence.target.incarnation, physicalIncarnation: digestSfValue(found.value.pin), sourceFingerprint, dependencyFingerprint, scopeFingerprint: digestSfValue({ scope: selected.scope, basis: selected.basis, sourceFingerprint, dependencyFingerprint }), evidence: material.evidence, projection: material.projection, accessLeaseRef: crypto.randomUUID() }
        const leaseKey = observation.accessLeaseRef
        leases.set(leaseKey, { authorityScopeDigest: key(selected.scope, selected.basis, context), reviewDigest: found.value.pin.reviewDigest, observationDigest: digestSfValue(observation), fence: () => accessFence.call(accessLease), current: () => current() && accessLease.fence === accessFence })
        if (leases.size > 512) leases.delete(leases.keys().next().value!)
        const verified = await transactionAll.call(persistence, async () => ({ commit: false, value: await fence(selected.scope, observation, selected.basis, context) }), { signal: request.signal }).catch(() => false)
        if (!verified || !current() || !await revalidate.call(host, context) || !current()) { leases.delete(leaseKey); return unavailable }
        return structuredClone(observation)
      } catch { return unavailable }
    },
    fence,
  }
}

function answerMaterial(snapshot: ReviewThreadSnapshot, basis: ReviewAnswerBasis) {
  const section = snapshot.review.sections.find((entry) => entry.id === snapshot.pin.sectionId)
  if (!section) return undefined
  const projection = structuredClone(section.content as DomainProjection)
  const references = [...new Map(reviewProjectionEvidence(projection).map((reference) => [digestSfValue(reference), reference])).values()]
  // C06's record scope cannot silently discard a calculation/document dependency.
  if (!references.length || references.some((reference) => reference.kind !== "record")) return undefined
  const records = references.filter((reference): reference is Extract<BusinessEvidenceRef, { kind: "record" }> => reference.kind === "record")
  const sources = records.filter((reference) => reference.refId === basis.sourceRef)
  const source = sources[0]
  if (sources.length !== 1 || !source || source.target.incarnation !== basis.sourceIncarnation || source.target.version !== basis.observedVersion || !isSfPeriod(source.target.period) || !source.target.fields.length) return undefined
  const target = source.target
  const dependencies: SourceRef[] = []
  for (const reference of records) {
    if (reference === source) continue
    if (!isSfPeriod(reference.target.period) || !reference.target.fields.length) return undefined
    dependencies.push({ surface: reference.target.surface, type: reference.target.recordType, id: reference.target.recordId, incarnation: reference.target.incarnation, version: reference.target.version, fields: [...reference.target.fields].sort(), period: reference.target.period, observedAt: snapshot.review.createdAt })
  }
  const scope: ConfirmationScope = { sourceRef: { surface: target.surface, type: target.recordType, id: target.recordId, incarnation: target.incarnation }, fields: [...target.fields].sort(), period: basis.period, materialDependencies: dependencies.toSorted((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))), scopeDefinitionVersion: "review-thread-c06-v1" }
  return { scope, evidence: structuredClone(source), projection, references: structuredClone(references) }
}
