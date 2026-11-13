import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ProductContext, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { DecisionIntentInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfImportHost } from "../../../../modules/sucafina/Sucafinav1/product/imports/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"

export type SfInputProducer = {
  skillIds: readonly string[]
  prepare: (selection: unknown, request: SfAnalysisRequest, call: TrustedDomainContext) => Promise<PortResult<unknown>>
}

export type SfIntentSelectionContext = Pick<ProductContext, "surface" | "period" | "currency" | "sourceRefs">

export type SfIntentInputBindings = {
  readSelectionContext: (
    caseRef: SfAnalysisRequest["caseRef"],
    selection: { readonly evidenceRefIds: readonly string[] },
    call: TrustedDomainContext,
  ) => Promise<PortResult<SfIntentSelectionContext>>
  selectedPreviewRef: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ previewRef: string }>>
  imports: Pick<ReturnType<typeof createSfImportHost>, "readPreviewForAnalysis">
}

type HumanIntentSelection = { readonly evidenceRefIds: readonly string[]; readonly importPreview?: unknown }

function humanIntentSelection(value: unknown): HumanIntentSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.some(([key]) => key !== "evidenceRefIds" && key !== "importPreview")) return undefined
  const ids = entries.find(([key]) => key === "evidenceRefIds")?.[1]
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) return undefined
  const preview = entries.find(([key]) => key === "importPreview")
  return preview ? { evidenceRefIds: ids, importPreview: preview[1] } : { evidenceRefIds: ids }
}

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function recordMatches(source: SourceRef, ref: BusinessEvidenceRef) {
  return ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period?.start === source.period.start && ref.target.period.end === source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field))
}

export function createSfIntentInputProducer(dependencies: SfAnalysisDependencies & SfIntentInputBindings): SfInputProducer {
  return {
    skillIds: ["sf-enquadrar-decisao"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanIntentSelection(selection)
      if (!human || !request.objective.trim() || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const selected = human.evidenceRefIds.flatMap((id) => current.value.evidenceRefs.filter((ref) => ref.refId === id))
      if (selected.length !== human.evidenceRefIds.length || new Set(selected.map((ref) => ref.refDigest)).size !== selected.length) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const sources = await dependencies.context.context({ refs: selected }, call)
      if (sources.length !== selected.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, selected[index]) || !same(item.currentRef, item.ref))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const context = await dependencies.readSelectionContext(request.caseRef, { evidenceRefIds: human.evidenceRefIds }, call)
      if (context.status !== "ok") return context.status === "needs-input" ? context : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const selectedContext = context.value
      if (selectedContext.currency !== current.value.case.currency || !same(selectedContext.period, current.value.case.horizon)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const records = selected.filter((ref) => ref.kind === "record")
      if (selectedContext.sourceRefs.some((source) => source.surface !== selectedContext.surface || !records.some((ref) => recordMatches(source, ref))) || records.some((ref) => !selectedContext.sourceRefs.some((source) => recordMatches(source, ref)))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const parsed = human.importPreview === undefined ? undefined : decodeSfOperationInput("sf_import_preview", human.importPreview)
      if (parsed && !parsed.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const importPreview = parsed?.ok ? parsed.value : undefined
      if (importPreview) {
        const previewRef = await dependencies.selectedPreviewRef(request.caseRef, call)
        if (previewRef.status !== "ok" || !previewRef.value.previewRef.trim()) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
        const preview = await dependencies.imports.readPreviewForAnalysis({ previewRef: previewRef.value.previewRef, request: importPreview }, call)
        if (preview.status !== "ok") return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
        const manifest = preview.value.manifest
        if (manifest.id !== previewRef.value.previewRef || manifest.state !== "preview" || manifest.domainApplied || manifest.receipts.length || manifest.issues.length || manifest.context.installationId !== call.binding.installationId || manifest.context.projectId !== call.binding.projectId || manifest.context.principalRef !== call.binding.principalRef || manifest.context.accessRevision !== call.binding.accessRevision || manifest.context.policyVersion !== call.binding.policyVersion || manifest.context.surface !== selectedContext.surface || !same(manifest.context.period, selectedContext.period) || manifest.context.currency !== selectedContext.currency || !same(manifest.context.sourceRefs, selectedContext.sourceRefs) || !same(manifest.baseIdentity, selectedContext.sourceRefs)) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      }
      const confirmedSources = await dependencies.context.context({ refs: selected }, call)
      if (confirmedSources.length !== selected.length || confirmedSources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, selected[index]) || !same(item.currentRef, item.ref))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const again = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (again.status !== "ok" || again.value.case.version !== current.value.case.version || !await dependencies.host.revalidate(call)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const built: DecisionIntentInput = { intentText: request.objective, context: selectedContext, case: request.caseRef, selectedSourceRefs: selected, ...(importPreview ? { importPreview } : {}) }
      const decoded = decodeSfSkillInput("DecisionIntentInput", built)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
