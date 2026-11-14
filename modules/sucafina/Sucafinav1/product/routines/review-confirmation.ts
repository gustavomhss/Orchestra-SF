import type { ConfirmationValidityProjection, DomainProjection } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ReviewPreparationHost } from "./review.ts"

/** The host selects a confirmation only when its source, incarnation, fields and period match the topic. */
export function createScopedReviewHost(input: {
  readTopic: (topicRef: string, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; recordCount?: number; previousProjection?: DomainProjection | null; confirmationId?: string }>>
  confirmation?: { project: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection>> }
  readPreviousReview?: ReviewPreparationHost["readPreviousReview"]
  revalidate: ReviewPreparationHost["revalidate"]
}): ReviewPreparationHost {
  return {
    revalidate: input.revalidate,
    readPreviousReview: input.readPreviousReview,
    readTopic: async (topicRef, context) => {
      if (!await input.revalidate([topicRef], context)) return { status: "denied", reason: "topic-unavailable" }
      const topic = await input.readTopic(topicRef, context)
      if (topic.status !== "ok") return topic
      if (!topic.value.confirmationId) {
        if (!await input.revalidate([topicRef], context)) return { status: "denied", reason: "topic-unavailable" }
        return { status: "ok", value: { projection: topic.value.projection, recordCount: topic.value.recordCount, previousProjection: topic.value.previousProjection, confirmation: null } }
      }
      if (!input.confirmation) return { status: "unavailable", reason: "confirmation-producer-unavailable" }
      const projection = await input.confirmation.project(topic.value.confirmationId, context)
      if (projection.status !== "ok") return projection
      if (projection.value.confirmationId !== topic.value.confirmationId || projection.value.state === "unavailable") return { status: "unavailable", reason: "confirmation-source-unavailable" }
      if (!await input.revalidate([topicRef], context)) return { status: "denied", reason: "topic-unavailable" }
      return { status: "ok", value: { projection: topic.value.projection, recordCount: topic.value.recordCount, previousProjection: topic.value.previousProjection, confirmation: projection.value } }
    },
  }
}

