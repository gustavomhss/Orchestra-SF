import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

export const WP12_QUESTION_PERIOD = { start: "2027-01-01", end: "2027-12-31" }
export const WP12_QUESTION_PENDING_REASON = "human-awaiting-training-confirmation"
export const WP12_QUESTION_OPERATIONS = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_freshness_check", "sf_scenario_simulate", "sf_answer_read"] as const
export const WP12_QUESTION_HUMAN_ACTIONS = ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "decisions.coverage", "decisions.promote-alternative"] as const satisfies readonly SfHumanAction[]
const versionId = "wp12-question-source"

/** Raw source rows only. C09, C10, questions and native receipts are produced by
 * the installed ports. This explicit human pending entry is not a derived gap. */
export async function initializeWp12QuestionSource(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: versionId, name: "Question source", year: 2027, closed: 0,
      lines: RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "training").map((category) => {
        const months = [category === "service" ? 210_000 : 0, ...Array<number>(11).fill(0)]
        return { id: `wp12-question-${category}`, name: `Explicit synthetic ${category}`, ownerId: "wp12-source-owner",
          sec: "opex", el: "licenses", cur: "USD", b: months, a: Array<null>(12).fill(null), f: [...months] }
      }), fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": versionId }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

export async function wp12QuestionSourceDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
}

/** One source and one alternative suffice for question consumption. Optional
 * supporting records and a predecessor come from real C06 callers; a referenced
 * answer is read again through its canonical port before C10 records its ID. */
export async function prepareWp12QuestionCase(context: Wp12NativeMissionContext, options: {
  objective?: string
  support?: (source: Extract<BusinessEvidenceRef, { kind: "record" }>) => Promise<{
    evidenceRefs: readonly BusinessEvidenceRef[]
    questionRef?: string
  }>
} = {}) {
  const phase = (stage: string) => console.log("SF_WP12_FOCUSED_QUESTION_PHASE:" + JSON.stringify({ stage, at: new Date().toISOString() }))
  phase("source-start")
  const issued = await context.ui("sf_case_draft", { purpose: "focused-question-source" }, (call) => context.business.plannerProduct.issueSource(versionId, call))
  if (issued.status !== "ok" || issued.value.evidence.kind !== "record") throw new Error("The real Planner did not issue the focused question source")
  const source = issued.value.evidence
  const projection = await context.ui("sf_context_get", { sourceRef: source.refId }, (call) =>
    context.business.projectPlannerEvidence(source, call, { period: WP12_QUESTION_PERIOD, currency: "USD" }))
  if (projection.status !== "ok") throw new Error(`The question source projection failed: ${projection.reason}`)
  expect(projection.value.components.filter((component) => component.id.startsWith("wp12-question-training:"))).toHaveLength(0)
  const before = await wp12QuestionSourceDigest(context)
  phase("source-ready")
  const support = await options.support?.(source)
  if (support?.questionRef) {
    const request = { questionRef: support.questionRef }
    const answer = await context.ui("sf_answer_read", request, (call) => context.services.dispatch("sf_answer_read", request, call))
    if (answer.status !== "ok" || answer.receipt.kind !== "ui") throw new Error("The selected predecessor has no real readable answer")
    const decoded = decodeSfOperationOutput("sf_answer_read", answer.result)
    if (!decoded.ok) throw new Error("The predecessor answer did not satisfy its canonical schema")
    expect(decoded.value.questionRef).toBe(support.questionRef)
    expect(decoded.value.state).toBe("unconfirmed")
    expect(decoded.value.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source))).toBe(true)
  }
  phase("support-ready")
  const draft = { objective: options.objective ?? "Clarify the information still required for the authorized decision using current evidence.",
    horizon: WP12_QUESTION_PERIOD, currency: "USD", criteria: ["Assess the cost coverage before a human decision"],
    sourceRefs: [source, ...(support?.evidenceRefs ?? [])] }
  const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (created.status !== "ok") throw new Error(`Focused question case creation failed: ${created.reason}`)
  const initialCaseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
  const basis: CostCoverageBasis = { id: `wp12-question-inventory:${created.value.id}`, version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.map((category): CostCoverageEntry => {
    if (category === "training") return { status: "pending", categoryId: category, reason: WP12_QUESTION_PENDING_REASON,
      ...(support?.questionRef ? { questionRef: support.questionRef } : {}) }
    const components = projection.value.components.filter((component) => component.id.startsWith(`wp12-question-${category}:`))
    expect(components).toHaveLength(12)
    expect(components.every((component) => component.currency === "USD" && component.amount !== null && component.evidenceState === "confirmed")).toBe(true)
    return { categoryId: category, status: "included", componentRefs: components.map((component) => component.id), evidenceRefs: [source],
      scopeNote: `Human classification of twelve observed ${category} amounts, including explicit zeros, for the selected source.` }
  })
  const coverage = await questionProductHttp(context, "baseline-coverage", { caseRef: initialCaseRef, source, basis, entries, expectedVersion: 0 })
  if (typeof coverage.coverageRef !== "string" || coverage.version !== 1) throw new Error("Focused coverage did not return its real versioned reference")
  phase("coverage-ready")
  const promoted = await questionProductHttp(context, "decision-promote", { caseRef: initialCaseRef, title: "Candidate",
    scenario: { baseRef: source.refId, operations: [], assumptions: [] }, coverageRef: coverage.coverageRef })
  const next = object(promoted.caseRef)
  if (typeof promoted.resultRef !== "string" || next.id !== initialCaseRef.id || next.incarnation !== initialCaseRef.incarnation || next.version !== initialCaseRef.version + 1)
    throw new Error("The focused question alternative did not advance exactly once")
  const caseRef = { ...initialCaseRef, version: Number(next.version) }
  phase("promotion-ready")
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`The focused question case cannot be read: ${read.reason}`)
  expect(read.value.case.alternatives).toHaveLength(1)
  const alternative = read.value.case.alternatives[0]!
  expect(alternative.scenario.baseRef).toBe(source.refId)
  expect(alternative.result.knownSubtotal).toBe(210_000)
  expect(alternative.result.total).toBeNull()
  expect(alternative.result.comparisonStatus).toBe("conditioned")
  expect(alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
  expect(alternative.result.restrictions).toContain("preview-not-applied")
  expect(alternative.result.costCoverage.coverageState).toBe("pending")
  expect(alternative.result.costCoverage.basisId).toBe(basis.id)
  expect(alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
  expect(alternative.result.costCoverage.issues).toEqual([])
  expect(alternative.result.costCoverage.entries).toEqual(entries)
  expect(alternative.result.components).toHaveLength((RENEWAL_TRANSITION_CATEGORIES.length - 1) * 12)
  expect(alternative.result.components.every((component) => component.evidenceState === "confirmed" && component.amount !== null)).toBe(true)
  expect(alternative.result.components.filter((component) => component.id.startsWith("wp12-question-training:"))).toHaveLength(0)
  expect(await wp12QuestionSourceDigest(context)).toBe(before)
  console.log("SF_WP12_FOCUSED_QUESTION_PREPARATION:" + JSON.stringify({ scope: "one-real-alternative-with-explicit-human-pending-coverage",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef, sourceRef: source.refId, alternativeId: alternative.id,
    resultRef: promoted.resultRef, coverageRef: coverage.coverageRef, pendingReason: WP12_QUESTION_PENDING_REASON,
    questionRef: support?.questionRef ?? null, plannerSourceCount: 1, alternativeCount: 1,
    derivedMissingCategoryIds: alternative.result.costCoverage.derivedMissingCategoryIds,
    conditionOrigin: "human-classification", derivedOmissionProof: false, total: alternative.result.total,
    inferenceExecuted: false, gnativeAccepted: false }))
  return { caseRef, case: read.value.case, source, alternative, resultRef: promoted.resultRef, coverageRef: coverage.coverageRef,
    questionRef: support?.questionRef, plannerSourceDigest: before }
}

async function questionProductHttp(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/planner?sf=${route}`), "planner")
  if (!response) throw new Error(`The installed question preparation requires ${route}`)
  const result = object(await response.json())
  if (response.status !== 200 || result.status !== "ok") throw new Error(`Real focused ${route} failed: ${String(result.reason)}`)
  return object(result.value)
}
