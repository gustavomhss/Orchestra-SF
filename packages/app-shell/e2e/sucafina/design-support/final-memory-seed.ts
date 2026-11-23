import { randomUUID } from "node:crypto"
import type { BusinessEvidenceRef } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/business-context"
import type { DomainProjection } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import type { DecisionCase } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import { plannerMonthlyPrefix } from "../../../../../modules/sucafina/Sucafinav1/product/planner/bi"
import { createFinalMemoryInventory, finalMemoryCoverage } from "./final-memory-inventory"

type Installed = { actorId: string; request(pathname: string, init?: RequestInit): Promise<Response> }
type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export const finalMemoryData = {
  objective: "Design test data · January itemized renewal and observed result",
  criterion: "Keep the complete January cost difference within USD 200",
  condition: "January service commitment · authorized Planner observation",
  reason: "Record the January comparison using separately priced, confirmed costs in every required inventory category.",
} as const

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Final memory seed expected an object")
  return value as Record<string, unknown>
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Final memory seed omitted a source reference")
  return value
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Final memory seed expected a list")
  return value
}

/**
 * Original human HTTP boundary after enrollment. All identities, versions,
 * scenario results, evidence and observations come from the installed producer.
 * This never writes product state, Atlas, grants, responses or a receipt.
 */
export async function seedFinalMemory(installed: Installed, year: number) {
  const period = { start: year + "-01-01", end: year + "-01-31" }
  const currency = "USD"
  const request = async (mode: string, parameters: Record<string, string> = {}, init?: RequestInit) => {
    console.info("SF_FINAL_MEMORY_STAGE " + mode)
    const response = await installed.request("/dashboard?" + new URLSearchParams({ sf: mode, ...parameters }), init)
    const body = object(await response.json())
    if (response.status !== 200 || (mode === "bi-data" ? !body.projection : !["ok", "comparable"].includes(String(body.status))))
      throw new Error("Final memory source rejected " + mode + " (HTTP " + response.status + "): " + String(body.reason ?? body.status))
    return body
  }
  const post = (mode: string, input: unknown) => request(mode, {}, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify(input),
  })
  const controls = async (reference: string) => {
    const selected = object(object((await request("decision-controls", { case: reference, format: "json" })).value).selected)
    const decision = selected.decision as DecisionCase
    const caseRef = selected.caseRef as CaseRef
    if (decision.id !== caseRef.id || decision.incarnation !== caseRef.incarnation || decision.version !== caseRef.version)
      throw new Error("Final memory seed received mismatched original case controls")
    return { decision, caseRef }
  }
  const inventories = await createFinalMemoryInventory(installed, year)
  const parameters = { viewId: "BI01", ...period }
  const options = object((await request("bi-options", parameters)).value)
  const versions = list(options.versions).map(object)
  const sources: RecordEvidence[] = []
  const projections: DomainProjection[] = []
  const titles = inventories.map((inventory) => inventory.title)
  for (const title of titles) {
    const version = versions.find((entry) => typeof entry.label === "string" && entry.label.startsWith(title + " ("))
    if (!version) throw new Error("Final memory seed cannot find the canonical Planner version")
    const ref = text(version.ref)
    const body = await request("bi-data", { ...parameters, baseRef: ref, candidateRef: ref, currency })
    const projection = body.projection as DomainProjection
    const evidence = projection.values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])])
    const source = evidence.find((entry): entry is RecordEvidence => entry.kind === "record" && entry.refId === ref &&
      entry.target.surface === "planner" && entry.target.recordType === "planner-version")
    if (!source) throw new Error("Final memory seed received no original Planner evidence")
    sources.push(source)
    projections.push(projection)
  }
  const first = sources[0]
  const source = sources[1]
  const projection = projections[1]
  if (!first || !source || !projection || first.refId === source.refId)
    throw new Error("Final memory seed requires two distinct original Planner sources")
  const created = await post("workbench-command", { operation: "sf_case_draft", input: {
    objective: finalMemoryData.objective, horizon: period, currency, criteria: [finalMemoryData.criterion], sourceRefs: [],
  } })
  const reference = text(created.outputRef)
  const draft = await controls(reference)
  const edited = await post("decision-edit", { caseRef: draft.caseRef, objective: finalMemoryData.objective,
    horizon: period, currency, criteria: draft.decision.criteria, sourceRefs: sources })
  let caseRef = object(edited.value).caseRef as CaseRef
  const basis = { id: "human-memory-cost-inventory:" + randomUUID(), version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: sources }
  for (const [index, evidence] of sources.entries()) {
    const inventory = inventories[index]
    const projected = projections[index]
    if (!inventory || !projected) throw new Error("Final memory seed omitted an original cost inventory")
    const entries = finalMemoryCoverage(inventory, projected, evidence)
    const coverage = await post("decision-coverage", { caseRef, source: evidence, basis, entries, expectedVersion: 0 })
    const promoted = await post("decision-promote", { caseRef, coverageRef: text(object(coverage.value).coverageRef),
      title: titles[index], scenario: { baseRef: evidence.refId, operations: [], assumptions: [] } })
    caseRef = object(promoted.value).caseRef as CaseRef
  }
  const before = await controls(reference)
  const criterion = before.decision.criteria[0]
  const alternatives = sources.map((evidence) => before.decision.alternatives.find((entry) => entry.scenario.baseRef === evidence.refId))
  if (before.decision.criteria.length !== 1 || !criterion || !alternatives[0] || !alternatives[1])
    throw new Error("Final memory seed did not reopen the original alternatives")
  await post("decision-criteria", { caseRef, criterionId: criterion.id, metricRef: "planner:known-subtotal-difference",
    operator: "lte", value: 200, unit: currency, period, evidenceRefs: sources, expectedRuleVersion: 0 })
  const compared = object((await post("decision-compare", { caseRef, baselineAlternativeId: alternatives[0].id,
    alternativeId: alternatives[1].id, criteria: [criterion.id] })).value)
  const comparison = object(compared.comparison)
  if (comparison.comparisonStatus !== "complete" || typeof comparison.completeDifference !== "number")
    throw new Error("Final memory seed requires producer-proven complete January coverage")
  await post("decision-choose", { caseRef, alternativeId: alternatives[1].id, alternativeVersion: alternatives[1].version,
    comparison: compared.request, criteria: [criterion.id], reason: finalMemoryData.reason })
  const selected = await controls(reference)
  const choice = selected.decision.choices[0]
  if (!choice || choice.comparisonStatus !== "complete" || choice.costCoverage.coverageState !== "complete" ||
      selected.decision.choices.length !== 1 || selected.decision.receipts.length !== 0)
    throw new Error("Final memory seed did not record exactly one original choice")
  caseRef = selected.caseRef
  const observedSource = projection.context.sourceRefs.find((entry) => entry.surface === source.target.surface &&
    entry.type === source.target.recordType && entry.id === source.target.recordId && entry.incarnation === source.target.incarnation &&
    entry.version === source.target.version)
  if (!observedSource) throw new Error("Final memory seed received no original observed SourceRef")
  const fields = observedSource.fields.filter((field) => source.target.fields.includes(field))
  if (!fields.length) throw new Error("Final memory seed received no shared observed fields")
  const query = { caseId: caseRef.id, incarnation: caseRef.incarnation, version: String(caseRef.version) }
  const beforeConditions = list((await request("memory-conditions", query)).value)
  if (beforeConditions.length !== 0) throw new Error("The original choice must initially have no signal condition")
  const registerCondition = async () => {
    await post("memory-condition", { caseRef, choiceId: choice.id,
      scenarioRefs: [choice.comparison.baselineResultRef, choice.comparison.alternativeResultRef],
      source: observedSource, evidence: source, fields, period, criterionId: criterion.id,
      recipientRef: installed.actorId, destination: reference, label: finalMemoryData.condition })
    const conditions = list((await request("memory-conditions", query)).value).map(object)
    const condition = conditions.find((entry) => entry.label === finalMemoryData.condition && entry.choiceId === choice.id)
    if (conditions.length !== 1 || !condition) throw new Error("Final memory source did not reopen the recorded condition")
    return { conditionId: text(condition.conditionId) }
  }
  const observed = projection.values.filter((value) => value.evidenceState === "confirmed" &&
    typeof value.value === "number" && value.period.start === period.start && value.period.end === period.end &&
    value.id === plannerMonthlyPrefix(projection.components) + ":1:actual" && value.sourceRefs.some((ref) => ref.refDigest === source.refDigest))
  if (observed.length !== 1 || !observed[0]) throw new Error("Final memory source did not expose one closed-month actual")
  const selection = await post("memory-outcome-selection", { caseRef, choiceId: choice.id, criterionRef: criterion.id,
    valueId: observed[0].id, period, evidenceRefs: [source] })
  const selectionRef = text(selection.selectionRef)
  const outcome = await request("memory-outcome", { selectionRef })
  if (outcome.status !== "comparable" || typeof outcome.expected !== "number" ||
    outcome.observed !== observed[0].value || typeof outcome.delta !== "number")
    throw new Error("Final memory source did not produce a comparable original outcome")
  return { reference, caseRef, choiceId: choice.id, registerCondition, initialConditionCount: beforeConditions.length, period, selectionRef,
    expected: outcome.expected, observed: outcome.observed, delta: outcome.delta }
}
