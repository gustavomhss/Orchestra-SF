import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { createPlannerOverviewHost } from "../../../product/planner/overview-host.ts"
import { plannerOverview, renderPlannerOverview } from "../../../product/planner/overview.ts"
import { plannerDifferencePresentation } from "../../../product/planner/bi-difference.ts"
import { comparePlannerVersions } from "../../../product/planner/version-comparison.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

test("Overview resolves baseline, candidate and official through the shared port and keeps their differences distinct", async () => {
  const fixture = await plannerFixture()
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const read = createPlannerOverviewHost({ host: fixture.host, planner: fixture.planner, issueSource: fixture.issueSource, versions: fixture.versions })
    await Promise.all(["v0", "v1", "v2"].map((id) => fixture.issueSource(id, context)))
    const before = await fixture.readSnapshot()
    const request = { baseVersionId: "v0", candidateVersionId: "v1", period: plannerPeriod }
    const selected = await read(request, context)
    expect(selected).toMatchObject({ status: "ok", value: { baselineRefs: [expect.objectContaining({ id: "v0" })], candidateRefs: [expect.objectContaining({ id: "v1" })], officialRefs: [expect.objectContaining({ id: "v0" })], metrics: { baselineOutlook: 590000, candidateOutlook: 602000, deltaToBase: 12000, candidateBudget: 600000, varianceToCandidateBudget: 2000, officialBudget: 600000, varianceToOfficialBudget: 2000 }, coverageState: "conditioned", gaps: ["cost-coverage-unavailable"] } })
    if (selected.status !== "ok") throw new Error("Overview unavailable")
    expect(selected.value.monthly.slice(0, 9).reduce((sum, row) => sum + row.actual!, 0)).toBe(400000)
    expect(selected.value.monthly.slice(9).map((row) => row.actual)).toEqual([null, null, null])
    expect(selected.value.components.filter((row) => row.difference !== 0)).toEqual([expect.objectContaining({ id: "line:11", difference: 12000, state: "matched" })])
    const html = renderPlannerOverview(selected.value)
    expect(html).toContain("Change from baseline")
    expect(html).toContain("Variance to official budget")
    expect(html).toContain("Planned FTE; this is not actual availability.")
    const alternative = await read({ ...request, candidateVersionId: "v2" }, context)
    expect(alternative).toMatchObject({ status: "ok", value: { metrics: { candidateOutlook: 596000, deltaToBase: 6000, candidateBudget: 600000, varianceToCandidateBudget: -4000, officialBudget: 600000, varianceToOfficialBudget: -4000 } } })
    expect(await fixture.readSnapshot()).toEqual(before)
    expect(await read({ ...request, baseVersionId: "deleted" }, context)).toMatchObject({ status: "needs-input", reason: "overview-version-period-mismatch" })
    expect(await read({ ...request, period: { start: "2028-01-01", end: "2028-12-31" } }, context)).toMatchObject({ status: "needs-input" })
    const injected = { ...request, injected: "USD" }
    expect(await read(injected, context)).toMatchObject({ status: "needs-input", reason: "invalid-overview-request" })
    await fixture.persistence.transaction("planner", async (snapshot) => { snapshot.data.officials = {}; return { commit: true, value: undefined } })
    expect(await read(request, context)).toMatchObject({ status: "ok", value: { officialRefs: [], metrics: { officialBudget: null, varianceToOfficialBudget: null, candidateBudget: 600000 } } })
    fixture.access.revision = "changed"
    expect(await read(request, context)).toMatchObject({ status: "denied" })
  } finally { await fixture.close() }
})

test("record additions and removals reconcile without matching labels or disguising unknown observations as zero", async () => {
  const snapshot = plannerSnapshot()
  rows(rows(snapshot.data.versions)[2]!.lines)[0]!.id = "replacement-license"
  const fixture = await plannerFixture(snapshot)
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const refs = await Promise.all(["v0", "v2"].map((id) => fixture.issueSource(id, context)))
    if (refs[0]!.status !== "ok" || refs[1]!.status !== "ok") throw new Error("source missing")
    const compared = await fixture.planner.compareForecast({ baseRef: refs[0]!.value.evidence.refId, candidateRef: refs[1]!.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
    expect(compared).toMatchObject({ status: "ok", value: { knownDifference: 6000, completeDifference: null } })
    if (compared.status !== "ok") throw new Error("comparison missing")
    const differences = comparePlannerVersions(compared.value.baseline, compared.value.candidate)
    expect(differences.rows.filter((row) => row.state === "removed")).toHaveLength(12)
    expect(differences.rows.filter((row) => row.state === "added")).toHaveLength(12)
    expect(differences.rows.reduce((sum, row) => sum + row.difference!, 0)).toBe(6000)
    expect(plannerDifferencePresentation(compared.value, "BI02")).toMatchObject({ status: "ok", value: { presentation: { waterfall: { reconciliation: "reconciled" } } } })
    const unknown = { ...compared.value.candidate, components: compared.value.candidate.components.map((component, index) => index === 0 ? { ...component, amount: null, evidenceState: "absent" as const } : component) }
    expect(comparePlannerVersions(compared.value.baseline, unknown).rows.find((row) => row.id === "replacement-license:1")).toMatchObject({ state: "added", difference: null })
    expect(plannerDifferencePresentation({ ...compared.value, candidate: unknown }, "BI03")).toMatchObject({ status: "ok", value: { presentation: { waterfall: { reconciliation: "unavailable" } } } })
    expect(comparePlannerVersions(compared.value.baseline, { ...compared.value.candidate, context: { ...compared.value.candidate.context, principalRef: "other" } }).status).toBe("incompatible")
    const duplicated = { ...compared.value.candidate, components: [...compared.value.candidate.components, compared.value.candidate.components[0]!] }
    expect(comparePlannerVersions(compared.value.baseline, duplicated).status).toBe("unavailable")
    const model = plannerOverview(compared.value)
    if (model.status !== "ok") throw new Error("overview missing")
    const escaped = renderPlannerOverview({ ...model.value, gaps: ["<script>unsafe</script>"] })
    expect(escaped).toContain("&lt;script&gt;unsafe&lt;/script&gt;")
    expect(escaped).not.toContain("<script>")
  } finally { await fixture.close() }
})

test("isolated FX and HR capacity changes reconcile to the exposed inputs and monthly components", async () => {
  for (const vector of ["fx", "fte"] as const) {
    const snapshot = plannerSnapshot()
    const baseline = rows(snapshot.data.versions)[0]!
    baseline.closed = 0
    baseline.lines = vector === "fx" ? [{ id: "euro-license", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(1000), a: [], f: [] }] : []
    baseline.fx = vector === "fx" ? [{ id: "eur", cur: "EUR", rate: 1 }] : []
    baseline.hc = { positions: vector === "fte" ? [{ id: "position", name: "Planned position", include: true, fte: 1, start: 7, end: 12, domain: "IT", type: "Employee", location: "Brazil", rateId: "usd" }] : [], rates: vector === "fte" ? [{ id: "usd", name: "USD role", locs: "Brazil", annual: 120000, cur: "USD" }] : [], hrAF: {} }
    const candidate = structuredClone(baseline)
    candidate.id = "v1"
    candidate.name = `Changed ${vector}`
    if (vector === "fx") rows(candidate.fx)[0]!.rate = 1.5
    if (vector === "fte") rows(object(candidate.hc).positions)[0]!.fte = 0.5
    snapshot.data.versions = [baseline, candidate]
    const fixture = await plannerFixture(snapshot)
    try {
      const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
      const references = await Promise.all(["v0", "v1"].map((id) => fixture.issueSource(id, context)))
      if (references[0]!.status !== "ok" || references[1]!.status !== "ok") throw new Error("isolated source unavailable")
      const compared = await fixture.planner.compareForecast({ baseRef: references[0]!.value.evidence.refId, candidateRef: references[1]!.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
      if (compared.status !== "ok") throw new Error("isolated comparison unavailable")
      const model = plannerOverview(compared.value)
      if (model.status !== "ok") throw new Error("isolated Overview unavailable")
      const expectedDelta = vector === "fx" ? 6000 : -30000
      expect(compared.value.knownDifference).toBe(expectedDelta)
      expect(model.value.metrics.deltaToBase).toBe(expectedDelta)
      expect(model.value.components.reduce((sum, row) => sum + row.difference!, 0)).toBe(expectedDelta)
      expect(model.value.coverageState).toBe("conditioned")
      expect(plannerDifferencePresentation(compared.value, "BI03")).toMatchObject({ status: "ok", value: { presentation: { waterfall: { reconciliation: "reconciled" } } } })
      if (vector === "fx") {
        expect(model.value.metrics).toMatchObject({ baselineOutlook: 12000, candidateOutlook: 18000 })
        expect(model.value.assumptions).toEqual([{ id: "fx:EUR", before: 1, after: 1.5, explanation: "The exchange-rate input changed; the comparison does not attribute the total difference to this input." }])
        expect(model.value.components.every((row) => row.state === "matched" && row.difference === 500 && row.id.startsWith("euro-license:"))).toBe(true)
        expect(compared.value.baseline.values.find((value) => value.id === "euro-license:1:budget")).toMatchObject({ value: 1000, currency: "EUR" })
        expect(compared.value.candidate.values.find((value) => value.id === "euro-license:1:budget")).toMatchObject({ value: 1000, currency: "EUR" })
      } else {
        expect(model.value.metrics).toMatchObject({ baselineOutlook: 60000, candidateOutlook: 30000 })
        expect(model.value.monthly.slice(0, 6).every((month) => month.baselineFte === 0 && month.fte === 0 && month.baselineOutlook === 0 && month.outlook === 0)).toBe(true)
        expect(model.value.monthly.slice(6).every((month) => month.baselineFte === 1 && month.fte === 0.5 && month.baselineOutlook === 10000 && month.outlook === 5000)).toBe(true)
        const changed = model.value.components.filter((row) => row.difference !== 0)
        expect(changed).toHaveLength(6)
        expect(changed.every((row) => row.state === "matched" && row.difference === -5000 && row.id.startsWith("HR:IT:"))).toBe(true)
        expect(model.value.assumptions).toEqual([])
        expect(renderPlannerOverview(model.value)).toContain("Base planned FTE")
      }
      expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
    } finally { await fixture.close() }
  }
})
