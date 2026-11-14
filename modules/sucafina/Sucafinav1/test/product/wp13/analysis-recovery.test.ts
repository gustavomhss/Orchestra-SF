import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createWp13SensitivityFixture } from "./sensitivity-fixture.ts"

test("reconciles an unbound C08 comparison on retry without writing a second result", async () => {
  const world = await createWp13SensitivityFixture()
  try {
    expect((await world.selection.register({ caseRef: world.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, world.context)).status).toBe("ok")
    let bindAttempts = 0
    const bindings = {
      ...world.comparisonBindings,
      bind: async (...args: Parameters<typeof world.comparisonBindings.bind>) => ++bindAttempts === 1 ? { status: "unavailable" as const, reason: "injected-before-binding-commit" } : world.comparisonBindings.bind(...args),
    }
    const analysis = createPortfolioAnalysis({
      planner: world.plannerWithCriteria,
      results: world.results,
      bindings,
      persist: createPlannerResultPersistence({ store: world.results, scenarios: world.scenarios, comparisonBindings: bindings, replay: world.plannerWithCriteria, resolveCase: async () => ({ status: "ok", value: world.caseRef }) }),
      select: world.selectPortfolio,
      idempotencyKey: async () => "analysis-retry",
    })
    expect(await analysis.evaluate(world.analysisRequest, world.context)).toEqual({ status: "unavailable", reason: "comparison-persisted-but-binding-unavailable" })
    const compare = { scenarioRefs: [world.baselineRef, world.selectedRef], criteria: ["renewal-difference"] }
    const requestDigest = digestSfValue(compare)
    const partial = await world.results.readByRequest({ caseRef: world.caseRef, kind: "comparison", idempotencyKey: `portfolio-comparison:analysis-retry:${requestDigest}`, requestDigest }, world.context)
    expect(partial.status === "ok" && partial.value.state).toBe("found")
    if (partial.status !== "ok" || partial.value.state !== "found") return
    const resultRef = partial.value.result.resultRef
    expect((await world.comparisonBindings.read({ caseRef: world.caseRef, resultRef }, world.context)).status).toBe("unavailable")
    const allocated = world.ids.value
    const retried = await analysis.evaluate(world.analysisRequest, world.context)
    expect(retried.status).toBe("ok")
    if (retried.status !== "ok") return
    expect(retried.value.analysis.comparisonRef).toBe(resultRef)
    expect(world.ids.value).toBe(allocated)
    expect(bindAttempts).toBe(2)
    expect(await analysis.revalidate(retried.value.analysis, world.context)).toBe(true)
    expect(await analysis.revalidate({ ...retried.value.analysis, scenarioResultRef: world.baselineRef }, world.context)).toBe(false)
    expect(await analysis.revalidate({ ...retried.value.analysis, scenario: { ...retried.value.analysis.scenario, knownSubtotal: 1 } }, world.context)).toBe(false)
    expect((await world.reviseRule()).status).toBe("ok")
    expect(await analysis.revalidate(retried.value.analysis, world.context)).toBe(false)
  } finally {
    await world.cleanup()
  }
})
