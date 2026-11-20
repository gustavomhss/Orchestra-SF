import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { SfProductState, SfProductStatePort, SfStateNamespace } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import type { CriterionMetric, CriterionRuleInput } from "../../../product/decisions/criterion-rules.ts"
import { createSfPortfolioServices } from "../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfDecisionDomainServices } from "../../../../../../apps/cli/src/sucafina-product/decision-domain-services.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

export type MetricRequest = Pick<CriterionMetric, "caseRef" | "criterionId" | "ruleRef" | "ruleVersion" | "metricRef" | "scenarioRef" | "baselineRef">
export function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}
export const period = { start: "2027-01-01", end: "2027-12-31" }

// Actual SQLite, issued Planner evidence, human coverage, HTTP promotions and
// ordinary rule registration. The state facade only adds a controllable deny
// gate and fault hooks after genuine reads; it never invents a successful read.
export async function criterionFixture() {
  const controls = {
    environmentReads: 0, metricCalls: 0, metricDepth: 0, metricCaseReads: 0, preferencesAllowed: true,
    beforeMetric: undefined as undefined | ((request: MetricRequest, call: TrustedDomainContext) => Promise<MetricRequest | void>),
    afterMetric: undefined as undefined | ((value: PortResult<CriterionMetric>) => Promise<void>),
    afterState: undefined as undefined | ((namespace: SfStateNamespace, value: unknown) => Promise<void>),
  }
  const f = await financialCompositionFixture({ beforeEnvironment: async () => { controls.environmentReads++ } })
  const realState = f.authority.state
  const read: SfProductStatePort["read"] = async (request, namespace, select) => {
    if (namespace === "preferences" && !controls.preferencesAllowed) return { status: "denied", reason: "fixture-preferences-access-revoked" }
    const result = await realState.read(request, namespace, select)
    if (controls.metricDepth && namespace === "cases") controls.metricCaseReads++
    await controls.afterState?.(namespace, result)
    return result
  }
  const authority = { ...f.authority, state: { ...realState, read } }
  const portfolio = createSfPortfolioServices({ authority, business: f.business, ...f.guards })
  let domain: ReturnType<typeof createSfDecisionDomainServices> | undefined
  try {
    const business = f.business
    await f.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 200].map((amount, index) => ({ id: "criterion-v" + index, name: "Criterion source " + index, year: 2027, closed: 0,
        lines: [{ id: "service", name: "License service", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await f.persistence.initializeSources("planner")
    const call = await f.read()
    const sources: BaselineCoverageRequest["source"][] = []
    const components: string[][] = []
    try {
      for (const index of [0, 1]) {
        const issued = ok(await business.plannerProduct.issueSource("criterion-v" + index, call), "Issue actual Planner evidence")
        const projected = ok(await business.planner.compareForecast({ baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period, currency: "USD" }, call), "Project actual source")
        sources.push(issued.evidence)
        components.push(projected.baseline.components.map((component) => component.id))
      }
    } finally { authority.ui.finish(call) }
    const initialRef = { id: "criterion-case", incarnation: "criterion-case-incarnation", version: 1 }
    const basis: BaselineCoverageRequest["basis"] = { id: "criterion-renewal", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
    const decision: DecisionCase = { ...initialRef, state: "draft", objective: "Compare two current Planner sources", horizon: period, currency: "USD",
      criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], participants: ["person"], sourceRefs: sources,
      alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await realState.transaction(f.request("seed-criterion-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-criterion-case",
      commandDigest: digestSfValue(decision) }, async (state) => { state.cases[decision.id] = decision; return { commit: true, value: true } })
    if (seed.status !== "ok") throw new Error("Actual empty case unavailable")
    const coverageRefs: string[] = []
    for (const [index, source] of sources.entries()) {
      const request: BaselineCoverageRequest = { caseRef: initialRef, source, basis, expectedVersion: 0,
        entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
          ? { categoryId, status: "included", componentRefs: components[index]!, evidenceRefs: [source], scopeNote: "Actual service cost; other categories remain pending" }
          : { categoryId, status: "pending", reason: "Human evidence still required" }) }
      const human = ok(await authority.human.admit(f.request("criterion-coverage-" + index), "decisions.coverage", request), "Admit actual classification")
      try { coverageRefs.push(ok(await business.withCase(human, initialRef, {}, () => business.baselineCoverage.register(request, human)), "Register actual classification").coverageRef) }
      finally { authority.human.finish(human) }
    }
    const http = portfolio.http({ origin: "https://example.test", mount: "/product" })
    let caseRef = initialRef
    const resultRefs: string[] = []
    for (const index of [0, 1]) {
      const payload = { caseRef, title: "Actual source " + index, scenario: { baseRef: sources[index]!.refId, operations: [], assumptions: [] }, coverageRef: coverageRefs[index]! }
      const response = await http(new Request("https://example.test/product/planner?sf=decision-promote", { method: "POST",
        headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": "criterion-promote-" + index }, body: JSON.stringify(payload) }), "planner")
      expect(response?.status).toBe(200)
      const receipt = ok(await response!.json() as PortResult<{ caseRef: typeof caseRef; resultRef?: string }>, "Promote actual source-only scenario")
      if (!receipt.resultRef) throw new Error("Actual promotion result missing")
      resultRefs.push(receipt.resultRef)
      caseRef = receipt.caseRef
    }
    domain = createSfDecisionDomainServices({ authority, business, baseline: business.baselineCoverage,
      proposalCoverageWrites: f.guards.proposalCoverageWrites, signalRegistryWrites: new WeakSet<object>(),
      selectedCase: business.selectedCase, sharedPortfolio: portfolio })
    business.bindDecisionDomain(domain)
    const selectedDomain = domain
    const ruleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const,
      value: 2000, unit: "USD", period, evidenceRefs: sources, expectedRuleVersion: 0 }
    const register = async (request: CriterionRuleInput = ruleInput) => {
      const human = ok(await authority.human.admit(f.request("criterion-rule-" + request.expectedRuleVersion), "decisions.criteria", request), "Admit actual ordinary rule")
      try { return ok(await business.withCase(human, caseRef, {}, () => selectedDomain.criteria.register(request, human)), "Register actual ordinary rule") }
      finally { authority.human.finish(human) }
    }
    const rule = await register()
    const metricRequest: MetricRequest = { caseRef, criterionId: "cost", ruleRef: rule.ruleRef, ruleVersion: rule.version,
      metricRef: ruleInput.metricRef, baselineRef: resultRefs[0]!, scenarioRef: resultRefs[1]! }
    const metric = portfolio.readMetric
    portfolio.readMetric = async (request, context) => {
      controls.metricCalls++
      controls.metricDepth++
      try {
        const changed = await controls.beforeMetric?.(request, context)
        const result = await metric(changed ?? request, context)
        await controls.afterMetric?.(result)
        return result
      } finally { controls.metricDepth-- }
    }
    const compareRequest = { scenarioRefs: resultRefs, criteria: ["cost"] }
    const admit = async () => {
      const transport = f.request("criterion-read")
      const call = ok(await authority.ui.admit(transport, "sf_scenario_compare", digestSfValue(compareRequest)), "Admit actual comparison")
      if (!await authority.ui.validate(call, "sf_scenario_compare", digestSfValue(compareRequest))) throw new Error("Comparison intent unavailable")
      return { call, transport }
    }
    const compare = async () => {
      const admitted = await admit()
      try { return await business.withCase(admitted.call, caseRef, {}, () => business.planner.compareScenarios(compareRequest, admitted.call)) }
      finally { authority.ui.finish(admitted.call) }
    }
    const mutate = (work: (state: SfProductState) => void) => f.persistence.transaction("dashboard", async (snapshot) => {
      // Explicit corruption/race injection for refusals only; successes above
      // are produced through C08's normal writers and human admission.
      work(snapshot.data.__sfProductV1 as SfProductState)
      return { commit: true, value: undefined }
    })
    return { ...f, authority, portfolio, domain: selectedDomain, controls, caseRef, resultRefs, sources, compareRequest, metricRequest, ruleInput,
      admit, compare, register, mutate, rawMetric: metric,
      dispose: async () => { selectedDomain.dispose(); portfolio.dispose(); await f.dispose() } }
  } catch (error) {
    domain?.dispose(); portfolio.dispose(); await f.dispose(); throw error
  }
}
