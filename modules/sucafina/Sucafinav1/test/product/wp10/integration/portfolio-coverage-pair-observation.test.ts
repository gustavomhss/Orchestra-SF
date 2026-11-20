import { AsyncLocalStorage } from "node:async_hooks"
import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortfolioCoverageAuthority } from "../../../../product/portfolio/coverage-preview.ts"
import { createSfPortfolioCoverageAuthority } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-coverage-authority.ts"
import { plannerObservationFixture } from "./planner-observation-batch-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<Value>(result: PortResult<Value>, label: string): Value {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

async function coveragePairFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await plannerObservationFixture(deadline, false, {
    sharedBase: true, humanActions: ["decisions.select-portfolio"],
  })
  const initial = await fixture.authority.state.read(fixture.stateRequest(), "cases", (state) => state)
  if (initial.status !== "ok") throw new Error("The real coverage case is unavailable")
  const decision = initial.value.cases[fixture.caseRef.id]!
  const stored = initial.value.decisionResults?.[fixture.request.scenarioRef]
  const baseline = initial.value.decisionResults?.[fixture.request.baselineRef]
  if (!stored || !baseline) throw new Error("The two original C09 results are required")
  const selected = decision.alternatives.filter((alternative) =>
    digestSfValue(alternative.scenario) === stored.requestDigest && digestSfValue(alternative.result) === stored.resultDigest)
  const baselines = decision.alternatives.filter((alternative) =>
    digestSfValue(alternative.scenario) === baseline.requestDigest && digestSfValue(alternative.result) === baseline.resultDigest)
  if (selected.length !== 1 || baselines.length !== 1) throw new Error("The human pair must be uniquely bound")
  const selection = { caseRef: fixture.caseRef, baselineAlternativeId: baselines[0]!.id,
    alternativeId: selected[0]!.id, criteria: ["cost"], expectedVersion: 0 }
  const admitted = ok(await fixture.authority.human.admit(fixture.stateRequest(), "decisions.select-portfolio", selection), "Human portfolio selection")
  const registered = await deadline.phase("coverage.select-pair", () => fixture.business.withCase(admitted, fixture.caseRef, {}, () =>
    fixture.portfolio.selection.register(selection, admitted))).finally(() => fixture.authority.human.finish(admitted))
  ok(registered, "Current portfolio selection")
  const request: SensitivityRequest = { scenarioRef: fixture.request.scenarioRef,
    parameterBounds: { parameterRef: "line:1", minimum: 0, maximum: 400, steps: 2 },
    criterion: { id: "cost", operator: "lte", value: 0 } }
  const pair = { scenarioRefs: [request.scenarioRef, fixture.request.baselineRef], criteria: [] as string[] }
  const resolve = createSfPortfolioCoverageAuthority({ authority: fixture.authority, business: fixture.business, registries: fixture.portfolio })
  const run = () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
    resolve(request, fixture.request.baselineRef, fixture.call))
  const capture = async () => ({
    state: await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor })),
    snapshots: await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) })),
  })
  return { ...fixture, request, pair, run, capture }
}

type Fixture = Awaited<ReturnType<typeof coveragePairFixture>>
type Mode = "logical" | "physical"
type Fault = "source" | "reader"
type PairObservation = { mode: Mode; request: unknown; physical: number; roots: number; cases: number;
  sources: string[]; coverage: string[]; caseRequests: unknown[]; caseStatuses: string[]; callsMatch: boolean; status?: string }

function observeCoveragePairs(fixture: Fixture, deadline: ReturnType<typeof compositionTestDeadline>, fault?: Fault) {
  const observations: PairObservation[] = []
  const pair = new AsyncLocalStorage<PairObservation>()
  const physical = new AsyncLocalStorage<boolean>()
  const counters = { mode: "physical" as Mode, changed: false, faultOutsideRoot: false, replacementCalls: 0 }
  const observe = fixture.business.withPlannerObservation, cases = fixture.business.cases.read
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const source = fixture.business.plannerSources.resolveForecastSource, coverage = fixture.business.plannerSources.resolveForecastCoverage
  fixture.store.transaction = (surface, work, options) => {
    const current = pair.getStore()
    if (current && !physical.getStore()) current.physical++
    return transaction(surface, (...args) => physical.run(true, () => work(...args)), options)
  }
  fixture.store.transactionAll = (work, options) => {
    const current = pair.getStore()
    if (current && !physical.getStore()) current.physical++
    return all((...args) => physical.run(true, () => work(...args)), options)
  }
  fixture.store.readSnapshotRoot = async (work, options) => {
    const current = pair.getStore()
    if (current) { current.roots++; if (!physical.getStore()) current.physical++ }
    const value = await root(() => physical.run(true, work), options)
    if (current && counters.mode === "physical" && fault && !counters.changed) {
      counters.changed = true
      counters.faultOutsideRoot = !physical.getStore() && fixture.store.currentSnapshots() === undefined
      if (fault === "reader") fixture.business.plannerSources.resolveForecastSource = (...args) => {
        counters.replacementCalls++
        return source(...args)
      }
      if (fault === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
        const current = versions.find((version) => version.id === "v1")
        if (!current) throw new Error("The actual candidate source is unavailable")
        current.lines[0]!.f[0] = 81
        return { commit: true, value: undefined }
      })
    }
    return value
  }
  fixture.business.cases.read = async (request, call) => {
    const current = pair.getStore()
    if (current) { current.cases++; current.caseRequests.push(structuredClone(request)); current.callsMatch &&= call === fixture.call }
    const result = await cases(request, call)
    current?.caseStatuses.push(result.status)
    return result
  }
  fixture.business.plannerSources.resolveForecastSource = (...args) => {
    const current = pair.getStore()
    if (current) { current.sources.push(args[0]); current.callsMatch &&= args[1] === fixture.call }
    return source(...args)
  }
  fixture.business.plannerSources.resolveForecastCoverage = (...args) => {
    const current = pair.getStore()
    if (current) { current.coverage.push(args[0]); current.callsMatch &&= args[1] === fixture.call }
    return coverage(...args)
  }
  fixture.business.withPlannerObservation = (request, call, work) => {
    if (digestSfValue(request) !== digestSfValue(fixture.pair)) return observe(request, call, work)
    const current: PairObservation = { mode: counters.mode, request: structuredClone(request), physical: 0, roots: 0,
      cases: 0, sources: [], coverage: [], caseRequests: [], caseStatuses: [], callsMatch: true }
    observations.push(current)
    return pair.run(current, async () => {
      // The control retains the already-qualified logical case observation.
      // Only the additional physical span is disabled for this exact pair.
      const result = counters.mode === "logical"
        ? await fixture.business.withScenarioObservation({ caseRef: fixture.caseRef, request }, call, work)
        : await observe(request, call, work)
      current.status = result.status
      return result
    })
  }
  deadline.own(() => {
    fixture.business.withPlannerObservation = observe
    fixture.business.cases.read = cases
    fixture.store.transaction = transaction
    fixture.store.transactionAll = all
    fixture.store.readSnapshotRoot = root
    fixture.business.plannerSources.resolveForecastSource = source
    fixture.business.plannerSources.resolveForecastCoverage = coverage
  })
  return { observations, counters }
}

function observedData(value: PortfolioCoverageAuthority, started: number, finished: number) {
  const { isStillValid, ...data } = value
  const evidence = data.evidence.map((item) => {
    const { checkedAt, ...fields } = item
    const observed = Date.parse(checkedAt)
    // The producer uses the real observation clock, independently for each read.
    expect(Number.isFinite(observed)).toBe(true)
    expect(observed).toBeGreaterThanOrEqual(started)
    expect(observed).toBeLessThanOrEqual(finished)
    expect(new Date(observed).toISOString()).toBe(checkedAt)
    return fields
  })
  return { data: { ...data, evidence }, isStillValid }
}

test("coverage authority scopes its exact candidate and baseline pair and repeats fresh proofs for validation", async () => {
  const deadline = compositionTestDeadline("coverage-authority-pair")
  try {
    const fixture = await coveragePairFixture(deadline)
    const before = await fixture.capture()
    const observed = observeCoveragePairs(fixture, deadline)
    observed.counters.mode = "logical"
    const controlStarted = Date.now()
    const control = ok(await deadline.phase("coverage.control", fixture.run), "Canonical coverage authority")
    const controlData = observedData(control, controlStarted, Date.now())
    expect(await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () =>
      ({ status: "ok" as const, value: await control.isStillValid(fixture.call) }))).toEqual({ status: "ok", value: true })
    const expected = observed.observations.splice(0)
    expect(expected).toHaveLength(3)
    observed.counters.mode = "physical"
    const actualStarted = Date.now()
    const actual = ok(await deadline.phase("coverage.observed", fixture.run), "Scoped coverage authority")
    const actualData = observedData(actual, actualStarted, Date.now())
    expect(actualData.data).toEqual(controlData.data)
    expect(actualData.isStillValid).not.toBe(controlData.isStillValid)
    expect(actual.storedResult.costCoverage.coverageState).toBe("pending")
    expect(actual.storedResult.costCoverage.entries.find((entry) => entry.categoryId === "training")?.status).toBe("pending")
    expect(await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () =>
      ({ status: "ok" as const, value: await actual.isStillValid(fixture.call) }))).toEqual({ status: "ok", value: true })
    expect(observed.observations).toHaveLength(3)
    for (const [index, current] of observed.observations.entries()) {
      const previous = expected[index]!
      expect(current.request).toEqual(fixture.pair)
      expect(current.status).toBe("ok")
      expect(current.cases).toBe(previous.cases)
      expect(current.caseRequests).toEqual(previous.caseRequests)
      expect(current.callsMatch).toBe(true)
      expect(previous.callsMatch).toBe(true)
      expect(current.caseStatuses).toEqual(previous.caseStatuses)
      expect(current.caseStatuses.every((status) => status === "ok")).toBe(true)
      expect(current.sources).toEqual(previous.sources)
      expect(current.sources.length).toBeGreaterThan(0)
      expect(current.coverage).toEqual(previous.coverage)
      expect(current.physical).toBeLessThan(previous.physical)
      expect(current.roots).toBeGreaterThan(0)
    }
    expect(await fixture.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

for (const fault of ["source", "reader"] as const) test("coverage pair refuses " + fault + " change after closing its readonly root", async () => {
  const deadline = compositionTestDeadline("coverage-authority-pair-" + fault)
  try {
    const fixture = await coveragePairFixture(deadline)
    const before = await fixture.capture()
    const observed = observeCoveragePairs(fixture, deadline, fault)
    const result = await deadline.phase("coverage.egress", fixture.run)
    expect(observed.counters.changed).toBe(true)
    expect(observed.counters.faultOutsideRoot).toBe(true)
    expect(observed.counters.replacementCalls).toBe(0)
    expect(observed.observations).toHaveLength(1)
    expect(result.status).not.toBe("ok")
    const after = await fixture.capture()
    expect(after.state).toEqual(before.state)
    expect(after.snapshots.dashboard).toEqual(before.snapshots.dashboard)
    expect(after.snapshots.procurement).toEqual(before.snapshots.procurement)
    if (fault === "source") {
      expect(after.snapshots.planner).not.toEqual(before.snapshots.planner)
      const versions = after.snapshots.planner.data.versions as { id: string; lines: { f: number[] }[] }[]
      expect(versions.find((version) => version.id === "v1")!.lines[0]!.f[0]).toBe(81)
    } else expect(after.snapshots.planner).toEqual(before.snapshots.planner)
  } finally { await deadline.close() }
}, 120_000)
