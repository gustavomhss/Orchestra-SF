import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import { plannerKnownSubtotal } from "../../../src/planner-accounts.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { ChoiceRecord, CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { comparePlannerScenarios, plannerScenarioCostPresentation } from "../../../product/planner/comparison.ts"
import { createPlannerMateriality } from "../../../product/planner/materiality.ts"
import type { PlannerScenarioHost, PlannerCriteriaHost } from "../../../product/planner/scenario-comparison-port.ts"
import { classifySfMaterialChange } from "../../../product/decision-memory/materiality.ts"
import { reconcileSfSignal } from "../../../product/decision-memory/signals.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "../wp03/planner-fixture.ts"

type ResolvedScenario = Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"]

// The fixture uses real SQLite, source issuance, Planner projection, scenario comparison
// and material-change producer. Coverage classifications and the minimum-savings policy
// below are explicit fixture inputs; they are not evidence of human registry or SessionV2 wiring.
async function materialityFixture(kind: "migration" | "training") {
  const snapshot = plannerSnapshot()
  for (const [index, version] of rows(snapshot.data.versions).entries()) {
    version.closed = 0
    const service = index === 0 ? 240000 : kind === "migration" ? 165000 : 210000
    version.lines = [{ id: "service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(service / 12), a: Array(12).fill(null), f: Array(12).fill(service / 12) }]
    if (index === 1 && kind === "migration") version.lines = [...rows(version.lines), { id: "migration", sec: "opex", el: "oth", cur: "USD", b: [...Array(11).fill(0), 45000], a: Array(12).fill(null), f: [...Array(11).fill(0), 45000] }]
  }
  const fixture = await plannerFixture(snapshot)
  const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
  const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [] }
  const snapshots = new Map<string, ResolvedScenario>()
  let trainingPending = kind === "training"
  const refresh = async () => {
    for (const [reference, versionId] of [["renewal", "v0"], ["transition", "v1"]] as const) {
      const issued = await fixture.issueSource(versionId, context)
      if (issued.status !== "ok") throw new Error(`Source unavailable: ${issued.status}`)
      const source = issued.value.evidence
      const projected = await fixture.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: plannerPeriod, currency: "USD" }, context)
      if (projected.status !== "ok") throw new Error(`Planner unavailable: ${projected.status}`)
      const projection = projected.value.baseline
      const pending = reference === "transition" && trainingPending
      const entries = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => {
        if (categoryId === "training" && pending) return { status: "pending" as const, categoryId, reason: "Training is not priced" }
        const componentRefs = projection.components.filter((component) => component.id.startsWith(`${categoryId}:`)).map((component) => component.id)
        return componentRefs.length ? { status: "included" as const, categoryId, componentRefs, evidenceRefs: [source], scopeNote: "Included in the actual Planner component set" } : { status: "not-applicable" as const, categoryId, justification: "Explicitly outside this fixture's renewal scope", evidenceRefs: [source] }
      })
      const commonCoverage = { basisId: basis.id, basisVersion: basis.version, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [source] }
      const assessment: CostCoverageAssessment = pending ? { ...commonCoverage, coverageState: "pending", entries, derivedMissingCategoryIds: ["training"], issues: ["training-unpriced"] } : { ...commonCoverage, coverageState: "complete", entries: entries.filter((entry) => entry.status !== "pending"), derivedMissingCategoryIds: [], issues: [] }
      const subtotal = plannerKnownSubtotal(projection.components.map((component) => component.amount))
      const common = { id: reference, version: source.target.version, components: projection.components, currency: "USD", horizon: plannerPeriod, sourceRefs: [source], restrictions: [], knownSubtotal: subtotal }
      const result: ScenarioResult = assessment.coverageState === "complete" ? { ...common, costCoverage: assessment, comparisonStatus: "complete", total: subtotal, unresolvedConditions: [] } : { ...common, costCoverage: assessment, comparisonStatus: "conditioned", total: null, unresolvedConditions: ["training-unpriced"] }
      snapshots.set(reference, { result, coverageRef: `coverage-${reference}`, basis, projection, source })
    }
  }
  await refresh()
  const scenarios: PlannerScenarioHost = { resolve: async (reference, call) => await fixture.host.revalidate(call) && snapshots.has(reference) ? { status: "ok", value: structuredClone(snapshots.get(reference)!) } : { status: "unavailable", reason: "scenario-unavailable" } }
  const sources: PlannerSourceHost = {
    resolveForecastSource: fixture.sources.resolveForecastSource,
    resolveForecastCoverage: async (reference, call) => {
      const value = [...snapshots.values()].find((item) => item.coverageRef === reference)
      if (!value || !await fixture.host.revalidate(call)) return { status: "unavailable", reason: "coverage-unavailable" }
      const current = await fixture.sources.resolveForecastSource(value.source.refId, call)
      return current.status === "ok" && current.value.evidence.refDigest === value.source.refDigest ? { status: "ok", value: { coverageRef: reference, basis, assessment: value.result.costCoverage } } : { status: "unavailable", reason: "coverage-source-changed" }
    },
  }
  const criteria: PlannerCriteriaHost = { evaluate: async (request, call) => {
    const baseline = snapshots.get(request.baselineRef)
    const alternative = snapshots.get(request.scenarioRef)
    if (request.criterionId !== "minimum-savings" || !baseline || !alternative || !await fixture.host.revalidate(call)) return { status: "unavailable", reason: "criterion-unavailable" }
    const comparison = comparePlannerScenarios({ baselineRef: request.baselineRef, alternativeRef: request.scenarioRef, baselineCoverageRef: baseline.coverageRef, alternativeCoverageRef: alternative.coverageRef, baseline: baseline.result, alternative: alternative.result, baselineProof: baseline, alternativeProof: alternative })
    const savings = plannerScenarioCostPresentation(comparison).completeSavings
    return { status: "ok", value: { criterionId: request.criterionId, state: savings === null ? "unknown" : savings >= 20000 ? "satisfied" : "failed", reason: "Explicit minimum savings of USD 20000 for the same annual period", evidenceRefs: [baseline.source, alternative.source] } }
  } }
  const planner = createPlannerPort({ host: fixture.host, sources, scenarios, criteria })
  const compared = await planner.compareScenarios({ scenarioRefs: ["renewal", "transition"], criteria: ["minimum-savings"] }, context)
  if (compared.status !== "ok") throw new Error(`Comparison unavailable: ${compared.status}`)
  const prior = snapshots.get("transition")!
  const source = prior.result.components[0]!.sourceRefs[0]!
  const body = { id: "original-choice", alternativeId: "transition", alternativeVersion: 1, basisVersion: 1, criteria: ["minimum-savings"], values: [], evidenceRefs: [prior.source], principalRef: context.binding.principalRef, reason: "Preserved human fixture choice", at: "2026-11-13T00:00:00Z", scenario: { baseRef: prior.source.refId, operations: [], assumptions: [] }, result: structuredClone(prior.result), comparison: compared.value }
  if (compared.value.comparisonStatus === "complete" && prior.result.costCoverage.coverageState !== "complete") throw new Error("Comparison promoted incomplete fixture coverage")
  const choice: ChoiceRecord = compared.value.comparisonStatus === "complete" && prior.result.costCoverage.coverageState === "complete" ? { ...body, comparisonStatus: "complete", costCoverage: prior.result.costCoverage } : { ...body, comparisonStatus: "conditioned", costCoverage: prior.result.costCoverage }
  const choiceDigest = digestSfValue(choice)
  const selection = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, choiceId: choice.id, source, evidence: prior.source, fields: ["lines"], period: plannerPeriod, criterionId: "minimum-savings", scenarioRefs: ["renewal", "transition"] as const }
  const produce = createPlannerMateriality({ scenarios, planner, verifyBinding: async (selected, currentChoice, call) => digestSfValue(selected) === digestSfValue(selection) && digestSfValue(currentChoice) === choiceDigest && await fixture.host.revalidate(call) })
  const change = async () => {
    await fixture.persistence.transaction("planner", async (current) => {
      const version = rows(current.data.versions).find((item) => item.id === "v1")!
      if (kind === "migration") {
        const line = rows(version.lines).find((item) => item.id === "migration")!
        line.b = [...Array(11).fill(0), 70000]
        line.f = [...Array(11).fill(0), 70000]
      } else version.lines = [...rows(version.lines), { id: "training", sec: "opex", el: "oth", cur: "USD", b: [...Array(11).fill(0), 40000], a: Array(12).fill(null), f: [...Array(11).fill(0), 40000] }]
      return { commit: true, value: undefined }
    })
    trainingPending = false
    await refresh()
    return produce({ selection, choice }, context)
  }
  return { fixture, context, choice, choiceDigest, selection, produce, change }
}

for (const kind of ["migration", "training"] as const) test(`C10 ${kind} change uses current Planner calculations and preserves the original choice`, async () => {
  const prepared = await materialityFixture(kind)
  try {
    const { choice, selection } = prepared
    expect(plannerScenarioCostPresentation(choice.comparison).knownSavings).toBe(30000)
    expect(choice.result.knownSubtotal).toBe(210000)
    if (kind === "training") {
      expect(choice.comparison.comparisonStatus).toBe("conditioned")
      expect(choice.result.total).toBeNull()
    }
    const produced = await prepared.change()
    if (produced.status !== "ok") throw new Error(`Materiality producer unavailable: ${produced.status}`)
    expect(produced.value.source.id).toBe(selection.source.id)
    expect(produced.value.source.incarnation).toBe(selection.source.incarnation)
    expect(produced.value.source.version).toBeGreaterThan(selection.source.version)
    expect(produced.value.comparison.resultAfter.knownSubtotal).toBe(kind === "migration" ? 235000 : 250000)
    expect(plannerScenarioCostPresentation(produced.value.comparison.after).completeSavings).toBe(kind === "migration" ? 5000 : -10000)
    expect(produced.value.comparison.after.criterionResults).toMatchObject([{ criterionId: "minimum-savings", state: "failed" }])
    const condition = { id: "monitored-minimum", source: selection.source, fields: selection.fields, period: selection.period, criterionId: selection.criterionId, choice }
    const classified = classifySfMaterialChange(condition, produced.value)
    expect(classified.impact.state).toBe("material")
    expect(classified.signal?.originalReason).toBe(choice.reason)
    expect(classified.signal?.reason).toContain("minimum-savings")
    expect(classified.signal?.reason).toContain(`${kind}:12`)
    expect(digestSfValue(choice)).toBe(prepared.choiceDigest)
    if (!classified.signal) throw new Error("Material change did not produce a signal")
    const opened = reconcileSfSignal(undefined, { kind: "signal", signal: classified.signal })
    if (!("state" in opened) || !opened.state) throw new Error("Signal did not open")
    expect(reconcileSfSignal(opened.state, { kind: "signal", signal: classified.signal }).action).toBe("none")
    expect(classifySfMaterialChange(condition, { ...produced.value, fields: ["name"] }).impact.state).toBe("irrelevant")
    expect(classifySfMaterialChange(condition, { ...produced.value, period: { start: "2028-01-01", end: "2028-12-31" } }).impact.state).toBe("irrelevant")
    prepared.fixture.access.allowed = false
    expect((await prepared.produce({ selection, choice }, prepared.context)).status).not.toBe("ok")
  } finally { await prepared.fixture.close() }
}, 60_000)
