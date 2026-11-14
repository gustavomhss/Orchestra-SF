import type { HotTopic, HotTopicIntent, createHotTopicPort } from "../dashboard/hot-topics.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { createRelationPort } from "./relations.ts"
import type { CollaborationHumanAuthority } from "./human.ts"

type HandoffRequest = { intent: HotTopicIntent; sourceRef: string; recipientRef?: string; relationKey: string }

/** Uses the producer's actual action ID and correlation; the relation is contextual metadata only. */
export function createHandoffPort(input: {
  hotTopics: Pick<ReturnType<typeof createHotTopicPort>, "create" | "read">
  relations: Pick<ReturnType<typeof createRelationPort>, "createHandoff" | "storageVersion">
  human: CollaborationHumanAuthority
  permit: symbol
  run: (context: TrustedDomainContext, request: HandoffRequest, work: () => Promise<PortResult<{ topic: HotTopic; state: "created" | "existing"; relationId: string }>>) => Promise<PortResult<{ topic: HotTopic; state: "created" | "existing"; relationId: string }>>
  authorizeIntent: (intent: HotTopicIntent, recipientRef: string | undefined, context: TrustedDomainContext) => Promise<boolean>
  resolveTopic: (topic: HotTopic, context: TrustedDomainContext) => Promise<PortResult<{ ref: string; evidence: BusinessEvidenceRef }>>
}) {
  return {
    create: async (request: HandoffRequest, context: TrustedDomainContext): Promise<PortResult<{ topic: HotTopic; state: "created" | "existing"; relationId: string }>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      if (!request || typeof request !== "object" || typeof request.sourceRef !== "string" || typeof request.relationKey !== "string" || !request.intent || typeof request.intent !== "object") return { status: "needs-input", reason: "invalid-handoff" }
      const intent = structuredClone(request)
      if (!await input.human.authorize(context, "collaboration.handoff.confirm", intent) || !intent.sourceRef.trim() || !intent.relationKey.trim() || !Array.isArray(intent.intent?.sourceRefs) || intent.intent.sourceRefs.filter((ref) => ref && typeof ref === "object" && ref.refId === intent.sourceRef).length !== 1 || !await input.authorizeIntent(structuredClone(intent.intent), intent.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
      return input.run(context, intent, async () => {
      const action = await input.hotTopics.create(intent.intent, context).catch(() => ({ status: "unavailable" as const, reason: "action-outcome-unknown-retry-same-correlation" }))
      if (action.status !== "ok") return action
      const target = await input.resolveTopic(action.value.topic, context)
      if (target.status !== "ok") return target
      const version = await input.relations.storageVersion(context)
      if (version.status !== "ok") return version
      const relation = await input.relations.createHandoff({ fromRef: intent.sourceRef, toRef: target.value.ref, kind: "handoff", evidenceRefs: [...intent.intent.sourceRefs, target.value.evidence], ...(intent.recipientRef ? { recipientRef: intent.recipientRef } : {}) }, { expectedStorageVersion: version.value, idempotencyKey: intent.relationKey }, context, intent, input.permit)
      if (relation.status !== "ok") return relation.status === "conflict" ? { status: "conflict", reason: "action-created-link-unconfirmed" } : { status: "unavailable", reason: "handoff-unavailable" }
      const current = await input.hotTopics.read(action.value.topic.id, intent.intent.sourceRefs, context)
      if (current.status !== "ok") return current
      return { status: "ok" as const, value: { topic: current.value, state: action.value.state, relationId: relation.value.id } }
      })
    },
  }
}
