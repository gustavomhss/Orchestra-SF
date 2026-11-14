import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createReviewApplication } from "../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { createReviewDecisionAccess } from "../../../../modules/sucafina/Sucafinav1/product/reviews/decision-access.ts"
import { createReviewOutcomeComparisonAccess } from "../../../../modules/sucafina/Sucafinav1/product/reviews/outcome-access.ts"
import { createExactReviewThreadSourceMapping } from "../../../../modules/sucafina/Sucafinav1/product/reviews/thread-access.ts"
import { createRecipientAwareThreadReads } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/thread-reads.ts"
import { captureBiReviewChart } from "../../../../modules/sucafina/Sucafinav1/product/analytics/review-chart.ts"
import { createDashboardAgendaSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/agenda.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"
import type { createSfBiServices } from "./bi-services.ts"

type ApplicationInput = Parameters<typeof createReviewApplication>[0]
export type SfReviewReaders = {
  historicalSource?: (source: SourceRef, call: TrustedDomainContext) => Promise<boolean>
  portfolioHistory?: Parameters<typeof createReviewDecisionAccess>[0]["portfolioHistory"]
  outcome?: { read: Parameters<typeof createReviewOutcomeComparisonAccess>[0]["read"]; authorize: ApplicationInput["access"]["authorizeOutcome"] }
  handoffs?: ApplicationInput["handoffs"]
  contributions?: ApplicationInput["contributions"]
}

/** Review uses the same source instances and current access checks as the business surfaces. */
export function createSfReviewServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  portfolio: ReturnType<typeof createSfPortfolioServices>
  bi: ReturnType<typeof createSfBiServices>
  persistence: SfScopedSourcePort
  origin: string
  readers?: SfReviewReaders
  maxBytes?: number
}) {
  const { authority, business } = input
  const host = authority.host
  const history = business.collaboration.threadHistory
  if (!history) return { application: undefined, unavailable: ["review-thread-history-unavailable"] }
  const currentSource = async (ref: SourceRef, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return false
    const source = await input.persistence.resolveScopedSource(ref.surface, ref.incarnation, async (snapshot, scope) => {
      if (scope.principalRef !== call.binding.principalRef || scope.accessRevision !== call.binding.accessRevision || scope.policyVersion !== call.binding.policyVersion ||
        scope.recordType !== ref.type || scope.recordId !== ref.id || request.signal.aborted) return false
      const principal = await host.authenticate(request, { surface: ref.surface, roleMap: roleMap(snapshot, ref.surface) })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return false
      const selector = object(scope.selector)
      const roles = principal.roles.filter((entry) => entry.surface === ref.surface).map((entry) => entry.role)
      const canWrite = principal.canWrite && roles.some((role) => role !== "viewer")
      if (selector.roleMapDigest !== digestSfValue(roleMap(snapshot, ref.surface))) return false
      if (ref.surface === "dashboard") {
        const access = object(object(snapshot.data.access)[principal.id])
        const actor = { id: principal.id, roles, canWrite,
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        return digestSfValue(selector.actor) === digestSfValue(actor)
      }
      return selector.canWrite === canWrite && Array.isArray(selector.roles) &&
        digestSfValue([...selector.roles].sort()) === digestSfValue([...roles].sort())
    })
    if (!source || source.incarnation !== ref.incarnation || source.version !== ref.version) return false
    const selector = object(source.scope.selector)
    const projection = object(source.projection)
    const fields = Array.isArray(selector.fields) ? selector.fields : Object.keys(projection)
    if (!ref.fields.length || ref.fields.some((field) => !fields.includes(field))) return false
    const selectedPeriod = object(selector.period)
    const year = typeof projection.year === "number" ? projection.year : undefined
    const period = typeof selectedPeriod.start === "string" && typeof selectedPeriod.end === "string" ? { start: selectedPeriod.start, end: selectedPeriod.end }
      : year && Number.isSafeInteger(year) ? { start: `${year}-01-01`, end: `${year}-12-31` } : undefined
    return !!period && period.start <= ref.period.start && period.end >= ref.period.end && await host.revalidate(call)
  }
  const sources = async (call: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await host.revalidate(call)) return false
    const unique = [...new Map(refs.map((ref) => [digestSfValue(ref), ref])).values()]
    const result = await Promise.all(unique.map(async (ref) => await currentSource(ref, call) || !!input.readers?.historicalSource && await input.readers.historicalSource(ref, call)))
    return result.every(Boolean) && await host.revalidate(call)
  }
  const sensitivity = input.portfolio.product?.contribution.persistentSensitivity
  const sensitivityReader: Parameters<typeof createReviewDecisionAccess>[0]["sensitivity"] = {
    read: (ref, call) => sensitivity ? sensitivity.read(ref, call) : Promise.resolve({ status: "unavailable", reason: "review-sensitivity-reader-unavailable" }),
  }
  const authorizeDecision = createReviewDecisionAccess({ host, results: business.results, sensitivity: sensitivityReader,
    ...(input.readers?.portfolioHistory ? { portfolioHistory: input.readers.portfolioHistory } : {}), currentCase: business.resolveCase })
  const authorizeSensitivity: ApplicationInput["access"]["authorizeSensitivity"] = async (call, values) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call) || values.length && !sensitivity) return false
    for (const value of values) {
      const digest = digestSfValue(value)
      const candidates = await authority.state.read(request, "cases", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return []
        return Object.values(state.decisionResults ?? {}).filter((result) => result.kind === "sensitivity" && result.resultDigest === digest &&
          state.cases[result.caseRef.id]?.incarnation === result.caseRef.incarnation && state.cases[result.caseRef.id]?.participants.includes(actor.principalRef)).map((result) => result.resultRef)
      })
      if (candidates.status !== "ok" || candidates.value.length !== 1) return false
      const checked = await sensitivityReader.read(candidates.value[0]!, call)
      if (checked.status !== "ok" || digestSfValue(checked.value.sensitivity) !== digest) return false
    }
    return await host.revalidate(call)
  }
  const outcome = input.readers?.outcome
  const authorizeOutcomeComparison = createReviewOutcomeComparisonAccess({ host,
    read: outcome?.read ?? (async () => ({ status: "unavailable" })) })
  const application = createReviewApplication({ state: authority.state, host, authority: authority.authority, evidence: business.context,
    creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity, requiredAuthority: ["reviews:read"],
    maxBytes: input.maxBytes ?? 8 * 1024 * 1024, now: () => new Date().toISOString(), origin: input.origin, ui: authority.ui,
    humanAuthority: authority.human, maxBodyBytes: 256 * 1024,
    ports: { planner: input.portfolio.planner, procurement: business.procurement,
      selectDashboardAgenda: createDashboardAgendaSelector({ host, dashboard: business.dashboard, sources: business.dashboardSources, recordEvidence: business.dashboardRecords }),
      readBiPresentation: input.bi.readForReview, captureBiReviewChart,
    },
    access: { authorizeSections: async (call, sections) => sections.every((section) => section.id.trim() && section.sourceRefs.length > 0) &&
        await sources(call, sections.flatMap((section) => section.sourceRefs)), revalidate: sources, authorizeDecision, authorizeSensitivity,
      authorizeOutcomeComparison, authorizeOutcome: outcome?.authorize ?? (async (call, values) => values.length === 0 && await host.revalidate(call)),
    },
    collaboration: { threads: createRecipientAwareThreadReads(business.collaboration.threads, business.collaboration.recipientThread), history,
      authorizeSourceMapping: createExactReviewThreadSourceMapping({ host, evidence: business.context }), maxMessages: 500 },
    ...(input.readers?.handoffs ? { handoffs: input.readers.handoffs } : {}),
    ...(input.readers?.contributions ? { contributions: input.readers.contributions } : {}),
  })
  return { application, unavailable: [...(input.readers?.historicalSource ? [] : ["review-historical-domain-source-reader-unavailable"]),
    ...(input.readers?.outcome ? [] : ["review-historical-outcome-reader-unavailable"]),
    ...(input.readers?.handoffs ? [] : ["review-closure-handoff-reader-unavailable"])] }
}
