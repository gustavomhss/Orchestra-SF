import { sfTransactionIdentity, sfTransactionProfileMatches } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"

type ReviewResult = PortResult<PreservedReview>
type ReadFailure = Exclude<ReviewResult, { status: "ok" }>
type SnapshotProof = { digest: string; receipt: string; access: string; fence: string }
type ReadProof = { fence: string; result: ReviewResult }
type ReadScope = { request: Request; open: boolean; calls: WeakMap<TrustedDomainContext, Map<string, ReadProof>>;
  delegated: WeakMap<TrustedDomainContext, Set<string>> }

/** Every consumer reopens the body's own C08 receipt, in addition to producer ACL checks. */
export function protectSfReviewReads(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "state" | "creationTarget"> &
    Partial<Pick<ReturnType<typeof createSfProductAuthority>, "requiresTeamProfile">>
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
  const receiptDigest = (state: Readonly<SfProductState>, id: string, digest: string, actor: SfStateAuthority) => {
    if (!state.reviews[id] || digestSfValue(state.reviews[id]) !== digest) return undefined
    const entries = Object.entries(state.transactions).filter(([, receipt]) => {
      if (receipt.namespace !== "reviews" || !receipt.principalRef.trim() || receipt.targetRef !== authority.creationTarget.ref ||
        receipt.targetIncarnation !== authority.creationTarget.incarnation || !receipt.value || typeof receipt.value !== "object" || Array.isArray(receipt.value)) return false
      const value = receipt.value
      if ("schema" in value) return value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 &&
        "reviewRef" in value && value.reviewRef === id && "reviewDigest" in value && value.reviewDigest === digest
      return "id" in value && value.id === id && digestSfValue(value) === digest
    })
    if (!entries.length || entries.some(([key, receipt]) => {
      const identity = sfTransactionIdentity(key)
      return !identity || identity.principalRef !== receipt.principalRef || identity.namespace !== receipt.namespace ||
        identity.targetRef !== receipt.targetRef || !sfTransactionProfileMatches(actor.profile, key)
    })) return undefined
    return digestSfValue(entries.map(([, receipt]) => receipt))
  }
  const denied = (): ReadFailure => ({ status: "denied", reason: "review-integrity-unavailable" })
  const unavailable = (): ReadFailure => ({ status: "unavailable", reason: "review-integrity-unavailable" })
  const changed = (): ReadFailure => ({ status: "stale", reason: "review-read-changed" })
  const snapshot = async (id: string, call: TrustedDomainContext, scope: ReadScope, binding: string): Promise<PortResult<SnapshotProof>> => {
    const current = async () => sameCall(scope, call, binding) && await host.revalidate(call) && sameCall(scope, call, binding)
    try {
      if (!await current()) return denied()
      const checked = await authority.state.read(scope.request, "reviews", async (state, actor): Promise<PortResult<SnapshotProof>> => {
        if (!sameCall(scope, call, binding) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return denied()
        const snapshots = host.persistence.currentSnapshots?.()
        const review = state.reviews[id]
        if (!review || review.id !== id) return denied()
        if (!snapshots) return unavailable()
        const digest = digestSfValue(review), receipt = receiptDigest(state, id, digest, actor)
        if (!receipt) return denied()
        // Reauthenticate the actual domain principals as well as the C08 reader.
        // Full snapshots include unversioned case/body/receipt changes and source metadata.
        const principals = await Promise.all((["dashboard", "planner", "procurement"] as const).map(async (surface) =>
          [surface, await host.authenticate(scope.request, { surface, roleMap: roleMap(snapshots[surface], surface) })] as const))
        const at = (await host.environment(scope.request)).at
        if (!await current()) return denied()
        if (!Number.isFinite(Date.parse(at))) return unavailable()
        if (digestSfValue(host.persistence.currentSnapshots?.()) !== digestSfValue(snapshots)) return changed()
        return { status: "ok", value: { digest, receipt, access: digestSfValue({ actor, principals, binding }),
          fence: digestSfValue({ snapshots, actor, principals, binding, day: new Date(at).toISOString().slice(0, 10), id, digest, receipt }) } }
      })
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
      const proof = async (expectedDigest?: string): Promise<PortResult<{ digest: string; receipt: string }>> => {
        if (!await currentAccess()) return denied()
        const checked = await authority.state.read(request, "reviews", (state, actor): PortResult<{ digest: string; receipt: string }> => {
          const review = state.reviews[id]
          if (!pinned() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
            actor.policyVersion !== call.binding.policyVersion || !review || review.id !== id) return denied()
          const digest = digestSfValue(review)
          if (expectedDigest !== undefined && digest !== expectedDigest) return denied()
          // The original writer may differ from the current authorized reader.
          const receipt = receiptDigest(state, id, digest, actor)
          return receipt ? { status: "ok", value: { digest, receipt } } : denied()
        })
        if (!pinned()) return denied()
        if ("reason" in checked) return checked.status === "denied" || await currentAccess() ? checked : denied()
        return checked.status === "ok" ? checked.value : unavailable()
      }
      // Prove Team ownership before a source reader can materialize evidence for this review.
      const ownership = authority.requiresTeamProfile ? await proof() : undefined
      if (ownership && ownership.status !== "ok") return ownership
      const first = await read(id, call)
      trace("LEGACY_FIRST_DONE")
      if (!await currentAccess()) return denied()
      if (first.status !== "ok") return first
      const digest = digestSfValue(first.value)
      const before = ownership ?? await proof(digest)
      trace("LEGACY_BEFORE_PROOF_DONE")
      if (before.status !== "ok") return before
      if (before.value.digest !== digest) return denied()
      const current = await read(id, call)
      trace("LEGACY_SECOND_DONE")
      if (!await currentAccess()) return denied()
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== digest) return denied()
      const after = await proof(digest)
      trace("LEGACY_AFTER_PROOF_DONE")
      if (!await currentAccess()) return denied()
      if (after.status !== "ok") return after
      if (after.value.digest !== before.value.digest || after.value.receipt !== before.value.receipt) return denied()
      return first
    } catch {
      const authorized = await currentAccess().catch(() => undefined)
      return authorized === false ? denied() : unavailable()
    }
  }
  const protectedRead = async (id: string, call: TrustedDomainContext): Promise<ReviewResult> => {
    const scope = execution.getStore()
    if (!scope || !input.localSnapshotReaders) return legacyRead(id, call)
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
      // This invocation must establish its own authorization before entering that
      // group. A missing or invalidated proof denies the read; snapshot failures
      // above still retain their unavailable classification.
      if (host.persistence.currentSnapshots?.()) return scope.delegated.get(call)?.has(id) ? legacyRead(id, call) : denied()
      let first = before.value
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = structuredClone(await read(id, call))
        if (result.status !== "ok") return await currentAccess() ? result : denied()
        const after = await snapshot(id, call, scope, binding)
        if (after.status !== "ok") return after
        if (first.digest !== after.value.digest || first.receipt !== after.value.receipt || first.access !== after.value.access ||
          digestSfValue(result.value) !== after.value.digest) return denied()
        if (first.fence === after.value.fence && snapshotBoundReview(result.value)) {
          proofs.set(id, { fence: after.value.fence, result: structuredClone(result) })
          return result
        }
        if (!snapshotBoundReview(result.value)) {
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
