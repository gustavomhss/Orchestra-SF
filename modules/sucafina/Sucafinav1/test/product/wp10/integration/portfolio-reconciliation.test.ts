import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState, SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import type { CriterionRuleInput } from "../../../../product/decisions/criterion-rules.ts"
import { portfolioCandidateRef } from "../../../../product/portfolio/candidates.ts"
import type { PortfolioReconciliationRequest } from "../../../../product/portfolio/reconciliation.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Fixture = Awaited<ReturnType<typeof financialCompositionFixture>>
type Product = NonNullable<Fixture["portfolio"]["product"]>
type CaseRef = PortfolioReconciliationRequest["caseRef"]
type MutationReceipt = { caseRef: CaseRef; resultRef?: string }
type EvaluatedPortfolio = Extract<Awaited<ReturnType<Product["http"]["evaluate"]>>, { status: "ok" }>["value"]
type Reconciled = Extract<Awaited<ReturnType<Product["http"]["reconcile"]>>, { status: "ok" }>["value"]
const horizon = { start: "2026-01-01", end: "2026-12-31" }

function ok<T>(result: PortResult<T> | SfStateResult<T>, phase: string): T {
  if (result.status !== "ok") throw new Error(`${phase}: ${JSON.stringify(result)}`)
  return result.value
}

test("real Portfolio HTTP reconciliation preserves the original C08 choice and refuses forged, revoked and replaced origins", async () => {
  const deadline = compositionTestDeadline("portfolio-reconciliation-real-history", 345_000)
  try {
    const fixture = await deadline.phase("fixture.initialize", async () => {
      const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check(),
        humanActions: ["decisions.portfolio.read", "decisions.portfolio.evaluate"] })
      deadline.own(() => value.dispose())
      return value
    })
    const { authority, business, portfolio, persistence } = fixture
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `v${index}`, name: index ? "Candidate" : "Baseline", year: 2026, closed: 0,
        lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await persistence.initializeSources("planner")
    const sources = await deadline.phase("fixture.actual-source-components", async () => {
      const call = await fixture.read()
      try {
        const entries = []
        for (const id of ["v0", "v1"]) {
          const issued = ok(await business.plannerProduct.issueSource(id, call), `Issue ${id}`)
          const compared = ok(await business.planner.compareForecast({ baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period: horizon, currency: "USD" }, call), `Project ${id}`)
          const target = compared.baseline.components.find((component) => component.period.start === "2026-02-01" && component.period.end === "2026-02-28")
          if (!target || target.amount === null || !target.sourceRefs.length) throw new Error("Real open-month component unavailable")
          entries.push({ source: issued.evidence, components: compared.baseline.components, target })
        }
        return entries
      } finally { authority.ui.finish(call) }
    })
    const initialRef: CaseRef = { id: "reconciliation-case", incarnation: "reconciliation-incarnation", version: 1 }
    const basis: BaselineCoverageRequest["basis"] = { id: "renewal", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources.map((entry) => entry.source) }
    // Seed only domain inputs and an empty case. All alternatives, comparisons,
    // selections, bindings, choices and their C08 receipts below are real writes.
    const decision: DecisionCase = { ...initialRef, state: "draft", objective: "Preserve the human renewal choice", horizon, currency: "USD",
      criteria: [{ id: "cost", description: "Known subtotal difference must not exceed zero", required: true }], participants: ["person"], sourceRefs: basis.sourceRefs,
      alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    ok(await authority.state.transaction(fixture.request("empty-reconciliation-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "empty-reconciliation-case", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      return { commit: true, value: true }
    }), "Seed empty case")
    const scoped = async <T>(caseRef: CaseRef, work: (call: TrustedDomainContext) => Promise<PortResult<T>>) => {
      const call = await fixture.read()
      try { return await business.withCase(call, caseRef, {}, () => work(call)) }
      finally { authority.ui.finish(call) }
    }
    const coverage = [] as { coverageRef: string; version: number }[]
    for (const [index, entry] of sources.entries()) {
      const request: BaselineCoverageRequest = { caseRef: initialRef, source: entry.source, basis, expectedVersion: 0,
        entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
          ? { categoryId, status: "included", componentRefs: entry.components.map((component) => component.id), evidenceRefs: [entry.source], scopeNote: "Service classified by the human" }
          : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }
      coverage.push(await deadline.phase(`coverage.${index}`, async () => {
        const call = ok(await authority.human.admit(fixture.request(`coverage-${index}`), "decisions.coverage", request), "Admit coverage")
        try { return ok(await business.withCase(call, initialRef, {}, () => business.baselineCoverage.register(request, call)), "Register coverage") }
        finally { authority.human.finish(call) }
      }))
    }
    const http = portfolio.http({ origin: "https://example.test", mount: "/product" })
    const post = async <T>(mode: string, payload: unknown, operation: string) => deadline.phase(`http.${operation}`, async () => {
      const response = await http(new Request(`https://example.test/product/planner?sf=${mode}`, { method: "POST", signal: deadline.signal,
        headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": operation }, body: JSON.stringify(payload) }), "planner")
      if (!response) throw new Error("Portfolio action was not routed")
      return { status: response.status, result: await response.json() as PortResult<T> }
    })
    const snapshot = async () => {
      const found = ok(await authority.state.read(fixture.request(), "cases", (state) => ({ decision: state.cases[initialRef.id],
        results: state.decisionResults ?? {}, transactions: state.transactions, outbox: state.outbox })), "Read C08")
      if (!found.decision) throw new Error("Current case unavailable")
      return { ...found, decision: found.decision }
    }
    const promote = async (index: number, caseRef: CaseRef) => {
      const entry = sources[index]!, classification = coverage[index]!
      const response = await post<MutationReceipt>("decision-promote", { caseRef, title: index ? "Candidate" : "Baseline", coverageRef: classification.coverageRef,
        scenario: { baseRef: entry.source.refId, operations: index ? [{ kind: "exclude", targetRef: entry.target.id, currency: "USD", period: entry.target.period }] : [], assumptions: [] } }, `promote-${index}`)
      expect(response.status).toBe(200)
      return ok(response.result, "Promote actual scenario")
    }
    const baseline = await promote(0, initialRef)
    const candidate = await promote(1, baseline.caseRef)
    const alternatives = (await snapshot()).decision.alternatives
    expect(alternatives).toHaveLength(2)
    expect(alternatives[1]!.scenario.operations).toHaveLength(1)
    await deadline.phase("criterion-and-selection", async () => {
      const rule: CriterionRuleInput = { caseRef: candidate.caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0,
        unit: "USD", period: horizon, evidenceRefs: basis.sourceRefs, expectedRuleVersion: 0 }
      const human = ok(await authority.human.admit(fixture.request("rule"), "decisions.criteria", rule), "Admit criterion")
      try { ok(await business.withCase(human, candidate.caseRef, {}, () => portfolio.rules.register(rule, human)), "Register criterion") }
      finally { authority.human.finish(human) }
      const request = { caseRef: candidate.caseRef, baselineAlternativeId: alternatives[0]!.id, alternativeId: alternatives[1]!.id, criteria: ["cost"], expectedVersion: 0 }
      const selected = ok(await authority.human.admit(fixture.request("selection"), "decisions.select-portfolio", request), "Admit selection")
      try { return ok(await business.withCase(selected, candidate.caseRef, {}, () => portfolio.selection.register(request, selected)), "Register actual selection") }
      finally { authority.human.finish(selected) }
    })
    const candidateRef = portfolioCandidateRef({ caseRef: encodeCaseRef(candidate.caseRef), caseVersion: candidate.caseRef.version,
      alternativeId: alternatives[1]!.id, alternativeVersion: alternatives[1]!.version })
    const request = { scope: { horizon, currency: "USD" }, candidateRefs: [candidateRef], operations: [], constraints: ["cost"], priorities: [], explorationLimit: 1 }
    const evaluated = await post<EvaluatedPortfolio>("decision-portfolio-evaluate", { caseRef: candidate.caseRef, request }, "portfolio-evaluate")
    expect(evaluated.status).toBe(200)
    const output = ok(evaluated.result, "Persist Portfolio and real binding")
    const stored = (await snapshot()).results[output.portfolioResultRef]
    if (!stored || stored.kind !== "portfolio") throw new Error("Actual C08 Portfolio missing")
    expect(output.portfolio).toEqual(stored.result)
    expect(stored.result.combinations).toHaveLength(1)
    const combination = stored.result.combinations[0]!
    const analysis = combination.analysis
    if (!analysis) throw new Error("Portfolio did not preserve its real comparison")
    expect(combination).toMatchObject({ comparisonStatus: "conditioned", eligibility: "conditioned" })
    expect(analysis.scenario.total).toBeNull()
    // Exercise the fresh N/N reader before choice advances the case. This uses
    // the canonical current binding and human selection, not the historical gate.
    const fresh = await deadline.phase("origin.current", () => scoped(candidate.caseRef, (call) => portfolio.reconciliation.readPortfolio({ caseRef: candidate.caseRef,
      resultRef: stored.resultRef, combinationId: combination.id }, call)))
    expect(ok(fresh, "Current origin").stored).toEqual(stored)
    const chosen = await post<MutationReceipt>("decision-choose", { caseRef: candidate.caseRef, alternativeId: alternatives[1]!.id,
      alternativeVersion: alternatives[1]!.version, comparison: { scenarioRefs: [analysis.comparison.baselineResultRef, analysis.scenarioResultRef], criteria: ["cost"] },
      criteria: ["cost"], reason: "Human accepts the known subtotal while remaining categories await evidence" }, "choose-real-portfolio")
    expect(chosen.status).toBe(200)
    const chosenRef = ok(chosen.result, "Record actual human choice").caseRef
    expect(chosenRef.version).toBe(candidate.caseRef.version + 1)
    const before = await snapshot(), choice = before.decision.choices[0]!
    expect(before.decision.choices).toHaveLength(1)
    expect(before.decision.ledger).toHaveLength(1)
    expect(before.decision.preparedChanges).toHaveLength(0)
    expect(before.decision.receipts).toHaveLength(0)
    const selected: PortfolioReconciliationRequest = { caseRef: chosenRef, portfolioResultRef: stored.resultRef, combinationId: combination.id, choiceId: choice.id }
    const reconciled = await post<Reconciled>("decision-portfolio-reconcile", selected, "reconcile-historical")
    expect(reconciled.status).toBe(200)
    const value = ok(reconciled.result, "Reconcile actual historical C08")
    expect(value.originalCaseRef).toEqual(candidate.caseRef)
    expect(value.caseRef).toEqual(chosenRef)
    expect(value.originalChoice).toEqual(choice)
    expect(value.originalCombination).toEqual(combination)
    expect(value.originalChoice.result.total).toBeNull()
    expect(value.components.length).toBeGreaterThan(0)
    expect(value.components.every((component) => component.correlation === "not-prepared" && component.effects.length === 0)).toBe(true)
    const conditions = value.components.flatMap((component) => component.conditions)
    expect(conditions.length).toBeGreaterThan(0)
    expect(conditions.every((condition) => condition.impact.state === "unknown" && condition.scopeReason === "materiality-producer-unavailable")).toBe(true)
    expect(value.unmappedChanges).toHaveLength(0)
    expect(value.restrictions).toContain("domain-receipts-do-not-prove-global-transaction")
    expect(await snapshot()).toEqual(before)
    const pageUrl = `https://example.test/product/planner?${new URLSearchParams({ sf: "decision-portfolio-reconciliation", case: encodeCaseRef(chosenRef), selection: JSON.stringify(selected) })}`
    const page = await deadline.phase("http.readonly-page", () => http(new Request(pageUrl, { signal: deadline.signal }), "planner"))
    expect(page?.status).toBe(200)
    const html = await page!.text()
    expect(html).toContain("Composição e escolha originais")
    expect(html).toContain("Materialidade permanece desconhecida")
    expect(html).toContain("Recibos individuais não comprovam uma transação global")
    expect(html).toContain("nenhum registro autorizado nesta composição")
    expect(html).not.toContain('method="post"')
    expect(page!.headers.get("cache-control")).toBe("no-store")
    expect(page!.headers.get("x-sf-access-revision")).toBeTruthy()
    expect(await snapshot()).toEqual(before)
    expect((await post("decision-portfolio-reconcile", { ...selected, binding: "transport-cannot-supply-proof" }, "forged-proof")).status).toBe(400)
    expect((await post("decision-portfolio-reconcile", { ...selected, caseRef: { ...chosenRef, incarnation: "replacement" } }, "foreign-incarnation")).status).not.toBe(200)
    fixture.active.value = false
    expect((await http(new Request(pageUrl, { signal: deadline.signal }), "planner"))?.status).toBe(403)
    fixture.active.value = true
    expect(await snapshot()).toEqual(before)
    // Deliberate fixture corruption is only a counterproof: no permissive
    // reader, synthetic receipt or substituted producer is installed.
    const corrupt = async (restore: boolean) => fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      const original = before.results[stored.resultRef]
      if (!original || !state.decisionResults) throw new Error("Original C08 result missing")
      state.decisionResults[stored.resultRef] = restore ? structuredClone(original) : { ...structuredClone(original), resultDigest: "0".repeat(64) }
      return { commit: true, value: undefined }
    })
    await corrupt(false)
    expect((await post("decision-portfolio-reconcile", selected, "corrupt-origin")).status).not.toBe(200)
    await corrupt(true)
    expect(await snapshot()).toEqual(before)
    // Removing the real source advances its lifecycle. The old immutable
    // composition remains stored, but current authority cannot resolve it.
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    await persistence.initializeSources("planner")
    expect((await post("decision-portfolio-reconcile", selected, "source-replaced")).status).not.toBe(200)
    expect(await snapshot()).toEqual(before)
  } finally { await deadline.close() }
}, 360_000)
