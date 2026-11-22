import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

for (const assessment of ["pending", "partial"] as const) {
  test("native sensitivity preserves sampled precision and durable replay for " + assessment + " component classification", async () => {
    const deadline = compositionTestDeadline("sensitivity-" + assessment + "-classification", 285_000)
    try {
      const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline, assessment))
      const result = sensitivityOk(await deadline.phase("native-produce", () =>
        fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
          fixture.product.sensitivity(fixture.input, fixture.call))))
      expect(result.evaluated.map((point) => [point.parameterValue, point.value])).toEqual([[80, -20], [120, 20]])
      // A numerical solver cannot supply the missing human assignment of the
      // Support component to a category. Pending categories stay unknown.
      expect(result.thresholdEvidence.state).toBe("sampled")
      expect(result.threshold).toBeNull()
      expect(result.comparisonStatus).toBe("conditioned")
      expect(result.unresolvedConditions.some((condition) => condition.reason.includes("training"))).toBe(true)
      const persisted = await deadline.phase("native-persist", () =>
        fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
          fixture.product.http.sensitivity(fixture.input, fixture.caseRef, fixture.call)))
      console.info("SENSITIVITY_CLASSIFICATION_PERSIST", JSON.stringify({ assessment, status: persisted.status,
        reason: persisted.status === "ok" ? undefined : persisted.reason }))
      expect(persisted.status).toBe("ok")
      const saved = sensitivityOk(persisted)
      expect(saved.sensitivity).toEqual(result)
      const durable = sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state))
      const cold = createSfPortfolioServices({ authority: fixture.authority, business: fixture.business,
        proposalCoverageWrites: fixture.writes })
      deadline.own(() => cold.dispose())
      if (!cold.product) throw new Error("Native recomposition unavailable")
      const coldProduct = cold.product
      expect(cold.proof).not.toBe(fixture.portfolio.proof)
      const reread = sensitivityOk(await deadline.phase("cold-read", () =>
        fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
          coldProduct.http.readSensitivity(saved.sensitivityResultRef, fixture.caseRef, fixture.call))))
      expect(reread).toEqual(saved)
      expect(sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state))).toEqual(durable)
      expect(Object.values(durable.decisionResults ?? {}).filter((entry) => entry.kind === "sensitivity"))
        .toEqual([expect.objectContaining({ resultRef: saved.sensitivityResultRef,
          requestDigest: digestSfValue(fixture.input), resultDigest: digestSfValue(result) })])
      expect(durable.cases[fixture.caseRef.id]?.choices).toEqual([])
      expect(durable.cases[fixture.caseRef.id]?.preparedChanges).toEqual([])
    } finally { await deadline.close() }
  }, 300_000)
}

test("fully classified known components still receive the actual exact bound while training stays pending", async () => {
  const deadline = compositionTestDeadline("sensitivity-assessed-subtotal", 105_000)
  try {
    const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline))
    const result = sensitivityOk(await deadline.phase("native-exact-produce", () =>
      fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
        fixture.product.sensitivity(fixture.input, fixture.call))))
    expect(result.evaluated.map((point) => [point.parameterValue, point.value])).toEqual([[80, -20], [120, 20]])
    expect(result.thresholdEvidence.state).toBe("exact")
    expect(result.threshold).toBeGreaterThanOrEqual(100)
    expect(result.threshold).toBeLessThan(101)
    expect(result.evaluated.some((point) => point.parameterValue === result.threshold)).toBe(false)
    expect(result.comparisonStatus).toBe("conditioned")
    expect(result.unresolvedConditions.some((condition) => condition.reason.includes("training"))).toBe(true)
    expect(result.unresolvedConditions.some((condition) => condition.id === "known-subtotal-threshold")).toBe(true)
  } finally { await deadline.close() }
}, 120_000)
