import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decisionCoverageRef } from "../../../../product/decisions/coverage-access.ts"
import { createStoredPlannerScenarioHost } from "../../../../product/planner/stored-scenarios.ts"
import { createWp13AnalysisFixture } from "../../wp13/sensitivity-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp13AnalysisFixture>>

function measuredScenarios(fixture: Fixture, wrapScalar: boolean) {
  const counts = { casesNamespaceReads: 0, otherNamespaceReads: 0, fullCaseReads: 0, scalarHooks: 0 }
  const read = fixture.state.read
  fixture.state.read = async (request, namespace, project) => {
    if (namespace === "cases") counts.casesNamespaceReads++
    if (namespace !== "cases") counts.otherNamespaceReads++
    return read(request, namespace, project)
  }
  // The unwrapped spread preserves the factory scalar's identity. Overriding it
  // deliberately adds observable caller semantics that any batch must retain.
  const store = wrapScalar ? { ...fixture.results, readHistoricalScenario: async (...args: Parameters<typeof fixture.results.readHistoricalScenario>) => {
    counts.scalarHooks++
    return fixture.results.readHistoricalScenario(...args)
  } } : { ...fixture.results }
  const scenarios = createStoredPlannerScenarioHost({
    store,
    cases: { ...fixture.cases, read: async (request, context) => { counts.fullCaseReads++; return fixture.cases.read(request, context) } },
    planner: fixture.planner,
    coverageRefFor: (reference, alternative) => decisionCoverageRef(reference, alternative.id, alternative.version),
  })
  return { counts, scenarios, restore: () => { fixture.state.read = read } }
}

for (const duplicate of [false, true]) {
  test(`historical scenario batches coalesce only C08 envelopes for real siblings${duplicate ? " including duplicate occurrences" : ""}`, async () => {
    const fixture = await createWp13AnalysisFixture()
    try {
      const selected = await fixture.results.readHistoricalScenario({ resultRef: fixture.selectedRef }, fixture.context)
      const baseline = await fixture.results.readHistoricalScenario({ resultRef: fixture.baselineRef }, fixture.context)
      if (selected.status !== "ok" || baseline.status !== "ok") throw new Error("Real persisted scenario fixtures unavailable")
      const expected = duplicate ? [selected.value.result, baseline.value.result, selected.value.result] : [selected.value.result, baseline.value.result]
      const references = duplicate ? [fixture.selectedRef, fixture.baselineRef, fixture.selectedRef] : [fixture.selectedRef, fixture.baselineRef]
      const measured = measuredScenarios(fixture, false)
      try {
        if (!measured.scenarios.resolveMany) throw new Error("Real scenario batch unavailable")
        const started = performance.now()
        const result = await measured.scenarios.resolveMany(references, fixture.context)
        console.info(JSON.stringify({ phase: "historical-scenario-batch", duplicate, durationMs: performance.now() - started, counters: measured.counts, statuses: result.map((entry) => entry.status) }))
        expect(result.map((entry) => entry.status)).toEqual(references.map(() => "ok"))
        expect(result.flatMap((entry) => entry.status === "ok" ? [digestSfValue(entry.value.result)] : [])).toEqual(expected.map(digestSfValue))
        expect(result.flatMap((entry) => entry.status === "ok" ? [entry.value.source.refDigest] : [])).toEqual(references.map(() => fixture.evidence.refDigest))
        expect(measured.counts.fullCaseReads).toBe(2)
        expect(measured.counts.scalarHooks).toBe(0)
        // Two distinct observations. Each result batch keeps its three C08
        // phases (6 total); the two complete case reads add four more.
        expect(measured.counts.casesNamespaceReads).toBe(10)
        expect(measured.counts.otherNamespaceReads).toBe(0)
      } finally { measured.restore() }
    } finally { await fixture.cleanup() }
  }, 120000)
}

test("historical scenario batch keeps an overriding scalar facade and its per-result hooks", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const measured = measuredScenarios(fixture, true)
    try {
      if (!measured.scenarios.resolveMany) throw new Error("Real scenario batch unavailable")
      const started = performance.now()
      const result = await measured.scenarios.resolveMany([fixture.selectedRef, fixture.baselineRef], fixture.context)
      console.info(JSON.stringify({ phase: "historical-scenario-batch.scalar-facade", durationMs: performance.now() - started, counters: measured.counts, statuses: result.map((entry) => entry.status) }))
      expect(result.map((entry) => entry.status)).toEqual(["ok", "ok"])
      expect(measured.counts).toEqual({ casesNamespaceReads: 16, otherNamespaceReads: 0, fullCaseReads: 2, scalarHooks: 4 })
    } finally { measured.restore() }
  } finally { await fixture.cleanup() }
}, 120000)
