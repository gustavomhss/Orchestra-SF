import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

type Wp12ChoicePost = "decision-sensitivity-units" | "decision-criteria" | "decision-choose"
export type Wp12ChoiceAction = "read-current-case" | Wp12ChoicePost | "read-chosen-case"

/** Human criteria use units issued from the actual persisted Planner results.
 * This helper never inserts a rule, metric or ChoiceRecord into C08 directly. */
export async function chooseWp12Alternative(context: Wp12NativeMissionContext, input: {
  caseRef: { id: string; incarnation: string; version: number }
  baselineResultRef: string
  alternativeResultRef: string
  alternativeId: string
  alternativeVersion: number
  parameterRef: string
  criterionId: string
  threshold: number
  reason: string
}, options?: { beforeAction?: (action: Wp12ChoiceAction) => Promise<void> }) {
  const productHttp = context.services.productHttp
  if (!productHttp) throw new Error("Choice preparation requires the real product routes")
  if (options?.beforeAction) await options.beforeAction("read-current-case")
  const current = await readCaseAnalysisProjection(context.request(), context.services, input.caseRef)
  if (current.status !== "ok") throw new Error(`Choice case read failed: ${current.reason}`)
  if (!current.value.case.criteria.some((criterion) => criterion.id === input.criterionId) || !Number.isFinite(input.threshold))
    throw new Error("The human criterion must belong to the current case")
  const post = async (mode: Wp12ChoicePost, payload: unknown) => {
    if (options?.beforeAction) await options.beforeAction(mode)
    const response = await productHttp(context.request(payload, `/sucafina/planner?sf=${mode}`), "planner")
    if (!response) throw new Error(`The real ${mode} route is missing`)
    const result = object(await response.json())
    if (response.status !== 200 || result.status !== "ok") throw new Error(`Real ${mode} failed: ${String(result.reason)}`)
    return object(result.value)
  }
  const issued = await post("decision-sensitivity-units", { caseRef: input.caseRef, scenarioRef: input.alternativeResultRef,
    baselineRef: input.baselineResultRef, parameterRef: input.parameterRef })
  const fields = object(issued.units)
  const refs = decodeSfOperationInput("sf_freshness_check", { evidenceRefs: fields.sourceRefs })
  if (!refs.ok || fields.baselineRef !== input.baselineResultRef || fields.parameterRef !== input.parameterRef ||
    typeof fields.parameterUnit !== "string" || typeof fields.resultUnit !== "string" || typeof fields.engineVersion !== "string" ||
    !fields.parameterUnit || !fields.resultUnit || !fields.engineVersion || fields.resultUnit !== current.value.case.currency ||
    !refs.value.evidenceRefs.length || digestSfValue(issued.caseRef) !== digestSfValue(input.caseRef))
    throw new Error("The host did not issue current scenario units and real source references")
  const units = { baselineRef: input.baselineResultRef, parameterRef: input.parameterRef, parameterUnit: fields.parameterUnit,
    resultUnit: fields.resultUnit, engineVersion: fields.engineVersion, sourceRefs: refs.value.evidenceRefs }
  expect(digestSfValue(units)).toBe(digestSfValue(issued.units))
  const rule = await post("decision-criteria", { caseRef: input.caseRef, criterionId: input.criterionId,
    metricRef: "planner:known-subtotal-difference", operator: "lte", value: input.threshold, unit: units.resultUnit,
    period: current.value.case.horizon, evidenceRefs: units.sourceRefs, expectedRuleVersion: 0, sensitivity: units })
  if (typeof rule.ruleRef !== "string" || rule.version !== 1) throw new Error("The real criterion registry did not return its first rule")
  const chosen = await post("decision-choose", { caseRef: input.caseRef, alternativeId: input.alternativeId,
    alternativeVersion: input.alternativeVersion,
    comparison: { scenarioRefs: [input.baselineResultRef, input.alternativeResultRef], criteria: [input.criterionId] },
    criteria: [input.criterionId], reason: input.reason })
  const next = object(chosen.caseRef)
  if (next.id !== input.caseRef.id || next.incarnation !== input.caseRef.incarnation || next.version !== input.caseRef.version + 1)
    throw new Error("The real choice did not advance the selected case exactly once")
  const caseRef = { ...input.caseRef, version: Number(next.version) }
  if (options?.beforeAction) await options.beforeAction("read-chosen-case")
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`The real choice cannot be read: ${read.reason}`)
  const choices = read.value.case.choices.filter((choice) => choice.alternativeId === input.alternativeId &&
    choice.alternativeVersion === input.alternativeVersion && choice.reason === input.reason)
  if (choices.length !== 1) throw new Error("The human choice is not uniquely persisted")
  const choice = choices[0]!
  expect(choice.principalRef).toBe(context.principalRef)
  expect(choice.criteria).toEqual([input.criterionId])
  expect(choice.values).toHaveLength(1)
  expect(choice.values[0]?.unit).toBe(units.resultUnit)
  expect(choice.values[0]?.horizon).toEqual(current.value.case.horizon)
  expect(choice.comparison.baselineResultRef).toBe(input.baselineResultRef)
  expect(choice.comparison.alternativeResultRef).toBe(input.alternativeResultRef)
  expect(read.value.case.preparedChanges).toHaveLength(0)
  expect(read.value.case.receipts).toHaveLength(0)
  console.log("SF_WP12_NATIVE_CHOICE_PREPARATION:" + JSON.stringify({ scope: "real-human-criterion-and-choice",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef, choiceId: choice.id, ruleRef: rule.ruleRef,
    unitsDigest: digestSfValue(units), choiceDigest: digestSfValue(choice), comparisonStatus: choice.comparisonStatus,
    inferenceExecuted: false, domainApplied: false }))
  return { caseRef, case: read.value.case, choice, ruleRef: rule.ruleRef, units }
}
