import { selectSfReviewReceipts } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { pinReviewReadProperties } from "../../../../modules/sucafina/Sucafinav1/product/reviews/read-identity.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import { canonicalSfValue, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { sfReviewReadValidation } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import { withSfScopedSourceChecks } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { hasActiveSfSnapshot, hasSfDashboardSourceFence } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { localRecordReview } from "./review-collaboration.ts"

type ReviewResult = PortResult<PreservedReview>
type ReadFailure = Exclude<ReviewResult, { status: "ok" }>
type SnapshotProof = { digest: string; receipt: string; access: string; fence: string; validated?: Extract<ReviewResult, { status: "ok" }> }
type ReadProof = { fence: string }
type ReadScope = { request: Request; open: boolean; calls: WeakMap<TrustedDomainContext, Map<string, ReadProof>>;
  delegated: WeakMap<TrustedDomainContext, Set<string>> }

/** Every consumer reopens the body's own C08 receipt, in addition to producer ACL checks. */
export function protectSfReviewReads(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "state" | "creationTarget">
  reviews: ReturnType<typeof createReviewPort>
  /** Default readers permit the protected body path; dependencies still run afresh. */
  localSnapshotReaders?: boolean
  /** Live recognition supplied only by the registered resident reader factory. */
  residentSnapshotReaders?: () => boolean
  /** Consumer owners/methods only; never a substitute for their callbacks. */
  dependenciesCurrent?: () => boolean | undefined
  /** Late-bound provider identity, captured per actual read; callbacks still run. */
  captureDependencies?: () => (() => boolean) | undefined
}) {
  const { authority, reviews } = input
  const host = authority.host
  const validation = sfReviewReadValidation(reviews)
  const read = reviews.read.bind(reviews)
  const dependenciesCurrent = input.dependenciesCurrent
  const captureDependencies = input.captureDependencies
  const authorityOwner = pinReviewReadProperties(authority, ["host", "state", "creationTarget"])
  const stateReader = authorityOwner && pinReviewReadProperties(authorityOwner.values.state, ["read"])
  const target = authorityOwner && pinReviewReadProperties(authorityOwner.values.creationTarget, ["ref", "incarnation"])
  const hostReader = authorityOwner && pinReviewReadProperties(authorityOwner.values.host,
    ["persistence", "requestFor", "revalidate", "authenticate", "environment"])
  const snapshotReader = hostReader && pinReviewReadProperties(hostReader.values.persistence, ["currentSnapshots"])
  const knownConsumer = !!authorityOwner && !!stateReader && !!target && !!hostReader && !!snapshotReader
  const consumerCurrent = () => !knownConsumer || authorityOwner!.current() && stateReader!.current() && target!.current() &&
    hostReader!.current() && snapshotReader!.current()
  const execution = new AsyncLocalStorage<ReadScope>()
  const sealedDigests = new WeakMap<object, string>()
  const defaultReaders = input.localSnapshotReaders === true
  const residentSnapshotReaders = input.residentSnapshotReaders
  const compositionCurrent = () => consumerCurrent() && input.dependenciesCurrent === dependenciesCurrent && input.captureDependencies === captureDependencies &&
    input.residentSnapshotReaders === residentSnapshotReaders &&
    (!dependenciesCurrent || dependenciesCurrent() !== false) && (!validation || validation.current())
  // Explicit default/wrapped readers retain before -> real read -> after.
  // Only the registered port can validate a current C08 body directly.
  const localReaders = () => knownConsumer && compositionCurrent() && (!dependenciesCurrent || dependenciesCurrent() === true) &&
    (defaultReaders || residentSnapshotReaders?.() === true)
  // Resident portfolio/native dependencies retain their original producer path.
  const supported = (review: PreservedReview) => snapshotBoundReview(review) && (defaultReaders || localRecordReview(review))
  const activeScope = (scope: ReadScope, call: TrustedDomainContext) => scope.open && execution.getStore() === scope &&
    !scope.request.signal.aborted && host.requestFor(call) === scope.request
  const sameCall = (scope: ReadScope, call: TrustedDomainContext, binding: string) => activeScope(scope, call) && localReaders() && reviews.read === protectedRead &&
    digestSfValue([call.kind, call.binding]) === binding
  const receiptDigest = (state: Pick<SfProductState, "reviews" | "transactions">, id: string, digest: string) => {
    if (!state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return undefined
    const receipts = Object.values(state.transactions).filter((receipt) => {
      if (receipt.namespace !== "reviews" || !receipt.principalRef.trim() || receipt.targetRef !== authority.creationTarget.ref ||
        receipt.targetIncarnation !== authority.creationTarget.incarnation || !receipt.value || typeof receipt.value !== "object" || Array.isArray(receipt.value)) return false
      const value = receipt.value
      if ("schema" in value) return value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 &&
        "reviewRef" in value && value.reviewRef === id && "reviewDigest" in value && value.reviewDigest === digest
      return "id" in value && value.id === id && digestSfValue(value) === digest
    })
    return receipts.length ? digestSfValue(receipts) : undefined
  }
  const denied = (): ReadFailure => ({ status: "denied", reason: "review-integrity-unavailable" })
  const unavailable = (): ReadFailure => ({ status: "unavailable", reason: "review-integrity-unavailable" })
  const changed = (): ReadFailure => ({ status: "stale", reason: "review-read-changed" })
  const snapshot = async (id: string, call: TrustedDomainContext, scope: ReadScope, binding: string, dependencies: () => boolean, reuse?: { fence?: string; digest?: string }): Promise<PortResult<SnapshotProof>> => {
    const unchanged = () => sameCall(scope, call, binding) && dependencies()
    const current = async () => unchanged() && await host.revalidate(call) && unchanged()
    try {
      let sourcesCurrent = () => true
      if (!await current()) return denied()
      const checked = await authority.state.read(scope.request, "reviews", selectSfReviewReceipts(async (state, actor): Promise<PortResult<SnapshotProof>> => {
        if (!unchanged() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return denied()
        const persistence = host.persistence
        const fence = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
        const sealed = fence?.readSealed?.()
        const digestIdentity = sealed && (sealed.bytesIdentity ?? sealed.identity)
        const memoized = digestIdentity && sealedDigests.get(digestIdentity)
        const surfaces = ["dashboard", "planner", "procurement"] as const
        const acl = memoized && fence?.observeAuthority?.(surfaces)
        if (acl && (acl.identity !== sealed?.identity || !acl.current())) return denied()
        const snapshots = acl ? undefined : sealed ? sealed.read() : persistence.currentSnapshots?.()
        const authoritySnapshots = acl ? acl.snapshots : snapshots
        const review = state.reviews[id]
        if (!review || review.id !== id) return denied()
        if (!authoritySnapshots) return unavailable()
        const digest = digestSfValue(review), receipt = receiptDigest(state, id, digest)
        if (!receipt) return denied()
        // Reauthenticate every principal. Only the pure digest of the same
        // sealed root is reused. Each authentication receives fresh ACL data.
        const principals = await Promise.all(surfaces.map(async (surface) =>
          [surface, await host.authenticate(scope.request, { surface, roleMap: roleMap(authoritySnapshots[surface], surface) })] as const))
        const at = (await host.environment(scope.request)).at
        if (!await current() || acl && !acl.current()) return denied()
        if (!Number.isFinite(Date.parse(at))) return unavailable()
        const snapshotDigest = memoized ?? digestSfValue(snapshots)
        const sameSnapshots = () => {
          if (!sealed) return digestSfValue(host.persistence.currentSnapshots?.()) === snapshotDigest
          if (host.persistence !== persistence || persistence.dashboardSourceFence !== fence ||
            !hasSfDashboardSourceFence(persistence) || !sealed.current()) return false
          const fresh = fence?.readSealed?.()
          return fresh?.identity === sealed.identity && fresh.current()
        }
        if (!sameSnapshots()) return changed()
        if (digestIdentity) sealedDigests.set(digestIdentity, snapshotDigest)
        const proof: SnapshotProof = { digest, receipt, access: digestSfValue({ actor, principals, binding }),
          fence: digestSfValue({ snapshotDigest, actor, principals, binding, day: new Date(at).toISOString().slice(0, 10), id, digest, receipt }) }
        if (reuse && (reuse.fence === proof.fence || reuse.digest === digest) && supported(review) && validation) {
          // A hit reuses only the protected body's materialization. The exact
          // producer reobserves evidence, projectors and every access callback.
          const observation = await withSfScopedSourceChecks({ owner: host, request: scope.request,
            current: () => unchanged() }, () => validation.validate(id, structuredClone(review), call,
            () => unchanged()))
          sourcesCurrent = observation.current
          const validated = observation.value
          if (!unchanged() || !sourcesCurrent()) return denied()
          if (validated.status !== "ok") return validated
          if (digestSfValue(validated.value) !== digest || digestSfValue(state.reviews[id]) !== digest ||
            receiptDigest(state, id, digest) !== receipt) return denied()
          if (!sameSnapshots()) return changed()
          proof.validated = validated
        }
        return { status: "ok", value: proof }
      }))
      // C08 reauthorizes after its callback. Successful proofs have no later await;
      // failed reads revalidate again before preserving an uncertain result.
      if (!unchanged() || !sourcesCurrent()) return denied()
      if ("reason" in checked) return checked.status === "denied" || await current() ? checked : denied()
      return checked.status === "ok" ? checked.value : unavailable()
    } catch {
      const authorized = await current().catch(() => undefined)
      return authorized === false ? denied() : unavailable()
    }
  }
  const legacyRead = async (id: string, call: TrustedDomainContext): Promise<ReviewResult> => {
    const trace = (stage: string) => { if (process.env.SF_REPORTS_TRACE === "1") console.error("SF_REPORTS_TRACE_" + stage) }
    trace("LEGACY_ENTER")
    const scope = execution.getStore()
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const pinned = () => (!scope || activeScope(scope, call)) && !!request && host.requestFor(call) === request &&
      !request.signal.aborted && binding === digestSfValue([call.kind, call.binding])
    const currentAccess = async () => pinned() && await host.revalidate(call) && pinned()
    try {
      if (!request || !await currentAccess()) return denied()
      const first = await read(id, call)
      trace("LEGACY_FIRST_DONE")
      if (!await currentAccess()) return denied()
      if (first.status !== "ok") return first
      const digest = digestSfValue(first.value)
      const proof = async (): Promise<PortResult<string>> => {
        if (!await currentAccess()) return denied()
        const checked = await authority.state.read(request, "reviews", (state, actor): PortResult<string> => {
          if (!pinned() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
            !state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return denied()
          // The original writer may differ from the current authorized reader.
          const receipt = receiptDigest(state, id, digest)
          return receipt ? { status: "ok", value: receipt } : denied()
        })
        if (!pinned()) return denied()
        if ("reason" in checked) return checked.status === "denied" || await currentAccess() ? checked : denied()
        return checked.status === "ok" ? checked.value : unavailable()
      }
      const before = await proof()
      trace("LEGACY_BEFORE_PROOF_DONE")
      if (before.status !== "ok") return before
      const current = await read(id, call)
      trace("LEGACY_SECOND_DONE")
      if (!await currentAccess()) return denied()
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== digest) return denied()
      const after = await proof()
      trace("LEGACY_AFTER_PROOF_DONE")
      if (!await currentAccess()) return denied()
      if (after.status !== "ok") return after
      if (after.value !== before.value) return denied()
      return first
    } catch {
      const authorized = await currentAccess().catch(() => undefined)
      return authorized === false ? denied() : unavailable()
    }
  }
  const protectedRead = async (id: string, call: TrustedDomainContext): Promise<ReviewResult> => {
    const scope = execution.getStore()
    if (!scope) return legacyRead(id, call)
    if (!activeScope(scope, call)) return denied()
    if (!localReaders()) return legacyRead(id, call)
    const dependencyPin = captureDependencies?.()
    if (captureDependencies && !dependencyPin) return legacyRead(id, call)
    const dependencies = dependencyPin ?? (() => true)
    const binding = digestSfValue([call.kind, call.binding])
    const currentAccess = async () => sameCall(scope, call, binding) && dependencies() && await host.revalidate(call) && sameCall(scope, call, binding) && dependencies()
    try {
      if (!await currentAccess()) return denied()
      let proofs = scope.calls.get(call)
      if (!proofs) { proofs = new Map(); scope.calls.set(call, proofs) }
      const prior = proofs.get(id)
      const before = await snapshot(id, call, scope, binding, dependencies, prior)
      if (before.status === "ok" && prior?.fence === before.value.fence && before.value.validated) return structuredClone(before.value.validated)
      proofs.delete(id)
      if (before.status !== "ok") return before
      // A canonical producer can materialize scoped source metadata. Never invoke
      // it from the final read-only C08 group when its complete proof has changed.
      // Without that producer proof, this invocation cannot authorize reuse of
      // the body. Actual producer/snapshot failures retain their own results.
      if (hasActiveSfSnapshot(host.persistence)) return !validation || scope.delegated.get(call)?.has(id) ? legacyRead(id, call) : denied()
      let first = before.value
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = structuredClone(await read(id, call))
        if (result.status !== "ok") return await currentAccess() ? result : denied()
        const after = await snapshot(id, call, scope, binding, dependencies)
        if (after.status !== "ok") return after
        if (first.digest !== after.value.digest || first.receipt !== after.value.receipt || first.access !== after.value.access ||
          digestSfValue(result.value) !== after.value.digest) return denied()
        if (first.fence === after.value.fence && supported(result.value)) {
          if (validation) proofs.set(id, { fence: after.value.fence })
          return result
        }
        if (!supported(result.value)) {
          let delegated = scope.delegated.get(call)
          if (!delegated) { delegated = new Set(); scope.delegated.set(call, delegated) }
          delegated.add(id)
          return legacyRead(id, call)
        }
        first = after.value
      }
      return changed()
    } catch {
      const authorized = await currentAccess().catch(() => undefined)
      return authorized === false ? denied() : unavailable()
    }
  }
  reviews.read = protectedRead
  return {
    current: () => compositionCurrent() && reviews.read === protectedRead,
    prepareRevalidation: (id: string, digest: string, call: TrustedDomainContext) => {
      const scope = execution.getStore()
      if (!scope || !activeScope(scope, call) || !localReaders() || !validation || !scope.calls.get(call)?.has(id)) return undefined
      const dependencyPin = captureDependencies?.()
      if (captureDependencies && !dependencyPin) return undefined
      const binding = digestSfValue([call.kind, call.binding])
      const dependencies = dependencyPin ?? (() => true)
      return async () => {
        if (!sameCall(scope, call, binding) || !dependencies() || !scope.calls.get(call)?.has(id)) return denied()
        const checked = await snapshot(id, call, scope, binding, dependencies, { digest })
        return checked.status === "ok" ? checked.value.validated ?? denied() : checked
      }
    },
    run: async <Value>(request: Request, work: () => Promise<Value>): Promise<Value> => {
      const current = execution.getStore()
      if (current && (!current.open || current.request.signal.aborted)) throw new Error("SF_REVIEW_READ_SCOPE_CLOSED")
      if (current?.request === request) return work()
      const scope: ReadScope = { request, open: true, calls: new WeakMap(), delegated: new WeakMap() }
      return execution.run(scope, async () => { try { return await work() } finally { scope.open = false } })
    },
    /** A prepared C05 lease must revalidate its real body even when C06 has
     * changed unrelated product rows since the original read. No old dependency
     * result is borrowed: the current C08 receipt and full producer run again. */
    revalidate: async (id: string, digest: string, call: TrustedDomainContext): Promise<ReviewResult> => {
      const scope = execution.getStore()
      if (!scope) return legacyRead(id, call)
      if (!activeScope(scope, call)) return denied()
      if (!localReaders() || !validation) return legacyRead(id, call)
      if (!scope.calls.get(call)?.has(id)) return scope.delegated.get(call)?.has(id)
        ? legacyRead(id, call) : denied()
      const dependencyPin = captureDependencies?.()
      if (captureDependencies && !dependencyPin) return legacyRead(id, call)
      const binding = digestSfValue([call.kind, call.binding])
      const checked = await snapshot(id, call, scope, binding, dependencyPin ?? (() => true), { digest })
      return checked.status === "ok" ? checked.value.validated ?? denied() : checked
    },
    prepare: async (references: readonly string[], call: TrustedDomainContext) => {
      // Finish source materialization before the atomic group. A second pass
      // observes one common fence if a later predecessor first opened a scope.
      for (let pass = 0; pass < 2; pass++) for (const id of references) await protectedRead(id, call)
    },
  }
}

export type SfReviewReadScope = ReturnType<typeof protectSfReviewReads>

/** External/native outcomes, comments and document readers retain the full producer path. */
export function snapshotBoundReview(review: PreservedReview) {
  if (review.comments.length) return false
  let remaining = 20_000
  const evidence = new Map<string, number>()
  const visit = (value: unknown, depth = 0): boolean => {
    if (depth > 24 || --remaining < 0) return false
    if (!value || typeof value !== "object") return true
    if (Array.isArray(value)) return value.every((entry) => visit(entry, depth + 1))
    if ("reviewOutcome" in value || "reviewOutcomeComparison" in value ||
      "reviewCommentRefs" in value && (!Array.isArray(value.reviewCommentRefs) || value.reviewCommentRefs.length > 0) ||
      "reviewChart" in value && value.reviewChart && typeof value.reviewChart === "object" && "sensitivity" in value.reviewChart) return false
    if ("decision" in value && value.decision !== undefined && (!value.decision || typeof value.decision !== "object" ||
      !("kind" in value.decision) || value.decision.kind !== "portfolio")) return false
    if ("schema" in value && value.schema === "sf-evidence-v1" &&
      (!("kind" in value) || value.kind !== "record" || !("target" in value) || !value.target || typeof value.target !== "object" ||
       !("surface" in value.target) || !["dashboard", "planner", "procurement"].includes(String(value.target.surface)))) return false
    // Repeated cells/charts carry copies of the same complete record evidence.
    // Reuse only a successful structural visit in this invocation, at an equal
    // or deeper placement. A deeper occurrence must still prove the depth cap.
    // Every occurrence above spends budget; source/receipt authority is separate.
    const canonical = "schema" in value && value.schema === "sf-evidence-v1" ? canonicalSfValue(value) : undefined
    if (canonical !== undefined && (evidence.get(canonical) ?? -1) >= depth) return true
    const accepted = Object.values(value).every((entry) => visit(entry, depth + 1))
    if (accepted && canonical !== undefined) evidence.set(canonical, depth)
    return accepted
  }
  return visit(review)
}
