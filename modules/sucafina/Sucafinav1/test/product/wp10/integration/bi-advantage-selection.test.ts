import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createPlannerPort } from "../../../../product/planner/port.ts"
import { scenarioBatchFixture } from "../../wp11/scenario-batch-fixture.ts"
import { createSfAuthorizedScenarioBiProjection } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { readSfDecisionBiSelection, sfDecisionBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { sfDecisionBiChoices } from "../../../../../../../apps/cli/src/sucafina-product/extended-bi-options.ts"

function ok<T>(value: PortResult<T>): T {
  if (value.status !== "ok") throw new Error(JSON.stringify(value))
  return value.value
}

/** Published producer fixture: actual UI leases, Planner arithmetic and C08.
 * It exercises the composed read boundary, not native provider acceptance. */
async function advantageFixture() {
  const fixture = await scenarioBatchFixture()
  try {
    const scenarios = fixture.observe().scenarios
    const planner = createPlannerPort({ host: fixture.fixture.host, sources: fixture.sources, scenarios })
    const directRequest = { scenarioRefs: [...fixture.saved], criteria: [] }
    const inverseRequest = { scenarioRefs: [...fixture.saved].reverse(), criteria: [] }
    const direct = ok(await planner.compareScenarios(directRequest, fixture.context))
    const inverse = ok(await planner.compareScenarios(inverseRequest, fixture.context))
    const sourceRefs = fixture.decision.sourceRefs
    const comparison = ok(await fixture.results.write({ kind: "comparison", result: direct, caseRef: fixture.caseRef,
      requestDigest: digestSfValue(directRequest), sourceRefs, idempotencyKey: "bi-direct" }, fixture.context))
    const saveInverse = (key: string, caseRef = fixture.caseRef) => fixture.results.write({ kind: "comparison", result: inverse, caseRef,
      requestDigest: digestSfValue(inverseRequest), sourceRefs, idempotencyKey: key }, fixture.context)
    const advantage = ok(await saveInverse("bi-inverse"))
    const selected = { scenarioResultRef: fixture.saved[1]!, comparisonRef: comparison.resultRef, advantageComparisonRef: advantage.resultRef }
    const selection = { ...selected, selectionRef: sfDecisionBiSelection(selected) }
    const readProjection: Parameters<typeof createSfAuthorizedScenarioBiProjection>[0]["readProjection"] = async (_selection, call) => {
      const source = fixture.entries[1]!.scenario.baseRef
      const observed = await fixture.planner.compareForecast({ baseRef: source, candidateRef: source, period: fixture.decision.horizon, currency: fixture.decision.currency }, call)
      return observed.status === "ok" ? { status: "ok", value: observed.value.candidate } : observed
    }
    const read = createSfAuthorizedScenarioBiProjection({ host: fixture.fixture.host, results: fixture.results, readProjection })
    return { ...fixture, comparison, advantage, selected, selection, readProjection, read, inverse, saveInverse }
  } catch (error) { await fixture.close(); throw error }
}

test("BI transports only explicit persisted inverse selectors and preserves existing selector filters", () => {
  const selected = { scenarioResultRef: "scenario", comparisonRef: "direct", sensitivityResultRef: "sensitivity", advantageComparisonRef: "inverse" }
  expect(readSfDecisionBiSelection(sfDecisionBiSelection(selected))).toEqual(selected)
  expect(readSfDecisionBiSelection(sfDecisionBiSelection({ scenarioResultRef: "scenario", comparisonRef: "direct" }))).toEqual({ scenarioResultRef: "scenario", comparisonRef: "direct" })
  expect(readSfDecisionBiSelection(sfDecisionBiSelection({ portfolioResultRef: "portfolio", sourceScenarioRef: "scenario" }))).toEqual({ portfolioResultRef: "portfolio", sourceScenarioRef: "scenario" })
  const encode = (value: unknown) => `sf-bi-decision:${encodeURIComponent(JSON.stringify(value))}`
  for (const advantageComparisonRef of ["", " ", null, 1, {}]) expect(readSfDecisionBiSelection(encode({ ...selected, advantageComparisonRef }))).toBeUndefined()
  expect(readSfDecisionBiSelection(encode({ ...selected, extra: "unselected" }))).toBeUndefined()
  expect(readSfDecisionBiSelection(encode({ portfolioResultRef: "portfolio", sourceScenarioRef: "scenario", advantageComparisonRef: "inverse" }))).toBeUndefined()
})

test("BI offers every authorized inverse separately and binds the current exact case pair without changing canonical values", async () => {
  const fixture = await advantageFixture()
  try {
    const projected = ok(await fixture.read(fixture.selection, fixture.context))
    expect(projected.comparison?.comparisonRef).toBe(fixture.advantage.resultRef)
    expect(projected.comparison?.values.find((value) => value.id === "scenario:advantage-known-difference")?.value).toBe(fixture.inverse.knownDifference)
    const original = ok(await fixture.results.read({ kind: "scenario", resultRef: fixture.selected.scenarioResultRef }, fixture.context))
    const second = ok(await fixture.saveInverse("bi-inverse-second"))
    const foreign = ok(await fixture.saveInverse("bi-inverse-other-case", fixture.otherCaseRef))
    const records = [original, fixture.comparison, fixture.advantage, second, foreign]
    const choices = ok(sfDecisionBiChoices("BI09", fixture.decision.horizon, records))
    const selections = choices.map((choice) => readSfDecisionBiSelection(choice.selectionRef))
    expect(selections).toContainEqual({ scenarioResultRef: original.resultRef, comparisonRef: fixture.comparison.resultRef })
    for (const inverse of [fixture.advantage, second]) {
      expect(selections).toContainEqual({ scenarioResultRef: original.resultRef, comparisonRef: fixture.comparison.resultRef, advantageComparisonRef: inverse.resultRef })
      expect(choices.some((choice) => choice.label.includes(`vantagem ${inverse.resultRef}`))).toBe(true)
    }
    expect(selections.some((value) => value && "scenarioResultRef" in value && value.advantageComparisonRef === foreign.resultRef)).toBe(false)
    expect(ok(sfDecisionBiChoices("BI11", fixture.decision.horizon, records))).toEqual([])
    expect(ok(sfDecisionBiChoices("BI09", { ...fixture.decision.horizon, end: "2028-12-31" }, records))).toEqual([])
    // Cardinality-only counterexample: copied canonical outputs, synthetic
    // identifiers, no claim that these records exist or are authorized in C08.
    const oversized = [original,
      ...Array.from({ length: 149 }, (_, index) => ({ ...fixture.comparison, resultRef: `comparison:direct:${index}` })),
      ...Array.from({ length: 150 }, (_, index) => ({ ...fixture.advantage, resultRef: `comparison:inverse:${index}` }))]
    const bounded = sfDecisionBiChoices("BI09", fixture.decision.horizon, oversized)
    expect(oversized).toHaveLength(300)
    expect(bounded).toEqual({ status: "needs-input", reason: "too-many-bi-choices-refine-period-or-select-case-in-workbench" })
    expect(bounded).not.toHaveProperty("value")
    expect(await fixture.read({ ...fixture.selection, advantageComparisonRef: second.resultRef }, fixture.context)).toEqual({ status: "denied", reason: "bi-scenario-selection-mismatch" })
    for (const reference of [fixture.comparison.resultRef, foreign.resultRef]) {
      const selected = { ...fixture.selected, advantageComparisonRef: reference }
      const refused = await fixture.read({ ...selected, selectionRef: sfDecisionBiSelection(selected) }, fixture.context)
      expect(refused).toEqual({ status: "stale", reason: "advantage-reference-mismatch" })
      expect(refused).not.toHaveProperty("value")
    }
    fixture.fixture.access.allowed = false
    const revoked = await fixture.read(fixture.selection, fixture.context)
    expect(revoked).toEqual({ status: "denied", reason: "bi-scenario-authority-changed" })
    expect(revoked).not.toHaveProperty("value")
  } finally { await fixture.close() }
}, 60000)

test("BI refuses lease loss after its first and last real authorization awaits and a changed final Request", async () => {
  const fixture = await advantageFixture()
  try {
    const observe = (after?: (count: number, call: TrustedDomainContext, observation: { replaced: boolean }) => void) => {
      const calls = { count: 0, replaced: false }
      const replacement = fixture.fixture.host.requestFor(fixture.context)
      const read = createSfAuthorizedScenarioBiProjection({ results: fixture.results, readProjection: fixture.readProjection,
        host: { requestFor: (call) => calls.replaced ? replacement : fixture.fixture.host.requestFor(call),
          revalidate: async (call) => { const allowed = await fixture.fixture.host.revalidate(call); after?.(++calls.count, call, calls); return allowed } } })
      return { read, calls }
    }
    const baseline = observe(), baselineCall = await fixture.admit()
    expect((await baseline.read(fixture.selection, baselineCall)).status).toBe("ok")
    expect(baseline.calls.count).toBeGreaterThan(1)
    fixture.fixture.ui.finish(baselineCall)
    for (const boundary of [1, baseline.calls.count]) {
      const call = await fixture.admit()
      const observed = observe((count, current) => {
        if (count !== boundary) return
        if (current.kind !== "ui") throw new Error("The real BI fixture must use a UI admission")
        fixture.fixture.ui.finish(current)
      })
      const refused = await observed.read(fixture.selection, call)
      expect(observed.calls.count).toBe(boundary)
      expect(refused).toEqual({ status: "denied", reason: "bi-scenario-authority-changed" })
      expect(refused).not.toHaveProperty("value")
    }
    const call = await fixture.admit()
    const swapped = observe((count, _call, observation) => { if (count === baseline.calls.count) observation.replaced = true })
    const refused = await swapped.read(fixture.selection, call)
    expect(swapped.calls.replaced).toBe(true)
    expect(refused).toEqual({ status: "denied", reason: "bi-scenario-authority-changed" })
    expect(refused).not.toHaveProperty("value")
    fixture.fixture.ui.finish(call)
  } finally { await fixture.close() }
}, 60000)
