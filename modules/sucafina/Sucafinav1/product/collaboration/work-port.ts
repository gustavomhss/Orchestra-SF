import { object } from "../../runtime/contract.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmationValidityProjection, Period } from "../contracts/context.ts"
import type { WorkListRequest } from "../contracts/operations.ts"
import type { AuthorizedWorkList } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementPort } from "../procurement/port.ts"
import type { HotTopic, createHotTopicPort } from "../dashboard/hot-topics.ts"
import type { createCollaborationAuthority } from "./authority.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import type { createRecipientThreadReader } from "./recipient-thread.ts"
import type { createThreadPort } from "./threads.ts"
import type { WorkSelectionPort } from "./selection.ts"
import { projectMyWork } from "./work.ts"
import { latestConfirmationWork } from "./confirmation-work.ts"
import { sameHandoffWorkSource } from "./work-handoff-source.ts"
import type { AnswerWork } from "./answer-work.ts"
import type { CollaborationWorkSourceRefresh } from "./work-source-refresh.ts"
import type { ReviewActionContext } from "../reviews/closure-action.ts"
import type { ReviewThreadContext } from "../reviews/thread-context.ts"
import { readWorkReviewContexts } from "./work-review-context.ts"
import type { WorkReviewContexts } from "./work-review-context.ts"

export type WorkPresentationItem = {
  kind: "clarification" | "handoff" | "procurement" | "confirmation" | "signal"
  actionRef: string
  title: string | null
  ownerRef: string
  ownerLabel?: string
  approvalStage?: string
  reason?: string
  due?: string
  period?: Period
  sourceVersion?: number
  observedVersion?: number
  state: string
  destination?: { kind: "thread"; threadId: string } | { kind: "hot-topic"; topicId: string } | { kind: "procurement-request"; recordId: string; incarnation: string } | { kind: "confirmation"; confirmationId: string } | { kind: "signal"; ref: string }
  sourceRefs: readonly BusinessEvidenceRef[]
  reviewContexts?: readonly ReviewActionContext[]
  reviewContext?: ReviewThreadContext
}

export type ConfirmationWork = { state: "valid" | "stale"; reason?: ConfirmationValidityProjection["reason"]; sourceRefs: readonly BusinessEvidenceRef[]; period: Period; observedVersion: number; sourceVersion?: number }
export type WorkSignals = (selectionRef: string, period: Period, context: TrustedDomainContext) => Promise<{ status: "ok"; signals: readonly { workRef: string; label: string; impact: { state: string; reason: string }; recipientRef: string; destination: string; sourceRefs: readonly BusinessEvidenceRef[] }[] } | { status: "unavailable" }>

/** Projects canonical producers on every read; it never stores operational status. */
export function createCollaborationWorkPort(input: {
  host: DomainPortHost
  state: SfProductStatePort
  collaboration: { authority: ReturnType<typeof createCollaborationAuthority>; hotTopics: ReturnType<typeof createHotTopicPort>; threads: ReturnType<typeof createThreadPort>; recipientThread?: ReturnType<typeof createRecipientThreadReader>; reissue?: ReturnType<typeof createCollaborationReissuer>; refreshWorkSource?: CollaborationWorkSourceRefresh; captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>; confirmationWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationWork>>; answerWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<AnswerWork>> }
  procurement: Pick<ReturnType<typeof createProcurementPort>, "list">
  selections: WorkSelectionPort
  signals?: WorkSignals
  reviewContexts?: WorkReviewContexts
  topicSource: { issue: (topic: HotTopic, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> }
}) {
  const collect = async (selection: WorkListRequest, context: TrustedDomainContext): Promise<PortResult<{ list: AuthorizedWorkList; presentation: readonly WorkPresentationItem[] }>> => {
      if (!selection || typeof selection.selectionRef !== "string" || !selection.selectionRef.trim() || !isSfPeriod(selection.period)) return { status: "needs-input", reason: "invalid-work-selection" }
      const selected = structuredClone(selection)
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "work-access-unavailable" }
      const scope = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (scope.status !== "ok") return scope
      const own = context.binding.principalRef
      const [threads, relations, confirmations] = await Promise.all([
        input.state.read(request, "threads", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.threads).map(([id, value]) => ({ id, recipientRef: object(value).recipientRef, state: object(value).state })) : undefined),
        input.state.read(request, "relations", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.relations : undefined),
        input.state.read(request, "confirmations", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.confirmations).filter((record) => record.authorId === own) : undefined),
      ])
      if ([threads, relations, confirmations].some((result) => result.status !== "ok" && !(result.status === "unavailable" && result.reason === "product-state-uninitialized"))) return { status: "unavailable", reason: "work-state-unavailable" }
      const threadIds = threads.status === "ok" ? threads.value : []
      const relationData = relations.status === "ok" ? relations.value : {}
      const confirmationRecords = confirmations.status === "ok" ? confirmations.value : []
      const confirmationScopes = confirmationRecords && latestConfirmationWork(confirmationRecords)
      if (!threadIds || !relationData || !confirmationScopes) return { status: "denied", reason: "work-access-unavailable" }
      if (confirmationScopes.length && !input.collaboration.confirmationWork) return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const items: AuthorizedWorkList["items"][number][] = []
      const presentation: WorkPresentationItem[] = []
      const presentationProofs: BusinessEvidenceRef[] = []
      const answerProofs: { id: string; value: AnswerWork }[] = []
      const reviewProofs: { topicId: string; value: readonly ReviewActionContext[] }[] = []
      const discussionProofs: { id: string; pin: ReviewThreadContext }[] = []
      if (selected.selectionRef.startsWith("sf:case-work-selection:") && !input.signals) return { status: "unavailable", reason: "work-signals-unavailable" }
      const signals = input.signals && selected.selectionRef.startsWith("sf:case-work-selection:") ? await input.signals(selected.selectionRef, selected.period, context) : undefined
      if (signals && signals.status !== "ok") return { status: "unavailable", reason: "work-signals-unavailable" }
      const signalItems = signals?.status === "ok" ? signals.signals : []
      if (new Set(signalItems.map((signal) => signal.workRef)).size !== signalItems.length) return { status: "unavailable", reason: "work-signals-unavailable" }
      for (const signal of signalItems) {
        if (!signal.workRef.trim() || !signal.label.trim() || !signal.destination.trim() || signal.recipientRef !== own || !signal.sourceRefs.length || !await input.collaboration.authority.sources(signal.sourceRefs, context)) return { status: "unavailable", reason: "work-signals-unavailable" }
        const actionRef = `sf-signal:${signal.workRef}`
        items.push({ actionRef, ownerRef: own, state: signal.impact.state, sourceRefs: signal.sourceRefs })
        presentation.push({ kind: "signal", actionRef, title: signal.label, ownerRef: own, period: selected.period, reason: signal.impact.reason, state: signal.impact.state, destination: { kind: "signal", ref: signal.destination }, sourceRefs: signal.sourceRefs })
      }
      for (const { actionRef, record } of confirmationScopes) {
        const confirmation = await input.collaboration.confirmationWork!(record.id, context)
        if (confirmation.status !== "ok") return confirmation
        if (confirmation.value.state === "valid") continue
        const membership = await input.selections.contains(scope.value, confirmation.value.sourceRefs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        items.push({ actionRef, ownerRef: own, state: "confirmation-stale", sourceRefs: confirmation.value.sourceRefs })
        presentation.push({ kind: "confirmation", actionRef, title: null, ownerRef: own, period: confirmation.value.period, observedVersion: confirmation.value.observedVersion, ...(confirmation.value.reason ? { reason: confirmation.value.reason } : {}), ...(confirmation.value.sourceVersion === undefined ? {} : { sourceVersion: confirmation.value.sourceVersion }), state: "confirmation-stale", destination: { kind: "confirmation", confirmationId: record.id }, sourceRefs: confirmation.value.sourceRefs })
      }
      for (const entry of threadIds) {
        if (entry.recipientRef !== own) continue
        if (entry.state !== "open" && entry.state !== "resolved") return { status: "unavailable", reason: "thread-work-source-unavailable" }
        const id = entry.id
        const answer = input.collaboration.answerWork ? await input.collaboration.answerWork(id, context) : undefined
        if (answer && answer.status !== "ok") return { status: "unavailable", reason: "answer-work-source-unavailable" }
        if (answer?.status === "ok") answerProofs.push({ id, value: answer.value })
        if (answer?.status === "ok" && answer.value.state === "valid") continue
        if (answer?.status === "ok" && answer.value.state === "stale") {
          const current = answer.value
          if (current.period.end < selected.period.start || current.period.start > selected.period.end) continue
          const recipient = current.reviewContext && input.collaboration.recipientThread ? await input.collaboration.recipientThread(id, context) : undefined
          if (current.reviewContext && (recipient?.status !== "ok" || digestSfValue(recipient.value.messages[0]?.sourceContext?.reviewContext) !== digestSfValue(current.reviewContext))) return { status: "unavailable", reason: "review-thread-context-unavailable" }
          const refs = recipient?.status === "ok" ? recipient.value.current.evidenceRefs : current.sourceRefs
          const membership = await input.selections.contains(scope.value, refs, context)
          if (membership.status !== "ok") return membership
          if (!membership.value) continue
          if (current.reviewContext) discussionProofs.push({ id, pin: structuredClone(current.reviewContext) })
          items.push({ actionRef: id, ownerRef: own, state: "answer-stale", sourceRefs: refs })
          presentation.push({ kind: "clarification", actionRef: id, title: null, ownerRef: own, period: current.period, observedVersion: current.observedVersion, sourceVersion: current.sourceVersion, ...(current.reason ? { reason: current.reason } : {}), state: "answer-stale", destination: { kind: "thread", threadId: id }, sourceRefs: refs, ...(current.reviewContext ? { reviewContext: current.reviewContext } : {}) })
          continue
        }
        if (entry.state === "resolved") continue
        const thread = await input.collaboration.threads.read(id, context)
        const reviewContext = thread.status === "ok" ? thread.value.messages[0]?.sourceContext?.reviewContext : undefined
        const recipient = (thread.status !== "ok" || !!reviewContext) && input.collaboration.recipientThread ? await input.collaboration.recipientThread(id, context) : undefined
        const value = recipient?.status === "ok" ? { ...recipient.value, period: recipient.value.observed.period, observedVersion: recipient.value.observed.version, evidenceRefs: recipient.value.current.evidenceRefs } : thread.status === "ok" && !reviewContext ? thread.value : undefined
        if (!value) return { status: "unavailable", reason: "thread-work-source-unavailable" }
        if (value.state !== "open" || value.recipientRef !== own || value.period.end < selected.period.start || value.period.start > selected.period.end) continue
        const membership = await input.selections.contains(scope.value, value.evidenceRefs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        const pinned = value.messages[0]?.sourceContext?.reviewContext
        if (pinned) discussionProofs.push({ id, pin: structuredClone(pinned) })
        items.push({ actionRef: value.id, ownerRef: own, state: "clarification-open", sourceRefs: value.evidenceRefs })
        presentation.push({ kind: "clarification", actionRef: value.id, title: value.messages[0]?.body ?? null, ownerRef: own, period: value.period, observedVersion: value.observedVersion, state: "clarification-open", destination: { kind: "thread", threadId: value.id }, sourceRefs: value.evidenceRefs, ...(pinned ? { reviewContext: pinned } : {}) })
      }
      for (const [key, raw] of Object.entries(relationData)) {
        if (!key.startsWith("sf:assignment:")) continue
        const assignment = object(raw)
        if (assignment.recipientRef !== own || typeof assignment.relationId !== "string" || key !== `sf:assignment:${assignment.relationId}`) continue
        const relation = object(relationData[assignment.relationId])
        if (relation.kind !== "handoff" || typeof relation.toRef !== "string" || !Array.isArray(relation.evidenceRefs)) return { status: "unavailable", reason: "invalid-work-source" }
        const original = relation.evidenceRefs as BusinessEvidenceRef[]
        const targetIndex = original.findIndex((ref) => ref.refId === relation.toRef && ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "hotTopics")
        if (targetIndex < 0 || original.filter((ref) => ref.refId === relation.toRef).length !== 1) return { status: "unavailable", reason: "invalid-work-source" }
        const target = original[targetIndex]
        if (!target || target.kind !== "record") return { status: "unavailable", reason: "invalid-work-source" }
        const origins = original.filter((_, index) => index !== targetIndex)
        const available = await input.collaboration.authority.sources(origins, context)
        const refresh = input.collaboration.refreshWorkSource ?? input.collaboration.reissue
        const reissued = !available && refresh && origins.every((ref) => ref.kind === "record") ? await Promise.all(origins.map((ref) => refresh(ref as Extract<BusinessEvidenceRef, { kind: "record" }>, context))) : undefined
        if (!available && (!reissued || reissued.some((entry) => entry.status !== "ok"))) return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        const sourceRefs = available ? origins : reissued!.flatMap((entry) => entry.status === "ok" ? [entry.value] : [])
        const membership = await input.selections.contains(scope.value, sourceRefs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        const topic = await input.collaboration.hotTopics.read(target.target.recordId, sourceRefs, context)
        if (topic.status !== "ok") return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        const current = await input.topicSource.issue(topic.value, context)
        if (current.status !== "ok" || current.value.target.recordId !== topic.value.id || !await input.collaboration.authority.sources([current.value], context) || !await sameHandoffWorkSource(input.host, target, current.value, context)) return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        const reviews = input.reviewContexts ? await readWorkReviewContexts(input.reviewContexts, topic.value.id, context) : undefined
        if (reviews && reviews.status !== "ok") return { status: "unavailable", reason: "work-review-context-unavailable" }
        if (reviews?.status === "ok") reviewProofs.push({ topicId: topic.value.id, value: reviews.value })
        items.push({ actionRef: current.value.refId, ownerRef: own, state: topic.value.status, sourceRefs: [...sourceRefs, current.value] })
        presentation.push({ kind: "handoff", actionRef: current.value.refId, title: topic.value.action || null, ownerRef: own, ...(topic.value.due.trim() ? { due: topic.value.due } : {}), ...(current.value.target.period ? { period: current.value.target.period } : {}), sourceVersion: current.value.target.version, state: topic.value.status, destination: { kind: "hot-topic", topicId: topic.value.id }, sourceRefs: [...sourceRefs, current.value], ...(reviews?.status === "ok" ? { reviewContexts: reviews.value } : {}) })
      }
      const procurement = scope.value.procurement.state === "selected" ? await input.procurement.list(scope.value.procurement.selectionRef, context) : { status: "ok" as const, value: { aging: [] } }
      if (procurement.status !== "ok") return procurement
      for (const projection of procurement.value.aging) {
        if (projection.context.surface !== "procurement" || projection.context.principalRef !== own || projection.context.installationId !== context.binding.installationId || projection.context.projectId !== context.binding.projectId || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        if (projection.context.period.start !== selected.period.start || projection.context.period.end !== selected.period.end) return { status: "unavailable", reason: "work-period-mismatch" }
        const holder = projection.values.find((value) => value.id === "holder")
        const status = projection.values.find((value) => value.id === "status")
        if (holder?.value !== own || typeof status?.value !== "string") continue
        const refs = holder.sourceRefs
        if (!refs.length || !await input.collaboration.authority.sources(refs, context)) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        const target = refs[0]
        if (!target || target.kind !== "record" || target.target.surface !== "procurement" || target.target.recordType !== "procurement-request") return { status: "unavailable", reason: "work-destination-unavailable" }
        const displayed = projection.values.filter((value) => ["holder", "status", "subject", "approvalStage"].includes(value.id) && value.value !== null)
        const displayedRefs = displayed.flatMap((value) => value.sourceRefs)
        if (new Set(displayed.map((value) => value.id)).size !== displayed.length || displayed.some((value) => !value.sourceRefs.length || value.sourceRefs.some((ref) => ref.kind !== "record" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" || ref.target.recordId !== target.target.recordId || !ref.target.fields.includes(value.id))) || !await input.collaboration.authority.sources(displayedRefs, context)) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        presentationProofs.push(...displayedRefs)
        const subject = projection.values.find((value) => value.id === "subject")?.value
        const approvalStage = projection.values.find((value) => value.id === "approvalStage")
        if (typeof approvalStage?.value === "string" && (!approvalStage.sourceRefs.length || !await input.collaboration.authority.sources(approvalStage.sourceRefs, context))) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        if (typeof approvalStage?.value === "string") presentationProofs.push(...approvalStage.sourceRefs)
        const captured = input.collaboration.captureWorkSource ? await input.collaboration.captureWorkSource(target.refId, context) : undefined
        if (captured && (captured.status !== "ok" || !await input.collaboration.authority.sources([captured.value], context))) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        const individual = captured?.status === "ok" ? captured.value : undefined
        if (individual && (individual.target.surface !== "procurement" || individual.target.recordType !== "procurement-request" || individual.target.recordId !== target.target.recordId || digestSfValue(individual.target.period) !== digestSfValue(projection.context.period))) return { status: "unavailable", reason: "work-destination-unavailable" }
        if (individual) presentationProofs.push(individual)
        items.push({ actionRef: target.refId, ownerRef: own, state: status.value, sourceRefs: refs })
        presentation.push({ kind: "procurement", actionRef: target.refId, title: typeof subject === "string" && subject.trim() ? subject : null, ownerRef: own, ...(typeof approvalStage?.value === "string" && approvalStage.value.trim() ? { approvalStage: approvalStage.value } : {}), period: projection.context.period, ...(individual ? { sourceVersion: individual.target.version, destination: { kind: "procurement-request" as const, recordId: individual.target.recordId, incarnation: individual.target.incarnation } } : {}), state: status.value, sourceRefs: refs })
      }
      const after = await Promise.all((["threads", "relations", "confirmations"] as const).map((namespace) => input.state.read(request, namespace, (_state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)))
      const before = [threads, relations, confirmations]
      if (after.some((result, index) => {
        const prior = before[index]
        if (result.status === "unavailable" && result.reason === "product-state-uninitialized") return prior?.status === "ok"
        if (result.status !== "ok" || !result.value) return true
        return result.storageVersion !== (prior?.status === "ok" ? prior.storageVersion : 0)
      })) return { status: "stale", reason: "work-state-changed" }
      const signalRefs = new Set(signalItems.map((signal) => `sf-signal:${signal.workRef}`))
      if (items.filter((item) => signalRefs.has(item.actionRef)).length !== signalItems.length) return { status: "unavailable", reason: "work-signal-identity-conflict" }
      const checks = await Promise.all(items.map((item) => signalRefs.has(item.actionRef) ? Promise.resolve({ status: "ok" as const, value: true }) : input.selections.contains(scope.value, item.sourceRefs, context)))
      const signalsAgain = signals && input.signals ? await input.signals(selected.selectionRef, selected.period, context) : undefined
      if (signals && (!signalsAgain || signalsAgain.status !== "ok" || digestSfValue(signalsAgain.signals) !== digestSfValue(signalItems))) return { status: "stale", reason: "work-signals-changed" }
      const current = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(scope.value)) return { status: "stale", reason: "work-selection-changed" }
      if (checks.some((result) => result.status !== "ok" || !result.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-or-selection-changed" }
      const result = projectMyWork(own, items)
      if (result.status !== "ok") return result
      const entries = result.value.items.map((item) => {
        const matches = presentation.filter((entry) => entry.actionRef === item.actionRef)
        const first = matches[0]
        if (!first || matches.some((entry) => entry.kind !== first.kind || entry.title !== first.title || entry.approvalStage !== first.approvalStage || entry.reason !== first.reason || entry.due !== first.due || entry.sourceVersion !== first.sourceVersion || entry.observedVersion !== first.observedVersion || digestSfValue(entry.period) !== digestSfValue(first.period) || digestSfValue(entry.destination) !== digestSfValue(first.destination) || digestSfValue(entry.reviewContexts) !== digestSfValue(first.reviewContexts) || digestSfValue(entry.reviewContext) !== digestSfValue(first.reviewContext))) return undefined
        return { ...first, sourceRefs: item.sourceRefs }
      })
      if (entries.some((item) => !item)) return { status: "stale", reason: "work-presentation-conflict" }
      const directory = (await input.host.environment(request)).directory.filter((person) => person.id === own && !!person.name.trim())
      const sourceChecks = await Promise.all(result.value.items.map((item) => input.collaboration.authority.sources(item.sourceRefs, context)))
      const finalSelection = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (finalSelection.status !== "ok" || digestSfValue(finalSelection.value) !== digestSfValue(scope.value)) return { status: "stale", reason: "work-selection-changed" }
      if (sourceChecks.some((allowed) => !allowed) || (presentationProofs.length > 0 && !await input.collaboration.authority.sources(presentationProofs, context)) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-or-selection-changed" }
      const answersAgain = await Promise.all(answerProofs.map((proof) => input.collaboration.answerWork!(proof.id, context)))
      if (answersAgain.some((answer) => answer.status !== "ok")) return { status: "unavailable", reason: "answer-work-source-unavailable" }
      if (answersAgain.some((answer, index) => answer.status === "ok" && digestSfValue(answer.value) !== digestSfValue(answerProofs[index]!.value))) return { status: "stale", reason: "answer-work-changed" }
      const reviewsAgain = await Promise.all(reviewProofs.map((proof) => readWorkReviewContexts(input.reviewContexts!, proof.topicId, context)))
      if (reviewsAgain.some((review) => review.status !== "ok")) return { status: "unavailable", reason: "work-review-context-unavailable" }
      if (reviewsAgain.some((review, index) => review.status === "ok" && digestSfValue(review.value) !== digestSfValue(reviewProofs[index]!.value))) return { status: "stale", reason: "work-review-context-changed" }
      const discussionsAgain = await Promise.all(discussionProofs.map((proof) => input.collaboration.recipientThread!(proof.id, context)))
      if (discussionsAgain.some((entry, index) => entry.status !== "ok" || digestSfValue(entry.value.messages[0]?.sourceContext?.reviewContext) !== digestSfValue(discussionProofs[index]!.pin))) return { status: "unavailable", reason: "review-thread-context-unavailable" }
      const finalState = await Promise.all((["threads", "relations", "confirmations"] as const).map((namespace) => input.state.read(request, namespace, (_state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)))
      if (finalState.some((entry, index) => {
        const prior = before[index]
        if (entry.status === "unavailable" && entry.reason === "product-state-uninitialized") return prior?.status === "ok"
        return entry.status !== "ok" || !entry.value || entry.storageVersion !== (prior?.status === "ok" ? prior.storageVersion : 0)
      }) || !await input.host.revalidate(context)) return { status: "stale", reason: "work-state-changed" }
      return { status: "ok", value: { list: result.value, presentation: entries.filter((item): item is WorkPresentationItem => !!item).map((item) => directory.length === 1 ? { ...item, ownerLabel: directory[0]!.name } : item) } }
  }
  return {
    list: async (selection: WorkListRequest, context: TrustedDomainContext): Promise<PortResult<AuthorizedWorkList>> => {
      const result = await collect(selection, context)
      return result.status === "ok" ? { status: "ok", value: result.value.list } : result
    },
    listPresentation: async (selection: WorkListRequest, context: TrustedDomainContext): Promise<PortResult<{ list: AuthorizedWorkList; items: readonly WorkPresentationItem[] }>> => {
      const result = await collect(selection, context)
      return result.status === "ok" ? { status: "ok", value: { list: result.value.list, items: result.value.presentation } } : result
    },
  }
}


