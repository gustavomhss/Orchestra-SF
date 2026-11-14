import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

export const WP12_PORTFOLIO_PERIOD = { start: "2027-01-01", end: "2027-12-31" }
export const WP12_PORTFOLIO_OPERATIONS = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_freshness_check", "sf_source_get",
  "sf_scenario_simulate", "sf_scenario_compare", "sf_portfolio_evaluate", "sf_alternative_draft", "sf_sensitivity_evaluate"] as const
export const WP12_PORTFOLIO_HUMAN_ACTIONS = ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "decisions.coverage",
  "decisions.promote-alternative", "decisions.portfolio.read", "decisions.portfolio.evaluate", "decisions.select-portfolio",
  "decisions.criteria", "decisions.choose", "decisions.sensitivity.evaluate", "decisions.sensitivity.select", "decisions.sensitivity.selection.read",
  "decisions.alternative.select", "decisions.condition.record"] as const satisfies readonly SfHumanAction[]

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]

export function wp12PortfolioMissionRequest(context: Wp12NativeMissionContext, profileId: "sf_portfolio" | "sf_finance",
  skillId: string, caseRef: Preparation["request"]["caseRef"], objective: string) {
  const selected = context.services.selected.find((entry) => entry.profile.id === profileId)
  const skill = selected?.skills.find((entry) => entry.id === skillId)
  if (!selected || !skill) throw new Error(`The installed host did not publish ${profileId}/${skillId}`)
  return { caseRef, profileId, profileVersion: selected.profile.version, skillId, skillVersion: skill.version, objective,
    manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...skill.allowedOperations] }
}

export async function prepareWp12PortfolioMission(context: Wp12NativeMissionContext, incoming: Preparation) {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input: incoming },
    "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The real workbench analysis preparation route is missing")
  return { response, body: object(await response.json()) }
}

export async function postWp12PortfolioSelection(context: Wp12NativeMissionContext, mode: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/dashboard?sf=${mode}`), "dashboard")
  if (!response) throw new Error(`The real ${mode} route is missing`)
  const result = object(await response.json())
  if (response.status !== 200 || result.status !== "ok") throw new Error(`Real ${mode} failed: ${String(result.reason)}`)
  return object(result.value)
}

export async function wp12PreferenceVersion(context: Wp12NativeMissionContext) {
  const read = await context.services.state.read(context.request(), "preferences", () => null)
  if (read.status !== "ok") throw new Error("The real preferences version is unavailable")
  return read.storageVersion
}

/** Only source rows are synthetic. The actual Planner verifies every proposed
 * operation and produces every coverage assessment, scenario and C09 result. */
export async function initializeWp12PortfolioSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: "wp12-portfolio-source", name: "Explicit synthetic planning source", year: 2027, closed: 0,
      lines: RENEWAL_TRANSITION_CATEGORIES.map((category) => {
        const months = [category === "service" ? 240_000 : 0, ...Array<number>(11).fill(0)]
        return { id: `wp12-portfolio-${category}`, name: `Explicit synthetic ${category}`, ownerId: "wp12-source-owner",
          sec: "opex", el: "licenses", cur: "USD", b: months, a: Array<null>(12).fill(null), f: [...months] }
      }), fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "wp12-portfolio-source" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

export async function postWp12Portfolio(context: Wp12NativeMissionContext, mode: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/planner?sf=${mode}`), "planner")
  if (!response) throw new Error(`The real ${mode} route is missing`)
  const result = object(await response.json())
  if (response.status !== 200 || result.status !== "ok") throw new Error(`Real ${mode} failed: ${String(result.reason)}`)
  return object(result.value)
}

export async function prepareWp12PortfolioCase(context: Wp12NativeMissionContext, extraSources: readonly BusinessEvidenceRef[] = []) {
  const issued = await context.ui("sf_case_draft", { purpose: "native-portfolio-source" }, (call) =>
    context.business.plannerProduct.issueSource("wp12-portfolio-source", call))
  if (issued.status !== "ok") throw new Error(`Portfolio source issuance failed: ${issued.reason}`)
  const source = issued.value.evidence
  const projection = await context.ui("sf_context_get", { sourceRef: source.refId }, (call) =>
    context.business.projectPlannerEvidence(source, call, { period: WP12_PORTFOLIO_PERIOD, currency: "USD" }))
  if (projection.status !== "ok") throw new Error(`Portfolio source projection failed: ${projection.reason}`)
  const component = (category: string) => {
    const values = projection.value.components.filter((entry) => entry.id.startsWith(`wp12-portfolio-${category}:`) && entry.period.start === "2027-01-01")
    if (values.length !== 1 || values[0]!.currency !== "USD" || values[0]!.evidenceState !== "confirmed")
      throw new Error(`The actual ${category} component is not uniquely observed`)
    return values[0]!
  }
  const service = component("service"), training = component("training")
  expect(service.amount).toBe(240_000)
  expect(training.amount).toBe(0)
  const reduction: ScenarioOperation = { kind: "replace", targetRef: service.id, amount: 200_000, currency: "USD", period: service.period }
  const additionalCost: ScenarioOperation = { kind: "replace", targetRef: training.id, amount: 40_000, currency: "USD", period: training.period }
  const draft = { objective: "Assess authorized planning options, delivery conditions and a bounded portfolio using current evidence.",
    horizon: WP12_PORTFOLIO_PERIOD, currency: "USD", criteria: ["Human cost difference threshold"], sourceRefs: [source, ...extraSources] }
  const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (created.status !== "ok") throw new Error(`Portfolio case creation failed: ${created.reason}`)
  let caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
  const basis: CostCoverageBasis = { id: `wp12-portfolio-inventory:${caseRef.id}`, version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.map((category) => {
    const components = projection.value.components.filter((entry) => entry.id.startsWith(`wp12-portfolio-${category}:`))
    expect(components).toHaveLength(12)
    expect(components.every((entry) => entry.currency === "USD" && entry.amount !== null && entry.evidenceState === "confirmed")).toBe(true)
    return { categoryId: category, status: "included", componentRefs: components.map((entry) => entry.id), evidenceRefs: [source],
      scopeNote: `Human classification of twelve observed ${category} amounts, including explicit zeros, for the selected source.` }
  })
  const coverage = await postWp12Portfolio(context, "baseline-coverage", { caseRef, source, basis, entries, expectedVersion: 0 })
  if (typeof coverage.coverageRef !== "string" || coverage.version !== 1) throw new Error("Real baseline coverage registration did not return its reference")
  const coverageRef = coverage.coverageRef
  const before = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
  const definitions = [
    { key: "baseline", title: "Baseline", operations: [] },
    { key: "lowerCost", title: "Candidate A", operations: [reduction] },
    { key: "trainingChange", title: "Candidate B", operations: [additionalCost] },
    { key: "combined", title: "Candidate C", operations: [reduction, additionalCost] },
  ] as const
  const promoted: { key: typeof definitions[number]["key"]; resultRef: string; scenarioDigest: string }[] = []
  for (const definition of definitions) {
    const scenario = { baseRef: source.refId, operations: definition.operations, assumptions: [] }
    const result = await postWp12Portfolio(context, "decision-promote", { caseRef, title: definition.title, scenario, coverageRef })
    const next = object(result.caseRef)
    if (typeof result.resultRef !== "string" || next.id !== caseRef.id || next.incarnation !== caseRef.incarnation || next.version !== caseRef.version + 1)
      throw new Error("Real portfolio alternative promotion did not advance exactly once")
    caseRef = { ...caseRef, version: Number(next.version) }
    promoted.push({ key: definition.key, resultRef: result.resultRef, scenarioDigest: digestSfValue(scenario) })
  }
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`Portfolio case read failed: ${read.reason}`)
  expect(read.value.case.alternatives).toHaveLength(4)
  const get = (key: typeof definitions[number]["key"]) => {
    const receipt = promoted.find((item) => item.key === key)
    const alternatives = read.value.case.alternatives.filter((item) => digestSfValue(item.scenario) === receipt?.scenarioDigest)
    if (!receipt || alternatives.length !== 1) throw new Error(`The actual ${key} alternative is not uniquely persisted`)
    return { alternative: alternatives[0]!, resultRef: receipt.resultRef }
  }
  const baseline = get("baseline"), lowerCost = get("lowerCost"), trainingChange = get("trainingChange"), combined = get("combined")
  // The real category inventory is complete for every selected operation. Its
  // coverage does not turn a simulated result, including a no-op, into an
  // applied or complete financial result.
  for (const [value, amount, serviceAmount, trainingAmount, hypotheticalCount] of [
    [baseline, 240_000, 240_000, 0, 0],
    [lowerCost, 200_000, 200_000, 0, 1],
    [trainingChange, 280_000, 240_000, 40_000, 1],
    [combined, 240_000, 200_000, 40_000, 2],
  ] as const) {
    const result = value.alternative.result
    expect(result.knownSubtotal).toBe(amount)
    expect(result.total).toBeNull()
    expect(result.comparisonStatus).toBe("conditioned")
    expect(result.unresolvedConditions).toContain("scenario-is-hypothetical")
    expect(result.restrictions).toContain("preview-not-applied")
    expect(result.costCoverage.basisId).toBe(basis.id)
    expect(result.costCoverage.basisVersion).toBe(basis.version)
    expect(result.costCoverage.alternativeId).toBe(value.alternative.id)
    expect(result.costCoverage.alternativeVersion).toBe(value.alternative.version)
    expect(result.costCoverage.coverageState).toBe("complete")
    expect(result.costCoverage.derivedMissingCategoryIds).toEqual([])
    expect(result.costCoverage.issues).toEqual([])
    expect(result.costCoverage.entries.map((entry) => entry.categoryId).toSorted()).toEqual([...RENEWAL_TRANSITION_CATEGORIES].sort())
    expect(result.costCoverage.entries.every((entry) => entry.status === "included")).toBe(true)
    expect(result.components).toHaveLength(RENEWAL_TRANSITION_CATEGORIES.length * 12)
    expect(result.components.every((entry) => entry.amount !== null && Number.isFinite(entry.amount) && entry.currency === "USD")).toBe(true)
    expect(result.components.filter((entry) => entry.evidenceState === "hypothetical")).toHaveLength(hypotheticalCount)
    expect(result.components.filter((entry) => entry.evidenceState === "confirmed")).toHaveLength(RENEWAL_TRANSITION_CATEGORIES.length * 12 - hypotheticalCount)
    const serviceComponent = result.components.find((entry) => entry.id === service.id)
    const trainingComponent = result.components.find((entry) => entry.id === training.id)
    if (!serviceComponent || !trainingComponent) throw new Error("The simulated result lost an explicitly selected source component")
    expect(serviceComponent.amount).toBe(serviceAmount)
    expect(trainingComponent.amount).toBe(trainingAmount)
    expect(serviceComponent.evidenceState).toBe(serviceAmount === service.amount ? "confirmed" : "hypothetical")
    expect(trainingComponent.evidenceState).toBe(trainingAmount === training.amount ? "confirmed" : "hypothetical")
  }
  for (const value of [lowerCost, trainingChange, combined]) {
    expect(value.alternative.result.components.some((entry) => entry.evidenceState === "hypothetical")).toBe(true)
  }
  expect(await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))).toBe(before)
  console.log("SF_WP12_NATIVE_PORTFOLIO_PREPARATION:" + JSON.stringify({ scope: "real-planner-operations-and-c09-promotions",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef, sourceRef: source.refId, coverageRef, results: promoted,
    operations: [reduction, additionalCost],
    alternatives: [baseline, lowerCost, trainingChange, combined].map(({ alternative }) => ({ id: alternative.id,
      knownSubtotal: alternative.result.knownSubtotal, total: alternative.result.total, comparisonStatus: alternative.result.comparisonStatus,
      coverageState: alternative.result.costCoverage.coverageState, hypotheticalComponents: alternative.result.components.filter((entry) => entry.evidenceState === "hypothetical").length })),
    inferenceExecuted: false, domainSourcesUnchanged: true, hypotheticalResultsRemainConditional: true, gnativeAccepted: false }))
  return { caseRef, case: read.value.case, source, coverageRef, baseline, lowerCost, trainingChange, combined,
    parameterRef: service.id, operations: { reduction, additionalCost } }
}
