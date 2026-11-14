import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { buildPlannerFinancialProjection, createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { plannerSnapshot } from "./planner-fixture.ts"
import { scenarioEngineFixture, scenarioMonth } from "./scenario-engine-fixture.ts"

const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const monthly = (value: number | null) => Array.from({ length: 12 }, (_, index) => index === 10 ? value : 0)

function snapshot() {
  const value = plannerSnapshot()
  const version = rows(value.data.versions)[0]!
  version.lines = [
    { id: "known", sec: "opex", el: "licenses", cur: "USD", b: monthly(2000), a: [], f: monthly(2000) },
    { id: "missing", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(null), a: [], f: [] },
    { id: "untouched", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(null), a: [], f: [] },
  ]
  value.data.versions = [version]
  return value
}

test("replace and include qualify an absent forecast from the real post-command copy, including explicit zero", async () => {
  const fixture = await scenarioEngineFixture(snapshot())
  try {
    const before = await fixture.readSnapshot()
    const baseline = await fixture.planner.simulateScenario({ baseRef: fixture.source.refId, operations: [], assumptions: [] }, fixture.context)
    expect(baseline).toMatchObject({ status: "ok", value: { knownSubtotal: 2000, total: null } })
    if (baseline.status !== "ok") throw new Error(baseline.reason)
    expect(baseline.value.components.find((component) => component.id === "missing:11")).toMatchObject({ amount: null, evidenceState: "absent" })
    const environment = await fixture.host.environment(fixture.host.requestFor(fixture.context)!)
    for (const kind of ["replace", "include"] as const) for (const amount of [1000, 0]) {
      const request: ScenarioRequest = { baseRef: fixture.source.refId, operations: [{ kind, targetRef: "missing:11", amount, currency: "USD", period: scenarioMonth }], assumptions: [] }
      const original = structuredClone(request)
      const isolated = structuredClone(before)
      const executed = domain.execute(isolated, actor, { page: "OPEX", action: "save", id: "missing", version: isolated.versions["v0:lines:missing"]?.version ?? 0, values: { versionId: "v0", f10: amount } }, environment)
      expect(executed.ok).toBe(true)
      const projection = projectPlannerSource(isolated, actor, "v0")
      if (!projection) throw new Error("Post-command source projection unavailable")
      const canonical = buildPlannerFinancialProjection({ projection, ref: fixture.source, period: scenarioMonth, binding: fixture.context, at: environment.at })
      const simulated = await fixture.planner.simulateScenario(request, fixture.context)
      expect(simulated).toMatchObject({ status: "ok", value: { knownSubtotal: amount === 0 ? 2000 : 3000, total: null, comparisonStatus: "conditioned", restrictions: ["preview-not-applied"] } })
      if (simulated.status !== "ok") throw new Error(simulated.reason)
      expect(simulated.value.components).toEqual(canonical.components.map((component) => ({ ...component, evidenceState: component.id === "missing:11" ? "hypothetical" : component.evidenceState })))
      expect(simulated.value.components.find((component) => component.id === "missing:11")).toMatchObject({ amount, evidenceState: "hypothetical" })
      expect(simulated.value.components.find((component) => component.id === "untouched:11")).toMatchObject({ amount: null, evidenceState: "absent" })
      expect(simulated.value.unresolvedConditions).not.toContain("missing:11:budget:missing")
      expect(simulated.value.unresolvedConditions).toContain("untouched:11:budget:missing")
      expect(simulated.value.unresolvedConditions).toContain("scenario-is-hypothetical")
      expect(await fixture.planner.simulateScenario(request, fixture.context)).toEqual(simulated)
      expect(request).toEqual(original)
      expect(await fixture.readSnapshot()).toEqual(before)
    }
  } finally { await fixture.close() }
}, 60000)

test("an explicit foreign forecast without FX stays absent instead of publishing the engine's legacy zero", async () => {
  const initial = snapshot()
  const version = rows(initial.data.versions)[0]!
  rows(version.lines).find((line) => line.id === "missing")!.cur = "EUR"
  version.fx = [{ id: "EUR", cur: "EUR", rate: null }]
  const fixture = await scenarioEngineFixture(initial)
  try {
    const before = await fixture.readSnapshot()
    const request: ScenarioRequest = { baseRef: fixture.source.refId, operations: [{ kind: "replace", targetRef: "missing:11", amount: 1000, currency: "EUR", period: scenarioMonth }], assumptions: [] }
    const original = structuredClone(request)
    const isolated = structuredClone(before)
    const environment = await fixture.host.environment(fixture.host.requestFor(fixture.context)!)
    expect(domain.execute(isolated, actor, { page: "OPEX", action: "save", id: "missing", version: 0, values: { versionId: "v0", f10: 1000 } }, environment).ok).toBe(true)
    const projection = projectPlannerSource(isolated, actor, "v0")!
    expect((rows(object(projection.summary).lines).find((line) => line.id === "missing")!.outlook as number[])[10]).toBe(0)
    const canonical = buildPlannerFinancialProjection({ projection, ref: fixture.source, period: scenarioMonth, binding: fixture.context, at: environment.at })
    expect(canonical.components.find((component) => component.id === "missing:11")).toMatchObject({ amount: null, evidenceState: "absent" })
    expect(canonical.missing).toContainEqual({ field: "missing:11:fx", reason: "missing-fx" })
    const result = await fixture.planner.simulateScenario(request, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { knownSubtotal: 2000, total: null, comparisonStatus: "conditioned" } })
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.components).toEqual(canonical.components)
    expect(result.value.unresolvedConditions).toContain("missing:11:fx:missing-fx")
    expect(await fixture.planner.simulateScenario(request, fixture.context)).toEqual(result)
    expect(request).toEqual(original)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
}, 60000)

test("a hypothetical HR forecast remains quantifiable when its independent budget rate is absent", async () => {
  const initial = snapshot()
  const version = rows(initial.data.versions)[0]!
  version.hc = { positions: [{ id: "unpriced", name: "Unpriced position", include: true, fte: 1, start: 1, end: 12, domain: "Finance", type: "Employee", location: "Unknown" }], rates: [], hrAF: {} }
  const fixture = await scenarioEngineFixture(initial)
  try {
    const before = await fixture.readSnapshot()
    const request: ScenarioRequest = { baseRef: fixture.source.refId, operations: [{ kind: "replace", targetRef: "HR:Finance:11", amount: 1200, currency: "USD", period: scenarioMonth }], assumptions: [] }
    const original = structuredClone(request)
    const baseline = await fixture.planner.simulateScenario({ baseRef: fixture.source.refId, operations: [], assumptions: [] }, fixture.context)
    if (baseline.status !== "ok") throw new Error(baseline.reason)
    expect(baseline.value.components.find((component) => component.id === "HR:Finance:11")).toMatchObject({ amount: null, evidenceState: "absent" })
    const isolated = structuredClone(before)
    const environment = await fixture.host.environment(fixture.host.requestFor(fixture.context)!)
    expect(domain.execute(isolated, actor, { page: "OPEX", action: "save", id: "HR:Finance", version: 0, values: { versionId: "v0", f10: 1200 } }, environment).ok).toBe(true)
    const projection = projectPlannerSource(isolated, actor, "v0")!
    const canonical = buildPlannerFinancialProjection({ projection, ref: fixture.source, period: scenarioMonth, binding: fixture.context, at: environment.at })
    expect(canonical.values.find((value) => value.id === "HR:Finance:11:budget-usd")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(canonical.values.find((value) => value.id === "HR:Finance:11:forecast")).toMatchObject({ value: 1200, evidenceState: "confirmed" })
    expect(canonical.missing).toContainEqual({ field: "HR:Finance:11:budget", reason: "missing-rate" })
    const result = await fixture.planner.simulateScenario(request, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { knownSubtotal: 3200, total: null, comparisonStatus: "conditioned" } })
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.components).toEqual(canonical.components.map((component) => ({ ...component, evidenceState: component.id === "HR:Finance:11" ? "hypothetical" : component.evidenceState })))
    expect(result.value.unresolvedConditions).toContain("HR:Finance:11:budget:missing-rate")
    expect(result.value.unresolvedConditions).not.toContain("HR:Finance:11:outlook:missing-rate")
    expect(await fixture.planner.simulateScenario(request, fixture.context)).toEqual(result)
    expect(request).toEqual(original)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
}, 60000)

test("a self-comparison reads once per source observation and still rejects revocation at final revalidation", async () => {
  const fixture = await scenarioEngineFixture(snapshot())
  try {
    const calls = { source: 0, coverage: 0, revoke: false }
    const sources: PlannerSourceHost = { resolveForecastSource: async (reference, binding) => {
      calls.source++
      const value = await fixture.sources.resolveForecastSource(reference, binding)
      if (calls.revoke && calls.source === 2) fixture.access.allowed = false
      return value
    }, resolveForecastCoverage: async (reference, binding) => { calls.coverage++; return fixture.sources.resolveForecastCoverage(reference, binding) } }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const request = { baseRef: fixture.source.refId, candidateRef: fixture.source.refId, period: scenarioMonth, currency: "USD" }
    const first = await planner.compareForecast(request, fixture.context)
    expect(first.status).toBe("ok")
    expect(calls).toEqual({ source: 2, coverage: 2, revoke: false })
    if (first.status !== "ok") throw new Error(first.reason)
    expect(digestSfValue(first.value.baseline)).toBe(digestSfValue(first.value.candidate))
    expect(first.value.baseline).not.toBe(first.value.candidate)
    expect(first.value.baseline.components).not.toBe(first.value.candidate.components)
    calls.source = 0
    calls.coverage = 0
    calls.revoke = true
    const revoked = await planner.compareForecast(request, fixture.context)
    expect(revoked.status).toBe("stale")
    expect(revoked).not.toHaveProperty("value")
    expect(calls.source).toBe(2)
  } finally { await fixture.close() }
}, 60000)
