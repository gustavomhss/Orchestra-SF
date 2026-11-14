import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"
import type { ScenarioOperation, SensitivityRequest } from "../contracts/operations.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { projectionDigest, resolvePlannerScenarioBatch } from "./scenario-comparison-port.ts"
import { comparePlannerScenarios, plannerComponentDigest } from "./comparison.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type PlannerSensitivityUnits = { baselineRef: string; parameterRef: string; parameterUnit: string; resultUnit: string; engineVersion: string; sourceRefs: readonly BusinessEvidenceRef[] }
export type PlannerSensitivityRule = { caseRef: CaseRef; ruleRef: string; criterionId: string; metricRef: string; operator: "lte" | "gte" | "eq"; value: number; unit: string; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; version: number; sensitivity?: PlannerSensitivityUnits }

/** Units come from the exact current Planner operation, sources and human-registered criterion. */
export function createPlannerSensitivityUnits(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: DecisionCasePort
  scenarios: PlannerScenarioHost
  store: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  evidence: BusinessContextService
  rules: { resolve: (request: { caseRef: CaseRef; criterionId: string }, context: TrustedDomainContext) => Promise<PortResult<PlannerSensitivityRule>> }
}) {
  const readScenario = (resultRef: string, context: TrustedDomainContext) => input.store.readHistoricalScenario ? input.store.readHistoricalScenario({ resultRef }, context) : input.store.read({ resultRef, kind: "scenario" }, context)
  const issue = async (request: { scenarioRef: string; baselineRef: string; parameterRef: string }, context: TrustedDomainContext) => {
    if (!request || typeof request.scenarioRef !== "string" || typeof request.baselineRef !== "string" || typeof request.parameterRef !== "string" || !request.scenarioRef.trim() || !request.baselineRef.trim() || request.scenarioRef === request.baselineRef || !request.parameterRef.trim()) return { status: "needs-input", reason: "invalid-sensitivity-unit-selection" } as const
    if (!input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied", reason: "sensitivity-authority-unavailable" } as const
    const [stored, baselineStored] = await Promise.all([readScenario(request.scenarioRef, context), readScenario(request.baselineRef, context)])
    if (stored.status !== "ok") return stored
    if (baselineStored.status !== "ok") return baselineStored
    if (stored.value.kind !== "scenario" || baselineStored.value.kind !== "scenario" || stored.value.caseRef.id !== baselineStored.value.caseRef.id || stored.value.caseRef.incarnation !== baselineStored.value.caseRef.incarnation) return { status: "denied", reason: "sensitivity-case-mismatch" } as const
    const current = await input.cases.read({ caseRef: encodeCaseRef(stored.value.caseRef) }, context)
    if (current.status !== "ok") return current
    const decision = current.value.case
    if (stored.value.caseRef.version > decision.version || baselineStored.value.caseRef.version > decision.version) return { status: "stale", reason: "sensitivity-case-changed" } as const
    const alternatives = decision.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === stored.value.requestDigest && digestSfValue(alternative.result) === stored.value.resultDigest)
    if (alternatives.length !== 1) return { status: "unavailable", reason: "scenario-not-current-case-alternative" } as const
    const scenario = alternatives[0]!.scenario
    const operations = scenario.operations.filter((operation) => operation.targetRef === request.parameterRef)
    const sourceOnly = scenario.operations.length === 0 && scenario.assumptions.length === 0
    if (!sourceOnly && (operations.length !== 1 || operations[0]!.kind !== "replace" || operations[0]!.replacementRef !== undefined || typeof operations[0]!.amount !== "number" || !Number.isFinite(operations[0]!.amount) || !operations[0]!.currency?.trim())) return { status: "needs-input", reason: "unsupported-sensitivity-parameter" } as const
    const [selected, baseline] = await resolvePlannerScenarioBatch(input.scenarios, [request.scenarioRef, request.baselineRef], context)
    if (selected.status !== "ok") return selected
    if (baseline.status !== "ok") return baseline
    if (!selected.value.coverageRef.trim() || !baseline.value.coverageRef.trim() || digestSfValue(selected.value.result) !== stored.value.resultDigest || digestSfValue(baseline.value.result) !== baselineStored.value.resultDigest || selected.value.source.refId !== scenario.baseRef || selected.value.result.currency !== baseline.value.result.currency || selected.value.result.currency !== decision.currency || digestSfValue(selected.value.result.horizon) !== digestSfValue(baseline.value.result.horizon) || digestSfValue(selected.value.result.horizon) !== digestSfValue(decision.horizon)) return { status: "stale", reason: "sensitivity-scope-changed" } as const
    const parameterOperation = sourceOnly ? plannerSourceParameter(selected.value, request.parameterRef) : undefined
    const operation = sourceOnly ? parameterOperation : operations[0]
    if (!operation) return { status: "needs-input", reason: "unsupported-sensitivity-parameter" } as const
    const unitData = plannerOperationUnits({ projection: selected.value.projection, source: selected.value.source, operation })
    if (!unitData || selected.value.result.currency !== unitData.resultUnit) return { status: "unavailable", reason: "sensitivity-unit-unavailable" } as const
    const refs = [...selected.value.result.sourceRefs, ...baseline.value.result.sourceRefs, ...selected.value.result.costCoverage.evaluatedSourceRefs, ...baseline.value.result.costCoverage.evaluatedSourceRefs, selected.value.source, baseline.value.source]
    const sourceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
    if (sourceRefs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return { status: "denied", reason: "sensitivity-evidence-scope-mismatch" } as const
    const resolutions = await Promise.all(sourceRefs.map((ref) => input.evidence.resolve(ref, context)))
    if (resolutions.some((resolution, index) => resolution.state !== "fresh" || resolution.ref.refDigest !== sourceRefs[index].refDigest || digestSfEvidenceRef(resolution.ref) !== resolution.ref.refDigest || resolution.accessRevision !== context.binding.accessRevision)) return { status: "stale", reason: "sensitivity-evidence-changed" } as const
    const again = await input.cases.read({ caseRef: encodeCaseRef(stored.value.caseRef) }, context)
    const [selectedAgain, baselineAgain] = await resolvePlannerScenarioBatch(input.scenarios, [request.scenarioRef, request.baselineRef], context)
    const evidenceAgain = await Promise.all(sourceRefs.map((ref) => input.evidence.resolve(ref, context)))
    const [storedAgain, baselineStoredAgain] = await Promise.all([readScenario(request.scenarioRef, context), readScenario(request.baselineRef, context)])
    if (storedAgain.status !== "ok" || baselineStoredAgain.status !== "ok" || digestSfValue(storedAgain.value) !== digestSfValue(stored.value) || digestSfValue(baselineStoredAgain.value) !== digestSfValue(baselineStored.value) || again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(decision) || selectedAgain.status !== "ok" || digestSfValue(selectedAgain.value.result) !== digestSfValue(selected.value.result) || selectedAgain.value.source.refDigest !== selected.value.source.refDigest || selectedAgain.value.coverageRef !== selected.value.coverageRef || projectionDigest(selectedAgain.value.projection) !== projectionDigest(selected.value.projection) || baselineAgain.status !== "ok" || digestSfValue(baselineAgain.value.result) !== digestSfValue(baseline.value.result) || baselineAgain.value.source.refDigest !== baseline.value.source.refDigest || baselineAgain.value.coverageRef !== baseline.value.coverageRef || projectionDigest(baselineAgain.value.projection) !== projectionDigest(baseline.value.projection) || evidenceAgain.some((resolution, index) => resolution.state !== "fresh" || resolution.ref.refDigest !== sourceRefs[index].refDigest || digestSfEvidenceRef(resolution.ref) !== resolution.ref.refDigest || resolution.accessRevision !== context.binding.accessRevision) || !await input.host.revalidate(context)) return { status: "stale", reason: "sensitivity-source-changed" } as const
    const units: PlannerSensitivityUnits = { baselineRef: request.baselineRef, parameterRef: request.parameterRef, parameterUnit: unitData.parameterUnit, resultUnit: unitData.resultUnit, engineVersion: selected.value.projection.engineVersion, sourceRefs }
    const sourceComparison = sourceOnly ? comparePlannerScenarios({ baselineRef: request.baselineRef, alternativeRef: request.scenarioRef, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: selected.value.coverageRef, baseline: baseline.value.result, alternative: selected.value.result, baselineProof: baseline.value, alternativeProof: selected.value }) : undefined
    return { status: "ok", value: { units, scenario, ...(parameterOperation ? { parameterOperation, sourceComparison, sourcePeriod: selected.value.result.horizon } : {}), scenarioCoverageRef: selected.value.coverageRef, baselineCoverageRef: baseline.value.coverageRef, caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, unitMetadataRef: selected.value.source.refId, unitMetadataVersion: selected.value.source.target.version, metadataDigest: digestSfValue({ units, scenarioCoverageRef: selected.value.coverageRef, baselineCoverageRef: baseline.value.coverageRef, operation, ...(parameterOperation ? { parameterOrigin: "current-source", sourceComparison, sourcePeriod: selected.value.result.horizon } : {}), parameterValueId: `${request.parameterRef}:forecast`, declaredCurrencyValueId: `${request.parameterRef}:currency-declared`, resultMetricRef: "planner:known-subtotal-difference", period: unitData.period, scenarioRef: request.scenarioRef, caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, requestDigest: stored.value.requestDigest, resultDigest: stored.value.resultDigest, baselineRequestDigest: baselineStored.value.requestDigest, baselineResultDigest: baselineStored.value.resultDigest }) } } as const
  }
  const resolve = async (request: SensitivityRequest, context: TrustedDomainContext) => {
    if (!decodeSfOperationInput("sf_sensitivity_evaluate", request).ok) return { status: "needs-input", reason: "invalid-sensitivity-request" } as const
    const stored = await readScenario(request.scenarioRef, context)
    if (stored.status !== "ok") return stored
    const current = await input.cases.read({ caseRef: encodeCaseRef(stored.value.caseRef) }, context)
    if (current.status !== "ok") return current
    const caseRef = { id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }
    const rule = await input.rules.resolve({ caseRef, criterionId: request.criterion.id }, context)
    if (rule.status !== "ok") return rule
    if (!rule.value.ruleRef.trim() || !rule.value.sensitivity || rule.value.metricRef !== "planner:known-subtotal-difference" || rule.value.criterionId !== request.criterion.id || rule.value.caseRef.id !== caseRef.id || rule.value.caseRef.incarnation !== caseRef.incarnation || rule.value.caseRef.version > caseRef.version || rule.value.operator !== request.criterion.operator || rule.value.value !== request.criterion.value || !Number.isSafeInteger(rule.value.version) || rule.value.version < 1 || rule.value.sensitivity.parameterRef !== request.parameterBounds.parameterRef) return { status: "needs-input", reason: "registered-sensitivity-rule-mismatch" } as const
    const issued = await issue({ scenarioRef: request.scenarioRef, baselineRef: rule.value.sensitivity.baselineRef, parameterRef: request.parameterBounds.parameterRef }, context)
    if (issued.status !== "ok") return issued
    if (digestSfValue(issued.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(issued.value.units) !== digestSfValue(rule.value.sensitivity) || rule.value.unit !== issued.value.units.resultUnit || digestSfValue(rule.value.period) !== digestSfValue(current.value.case.horizon)) return { status: "stale", reason: "registered-sensitivity-units-changed" } as const
    const refs = [...issued.value.units.sourceRefs, ...rule.value.evidenceRefs]
    const evidenceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
    if (evidenceRefs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return { status: "denied", reason: "sensitivity-evidence-scope-mismatch" } as const
    const resolutions = await Promise.all(evidenceRefs.map((ref) => input.evidence.resolve(ref, context)))
    if (resolutions.some((resolution, index) => resolution.state !== "fresh" || resolution.ref.refDigest !== evidenceRefs[index].refDigest || digestSfEvidenceRef(resolution.ref) !== resolution.ref.refDigest || resolution.accessRevision !== context.binding.accessRevision)) return { status: "stale", reason: "sensitivity-evidence-changed" } as const
    const againEvidence = await Promise.all(evidenceRefs.map((ref) => input.evidence.resolve(ref, context)))
    const again = await input.rules.resolve({ caseRef, criterionId: request.criterion.id }, context)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule.value) || againEvidence.some((resolution, index) => resolution.state !== "fresh" || resolution.ref.refDigest !== evidenceRefs[index].refDigest || digestSfEvidenceRef(resolution.ref) !== resolution.ref.refDigest || resolution.accessRevision !== context.binding.accessRevision) || !await input.host.revalidate(context)) return { status: "stale", reason: "sensitivity-rule-changed" } as const
    return { status: "ok", value: { caseRef, scenario: issued.value.scenario, ...(issued.value.parameterOperation ? { parameterOperation: issued.value.parameterOperation } : {}), scenarioCoverageRef: issued.value.scenarioCoverageRef, baselineCoverageRef: issued.value.baselineCoverageRef, baselineRef: issued.value.units.baselineRef, criterionId: rule.value.criterionId, metric: "alternative-minus-baseline-known-subtotal" as const, parameterUnit: issued.value.units.parameterUnit, resultUnit: issued.value.units.resultUnit, unit: issued.value.units.resultUnit, unitMetadataRef: issued.value.unitMetadataRef, unitMetadataVersion: issued.value.unitMetadataVersion, engineVersion: issued.value.units.engineVersion, evidenceRefs, metadataDigest: issued.value.metadataDigest, ruleRef: rule.value.ruleRef, ruleVersion: rule.value.version, ruleDigest: digestSfValue(rule.value), sensitivityRequest: structuredClone(request) } } as const
  }
  return { issue, resolve, revalidate: async (binding: { sensitivityRequest: SensitivityRequest }, context: TrustedDomainContext) => { const current = await resolve(binding.sensitivityRequest, context); return current.status === "ok" && digestSfValue(current.value) === digestSfValue(binding) } }
}

/** A source observation can vary only an existing confirmed USD forecast value. */
function plannerSourceParameter(value: Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"], target: string): ScenarioOperation | undefined {
  if (!value.result.id.startsWith("source-scenario:") || target.startsWith("HR:") || value.result.currency !== "USD" || plannerComponentDigest(value.result.components) !== plannerComponentDigest(value.projection.components)) return undefined
  const amounts = value.projection.values.filter((item) => item.id === `${target}:forecast` && item.granularity === "month")
  const components = value.projection.components.filter((item) => item.id === target)
  const amount = amounts[0]
  if (amounts.length !== 1 || components.length !== 1 || !amount || amount.currency !== "USD" || amount.evidenceState !== "confirmed" || typeof amount.value !== "number" || !Number.isFinite(amount.value) || components[0]!.amount !== amount.value || components[0]!.evidenceState !== "confirmed" || !amount.sourceRefs.some((ref) => ref.refDigest === value.source.refDigest)) return undefined
  return { kind: "replace", targetRef: target, amount: amount.value, currency: "USD", period: amount.period }
}

/** Verify that operation and result units are independently declared by the current Planner source. */
export function plannerOperationUnits(input: { projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }>; operation: ScenarioOperation }) {
  if (input.operation.kind !== "replace" || input.operation.replacementRef !== undefined || typeof input.operation.amount !== "number" || !Number.isFinite(input.operation.amount) || input.source.target.surface !== "planner" || input.source.target.recordType !== "planner-version" || input.source.installationId !== input.projection.context.installationId || input.source.projectId !== input.projection.context.projectId || !input.projection.context.sourceRefs.some((ref) => ref.surface === "planner" && ref.id === input.source.target.recordId && ref.incarnation === input.source.target.incarnation && ref.version === input.source.target.version)) return undefined
  const amounts = input.projection.values.filter((value) => value.id === `${input.operation.targetRef}:forecast` && value.granularity === "month")
  const currencies = input.projection.values.filter((value) => value.id === `${input.operation.targetRef}:currency-declared` && value.granularity === "month")
  const amount = amounts[0]
  const currency = currencies[0]
  if (amounts.length !== 1 || currencies.length !== 1 || !amount || !currency || currency.evidenceState !== "confirmed" || typeof currency.value !== "string" || !currency.value.trim() || amount.currency !== currency.value || input.operation.currency !== currency.value || digestSfValue(amount.period) !== digestSfValue(currency.period) || input.operation.period !== undefined && digestSfValue(input.operation.period) !== digestSfValue(amount.period) || !input.source.target.period || input.source.target.period.start > amount.period.start || input.source.target.period.end < amount.period.end || !amount.sourceRefs.some((ref) => ref.refDigest === input.source.refDigest) || !currency.sourceRefs.some((ref) => ref.refDigest === input.source.refDigest) || !input.projection.engineVersion.trim() || !input.projection.components.length || input.projection.components.some((component) => component.currency !== input.projection.context.currency) || !input.projection.context.currency.trim()) return undefined
  return { parameterUnit: currency.value, resultUnit: input.projection.context.currency, period: amount.period }
}
