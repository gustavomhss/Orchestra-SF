import { digestSfValue } from "../contracts/canonical.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { PortfolioRequest, ScenarioOperation } from "../contracts/operations.ts"
import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortfolioHost, PortfolioPort } from "./port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type DecisionPreparation = {
  prepareChanges: (request: { caseRef: CaseRef; choiceId: string; operations: readonly ScenarioOperation[] }, context: TrustedDomainContext) => Promise<PortResult<{ caseRef: CaseRef }>>
}

export function portfolioEvaluationDigest(request: PortfolioRequest, result: PortfolioResult) {
  return digestSfValue({ request, result })
}

/** Revalidate the selected set against the persisted human choice, then use WP11's preparation path. */
export async function preparePortfolioChoice(input: {
  portfolio: PortfolioPort
  host: PortfolioHost
  cases: DecisionCasePort
  decisions: DecisionPreparation
  request: PortfolioRequest
  selectedCandidateRefs: readonly string[]
  combinationId: string
  expectedEvaluationDigest: string
  caseRef: CaseRef
  choiceId: string
}, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef }>> {
  if (context.kind !== "ui") return { status: "denied", reason: "human-choice-required" }
  if (!input.selectedCandidateRefs.length || new Set(input.selectedCandidateRefs).size !== input.selectedCandidateRefs.length || input.selectedCandidateRefs.some((ref) => !input.request.candidateRefs.includes(ref))) return { status: "needs-input", reason: "invalid-selection" }
  const comparison = await input.portfolio.evaluate(input.request, context)
  if (comparison.status !== "ok") return comparison
  const selected = comparison.value.combinations.find((item) => item.id === input.combinationId)
  if (!selected || portfolioEvaluationDigest(input.request, comparison.value) !== input.expectedEvaluationDigest) return { status: "stale", reason: "combination-changed" }
  if (selected.eligibility === "ineligible" || selected.eligibility === "unavailable") return { status: "conflict", reason: "combination-not-available" }
  const resolved = await Promise.all(input.selectedCandidateRefs.map((ref) => input.host.resolveCandidate(ref, context)))
  const failure = resolved.find((item) => item.status !== "ok")
  if (failure) return failure
  const candidates = resolved.flatMap((item) => item.status === "ok" ? [item.value] : [])
  const operations = [...input.request.operations, ...candidates.flatMap((candidate) => candidate.operations)]
  if (digestSfValue({ candidates: candidates.map((candidate) => candidate.ref), operations }) !== input.combinationId) return { status: "stale", reason: "combination-changed" }
  const caseRef = `case:${encodeURIComponent(input.caseRef.id)}:${encodeURIComponent(input.caseRef.incarnation)}`
  const current = await input.cases.read({ caseRef }, context)
  if (current.status !== "ok") return current
  if (current.value.case.version !== input.caseRef.version) return { status: "stale", reason: "case-changed" }
  const choice = current.value.case.choices.find((item) => item.id === input.choiceId)
  if (!choice || digestSfValue(choice.scenario.operations) !== digestSfValue(operations) || candidates.some((candidate) => candidate.scenario.baseRef !== choice.scenario.baseRef || candidate.scenario.assumptions.some((assumption) => !choice.scenario.assumptions.some((item) => digestSfValue(item) === digestSfValue(assumption))))) return { status: "conflict", reason: "choice-does-not-match-combination" }
  if (digestSfValue(choice.result.components) !== digestSfValue(selected.components) || choice.result.currency !== input.request.scope.currency || choice.result.horizon.start !== input.request.scope.horizon.start || choice.result.horizon.end !== input.request.scope.horizon.end) return { status: "stale", reason: "choice-result-changed" }
  if (!(await input.host.revalidate(context))) return { status: "stale", reason: "authority-changed" }
  return input.decisions.prepareChanges({ caseRef: input.caseRef, choiceId: input.choiceId, operations }, context)
}
