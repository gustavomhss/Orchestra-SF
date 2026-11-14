import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCritiqueInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createDecisionAnswerEffect } from "../../../../modules/sucafina/Sucafinav1/product/decisions/answer-effect.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

const unavailable = { status: "unavailable", reason: "analysis-input-producer-unavailable" } as const

type CritiqueSelection = {
  authorRunRef: string
  outputDigest: string
  choiceRefs: readonly string[]
  alternativeRefs: readonly string[]
  evidenceRefIds: readonly string[]
  responseRef?: string
}

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function selection(value: unknown): CritiqueSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.some(([key]) => !["authorRunRef", "outputDigest", "choiceRefs", "alternativeRefs", "evidenceRefIds", "responseRef"].includes(key))) return undefined
  const authorRunRef = entries.find(([key]) => key === "authorRunRef")?.[1]
  const outputDigest = entries.find(([key]) => key === "outputDigest")?.[1]
  const choiceRefs = entries.find(([key]) => key === "choiceRefs")?.[1]
  const alternativeRefs = entries.find(([key]) => key === "alternativeRefs")?.[1]
  const evidenceRefIds = entries.find(([key]) => key === "evidenceRefIds")?.[1]
  const responseRef = entries.find(([key]) => key === "responseRef")?.[1]
  if (typeof authorRunRef !== "string" || !authorRunRef.trim() || typeof outputDigest !== "string" || !/^[a-f0-9]{64}$/.test(outputDigest)) return undefined
  if (!Array.isArray(choiceRefs) || !Array.isArray(alternativeRefs) || !Array.isArray(evidenceRefIds) || !choiceRefs.length || !alternativeRefs.length) return undefined
  if (choiceRefs.some((id) => typeof id !== "string" || !id.trim()) || alternativeRefs.some((id) => typeof id !== "string" || !id.trim())) return undefined
  if (new Set(choiceRefs).size !== choiceRefs.length || new Set(alternativeRefs).size !== alternativeRefs.length) return undefined
  if (evidenceRefIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(evidenceRefIds).size !== evidenceRefIds.length) return undefined
  if (responseRef !== undefined && (typeof responseRef !== "string" || !responseRef.trim())) return undefined
  return { authorRunRef, outputDigest, choiceRefs, alternativeRefs, evidenceRefIds, ...(responseRef === undefined ? {} : { responseRef }) }
}

function authorComparison(output: ContributionEnvelope) {
  if (output.state !== "ready") return undefined
  if (output.kind === "ScenarioComparison") return output.payload
  if (output.kind === "FinancialAnalysis") return output.payload.comparison
  return undefined
}

export function createSfCritiqueInputProducer(dependencies: SfAnalysisDependencies & {
  readAuthorAnalysis: (runRef: string, outputDigest: string, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
  readHistoricalAuthor?: (runRef: string, outputDigest: string, selection: { caseRef: SfAnalysisRequest["caseRef"]; responseRef: string }, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
  readAnswerEffectSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ state: "none" } | { state: "selected"; request: Parameters<ReturnType<typeof createDecisionAnswerEffect>>[0] }>>
  answerEffect?: ReturnType<typeof createDecisionAnswerEffect>
}): SfInputProducer {
  return {
    skillIds: ["sf-contestar-decisao"],
    prepare: async (raw, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = selection(raw)
      if (!human) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (request.profileId !== "sf_reviewer") return unavailable
      const first = await load(dependencies, human, request, call)
      const second = await load(dependencies, human, request, call)
      if (!first || !second || !same(first.input, second.input) || first.accessRevision !== second.accessRevision || first.accessRevision !== call.binding.accessRevision) return unavailable
      const decoded = decodeSfSkillInput("DecisionCritiqueInput", second.input)
      return decoded.ok ? { status: "ok", value: decoded.value } : unavailable
    },
  }
}

async function load(
  dependencies: SfAnalysisDependencies & {
    readAuthorAnalysis: (runRef: string, outputDigest: string, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
    readHistoricalAuthor?: (runRef: string, outputDigest: string, selection: { caseRef: SfAnalysisRequest["caseRef"]; responseRef: string }, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
    readAnswerEffectSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ state: "none" } | { state: "selected"; request: Parameters<ReturnType<typeof createDecisionAnswerEffect>>[0] }>>
    answerEffect?: ReturnType<typeof createDecisionAnswerEffect>
  },
  human: CritiqueSelection,
  request: SfAnalysisRequest,
  call: TrustedDomainContext,
): Promise<{ input: DecisionCritiqueInput; accessRevision: string } | undefined> {
  if (!(await dependencies.host.revalidate(call))) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const alternatives = human.alternativeRefs.flatMap((id) => current.value.case.alternatives.filter((item) => item.id === id))
  const choices = human.choiceRefs.flatMap((id) => current.value.case.choices.filter((item) => item.id === id))
  if (alternatives.length !== human.alternativeRefs.length || choices.length !== human.choiceRefs.length || choices.some((choice) => !human.alternativeRefs.includes(choice.alternativeId))) return undefined
  const selectedAnswer = await dependencies.readAnswerEffectSelection(request.caseRef, call)
  if (selectedAnswer.status !== "ok") return undefined
  if (selectedAnswer.value.state === "none" && human.responseRef) return undefined
  const effect = await (async () => {
    if (selectedAnswer.value.state === "none") return null
    if (!dependencies.answerEffect || !dependencies.readHistoricalAuthor) return undefined
    const asked = selectedAnswer.value.request
    if (!human.responseRef || !same(asked.caseRef, request.caseRef) || !human.choiceRefs.includes(asked.choiceId) || !human.alternativeRefs.includes(asked.baselineAlternativeId) || !human.alternativeRefs.includes(asked.alternativeId)) return undefined
    const produced = await dependencies.answerEffect(asked, call)
    if (produced.status !== "ok" || produced.value.choiceChanged || produced.value.answerRef !== human.responseRef || !same(produced.value.caseRef, request.caseRef) || produced.value.questionId !== asked.questionId || produced.value.originalChoice.id !== asked.choiceId || digestSfValue(produced.value.originalChoice) !== produced.value.originalChoiceDigest || digestSfValue(produced.value.currentComparison) !== produced.value.currentComparisonDigest || same(produced.value.originalChoice.comparison, produced.value.currentComparison)) return undefined
    return produced.value
  })()
  if (effect === undefined) return undefined
  const author = effect
    ? await dependencies.readHistoricalAuthor!(human.authorRunRef, human.outputDigest, { caseRef: request.caseRef, responseRef: effect.answerRef }, call)
    : await dependencies.readAuthorAnalysis(human.authorRunRef, human.outputDigest, call)
  if (author.status !== "ok" || author.value.run.state !== "ready" || !author.value.run.native || author.value.run.runRef !== human.authorRunRef || author.value.output.state !== "ready" || author.value.run.outputRef !== author.value.output.id || author.value.output.outputDigest !== human.outputDigest || digestSfContribution(author.value.output) !== human.outputDigest) return undefined
  if (author.value.run.caseRef.id !== request.caseRef.id || author.value.run.caseRef.incarnation !== request.caseRef.incarnation || (effect ? author.value.run.caseRef.version >= request.caseRef.version : author.value.run.caseRef.version !== request.caseRef.version)) return undefined
  const target = authorComparison(author.value.output)
  const criteria = choices[0]?.criteria
  if (!target || !criteria || choices.some((choice) => !same(choice.criteria, criteria))) return undefined
  const requestRefs = effect ? effect.currentRequest : { scenarioRefs: [target.baselineResultRef, target.alternativeResultRef] as const, criteria }
  if (effect && !same(target, effect.originalChoice.comparison)) return undefined
  const replay = await dependencies.planner.compareScenarios(effect ? effect.currentRequest : { scenarioRefs: [...requestRefs.scenarioRefs], criteria }, call)
  if (replay.status !== "ok" || (effect ? !same(replay.value, effect.currentComparison) : !same(replay.value, target))) return undefined
  const authorizedEvidenceRefs = human.evidenceRefIds.flatMap((id) => current.value.evidenceRefs.filter((ref) => ref.refId === id))
  if (authorizedEvidenceRefs.length !== human.evidenceRefIds.length) return undefined
  if (effect && !authorizedEvidenceRefs.some((ref) => same(ref, effect.answerEvidence))) return undefined
  const sources = await dependencies.context.context({ refs: authorizedEvidenceRefs }, call)
  if (sources.length !== authorizedEvidenceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, authorizedEvidenceRefs[index]) || !same(item.currentRef, item.ref) || item.accessRevision !== call.binding.accessRevision) || !(await dependencies.host.revalidate(call))) return undefined
  const input: DecisionCritiqueInput = {
    alternativeRefs: human.alternativeRefs,
    choiceRefs: human.choiceRefs,
    comparison: replay.value,
    authorAnalysis: { runRef: human.authorRunRef, outputDigest: human.outputDigest },
    authorizedEvidenceRefs,
  }
  return { input, accessRevision: call.binding.accessRevision }
}
