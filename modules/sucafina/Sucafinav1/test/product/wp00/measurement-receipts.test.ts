import { expect, test } from "bun:test"
import { compareMeasurements, createMeasurementPlan, measurementKey, summarizeMeasurements } from "../../../../../../packages/app-shell/e2e/sucafina/wp00/measurements.ts"
import type { Measurement } from "../../../../../../packages/app-shell/e2e/sucafina/wp00/measurements.ts"

const plan = createMeasurementPlan(["synthetic-observed-flow"])
const configuration = plan[0]!
const sample = (repetition: number): Measurement => ({
  ...configuration, repetition, startedAt: "2026-11-14T00:00:00.000Z", outcome: "passed",
  visualReadyMs: repetition, completionMs: repetition + 50, failureReason: null, resultEvidenceRef: null,
})
const environment = {
  datasetDigest: "synthetic-corpus-digest", runtimeVersion: "synthetic-runtime", operatingSystem: "synthetic-os",
  device: "synthetic-runner", browserVersion: "synthetic-browser", cacheState: "same context; no-store", method: "usable content then asserted completion",
}

// These are synthetic tests of receipt arithmetic and eligibility, never observed UI latency evidence.

test("a bootstrap failure cancels the full planned matrix without manufacturing zero timings", () => {
  const summary = summarizeMeasurements(plan, [], {}, "bootstrap-failed")
  expect(summary).toHaveLength(6)
  expect(summary.reduce((count, row) => count + row.cancelled, 0)).toBe(180)
  for (const row of summary) expect(row).toMatchObject({
    attempted: 0, passed: 0, failed: 0, cancelled: 30, cancellationReason: "bootstrap-failed",
    visualReady: { samples: 0, medianMs: null, p95Ms: null }, completion: { samples: 0, medianMs: null, p95Ms: null },
    perceptibleResponseBudget: { state: "NOT_PROVEN", observedWithinLimit: 0, observedAboveLimit: 0, unobserved: 30 },
  })
})

test("thirty unordered successful observations retain distinct median and nearest-rank p95", () => {
  const observations = Array.from({ length: 30 }, (_, index) => sample(30 - index))
  const summary = summarizeMeasurements([configuration], observations, {}, "not-executed")[0]!
  expect(summary).toMatchObject({
    attempted: 30, passed: 30, failed: 0, cancelled: 0, cancellationReason: null,
    visualReady: { samples: 30, medianMs: 15.5, p95Ms: 29 },
    completion: { samples: 30, medianMs: 65.5, p95Ms: 79 },
    perceptibleResponseBudget: { state: "OBSERVED_WITHIN_LIMIT", observedWithinLimit: 30, observedAboveLimit: 0, unobserved: 0 },
  })
})

test("a failed attempt remains evidence and never contributes a successful timing", () => {
  const failed: Measurement = { ...sample(1), outcome: "failed", visualReadyMs: null, completionMs: null, failureReason: "source-revoked" }
  const summary = summarizeMeasurements([configuration], [failed], { [measurementKey(configuration)]: "flow-stopped-after-failure" }, "")[0]!
  expect(summary).toMatchObject({
    attempted: 1, passed: 0, failed: 1, cancelled: 29, cancellationReason: "flow-stopped-after-failure",
    visualReady: { samples: 0, medianMs: null, p95Ms: null }, completion: { samples: 0, medianMs: null, p95Ms: null },
  })
})

test("a usable-result bound above 200 ms leaves first perceptible response unproven", () => {
  const observations = Array.from({ length: 30 }, (_, index) => ({
    ...sample(index + 1), visualReadyMs: index === 29 ? 201 : 200, completionMs: 250,
  }))
  const summary = summarizeMeasurements([configuration], observations, {}, "")[0]!
  expect(summary.perceptibleResponseBudget).toMatchObject({
    criterion: "CAMP.QLT.05", limitMs: 200, evidenceBasis: "usable-result-upper-bound",
    state: "NOT_PROVEN", observedWithinLimit: 29, observedAboveLimit: 1, unobserved: 0,
  })
  expect(summary.passed).toBe(30)
})

test("duplicate, unplanned, incomplete and temporally inverted observations are rejected", () => {
  expect(() => summarizeMeasurements([configuration], [sample(1), sample(1)], {}, "")).toThrow("Duplicate")
  expect(() => summarizeMeasurements([configuration], [sample(31)], {}, "")).toThrow("planned matrix")
  expect(() => summarizeMeasurements([configuration], [{ ...sample(1), completionMs: null }], {}, "")).toThrow("both observed timings")
  expect(() => summarizeMeasurements([configuration], [{ ...sample(1), completionMs: 0 }], {}, "")).toThrow("Completion must follow")
})

test("baseline comparison requires the same corpus, environment and thirty successful outcomes", () => {
  const observations = Array.from({ length: 30 }, (_, index) => sample(index + 1))
  const baseline = { productSha: "synthetic-baseline", environment, summaries: summarizeMeasurements([configuration], observations, {}, "") }
  const candidate = { productSha: "synthetic-candidate", environment, summaries: summarizeMeasurements([configuration], observations.map((row) => ({
    ...row, visualReadyMs: row.visualReadyMs! * 2, completionMs: row.completionMs! * 2,
  })), {}, "") }
  expect(compareMeasurements(candidate, null)).toMatchObject({ state: "unavailable", comparisons: [] })
  expect(compareMeasurements(candidate, { ...baseline, environment: { ...environment, datasetDigest: "different" } })).toMatchObject({ state: "incomparable", comparisons: [] })
  expect(compareMeasurements(candidate, { ...baseline, summaries: summarizeMeasurements([configuration], observations.slice(0, 29), {}, "cancelled") })).toMatchObject({ state: "incomplete" })
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: true, comparisons: [{
      state: "comparable", visualMedianDeltaMs: 15.5, completionMedianDeltaMs: 65.5,
      visualP95DeltaMs: 29, completionP95DeltaMs: 79,
      visualMedianDeltaPercent: 100, completionMedianDeltaPercent: 100, visualP95DeltaPercent: 100, completionP95DeltaPercent: 100,
      regressionInvestigation: { criterion: "CAMP.QLT.05", metric: "completion-p95", required: true },
    }],
  })
})

test("empty or malformed measurement plans never manufacture a complete matrix", () => {
  expect(() => createMeasurementPlan([])).toThrow("nonempty")
  expect(() => createMeasurementPlan([" "])).toThrow("nonempty")
  expect(() => summarizeMeasurements([], [], {}, "not-started")).toThrow("must not be empty")
  expect(() => summarizeMeasurements([configuration, configuration], [], {}, "not-started")).toThrow("Duplicate")
  expect(() => summarizeMeasurements([{ ...configuration, viewportWidth: 0 }], [], {}, "not-started")).toThrow("Invalid")
  expect(() => summarizeMeasurements([{ ...configuration, repetitions: 0 }], [], {}, "not-started")).toThrow("Invalid")
  expect(() => summarizeMeasurements([configuration], [], {}, " ")).toThrow("cancellation reason")
})

test.each([
  ["NaN", Number.NaN], ["infinite", Number.POSITIVE_INFINITY], ["negative", -1],
] as const)("a %s observed latency is rejected before aggregation", (_, value) => {
  expect(() => summarizeMeasurements([configuration], [{ ...sample(1), visualReadyMs: value }], {}, "not-started")).toThrow("Invalid observed latency")
})

test.each(["candidate", "baseline"] as const)("a duplicate %s summary cannot be treated as another comparable configuration", (side) => {
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => sample(index + 1)))
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => sample(index + 1)))
  const duplicated = side === "candidate" ? candidate : baseline
  duplicated.summaries.push(structuredClone(duplicated.summaries[0]!))
  expect(compareMeasurements(candidate, baseline)).toMatchObject({ state: "incomplete", reason: "Duplicate measurement configuration in supplied summaries", comparisons: [] })
})

test("comparison rejects empty and asymmetric matrices instead of passing vacuously", () => {
  const measured = receipt("candidate", Array.from({ length: 30 }, (_, index) => sample(index + 1)))
  const empty = { ...measured, summaries: [] }
  expect(compareMeasurements(empty, empty)).toMatchObject({ state: "incomplete", comparisons: [] })
  expect(compareMeasurements(measured, empty)).toMatchObject({ state: "incomplete", comparisons: [] })
  expect(compareMeasurements(empty, measured)).toMatchObject({ state: "incomplete", comparisons: [] })
  const additional = { ...measured, summaries: [...measured.summaries, { ...measured.summaries[0]!, flow: "synthetic-extra-flow" }] }
  expect(compareMeasurements(measured, additional)).toMatchObject({ state: "incomplete", reason: "Candidate and baseline measurement matrices differ", comparisons: [] })
  expect(compareMeasurements(additional, measured)).toMatchObject({ state: "incomplete", comparisons: [] })
})

test.each([
  ["attempt count", { attempted: 29 }],
  ["too many successes", { passed: 31 }],
  ["negative failures", { failed: -1 }],
  ["unaccounted cancellation", { cancelled: 1 }],
  ["fractional successes", { passed: 29.5 }],
  ["spurious cancellation reason", { cancellationReason: "no attempts were cancelled" }],
  ["sample count", { visualReady: { samples: 29, medianMs: 15.5, p95Ms: 29 } }],
  ["missing quantile", { visualReady: { samples: 30, medianMs: null, p95Ms: 29 } }],
  ["non-finite quantile", { completion: { samples: 30, medianMs: 65.5, p95Ms: Number.POSITIVE_INFINITY } }],
  ["NaN quantile", { completion: { samples: 30, medianMs: Number.NaN, p95Ms: 79 } }],
  ["inverted quantiles", { completion: { samples: 30, medianMs: 80, p95Ms: 79 } }],
  ["completion before usable content", { completion: { samples: 30, medianMs: 1, p95Ms: 2 } }],
  ["different population", { statisticsPopulation: "all attempts including failures" }],
  ["different quantile method", { quantileMethod: "mean labelled as p95" }],
] as const)("a supplied summary with %s cannot produce numerical comparisons", (_, patch) => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => sample(index + 1)))
  const candidate = { ...baseline, productSha: "candidate", summaries: structuredClone(baseline.summaries) }
  // Deliberately corrupt a received aggregate at runtime without changing the valid summary type.
  for (const [field, value] of Object.entries(patch)) Reflect.set(candidate.summaries[0]!, field, value)
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "incomplete", comparisons: [{
      state: "incomplete", visualMedianDeltaMs: null, completionMedianDeltaMs: null,
      visualP95DeltaMs: null, completionP95DeltaMs: null, visualMedianDeltaPercent: null, completionMedianDeltaPercent: null,
      visualP95DeltaPercent: null, completionP95DeltaPercent: null, regressionInvestigation: null,
    }],
  })
  expect(compareMeasurements(baseline, candidate)).toMatchObject({ state: "incomplete", comparisons: [{ state: "incomplete", completionP95DeltaMs: null }] })
})

test.each([29, 31])("a complete %i-sample receipt does not satisfy the required 30/30 comparison", (count) => {
  const observations = Array.from({ length: count }, (_, index) => sample(index + 1))
  const measured = { productSha: "synthetic", environment, summaries: summarizeMeasurements([{ ...configuration, repetitions: count }], observations, {}, "") }
  expect(compareMeasurements(measured, measured)).toMatchObject({ state: "incomplete", comparisons: [{ state: "incomplete", completionMedianDeltaMs: null, completionP95DeltaMs: null }] })
})

test("completion tail regression triggers investigation even with an unchanged median", () => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: 100 })))
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: index < 28 ? 100 : 125 })))
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: true, comparisons: [{
      completionMedianDeltaMs: 0, completionMedianDeltaPercent: 0, completionP95DeltaMs: 25, completionP95DeltaPercent: 25,
      regressionInvestigation: { criterion: "CAMP.QLT.05", metric: "completion-p95", thresholdPercent: 20, required: true, reason: "completion-p95-increase-over-20-percent" },
    }],
  })
})

test.each([80, 100, 120, 120.000001])("a completion p95 of %f obeys the strict twenty-percent investigation threshold", (completion) => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: 100 })))
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: completion })))
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: completion > 120,
    comparisons: [{ completionP95DeltaMs: completion - 100, regressionInvestigation: { required: completion > 120 } }],
  })
})

test("a higher median alone does not claim the CAMP.QLT.05 p95 trigger", () => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: index < 27 ? 100 : 200 })))
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 10, completionMs: index < 27 ? 150 : 200 })))
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: false,
    comparisons: [{ completionMedianDeltaPercent: 50, completionP95DeltaPercent: 0, regressionInvestigation: { required: false, reason: null } }],
  })
})

test.each([0, 5])("zero baseline with a %i ms candidate never manufactures a relative percentage", (completion) => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 0, completionMs: 0 })))
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 0, completionMs: completion })))
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: completion > 0, comparisons: [{
      completionMedianDeltaMs: completion, completionP95DeltaMs: completion,
      completionMedianDeltaPercent: null, completionP95DeltaPercent: null,
      percentageStates: { visualMedian: "baseline-zero", completionMedian: "baseline-zero", visualP95: "baseline-zero", completionP95: "baseline-zero" },
      regressionInvestigation: { required: completion > 0, reason: completion > 0 ? "baseline-zero-increase" : null },
    }],
  })
})

test("finite extreme observations retain finite quantiles and explicitly unavailable overflowing percentages", () => {
  const baseline = receipt("baseline", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 0, completionMs: Number.MIN_VALUE })))
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => ({ ...sample(index + 1), visualReadyMs: 0, completionMs: Number.MAX_VALUE })))
  expect(candidate.summaries[0]!.completion).toEqual({ samples: 30, medianMs: Number.MAX_VALUE, p95Ms: Number.MAX_VALUE })
  expect(compareMeasurements(candidate, baseline)).toMatchObject({
    state: "comparable", requiresInvestigation: true, comparisons: [{
      completionP95DeltaMs: Number.MAX_VALUE, completionP95DeltaPercent: null,
      percentageStates: { completionMedian: "percentage-overflow", completionP95: "percentage-overflow" },
      regressionInvestigation: { required: true, reason: "percentage-overflow-increase" },
    }],
  })
})

test("missing baseline and incomplete environment remain non-numerical even with valid summaries", () => {
  const candidate = receipt("candidate", Array.from({ length: 30 }, (_, index) => sample(index + 1)))
  expect(compareMeasurements(candidate, null)).toEqual({ state: "unavailable", reason: "Baseline was not measured", comparisons: [] })
  expect(compareMeasurements(candidate, { ...candidate, environment: { ...environment, browserVersion: "" } })).toMatchObject({ state: "incomparable", comparisons: [] })
  expect(compareMeasurements(candidate, { ...candidate, environment: { ...environment, method: "different method" } })).toMatchObject({ state: "incomparable", comparisons: [] })
})

function receipt(productSha: string, observations: Measurement[]) {
  return { productSha, environment, summaries: summarizeMeasurements([configuration], observations, {}, "synthetic-not-executed") }
}
