import { randomUUID } from "node:crypto"
import type { BusinessEvidenceRef } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/business-context"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import type { DecisionCase } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import { waveThreeData } from "./wave-three-data"
import { waveFourDecisionsData } from "./wave-four-decisions-data"

type Installed = { request(pathname: string, init?: RequestInit): Promise<Response> }
type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Canonical Decisions seed expected an object")
  return value as Record<string, unknown>
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Canonical Decisions seed omitted a reference")
  return value
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Canonical Decisions seed expected a source list")
  return value
}
function route(mode: string, parameters: Record<string, string> = {}) {
  return "/dashboard?" + new URLSearchParams({ sf: mode, ...parameters })
}
async function responseBody(response: Response, mode: string) {
  try {
    const body = object(await response.json())
    if (response.status !== 200 || body.status !== "ok")
      throw new Error("Canonical Decisions seed rejected " + mode + " (" + response.status + "): " + String(body.reason ?? body.status))
    return body
  } catch (error: unknown) {
    // Emit before the native process scope closes; do not print bodies, cookies or credentials.
    console.error("Canonical Decisions seed response failed: " + mode + " HTTP " + response.status + " " +
      (error instanceof Error ? error.message : "unclassified response"))
    throw error
  }
}

/**
 * Post-start hook. Every case, assumption, coverage basis, alternative and choice
 * is accepted by the original installed HTTP boundary and its CAS/idempotency.
 * Planner inputs are read through BI01. Nothing patches a projection, grant,
 * native binding, archived source or application receipt.
 */
export async function seedWaveFourDecisions(installed: Installed, year: number): Promise<void> {
  const horizon = { start: year + "-01-01", end: year + "-12-31" }
  const currency = "USD"
  const request = async (mode: string, parameters: Record<string, string> = {}, init?: RequestInit) => {
    process.stdout.write("SF_DESIGN_STAGE decisions-request-" + mode + "\n")
    try {
      const response = await installed.request(route(mode, parameters), init)
      process.stdout.write("SF_DESIGN_STAGE decisions-response-" + mode + "\n")
      return response
    } catch (error: unknown) {
      console.error("Canonical Decisions seed transport failed: " + mode + " " +
        (error instanceof Error ? error.name : "unclassified transport"))
      throw error
    }
  }
  const get = async (mode: string, parameters: Record<string, string>) =>
    responseBody(await request(mode, parameters), mode)
  const post = async (mode: string, input: unknown) =>
    responseBody(await request(mode, {}, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(input),
    }), mode)
  const create = async (objective: string) => {
    const result = await post("workbench-command", { operation: "sf_case_draft",
      input: { objective, horizon, currency, criteria: [waveFourDecisionsData.criterion], sourceRefs: [] } })
    return text(result.outputRef)
  }
  const controls = async (reference: string) => {
    const selected = object(object((await get("decision-controls", { case: reference, format: "json" })).value).selected)
    const decision = selected.decision as DecisionCase
    const caseRef = selected.caseRef as CaseRef
    if (decision.id !== caseRef.id || decision.incarnation !== caseRef.incarnation || decision.version !== caseRef.version)
      throw new Error("Canonical Decisions seed received a mismatched case")
    return { decision, caseRef }
  }

  const parameters = { viewId: "BI01", ...horizon }
  const options = object((await get("bi-options", parameters)).value)
  const versions = list(options.versions).map(object)
  const sources: RecordEvidence[] = []
  const titles = [waveThreeData.planner.version, waveThreeData.planner.comparison]
  for (const title of titles) {
    const version = versions.find((entry) => typeof entry.label === "string" && entry.label.startsWith(title + " ("))
    if (!version) throw new Error("Canonical Decisions seed cannot find the installed Planner version " + title)
    const ref = text(version.ref)
    const reply = await request("bi-data", { ...parameters, baseRef: ref, candidateRef: ref, currency })
    if (reply.status !== 200) throw new Error("Canonical Decisions seed could not read Planner BI evidence")
    const projection = object(object(await reply.json()).projection)
    const evidence = list(projection.values).map(object).flatMap((value) =>
      [...list(value.sourceRefs), value.drilldown].filter(Boolean) as BusinessEvidenceRef[])
    const source = evidence.find((entry): entry is RecordEvidence => entry.kind === "record" && entry.refId === ref &&
      entry.target.surface === "planner" && entry.target.recordType === "planner-version")
    if (!source) throw new Error("Canonical Decisions seed received no emitted Planner source")
    sources.push(source)
  }
  if (sources.length !== 2 || sources[0]!.refId === sources[1]!.refId)
    throw new Error("Canonical Decisions seed requires two distinct source versions")

  const editable = await create(waveFourDecisionsData.editableObjective)
  const editableCase = await controls(editable)
  await post("decision-edit", { caseRef: editableCase.caseRef, objective: waveFourDecisionsData.editableObjective,
    horizon, currency, criteria: editableCase.decision.criteria, sourceRefs: sources })

  const reference = await create(waveFourDecisionsData.objective)
  const draft = await controls(reference)
  const edited = await post("decision-edit", { caseRef: draft.caseRef, objective: waveFourDecisionsData.objective,
    horizon, currency, criteria: draft.decision.criteria, sourceRefs: sources,
    assumptions: [
      { id: randomUUID(), text: waveFourDecisionsData.assumption, state: "open", evidenceRefs: [sources[0]!] },
      { id: randomUUID(), text: waveFourDecisionsData.secondAssumption, state: "open", evidenceRefs: [sources[1]!] },
    ],
  })
  let caseRef = object(edited.value).caseRef as CaseRef
  const basis = { id: "human-cost-inventory:" + randomUUID(), version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: sources }
  const entries = basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: waveFourDecisionsData.pending }))
  for (const [index, source] of sources.entries()) {
    const coverage = await post("decision-coverage", { caseRef, source, basis, entries, expectedVersion: 0 })
    const coverageRef = text(object(coverage.value).coverageRef)
    const promoted = await post("decision-promote", { caseRef, coverageRef, title: titles[index],
      scenario: { baseRef: source.refId, operations: [], assumptions: [] } })
    caseRef = object(promoted.value).caseRef as CaseRef
  }
  const comparedCase = await controls(reference)
  const criteria = comparedCase.decision.criteria.map((entry) => entry.id)
  const alternatives = sources.map((source) => comparedCase.decision.alternatives.find((entry) => entry.scenario.baseRef === source.refId))
  if (criteria.length !== 1 || alternatives.some((entry) => !entry))
    throw new Error("Canonical Decisions seed did not reopen the accepted alternatives")
  await post("decision-criteria", { caseRef, criterionId: criteria[0], metricRef: "planner:known-subtotal-difference",
    operator: "lte", value: 2000, unit: currency, period: horizon, evidenceRefs: sources, expectedRuleVersion: 0 })
  const compared = object((await post("decision-compare", { caseRef, baselineAlternativeId: alternatives[0]!.id,
    alternativeId: alternatives[1]!.id, criteria })).value)
  const comparison = object(compared.comparison)
  if (comparison.comparisonStatus !== "conditioned" || comparison.completeDifference !== null)
    throw new Error("Canonical Decisions seed unexpectedly reported complete cost coverage")
  await post("decision-choose", { caseRef, alternativeId: alternatives[1]!.id, alternativeVersion: alternatives[1]!.version,
    comparison: compared.request, criteria, reason: waveFourDecisionsData.choiceReason })
  const recorded = await controls(reference)
  if (recorded.decision.choices.length !== 1 || recorded.decision.alternatives.length !== 2 ||
      recorded.decision.assumptions.some((entry) => entry.state !== "open") || recorded.decision.receipts.length !== 0)
    throw new Error("Canonical Decisions seed did not preserve the recorded uncertainty")
}
