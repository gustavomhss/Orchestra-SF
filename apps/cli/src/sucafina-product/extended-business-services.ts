import { createPlannerCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/planner/capabilities.ts"
import { createPlannerResultPersistence } from "../../../../modules/sucafina/Sucafinav1/product/planner/persistence.ts"
import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { CapabilityDescriptor } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { createSfPortfolioServices } from "./portfolio-services.ts"
import type { SfPortfolioPreparation } from "./portfolio-services.ts"
import { createSfBiServices } from "./bi-services.ts"
import { createSfBiArtifacts } from "./bi-artifacts.ts"
import type { SfBiHumanChoiceReader } from "./bi-artifacts.ts"
import { createSfReviewCollaboration } from "./review-collaboration.ts"
import type { ReviewThreadRecipientAuthority } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts"
import { createSfReviewServices } from "./review-services.ts"
import type { SfReviewReaders } from "./review-services.ts"
import { createSfExtendedAssets } from "./extended-assets.ts"
import { createSfExtendedHttp } from "./extended-http.ts"
import { createSfAnalysisChoiceServices } from "./analysis-choice-services.ts"
import { createSfAnalysisChoiceHttp } from "./analysis-choice-http.ts"
import { createStoredContextualBiSelectionReader } from "../../../../modules/sucafina/Sucafinav1/product/analytics/contextual.ts"
import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import { createDecisionCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/decisions/capabilities.ts"
import { createSfChangeProposalServices } from "./change-proposal-services.ts"
import { createSfAlternativeServices } from "./alternative-services.ts"
import type { SfProductHtml } from "../../../../modules/sucafina/Sucafinav1/product/integration/host-presentation.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"

/** Composition of published domain factories over the installation's existing authorities and persistence. */
export function createSfExtendedBusinessServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  persistence: SfScopedSourcePort
  proposalCoverageWrites: WeakSet<object>
  analysisSelectionWrites: WeakSet<object>
  procurementEvidenceWrites?: WeakSet<object>
  origin: string
  preparation?: SfPortfolioPreparation
  reviewReaders?: SfReviewReaders
  reviewRecipientAuthority?: ReviewThreadRecipientAuthority
  readHumanBiChoice?: SfBiHumanChoiceReader
  assets?: Pick<ReturnType<typeof createSfExtendedAssets>, "bi" | "reviews">
}) {
  const portfolioServices = createSfPortfolioServices({ authority: input.authority, business: input.business,
    proposalCoverageWrites: input.proposalCoverageWrites, procurementEvidenceWrites: input.procurementEvidenceWrites, preparation: input.preparation })
  const decisions = createSfChangeProposalServices(input)
  const alternatives = createSfAlternativeServices(input)
  const bi = createSfBiServices({ authority: input.authority, business: input.business, portfolio: portfolioServices })
  const biArtifacts = createSfBiArtifacts({ authority: input.authority, business: input.business, bi })
  const choices = createSfAnalysisChoiceServices({ ...input, portfolio: portfolioServices, biArtifacts: biArtifacts.store })
  const biSelection = createStoredContextualBiSelectionReader({ approvedViews: biViews.map((view) => ({ id: view.id, version: 1, allowedFilters: [] })),
    readHumanChoice: input.readHumanBiChoice ?? choices.readBi, readArtifact: biArtifacts.store.read, revalidate: input.authority.host.revalidate })
  const reviewServices = createSfReviewServices({ ...input, portfolio: portfolioServices, bi, readers: input.reviewReaders })
  const reviews = reviewServices.application
  if (reviews && reviewServices.historical) input.business.bindReviewCollaboration(createSfReviewCollaboration({ authority: input.authority,
    application: reviews, evidence: reviewServices.historical.evidence, recipientAuthority: input.reviewRecipientAuthority }))
  const ownAssets = input.assets ? undefined : createSfExtendedAssets()
  const assets = input.assets ?? ownAssets!
  const descriptors: readonly CapabilityDescriptor[] = [bi.descriptor, ...portfolioServices.descriptors, ...(reviews?.descriptors ?? [])]
  if (new Set(descriptors.map((descriptor) => descriptor.id)).size !== descriptors.length) throw new Error("SF_EXTENDED_CAPABILITY_DUPLICATE")
  const scenarios = input.business.plannerProduct.scenarios
  const replacements = [...(scenarios ? createPlannerCapabilities(portfolioServices.planner, input.business.receipt,
    createPlannerResultPersistence({ store: input.business.results, scenarios, resolveCase: input.business.resolveCase }))
    .filter((descriptor) => descriptor.id === "sf_scenario_compare") : []),
    ...createDecisionCapabilities({ cases: input.business.cases, change: decisions.prepare, alternative: alternatives.proposal, createReceipt: input.business.receipt,
      requiredAuthority: { read: ["cases:read"], draft: ["cases:write"], receipt: ["cases:read"], alternative: ["cases:read"], change: ["cases:read"] } })
      .filter((descriptor) => descriptor.id === "sf_change_prepare" || descriptor.id === "sf_alternative_draft"),
  ]
  const http = createSfExtendedHttp({ ...input, bi, reviews, assets, reviewEvidence: reviewServices.historical?.evidence })
  const choiceHttp = createSfAnalysisChoiceHttp({ authority: input.authority, origin: input.origin, choices, artifacts: biArtifacts.store,
    alternatives: alternatives.choices, business: input.business })
  let disposed = false
  const productHttp: NonNullable<Application["product"]> = async (request, surface) => disposed ? undefined : await choiceHttp(request, surface) ?? await http(request, surface)
  const productHtml: SfProductHtml = (html, surface, page, request) => {
    if (disposed || surface !== "dashboard" || html.includes("data-sf-extended-navigation")) return html
    const period = navigationPeriod(html, page, request)
    if (!period) return html.replace("</main>", '<nav data-sf-extended-navigation aria-label="Business analysis"><p>Choose a supported period to open business analysis.</p></nav></main>')
    const link = (mode: string) => `?${new URLSearchParams({ sf: mode, page, ...period }).toString().replaceAll("&", "&amp;")}`
    const links = `<nav data-sf-extended-navigation aria-label="Business analysis"><a href="${link("bi")}">Business intelligence</a>${reviews ? ` <a href="${link("review")}">Prepare review and reports</a>` : ""}</nav>`
    return html.replace("</main>", `${links}</main>`)
  }
  return {
    descriptors, replacements, productHttp, productHtml, bi, biArtifacts: biArtifacts.store, choices, reviews, decisions, alternatives,
    portfolio: portfolioServices.product, portfolioServices, portfolioProof: portfolioServices.proof, units: portfolioServices.units,
    readers: { biSelection, selectedSensitivity: choices.readSensitivity,
      ...(reviews ? { reviewSnapshot: reviews.reviews.read, artifacts: reviews.artifacts } : {}),
      ...(portfolioServices.product?.contribution.persistentSensitivity ? { sensitivity: portfolioServices.product.contribution.persistentSensitivity } : {}),
      criteria: portfolioServices.rules, portfolioSelection: portfolioServices.selection,
    },
    analysisBindings: { biSelection, selectedSensitivity: choices.readSensitivity, changeProposals: decisions.store, replayAlternative: alternatives.replay,
      ...(reviews ? { reviews: reviews.reviews, artifacts: reviews.artifacts } : {}),
      ...(portfolioServices.proof ? { portfolioProof: portfolioServices.proof } : {}), ...(portfolioServices.units ? { units: portfolioServices.units } : {}),
    },
    unavailable: [...portfolioServices.unavailable, ...bi.unavailable, ...reviewServices.unavailable, ...decisions.unavailable,
      ...(!input.reviewRecipientAuthority ? ["review-distinct-recipient-authority-unavailable"] : [])],
    dispose: () => { disposed = true; portfolioServices.dispose(); ownAssets?.dispose() },
  }
}

/** Read the rendered controls so defaults use the same environment date as the page. */
function navigationPeriod(html: string, page: string, request?: Request) {
  const query = request ? new URL(request.url).searchParams : undefined
  if (query?.has("start") || query?.has("end")) {
    const period = { start: query.get("start"), end: query.get("end") }
    return isSfPeriod(period) ? period : undefined
  }
  const scoped = page === "Executive Dashboard" ? ["execYear", "executiveMonth"] :
    page === "IT Operations" ? ["opsYear", "operationsMonth"] : page === "IT Security KPIs" ? ["secYear", "securityMonth"] : undefined
  const year = selectedValue(html, scoped?.[0] ?? "year") ??
    (scoped ? query?.get(scoped[0]!) || query?.get("own") : query?.get("year")) ?? (scoped ? undefined : "2026")
  if (!year || !/^202[4-7]$/.test(year)) return undefined
  if (!scoped) return { start: `${year}-01-01`, end: `${year}-12-31` }
  const month = selectedValue(html, scoped[1]!) ?? query?.get(scoped[1]!) ?? query?.get("month")
  if (!month || !/^([1-9]|1[0-2])$/.test(month)) return undefined
  const prefix = `${year}-${month.padStart(2, "0")}`
  return { start: `${prefix}-01`, end: `${prefix}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}` }
}
function selectedValue(html: string, key: string): string | undefined {
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    if (!new RegExp(`(?:data-query|name)="${key}"`).test(select[1]!)) continue
    const options = [...select[2]!.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)]
    const selected = options.find((option) => /(?:^|\s)selected(?:\s|=|$)/.test(option[1]!)) ?? options[0]
    if (selected) return /\bvalue="([^"]*)"/.exec(selected[1]!)?.[1] ?? selected[2]!.trim()
  }
  return undefined
}
