import { describe, expect, test } from "bun:test"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ProjectionComponent } from "../../../product/contracts/context.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import type { PortfolioRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const period = { start: "2027-01-01", end: "2027-12-31" }
const request: PortfolioRequest = { scope: { horizon: period, currency: "USD" }, candidateRefs: ["a", "b"], operations: [], constraints: ["ceiling"], priorities: [], explorationLimit: 4 }
const scenario: ScenarioResult = { id: "s", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period, issues: ["training:missing-category"], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }

function host(): PortfolioHost {
  return {
    revalidate: async () => true,
    revalidateEvaluation: async () => true,
    resolveCandidate: async (ref) => ({ status: "ok", value: { ref, caseRef: `case-${ref}`, operations: [{ kind: "replace", targetRef: ref }], scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: ref }], assumptions: [] } } }),
    evaluate: async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "known subtotal" }] } }),
    sensitivity: async () => ({ status: "unavailable", reason: "not-connected" }),
  }
}

describe("portfolio composition", () => {
  test("keeps a missing cost category conditioned despite a satisfied known subtotal", async () => {
    const result = await createPortfolioPort(host()).evaluate(request, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.combinations).toHaveLength(3)
    expect(result.value.combinations.every((item) => item.eligibility === "conditioned")).toBe(true)
    expect(result.value.combinations[0].costCoverageRefs).toEqual(["coverage-a"])
    expect(result.value.combinations[0].restrictions).toContain("analysis-unavailable")
  })

  test("rejects duplicate operations and declares an exploration limit", async () => {
    const input = host()
    input.resolveCandidate = async (ref) => ({ status: "ok", value: { ref, caseRef: ref, operations: [{ kind: "replace", targetRef: "same" }], scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: "same" }], assumptions: [] } } })
    const result = await createPortfolioPort(input).evaluate({ ...request, explorationLimit: 3 }, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.combinations[2].eligibility).toBe("ineligible")
    expect(result.value.combinations[2].conflicts).toEqual(["duplicate-target:same"])
    const limited = await createPortfolioPort(input).evaluate({ ...request, explorationLimit: 1 }, context)
    expect(limited.status === "ok" && limited.value.limitations.some((item) => item.includes("limit 1"))).toBe(true)
  })

  test("does not return results after candidate revocation", async () => {
    const input = host()
    let calls = 0
    input.resolveCandidate = async (ref) => ++calls > 2 ? { status: "denied", reason: "revoked" } : { status: "ok", value: { ref, caseRef: ref, operations: [{ kind: "replace", targetRef: ref }], scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: ref }], assumptions: [] } } }
    expect(await createPortfolioPort(input).evaluate(request, context)).toEqual({ status: "stale", reason: "candidate-changed-or-revoked" })
  })

  test("does not expose a result when scenario coverage is revoked before egress", async () => {
    const input = host()
    input.revalidateEvaluation = async () => false
    expect(await createPortfolioPort(input).evaluate(request, context)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
  })

  test("does not claim eligibility if a required constraint was not assessed", async () => {
    const input = host()
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints: [] } })
    expect(await createPortfolioPort(input).evaluate(request, context)).toEqual({ status: "unavailable", reason: "constraint-assessment-incomplete" })
  })


  test("preserves the domain's failed ceiling after coverage resolves", async () => {
    const input = host()
    const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", kind: "record", refId: "service-quote", installationId: "install", projectId: "project", evidenceLevel: "observed", refDigest: "a".repeat(64), target: { surface: "planner", recordType: "quote", recordId: "service", incarnation: "service-inc", version: 1, fields: ["amount"], period, projectionDigest: "b".repeat(64) } }
    const component: ProjectionComponent = { id: "service", amount: 250000, currency: "USD", period, evidenceState: "confirmed", sourceRefs: [{ surface: "planner", type: "quote", id: "service", incarnation: "service-inc", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" }] }
    const coverage = assessCostCoverage({ basis: { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, sourceRefs: [evidence], additionalCategoryIds: [] }, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service" ? { status: "included", categoryId, componentRefs: [component.id], evidenceRefs: [evidence], scopeNote: "Quoted service cost" } : { status: "not-applicable", categoryId, evidenceRefs: [evidence], justification: "Reviewed scope excludes this cost" }),
      components: [component], evidence: [{ ref: evidence, state: "fresh", accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }], supports: () => true })
    expect(coverage.coverageState).toBe("complete")
    if (coverage.coverageState !== "complete") throw new Error("complete coverage fixture required")
    const complete: ScenarioResult = { ...scenario, components: [component], sourceRefs: [evidence], comparisonStatus: "complete", knownSubtotal: 250000, total: 250000, costCoverage: coverage }
    const comparison = { baselineResultRef: "base", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage-v2"], criterionResults: [{ criterionId: "ceiling", state: "failed", reason: "250000 exceeds 240000" }], unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 40000, completeDifference: 40000 } as const
    input.resolveCandidate = async (ref) => ({ status: "ok", value: { ref, caseRef: `case-${ref}`, operations: [{ kind: "replace", targetRef: ref }], scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: ref }], assumptions: [] }, result: complete } })
    input.evaluate = async () => ({ status: "ok", value: { scenario: complete, costCoverageRefs: ["coverage-v2"], analysis: { scenarioResultRef: "scenario-ref", scenario: complete, comparisonRef: "comparison-ref", comparison }, constraints: [{ ref: "ceiling", state: "failed", reason: "250000 exceeds 240000" }] } })
    const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.combinations[0].eligibility).toBe("ineligible")
    expect(result.value.combinations[0].restrictions).toContain("ceiling:250000 exceeds 240000")
  })


  test("does not promote a restricted scenario to complete eligibility", async () => {
    const input = host()
    const restricted: ScenarioResult = { ...scenario, comparisonStatus: "complete", knownSubtotal: 210000, total: 210000, restrictions: ["delivery-unconfirmed"], costCoverage: { ...scenario.costCoverage, coverageState: "complete", entries: [], derivedMissingCategoryIds: [], issues: [] } }
    input.evaluate = async () => ({ status: "ok", value: { scenario: restricted, costCoverageRefs: ["coverage-v1"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "within ceiling" }] } })
    const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.combinations[0].eligibility).toBe("conditioned")
    expect(result.value.combinations[0].restrictions).toContain("delivery-unconfirmed")
  })


  test("reports an explicitly pending interaction cost", async () => {
    const input = host()
    const pending: ScenarioResult = { ...scenario, costCoverage: { ...scenario.costCoverage, coverageState: "pending", entries: [{ status: "pending", categoryId: "interaction", reason: "quote-needed" }] } }
    input.evaluate = async () => ({ status: "ok", value: { scenario: pending, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } })
    const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.combinations[0].restrictions).toContain("interaction:quote-needed")
    expect(result.value.combinations[0].eligibility).toBe("conditioned")
  })


  test("refuses a domain result that repeats a shared component", async () => {
    const input = host()
    const component = { id: "shared", amount: 100, currency: "USD", period, sourceRefs: [], evidenceState: "confirmed" as const }
    const duplicate: ScenarioResult = { ...scenario, components: [component, component] }
    input.evaluate = async () => ({ status: "ok", value: { scenario: duplicate, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } })
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "unavailable", reason: "duplicate-scenario-component" })
  })


  test("retains validated canonical analysis and rejects a mismatched scenario reference", async () => {
    const input = host()
    const comparison = { baselineResultRef: "base", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage-a"], criterionResults: [{ criterionId: "ceiling", state: "satisfied", reason: "subtotal" }], unresolvedConditions: ["training missing"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null } as const
    const analysis = { scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison }
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], analysis, constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } })
    const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.value.combinations[0].analysis).toEqual(analysis)
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], analysis: { ...analysis, comparison: { ...comparison, criterionResults: [] } }, constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } })
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "unavailable", reason: "comparison-criteria-incomplete" })
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], analysis: { ...analysis, scenarioResultRef: "other" }, constraints: [] } })
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "unavailable", reason: "analysis-reference-mismatch" })
  })

})
