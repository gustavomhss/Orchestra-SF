import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createCriterionResultBindings } from "../../../product/decisions/criterion-rules.ts"
import { createPortfolioResultBindings } from "../../../product/decisions/portfolio-bindings.ts"
import { encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
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

test("reconciles a persisted portfolio after its binding fails without duplicating the calculation result", async () => {
  const world = await createWp13SensitivityFixture()
  try {
    expect((await world.selection.register({ caseRef: world.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, world.context)).status).toBe("ok")
    const analysis = createPortfolioAnalysis({ planner: world.plannerWithCriteria, results: world.results, bindings: world.comparisonBindings, persist: createPlannerResultPersistence({ store: world.results, scenarios: world.scenarios, comparisonBindings: world.comparisonBindings, replay: world.plannerWithCriteria, resolveCase: async () => ({ status: "ok", value: world.caseRef }) }), select: world.selectPortfolio, idempotencyKey: async () => "portfolio-retry-analysis" })
    const registry = createPortfolioResultBindings({ state: world.state, host: world.host, results: world.results, selection: world.selection, resolveCandidate: createDecisionCandidateResolver(world.cases), authorizeCase: async () => world.access.allowed, verifyBinding: async (_binding, result, context) => result.kind === "portfolio" && (await Promise.all(result.result.combinations.map((item) => item.analysis ? analysis.revalidate(item.analysis, context) : Promise.resolve(true)))).every(Boolean), verifySnapshot: () => world.access.allowed, operationIdentity: () => "portfolio-retry-binding", proposalCoverageWrites: world.proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    let bindAttempts = 0
    const bindings = { ...registry, bind: async (...args: Parameters<typeof registry.bind>) => ++bindAttempts === 1 ? { status: "unavailable" as const, reason: "injected-before-portfolio-binding" } : registry.bind(...args) }
    const contribution = createProductionPortfolio({
      cases: world.cases, planner: world.plannerWithCriteria, sources: world.sources, evidence: world.evidenceService, revalidate: world.host.revalidate, analysis,
      candidateCoverageRefFor: async (candidate) => {
        const ref = parseCaseRef(candidate.caseRef)
        return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-coverage-unavailable" }
      },
      createReceipt: async () => undefined,
      decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "not-used-by-recovery-test" }) },
      persistence: { results: world.results, portfolioBindings: bindings, caseFor: async () => ({ status: "ok", value: world.caseRef }), idempotencyKey: async () => "portfolio-result-retry" },
      enabledOperations: ["sf_portfolio_evaluate"],
    })
    if (!contribution.persistent) throw new Error("portfolio persistence unavailable")
    const request = { ...world.analysisRequest.portfolio, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(world.caseRef), caseVersion: world.caseRef.version, alternativeId: "selected", alternativeVersion: 1 })] }
    expect(await contribution.persistent.evaluateAndStore(request, world.caseRef, world.context)).toEqual({ status: "unavailable", reason: "injected-before-portfolio-binding" })
    const partial = await world.results.readByRequest({ caseRef: world.caseRef, kind: "portfolio", idempotencyKey: "portfolio-result-retry", requestDigest: digestSfValue(request) }, world.context)
    expect(partial.status === "ok" && partial.value.state).toBe("found")
    if (partial.status !== "ok" || partial.value.state !== "found") return
    const resultRef = partial.value.result.resultRef
    const allocated = world.ids.value
    const retried = await contribution.persistent.evaluateAndStore(request, world.caseRef, world.context)
    expect(retried.status).toBe("ok")
    if (retried.status !== "ok") return
    expect(retried.value.portfolioResultRef).toBe(resultRef)
    expect(world.ids.value).toBe(allocated)
    expect(bindAttempts).toBe(2)
    expect((await contribution.persistent.read(resultRef, world.context)).status).toBe("ok")
    world.access.allowed = false
    expect((await contribution.persistent.read(resultRef, world.context)).status).toBe("denied")
  } finally { await world.cleanup() }
})

test("reconciles a persisted sensitivity after its criterion binding fails without duplicating samples", async () => {
  const world = await createWp13SensitivityFixture()
  try {
    const registry = createCriterionResultBindings({ state: world.state, host: world.host, rules: world.rules, results: world.results, authorizeCase: async () => world.access.allowed, verifyBinding: async () => world.access.allowed, verifySnapshot: () => world.access.allowed, operationIdentity: () => "sensitivity-retry-binding", proposalCoverageWrites: world.proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    let bindAttempts = 0
    const bindings = { ...registry, bind: async (...args: Parameters<typeof registry.bind>) => ++bindAttempts === 1 ? { status: "unavailable" as const, reason: "injected-before-sensitivity-binding" } : registry.bind(...args) }
    const evaluate = createPlannerSensitivity({ results: world.results, resolve: world.issuer.resolve, revalidate: world.issuer.revalidate, preview: (input, context) => comparePlannerPreview({ host: world.host, sources: world.sources, scenarios: world.scenarios, planner: world.planner }, input, context), idempotencyKey: async () => "sensitivity-retry-sample" })
    const persistent = createPersistentSensitivityPort({ portfolio: { evaluate: async () => ({ status: "unavailable", reason: "not-used-by-recovery-test" }), sensitivity: evaluate }, results: world.results, bindings, resolveBinding: world.issuer.resolve, idempotencyKey: async () => "sensitivity-result-retry" })
    expect(await persistent.evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)).toEqual({ status: "unavailable", reason: "injected-before-sensitivity-binding" })
    const partial = await world.results.readByRequest({ caseRef: world.caseRef, kind: "sensitivity", idempotencyKey: "sensitivity:sensitivity-result-retry", requestDigest: digestSfValue(world.sensitivityRequest) }, world.context)
    expect(partial.status === "ok" && partial.value.state).toBe("found")
    if (partial.status !== "ok" || partial.value.state !== "found") return
    const resultRef = partial.value.result.resultRef
    const allocated = world.ids.value
    const retried = await persistent.evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)
    expect(retried.status).toBe("ok")
    if (retried.status !== "ok") return
    expect(retried.value.sensitivityResultRef).toBe(resultRef)
    expect(world.ids.value).toBe(allocated)
    expect(bindAttempts).toBe(2)
    expect((await persistent.read(resultRef, world.context)).status).toBe("ok")
    world.access.allowed = false
    expect((await persistent.read(resultRef, world.context)).status).toBe("denied")
  } finally { await world.cleanup() }
})
