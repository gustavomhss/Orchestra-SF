import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createDecisionAnswerEffect } from "../../../../modules/sucafina/Sucafinav1/product/decisions/answer-effect.ts"
import { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { SfAnalysisRequest } from "./analysis-verifier.ts"
import { createSfCritiqueInputProducer } from "./input-producer-critique.ts"
import { createSfDecisionCritiqueVerifier } from "./analysis-verifier-review.ts"
import type { createSfAnalysisSelectionReaders } from "./analysis-services-readers.ts"
import { readSfReviewAuthorSelection } from "./analysis-services-readers.ts"

type Readers = ReturnType<typeof createSfAnalysisSelectionReaders>
type CaseRef = SfAnalysisRequest["caseRef"]
type Author = { run: SfNativeRunRecord; output: ContributionEnvelope }
type Selection = { author: { runRef: string; outputDigest: string }; choices: readonly string[]; alternatives: readonly string[]; evidenceRefIds: readonly string[]; responseRef?: string }
const unavailable = { status: "unavailable", reason: "review-author-selection-unavailable" } as const
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const strings = (value: unknown): readonly string[] | undefined => Array.isArray(value) && value.every((item) => typeof item === "string" && !!item.trim()) && new Set(value).size === value.length ? value : undefined

function critiqueSelection(raw: unknown, prepared: boolean): Selection | undefined {
  if (prepared) {
    const parsed = decodeSfSkillInput("DecisionCritiqueInput", raw)
    return parsed.ok ? { author: parsed.value.authorAnalysis, choices: parsed.value.choiceRefs, alternatives: parsed.value.alternativeRefs,
      evidenceRefIds: parsed.value.authorizedEvidenceRefs.map((ref) => ref.refId) } : undefined
  }
  const value = object(raw)
  const author = readSfReviewAuthorSelection({ runRef: value.authorRunRef, outputDigest: value.outputDigest })
  const choices = strings(value.choiceRefs), alternatives = strings(value.alternativeRefs), refs = strings(value.evidenceRefIds)
  if (!author || !choices || !alternatives?.length || !refs || Object.keys(value).some((key) => !["authorRunRef", "outputDigest", "choiceRefs", "alternativeRefs", "evidenceRefIds", "responseRef"].includes(key)) ||
    value.responseRef !== undefined && (typeof value.responseRef !== "string" || !value.responseRef.trim())) return undefined
  return { author, choices, alternatives, evidenceRefIds: refs, ...(typeof value.responseRef === "string" ? { responseRef: value.responseRef } : {}) }
}

/** The answer effect is selected by immutable C08 choices, current alternatives, and a real C11 answer. */
export function createSfAnalysisReviewServices(input: { business: ReturnType<typeof createSfBusinessServices>; authority: ReturnType<typeof createSfProductAuthority>; readers: Readers }) {
  const { business, authority, readers } = input
  const dependencies = { cases: business.cases, planner: business.planner, procurement: business.procurement, context: business.context, host: authority.host }
  const compare = createDecisionComparisonService({ ...dependencies, state: authority.state, results: business.results })
  const answerEffect = createDecisionAnswerEffect({ cases: business.cases, host: authority.host, compare,
    resolveAnswer: async (request, call) => await business.collaboration.answerEvidence.belongsToQuestion(request.questionId, request.answerRef, call)
      ? business.collaboration.answerEvidence.resolve(request.answerRef, call) : unavailable })

  const selectedEffect = (selection: Selection, prepared: boolean) => async (caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<
    { state: "none" } | { state: "selected"; request: Parameters<typeof answerEffect>[0] }>> => {
    const current = await readers.current(caseRef, call)
    if (!current) return unavailable
    const refs = selection.evidenceRefIds.flatMap((id) => current.evidenceRefs.filter((ref) => ref.refId === id))
    if (refs.length !== selection.evidenceRefIds.length) return unavailable
    const author = await readers.readAuthorForCase(selection.author.runRef, selection.author.outputDigest, caseRef, call)
    if (author.status === "ok" && !selection.responseRef) return { status: "ok", value: { state: "none" } }
    const answers = current.case.questions.filter((question) => question.state === "answered" && !!question.answerRef &&
      (selection.responseRef ? question.answerRef === selection.responseRef : prepared && refs.some((ref) => ref.refId === question.answerRef)))
    if (answers.length !== 1 || !answers[0]!.answerRef) return unavailable
    const question = answers[0]!
    const responseRef = question.answerRef!
    const historical = await readers.readHistoricalAuthor(selection.author.runRef, selection.author.outputDigest, { caseRef, responseRef }, call)
    if (historical.status !== "ok" || historical.value.output.state !== "ready") return unavailable
    const original = historical.value.output.kind === "ScenarioComparison" ? historical.value.output.payload :
      historical.value.output.kind === "FinancialAnalysis" ? historical.value.output.payload.comparison : undefined
    const choices = current.case.choices.filter((choice) => selection.choices.includes(choice.id) && same(choice.comparison, original))
    if (!original || choices.length !== 1 || !selection.alternatives.includes(choices[0]!.alternativeId)) return unavailable
    const answer = await business.collaboration.answerEvidence.resolve(responseRef, call)
    if (answer.status !== "ok" || !refs.some((ref) => same(ref, answer.value))) return unavailable
    const alternatives = selection.alternatives.flatMap((id) => current.case.alternatives.filter((alternative) => alternative.id === id))
    if (alternatives.length !== selection.alternatives.length) return unavailable
    const baseline = await business.results.readHistoricalScenario({ resultRef: original.baselineResultRef }, call)
    if (baseline.status !== "ok" || baseline.value.kind !== "scenario") return unavailable
    const baselines = alternatives.filter((alternative) => same(alternative.result, baseline.value.result))
    const changed = alternatives.filter((alternative) => [...alternative.result.sourceRefs, ...alternative.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs)]
      .some((ref) => same(ref, answer.value)))
    if (baselines.length !== 1 || changed.length !== 1 || baselines[0]!.id === changed[0]!.id) return unavailable
    const request = { caseRef, questionId: question.id, answerRef: responseRef, choiceId: choices[0]!.id,
      baselineAlternativeId: baselines[0]!.id, alternativeId: changed[0]!.id, criteria: choices[0]!.criteria }
    const effect = await answerEffect(request, call)
    const again = await readers.current(caseRef, call)
    if (effect.status !== "ok" || effect.value.choiceChanged || same(effect.value.originalChoice.comparison, effect.value.currentComparison) ||
      !again || !same(again.case, current.case) || !await authority.host.revalidate(call)) return unavailable
    return { status: "ok", value: { state: "selected", request } }
  }
  const bindings = (selection: Selection, prepared: boolean) => ({ ...dependencies, readAuthorAnalysis: readers.readAuthorAnalysis,
    readHistoricalAuthor: readers.readHistoricalAuthor, readAnswerEffectSelection: selectedEffect(selection, prepared), answerEffect })
  const normalizeSelection = async (raw: unknown, request: SfAnalysisRequest, call: TrustedDomainContext) => {
    const fields = object(raw)
    if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, "authorAnalysis")) return raw
    const target = readSfReviewAuthorSelection(fields.authorAnalysis)
    const current = await readers.current(request.caseRef, call)
    if (!target || !current) return undefined
    const author = await readers.readAuthorForCase(target.runRef, target.outputDigest, request.caseRef, call)
    if (author.status !== "ok" || author.value.output.state !== "ready") return undefined
    const comparison = author.value.output.kind === "ScenarioComparison" ? author.value.output.payload :
      author.value.output.kind === "FinancialAnalysis" ? author.value.output.payload.comparison : undefined
    if (!comparison) return undefined
    const located = await Promise.all(current.case.alternatives.map(async (alternative) => ({ alternative,
      found: await business.scenarioLookup({ caseRef: request.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version }, call) })))
    const alternatives = [comparison.baselineResultRef, comparison.alternativeResultRef].map((resultRef) =>
      located.filter((item) => item.found.status === "ok" && item.found.value.resultRef === resultRef))
    if (alternatives.some((found) => found.length !== 1) || alternatives[0]![0]!.alternative.id === alternatives[1]![0]!.alternative.id) return undefined
    const refs = author.value.output.evidenceRefs
    if (refs.some((ref) => !current.evidenceRefs.some((allowed) => same(ref, allowed)))) return undefined
    const choices = current.case.choices.filter((choice) => same(choice.comparison, comparison))
    const again = await readers.current(request.caseRef, call)
    if (!again || !same(again.case, current.case) || !await authority.host.revalidate(call)) return undefined
    return { authorRunRef: target.runRef, outputDigest: target.outputDigest, choiceRefs: choices.map((choice) => choice.id),
      alternativeRefs: alternatives.map((found) => found[0]!.alternative.id), evidenceRefIds: refs.map((ref) => ref.refId) }
  }
  const producer: ReturnType<typeof createSfCritiqueInputProducer> = {
    skillIds: ["sf-contestar-decisao"], prepare: async (raw, request, call) => {
      const normalized = await normalizeSelection(raw, request, call)
      const selection = critiqueSelection(normalized, false)
      return selection ? createSfCritiqueInputProducer(bindings(selection, false)).prepare(normalized, request, call)
        : { status: "needs-input", reason: "invalid-analysis-input" }
    },
  }
  const verifier: ReturnType<typeof createSfDecisionCritiqueVerifier> = {
    skillIds: ["sf-contestar-decisao"], verify: async (value, request, call) => {
      const selection = critiqueSelection(value, true)
      return selection ? createSfDecisionCritiqueVerifier(bindings(selection, true)).verify(value, request, call)
        : { status: "needs-input", reason: "invalid-analysis-input" }
    },
  }

  const resolveReviewTarget = async (request: { request: SfAnalysisRequest; skillInput: unknown; runRef: string; authorAnalysis?: unknown }, call: TrustedDomainContext): Promise<PortResult<{
    author?: Author; reviewTarget?: NonNullable<SfNativeRunRecord["reviewTarget"]>
  }>> => {
    const critique = request.request.skillId === "sf-contestar-decisao"
    const evidence = request.request.skillId === "sf-revisar-evidencias"
    if (!critique && !evidence) return request.authorAnalysis === undefined ? { status: "ok", value: {} } : { status: "denied", reason: "review-target-outside-review-skill" }
    if (request.request.profileId !== "sf_reviewer") return { status: "denied", reason: "independent-reviewer-required" }
    const selected = critique ? critiqueSelection(request.skillInput, true) : undefined
    const target = critique ? selected?.author : readSfReviewAuthorSelection(request.authorAnalysis)
    if (!target || critique && request.authorAnalysis !== undefined && !same(target, readSfReviewAuthorSelection(request.authorAnalysis)) || target.runRef === request.runRef)
      return { status: "needs-input", reason: "review-author-selection-required" }
    if (evidence && !decodeSfSkillInput("EvidenceReviewInput", request.skillInput).ok) return { status: "needs-input", reason: "invalid-analysis-input" }
    const effect = selected ? await selectedEffect(selected, true)(request.request.caseRef, call) : undefined
    if (selected && (!effect || effect.status !== "ok")) return unavailable
    const author = effect?.status === "ok" && effect.value.state === "selected"
      ? await readers.readHistoricalAuthor(target.runRef, target.outputDigest, { caseRef: request.request.caseRef, responseRef: effect.value.request.answerRef }, call)
      : await readers.readAuthorForCase(target.runRef, target.outputDigest, request.request.caseRef, call)
    if (author.status !== "ok" || !author.value.run.native || author.value.run.runRef === request.runRef) return unavailable
    if (evidence) {
      const parsed = decodeSfSkillInput("EvidenceReviewInput", request.skillInput)
      const current = await readers.current(request.request.caseRef, call)
      if (!parsed.ok || !current || !parsed.value.claims.length || parsed.value.claims.some((claim) =>
        !current.case.assumptions.some((saved) => saved.id === claim.id && saved.text === claim.text && same(saved.evidenceRefs, claim.evidenceRefs))) ||
        [...parsed.value.businessEvidenceRefs, ...parsed.value.documentEvidence.map((value) => value.ref), ...parsed.value.claims.flatMap((claim) => claim.evidenceRefs)]
          .some((ref) => !current.evidenceRefs.some((allowed) => same(ref, allowed)))) return { status: "unavailable", reason: "review-case-evidence-link-unavailable" }
    }
    return { status: "ok", value: { author: author.value, reviewTarget: { targetRunId: author.value.run.runRef,
      targetSessionId: author.value.run.native.sessionID, targetOutputDigest: author.value.output.outputDigest, caseRef: request.request.caseRef } } }
  }
  return { producer, verifier, answerEffect, resolveReviewTarget }
}
