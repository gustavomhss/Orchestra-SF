import { expect, test } from "bun:test"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerIntervalProof } from "../../../product/planner/interval-proof.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { createWp05SensitivityFixture } from "../wp05/engine-fixture.ts"

test("composed Planner operations preserve all fixed costs while proving the real 55000 boundary", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const before = structuredClone(fixture.scenario)
    const observations: ScenarioRequest[] = []
    const preview: typeof fixture.preview = async (request, context) => {
      observations.push(structuredClone(request.scenario))
      return fixture.preview(request, context)
    }
    const proof = await createPlannerIntervalProof({ units: fixture.issuer, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    expect(proof.status).toBe("ok")
    if (proof.status !== "ok") throw new Error(`Composed interval unavailable: ${JSON.stringify(proof)}`)
    expect(proof.value).toMatchObject({ kind: "planner-direct-usd-v1", parameterRef: "implementation:11", minimum: 10000, maximum: 70000, unit: "USD" })
    expect(proof.value.componentIds).toEqual(fixture.selectedResult.components.map((component) => component.id))
    const solved = await createPlannerExactThreshold({ units: fixture.issuer, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    expect(solved.status).toBe("ok")
    if (solved.status !== "ok") throw new Error(`Composed threshold unavailable: ${JSON.stringify(solved)}`)
    expect(solved.value.value).toBeCloseTo(55000, 8)
    expect(solved.value.evidenceRefs.length).toBeGreaterThan(0)
    expect(observations.length).toBeGreaterThan(4)
    expect(observations.length).toBeLessThanOrEqual(18)
    for (const observation of observations) {
      expect(observation.operations).toHaveLength(3)
      expect(observation.operations.filter((operation) => operation.targetRef !== "implementation:11")).toEqual(before.operations.filter((operation) => operation.targetRef !== "implementation:11"))
    }
    const at = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: withAmount(before, solved.value.value) }, fixture.context)
    const beyond = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: withAmount(before, nextFloat(solved.value.value)) }, fixture.context)
    expect(at.status).toBe("ok")
    expect(beyond.status).toBe("ok")
    if (at.status !== "ok" || beyond.status !== "ok") throw new Error("Boundary witnesses unavailable")
    expect(at.value.metric.value).toBe(-20000)
    expect(beyond.value.metric.value).toBeGreaterThan(-20000)
    expect(at.value.sample.knownSubtotal).toBe(220000)
    expect(at.value.sample.total).toBeNull()
    expect(at.value.sample.comparisonStatus).toBe("conditioned")
    expect(fixture.scenario).toEqual(before)
    const stored = await fixture.results.read({ kind: "scenario", resultRef: fixture.selectedRef }, fixture.context)
    expect(stored.status).toBe("ok")
    if (stored.status !== "ok" || stored.value.kind !== "scenario") throw new Error("Stored alternative unavailable")
    expect(stored.value.result).toEqual(fixture.selectedResult)
    expect(stored.value.result.knownSubtotal).toBe(210000)
    expect((await fixture.cases.read({ caseRef: "case:case:case-incarnation" }, fixture.context)).status).toBe("ok")
  } finally { await fixture.cleanup() }
}, 180000)

test("composed Planner threshold includes confirmed training once and distinguishes zero from missing price", async () => {
  for (const training of ["confirmed", "zero", "null"] as const) {
    const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training, composed: true })
    try {
      const calls = { count: 0 }
      const preview: typeof fixture.preview = (request, context) => { calls.count++; return fixture.preview(request, context) }
      const solved = await createPlannerExactThreshold({ units: fixture.issuer, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
      const proof = await createPlannerIntervalProof({ units: fixture.issuer, preview: fixture.preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
      if (training === "null") {
        expect(solved).toMatchObject({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
        expect(proof).toMatchObject({ status: "unavailable", reason: "interval-domain-unproven" })
        expect(fixture.selectedResult.components.find((component) => component.id === "training:11")).toMatchObject({ amount: null, evidenceState: "absent" })
        continue
      }
      expect(solved.status).toBe("ok")
      expect(proof.status).toBe("ok")
      expect(calls.count).toBeLessThanOrEqual(18)
      if (solved.status !== "ok") throw new Error(`Training boundary unavailable: ${JSON.stringify(solved)}`)
      expect(solved.value.value).toBeCloseTo(training === "confirmed" ? 15000 : 55000, 8)
      expect(fixture.selectedResult.knownSubtotal).toBe(training === "confirmed" ? 250000 : 210000)
      expect(fixture.selectedResult.components.filter((component) => component.id === "training:11")).toHaveLength(1)
      const at = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: withAmount(fixture.scenario, training === "confirmed" ? 15000 : 55000) }, fixture.context)
      expect(at.status).toBe("ok")
      if (at.status !== "ok") throw new Error("Training witness unavailable")
      expect(at.value.metric.value).toBe(-20000)
      expect(at.value.sample.knownSubtotal).toBe(220000)
      expect(at.value.sample.total).toBeNull()
    } finally { await fixture.cleanup() }
  }
}, 180000)

test("composed interval and threshold refuse changing fixed costs or source revocation", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const preview: typeof fixture.preview = (request, context) => fixture.preview({ ...request, scenario: { ...request.scenario, operations: request.scenario.operations.map((operation) => operation.targetRef === "bridge:11" && request.scenario.operations.find((item) => item.targetRef === "implementation:11")?.amount === 70000 ? { ...operation, amount: 60001 } : operation) } }, context)
    expect(await createPlannerIntervalProof({ units: fixture.issuer, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "interval-domain-unproven" })
    expect(await createPlannerExactThreshold({ units: fixture.issuer, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
    fixture.revokeSource(fixture.scenario.baseRef)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect((await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).status).not.toBe("ok")
    expect((await createPlannerIntervalProof({ units: fixture.issuer, preview: fixture.preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).status).not.toBe("ok")
  } finally { await fixture.cleanup() }
}, 180000)

test("composed proof refuses duplicate and indirect writes to the varying parameter", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    for (const extra of [
      { kind: "replace" as const, targetRef: "implementation:11", amount: 1, currency: "USD" },
      { kind: "defer" as const, targetRef: "implementation:10", period: { start: "2027-11-01", end: "2027-11-30" } },
    ]) {
      const units = { ...fixture.issuer, issue: async (...args: Parameters<typeof fixture.issuer.issue>) => {
        const issued = await fixture.issuer.issue(...args)
        return issued.status === "ok" ? { ...issued, value: { ...issued.value, scenario: { ...issued.value.scenario, operations: [...issued.value.scenario.operations, extra] } } } : issued
      } }
      const calls = { count: 0 }
      const preview: typeof fixture.preview = (request, context) => { calls.count++; return fixture.preview(request, context) }
      expect(await createPlannerIntervalProof({ units, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "interval-domain-unproven" })
      expect(await createPlannerExactThreshold({ units, preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "exact-threshold-domain-unproven" })
      expect(calls.count).toBe(0)
    }
  } finally { await fixture.cleanup() }
}, 180000)

function withAmount(scenario: ScenarioRequest, amount: number): ScenarioRequest {
  return { ...scenario, operations: scenario.operations.map((operation) => operation.targetRef === "implementation:11" ? { ...operation, amount } : operation) }
}

function nextFloat(value: number) {
  const bytes = new DataView(new ArrayBuffer(8))
  bytes.setFloat64(0, value)
  bytes.setBigUint64(0, bytes.getBigUint64(0) + 1n)
  return bytes.getFloat64(0)
}
