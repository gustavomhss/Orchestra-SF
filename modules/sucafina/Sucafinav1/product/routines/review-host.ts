import type { ConfirmationValidityProjection, DomainProjection, Period } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort, ReviewSection } from "../reviews/port.ts"
import type { createReviewAgendaSelection, ReviewAgendaItem } from "../reviews/selection.ts"
import { prepareFactualReview } from "./review.ts"

/** A routine prepares an existing WP07 agenda; only its human port preserves a review. */
export function createReviewRoutinePreparation(input: {
  agenda: Pick<ReturnType<typeof createReviewAgendaSelection>, "create" | "release">
  reviews: Pick<ReturnType<typeof createReviewPort>, "preview" | "read">
  /** Resolve C06 by the section's authorized source, incarnation, fields and period. */
  confirmationFor: (section: ReviewSection, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection | null>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (incoming: { items: readonly ReviewAgendaItem[]; period: Period; currentReviewRef?: string; previousReviewRef?: string }, context: TrustedDomainContext) => {
    const request = structuredClone(incoming)
    const selected = await input.agenda.create(request.items, context)
    if (selected.status !== "ok") return selected
    const selectionRef = selected.value.selectionRef
    const sectionRefs = selected.value.sectionRefs
    const prepared = await prepareFactualReview({
      topicRefs: sectionRefs,
      period: request.period,
      ...(request.currentReviewRef ? { currentReviewRef: request.currentReviewRef } : {}),
      ...(request.previousReviewRef ? { previousReviewRef: request.previousReviewRef } : {}),
      context,
      host: {
        readTopic: async (topicRef, call) => {
          const sections = await input.reviews.preview(selectionRef, [topicRef], call, request.period)
          if (sections.status !== "ok") return sections
          const section = sections.value[0]
          if (!section || section.id !== topicRef) return { status: "unavailable", reason: "review-section-unavailable" }
          const confirmation = await input.confirmationFor(section, call)
          if (confirmation.status !== "ok") return confirmation
          const previous = request.previousReviewRef && request.currentReviewRef ? await input.reviews.read(request.currentReviewRef, call) : undefined
          if (previous && previous.status !== "ok") return previous
          if (previous?.status === "ok" && (previous.value.id !== request.currentReviewRef || previous.value.previousReviewRef !== request.previousReviewRef)) return { status: "unavailable", reason: "prior-review-mismatch" }
          const prior = request.previousReviewRef ? await input.reviews.read(request.previousReviewRef, call) : undefined
          if (prior && prior.status !== "ok") return prior
          if (prior?.status === "ok" && prior.value.id !== request.previousReviewRef) return { status: "unavailable", reason: "prior-review-mismatch" }
          const earlier = prior?.status === "ok" ? prior.value.sections.find((entry) => entry.id === topicRef && entry.period.start === section.period.start && entry.period.end === section.period.end) : undefined
          return { status: "ok", value: { projection: section.projection, recordCount: section.recordCount, confirmation: confirmation.value, previousProjection: earlier ? earlier.content as DomainProjection : null } }
        },
        readPreviousReview: (ref, call) => input.reviews.read(ref, call),
        revalidate: async (_refs, call) => {
          const current = await input.reviews.preview(selectionRef, sectionRefs, call, request.period)
          return current.status === "ok" && await input.revalidate(call)
        },
      },
    })
    if (prepared.status !== "ok") {
      input.agenda.release(selectionRef)
      return prepared
    }
    // Hidden C06 sections must not remain selectable through the returned agenda.
    if (prepared.value.draft.sections.length !== sectionRefs.length || prepared.value.draft.coverage.unavailableTopics > 0) {
      input.agenda.release(selectionRef)
      return { status: "unavailable", reason: "review-section-unavailable" } as const
    }
    return { status: "ok", value: {
      ...prepared.value,
      draft: { ...prepared.value.draft, sections: prepared.value.draft.sections.map((section) => ({ ...section, title: selected.value.sections.find((candidate) => candidate.id === section.id)!.title })) },
      reviewSelection: { selectionRef, sectionRefs, ...(request.previousReviewRef ? { previousReviewRef: request.previousReviewRef } : {}) },
      agendaGaps: selected.value.gaps,
      preserved: false,
    } } as const
  }
}
