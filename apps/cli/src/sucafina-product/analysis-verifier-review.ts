import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfConfirmedClaimField, SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { createDashboardRecordEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { readDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createDecisionAnswerEffect } from "../../../../modules/sucafina/Sucafinav1/product/decisions/answer-effect.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"

export function createSfDecisionCritiqueVerifier(dependencies: SfAnalysisDependencies & {
  readAuthorAnalysis: (runRef: string, outputDigest: string, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
  readHistoricalAuthor: (runRef: string, outputDigest: string, selection: { caseRef: SfAnalysisRequest["caseRef"]; responseRef: string }, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
  readAnswerEffectSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ state: "none" } | { state: "selected"; request: Parameters<ReturnType<typeof createDecisionAnswerEffect>>[0] }>>
  answerEffect: ReturnType<typeof createDecisionAnswerEffect>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-contestar-decisao"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionCritiqueInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        if (request.profileId !== "sf_reviewer") return undefined
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version ||
          !value.alternativeRefs.length ||
          value.choiceRefs.some((id) => !current.value.case.choices.some((choice) => choice.id === id && value.alternativeRefs.includes(choice.alternativeId))) ||
          value.alternativeRefs.some((id) => !current.value.case.alternatives.some((alternative) => alternative.id === id)) ||
          value.authorizedEvidenceRefs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const selectedAnswer = await dependencies.readAnswerEffectSelection(request.caseRef, currentCall)
        if (selectedAnswer.status !== "ok") return undefined
        const effect = await (async () => {
          if (selectedAnswer.value.state === "none") return null
          const selection = selectedAnswer.value.request
          if (digestSfValue(selection.caseRef) !== digestSfValue(request.caseRef) || !value.choiceRefs.includes(selection.choiceId) || !value.alternativeRefs.includes(selection.baselineAlternativeId) || !value.alternativeRefs.includes(selection.alternativeId)) return undefined
          const result = await dependencies.answerEffect(selection, currentCall)
          if (result.status !== "ok" || result.value.choiceChanged || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef) || result.value.questionId !== selection.questionId || result.value.answerRef !== selection.answerRef || result.value.originalChoice.id !== selection.choiceId || digestSfValue(result.value.originalChoice) !== result.value.originalChoiceDigest || digestSfValue(result.value.currentComparison) !== result.value.currentComparisonDigest || digestSfValue(result.value.currentComparison) !== digestSfValue(value.comparison) || !value.authorizedEvidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(result.value.answerEvidence))) return undefined
          return result.value
        })()
        if (effect === undefined) return undefined
        const author = effect ? await dependencies.readHistoricalAuthor(value.authorAnalysis.runRef, value.authorAnalysis.outputDigest, { caseRef: request.caseRef, responseRef: effect.answerRef }, currentCall) : await dependencies.readAuthorAnalysis(value.authorAnalysis.runRef, value.authorAnalysis.outputDigest, currentCall)
        if (author.status !== "ok" || author.value.run.state !== "ready" || !author.value.run.native || author.value.run.runRef !== value.authorAnalysis.runRef ||
          author.value.run.outputRef !== author.value.output.id || author.value.output.state !== "ready" ||
          author.value.output.runProvenance.runId !== author.value.run.runRef || author.value.output.runProvenance.nativeSessionId !== author.value.run.native.sessionID ||
          author.value.run.caseRef.id !== request.caseRef.id || author.value.run.caseRef.incarnation !== request.caseRef.incarnation ||
          (effect ? author.value.run.caseRef.version >= request.caseRef.version : author.value.run.caseRef.version !== request.caseRef.version) || digestSfValue(author.value.output.caseRef) !== digestSfValue(author.value.run.caseRef) ||
          author.value.output.outputDigest !== value.authorAnalysis.outputDigest || digestSfContribution(author.value.output) !== value.authorAnalysis.outputDigest) return undefined
        const targetComparison = author.value.output.kind === "ScenarioComparison" ? author.value.output.payload : author.value.output.kind === "FinancialAnalysis" ? author.value.output.payload.comparison : undefined
        if (!targetComparison || digestSfValue(targetComparison) !== digestSfValue(effect ? effect.originalChoice.comparison : value.comparison)) return undefined
        const selected = current.value.case.choices.find((choice) => value.choiceRefs.includes(choice.id) && digestSfValue(choice.comparison) === digestSfValue(effect ? effect.originalChoice.comparison : value.comparison))
        if (value.choiceRefs.length && !selected) return undefined
        const comparisonRequest = effect ? effect.currentRequest : { scenarioRefs: [value.comparison.baselineResultRef, value.comparison.alternativeResultRef], criteria: selected?.criteria ?? value.comparison.criterionResults.map((criterion) => criterion.criterionId) }
        const replay = await dependencies.planner.compareScenarios(comparisonRequest, currentCall)
        if (replay.status !== "ok" || digestSfValue(replay.value) !== digestSfValue(value.comparison) || (effect && digestSfValue(effect.originalChoice.comparison) === digestSfValue(effect.currentComparison))) return undefined
        const sources = await dependencies.context.context({ refs: value.authorizedEvidenceRefs }, currentCall)
        if (sources.length !== value.authorizedEvidenceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(value.authorizedEvidenceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        const missing = [
          ...current.value.case.alternatives.filter((alternative) => value.alternativeRefs.includes(alternative.id)).flatMap((alternative) => alternative.result.costCoverage.derivedMissingCategoryIds),
          ...(effect ? [] : current.value.case.choices.filter((choice) => value.choiceRefs.includes(choice.id)).flatMap((choice) => choice.costCoverage.derivedMissingCategoryIds)),
        ]
        if (missing.length && replay.value.comparisonStatus === "complete") return undefined
        return { current: current.value.case, sources, missing, author: author.value, effect }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const current = await read(currentCall)
        if (!current || digestSfValue(current.effect) !== digestSfValue(proof.effect) || output.state !== "ready" || output.kind !== "CritiqueReport") return { status: "unavailable", reason: "analysis-output-unverified" }
        const report = output.payload
        if (report.targetRunId !== value.authorAnalysis.runRef || report.targetOutputDigest !== value.authorAnalysis.outputDigest ||
          report.reviewerRunId !== output.runProvenance.runId || report.reviewerSessionId !== output.runProvenance.nativeSessionId ||
          report.reviewerRunId === current.author.run.runRef || report.reviewerSessionId === current.author.run.native?.sessionID ||
          output.runProvenance.targetRunId !== value.authorAnalysis.runRef || output.runProvenance.targetOutputDigest !== value.authorAnalysis.outputDigest ||
          output.runProvenance.reviewerRunId !== output.runProvenance.runId || output.runProvenance.profileId !== "sf_reviewer" || output.runProvenance.skillId !== "sf-contestar-decisao" || !output.runProvenance.loadedMessageId || !output.runProvenance.sourceDigest || !output.runProvenance.instructionsDigest ||
          (current.effect && !output.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(current.effect!.answerEvidence))) ||
          digestSfValue(output.evidenceRefs) !== digestSfValue(report.evidenceRefs) ||
          report.claimIssues.some((issue) => !issue.claimRef.trim() || !issue.reason.trim() || issue.kind === "access-unavailable" || (issue.kind === "missing-category" ? !current.missing.includes(issue.claimRef) : !issue.evidenceRefs.length)) ||
          report.unresolvedConditions.some((condition) => !condition.reason.trim() || (!current.missing.includes(condition.category) && !condition.evidenceRefs.length)) ||
          [...output.evidenceRefs, ...report.claimIssues.flatMap((issue) => issue.evidenceRefs), ...report.unresolvedConditions.flatMap((condition) => condition.evidenceRefs)].some((ref) => !value.authorizedEvidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) ||
          current.missing.some((category) => !report.unresolvedConditions.some((condition) => condition.category === category) && !report.claimIssues.some((issue) => issue.kind === "missing-category" && issue.claimRef === category))) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}

export function createSfEvidenceReviewVerifier(dependencies: SfAnalysisDependencies & {
  documentHost: DocumentEvidenceHost
  readCurrentClaimBindings?: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<readonly SfConfirmedClaimField[]>>
  dashboardRecord?: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "read">
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-revisar-evidencias"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("EvidenceReviewInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version || value.claims.some((claim) => !current.value.case.assumptions.some((item) => item.id === claim.id && item.text === claim.text && digestSfValue(item.evidenceRefs) === digestSfValue(claim.evidenceRefs)))) return undefined
        const refs = [...value.businessEvidenceRefs, ...value.documentEvidence.map((item) => item.ref), ...value.claims.flatMap((item) => item.evidenceRefs)]
          .filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        if (refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) || value.currentSourceRevisions.length !== refs.length || new Set(value.currentSourceRevisions.map((entry) => digestSfValue(entry.ref))).size !== refs.length || value.currentSourceRevisions.some((entry) => !refs.some((ref) => digestSfValue(ref) === digestSfValue(entry.ref)) || (entry.ref.kind === "record" ? entry.incarnation !== entry.ref.target.incarnation || entry.version !== entry.ref.target.version : entry.ref.kind === "document" ? entry.incarnation !== entry.ref.target.incarnation || entry.version !== entry.ref.target.revision : true))) return undefined
        const documents = await Promise.all(value.documentEvidence.map((item) => readDocumentEvidence(item.id, currentCall, { state: dependencies.documentHost.state, documents: dependencies.documentHost.documents, requestFor: dependencies.documentHost.host.requestFor, revalidate: dependencies.documentHost.host.revalidate })))
        if (documents.some((item, index) => item.status !== "ok" || digestSfValue(item.value.evidence) !== digestSfValue(value.documentEvidence[index]))) return undefined
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || item.accessRevision !== currentCall.binding.accessRevision || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "ClaimIssue" || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        const issue = output.payload
        if (output.runProvenance.profileId !== "sf_reviewer" || output.runProvenance.skillId !== "sf-revisar-evidencias" || !output.runProvenance.loadedMessageId || !output.runProvenance.sourceDigest) return { status: "unavailable", reason: "analysis-output-unverified" }
        const claim = value.claims.find((item) => item.id === issue.claimRef)
        if (claim && !claim.evidenceRefs.length && issue.kind === "unsupported" && !!issue.reason.trim() && !issue.evidenceRefs.length && !output.evidenceRefs.length) return { status: "ok", value: true }
        if (claim && issue.kind === "contradiction" && issue.reason.trim() && dependencies.readCurrentClaimBindings && dependencies.dashboardRecord && await verifyClaimContradiction({ ...dependencies, readCurrentClaimBindings: dependencies.readCurrentClaimBindings, dashboardRecord: dependencies.dashboardRecord }, request.caseRef, claim, issue.evidenceRefs, currentCall) && digestSfValue(output.evidenceRefs) === digestSfValue(issue.evidenceRefs) && await read(currentCall)) return { status: "ok", value: true }
        return { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}

async function verifyClaimContradiction(dependencies: SfAnalysisDependencies & {
  readCurrentClaimBindings: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<readonly SfConfirmedClaimField[]>>
  dashboardRecord: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "read">
}, caseRef: SfAnalysisRequest["caseRef"], claim: { id: string; evidenceRefs: readonly BusinessEvidenceRef[] }, refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) {
  if (refs.length !== 2 || refs.some((ref) => ref.kind !== "record" || !claim.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) || digestSfValue(refs[0]) === digestSfValue(refs[1])) return false
  const bindings = await dependencies.readCurrentClaimBindings(caseRef, call)
  if (bindings.status !== "ok") return false
  const selected = refs.map((ref) => bindings.value.filter((binding) => binding.claimRef === claim.id && digestSfValue(binding.caseRef) === digestSfValue(caseRef) && digestSfValue(binding.sourceRef) === digestSfValue(ref) && binding.id.trim() && binding.incarnation.trim() && Number.isSafeInteger(binding.version) && binding.version > 0 && Number.isFinite(Date.parse(binding.confirmedAt)) && binding.confirmedBy.trim() && binding.accessRevision === call.binding.accessRevision && binding.policyVersion === call.binding.policyVersion))
  if (selected.some((items) => items.length !== 1)) return false
  const left = selected[0]![0]!
  const right = selected[1]![0]!
  if (left.id === right.id || !left.fieldKey || left.fieldKey !== right.fieldKey || !left.period || !right.period || digestSfValue(left.period) !== digestSfValue(right.period) || left.unit !== right.unit || left.value === null || right.value === null || typeof left.value !== typeof right.value || digestSfValue(left.value) === digestSfValue(right.value)) return false
  const valid = await Promise.all([left, right].map(async (binding) => {
    const ref = binding.sourceRef
    if (ref.kind !== "record" || !ref.target.fields.includes(binding.fieldKey) || digestSfValue(ref.target.period) !== digestSfValue(binding.period)) return false
    const opened = await dependencies.dashboardRecord.read(ref.refId, call)
    const again = await dependencies.dashboardRecord.read(ref.refId, call)
    if (opened.status !== "ok" || again.status !== "ok" || opened.value.version !== ref.target.version || digestSfValue(withoutObservationTimes(opened.value)) !== digestSfValue(withoutObservationTimes(again.value))) return false
    const values = opened.value.values.filter((item) => item.id === `${ref.target.recordType}:${encodeURIComponent(ref.target.recordId)}:${encodeURIComponent(binding.fieldKey)}`)
    if (values.length !== 1) return false
    const value = values[0]!
    return value.evidenceState === "confirmed" && value.currency === undefined && value.unit === binding.unit && digestSfValue(value.period) === digestSfValue(binding.period) && digestSfValue(value.value) === digestSfValue(binding.value) && digestSfValue(value.sourceRefs) === digestSfValue([ref]) && digestSfValue(value.drilldown) === digestSfValue(ref)
  }))
  if (valid.some((item) => !item)) return false
  const again = await dependencies.readCurrentClaimBindings(caseRef, call)
  return again.status === "ok" && digestSfValue(again.value) === digestSfValue(bindings.value) && await dependencies.host.revalidate(call)
}
