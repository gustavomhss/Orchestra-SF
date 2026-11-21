import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfBiArtifactStore } from "../../../../modules/sucafina/Sucafinav1/product/analytics/artifact-store.ts"
import { createStoredContextualBiSelectionReader } from "../../../../modules/sucafina/Sucafinav1/product/analytics/contextual.ts"
import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import { sameBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfBiServices } from "./bi-services.ts"

export type SfBiHumanChoiceReader = Parameters<typeof createStoredContextualBiSelectionReader>[0]["readHumanChoice"]

export function createSfBiArtifacts(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  bi: ReturnType<typeof createSfBiServices>
  readHumanChoice?: SfBiHumanChoiceReader
}) {
  const { authority, business, bi } = input
  const host = authority.host
  const lockedFence = () => {
    const fences = business.lockedSourceFences()
    return fences ? digestSfValue(fences) : undefined
  }
  const store = createSfBiArtifactStore({ host, state: authority.state, operationIdentity: business.operationIdentity, now: () => new Date().toISOString(),
    authorizeSelection: async (selection, mutation, call) => selection.selection.version === 1 && selection.selection.filters.length === 0 &&
      biViews.some((view) => view.id === selection.selection.viewId) && await authority.human.authorize(call, "bi.artifact.save", { selection, mutation }),
    produce: async (selection, call) => {
      const before = await business.readSourceFences(call)
      if (!before) return { status: "unavailable", reason: "bi-source-fence-unavailable" }
      const produced = await bi.readForReview({ viewId: selection.selection.viewId, selectionRef: selection.dashboardSelection.selectionRef, period: selection.dashboardSelection.period }, call)
      if (produced.status !== "ok") return produced
      const after = await business.readSourceFences(call)
      if (!after || digestSfValue(before) !== digestSfValue(after)) return { status: "stale", reason: "bi-source-changed" }
      const projectionRefs = produced.value.projection.values.flatMap((value) => value.sourceRefs)
        .filter((ref, index, all) => all.findIndex((entry) => digestSfValue(entry) === digestSfValue(ref)) === index)
      const current = await business.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
      if (current.status !== "ok" || current.value.case.version !== selection.caseRef.version ||
        projectionRefs.some((ref) => !current.value.evidenceRefs.some((candidate) => digestSfValue(candidate) === digestSfValue(ref))))
        return { status: "unavailable", reason: "bi-case-evidence-unavailable" }
      const mapped = produced.value.projection.context.sourceRefs.map((source) => projectionRefs.filter((ref) => ref.kind === "record" &&
        ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id &&
        ref.target.incarnation === source.incarnation && ref.target.version === source.version && source.fields.every((field) => ref.target.fields.includes(field)) &&
        !!ref.target.period && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end))
      if (!mapped.length || mapped.some((refs) => refs.length !== 1)) return { status: "unavailable", reason: "bi-source-evidence-unavailable" }
      const sourceRefs = mapped.map((refs) => refs[0]!)
      const resolved = await business.context.context({ refs: projectionRefs }, call)
      if (resolved.length !== projectionRefs.length || resolved.some((entry, index) => entry.state !== "fresh" || !entry.currentRef || !entry.authorizedProjection ||
        digestSfValue(entry.ref) !== digestSfValue(projectionRefs[index]) || digestSfValue(entry.currentRef) !== digestSfValue(entry.ref)) ||
        digestSfValue(await business.readSourceFences(call)) !== digestSfValue(after) || !await host.revalidate(call))
        return { status: "stale", reason: "bi-source-changed" }
      return { status: "ok", value: { ...produced.value, projectionRefs, sourceRefs, sourceFenceDigest: digestSfValue(after) } }
    },
    verifyCurrent: async (artifact, call) => {
      const sources = await business.readSourceFences(call)
      if (!sources || digestSfValue(sources) !== artifact.sourceFenceDigest) return false
      const current = await bi.readForReview({ viewId: artifact.selection.viewId, selectionRef: artifact.dashboardSelection.selectionRef, period: artifact.dashboardSelection.period }, call)
      const after = await business.readSourceFences(call)
      return current.status === "ok" && sameBiProjection(current.value.projection, artifact.projection) && digestSfValue(current.value.presentation) === digestSfValue(artifact.presentation) &&
        !!after && digestSfValue(after) === artifact.sourceFenceDigest && await host.revalidate(call)
    },
    verifyLocked: async (artifact, call) => lockedFence() === artifact.sourceFenceDigest && await host.revalidate(call) && lockedFence() === artifact.sourceFenceDigest,
    readLockedFence: lockedFence,
  })
  const selection = input.readHumanChoice ? createStoredContextualBiSelectionReader({ approvedViews: biViews.map((view) => ({ id: view.id, version: 1, allowedFilters: [] })),
    readHumanChoice: input.readHumanChoice, readArtifact: store.read, revalidate: host.revalidate }) : undefined
  return { store, selection, unavailable: input.readHumanChoice ? [] : ["bi-persisted-human-choice-reader-unavailable"] }
}
