import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import { readSfMemorySelection, sfMemoryEvidence, sfMemoryReadIdentity } from "./analysis-memory-evidence.ts"

export function createSfDecisionMemoryVerifier(dependencies: SfAnalysisDependencies & {
  caseRecall: ReturnType<typeof createSfCaseRecall>
  readRecallSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<SfSkillInputMap["DecisionRecallInput"]>>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-consultar-memoria-decisoria"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionRecallInput", input)
      if (!decoded.ok || !decoded.value.query.trim() || decoded.value.query !== request.objective || digestSfValue(decoded.value.currentCase) !== digestSfValue(request.caseRef)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = structuredClone(decoded.value)
      const read = async (currentCall: TrustedDomainContext) => {
        const selection = await dependencies.readRecallSelection(request.caseRef, currentCall)
        if (selection.status !== "ok" || digestSfValue(selection.value) !== digestSfValue(value)) return undefined
        const recalled = await readSfMemorySelection(dependencies, value, currentCall)
        if (!recalled) return undefined
        const again = await dependencies.readRecallSelection(request.caseRef, currentCall)
        return again.status === "ok" && digestSfValue(again.value) === digestSfValue(selection.value) && await dependencies.host.revalidate(currentCall) ? recalled : undefined
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const checked = await read(call)
      if (!checked || digestSfValue(sfMemoryReadIdentity(proof)) !== digestSfValue(sfMemoryReadIdentity(checked))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources,
        promptContext: { decisionRecall: { result: { matches: proof.recalled.matches, limitations: proof.recalled.limitations, accessRevision: proof.recalled.accessRevision },
          sources: proof.sources.map(sfMemoryEvidence) } }, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || (output.kind !== "CaseRecall" && output.kind !== "MatchExplanation")) return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(sfMemoryReadIdentity(current)) !== digestSfValue(sfMemoryReadIdentity(proof))) return { status: "unavailable", reason: "analysis-output-unverified" }
        const final = await read(currentCall)
        if (!final || digestSfValue(sfMemoryReadIdentity(final)) !== digestSfValue(sfMemoryReadIdentity(current))) return { status: "unavailable", reason: "analysis-output-unverified" }
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
