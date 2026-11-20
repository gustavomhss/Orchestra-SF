import { AsyncLocalStorage } from "node:async_hooks"
import { expect, test } from "bun:test"
import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { SF_SIGNAL_REGISTRY_PREFIX } from "../../../../product/decision-memory/signal-registry.ts"
import { memoryMaterialityFixture } from "./memory-materiality-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Fixture = Awaited<ReturnType<typeof memoryMaterialityFixture>>
type Fault = "reader" | "source"
type Mode = "logical" | "physical"
type Observation = { kind: "selection" | "producer"; mode: Mode; request: unknown; call: TrustedDomainContext;
  physical: number; roots: number; callsMatch: boolean; status?: string;
  before: { cases: number; sources: number; coverage: number; frames: number; comparisons: number };
  after?: { cases: number; sources: number; coverage: number; frames: number; comparisons: number } }

function observeMateriality(fixture: Fixture, deadline: ReturnType<typeof compositionTestDeadline>, fault?: Fault) {
  const cases = fixture.business.cases.read, stateRead = fixture.authority.state.read
  const source = fixture.business.plannerSources.resolveForecastSource, compare = fixture.business.planner.compareScenarios
  const coverage = fixture.business.plannerSources.resolveForecastCoverage
  const scalar = fixture.scenarios.resolve, observe = fixture.business.withPlannerObservation
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const observations = new AsyncLocalStorage<Observation>(), physical = new AsyncLocalStorage<boolean>()
  const reads = { concurrent: 0, maximum: 0, cases: [] as string[], caseRequests: [] as unknown[], envelopes: [] as unknown[],
    sources: [] as { reference: string; status: string }[],
    coverage: [] as { reference: string; status: string }[],
    resultFrames: [] as { resultRef: unknown; caseRef: unknown; resultDigest: unknown }[][],
    comparisons: [] as { request: unknown; beforeFrames: number; afterFrames: number; sources: number;
      result: Awaited<ReturnType<typeof compare>> }[],
    observations: [] as Observation[], mode: "physical" as Mode,
    armedAt: 0, faultFrames: 0, faultComparisons: 0,
    changed: false, faultOutsideRoot: false, replacementCalls: 0 }
  const counts = () => ({ cases: reads.cases.length, sources: reads.sources.length, coverage: reads.coverage.length,
    frames: reads.resultFrames.length, comparisons: reads.comparisons.length })
  fixture.store.transaction = (surface, work, options) => {
    const current = observations.getStore()
    if (current && !physical.getStore()) current.physical++
    return transaction(surface, (...args) => physical.run(true, () => work(...args)), options)
  }
  fixture.store.transactionAll = (work, options) => {
    const current = observations.getStore()
    if (current && !physical.getStore()) current.physical++
    return all((...args) => physical.run(true, () => work(...args)), options)
  }
  fixture.store.readSnapshotRoot = async (work, options) => {
    const current = observations.getStore()
    if (current) { current.roots++; if (!physical.getStore()) current.physical++ }
    const value = await root(() => physical.run(true, work), options)
    // Arm at the first direct batch's final C08 envelope; change the real
    // dependency only after this completed producer's physical root closes.
    if (fault && current?.kind === "producer" && reads.armedAt && !reads.changed) {
      reads.changed = true
      reads.faultFrames = reads.resultFrames.length
      reads.faultComparisons = reads.comparisons.length
      reads.faultOutsideRoot = !physical.getStore() && fixture.store.currentSnapshots() === undefined
      if (fault === "reader") fixture.scenarios.resolve = (...args) => { reads.replacementCalls++; return scalar(...args) }
      if (fault === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
        const actual = versions.find((version) => version.id === "v1")
        if (!actual) throw new Error("The actual materiality source is missing")
        actual.lines[0]!.f[0] = 81
        return { commit: true, value: undefined }
      })
    }
    return value
  }
  fixture.business.cases.read = async (request, call) => {
    reads.concurrent++
    reads.maximum = Math.max(reads.maximum, reads.concurrent)
    const current = observations.getStore()
    if (current) current.callsMatch &&= call === current.call
    try {
      const result = await cases(request, call)
      reads.cases.push(result.status)
      reads.caseRequests.push(structuredClone(request))
      return result
    } finally { reads.concurrent-- }
  }
  fixture.business.plannerSources.resolveForecastSource = async (reference, call) => {
    const current = observations.getStore()
    if (current) current.callsMatch &&= call === current.call
    const result = await source(reference, call)
    reads.sources.push({ reference, status: result.status })
    return result
  }
  fixture.business.plannerSources.resolveForecastCoverage = async (reference, call) => {
    const current = observations.getStore()
    if (current) current.callsMatch &&= call === current.call
    const result = await coverage(reference, call)
    reads.coverage.push({ reference, status: result.status })
    return result
  }
  fixture.business.planner.compareScenarios = async (request, call) => {
    const current = observations.getStore()
    if (current) current.callsMatch &&= call === current.call
    const beforeFrames = reads.resultFrames.length
    const result = await compare(request, call)
    reads.comparisons.push({ request: structuredClone(request), beforeFrames,
      afterFrames: reads.resultFrames.length, sources: reads.sources.length, result: structuredClone(result) })
    return result
  }
  fixture.authority.state.read = async (request, namespace, select) => {
    const result = await stateRead(request, namespace, select)
    if (namespace !== "cases" || result.status !== "ok" || !Array.isArray(result.value)) return result
    const values = result.value.map(object)
    if (values.length !== 2 || !values.every((value, index) =>
      object(value.stored).resultRef === fixture.signal.scenarioRefs[index])) return result
    reads.envelopes.push(structuredClone(result))
    reads.resultFrames.push(values.map((value) => ({ resultRef: object(value.stored).resultRef,
      caseRef: structuredClone(object(value.stored).caseRef), resultDigest: object(value.stored).resultDigest })))
    // Two registry authorizations consume 12 envelopes. The next six are the
    // producer's first load. Keep recording all later callbacks before egress.
    if (reads.resultFrames.length === 18 && fault) reads.armedAt = 18
    return result
  }
  fixture.business.withPlannerObservation = (request, call, work) => {
    const value = object(request)
    if (digestSfValue(value.scenarioRefs) !== digestSfValue(fixture.signal.scenarioRefs) ||
      !Array.isArray(value.criteria) || value.criteria.length > 1 ||
      value.criteria.length === 1 && value.criteria[0] !== fixture.signal.criterionId) return observe(request, call, work)
    const current: Observation = { kind: value.criteria.length ? "producer" : "selection", mode: reads.mode,
      request: structuredClone(request), call, physical: 0, roots: 0, callsMatch: true, before: counts() }
    reads.observations.push(current)
    return observations.run(current, async () => {
      try {
        // Keep the already-qualified logical proof owner in the control.
        // Only the additional physical span is omitted.
        const result = reads.mode === "logical"
          ? await fixture.business.withScenarioObservation({ caseRef: fixture.signal.caseRef, request }, call, work)
          : await observe(request, call, work)
        current.status = result.status
        return result
      } finally { current.after = counts() }
    })
  }
  deadline.own(() => {
    fixture.business.cases.read = cases
    fixture.authority.state.read = stateRead
    fixture.business.plannerSources.resolveForecastSource = source
    fixture.business.plannerSources.resolveForecastCoverage = coverage
    fixture.business.planner.compareScenarios = compare
    fixture.business.withPlannerObservation = observe
    fixture.store.transaction = transaction
    fixture.store.transactionAll = all
    fixture.store.readSnapshotRoot = root
    fixture.scenarios.resolve = scalar
  })
  return reads
}

test("materiality reads both real producer versions twice after registering a human condition", async () => {
  const deadline = compositionTestDeadline("memory-materiality-registered-batch")
  try {
    const fixture = await memoryMaterialityFixture(deadline)
    const before = await fixture.capture()
    if (before.state.status !== "ok") throw new Error("The initial protected envelope is unavailable")
    const stored = fixture.signal.scenarioRefs.map((ref) => before.state.value.state.decisionResults?.[ref])
    expect(stored.every((value) => value?.kind === "scenario")).toBe(true)
    expect(stored.map((value) => value?.caseRef.version)).toEqual([fixture.caseRef.version, fixture.signal.caseRef.version])
    expect(fixture.signal.caseRef.version).toBe(fixture.caseRef.version + 1)
    expect(object(before.state.value.state.preferences[SF_SIGNAL_REGISTRY_PREFIX + fixture.conditionId]).selection).toEqual(fixture.signal)
    const observed = observeMateriality(fixture, deadline)
    const response = await deadline.phase("memory.materiality", fixture.readMateriality)
    expect(response.status).toBe(200)
    expect(response.body.status).toBe("ok")
    const impact = object(response.body.impact), signal = object(response.body.signal), snapshot = object(response.body.snapshot)
    const change = object(snapshot.change), comparison = object(change.comparison)
    expect(impact.conditionId).toBe(fixture.conditionId)
    expect(impact.state).toBe("unknown")
    expect(impact.reason).toBe("evidence-unavailable")
    expect(signal.severity).toBe("unknown")
    expect(signal.originalReason).toBe(fixture.choice.reason)
    expect(object(snapshot.condition).choice).toEqual(fixture.choice)
    expect(change.availability).toBe("available")
    expect(comparison.before).toEqual(fixture.choice.comparison)
    expect(comparison.resultBefore).toEqual(fixture.choice.result)
    expect(comparison.resultAfter).toEqual(fixture.candidate.result)
    expect(object(comparison.after).baselineResultRef).toBe(fixture.signal.scenarioRefs[0])
    expect(object(comparison.after).alternativeResultRef).toBe(fixture.signal.scenarioRefs[1])
    expect(observed.maximum).toBe(1)
    expect(observed.cases.length).toBeGreaterThan(0)
    expect(observed.cases.every((status) => status === "ok")).toBe(true)
    expect(observed.comparisons).toHaveLength(4)
    expect(observed.comparisons.map((entry) => entry.request)).toEqual(Array.from({ length: 4 }, () =>
      ({ scenarioRefs: fixture.signal.scenarioRefs, criteria: [fixture.signal.criterionId] })))
    expect(observed.comparisons.map((entry) => entry.result)).toEqual(Array.from({ length: 4 }, () => observed.comparisons[0]!.result))
    expect(observed.comparisons[0]!.result.status).toBe("ok")
    // Both materiality load passes remain independent in each of the two
    // complete source observations. Registry reauthorization remains between.
    expect(observed.comparisons[0]!.beforeFrames).toBe(18)
    expect(observed.comparisons[1]!.beforeFrames - observed.comparisons[0]!.afterFrames).toBe(6)
    expect(observed.comparisons[2]!.beforeFrames - observed.comparisons[1]!.afterFrames).toBe(30)
    expect(observed.comparisons[3]!.beforeFrames - observed.comparisons[2]!.afterFrames).toBe(6)
    expect(observed.resultFrames.length - observed.comparisons[3]!.afterFrames).toBe(12)
    const frame = stored.map((value) => ({ resultRef: value!.resultRef, caseRef: value!.caseRef, resultDigest: value!.resultDigest }))
    expect(observed.resultFrames).toEqual(Array.from({ length: observed.resultFrames.length }, () => frame))
    expect(observed.sources.every((entry) => entry.status === "ok")).toBe(true)
    for (const ref of fixture.sources) expect(observed.sources.some((entry) => entry.reference === ref.refId)).toBe(true)
    for (const [index, entry] of observed.comparisons.entries()) {
      expect(entry.sources).toBeGreaterThan(index ? observed.comparisons[index - 1]!.sources : 0)
    }
    expect(await fixture.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

for (const fault of ["reader", "source"] as const) {
  test("materiality refuses " + fault + " drift after its completed readonly producer and before fresh egress", async () => {
    const deadline = compositionTestDeadline("memory-materiality-final-" + fault)
    try {
      const fixture = await memoryMaterialityFixture(deadline)
      const before = await fixture.capture()
      if (before.state.status !== "ok") throw new Error("The initial protected envelope is unavailable")
      const observed = observeMateriality(fixture, deadline, fault)
      const response = await deadline.phase("memory.materiality", fixture.readMateriality)
      expect(observed.changed).toBe(true)
      expect(observed.faultOutsideRoot).toBe(true)
      expect(observed.armedAt).toBe(18)
      expect(observed.faultComparisons).toBe(2)
      expect(observed.resultFrames).toHaveLength(observed.faultFrames)
      expect(observed.faultFrames).toBe(observed.comparisons[1]!.afterFrames)
      expect(observed.maximum).toBe(1)
      expect(observed.replacementCalls).toBe(0)
      expect(observed.comparisons).toHaveLength(2)
      expect(observed.comparisons.map((entry) => entry.result.status)).toEqual(["ok", "ok"])
      expect(observed.comparisons[0]!.beforeFrames).toBe(18)
      expect(observed.comparisons[1]!.beforeFrames - observed.comparisons[0]!.afterFrames).toBe(6)
      expect(observed.observations.filter((entry) => entry.kind === "producer")).toHaveLength(1)
      expect(response).toEqual({ status: 503, body: { status: "unavailable" } })
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
}

test("materiality scopes each real selection and producer independently while preserving all canonical callbacks", async () => {
  const deadline = compositionTestDeadline("memory-materiality-observation")
  try {
    const fixture = await memoryMaterialityFixture(deadline)
    const before = await fixture.capture()
    const observed = observeMateriality(fixture, deadline)
    observed.mode = "logical"
    const control = await deadline.phase("memory.materiality.control", fixture.readMateriality)
    expect(control.status).toBe(200)
    expect(control.body.status).toBe("ok")
    const expected = observed.observations.splice(0)
    expect(expected.filter((entry) => entry.kind === "selection")).toHaveLength(8)
    expect(expected.filter((entry) => entry.kind === "producer")).toHaveLength(2)
    observed.mode = "physical"
    const actual = await deadline.phase("memory.materiality.observed", fixture.readMateriality)
    expect(actual).toEqual(control)
    expect(observed.observations).toHaveLength(expected.length)
    for (const [index, current] of observed.observations.entries()) {
      const previous = expected[index]!
      if (!current.after || !previous.after) throw new Error("A complete canonical observation is required")
      expect(current.request).toEqual(previous.request)
      expect(current.kind).toBe(previous.kind)
      expect(current.status).toBe("ok")
      expect(previous.status).toBe("ok")
      expect(current.callsMatch).toBe(true)
      expect(previous.callsMatch).toBe(true)
      expect(observed.cases.slice(current.before.cases, current.after.cases))
        .toEqual(observed.cases.slice(previous.before.cases, previous.after.cases))
      expect(observed.caseRequests.slice(current.before.cases, current.after.cases))
        .toEqual(observed.caseRequests.slice(previous.before.cases, previous.after.cases))
      expect(observed.sources.slice(current.before.sources, current.after.sources))
        .toEqual(observed.sources.slice(previous.before.sources, previous.after.sources))
      expect(current.after.sources).toBeGreaterThan(current.before.sources)
      expect(observed.coverage.slice(current.before.coverage, current.after.coverage))
        .toEqual(observed.coverage.slice(previous.before.coverage, previous.after.coverage))
      expect(observed.resultFrames.slice(current.before.frames, current.after.frames))
        .toEqual(observed.resultFrames.slice(previous.before.frames, previous.after.frames))
      expect(observed.envelopes.slice(current.before.frames, current.after.frames))
        .toEqual(observed.envelopes.slice(previous.before.frames, previous.after.frames))
      expect(observed.comparisons.slice(current.before.comparisons, current.after.comparisons).map((entry) => ({ request: entry.request, result: entry.result })))
        .toEqual(observed.comparisons.slice(previous.before.comparisons, previous.after.comparisons).map((entry) => ({ request: entry.request, result: entry.result })))
      expect(current.physical).toBeLessThan(previous.physical)
      expect(current.roots).toBeGreaterThan(0)
    }
    expect(await fixture.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)
