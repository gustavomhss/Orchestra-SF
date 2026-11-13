import { expect, test } from "bun:test"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const evidence = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "hash" } } as const
const source = { surface: "planner", type: "quote", id: "q", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" } as const
const resolution = [{ state: "fresh", ref: evidence, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }] as const
const basis = { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [evidence] }
const period = { horizon, currency: "USD" }

test("portfolio distinguishes omitted training from sourced zero using WP11 coverage", async () => {
  const common = RENEWAL_TRANSITION_CATEGORIES.filter((id) => id !== "training").map((categoryId) => ({ status: "not-applicable" as const, categoryId, justification: "source confirms scope", evidenceRefs: [evidence] }))
  const zero = { id: "training", amount: 0, currency: "USD", period: horizon, sourceRefs: [source], evidenceState: "confirmed" as const }
  const assess = (includeZero: boolean) => assessCostCoverage({ basis, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon, entries: includeZero ? [...common, { status: "included", categoryId: "training", componentRefs: ["training"], evidenceRefs: [evidence], scopeNote: "explicitly free" }] : common, components: includeZero ? [zero] : [], evidence: resolution, supports: () => true })
  const missing = assess(false)
  const complete = assess(true)
  expect(missing.coverageState).toBe("pending")
  expect(complete.coverageState).toBe("complete")
  if (complete.coverageState !== "complete") return
  const draft = { id: "scenario", version: 1, currency: "USD", horizon, sourceRefs: [evidence], unresolvedConditions: [], restrictions: [] } as const
  const scenarios: readonly ScenarioResult[] = [
    { ...draft, components: [], knownSubtotal: 0, total: null, comparisonStatus: "conditioned", costCoverage: missing },
    { ...draft, components: [zero], knownSubtotal: 0, total: 0, comparisonStatus: "complete", costCoverage: complete },
  ]
  const operations = [{ kind: "replace" as const, targetRef: "line:1", amount: 0 }]
  const candidate = { ref: "a", caseRef: "case", operations, scenario: { baseRef: "base", operations, assumptions: [] } }
  const current = { value: 0 }
  const host: PortfolioHost = { resolveCandidate: async () => ({ status: "ok", value: candidate }), evaluate: async () => ({ status: "ok", value: { scenario: scenarios[current.value], costCoverageRefs: [`coverage-${current.value}`], constraints: [] } }), sensitivity: async () => ({ status: "unavailable", reason: "unused" }), revalidate: async () => true, revalidateEvaluation: async () => true }
  const request = { scope: period, candidateRefs: ["a"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
  const port = createPortfolioPort(host)
  const conditioned = await port.evaluate(request, {} as TrustedDomainContext)
  current.value = 1
  const eligible = await port.evaluate(request, {} as TrustedDomainContext)
  expect(conditioned.status === "ok" && conditioned.value.combinations[0].eligibility).toBe("conditioned")
  expect(eligible.status === "ok" && eligible.value.combinations[0].eligibility).toBe("conditioned")
  expect(eligible.status === "ok" && eligible.value.combinations[0].restrictions).toContain("analysis-unavailable")
  const candidatePending = createPortfolioPort({ ...host, resolveCandidate: async () => ({ status: "ok", value: { ...candidate, result: scenarios[0] } }), evaluate: async () => ({ status: "ok", value: { scenario: scenarios[1], costCoverageRefs: ["coverage-1"], constraints: [], analysis: { scenarioResultRef: "sample", scenario: scenarios[1], comparisonRef: "comparison", comparison: { baselineResultRef: "baseline", alternativeResultRef: "sample", costCoverageRefs: ["coverage-1"], criterionResults: [], unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 0, completeDifference: 0 } } } }) })
  const pending = await candidatePending.evaluate(request, {} as TrustedDomainContext)
  expect(pending.status === "ok" && pending.value.combinations[0].eligibility).toBe("conditioned")
  expect(pending.status === "ok" && pending.value.combinations[0].restrictions).toContain("candidate:a:missing-category:training")
  const missingCriterion = await candidatePending.evaluate({ ...request, constraints: ["max-cost"] }, {} as TrustedDomainContext)
  expect(missingCriterion).toEqual({ status: "unavailable", reason: "comparison-criteria-incomplete" })
  const unknownCriterion = createPortfolioPort({ ...host, resolveCandidate: async () => ({ status: "ok", value: { ...candidate, result: scenarios[1] } }), evaluate: async () => ({ status: "ok", value: { scenario: scenarios[1], costCoverageRefs: ["coverage-1"], constraints: [{ ref: "max-cost", state: "unknown", reason: "criterion-rule-unavailable" }], analysis: { scenarioResultRef: "complete", scenario: scenarios[1], comparisonRef: "comparison", comparison: { baselineResultRef: "baseline", alternativeResultRef: "complete", costCoverageRefs: ["coverage-1"], criterionResults: [{ criterionId: "max-cost", state: "unknown", reason: "criterion-rule-unavailable" }], unresolvedConditions: ["criterion-rule-unavailable"], comparisonStatus: "complete", knownDifference: 0, completeDifference: 0 } } } }) })
  const unknown = await unknownCriterion.evaluate({ ...request, constraints: ["max-cost"] }, {} as TrustedDomainContext)
  expect(unknown.status === "ok" && unknown.value.combinations[0].eligibility).toBe("conditioned")
  expect(unknown.status === "ok" && unknown.value.combinations[0].comparisonStatus).toBe("complete")
  const partialFailure = createPortfolioPort({ ...host, evaluate: async () => ({ status: "ok", value: { scenario: scenarios[0], costCoverageRefs: ["coverage-0"], constraints: [{ ref: "max-cost", state: "failed", reason: "criterion-not-satisfied-conditioned" }], analysis: { scenarioResultRef: "partial", scenario: scenarios[0], comparisonRef: "comparison", comparison: { baselineResultRef: "baseline", alternativeResultRef: "partial", costCoverageRefs: ["coverage-0"], criterionResults: [{ criterionId: "max-cost", state: "failed", reason: "criterion-not-satisfied-conditioned" }], unresolvedConditions: ["missing-training"], comparisonStatus: "conditioned", knownDifference: 1, completeDifference: null } } } }) })
  const partial = await partialFailure.evaluate({ ...request, constraints: ["max-cost"] }, {} as TrustedDomainContext)
  expect(partial.status === "ok" && partial.value.combinations[0].eligibility).toBe("conditioned")
})
