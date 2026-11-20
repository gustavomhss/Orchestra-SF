import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase, CostCoverageBasis, CostCoverageEntry } from "../../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Declared SQLite inputs; every scenario, rule, unit, boundary and persisted
// sensitivity below is issued by the actual installed production services.
async function sensitivityObservationFixture(deadline: ReturnType<typeof compositionTestDeadline>, mixed = false) {
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
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
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
  for (const [index, source] of sources.entries()) {
    if (source.kind !== "record") throw new Error("Actual Planner record source required")
    const forecast = await fixture.business.withCase(call, caseRef, {}, () =>
      fixture.business.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period, currency: "USD" }, call))
    if (forecast.status !== "ok") throw new Error(`Actual coverage components unavailable: ${forecast.reason}`)
    const projection = forecast.value.baseline
    expect(projection.components).toHaveLength(12)
    expect(projection.components.every((component) => component.amount !== null &&
      component.evidenceState === "confirmed" && component.sourceRefs.length > 0)).toBe(true)
    const entries: CostCoverageEntry[] = [
      { status: "included", categoryId: "service", componentRefs: projection.components.map((component) => component.id),
        evidenceRefs: [source], scopeNote: "These twelve installed license forecast components are assessed as service; training remains unresolved." },
      { status: "pending", categoryId: "training", reason: "No training evidence has been supplied" },
    ]
    const request = { caseRef, source, basis, entries, expectedVersion: 0 }
    const human = await fixture.authority.human.admit(fixture.request(`sensitivity-coverage-${index}`), "decisions.coverage", request)
    if (human.status !== "ok") throw new Error("Actual human coverage admission unavailable")
    try {
      const registered = await fixture.business.withCase(human.value, caseRef, {}, () =>
        fixture.business.baselineCoverage.register(request, human.value))
      if (registered.status !== "ok") throw new Error(`Actual coverage registration refused: ${registered.reason}`)
      const read = await fixture.business.withCase(human.value, caseRef, {}, () =>
        fixture.business.baselineCoverage.resolveForecastCoverage(registered.value.coverageRef, human.value))
      if (read.status !== "ok") throw new Error(`Actual registered coverage unavailable: ${read.reason}`)
      expect(read.value.assessment.coverageState).toBe("pending")
      expect(read.value.assessment.entries.filter((entry) => entry.status !== "pending")).toEqual([entries[0]])
      expect(read.value.assessment.entries.find((entry) => entry.categoryId === "training")).toEqual(entries[1])
    } finally { fixture.authority.human.finish(human.value) }
  }
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
  const units = fixture.portfolio.units
  if (!units) throw new Error("Actual sensitivity units unavailable")
  const unitRequest = { scenarioRef: produced.value.resultRefs[1]!, baselineRef: produced.value.resultRefs[0]!, parameterRef: "line:1" }
  const issued = await fixture.business.withCase(call, caseRef, {}, () => units.issue(unitRequest, call))
  if (issued.status !== "ok") throw new Error(`Actual sensitivity units refused: ${issued.reason}`)
  const ruleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const, value: -200,
    unit: "USD", period, evidenceRefs: sources, sensitivity: issued.value.units, expectedRuleVersion: 0 }
  const human = await fixture.authority.human.admit(fixture.request(), "decisions.criteria", ruleInput)
  if (human.status !== "ok") throw new Error("Actual human criterion admission unavailable")
  const rule = await fixture.business.withCase(human.value, caseRef, {}, () => fixture.portfolio.rules.register(ruleInput, human.value))
    .finally(() => fixture.authority.human.finish(human.value))
  if (rule.status !== "ok") throw new Error(`Actual criterion registration failed: ${rule.reason}`)
  const scenarios = fixture.business.plannerProduct.scenarios
  if (!scenarios) throw new Error("Actual stored scenario resolver unavailable")
  const sensitivityRequest: SensitivityRequest = { scenarioRef: unitRequest.scenarioRef,
    parameterBounds: { parameterRef: unitRequest.parameterRef, minimum: 0, maximum: 200, steps: 2 },
    criterion: { id: "cost", operator: "lte", value: -200 } }
  return { ...fixture, stateRequest: fixture.request, call, caseRef, sources, scenarios, period, companion, units, unitRequest, sensitivityRequest }
}

type SensitivityFixture = Awaited<ReturnType<typeof sensitivityObservationFixture>>

function caseObservations(fixture: SensitivityFixture, deadline: ReturnType<typeof compositionTestDeadline>) {
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

test("Composed sensitivity units equal the canonical producer and start a fresh case proof on every call", async () => {
  const deadline = compositionTestDeadline("portfolio-sensitivity-units")
  try {
    const fixture = await sensitivityObservationFixture(deadline)
    const counts = caseObservations(fixture, deadline)
    const observed = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      counts.cases = 0
      const first = await fixture.units.issue(fixture.unitRequest, fixture.call)
      expect(first.status).toBe("ok")
      const firstReads = counts.cases
      // Real human baseline coverage also reopens C08 directly. Count the full
      // case observations, including those independent coverage admissions.
      expect(firstReads).toBeGreaterThan(2)
      counts.cases = 0
      expect(await fixture.units.issue(fixture.unitRequest, fixture.call)).toEqual(first)
      expect(counts.cases).toBe(firstReads)
      const observe = fixture.business.withPlannerObservation
      try {
        fixture.business.withPlannerObservation = (_request, _call, work) => work()
        counts.cases = 0
        expect(await fixture.units.issue(fixture.unitRequest, fixture.call)).toEqual(first)
        expect(counts.cases).toBeGreaterThan(firstReads)
      } finally { fixture.business.withPlannerObservation = observe }
      return first
    })
    expect(observed.status).toBe("ok")
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
      versions.find((version) => version.id === "v1")!.lines[0]!.f[0] = 81
      return { commit: true, value: undefined }
    })
    const changed = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.units.issue(fixture.unitRequest, fixture.call))
    expect(changed.status).not.toBe("ok")
    expect(Object.hasOwn(changed, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)

test("The real sensitivity route scopes units, previews and exact search, and releases every owner before persisting", async () => {
  const deadline = compositionTestDeadline("portfolio-sensitivity-persistence-phases")
  try {
    const fixture = await sensitivityObservationFixture(deadline)
    const product = fixture.portfolio.product
    if (!product) throw new Error("Actual Portfolio product unavailable")
    const observe = fixture.business.withPlannerObservation
    const transaction = fixture.authority.state.transaction
    const events: { kind: string; parentDepth: number }[] = []
    const writes: number[] = []
    let depth = 0
    fixture.business.withPlannerObservation = async (request, call, work) => {
      const record = request && typeof request === "object" ? request : {}
      const kind = "binding" in record && "request" in record ? "exact"
        : "sensitivityRequest" in record ? "revalidate"
        : "scenario" in record && "baselineRef" in record ? "preview"
        : "parameterRef" in record ? "units" : "resolve"
      events.push({ kind, parentDepth: depth })
      depth++
      try { return await observe(request, call, work) } finally { depth-- }
    }
    fixture.authority.state.transaction = (request, command, work) => {
      if (command.namespace === "cases") writes.push(depth)
      return transaction(request, command, work)
    }
    deadline.own(() => {
      fixture.business.withPlannerObservation = observe
      fixture.authority.state.transaction = transaction
    })
    const saved = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      product.http.sensitivity(fixture.sensitivityRequest, fixture.caseRef, fixture.call))
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error(`Actual sensitivity persistence refused: ${saved.reason}`)
    expect(saved.value.sensitivity.thresholdEvidence.state).toBe("exact")
    if (saved.value.sensitivity.thresholdEvidence.state !== "exact") throw new Error("Canonical exact boundary unavailable")
    expect(saved.value.sensitivity.threshold).toBeCloseTo(120, 8)
    expect(saved.value.sensitivity.evaluated).toHaveLength(3)
    expect(saved.value.sensitivity.thresholdEvidence.evidenceRefs.length).toBeGreaterThan(0)
    expect(events.some((entry) => entry.kind === "units")).toBe(true)
    expect(events.some((entry) => entry.kind === "preview" && entry.parentDepth === 0)).toBe(true)
    expect(events.some((entry) => entry.kind === "exact" && entry.parentDepth === 0)).toBe(true)
    expect(events.filter((entry) => entry.kind === "revalidate" && entry.parentDepth === 0).length).toBeGreaterThan(0)
    expect(writes.length).toBeGreaterThan(0)
    expect(writes).toEqual(writes.map(() => 0))
    expect(depth).toBe(0)
    const stored = await fixture.authority.state.read(fixture.stateRequest(), "cases", (state) =>
      state.decisionResults?.[saved.value.sensitivityResultRef])
    expect(stored.status).toBe("ok")
    if (stored.status !== "ok" || !stored.value) throw new Error("Actual sensitivity result missing after publication")
    expect(stored.value.kind).toBe("sensitivity")
    expect(stored.value.resultDigest).toBe(digestSfValue(saved.value.sensitivity))
    expect(stored.value.result).toEqual(saved.value.sensitivity)
  } finally { await deadline.close() }
}, 120_000)

for (const mutation of ["source", "lease", "input"] as const) {
  test(`Sensitivity units refuse a ${mutation} change after their last canonical callback`, async () => {
    const deadline = compositionTestDeadline(`portfolio-sensitivity-final-${mutation}`)
    try {
      const fixture = await sensitivityObservationFixture(deadline)
      const observe = fixture.business.withPlannerObservation
      let reached = 0
      fixture.business.withPlannerObservation = (request, call, work) => observe(request, call, async () => {
        const result = await work()
        if (request === fixture.unitRequest && result.status === "ok") {
          reached++
          if (mutation === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
            const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
            versions.find((version) => version.id === "v0")!.lines[0]!.f[0] = 101
            return { commit: true, value: undefined }
          })
          if (mutation === "lease") fixture.authority.ui.finish(call)
          if (mutation === "input") fixture.unitRequest.parameterRef = "changed-after-canonical-units"
        }
        return result
      })
      deadline.own(() => { fixture.business.withPlannerObservation = observe })
      const refused = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
        fixture.units.issue(fixture.unitRequest, fixture.call))
      expect(reached).toBe(1)
      expect(refused.status).not.toBe("ok")
      expect(Object.hasOwn(refused, "value")).toBe(false)
    } finally { await deadline.close() }
  }, 120_000)
}

test("Sensitivity units keep mixed Planner and Procurement evidence on the original canonical fallback", async () => {
  const deadline = compositionTestDeadline("portfolio-sensitivity-mixed")
  try {
    const fixture = await sensitivityObservationFixture(deadline, true)
    expect(fixture.companion).toMatchObject({ kind: "record", target: { surface: "procurement", recordType: "procurement-request" } })
    const counts = caseObservations(fixture, deadline)
    const result = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      counts.cases = 0
      const first = await fixture.units.issue(fixture.unitRequest, fixture.call)
      expect(first.status).toBe("ok")
      const originalReads = counts.cases
      expect(originalReads).toBeGreaterThan(2)
      const observe = fixture.business.withPlannerObservation
      try {
        fixture.business.withPlannerObservation = (_request, _call, work) => work()
        counts.cases = 0
        expect(await fixture.units.issue(fixture.unitRequest, fixture.call)).toEqual(first)
        expect(counts.cases).toBe(originalReads)
      } finally { fixture.business.withPlannerObservation = observe }
      return first
    })
    expect(result.status).toBe("ok")
    fixture.authority.ui.finish(fixture.call)
    const refused = await fixture.units.issue(fixture.unitRequest, fixture.call)
    expect(refused.status).not.toBe("ok")
    expect(Object.hasOwn(refused, "value")).toBe(false)
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
