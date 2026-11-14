import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest, SensitivityRequest } from "../../../product/contracts/operations.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import type { PlannerScenarioHost } from "../../../product/planner/scenario-comparison-port.ts"
import type { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { plannerSnapshot } from "./planner-fixture.ts"
import { scenarioEngineFixture, scenarioMonth } from "./scenario-engine-fixture.ts"

test("the real Planner long IEEE plateau uses bisection and certifies one against nextUp one", async () => {
  const initial = plannerSnapshot()
  const version = rows(initial.data.versions)[0]!
  const months = (value: number) => Array.from({ length: 12 }, (_, index) => index === 10 ? value : 0)
  version.lines = [
    { id: "fixed", sec: "opex", el: "licenses", cur: "USD", b: months(2 ** 53), a: [], f: months(2 ** 53) },
    { id: "parameter", sec: "opex", el: "licenses", cur: "USD", b: months(0), a: [], f: months(0) },
  ]
  initial.data.versions = [version]
  const fixture = await scenarioEngineFixture(initial)
  try {
    const before = await fixture.readSnapshot()
    const observation: ScenarioRequest = { baseRef: fixture.source.refId, operations: [], assumptions: [] }
    const baseline = await fixture.planner.simulateScenario(observation, fixture.context)
    const projection = await fixture.planner.compareForecast({ baseRef: fixture.source.refId, candidateRef: fixture.source.refId, currency: "USD", period: scenarioMonth }, fixture.context)
    if (baseline.status !== "ok" || projection.status !== "ok") throw new Error("IEEE baseline unavailable")
    expect(baseline.value.knownSubtotal).toBe(2 ** 53)
    expect(baseline.value.components.map((component) => component.id)).toEqual(["fixed:11", "parameter:11"])
    const scenario: ScenarioRequest = { ...observation, operations: [{ kind: "replace", targetRef: "parameter:11", amount: 0, currency: "USD", period: scenarioMonth }] }
    const original = structuredClone(scenario)
    const scenarios: PlannerScenarioHost = { resolve: async (reference, context) => {
      if (reference !== "ieee-baseline" || !await fixture.host.revalidate(context)) return { status: "unavailable", reason: "IEEE baseline unavailable" }
      return { status: "ok", value: { result: baseline.value, projection: projection.value.baseline, coverageRef: fixture.coverageRef, basis: fixture.basis, source: fixture.source } }
    } }
    // This fixture fixes only the units/rule admission. Every monetary sample,
    // source qualification, comparison and boundary witness runs the real domain.
    const unitIssues = { count: 0 }
    const units = { issue: async () => { unitIssues.count++; return { status: "ok", value: { scenario: structuredClone(scenario), metadataDigest: digestSfValue({ scenario, source: fixture.source }), units: { sourceRefs: [fixture.source], engineVersion: "planner-runtime-v1", parameterUnit: "USD", resultUnit: "USD" } } } } } as unknown as ReturnType<typeof createPlannerSensitivityUnits>
    const parameters: number[] = []
    const preview: Parameters<typeof createPlannerExactThreshold>[0]["preview"] = async (request, context) => {
      parameters.push(request.scenario.operations[0]!.amount!)
      return comparePlannerPreview({ host: fixture.host, sources: fixture.sources, scenarios, planner: fixture.planner }, request, context)
    }
    const request: SensitivityRequest = { scenarioRef: "ieee-alternative", parameterBounds: { parameterRef: "parameter:11", minimum: 0, maximum: 16, steps: 3 }, criterion: { id: "zero-increment", operator: "lte", value: 0 } }
    const originalRequest = structuredClone(request)
    const solved = await createPlannerExactThreshold({ units, preview })(request, "ieee-baseline", fixture.context)
    expect(solved.status).toBe("ok")
    if (solved.status !== "ok") throw new Error(solved.reason)
    expect(solved.value.value).toBe(1)
    expect(parameters.length).toBeGreaterThan(18)
    expect(unitIssues.count).toBe(2)
    const bytes = new DataView(new ArrayBuffer(8))
    bytes.setFloat64(0, 1)
    bytes.setBigUint64(0, bytes.getBigUint64(0) + 1n)
    const adjacent = bytes.getFloat64(0)
    expect(parameters.slice(-2)).toEqual([1, adjacent])
    const at = await preview({ baselineRef: "ieee-baseline", scenario: { ...scenario, operations: [{ ...scenario.operations[0]!, amount: 1 }] } }, fixture.context)
    const beyond = await preview({ baselineRef: "ieee-baseline", scenario: { ...scenario, operations: [{ ...scenario.operations[0]!, amount: adjacent }] } }, fixture.context)
    expect(at).toMatchObject({ status: "ok", value: { metric: { value: 0 }, sample: { knownSubtotal: 2 ** 53, total: null, comparisonStatus: "conditioned" } } })
    expect(beyond).toMatchObject({ status: "ok", value: { metric: { value: 2 }, sample: { knownSubtotal: 2 ** 53 + 2, total: null, comparisonStatus: "conditioned" } } })
    expect(solved.value.evidenceRefs).toContainEqual(fixture.source)
    expect(scenario).toEqual(original)
    expect(request).toEqual(originalRequest)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
}, 60000)
