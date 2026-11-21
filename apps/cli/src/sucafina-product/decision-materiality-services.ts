import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { verifyDecisionPlannerSources } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { createPlannerMateriality } from "../../../../modules/sucafina/Sucafinav1/product/planner/materiality.ts"
import { createSfSignalRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts"
import type { SfSignalSelection, SfStoredSignalBinding } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts"
import { classifySfMaterialChange } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import { reconcileSfSignal } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signals.ts"
import { createSfDecisionPlannerActors } from "./decision-baseline-services.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** A human records a condition; Planner computes its change from two selected stored scenarios. */
export function createSfDecisionMaterialityServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  signalRegistryWrites: WeakSet<object>
}) {
  const host = input.authority.host
  const business = input.business
  const scenarios = business.plannerProduct.scenarios
  if (!scenarios) throw new Error("SF_MATERIALITY_STORED_SCENARIOS_REQUIRED")
  const actors = createSfDecisionPlannerActors(input.authority)
  const fences = new Map<string, { call: TrustedDomainContext; binding: string; sources: string; refs: readonly BusinessEvidenceRef[]; expires: number }>()
  const key = (selection: SfSignalSelection, principalRef: string, accessRevision: string, policyVersion: string) => digestSfValue({ selection, principalRef, accessRevision, policyVersion })
  const currentCase = async (selection: Pick<SfSignalSelection, "caseRef">, call: TrustedDomainContext) => {
    const selected = await input.selectedCase(call)
    if (selected.status !== "ok" || selected.value.id !== selection.caseRef.id || selected.value.incarnation !== selection.caseRef.incarnation || selected.value.version < selection.caseRef.version) return undefined
    const current = await business.cases.read({ caseRef: encodeCaseRef(selected.value) }, call)
    return current.status === "ok" && same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, selected.value) && await host.revalidate(call) ? current.value : undefined
  }
  const authorizeSelection = async (selection: SfSignalSelection, call: TrustedDomainContext) => {
    const binding = digestSfValue([call.kind, call.binding])
    const current = await currentCase(selection, call)
    if (!current || selection.source.surface !== "planner" || selection.evidence.target.surface !== "planner" ||
      current.case.choices.filter((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId)).length !== 1 ||
      current.case.criteria.filter((criterion) => criterion.id === selection.criterionId).length !== 1 || !current.case.participants.includes(selection.recipientRef) ||
      !current.evidenceRefs.some((ref) => same(ref, selection.evidence))) return false
    const stored = await Promise.all(selection.scenarioRefs.map((resultRef) => business.results.readHistoricalScenario({ resultRef }, call)))
    const resolved = await Promise.all(selection.scenarioRefs.map((ref) => scenarios.resolve(ref, call)))
    if (stored.length !== 2 || stored.some((result) => result.status !== "ok" || result.value.kind !== "scenario" || result.value.caseRef.id !== current.case.id ||
      result.value.caseRef.incarnation !== current.case.incarnation || result.value.caseRef.version > current.case.version) || resolved.some((result) => result.status !== "ok")) return false
    const refs = [selection.evidence, ...resolved.flatMap((result) => result.status === "ok" ? [...result.value.result.sourceRefs,
      ...result.value.result.costCoverage.evaluatedSourceRefs, ...result.value.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)] : [])]
    const found = await business.context.context({ refs }, call)
    if (!refs.length || found.length !== refs.length || found.some((value, index) => value.state !== "fresh" || !value.authorizedProjection || !value.currentRef || !same(value.ref, refs[index]) || !same(value.currentRef, value.ref)) || !await actors.capture(call)) return false
    const sourceFences = await business.readSourceFences(call)
    const again = await currentCase(selection, call)
    if (!sourceFences || !again || !same(current.case, again.case) || binding !== digestSfValue([call.kind, call.binding]) || !await host.revalidate(call)) return false
    const now = Date.now()
    for (const [id, value] of fences) if (value.expires <= now) fences.delete(id)
    const id = key(selection, call.binding.principalRef, call.binding.accessRevision, call.binding.policyVersion)
    if (fences.size >= 512 && !fences.has(id)) return false
    fences.set(id, { call, binding, sources: digestSfValue(sourceFences), refs: structuredClone(refs), expires: now + 30_000 })
    return true
  }
  const choiceFor = async (selection: SfSignalSelection, call: TrustedDomainContext) => {
    const current = await currentCase(selection, call)
    const choices = current?.case.choices.filter((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId))
    return choices?.length === 1 ? choices[0] : undefined
  }
  const nextState = async (record: SfStoredSignalBinding, call: TrustedDomainContext) => {
    const choice = await choiceFor(record.selection, call)
    if (!choice || digestSfValue(choice) !== record.choiceDigest || !await authorizeSelection(record.selection, call)) return undefined
    const change = await produce({ selection: record.selection, choice }, call)
    if (change.status !== "ok") return undefined
    const classified = classifySfMaterialChange({ id: record.id, source: record.selection.source, fields: record.selection.fields,
      period: record.selection.period, criterionId: record.selection.criterionId, choice }, change.value)
    // Irrelevance is not a proof that an existing condition was resolved.
    if (!classified.signal) return record.signalState
    const next = reconcileSfSignal(record.signalState, { kind: "signal", signal: classified.signal })
    return "state" in next ? next.state : undefined
  }
  const registry: ReturnType<typeof createSfSignalRegistry> = createSfSignalRegistry({ state: input.authority.state, host, cases: business.cases,
    signalRegistryWrites: input.signalRegistryWrites, operationIdentity: business.operationIdentity, createId: randomUUID,
    approveSelection: (selection, call) => input.authority.human.authorize(call, "decisions.condition.record", selection), authorizeSelection,
    approveReconcile: async (record, next, call) => {
      const produced = await nextState(record, call)
      return !!produced && same(produced, next) && await host.revalidate(call)
    },
    checkSourceFence: async (snapshot, selection, authority) => {
      const captured = fences.get(key(selection, authority.principalRef, authority.accessRevision, authority.policyVersion))
      if (!captured || captured.expires <= Date.now() || captured.binding !== digestSfValue([captured.call.kind, captured.call.binding])) return false
      const actor = actors.locked(snapshot, captured.call)
      const locked = business.lockedSourceFences()
      return !!actor && !!locked && captured.sources === digestSfValue(locked) && verifyDecisionPlannerSources(snapshot, captured.refs, actor, captured.call)
    } })
  const produce: ReturnType<typeof createPlannerMateriality> = createPlannerMateriality({ scenarios, planner: business.planner,
    verifyBinding: async (selection, choice, call) => {
      const selected = await input.selectedCase(call)
      if (selected.status !== "ok") return false
      const visible = await registry.list(selected.value, call)
      const matches = visible.status === "ok" ? visible.records.filter((record) => sameSelection(record.selection, selection) && record.choiceDigest === digestSfValue(choice)) : []
      if (matches.length !== 1) return false
      const current = await choiceFor(matches[0]!.selection, call)
      return !!current && same(current, choice) && await authorizeSelection(matches[0]!.selection, call) && await host.revalidate(call)
    } })
  return { registry: { list: registry.list }, produce, dispose: () => { fences.clear() },
    conditions: {
      register: registry.register,
      revise: registry.revise,
      // Only the host calls this method. The next state is produced here, never accepted from a client.
      reconcile: async (conditionId: string, call: TrustedDomainContext) => {
        const selected = await input.selectedCase(call)
        if (selected.status !== "ok") return { status: "unavailable" as const }
        const visible = await registry.list(selected.value, call)
        const records = visible.status === "ok" ? visible.records.filter((record) => record.id === conditionId) : []
        if (records.length !== 1) return { status: "unavailable" as const }
        const next = await nextState(records[0]!, call)
        return next ? registry.reconcile(records[0]!, next, call) : { status: "unavailable" as const }
      },
    },
  }
}

function sameSelection(left: SfSignalSelection, right: Parameters<ReturnType<typeof createPlannerMateriality>>[0]["selection"]) {
  return same({ caseRef: left.caseRef, choiceId: left.choiceId, source: left.source, evidence: left.evidence, fields: left.fields,
    period: left.period, criterionId: left.criterionId, scenarioRefs: left.scenarioRefs },
  { caseRef: right.caseRef, choiceId: right.choiceId, source: right.source, evidence: right.evidence, fields: right.fields,
    period: right.period, criterionId: right.criterionId, scenarioRefs: right.scenarioRefs })
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
