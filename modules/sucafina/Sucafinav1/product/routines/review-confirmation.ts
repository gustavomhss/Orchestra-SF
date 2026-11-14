import type { ConfirmationScope, ConfirmationValidityProjection, DomainProjection } from "../contracts/context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ReviewSection } from "../reviews/port.ts"
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

/** Resolve the producer's explicit material scope; an arbitrary confirmation id cannot close a topic. */
export function createReviewConfirmationReader(input: {
  confirmation: { readScope: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection | null>> }
  scopeFor: (section: ReviewSection, context: TrustedDomainContext) => Promise<PortResult<ConfirmationScope>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (incoming: ReviewSection, context: TrustedDomainContext): Promise<PortResult<ConfirmationValidityProjection | null>> => {
    const section = structuredClone(incoming)
    if (!await input.revalidate(context)) return { status: "denied", reason: "confirmation-source-unavailable" }
    const resolved = await input.scopeFor(structuredClone(section), context)
    if (resolved.status !== "ok") return resolved
    const scope = structuredClone(resolved.value)
    const source = section.projection.context.sourceRefs.find((ref) => ref.surface === scope.sourceRef.surface && ref.type === scope.sourceRef.type && ref.id === scope.sourceRef.id && ref.incarnation === scope.sourceRef.incarnation)
    if (!source || !scope.fields.length || scope.fields.some((field) => !source.fields.includes(field)) ||
      digestSfValue(scope.period) !== digestSfValue(section.period) || !scope.scopeDefinitionVersion.trim()) return { status: "unavailable", reason: "confirmation-scope-mismatch" }
    const read = await input.confirmation.readScope(scope, context)
    if (read.status !== "ok") return read
    if (!await input.revalidate(context)) return { status: "denied", reason: "confirmation-source-unavailable" }
    return { status: "ok", value: structuredClone(read.value) }
  }
}


