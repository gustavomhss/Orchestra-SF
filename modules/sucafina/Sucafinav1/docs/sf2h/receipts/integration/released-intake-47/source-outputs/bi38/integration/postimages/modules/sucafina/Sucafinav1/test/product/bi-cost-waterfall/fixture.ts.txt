import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { BiViewRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createSfBiServices } from "../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfDecisionBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"

export function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Real SQLite, UI/human authority, Planner, C08 promotions and comparison.
// The annual source rows and empty case are fixtures; no financial result,
// comparison, coverage assessment, persisted reference or binding is invented.
// A one-month horizon keeps this acceptance surgical. In the default fixture,
// pending human categories stay pending even when known components reconcile.
// The complete fixture supplies its own quantified source row per category.
export async function waterfallFixture(deadline: ReturnType<typeof compositionTestDeadline>, options: {
  missing?: boolean
  cancellation?: boolean
  complete?: boolean
} = {}) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => value.dispose())
    return value
  })
  const { authority, business, portfolio, persistence } = fixture
  const period = { start: "2026-01-01", end: "2026-01-31" }
  const version = (index: number) => {
    const rows: { id: string; name: string; amount: number | null }[] = options.complete
      ? RENEWAL_TRANSITION_CATEGORIES.map((category, position) => ({ id: category,
        name: `Confirmed ${category} cost`, amount: category === "service" ? index ? 80 : 100 : (position + 1) * 10 }))
      : [
        { id: "service", name: "Private license service", amount: index ? options.cancellation ? 110 : 80 : 100 },
        { id: "fee", name: "Explicit service fee", amount: 10 },
        { id: "zero", name: "Recorded zero cost", amount: 0 },
        { id: "credit", name: "Recorded credit", amount: -5 },
        ...(options.missing ? [{ id: "missing", name: "Cost awaiting evidence", amount: null }] : []),
      ]
    return { id: `waterfall-v${index}`, name: index ? "Waterfall candidate" : "Waterfall baseline", year: 2026, closed: options.complete ? 1 : 0,
      lines: rows.map((row) => ({ id: row.id, name: row.name, sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(row.amount), a: options.complete ? [row.amount, ...Array(11).fill(null)] : Array(12).fill(null),
        f: options.complete ? [null, ...Array(11).fill(row.amount)] : Array(12).fill(row.amount) })),
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }
  }
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [version(0), version(1)]
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
    const issued = ok(await deadline.phase(`source.${index}`, () => business.plannerProduct.issueSource(`waterfall-v${index}`, call)), "Issue actual source")
    sources.push(issued.evidence)
    forecasts.push(await deadline.phase(`forecast.${index}`, () => business.planner.compareForecast({
      baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period, currency: "USD",
    }, call)))
  }
  const initialRef = { id: "waterfall-case", incarnation: "waterfall-incarnation", version: 1 }
  const basis: BaselineCoverageRequest["basis"] = { id: "waterfall-renewal", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
  const initial: DecisionCase = { ...initialRef, state: "draft", objective: "Explain a persisted cost comparison", horizon: period, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: sources, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(fixture.request("waterfall-empty-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "waterfall-empty-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty case fixture: ${JSON.stringify(seeded)}`)
  const coverageRefs: string[] = []
  for (const [index, source] of sources.entries()) {
    const forecast = ok(forecasts[index]!, "Actual forecast")
    const coverage: BaselineCoverageRequest = { caseRef: initialRef, source, basis, expectedVersion: 0,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => options.complete || categoryId === "service"
        ? { categoryId, status: "included", componentRefs: forecast.baseline.components
          .filter((component) => !options.complete || component.id.startsWith(`${categoryId}:`)).map((component) => component.id),
          evidenceRefs: [source], scopeNote: options.complete ? `Human classifies the separately recorded, quantified ${categoryId} cost in the closed month`
            : "Human identifies the recorded service costs; other categories await evidence" }
        : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }
    const human = ok(await authority.human.admit(fixture.request(`waterfall-coverage-${index}`), "decisions.coverage", coverage), "Admit human coverage")
    try {
      const registered = ok(await deadline.phase(`coverage.${index}`, () => business.withCase(human, initialRef, {}, () =>
        business.baselineCoverage.register(coverage, human))), "Register actual coverage")
      coverageRefs.push(registered.coverageRef)
    } finally { authority.human.finish(human) }
  }
  const candidateForecast = ok(forecasts[1]!, "Candidate forecast")
  const fee = candidateForecast.baseline.components.find((component) => component.amount === 10)
  if (!options.complete && !fee) throw new Error("Real candidate fee component unavailable")
  const requests: ScenarioRequest[] = [
    { baseRef: sources[0]!.refId, operations: [], assumptions: [] },
    { baseRef: sources[1]!.refId, operations: options.complete ? [] : [{ kind: "exclude", targetRef: fee!.id, currency: fee!.currency, period: fee!.period }], assumptions: [] },
  ]
  const mutationHttp = portfolio.http({ origin: "https://example.test", mount: "/product" })
  const promote = async (index: number, caseRef: typeof initialRef) => {
    const payload = { caseRef, title: index ? "Waterfall candidate" : "Waterfall baseline", scenario: requests[index]!, coverageRef: coverageRefs[index]! }
    const response = await deadline.phase(`promotion.${index}`, () => mutationHttp(new Request("https://example.test/product/planner?sf=decision-promote", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": `waterfall-promote-${index}` }, body: JSON.stringify(payload),
    }), "planner"))
    if (response?.status !== 200) throw new Error(`Actual human promotion ${index}: ${response?.status} ${response ? await response.text() : "no response"}`)
    const receipt = ok(await response.json() as PortResult<{ caseRef: typeof initialRef; resultRef?: string }>, "Persist promoted scenario")
    if (!receipt.resultRef) throw new Error("Actual promotion did not persist its scenario")
    return { caseRef: receipt.caseRef, resultRef: receipt.resultRef }
  }
  const baseline = await promote(0, initialRef)
  const candidate = await promote(1, baseline.caseRef)
  const snapshot = await authority.state.read(fixture.request(), "cases", (state) => state.cases[initialRef.id])
  if (snapshot.status !== "ok" || !snapshot.value || snapshot.value.alternatives.length !== 2) throw new Error("Promoted alternatives unavailable")
  const caseValue = snapshot.value
  const compared = ok(await deadline.phase("comparison.persist", () => business.withCase(call, candidate.caseRef, {}, async () => {
    const selected = await portfolio.compare({ caseRef: candidate.caseRef, baselineAlternativeId: caseValue.alternatives[0]!.id,
      alternativeId: caseValue.alternatives[1]!.id, criteria: [] }, call)
    if (selected.status !== "ok") return selected
    return business.calculations.persist({ kind: "comparison", request: selected.value.request, result: selected.value.comparison }, "waterfall-comparison", call)
  })), "Persist actual comparison")
  const selectionRef = sfDecisionBiSelection({ scenarioResultRef: candidate.resultRef, comparisonRef: compared.resultRef })
  const bi = createSfBiServices({ authority, business, portfolio })
  const admit = async (request: BiViewRequest, signal: AbortSignal = deadline.signal) => {
    const context = ok(await authority.ui.admit(new Request(fixture.request(), { signal }), "sf_bi_view", digestSfValue(request)), "Admit actual BI request")
    deadline.own(() => authority.ui.finish(context))
    return context
  }
  const dispatch = async (viewId = "BI09", selected = selectionRef, requestedPeriod = period) => {
    const request: BiViewRequest = { viewId, selectionRef: selected, period: { ...requestedPeriod } }
    return bi.dispatchPresentation(request, await admit(request))
  }
  const preparePortfolio = async () => {
    const request = { caseRef: candidate.caseRef, baselineAlternativeId: caseValue.alternatives[0]!.id,
      alternativeId: caseValue.alternatives[1]!.id, criteria: [], expectedVersion: 0 }
    const human = ok(await authority.human.admit(fixture.request("waterfall-select-portfolio"), "decisions.select-portfolio", request), "Admit actual portfolio selection")
    try {
      ok(await deadline.phase("portfolio.select", () => business.withCase(human, candidate.caseRef, {}, () =>
        portfolio.selection.register(request, human))), "Register actual portfolio selection")
    } finally { authority.human.finish(human) }
    const persistent = portfolio.product?.contribution.persistent
    if (!persistent) throw new Error("Actual persistent Portfolio unavailable")
    const evaluation = { scope: { horizon: period, currency: "USD" }, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(candidate.caseRef),
      caseVersion: candidate.caseRef.version, alternativeId: caseValue.alternatives[1]!.id, alternativeVersion: caseValue.alternatives[1]!.version })],
    operations: [], constraints: [], priorities: [], explorationLimit: 1 }
    const bundle = ok(await deadline.phase("portfolio.persist", () => business.withCase(call, candidate.caseRef, {}, () =>
      persistent.evaluateAndStore(evaluation, candidate.caseRef, call))), "Persist actual Portfolio")
    const analyses = bundle.portfolio.combinations.flatMap((combination) => combination.analysis ? [combination.analysis] : [])
    if (analyses.length !== 1) throw new Error(`Expected one actually produced Portfolio analysis; received ${analyses.length}`)
    const analysis = analyses[0]!
    return { bundle, analysis, selectionRef: sfDecisionBiSelection({ portfolioResultRef: bundle.portfolioResultRef, sourceScenarioRef: analysis.scenarioResultRef }) }
  }
  return { ...fixture, call, caseRef: candidate.caseRef, caseValue, sources, period, baseline, candidate,
    comparisonRef: compared.resultRef, selectionRef, bi, admit, dispatch, preparePortfolio }
}
