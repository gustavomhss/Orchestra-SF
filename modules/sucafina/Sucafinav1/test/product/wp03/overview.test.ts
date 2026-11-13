import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
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
