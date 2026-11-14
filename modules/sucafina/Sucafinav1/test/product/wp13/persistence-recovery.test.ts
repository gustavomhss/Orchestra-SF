import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionResultBindings } from "../../../product/decisions/criterion-rules.ts"
import { createPortfolioResultBindings } from "../../../product/decisions/portfolio-bindings.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import type { PortfolioPort } from "../../../product/portfolio/port.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createWp13AnalysisFixture, createWp13SensitivityFixture } from "./sensitivity-fixture.ts"

test("portfolio retry recovers a lost binding reply without allocating or binding twice", async () => {
  await portfolioRecovery("after")
})

test("sensitivity retry recovers a lost binding reply without allocating or binding twice", async () => {
  await sensitivityRecovery("after")
})

async function portfolioRecovery(failure: "before" | "after") {
  const world = await createWp13AnalysisFixture()
  try {
    const selection = await world.selection.register({ caseRef: world.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", criteria: ["renewal-difference"], expectedVersion: 0 }, world.context)
    expect(selection.status).toBe("ok")
    if (selection.status !== "ok") throw new Error(`selection unavailable: ${selection.reason}`)
    const analysis = createPortfolioAnalysis({
      planner: world.plannerWithCriteria,
      results: world.results,
      bindings: world.comparisonBindings,
      persist: createPlannerResultPersistence({ store: world.results, scenarios: world.scenarios, comparisonBindings: world.comparisonBindings, replay: world.plannerWithCriteria, resolveCase: async () => ({ status: "ok", value: world.caseRef }) }),
      select: world.selectPortfolio,
      idempotencyKey: async () => "recovery-analysis",
    })
    const actualBindings = createPortfolioResultBindings({
      state: world.state,
      host: world.host,
      results: world.results,
      selection: world.selection,
      resolveCandidate: createDecisionCandidateResolver(world.cases),
      authorizeCase: async () => world.access.allowed,
      verifyBinding: async (_binding, result, context) => result.kind === "portfolio" && (await Promise.all(result.result.combinations.map((combination) => combination.analysis ? analysis.revalidate(combination.analysis, context) : Promise.resolve(false)))).every(Boolean),
      verifySnapshot: () => world.access.allowed,
      operationIdentity: () => "recovery-portfolio-binding",
      proposalCoverageWrites: world.proposalCoverageWrites,
      now: () => "2026-11-13T00:00:00Z",
    })
    let attempts = 0
    const bindings = {
      ...actualBindings,
      bind: async (...args: Parameters<typeof actualBindings.bind>) => {
        attempts += 1
        if (attempts === 1 && failure === "before") return { status: "unavailable" as const, reason: "injected-before-binding-commit" }
        const bound = await actualBindings.bind(...args)
        if (attempts === 1 && failure === "after" && bound.status === "ok") return { status: "unavailable" as const, reason: "injected-lost-binding-reply" }
        return bound
      },
    }
    const open = () => {
      const product = createProductionPortfolio({
        cases: world.cases,
        planner: world.planner,
        sources: world.sources,
        evidence: world.evidenceService,
        revalidate: world.host.revalidate,
        analysis,
        candidateCoverageRefFor: async (candidate) => {
          const ref = parseCaseRef(candidate.caseRef)
          return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) } : { status: "unavailable", reason: "candidate-unavailable" }
        },
        decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "not-used-by-persistence-recovery" }) },
        createReceipt: async () => undefined,
        persistence: { results: world.results, portfolioBindings: bindings, caseFor: async () => ({ status: "ok", value: world.caseRef }), idempotencyKey: async () => "recovery-portfolio" },
        enabledOperations: ["sf_portfolio_evaluate"],
      })
      if (!product.persistent) throw new Error("portfolio persistence unavailable")
      return product.persistent
    }
    const request = { ...world.analysisRequest.portfolio, candidateRefs: [portfolioCandidateRef({ caseRef: encodeCaseRef(world.caseRef), caseVersion: world.caseRef.version, alternativeId: "selected", alternativeVersion: 1 })] }
    const first = await open().evaluateAndStore(request, world.caseRef, world.context)
    expect(first).toEqual({ status: "unavailable", reason: failure === "before" ? "injected-before-binding-commit" : "injected-lost-binding-reply" })
    const saved = await world.results.readByRequest({ caseRef: world.caseRef, kind: "portfolio", idempotencyKey: "recovery-portfolio", requestDigest: digestSfValue(request) }, world.context)
    expect(saved.status === "ok" && saved.value.state).toBe("found")
    if (saved.status !== "ok" || saved.value.state !== "found") throw new Error("portfolio result was not persisted before the binding fault")
    const resultRef = saved.value.result.resultRef
    const allocated = world.ids.value
    expect((await actualBindings.read({ caseRef: world.caseRef, resultRef }, world.context)).status).toBe(failure === "before" ? "unavailable" : "ok")
    const retried = await open().evaluateAndStore(request, world.caseRef, world.context)
    expect(retried.status).toBe("ok")
    if (retried.status !== "ok") throw new Error(`portfolio recovery failed: ${retried.reason}`)
    expect(retried.value.portfolioResultRef).toBe(resultRef)
    expect(retried.value.portfolio.combinations[0]?.analysis?.comparisonRef).toBe(saved.value.result.kind === "portfolio" ? saved.value.result.result.combinations[0]?.analysis?.comparisonRef : undefined)
    expect(world.ids.value).toBe(allocated)
    expect(attempts).toBe(failure === "before" ? 2 : 1)
    expect(await open().read(resultRef, world.context)).toEqual(retried)
    expect(await open().evaluateAndStore(request, world.caseRef, world.context)).toEqual(retried)
    expect(world.ids.value).toBe(allocated)
    expect(attempts).toBe(failure === "before" ? 2 : 1)
  } finally {
    await world.cleanup()
  }
}

async function sensitivityRecovery(failure: "before" | "after") {
  const world = await createWp13SensitivityFixture()
  try {
    const actualBindings = createCriterionResultBindings({
      state: world.state,
      host: world.host,
      rules: world.rules,
      results: world.results,
      authorizeCase: async () => world.access.allowed,
      verifyBinding: async () => world.access.allowed,
      verifySnapshot: () => world.access.allowed,
      operationIdentity: () => "recovery-sensitivity-binding",
      proposalCoverageWrites: world.proposalCoverageWrites,
      now: () => "2026-11-13T00:00:00Z",
    })
    let attempts = 0
    const bindings = {
      ...actualBindings,
      bind: async (...args: Parameters<typeof actualBindings.bind>) => {
        attempts += 1
        if (attempts === 1 && failure === "before") return { status: "unavailable" as const, reason: "injected-before-binding-commit" }
        const bound = await actualBindings.bind(...args)
        if (attempts === 1 && failure === "after" && bound.status === "ok") return { status: "unavailable" as const, reason: "injected-lost-binding-reply" }
        return bound
      },
    }
    const open = () => {
      const portfolio: PortfolioPort = {
        evaluate: async () => ({ status: "unavailable", reason: "not-used-by-sensitivity-recovery" }),
        sensitivity: createPlannerSensitivity({ results: world.results, resolve: world.issuer.resolve, revalidate: world.issuer.revalidate, preview: (input, context) => comparePlannerPreview({ host: world.host, sources: world.sources, scenarios: world.scenarios, planner: world.planner }, input, context), idempotencyKey: async (digest) => `sensitivity-${digest}` }),
      }
      return createPersistentSensitivityPort({ portfolio, results: world.results, bindings, resolveBinding: world.issuer.resolve, idempotencyKey: async () => "recovery-sensitivity" })
    }
    const before = world.ids.value
    const first = await open().evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)
    expect(first).toEqual({ status: "unavailable", reason: failure === "before" ? "injected-before-binding-commit" : "injected-lost-binding-reply" })
    const saved = await world.results.readByRequest({ caseRef: world.caseRef, kind: "sensitivity", idempotencyKey: "sensitivity:recovery-sensitivity", requestDigest: digestSfValue(world.sensitivityRequest) }, world.context)
    expect(saved.status === "ok" && saved.value.state).toBe("found")
    if (saved.status !== "ok" || saved.value.state !== "found") throw new Error("sensitivity result was not persisted before the binding fault")
    const resultRef = saved.value.result.resultRef
    const allocated = world.ids.value
    expect(allocated).toBe(before + 1)
    expect((await actualBindings.read({ caseRef: world.caseRef, resultRef }, world.context)).status).toBe(failure === "before" ? "unavailable" : "ok")
    const retried = await open().evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)
    expect(retried.status).toBe("ok")
    if (retried.status !== "ok") throw new Error(`sensitivity recovery failed: ${retried.reason}`)
    expect(retried.value.sensitivityResultRef).toBe(resultRef)
    expect(retried.value.sensitivity.evaluated.map((sample) => sample.resultRef)).toEqual(world.saved.sensitivity.evaluated.map((sample) => sample.resultRef))
    expect(world.ids.value).toBe(allocated)
    expect(attempts).toBe(failure === "before" ? 2 : 1)
    expect(await open().read(resultRef, world.context)).toEqual(retried)
    expect(await open().evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)).toEqual(retried)
    expect(world.ids.value).toBe(allocated)
    expect(attempts).toBe(failure === "before" ? 2 : 1)
  } finally {
    await world.cleanup()
  }
}
