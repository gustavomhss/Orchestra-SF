import { expect, test } from "bun:test"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { preparePortfolioChoice, portfolioEvaluationDigest } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { PortfolioRequest } from "../../../product/contracts/operations.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui" } as TrustedDomainContext
const period = { start: "2027-01-01", end: "2027-12-31" }
const operations = [{ kind: "replace" as const, targetRef: "line:1", amount: 40 }]
const request: PortfolioRequest = { scope: { horizon: period, currency: "USD" }, candidateRefs: ["a"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
const scenario: ScenarioResult = { id: "scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["training missing"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 40, total: null, costCoverage: { basisId: "b", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }
const host: PortfolioHost = {
  resolveCandidate: async (ref) => ({ status: "ok", value: { ref, caseRef: "case", operations, scenario: { baseRef: "base", operations, assumptions: [] } } }),
  evaluate: async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["coverage"], constraints: [] } }),
  sensitivity: async () => ({ status: "unavailable", reason: "not-connected" }),
  revalidate: async () => true,
  revalidateEvaluation: async () => true,
}

test("prepares through the WP11 port only when the persisted human choice matches", async () => {
  const portfolio = createPortfolioPort(host)
  const comparison = await portfolio.evaluate(request, context)
  if (comparison.status !== "ok") throw new Error(comparison.reason)
  const ref = { id: "case", incarnation: "one", version: 2 }
  let prepared = 0
  const cases = { read: async () => ({ status: "ok", value: { case: { version: 2, choices: [{ id: "choice", scenario: { baseRef: "base", operations, assumptions: [] }, result: scenario }] } } as unknown as AuthorizedCaseProjection }) } as unknown as DecisionCasePort
  const decisions = { prepareChanges: async () => { prepared++; return { status: "ok" as const, value: { caseRef: ref } } } }
  const input = { portfolio, host, cases, decisions, request, selectedCandidateRefs: ["a"], combinationId: comparison.value.combinations[0].id, expectedEvaluationDigest: portfolioEvaluationDigest(request, comparison.value), caseRef: ref, choiceId: "choice" }
  expect((await preparePortfolioChoice(input, context)).status).toBe("ok")
  expect(prepared).toBe(1)
  expect(await preparePortfolioChoice({ ...input, choiceId: "other" }, context)).toEqual({ status: "conflict", reason: "choice-does-not-match-combination" })
  expect(prepared).toBe(1)
  const changed = { ...input, expectedEvaluationDigest: "old-comparison" }
  expect(await preparePortfolioChoice(changed, context)).toEqual({ status: "stale", reason: "combination-changed" })
  expect(prepared).toBe(1)
  expect(await preparePortfolioChoice({ ...input, request: { ...request, priorities: ["changed-priority"] } }, context)).toEqual({ status: "stale", reason: "combination-changed" })
  expect(prepared).toBe(1)
})
