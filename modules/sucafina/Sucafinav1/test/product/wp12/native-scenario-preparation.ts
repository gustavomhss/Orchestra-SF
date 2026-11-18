import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

export const WP12_SCENARIO_PERIOD = { start: "2027-01-01", end: "2027-12-31" }
export const WP12_SCENARIO_OPERATIONS = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_freshness_check", "sf_scenario_compare", "sf_scenario_simulate"] as const
export const WP12_SCENARIO_HUMAN_ACTIONS = ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "decisions.coverage", "decisions.promote-alternative"] as const satisfies readonly SfHumanAction[]
const alternatives = [
  { key: "baseline", versionId: "wp12-scenario-0", service: 240_000, training: 0, title: "Baseline" },
  { key: "pending", versionId: "wp12-scenario-1", service: 210_000, training: null, title: "Candidate A" },
  { key: "complete", versionId: "wp12-scenario-2", service: 210_000, training: 40_000, title: "Candidate B" },
] as const

/** Synthetic source rows enter the ordinary Planner persistence. No scenario,
 * coverage assessment, alternative, contribution or receipt is written here. */
export async function initializeWp12ScenarioSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: alternatives.map((alternative) => ({ id: alternative.versionId, name: alternative.title,
      year: 2027, closed: 0,
      lines: RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "training" || alternative.training !== null).map((category) => {
        const amount = category === "service" ? alternative.service : category === "training" ? alternative.training : 0
        const months = [amount, ...Array<number>(11).fill(0)]
        return { id: `wp12-cost-${category}`, name: `Explicit synthetic ${category}`, ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD",
          b: months, a: Array<null>(12).fill(null), f: [...months] }
      }),
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
      officials: { "2027": "wp12-scenario-0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

/** Real human coverage classifications and promotions produce the C09/C10
 * inputs shared by native scenario, reviewer and missing-information missions. */
export async function prepareWp12ScenarioCase(context: Wp12NativeMissionContext, options: { objective?: string } = {}) {
  const productHttp = context.services.productHttp
  if (!productHttp) throw new Error("Scenario preparation requires the host's real product routes")
  const sources = await context.ui("sf_case_draft", { purpose: "native-scenario-source-inventory" }, async (call) => {
    const values = []
    for (const alternative of alternatives) {
      const issued = await context.business.plannerProduct.issueSource(alternative.versionId, call)
      if (issued.status !== "ok") throw new Error(`Scenario source issuance failed: ${issued.reason}`)
      values.push({ ...alternative, evidence: issued.value.evidence })
    }
    return values
  })
  const draft = { objective: options.objective ?? "Compare current authorized renewal alternatives using the Planner results and their cost coverage.",
    horizon: WP12_SCENARIO_PERIOD, currency: "USD", criteria: ["Compare total cost only with complete category coverage"],
    sourceRefs: sources.map((source) => source.evidence) }
  const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (created.status !== "ok") throw new Error(`Scenario case creation failed: ${created.reason}`)
  let caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
  const basis: CostCoverageBasis = { id: `wp12-renewal-inventory:${caseRef.id}`, version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: draft.sourceRefs }
  const before = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
  const promoted: { key: typeof alternatives[number]["key"]; resultRef: string; coverageRef: string }[] = []
  for (const source of sources) {
    const projection = await context.ui("sf_context_get", { sourceRef: source.evidence.refId }, (call) =>
      context.business.projectPlannerEvidence(source.evidence, call, { period: WP12_SCENARIO_PERIOD, currency: "USD" }))
    if (projection.status !== "ok") throw new Error(`Scenario source projection failed: ${projection.reason}`)
    const entries = RENEWAL_TRANSITION_CATEGORIES.flatMap((category): CostCoverageEntry[] => {
      const components = projection.value.components.filter((component) => component.id.startsWith(`wp12-cost-${category}:`))
      if (category === "training" && source.training === null) {
        expect(components).toHaveLength(0)
        // The declared inventory contains this category, but neither a source
        // row nor a classification entry supplies it. C10 must derive the gap.
        return []
      }
      expect(components).toHaveLength(12)
      expect(components.every((component) => component.currency === "USD" && component.amount !== null && component.evidenceState === "confirmed")).toBe(true)
      return [{ categoryId: category, status: "included", componentRefs: components.map((component) => component.id), evidenceRefs: [source.evidence],
        scopeNote: `Human classification of the twelve observed ${category} amounts, including explicit zero amounts, for the selected source.` }]
    })
    if (source.key === "pending") expect(entries.some((entry) => entry.categoryId === "training")).toBe(false)
    const coveragePayload = { caseRef, source: source.evidence, basis, entries, expectedVersion: 0 }
    const coverageResponse = await productHttp(context.request(coveragePayload, "/sucafina/planner?sf=baseline-coverage"), "planner")
    if (!coverageResponse) throw new Error("The baseline coverage route is missing")
    const coverage = object(await coverageResponse.json())
    const coverageValue = object(coverage.value)
    if (coverageResponse.status !== 200 || coverage.status !== "ok" || typeof coverageValue.coverageRef !== "string")
      throw new Error(`Real scenario coverage registration failed: ${String(coverage.reason)}`)
    expect(coverageValue.version).toBe(1)
    const promotion = { caseRef, title: source.title, scenario: { baseRef: source.evidence.refId, operations: [], assumptions: [] }, coverageRef: coverageValue.coverageRef }
    const promotionResponse = await productHttp(context.request(promotion, "/sucafina/planner?sf=decision-promote"), "planner")
    if (!promotionResponse) throw new Error("The real alternative promotion route is missing")
    const result = object(await promotionResponse.json())
    const value = object(result.value), next = object(value.caseRef)
    if (promotionResponse.status !== 200 || result.status !== "ok" || typeof value.resultRef !== "string" ||
      next.id !== caseRef.id || next.incarnation !== caseRef.incarnation || next.version !== caseRef.version + 1)
      throw new Error(`Real scenario promotion failed: ${String(result.reason)}`)
    caseRef = { ...caseRef, version: Number(next.version) }
    promoted.push({ key: source.key, resultRef: value.resultRef, coverageRef: coverageValue.coverageRef })
  }
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`The prepared scenario case cannot be read: ${read.reason}`)
  expect(read.value.case.alternatives).toHaveLength(3)
  const get = (key: typeof alternatives[number]["key"]) => {
    const source = sources.find((item) => item.key === key)
    const matches = read.value.case.alternatives.filter((item) => item.scenario.baseRef === source?.evidence.refId)
    if (matches.length !== 1) throw new Error(`The real ${key} alternative is not uniquely persisted`)
    return matches[0]!
  }
  const baseline = get("baseline"), pending = get("pending"), complete = get("complete")
  // Coverage describes the observed category inventory. A simulated result is
  // still a hypothetical preview, even when every category has actual evidence.
  for (const alternative of [baseline, pending, complete]) {
    expect(alternative.result.total).toBeNull()
    expect(alternative.result.comparisonStatus).toBe("conditioned")
    expect(alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
    expect(alternative.result.restrictions).toContain("preview-not-applied")
    expect(alternative.result.costCoverage.basisId).toBe(basis.id)
    expect(alternative.result.costCoverage.basisVersion).toBe(basis.version)
  }
  for (const alternative of [baseline, complete]) {
    expect(alternative.result.costCoverage.coverageState).toBe("complete")
    expect(alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
    expect(alternative.result.costCoverage.entries.map((entry) => entry.categoryId).toSorted()).toEqual([...RENEWAL_TRANSITION_CATEGORIES].sort())
    expect(alternative.result.costCoverage.entries.every((entry) => entry.status === "included")).toBe(true)
    expect(alternative.result.components).toHaveLength(RENEWAL_TRANSITION_CATEGORIES.length * 12)
    expect(alternative.result.components.every((component) => component.amount !== null && component.evidenceState === "confirmed")).toBe(true)
  }
  expect(baseline.result.knownSubtotal).toBe(240_000)
  const zeroTraining = baseline.result.components.filter((component) => component.id.startsWith("wp12-cost-training:"))
  expect(zeroTraining).toHaveLength(12)
  expect(zeroTraining.every((component) => component.amount === 0)).toBe(true)
  expect(pending.result.knownSubtotal).toBe(210_000)
  expect(pending.result.costCoverage.coverageState).toBe("pending")
  expect(pending.result.components.filter((component) => component.id.startsWith("wp12-cost-training:"))).toHaveLength(0)
  expect(pending.result.costCoverage.entries.some((entry) => entry.categoryId === "training" && entry.status === "pending" && entry.reason === "missing-category")).toBe(true)
  expect(pending.result.costCoverage.derivedMissingCategoryIds).toContain("training")
  expect(complete.result.knownSubtotal).toBe(250_000)
  const observedTraining = complete.result.components.filter((component) => component.id.startsWith("wp12-cost-training:"))
  expect(observedTraining).toHaveLength(12)
  expect(observedTraining.filter((component) => component.amount === 40_000)).toHaveLength(1)
  expect(observedTraining.filter((component) => component.amount === 0)).toHaveLength(11)
  expect(await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))).toBe(before)
  console.log("SF_WP12_NATIVE_SCENARIO_PREPARATION:" + JSON.stringify({ scope: "real-category-coverage-and-hypothetical-c09-promotions", githubSha: process.env.GITHUB_SHA ?? null,
    caseRef, basisId: basis.id, routes: ["baseline-coverage", "decision-promote"], results: promoted,
    alternatives: [baseline, pending, complete].map((item) => ({ id: item.id, version: item.version, knownSubtotal: item.result.knownSubtotal,
      total: item.result.total, comparisonStatus: item.result.comparisonStatus, coverageState: item.result.costCoverage.coverageState,
      derivedMissingCategoryIds: item.result.costCoverage.derivedMissingCategoryIds, restrictions: item.result.restrictions })),
    inferenceExecuted: false, plannerSourcesUnchanged: true, hypotheticalResultsRemainConditional: true, gnativeAccepted: false }))
  const resultRef = (key: typeof alternatives[number]["key"]) => {
    const receipt = promoted.find((item) => item.key === key)
    if (!receipt) throw new Error(`The ${key} scenario has no promotion receipt`)
    return receipt.resultRef
  }
  return { caseRef, case: read.value.case, sources, baseline, pending, complete, plannerSourceDigest: before,
    resultRefs: { baseline: resultRef("baseline"), pending: resultRef("pending"), complete: resultRef("complete") } }
}
