import { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../integration/dashboard-sources.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { ConfirmationCommand, ConfirmationScope, DomainProjection } from "../contracts/context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createProcurementPort } from "../procurement/port.ts"
import type { createProcurementCollectionRegistry } from "../procurement/sources.ts"
import { createWorkDestinationResolver } from "./destination.ts"
import { createCollaborationCycleView } from "./cycle-view.ts"
import type { WorkPresentationItem, WorkSignals } from "./work-port.ts"
import type { ConfirmationWork } from "./work-port.ts"
import { createCollaborationCapabilities } from "./capabilities.ts"
import type { CollaborationCapabilityHost } from "./capabilities.ts"
import { createCollaborationAuthority } from "./authority.ts"
import type { CollaborationRecipientAuthority } from "./recipient-authority.ts"
import { createCollaborationComposition } from "./composition.ts"
import { createCollaborationDispatch } from "./dispatch.ts"
import { createWorkSelectionPort } from "./selection.ts"
import { createCaseWorkSelection } from "./case-selection.ts"
import type { WorkSelectionPort } from "./selection.ts"
import { createQuestionSource } from "./question-source.ts"
import { createQuestionPreparations } from "./question-preparations.ts"
import { createQuestionConsumer } from "./question-consumer.ts"
import type { createSfContributionReader } from "../ai/contribution-reader.ts"
import { createCollaborationSourceFence } from "./source-fence.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import { createConfirmationPort } from "./confirmation.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationObserver } from "./confirmation.ts"
import { createConfirmationObservationReceipts } from "./confirmation-observations.ts"
import { createRecipientAwareThreadReads } from "./thread-reads.ts"
import { createRecipientThreadActions } from "./recipient-actions.ts"
import { createCollaborationMutationFence } from "./mutation-fence.ts"
import { createRecipientThreadReader } from "./recipient-thread.ts"
import { createCollaborationReissuer } from "./reissue.ts"
import { createWorkSourceRefresh } from "./work-source-refresh.ts"
import { createThreadAnswerEvidence } from "./evidence.ts"
import { createThreadHistory } from "./thread-history.ts"
import { createAnswerReusePort } from "./answer-reuse.ts"
import { createAnswerWorkPort } from "./answer-work.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isThread } from "./threads.ts"
export type { WorkSelection, WorkSelectionPort } from "./selection.ts"

type HostConfirmationObservation = AvailableConfirmationScopeObservation & { evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; projection: DomainProjection }

/** Compose the installation's authenticated C08 services; no authority is derived from arguments. */
export function createCollaborationHost<T extends HostConfirmationObservation = HostConfirmationObservation>(input: {
  host: DomainPortHost
  state: SfProductStatePort
  creationTarget: { ref: string; incarnation: string }
  scopedSources: SfScopedSourcePort
  evidence: BusinessContextService
  procurement: Pick<ReturnType<typeof createProcurementPort>, "list">
  collections: Pick<ReturnType<typeof createProcurementCollectionRegistry>, "resolveRequestCollection">
  workSelections?: WorkSelectionPort
  caseSelectionWrites?: WeakSet<object>
  threadHistoryWrites?: WeakSet<object>
  workSignals?: WorkSignals
  workDestination?: { origin: string; mount: string; resolveDestination: (destination: NonNullable<WorkPresentationItem["destination"]>, context: TrustedDomainContext) => Promise<PortResult<{ href: string }>> }
  cases: Pick<DecisionCasePort, "read">
  readQuestionContribution?: ReturnType<typeof createSfContributionReader>
  /** Identical private case authority supplied to the canonical case producer; required for work after source changes. */
  workCaseAuthority?: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authority: SfDomainValidation
  human: CollaborationHumanAuthority
  recipientAuthority?: CollaborationRecipientAuthority
  issueForActor?: (target: Extract<BusinessEvidenceRef, { kind: "record" }>["target"], context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  prepareReissueScope?: (original: Extract<BusinessEvidenceRef, { kind: "record" }>, current: Extract<BusinessEvidenceRef, { kind: "record" }>, context: TrustedDomainContext) => Promise<PortResult<{ fence: () => Promise<boolean> }>>
  resolveAnswerScope?: (source: Extract<BusinessEvidenceRef, { kind: "record" }>, evidence: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[], context: TrustedDomainContext) => Promise<PortResult<{ scope: ConfirmationScope }>>
  confirmationSource?: ConfirmationObserver<T> & {
    verifyManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
    /** Read-only check of the same manifest in the protected transaction snapshot. */
    fenceManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
  }
  requiredAuthority: CollaborationCapabilityHost["requiredAuthority"]
  createId: () => string
  now: () => string
}) {
  const issueRecord = createDashboardRecordSourceIssuer({ host: input.host, scopedSources: input.scopedSources })
  const recordEvidence = createDashboardRecordEvidenceHost({ host: input.host, scopedSources: input.scopedSources, issueRecord })
  const authority = createCollaborationAuthority({ host: input.host, evidence: input.evidence, recipientAuthority: input.recipientAuthority })
  const reissue = input.issueForActor ? createCollaborationReissuer({ host: input.host, issueForActor: input.issueForActor, authorize: (ref, context) => authority.sources([ref], context), prepareMaterialScope: input.prepareReissueScope }) : undefined
  const refreshWorkSource = input.issueForActor ? createWorkSourceRefresh({ host: input.host, issueForActor: input.issueForActor, authorize: (ref, context) => authority.sources([ref], context) }) : undefined
  const baseSelections = input.workSelections ?? createWorkSelectionPort({ collections: input.collections, authority, captureMember: input.captureWorkSource })
  const caseSelection = input.caseSelectionWrites ? createCaseWorkSelection({ host: input.host, state: input.state, cases: input.cases, authority, human: input.human, fence: createCollaborationMutationFence(input.host), fallback: baseSelections, reissue, refreshWorkSource, workCaseAuthority: input.workCaseAuthority, target: input.creationTarget, createId: input.createId, caseSelectionWrites: input.caseSelectionWrites }) : undefined
  const selections = caseSelection?.port ?? baseSelections
  const recipientThread = reissue ? createRecipientThreadReader({ host: input.host, state: input.state, reissue, authorize: authority.sources }) : undefined
  const confirmation = (() => {
    if (!input.confirmationSource || typeof input.confirmationSource.verifyManifest !== "function" || typeof input.confirmationSource.fenceManifest !== "function") return undefined
    const source = input.confirmationSource
    const observe: ConfirmationObserver<T>["observe"] = async (scope, context) => {
      if (!await source.verifyManifest(scope, context)) return { state: "dependency-unavailable", sourceVersion: 0 }
      return source.observe(scope, context)
    }
    const fence: ConfirmationObserver<T>["fence"] = async (scope, observation, context) => await source.fenceManifest(scope, context) && await source.fence(scope, observation, context)
    const observations = createConfirmationObservationReceipts<T>({ host: input.host, observe, now: () => Date.parse(input.now()) })
    const port = createConfirmationPort<T>({ host: input.host, state: input.state, creationTarget: input.creationTarget, human: input.human, observe, fence, verifyObserved: observations.verifyObserved, createId: input.createId, now: input.now })
    const work = async (id: string, context: TrustedDomainContext): Promise<PortResult<ConfirmationWork>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "confirmation-work-unavailable" }
      const stored = await input.state.read(request, "confirmations", (state, current) => current.principalRef === context.binding.principalRef && current.accessRevision === context.binding.accessRevision && current.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (stored.status !== "ok" || !stored.value || stored.value.authorId !== context.binding.principalRef) return { status: "unavailable", reason: "confirmation-work-unavailable" }
      const validity = await port.project(id, context)
      if (validity.status !== "ok" || validity.value.state === "unavailable") return { status: "unavailable", reason: "confirmation-work-unavailable" }
      if (validity.value.state === "valid") return { status: "ok", value: { state: "valid", reason: validity.value.reason, sourceRefs: [], period: stored.value.scope.period, observedVersion: stored.value.observedSourceVersion } }
      const current = await observe(stored.value.scope, context)
      if (current.state !== "available") return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const refs = [current.evidence]
      if (!await authority.sources(refs, context)) return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const again = await port.project(id, context)
      if (again.status !== "ok" || again.value.state !== "stale" || (again.value.reason !== validity.value.reason || again.value.evaluatedSourceVersion !== validity.value.evaluatedSourceVersion || again.value.scopeFingerprint !== validity.value.scopeFingerprint) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "confirmation-work-changed" }
      return { status: "ok", value: { state: "stale", reason: validity.value.reason, sourceRefs: refs, period: stored.value.scope.period, observedVersion: stored.value.observedSourceVersion, sourceVersion: current.sourceVersion } }
    }
    const prepare = async (scope: ConfirmationScope, context: TrustedDomainContext) => {
      const result = await observations.prepare(scope, context)
      if (result.status !== "ok") return result
      return { status: "ok" as const, value: { sourceVersion: result.value.sourceVersion, incarnation: result.value.incarnation, scopeFingerprint: result.value.scopeFingerprint, evidence: result.value.evidence, projection: result.value.projection } }
    }
    const confirm = async (command: ConfirmationCommand, context: TrustedDomainContext) => {
      const result = await port.confirm(command, context)
      if (result.status !== "ok") return result
      const record = result.value
      return { status: "ok" as const, value: { id: record.id, sourceRef: record.sourceRef, observedSourceVersion: record.observedSourceVersion, observedScopeFingerprint: record.observedScopeFingerprint, scope: record.scope, authorId: record.authorId, confirmedAt: record.confirmedAt, auditRef: record.auditRef } }
    }
    return { prepare, confirm, project: port.project, readScope: port.readScope, find: port.find, inspect: port.inspect, work }
  })()
  const answerWork = input.confirmationSource ? createAnswerWorkPort({ host: input.host, state: input.state, source: input.confirmationSource, authorizeSources: authority.sources }) : undefined
  const collaboration = createCollaborationComposition({ host: input.host, state: input.state, creationTarget: input.creationTarget, evidence: input.evidence, procurement: input.procurement, selections, signals: input.workSignals, recordEvidence, human: input.human, recipientAuthority: input.recipientAuthority, recipientThread, reissue, refreshWorkSource, captureWorkSource: input.captureWorkSource, confirmationWork: confirmation?.work, answerWork: answerWork?.project, createId: input.createId, now: input.now })
  const threadReads = createRecipientAwareThreadReads(collaboration.threads, recipientThread)
  const resolveWorkDestination = input.workDestination ? createWorkDestinationResolver({ ...input.workDestination, host: input.host, work: collaboration.work }) : undefined
  const captureWorkSource = async (memberRef: string, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    if (!input.captureWorkSource || typeof memberRef !== "string" || !memberRef.trim()) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    const captured = await input.captureWorkSource(memberRef, context)
    if (captured.status !== "ok") return captured
    if (!await authority.sources([captured.value], context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    return captured
  }
  const recipientActions = recipientThread ? createRecipientThreadActions({ state: input.state, host: input.host, human: input.human, mutationFence: createCollaborationMutationFence(input.host), read: recipientThread, creationTarget: input.creationTarget, createId: input.createId, now: input.now }) : undefined
  const answerEvidence = createThreadAnswerEvidence(threadReads)
  const threadHistory = input.threadHistoryWrites ? createThreadHistory({ host: input.host, state: input.state, read: threadReads.read, human: input.human, fence: createCollaborationMutationFence(input.host), target: input.creationTarget, threadHistoryWrites: input.threadHistoryWrites }) : undefined
  const storageVersion = async (namespace: "threads" | "relations" | "confirmations", context: TrustedDomainContext): Promise<PortResult<number>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "collaboration-state-unavailable" }
    const state = await input.state.read(request, namespace, (_value, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    if (state.status === "unavailable" && state.reason === "product-state-uninitialized" && await input.host.revalidate(context)) return { status: "ok", value: 0 }
    if (state.status !== "ok" || !state.value || !await input.host.revalidate(context)) return { status: "unavailable", reason: "collaboration-state-unavailable" }
    return { status: "ok", value: state.storageVersion }
  }
  const listRecipients = async (context: TrustedDomainContext): Promise<PortResult<readonly { id: string; name: string }[]>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "recipient-directory-unavailable" }
    const directory = (await input.host.environment(request)).directory
    if (directory.length > 1000) return { status: "unavailable", reason: "recipient-directory-unavailable" }
    const candidates = directory.filter((person) => person.id.trim() && person.name.trim() && directory.filter((other) => other.id === person.id).length === 1)
    const permitted = await Promise.all(candidates.map((person) => authority.recipient(person.id, context)))
    const confirmed = await Promise.all(permitted.filter((person): person is { id: string; name: string } => !!person).map((person) => authority.recipient(person.id, context)))
    const current = (await input.host.environment(request)).directory
    if (confirmed.some((person) => !person) || digestSfValue(current) !== digestSfValue(directory) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "recipient-directory-unavailable" }
    return { status: "ok", value: confirmed.filter((person): person is { id: string; name: string } => !!person).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) }
  }
  const answerReuse = input.confirmationSource ? createAnswerReusePort<T>({
    host: input.host,
    state: input.state,
    now: () => Date.parse(input.now()),
    target: input.creationTarget,
    answer: async (questionId, context) => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "answer-unavailable" }
      const visible = await threadReads.read(questionId, context)
      if (visible.status !== "ok") return visible
      const message = visible.value.messages.findLast((entry, index) => index > 0 && entry.authorRef === visible.value.recipientRef)
      if (!message || visible.value.kind === "comment") return { status: "unavailable", reason: "answer-unavailable" }
      const evidence = await answerEvidence.issue(questionId, message.id, context)
      if (evidence.status !== "ok") return evidence
      const raw = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[questionId] : undefined)
      if (raw.status !== "ok" || !isThread(raw.value) || raw.value.id !== questionId || digestSfValue(raw.value.messages) !== digestSfValue(visible.value.messages) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-unavailable" }
      return { status: "ok", value: { id: message.id, ref: evidence.value.refId, authorRef: message.authorRef, questionId, body: message.body, digest: digestSfValue({ questionId, ...message }), threadDigest: digestSfValue(raw.value) } }
    },
    belongsToQuestion: answerEvidence.belongsToQuestion,
    scopeForAnswer: async (questionId, answerRef, context) => {
      if (!await answerEvidence.belongsToQuestion(questionId, answerRef, context)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const thread = await threadReads.read(questionId, context)
      if (thread.status !== "ok" || !thread.value.evidenceRefs.length || thread.value.evidenceRefs.some((ref) => ref.kind !== "record")) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const evidence = thread.value.evidenceRefs as readonly Extract<BusinessEvidenceRef, { kind: "record" }>[]
      const source = evidence.find((ref) => ref.refId === thread.value.sourceRef)
      if (!source || source.kind !== "record" || source.refId !== thread.value.sourceRef || !source.target.period || digestSfValue(source.target.period) !== digestSfValue(thread.value.period)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      if (evidence.filter((ref) => ref.refId === source.refId).length !== 1) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const derived = input.resolveAnswerScope ? await input.resolveAnswerScope(source, evidence, context) : source.target.surface === "dashboard" && evidence.length === 1 ? { status: "ok" as const, value: { scope: { sourceRef: { surface: source.target.surface, type: source.target.recordType, id: source.target.recordId, incarnation: source.target.incarnation }, fields: source.target.fields, period: source.target.period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" } } } : { status: "unavailable" as const, reason: "answer-scope-unavailable" }
      if (derived.status !== "ok") return derived
      const scope = derived.value.scope
      if (digestSfValue(scope.sourceRef) !== digestSfValue({ surface: source.target.surface, type: source.target.recordType, id: source.target.recordId, incarnation: source.target.incarnation }) || digestSfValue([...scope.fields].sort()) !== digestSfValue([...source.target.fields].sort()) || digestSfValue(scope.period) !== digestSfValue(source.target.period) || scope.materialDependencies.length !== evidence.length - 1 || new Set(scope.materialDependencies.map((dependency) => digestSfValue({ surface: dependency.surface, type: dependency.type, id: dependency.id, incarnation: dependency.incarnation, version: dependency.version, fields: [...dependency.fields].sort(), period: dependency.period }))).size !== scope.materialDependencies.length || scope.materialDependencies.some((dependency) => evidence.filter((ref) => ref !== source && ref.target.surface === dependency.surface && ref.target.recordType === dependency.type && ref.target.recordId === dependency.id && ref.target.incarnation === dependency.incarnation && ref.target.version === dependency.version && digestSfValue([...ref.target.fields].sort()) === digestSfValue([...dependency.fields].sort()) && digestSfValue(ref.target.period) === digestSfValue(dependency.period)).length !== 1)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      if (!await input.confirmationSource!.verifyManifest(scope, context)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      return { status: "ok", value: { scope } }
    },
    observe: (scope, context) => input.confirmationSource!.observe(scope, context),
    fence: async (scope, observation, context) => await input.confirmationSource!.fenceManifest(scope, context) && await input.confirmationSource!.fence(scope, observation, context),
    authorizeConfirmation: (context, questionId, answerRef, mutation) => input.human.authorize(context, "collaboration.answer.confirm", { questionId, answerRef, mutation }),
  }) : undefined

  const questionPreparations = createQuestionPreparations({ host: input.host, state: input.state, cases: input.cases, now: () => Date.parse(input.now()) })
  const questions = createQuestionConsumer({ host: input.host, state: input.state, cases: input.cases, human: input.human, authority, preparations: questionPreparations, readContribution: input.readQuestionContribution, fence: createCollaborationMutationFence(input.host), target: input.creationTarget, createId: input.createId, now: input.now })
  const dispatch = createCollaborationDispatch({ collaboration, threadReads, answerReuse, cases: input.cases, recordQuestionPreparation: questionPreparations.record, requiredAuthority: input.requiredAuthority, createReceipt: async (context, operation, digest, resultDigest) => {
    if (!await input.authority.revalidateDomainContext(context)) return undefined
    return input.authority.receiptFor(context, operation, digest, resultDigest)
  } })

  const cycle = createCollaborationCycleView({ cases: input.cases, work: collaboration.work, host: input.host, resolveCase: caseSelection?.resolveCase })
  return { ...collaboration, questions, cycle, caseSelection, confirmation, answerReuse, threadHistory, listRecipients, storageVersion, recipientThread, recipientActions, captureWorkSource, resolveWorkDestination, recordEvidence, selections, sourceFence: createCollaborationSourceFence({ host: input.host, scopedSources: input.scopedSources }), resolveQuestion: createQuestionSource(threadReads), answerEvidence, resolveAnswer: answerEvidence.resolve, projectAnswer: answerEvidence.project, capabilities: createCollaborationCapabilities(dispatch) }
}


