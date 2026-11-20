import { expect, test } from "bun:test"
import { object } from "../../../../runtime/contract.ts"
import { SF_SIGNAL_REGISTRY_PREFIX } from "../../../../product/decision-memory/signal-registry.ts"
import { memoryMaterialityFixture } from "./memory-materiality-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Fixture = Awaited<ReturnType<typeof memoryMaterialityFixture>>
type Fault = "reader" | "source"

function observeMateriality(fixture: Fixture, deadline: ReturnType<typeof compositionTestDeadline>, fault?: Fault) {
  const cases = fixture.business.cases.read, stateRead = fixture.authority.state.read
  const source = fixture.business.plannerSources.resolveForecastSource, compare = fixture.business.planner.compareScenarios
  const scalar = fixture.scenarios.resolve
  const reads = { concurrent: 0, maximum: 0, cases: [] as string[],
    sources: [] as { reference: string; status: string }[],
    resultFrames: [] as { resultRef: unknown; caseRef: unknown; resultDigest: unknown }[][],
    comparisons: [] as { request: unknown; beforeFrames: number; afterFrames: number; sources: number;
      result: Awaited<ReturnType<typeof compare>> }[],
    changed: false, faultOutsideRoot: false, replacementCalls: 0 }
  fixture.business.cases.read = async (request, call) => {
    reads.concurrent++
    reads.maximum = Math.max(reads.maximum, reads.concurrent)
    try {
      const result = await cases(request, call)
      reads.cases.push(result.status)
      return result
    } finally { reads.concurrent-- }
  }
  fixture.business.plannerSources.resolveForecastSource = async (reference, call) => {
    const result = await source(reference, call)
    reads.sources.push({ reference, status: result.status })
    return result
  }
  fixture.business.planner.compareScenarios = async (request, call) => {
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
    reads.resultFrames.push(values.map((value) => ({ resultRef: object(value.stored).resultRef,
      caseRef: structuredClone(object(value.stored).caseRef), resultDigest: object(value.stored).resultDigest })))
    // The first registry.list performs two independently authorized batches
    // (12 C08 envelopes). The next six belong to the materiality producer's
    // first load, before any comparison. Change its actual egress dependency.
    if (reads.resultFrames.length === 18 && fault) {
      reads.changed = true
      reads.faultOutsideRoot = fixture.store.currentSnapshots() === undefined
      if (fault === "reader") fixture.scenarios.resolve = (...args) => { reads.replacementCalls++; return scalar(...args) }
      if (fault === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
        const actual = versions.find((version) => version.id === "v1")
        if (!actual) throw new Error("The actual materiality source is missing")
        actual.lines[0]!.f[0] = 81
        return { commit: true, value: undefined }
      })
    }
    return result
  }
  deadline.own(() => {
    fixture.business.cases.read = cases
    fixture.authority.state.read = stateRead
    fixture.business.plannerSources.resolveForecastSource = source
    fixture.business.planner.compareScenarios = compare
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
  test("materiality refuses " + fault + " drift in its first direct batch after the real registry admission", async () => {
    const deadline = compositionTestDeadline("memory-materiality-final-" + fault)
    try {
      const fixture = await memoryMaterialityFixture(deadline)
      const before = await fixture.capture()
      if (before.state.status !== "ok") throw new Error("The initial protected envelope is unavailable")
      const observed = observeMateriality(fixture, deadline, fault)
      const response = await deadline.phase("memory.materiality", fixture.readMateriality)
      expect(observed.changed).toBe(true)
      expect(observed.faultOutsideRoot).toBe(true)
      expect(observed.resultFrames).toHaveLength(18)
      expect(observed.maximum).toBe(1)
      expect(observed.replacementCalls).toBe(0)
      expect(observed.comparisons).toEqual([])
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
