import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import { plannerSourceActor, projectPlannerSource } from "../../../product/planner/port.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { createSfBiServices } from "../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfPlannerBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { ok } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

// FX01/FX03 source declarations and literal expectations. The real Planner
// produces every total and difference. Its current projection has no annual
// budget-minus-outlook margin field, so the -2000/+4000 margins remain a C02
// producer gap; this test does not manufacture them by summing or negating BI.
test("installed BI01/BI02 preserve the canonical 590000 to 602000 and 596000 forecast replacements", async () => {
  const deadline = compositionTestDeadline("installed-bi-forecast-replacement", 165_000)
  try {
    const fixture = await deadline.phase("fixture.initialize", async () => {
      const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
      deadline.own(() => value.dispose())
      return value
    })
    const period = { start: "2027-01-01", end: "2027-12-31" }
    const budget = [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000]
    const actual = [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null]
    const versions = [
      { id: "installed-forecast-baseline", license: 72000, fullYear: 590000, november: 112000, difference: 0 },
      { id: "installed-forecast-fx01", license: 84000, fullYear: 602000, november: 124000, difference: 12000 },
      { id: "installed-forecast-fx03", license: 78000, fullYear: 596000, november: 118000, difference: 6000 },
    ]
    await fixture.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = versions.map((version) => ({ id: version.id, name: version.id, year: 2027, closed: 9,
        lines: [
          { id: "other", name: "Other costs and closed actuals", sec: "opex", el: "licenses", cur: "USD", b: budget, a: actual,
            f: [null, null, null, null, null, null, null, null, null, 38000, 40000, 40000] },
          { id: "license", name: "November license quote", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(0),
            a: [0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null],
            f: Array.from({ length: 12 }, (_, month) => month === 10 ? version.license : 0) },
        ], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await fixture.persistence.initializeSources("planner")
    const call = await fixture.read()
    deadline.own(() => fixture.authority.ui.finish(call))
    const sources: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
    for (const version of versions) sources.push(ok(await deadline.phase(`source.${version.id}`, () =>
      fixture.business.plannerProduct.issueSource(version.id, call)), "Issue actual forecast source").evidence)

    // Read the same authenticated canonical projection covered by each source
    // digest. This observes annual budget/actual totals without test arithmetic.
    const transport = fixture.authority.host.requestFor(call)
    if (!transport) throw new Error("Authenticated forecast source request unavailable")
    await deadline.phase("source.canonical-summaries", () => fixture.persistence.transaction("planner", async (snapshot) => {
      const principal = await fixture.authority.host.authenticate(transport, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      const actor = plannerSourceActor(snapshot, principal, call.binding.principalRef)
      if (!actor) throw new Error("Authenticated forecast source actor unavailable")
      for (const [index, version] of versions.entries()) {
        const projection = projectPlannerSource(snapshot, actor, version.id)
        expect(projection).toMatchObject({ year: 2027, closed: 9, summary: { total: 600000, actualYTD: 400000, fullYear: version.fullYear } })
        expect(digestSfValue({ versionId: version.id, projection })).toBe(sources[index]!.target.projectionDigest)
      }
      return { commit: false, value: undefined }
    }))

    const bi = createSfBiServices({ authority: fixture.authority, business: fixture.business, portfolio: fixture.portfolio })
    for (const index of [1, 2]) {
      const version = versions[index]!
      const comparison = { baseRef: sources[0]!.refId, candidateRef: sources[index]!.refId, period, currency: "USD" }
      const canonical = ok(await deadline.phase(`forecast.${version.id}`, () => fixture.business.planner.compareForecast(comparison, call)), "Canonical forecast replacement")
      expect(canonical.knownDifference).toBe(version.difference)
      expect(canonical.completeDifference).toBeNull()
      expect(canonical.comparison.comparisonStatus).toBe("conditioned")
      expect(canonical.sourceRefs).toEqual([sources[0], sources[index]])
      for (const viewId of ["BI01", "BI02"] as const) {
        const request: BiViewRequest = { viewId, selectionRef: sfPlannerBiSelection(comparison), period }
        const admitted = ok(await fixture.authority.ui.admit(fixture.request(), "sf_bi_view", digestSfValue(request)), "Admit forecast BI")
        try {
          const output = ok(await deadline.phase(`${viewId}.${version.id}`, () => bi.dispatchPresentation(request, admitted)), "Installed forecast presentation")
          expect(output.projection.components).toEqual(canonical.candidate.components)
          expect(output.projection.missing).toEqual(canonical.candidate.missing)
          expect(output.projection.context).toMatchObject({ currency: "USD", period })
          if (viewId === "BI01") {
            expect(output.projection.values).toEqual(canonical.candidate.values)
            const months = (measure: string) => Array.from({ length: 12 }, (_, month) =>
              output.projection.values.find((value) => value.id === `month:${month + 1}:${measure}`)?.value)
            expect(months("budget")).toEqual(budget)
            expect(months("actual")).toEqual(actual)
            expect(months("outlook")).toEqual([40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, 38000, version.november, 40000])
            expect(output.projection.values.find((value) => value.id === "license:11:forecast")).toMatchObject({
              value: version.license, currency: "USD", sourceRefs: [sources[index]], drilldown: sources[index], evidenceState: "confirmed",
            })
            expect(output.projection.values.find((value) => value.id === "license:10:forecast")?.value).toBe(0)
            expect(output.projection.values.find((value) => value.id === "license:10:actual")?.value).toBeNull()
          } else {
            expect(output.presentation.waterfall).toMatchObject({ reconciliation: "reconciled", finalValueId: "difference:candidate-total" })
            expect(output.projection.values.find((value) => value.id === "difference:baseline")).toMatchObject({ value: 590000, sourceRefs: canonical.sourceRefs })
            expect(output.projection.values.find((value) => value.id === "difference:candidate-total")?.value).toBe(version.fullYear)
            expect(output.projection.values.filter((value) => value.id.startsWith("difference:component:") && value.value !== 0)
              .map((value) => value.value)).toEqual([version.difference])
          }
        } finally { fixture.authority.ui.finish(admitted) }
      }
    }
  } finally { await deadline.close() }
}, 180_000)
