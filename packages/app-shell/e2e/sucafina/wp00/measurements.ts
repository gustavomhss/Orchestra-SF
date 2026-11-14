export type MeasurementPlan = {
  flow: string
  viewportWidth: number
  viewportHeight: number
  zoomPercent: number
  repetitions: number
}

export type Measurement = {
  flow: string
  repetition: number
  viewportWidth: number
  viewportHeight: number
  zoomPercent: number
  startedAt: string
  visualReadyMs: number | null
  completionMs: number | null
  outcome: "passed" | "failed"
  failureReason: string | null
  resultEvidenceRef: string | null
}

const statisticsPopulation = "successful outcomes only; failed and unexecuted attempts remain explicit"
const quantileMethod = "median of middle values; p95 nearest rank ceil(0.95 * n)"
const environmentFields = ["datasetDigest", "runtimeVersion", "operatingSystem", "device", "browserVersion", "cacheState", "method"] as const

export function measurementKey(value: Pick<MeasurementPlan, "flow" | "viewportWidth" | "viewportHeight" | "zoomPercent">) {
  return [value.flow, value.viewportWidth, value.viewportHeight, value.zoomPercent].join(":")
}

export function createMeasurementPlan(flows: readonly string[]): MeasurementPlan[] {
  if (!flows.length || flows.some((flow) => typeof flow !== "string" || !flow.trim()) || new Set(flows).size !== flows.length)
    throw new Error("Measurement flows must be nonempty and unique")
  return flows.flatMap((flow) => [320, 768, 1440].flatMap((viewportWidth) => [100, 200].map((zoomPercent) => ({
    flow, viewportWidth, viewportHeight: 900, zoomPercent, repetitions: 30,
  }))))
}

/** Failed attempts remain in raw evidence; only successful comparable outcomes contribute timings. */
export function summarizeMeasurements(plan: readonly MeasurementPlan[], observations: readonly Measurement[], cancelled: Readonly<Record<string, string>>, fallbackReason: string) {
  if (!plan.length) throw new Error("Measurement matrix must not be empty")
  if (plan.some((configuration) => configurationProblem(configuration))) throw new Error("Invalid measurement configuration")
  const expected = new Map(plan.map((item) => [measurementKey(item), item]))
  if (expected.size !== plan.length) throw new Error("Duplicate measurement configuration")
  if (Object.entries(cancelled).some(([key, reason]) => !expected.has(key) || typeof reason !== "string" || !reason.trim()))
    throw new Error("Cancellation requires a planned configuration and a reason")
  const seen = new Set<string>()
  for (const sample of observations) {
    const key = measurementKey(sample)
    const configuration = expected.get(key)
    if (!configuration || !Number.isSafeInteger(sample.repetition) || sample.repetition < 1 || sample.repetition > configuration.repetitions)
      throw new Error("Observation does not belong to the planned matrix")
    const identity = key + ":" + sample.repetition
    if (seen.has(identity)) throw new Error("Duplicate measurement attempt; retries must not replace evidence")
    seen.add(identity)
    if (typeof sample.startedAt !== "string" || !Number.isFinite(Date.parse(sample.startedAt))) throw new Error("Missing observed start time")
    if (sample.outcome !== "passed" && sample.outcome !== "failed") throw new Error("Invalid observed outcome")
    if ([sample.visualReadyMs, sample.completionMs].some((value) => value !== null && (!Number.isFinite(value) || value < 0)))
      throw new Error("Invalid observed latency")
    if (sample.completionMs !== null && (sample.visualReadyMs === null || sample.completionMs < sample.visualReadyMs))
      throw new Error("Completion must follow observed usable content")
    if (sample.outcome === "passed" && (sample.visualReadyMs === null || sample.completionMs === null || sample.failureReason !== null))
      throw new Error("Successful observations require both observed timings")
    if (sample.outcome === "failed" && (typeof sample.failureReason !== "string" || !sample.failureReason.trim()))
      throw new Error("Failed observation requires a reason")
    if (sample.resultEvidenceRef !== null && (typeof sample.resultEvidenceRef !== "string" || !sample.resultEvidenceRef.trim()))
      throw new Error("Invalid result evidence reference")
  }
  return plan.map((configuration) => {
    const key = measurementKey(configuration)
    const attempted = observations.filter((sample) => measurementKey(sample) === key)
    const passed = attempted.filter((sample) => sample.outcome === "passed")
    const usable = attempted.flatMap((sample) => sample.visualReadyMs === null ? [] : [sample.visualReadyMs])
    const cancellationReason = attempted.length < configuration.repetitions ? cancelled[key] ?? fallbackReason : null
    if (cancellationReason !== null && (typeof cancellationReason !== "string" || !cancellationReason.trim()))
      throw new Error("Unexecuted attempts require a cancellation reason")
    return {
      ...configuration,
      attempted: attempted.length,
      passed: passed.length,
      failed: attempted.length - passed.length,
      cancelled: configuration.repetitions - attempted.length,
      cancellationReason,
      visualReady: distribution(passed.map((sample) => sample.visualReadyMs!)),
      completion: distribution(passed.map((sample) => sample.completionMs!)),
      perceptibleResponseBudget: {
        criterion: "CAMP.QLT.05", limitMs: 200, evidenceBasis: "usable-result-upper-bound",
        observedWithinLimit: usable.filter((latency) => latency <= 200).length,
        observedAboveLimit: usable.filter((latency) => latency > 200).length,
        unobserved: configuration.repetitions - usable.length,
        state: passed.length === configuration.repetitions && usable.every((latency) => latency <= 200) ? "OBSERVED_WITHIN_LIMIT" : "NOT_PROVEN",
        limit: "Only the declared flow start is timed. An earlier work indicator and each internal action are not independently observed; an upper bound above 200 ms is not proof of a perceptible-response violation.",
      },
      statisticsPopulation,
      quantileMethod,
    }
  })
}

export type MeasurementEnvironment = {
  datasetDigest: string
  runtimeVersion: string
  operatingSystem: string
  device: string
  browserVersion: string
  cacheState: string
  method: string
}

/** Validate supplied aggregate receipts; raw observations and their provenance remain separate evidence. */
export function compareMeasurements(
  candidate: { productSha: string; environment: MeasurementEnvironment; summaries: ReturnType<typeof summarizeMeasurements> },
  baseline: { productSha: string; environment: MeasurementEnvironment; summaries: ReturnType<typeof summarizeMeasurements> } | null,
) {
  if (!baseline) return { state: "unavailable" as const, reason: "Baseline was not measured", comparisons: [] }
  if (environmentFields.some((key) => typeof candidate.environment?.[key] !== "string" || !candidate.environment[key].trim() ||
    typeof baseline.environment?.[key] !== "string" || !baseline.environment[key].trim()))
    return { state: "incomparable" as const, reason: "Required environment or corpus observations are missing", comparisons: [] }
  const mismatches = environmentFields
    .filter((key) => candidate.environment[key] !== baseline.environment[key])
  if (mismatches.length) return { state: "incomparable" as const, reason: "Environment or corpus differs: " + mismatches.join(", "), comparisons: [] }
  if (!Array.isArray(candidate.summaries) || !Array.isArray(baseline.summaries) || !candidate.summaries.length || !baseline.summaries.length)
    return { state: "incomplete" as const, reason: "Measurement matrix must not be empty", comparisons: [] }
  if ([...candidate.summaries, ...baseline.summaries].some((row) => configurationProblem(row)))
    return { state: "incomplete" as const, reason: "Invalid measurement configuration", comparisons: [] }
  const candidateKeys = new Set(candidate.summaries.map(measurementKey))
  const references = new Map(baseline.summaries.map((row) => [measurementKey(row), row]))
  if (candidateKeys.size !== candidate.summaries.length || references.size !== baseline.summaries.length)
    return { state: "incomplete" as const, reason: "Duplicate measurement configuration in supplied summaries", comparisons: [] }
  if (candidateKeys.size !== references.size || [...candidateKeys].some((key) => !references.has(key)))
    return { state: "incomplete" as const, reason: "Candidate and baseline measurement matrices differ", comparisons: [] }
  const comparisons = candidate.summaries.map((row) => {
    const reference = references.get(measurementKey(row))!
    const candidateProblem = summaryProblem(row)
    const baselineProblem = summaryProblem(reference)
    const reason = candidateProblem ? "Candidate: " + candidateProblem : baselineProblem ? "Baseline: " + baselineProblem :
      row.repetitions !== 30 || reference.repetitions !== 30 || row.passed !== 30 || reference.passed !== 30
        ? "Comparison requires exactly 30/30 successful observations in both receipts" : null
    if (reason) return {
      key: measurementKey(row), state: "incomplete" as const, reason,
      visualMedianDeltaMs: null, completionMedianDeltaMs: null, visualP95DeltaMs: null, completionP95DeltaMs: null,
      visualMedianDeltaPercent: null, completionMedianDeltaPercent: null, visualP95DeltaPercent: null, completionP95DeltaPercent: null,
      percentageStates: null, regressionInvestigation: null,
    }
    const visualMedian = latencyChange(row.visualReady.medianMs!, reference.visualReady.medianMs!)
    const completionMedian = latencyChange(row.completion.medianMs!, reference.completion.medianMs!)
    const visualP95 = latencyChange(row.visualReady.p95Ms!, reference.visualReady.p95Ms!)
    const completionP95 = latencyChange(row.completion.p95Ms!, reference.completion.p95Ms!)
    // Ignore only floating-point roundoff at exactly 20%; this is an investigation signal, not acceptance.
    const exceedsThreshold = completionP95.deltaPercent !== null && completionP95.deltaPercent >
      20 + 4 * Number.EPSILON * Math.max(20, Math.abs(completionP95.deltaPercent))
    const investigationReason = exceedsThreshold ? "completion-p95-increase-over-20-percent" :
      completionP95.deltaPercent === null && completionP95.deltaMs > 0 ? completionP95.percentageState + "-increase" : null
    return {
      key: measurementKey(row), state: "comparable" as const, reason: null,
      visualMedianDeltaMs: visualMedian.deltaMs, completionMedianDeltaMs: completionMedian.deltaMs,
      visualP95DeltaMs: visualP95.deltaMs, completionP95DeltaMs: completionP95.deltaMs,
      visualMedianDeltaPercent: visualMedian.deltaPercent, completionMedianDeltaPercent: completionMedian.deltaPercent,
      visualP95DeltaPercent: visualP95.deltaPercent, completionP95DeltaPercent: completionP95.deltaPercent,
      percentageStates: { visualMedian: visualMedian.percentageState, completionMedian: completionMedian.percentageState, visualP95: visualP95.percentageState, completionP95: completionP95.percentageState },
      regressionInvestigation: { criterion: "CAMP.QLT.05", metric: "completion-p95", thresholdPercent: 20, required: investigationReason !== null, reason: investigationReason },
    }
  })
  const complete = comparisons.every((row) => row.state === "comparable")
  return {
    state: complete ? "comparable" as const : "incomplete" as const,
    reason: complete ? null : "Some configurations lack consistent 30/30 successful observations",
    candidateSha: candidate.productSha, baselineSha: baseline.productSha,
    requiresInvestigation: comparisons.some((row) => row.regressionInvestigation?.required === true) ? true : complete ? false : null, comparisons,
  }
}

function configurationProblem(value: MeasurementPlan) {
  if (!value || typeof value.flow !== "string" || !value.flow.trim()) return "Missing flow"
  if (![value.viewportWidth, value.viewportHeight, value.repetitions].every((number) => Number.isSafeInteger(number) && number > 0) ||
    !Number.isFinite(value.zoomPercent) || value.zoomPercent <= 0) return "Invalid dimensions or repetitions"
  return null
}

function summaryProblem(row: ReturnType<typeof summarizeMeasurements>[number]) {
  if (![row.attempted, row.passed, row.failed, row.cancelled].every((count) => Number.isSafeInteger(count) && count >= 0 && count <= row.repetitions) ||
    row.attempted !== row.passed + row.failed || row.attempted + row.cancelled !== row.repetitions)
    return "Attempt counts are inconsistent"
  if (row.cancelled ? typeof row.cancellationReason !== "string" || !row.cancellationReason.trim() : row.cancellationReason !== null)
    return "Cancellation count and reason disagree"
  if (row.statisticsPopulation !== statisticsPopulation || row.quantileMethod !== quantileMethod) return "Statistical methods differ"
  if ([row.visualReady, row.completion].some((value) => !value || value.samples !== row.passed ||
    (row.passed === 0 ? value.medianMs !== null || value.p95Ms !== null :
      typeof value.medianMs !== "number" || !Number.isFinite(value.medianMs) || value.medianMs < 0 ||
      typeof value.p95Ms !== "number" || !Number.isFinite(value.p95Ms) || value.p95Ms < value.medianMs)))
    return "Distribution counts or latencies are inconsistent"
  if (row.passed && (row.completion.medianMs! < row.visualReady.medianMs! || row.completion.p95Ms! < row.visualReady.p95Ms!))
    return "Completion quantiles precede usable content"
  return null
}

function latencyChange(candidate: number, baseline: number) {
  const deltaMs = candidate - baseline
  if (baseline === 0) return { deltaMs, deltaPercent: null, percentageState: "baseline-zero" as const }
  const deltaPercent = deltaMs / baseline * 100
  return Number.isFinite(deltaPercent) ? { deltaMs, deltaPercent, percentageState: "measured" as const } :
    { deltaMs, deltaPercent: null, percentageState: "percentage-overflow" as const }
}

function distribution(values: readonly number[]) {
  const sorted = values.toSorted((left, right) => left - right)
  if (!sorted.length) return { samples: 0, medianMs: null, p95Ms: null }
  const middle = Math.floor(sorted.length / 2)
  return {
    samples: sorted.length,
    medianMs: sorted.length % 2 ? sorted[middle]! : sorted[middle - 1]! + (sorted[middle]! - sorted[middle - 1]!) / 2,
    p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1]!,
  }
}
