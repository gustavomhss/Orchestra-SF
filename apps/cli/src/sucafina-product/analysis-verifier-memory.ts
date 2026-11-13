import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfDecisionMemoryVerifier(dependencies: SfAnalysisDependencies & {
  caseRecall: ReturnType<typeof createSfCaseRecall>
  readRecallSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<SfSkillInputMap["DecisionRecallInput"]>>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-consultar-memoria-decisoria"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionRecallInput", input)
      if (!decoded.ok || !decoded.value.query.trim() || decoded.value.query !== request.objective || digestSfValue(decoded.value.currentCase) !== digestSfValue(request.caseRef)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const selection = await dependencies.readRecallSelection(request.caseRef, currentCall)
        if (selection.status !== "ok" || digestSfValue(selection.value) !== digestSfValue(value)) return undefined
        const recalled = await dependencies.caseRecall({ caseRef: request.caseRef, limit: 50, scope: { query: value.query, recallScope: value.recallScope } }, currentCall)
        if (recalled.status !== "ok" || recalled.accessRevision !== currentCall.binding.accessRevision || recalled.matches.some((match) => !value.recallScope.cases.some((ref) => digestSfValue(ref) === digestSfValue(match.caseRef)))) return undefined
        const refs = recalled.matches.flatMap((match) => match.evidenceRefs).filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, recalled, sources, refs }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || (output.kind !== "CaseRecall" && output.kind !== "MatchExplanation")) return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(current.recalled) !== digestSfValue(proof.recalled)) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (output.kind === "CaseRecall") {
          const expected = { matches: current.recalled.matches, limitations: current.recalled.limitations, accessRevision: current.recalled.accessRevision }
          return digestSfValue(output.payload) === digestSfValue(expected) && digestSfValue(output.evidenceRefs) === digestSfValue(current.refs)
            ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
        }
        const explanation = output.payload
        const match = current.recalled.matches.find((item) => digestSfValue(item.explanation) === digestSfValue(explanation))
        return match && digestSfValue(output.evidenceRefs) === digestSfValue(match.evidenceRefs)
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
