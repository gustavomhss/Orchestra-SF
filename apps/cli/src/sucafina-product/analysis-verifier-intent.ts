import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createDecisionCasePort } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createSfImportHost } from "../../../../modules/sucafina/Sucafinav1/product/imports/host.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfIntentVerifier(dependencies: SfAnalysisDependencies & {
  replayIntent: ReturnType<typeof createDecisionCasePort>["prepareIntentForCase"]
  imports: Pick<ReturnType<typeof createSfImportHost>, "readPreviewForAnalysis">
  selectedPreviewRef: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ previewRef: string }>>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-enquadrar-decisao"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionIntentInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.intentText !== request.objective || digestSfValue(value.case) !== digestSfValue(request.caseRef))
        return { status: "needs-input", reason: "analysis-input-mismatch" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version ||
          value.context.currency !== current.value.case.currency || digestSfValue(value.context.period) !== digestSfValue(current.value.case.horizon) ||
          value.selectedSourceRefs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) ||
          value.context.sourceRefs.some((source) => source.surface !== value.context.surface || !value.selectedSourceRefs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period?.start === source.period.start && ref.target.period.end === source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field))))) return undefined
        const preview = await (async () => {
          if (!value.importPreview) return null
          const selected = await dependencies.selectedPreviewRef(request.caseRef, currentCall)
          if (selected.status !== "ok" || !selected.value.previewRef.trim()) return undefined
          const result = await dependencies.imports.readPreviewForAnalysis({ previewRef: selected.value.previewRef, request: value.importPreview }, currentCall)
          if (result.status !== "ok") return undefined
          const manifest = result.value.manifest
          if (manifest.id !== selected.value.previewRef || manifest.state !== "preview" || manifest.domainApplied || manifest.receipts.length || manifest.issues.length ||
            manifest.context.installationId !== currentCall.binding.installationId || manifest.context.projectId !== currentCall.binding.projectId || manifest.context.principalRef !== currentCall.binding.principalRef || manifest.context.accessRevision !== currentCall.binding.accessRevision || manifest.context.policyVersion !== currentCall.binding.policyVersion ||
            manifest.context.surface !== value.context.surface || digestSfValue(manifest.context.period) !== digestSfValue(value.context.period) || manifest.context.currency !== value.context.currency ||
            digestSfValue(manifest.context.sourceRefs) !== digestSfValue(value.context.sourceRefs) || digestSfValue(manifest.baseIdentity) !== digestSfValue(value.context.sourceRefs)) return undefined
          return { previewRef: selected.value.previewRef, digest: result.value.digest }
        })()
        if (preview === undefined) return undefined
        const sources = await dependencies.context.context({ refs: value.selectedSourceRefs }, currentCall)
        if (sources.length !== value.selectedSourceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(value.selectedSourceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources, preview }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "IntentFrame" ||
          digestSfValue(output.evidenceRefs) !== digestSfValue(value.selectedSourceRefs) || digestSfValue(output.payload.sourceRefs) !== digestSfValue(value.selectedSourceRefs) ||
          digestSfValue(output.payload.horizon) !== digestSfValue(value.context.period) || output.payload.currency !== value.context.currency || output.payload.gaps.length) return { status: "unavailable", reason: "analysis-output-unverified" }
        const fresh = await read(currentCall)
        if (!fresh) return { status: "unavailable", reason: "analysis-output-unverified" }
        const replay = await dependencies.replayIntent({ objective: output.payload.objective, horizon: output.payload.horizon, currency: output.payload.currency, criteria: output.payload.criteria.map((item) => item.description), sourceRefs: value.selectedSourceRefs }, request.caseRef, currentCall)
        const expected = replay.status === "ok" && fresh.preview ? { ...replay.value, analysisBasis: "import-preview" as const, importPreviewRef: fresh.preview.previewRef } : replay.status === "ok" ? replay.value : undefined
        const latest = value.importPreview ? await read(currentCall) : fresh
        const previewStillCurrent = !!latest && digestSfValue(latest.preview) === digestSfValue(fresh.preview) && digestSfValue(fresh.preview) === digestSfValue(proof.preview)
        return expected && previewStillCurrent && digestSfValue(expected) === digestSfValue(output.payload)
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
