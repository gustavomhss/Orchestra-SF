import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { readDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfDecisionCritiqueVerifier(dependencies: SfAnalysisDependencies & {
  readAuthorAnalysis: (runRef: string, outputDigest: string, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; output: ContributionEnvelope }>>
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
          !current.value.case.choices.some((choice) => value.choiceRefs.includes(choice.id) && digestSfValue(choice.comparison) === digestSfValue(value.comparison)) ||
          (!value.choiceRefs.length || !value.alternativeRefs.length) ||
          value.choiceRefs.some((id) => !current.value.case.choices.some((choice) => choice.id === id && value.alternativeRefs.includes(choice.alternativeId))) ||
          value.alternativeRefs.some((id) => !current.value.case.alternatives.some((alternative) => alternative.id === id)) ||
          value.authorizedEvidenceRefs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const selected = current.value.case.choices.find((choice) => value.choiceRefs.includes(choice.id) && digestSfValue(choice.comparison) === digestSfValue(value.comparison))
        if (!selected) return undefined
        const replay = await dependencies.planner.compareScenarios({ scenarioRefs: [value.comparison.baselineResultRef, value.comparison.alternativeResultRef], criteria: selected.criteria }, currentCall)
        if (replay.status !== "ok" || digestSfValue(replay.value) !== digestSfValue(value.comparison)) return undefined
        const author = await dependencies.readAuthorAnalysis(value.authorAnalysis.runRef, value.authorAnalysis.outputDigest, currentCall)
        if (author.status !== "ok" || author.value.run.state !== "ready" || !author.value.run.native || author.value.run.runRef !== value.authorAnalysis.runRef ||
          author.value.run.outputRef !== author.value.output.id || author.value.output.state !== "ready" ||
          author.value.output.runProvenance.runId !== author.value.run.runRef || author.value.output.runProvenance.nativeSessionId !== author.value.run.native.sessionID ||
          digestSfValue(author.value.run.caseRef) !== digestSfValue(request.caseRef) || digestSfValue(author.value.output.caseRef) !== digestSfValue(request.caseRef) ||
          author.value.output.outputDigest !== value.authorAnalysis.outputDigest || digestSfContribution(author.value.output) !== value.authorAnalysis.outputDigest) return undefined
        const sources = await dependencies.context.context({ refs: value.authorizedEvidenceRefs }, currentCall)
        if (sources.length !== value.authorizedEvidenceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(value.authorizedEvidenceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        const missing = [
          ...current.value.case.alternatives.filter((alternative) => value.alternativeRefs.includes(alternative.id)).flatMap((alternative) => alternative.result.costCoverage.derivedMissingCategoryIds),
          ...current.value.case.choices.filter((choice) => value.choiceRefs.includes(choice.id)).flatMap((choice) => choice.costCoverage.derivedMissingCategoryIds),
        ]
        return { current: current.value.case, sources, missing, author: author.value }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const current = await read(currentCall)
        if (!current || output.state !== "ready" || output.kind !== "CritiqueReport") return { status: "unavailable", reason: "analysis-output-unverified" }
        const report = output.payload
        if (report.targetRunId !== value.authorAnalysis.runRef || report.targetOutputDigest !== value.authorAnalysis.outputDigest ||
          report.reviewerRunId !== output.runProvenance.runId || report.reviewerSessionId !== output.runProvenance.nativeSessionId ||
          report.reviewerRunId === current.author.run.runRef || report.reviewerSessionId === current.author.run.native?.sessionID ||
          output.runProvenance.targetRunId !== value.authorAnalysis.runRef || output.runProvenance.targetOutputDigest !== value.authorAnalysis.outputDigest ||
          output.runProvenance.reviewerRunId !== output.runProvenance.runId || output.runProvenance.profileId !== "sf_reviewer" ||
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

export function createSfEvidenceReviewVerifier(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost }): SfAnalysisVerifier {
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
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "ClaimIssue" || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        const issue = output.payload
        const claim = value.claims.find((item) => item.id === issue.claimRef)
        return claim && !claim.evidenceRefs.length && issue.kind === "unsupported" && !!issue.reason.trim() && !issue.evidenceRefs.length && !output.evidenceRefs.length
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
