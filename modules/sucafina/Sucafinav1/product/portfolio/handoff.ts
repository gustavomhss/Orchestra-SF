import { digestSfValue } from "../contracts/canonical.ts"
import { plannerComponentDigest } from "../planner/comparison.ts"
import { portfolioResultDigest } from "./result-store.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { PortfolioRequest, ScenarioOperation } from "../contracts/operations.ts"
import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortfolioCandidate, PortfolioHost, PortfolioPort } from "./port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type DecisionPreparation = {
  prepareChanges: (request: { caseRef: CaseRef; choiceId: string; operations: readonly ScenarioOperation[] }, context: TrustedDomainContext) => Promise<PortResult<{ caseRef: CaseRef }>>
}

export function portfolioEvaluationDigest(request: PortfolioRequest, result: PortfolioResult) {
  return digestSfValue({ request, result: portfolioResultDigest(result) })
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
  if (failure && failure.status !== "ok") return failure
  const candidates = resolved.flatMap((item) => item.status === "ok" ? [item.value] : [])
  const operations = [...input.request.operations, ...candidates.flatMap((candidate) => candidate.operations)]
  if (digestSfValue({ candidates: candidates.map((candidate) => candidate.ref), operations }) !== input.combinationId) return { status: "stale", reason: "combination-changed" }
  const caseRef = `case:${encodeURIComponent(input.caseRef.id)}:${encodeURIComponent(input.caseRef.incarnation)}`
  const current = await input.cases.read({ caseRef }, context)
  if (current.status !== "ok") return current
  if (current.value.case.id !== input.caseRef.id || current.value.case.incarnation !== input.caseRef.incarnation || current.value.case.version !== input.caseRef.version) return { status: "stale", reason: "case-changed" }
  const choice = current.value.case.choices.find((item) => item.id === input.choiceId)
  if (!choice || digestSfValue(choice.scenario.operations) !== digestSfValue(operations) || candidates.some((candidate) => candidate.scenario.baseRef !== choice.scenario.baseRef || candidate.scenario.assumptions.some((assumption) => !choice.scenario.assumptions.some((item) => digestSfValue(item) === digestSfValue(assumption))))) return { status: "conflict", reason: "choice-does-not-match-combination" }
  if (plannerComponentDigest(choice.result.components) !== plannerComponentDigest(selected.components) || choice.result.currency !== input.request.scope.currency || choice.result.horizon.start !== input.request.scope.horizon.start || choice.result.horizon.end !== input.request.scope.horizon.end) return { status: "stale", reason: "choice-result-changed" }
  const checked = await revalidateCandidates(input.host, input.selectedCandidateRefs, candidates, context)
  if (checked.status !== "ok") return checked
  return input.decisions.prepareChanges({ caseRef: input.caseRef, choiceId: input.choiceId, operations }, context)
}

/** Promote a reviewed combination to a case alternative through WP11's authorized human action. */
export async function promotePortfolioAlternative(input: {
  portfolio: PortfolioPort
  host: PortfolioHost
  decisions: { addAlternative: (request: { caseRef: CaseRef; title: string; scenario: import("../contracts/operations.ts").ScenarioRequest; coverageRef: string }, context: TrustedDomainContext) => Promise<PortResult<{ caseRef: CaseRef; resultRef?: string }>> }
  request: PortfolioRequest
  selectedCandidateRefs: readonly string[]
  combinationId: string
  expectedEvaluationDigest: string
  caseRef: CaseRef
  title: string
  coverageRef: string
}, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef; resultRef?: string }>> {
  if (context.kind !== "ui") return { status: "denied", reason: "human-promotion-required" }
  if (!input.title.trim() || !input.coverageRef.trim() || !input.selectedCandidateRefs.length || new Set(input.selectedCandidateRefs).size !== input.selectedCandidateRefs.length || input.selectedCandidateRefs.some((ref) => !input.request.candidateRefs.includes(ref))) return { status: "needs-input", reason: "invalid-selection" }
  const comparison = await input.portfolio.evaluate(input.request, context)
  if (comparison.status !== "ok") return comparison
  const selected = comparison.value.combinations.find((item) => item.id === input.combinationId)
  if (!selected || portfolioEvaluationDigest(input.request, comparison.value) !== input.expectedEvaluationDigest) return { status: "stale", reason: "combination-changed" }
  if (selected.eligibility === "ineligible" || selected.eligibility === "unavailable") return { status: "conflict", reason: "combination-not-available" }
  const resolved = await Promise.all(input.selectedCandidateRefs.map((ref) => input.host.resolveCandidate(ref, context)))
  const failure = resolved.find((item) => item.status !== "ok")
  if (failure && failure.status !== "ok") return failure
  const candidates = resolved.flatMap((item) => item.status === "ok" ? [item.value] : [])
  const operations = [...input.request.operations, ...candidates.flatMap((candidate) => candidate.operations)]
  if (digestSfValue({ candidates: candidates.map((candidate) => candidate.ref), operations }) !== input.combinationId) return { status: "stale", reason: "combination-changed" }
  const first = candidates[0]
  if (!first || candidates.some((candidate) => candidate.scenario.baseRef !== first.scenario.baseRef)) return { status: "conflict", reason: "portfolio-base-mismatch" }
  const assumptions = candidates.flatMap((candidate) => candidate.scenario.assumptions)
  if (assumptions.some((item) => assumptions.some((other) => other.id === item.id && digestSfValue(other) !== digestSfValue(item)))) return { status: "conflict", reason: "portfolio-assumption-conflict" }
  const checked = await revalidateCandidates(input.host, input.selectedCandidateRefs, candidates, context)
  if (checked.status !== "ok") return checked
  return input.decisions.addAlternative({ caseRef: input.caseRef, title: input.title, coverageRef: input.coverageRef, scenario: { baseRef: first.scenario.baseRef, operations, assumptions: assumptions.filter((item, index) => assumptions.findIndex((other) => digestSfValue(other) === digestSfValue(item)) === index) } }, context)
}

async function revalidateCandidates(host: PortfolioHost, refs: readonly string[], expected: readonly PortfolioCandidate[], context: TrustedDomainContext): Promise<PortResult<true>> {
  try {
    const resolved = await Promise.all(refs.map((ref) => host.resolveCandidate(ref, context)))
    const failure = resolved.find((item) => item.status !== "ok")
    if (failure && failure.status !== "ok") return failure
    const candidates = resolved.flatMap((item) => item.status === "ok" ? [item.value] : [])
    if (digestSfValue(candidates) !== digestSfValue(expected)) return { status: "stale", reason: "candidate-changed-before-handoff" }
    if (!await host.revalidate(context)) return { status: "stale", reason: "authority-changed" }
    return { status: "ok", value: true }
  } catch {
    return { status: "unavailable", reason: "candidate-revalidation-unavailable" }
  }
}
