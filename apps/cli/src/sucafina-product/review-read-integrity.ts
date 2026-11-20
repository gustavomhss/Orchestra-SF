import { sfInstalledReportsDiagnostic } from "../../../../modules/sucafina/Sucafinav1/runtime/reports-installed-diagnostic.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import { canonicalSfValue, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { localRecordReview } from "./review-collaboration.ts"

type ReviewResult = PortResult<PreservedReview>
type ReadFailure = Exclude<ReviewResult, { status: "ok" }>
type SnapshotProof = { digest: string; receipt: string; access: string; fence: string }
type ReadProof = { fence: string; result: ReviewResult }
type ReadScope = { request: Request; open: boolean; calls: WeakMap<TrustedDomainContext, Map<string, ReadProof>>;
  delegated: WeakMap<TrustedDomainContext, Set<string>> }

const recordReadCost = (stage: string, started: number) => sfInstalledReportsDiagnostic.metric("review." + stage, started)

/** Every consumer reopens the body's own C08 receipt, in addition to producer ACL checks. */
export function protectSfReviewReads(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "state" | "creationTarget">
  reviews: ReturnType<typeof createReviewPort>
  /** Only the default installation readers have their entire authority in these snapshots. */
  localSnapshotReaders?: boolean
  /** Live recognition supplied only by the registered resident reader factory. */
  residentSnapshotReaders?: () => boolean
}) {
  const { authority, reviews } = input
  const host = authority.host
  const timedSnapshots = () => {
    const started = performance.now()
    const value = host.persistence.currentSnapshots?.()
    recordReadCost(value ? "current-snapshots-copy" : "current-snapshots-empty", started)
    return value
  }
  const read = reviews.read.bind(reviews)
  const execution = new AsyncLocalStorage<ReadScope>()
  const defaultReaders = input.localSnapshotReaders === true
  const localReaders = () => defaultReaders || input.residentSnapshotReaders?.() === true
  // Resident portfolio/native dependencies retain their original producer path.
  const supported = (review: PreservedReview) => snapshotBoundReview(review) && (defaultReaders || localRecordReview(review))
  const sameCall = (scope: ReadScope, call: TrustedDomainContext, binding: string) => scope.open && localReaders() &&
    execution.getStore() === scope && host.requestFor(call) === scope.request && !scope.request.signal.aborted &&
    digestSfValue([call.kind, call.binding]) === binding
  const receiptDigest = (state: Readonly<SfProductState>, id: string, digest: string) => {
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
  const snapshot = async (id: string, call: TrustedDomainContext, scope: ReadScope, binding: string): Promise<PortResult<SnapshotProof>> => {
    const current = async () => sameCall(scope, call, binding) && await host.revalidate(call) && sameCall(scope, call, binding)
    try {
      if (!await current()) return denied()
      const stateStarted = performance.now()
      const checked = await authority.state.read(scope.request, "reviews", async (state, actor): Promise<PortResult<SnapshotProof>> => {
        if (!sameCall(scope, call, binding) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return denied()
        const snapshots = timedSnapshots()
        const review = state.reviews[id]
        if (!review || review.id !== id) return denied()
        if (!snapshots) return unavailable()
        const reviewStarted = performance.now()
        const digest = digestSfValue(review), receipt = receiptDigest(state, id, digest)
        recordReadCost("review-and-receipt-digests", reviewStarted)
        if (!receipt) return denied()
        // Reauthenticate the actual domain principals as well as the C08 reader.
        // Full snapshots include unversioned case/body/receipt changes and source metadata.
        const principals = await Promise.all((["dashboard", "planner", "procurement"] as const).map(async (surface) =>
          [surface, await host.authenticate(scope.request, { surface, roleMap: roleMap(snapshots[surface], surface) })] as const))
        const at = (await host.environment(scope.request)).at
        if (!await current()) return denied()
        if (!Number.isFinite(Date.parse(at))) return unavailable()
        const liveSnapshots = timedSnapshots()
        const liveStarted = performance.now()
        const liveDigest = digestSfValue(liveSnapshots)
        recordReadCost("live-full-snapshot-digest", liveStarted)
        const capturedStarted = performance.now()
        const capturedDigest = digestSfValue(snapshots)
        recordReadCost("captured-full-snapshot-digest", capturedStarted)
        if (liveDigest !== capturedDigest) return changed()
        const accessStarted = performance.now()
        const access = digestSfValue({ actor, principals, binding })
        recordReadCost("access-digest", accessStarted)
        const fenceStarted = performance.now()
        const fence = digestSfValue({ snapshots, actor, principals, binding, day: new Date(at).toISOString().slice(0, 10), id, digest, receipt })
        recordReadCost("full-snapshot-fence-digest", fenceStarted)
        return { status: "ok", value: { digest, receipt, access, fence } }
      })
      recordReadCost("scope-state-read-inclusive", stateStarted)
      // C08 reauthorizes after its callback. Successful proofs have no later await;
      // failed reads revalidate again before preserving an uncertain result.
      if (!sameCall(scope, call, binding)) return denied()
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
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const pinned = () => !!request && host.requestFor(call) === request && !request.signal.aborted && binding === digestSfValue([call.kind, call.binding])
    const currentAccess = async () => pinned() && await host.revalidate(call) && pinned()
    try {
      if (!request || !await currentAccess()) return denied()
      const firstStarted = performance.now()
      const first = await read(id, call)
      recordReadCost("canonical-producer-read", firstStarted)
      trace("LEGACY_FIRST_DONE")
      if (!await currentAccess()) return denied()
      if (first.status !== "ok") return first
      const digest = digestSfValue(first.value)
      const proof = async (): Promise<PortResult<string>> => {
        if (!await currentAccess()) return denied()
        const stateStarted = performance.now()
        const checked = await authority.state.read(request, "reviews", (state, actor): PortResult<string> => {
          if (!pinned() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
            !state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return denied()
          // The original writer may differ from the current authorized reader.
          const receipt = receiptDigest(state, id, digest)
          return receipt ? { status: "ok", value: receipt } : denied()
        })
        recordReadCost("legacy-state-read-inclusive", stateStarted)
        if (!pinned()) return denied()
        if ("reason" in checked) return checked.status === "denied" || await currentAccess() ? checked : denied()
        return checked.status === "ok" ? checked.value : unavailable()
      }
      const before = await proof()
      trace("LEGACY_BEFORE_PROOF_DONE")
      if (before.status !== "ok") return before
      const currentStarted = performance.now()
      const current = await read(id, call)
      recordReadCost("canonical-producer-read", currentStarted)
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
    if (!scope || !localReaders()) return legacyRead(id, call)
    const binding = digestSfValue([call.kind, call.binding])
    const currentAccess = async () => sameCall(scope, call, binding) && await host.revalidate(call) && sameCall(scope, call, binding)
    try {
      if (!await currentAccess()) return denied()
      let proofs = scope.calls.get(call)
      if (!proofs) { proofs = new Map(); scope.calls.set(call, proofs) }
      const prior = proofs.get(id)
      const before = await snapshot(id, call, scope, binding)
      if (before.status === "ok" && prior?.fence === before.value.fence) return structuredClone(prior.result)
      proofs.delete(id)
      if (before.status !== "ok") return before
      // A canonical producer can materialize scoped source metadata. Never invoke
      // it from the final read-only C08 group when its complete proof has changed.
      // Without that producer proof, this invocation cannot authorize reuse of
      // the body. Actual producer/snapshot failures retain their own results.
      if (timedSnapshots()) return scope.delegated.get(call)?.has(id) ? legacyRead(id, call) : denied()
      let first = before.value
      for (let attempt = 0; attempt < 2; attempt++) {
        const producerStarted = performance.now()
        const produced = await read(id, call)
        recordReadCost("canonical-producer-read", producerStarted)
        const cloneStarted = performance.now()
        const result = structuredClone(produced)
        recordReadCost("producer-result-clone", cloneStarted)
        if (result.status !== "ok") return await currentAccess() ? result : denied()
        const after = await snapshot(id, call, scope, binding)
        if (after.status !== "ok") return after
        if (first.digest !== after.value.digest || first.receipt !== after.value.receipt || first.access !== after.value.access ||
          digestSfValue(result.value) !== after.value.digest) return denied()
        if (first.fence === after.value.fence && supported(result.value)) {
          proofs.set(id, { fence: after.value.fence, result: structuredClone(result) })
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
    run: async <Value>(request: Request, work: () => Promise<Value>): Promise<Value> => {
      const current = execution.getStore()
      if (current?.open && current.request === request) return work()
      const scope: ReadScope = { request, open: true, calls: new WeakMap(), delegated: new WeakMap() }
      return execution.run(scope, async () => { try { return await work() } finally { scope.open = false } })
    },
    prepare: async (references: readonly string[], call: TrustedDomainContext) => {
      // Finish source materialization before the atomic group. A second pass
      // observes one common fence if a later predecessor first opened a scope.
      for (let pass = 0; pass < 2; pass++) for (const id of references) await protectedRead(id, call)
    },
  }
}

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
