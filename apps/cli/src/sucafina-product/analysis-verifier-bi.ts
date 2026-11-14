import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"

/** The host owns view revisions, selection, projection identities and the persisted table reader. */
export type SfBiSelection = {
  approvedViews: SfSkillInputMap["ContextualBIInput"]["approvedViews"]
  authorizedFilters: SfSkillInputMap["ContextualBIInput"]["authorizedFilters"]
  dashboardSelection: SfSkillInputMap["ContextualBIInput"]["dashboardSelection"]
  projectionRefs: readonly BusinessEvidenceRef[]
  projection: DomainProjection
  viewId: string
  canonicalProjectionRefs: readonly string[]
  tableRef: string
}
export function createSfBiVerifier(dependencies: SfAnalysisDependencies & {
  readBiSelection: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<SfBiSelection>>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-produzir-bi-contextual"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("ContextualBIInput", input)
      if (!decoded.ok || !decoded.value.businessQuestion.trim() || decoded.value.businessQuestion !== request.objective) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const selected = await dependencies.readBiSelection(request.caseRef, currentCall)
        if (selected.status !== "ok") return undefined
        const selection = selected.value
        if (!selection.tableRef.trim() || !selection.canonicalProjectionRefs.length || selection.canonicalProjectionRefs.some((ref) => !ref.trim()) ||
          selection.approvedViews.some((view) => !view.id.trim() || !Number.isSafeInteger(view.version) || view.version < 1 || new Set(view.allowedFilters).size !== view.allowedFilters.length) ||
          !selection.approvedViews.some((view) => view.id === selection.viewId) ||
          selection.authorizedFilters.some((filter) => !selection.approvedViews.some((view) => view.id === selection.viewId && view.allowedFilters.includes(filter.field))) ||
          digestSfValue(selection.approvedViews) !== digestSfValue(value.approvedViews) || digestSfValue(selection.authorizedFilters) !== digestSfValue(value.authorizedFilters) ||
          digestSfValue(selection.dashboardSelection) !== digestSfValue(value.dashboardSelection) || digestSfValue(selection.projectionRefs) !== digestSfValue(value.projectionRefs) ||
          selection.projection.context.installationId !== currentCall.binding.installationId || selection.projection.context.projectId !== currentCall.binding.projectId ||
          selection.projection.context.principalRef !== currentCall.binding.principalRef || selection.projection.context.accessRevision !== currentCall.binding.accessRevision ||
          selection.projection.context.policyVersion !== currentCall.binding.policyVersion || digestSfValue(selection.projection.context.period) !== digestSfValue(selection.dashboardSelection.period) ||
          selection.projection.values.some((item) => (item.value !== null && !item.sourceRefs.length) || item.sourceRefs.some((ref) => !selection.projectionRefs.some((allowed) => digestSfValue(ref) === digestSfValue(allowed))) || (item.drilldown !== null && !selection.projectionRefs.some((allowed) => digestSfValue(item.drilldown) === digestSfValue(allowed))))) return undefined
        const sources = await dependencies.context.context({ refs: selection.projectionRefs }, currentCall)
        if (sources.length !== selection.projectionRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(selection.projectionRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, selection, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "ContextualBIProposal") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(withoutObservationTimes(current.selection)) !== digestSfValue(withoutObservationTimes(proof.selection))) return { status: "unavailable", reason: "analysis-output-unverified" }
        const proposal = output.payload
        if (proposal.approvedViewId !== current.selection.viewId || proposal.tableRef !== current.selection.tableRef || digestSfValue(proposal.canonicalProjectionRefs) !== digestSfValue(current.selection.canonicalProjectionRefs) ||
          digestSfValue(proposal.filters) !== digestSfValue(current.selection.authorizedFilters) || digestSfValue(proposal.sourceRefs) !== digestSfValue(current.selection.projectionRefs) || digestSfValue(output.evidenceRefs) !== digestSfValue(proposal.sourceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
