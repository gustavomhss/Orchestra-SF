import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { ok } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { trainingHorizon } from "./fixture.ts"
import { resolveTrainingAfterChoice, trainingHistoryFixture } from "./history-fixture.ts"

for (const expected of [
  { training: "omitted", threshold: 55000, originalSubtotal: 210000, coverage: "pending" },
  { training: "confirmed", threshold: 15000, originalSubtotal: 250000, coverage: "complete" },
] as const) test(`canonical ${expected.training} training sensitivity certifies ${expected.threshold} from installed persisted sources`, async () => {
  const deadline = compositionTestDeadline(`installed-bi-threshold-${expected.training}`, 165_000)
  try {
    const fixture = await trainingHistoryFixture(deadline, expected.training)
    await fixture.registerRule()
    const scenarios = fixture.business.plannerProduct.scenarios
    const units = fixture.portfolio.units
    if (!scenarios || !units) throw new Error("Installed Planner sensitivity producers unavailable")
    const preview: Parameters<typeof createPlannerExactThreshold>[0]["preview"] = (request, context) => comparePlannerPreview({
      host: fixture.authority.host, sources: fixture.business.plannerSources, scenarios, planner: fixture.portfolio.planner,
    }, request, context)
    const exact = createPlannerExactThreshold({ units, preview })
    const request: SensitivityRequest = { scenarioRef: fixture.candidate.resultRef,
      parameterBounds: { parameterRef: "implementation:11", minimum: 10000, maximum: 70000, steps: 2 },
      criterion: { id: "minimum-known-advantage", operator: "lte", value: -20000 } }
    const before = await fixture.authority.state.read(fixture.request(), "cases", (state) => ({
      decision: state.cases[fixture.caseRef.id], results: state.decisionResults,
    }))
    if (before.status !== "ok") throw new Error("Persisted threshold inputs unavailable")
    const certified = ok(await deadline.phase("canonical.exact-threshold", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      exact(request, fixture.baseline.resultRef, fixture.call))), "Canonical known-subtotal threshold")
    // The canonical solver returns the last accepted IEEE input, including a
    // sub-cent rounding plateau. No test or BI code implements the equation.
    expect(certified.value).toBeCloseTo(expected.threshold, 8)
    expect(certified.evidenceRefs.length).toBeGreaterThan(0)
    expect(certified.evidenceRefs.every((reference) => fixture.sources.some((source) => digestSfValue(source) === digestSfValue(reference)))).toBe(true)
    const selected = fixture.caseValue.alternatives[1]!
    const at = async (amount: number) => ok(await deadline.phase(`canonical.preview.${amount}`, () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      preview({ baselineRef: fixture.baseline.resultRef, scenario: { ...selected.scenario, operations: [{ kind: "replace", targetRef: "implementation:11",
        amount, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } }] } }, fixture.call))), "Canonical boundary preview")
    const boundary = await at(expected.threshold)
    const exceeded = await at(expected.threshold + 1)
    expect(boundary.sample.knownSubtotal).toBe(220000)
    expect(boundary.metric).toMatchObject({ value: -20000, unit: "USD", period: trainingHorizon, state: "conditioned" })
    expect(exceeded.sample.knownSubtotal).toBe(220001)
    expect(exceeded.metric.value).toBe(-19999)
    expect(boundary.sample.total).toBeNull()
    expect(boundary.comparison.completeDifference).toBeNull()
    expect(selected.result).toMatchObject({ knownSubtotal: expected.originalSubtotal, costCoverage: { coverageState: expected.coverage } })
    expect(fixture.caseValue.alternatives[0]!.result.knownSubtotal).toBe(240000)
    const after = await fixture.authority.state.read(fixture.request(), "cases", (state) => ({
      decision: state.cases[fixture.caseRef.id], results: state.decisionResults,
    }))
    if (after.status !== "ok") throw new Error("Threshold source records unavailable after preview")
    expect(after.value).toEqual(before.value)
    // The human rule and exact solver use installed results. These transient
    // previews remain conditioned and are not persisted as a BI11 result.
  } finally { await deadline.close() }
}, 180_000)

test("a real human ChoiceRecord remains historical when a later training quote revises the same installed case", async () => {
  const deadline = compositionTestDeadline("installed-bi-training-choice-history", 165_000)
  try {
    const fixture = await trainingHistoryFixture(deadline)
    await fixture.registerRule()
    const alternative = fixture.caseValue.alternatives[1]!
    const request = { caseRef: fixture.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version,
      comparison: { scenarioRefs: [fixture.baseline.resultRef, fixture.candidate.resultRef], criteria: ["minimum-known-advantage"] },
      criteria: ["minimum-known-advantage"], reason: "Human chooses the conditioned transition while the separately excluded training quote is pending; no application is authorized" }
    const response = await deadline.phase("choice.http", () => fixture.mutationHttp(new Request("https://example.test/product/planner?sf=decision-choose", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": "history-human-choice" }, body: JSON.stringify(request),
    }), "planner"))
    if (response?.status !== 200) throw new Error(`Human choice rejected: ${response?.status} ${response ? await response.text() : "no response"}`)
    const chosenReceipt = ok(await response.json() as PortResult<{ caseRef: typeof fixture.caseRef }>, "Persist human choice")
    const readCase = (caseRef: typeof fixture.caseRef) => fixture.business.withCase(fixture.call, caseRef, {}, () =>
      fixture.business.cases.read({ caseRef: encodeCaseRef(caseRef) }, fixture.call))
    const chosen = ok(await deadline.phase("choice.authorized-read", () => readCase(chosenReceipt.caseRef)), "Read actual chosen case")
    expect(chosen.case.state).toBe("chosen")
    expect(chosen.case.choices).toHaveLength(1)
    const original = structuredClone(chosen.case.choices[0]!)
    expect(original.result).toEqual(alternative.result)
    expect(original).toMatchObject({ alternativeId: alternative.id, alternativeVersion: 1, basisVersion: 1, comparisonStatus: "conditioned",
      result: { knownSubtotal: 210000, total: null, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } },
      comparison: { baselineResultRef: fixture.baseline.resultRef, alternativeResultRef: fixture.candidate.resultRef,
        knownDifference: -30000, completeDifference: null, comparisonStatus: "conditioned" } })
    expect(original.values).toEqual([{ criterionRef: "minimum-known-advantage", value: -30000, unit: "USD", currency: "USD", horizon: trainingHorizon }])
    expect(original.result.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    const originalDigest = digestSfValue(original)

    const revised = await resolveTrainingAfterChoice(fixture, deadline, chosenReceipt.caseRef)
    expect(revised.caseRef.id).toBe(chosenReceipt.caseRef.id)
    expect(revised.caseRef.incarnation).toBe(chosenReceipt.caseRef.incarnation)
    expect(revised.caseRef.version).toBeGreaterThan(chosenReceipt.caseRef.version)
    expect(revised.source.refDigest).not.toBe(fixture.sources[1]!.refDigest)
    expect(revised.forecast.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 40000, currency: "USD", evidenceState: "confirmed" })
    await fixture.registerRule(revised.caseRef, revised.basis.sourceRefs, 1)
    const current = ok(await deadline.phase("revision.authorized-read", () => readCase(revised.caseRef)), "Read actual reconsidered case")
    const candidate = current.case.alternatives.find((entry) => entry.id === alternative.id)
    expect(current.case.state).toBe("reconsidering")
    expect(candidate).toMatchObject({ id: alternative.id, version: 2,
      result: { knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { basisVersion: 2, coverageState: "complete" } } })
    expect(candidate?.scenario).toEqual({ baseRef: revised.source.refId, operations: [], assumptions: [] })
    const compared = ok(await deadline.phase("revision.canonical-comparison", () => fixture.business.withCase(fixture.call, revised.caseRef, {}, () =>
      fixture.portfolio.compare({ caseRef: revised.caseRef, baselineAlternativeId: fixture.caseValue.alternatives[0]!.id,
        alternativeId: alternative.id, criteria: ["minimum-known-advantage"] }, fixture.call))), "Compare revised current alternatives")
    expect(compared.comparison).toMatchObject({ baselineResultRef: revised.baseline.resultRef, alternativeResultRef: revised.candidate.resultRef,
      knownDifference: 10000, completeDifference: 10000, comparisonStatus: "complete" })
    expect(compared.comparison.criterionResults).toContainEqual(expect.objectContaining({ criterionId: "minimum-known-advantage", state: "failed" }))
    expect(current.case.choices).toHaveLength(1)
    expect(current.case.choices[0]).toEqual(original)
    expect(digestSfValue(current.case.choices[0])).toBe(originalDigest)
    expect(current.case.choices[0]!.result.sourceRefs).toEqual(original.result.sourceRefs)
    expect(current.case.choices[0]!.costCoverage).toEqual(original.costCoverage)
    expect(current.case.preparedChanges).toEqual([])
    expect(current.case.receipts).toEqual([])
    const oldSource = ok(await deadline.phase("source.original-readback", () => fixture.business.plannerProduct.issueSource(fixture.sources[1]!.target.recordId, fixture.call)), "Read original source identity")
    expect(oldSource.evidence).toEqual(fixture.sources[1]!)
    const historical = ok(await deadline.phase("scenario.historical-read", () => fixture.business.withCase(fixture.call, revised.caseRef, {}, () =>
      fixture.business.results.readHistoricalScenario({ resultRef: fixture.candidate.resultRef }, fixture.call))), "Read original C08 scenario")
    if (historical.kind !== "scenario") throw new Error("Historical reference no longer addresses a scenario")
    expect(historical.result).toEqual(original.result)
    expect(historical.caseRef).toEqual(fixture.candidate.caseRef)
  } finally { await deadline.close() }
}, 180_000)
