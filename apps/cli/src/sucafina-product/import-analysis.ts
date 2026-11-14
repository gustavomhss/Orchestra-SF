import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ImportPreviewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ForecastExplainInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfImportHost } from "../../../../modules/sucafina/Sucafinav1/product/imports/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createPlannerImportAnalysis } from "../../../../modules/sucafina/Sucafinav1/product/planner/import-analysis.ts"
import { createSfForecastVerifier, withoutObservationTimes, type SfAnalysisDependencies, type SfAnalysisProof, type SfAnalysisRequest, type SfAnalysisVerifier } from "./analysis-verifier.ts"

type PlannerAnalysis = Parameters<typeof createPlannerImportAnalysis>[0]
type PreviewReader = PlannerAnalysis["readPreview"]

/** Public human selection. It carries the C04 preview request, not a workbook command. */
export type SfImportForecastSelection = {
  caseRef: { id: string; incarnation: string; version: number }
  previewRef: string
  importRequest: ImportPreviewRequest
  period: Period
  currency: string
}

export function createSfImportForecastAnalysis(input: SfAnalysisDependencies & {
  imports: { readPreparedPreviewForAnalysis: PreviewReader } & Pick<ReturnType<typeof createSfImportHost>, "readPreviewForAnalysis">
  issueSource: PlannerAnalysis["issueSource"]
  verifyTarget: PlannerAnalysis["verifyTarget"]
  matchesIntent: (call: TrustedDomainContext, operation: string, inputDigest: string) => Promise<boolean>
  intentOperation: string
}): { prepare: (call: TrustedDomainContext, selection: SfImportForecastSelection) => Promise<PortResult<ForecastExplainInput>>; verifier: SfAnalysisVerifier } {
  const analyze = createPlannerImportAnalysis({
    host: input.host,
    issueSource: input.issueSource,
    verifyTarget: input.verifyTarget,
    readPreview: (selection, call) => input.imports.readPreparedPreviewForAnalysis(selection, call),
  })
  const read = async (selection: SfImportForecastSelection, request: SfAnalysisRequest, call: TrustedDomainContext) => {
    if (call.kind !== "ui" || !await input.host.revalidate(call)) return undefined
    if (selection.caseRef.id !== request.caseRef.id || selection.caseRef.incarnation !== request.caseRef.incarnation || selection.caseRef.version !== request.caseRef.version || !selection.previewRef.trim()) return undefined
    const current = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return undefined
    const preview = await input.imports.readPreviewForAnalysis({ previewRef: selection.previewRef, request: selection.importRequest }, call)
    if (preview.status !== "ok") return undefined
    const replay = await analyze({ previewRef: selection.previewRef, importRequest: selection.importRequest, period: selection.period, currency: selection.currency }, call)
    if (replay.status !== "ok" || replay.value.analysisBasis !== "import-preview" || replay.value.domainApplied !== false || replay.value.importPreviewRef !== selection.previewRef) return undefined
    const refs = replay.value.sourceRefs
    if (!refs.length || refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
    const sources = await input.context.context({ refs }, call)
    const again = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
    const latest = await input.imports.readPreviewForAnalysis({ previewRef: selection.previewRef, request: selection.importRequest }, call)
    if (sources.length !== refs.length || sources.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || latest.status !== "ok" || latest.value.digest !== preview.value.digest || !await input.host.revalidate(call)) return undefined
    return { current: current.value.case, replay: replay.value, sources,
      promptContext: { importPreview: { importPreviewRef: selection.previewRef, manifest: latest.value.manifest, detail: latest.value.detail } } }
  }
  const domain = createSfForecastVerifier(input)
  return {
    prepare: async (call, selection) => {
      const wanted = structuredClone(selection)
      if (call.kind !== "ui" || !await input.matchesIntent(call, input.intentOperation, digestSfValue(wanted))) return { status: "denied", reason: "import-forecast-authority-unavailable" }
      const proof = await read(wanted, { ...selection, profileId: "", profileVersion: "", skillId: "sf-explicar-forecast", skillVersion: "", manifestDigest: "", outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "" }, call)
      if (!proof || !await input.matchesIntent(call, input.intentOperation, digestSfValue(wanted))) return { status: "unavailable", reason: "import-forecast-unavailable" }
      return { status: "ok", value: { forecastComparison: proof.replay, selectedPeriod: wanted.period, currency: wanted.currency, sourceRefs: proof.replay.sourceRefs, registeredReasons: [], importPreview: wanted.importRequest } }
    },
    verifier: {
      skillIds: ["sf-explicar-forecast"],
      verify: async (value, request, call) => {
        const decoded = decodeSfSkillInput("ForecastExplainInput", value)
        if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
        if (!decoded.value.importPreview && decoded.value.forecastComparison.analysisBasis === "domain") return domain.verify(value, request, call)
        const selection = selectionFrom(request, decoded.value)
        if (!selection || decoded.value.registeredReasons.length) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
        const load = async (currentCall: TrustedDomainContext) => {
          const proof = await read(selection, request, currentCall)
          if (!proof || digestSfValue(withoutObservationTimes(proof.replay)) !== digestSfValue(withoutObservationTimes(decoded.value.forecastComparison)) || digestSfValue(decoded.value.sourceRefs) !== digestSfValue(proof.replay.sourceRefs) || digestSfValue(decoded.value.importPreview) !== digestSfValue(selection.importRequest)) return undefined
          return proof
        }
        const proof = await load(call)
        if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
        const accepted: SfAnalysisProof = { current: proof.current, input: decoded.value, sources: proof.sources, promptContext: proof.promptContext, acceptsOutput: async (output, freshCall) => {
          const current = await load(freshCall)
          return current && digestSfValue(current.promptContext) === digestSfValue(proof.promptContext) && output.kind === "FinancialAnalysis" && output.state === "ready" && digestSfValue(output.evidenceRefs) === digestSfValue(current.replay.sourceRefs) && digestSfValue(withoutObservationTimes(output.payload)) === digestSfValue(withoutObservationTimes(current.replay))
            ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
        } }
        return { status: "ok", value: accepted }
      },
    },
  }
}

function selectionFrom(request: SfAnalysisRequest, value: ForecastExplainInput): SfImportForecastSelection | undefined {
  if (!value.importPreview || value.forecastComparison.analysisBasis !== "import-preview" || value.forecastComparison.domainApplied !== false || !value.forecastComparison.importPreviewRef?.trim()) return undefined
  return { caseRef: request.caseRef, previewRef: value.forecastComparison.importPreviewRef, importRequest: value.importPreview, period: value.selectedPeriod, currency: value.currency }
}
