import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "./case-port.ts"
import type { createDecisionComparisonService } from "./comparison.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Compare an explicitly selected current scenario with the preserved choice after an authorized answer. */
export function createDecisionAnswerEffect(input: {
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "revalidate">
  compare: ReturnType<typeof createDecisionComparisonService>
  resolveAnswer: (request: { questionId: string; answerRef: string }, context: TrustedDomainContext) => Promise<PortResult<BusinessEvidenceRef>>
}) {
  return async (request: { caseRef: CaseRef; questionId: string; answerRef: string; choiceId: string; baselineAlternativeId: string; alternativeId: string; criteria: readonly string[] }, context: TrustedDomainContext) => {
    try {
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "answer-effect-access-unavailable" } as const
      const read = () => input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const current = await read()
      if (current.status !== "ok") return current
      const questions = current.value.case.questions.filter((item) => item.id === request.questionId && item.state === "answered" && item.answerRef === request.answerRef)
      const choices = current.value.case.choices.filter((item) => item.id === request.choiceId)
      if (current.value.case.version !== request.caseRef.version || questions.length !== 1 || choices.length !== 1) return { status: "stale", reason: "answer-or-choice-changed" } as const
      const answer = await input.resolveAnswer({ questionId: request.questionId, answerRef: request.answerRef }, context)
      if (answer.status !== "ok") return answer
      if (!current.value.case.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(answer.value))) return { status: "unavailable", reason: "answer-evidence-unavailable" } as const
      const alternatives = current.value.case.alternatives.filter((item) => item.id === request.alternativeId)
      if (alternatives.length !== 1 || ![...alternatives[0]!.result.sourceRefs, ...alternatives[0]!.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs)].some((ref) => digestSfValue(ref) === digestSfValue(answer.value))) return { status: "unavailable", reason: "answer-not-bound-to-scenario" } as const
      const comparisonRequest = { caseRef: request.caseRef, baselineAlternativeId: request.baselineAlternativeId, alternativeId: request.alternativeId, criteria: request.criteria }
      const comparison = await input.compare(comparisonRequest, context)
      if (comparison.status !== "ok") return comparison
      const again = await read()
      const answerAgain = await input.resolveAnswer({ questionId: request.questionId, answerRef: request.answerRef }, context)
      const comparisonAgain = await input.compare(comparisonRequest, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || answerAgain.status !== "ok" || digestSfValue(answerAgain.value) !== digestSfValue(answer.value) || comparisonAgain.status !== "ok" || digestSfValue(comparisonAgain.value) !== digestSfValue(comparison.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "answer-effect-changed" } as const
      return { status: "ok", value: { caseRef: request.caseRef, questionId: request.questionId, answerRef: request.answerRef, answerEvidence: answer.value, originalChoice: choices[0]!, originalChoiceDigest: digestSfValue(choices[0]), currentRequest: comparison.value.request, currentComparison: comparison.value.comparison, currentComparisonDigest: digestSfValue(comparison.value.comparison), choiceChanged: false as const } } as const
    } catch { return { status: "unavailable", reason: "answer-effect-unavailable" } as const }
  }
}
