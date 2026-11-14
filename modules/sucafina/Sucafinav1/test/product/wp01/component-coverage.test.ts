import { expect, test } from "bun:test"
import { contextBar, decisionDesk, scenario } from "../../../product/ui/components.ts"
import type { ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"

const horizon = { start: "2027-01", end: "2027-12" }
const pending: ScenarioResult = {
  id: "replacement-v1", version: 1, components: [], currency: "USD", horizon,
  sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null,
  costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "replacement", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], entries: [], derivedMissingCategoryIds: ["training"], coverageState: "pending" },
}
const comparison: ScenarioComparison = {
  baselineResultRef: "renew-v1", alternativeResultRef: "replacement-v1", costCoverageRefs: ["coverage-renew-v1", "coverage-replacement-v1"],
  criterionResults: [{ criterionId: "cost", state: "unknown", reason: "Training is missing" }], unresolvedConditions: ["Training has not been confirmed"],
  comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null,
}

test("coverage references and the derived omitted category accompany conditioned amounts", () => {
  const html = scenario(pending, comparison)
  expect(html).toContain("Known subtotal: 210000 USD")
  expect(html).toContain("Known difference: 30000 USD")
  expect(html).toContain("Comparison conditioned")
  expect(html).toContain("Cost coverage: pending")
  expect(html).toContain("coverage-renew-v1")
  expect(html).toContain("coverage-replacement-v1")
  expect(html.indexOf("coverage-replacement-v1")).toBeLessThan(html.indexOf("<details>"))
  expect(html).toContain("Missing category: training")
  expect(html).toContain("confirm its cost or document why it does not apply")
  expect(html).toContain("Training has not been confirmed")
  expect(html).not.toContain("Complete comparison")
  expect(html).not.toContain("Total:")
})

test("unavailable values remain unavailable and a pending question supplies the next step", () => {
  const result: ScenarioResult = {
    ...pending, comparisonStatus: "unavailable", knownSubtotal: null,
    costCoverage: { ...pending.costCoverage, coverageState: "unavailable", entries: [{ status: "pending", categoryId: "training", reason: "Source access unavailable", questionRef: "training-question" }], derivedMissingCategoryIds: [] },
  }
  const html = scenario(result, { ...comparison, comparisonStatus: "unavailable", knownDifference: null })
  expect(html).toContain("Known subtotal: Unavailable USD")
  expect(html).toContain("Known difference: Unavailable USD")
  expect(html).toContain("answer question training-question")
  expect(html).toContain("Review source access, currency and period")
  expect(html).not.toContain("subtotal: 0")
  expect(html).not.toContain("difference: 0")
})

test("a confirmed zero and a later nonzero cost are consumed without UI arithmetic", () => {
  const complete: ScenarioResult = {
    ...pending, comparisonStatus: "complete", knownSubtotal: 210000, total: 210000,
    costCoverage: { ...pending.costCoverage, coverageState: "complete", entries: [{ status: "included", categoryId: "training", componentRefs: ["training-zero"], evidenceRefs: [], scopeNote: "Training included at zero in the confirmed quote" }], derivedMissingCategoryIds: [] },
  }
  const first = scenario(complete, { ...comparison, comparisonStatus: "complete", knownDifference: 30000, completeDifference: 30000 })
  expect(first).toContain("Total: 210000 USD")
  expect(first).toContain("Training included at zero in the confirmed quote")
  expect(first).not.toContain("Missing category")
  const updated: ScenarioResult = { ...complete, id: "replacement-v2", version: 2, knownSubtotal: 250000, total: 250000 }
  const second = scenario(updated, { ...comparison, alternativeResultRef: "replacement-v2", costCoverageRefs: ["coverage-renew-v1", "coverage-replacement-v2"], comparisonStatus: "complete", knownDifference: -10000, completeDifference: -10000 })
  expect(second).toContain("Total: 250000 USD")
  expect(second).toContain("Difference: -10000 USD")
  expect(second).toContain("coverage-replacement-v2")
})

test("choice history retains its original conditional result after reevaluation", () => {
  const projection: AuthorizedCaseProjection = {
    context: { installationId: "installation", projectId: "project", principalRef: "reader", policyVersion: "1", accessRevision: "1", kind: "ui" },
    checkedAt: "2027-01-01", evidenceRefs: [], events: [],
    case: {
      id: "case", incarnation: "first", version: 3, state: "reconsidering", objective: "Review renewal", horizon, currency: "USD",
      criteria: [], participants: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], preparedChanges: [], receipts: [], ledger: [],
      choices: [{ id: "choice", alternativeId: "replacement", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [], principalRef: "reader", reason: "Chosen subject to confirming training", at: "2027-01-01", scenario: { baseRef: "base", operations: [], assumptions: [] }, result: pending, comparison, comparisonStatus: "conditioned", costCoverage: pending.costCoverage }],
    },
  }
  const html = decisionDesk(projection)
  expect(html).toContain("Chosen subject to confirming training")
  expect(html).toContain("Known subtotal: 210000 USD")
  expect(html).toContain("Known difference: 30000 USD")
  expect(html).toContain("coverage-replacement-v1")
  expect(html).not.toContain("Complete comparison")
})

test("coverage metadata is escaped and complete comparison does not mask conditioned source", () => {
  const html = scenario(pending, { ...comparison, costCoverageRefs: ["<img src=x onerror=alert(1)>"], comparisonStatus: "complete", knownDifference: 30000, completeDifference: 30000 })
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  expect(html).not.toContain("<img")
  expect(html).not.toContain("Complete comparison")
  expect(html).toContain("Comparison conditioned")
})

test("work context displays the authorized record scope and does not manufacture records", () => {
  const html = contextBar({ installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "1", policyVersion: "1", surface: "planner", period: horizon, currency: "USD", capabilities: [], sourceRefs: [{ surface: "planner", type: "budget", id: "<authorized>", incarnation: "first", version: 3, fields: [], period: horizon, observedAt: "2027-01-01" }] }, 3)
  expect(html).toContain("Budget Planner")
  expect(html).toContain("Scope: budget &lt;authorized&gt; · version 3")
  expect(html).toContain("Period: 2027-01 – 2027-12")
})
