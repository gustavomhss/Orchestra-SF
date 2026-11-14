import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfBiArtifact } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfBiArtifactStore } from "../../../../modules/sucafina/Sucafinav1/product/analytics/artifact-store.ts"
import { createStoredContextualBiSelectionReader } from "../../../../modules/sucafina/Sucafinav1/product/analytics/contextual.ts"
import { createApprovedCatalog } from "../../../../modules/sucafina/Sucafinav1/product/analytics/approved-catalog.ts"
import type { ApprovedView } from "../../../../modules/sucafina/Sucafinav1/product/analytics/approved-catalog.ts"
import { resolveDashboardBiSelection } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfWorkspaceServices } from "./workspace-services.ts"
import type { createSfAnalysisSelectionScope } from "./analysis-selection-scope.ts"
import type { SfAnalysisPreparation } from "./analysis-services.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"

/** These three installed Dashboard producers accept an exact period, with no other filter semantics. */
export const sfAnalysisApprovedBiViews: readonly ApprovedView[] = ["BI01", "BI07", "BI08"].map((id) => ({ id, version: 1, allowedFilters: ["period"] }))

export function createSfAnalysisBiBindings(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  workspace: ReturnType<typeof createSfWorkspaceServices>
  selection: ReturnType<typeof createSfAnalysisSelectionScope>["read"]
}) {
  const host = input.authority.host
  const catalog = createApprovedCatalog(sfAnalysisApprovedBiViews)
  const mutations = new WeakMap<TrustedDomainContext, { incoming: SfAnalysisPreparation; mutation: { expectedStorageVersion: number; idempotencyKey: string } }>()
  const fence = async (call: TrustedDomainContext) => {
    const value = await input.business.readSourceFences(call)
    return value ? digestSfValue(value) : undefined
  }
  const lockedFence = () => {
    const value = input.business.lockedSourceFences()
    return value ? digestSfValue(value) : undefined
  }
  const produce: Parameters<typeof createSfBiArtifactStore>[0]["produce"] = async (selection, call) => {
    const route = resolveDashboardBiSelection(selection.selection.viewId, selection.dashboardSelection.period)
    if (!route || !validFilters(selection.selection.filters, selection.dashboardSelection.period) || !same(selection.dashboardSelection.fields, route.fields) ||
      !same(selection.period, selection.dashboardSelection.period) || !catalog.views.some((view) => view.id === selection.selection.viewId && view.version === selection.selection.version)) return { status: "unavailable", reason: "bi-analysis-selection-unavailable" }
    const before = await fence(call)
    const current = await input.business.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
    const source = await input.business.dashboardSources.resolveDashboardSource(selection.dashboardSelection.selectionRef, call)
    if (!before || current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, selection.caseRef) ||
      source.status !== "ok" || source.value.evidence.target.recordId !== route.page || !same(source.value.evidence.target.period, selection.period)) return { status: "unavailable", reason: "bi-analysis-source-unavailable" }
    const request = { viewId: selection.selection.viewId, selectionRef: selection.dashboardSelection.selectionRef, period: selection.period }
    const projection = await input.workspace.bi.source.read(request, call)
    if (projection.status !== "ok") return projection
    const presentation = await input.workspace.bi.source.describe(request, call, structuredClone(projection.value))
    if (presentation.status !== "ok") return presentation
    const refs = projection.value.values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])])
      .filter((ref, index, all) => all.findIndex((candidate) => same(candidate, ref)) === index)
    const sourceRefs = [source.value.evidence, ...refs].filter((ref, index, all) => all.findIndex((candidate) => same(candidate, ref)) === index)
    if (!refs.length || !projection.value.context.sourceRefs.length || sourceRefs.some((ref) => !current.value.evidenceRefs.some((allowed) => same(allowed, ref)))) return { status: "unavailable", reason: "bi-analysis-case-evidence-unavailable" }
    const resolutions = await input.business.context.context({ refs: sourceRefs }, call)
    const again = await input.business.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
    if (resolutions.length !== sourceRefs.length || resolutions.some((value, index) => value.state !== "fresh" || !value.authorizedProjection || !value.currentRef || !same(value.ref, sourceRefs[index]) || !same(value.currentRef, value.ref)) ||
      again.status !== "ok" || !same(again.value.case, current.value.case) || before !== await fence(call) || !await input.workspace.bi.source.revalidate(request, call, projection.value) || !await host.revalidate(call)) return { status: "unavailable", reason: "bi-analysis-source-changed" }
    return { status: "ok", value: { projection: projection.value, presentation: presentation.value, projectionRefs: refs, sourceRefs, sourceFenceDigest: before } }
  }
  const verifyCurrent = async (artifact: SfBiArtifact, call: TrustedDomainContext) => {
    if (!same(artifact.binding, { installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion })) return false
    const current = await produce(artifact, call)
    return current.status === "ok" && artifact.sourceFenceDigest === current.value.sourceFenceDigest && same(withoutObservationTimes(artifact.projection), withoutObservationTimes(current.value.projection)) &&
      same(artifact.presentation, current.value.presentation) && same(artifact.projectionRefs, current.value.projectionRefs) && same(withoutObservationTimes(artifact.sourceRefs), withoutObservationTimes(current.value.sourceRefs)) && await host.revalidate(call)
  }
  const store = createSfBiArtifactStore({ host, state: input.authority.state, produce, verifyCurrent,
    readLockedFence: lockedFence, operationIdentity: input.business.operationIdentity, now: () => new Date().toISOString(),
    authorizeSelection: async (selection, mutation, call) => {
      const pending = mutations.get(call)
      const human = pending && parseSelection(pending.incoming.selection)
      // This callback is also used under the store lock; private admission revalidation opens no nested state transaction.
      return call.kind === "ui" && !!pending && !!human && same(pending.mutation, mutation) && same(pending.incoming.request.caseRef, selection.caseRef) && same(selection.selection, human.selection) &&
        same(selection.dashboardSelection, human.dashboardSelection) && same(selection.period, human.dashboardSelection.period) &&
        await input.authority.human.authorize(call, "analysis.prepare", pending.incoming) && await host.revalidate(call)
    },
    verifyLocked: async (artifact, call, snapshot) => {
      const selected = object(object(object(snapshot.data.__sfProductV1).cases)[artifact.caseRef.id])
      return artifact.sourceFenceDigest === lockedFence() && selected.id === artifact.caseRef.id && selected.incarnation === artifact.caseRef.incarnation && selected.version === artifact.caseRef.version &&
        Array.isArray(selected.participants) && selected.participants.includes(call.binding.principalRef) && artifact.binding.installationId === call.binding.installationId && artifact.binding.projectId === call.binding.projectId &&
        artifact.binding.principalRef === call.binding.principalRef && artifact.binding.accessRevision === call.binding.accessRevision && artifact.binding.policyVersion === call.binding.policyVersion &&
        artifact.projectionDigest === digestSfValue(artifact.projection) && artifact.tableDigest === digestSfValue({ rows: artifact.rows, period: artifact.period, presentation: artifact.presentation }) && await host.revalidate(call)
    } })
  const biSelection = createStoredContextualBiSelectionReader({ approvedViews: sfAnalysisApprovedBiViews, readArtifact: store.read, revalidate: host.revalidate,
    readHumanChoice: async (caseRef, call) => {
      const selected = await input.selection(caseRef, "sf-produzir-bi-contextual", call)
      if (selected.status !== "ok") return selected
      const human = parseSelection(selected.value.selection)
      const projectionRef = selected.value.material.projectionRef
      const tableRef = selected.value.material.tableRef
      return human && typeof projectionRef === "string" && typeof tableRef === "string" && projectionRef.trim() && tableRef.trim()
        ? { status: "ok", value: { selection: human.selection, projectionRef, tableRef } } : { status: "unavailable", reason: "bi-analysis-artifact-selection-unavailable" }
    } })
  return { binding: { biSelection }, artifacts: store,
    prepare: async (incoming: SfAnalysisPreparation, call: TrustedUiContext): Promise<PortResult<Readonly<Record<string, unknown>>>> => {
      const human = parseSelection(incoming.selection)
      const source = host.requestFor(call)
      if (!human || !source || !await input.authority.human.authorize(call, "analysis.prepare", incoming)) return { status: "needs-input", reason: "bi-analysis-selection-invalid" }
      const version = await input.authority.state.read(source, "bi-artifacts", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
        ? { count: Object.keys(state.biArtifacts ?? {}).length, existing: Object.values(state.biArtifacts ?? {}).filter((artifact) => same(artifact.caseRef, incoming.request.caseRef) && same(artifact.selection, human.selection) && same(artifact.dashboardSelection, human.dashboardSelection) &&
          artifact.binding.installationId === call.binding.installationId && artifact.binding.projectId === call.binding.projectId && artifact.binding.principalRef === actor.principalRef && artifact.binding.accessRevision === actor.accessRevision && artifact.binding.policyVersion === actor.policyVersion).map((artifact) => ({ projectionRef: artifact.projectionRef, tableRef: artifact.tableRef })) } : undefined)
      if (version.status !== "ok" || !version.value) return { status: "unavailable", reason: "bi-artifact-storage-unavailable" }
      if (version.value.existing.length > 1) return { status: "unavailable", reason: "bi-artifact-selection-ambiguous" }
      const existing = version.value.existing[0]
      if (existing) {
        const current = await store.read(existing.projectionRef, call)
        return current.status === "ok" && current.value.tableRef === existing.tableRef && await input.authority.human.authorize(call, "analysis.prepare", incoming)
          ? { status: "ok", value: existing } : { status: "unavailable", reason: "bi-artifact-selection-stale" }
      }
      if (version.value.count >= 1024) return { status: "unavailable", reason: "bi-artifact-capacity" }
      const mutation = { expectedStorageVersion: version.storageVersion, idempotencyKey: `analysis-bi:${digestSfValue(incoming)}` }
      mutations.set(call, { incoming: structuredClone(incoming), mutation })
      try {
        return await store.save({ caseRef: incoming.request.caseRef, selection: human.selection, dashboardSelection: human.dashboardSelection, period: human.dashboardSelection.period }, mutation, call)
      } finally { mutations.delete(call) }
    } }
}

function parseSelection(raw: unknown): Pick<SfBiArtifact, "selection" | "dashboardSelection"> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  if (Object.keys(value).length !== 4 || Object.keys(value).some((key) => !["viewId", "version", "filters", "dashboardSelection"].includes(key))) return undefined
  const dashboard = decodeSfOperationInput("sf_dashboard_read", value.dashboardSelection)
  if (!dashboard.ok || (value.viewId !== "BI01" && value.viewId !== "BI07" && value.viewId !== "BI08") || typeof value.version !== "number" || !sfAnalysisApprovedBiViews.some((view) => view.id === value.viewId && view.version === value.version) || !Array.isArray(value.filters)) return undefined
  const filters = value.filters.flatMap((raw: unknown) => {
    const filter = object(raw)
    return Object.keys(filter).length === 2 && filter.field === "period" && Array.isArray(filter.values) && filter.values.every((entry: unknown) => typeof entry === "string")
      ? [{ field: "period", values: filter.values as string[] }] : []
  })
  if (filters.length !== value.filters.length || !validFilters(filters, dashboard.value.period)) return undefined
  return { selection: { viewId: value.viewId, version: value.version, filters }, dashboardSelection: dashboard.value }
}
function validFilters(filters: readonly { field: string; values: readonly string[] }[], period: { start: string; end: string }) {
  return filters.length <= 1 && filters.every((filter) => filter.field === "period" && same(filter.values, [period.start, period.end]))
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
