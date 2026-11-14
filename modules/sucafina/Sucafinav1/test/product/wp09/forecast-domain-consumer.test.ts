import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { createPlannerForecastInsights } from "../../../product/planner/forecast-insights.ts"
import { createForecastFactsAccess, prepareForecastReview } from "../../../product/routines/forecast.ts"
import { createRoutinePlannerFixture, routineJanuary, routinePlannerPeriod } from "./planner-review-fixture.ts"

test("real Planner value and FX changes remain separate observations with the producer total and no invented cause", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    await fixture.persistence.transaction("planner", async (snapshot) => {
      for (const [id, amount, rate] of [["v0", 100, 1.1], ["v1", 120, 1.2]] as const) {
        const version = rows(snapshot.data.versions).find((entry) => entry.id === id)!
        version.closed = 0
        version.lines = [{ id: "license", name: "License", ownerId: "owner:finance", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100), a: [], f: [amount] }, { id: id === "v0" ? "removed" : "added", name: "Changed line membership", sec: "opex", el: "services", cur: "USD", b: Array(12).fill(0), a: [], f: [10] }]
        version.fx = [{ id: "EUR", cur: "EUR", rate }]
      }
      return { commit: true, value: undefined }
    })
    const base = await fixture.source("v0")
    const candidate = await fixture.source("v1")
    const request = { baseRef: base.refId, candidateRef: candidate.refId, period: routineJanuary, currency: "USD" }
    const original = await fixture.product.planner.compareForecast(request, fixture.context)
    const facts = createPlannerForecastInsights({ host: fixture.host, planner: fixture.product.planner, sources: fixture.product.sources })
    const result = await prepareForecastReview({ request, context: fixture.context, host: { planner: fixture.product.planner, confirmations: async () => ({ status: "ok", value: [] }), revalidate: (_request, context) => fixture.host.revalidate(context), ...createForecastFactsAccess(facts) } })
    if (original.status !== "ok" || result.status !== "ok") throw new Error("FX comparison unavailable")
    expect(result.value.comparison).toEqual(original.value)
    expect(result.value.measured.differenceAgainstBase).toBeCloseTo(34, 8)
    expect(result.value.changes).toContainEqual(expect.objectContaining({ state: "changed", current: expect.objectContaining({ id: "fx:EUR", value: 1.2 }), previous: expect.objectContaining({ value: 1.1 }) }))
    expect(result.value.changes).toContainEqual(expect.objectContaining({ state: "changed", delta: 20, current: expect.objectContaining({ id: "license:1:forecast", currency: "EUR", value: 120 }) }))
    expect(result.value.changes).toContainEqual(expect.objectContaining({ state: "removed", previous: expect.objectContaining({ id: "removed:1:outlook-usd", value: 10 }) }))
    expect(result.value.changes).toContainEqual(expect.objectContaining({ state: "added", current: expect.objectContaining({ id: "added:1:outlook-usd", value: 10 }) }))
    expect(result.value.justifications).toMatchObject({ status: "unavailable", reason: "justification-source-unavailable" })
    expect(result.value.changes.every((change) => !("cause" in change) && !("attribution" in change))).toBe(true)
    expect(result.value.synthesisIncluded).toBe(false)
  } finally { await fixture.dispose() }
}, 120_000)

test("forecast preparation preserves authorized HR aggregates and independent missing rate, FX and inherited budget", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const version = rows(snapshot.data.versions).find((entry) => entry.id === "v0")!
      version.closed = 1
      version.lines = [{ id: "foreign-license", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100), a: [10], f: [] }]
      version.fx = [{ id: "EUR", cur: "EUR", rate: null }]
      version.hc = { positions: [
        { id: "priced", name: "Priced", include: true, fte: 1, start: 7, end: 12, domain: "IT", type: "Employee", location: "Brazil", rateId: "usd", talentReview: "private talent result", outlook: "private personnel outlook" },
        { id: "missing", name: "Missing rate", include: true, fte: 1, start: 7, end: 12, domain: "Finance", type: "Employee", location: "Unknown" },
        { id: "foreign", name: "Missing FX", include: true, fte: 0.5, start: 7, end: 12, domain: "Legal", type: "Employee", location: "France", rateId: "eur" },
      ], rates: [{ id: "usd", name: "USD role", locs: "Brazil", annual: 120000, cur: "USD" }, { id: "eur", name: "EUR role", locs: "France", annual: 90000, cur: "EUR" }], hrAF: { IT: { a: [10] }, Finance: { a: [500], f: [null, null, null, null, null, null, 0] }, Legal: { a: [250], f: [null, null, null, null, null, null, 20] } } }
      return { commit: true, value: undefined }
    })
    const ref = await fixture.source("v0")
    const request = { baseRef: ref.refId, candidateRef: ref.refId, period: routinePlannerPeriod, currency: "USD" }
    const facts = createPlannerForecastInsights({ host: fixture.host, planner: fixture.product.planner, sources: fixture.product.sources })
    const before = await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data) }))
    const result = await prepareForecastReview({ request, context: fixture.context, host: { planner: fixture.product.planner, confirmations: async () => ({ status: "ok", value: [] }), revalidate: (_request, context) => fixture.host.revalidate(context), ...createForecastFactsAccess(facts) } })
    if (result.status !== "ok") throw new Error(`HR preparation unavailable: ${result.reason}`)
    expect(result.value.comparison.candidate.values).toContainEqual(expect.objectContaining({ id: "HR:IT:7:budget-usd", value: 10000, evidenceState: "confirmed" }))
    expect(result.value.comparison.candidate.values).toContainEqual(expect.objectContaining({ id: "month:7:fte", value: 2.5, unit: "fte" }))
    expect(result.value.comparison.candidate.values).toContainEqual(expect.objectContaining({ id: "HR:Finance:7:outlook-usd", value: 0, evidenceState: "confirmed" }))
    expect(result.value.gaps.missingRate).toContain("HR:Finance:7:budget")
    expect(result.value.gaps.missingFx).toContain("HR:Legal:7:budget")
    expect(Array.isArray(result.value.gaps.inheritedBudget) && result.value.gaps.inheritedBudget.some((entry) => entry.valueId === "HR:IT:7:outlook-usd")).toBe(true)
    expect(result.value.measured.differenceAgainstBase).toBeNull()
    expect(result.value.complete).toBe(false)
    for (const privateValue of ["private talent result", "private personnel outlook", '"rateId"', '"annual"']) expect(JSON.stringify(result)).not.toContain(privateValue)
    expect(await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data }))).toEqual(before)
    // A declared dependency changes C06 even when the January numeric scope is unchanged.
    const version = await fixture.source("v1")
    const scope = { sourceRef: { surface: "planner" as const, type: "planner-version", id: "v1", incarnation: version.target.incarnation }, fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const confirmation = await fixture.confirm(scope, "dependency-baseline")
    await fixture.persistence.transaction("planner", async (snapshot) => {
      object(rows(snapshot.data.versions).find((entry) => entry.id === "v1")!).fx = [{ id: "EUR", cur: "EUR", rate: 1.2 }]
      return { commit: true, value: undefined }
    })
    expect(await fixture.confirmations.project(confirmation.id, fixture.context)).toMatchObject({ status: "ok", value: { state: "stale", reason: "dependency-change" } })
  } finally { await fixture.dispose() }
}, 120_000)
