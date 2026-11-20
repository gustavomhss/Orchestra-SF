import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { criterionRuleKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

type Selection = { scenarioRef: string; baselineRef: string; parameterRef: string; caseRef?: unknown }
type Observation =
  | { kind: "units"; selection: Selection }
  | { kind: "resolve"; request: SensitivityRequest; binding?: Record<string, unknown> }
  | { kind: "preview"; baselineRef: string; scenario: ScenarioRequest }
  | { kind: "exact"; request: SensitivityRequest; baselineRef: string; binding?: Record<string, unknown> }

/** Recognize only the existing complete read-only sensitivity producers. This
 * does not authorize a source or attest a number; the canonical producer still
 * performs every read and proof inside its own physical observation. */
export function sfPlannerSensitivityObservation(incoming: unknown) {
  return observation(incoming) !== undefined
}

export function sfPlannerSensitivitySources(incoming: unknown, value: DecisionCase,
  state: Readonly<SfProductState>, refs: readonly BusinessEvidenceRef[]) {
  const phase = observation(incoming)
  if (!phase) return false
  const known = new Set(refs.map((ref) => digestSfValue(ref)))
  const sourceRefs = (items: unknown) => Array.isArray(items) && items.every((ref) => known.has(digestSfValue(ref)))
  const scenario = (reference: string) => {
    const stored = state.decisionResults?.[reference]
    if (!stored || stored.kind !== "scenario" || stored.caseRef.id !== value.id || stored.caseRef.incarnation !== value.incarnation ||
      !Number.isSafeInteger(stored.caseRef.version) || stored.caseRef.version < 0 || stored.caseRef.version > value.version ||
      !sourceRefs(stored.sourceRefs) || digestSfValue(stored.result) !== stored.resultDigest) return undefined
    const alternatives = value.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === stored.requestDigest &&
      digestSfValue(alternative.result) === stored.resultDigest)
    return alternatives.length === 1 ? alternatives[0] : undefined
  }
  const rule = (criterion: SensitivityRequest["criterion"]) => {
    const current = object(state.preferences[criterionRuleKey(value, criterion.id)]), caseRef = object(current.caseRef)
    return current.schema === "sf-criterion-rule-v1" && current.criterionId === criterion.id &&
      current.metricRef === "planner:known-subtotal-difference" && current.operator === criterion.operator && current.value === criterion.value &&
      caseRef.id === value.id && caseRef.incarnation === value.incarnation && Number.isSafeInteger(caseRef.version) &&
      Number(caseRef.version) >= 0 && Number(caseRef.version) <= value.version && sourceRefs(current.evidenceRefs) ? current : undefined
  }
  const selected = (selection: Selection) => {
    const candidate = scenario(selection.scenarioRef), baseline = scenario(selection.baselineRef)
    if (!candidate || !baseline || selection.scenarioRef === selection.baselineRef ||
      selection.caseRef !== undefined && digestSfValue(selection.caseRef) !== digestSfValue({ id: value.id, incarnation: value.incarnation, version: value.version }))
      return undefined
    if (candidate.scenario.assumptions.length) return undefined
    const operations = candidate.scenario.operations.filter((operation) => operation.targetRef === selection.parameterRef)
    if (candidate.scenario.operations.length) {
      const operation = operations[0]
      if (operations.length !== 1 || !operation || operation.kind !== "replace" || operation.replacementRef !== undefined ||
        typeof operation.amount !== "number" || !Number.isFinite(operation.amount)) return undefined
    } else {
      if (!sourceOnlyOperation(candidate, selection.parameterRef)) return undefined
    }
    return candidate
  }
  if (phase.kind === "units") return selected(phase.selection) !== undefined
  if (phase.kind === "preview") {
    if (!scenario(phase.baselineRef) || phase.scenario.assumptions.length) return false
    const alternatives = value.alternatives.filter((alternative) => alternative.scenario.baseRef === phase.scenario.baseRef)
    const candidate = alternatives[0]
    if (alternatives.length !== 1 || !candidate || candidate.scenario.assumptions.length ||
      !refs.some((ref) => ref.kind === "record" && ref.target.surface === "planner" && ref.refId === phase.scenario.baseRef)) return false
    if (!candidate.scenario.operations.length) {
      const operation = phase.scenario.operations[0]
      const original = operation && sourceOnlyOperation(candidate, operation.targetRef)
      return phase.scenario.operations.length === 1 && !!operation && !!original &&
        typeof operation.amount === "number" && Number.isFinite(operation.amount) &&
        digestSfValue(operation) === digestSfValue({ ...original, amount: operation.amount })
    }
    if (phase.scenario.operations.length !== candidate.scenario.operations.length) return false
    let changed = 0
    return phase.scenario.operations.every((operation, index) => {
      const original = candidate.scenario.operations[index]!
      if (digestSfValue(operation) === digestSfValue(original)) return true
      if (++changed > 1 || original.kind !== "replace" || operation.kind !== "replace" ||
        original.replacementRef !== undefined || operation.replacementRef !== undefined ||
        typeof operation.amount !== "number" || !Number.isFinite(operation.amount)) return false
      return digestSfValue({ ...operation, amount: undefined }) === digestSfValue({ ...original, amount: undefined })
    })
  }
  const currentRule = rule(phase.request.criterion)
  if (!currentRule) return false
  const units = object(currentRule.sensitivity)
  const baselineRef = phase.kind === "exact" ? phase.baselineRef : units.baselineRef
  if (typeof baselineRef !== "string") return false
  const candidate = selected({ scenarioRef: phase.request.scenarioRef, baselineRef, parameterRef: phase.request.parameterBounds.parameterRef })
  if (!candidate) return false
  // Exact evaluates preview children inside this observation. Keep the entire
  // solver canonical when those children cannot enter the same source closure.
  if (phase.kind === "exact" && value.alternatives.filter((alternative) =>
    alternative.scenario.baseRef === candidate.scenario.baseRef).length !== 1) return false
  // A standalone canonical exact solver does not require a rule's sensitivity
  // extension. Host-bound resolve/revalidate/exact do, and retain its real refs.
  if (phase.kind === "resolve" || phase.binding) {
    if (units.baselineRef !== baselineRef || units.parameterRef !== phase.request.parameterBounds.parameterRef || !sourceRefs(units.sourceRefs)) return false
  }
  const binding = phase.binding
  return !binding || digestSfValue(binding.caseRef) === digestSfValue({ id: value.id, incarnation: value.incarnation, version: value.version }) &&
    binding.baselineRef === baselineRef && binding.criterionId === phase.request.criterion.id && binding.ruleRef === currentRule.ruleRef &&
    binding.ruleVersion === currentRule.version && binding.ruleDigest === digestSfValue(currentRule) &&
    digestSfValue(binding.scenario) === digestSfValue(candidate.scenario) && sourceRefs(binding.evidenceRefs) &&
    digestSfValue(binding.sensitivityRequest) === digestSfValue(phase.request)
}

/** A conservative shape check over the actual source-only result. It grants no
 * units: plannerSourceParameter and plannerOperationUnits still inspect the
 * current projection in the canonical producer, including both source passes. */
function sourceOnlyOperation(candidate: DecisionCase["alternatives"][number], target: string) {
  const components = candidate.result.components.filter((component) => component.id === target), component = components[0]
  if (candidate.scenario.operations.length || candidate.scenario.assumptions.length || target.startsWith("HR:") ||
    !candidate.result.id.startsWith("source-scenario:") || candidate.result.currency !== "USD" ||
    components.length !== 1 || !component || component.currency !== "USD" || component.evidenceState !== "confirmed" ||
    typeof component.amount !== "number" || !Number.isFinite(component.amount)) return undefined
  return { kind: "replace", targetRef: target, amount: component.amount, currency: "USD", period: component.period }
}

function observation(incoming: unknown): Observation | undefined {
  const value = object(incoming)
  if (closed(value, ["scenarioRef", "baselineRef", "parameterRef"], ["caseRef"]) &&
    text(value.scenarioRef) && text(value.baselineRef) && text(value.parameterRef))
    return { kind: "units", selection: { scenarioRef: value.scenarioRef, baselineRef: value.baselineRef,
      parameterRef: value.parameterRef, ...(value.caseRef === undefined ? {} : { caseRef: value.caseRef }) } }
  if (closed(value, ["baselineRef", "scenario"]) && text(value.baselineRef)) {
    const scenario = decodeSfOperationInput("sf_scenario_simulate", value.scenario)
    if (scenario.ok && digestSfValue(scenario.value) === digestSfValue(value.scenario))
      return { kind: "preview", baselineRef: value.baselineRef, scenario: scenario.value }
  }
  const direct = sensitivity(incoming)
  if (direct) return { kind: "resolve", request: direct }
  const binding = sensitivityBinding(incoming)
  if (binding) return { kind: "resolve", request: binding.request, binding: binding.value }
  if (closed(value, ["request", "baselineRef"]) && text(value.baselineRef)) {
    const request = sensitivity(value.request)
    if (request) return { kind: "exact", request, baselineRef: value.baselineRef }
  }
  if (closed(value, ["request", "binding"])) {
    const request = sensitivity(value.request), bound = sensitivityBinding(value.binding)
    if (request && bound && typeof bound.value.baselineRef === "string" &&
      digestSfValue(request) === digestSfValue(bound.request))
      return { kind: "exact", request, baselineRef: bound.value.baselineRef, binding: bound.value }
  }
  return undefined
}

function sensitivity(value: unknown): SensitivityRequest | undefined {
  const decoded = decodeSfOperationInput("sf_sensitivity_evaluate", value)
  return decoded.ok && digestSfValue(decoded.value) === digestSfValue(value) ? decoded.value : undefined
}

function sensitivityBinding(incoming: unknown) {
  const value = object(incoming)
  const required = ["caseRef", "scenario", "scenarioCoverageRef", "baselineCoverageRef", "baselineRef", "criterionId", "metric",
    "parameterUnit", "resultUnit", "unit", "unitMetadataRef", "unitMetadataVersion", "engineVersion", "evidenceRefs",
    "metadataDigest", "ruleRef", "ruleVersion", "ruleDigest", "sensitivityRequest"]
  if (!closed(value, required, ["parameterOperation"]) || value.metric !== "alternative-minus-baseline-known-subtotal") return undefined
  const request = sensitivity(value.sensitivityRequest)
  const scenario = decodeSfOperationInput("sf_scenario_simulate", value.scenario)
  return request && scenario.ok && digestSfValue(scenario.value) === digestSfValue(value.scenario) &&
    ["scenarioCoverageRef", "baselineCoverageRef", "baselineRef", "criterionId", "parameterUnit", "resultUnit", "unit",
      "unitMetadataRef", "engineVersion", "metadataDigest", "ruleRef", "ruleDigest"].every((key) => text(value[key])) &&
    Number.isSafeInteger(value.unitMetadataVersion) && Number.isSafeInteger(value.ruleVersion) && Array.isArray(value.evidenceRefs)
    ? { request, value } : undefined
}

function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() }
function closed(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const keys = Reflect.ownKeys(value)
  return required.every((key) => keys.includes(key)) && keys.every((key) =>
    typeof key === "string" && (required.includes(key) || optional.includes(key)) &&
    Object.getOwnPropertyDescriptor(value, key)?.enumerable && "value" in Object.getOwnPropertyDescriptor(value, key)!)
}
