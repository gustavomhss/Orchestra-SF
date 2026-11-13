import type { HotTopic, HotTopicIntent, createHotTopicPort } from "../dashboard/hot-topics.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { createRelationPort } from "./relations.ts"
import type { CollaborationHumanAuthority } from "./human.ts"

type HandoffRequest = { intent: HotTopicIntent; sourceRef: string; recipientRef?: string; relationKey: string }
type LinkRequest = { topicRef: string; sourceRefs: readonly BusinessEvidenceRef[]; sourceRef: string; recipientRef?: string; relationKey: string }
type UpdateRequest = { topicId: string; expectedVersion: number; idempotencyKey: string; values: Partial<Pick<HotTopic, "action" | "owner" | "due" | "status" | "priority" | "notes">>; sourceRefs: readonly BusinessEvidenceRef[]; sourceRef: string; recipientRef?: string; relationKey: string }
type HandoffResult = { topic: HotTopic; state: "created" | "existing" | "updated" | "linked"; relationId: string }

/** Uses the producer's actual action ID and correlation; the relation is contextual metadata only. */
export function createHandoffPort(input: {
  hotTopics: Pick<ReturnType<typeof createHotTopicPort>, "create" | "read"> & Partial<Pick<ReturnType<typeof createHotTopicPort>, "update">>
  relations: Pick<ReturnType<typeof createRelationPort>, "createHandoff" | "storageVersion">
  human: CollaborationHumanAuthority
  permit: symbol
  run: (context: TrustedDomainContext, request: HandoffRequest | UpdateRequest | LinkRequest, work: () => Promise<PortResult<HandoffResult>>) => Promise<PortResult<HandoffResult>>
  authorizeIntent: (intent: HotTopicIntent, recipientRef: string | undefined, context: TrustedDomainContext) => Promise<boolean>
  authorizeUpdate?: (request: UpdateRequest, context: TrustedDomainContext) => Promise<boolean>
  resolveTopic: (topic: HotTopic, context: TrustedDomainContext) => Promise<PortResult<{ ref: string; evidence: BusinessEvidenceRef }>>
}) {
  return {
    link: async (request: LinkRequest, context: TrustedDomainContext): Promise<PortResult<HandoffResult>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      if (!request || typeof request.topicRef !== "string" || !request.topicRef.trim() || typeof request.sourceRef !== "string" || !request.sourceRef.trim() || typeof request.relationKey !== "string" || !request.relationKey.trim() || request.sourceRef === request.topicRef || !Array.isArray(request.sourceRefs) || request.sourceRefs.filter((ref) => ref && ref.refId === request.sourceRef).length !== 1) return { status: "needs-input", reason: "invalid-handoff-link" }
      const selected = structuredClone(request)
      const targets = selected.sourceRefs.filter((ref) => ref && ref.refId === selected.topicRef)
      const target = targets[0]
      if (targets.length !== 1 || target?.kind !== "record" || target.target.surface !== "dashboard" || target.target.recordType !== "hotTopics" || !await input.human.authorize(context, "collaboration.handoff.confirm", selected)) return { status: "denied", reason: "handoff-access-unavailable" }
      return input.run(context, selected, async () => {
        const topic = await input.hotTopics.read(target.target.recordId, selected.sourceRefs, context)
        if (topic.status !== "ok") return topic
        if (topic.value.id !== target.target.recordId || !["critical", "high", "normal"].includes(topic.value.priority)) return { status: "stale", reason: "action-selection-changed" }
        const intent: HotTopicIntent = { correlationKey: selected.relationKey, sourceRefs: selected.sourceRefs, action: topic.value.action, owner: topic.value.owner, due: topic.value.due, priority: topic.value.priority as HotTopicIntent["priority"], notes: "" }
        if (!await input.human.authorize(context, "collaboration.handoff.confirm", selected) || !await input.authorizeIntent(intent, selected.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
        const issued = await input.resolveTopic(topic.value, context)
        if (issued.status !== "ok") return issued
        const version = await input.relations.storageVersion(context)
        if (version.status !== "ok") return version
        const relation = await input.relations.createHandoff({ fromRef: selected.sourceRef, toRef: issued.value.ref, kind: "handoff", evidenceRefs: [...selected.sourceRefs.filter((ref) => ref.refId !== issued.value.ref), issued.value.evidence], ...(selected.recipientRef ? { recipientRef: selected.recipientRef } : {}) }, { expectedStorageVersion: version.value, idempotencyKey: selected.relationKey }, context, selected, input.permit)
        if (relation.status !== "ok") return { status: relation.status === "conflict" ? "conflict" : "unavailable", reason: "action-link-unconfirmed" }
        const current = await input.hotTopics.read(target.target.recordId, selected.sourceRefs, context)
        if (current.status !== "ok") return current
        if (current.value.id !== target.target.recordId || current.value.version < topic.value.version) return { status: "unavailable", reason: "action-readback-unconfirmed" }
        if (!await input.human.authorize(context, "collaboration.handoff.confirm", selected) || !await input.authorizeIntent(intent, selected.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
        return { status: "ok", value: { topic: current.value, state: "linked", relationId: relation.value.id } }
      })
    },
    create: async (request: HandoffRequest, context: TrustedDomainContext): Promise<PortResult<HandoffResult>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      if (!request || typeof request !== "object" || typeof request.sourceRef !== "string" || typeof request.relationKey !== "string" || !request.intent || typeof request.intent !== "object") return { status: "needs-input", reason: "invalid-handoff" }
      const intent = structuredClone(request)
      if (!await input.human.authorize(context, "collaboration.handoff.confirm", intent) || !intent.sourceRef.trim() || !intent.relationKey.trim() || !Array.isArray(intent.intent?.sourceRefs) || intent.intent.sourceRefs.filter((ref) => ref && typeof ref === "object" && ref.refId === intent.sourceRef).length !== 1 || !await input.authorizeIntent(structuredClone(intent.intent), intent.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
      return input.run(context, intent, async () => {
      if (!await input.human.authorize(context, "collaboration.handoff.confirm", intent) || !await input.authorizeIntent(structuredClone(intent.intent), intent.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
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
      if (current.value.id !== action.value.topic.id || current.value.version < action.value.topic.version) return { status: "unavailable", reason: "action-readback-unconfirmed" }
      if (!await input.human.authorize(context, "collaboration.handoff.confirm", intent) || !await input.authorizeIntent(structuredClone(intent.intent), intent.recipientRef, context)) return { status: "denied", reason: "handoff-access-unavailable" }
      return { status: "ok" as const, value: { topic: current.value, state: action.value.state, relationId: relation.value.id } }
      })
    },
    update: async (request: UpdateRequest, context: TrustedDomainContext): Promise<PortResult<HandoffResult>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      if (!request || typeof request.topicId !== "string" || !request.topicId.trim() || typeof request.sourceRef !== "string" || !request.sourceRef.trim() || typeof request.relationKey !== "string" || !request.relationKey.trim() || typeof request.idempotencyKey !== "string" || !request.idempotencyKey.trim() || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0 || !request.values || typeof request.values !== "object" || Array.isArray(request.values) || !Object.keys(request.values).length || !Array.isArray(request.sourceRefs) || request.sourceRefs.filter((ref) => ref && typeof ref === "object" && ref.refId === request.sourceRef).length !== 1) return { status: "needs-input", reason: "invalid-handoff-update" }
      const selected = structuredClone(request)
      if (!input.hotTopics.update || !input.authorizeUpdate || !await input.human.authorize(context, "collaboration.handoff.confirm", selected)) return { status: "denied", reason: "handoff-access-unavailable" }
      return input.run(context, selected, async () => {
        if (!await input.authorizeUpdate!(selected, context)) return { status: "denied", reason: "handoff-access-unavailable" }
        const action = await input.hotTopics.update!({ id: selected.topicId, version: selected.expectedVersion, idempotencyKey: selected.idempotencyKey, sourceRefs: selected.sourceRefs, values: selected.values }, context).catch(() => ({ status: "unavailable" as const, reason: "action-outcome-unknown-retry-same-correlation" }))
        if (action.status !== "ok") return action
        if (action.value.id !== selected.topicId) return { status: "unavailable", reason: "action-unavailable" }
        const target = await input.resolveTopic(action.value, context)
        if (target.status !== "ok") return target
        const version = await input.relations.storageVersion(context)
        if (version.status !== "ok") return version
        const relation = await input.relations.createHandoff({ fromRef: selected.sourceRef, toRef: target.value.ref, kind: "handoff", evidenceRefs: [...selected.sourceRefs, target.value.evidence], ...(selected.recipientRef ? { recipientRef: selected.recipientRef } : {}) }, { expectedStorageVersion: version.value, idempotencyKey: selected.relationKey }, context, selected, input.permit)
        if (relation.status !== "ok") return { status: relation.status === "conflict" ? "conflict" : "unavailable", reason: "action-updated-link-unconfirmed" }
        const current = await input.hotTopics.read(selected.topicId, selected.sourceRefs, context)
        if (current.status !== "ok") return current
        if (current.value.id !== selected.topicId || current.value.version < action.value.version) return { status: "unavailable", reason: "action-readback-unconfirmed" }
        if (!await input.human.authorize(context, "collaboration.handoff.confirm", selected) || !await input.authorizeUpdate!(selected, context)) return { status: "denied", reason: "handoff-access-unavailable" }
        return { status: "ok", value: { topic: current.value, state: "updated", relationId: relation.value.id } }
      })
    },
  }
}

