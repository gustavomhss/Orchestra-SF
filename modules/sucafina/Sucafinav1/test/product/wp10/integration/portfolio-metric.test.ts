import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, CostCoverageBasis } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Real SQLite/C08, UI authority, Planner scenarios, result storage, criteria and
// public comparison. Pending coverage and binding the produced alternatives to
// C08 are explicit fixtures, not human promotion or complete-cost acceptance.
test("Portfolio metric keeps the public comparison's four real reads and reauthorizes each invocation", async () => {
  const deadline = compositionTestDeadline("portfolio-metric-observations")
  try {
    const fixture = await metricFixture(deadline)
    const reads: string[] = []
    const resolve = fixture.scenarios.resolve
    fixture.scenarios.resolve = async (reference, call) => {
      const result = await resolve(reference, call)
      reads.push(reference)
      expect(call).toBe(fixture.call)
      return result
    }
    deadline.own(() => { fixture.scenarios.resolve = resolve })
    const metric = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      const first = await deadline.phase("metric.first", () => fixture.portfolio.readMetric(fixture.request, fixture.call))
      expect(first).toMatchObject({ status: "ok", value: { value: -240, unit: "USD", period: fixture.period,
        state: "conditioned", engineVersion: "planner-runtime-v1", evidenceRefs: fixture.sources } })
      expect(reads).toEqual([fixture.request.baselineRef, fixture.request.scenarioRef, fixture.request.baselineRef, fixture.request.scenarioRef])
      const second = await deadline.phase("metric.second", () => fixture.portfolio.readMetric(fixture.request, fixture.call))
      expect(second).toEqual(first)
      expect(reads).toEqual(Array.from({ length: 4 }, () => [fixture.request.baselineRef, fixture.request.scenarioRef]).flat())
      return second
    })
    expect(metric.status).toBe("ok")
    fixture.active.value = false
    const revoked = await fixture.portfolio.readMetric(fixture.request, fixture.call)
    expect(revoked.status).not.toBe("ok")
    expect(Object.hasOwn(revoked, "value")).toBe(false)
    expect(reads).toHaveLength(8)
  } finally { await deadline.close() }
}, 120_000)

for (const change of ["source", "authority", "case-membership", "request"] as const) test(`Portfolio metric refuses ${change} changing after the final real scenario resolution`, async () => {
  const deadline = compositionTestDeadline(`portfolio-metric-${change}`)
  try {
    const fixture = await metricFixture(deadline)
    const resolve = fixture.scenarios.resolve
    let reads = 0
    fixture.scenarios.resolve = async (reference, call) => {
      const result = await resolve(reference, call)
      reads++
      if (reads === 4) {
        if (change === "authority") fixture.active.value = false
        if (change === "request") fixture.request.criterionId = "changed-after-admission"
        if (change === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
          versions.find((version) => version.id === "v0")!.lines[0]!.f[0] = 101
          return { commit: true, value: undefined }
        })
        if (change === "case-membership") await fixture.store.transaction("dashboard", async (snapshot) => {
          const product = snapshot.data.__sfProductV1 as SfProductState
          product.cases[fixture.caseRef.id]!.participants = []
          return { commit: true, value: undefined }
        })
      }
      return result
    }
    deadline.own(() => { fixture.scenarios.resolve = resolve })
    const metric = await deadline.phase("metric.interleaved", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.portfolio.readMetric(fixture.request, fixture.call)))
    expect(reads).toBe(4)
    expect(metric.status).not.toBe("ok")
    expect(Object.hasOwn(metric, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)

async function metricFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await deadline.phase("fixture.initialize", () => financialCompositionFixture({ signal: deadline.signal,
    beforeEnvironment: async () => deadline.check() }))
  deadline.own(() => fixture.dispose())
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "metric-case", incarnation: "metric-incarnation", version: 1 }
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `v${index}`, name: index ? "Candidate" : "Baseline", year: 2026, closed: 0,
      lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  const sources = [] as CostCoverageBasis["sourceRefs"][number][]
  for (const id of ["v0", "v1"]) {
    const issued = await fixture.business.plannerProduct.issueSource(id, call)
    if (issued.status !== "ok") throw new Error(`Actual metric source ${id} unavailable: ${issued.reason}`)
    sources.push(issued.value.evidence)
  }
  const basis: CostCoverageBasis = { id: "metric-basis", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: sources }
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Read deterministic criterion metadata", horizon: period, currency: "USD",
    participants: ["person"], criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], sourceRefs: sources,
    alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "metric-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[caseRef.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Metric case fixture unavailable")
  fixture.business.bindForecastCoverage(async (reference, context) => {
    const source = await fixture.business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:metric-pending-coverage", basis,
      assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: source.value.versionId === "v0" ? "baseline" : "candidate", alternativeVersion: 1,
        currency: "USD", horizon: period, issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const produced = await deadline.phase("fixture.produce-scenarios", () => fixture.business.withCase(call, caseRef, {}, async () => {
    const alternatives: DecisionCase["alternatives"][number][] = []
    const resultRefs: string[] = []
    for (const [index, source] of sources.entries()) {
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const result = await fixture.business.planner.simulateScenario(scenario, call)
      if (result.status !== "ok") return result
      const saved = await fixture.business.results.write({ kind: "scenario", result: result.value, caseRef,
        requestDigest: digestSfValue(scenario), sourceRefs: result.value.sourceRefs, idempotencyKey: `metric-result-${index}` }, call)
      if (saved.status !== "ok") return saved
      resultRefs.push(saved.value.resultRef)
      alternatives.push({ id: index ? "candidate" : "baseline", version: 1, title: index ? "Candidate" : "Baseline", scenario, result: result.value })
    }
    return { status: "ok", value: { alternatives, resultRefs } }
  }))
  if (produced.status !== "ok") throw new Error(`Actual metric scenario production failed: ${produced.reason}`)
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id])
  if (current.status !== "ok") throw new Error("Metric fixture versions unavailable")
  const bound = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "metric-alternatives", commandDigest: digestSfValue(produced.value.alternatives) }, async (state) => {
    state.cases[caseRef.id] = { ...initial, alternatives: produced.value.alternatives }
    return { commit: true, value: true }
  })
  if (bound.status !== "ok") throw new Error("Produced metric alternatives could not be bound")
  const ruleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const, value: 0,
    unit: "USD", period, evidenceRefs: sources, expectedRuleVersion: 0 }
  const human = await fixture.authority.human.admit(fixture.request(), "decisions.criteria", ruleInput)
  if (human.status !== "ok") throw new Error("Actual human criterion admission unavailable")
  const rule = await fixture.business.withCase(human.value, caseRef, {}, () => fixture.portfolio.rules.register(ruleInput, human.value))
    .finally(() => fixture.authority.human.finish(human.value))
  if (rule.status !== "ok") throw new Error(`Actual criterion registration failed: ${rule.reason}`)
  const scenarios = fixture.business.plannerProduct.scenarios
  if (!scenarios) throw new Error("Actual stored scenario resolver unavailable")
  return { ...fixture, call, caseRef, sources, scenarios, period,
    request: { caseRef, criterionId: "cost", ruleRef: rule.value.ruleRef, ruleVersion: rule.value.version,
      metricRef: "planner:known-subtotal-difference", baselineRef: produced.value.resultRefs[0]!, scenarioRef: produced.value.resultRefs[1]! } }
}
