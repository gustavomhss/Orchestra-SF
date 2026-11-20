import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, CostCoverageBasis } from "../../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { object } from "../../../../runtime/contract.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// The data below is a declared SQLite fixture. Scenarios, stored results, human
// criteria, units and the final choice are produced by their real domain APIs.
async function observationFixture(deadline: ReturnType<typeof compositionTestDeadline>, mixed = false) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check(), humanActions: ["decisions.portfolio.read"] })
    deadline.own(() => value.dispose())
    return value
  })
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
  const companion = mixed ? await procurementSource(fixture, call, period) : undefined
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Read deterministic criterion metadata", horizon: period, currency: "USD",
    participants: ["person"], criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], sourceRefs: [...sources, ...(companion ? [companion] : [])],
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
      const scenario = { baseRef: source.refId, operations: index ? [{ kind: "replace" as const, targetRef: "line:1", amount: 80,
        currency: "USD", period: { start: "2026-01-01", end: "2026-01-31" } }] : [], assumptions: [] }
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
  return { ...fixture, stateRequest: fixture.request, call, caseRef, sources, scenarios, period, companion,
    request: { caseRef, criterionId: "cost", ruleRef: rule.value.ruleRef, ruleVersion: rule.value.version,
      metricRef: "planner:known-subtotal-difference", baselineRef: produced.value.resultRefs[0]!, scenarioRef: produced.value.resultRefs[1]! } }
}


type ObservationFixture = Awaited<ReturnType<typeof observationFixture>>

function caseObservations(fixture: ObservationFixture, deadline: ReturnType<typeof compositionTestDeadline>) {
  const counts = { cases: 0 }
  const read = fixture.authority.state.read
  fixture.authority.state.read = async (request, namespace, select) => {
    const result = await read(request, namespace, select)
    if (namespace === "cases" && result.status === "ok" && result.value && typeof result.value === "object" &&
      "id" in result.value && result.value.id === fixture.caseRef.id && "alternatives" in result.value &&
      Array.isArray(result.value.alternatives)) counts.cases++
    return result
  }
  deadline.own(() => { fixture.authority.state.read = read })
  return counts
}

function comparison(fixture: ObservationFixture) {
  return { scenarioRefs: [fixture.request.baselineRef, fixture.request.scenarioRef], criteria: ["cost"] }
}

async function httpUnits(fixture: ObservationFixture, signal: AbortSignal) {
  const http = fixture.portfolio.http({ origin: "https://example.test", mount: "/sucafina" })
  const payload = { caseRef: fixture.caseRef, baselineRef: fixture.request.baselineRef,
    scenarioRef: fixture.request.scenarioRef, parameterRef: "line:1" }
  const response = await http(new Request("https://example.test/sucafina/planner?sf=decision-sensitivity-units", {
    method: "POST", signal, headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify(payload),
  }), "planner")
  if (!response) throw new Error("The composed public sensitivity route is missing")
  return { status: response.status, body: object(await response.json()) }
}

test("Portfolio metric opens a fresh complete Planner case observation for every invocation", async () => {
  const deadline = compositionTestDeadline("portfolio-planner-metric")
  try {
    const fixture = await observationFixture(deadline)
    const counts = caseObservations(fixture, deadline)
    const result = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      counts.cases = 0
      const first = await fixture.portfolio.readMetric(fixture.request, fixture.call)
      expect(first).toMatchObject({ status: "ok", value: { value: -240, unit: "USD", state: "conditioned" } })
      const firstReads = counts.cases
      expect(firstReads).toBeGreaterThan(0)
      counts.cases = 0
      const second = await fixture.portfolio.readMetric(fixture.request, fixture.call)
      expect(second).toEqual(first)
      expect(counts.cases).toBe(firstReads)
      const observe = fixture.business.withPlannerObservation
      try {
        // Run the same current canonical producer with only this optimization
        // absent. All original case/source/authority readers still execute.
        fixture.business.withPlannerObservation = (_request, _call, work) => work()
        counts.cases = 0
        const canonical = await fixture.portfolio.readMetric(fixture.request, fixture.call)
        expect(canonical).toEqual(first)
        expect(counts.cases).toBeGreaterThan(firstReads)
      } finally { fixture.business.withPlannerObservation = observe }
      return second
    })
    expect(result.status).toBe("ok")
  } finally { await deadline.close() }
}, 120_000)

test("Portfolio comparison joins its exact Planner owner and closes the observation before a real human choice writes", async () => {
  const deadline = compositionTestDeadline("portfolio-planner-choice")
  try {
    const fixture = await observationFixture(deadline)
    const request = comparison(fixture)
    const compared = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.withScenarioObservation({ caseRef: fixture.caseRef }, fixture.call, () =>
        fixture.portfolio.planner.compareScenarios(request, fixture.call)))
    expect(compared).toMatchObject({ status: "ok", value: { knownDifference: -240, comparisonStatus: "conditioned",
      criterionResults: [{ criterionId: "cost", state: "unknown" }] } })
    const choice = { caseRef: fixture.caseRef, alternativeId: "candidate", alternativeVersion: 1,
      comparison: request, criteria: ["cost"], reason: "Record the current hypothetical comparison without applying it." }
    const human = await fixture.authority.human.admit(fixture.stateRequest(), "decisions.choose", choice)
    if (human.status !== "ok") throw new Error("Actual human choice admission unavailable")
    const saved = await fixture.business.withCase(human.value, fixture.caseRef, {}, () =>
      fixture.portfolio.mutations.recordChoice(choice, human.value)).finally(() => fixture.authority.human.finish(human.value))
    expect(saved).toMatchObject({ status: "ok", value: { caseRef: { ...fixture.caseRef, version: 2 } } })
    const current = await fixture.business.cases.read({ caseRef: encodeCaseRef(fixture.caseRef) }, fixture.call)
    if (current.status !== "ok") throw new Error("The actual persisted choice is unreadable")
    expect(current.value.case.choices).toHaveLength(1)
    expect(current.value.case.choices[0]).toMatchObject({ alternativeId: "candidate", reason: choice.reason,
      comparisonStatus: "conditioned", values: [{ criterionRef: "cost", value: -240, unit: "USD" }] })
    expect(current.value.case.preparedChanges).toEqual([])
    expect(current.value.case.receipts).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("The public sensitivity units route retains its canonical output with one complete Planner observation per request", async () => {
  const deadline = compositionTestDeadline("portfolio-planner-units")
  try {
    const fixture = await observationFixture(deadline)
    const counts = caseObservations(fixture, deadline)
    const first = await httpUnits(fixture, deadline.signal)
    expect(first).toMatchObject({ status: 200, body: { status: "ok", value: { caseRef: fixture.caseRef,
      units: { parameterRef: "line:1", parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner-runtime-v1" } } } })
    // Count all real complete-case selections, including coverage readers;
    // the independently repeated request must repeat its full admitted schedule.
    const firstReads = counts.cases
    expect(firstReads).toBeGreaterThan(0)
    counts.cases = 0
    const second = await httpUnits(fixture, deadline.signal)
    expect(second).toEqual(first)
    expect(counts.cases).toBe(firstReads)
    const observe = fixture.business.withPlannerObservation
    try {
      fixture.business.withPlannerObservation = (_request, _call, work) => work()
      counts.cases = 0
      const canonical = await httpUnits(fixture, deadline.signal)
      expect(canonical).toEqual(first)
      expect(counts.cases).toBeGreaterThan(firstReads)
    } finally { fixture.business.withPlannerObservation = observe }
  } finally { await deadline.close() }
}, 120_000)

for (const entry of ["metric-source", "comparison-lease", "units-input"] as const) {
  test(`Portfolio ${entry} rechecks the composed observation after its last canonical callback`, async () => {
    const deadline = compositionTestDeadline(`portfolio-planner-final-${entry}`)
    try {
      const fixture = await observationFixture(deadline)
      const compare = comparison(fixture), observe = fixture.business.withPlannerObservation
      let reached = 0
      fixture.business.withPlannerObservation = (incoming, call, work) => observe(incoming, call, async () => {
        const result = await work()
        const selected = entry === "metric-source" ? incoming === fixture.request
          : entry === "comparison-lease" ? incoming === compare
          : !!incoming && typeof incoming === "object" && "parameterRef" in incoming
        if (selected && result.status === "ok") {
          reached++
          if (entry === "metric-source") await fixture.persistence.transaction("planner", async (snapshot) => {
            const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
            versions.find((version) => version.id === "v0")!.lines[0]!.f[0] = 101
            return { commit: true, value: undefined }
          })
          if (entry === "comparison-lease") fixture.authority.ui.finish(call)
          if (entry === "units-input" && incoming && typeof incoming === "object" && "parameterRef" in incoming)
            incoming.parameterRef = "changed-after-canonical-units"
        }
        return result
      })
      deadline.own(() => { fixture.business.withPlannerObservation = observe })
      const result = entry === "units-input" ? (await httpUnits(fixture, deadline.signal)).body
        : await fixture.business.withCase<unknown>(fixture.call, fixture.caseRef, {}, () => entry === "metric-source"
          ? fixture.portfolio.readMetric(fixture.request, fixture.call)
          : fixture.portfolio.planner.compareScenarios(compare, fixture.call))
      expect(reached).toBe(1)
      expect(result.status).not.toBe("ok")
      expect(Object.hasOwn(result, "value")).toBe(false)
    } finally { await deadline.close() }
  }, 120_000)
}

test("Mixed Planner and Procurement evidence retains canonical case reads and current lease refusal", async () => {
  const deadline = compositionTestDeadline("portfolio-planner-mixed-fallback")
  try {
    const fixture = await observationFixture(deadline, true)
    expect(fixture.companion).toMatchObject({ kind: "record", target: { surface: "procurement", recordType: "procurement-request" } })
    const counts = caseObservations(fixture, deadline)
    const result = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      counts.cases = 0
      const first = await fixture.portfolio.readMetric(fixture.request, fixture.call)
      expect(first).toMatchObject({ status: "ok", value: { value: -240, state: "conditioned" } })
      const firstReads = counts.cases
      expect(firstReads).toBeGreaterThan(0)
      const canonical = fixture.business.withPlannerObservation
      try {
        fixture.business.withPlannerObservation = (_request, _call, work) => work()
        counts.cases = 0
        const second = await fixture.portfolio.readMetric(fixture.request, fixture.call)
        expect(second).toEqual(first)
        expect(counts.cases).toBe(firstReads)
      } finally { fixture.business.withPlannerObservation = canonical }
      return first
    })
    expect(result.status).toBe("ok")
    const units = await httpUnits(fixture, deadline.signal)
    expect(units).toMatchObject({ status: 200, body: { status: "ok" } })
    const compared = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.portfolio.planner.compareScenarios(comparison(fixture), fixture.call))
    expect(compared).toMatchObject({ status: "ok", value: { knownDifference: -240, comparisonStatus: "conditioned" } })
    fixture.authority.ui.finish(fixture.call)
    const denied = await fixture.portfolio.readMetric(fixture.request, fixture.call)
    expect(denied.status).not.toBe("ok")
    expect(Object.hasOwn(denied, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)

async function procurementSource(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>,
  call: Awaited<ReturnType<typeof fixture.read>>, period: { start: string; end: string }) {
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", fxRates: [], minQuotes: 2, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [], requests: { "MIXED-1": { version: 1, by: "person", request: {
        number: "MIXED-1", status: "src_pending", createdBy: "person", createdAt: "2026-01-01T00:00:00.000Z",
        pr: { title: "Companion purchase source", type: "service", description: "Explicit source fixture", estAmount: 140,
          costCenter: "TEST", needBy: "2026-12-31", justification: "Observe the current mixed case", recurring: false },
        sourcing: { evaluator: "person", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [] },
      } } } }
    return { commit: true, value: undefined }
  })
  const intent = { purpose: "work-selection", period }
  const selection = await fixture.authority.ui.admit(fixture.request(), "sf_work_list", digestSfValue(intent))
  if (selection.status !== "ok" || !await fixture.authority.ui.validate(selection.value, "sf_work_list", digestSfValue(intent)))
    throw new Error("Actual Procurement selection admission unavailable")
  try {
    const selected = await fixture.business.procurementSelections.create(selection.value, period)
    if (selected.status !== "ok") throw new Error("Actual Procurement period selection unavailable")
  } finally { fixture.authority.ui.finish(selection.value) }
  const issued = await fixture.business.individual.issue("procurement-request", "MIXED-1", call)
  if (issued.status !== "ok") throw new Error(`Actual mixed source unavailable: ${issued.reason}`)
  const resolved = await fixture.business.individual.resolve(issued.value, call)
  if (resolved.status !== "ok") throw new Error(`Actual mixed projection unavailable: ${resolved.reason}`)
  return resolved.value.evidence
}
