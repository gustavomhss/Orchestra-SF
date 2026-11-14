import { randomUUID } from "node:crypto"
import { createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardConfirmationIssuer } from "../../../product/dashboard/confirmation-issuer.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { createWorkSourceRefresh } from "../../../product/collaboration/work-source-refresh.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

/** Actual SQLite/domain/BCS/host consumers; only the historical source grant+archive is injected.
 * It is deliberately disabled initially and is NOT proof that the production C17 host archives history.
 */
export async function createThreadHistoryFixture(options: { supplement?: { reference: BusinessEvidenceRef; authorized: () => boolean } } = {}) {
  const threadHistoryWrites = new WeakSet<object>()
  const fixture = await createRelationsFixture({ threadHistoryWrites })
  const historical = { allowed: false }
  const archive = new Map<string, { ref: BusinessEvidenceRef; projection: DomainProjection }>()
  const issue = createDashboardConfirmationIssuer({ host: fixture.host, scopedSources: fixture.persistence })
  const issueForActor: NonNullable<Parameters<typeof createCollaborationHost>[0]["issueForActor"]> = (target, context) => issue({ recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
  const refresh = createWorkSourceRefresh({ host: fixture.host, issueForActor, authorize: (ref, context) => fixture.authority.sources([ref], context) })
  const source = createDashboardConfirmationObserver({ host: fixture.host, scopedSources: fixture.persistence, readProjection: (selection, context) => fixture.records.read(selection.reference, context) })
  const evidence = createSfBusinessContext({
    revalidate: fixture.host.revalidate,
    resolveSource: async (ref, context): Promise<BusinessEvidenceResolution> => {
      if (options.supplement && ref.kind !== "record") return { state: options.supplement.authorized() && digestSfValue(ref) === digestSfValue(options.supplement.reference) ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-14T00:00:00Z" }
      const current = await fixture.evidence.resolve(ref, context)
      if (current.state === "fresh") return current
      const captured = archive.get(ref.refDigest)
      if (!historical.allowed || context.binding.principalRef !== fixture.person.id || !captured || digestSfValue(captured.ref) !== digestSfValue(ref) || ref.kind !== "record") return current
      const live = await refresh(ref, context)
      if (live.status !== "ok") return current
      const projection = await fixture.records.read(live.value.refId, context)
      if (projection.status !== "ok") return current
      return { state: "historical", ref, currentRef: live.value, authorizedProjection: captured.projection, differences: captured.projection.values.flatMap((before) => {
        const after = projection.value.values.find((value) => value.id === before.id)
        return after && before.value !== after.value ? [{ field: before.id, before: before.value, after: after.value }] : []
      }), accessRevision: context.binding.accessRevision, checkedAt: "2026-11-14T00:00:00Z" }
    },
    proveContinuity: async (original, current, context) => {
      if (!historical.allowed || context.binding.principalRef !== fixture.person.id || !archive.has(original.refDigest) || original.kind !== "record") return false
      const live = await refresh(original, context)
      return live.status === "ok" && digestSfValue(live.value) === digestSfValue(current)
    },
    recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }),
  })
  const authority = createSfDomainAuthority({ ui: fixture.ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
  const collaboration = createCollaborationHost({ host: fixture.host, state: fixture.state, creationTarget: fixture.creationTarget, scopedSources: fixture.persistence, evidence, procurement: { list: async () => ({ status: "unavailable", reason: "not-selected" }) }, collections: { resolveRequestCollection: async () => ({ status: "unavailable", reason: "not-selected" }) }, cases: { read: async () => ({ status: "unavailable", reason: "not-selected" }) }, authority, human: fixture.human, issueForActor, prepareReissueScope: source.prepareReissueScope, confirmationSource: source, threadHistoryWrites, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => "2026-11-14T00:00:00Z" })
  const capture = async (ref: BusinessEvidenceRef) => {
    if (ref.kind !== "record") throw new Error("Only record history is in this fixture")
    archive.set(ref.refDigest, { ref: structuredClone(ref), projection: available(await fixture.records.read(ref.refId, fixture.read)) })
  }
  return { ...fixture, historical, collaboration, capture, historyEvidence: evidence }
}
