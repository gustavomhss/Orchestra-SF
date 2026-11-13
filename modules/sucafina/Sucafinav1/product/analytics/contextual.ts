import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfSkillInputMap } from "../contracts/skill-inputs.ts"
import type { SfBiArtifact } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { createApprovedCatalog } from "./approved-catalog.ts"
import type { ApprovedSelection, ApprovedView } from "./approved-catalog.ts"

export type ContextualBiArtifacts = {
  dashboardSelection: SfSkillInputMap["ContextualBIInput"]["dashboardSelection"]
  projectionRefs: readonly BusinessEvidenceRef[]
  projection: DomainProjection
  canonicalProjectionRefs: readonly string[]
  tableRef: string
}

/** The host owns the human choice and verifies that every returned artifact remains openable. */
export function createContextualBiSelectionReader(input: {
  approvedViews: readonly ApprovedView[]
  readHumanSelection: (caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => Promise<PortResult<ApprovedSelection>>
  readArtifacts: (selection: ApprovedSelection, context: TrustedDomainContext) => Promise<PortResult<ContextualBiArtifacts>>
  verifyArtifacts: (caseRef: { id: string; incarnation: string; version: number }, selection: ApprovedSelection, artifacts: ContextualBiArtifacts, context: TrustedDomainContext) => Promise<boolean>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  const catalog = createApprovedCatalog(input.approvedViews)
  return async (caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
    if (!caseRef.id.trim() || !caseRef.incarnation.trim() || !Number.isSafeInteger(caseRef.version) || caseRef.version < 1 || !await input.revalidate(context)) return { status: "denied", reason: "context-unavailable" } as const
    const selected = await input.readHumanSelection(caseRef, context)
    if (selected.status !== "ok") return selected
    const selection = structuredClone(selected.value)
    const state: { artifacts?: ContextualBiArtifacts } = {}
    const resolved = await catalog.resolve(selection, context, {
      revalidate: input.revalidate,
      resolve: async (current, binding) => {
        const result = await input.readArtifacts(current, binding)
        if (result.status !== "ok") return null
        state.artifacts = structuredClone(result.value)
        return { projectionRefs: state.artifacts.canonicalProjectionRefs, tableRef: state.artifacts.tableRef }
      },
    })
    const artifacts = state.artifacts
    if (!resolved || !artifacts) return { status: "unavailable", reason: "bi-selection-unavailable" } as const
    const dashboardSelection = decodeSfOperationInput("sf_dashboard_read", artifacts.dashboardSelection)
    if (!dashboardSelection.ok) return { status: "unavailable", reason: "bi-dashboard-selection-invalid" } as const
    const decoded = decodeSfOperationOutput("sf_bi_view", artifacts.projection)
    if (!decoded.ok) return { status: "unavailable", reason: "bi-projection-invalid" } as const
    const projection = decoded.value
    if (projection.context.installationId !== context.binding.installationId || projection.context.projectId !== context.binding.projectId || projection.context.principalRef !== context.binding.principalRef || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion || !artifacts.dashboardSelection.selectionRef.trim() || digestSfValue(projection.context.period) !== digestSfValue(artifacts.dashboardSelection.period)) return { status: "denied", reason: "bi-context-mismatch" } as const
    const refs = new Set(artifacts.projectionRefs.map(digestSfValue))
    if (!refs.size || artifacts.projectionRefs.length !== refs.size || projection.values.some((value) => (value.value !== null && !value.sourceRefs.length) || value.sourceRefs.some((reference) => !refs.has(digestSfValue(reference))) || (value.drilldown && !refs.has(digestSfValue(value.drilldown))))) return { status: "unavailable", reason: "bi-evidence-unavailable" } as const
    const revision = digestSfValue({ caseRef, selection, artifacts })
    if (!await input.verifyArtifacts(caseRef, selection, artifacts, context) || !await input.revalidate(context) || revision !== digestSfValue({ caseRef, selection, artifacts })) return { status: "denied", reason: "bi-artifacts-unavailable" } as const
    return { status: "ok", value: { approvedViews: catalog.views.map((view) => ({ ...view, allowedFilters: [...view.allowedFilters] })), authorizedFilters: selection.filters, dashboardSelection: structuredClone(dashboardSelection.value), projectionRefs: artifacts.projectionRefs, projection, viewId: resolved.viewId, canonicalProjectionRefs: artifacts.canonicalProjectionRefs, tableRef: artifacts.tableRef } } as const
  }
}

/** The references come from the host's human selection, never from an AI request. */
export function createStoredContextualBiSelectionReader(input: {
  approvedViews: readonly ApprovedView[]
  readHumanChoice: (caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => Promise<PortResult<{ selection: ApprovedSelection; projectionRef: string; tableRef: string }>>
  readArtifact: (reference: string, context: TrustedDomainContext) => Promise<PortResult<SfBiArtifact>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
    if (!await input.revalidate(context)) return { status: "denied", reason: "context-unavailable" } as const
    const selected = await input.readHumanChoice(caseRef, context)
    if (selected.status !== "ok") return selected
    const choice = structuredClone(selected.value)
    if (!choice.projectionRef.trim() || !choice.tableRef.trim() || choice.projectionRef === choice.tableRef) return { status: "unavailable", reason: "bi-artifact-reference-unavailable" } as const
    const open = async (selection: ApprovedSelection, binding: TrustedDomainContext) => {
      const projection = await input.readArtifact(choice.projectionRef, binding)
      if (projection.status !== "ok") return projection
      const table = await input.readArtifact(choice.tableRef, binding)
      if (table.status !== "ok") return table
      const artifact = projection.value
      if (digestSfValue(artifact) !== digestSfValue(table.value) || digestSfValue(artifact.caseRef) !== digestSfValue(caseRef) || digestSfValue(artifact.selection) !== digestSfValue(selection) || artifact.projectionRef !== choice.projectionRef || artifact.tableRef !== choice.tableRef) return { status: "stale", reason: "bi-artifact-mismatch" } as const
      return { status: "ok", value: { dashboardSelection: artifact.dashboardSelection, projectionRefs: artifact.projectionRefs, projection: artifact.projection, canonicalProjectionRefs: [artifact.projectionRef], tableRef: artifact.tableRef } } as const
    }
    return createContextualBiSelectionReader({
      approvedViews: input.approvedViews,
      readHumanSelection: async () => ({ status: "ok", value: choice.selection }),
      readArtifacts: open,
      verifyArtifacts: async (_caseRef, selection, artifacts, binding) => {
        const current = await open(selection, binding)
        const latestChoice = await input.readHumanChoice(caseRef, binding)
        return current.status === "ok" && latestChoice.status === "ok" && digestSfValue(latestChoice.value) === digestSfValue(choice) && digestSfValue(current.value) === digestSfValue(artifacts)
      },
      revalidate: input.revalidate,
    })(caseRef, context)
  }
}
