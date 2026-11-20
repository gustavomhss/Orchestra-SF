import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { criterionRuleKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfCaseReadObservation } from "./case-read-batch.ts"
import type { SfCaseReadBatchAdmission } from "./case-read-batch.ts"

type Phase = { kind: "comparison" | "empty-recall"; caseRef: { id: string; incarnation: string; version: number }; request: unknown }
type Observation = <Value>(phase: Phase, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>,
  current?: () => boolean) => Promise<PortResult<Value>>

/** Group only a complete read phase whose requested sources are already inside
 * the admitted case closure. The original case/metric/recall callbacks all run;
 * mutation preparation, writes and separate observations remain outside. */
export function createSfPlannerObservationBatch(input: Parameters<typeof createSfCaseReadObservation>[0] & {
  admissions: readonly SfCaseReadBatchAdmission[]
  readerIdentities: () => readonly unknown[]
}): Observation {
  const admissions = input.admissions
  const readers = admissions.map((base) => createSfCaseReadObservation(input, { kind: base.kind,
    identity: () => [input.admissions, ...input.admissions, base, base.kind, base.identity, base.forCall,
      input.readerIdentities, ...input.readerIdentities(), ...base.identity()],
    forCall: (call, incoming) => {
      const phase = object(incoming).phase
      if (!phaseShape(phase) || input.admissions !== admissions) return undefined
      const admitted = base.forCall(call, incoming)
      if (!admitted) return undefined
      return { ...admitted, dependencies: (value, state) => {
        const refs = admitted.dependencies(value, state, incoming)
        return refs?.length && phaseSources(phase, value, state, refs) ? refs : undefined
      } }
    },
  }))
  return async <Value>(phase: Phase, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>,
    current: () => boolean = () => true): Promise<PortResult<Value>> => {
    const incoming = { caseRef: encodeCaseRef(phase.caseRef), phase }
    const run = (index: number): Promise<PortResult<Value>> => readers[index]
      ? readers[index]!(incoming, call, () => run(index + 1), { current, validate: () => true }) : work()
    return run(0)
  }
}

function phaseShape(value: unknown): value is Phase {
  const phase = object(value), ref = object(phase.caseRef), request = object(phase.request)
  if ((phase.kind !== "comparison" && phase.kind !== "empty-recall") || typeof ref.id !== "string" || !ref.id ||
    typeof ref.incarnation !== "string" || !ref.incarnation || !Number.isSafeInteger(ref.version) || Number(ref.version) < 0) return false
  if (phase.kind === "empty-recall") {
    const scope = object(request.scope)
    const decoded = decodeSfSkillInput("DecisionRecallInput", { currentCase: request.caseRef, query: scope.query, recallScope: scope.recallScope })
    return request.limit === 50 && decoded.ok && digestSfValue(decoded.value.currentCase) === digestSfValue(ref) &&
      decoded.value.recallScope.cases.length === 0 && decoded.value.recallScope.includeHistorical === false
  }
  const compared = decodeSfOperationInput("sf_scenario_compare", phase.request)
  if (compared.ok && digestSfValue(compared.value) === digestSfValue(phase.request)) return true
  return request.metricRef === "planner:known-subtotal-difference" && typeof request.scenarioRef === "string" &&
    typeof request.baselineRef === "string" && typeof request.criterionId === "string" &&
    digestSfValue(request.caseRef) === digestSfValue(ref)
}

function phaseSources(phase: Phase, value: DecisionCase, state: Readonly<SfProductState>, refs: readonly BusinessEvidenceRef[]) {
  if (value.id !== phase.caseRef.id || value.incarnation !== phase.caseRef.incarnation || value.version !== phase.caseRef.version) return false
  if (phase.kind === "empty-recall") return true
  const request = object(phase.request)
  const decoded = decodeSfOperationInput("sf_scenario_compare", phase.request)
  const references = decoded.ok ? decoded.value.scenarioRefs : [String(request.baselineRef), String(request.scenarioRef)]
  const criteria = decoded.ok ? decoded.value.criteria : [String(request.criterionId)]
  const known = new Set(refs.map((ref) => digestSfValue(ref)))
  const sourceRefs = (items: unknown) => Array.isArray(items) && items.every((ref) => known.has(digestSfValue(ref)))
  const scenario = (reference: string) => {
    const stored = state.decisionResults?.[reference]
    return !!stored && stored.kind === "scenario" && stored.caseRef.id === value.id && stored.caseRef.incarnation === value.incarnation &&
      stored.caseRef.version <= value.version && sourceRefs(stored.sourceRefs) &&
      value.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === stored.requestDigest &&
        digestSfValue(alternative.result) === stored.resultDigest).length === 1
  }
  if (!references.every(scenario)) return false
  return criteria.every((id) => {
    const rule = object(state.preferences[criterionRuleKey(phase.caseRef, id)]), caseRef = object(rule.caseRef)
    if (rule.schema !== "sf-criterion-rule-v1" || rule.criterionId !== id || !sourceRefs(rule.evidenceRefs) ||
      caseRef.id !== value.id || caseRef.incarnation !== value.incarnation || !Number.isSafeInteger(caseRef.version) ||
      Number(caseRef.version) > value.version || Number(caseRef.version) < 0) return false
    if (rule.sensitivity === undefined) return true
    const sensitivity = object(rule.sensitivity)
    return typeof sensitivity.baselineRef === "string" && scenario(sensitivity.baselineRef) && sourceRefs(sensitivity.sourceRefs)
  })
}
