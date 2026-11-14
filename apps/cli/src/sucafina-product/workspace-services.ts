import { randomUUID } from "node:crypto"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { projectSfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { createCollaborationHttp } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/http.ts"
import { createDashboardAgendaSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/agenda.ts"
import { createReviewApplication } from "../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { createExactReviewThreadSourceMapping } from "../../../../modules/sucafina/Sucafinav1/product/reviews/thread-access.ts"
import { createReviewDecisionAccess } from "../../../../modules/sucafina/Sucafinav1/product/reviews/decision-access.ts"
import { createSfBiFactory } from "../../../../modules/sucafina/Sucafinav1/product/analytics/factory.ts"
import { sameBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import { captureBiReviewChart } from "../../../../modules/sucafina/Sucafinav1/product/analytics/review-chart.ts"
import { presentDashboardBi, resolveDashboardBiSelection } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts"
import type { createSfContributionReader } from "../../../../modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Compose the published domain services over the same installation store and authority. */
export function createSfWorkspaceServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  persistence: Parameters<CreateSfHostRuntime>[0]["persistence"]
  origin: string
  mount: string
  caseSelectionWrites: WeakSet<object>
  threadHistoryWrites: WeakSet<object>
  readContribution?: ReturnType<typeof createSfContributionReader>
}) {
  const { authority, business } = input
  const host = authority.host
  const collaboration = business.collaboration
  const collaborationHttp = createCollaborationHttp({
    origin: input.origin, mount: `${input.mount}/dashboard`, host: collaboration, human: authority.human,
    admitRead: async (request, operation, payload) => {
      const name = `sf-read:${operation}`
      const digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(request, name, digest)
      if (admitted.status !== "ok") return admitted
      if (await authority.ui.validate(admitted.value, name, digest)) return admitted
      authority.ui.finish(admitted.value)
      return { status: "denied", reason: "collaboration-read-authority-unavailable" }
    },
    finishRead: authority.ui.finish,
  })
  const bi = createSfBiFactory({
    authority: authority.authority,
    dashboard: { views: ["BI01", "BI07", "BI08"], host: {
      dashboard: business.dashboard,
      resolve: async (request, call) => {
        const selection = resolveDashboardBiSelection(request.viewId, request.period)
        const source = await business.dashboardSources.resolveDashboardSource(request.selectionRef, call)
        if (!selection || source.status !== "ok" || source.value.evidence.target.recordId !== selection.page || !await host.revalidate(call))
          return { status: "unavailable", reason: "dashboard-bi-selection-unavailable" }
        return { status: "ok", value: { fields: selection.fields, present: (projection) => {
          const result = presentDashboardBi(request.viewId as "BI01" | "BI07" | "BI08", projection)
          if (result.status !== "ok") throw new Error("SF_BI_PRODUCER_PRESENTATION_UNAVAILABLE")
          return result.value
        } } }
      },
      revalidate: async (request, call, projection) => {
        const selection = resolveDashboardBiSelection(request.viewId, request.period)
        if (!selection || !await host.revalidate(call)) return false
        const current = await business.dashboard.read({ selectionRef: request.selectionRef, fields: selection.fields, period: request.period }, call)
        return current.status === "ok" && (!projection || sameBiProjection(current.value, projection)) && await host.revalidate(call)
      },
    } },
    procurement: { views: ["BI05", "BI06"], host: {
      list: business.procurement.list,
      revalidate: async (request, call) => {
        const current = await business.procurement.list(request.selectionRef, call)
        return current.status === "ok" && await host.revalidate(call)
      },
    } },
  })
  // Source identities are private lifecycle receipts, not roles or raw browser references.
  const sourcesCurrent = async (call: TrustedDomainContext, refs: readonly SourceRef[]) => {
    const request = host.requestFor(call)
    if (!request || !input.persistence.transactionAll || !await host.revalidate(call)) return false
    const at = (await host.environment(request)).at
    const result = await input.persistence.transactionAll(async (snapshots) => {
      const valid = refs.every((ref) => {
        if (!["dashboard", "planner", "procurement"].includes(ref.surface)) return false
        const snapshot = snapshots[ref.surface]
        const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === ref.incarnation &&
          entry.version === ref.version && entry.scope.recordType === ref.type && entry.scope.recordId === ref.id &&
          entry.scope.principalRef === call.binding.principalRef && entry.scope.accessRevision === call.binding.accessRevision &&
          entry.scope.policyVersion === call.binding.policyVersion && digestSfValue(object(entry.scope.selector).fields) === digestSfValue([...ref.fields].sort()) &&
          digestSfValue(object(entry.scope.selector).period) === digestSfValue(ref.period))
        return entries.length === 1 && digestSfValue(projectSfSourceScope(ref.surface, snapshot, entries[0]!.scope, at)) === entries[0]!.inputDigest
      })
      return { commit: false, value: valid && await host.revalidate(call) }
    }, { signal: request.signal })
    return result && await host.revalidate(call)
  }
  const decisionAccess = createReviewDecisionAccess({ host, results: business.results, currentCase: business.resolveCase,
    sensitivity: { read: async (reference, call) => {
      const result = await business.results.read({ kind: "sensitivity", resultRef: reference }, call)
      return result.status === "ok" && result.value.kind === "sensitivity" ? { status: "ok", value: { sensitivityResultRef: reference, sensitivity: result.value.result, caseRef: result.value.caseRef } } :
        result.status === "ok" ? { status: "unavailable", reason: "sensitivity-result-unavailable" } : result
    } } })
  const history = collaboration.threadHistory
  if (!history) throw new Error("SF_THREAD_HISTORY_COMPOSITION_UNAVAILABLE")
  const reviews = createReviewApplication({
    origin: input.origin, ui: authority.ui, humanAuthority: authority.human, state: authority.state, host,
    authority: authority.authority, evidence: business.context, creationTarget: authority.creationTarget,
    operationIdentity: business.operationIdentity, requiredAuthority: ["reviews:read"], maxBytes: 8 * 1024 * 1024, maxBodyBytes: 131072,
    now: () => new Date().toISOString(),
    ports: { planner: business.planner, procurement: business.procurement,
      selectDashboardAgenda: createDashboardAgendaSelector({ host, dashboard: business.dashboard, sources: business.dashboardSources, recordEvidence: business.dashboardRecords }),
      readBiPresentation: bi.readPresentation, captureBiReviewChart },
    collaboration: { threads: collaboration.threads, history,
      authorizeSourceMapping: createExactReviewThreadSourceMapping({ host, evidence: business.context }), maxMessages: 1000 },
    access: {
      authorizeSections: (call, sections) => sourcesCurrent(call, sections.flatMap((section) => section.sourceRefs)),
      revalidate: sourcesCurrent, authorizeDecision: decisionAccess,
      // Outcomes require the current observation producer. Absent evidence cannot be preserved as an outcome.
      authorizeOutcome: async (call, outcomes) => outcomes.length === 0 && await host.revalidate(call),
      authorizeOutcomeComparison: async (call, outcomes) => outcomes.length === 0 && await host.revalidate(call),
      authorizeSensitivity: async (call, values) => {
        const request = host.requestFor(call)
        if (!request || !await host.revalidate(call)) return false
        const selected = await authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef &&
          actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
          ? Object.values(state.decisionResults ?? {}).filter((item) => item.kind === "sensitivity").map((item) => item.resultRef) : [])
        if (selected.status !== "ok") return false
        const records = await Promise.all(selected.value.map((resultRef) => business.results.read({ kind: "sensitivity", resultRef }, call)))
        return values.every((value) => records.some((record) => record.status === "ok" && record.value.kind === "sensitivity" &&
          digestSfValue(record.value.result) === digestSfValue(value))) && await host.revalidate(call)
      },
    },
    ...(input.readContribution ? { contributions: { contributions: input.readContribution, results: business.results } } : {}),
  })
  return { collaboration, reviews, bi, descriptors: [...reviews.descriptors, bi.descriptor],
    http: async (request: Request, surface: string) => await collaborationHttp(request) ?? await reviews.http(request, surface) }
}
