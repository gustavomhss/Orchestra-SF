import { randomUUID } from "node:crypto"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { createSfSignalRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts"
import type { SfSignalSelection } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts"
import { createSfPlannerMaterialityAccess } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/planner-materiality.ts"
import type { MaterialChangeEvent, MaterialCondition } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import { createSfAuthorizedSignalList } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-list.ts"
import { reconcileSfSignal } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signals.ts"
import { createSfOutcomeSelectionRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/outcome-selection.ts"
import { createSfDomainOutcomeAccess } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/domain-outcome.ts"
import { createSfReviewOutcomeAdapter } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/outcome-review.ts"
import { createPlannerMateriality } from "../../../../modules/sucafina/Sucafinav1/product/planner/materiality.ts"
import { createPlannerObservedProjection } from "../../../../modules/sucafina/Sucafinav1/product/planner/observed.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { RoutineHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/capabilities.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { SfReviewReaders } from "./review-services.ts"
import { materialSelection, memorySignalSelection, memoryOutcomeSelection } from "./memory-selection.ts"
import type { SfMaterialSelectionScope, SfMemoryCaseRef } from "./memory-selection.ts"

export type SfMemoryServicesInput = {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "state" | "human">
  business: Pick<ReturnType<typeof createSfBusinessServices>, "cases" | "context" | "plannerSources" | "resolveCase" | "operationIdentity" | "readSourceFences" | "lockedSourceFences"> & {
    planner: Pick<ReturnType<typeof createSfBusinessServices>["planner"], "compareScenarios" | "compareForecast">
    plannerProduct: Pick<ReturnType<typeof createSfBusinessServices>["plannerProduct"], "scenarios">
  }
  signalRegistryWrites: WeakSet<object>
}

/** Compose C17 from protected selections and actual Planner/C08 reads. No polling event is invented. */
export function createSfMemoryServices(input: SfMemoryServicesInput) {
  const host = input.authority.host
  const business = input.business
  const scopes = new WeakMap<TrustedDomainContext, SfMaterialSelectionScope>()
  const fences = new WeakMap<object, { selectionDigest: string; authority: SfStateAuthority; casesVersion: number; sources: NonNullable<Awaited<ReturnType<typeof business.readSourceFences>>> }>()
  const authorizeEvidence = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => {
    const selected = [...new Map(refs.map((ref) => [ref.refDigest, ref])).values()]
    if (selected.some((ref) => ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId ||
      ref.refDigest !== digestSfEvidenceRef(ref)) || !await host.revalidate(call)) return false
    const resolved = await business.context.context({ refs: selected }, call)
    return resolved.length === selected.length && resolved.every((entry, index) => entry.state === "fresh" && !!entry.authorizedProjection &&
      !!entry.currentRef && entry.accessRevision === call.binding.accessRevision && same(entry.ref, selected[index]) && same(entry.currentRef, entry.ref)) &&
      await host.revalidate(call)
  }
  const authorizeFenced = async (selection: object, call: TrustedDomainContext, read: () => Promise<boolean>) => {
    const request = host.requestFor(call)
    if (!request) return false
    const cases = () => input.authority.state.read(request, "cases", (_state, actor) => actor.principalRef === call.binding.principalRef &&
      actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion)
    const first = await cases()
    const before = await business.readSourceFences(call)
    if (first.status !== "ok" || !first.value || !before || !await read() || !await host.revalidate(call)) return false
    const after = await business.readSourceFences(call)
    const last = await cases()
    if (!after || !same(before, after) || last.status !== "ok" || !last.value || last.storageVersion !== first.storageVersion) return false
    fences.set(selection, { selectionDigest: digestSfValue(selection), authority: { principalRef: call.binding.principalRef,
      accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion }, sources: after, casesVersion: last.storageVersion })
    return true
  }
  const checkSourceFence = async (snapshot: Snapshot, selection: object, authority: SfStateAuthority) => {
    const captured = fences.get(selection)
    const locked = business.lockedSourceFences()
    const state = object(host.persistence.currentSnapshots?.()?.dashboard.data.__sfProductV1)
    return !!captured && !!locked && same(captured.authority, authority) && captured.selectionDigest === digestSfValue(selection) &&
      object(state.versions).cases === captured.casesVersion && sfRunSourceFence(snapshot) === captured.sources.planner && same(captured.sources, locked)
  }
  const scenarios = business.plannerProduct.scenarios
  const authorizeSignal = (selection: SfSignalSelection, call: TrustedDomainContext) => authorizeFenced(selection, call, async () => {
    const request = host.requestFor(call)
    if (!request || !scenarios || !memorySignalSelection(selection) || !await authorizeEvidence([selection.evidence], call)) return false
    const read = () => input.authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef &&
      actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
      ? selection.scenarioRefs.map((ref) => state.decisionResults?.[ref]) : undefined)
    const stored = await read()
    if (stored.status !== "ok" || !stored.value || stored.value.some((record, index) => !record || record.schema !== "sf-decision-result-v1" ||
      record.kind !== "scenario" || record.resultRef !== selection.scenarioRefs[index] || record.caseRef.id !== selection.caseRef.id ||
      record.caseRef.incarnation !== selection.caseRef.incarnation || record.caseRef.version > selection.caseRef.version || record.resultDigest !== digestSfValue(record.result))) return false
    const resolved = await Promise.all(selection.scenarioRefs.map((ref) => scenarios.resolve(ref, call)))
    const again = await read()
    return resolved.every((result, index) => result.status === "ok" && same(result.value.result, stored.value![index]!.result)) &&
      again.status === "ok" && stored.storageVersion === again.storageVersion && same(stored.value, again.value) && await host.revalidate(call)
  })
  const domainProducer = scenarios ? createPlannerMateriality({ scenarios, planner: business.planner, verifyBinding: async (selection, choice, call) => {
    const current = await business.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
    return current.status === "ok" && current.value.case.id === selection.caseRef.id && current.value.case.incarnation === selection.caseRef.incarnation &&
      current.value.case.version >= selection.caseRef.version && current.value.case.choices.filter((item) => item.id === selection.choiceId && same(item, choice)).length === 1 &&
      current.value.evidenceRefs.some((ref) => same(ref, selection.evidence)) && await authorizeEvidence([selection.evidence], call)
  } }) : undefined
  // Re-evaluation compares the original criterion set. Read that complete comparison from C10;
  // retaining a one-criterion projection would silently reject every multi-criterion choice.
  const produce: ReturnType<typeof createPlannerMateriality> = async (request, call) => {
    if (!domainProducer) return unavailable("planner-materiality-producer-unavailable")
    const first = await domainProducer(request, call)
    if (first.status !== "ok") return first
    if (same(request.choice.criteria, [request.selection.criterionId])) return first
    const read = () => business.planner.compareScenarios({ scenarioRefs: request.selection.scenarioRefs, criteria: request.choice.criteria }, call)
    const complete = await read()
    if (complete.status !== "ok" || !same(complete.value.criterionResults.filter((item) => item.criterionId === request.selection.criterionId), first.value.comparison.after.criterionResults))
      return unavailable("materiality-comparison-unavailable")
    const again = await domainProducer(request, call)
    const checked = await read()
    if (again.status !== "ok" || !same(first.value, again.value) || checked.status !== "ok" || !same(complete.value, checked.value) || !await host.revalidate(call))
      return unavailable("materiality-comparison-changed")
    return { status: "ok", value: { ...first.value, comparison: { ...first.value.comparison, after: complete.value } } }
  }
  const registry: ReturnType<typeof createSfSignalRegistry> = createSfSignalRegistry({ state: input.authority.state, host, cases: business.cases, signalRegistryWrites: input.signalRegistryWrites,
    approveSelection: (selection, call) => input.authority.human.authorize(call, "decisions.condition.record", selection),
    authorizeSelection: authorizeSignal, checkSourceFence, operationIdentity: business.operationIdentity, createId: randomUUID,
    approveReconcile: async (record, next, call) => {
      const current = await business.cases.read({ caseRef: encodeCaseRef(record.selection.caseRef) }, call)
      if (current.status !== "ok") return false
      const actual = await materiality({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, record.id, call)
      if (actual.status !== "ok" || !actual.signal) return false
      const calculated = reconcileSfSignal(record.signalState, { kind: "signal", signal: actual.signal })
      return "state" in calculated && !!calculated.state && same(calculated.state, next) && await host.revalidate(call)
    },
  })
  const materialityAccess = (caseRef: SfMemoryCaseRef): ReturnType<typeof createSfPlannerMaterialityAccess> => createSfPlannerMaterialityAccess({ caseRef, registry, cases: business.cases, host, produce, authorizeEvidence })
  const materiality = (caseRef: SfMemoryCaseRef, conditionId: string, call: TrustedDomainContext) => materialityAccess(caseRef)(conditionId, call)
  const signals = (caseRef: SfMemoryCaseRef, call: TrustedDomainContext) => createSfAuthorizedSignalList({ host, cases: business.cases, registry,
    materiality: materialityAccess(caseRef) })(caseRef, call)
  const observed = createPlannerObservedProjection({ host, planner: business.planner, sources: business.plannerSources })
  const outcomeSelections = createSfOutcomeSelectionRegistry({ state: input.authority.state, host, cases: business.cases, signalRegistryWrites: input.signalRegistryWrites,
    approveSelection: (selection, call) => input.authority.human.authorize(call, "decisions.outcome.select", selection),
    authorizeSelection: (selection, call) => authorizeFenced(selection, call, async () => !!memoryOutcomeSelection(selection) &&
      await authorizeEvidence(selection.evidenceRefs, call) && !!await observed(selection, call)),
    checkSourceFence, operationIdentity: business.operationIdentity,
  })
  const outcomes = createSfDomainOutcomeAccess({ host, cases: business.cases, select: outcomeSelections.select, readProjection: observed, authorizeEvidence })
  const readReviewOutcome = createSfReviewOutcomeAdapter(outcomes)
  const reviewOutcome: NonNullable<SfReviewReaders["outcome"]> = {
    read: async (request, call) => {
      const result = await readReviewOutcome(request, call)
      return result.status === "ready" && result.comparison.cutoff === request.cutoff ? result : { status: "unavailable" }
    },
    authorize: async (call, values) => {
      const captured = structuredClone(values)
      const binding = digestSfValue([call.kind, call.binding])
      if (!await host.revalidate(call)) return false
      for (const observation of captured) {
        const current = await business.cases.read({ caseRef: encodeCaseRef(observation.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.version !== observation.caseRef.version) return false
        const load = () => Promise.all(current.value.case.choices.map((choice) => readReviewOutcome({ caseRef: observation.caseRef, choiceId: choice.id }, call)))
        const first = await load()
        const selected = first.filter((result) => result.status === "ready" && same(result.observation, observation))
        if (selected.length !== 1) return false
        const second = await load()
        if (!same(first, second)) return false
      }
      return same(values, captured) && binding === digestSfValue([call.kind, call.binding]) && await host.revalidate(call)
    },
  }

  const scopeAuthorized = async (scope: SfMaterialSelectionScope, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || request.signal.aborted || !await host.revalidate(call)) return false
    if (call.kind === "ui") return input.authority.human.authorize(call, scope.action, scope.payload)
    if (scope.action !== "analysis.start" || call.binding.caseId !== scope.caseRef.id || call.binding.caseIncarnation !== scope.caseRef.incarnation ||
      call.binding.caseVersion !== scope.caseRef.version) return false
    const payload = object(scope.payload)
    const found = await input.authority.state.read(request, "contributions", (state, actor) => {
      const run = state.nativeRuns?.[call.binding.runId]
      return !!run && run.skillId === "sf-reavaliar-compromissos" && run.native?.sessionID === call.binding.nativeSessionId &&
        run.principalRef === actor.principalRef && actor.principalRef === call.binding.principalRef && run.accessRevision === actor.accessRevision &&
        actor.accessRevision === call.binding.accessRevision && run.policyVersion === actor.policyVersion && actor.policyVersion === call.binding.policyVersion &&
        same(run.caseRef, scope.caseRef) && run.intentDigest === digestSfValue(scope.payload) && run.skillInputDigest === digestSfValue(payload.skillInput)
    })
    return found.status === "ok" && found.value && await host.revalidate(call)
  }
  const withMaterialSelection = async <T>(call: TrustedDomainContext, incoming: SfMaterialSelectionScope, work: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    if (scopes.has(call)) return { status: "denied", reason: "materiality-selection-already-bound" }
    const scope = structuredClone(incoming)
    const payload = object(scope.payload)
    const selected = materialSelection(payload.request, scope.action === "analysis.prepare" ? payload.selection : payload.skillInput)
    if (!selected || !same(selected, { caseRef: scope.caseRef, choiceId: scope.choiceId, conditionIds: scope.conditionIds }) || !await scopeAuthorized(scope, call))
      return { status: "denied", reason: "materiality-selection-unavailable" }
    if (scopes.has(call)) return { status: "denied", reason: "materiality-selection-already-bound" }
    const binding = digestSfValue([call.kind, call.binding])
    scopes.set(call, scope)
    try {
      const result = await work()
      return scopes.get(call) === scope && binding === digestSfValue([call.kind, call.binding]) && await scopeAuthorized(scope, call)
        ? result : { status: "denied", reason: "materiality-selection-authority-changed" }
    } finally { scopes.delete(call) }
  }
  const selectedMaterialChanges = async (caseRef: SfMemoryCaseRef, call: TrustedDomainContext): Promise<PortResult<readonly { condition: MaterialCondition; change: MaterialChangeEvent }[]>> => {
    const selected = scopes.get(call)
    if (!selected || !same(selected.caseRef, caseRef) || !await scopeAuthorized(selected, call)) return unavailable("materiality-selection-required")
    const before = await business.readSourceFences(call)
    const listed = await registry.list(caseRef, call)
    if (!before || listed.status !== "ok") return unavailable("materiality-registry-unavailable")
    const bindings = selected.conditionIds.map((id) => listed.records.filter((record) => record.id === id))
    if (bindings.some((records) => records.length !== 1 || records[0]!.selection.choiceId !== selected.choiceId)) return unavailable("materiality-selected-condition-unavailable")
    const changes = await Promise.all(selected.conditionIds.map((id) => materiality(caseRef, id, call)))
    if (changes.some((result) => result.status !== "ok")) return unavailable("materiality-source-unavailable")
    const again = await registry.list(caseRef, call)
    const after = await business.readSourceFences(call)
    if (again.status !== "ok" || !after || !same(before, after) || bindings.some((records) => !again.records.some((record) => same(record, records[0]))) ||
      scopes.get(call) !== selected || !await scopeAuthorized(selected, call)) return unavailable("materiality-selection-or-source-changed")
    const values = changes.flatMap((result) => result.status === "ok" ? [result.snapshot] : [])
    return values.length === selected.conditionIds.length && values.every((value, index) => value.condition.id === selected.conditionIds[index] && value.condition.choice.id === selected.choiceId)
      ? { status: "ok", value: values } : unavailable("materiality-selected-condition-unavailable")
  }
  const conditions = async (caseRef: SfMemoryCaseRef, call: TrustedDomainContext) => {
    const result = await registry.list(caseRef, call)
    return result.status === "ok" ? { status: "ok" as const, value: result.records.map((record) => ({ conditionId: record.id, revision: record.revision,
      choiceId: record.selection.choiceId, criterionId: record.selection.criterionId, label: record.selection.label, period: record.selection.period })) }
      : unavailable("materiality-registry-unavailable")
  }
  const prepareWatch: RoutineHost["prepareWatch"] = async (requested, call) => {
    const selected = await business.resolveCase(call)
    if (selected.status !== "ok") return selected
    if (requested.caseRef !== selected.value.id || !await host.revalidate(call)) return { status: "denied", reason: "watch-case-unavailable" }
    const bindings = await registry.list(selected.value, call)
    const found = bindings.status === "ok" ? bindings.records.filter((record) => record.id === requested.conditionRef &&
      (requested.recipientRef === undefined || requested.recipientRef === record.selection.recipientRef)) : []
    if (found.length !== 1) return unavailable("watch-condition-unavailable")
    if ((await materiality(selected.value, found[0]!.id, call)).status !== "ok") return unavailable("watch-condition-source-unavailable")
    // The condition is real, but C17 cannot create C07 authorizations, schedule identities or occurrence owners.
    return unavailable("native-watch-admission-port-unavailable")
  }
  return { registry, conditions, materiality, signals, outcomeSelections, outcomes, reviewOutcome, selectedMaterialChanges, withMaterialSelection, prepareWatch,
    catalog: [...(scenarios ? ["planner-conditions", "planner-materiality", "planner-signals"] as const : []), "planner-closed-month-outcomes" as const],
    unavailable: [...(!scenarios ? ["planner-materiality-producer-unavailable"] : []), "native-watch-admission-port-unavailable"],
  }
}

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function unavailable(reason: string) {
  return { status: "unavailable" as const, reason }
}
