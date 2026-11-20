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
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
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

type MetricFixture = Awaited<ReturnType<typeof metricFixture>>

// Observe the actual C08 result envelopes without wrapping the selector or
// replacing its producer. This keeps the original state admission path intact.
function metricResultObservations(fixture: MetricFixture, deadline: ReturnType<typeof compositionTestDeadline>,
  afterObservation?: (references: readonly string[]) => void) {
  const observations: string[][] = []
  const read = fixture.authority.state.read
  fixture.authority.state.read = async (request, namespace, select) => {
    const result = await read(request, namespace, select)
    if (namespace === "cases" && result.status === "ok") {
      const values: readonly unknown[] = Array.isArray(result.value) ? result.value : [result.value]
      const references = values.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || !("stored" in entry)) return []
        const stored = entry.stored
        return stored && typeof stored === "object" && "kind" in stored && stored.kind === "scenario" &&
          "resultRef" in stored && typeof stored.resultRef === "string" ? [stored.resultRef] : []
      })
      if (references.length && references.length === values.length) {
        observations.push(references)
        afterObservation?.(references)
      }
    }
    return result
  }
  deadline.own(() => { fixture.authority.state.read = read })
  return observations
}

function expectedMetricObservations(request: MetricFixture["request"], batch: boolean) {
  const first = Array.from({ length: 3 }, () => [request.scenarioRef])
  const phases = batch ? Array.from({ length: 12 }, () => [request.baselineRef, request.scenarioRef])
    : Array.from({ length: 2 }, () => [
      ...Array.from({ length: 6 }, () => [request.baselineRef]),
      ...Array.from({ length: 6 }, () => [request.scenarioRef]),
    ]).flat()
  return [...first, ...phases]
}

test("Portfolio metric observes both canonical batch phases afresh and keeps opaque scalar calls sequential", async () => {
  const deadline = compositionTestDeadline("portfolio-metric-batch")
  try {
    const fixture = await metricFixture(deadline)
    const observations = metricResultObservations(fixture, deadline)
    const resolve = fixture.scenarios.resolve
    const scalarReads: string[] = []
    let active = 0, peak = 0
    deadline.own(() => { fixture.scenarios.resolve = resolve })
    const values: Awaited<ReturnType<typeof fixture.portfolio.readMetric>>[] = []
    for (const batch of [true, true, false]) {
      fixture.scenarios.resolve = batch ? resolve : async (reference, call) => {
        active++
        peak = Math.max(peak, active)
        try {
          const result = await resolve(reference, call)
          scalarReads.push(reference)
          return result
        } finally { active-- }
      }
      observations.length = 0
      const value = await deadline.phase(batch ? "metric.canonical" : "metric.opaque", () =>
        fixture.business.withCase(fixture.call, fixture.caseRef, {}, () => fixture.portfolio.readMetric(fixture.request, fixture.call)))
      expect(value).toMatchObject({ status: "ok", value: { value: -240, state: "conditioned", evidenceRefs: fixture.sources } })
      expect(observations).toEqual(expectedMetricObservations(fixture.request, batch))
      values.push(value)
    }
    expect(values[1]).toEqual(values[0])
    expect(values[2]).toEqual(values[0])
    expect(scalarReads).toEqual([fixture.request.baselineRef, fixture.request.scenarioRef, fixture.request.baselineRef, fixture.request.scenarioRef])
    expect(peak).toBe(1)
    expect(active).toBe(0)
  } finally { await deadline.close() }
}, 120_000)

test("Portfolio metric batches result envelopes while preserving separate historical case observations", async () => {
  const deadline = compositionTestDeadline("portfolio-metric-historical-batch")
  try {
    const fixture = await metricFixture(deadline)
    const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[fixture.caseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("Current metric case unavailable")
    const next = { ...current.value, version: current.value.version + 1 }
    const advanced = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: next.id, targetIncarnation: next.incarnation, idempotencyKey: "metric-newer-case", commandDigest: digestSfValue(next) }, async (state) => {
      state.cases[next.id] = next
      return { commit: true, value: true }
    })
    if (advanced.status !== "ok" || !advanced.value) throw new Error("Metric case advance unavailable")
    const caseRef = { id: next.id, incarnation: next.incarnation, version: next.version }
    // Re-record the actual produced baseline through C09 at the later case
    // version. The candidate retains its original producer version.
    const saved = await fixture.business.withCase(fixture.call, caseRef, {}, async () => {
      const baseline = await fixture.business.results.readHistoricalScenario({ resultRef: fixture.request.baselineRef }, fixture.call)
      if (baseline.status !== "ok") return baseline
      if (baseline.value.kind !== "scenario") throw new Error("Actual baseline is not a scenario")
      return fixture.business.results.write({ kind: "scenario", caseRef, result: baseline.value.result,
        requestDigest: baseline.value.requestDigest, sourceRefs: baseline.value.sourceRefs, idempotencyKey: "metric-newer-baseline" }, fixture.call)
    })
    if (saved.status !== "ok") throw new Error(`Actual later baseline unavailable: ${saved.reason}`)
    const request = { ...fixture.request, caseRef, baselineRef: saved.value.resultRef }
    const observations = metricResultObservations(fixture, deadline)
    const read = fixture.business.cases.read, resolve = fixture.scenarios.resolve
    let caseReads = 0
    fixture.business.cases.read = async (incoming, call) => {
      caseReads++
      return read(incoming, call)
    }
    deadline.own(() => { fixture.business.cases.read = read; fixture.scenarios.resolve = resolve })
    const counts: number[] = []
    const values: Awaited<ReturnType<typeof fixture.portfolio.readMetric>>[] = []
    for (const batch of [true, false]) {
      fixture.scenarios.resolve = batch ? resolve : (reference, call) => resolve(reference, call)
      observations.length = 0
      caseReads = 0
      const value = await deadline.phase(batch ? "metric.historical-batch" : "metric.historical-scalar", () =>
        fixture.business.withCase(fixture.call, caseRef, {}, () => fixture.portfolio.readMetric(request, fixture.call)))
      expect(value).toMatchObject({ status: "ok", value: { caseRef, baselineRef: saved.value.resultRef, value: -240, state: "conditioned" } })
      expect(observations).toEqual(expectedMetricObservations(request, batch))
      counts.push(caseReads)
      values.push(value)
    }
    expect(values[1]).toEqual(values[0])
    expect(counts[0]).toBeGreaterThan(0)
    expect(counts[1]).toBe(counts[0])
  } finally { await deadline.close() }
}, 120_000)

test("Portfolio metric never invokes a replaced batch through an unchanged scalar reader", async () => {
  const deadline = compositionTestDeadline("portfolio-metric-replaced-batch")
  try {
    const fixture = await metricFixture(deadline)
    const observations = metricResultObservations(fixture, deadline)
    const batch = fixture.scenarios.resolveMany
    let replacedCalls = 0
    fixture.scenarios.resolveMany = async (references) => {
      replacedCalls++
      return references.map(() => ({ status: "denied", reason: "foreign-batch" }))
    }
    deadline.own(() => { fixture.scenarios.resolveMany = batch })
    const value = await deadline.phase("metric.replaced-batch", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.portfolio.readMetric(fixture.request, fixture.call)))
    expect(value).toMatchObject({ status: "ok", value: { value: -240, state: "conditioned" } })
    expect(replacedCalls).toBe(0)
    expect(observations).toEqual(expectedMetricObservations(fixture.request, false))
  } finally { await deadline.close() }
}, 120_000)

for (const method of ["scalar", "batch"] as const) test(`Portfolio metric refuses an original ${method} changing during a canonical batch`, async () => {
  const deadline = compositionTestDeadline(`portfolio-metric-mid-batch-${method}`)
  try {
    const fixture = await metricFixture(deadline)
    const resolve = fixture.scenarios.resolve, batch = fixture.scenarios.resolveMany
    let changed = false, replacementCalls = 0
    deadline.own(() => { fixture.scenarios.resolve = resolve; fixture.scenarios.resolveMany = batch })
    metricResultObservations(fixture, deadline, (references) => {
      if (changed || references.length !== 2) return
      changed = true
      if (method === "scalar") fixture.scenarios.resolve = async () => {
        replacementCalls++
        return { status: "denied", reason: "changed-scalar" }
      }
      if (method === "batch") fixture.scenarios.resolveMany = async (selected) => {
        replacementCalls++
        return selected.map(() => ({ status: "denied", reason: "changed-batch" }))
      }
    })
    const value = await deadline.phase("metric.reader-drift", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.portfolio.readMetric(fixture.request, fixture.call)))
    expect(changed).toBe(true)
    expect(value).toEqual({ status: "denied", reason: "scenario-reader-changed" })
    expect(Object.hasOwn(value, "value")).toBe(false)
    expect(replacementCalls).toBe(0)
  } finally { await deadline.close() }
}, 120_000)
