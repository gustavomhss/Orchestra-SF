import { expect, test } from "bun:test"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { preparePortfolioChoice, promotePortfolioAlternative, portfolioEvaluationDigest } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { PortfolioRequest } from "../../../product/contracts/operations.ts"
import type { PortfolioResult, ScenarioResult } from "../../../product/contracts/decisions.ts"
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
  const cases = { read: async () => ({ status: "ok", value: { case: { id: "case", incarnation: "one", version: 2, choices: [{ id: "choice", scenario: { baseRef: "base", operations, assumptions: [] }, result: scenario }] } } as unknown as AuthorizedCaseProjection }) } as unknown as DecisionCasePort
  const decisions = { prepareChanges: async () => { prepared++; return { status: "ok" as const, value: { caseRef: ref } } } }
  const input = { portfolio, host, cases, decisions, request, selectedCandidateRefs: ["a"], combinationId: comparison.value.combinations[0].id, expectedEvaluationDigest: portfolioEvaluationDigest(request, comparison.value), caseRef: ref, choiceId: "choice" }
  expect((await preparePortfolioChoice(input, context)).status).toBe("ok")
  expect(prepared).toBe(1)
  const replaced = { read: async () => ({ status: "ok", value: { case: { id: "case", incarnation: "replacement", version: 2, choices: [] } } }) } as unknown as DecisionCasePort
  expect(await preparePortfolioChoice({ ...input, cases: replaced }, context)).toEqual({ status: "stale", reason: "case-changed" })
  expect(prepared).toBe(1)
  expect(await preparePortfolioChoice({ ...input, choiceId: "other" }, context)).toEqual({ status: "conflict", reason: "choice-does-not-match-combination" })
  expect(prepared).toBe(1)
  const changed = { ...input, expectedEvaluationDigest: "old-comparison" }
  expect(await preparePortfolioChoice(changed, context)).toEqual({ status: "stale", reason: "combination-changed" })
  expect(prepared).toBe(1)

  let reads = 0
  const changingHost: PortfolioHost = { ...host, resolveCandidate: async (ref) => {
    reads++
    const amount = reads === 6 ? 41 : 40
    const nextOperations = [{ kind: "replace" as const, targetRef: "line:1", amount }]
    return { status: "ok", value: { ref, caseRef: "case", operations: nextOperations, scenario: { baseRef: "base", operations: nextOperations, assumptions: [] } } }
  } }
  const changingPortfolio = createPortfolioPort(changingHost)
  const fresh = await changingPortfolio.evaluate(request, context)
  if (fresh.status !== "ok") throw new Error(fresh.reason)
  const changingInput = { ...input, host: changingHost, portfolio: changingPortfolio, combinationId: fresh.value.combinations[0]!.id, expectedEvaluationDigest: portfolioEvaluationDigest(request, fresh.value) }
  expect(await preparePortfolioChoice(changingInput, context)).toEqual({ status: "stale", reason: "candidate-changed-before-handoff" })
  expect(prepared).toBe(1)
  expect(await preparePortfolioChoice({ ...input, request: { ...request, priorities: ["changed-priority"] } }, context)).toEqual({ status: "stale", reason: "combination-changed" })
  expect(prepared).toBe(1)
})


test("promotes the reviewed combination through the case domain only for a human", async () => {
  const combinedRequest = { ...request, candidateRefs: ["a", "b"], explorationLimit: 3 }
  const combinedHost: PortfolioHost = { ...host, resolveCandidate: async (ref) => {
    const changes = [{ kind: "replace" as const, targetRef: `line:${ref}`, amount: 40 }]
    return { status: "ok", value: { ref, caseRef: "case", operations: changes, scenario: { baseRef: "base", operations: changes, assumptions: [] } } }
  } }
  const portfolio = createPortfolioPort(combinedHost)
  const evaluated = await portfolio.evaluate(combinedRequest, context)
  if (evaluated.status !== "ok") throw new Error(evaluated.reason)
  const selected = evaluated.value.combinations.find((item) => item.caseRefs.length === 2)!
  const preview = await portfolio.evaluateWithSelections(combinedRequest, context)
  expect(preview.status === "ok" && preview.value.selections.find((item) => item.combinationId === selected.id)?.selectedCandidateRefs).toEqual(["a", "b"])
  const calls: unknown[] = []
  const ref = { id: "case", incarnation: "one", version: 2 }
  const input = { portfolio, host: combinedHost, decisions: { addAlternative: async (value: unknown) => { calls.push(value); return { status: "ok" as const, value: { caseRef: { ...ref, version: 3 } } } } }, request: combinedRequest, selectedCandidateRefs: ["a", "b"], combinationId: selected.id, expectedEvaluationDigest: portfolioEvaluationDigest(combinedRequest, evaluated.value), caseRef: ref, title: "Combined", coverageRef: "case-coverage" }
  expect((await promotePortfolioAlternative(input, context)).status).toBe("ok")
  expect(calls).toEqual([{ caseRef: ref, title: "Combined", coverageRef: "case-coverage", scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: "line:a", amount: 40 }, { kind: "replace", targetRef: "line:b", amount: 40 }], assumptions: [] } }])
  expect(await promotePortfolioAlternative({ ...input, expectedEvaluationDigest: "stale" }, context)).toEqual({ status: "stale", reason: "combination-changed" })
  expect(await promotePortfolioAlternative(input, { kind: "native" } as TrustedDomainContext)).toEqual({ status: "denied", reason: "human-promotion-required" })
  expect(calls).toHaveLength(1)

  let reads = 0
  const changingHost: PortfolioHost = { ...combinedHost, resolveCandidate: async (ref) => {
    reads++
    const amount = reads === 11 ? 41 : 40
    const operations = [{ kind: "replace" as const, targetRef: `line:${ref}`, amount }]
    return { status: "ok", value: { ref, caseRef: "case", operations, scenario: { baseRef: "base", operations, assumptions: [] } } }
  } }
  const changingPortfolio = createPortfolioPort(changingHost)
  const fresh = await changingPortfolio.evaluate(combinedRequest, context)
  if (fresh.status !== "ok") throw new Error(fresh.reason)
  const selectedAgain = fresh.value.combinations.find((item) => item.caseRefs.length === 2)!
  const changingInput = { ...input, host: changingHost, portfolio: changingPortfolio, combinationId: selectedAgain.id, expectedEvaluationDigest: portfolioEvaluationDigest(combinedRequest, fresh.value) }
  expect(await promotePortfolioAlternative(changingInput, context)).toEqual({ status: "stale", reason: "candidate-changed-before-handoff" })
  expect(calls).toHaveLength(1)
})


test("review digest ignores observation clocks but retains financial changes", () => {
  const source = { surface: "planner", type: "line", id: "line", incarnation: "inc", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const component = { id: "line", amount: 40, currency: "USD", period, sourceRefs: [source], evidenceState: "confirmed" as const }
  const result: PortfolioResult = { combinations: [{ id: "combination", caseRefs: ["case"], components: [component], costCoverageRefs: [], conflicts: [], restrictions: [], eligibility: "conditioned", comparisonStatus: "conditioned" }], limitations: [], evidenceRefs: [] }
  const later: PortfolioResult = { ...result, combinations: [{ ...result.combinations[0], components: [{ ...component, sourceRefs: [{ ...source, observedAt: "2026-11-13T00:01:00Z" }] }] }] }
  const changed: PortfolioResult = { ...result, combinations: [{ ...result.combinations[0], components: [{ ...component, amount: 41 }] }] }
  expect(portfolioEvaluationDigest(request, later)).toBe(portfolioEvaluationDigest(request, result))
  expect(portfolioEvaluationDigest(request, changed)).not.toBe(portfolioEvaluationDigest(request, result))
})
