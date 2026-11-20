import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createPlannerResultPersistence } from "../../../../product/planner/persistence.ts"
import { compareScenarios } from "../../../../product/planner/scenario-comparison-port.ts"
import type { PlannerScenarioHost } from "../../../../product/planner/scenario-comparison-port.ts"
import { resolveStoredPlannerScenarios } from "../../../../product/planner/stored-scenarios.ts"
import { scenarioBatchFixture } from "../../wp11/scenario-batch-fixture.ts"

type Fixture = Awaited<ReturnType<typeof scenarioBatchFixture>>
type Observation = ReturnType<Fixture["observe"]>

function ok<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

async function comparison(fixture: Fixture) {
  const observed = fixture.observe()
  const request = { scenarioRefs: fixture.saved, criteria: [] }
  const result = ok(await compareScenarios({ host: fixture.fixture.host, sources: fixture.sources, scenarios: observed.scenarios }, request, fixture.context))
  return { kind: "comparison" as const, request, result }
}

function persistence(fixture: Fixture, observed: Observation, scenarios = observed.scenarios,
  store: Parameters<typeof createPlannerResultPersistence>[0]["store"] = fixture.results) {
  return createPlannerResultPersistence({ store, scenarios, resolveCase: async (context) => {
    const current = await observed.cases.read({ caseRef: encodeCaseRef(fixture.caseRef) }, context)
    if (current.status !== "ok") return current
    const decision = current.value.case
    return { status: "ok", value: { id: decision.id, incarnation: decision.incarnation, version: decision.version } }
  } })
}

async function stateOf(fixture: Fixture) {
  const current = await fixture.state.read(fixture.request, "cases", (state) => state)
  if (current.status !== "ok") throw new Error("Real C08 observation unavailable")
  return current.value
}

test("C09 batches real siblings in both validation phases and preserves the persisted comparison", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const incoming = await comparison(fixture)
    expect(incoming.result).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    for (const batched of [true, false]) {
      const observed = fixture.observe()
      const scenarios: PlannerScenarioHost = batched ? observed.scenarios : { ...observed.scenarios,
        resolve: (reference, context) => observed.scenarios.resolve(reference, context) }
      const saved = ok(await persistence(fixture, observed, scenarios)(incoming, `comparison-${batched}`, fixture.context))
      const stored = ok(await fixture.results.read({ kind: "comparison", resultRef: saved.resultRef }, fixture.context))
      expect(stored.result).toEqual(incoming.result)
      expect(stored.requestDigest).toBe(digestSfValue(incoming.request))
      expect(observed.counts).toMatchObject({ cases: batched ? 7 : 11, stores: 8, forecasts: 4 })
    }
    const state = await stateOf(fixture)
    expect(state.cases[fixture.caseRef.id]!.choices).toEqual([])
    expect(state.cases[fixture.caseRef.id]!.preparedChanges).toEqual([])
    expect(state.cases[fixture.caseRef.id]!.receipts).toEqual([])
  } finally { await fixture.close() }
}, 60000)

test("the original scalar/batch pair keeps historical producer versions and separate cases in distinct groups", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const current = await fixture.changeCase((value) => ({ ...value, version: 2 }))
    const baseline = fixture.entries[0]!, selected = fixture.entries[1]!
    const newer = ok(await fixture.results.write({ kind: "scenario", caseRef: { id: current.id, incarnation: current.incarnation, version: current.version },
      result: baseline.result, requestDigest: digestSfValue(baseline.scenario), sourceRefs: baseline.result.sourceRefs, idempotencyKey: "c09-newer-producer" }, fixture.context))
    const other = ok(await fixture.results.write({ kind: "scenario", caseRef: fixture.otherCaseRef, result: selected.result,
      requestDigest: digestSfValue(selected.scenario), sourceRefs: selected.result.sourceRefs, idempotencyKey: "c09-other-case" }, fixture.context))
    const observed = fixture.observe()
    const references = [fixture.saved[1]!, newer.resultRef, other.resultRef, fixture.saved[1]!, "decision-result:missing"]
    const values = await resolveStoredPlannerScenarios({ ...observed.scenarios }, references, fixture.context)
    expect(values).toHaveLength(references.length)
    expect(values.slice(0, 4).map((value) => ok(value).result)).toEqual([selected.result, baseline.result, selected.result, selected.result])
    expect(values[4]).toEqual({ status: "unavailable", reason: "result-unavailable" })
    expect(observed.counts).toMatchObject({ cases: 6, stores: 9, forecasts: 4 })
    expect(ok(values[0]!)).not.toBe(ok(values[3]!))
    expect(ok(values[0]!).result).not.toBe(ok(values[3]!).result)
  } finally { await fixture.close() }
}, 60000)

test("a copied resolveMany cannot bypass an overridden scalar scenario reader before C09 writes", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const incoming = await comparison(fixture), observed = fixture.observe()
    const before = await stateOf(fixture)
    let scalarCalls = 0
    const scenarios: PlannerScenarioHost = { ...observed.scenarios, resolve: async (reference, context) => {
      scalarCalls++
      const value = await observed.scenarios.resolve(reference, context)
      return value.status === "ok" ? { status: "ok", value: { ...value.value, result: { ...value.value.result, id: "changed-scenario" } } } : value
    } }
    expect(await persistence(fixture, observed, scenarios)(incoming, "copied-batch-drift", fixture.context))
      .toEqual({ status: "stale", reason: "scenario-changed" })
    expect(scalarCalls).toBe(2)
    expect(await stateOf(fixture)).toEqual(before)
  } finally { await fixture.close() }
}, 60000)

for (const batch of ["replacement", "another-constructor"] as const) {
  test(`a ${batch} batch retains the original scalar fallback`, async () => {
    const fixture = await scenarioBatchFixture()
    try {
      const observed = fixture.observe(), foreign = fixture.observe()
      let called = false
      const scenarios: PlannerScenarioHost = { ...observed.scenarios, resolveMany: batch === "another-constructor" ? foreign.scenarios.resolveMany
        : async (references) => { called = true; return references.map(() => ({ status: "denied", reason: "replacement-batch" })) } }
      const values = await resolveStoredPlannerScenarios(scenarios, fixture.saved, fixture.context)
      expect(values.map((value) => ok(value).result)).toEqual(fixture.entries.map((entry) => entry.result))
      expect(called).toBe(false)
      expect(observed.counts).toMatchObject({ cases: 4, stores: 4, forecasts: 2 })
      expect(foreign.counts).toMatchObject({ cases: 0, stores: 0, forecasts: 0 })
    } finally { await fixture.close() }
  }, 60000)
}

test("an opaque scalar facade retains the original concurrent start schedule", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe(), release = Promise.withResolvers<void>(), starts: string[] = []
    const scenarios: PlannerScenarioHost = { ...observed.scenarios, resolve: async (reference, context) => {
      starts.push(reference)
      await release.promise
      return observed.scenarios.resolve(reference, context)
    } }
    const pending = resolveStoredPlannerScenarios(scenarios, fixture.saved, fixture.context)
    try {
      await Promise.resolve()
      expect(starts).toEqual(fixture.saved)
    } finally { release.resolve() }
    expect((await pending).map((value) => ok(value).result)).toEqual(fixture.entries.map((entry) => entry.result))
    expect(observed.counts).toMatchObject({ cases: 4, stores: 4, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)

for (const method of ["resolve", "resolveMany"] as const) {
  test(`C09 refuses ${method} changed during the original batch without restarting through the facade`, async () => {
    const fixture = await scenarioBatchFixture()
    try {
      const incoming = await comparison(fixture), observed = fixture.observe()
      const before = await stateOf(fixture)
      let reached = false, replacementCalls = 0
      observed.hooks.afterForecast = async (count) => {
        if (count !== 1) return
        reached = true
        if (method === "resolve") observed.scenarios.resolve = async () => { replacementCalls++; return { status: "denied", reason: "replacement-scalar" } }
        else observed.scenarios.resolveMany = async (references) => { replacementCalls++; return references.map(() => ({ status: "denied", reason: "replacement-batch" })) }
      }
      expect(await persistence(fixture, observed)(incoming, `changed-${method}`, fixture.context))
        .toEqual({ status: "denied", reason: "scenario-reader-changed" })
      expect(reached).toBe(true)
      expect(replacementCalls).toBe(0)
      expect(observed.counts).toMatchObject({ stores: 4, forecasts: 2 })
      expect(await stateOf(fixture)).toEqual(before)
    } finally { await fixture.close() }
  }, 60000)
}

test("C09 passes bare result references through every opaque historical admission", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const incoming = await comparison(fixture), observed = fixture.observe()
    const before = await stateOf(fixture), references: string[] = []
    const store = { ...fixture.results, readHistoricalScenario: async (request: { resultRef: string }) => {
      references.push(request.resultRef)
      return { status: "denied" as const, reason: "historical-facade-refused" }
    } }
    expect(await persistence(fixture, observed, observed.scenarios, store)(incoming, "opaque-historical", fixture.context))
      .toEqual({ status: "denied", reason: "historical-facade-refused" })
    expect(references).toEqual(fixture.saved)
    expect(observed.counts).toMatchObject({ stores: 0, forecasts: 0 })
    expect(await stateOf(fixture)).toEqual(before)
  } finally { await fixture.close() }
}, 60000)

test("C09 starts a new sibling observation after its actual write and detects a changed current case", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const incoming = await comparison(fixture), observed = fixture.observe()
    let committed = false
    const store: typeof fixture.results = { ...fixture.results, write: async (...args) => {
      const saved = await fixture.results.write(...args)
      if (args[0].kind === "comparison" && saved.status === "ok") {
        committed = true
        await fixture.changeCase((decision) => ({ ...decision, version: decision.version + 1 }))
      }
      return saved
    } }
    expect(await persistence(fixture, observed, observed.scenarios, store)(incoming, "postwrite-case", fixture.context))
      .toEqual({ status: "stale", reason: "comparison-case-changed" })
    expect(committed).toBe(true)
    expect(observed.counts).toMatchObject({ cases: 7, stores: 8, forecasts: 4 })
    const state = await stateOf(fixture)
    expect(Object.values(state.decisionResults ?? {}).filter((value) => value.kind === "comparison")).toHaveLength(1)
    expect(state.cases[fixture.caseRef.id]!.version).toBe(fixture.caseRef.version + 1)
    expect(state.cases[fixture.caseRef.id]!.choices).toEqual([])
  } finally { await fixture.close() }
}, 60000)
