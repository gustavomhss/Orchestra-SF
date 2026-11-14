import { expect, test } from "bun:test"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createWp13SensitivityRuntimeFixture } from "./sensitivity-fixture.ts"

test("sensitivity retains the admitted request when a provider mutates its borrowed input", async () => {
  const world = await createWp13SensitivityRuntimeFixture()
  try {
    const request = structuredClone(world.sensitivityRequest)
    const evaluate = createPlannerSensitivity({
      results: world.results,
      resolve: async (borrowed, context) => {
        const resolved = structuredClone(await world.issuer.resolve(borrowed, context))
        borrowed.criterion.value = 999
        return resolved
      },
      revalidate: world.issuer.revalidate,
      preview: (input, context) => comparePlannerPreview({ host: world.host, sources: world.sources, scenarios: world.scenarios, planner: world.planner }, input, context),
      idempotencyKey: async () => "request-snapshot",
    })
    const result = await evaluate(request, world.context)
    expect(result.status).toBe("ok")
    expect(request).toEqual(world.sensitivityRequest)
    if (result.status !== "ok") return
    expect(result.value.evaluated.map((sample) => sample.parameterValue)).toEqual([100000, 110000, 120000])
    expect(result.value.evaluated.every((sample) => sample.value === null)).toBe(true)
    expect(result.value.comparisonStatus).toBe("conditioned")
  } finally { await world.cleanup() }
})

test("sensitivity detects a provider reusing and changing the original source record", async () => {
  const world = await createWp13SensitivityRuntimeFixture()
  try {
    const original = await world.results.readHistoricalScenario({ resultRef: world.selectedRef }, world.context)
    if (original.status !== "ok") throw new Error("source scenario unavailable")
    const borrowed = structuredClone(original)
    let reads = 0
    const evaluate = createPlannerSensitivity({
      results: {
        ...world.results,
        readHistoricalScenario: async (request, context) => {
          if (request.resultRef !== world.selectedRef) return world.results.readHistoricalScenario(request, context)
          if (++reads > 1) borrowed.value.resultDigest = "e".repeat(64)
          return borrowed
        },
      },
      resolve: world.issuer.resolve,
      revalidate: world.issuer.revalidate,
      preview: (input, context) => comparePlannerPreview({ host: world.host, sources: world.sources, scenarios: world.scenarios, planner: world.planner }, input, context),
      idempotencyKey: async () => "source-snapshot",
    })
    expect(await evaluate(world.sensitivityRequest, world.context)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
    expect(reads).toBe(2)
  } finally { await world.cleanup() }
})
