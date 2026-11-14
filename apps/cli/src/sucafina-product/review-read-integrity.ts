import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"

type ReviewResult = PortResult<PreservedReview>
type ReadProof = { fence: string; result: ReviewResult }
type ReadScope = { request: Request; open: boolean; calls: WeakMap<TrustedDomainContext, Map<string, ReadProof>>;
  delegated: WeakMap<TrustedDomainContext, Set<string>> }

/** Every consumer reopens the body's own C08 receipt, in addition to producer ACL checks. */
export function protectSfReviewReads(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  reviews: ReturnType<typeof createReviewPort>
  /** Only the default installation readers have their entire authority in these snapshots. */
  localSnapshotReaders?: boolean
}) {
  const { authority, reviews } = input
  const host = authority.host
  const read = reviews.read.bind(reviews)
  const execution = new AsyncLocalStorage<ReadScope>()
  const sameCall = (scope: ReadScope, call: TrustedDomainContext, binding: string) => scope.open &&
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
  const snapshot = async (id: string, call: TrustedDomainContext, scope: ReadScope, binding: string) => {
    if (!sameCall(scope, call, binding) || !await host.revalidate(call) || !sameCall(scope, call, binding)) return undefined
    const checked = await authority.state.read(scope.request, "reviews", async (state, actor) => {
      if (!sameCall(scope, call, binding) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
        actor.policyVersion !== call.binding.policyVersion) return undefined
      const snapshots = host.persistence.currentSnapshots?.()
      const review = state.reviews[id]
      if (!snapshots || !review) return undefined
      const digest = digestSfValue(review), receipt = receiptDigest(state, id, digest)
      if (!receipt) return undefined
      // Reauthenticate the actual domain principals as well as the C08 reader.
      // Full snapshots include unversioned case/body/receipt changes and source metadata.
      const principals = await Promise.all((["dashboard", "planner", "procurement"] as const).map(async (surface) =>
        [surface, await host.authenticate(scope.request, { surface, roleMap: roleMap(snapshots[surface], surface) })] as const))
      const at = (await host.environment(scope.request)).at
      if (!Number.isFinite(Date.parse(at)) || !await host.revalidate(call) || !sameCall(scope, call, binding) ||
        digestSfValue(host.persistence.currentSnapshots?.()) !== digestSfValue(snapshots)) return undefined
      return { digest, fence: digestSfValue({ snapshots, actor, principals, binding, day: new Date(at).toISOString().slice(0, 10), id, digest, receipt }) }
    })
    // C08 reauthorizes after its callback. Do not await again after that fence.
    return checked.status === "ok" && sameCall(scope, call, binding) ? checked.value : undefined
  }
  const legacyRead = async (id: string, call: TrustedDomainContext): Promise<ReviewResult> => {
    const denied = (): PortResult<PreservedReview> => ({ status: "denied", reason: "review-integrity-unavailable" })
    try {
      const request = authority.host.requestFor(call)
      if (!request || request.signal.aborted || !await authority.host.revalidate(call)) return denied()
      const binding = digestSfValue([call.kind, call.binding])
      const first = await read(id, call)
      if (first.status !== "ok") return first
      const digest = digestSfValue(first.value)
      const proof = () => authority.state.read(request, "reviews", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
          !state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return undefined
        // The original writer may differ from the current authorized reader.
        return receiptDigest(state, id, digest)
      })
      const before = await proof()
      if (before.status !== "ok" || !before.value) return denied()
      const current = await read(id, call)
      const after = await proof()
      if (current.status !== "ok" || digestSfValue(current.value) !== digest || after.status !== "ok" || after.value !== before.value ||
        request.signal.aborted || binding !== digestSfValue([call.kind, call.binding]) || !await authority.host.revalidate(call)) return denied()
      return first
    } catch { return denied() }
  }
  const protectedRead = async (id: string, call: TrustedDomainContext): Promise<ReviewResult> => {
    const scope = execution.getStore()
    if (!scope || !input.localSnapshotReaders) return legacyRead(id, call)
    const denied = (): ReviewResult => ({ status: "denied", reason: "review-integrity-unavailable" })
    const binding = digestSfValue([call.kind, call.binding])
    try {
      if (!sameCall(scope, call, binding)) return denied()
      let proofs = scope.calls.get(call)
      if (!proofs) { proofs = new Map(); scope.calls.set(call, proofs) }
      const prior = proofs.get(id)
      const before = await snapshot(id, call, scope, binding)
      if (before && prior?.fence === before.fence) return structuredClone(prior.result)
      proofs.delete(id)
      // A canonical producer can materialize scoped source metadata. Never invoke
      // it from the final read-only C08 group when its complete proof has changed.
      if (host.persistence.currentSnapshots?.()) return scope.delegated.get(call)?.has(id) ? legacyRead(id, call) : denied()
      let first = before
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = structuredClone(await read(id, call))
        const after = await snapshot(id, call, scope, binding)
        if (!sameCall(scope, call, binding)) return denied()
        if (first && after?.fence === first.fence && (result.status !== "ok" ||
          digestSfValue(result.value) === after.digest && snapshotBoundReview(result.value))) {
          proofs.set(id, { fence: after.fence, result: structuredClone(result) })
          return result
        }
        if (result.status !== "ok") return result
        if (!snapshotBoundReview(result.value)) {
          let delegated = scope.delegated.get(call)
          if (!delegated) { delegated = new Set(); scope.delegated.set(call, delegated) }
          delegated.add(id)
          return legacyRead(id, call)
        }
        first = after
      }
      return denied()
    } catch { return denied() }
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
function snapshotBoundReview(review: PreservedReview) {
  if (review.comments.length) return false
  let remaining = 20_000
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
    return Object.values(value).every((entry) => visit(entry, depth + 1))
  }
  return visit(review)
}
