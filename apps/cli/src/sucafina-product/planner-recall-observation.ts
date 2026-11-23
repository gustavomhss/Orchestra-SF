import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { deriveSfMemoryOwner } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/atlas-projection.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { hasSfLocalSnapshotScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { plannerRecordMaterialized } from "./finance-pair-observation.ts"
import { createSfPlannerCalculationRoot, readSfPlannerCalculationRootProof } from "./planner-calculation-root.ts"
import { plannerRequestIdentity } from "./planner-calculation-read-scope.ts"
import { pinSfPlannerRecordReaders, type createSfPlannerRecordProofScope } from "./planner-record-proof-scope.ts"

type Recall = ReturnType<typeof createSfCaseRecall>
type CaseRef = { id: string; incarnation: string; version: number }
type CaseSelection = { ref: CaseRef; current: () => boolean }
type PlannerRecord = Extract<BusinessEvidenceRef, { kind: "record" }>
type Plan = { cases: readonly CaseRef[]; memory: readonly CaseRef[]; period?: Period }
type Witness = { kind: "current"; digest: string; environment: string; refs: readonly PlannerRecord[];
  principalDigest: string; plannerRoleMap: ReturnType<typeof roleMap> } | { kind: "unsupported" }
type Frame = { call: TrustedDomainContext; cases: ReadonlyMap<string, number>; open: boolean; invalid: boolean; pending: number; current: () => boolean }

/** Own each eligible case read or explicit Recall, retaining every canonical case and Atlas pass. */
export function createSfPlannerRecallObservation(input: {
  host: DomainPortHost
  state: SfProductStatePort
  recordProof: ReturnType<typeof createSfPlannerRecordProofScope>
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  readerIdentities: () => readonly unknown[]
  selectedScope?: (call: TrustedDomainContext) => CaseSelection | undefined
}) {
  const host = input.host, state = input.state, recordProof = input.recordProof
  const readState = state.read, lockedFences = input.lockedSourceFences, readers = input.readerIdentities
  const observeRecords = recordProof.run, selectedScope = input.selectedScope
  const pinned = pinSfPlannerRecordReaders([input, host, host.persistence, state, recordProof])
  const root = createSfPlannerCalculationRoot({ host })
  const frames = new AsyncLocalStorage<Frame>()
  const active = new WeakMap<TrustedDomainContext, Frame>()
  const unsupported = { kind: "unsupported" as const }
  const unavailable = () => ({ status: "unavailable", reason: "planner-recall-observation-changed" } as const)

  const observe = async <Value>(plan: Plan, incoming: unknown, call: TrustedDomainContext,
    work: () => Promise<PortResult<Value>>, selection?: CaseSelection): Promise<PortResult<Value>> => {
    try {
      if (!root.allows(call) || active.has(call)) return unavailable()
      if (call.kind !== "ui" || call.binding.principalRef.startsWith("local:") || !pinned()) return work()
      const persistence = host.persistence
      const present = hasSfLocalSnapshotScope(persistence)
      // A foreign C08 owner keeps its original producer and cannot lend this
      // observer its physical root or its terminal proof map.
      if (present === true || present === undefined && persistence.currentSnapshots?.()) return work()
      const request = host.requestFor(call)
      if (!request || request.signal.aborted) return unavailable()
      const binding = call.binding, lease = call.lease
      const bindingDigest = digestSfValue([call.kind, binding]), requestDigest = plannerRequestIdentity(request)
      const selected = structuredClone(plan), planDigest = digestSfValue(plan), inputDigest = digestSfValue(incoming)
      const identities = [...readers()]
      const selectionCurrent = selection?.current, selectionRef = selection?.ref
      const current = () => pinned() && input.host === host && input.state === state && input.recordProof === recordProof &&
        state.read === readState && recordProof.run === observeRecords && input.lockedSourceFences === lockedFences &&
        input.readerIdentities === readers && input.selectedScope === selectedScope && host.persistence === persistence && sameReaders(readers(), identities) &&
        (!selection || selection.current === selectionCurrent && selection.ref === selectionRef && selectionCurrent?.() === true) &&
        host.requestFor(call) === request && !request.signal.aborted && call.binding === binding && call.lease === lease &&
        digestSfValue([call.kind, call.binding]) === bindingDigest && plannerRequestIdentity(request) === requestDigest &&
        digestSfValue(plan) === planDigest && digestSfValue(selected) === planDigest && digestSfValue(incoming) === inputDigest
      const environment = async () => {
        const value = await host.environment(request), at = Date.parse(value.at)
        return Number.isFinite(at) ? digestSfValue({ day: new Date(at).toISOString().slice(0, 10),
          directory: value.directory, bankKey: value.bankKey ? Array.from(value.bankKey) : undefined }) : undefined
      }
      const sameActor = (actor: { principalRef: string; accessRevision: string; policyVersion: string }) =>
        actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
        actor.policyVersion === call.binding.policyVersion
      const witness = async (beforeAdmission = false): Promise<Witness | undefined> => {
        const observed = await readState(request, "cases", async (stored, actor) => {
          if (!current() || !sameActor(actor)) return undefined
          const cases: DecisionCase[] = [], refs = new Map<string, PlannerRecord>()
          for (const ref of selected.cases) {
            const value = stored.cases[ref.id]
            if (!value || value.id !== ref.id || value.incarnation !== ref.incarnation || !value.participants.includes(actor.principalRef)) return undefined
            if (value.version !== ref.version) return beforeAdmission ? unsupported : undefined
            if (selected.period && digestSfValue(value.horizon) !== digestSfValue(selected.period) || !plannerCase(value, call, refs))
              return unsupported
            cases.push(value)
          }
          const snapshots = persistence.currentSnapshots?.(), sources = lockedFences()
          if (!snapshots || !sources || !refs.size) return unsupported
          const snapshotDigest = digestSfValue({ state: stored, snapshots, sources })
          const before = await environment()
          const principal = structuredClone(await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") }))
          if (!before || !principal || principal.id !== actor.principalRef || !current()) return undefined
          if (principal.id.startsWith("local:") || ![...refs.values()].every((ref) =>
            plannerRecordMaterialized(ref, call, snapshots.planner, principal))) return unsupported
          if (!await host.revalidate(call) || !current()) return undefined
          const after = await environment()
          const again = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") })
          if (!after || before !== after || digestSfValue(principal) !== digestSfValue(again) || !current() ||
            snapshotDigest !== digestSfValue({ state: stored, snapshots: persistence.currentSnapshots?.(), sources: lockedFences() })) return undefined
          return { kind: "current" as const, cases: structuredClone(cases), refs: structuredClone([...refs.values()]),
            snapshotDigest, environment: after, principal, plannerRoleMap: structuredClone(roleMap(snapshots.planner, "planner")) }
        })
        if (!current() || observed.status !== "ok" || !observed.value) return undefined
        if (observed.value.kind === "unsupported") return unsupported
        const before = observed.value
        const refs = new Map(before.refs.map((ref) => [digestSfValue(ref), ref]))
        if (selected.memory.length) {
          // A cases grant identifies a candidate; only the original Atlas
          // namespace admission may inspect its partition for a closed leaf set.
          const atlas = await readState(request, "atlas", async (stored, actor) => {
            if (!current() || !sameActor(actor) || before.snapshotDigest !==
              digestSfValue({ state: stored, snapshots: persistence.currentSnapshots?.(), sources: lockedFences() })) return undefined
            for (const selectedCase of selected.memory) {
              const value = before.cases.find((item) => caseKey(item) === caseKey(selectedCase))
              if (!value) return undefined
              const owner = deriveSfMemoryOwner({ kind: "ui", installationId: call.binding.installationId,
                projectId: call.binding.projectId, principalRef: call.binding.principalRef,
                accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion }, value)
              if (!owner) return unsupported
              const partition = stored.atlas[owner]
              // Absence is still observed by the complete canonical Atlas reader.
              if (partition === undefined) continue
              if (!plainRecord(partition) || !Array.isArray(partition.events) || !plainRecord(partition.envelopes) ||
                !plainRecord(partition.originals) || !plainRecord(partition.captureDigests)) return unsupported
              if (Object.values(partition.envelopes).some((envelope) => !plainRecord(envelope) || !plainRecord(envelope.caseRef) ||
                envelope.owner !== owner || envelope.kind !== "task" || envelope.caseRef.id !== value.id ||
                envelope.caseRef.incarnation !== value.incarnation || !Number.isSafeInteger(envelope.caseRef.version) ||
                Number(envelope.caseRef.version) < 1 || Number(envelope.caseRef.version) > value.version ||
                !Array.isArray(envelope.evidenceRefs) || !Array.isArray(envelope.dependencies)) ||
                !plannerReferences(partition, value, call, refs)) return unsupported
            }
            const snapshots = persistence.currentSnapshots?.()
            if (!snapshots || ![...refs.values()].every((ref) =>
              plannerRecordMaterialized(ref, call, snapshots.planner, before.principal))) return unsupported
            return current() && await host.revalidate(call) && current() ? true : undefined
          })
          if (!current() || atlas.status !== "ok" || atlas.value === undefined) return undefined
          if (atlas.value !== true) return unsupported
        }
        // Close the environment after C08's namespace egress, not just inside
        // its callback. Native scope and terminal authorization remain live.
        const closed = await environment()
        if (!current() || closed !== before.environment || !await host.revalidate(call) || !current()) return undefined
        return { kind: "current", digest: digestSfValue({ snapshot: before.snapshotDigest, refs: [...refs.values()],
          principal: before.principal, environment: closed, plan: selected }),
          environment: closed, refs: structuredClone([...refs.values()]), principalDigest: digestSfValue(before.principal),
          plannerRoleMap: before.plannerRoleMap }
      }
      const prepared = await root.prepare(call, async () => true, current)
      if (!prepared) return unavailable()
      const grouped = await prepared.run(async (): Promise<PortResult<typeof unsupported | {
        kind: "observed"; witness: string; result: PortResult<Value>
      }>> => {
        const before = await witness(true)
        if (!before) return unavailable()
        if (before.kind === "unsupported") return { status: "ok", value: unsupported }
        const token = root.proof(call)
        if (!token) return { status: "ok", value: unsupported }
        const owner = readSfPlannerCalculationRootProof(token, host, call)
        if (!owner || !owner.current()) return unavailable()
        const frame: Frame = { call, cases: new Map(selected.cases.map((ref) => [caseKey(ref), ref.version])), open: true, invalid: false, pending: 0,
          current: () => {
            if (frame.invalid) return false
            try {
              const valid = frame.open && frames.getStore() === frame && active.get(call) === frame && current() && owner.current()
              if (!valid) frame.invalid = true
              return valid
            } catch { frame.invalid = true; return false }
          } }
        const authorize = async () => {
          if (!frame.current() || !await host.revalidate(call) || !frame.current()) return false
          const at = await environment()
          if (!frame.current() || at !== before.environment) return false
          const principal = await host.authenticate(request, { surface: "planner", roleMap: structuredClone(before.plannerRoleMap) })
          return frame.current() && digestSfValue(principal) === before.principalDigest &&
            await host.revalidate(call) && frame.current()
        }
        active.set(call, frame)
        let result: PortResult<Value>
        try {
          result = await frames.run(frame, () => observeRecords(before.refs, call, token, authorize, () => frame.current(), async () => {
            const detached = structuredClone(await work())
            if (selection && !caseResultMatches(detached, selected.cases[0]!)) { frame.invalid = true; return unavailable() }
            return detached
          }))
          if (frame.invalid || frame.pending || !current() || !owner.current()) return unavailable()
        } finally {
          frame.open = false
          if (active.get(call) === frame) active.delete(call)
        }
        const after = await witness()
        return after?.kind === "current" && after.digest === before.digest
          ? { status: "ok", value: { kind: "observed", witness: after.digest, result } } : unavailable()
      })
      if (grouped.status !== "ok") return grouped
      if (grouped.value.kind === "unsupported") return current() ? work() : unavailable()
      const egress = await root.prepare(call, async () => true, current)
      if (!egress) return unavailable()
      const fresh = await egress.run(async () => ({ status: "ok" as const, value: await witness() }))
      if (fresh.status !== "ok" || fresh.value?.kind !== "current" || fresh.value.digest !== grouped.value.witness || !current())
        return unavailable()
      const closed = await environment()
      return closed === fresh.value.environment && current() ? grouped.value.result : unavailable()
    } catch { return unavailable() }
  }

  const read = async (incoming: Parameters<DecisionCasePort["read"]>[0], call: TrustedDomainContext,
    work: () => ReturnType<DecisionCasePort["read"]>, selection?: CaseSelection): ReturnType<DecisionCasePort["read"]> => {
    const frame = frames.getStore()
    let ref: ReturnType<typeof parseCaseRef>, selected: CaseSelection | undefined
    // Classification alone may fall back. Once an owner runs work, a refusal
    // never replays that producer under a different path.
    try {
      const parsed = decodeSfOperationInput("sf_case_read", incoming)
      ref = parsed.ok ? parseCaseRef(parsed.value.caseRef) : undefined
      selected = selection ?? (frame ? undefined : selectedScope?.(call))
      if (selected && (!versionedCaseRef(selected.ref) || typeof selected.current !== "function")) selected = undefined
    } catch { ref = undefined }
    if (frame) {
      frame.pending++
      try {
        const version = ref && frame.cases.get(caseKey(ref))
        if (frame.call !== call || !ref || version === undefined || !frame.current() ||
          selection && (!selected || caseKey(selected.ref) !== caseKey(ref) || selected.ref.version !== version || !selected.current())) {
          frame.invalid = true
          return unavailable()
        }
        const digest = digestSfValue(incoming), hint = selected?.ref, hintCurrent = selected?.current
        const hintDigest = hint && digestSfValue(hint)
        const result = structuredClone(await work())
        if (!frame.current() || digestSfValue(incoming) !== digest ||
          selected && (selected.ref !== hint || selected.current !== hintCurrent || digestSfValue(selected.ref) !== hintDigest || !hintCurrent?.()) ||
          !caseResultMatches(result, { ...ref, version })) { frame.invalid = true; return unavailable() }
        return result
      } catch { frame.invalid = true; return unavailable()
      } finally { frame.pending-- }
    }
    if (!ref || !selected) return work()
    if (caseKey(selected.ref) !== caseKey(ref)) return selection ? unavailable() : work()
    return observe({ cases: [selected.ref], memory: [] }, incoming, call, work, selected)
  }
  const recall = async (incoming: Parameters<Recall>[0], call: TrustedDomainContext,
    work: () => ReturnType<Recall>): ReturnType<Recall> => {
    const frame = frames.getStore()
    if (frame) { frame.invalid = true; return { status: "unavailable" } }
    let plan: Plan | undefined
    try {
      const scope = incoming?.scope?.recallScope
      if (scope && scope.includeHistorical === false && versionedCaseRef(incoming.caseRef) &&
        Array.isArray(scope.cases) && scope.cases.length <= 50 && scope.cases.every(versionedCaseRef)) {
        const selected = [incoming.caseRef, ...scope.cases]
        const cases = [...new Map(selected.map((ref) => [caseKey(ref), ref])).values()]
        if (cases.length === selected.length) plan = { cases, memory: scope.cases, period: scope.period }
      }
    } catch { /* The original reader owns malformed-input admission. */ }
    if (!plan) return work()
    const result = await observe(plan, incoming, call, async () => ({ status: "ok" as const, value: await work() }))
    return result.status === "ok" ? result.value : { status: "unavailable" }
  }
  return { read, recall }
}

function versionedCaseRef(value: unknown): value is CaseRef {
  return plainRecord(value) && typeof value.id === "string" && !!value.id && typeof value.incarnation === "string" &&
    !!value.incarnation && Number.isSafeInteger(value.version) && Number(value.version) > 0
}
function caseResultMatches(result: unknown, ref: CaseRef) {
  if (!plainRecord(result)) return false
  if (result.status !== "ok") return true
  if (!plainRecord(result.value) || !plainRecord(result.value.case)) return false
  const value = result.value.case
  return value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version
}

function sameReaders(current: readonly unknown[], pinned: readonly unknown[]) {
  return current.length === pinned.length && current.every((reader, index) => reader === pinned[index])
}
function caseKey(ref: { id: string; incarnation: string }) { return JSON.stringify([ref.id, ref.incarnation]) }

function plannerCase(value: DecisionCase, call: TrustedDomainContext, refs: Map<string, PlannerRecord>) {
  // Open assumptions stay unresolved. Their explicit evidence must pass the
  // same complete materialized Planner reference closure below.
  if (value.preparedChanges.length || value.receipts.length || value.assumptions.some((assumption) => assumption.state !== "open") || value.questions.length ||
    [...value.alternatives, ...value.choices].some((item) => item.scenario.assumptions.length ||
      item.scenario.operations.some((operation) => operation.replacementRef !== undefined || operation.targetRef.startsWith("sf-procurement:") ||
        !["replace", "exclude", "include", "defer"].includes(operation.kind)))) return false
  const captured = new Map<string, PlannerRecord>()
  if (!plannerReferences(value, value, call, captured) || !captured.size) return false
  const bases = new Set([...captured.values()].map((ref) => ref.refId))
  if (![...value.alternatives, ...value.choices].every((item) => bases.has(item.scenario.baseRef))) return false
  for (const [key, ref] of captured) refs.set(key, ref)
  return true
}

/** Event nodes retain their canonical reader; only their explicit Planner leaves enter the map. */
function plannerReferences(value: unknown, selected: DecisionCase, call: TrustedDomainContext, refs: Map<string, PlannerRecord>) {
  const seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object" || seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId ||
        ref.refDigest !== digestSfEvidenceRef(ref)) return false
      if (ref.kind === "record") {
        if (ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period) return false
        refs.set(digestSfValue(ref), ref)
      } else if (ref.kind === "case-event") {
        const events = selected.ledger.filter((event) => event.id === ref.target.eventId)
        if (ref.target.caseId !== selected.id || ref.target.caseIncarnation !== selected.incarnation || events.length !== 1 ||
          ref.target.caseVersion !== events[0]!.caseRef.version || ref.target.outputDigest !== events[0]!.outputDigest ||
          digestSfValue(ref.target.evidenceRefs) !== digestSfValue(events[0]!.evidenceRefs)) return false
      } else return false
    }
    return Object.values(item).every(visit)
  }
  return visit(value)
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
