import { describe, expect, test } from "bun:test"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
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

  test("detects an in-place candidate mutation at egress", async () => {
    const input = host()
    const candidate = { ref: "a", caseRef: "case-a", operations: [{ kind: "replace" as const, targetRef: "a", amount: 10 }], scenario: { baseRef: "base", operations: [{ kind: "replace" as const, targetRef: "a", amount: 10 }], assumptions: [] } }
    input.resolveCandidate = async () => ({ status: "ok", value: candidate })
    input.evaluate = async () => {
      candidate.operations[0]!.amount = 20
      candidate.scenario.operations[0]!.amount = 20
      return { status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } }
    }
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "stale", reason: "candidate-changed-or-revoked" })
  })

  test("preserves scenario observations when the domain reuses a result object", async () => {
    const input = host()
    const shared = structuredClone(scenario)
    const observed: (number | null)[] = []
    input.evaluate = async ({ candidates }) => {
      shared.knownSubtotal = candidates.length === 1 && candidates[0]!.ref === "a" ? 100 : 200
      return { status: "ok", value: { scenario: shared, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "subtotal" }] } }
    }
    input.revalidateEvaluation = async (value) => { observed.push(value.knownSubtotal); return true }
    const result = await createPortfolioPort(input).evaluate(request, context)
    expect(result.status).toBe("ok")
    expect(observed).toEqual([100, 200, 200])
  })

  test("does not expose a result when scenario coverage is revoked before egress", async () => {
    const input = host()
    input.revalidateEvaluation = async () => false
    expect(await createPortfolioPort(input).evaluate(request, context)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
  })

  test("rejects an egress callback that rewrites its observed components or coverage references", async () => {
    const input = host()
    const calculated: ScenarioResult = { ...scenario, components: [{ id: "component", amount: 100, currency: "USD", period, sourceRefs: [], evidenceState: "hypothetical" }] }
    input.evaluate = async () => ({ status: "ok", value: { scenario: calculated, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "satisfied", reason: "known subtotal" }] } })
    input.revalidateEvaluation = async (observed, refs) => {
      Object.assign(observed.components[0]!, { amount: 999 })
      Object.assign(refs, { 0: "forged-coverage" })
      return true
    }
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
    expect(calculated.components[0]!.amount).toBe(100)
  })

  test("does not claim eligibility if a required constraint was not assessed", async () => {
    const input = host()
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints: [] } })
    expect(await createPortfolioPort(input).evaluate(request, context)).toEqual({ status: "unavailable", reason: "constraint-assessment-incomplete" })
  })

  test("a definitive failed deadline stays infeasible while financial coverage remains pending", async () => {
    const input = host()
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints: [{ ref: "ceiling", state: "unknown", reason: "Financial coverage is pending." }, { ref: "delivery", state: "failed", reason: "Confirmed delivery exceeds the required deadline." }] } })
    const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"], constraints: ["ceiling", "delivery"] }, context)
    if (result.status !== "ok") throw new Error(`Domain constraint assessment unavailable: ${JSON.stringify(result)}`)
    expect(result.value.combinations[0]!.eligibility).toBe("ineligible")
    expect(result.value.combinations[0]!.comparisonStatus).toBe("conditioned")
    expect(result.value.combinations[0]!.restrictions).toContain("missing-category:training")
    expect(result.value.combinations[0]!.restrictions).toContain("delivery:Confirmed delivery exceeds the required deadline.")
  })


  test("a definitive failed deadline preserves unavailable financial evidence", async () => {
    for (const missing of ["candidate", "analysis"] as const) {
      const input = host()
      const constraints = [{ ref: "ceiling", state: "unknown", reason: "Financial evidence is unavailable." }, { ref: "delivery", state: "failed", reason: "Confirmed delivery exceeds the required deadline." }] as const
      if (missing === "candidate") {
        const resolve = input.resolveCandidate
        input.resolveCandidate = async (ref, trusted) => {
          const candidate = await resolve(ref, trusted)
          return candidate.status === "ok" ? { status: "ok", value: { ...candidate.value, result: { ...scenario, comparisonStatus: "unavailable" as const, knownSubtotal: null, total: null } } } : candidate
        }
      }
      input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], constraints, ...(missing === "analysis" ? { analysis: { scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison: { baselineResultRef: "baseline-ref", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage-a"], criterionResults: constraints.map((item) => ({ criterionId: item.ref, state: item.state, reason: item.reason })), unresolvedConditions: ["financial-source-unavailable"], comparisonStatus: "unavailable" as const, knownDifference: null, completeDifference: null } } } : {}) } })
      const result = await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"], constraints: ["ceiling", "delivery"] }, context)
      if (result.status !== "ok") throw new Error(`Unavailable financial comparison: ${JSON.stringify(result)}`)
      expect(result.value.combinations[0]).toMatchObject({ eligibility: "ineligible", comparisonStatus: "unavailable" })
    }
  })

  test("preserves the domain's failed ceiling after coverage resolves", async () => {
    const input = host()
    const identity = { schema: "sf-evidence-v1", refId: "cost-quote", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "quote", incarnation: "inc", version: 2, fields: ["amount", "coverage"], period, projectionDigest: "a".repeat(64) } } as const
    const evidence = { ...identity, refDigest: digestSfEvidenceRef(identity) }
    const source = { surface: "planner", type: "quote", id: "quote", incarnation: "inc", version: 2, fields: ["amount", "coverage"], period, observedAt: "2026-11-14T00:00:00Z" } as const
    const components = [{ id: "cost", amount: 250000, currency: "USD", period, sourceRefs: [source], evidenceState: "confirmed" as const }]
    const basis = { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [evidence] }
    const coverage = assessCostCoverage({ basis, alternativeId: "a", alternativeVersion: 2, currency: "USD", horizon: period, entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId, index) => index === 0 ? { status: "included" as const, categoryId, componentRefs: ["cost"], evidenceRefs: [evidence], scopeNote: "All known costs in the canonical quote component" } : { status: "not-applicable" as const, categoryId, justification: "Explicit quote scope", evidenceRefs: [evidence] }), components, evidence: [{ state: "fresh", ref: evidence, accessRevision: "access", checkedAt: "2026-11-14T00:00:00Z" }], supports: () => true })
    expect(coverage.coverageState).toBe("complete")
    if (coverage.coverageState !== "complete") throw new Error("Expected complete canonical quote coverage")
    const complete: ScenarioResult = { ...scenario, components, sourceRefs: [evidence], comparisonStatus: "complete", knownSubtotal: 250000, total: 250000, costCoverage: coverage }
    const resolve = input.resolveCandidate
    input.resolveCandidate = async (ref, context) => { const result = await resolve(ref, context); return result.status === "ok" ? { status: "ok", value: { ...result.value, result: complete } } : result }
    const comparison = { baselineResultRef: "base", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage-v2"], criterionResults: [{ criterionId: "ceiling", state: "failed", reason: "250000 exceeds 240000" }], unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 10000, completeDifference: 10000 } as const
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
    input.evaluate = async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage-a"], analysis: { ...analysis, scenarioResultRef: "other" }, constraints: [] } })
    expect(await createPortfolioPort(input).evaluate({ ...request, candidateRefs: ["a"] }, context)).toEqual({ status: "unavailable", reason: "analysis-reference-mismatch" })
  })

})
