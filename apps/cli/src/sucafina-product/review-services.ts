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
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"
import type { createSfBiServices } from "./bi-services.ts"
import { createSfReviewHistory } from "./review-history.ts"
import { createSfReviewHandoffs } from "./review-handoffs.ts"
import { createPortfolioHistory } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-history.ts"
import { createPortfolioHistoricalProvenance } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/history-provenance.ts"

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
  const historical = createSfReviewHistory({ authority, persistence: input.persistence, evidence: business.context, authorizeCase: business.authorizeCase })
  const currentSource = historical.currentSource
  const sources = async (call: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await host.revalidate(call)) return false
    const unique = [...new Map(refs.map((ref) => [digestSfValue(ref), ref])).values()]
    const result = await Promise.all(unique.map(async (ref) => await currentSource(ref, call) || await historical.historicalSource(ref, call) || !!input.readers?.historicalSource && await input.readers.historicalSource(ref, call)))
    return result.every(Boolean) && await host.revalidate(call)
  }
  const sensitivity = input.portfolio.product?.contribution.persistentSensitivity
  const sensitivityReader: Parameters<typeof createReviewDecisionAccess>[0]["sensitivity"] = {
    read: (ref, call) => sensitivity ? sensitivity.read(ref, call) : Promise.resolve({ status: "unavailable", reason: "review-sensitivity-reader-unavailable" }),
  }
  const portfolioHistory = input.readers?.portfolioHistory ?? createPortfolioHistory({ state: authority.state, host, authorizeCase: business.authorizeCase,
    verifyHistoricalProvenance: createPortfolioHistoricalProvenance({ readHistoricalBinding: input.portfolio.portfolioBindings.readHistoricalBinding,
      caseFor: business.resolveCase, cases: business.cases, evidence: historical.evidence, host }) })
  const authorizeDecision = createReviewDecisionAccess({ host, results: business.results, sensitivity: sensitivityReader, portfolioHistory, currentCase: business.resolveCase })
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
  const handoffs = input.readers?.handoffs ?? createSfReviewHandoffs({ authority, business })
  const application = createReviewApplication({ state: authority.state, host, authority: authority.authority, evidence: historical.evidence,
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
      authorizeSourceMapping: createExactReviewThreadSourceMapping({ host, evidence: historical.evidence }), maxMessages: 500 },
    handoffs,
    ...(input.readers?.contributions ? { contributions: input.readers.contributions } : {}),
  })
  return { application, historical, portfolioHistory, handoffs, unavailable: input.readers?.outcome ? [] : ["review-historical-outcome-reader-unavailable"] }
}
