import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

test("C02 qualifies each HR domain and month while preserving authorized aggregates and independent actual/forecast", async () => {
  const snapshot = plannerSnapshot()
  const version = rows(snapshot.data.versions)[0]!
  version.closed = 1
  version.lines = [{ id: "foreign-license", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100), a: [10], f: [] }]
  version.fx = [{ id: "EUR", cur: "EUR", rate: null }]
  version.hc = { positions: [
    { id: "priced", name: "Priced", include: true, fte: 1, start: 7, end: 12, domain: "IT", type: "Employee", location: "Brazil", rateId: "usd", talentReview: "private talent result", outlook: "private personnel outlook" },
    { id: "missing", name: "Missing rate", include: true, fte: 1, start: 7, end: 12, domain: "Finance", type: "Employee", location: "Unknown" },
    { id: "foreign", name: "Missing FX", include: true, fte: 0.5, start: 7, end: 12, domain: "Legal", type: "Employee", location: "France", rateId: "eur" },
  ], rates: [{ id: "usd", name: "USD role", locs: "Brazil", annual: 120000, cur: "USD" }, { id: "eur", name: "EUR role", locs: "France", annual: 90000, cur: "EUR" }], hrAF: { IT: { a: [10] }, Finance: { a: [500], f: [null, null, null, null, null, null, 0] }, Legal: { a: [250], f: [null, null, null, null, null, null, 20] } } }
  const fixture = await plannerFixture(snapshot)
  try {
    const observed: Record<string, { id: string; value: unknown; evidenceState: string }[]> = {}
    for (const principal of ["finance", "viewer"]) {
      const context = await fixture.admit("sf-human:planner.read", {}, principal, true)
      const source = await fixture.issueSource("v0", context)
      if (source.status !== "ok") throw new Error("HR source unavailable")
      const comparison = await fixture.planner.compareForecast({ baseRef: source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
      expect(comparison.status).toBe("ok")
      if (comparison.status !== "ok") throw new Error("HR comparison unavailable")
      const projection = comparison.value.baseline
      const cell = (id: string) => projection.values.find((value) => value.id === id)
      expect(cell("HR:IT:7:budget-usd")).toMatchObject({ value: 10000, evidenceState: "confirmed" })
      expect(cell("HR:IT:7:outlook-usd")).toMatchObject({ value: 10000, evidenceState: "estimated" })
      expect(cell("HR:Finance:1:actual-usd")).toMatchObject({ value: 500, evidenceState: "confirmed" })
      expect(cell("HR:Finance:1:budget-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:Finance:7:budget-usd")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(cell("HR:Finance:7:outlook-usd")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(cell("HR:Finance:8:outlook-usd")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(cell("HR:Legal:1:actual-usd")).toMatchObject({ value: 250, evidenceState: "confirmed" })
      expect(cell("HR:Legal:7:forecast")).toMatchObject({ value: 20, evidenceState: "confirmed" })
      expect(cell("HR:Legal:7:outlook-usd")).toMatchObject({ value: 20, evidenceState: "confirmed" })
      expect(cell("HR:Legal:8:outlook-usd")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(projection.missing).toContainEqual({ field: "HR:Finance:7:budget", reason: "missing-rate" })
      expect(projection.missing).toContainEqual({ field: "HR:Legal:7:budget", reason: "missing-fx" })
      expect(projection.missing).not.toContainEqual({ field: "HR:IT:7:budget", reason: "missing-fx" })
      expect(projection.missing.some((entry) => entry.reason === "restricted")).toBe(false)
      expect(cell("month:7:fte")).toMatchObject({ value: 2.5, unit: "fte", evidenceState: "confirmed" })
      expect(comparison.value.knownDifference).toBeNull()
      observed[principal] = projection.values.map(({ id, value, evidenceState }) => ({ id, value, evidenceState }))
    }
    expect(observed.viewer).toEqual(observed.finance)
    const publicSource = projectPlannerSource(snapshot, { id: "viewer", roles: ["viewer"], canWrite: false }, "v0")!
    expect(rows(object(publicSource.summary).lines).some((line) => line.id === "HR:IT")).toBe(true)
    for (const privateField of ['"rateId"', '"rates"', '"rateOverride"', "private talent result", "private personnel outlook"]) expect(JSON.stringify(publicSource)).not.toContain(privateField)
    for (const position of [...rows(object(publicSource.hc).positions), ...rows(object(publicSource.summary).positions)]) expect(Object.keys(position).some((key) => ["annual", "months", "total", "budget", "rate", "salary", "cost", "talentReview", "outlook"].includes(key))).toBe(false)
    expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
  } finally { await fixture.close() }
})
