import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfPortfolioVerifier(dependencies: SfAnalysisDependencies & {
  portfolioProof: Pick<ReturnType<typeof createPortfolioProofVerifier>, "replayPortfolio">
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
        if (output.state !== "ready" || output.kind !== "PortfolioComparison" || digestSfValue(output.evidenceRefs) !== digestSfValue(output.payload.evidenceRefs) || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (!await dependencies.portfolioProof.replayPortfolio(value.request, output.payload, currentCall) || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
