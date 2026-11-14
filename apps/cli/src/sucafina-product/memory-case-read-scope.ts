import { AsyncLocalStorage } from "node:async_hooks"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { approvalStageEntry } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import type { RequestView } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import type { createSfAtlasMemory } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

type Recall = ReturnType<typeof createSfCaseRecall>
export type SfMemoryObservation = <Value>(incoming: Parameters<Recall>[0], call: TrustedDomainContext,
  work: (recall: Recall) => Promise<Value | undefined>) => Promise<Value | undefined>
type CaseRef = { id: string; incarnation: string }
type Selection = { period: Period; expiresAt: number }
type Proof = { ref: CaseRef; readDigest: string; fence: string; value: AuthorizedCaseProjection }
type MemoryResult = Awaited<ReturnType<ReturnType<typeof createSfAtlasMemory>["recall"]>>
type MemoryProof = { ref: CaseRef; inputDigest: string; fence: string; value: MemoryResult }
type Scope = { call: TrustedDomainContext; request: Request; requestDigest: string; binding: string; incoming: Parameters<Recall>[0]; inputDigest: string;
  selection: Selection; selectionDigest: string; reader: object; open: boolean; invalid: boolean; busy: Set<string>; proofs: Map<string, Proof>;
  memoryBusy: Set<string>; memories: Map<string, MemoryProof> }
type Fence = { kind: "sf-memory-case-fence"; digest: string; cases: Record<string, string> } | { kind: "unsupported" }

/** Reuse completed case projections only inside one UI observation with unchanged, protected inputs. */
export function createSfMemoryCaseReadScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  selection: (call: TrustedDomainContext) => Selection | undefined
  readerIdentity: () => object | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}) {
  const local = new AsyncLocalStorage<Scope>()
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const current = (scope: Scope) => local.getStore() === scope && scope.open && !scope.invalid && active.get(scope.call) === scope &&
    scope.call.kind === "ui" && input.host.requestFor(scope.call) === scope.request && !scope.request.signal.aborted &&
    requestIdentity(scope.request) === scope.requestDigest &&
    digestSfValue([scope.call.kind, scope.call.binding]) === scope.binding && digestSfValue(scope.incoming) === scope.inputDigest &&
    input.selection(scope.call) === scope.selection && scope.selection.expiresAt > Date.now() &&
    digestSfValue(scope.selection) === scope.selectionDigest && input.readerIdentity() === scope.reader
  const environment = async (scope: Scope) => {
    const value = await input.host.environment(scope.request)
    const at = Date.parse(value.at)
    return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
      bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
  }
  const snapshot = async (scope: Scope, refs: readonly CaseRef[], observedMemory?: { ref: CaseRef; value: MemoryResult }): Promise<Fence | undefined> => {
    if (!current(scope) || !await input.host.revalidate(scope.call) || !current(scope)) return undefined
    const found = await input.state.read(scope.request, "cases", async (state, actor): Promise<Fence | undefined> => {
      if (!current(scope) || actor.principalRef !== scope.call.binding.principalRef || actor.accessRevision !== scope.call.binding.accessRevision ||
        actor.policyVersion !== scope.call.binding.policyVersion) return undefined
      const locked = input.host.persistence.currentSnapshots?.()
      const sources = input.lockedSourceFences()
      if (!locked || !sources) return { kind: "unsupported" }
      const productDigest = digestSfValue(locked.dashboard.data.__sfProductV1)
      const cases: Record<string, string> = {}
      for (const ref of refs) {
        const value = state.cases[ref.id]
        if (!value || value.id !== ref.id || value.incarnation !== ref.incarnation || !value.participants.includes(actor.principalRef)) return undefined
        if (!procurementCase(value, locked.procurement)) return { kind: "unsupported" }
        cases[caseKey(ref)] = digestSfValue(value)
      }
      // A current case containing only records does not imply its whole Atlas
      // history has that closure. Inspect the completed memory proof as well.
      for (const proof of [...scope.memories.values(), ...(observedMemory ? [observedMemory] : [])]) {
        if (proof.value.status !== "ok" || !procurementReferences(proof.value, proof.ref, locked.procurement)?.size) return { kind: "unsupported" }
      }
      const before = await environment(scope)
      const principal = structuredClone(await input.host.authenticate(scope.request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") }))
      if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !current(scope)) return undefined
      const after = await environment(scope)
      const again = await input.host.authenticate(scope.request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") })
      if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
        !await input.host.revalidate(scope.call) || !current(scope) || productDigest !== digestSfValue(input.host.persistence.currentSnapshots?.()?.dashboard.data.__sfProductV1) ||
        digestSfValue(sources) !== digestSfValue(input.lockedSourceFences())) return undefined
      // C08 retains the actual SQLite read scope through all final awaits and
      // reauthorizes again on return. Full state includes originals, captures,
      // outbox, preferences and case bytes, not just their revision counters.
      return { kind: "sf-memory-case-fence", cases,
        digest: digestSfValue({ state, sources, principal, environment: after, selection: scope.selection,
          request: scope.requestDigest, binding: scope.binding, input: scope.inputDigest }) }
    })
    return current(scope) && found.status === "ok" ? found.value : undefined
  }
  const unavailable = () => ({ status: "unavailable" as const, reason: "memory-case-proof-changed" })
  const read: DecisionCasePort["read"] = async (incoming, call) => {
    const scope = local.getStore()
    if (!scope || scope.call !== call) return input.read(incoming, call)
    if (!current(scope)) return unavailable()
    const ref = parseCaseRef(incoming.caseRef)
    if (!ref) return input.read(incoming, call)
    const key = caseKey(ref), readDigest = digestSfValue(incoming)
    // Never share a pending Promise or replace canonical recursion/cycle guards.
    if (scope.busy.has(key)) return input.read(incoming, call)
    const before = await snapshot(scope, [ref])
    if (before?.kind === "unsupported" && !scope.proofs.has(key)) return input.read(incoming, call)
    if (before?.kind !== "sf-memory-case-fence" || !current(scope)) { scope.invalid = true; return unavailable() }
    const proof = scope.proofs.get(key)
    if (proof) {
      if (proof.fence !== before.digest || proof.readDigest !== readDigest || digestSfValue(incoming) !== readDigest ||
        before.cases[key] !== digestSfValue(proof.value.case)) { scope.invalid = true; return unavailable() }
      return { status: "ok", value: { ...structuredClone(proof.value), checkedAt: new Date().toISOString() } }
    }
    scope.busy.add(key)
    try {
      // The first proof always comes from the complete producer outside C08.
      // Source readers may materialize metadata and must never run under its lock.
      const result = await input.read(incoming, call)
      if (result.status !== "ok") return result
      const after = await snapshot(scope, [ref])
      if (after?.kind !== "sf-memory-case-fence" || !current(scope) || digestSfValue(incoming) !== readDigest ||
        after.cases[key] !== digestSfValue(result.value.case)) { scope.invalid = true; return unavailable() }
      if (before.digest !== after.digest) {
        // Materializing a first source scope may change state. Keep this fully
        // canonical result, but do not treat it as a reusable completed proof.
        if (scope.proofs.size || scope.memories.size) { scope.invalid = true; return unavailable() }
        return result
      }
      scope.proofs.set(key, { ref, readDigest, fence: after.digest, value: structuredClone(result.value) })
      return { status: "ok", value: structuredClone(result.value) }
    } finally { scope.busy.delete(key) }
  }
  const memory = async (incoming: CaseRef, call: TrustedDomainContext, work: () => Promise<MemoryResult>): Promise<MemoryResult> => {
    const scope = local.getStore()
    if (!scope || scope.call !== call) return work()
    if (!current(scope)) return { status: "unavailable" }
    // Atlas recall's selector is exactly {id, incarnation}. Its canonical rank
    // first supplies that selector and later supplies envelope.caseRef, whose
    // extra version is historical metadata, not a different recall operation.
    // Pin the complete argument separately so changes during either await still
    // invalidate that invocation; the outer recall retains its versioned scope.
    const ref = { id: incoming.id, incarnation: incoming.incarnation }, key = caseKey(ref)
    const inputDigest = digestSfValue(ref), argumentDigest = digestSfValue(incoming)
    if (scope.memoryBusy.has(key)) return work()
    const before = await snapshot(scope, [ref])
    if (before?.kind === "unsupported" && !scope.memories.has(key)) return work()
    if (before?.kind !== "sf-memory-case-fence" || !current(scope)) { scope.invalid = true; return { status: "unavailable" } }
    const proof = scope.memories.get(key)
    if (proof) {
      if (proof.fence !== before.digest || proof.inputDigest !== inputDigest || digestSfValue(incoming) !== argumentDigest) {
        scope.invalid = true; return { status: "unavailable" }
      }
      return structuredClone(proof.value)
    }
    scope.memoryBusy.add(key)
    try {
      // Preserve the first complete Atlas original/capture/current-continuity
      // proof. Later rank reads still reauthenticate and reread the entire
      // protected partition through C08; rank's continuity checks stay intact.
      const result = await work()
      if (result.status !== "ok") return result
      const after = await snapshot(scope, [ref], { ref, value: result })
      if (after?.kind === "unsupported") return result
      if (after?.kind !== "sf-memory-case-fence" || before.digest !== after.digest ||
        !current(scope) || digestSfValue(incoming) !== argumentDigest) { scope.invalid = true; return { status: "unavailable" } }
      scope.memories.set(key, { ref, inputDigest, fence: after.digest, value: structuredClone(result) })
      return structuredClone(result)
    } finally { scope.memoryBusy.delete(key) }
  }
  const observation = async <Value>(incoming: Parameters<Recall>[0], call: TrustedDomainContext,
    work: (scope?: Scope) => Promise<Value | undefined>): Promise<Value | undefined> => {
    if (call.kind !== "ui") return work()
    const request = input.host.requestFor(call), selection = input.selection(call), reader = input.readerIdentity()
    if (!request || request.signal.aborted || active.has(call)) return undefined
    if (!selection || !reader) return work()
    const scope: Scope = { call, request, requestDigest: requestIdentity(request), selection, selectionDigest: digestSfValue(selection), reader,
      binding: digestSfValue([call.kind, call.binding]), incoming, inputDigest: digestSfValue(incoming),
      open: true, invalid: false, busy: new Set(), proofs: new Map(), memoryBusy: new Set(), memories: new Map() }
    active.set(call, scope)
    try {
      return await local.run(scope, async () => {
        if (!current(scope) || !await input.host.revalidate(call) || !current(scope)) return undefined
        const result = await work(scope)
        if (result === undefined || !current(scope)) return undefined
        const proofs = [...scope.proofs.values()]
        const memories = [...scope.memories.values()]
        if (proofs.length || memories.length) {
          const refs = [...new Map([...proofs, ...memories].map((proof) => [caseKey(proof.ref), proof.ref])).values()]
          const final = await snapshot(scope, refs)
          if (final?.kind !== "sf-memory-case-fence" || [...proofs, ...memories].some((proof) => proof.fence !== final.digest) ||
            proofs.some((proof) => final.cases[caseKey(proof.ref)] !== digestSfValue(proof.value.case)) || !current(scope)) return undefined
        } else if (!await input.host.revalidate(call) || !current(scope)) return undefined
        return structuredClone(result)
      })
    } catch { return undefined }
    finally { scope.open = false; scope.proofs.clear(); scope.memories.clear(); if (active.get(call) === scope) active.delete(call) }
  }
  const recall = async (incoming: Parameters<Recall>[0], call: TrustedDomainContext, work: () => ReturnType<Recall>): ReturnType<Recall> => {
    const result = await observation(incoming, call, async () => {
      const result = await work()
      return result.status === "ok" ? result : undefined
    })
    return result ?? { status: "unavailable" }
  }
  // Each producer/verifier pass creates a new scope; its two independent Atlas
  // observations never share completed projections, memory results or fences.
  const observe = <Value>(incoming: Parameters<Recall>[0], call: TrustedDomainContext, canonical: Recall,
    work: (recall: Recall) => Promise<Value | undefined>): Promise<Value | undefined> => observation(incoming, call, async (scope) => {
    if (!scope) return work(canonical)
    let claimed = false
    const scopedRecall: Recall = async (value, currentCall) => {
      // Only this callback enters the existing observation. The public recall
      // cannot consume its admission, even before this one has started.
      if (claimed || currentCall !== call || !current(scope) || digestSfValue(value) !== scope.inputDigest) return { status: "unavailable" }
      claimed = true
      const result = await canonical(value, currentCall)
      return current(scope) && digestSfValue(value) === scope.inputDigest ? result : { status: "unavailable" }
    }
    return work(scopedRecall)
  })
  return { read, memory, recall, observe }
}

function caseKey(ref: CaseRef) { return JSON.stringify([ref.id, ref.incarnation]) }
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }

/** Other domains, native calls, timed approval ages and implicit selectors keep their canonical path. */
function procurementCase(value: DecisionCase, snapshot: Snapshot) {
  if (value.preparedChanges.length || value.receipts.length || value.assumptions.length || value.questions.length) return false
  const refs = procurementReferences(value, value, snapshot)
  return !!refs?.size && [...value.alternatives, ...value.choices].every((item) =>
    refs.has(item.scenario.baseRef) && !item.scenario.assumptions.length && item.scenario.operations.every((operation) =>
      operation.kind === "replace" && operation.replacementRef === undefined && refs.has(operation.targetRef)))
}

function procurementReferences(value: unknown, selected: CaseRef, snapshot: Snapshot) {
  const refs = new Map<string, Extract<BusinessEvidenceRef, { kind: "record" }>>()
  const seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return true
    if (seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind === "case-event") {
        if (ref.target.caseId !== selected.id || ref.target.caseIncarnation !== selected.incarnation || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      } else {
        if (ref.kind !== "record" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" ||
          !ref.refId.startsWith("sf-procurement:") || ref.refDigest !== digestSfEvidenceRef(ref)) return false
        const request = object(object(object(snapshot.data.store).requests)[ref.target.recordId]).request
        // Procurement ageDays is continuous when an approval stage exists.
        // Such cases are never cached, even when the UTC day is unchanged.
        if (!request || approvalStageEntry(request as RequestView)) return false
        refs.set(ref.refId, ref)
      }
    }
    return Object.values(item).every(visit)
  }
  return visit(value) ? refs : undefined
}
