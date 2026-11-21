import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { verifyAlternativePublication } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { AlternativeCapabilityProvenance } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { createAlternativeReadOnlyReplay } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts"
import type { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfPortfolioVerifier(dependencies: SfAnalysisDependencies & {
  portfolioProof: Pick<ReturnType<typeof createPortfolioProofVerifier>, "replayPortfolio">
  readAlternativeCapture?: (runRef: string, resultDigest: string, call: TrustedDomainContext) => Promise<PortResult<{ run: SfNativeRunRecord; record: AlternativeCapabilityProvenance }>>
  replayAlternative?: ReturnType<typeof createAlternativeReadOnlyReplay>
}): SfAnalysisVerifier {
  const resolveCandidate = createDecisionCandidateResolver(dependencies.cases)
  return {
    skillIds: ["sf-compor-portfolio"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("PortfolioCompositionInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (!value.candidates.length || value.candidates.length !== value.request.candidateRefs.length || digestSfValue(value.constraints) !== digestSfValue(value.request.constraints) || new Set(value.request.candidateRefs).size !== value.request.candidateRefs.length) return { status: "needs-input", reason: "analysis-input-mismatch" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const candidates = await Promise.all(value.candidates.map(async (candidate) => {
          const source = await dependencies.cases.read({ caseRef: encodeCaseRef(candidate.case) }, currentCall)
          if (source.status !== "ok" || source.value.case.version !== candidate.case.version) return undefined
          const alternatives = source.value.case.alternatives.filter((alternative) => {
            const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(candidate.case), caseVersion: candidate.case.version, alternativeId: alternative.id, alternativeVersion: alternative.version })
            return (candidate.alternativeRef === alternative.id || candidate.alternativeRef === ref) && value.request.candidateRefs.includes(ref) && digestSfValue(alternative.result) === digestSfValue(candidate.result)
          })
          if (alternatives.length !== 1) return undefined
          const alternative = alternatives[0]!
          const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(candidate.case), caseVersion: candidate.case.version, alternativeId: alternative.id, alternativeVersion: alternative.version })
          const resolved = await resolveCandidate(ref, currentCall)
          if (resolved.status !== "ok" || resolved.value.caseRef !== encodeCaseRef(candidate.case) || digestSfValue(resolved.value.result) !== digestSfValue(candidate.result)) return undefined
          return { ref, coverageRef: decisionCoverageRef(candidate.case, alternative.id, alternative.version), result: candidate.result }
        }))
        if (candidates.some((candidate) => !candidate)) return undefined
        const selected = candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined)
        if (new Set(selected.map((candidate) => candidate.ref)).size !== selected.length || digestSfValue(selected.map((candidate) => candidate.ref).sort()) !== digestSfValue([...value.request.candidateRefs].sort()) || digestSfValue(selected.map((candidate) => candidate.coverageRef).sort()) !== digestSfValue([...value.costCoverageRefs].sort())) return undefined
        const refs = selected.flatMap((candidate) => [...candidate.result.sourceRefs, ...candidate.result.costCoverage.evaluatedSourceRefs, ...candidate.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]).filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (output.kind === "AlternativeDraft") {
          if (!dependencies.readAlternativeCapture || !dependencies.replayAlternative) return { status: "unavailable", reason: "alternative-capture-unavailable" }
          const capture = await dependencies.readAlternativeCapture(output.runProvenance.runId, digestSfValue(output.payload), currentCall)
          if (capture.status !== "ok" || (capture.value.run.state !== "running" && (capture.value.run.state !== "ready" || capture.value.run.outputRef !== output.id)) || !verifyAlternativePublication(capture.value.record, { ...capture.value.run, state: "ready", outputRef: output.id }, output)) return { status: "unavailable", reason: "alternative-capture-unavailable" }
          const replay = await dependencies.replayAlternative(capture.value.record, currentCall)
          if (replay.status !== "ok" || digestSfValue(replay.value.output) !== digestSfValue(output.payload)) return { status: "unavailable", reason: "analysis-output-unverified" }
          const refs = [...output.payload.proposal.result.sourceRefs, ...output.payload.proposal.result.costCoverage.evaluatedSourceRefs, ...output.payload.proposal.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
          if (refs.some((ref) => !output.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "analysis-output-unverified" }
          const sources = await dependencies.context.context({ refs: output.evidenceRefs }, currentCall)
          if (sources.length !== output.evidenceRefs.length || sources.some((item, index) => item.state !== "fresh" || item.accessRevision !== currentCall.binding.accessRevision || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(output.evidenceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref))) return { status: "unavailable", reason: "analysis-source-unavailable" }
          const again = await dependencies.readAlternativeCapture(output.runProvenance.runId, digestSfValue(output.payload), currentCall)
          if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(capture.value) || !await read(currentCall) || !await dependencies.host.revalidate(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
          return { status: "ok", value: true }
        }
        if (output.kind !== "PortfolioComparison" || digestSfValue(output.evidenceRefs) !== digestSfValue(output.payload.evidenceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (!await dependencies.portfolioProof.replayPortfolio(value.request, output.payload, currentCall) || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
