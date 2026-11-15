import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import { createSfBiServices } from "../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfPlannerBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { ok } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

test("installed BI01 preserves the real EUR quote and canonical 1.08 conversion while missing FX stays absent", async () => {
  const deadline = compositionTestDeadline("installed-bi-currency-source", 165_000)
  try {
    const fixture = await deadline.phase("fixture.initialize", async () => {
      const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
      deadline.own(() => value.dispose())
      return value
    })
    const period = { start: "2027-11-01", end: "2027-11-30" }
    const amount = Array.from({ length: 12 }, (_, month) => month === 10 ? 28000 : 0)
    await fixture.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [1.08, null].map((rate, index) => ({ id: `installed-fx-${index}`, name: rate === null ? "EUR quote without FX evidence" : "EUR quote at declared FX", year: 2027, closed: 0,
        lines: [{ id: "foreign", name: "Quoted EUR service", sec: "opex", el: "licenses", cur: "EUR", b: amount, a: Array(12).fill(null), f: amount }],
        fx: [{ cur: "EUR", rate }], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await fixture.persistence.initializeSources("planner")
    const call = await fixture.read()
    deadline.own(() => fixture.authority.ui.finish(call))
    const bi = createSfBiServices({ authority: fixture.authority, business: fixture.business, portfolio: fixture.portfolio })
    for (const index of [0, 1]) {
      const issued = ok(await deadline.phase(`source.${index}`, () => fixture.business.plannerProduct.issueSource(`installed-fx-${index}`, call)), "Issue actual FX source")
      const comparison = { baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period, currency: "USD" }
      const canonical = ok(await deadline.phase(`forecast.${index}`, () => fixture.business.planner.compareForecast(comparison, call)), "Canonical FX forecast")
      const request: BiViewRequest = { viewId: "BI01", selectionRef: sfPlannerBiSelection(comparison), period }
      const admitted = ok(await fixture.authority.ui.admit(fixture.request(), "sf_bi_view", digestSfValue(request)), "Admit currency BI")
      try {
        const output = ok(await deadline.phase(`BI01.${index}`, () => bi.dispatchPresentation(request, admitted)), "Installed currency presentation")
        expect(output.projection.components).toEqual(canonical.candidate.components)
        expect(output.projection.values).toEqual(canonical.candidate.values)
        expect(output.projection.missing).toEqual(canonical.candidate.missing)
        expect(output.projection.version).toBe(canonical.candidate.version)
        expect(output.projection.engineVersion).toBe(canonical.candidate.engineVersion)
        expect(output.projection.context).toMatchObject({ currency: "USD", period })
        expect(output.projection.values.find((value) => value.id === "foreign:11:forecast")).toMatchObject({
          value: 28000, currency: "EUR", evidenceState: "confirmed", sourceRefs: [issued.evidence],
        })
        expect(output.projection.values.find((value) => value.id === "fx:EUR")).toMatchObject({
          value: index === 0 ? 1.08 : null, unit: "USD/EUR", evidenceState: index === 0 ? "confirmed" : "absent", sourceRefs: [issued.evidence],
        })
        const component = output.projection.components.find((component) => component.id === "foreign:11")
        expect(component).toMatchObject({ currency: "USD", evidenceState: index === 0 ? "confirmed" : "absent" })
        if (index === 0) expect(component?.amount).toBeCloseTo(30240, 8)
        else expect(component?.amount).toBeNull()
        if (index === 1) {
          expect(output.projection.missing.some((missing) => missing.reason === "missing-fx")).toBe(true)
          expect(output.projection.values.find((value) => value.id === "foreign:11:outlook-usd")?.value).toBeNull()
        }
      } finally { fixture.authority.ui.finish(admitted) }
    }
  } finally { await deadline.close() }
}, 180_000)
