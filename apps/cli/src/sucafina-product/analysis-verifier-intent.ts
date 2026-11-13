import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { DecisionCasePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfIntentVerifier(dependencies: SfAnalysisDependencies & { replayIntent: DecisionCasePort["prepareIntent"] }): SfAnalysisVerifier {
  return {
    skillIds: ["sf-enquadrar-decisao"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionIntentInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.importPreview) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      if (value.intentText !== request.objective || digestSfValue(value.case) !== digestSfValue(request.caseRef))
        return { status: "needs-input", reason: "analysis-input-mismatch" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version ||
          value.context.currency !== current.value.case.currency || digestSfValue(value.context.period) !== digestSfValue(current.value.case.horizon) ||
          value.selectedSourceRefs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) ||
          value.context.sourceRefs.some((source) => source.surface !== value.context.surface || !value.selectedSourceRefs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period?.start === source.period.start && ref.target.period.end === source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field))))) return undefined
        const sources = await dependencies.context.context({ refs: value.selectedSourceRefs }, currentCall)
        if (sources.length !== value.selectedSourceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(value.selectedSourceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "IntentFrame" || !await read(currentCall) ||
          digestSfValue(output.evidenceRefs) !== digestSfValue(value.selectedSourceRefs) || digestSfValue(output.payload.sourceRefs) !== digestSfValue(value.selectedSourceRefs) ||
          digestSfValue(output.payload.horizon) !== digestSfValue(value.context.period) || output.payload.currency !== value.context.currency || output.payload.gaps.length) return { status: "unavailable", reason: "analysis-output-unverified" }
        const replay = await dependencies.replayIntent({ objective: output.payload.objective, horizon: output.payload.horizon, currency: output.payload.currency, criteria: output.payload.criteria.map((item) => item.description), sourceRefs: value.selectedSourceRefs }, currentCall)
        return replay.status === "ok" && digestSfValue(replay.value) === digestSfValue(output.payload) && await read(currentCall)
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
