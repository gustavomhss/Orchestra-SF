import { hasActiveSfSnapshot, hasSfDashboardSourceFence, object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
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
  readContext?: (pin: ReviewThreadContext, basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<PortResult<ReviewThreadSnapshot>>
  reuseResolvedMaterial?: (snapshot: ReviewThreadSnapshot, context: TrustedDomainContext) => boolean
}) {
  const contexts = createReviewThreadContext(input)
  const readContext = input.readContext
  const reuseResolvedMaterial = input.reuseResolvedMaterial
  const resolved = new WeakMap<TrustedDomainContext, {
    scopeKey: string
    snapshot: ReviewThreadSnapshot
    material: NonNullable<ReturnType<typeof answerMaterial>>
    current: () => boolean
  }>()
  const leases = new Map<string, { authorityScopeDigest: string; reviewDigest: string; observationDigest: string; fence: () => Promise<boolean>; current: () => boolean }>()
  const key = (scope: ConfirmationScope, basis: ReviewAnswerBasis, context: TrustedDomainContext) => digestSfValue({ scope, basis, authority: context.binding })
  const read = async (basis: ReviewAnswerBasis, context: TrustedDomainContext) => {
    if (!basis || !isReviewThreadContext(basis.reviewContext)) return { status: "unavailable" as const, reason: "review-answer-source-unavailable" }
    if (!readContext) return contexts.read(basis.reviewContext, basis, context)
    if (input.readContext !== readContext) return { status: "unavailable" as const, reason: "review-answer-source-unavailable" }
    const result = await readContext(basis.reviewContext, basis, context)
    return input.readContext === readContext ? result : { status: "unavailable" as const, reason: "review-answer-source-unavailable" }
  }
  const fence = async (scope: ConfirmationScope, observation: ReviewAnswerObservation, basis: ReviewAnswerBasis, context: TrustedDomainContext) => {
    if (!basis || !isReviewThreadContext(basis.reviewContext) || observation?.state !== "available") return false
    try {
      const lease = leases.get(observation.accessLeaseRef)
      const host = input.host
      const request = host.requestFor(context)
      if (!lease || lease.authorityScopeDigest !== key(scope, basis, context) || !request || request.signal.aborted ||
          !lease.current() || digestSfValue(observation) !== lease.observationDigest) return false
      const persistence = host.persistence
      const atomic = context.kind === "ui" && hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
      const readSealed = atomic?.readSealed
      const readDashboard = atomic?.currentSnapshot
      const admitted = readDashboard && readSealed?.call(atomic)
      const reviewRef = basis.reviewContext.reviewRef
      const storedReview = (snapshot: Snapshot | undefined, ref: string) =>
        snapshot && object(object(snapshot.data.__sfProductV1).reviews)[ref]
      // The digest is pure over the sealed root. Each checkpoint still
      // independently obtains the current root and runs the real authority.
      let sealedDigest: string | undefined
      const matchesStoredReview = () => {
        if (!admitted?.bytesIdentity) return digestSfValue(storedReview(input.host.persistence.currentSnapshots?.()?.dashboard,
          basis.reviewContext.reviewRef)) === lease.reviewDigest
        if (input.host !== host || host.persistence !== persistence || host.requestFor(context) !== request || request.signal.aborted ||
          basis.reviewContext.reviewRef !== reviewRef || !atomic || !readDashboard || atomic.readSealed !== readSealed ||
          persistence.dashboardSourceFence !== atomic || atomic.currentSnapshot !== readDashboard ||
          !hasSfDashboardSourceFence(persistence) || !admitted.current()) return false
        const observed = readSealed?.call(atomic)
        if (!observed || observed.identity !== admitted.identity || observed.bytesIdentity !== admitted.bytesIdentity ||
          !observed.current()) return false
        sealedDigest ??= digestSfValue(storedReview(readDashboard.call(persistence, "dashboard"), reviewRef))
        return sealedDigest === lease.reviewDigest && observed.current() && admitted.current()
      }
      if (!matchesStoredReview() || !await input.host.revalidate(context)) return false
      if (!await lease.fence() || !lease.current() || !matchesStoredReview() || !await input.host.revalidate(context)) return false
      return await lease.fence() && lease.current() && !request.signal.aborted && matchesStoredReview() &&
        await input.host.revalidate(context) && lease.current() && !request.signal.aborted && matchesStoredReview()
    } catch { return false }
  }
  return {
    resolve: async (basis: ReviewAnswerBasis, context: TrustedDomainContext): Promise<PortResult<{ scope: ConfirmationScope }>> => {
      try {
        resolved.delete(context)
        const selected = structuredClone(basis)
        const host = input.host
        const reviews = input.reviews
        const readReview = reviews.read
        const revalidate = host.revalidate
        const requestFor = host.requestFor
        const persistence = host.persistence
        const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
        const prepareAccess = input.prepareAccess
        const request = reuseResolvedMaterial && readContext && atomic && context.kind === "ui" && requestFor.call(host, context)
        const lease = context.lease
        const current = () => !!request && !request.signal.aborted && context.lease === lease && input.host === host &&
          host.requestFor === requestFor && host.revalidate === revalidate && requestFor.call(host, context) === request &&
          input.reviews === reviews && reviews.read === readReview && host.persistence === persistence && !!atomic &&
          hasSfDashboardSourceFence(persistence) && persistence.dashboardSourceFence === atomic &&
          input.readContext === readContext && input.prepareAccess === prepareAccess && input.reuseResolvedMaterial === reuseResolvedMaterial
        const found = await read(selected, context)
        if (found.status !== "ok") return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        const material = answerMaterial(found.value, selected)
        if (!material) return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        const resident = () => current() && reuseResolvedMaterial?.(found.value, context) === true
        if (resident()) resolved.set(context, { scopeKey: key(material.scope, selected, context), snapshot: found.value, material, current: resident })
        return { status: "ok", value: { scope: structuredClone(material.scope) } }
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
        const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
        const readSealed = atomic?.readSealed
        const readDashboard = atomic?.currentSnapshot
        const prepareAccess = input.prepareAccess
        const request = requestFor.call(host, context)
        const current = () => input.reviews === reviews && reviews.read === readReview && input.host === host && host.revalidate === revalidate && host.requestFor === requestFor && host.persistence === persistence && persistence.transactionAll === transactionAll && persistence.currentSnapshots === currentSnapshots && input.prepareAccess === prepareAccess && requestFor.call(host, context) === request && !request?.signal.aborted &&
          (!atomic || persistence.dashboardSourceFence === atomic && hasSfDashboardSourceFence(persistence) &&
            atomic.readSealed === readSealed && atomic.currentSnapshot === readDashboard)
        if (!request || !transactionAll || !currentSnapshots || typeof prepareAccess !== "function" || hasActiveSfSnapshot(persistence) || !current()) return undefined
        const found = await read(selected, context)
        if (!current() || found.status !== "ok") return undefined
        const access = await prepareAccess(structuredClone(found.value.pin), structuredClone(selected), structuredClone(found.value.review), context)
        if (!current() || access.status !== "ok" || typeof access.value.fence !== "function" || !await revalidate.call(host, context) || !current()) return undefined
        const accessLease = access.value
        const accessFence = accessLease.fence
        const digests = new WeakMap<object, string>()
        const threadFence = async () => {
          try {
            if (!current()) return false
            const read = () => atomic && readSealed?.call(atomic)
            const admitted = read()
            const observation = { first: admitted }
            const storedDigest = () => {
              if (admitted && !admitted.current()) return undefined
              const sealed = admitted && (observation.first ?? read())
              observation.first = undefined
              if (admitted && (!sealed || sealed.identity !== admitted.identity ||
                sealed.bytesIdentity !== admitted.bytesIdentity || !sealed.current())) return undefined
              // Only the pure body digest follows identical SQL bytes across roots.
              const identity = sealed?.bytesIdentity ?? sealed?.identity
              const cached = identity && digests.get(identity)
              if (cached) return cached
              const snapshot = sealed && readDashboard ? readDashboard.call(persistence, "dashboard") :
                (sealed ? sealed.read() : currentSnapshots.call(persistence))?.dashboard
              const digest = digestSfValue(snapshot && object(object(snapshot.data.__sfProductV1).reviews)[selected.reviewContext.reviewRef])
              if (sealed && identity) {
                if (!sealed.current()) return undefined
                digests.set(identity, digest)
              }
              return digest
            }
            const unchanged = () => current() && accessLease.fence === accessFence && storedDigest() === found.value.pin.reviewDigest
            if (!unchanged() || !await revalidate.call(host, context) || !unchanged() || !await accessFence.call(accessLease) || !unchanged()) return false
            if (!await revalidate.call(host, context) || !unchanged() || !await accessFence.call(accessLease) || !unchanged()) return false
            return await revalidate.call(host, context) && unchanged()
          } catch { return false }
        }
        const verify = async () => ({ commit: false, value: await threadFence() })
        const verified = atomic
          ? await atomic.transaction.call(persistence, "dashboard", verify, { signal: request.signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
          : await transactionAll.call(persistence, verify, { signal: request.signal })
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
        const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
        const prepareAccess = input.prepareAccess
        const request = requestFor.call(host, context)
        const current = () => input.reviews === reviews && reviews.read === readReview && input.host === host && host.revalidate === revalidate && host.requestFor === requestFor && host.persistence === persistence && persistence.transactionAll === transactionAll && persistence.currentSnapshots === currentSnapshots && input.prepareAccess === prepareAccess && requestFor.call(host, context) === request && !request?.signal.aborted &&
          (!atomic || persistence.dashboardSourceFence === atomic && hasSfDashboardSourceFence(persistence))
        if (!request || !transactionAll || !currentSnapshots || typeof prepareAccess !== "function" || hasActiveSfSnapshot(persistence) || !current()) return unavailable
        // Only reuse detached material produced for this admitted request and
        // scope. prepareAccess still makes its own pair of protected reads.
        const candidate = resolved.get(context)
        resolved.delete(context)
        if (candidate && !candidate.current()) return unavailable
        const cached = candidate?.scopeKey === key(selected.scope, selected.basis, context) ? candidate : undefined
        const materialCurrent = () => current() && (!cached || cached.current())
        if (!materialCurrent()) return unavailable
        const found = cached ? { status: "ok" as const, value: cached.snapshot } : await read(selected.basis, context)
        if (!materialCurrent() || found.status !== "ok") return unavailable
        const material = cached?.material ?? answerMaterial(found.value, selected.basis)
        if (!material || digestSfValue(material.scope) !== digestSfValue(selected.scope)) return { state: "dependency-unavailable", sourceVersion: 0 }
        const access = await prepareAccess(structuredClone(found.value.pin), structuredClone(selected.basis), structuredClone(found.value.review), context)
        if (!materialCurrent() || access.status !== "ok" || typeof access.value.fence !== "function" || !await revalidate.call(host, context) || !materialCurrent()) return unavailable
        const accessLease = access.value
        const accessFence = accessLease.fence
        const sourceFingerprint = digestSfValue({ reviewContext: found.value.pin, source: material.evidence, projection: material.projection })
        const dependencyFingerprint = digestSfValue({ reviewContext: found.value.pin, evidenceRefs: material.references, dependencies: material.scope.materialDependencies })
        const observation: ReviewAnswerObservation = { state: "available", sourceVersion: material.evidence.target.version, incarnation: material.evidence.target.incarnation, physicalIncarnation: digestSfValue(found.value.pin), sourceFingerprint, dependencyFingerprint, scopeFingerprint: digestSfValue({ scope: selected.scope, basis: selected.basis, sourceFingerprint, dependencyFingerprint }), evidence: material.evidence, projection: material.projection, accessLeaseRef: crypto.randomUUID() }
        const leaseKey = observation.accessLeaseRef
        leases.set(leaseKey, { authorityScopeDigest: key(selected.scope, selected.basis, context), reviewDigest: found.value.pin.reviewDigest, observationDigest: digestSfValue(observation), fence: () => accessFence.call(accessLease), current: () => materialCurrent() && accessLease.fence === accessFence })
        if (leases.size > 512) leases.delete(leases.keys().next().value!)
        const verify = async () => ({ commit: false, value: materialCurrent() && await fence(selected.scope, observation, selected.basis, context) })
        const verified = await (atomic
          ? atomic.transaction("dashboard", verify, { signal: request.signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
          : transactionAll.call(persistence, verify, { signal: request.signal })).catch(() => false)
        if (!verified || !materialCurrent() || !await revalidate.call(host, context) || !materialCurrent()) { leases.delete(leaseKey); return unavailable }
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
