import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

function snapshot() {
  const value = plannerSnapshot()
  const version = rows(value.data.versions)[0]!
  version.closed = 1
  version.lines = []
  version.hc = {
    positions: [
      { id: "missing-number", domain: "MissingNumber", rateId: 999 },
      { id: "missing-string", domain: "MissingString", rateId: "999" },
      { id: "explicit-number", domain: "ExplicitNumber", rateId: 7 },
      { id: "known-zero", domain: "KnownZero", rateId: 8 },
      { id: "automatic", domain: "Automatic", rateId: "" },
    ].map((position) => ({ ...position, name: position.id, include: true, fte: 1, start: 1, end: 12, type: "Employee", location: "Brazil" })),
    rates: [
      { id: "automatic-card", name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" },
      { id: 7, name: "Explicit card", locs: "Elsewhere", annual: 240000, cur: "USD" },
      { id: 8, name: "Confirmed zero", locs: "Elsewhere", annual: 0, cur: "USD" },
    ],
    hrAF: { MissingNumber: { a: [0], f: [null, 15] }, MissingString: { a: [20], f: [null, 0] } },
  }
  return value
}

test("C02 preserves explicit numeric HR identity, known zero and independent actual/forecast for finance and viewer", async () => {
  const fixture = await plannerFixture(snapshot())
  try {
    const before = await fixture.readSnapshot()
    const observed: Record<string, unknown> = {}
    for (const principal of ["finance", "viewer"]) {
      const context = await fixture.admit("sf-human:planner.read", {}, principal, true)
      const request = fixture.host.requestFor(context)
      if (!request) throw new Error("The real UI admission has no current request")
      const environment = await fixture.host.environment(request)
      const actor = { id: principal, roles: [principal], canWrite: principal === "finance" }
      const view = domain.view(before, actor, environment)
      const version = rows(view.data.versions).find((entry) => entry.id === "v0")!
      const summary = object(version.summary)
      for (const id of ["missing-number", "missing-string"]) {
        expect(rows(summary.positions).find((position) => position.id === id)?.hasRate).toBe(false)
      }
      expect(rows(summary.lines).find((line) => line.id === "HR:MissingNumber")?.budget).toEqual(Array(12).fill(0))
      expect(rows(summary.lines).find((line) => line.id === "HR:ExplicitNumber")?.budget).toEqual(Array(12).fill(20000))
      const source = await fixture.issueSource("v0", context)
      if (source.status !== "ok") throw new Error("The real issuer refused the readable legacy source")
      const comparison = await fixture.planner.compareForecast({ baseRef: source.value.evidence.refId,
        candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
      if (comparison.status !== "ok") throw new Error("The real comparison did not return its qualified source")
      const projection = comparison.value.baseline
      const cell = (id: string) => projection.values.find((value) => value.id === id)
      for (const label of ["MissingNumber", "MissingString"]) {
        expect(cell(`HR:${label}:3:budget-usd`)).toMatchObject({ value: null, evidenceState: "absent" })
        expect(cell(`HR:${label}:3:outlook-usd`)).toMatchObject({ value: null, evidenceState: "absent" })
        expect(projection.components.find((component) => component.id === `HR:${label}:3`)).toMatchObject({ amount: null, evidenceState: "absent" })
        expect(projection.missing).toContainEqual({ field: `HR:${label}:3:budget`, reason: "missing-rate" })
      }
      expect(cell("HR:MissingNumber:1:actual-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:MissingNumber:1:outlook-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:MissingNumber:2:outlook-usd")).toMatchObject({ value: 15, evidenceState: "confirmed" })
      expect(cell("HR:MissingString:1:actual-usd")).toMatchObject({ value: 20, evidenceState: "confirmed" })
      expect(cell("HR:MissingString:2:outlook-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:ExplicitNumber:3:budget-usd")).toMatchObject({ value: 20000, evidenceState: "confirmed" })
      expect(cell("HR:KnownZero:3:budget-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:KnownZero:3:outlook-usd")).toMatchObject({ value: 0, evidenceState: "estimated" })
      expect(cell("HR:Automatic:3:budget-usd")).toMatchObject({ value: 10000, evidenceState: "confirmed" })
      expect(cell("month:3:fte")).toMatchObject({ value: 5, evidenceState: "confirmed" })
      expect(cell("month:3:hr-budget")).toMatchObject({ value: null, evidenceState: "absent" })
      for (const label of ["ExplicitNumber", "KnownZero", "Automatic"]) {
        expect(projection.missing.some((entry) => entry.field.startsWith(`HR:${label}:`) && entry.reason === "missing-rate")).toBe(false)
      }
      expect(comparison.value.knownDifference).toBeNull()
      observed[principal] = projection.values.map(({ id, value, evidenceState }) => ({ id, value, evidenceState }))
      if (principal === "viewer") {
        const publicSource = projectPlannerSource(before, actor, "v0")!
        for (const field of ['"rateId"', '"rates"', '"annualCost"', '"rateOverride"']) expect(JSON.stringify(publicSource)).not.toContain(field)
      }
    }
    expect(observed.viewer).toEqual(observed.finance)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
}, 60000)

test("qualified HR self-comparison still refuses revocation during the final coverage observation", async () => {
  const fixture = await plannerFixture(snapshot())
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const source = await fixture.issueSource("v0", context)
    if (source.status !== "ok") throw new Error("The real issuer refused the readable legacy source")
    const before = await fixture.readSnapshot()
    const calls = { source: 0, coverage: 0 }
    const planner = createPlannerPort({ host: fixture.host, sources: {
      resolveForecastSource: async (reference, binding) => {
        calls.source++
        return fixture.sources.resolveForecastSource(reference, binding)
      },
      resolveForecastCoverage: async (reference, binding) => {
        calls.coverage++
        const result = await fixture.sources.resolveForecastCoverage(reference, binding)
        if (calls.coverage === 2) fixture.access.allowed = false
        return result
      },
    } })
    const result = await planner.compareForecast({ baseRef: source.value.evidence.refId,
      candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
    expect(calls).toEqual({ source: 2, coverage: 2 })
    expect(result).toEqual({ status: "stale", reason: "coverage-or-authority-changed" })
    expect(result).not.toHaveProperty("value")
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
}, 60000)
