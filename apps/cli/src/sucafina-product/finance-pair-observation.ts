import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductState, SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sfPlannerEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfPlannerCalculationRoot } from "./planner-calculation-root.ts"
import type { createSfPlannerRecordProofScope } from "./planner-record-proof-scope.ts"
import { sfPlannerProofCount, sfPlannerProofOwner } from "./planner-proof-diagnostic.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type PlannerRecord = Extract<BusinessEvidenceRef, { kind: "record" }>
type Principal = NonNullable<Awaited<ReturnType<DomainPortHost["authenticate"]>>>
type Witness = { kind: "current"; digest: string; environment: string; refs: readonly PlannerRecord[];
  principalDigest: string; plannerRoleMap: ReturnType<typeof roleMap> } | { kind: "unsupported" }

/** Own a closed Finance pair and its completed terminal facts, without crossing a phase. */
export function createSfFinancePairObservation(input: {
  host: DomainPortHost
  state: SfProductStatePort
  selectedScope: (call: TrustedDomainContext) => { ref: CaseRef; current: () => boolean } | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  readerIdentities: () => readonly unknown[]
  recordProof?: ReturnType<typeof createSfPlannerRecordProofScope>
}) {
  const root = createSfPlannerCalculationRoot({ host: input.host })
  const unsupported = { kind: "unsupported" as const }
  const unavailable = () => { sfPlannerProofCount("ownerRefused"); return ({ status: "unavailable" as const, reason: "finance-pair-observation-changed" }) }

  const observe = async <Value>(incoming: ScenarioCompareRequest, call: TrustedDomainContext,
    work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    try {
      if (!root.allows(call)) return unavailable()
      const host = input.host, persistence = host.persistence
      const parsed = decodeSfOperationInput("sf_scenario_compare", incoming)
      if (call.kind !== "ui" || !parsed.ok || parsed.value.criteria.length || parsed.value.scenarioRefs.length !== 2 ||
        parsed.value.scenarioRefs[0] === parsed.value.scenarioRefs[1] ||
        digestSfValue(parsed.value) !== digestSfValue(incoming) ||
        !persistence.readSnapshotRoot || !persistence.currentSnapshots || persistence.currentSnapshots()) { sfPlannerProofCount("ownerIneligible"); return await work() }
      const selection = input.selectedScope(call)
      if (!selection) { sfPlannerProofCount("ownerSelectionFallback"); return await work() }
      const request = host.requestFor(call)
      if (!request || request.signal.aborted || !selection.current()) return unavailable()

      const pairDigest = digestSfValue(incoming), caseDigest = digestSfValue(selection.ref)
      const readState = input.state.read, lockedFences = input.lockedSourceFences, readers = input.readerIdentities
      const identities = [...readers()], recordProof = input.recordProof, observeRecords = recordProof?.run
      const current = () => selection.current() && digestSfValue(selection.ref) === caseDigest &&
        input.host === host && host.persistence === persistence && host.requestFor(call) === request && !request.signal.aborted &&
        digestSfValue(incoming) === pairDigest && input.state.read === readState && input.lockedSourceFences === lockedFences &&
        input.readerIdentities === readers && sameReaders(readers(), identities) &&
        input.recordProof === recordProof && recordProof?.run === observeRecords
      const environment = async () => {
        const value = await host.environment(request), at = Date.parse(value.at)
        return Number.isFinite(at) ? digestSfValue({ day: new Date(at).toISOString().slice(0, 10),
          directory: value.directory, bankKey: value.bankKey ? Array.from(value.bankKey) : undefined }) : undefined
      }
      const witness = async (): Promise<Witness | undefined> => {
        const observed = await readState(request, "cases", async (state, actor): Promise<Witness | undefined> => {
          const decision = state.cases[selection.ref.id]
          if (!current() || !decision || decision.id !== selection.ref.id || decision.incarnation !== selection.ref.incarnation ||
            decision.version !== selection.ref.version || !decision.participants.includes(actor.principalRef) ||
            actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
            actor.policyVersion !== call.binding.policyVersion) return undefined
          const refs = closedPair(decision, state, parsed.value.scenarioRefs)
          const snapshots = persistence.currentSnapshots?.(), sources = lockedFences()
          if (!snapshots || !sources) return undefined
          if (!refs) return unsupported
          const snapshotDigest = digestSfValue({ state, snapshots, sources })
          const before = await environment()
          const principal = structuredClone(await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") }))
          if (!before || !principal || principal.id !== actor.principalRef || !current()) return undefined
          if (principal.id.startsWith("local:")) return unsupported
          if (!refs.every((ref) => plannerRecordMaterialized(ref, call, snapshots.planner, principal))) return unsupported
          if (!await host.revalidate(call) || !current()) return undefined
          const after = await environment()
          const again = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") })
          if (!after || before !== after || digestSfValue(principal) !== digestSfValue(again) || !current() ||
            snapshotDigest !== digestSfValue({ state, snapshots: persistence.currentSnapshots?.(), sources: lockedFences() })) return undefined
          return { kind: "current", digest: digestSfValue({ snapshotDigest, principal, environment: after }), environment: after,
            refs: structuredClone(refs), principalDigest: digestSfValue(principal), plannerRoleMap: structuredClone(roleMap(snapshots.planner, "planner")) }
        })
        if (!current() || observed.status !== "ok" || !observed.value) return undefined
        if (observed.value.kind === "unsupported") return observed.value
        // C08 reauthorizes after its callback. Close the clock witness after that await too.
        const closed = await environment()
        return current() && closed === observed.value.environment ? observed.value : undefined
      }
      const prepared = await root.prepare(call, async () => true, current)
      if (!prepared) { sfPlannerProofCount("ownerPreparedFailed"); return unavailable() }
      const grouped = await prepared.run(async (): Promise<PortResult<typeof unsupported | {
        kind: "observed"; witness: string; result: PortResult<Value>
      }>> => {
        const before = await witness()
        if (!before) return unavailable()
        if (before.kind === "unsupported") return { status: "ok", value: unsupported }
        // The private root seals these ACL/source bytes. Authentication and the
        // environment are still freshly observed for every terminal proof read.
        const authorizeRecords = async () => {
          if (!current() || !await host.revalidate(call) || !current()) return false
          const environmentNow = await environment()
          if (!current() || environmentNow !== before.environment) return false
          const principalNow = await host.authenticate(request, { surface: "planner", roleMap: structuredClone(before.plannerRoleMap) })
          return current() && digestSfValue(principalNow) === before.principalDigest &&
            await host.revalidate(call) && current()
        }
        const result = observeRecords
          ? await observeRecords(before.refs, call, root.proof(call), authorizeRecords, current, work)
          : await work()
        const after = await witness()
        return after?.kind === "current" && after.digest === before.digest
          ? { status: "ok", value: { kind: "observed", witness: after.digest, result } }
          : unavailable()
      })
      if (grouped.status !== "ok") return grouped
      if (grouped.value.kind === "unsupported") { sfPlannerProofCount("ownerUnsupported"); return current() ? await work() : unavailable() }
      // The first root is closed. Never replay the work when a source or reader has changed.
      const egress = await root.prepare(call, async () => true, current)
      if (!egress) return unavailable()
      const fresh = await egress.run(async () => ({ status: "ok" as const, value: await witness() }))
      if (fresh.status !== "ok" || fresh.value?.kind !== "current" || fresh.value.digest !== grouped.value.witness || !current())
        return unavailable()
      const closed = await environment()
      return closed === fresh.value.environment && current() ? grouped.value.result : unavailable()
    } catch { return unavailable() }
  }
  return <Value>(incoming: ScenarioCompareRequest, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>) =>
    sfPlannerProofOwner(0, () => observe(incoming, call, work))
}

function sameReaders(current: readonly unknown[], pinned: readonly unknown[]) {
  return current.length === pinned.length && current.every((reader, index) => reader === pinned[index])
}

/** Admit only the historical Planner-only closure. Other domain routes keep their own readers. */
function closedPair(decision: DecisionCase, state: Readonly<SfProductState>, references: readonly string[]) {
  const alternatives = [...decision.alternatives, ...decision.choices]
  if (decision.preparedChanges.length || decision.receipts.length || alternatives.some((item) => item.scenario.operations.some((operation) =>
    operation.replacementRef !== undefined || operation.targetRef.startsWith("sf-procurement:") ||
    !["replace", "exclude", "include", "defer"].includes(operation.kind)))) return undefined
  const found = new Map<string, PlannerRecord>(), seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object" || seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" ||
        !ref.target.period || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      found.set(digestSfValue(ref), ref)
    }
    return Object.values(item).every(visit)
  }
  if (!visit(decision) || !found.size) return undefined
  const bases = new Set([...found.values()].map((ref) => ref.refId))
  if (!alternatives.every((alternative) => bases.has(alternative.scenario.baseRef))) return undefined
  const pair = references.map((ref) => {
    const stored = state.decisionResults?.[ref]
    return stored?.kind === "scenario" && stored.resultRef === ref && stored.caseRef.id === decision.id &&
      stored.caseRef.incarnation === decision.incarnation && stored.caseRef.version <= decision.version &&
      digestSfValue(stored.result) === stored.resultDigest && stored.sourceRefs.every((source) => found.has(digestSfValue(source)))
      ? decision.alternatives.filter((item) => digestSfValue(item.scenario) === stored.requestDigest &&
        digestSfValue(item.result) === stored.resultDigest)
      : []
  })
  return pair[0]?.length === 1 && pair[1]?.length === 1 && pair[0][0]!.id !== pair[1][0]!.id ? [...found.values()] : undefined
}

export function plannerRecordMaterialized(ref: PlannerRecord, call: TrustedDomainContext, snapshot: Snapshot, principal: Principal) {
  const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
  const selector = sfPlannerProjectionSelector(snapshot, { id: principal.id, roles,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer") })
  const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
    policyVersion: call.binding.policyVersion, recordType: "planner-version", recordId: ref.target.recordId, selector }
  const entry = snapshot.sfSources?.scopes?.[digestSfValue(scope)]
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId), identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectSfSourceScope("planner", snapshot, scope)
  if (!entry || !source || !identity || !projection || typeof projection !== "object" || Array.isArray(projection) ||
    identity.incarnation !== entry.incarnation || identity.version !== entry.version || identity.inputDigest !== digestSfValue(projection)) return false
  const expected = sfPlannerEvidenceRef({ versionId: scope.recordId, projection: projection as Record<string, unknown>, identity }, call)
  return !!expected && digestSfValue(expected) === digestSfValue(ref) &&
    digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
      alive: true, inputDigest: identity.inputDigest, version: entry.version })
}
