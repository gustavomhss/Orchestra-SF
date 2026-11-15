import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageEntry, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { BiViewRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import { createSfBiServices } from "../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfDecisionBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { ok } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

export const trainingHorizon = { start: "2027-01-01", end: "2027-12-31" }
export type TrainingQuote = "omitted" | "confirmed" | "zero" | "null"

/** Literal source declarations, then real source issuance, human coverage,
 * HTTP promotion, canonical comparison and C08 persistence. No financial result,
 * complete coverage, binding, inverse value or stored reference is seeded.
 * Ancillary categories have an explicit zero quote; migration shares the
 * implementation price. Training is explicitly outside that price. This does
 * not impersonate a not-applicable producer, which the installed host lacks.
 */
export async function trainingFixture(deadline: ReturnType<typeof compositionTestDeadline>, training: TrainingQuote) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => value.dispose())
    return value
  })
  const { authority, business, portfolio, persistence } = fixture
  const rows = [
    [{ id: "renewal", name: "Final renewal service price including taxes", amount: 240000 },
      { id: "covered-zero", name: "Explicit zero additional overlap, implementation, migration, training, exit and internal costs", amount: 0 }],
    [{ id: "bridge", name: "Final bridge service price including taxes", amount: 60000 },
      { id: "implementation", name: "Final implementation and migration price including taxes, excluding training", amount: 45000 },
      { id: "new-service", name: "Final new service price including taxes", amount: 105000 },
      { id: "covered-zero", name: "Explicit zero contract exit, internal and other relevant costs", amount: 0 },
      ...(training === "omitted" ? [] : [{ id: "training", name: "Separately priced training", amount: training === "confirmed" ? 40000 : training === "zero" ? 0 : null }])],
  ]
  const monthly = (amount: number | null) => Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = rows.map((lines, index) => ({ id: `installed-training-${index}-${training}`,
      name: index ? `Transition: training ${training}` : "Renewal quote", year: 2027, closed: 0,
      lines: lines.map((line) => ({ id: line.id, name: line.name, sec: "opex", el: "licenses", cur: "USD",
        b: monthly(line.amount), a: Array(12).fill(null), f: monthly(line.amount) })),
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: {}, suppliers: [], settings: { currency: "USD" } }
    return { commit: true, value: undefined }
  })
  await persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => authority.ui.finish(call))
  const sources: BaselineCoverageRequest["source"][] = []
  const forecasts: Awaited<ReturnType<typeof business.planner.compareForecast>>[] = []
  for (const index of [0, 1]) {
    const issued = ok(await deadline.phase(`source.${index}`, () => business.plannerProduct.issueSource(`installed-training-${index}-${training}`, call)), "Issue training source")
    sources.push(issued.evidence)
    forecasts.push(await deadline.phase(`forecast.${index}`, () => business.planner.compareForecast({
      baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period: trainingHorizon, currency: "USD",
    }, call)))
  }
  const initialRef = { id: "installed-training-case", incarnation: `installed-training-${training}`, version: 1 }
  const basis: BaselineCoverageRequest["basis"] = { id: "installed-training-renewal", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
  const initial: DecisionCase = { ...initialRef, state: "draft", objective: "Compare declared renewal and transition quotes", horizon: trainingHorizon, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: sources, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(fixture.request("training-empty-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "training-empty-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty training case: ${JSON.stringify(seeded)}`)
  const coverageRequests: BaselineCoverageRequest[] = []
  const coverageRefs: string[] = []
  for (const [index, source] of sources.entries()) {
    const forecast = ok(forecasts[index]!, "Training source forecast")
    const componentRefs = (line: string) => forecast.baseline.components.filter((component) => component.id.startsWith(`${line}:`)).map((component) => component.id)
    const entries = RENEWAL_TRANSITION_CATEGORIES.flatMap((categoryId): CostCoverageEntry[] => {
      if (index === 1 && categoryId === "training" && training === "omitted") return []
      if (index === 1 && categoryId === "training" && training === "null")
        return [{ categoryId, status: "pending", reason: "missing-value-and-evidence" }]
      const line = index === 0 ? categoryId === "service" || categoryId === "taxes" ? "renewal" : "covered-zero"
        : categoryId === "service" ? "new-service" : categoryId === "service_overlap" ? "bridge"
          : categoryId === "implementation" || categoryId === "migration" ? "implementation"
            : categoryId === "training" ? "training" : "covered-zero"
      return [{ categoryId, status: "included", componentRefs: categoryId === "taxes" && index === 1
        ? forecast.baseline.components.filter((component) => training !== "null" || !component.id.startsWith("training:")).map((component) => component.id)
        : componentRefs(line), evidenceRefs: [source],
        scopeNote: categoryId === "taxes" ? "All supplied prices are final including taxes; no second monetary contribution"
          : categoryId === "migration" && index === 1 ? "Migration shares the implementation component, whose price excludes training"
            : line === "covered-zero" ? "The separate source quote explicitly confirms zero additional charges for this category"
              : `Human classification of the explicit ${line} quote` }]
    })
    const coverage: BaselineCoverageRequest = { caseRef: initialRef, source, basis, expectedVersion: 0, entries }
    coverageRequests.push(coverage)
    const human = ok(await authority.human.admit(fixture.request(`training-coverage-${index}`), "decisions.coverage", coverage), "Admit training coverage")
    try {
      const registered = ok(await deadline.phase(`coverage.${index}`, () => business.withCase(human, initialRef, {}, () =>
        business.baselineCoverage.register(coverage, human))), "Register training coverage")
      coverageRefs.push(registered.coverageRef)
    } finally { authority.human.finish(human) }
  }
  const scenarios: ScenarioRequest[] = sources.map((source) => ({ baseRef: source.refId, operations: [], assumptions: [] }))
  const mutationHttp = portfolio.http({ origin: "https://example.test", mount: "/product" })
  const promote = async (index: number, caseRef: typeof initialRef) => {
    const payload = { caseRef, title: index ? `Transition with ${training} training` : "Renewal", scenario: scenarios[index]!, coverageRef: coverageRefs[index]! }
    const response = await deadline.phase(`promotion.${index}`, () => mutationHttp(new Request("https://example.test/product/planner?sf=decision-promote", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": `training-promote-${index}` }, body: JSON.stringify(payload),
    }), "planner"))
    if (response?.status !== 200) throw new Error(`Training promotion ${index}: ${response?.status} ${response ? await response.text() : "no response"}`)
    const receipt = ok(await response.json() as PortResult<{ caseRef: typeof initialRef; resultRef?: string }>, "Persist training scenario")
    if (!receipt.resultRef) throw new Error("Training promotion did not persist its scenario")
    return { caseRef: receipt.caseRef, resultRef: receipt.resultRef }
  }
  const baseline = await promote(0, initialRef)
  const candidate = await promote(1, baseline.caseRef)
  const snapshot = await authority.state.read(fixture.request(), "cases", (state) => state.cases[initialRef.id])
  if (snapshot.status !== "ok" || !snapshot.value || snapshot.value.alternatives.length !== 2) throw new Error("Training alternatives unavailable")
  const caseValue = snapshot.value
  const compare = (inverse: boolean) => deadline.phase(inverse ? "advantage.persist" : "comparison.persist", () => business.withCase(call, candidate.caseRef, {}, async () => {
    const selected = await portfolio.compare({ caseRef: candidate.caseRef, baselineAlternativeId: caseValue.alternatives[inverse ? 1 : 0]!.id,
      alternativeId: caseValue.alternatives[inverse ? 0 : 1]!.id, criteria: [] }, call)
    if (selected.status !== "ok") return selected
    return business.calculations.persist({ kind: "comparison", request: selected.value.request, result: selected.value.comparison },
      inverse ? "training-advantage-comparison" : "training-direct-comparison", call)
  }))
  const comparison = ok(await compare(false), "Persist canonical direct comparison")
  const advantage = ok(await compare(true), "Persist canonical inverse comparison")
  const selectionRef = sfDecisionBiSelection({ scenarioResultRef: candidate.resultRef, comparisonRef: comparison.resultRef, advantageComparisonRef: advantage.resultRef })
  const bi = createSfBiServices({ authority, business, portfolio })
  const dispatch = async (viewId = "BI09", selected = selectionRef) => {
    const request: BiViewRequest = { viewId, selectionRef: selected, period: trainingHorizon }
    const context = ok(await authority.ui.admit(fixture.request(), "sf_bi_view", digestSfValue(request)), "Admit training BI")
    try { return await bi.dispatchPresentation(request, context) }
    finally { authority.ui.finish(context) }
  }
  return { ...fixture, call, sources, basis, coverageRequests, coverageRefs, caseRef: candidate.caseRef, caseValue,
    baseline, candidate, comparison, advantage, selectionRef, bi, dispatch }
}
