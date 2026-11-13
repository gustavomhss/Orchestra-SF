import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopic, HotTopicIntent } from "../dashboard/hot-topics.ts"

type HandoffRequest = { intent: HotTopicIntent; sourceRef: string; recipientRef?: string; relationKey: string }
type FollowupSelection = { noteId: string; sourceRef: string; action: string; owner: string; due: string; priority: HotTopicIntent["priority"]; notes: string; recipientRef?: string }
type UpdateValues = Partial<Pick<HotTopic, "action" | "owner" | "due" | "priority">>
type HandoffUpdate = { topicId: string; expectedVersion: number; idempotencyKey: string; values: UpdateValues; sourceRefs: readonly BusinessEvidenceRef[]; sourceRef: string; recipientRef?: string; relationKey: string }

/** The host derives stableSourceKey from the source identity and incarnation, not its version.
 * Uses the existing collaboration handoff; the human confirmation binds the exact prepared payload. */
export function createFollowupHandoff<T, U = T>(input: {
  resolveNote: (sourceRef: string, noteId: string, context: TrustedDomainContext) => Promise<PortResult<{ sourceRef: string; stableSourceKey: string; evidence: BusinessEvidenceRef }>>
  handoff: { create: (request: HandoffRequest, context: TrustedDomainContext) => Promise<PortResult<T>>; update?: (request: HandoffUpdate, context: TrustedDomainContext) => Promise<PortResult<U>> }
  readTopic?: (topicId: string, evidence: BusinessEvidenceRef, context: TrustedDomainContext) => Promise<PortResult<HotTopic>>
  revalidateUpdate?: (topic: HotTopic, source: BusinessEvidenceRef, context: TrustedDomainContext) => Promise<boolean>
}) {
  return {
    async prepare(selection: FollowupSelection, context: TrustedDomainContext): Promise<PortResult<HandoffRequest>> {
      if (!selection.noteId.trim() || !selection.sourceRef.trim() || !selection.action.trim() || !selection.owner.trim() || !selection.due.trim() || !["critical", "high", "normal"].includes(selection.priority)) return { status: "needs-input", reason: "followup-fields-required" }
      const source = await input.resolveNote(selection.sourceRef, selection.noteId, context)
      if (source.status !== "ok") return source
      if (source.value.sourceRef !== selection.sourceRef || source.value.evidence.refId !== selection.sourceRef || !source.value.stableSourceKey.trim()) return { status: "stale", reason: "followup-source-changed" }
      const correlation = digestSfValue({ sourceIdentity: source.value.stableSourceKey, noteId: selection.noteId })
      return { status: "ok", value: { sourceRef: selection.sourceRef, relationKey: `routine-handoff:${correlation}`, ...(selection.recipientRef ? { recipientRef: selection.recipientRef } : {}), intent: { correlationKey: `routine-action:${correlation}`, sourceRefs: [source.value.evidence], action: selection.action, owner: selection.owner, due: selection.due, priority: selection.priority, notes: selection.notes } } }
    },
    async confirm(request: HandoffRequest, context: TrustedDomainContext): Promise<PortResult<T>> {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      return input.handoff.create(request, context)
    },
    async prepareUpdate(selection: { noteId: string; sourceRef: string; topicId: string; values: UpdateValues; recipientRef?: string }, context: TrustedDomainContext) {
      if (!input.readTopic || !input.revalidateUpdate || !input.handoff.update) return { status: "unavailable", reason: "handoff-update-unavailable" } as const
      if (!selection.noteId.trim() || !selection.sourceRef.trim() || !selection.topicId.trim() || !selection.values || typeof selection.values !== "object" || Array.isArray(selection.values) || !Object.keys(selection.values).length || Object.values(selection.values).some((value) => typeof value !== "string" || !value.trim()) || (selection.values.priority !== undefined && !["critical", "high", "normal"].includes(selection.values.priority)) || Object.keys(selection.values).some((key) => !["action", "owner", "due", "priority"].includes(key))) return { status: "needs-input", reason: "followup-fields-required" } as const
      const source = await input.resolveNote(selection.sourceRef, selection.noteId, context)
      if (source.status !== "ok") return source
      if (source.value.sourceRef !== selection.sourceRef || source.value.evidence.refId !== selection.sourceRef || !source.value.stableSourceKey.trim()) return { status: "stale", reason: "followup-source-changed" } as const
      const topic = await input.readTopic(selection.topicId, source.value.evidence, context)
      if (topic.status !== "ok") return topic
      if (topic.value.id !== selection.topicId || !await input.revalidateUpdate(topic.value, source.value.evidence, context)) return { status: "denied", reason: "handoff-access-unavailable" } as const
      const correlation = digestSfValue({ sourceIdentity: source.value.stableSourceKey, noteId: selection.noteId, topicId: topic.value.id, version: topic.value.version })
      const request: HandoffUpdate = { topicId: topic.value.id, expectedVersion: topic.value.version, idempotencyKey: `routine-update:${correlation}`, values: { ...selection.values }, sourceRefs: [source.value.evidence], sourceRef: selection.sourceRef, ...(selection.recipientRef ? { recipientRef: selection.recipientRef } : {}), relationKey: `routine-update-link:${correlation}` }
      return { status: "ok", value: { before: topic.value, after: { ...topic.value, ...request.values }, request } } as const
    },
    async confirmUpdate(request: HandoffUpdate, context: TrustedDomainContext): Promise<PortResult<U>> {
      if (context.kind !== "ui") return { status: "denied", reason: "human-handoff-required" }
      if (!input.handoff.update) return { status: "unavailable", reason: "handoff-update-unavailable" }
      return input.handoff.update(request, context)
    },
  }
}
