import { createHotTopicPort } from "../dashboard/hot-topics.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createCollaborationMutationFence } from "./mutation-fence.ts"
import { createCollaborationAuthority } from "./authority.ts"
import type { CollaborationRecipientAuthority } from "./recipient-authority.ts"
import { createCollaborationHotTopicHost } from "./hot-topic-host.ts"
import { createCollaborationHotTopicReadHost } from "./hot-topic-read-host.ts"
import { createRelationPort } from "./relations.ts"
import { createHandoffRelationProjection } from "./handoff-relation.ts"
import type { WorkReviewContexts } from "./work-review-context.ts"
import { createThreadPort } from "./threads.ts"
import { createHandoffPort } from "./handoff.ts"
import { createCollaborationWorkPort } from "./work-port.ts"
import type { ConfirmationWork, WorkSignals } from "./work-port.ts"
import type { createProcurementPort } from "../procurement/port.ts"
import type { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import type { createRecipientThreadReader } from "./recipient-thread.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { WorkSelectionPort } from "./selection.ts"
import type { AnswerWork } from "./answer-work.ts"
import type { CollaborationWorkSourceRefresh } from "./work-source-refresh.ts"

/** The source producer must issue a current authorized C17 record for the exact action. */
export function createCollaborationComposition(input: {
  host: DomainPortHost
  state: SfProductStatePort
  creationTarget: { ref: string; incarnation: string }
  evidence: BusinessContextService
  recordEvidence: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "issue">
  procurement: Pick<ReturnType<typeof createProcurementPort>, "list">
  selections: WorkSelectionPort
  signals?: WorkSignals
  reviewContexts?: WorkReviewContexts
  human: CollaborationHumanAuthority
  recipientAuthority?: CollaborationRecipientAuthority
  recipientThread?: ReturnType<typeof createRecipientThreadReader>
  reissue?: ReturnType<typeof createCollaborationReissuer>
  captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  confirmationWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationWork>>
  answerWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<AnswerWork>>
  refreshWorkSource?: CollaborationWorkSourceRefresh
  createId: () => string
  now: () => string
}) {
  const mutationFence = createCollaborationMutationFence(input.host)
  const authority = createCollaborationAuthority({ host: input.host, evidence: input.evidence, recipientAuthority: input.recipientAuthority })
  const activeHandoffs = new WeakMap<TrustedDomainContext, Parameters<Parameters<typeof createHandoffPort>[0]["run"]>[1]>()
  const handoffPermit = Symbol("handoff")
  const hotTopicWriter = createHotTopicPort(createCollaborationHotTopicHost({ host: input.host, state: input.state, evidence: input.evidence, creationTarget: input.creationTarget, mutationFence, authorizeMutation: async (context) => {
    const request = activeHandoffs.get(context)
    if (!request || !await input.human.authorize(context, "collaboration.handoff.confirm", request)) return false
    const refs = "intent" in request ? request.intent.sourceRefs : request.sourceRefs
    return !request.recipientRef || authority.checkRecipientAtCommit(request.recipientRef, refs, context)
  } }))
  const hotTopicReader = createHotTopicPort(createCollaborationHotTopicReadHost({ host: input.host, state: input.state, evidence: input.evidence, mutationFence }))
  const hotTopics = { create: hotTopicWriter.create, update: hotTopicWriter.update, read: hotTopicReader.read }
  const topicSource = { issue: async (topic: HotTopic, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "topic-source-unavailable" }
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "clock-unavailable" }
    const day = new Date(environment.at).toISOString().slice(0, 10)
    return input.recordEvidence.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: topic.id, fields: ["status"], period: { start: day, end: day } }, context)
  } }
  const relations = createRelationPort({ state: input.state, host: input.host, createId: input.createId, now: input.now, authorizePair: authority.authorizePair, checkRecipientAtCommit: authority.checkRecipientAtCommit, creationTarget: input.creationTarget, human: input.human, mutationFence, reissue: input.reissue, projectHandoff: createHandoffRelationProjection({ host: input.host, authorizeSources: authority.sources, reissue: input.reissue, readTopic: hotTopics.read, issueTopic: topicSource.issue }), handoffPermit })
  const threads = createThreadPort({ state: input.state, host: input.host, createId: input.createId, now: input.now, authorize: authority.authorizeThread, checkRecipientAtCommit: authority.checkRecipientAtCommit, creationTarget: input.creationTarget, human: input.human, mutationFence })
  const handoff = createHandoffPort({ hotTopics, relations, human: input.human, permit: handoffPermit, run: async (context, request, work) => {
    if (activeHandoffs.has(context)) return { status: "conflict", reason: "handoff-in-progress" }
    activeHandoffs.set(context, request)
    try { return await work() } finally { activeHandoffs.delete(context) }
  }, authorizeIntent: authority.authorizeIntent, authorizeUpdate: async (request, context) => {
    if (request.values.notes?.trim() || !await authority.sources(request.sourceRefs, context)) return false
    const topic = await hotTopics.read(request.topicId, request.sourceRefs, context)
    if (topic.status !== "ok") return false
    const owner = request.values.owner ?? topic.value.owner
    if (!request.recipientRef) return !owner.trim()
    const person = await authority.recipient(request.recipientRef, context)
    return !!person && person.name === owner && await authority.recipientSources(person.id, request.sourceRefs, context)
  }, resolveTopic: async (topic, context) => {
    const issued = await topicSource.issue(topic, context)
    if (issued.status !== "ok") return issued
    const ref = issued.value
    if (ref.target.surface !== "dashboard" || ref.target.recordType !== "hotTopics" || ref.target.recordId !== topic.id || !await authority.sources([ref], context)) return { status: "unavailable", reason: "topic-source-unavailable" }
    return { status: "ok", value: { ref: ref.refId, evidence: ref } }
  } })
  const work = createCollaborationWorkPort({ host: input.host, state: input.state, collaboration: { authority, hotTopics, threads, recipientThread: input.recipientThread, reissue: input.reissue, captureWorkSource: input.captureWorkSource, confirmationWork: input.confirmationWork, answerWork: input.answerWork, refreshWorkSource: input.refreshWorkSource }, procurement: input.procurement, topicSource, selections: input.selections, signals: input.signals, reviewContexts: input.reviewContexts })
  return { authority, hotTopics: { read: hotTopics.read }, relations: { read: relations.read, create: relations.create, remove: relations.remove, storageVersion: relations.storageVersion, readVersioned: relations.readVersioned }, threads, handoff, work }
}


