import { object } from "../../runtime/contract.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
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

export type WorkPresentationItem = {
  kind: "clarification" | "handoff" | "procurement" | "confirmation"
  actionRef: string
  title: string | null
  ownerRef: string
  ownerLabel?: string
  due?: string
  period?: Period
  sourceVersion?: number
  observedVersion?: number
  state: string
  destination?: { kind: "thread"; threadId: string } | { kind: "hot-topic"; topicId: string } | { kind: "procurement-request"; recordId: string; incarnation: string } | { kind: "confirmation"; confirmationId: string }
  sourceRefs: readonly BusinessEvidenceRef[]
}

export type ConfirmationWork = { state: "valid" | "stale"; sourceRefs: readonly BusinessEvidenceRef[]; period: Period; observedVersion: number; sourceVersion?: number }

/** Projects canonical producers on every read; it never stores operational status. */
export function createCollaborationWorkPort(input: {
  host: DomainPortHost
  state: SfProductStatePort
  collaboration: { authority: ReturnType<typeof createCollaborationAuthority>; hotTopics: ReturnType<typeof createHotTopicPort>; threads: ReturnType<typeof createThreadPort>; recipientThread?: ReturnType<typeof createRecipientThreadReader>; reissue?: ReturnType<typeof createCollaborationReissuer>; captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>; confirmationWork?: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationWork>> }
  procurement: Pick<ReturnType<typeof createProcurementPort>, "list">
  selections: WorkSelectionPort
  topicSource: { issue: (topic: HotTopic, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> }
}) {
  const collect = async (selection: WorkListRequest, context: TrustedDomainContext): Promise<PortResult<{ list: AuthorizedWorkList; presentation: readonly WorkPresentationItem[] }>> => {
      if (!selection.selectionRef.trim() || !isSfPeriod(selection.period)) return { status: "needs-input", reason: "invalid-work-selection" }
      const selected = structuredClone(selection)
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "work-access-unavailable" }
      const scope = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (scope.status !== "ok") return scope
      const own = context.binding.principalRef
      const [threads, relations, confirmations] = await Promise.all([
        input.state.read(request, "threads", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.threads).map(([id, value]) => ({ id, recipientRef: object(value).recipientRef, state: object(value).state })) : undefined),
        input.state.read(request, "relations", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.relations : undefined),
        input.state.read(request, "confirmations", (state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.confirmations).filter((record) => record.authorId === own).map((record) => record.id) : undefined),
      ])
      if ([threads, relations, confirmations].some((result) => result.status !== "ok" && !(result.status === "unavailable" && result.reason === "product-state-uninitialized"))) return { status: "unavailable", reason: "work-state-unavailable" }
      const threadIds = threads.status === "ok" ? threads.value : []
      const relationData = relations.status === "ok" ? relations.value : {}
      const confirmationIds = confirmations.status === "ok" ? confirmations.value : []
      if (!threadIds || !relationData || !confirmationIds) return { status: "denied", reason: "work-access-unavailable" }
      if (confirmationIds.length && !input.collaboration.confirmationWork) return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const items: AuthorizedWorkList["items"][number][] = []
      const presentation: WorkPresentationItem[] = []
      const presentationProofs: BusinessEvidenceRef[] = []
      for (const id of confirmationIds) {
        const confirmation = await input.collaboration.confirmationWork!(id, context)
        if (confirmation.status !== "ok") return confirmation
        if (confirmation.value.state === "valid") continue
        const membership = await input.selections.contains(scope.value, confirmation.value.sourceRefs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        items.push({ actionRef: id, ownerRef: own, state: "confirmation-stale", sourceRefs: confirmation.value.sourceRefs })
        presentation.push({ kind: "confirmation", actionRef: id, title: null, ownerRef: own, period: confirmation.value.period, observedVersion: confirmation.value.observedVersion, ...(confirmation.value.sourceVersion === undefined ? {} : { sourceVersion: confirmation.value.sourceVersion }), state: "confirmation-stale", destination: { kind: "confirmation", confirmationId: id }, sourceRefs: confirmation.value.sourceRefs })
      }
      for (const entry of threadIds) {
        if (entry.recipientRef !== own || entry.state === "resolved") continue
        if (entry.state !== "open") return { status: "unavailable", reason: "thread-work-source-unavailable" }
        const id = entry.id
        const thread = await input.collaboration.threads.read(id, context)
        const recipient = thread.status !== "ok" && input.collaboration.recipientThread ? await input.collaboration.recipientThread(id, context) : undefined
        const value = thread.status === "ok" ? thread.value : recipient?.status === "ok" ? { ...recipient.value, period: recipient.value.observed.period, observedVersion: recipient.value.observed.version, evidenceRefs: recipient.value.current.evidenceRefs } : undefined
        if (!value) return { status: "unavailable", reason: "thread-work-source-unavailable" }
        if (value.state !== "open" || value.recipientRef !== own || value.period.end < selected.period.start || value.period.start > selected.period.end) continue
        const membership = await input.selections.contains(scope.value, value.evidenceRefs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        items.push({ actionRef: value.id, ownerRef: own, state: "clarification-open", sourceRefs: value.evidenceRefs })
        presentation.push({ kind: "clarification", actionRef: value.id, title: value.messages[0]?.body ?? null, ownerRef: own, period: value.period, observedVersion: value.observedVersion, state: "clarification-open", destination: { kind: "thread", threadId: value.id }, sourceRefs: value.evidenceRefs })
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
        const available = await input.collaboration.authority.sources(original, context)
        const reissued = !available && input.collaboration.reissue && original.every((ref) => ref.kind === "record") ? await Promise.all(original.map((ref) => input.collaboration.reissue!(ref as Extract<BusinessEvidenceRef, { kind: "record" }>, context))) : undefined
        if (!available && (!reissued || reissued.some((entry) => entry.status !== "ok"))) return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        const refs = available ? original : reissued!.flatMap((entry) => entry.status === "ok" ? [entry.value] : [])
        const membership = await input.selections.contains(scope.value, refs, context)
        if (membership.status !== "ok") return membership
        if (!membership.value) continue
        const target = refs[targetIndex]
        if (!target || target.kind !== "record") return { status: "unavailable", reason: "invalid-work-source" }
        const sourceRefs = refs.filter((_, index) => index !== targetIndex)
        const topic = await input.collaboration.hotTopics.read(target.target.recordId, sourceRefs, context)
        if (topic.status !== "ok") return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        const current = await input.topicSource.issue(topic.value, context)
        if (current.status !== "ok" || current.value.target.recordId !== topic.value.id || !await input.collaboration.authority.sources([current.value], context)) return { status: "unavailable", reason: "handoff-work-source-unavailable" }
        items.push({ actionRef: current.value.refId, ownerRef: own, state: topic.value.status, sourceRefs: [...sourceRefs, current.value] })
        presentation.push({ kind: "handoff", actionRef: current.value.refId, title: topic.value.action || null, ownerRef: own, ...(topic.value.due.trim() ? { due: topic.value.due } : {}), ...(current.value.target.period ? { period: current.value.target.period } : {}), sourceVersion: current.value.target.version, state: topic.value.status, destination: { kind: "hot-topic", topicId: topic.value.id }, sourceRefs: [...sourceRefs, current.value] })
      }
      const procurement = scope.value.procurement.state === "selected" ? await input.procurement.list(scope.value.procurement.selectionRef, context) : { status: "ok" as const, value: { aging: [] } }
      if (procurement.status !== "ok") return procurement
      for (const projection of procurement.value.aging) {
        if (projection.context.period.start !== selected.period.start || projection.context.period.end !== selected.period.end) return { status: "unavailable", reason: "work-period-mismatch" }
        const holder = projection.values.find((value) => value.id === "holder")
        const status = projection.values.find((value) => value.id === "status")
        if (holder?.value !== own || typeof status?.value !== "string") continue
        const refs = holder.sourceRefs
        if (!refs.length || !await input.collaboration.authority.sources(refs, context)) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        const target = refs[0]
        if (!target || target.kind !== "record" || target.target.surface !== "procurement" || target.target.recordType !== "procurement-request") return { status: "unavailable", reason: "work-destination-unavailable" }
        const subject = projection.values.find((value) => value.id === "subject")?.value
        const captured = input.collaboration.captureWorkSource ? await input.collaboration.captureWorkSource(target.refId, context) : undefined
        if (captured && (captured.status !== "ok" || !await input.collaboration.authority.sources([captured.value], context))) return { status: "unavailable", reason: "procurement-work-source-unavailable" }
        const individual = captured?.status === "ok" ? captured.value : undefined
        if (individual) presentationProofs.push(individual)
        items.push({ actionRef: target.refId, ownerRef: own, state: status.value, sourceRefs: refs })
        presentation.push({ kind: "procurement", actionRef: target.refId, title: typeof subject === "string" && subject.trim() ? subject : null, ownerRef: own, period: projection.context.period, ...(individual ? { sourceVersion: individual.target.version, destination: { kind: "procurement-request" as const, recordId: individual.target.recordId, incarnation: individual.target.incarnation } } : {}), state: status.value, sourceRefs: refs })
      }
      const after = await Promise.all((["threads", "relations", "confirmations"] as const).map((namespace) => input.state.read(request, namespace, (_state, authority) => authority.principalRef === own && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)))
      const before = [threads, relations, confirmations]
      if (after.some((result, index) => {
        const prior = before[index]
        if (result.status === "unavailable" && result.reason === "product-state-uninitialized") return prior?.status === "ok"
        if (result.status !== "ok" || !result.value) return true
        return result.storageVersion !== (prior?.status === "ok" ? prior.storageVersion : 0)
      })) return { status: "stale", reason: "work-state-changed" }
      const checks = await Promise.all(items.map((item) => input.selections.contains(scope.value, item.sourceRefs, context)))
      const current = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(scope.value)) return { status: "stale", reason: "work-selection-changed" }
      if (checks.some((result) => result.status !== "ok" || !result.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-or-selection-changed" }
      const result = projectMyWork(own, items)
      if (result.status !== "ok") return result
      const entries = result.value.items.map((item) => {
        const matches = presentation.filter((entry) => entry.actionRef === item.actionRef)
        const first = matches[0]
        if (!first || matches.some((entry) => entry.kind !== first.kind || entry.title !== first.title || entry.due !== first.due || entry.sourceVersion !== first.sourceVersion || entry.observedVersion !== first.observedVersion || digestSfValue(entry.period) !== digestSfValue(first.period) || digestSfValue(entry.destination) !== digestSfValue(first.destination))) return undefined
        return { ...first, sourceRefs: item.sourceRefs }
      })
      if (entries.some((item) => !item)) return { status: "stale", reason: "work-presentation-conflict" }
      const directory = (await input.host.environment(request)).directory.filter((person) => person.id === own && !!person.name.trim())
      const sourceChecks = await Promise.all(result.value.items.map((item) => input.collaboration.authority.sources(item.sourceRefs, context)))
      const finalSelection = await input.selections.resolve(selected.selectionRef, selected.period, context)
      if (finalSelection.status !== "ok" || digestSfValue(finalSelection.value) !== digestSfValue(scope.value)) return { status: "stale", reason: "work-selection-changed" }
      if (sourceChecks.some((allowed) => !allowed) || (presentationProofs.length > 0 && !await input.collaboration.authority.sources(presentationProofs, context)) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-or-selection-changed" }
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
