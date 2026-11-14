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
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import type { createSfAtlasMemory } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { deriveSfMemoryOwner } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/atlas-projection.ts"
import type { SfProcurementRecordObservation } from "./procurement-record-read-scope.ts"

type Recall = ReturnType<typeof createSfCaseRecall>
export type SfMemoryObservation = <Value>(incoming: Parameters<Recall>[0], call: TrustedDomainContext,
  work: (recall: Recall) => Promise<Value | undefined>) => Promise<Value | undefined>
type CaseRef = { id: string; incarnation: string }
type Selection = { period: Period; expiresAt: number }
type Proof = { ref: CaseRef; readDigest: string; fence: string; value: AuthorizedCaseProjection }
type MemoryResult = Awaited<ReturnType<ReturnType<typeof createSfAtlasMemory>["recall"]>>
type MemoryProof = { ref: CaseRef; inputDigest: string; fence: string; value: MemoryResult }
type Scope = { call: TrustedDomainContext; request: Request; requestDigest: string; binding: string; bindingIdentity: TrustedDomainContext["binding"]; lease: TrustedDomainContext["lease"]; incoming: Parameters<Recall>[0]; inputDigest: string;
  selection: Selection; selectionDigest: string; reader: object; open: boolean; invalid: boolean; busy: Set<string>; proofs: Map<string, Proof>;
  memoryBusy: Set<string>; memories: Map<string, MemoryProof> }
type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type ProtectedState = { state: string; snapshots: string; sources: string }
type Fence = { kind: "sf-memory-case-fence"; digest: string; cases: Record<string, string>; records: Record<string, readonly RecordRef[]>;
  protected: ProtectedState; environmentDigest: string; principalDigest: string } | { kind: "unsupported" }
type MemoryFence = Extract<Fence, { kind: "sf-memory-case-fence" }>
type AtlasClosure = { kind: "sf-memory-atlas-closure"; owner: string; partitionDigest: string; records: readonly RecordRef[] }
type GroupedMemory = { scope: Scope; key: string; proof: Proof; before: MemoryFence; closure: AtlasClosure; open: boolean; reading: boolean }

/** Reuse completed case projections only inside one UI observation with unchanged, protected inputs. */
export function createSfMemoryCaseReadScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  /** One actual canonical read; invoked only inside an eligible observation, never for a reused proof. */
  readCanonical?: (incoming: Parameters<DecisionCasePort["read"]>[0], call: TrustedDomainContext,
    records: readonly BusinessEvidenceRef[]) => ReturnType<DecisionCasePort["read"]>
  /** One real Atlas call inside an already-qualified record root; absence preserves the canonical path. */
  readMemoryCanonical?: (records: readonly BusinessEvidenceRef[], call: TrustedDomainContext,
    work: () => Promise<MemoryResult>) => Promise<SfProcurementRecordObservation<MemoryResult>>
  selection: (call: TrustedDomainContext) => Selection | undefined
  readerIdentity: () => object | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}) {
  const local = new AsyncLocalStorage<Scope>()
  // Separate lexical ownership preserves a closed marker in detached continuations.
  const groupedMemory = new AsyncLocalStorage<GroupedMemory>()
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const current = (scope: Scope) => local.getStore() === scope && scope.open && !scope.invalid && active.get(scope.call) === scope &&
    scope.call.kind === "ui" && input.host.requestFor(scope.call) === scope.request && !scope.request.signal.aborted &&
    requestIdentity(scope.request) === scope.requestDigest &&
    scope.call.binding === scope.bindingIdentity && scope.call.lease === scope.lease && digestSfValue([scope.call.kind, scope.call.binding]) === scope.binding && digestSfValue(scope.incoming) === scope.inputDigest &&
    input.selection(scope.call) === scope.selection && scope.selection.expiresAt > Date.now() &&
    digestSfValue(scope.selection) === scope.selectionDigest && input.readerIdentity() === scope.reader
  const environment = async (scope: Scope) => {
    const value = await input.host.environment(scope.request)
    const at = Date.parse(value.at)
    return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
      bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
  }
  const protectedState = (state: Readonly<SfProductState>): ProtectedState | undefined => {
    const snapshots = input.host.persistence.currentSnapshots?.(), sources = input.lockedSourceFences()
    return snapshots && sources ? { state: digestSfValue(state), snapshots: digestSfValue(snapshots), sources: digestSfValue(sources) } : undefined
  }
  const sameProtected = (state: Readonly<SfProductState>, expected: ProtectedState) => {
    const value = protectedState(state)
    return !!value && value.state === expected.state && value.snapshots === expected.snapshots && value.sources === expected.sources
  }
  const sameActor = (scope: Scope, actor: SfStateAuthority) => actor.principalRef === scope.call.binding.principalRef &&
    actor.policyVersion === scope.call.binding.policyVersion && actor.accessRevision === scope.call.binding.accessRevision
  const liveProtected = (expected: ProtectedState) => {
    // LocalStore returns fresh clones here, so identity is not a root token.
    const snapshots = input.host.persistence.currentSnapshots?.(), sources = input.lockedSourceFences()
    return !!snapshots && !!sources && digestSfValue(snapshots) === expected.snapshots && digestSfValue(sources) === expected.sources
  }
  const protectedBoundary = async (scope: Scope, before: MemoryFence, state: Readonly<SfProductState>) => {
    if (!current(scope) || !sameProtected(state, before.protected) || !await input.host.revalidate(scope.call) || !current(scope)) return false
    const snapshots = input.host.persistence.currentSnapshots?.()
    if (!snapshots) return false
    const firstEnvironment = await environment(scope)
    if (!firstEnvironment || digestSfValue(firstEnvironment) !== before.environmentDigest || !current(scope)) return false
    const firstPrincipal = await input.host.authenticate(scope.request, { surface: "procurement", roleMap: roleMap(snapshots.procurement, "procurement") })
    if (!firstEnvironment || digestSfValue(firstEnvironment) !== before.environmentDigest ||
      digestSfValue(firstPrincipal) !== before.principalDigest || !current(scope)) return false
    const secondEnvironment = await environment(scope)
    if (!secondEnvironment || digestSfValue(secondEnvironment) !== before.environmentDigest || !current(scope)) return false
    const secondPrincipal = await input.host.authenticate(scope.request, { surface: "procurement", roleMap: roleMap(snapshots.procurement, "procurement") })
    return !!secondEnvironment && digestSfValue(secondEnvironment) === before.environmentDigest &&
      digestSfValue(secondPrincipal) === before.principalDigest && await input.host.revalidate(scope.call) &&
      current(scope) && sameProtected(state, before.protected)
  }
  const snapshot = async (scope: Scope, refs: readonly CaseRef[], observedMemory?: { ref: CaseRef; value: MemoryResult }): Promise<Fence | undefined> => {
    if (!current(scope) || !await input.host.revalidate(scope.call) || !current(scope)) return undefined
    const found = await input.state.read(scope.request, "cases", async (state, actor): Promise<Fence | undefined> => {
      if (!current(scope) || actor.principalRef !== scope.call.binding.principalRef || actor.accessRevision !== scope.call.binding.accessRevision ||
        actor.policyVersion !== scope.call.binding.policyVersion) return undefined
      const locked = input.host.persistence.currentSnapshots?.()
      const sources = input.lockedSourceFences()
      if (!locked || !sources) return { kind: "unsupported" }
      const protectedBefore = protectedState(state)
      if (!protectedBefore) return { kind: "unsupported" }
      const cases: Record<string, string> = {}
      const records: Record<string, readonly RecordRef[]> = {}
      for (const ref of refs) {
        const value = state.cases[ref.id]
        if (!value || value.id !== ref.id || value.incarnation !== ref.incarnation || !value.participants.includes(actor.principalRef)) return undefined
        const captured = new Map<string, RecordRef>()
        if (!procurementCase(value, locked.procurement, captured)) return { kind: "unsupported" }
        cases[caseKey(ref)] = digestSfValue(value)
        records[caseKey(ref)] = structuredClone([...captured.values()])
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
        !await input.host.revalidate(scope.call) || !current(scope) || !sameProtected(state, protectedBefore) ||
        digestSfValue(sources) !== digestSfValue(input.lockedSourceFences())) return undefined
      // C08 retains the actual SQLite read scope through all final awaits and
      // reauthorizes again on return. Full state includes originals, captures,
      // outbox, preferences and case bytes, not just their revision counters.
      return { kind: "sf-memory-case-fence", cases, records, protected: protectedBefore,
        environmentDigest: digestSfValue(after), principalDigest: digestSfValue(principal),
        digest: digestSfValue({ state, snapshots: protectedBefore.snapshots, sources, principal, environment: after, selection: scope.selection,
          request: scope.requestDigest, binding: scope.binding, input: scope.inputDigest }) }
    })
    return current(scope) && found.status === "ok" ? found.value : undefined
  }
  const completedCase = (scope: Scope, key: string, proof: Proof, before: MemoryFence) =>
    current(scope) && scope.proofs.get(key) === proof && proof.fence === before.digest &&
    before.cases[key] === digestSfValue(proof.value.case)
  const atlasClosure = async (scope: Scope, ref: CaseRef, proof: Proof, before: MemoryFence):
    Promise<AtlasClosure | { kind: "unsupported" } | { kind: "changed" }> => {
    const key = caseKey(ref)
    if (!completedCase(scope, key, proof, before)) return { kind: "changed" }
    // A cases grant selects the owner; only an actual atlas grant reads its partition.
    const found = await input.state.read(scope.request, "atlas", async (state, actor):
      Promise<AtlasClosure | { kind: "unsupported" } | { kind: "changed" }> => {
      if (!sameActor(scope, actor) || !completedCase(scope, key, proof, before) ||
        digestSfValue(state.cases[ref.id]) !== before.cases[key] || !await protectedBoundary(scope, before, state)) return { kind: "changed" }
      const owner = deriveSfMemoryOwner(proof.value.context, proof.value.case)
      if (!owner) return { kind: "unsupported" }
      const partition = state.atlas[owner]
      if (!plainRecord(partition) || !Array.isArray(partition.events) || !plainRecord(partition.envelopes) ||
        !plainRecord(partition.originals) || !plainRecord(partition.captureDigests)) return { kind: "unsupported" }
      if (Object.values(partition.envelopes).some((value) => {
        if (!plainRecord(value) || !plainRecord(value.caseRef) || value.owner !== owner || value.kind !== "task" ||
          value.caseRef.id !== ref.id || value.caseRef.incarnation !== ref.incarnation ||
          typeof value.caseRef.version !== "number" || !Number.isSafeInteger(value.caseRef.version) ||
          value.caseRef.version < 1 || value.caseRef.version > proof.value.case.version ||
          !Array.isArray(value.evidenceRefs) || !Array.isArray(value.dependencies)) return true
        return false
      }) || Object.values(partition.originals).some((value) => !plainRecord(value) || !plainRecord(value.ref) ||
        value.ref.schema !== "sf-evidence-v1" || value.projection === undefined)) return { kind: "unsupported" }
      const snapshots = input.host.persistence.currentSnapshots?.()
      if (!snapshots) return { kind: "unsupported" }
      const records = new Map<string, RecordRef>()
      // The exact completed case already passed procurementCase in the external
      // cases witness. Recollect full refs from that authorized projection.
      if (!procurementReferences(proof.value.case, ref, snapshots.procurement, records)?.size ||
        !procurementReferences(partition, ref, snapshots.procurement, records) || !records.size) return { kind: "unsupported" }
      const result: AtlasClosure = { kind: "sf-memory-atlas-closure", owner,
        partitionDigest: digestSfValue(partition), records: structuredClone([...records.values()]) }
      return completedCase(scope, key, proof, before) && await protectedBoundary(scope, before, state) ? result : { kind: "changed" }
    })
    if (!current(scope)) return { kind: "changed" }
    return found.status === "ok" ? found.value : { kind: "unsupported" }
  }
  const groupedCurrent = (frame: GroupedMemory) => frame.open && groupedMemory.getStore() === frame &&
    local.getStore() === frame.scope && completedCase(frame.scope, frame.key, frame.proof, frame.before) && liveProtected(frame.before.protected)
  const readGroupedCase: DecisionCasePort["read"] = async (incoming, call) => {
    const frame = groupedMemory.getStore()
    if (!frame) return { status: "unavailable", reason: "memory-case-proof-changed" }
    const { scope } = frame
    const refuse = () => { scope.invalid = true; return { status: "unavailable" as const, reason: "memory-case-proof-changed" } }
    const selected = structuredClone(incoming), readDigest = digestSfValue(selected)
    const ref = parseCaseRef(selected.caseRef)
    if (frame.reading || call !== scope.call || !ref || caseKey(ref) !== frame.key || readDigest !== frame.proof.readDigest ||
      !groupedCurrent(frame)) return refuse()
    // Claim synchronously, before the first await, so overlapping readers cannot
    // both enter using the same completed projection.
    frame.reading = true
    try {
      if (!await input.host.revalidate(call) || !groupedCurrent(frame) || digestSfValue(incoming) !== readDigest) return refuse()
      // Keep real cases authority and full witnesses. This private result never
      // emits the external writer-hook tag while the parent root is held.
      const found = await input.state.read(scope.request, "cases", async (state, actor) => {
        if (!sameActor(scope, actor) || !groupedCurrent(frame) ||
          digestSfValue(state.cases[ref.id]) !== frame.before.cases[frame.key] ||
          !await protectedBoundary(scope, frame.before, state) || !groupedCurrent(frame)) return undefined
        return { ...structuredClone(frame.proof.value), checkedAt: new Date().toISOString() }
      })
      if (found.status !== "ok" || !found.value || digestSfValue(incoming) !== readDigest ||
        !await input.host.revalidate(call) || !groupedCurrent(frame)) return refuse()
      return { status: "ok", value: structuredClone(found.value) }
    } catch { return refuse()
    } finally { frame.reading = false }
  }
  const readMemory = async (scope: Scope, ref: CaseRef, before: MemoryFence, work: () => Promise<MemoryResult>): Promise<MemoryResult> => {
    const readCanonicalMemory = input.readMemoryCanonical
    if (!readCanonicalMemory) return work()
    const key = caseKey(ref), proof = scope.proofs.get(key)
    if (!proof) return work()
    const refused = (): MemoryResult => { scope.invalid = true; return { status: "unavailable" } }
    if (!completedCase(scope, key, proof, before) || groupedMemory.getStore()) return refused()
    const closure = await atlasClosure(scope, ref, proof, before)
    if (closure.kind === "unsupported") return current(scope) ? work() : refused()
    if (closure.kind !== "sf-memory-atlas-closure" || !completedCase(scope, key, proof, before) || input.readMemoryCanonical !== readCanonicalMemory) return refused()
    let invoked = false, completed = false
    let actual: MemoryResult | undefined
    const observed = await readCanonicalMemory(structuredClone(closure.records), scope.call, async () => {
      if (invoked || !completedCase(scope, key, proof, before)) return refused()
      invoked = true
      // The outer witness and atlas selection precede this root. Compare their
      // exact bytes inside C08 before canonical work; never recapture on drift.
      const admitted = await input.state.read(scope.request, "atlas", async (state, actor) =>
        sameActor(scope, actor) && completedCase(scope, key, proof, before) &&
        digestSfValue(state.cases[ref.id]) === before.cases[key] &&
        digestSfValue(state.atlas[closure.owner]) === closure.partitionDigest &&
        await protectedBoundary(scope, before, state))
      if (admitted.status !== "ok" || !admitted.value || !completedCase(scope, key, proof, before) || !liveProtected(before.protected)) return refused()
      const frame: GroupedMemory = { scope, key, proof, before, closure, open: true, reading: false }
      try {
        return await groupedMemory.run(frame, async () => {
          const result = await work()
          if (frame.reading || !groupedCurrent(frame)) return refused()
          actual = structuredClone(result)
          completed = true
          return result
        })
      } finally { if (frame.reading) scope.invalid = true; frame.open = false }
    })
    // Unsupported permits fallback only before the supplied canonical work ran.
    if (observed.kind === "unsupported" && !invoked) return current(scope) ? work() : refused()
    if (observed.kind !== "observed" || !invoked || !completed || actual === undefined || input.readMemoryCanonical !== readCanonicalMemory ||
      digestSfValue(observed.value) !== digestSfValue(actual) || !completedCase(scope, key, proof, before)) return refused()
    return structuredClone(observed.value)
  }
  const unavailable = () => ({ status: "unavailable" as const, reason: "memory-case-proof-changed" })
  const read: DecisionCasePort["read"] = async (incoming, call) => {
    if (groupedMemory.getStore()) return readGroupedCase(incoming, call)
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
      // The first proof always comes from the complete canonical producer. A
      // composed read may group it only after proving every current actor/source
      // scope is already materialized. This outer witness and its real mutation
      // probes remain outside that root; unsupported sources keep the normal path.
      const result = input.readCanonical
        ? await input.readCanonical(incoming, call, structuredClone(before.records[key] ?? []))
        : await input.read(incoming, call)
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
    const grouped = groupedMemory.getStore()
    if (grouped) { grouped.scope.invalid = true; return { status: "unavailable" } }
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
      const result = await readMemory(scope, ref, before, work)
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
      binding: digestSfValue([call.kind, call.binding]), bindingIdentity: call.binding, lease: call.lease, incoming, inputDigest: digestSfValue(incoming),
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
function procurementCase(value: DecisionCase, snapshot: Snapshot, records?: Map<string, RecordRef>) {
  if (value.preparedChanges.length || value.receipts.length || value.assumptions.length || value.questions.length) return false
  const refs = procurementReferences(value, value, snapshot, records)
  return !!refs?.size && [...value.alternatives, ...value.choices].every((item) =>
    refs.has(item.scenario.baseRef) && !item.scenario.assumptions.length && item.scenario.operations.every((operation) =>
      operation.kind === "replace" && operation.replacementRef === undefined && refs.has(operation.targetRef)))
}

function procurementReferences(value: unknown, selected: CaseRef, snapshot: Snapshot, records?: Map<string, RecordRef>) {
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
        // Different historical versions/field selectors of one record must all
        // pass the zero-write qualification; refId alone cannot collapse them.
        records?.set(digestSfValue(ref), ref)
      }
    }
    return Object.values(item).every(visit)
  }
  return visit(value) ? refs : undefined
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
