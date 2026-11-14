import { expect, test } from "bun:test"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import { createPlannerSensitivity } from "../../../../product/portfolio/planner-sensitivity.ts"
import { createRenewalChoiceHistory } from "../../wp11/renewal-choice-fixture.ts"

type History = Awaited<ReturnType<typeof createRenewalChoiceHistory>>
type ConsumerPreview = Parameters<typeof createPlannerSensitivity>[0]["preview"]
type Observation = {
  resolution: number
  ordinal: number
  amount: number | null | undefined
  metric: number | null | undefined
  status: string
  durationMs: number
}

// Regression first: the unmodified producer performs two full searches here.
// After the product change the same operation searches once, while both pairs
// of fresh adjacent certification witnesses and all authority checks remain.
test("Finance sensitivity searches once and recertifies fresh adjacent witnesses without retaining authority for the next operation", async () => {
  const history = await createRenewalChoiceHistory()
  const observed = instrument(history, "search-work")
  try {
    const request = endpoints(history.before.sensitivityRequest)
    expect(history.before.baselineResult.knownSubtotal).toBe(240000)
    expect(history.before.selectedResult).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    const result = await observed.evaluate(request, history.fixture.context)
    if (result.status !== "ok") throw new Error(`Real omitted-training sensitivity failed: ${JSON.stringify(result)}`)
    expect(result.value.threshold).toBeCloseTo(55000, 8)
    expect(result.value.thresholdEvidence.state).toBe("exact")
    expect(result.value.comparisonStatus).toBe("conditioned")
    expect(result.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    if (result.value.threshold === null) throw new Error("The real exact certificate has no boundary")
    const threshold = result.value.threshold
    const witnesses = observed.previews.filter((preview) => typeof preview.amount === "number" && preview.amount >= threshold && preview.amount < threshold + 1)
    expect(witnesses).toHaveLength(4)
    for (const resolution of [1, 2]) {
      const pair = witnesses.filter((preview) => preview.resolution === resolution)
      expect(pair).toHaveLength(2)
      expect(pair[0]!.amount).toBe(threshold)
      if (typeof pair[1]!.amount !== "number" || pair[0]!.metric === null || pair[0]!.metric === undefined || pair[1]!.metric === null || pair[1]!.metric === undefined) throw new Error("Fresh adjacent witnesses are missing")
      expect(positiveBits(pair[1]!.amount) - positiveBits(threshold)).toBe(1n)
      expect(pair[0]!.metric <= request.criterion.value).toBe(true)
      expect(pair[1]!.metric <= request.criterion.value).toBe(false)
    }
    const completed = { ...observed.counts }
    expect(completed.resolutions).toBe(2)
    expect(completed.revalidations).toBe(4)
    expect(completed.consumerPreviews).toBe(8)
    expect(completed.sampleWrites).toBe(2)
    history.fixture.ui.finish(history.fixture.context)
    expect(await history.fixture.host.revalidate(history.fixture.context)).toBe(false)
    const denied = await observed.evaluate(request, history.fixture.context)
    expect(denied.status).not.toBe("ok")
    expect(observed.counts.resolutions).toBe(completed.resolutions + 1)
    expect(observed.counts.searches).toBe(completed.searches)
    expect(observed.counts.sampleWrites).toBe(completed.sampleWrites)
    observed.report({ result: result.status, threshold, comparisonStatus: result.value.comparisonStatus, nextOperation: denied.status, completed })
    // Deliberately fails with 2 on the old producer. No fixture, timeout,
    // authority callback, financial value or required witness is substituted.
    expect(completed.searches).toBe(1)
    expect(completed.searchUnitIssues).toBe(2)
  } finally {
    observed.report({ phase: "terminal" })
    await history.cleanup()
  }
}, 120000)

test("Finance sensitivity refuses authority revoked after the final awaited adjacent witness", async () => {
  const history = await createRenewalChoiceHistory()
  const observed = instrument(history, "final-witness-revocation")
  const controls = { revoked: false }
  try {
    observed.controls.afterPreview = async (preview) => {
      // The second resolution starts final recertification. Its first two
      // previews reread samples; its last two are fresh adjacent witnesses.
      if (preview.resolution !== 2 || preview.ordinal !== 4) return
      history.fixture.ui.finish(history.fixture.context)
      controls.revoked = true
    }
    const result = await observed.evaluate(endpoints(history.before.sensitivityRequest), history.fixture.context)
    expect(controls.revoked).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(observed.counts.revalidations).toBe(4)
    expect(await history.fixture.host.revalidate(history.fixture.context)).toBe(false)
    observed.report({ result: result.status, revokedAfterFinalWitness: controls.revoked })
  } finally {
    observed.report({ phase: "terminal" })
    await history.cleanup()
  }
}, 120000)

/** Counts real public producer calls; the observers never issue extra reads. */
function instrument(history: History, phase: string) {
  const started = Date.now()
  const before = history.before
  const counts = { searches: 0, searchPreviews: 0, searchUnitIssues: 0, resolutions: 0, revalidations: 0, consumerPreviews: 0, sampleWrites: 0 }
  const previews: Observation[] = []
  const controls: { afterPreview?: (preview: Observation) => Promise<void> } = {}
  const search = createPlannerExactThreshold({
    units: { ...before.issuer, issue: async (...args) => { counts.searchUnitIssues++; return before.issuer.issue(...args) } },
    preview: async (...args) => { counts.searchPreviews++; return before.preview(...args) },
  })
  const preview: ConsumerPreview = async (request, context) => {
    const at = Date.now()
    const result = await before.preview(request, context)
    counts.consumerPreviews++
    const observation = {
      resolution: counts.resolutions,
      ordinal: previews.filter((value) => value.resolution === counts.resolutions).length + 1,
      amount: request.scenario.operations.find((operation) => operation.targetRef === before.sensitivityRequest.parameterBounds.parameterRef)?.amount,
      metric: result.status === "ok" ? result.value.metric.value : undefined,
      status: result.status,
      durationMs: Date.now() - at,
    }
    previews.push(observation)
    await controls.afterPreview?.(observation)
    return result
  }
  const evaluate = createPlannerSensitivity({
    results: { ...before.results, write: async (...args) => { counts.sampleWrites++; return before.results.write(...args) } },
    resolve: async (...args) => { counts.resolutions++; return before.issuer.resolve(...args) },
    revalidate: async (...args) => { counts.revalidations++; return before.issuer.revalidate(...args) },
    preview,
    exactThreshold: async (request, binding, context) => { counts.searches++; return search(request, binding.baselineRef, context) },
    idempotencyKey: async () => `finance-resume-performance:${phase}`,
  })
  return {
    counts, previews, controls, evaluate,
    report: (detail: Record<string, unknown>) => console.info("[finance-resume-performance]", JSON.stringify({ phase, elapsedMs: Date.now() - started, counts, previews, ...detail })),
  }
}

function endpoints(request: SensitivityRequest): SensitivityRequest {
  return { ...request, parameterBounds: { ...request.parameterBounds, steps: 1 } }
}

function positiveBits(value: number) {
  const data = new DataView(new ArrayBuffer(8))
  data.setFloat64(0, value)
  return data.getBigUint64(0)
}
