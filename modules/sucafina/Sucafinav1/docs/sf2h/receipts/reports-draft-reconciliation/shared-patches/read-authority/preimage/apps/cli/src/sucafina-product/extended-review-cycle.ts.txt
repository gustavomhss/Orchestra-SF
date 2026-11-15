import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { ReviewAgendaItem } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import { reviewDecisionEvidence } from "../../../../modules/sucafina/Sucafinav1/product/reviews/decision.ts"
import type { ReviewOutcomeComparison } from "../../../../modules/sucafina/Sucafinav1/product/reviews/outcome.ts"
import type { ObservedResultProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfReviewServices } from "./review-services.ts"
import type { DashboardAgendaSection } from "./dashboard-services.ts"

export type SfReviewUpdate = { available: boolean; previousReviewRef: string; items: ReviewAgendaItem[]; confirmations: { sectionId: string; label: string }[]; unavailableSections: { sectionId: string; title: string; reason: string }[] }

/** Dashboard discovery has a UI title; the C04 dashboard agenda accepts only its canonical selection fields. */
export function sfDashboardReviewAgendaItem(section: DashboardAgendaSection): Extract<ReviewAgendaItem, { kind: "dashboard" }> {
  return { kind: "dashboard", id: section.id, topic: section.topic, selectionRef: section.selectionRef,
    period: { start: section.period.start, end: section.period.end },
    ...(section.recordRefs === undefined ? {} : { recordRefs: section.recordRefs }) }
}

/** Preserved review order/period/notes survive. Ambiguous original record selections require a new explicit human choice. */
export function createSfExtendedReviewCycle(input: { authority: ReturnType<typeof createSfProductAuthority>; business: ReturnType<typeof createSfBusinessServices>; reviews: ReturnType<typeof createSfReviewServices>["application"]; persistence: SfScopedSourcePort }) {
  const { authority, business } = input
  const issue = createDashboardSourceIssuer({ host: authority.host, scopedSources: input.persistence })
  const update = async (reviewRef: string, call: TrustedDomainContext): Promise<PortResult<SfReviewUpdate>> => {
    if (!input.reviews) return { status: "unavailable", reason: "review-producers-unavailable" }
    const prior = await input.reviews.reviews.read(reviewRef, call)
    if (prior.status !== "ok") return prior
    const value: SfReviewUpdate = { available: false, previousReviewRef: prior.value.id, items: [], confirmations: [], unavailableSections: [] }
    for (const section of prior.value.sections) {
      const projection = section.content as DomainProjection & { reviewAgendaNote?: string; reviewChart?: unknown; reviewOutcome?: unknown }
      const refs = section.sourceRefs.filter((ref) => ref.surface === "dashboard" && ref.type === "dashboard-page")
      if (refs.length !== 1 || section.sourceRefs.length !== 1 || projection.reviewChart || projection.reviewOutcome || prior.value.comments.some((comment) => comment.sourceRefs.some((ref) => section.sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))))) {
        value.unavailableSections.push({ sectionId: section.id, title: section.title, reason: "A seleção de gráfico, outcome, thread ou produtor deste tópico não foi preservada como agenda editável. Escolha novamente essa fonte no produto antes de incluí-la na sucessora." })
        continue
      }
      const source = refs[0]!
      const current = await issue({ page: source.id, fields: source.fields, period: section.period }, call)
      if (current.status !== "ok") return current
      const resolved = await business.dashboardSources.resolveDashboardSource(current.value.selectionRef, call)
      if (resolved.status !== "ok") return resolved
      const discovered = await business.dashboardServices.discover({ page: source.id, period: section.period }, call)
      if (discovered.status !== "ok") return discovered
      if (!discovered.value.agenda) { value.unavailableSections.push({ sectionId: section.id, title: section.title, reason: "Este tópico requer uma seleção de origem antes de preparar a nova revisão." }); continue }
      value.available ||= resolved.value.evidence.target.incarnation !== source.incarnation || resolved.value.evidence.target.version !== source.version
      const item: ReviewAgendaItem = { ...sfDashboardReviewAgendaItem(discovered.value.agenda.section), id: section.id,
        ...(projection.reviewAgendaNote !== undefined ? { agendaNote: projection.reviewAgendaNote } : {}) }
      // C04 keeps the exact projection but does not persist its original C17 recordRefs. Do not infer "all" from a count.
      value.confirmations.push({ sectionId: section.id, label: `Selecionar explicitamente os registros atuais autorizados de ${source.id}, ${section.period.start} – ${section.period.end}; revisar a lista e remover registros antes de preservar.` })
      value.items.push(item)
    }
    const again = await input.reviews.reviews.read(reviewRef, call)
    return again.status === "ok" && digestSfValue(again.value) === digestSfValue(prior.value) && await authority.host.revalidate(call)
      ? { status: "ok", value } : { status: "denied", reason: "review-access-changed" }
  }
  const evidence = (review: PreservedReview, referenceId: string) => review.sections.flatMap((section) => {
    const projection = section.content as DomainProjection & { reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison }
    return [...projection.values.flatMap((value) => [value.drilldown, ...value.sourceRefs]),
      ...(projection.decision ? reviewDecisionEvidence(projection.decision) : []), ...(projection.reviewOutcome?.sourceRefs ?? []),
      ...(projection.reviewOutcomeComparison?.baselineRefs ?? []), ...(projection.reviewOutcomeComparison?.sourceRefs ?? [])]
      .filter((ref): ref is BusinessEvidenceRef => !!ref && ref.refId === referenceId)
  })
  return { update, evidence }
}
