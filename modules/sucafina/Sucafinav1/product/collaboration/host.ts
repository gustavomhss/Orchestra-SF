import { hasSfDashboardSourceFence } from "../../runtime/contract.ts"
import { isInstalledSfStateRead, isInstalledSfStateTransaction, selectSfReviewReceipts } from "../host-binding/state-provider.ts"
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
import type { WorkReviewContexts } from "./work-review-context.ts"
import { createCollaborationCapabilities } from "./capabilities.ts"
import type { CollaborationCapabilityHost } from "./capabilities.ts"
import { createCollaborationAuthority, isRegisteredAnswerSource, isRegisteredReviewMutationSource, registeredLocalReview } from "./authority.ts"
import type { CollaborationRecipientAuthority, ReviewThreadRecipientAuthority } from "./recipient-authority.ts"
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
import { createThreadSourceContinuity } from "./thread-continuity.ts"
import { threadMessageContext } from "./thread-context.ts"
import type { ReviewThreadContextAuthorizer, ThreadSourceContext } from "./thread-context.ts"
import type { createReviewAnswerSource } from "../reviews/review-answer-source.ts"
import { createHistoricalThreadSourceRefresh } from "./thread-source-refresh.ts"
import { createAnswerReusePort } from "./answer-reuse.ts"
import { createAnswerWorkPort } from "./answer-work.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isThread, sameThreadReadScope } from "./threads.ts"
import { createReviewThreadSourceFence } from "./review-source-fence.ts"
import type { PrepareReviewThreadFence } from "./review-source-fence.ts"
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
  reviewContexts?: WorkReviewContexts
  authorizeReviewThreadContext?: ReviewThreadContextAuthorizer
  prepareReviewThreadFence?: PrepareReviewThreadFence
  workDestination?: { origin: string; mount: string; resolveDestination: (destination: NonNullable<WorkPresentationItem["destination"]>, context: TrustedDomainContext) => Promise<PortResult<{ href: string }>> }
  cases: Pick<DecisionCasePort, "read">
  readQuestionContribution?: ReturnType<typeof createSfContributionReader>
  /** Identical private case authority supplied to the canonical case producer; required for work after source changes. */
  workCaseAuthority?: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authority: SfDomainValidation
  human: CollaborationHumanAuthority
  recipientAuthority?: CollaborationRecipientAuthority
  reviewRecipientAuthority?: ReviewThreadRecipientAuthority
  issueForActor?: (target: Extract<BusinessEvidenceRef, { kind: "record" }>["target"], context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  prepareReissueScope?: (original: Extract<BusinessEvidenceRef, { kind: "record" }>, current: Extract<BusinessEvidenceRef, { kind: "record" }>, context: TrustedDomainContext) => Promise<PortResult<{ fence: () => Promise<boolean> }>>
  resolveAnswerScope?: (source: Extract<BusinessEvidenceRef, { kind: "record" }>, evidence: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[], context: TrustedDomainContext) => Promise<PortResult<{ scope: ConfirmationScope }>>
  reviewAnswerSource?: ReturnType<typeof createReviewAnswerSource>
  confirmationSource?: ConfirmationObserver<T> & {
    verifyManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
    /** Read-only check of the same manifest in the protected transaction snapshot. */
    fenceManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
  }
  requiredAuthority: CollaborationCapabilityHost["requiredAuthority"]
  createId: () => string
  now: () => string
}) {
  const prepareReviewThreadFence = input.prepareReviewThreadFence ?? (input.reviewAnswerSource ? createReviewThreadSourceFence({ source: () => input.reviewAnswerSource }) : undefined)
  const replayHost = input.host
  const replayPersistence = replayHost.persistence
  const replaySource = input.reviewAnswerSource
  const replayEvidence = input.evidence
  const replayAuthorize = input.authorizeReviewThreadContext
  const replayRecipient = input.reviewRecipientAuthority
  const replayHuman = input.human
  const replayHumanAuthorize = replayHuman.authorize
  const replayCurrent = () => !!replaySource && input.prepareReviewThreadFence === undefined &&
    input.host === replayHost && replayHost.persistence === replayPersistence && hasSfDashboardSourceFence(replayPersistence) &&
    input.reviewAnswerSource === replaySource && input.evidence === replayEvidence && input.authorizeReviewThreadContext === replayAuthorize &&
    input.reviewRecipientAuthority === replayRecipient && input.human === replayHuman && replayHuman.authorize === replayHumanAuthorize &&
    isRegisteredReviewMutationSource(replayEvidence, replaySource, replayAuthorize, replayRecipient)
  const issueRecord = createDashboardRecordSourceIssuer({ host: input.host, scopedSources: input.scopedSources })
  const recordEvidence = createDashboardRecordEvidenceHost({ host: input.host, scopedSources: input.scopedSources, issueRecord })
  const authority = createCollaborationAuthority({ host: input.host, evidence: input.evidence, recipientAuthority: input.recipientAuthority, reviewRecipientAuthority: input.reviewRecipientAuthority, authorizeReviewThreadContext: input.authorizeReviewThreadContext })
  const reissue = input.issueForActor ? createCollaborationReissuer({ host: input.host, issueForActor: input.issueForActor, authorize: (ref, context) => authority.sources([ref], context), prepareMaterialScope: input.prepareReissueScope }) : undefined
  const refreshWorkSource = input.issueForActor ? createWorkSourceRefresh({ host: input.host, issueForActor: input.issueForActor, authorize: (ref, context) => authority.sources([ref], context) }) : undefined
  const historicalThreadSource = createHistoricalThreadSourceRefresh({ host: input.host, evidence: input.evidence })
  const refreshThreadSource: NonNullable<typeof refreshWorkSource> = async (original, context) => {
    const samePeriod = refreshWorkSource ? await refreshWorkSource(original, context) : undefined
    return samePeriod?.status === "ok" ? samePeriod : historicalThreadSource(original, context)
  }
  const baseSelections = input.workSelections ?? createWorkSelectionPort({ collections: input.collections, authority, captureMember: input.captureWorkSource })
  const caseSelection = input.caseSelectionWrites ? createCaseWorkSelection({ host: input.host, state: input.state, cases: input.cases, authority, human: input.human, fence: createCollaborationMutationFence(input.host), fallback: baseSelections, reissue, refreshWorkSource, workCaseAuthority: input.workCaseAuthority, target: input.creationTarget, createId: input.createId, caseSelectionWrites: input.caseSelectionWrites }) : undefined
  const selections = caseSelection?.port ?? baseSelections
  const recipientThread = reissue ? createRecipientThreadReader({ host: input.host, state: input.state, reissue, refresh: refreshThreadSource, authorize: authority.readSources, authorizeHistorical: authority.readHistoricalSources, authorizeContext: authority.readReviewThreadBasis,
    authorizeReviewLeg: authority.readRecipientReviewLeg }) : undefined
  const authorizeThreadSourceContinuity = reissue ? createThreadSourceContinuity({ host: input.host, reissue, refresh: refreshThreadSource, authorizeHistorical: authority.historicalSources }) : undefined
  const confirmation = (() => {
    if (!input.confirmationSource || typeof input.confirmationSource.verifyManifest !== "function" || typeof input.confirmationSource.fenceManifest !== "function") return undefined
    const source = input.confirmationSource
    const observe: ConfirmationObserver<T>["observe"] = async (scope, context) => {
      if (!await source.verifyManifest(scope, context)) return { state: "dependency-unavailable", sourceVersion: 0 }
      return source.observe(scope, context)
    }
    const fence: ConfirmationObserver<T>["fence"] = async (scope, observation, context) => await source.fenceManifest(scope, context) && await source.fence(scope, observation, context)
    // Selection rereads do not own a C08 mutation transaction. Run only their
    // read-only source fence inside the canonical persistence snapshot.
    const readFence: ConfirmationObserver<T>["fence"] = async (scope, observation, context) => {
      const transaction = input.host.persistence.transactionAll
      const request = input.host.requestFor(context)
      if (!transaction || !request) return false
      return transaction(async () => ({ commit: false, value: await fence(scope, observation, context) }), { signal: request.signal })
    }
    const observations = createConfirmationObservationReceipts<T>({ host: input.host, observe, fence: readFence, now: () => Date.parse(input.now()) })
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
      return { status: "ok" as const, value: { sourceVersion: result.value.sourceVersion, incarnation: result.value.incarnation, scopeFingerprint: result.value.scopeFingerprint, evidence: result.value.evidence, projection: result.value.projection, selectionRef: result.value.selectionRef } }
    }
    const readSelection = async (selectionRef: string, context: TrustedDomainContext) => {
      const result = await observations.readSelection(selectionRef, context)
      if (result.status !== "ok") return result
      const observation = result.value.observation
      return { status: "ok" as const, value: { kind: "prepared-selection" as const, selectionRef: result.value.selectionRef,
        scope: result.value.scope, observation: { sourceVersion: observation.sourceVersion, incarnation: observation.incarnation,
          scopeFingerprint: observation.scopeFingerprint, evidence: observation.evidence, projection: observation.projection } } }
    }
    const confirm = async (command: ConfirmationCommand, context: TrustedDomainContext) => {
      const result = await port.confirm(command, context)
      if (result.status !== "ok") return result
      const record = result.value
      return { status: "ok" as const, value: { id: record.id, sourceRef: record.sourceRef, observedSourceVersion: record.observedSourceVersion, observedScopeFingerprint: record.observedScopeFingerprint, scope: record.scope, authorId: record.authorId, confirmedAt: record.confirmedAt, auditRef: record.auditRef } }
    }
    return { prepare, readSelection, confirm, project: port.project, readScope: port.readScope, find: port.find, inspect: port.inspect, work }
  })()
  const answerWork = input.confirmationSource ? createAnswerWorkPort({ host: input.host, state: input.state, source: input.confirmationSource, reviewSource: input.reviewAnswerSource, authorizeSources: authority.sources, authorizeHistoricalSources: authority.historicalSources }) : undefined
  const collaboration = createCollaborationComposition({ host: input.host, state: input.state, replayCurrent, creationTarget: input.creationTarget, evidence: input.evidence, procurement: input.procurement, selections, signals: input.workSignals, reviewContexts: input.reviewContexts, prepareReviewThreadFence, authorizeReviewThreadContext: input.authorizeReviewThreadContext, recordEvidence, human: input.human, recipientAuthority: input.recipientAuthority, reviewRecipientAuthority: input.reviewRecipientAuthority, recipientThread, reissue, refreshWorkSource, captureWorkSource: input.captureWorkSource, confirmationWork: confirmation?.work, answerWork: answerWork?.project, createId: input.createId, now: input.now })
  const replyState = input.state
  const readReplyState = replyState.read
  const replyTransaction = replyState.transaction
  const replyThread = collaboration.threads.reply
  const prepareReplyContinuity = authority.prepareReviewReplyContinuity
  const replyInstalledReview = async (id: string, body: string, mutation: Parameters<typeof replyThread>[2], context: TrustedDomainContext) => {
    const localReview = registeredLocalReview(replayEvidence)
    if (context.kind !== "ui" || !recipientThread || !replayCurrent() || !localReview ||
      !isInstalledSfStateTransaction(readReplyState, replyTransaction)) return undefined
    if (typeof id !== "string" || !id.trim()) return undefined
    const host = input.host
    const requestFor = host.requestFor, revalidate = host.revalidate
    const request = requestFor.call(host, context)
    const lease = context.lease
    const binding = digestSfValue(context.binding)
    const target = input.creationTarget
    const targetIdentity = digestSfValue(target)
    const current = () => !!request && !request.signal.aborted && replayCurrent() && registeredLocalReview(replayEvidence) === localReview && input.host === host &&
      host.requestFor === requestFor && host.revalidate === revalidate && requestFor.call(host, context) === request &&
      input.state === replyState && replyState.read === readReplyState && replyState.transaction === replyTransaction &&
      collaboration.threads.reply === replyThread && authority.prepareReviewReplyContinuity === prepareReplyContinuity &&
      input.creationTarget === target && digestSfValue(target) === targetIdentity &&
      context.lease === lease && digestSfValue(context.binding) === binding
    const denied = { status: "denied" as const, reason: "thread-access-unavailable" }
    if (!request || !current() || !await revalidate.call(host, context) || !current()) return denied
    const bound = (actor: Pick<TrustedDomainContext["binding"], "principalRef" | "accessRevision" | "policyVersion">) =>
      actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion
    const stored = await replyState.read(request, "threads", (state, actor) => ({ bound: bound(actor), thread: bound(actor) ? state.threads[id] : undefined }))
    if (!current()) return denied
    if ("reason" in stored) return stored
    if (stored.status !== "ok") return { status: "unavailable" as const, reason: "thread-read-unavailable" }
    if (!stored.value.bound) return denied
    const thread = stored.value.thread
    if (!isThread(thread) || thread.id !== id || thread.kind === "comment" || thread.recipientRef !== context.binding.principalRef ||
      !thread.messages.every((message) => message.authorRef === thread.recipientRef)) return undefined
    const basis = thread.messages[0]?.sourceContext
    const pin = basis?.reviewContext
    if (!pin || basis.evidenceRefs.some((ref) => ref.kind !== "record" || ref.target.surface !== "dashboard" ||
      ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return undefined
    const review = await replyState.read(request, "reviews", selectSfReviewReceipts((state, actor) => {
      if (!bound(actor)) return { bound: false, local: false }
      const review = state.reviews[pin.reviewRef]
      return { bound: true, local: !!review && digestSfValue(review) === pin.reviewDigest && localReview(review) }
    }))
    if (!current()) return denied
    if ("reason" in review) return review
    if (review.status !== "ok") return { status: "unavailable" as const, reason: "thread-read-unavailable" }
    if (!review.value.bound) return denied
    if (!review.value.local) return undefined
    const continuity = await prepareReplyContinuity(basis.evidenceRefs, context, current)
    if (!current()) return denied
    if (continuity === "reissue") return undefined
    if (!continuity) return { status: "unavailable" as const, reason: "thread-source-unavailable" }
    return replyThread(id, body, mutation, context, Object.freeze({ request, current, threadDigest: digestSfValue(thread),
      sameScope: (prior: typeof thread) => sameThreadReadScope(thread, prior) && prior.messages.every((message) => message.authorRef === thread.recipientRef),
      continuity }))
  }
  const threadReads = createRecipientAwareThreadReads(collaboration.threads, recipientThread)
  const resolveWorkDestination = input.workDestination ? createWorkDestinationResolver({ ...input.workDestination, host: input.host, work: collaboration.work }) : undefined
  const captureWorkSource = async (memberRef: string, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    if (!input.captureWorkSource || typeof memberRef !== "string" || !memberRef.trim()) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    const captured = await input.captureWorkSource(memberRef, context)
    if (captured.status !== "ok") return captured
    if (!await authority.sources([captured.value], context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    return captured
  }
  const recipientActions = recipientThread ? createRecipientThreadActions({ state: input.state, host: input.host, human: input.human, mutationFence: createCollaborationMutationFence(input.host), read: recipientThread, prepareReviewThreadFence, authorizeReviewRecipient: authority.reviewRecipientSources, checkReviewRecipientAtCommit: authority.checkReviewRecipientAtCommit, answerWork: answerWork?.project, creationTarget: input.creationTarget, createId: input.createId, now: input.now }) : undefined
  const answerRead = threadReads.read
  const answerState = input.state
  const readAnswerState = answerState.read
  const answerFence = hasSfDashboardSourceFence(replayPersistence) ? replayPersistence.dashboardSourceFence : undefined
  const answerEvidence = createThreadAnswerEvidence(threadReads, input.host, {
    read: answerRead,
    installed: () => !!answerFence && replayCurrent() && !!registeredLocalReview(replayEvidence) && hasSfDashboardSourceFence(replayPersistence) &&
      replayPersistence.dashboardSourceFence === answerFence && input.state === answerState &&
      answerState.read === readAnswerState && isInstalledSfStateRead(readAnswerState) && threadReads.read === answerRead,
  })
  const authorizeHistoricalBasis = async (basis: ThreadSourceContext, context: TrustedDomainContext) =>
    await authority.readHistoricalSources(basis.evidenceRefs, context) && await authority.readReviewThreadBasis(basis, context)
  const threadHistory = input.threadHistoryWrites ? createThreadHistory({ host: input.host, state: input.state, replayCurrent, read: threadReads.read, readHistorical: threadReads.readHistorical, prepareReviewThreadFence, authorizeReviewRecipient: authority.reviewRecipientSources, checkReviewRecipientAtCommit: authority.checkReviewRecipientAtCommit, authorizeSources: authorizeHistoricalBasis,
    // Each mutation observation still authorizes the historical evidence and the
    // pinned C05 source. The resident reader can hold both under one sealed root.
    authorizeEditBasis: async (thread, basis, context) => {
      if (!replayCurrent()) return authorizeHistoricalBasis(basis, context)
      const batched = await authority.readRecipientReviewLeg(thread, basis, basis.evidenceRefs, context,
        () => authority.readHistoricalSources(basis.evidenceRefs, context))
      if (!replayCurrent()) return false
      return batched ?? authorizeHistoricalBasis(basis, context)
    },
    prepareEditReceipt: async (thread, basis, context, current) => {
      const recipient = thread.recipientRef
      if (!recipient || !current() || !await authority.readRecipient(recipient, context) || !current()) return undefined
      return prepareReplyContinuity(basis.evidenceRefs, context, current)
    },
    human: input.human, fence: createCollaborationMutationFence(input.host), target: input.creationTarget, threadHistoryWrites: input.threadHistoryWrites }) : undefined
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
    const permitted = await Promise.all(candidates.map((person) => authority.readRecipient(person.id, context)))
    const confirmed = await Promise.all(permitted.filter((person): person is { id: string; name: string } => !!person).map((person) => authority.readRecipient(person.id, context)))
    const current = (await input.host.environment(request)).directory
    if (confirmed.some((person) => !person) || digestSfValue(current) !== digestSfValue(directory) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "recipient-directory-unavailable" }
    return { status: "ok", value: confirmed.filter((person): person is { id: string; name: string } => !!person).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) }
  }
  // A reference identifies a message; it does not authorize it. Derive it only
  // from a thread already returned by the authenticated reader, then keep the
  // canonical reread and answer-reuse source/commit fences below.
  const answerReference = (questionId: string, message: { id: string; incarnation: string; version: number }) => `sf-thread-answer:${encodeURIComponent(questionId)}:${encodeURIComponent(message.id)}:${encodeURIComponent(message.incarnation)}:${message.version}`
  // C05 membership is an identity check, not a source grant. The answer reader
  // authenticates exposure; resolve/observe and their protected fences authorize
  // the complete preserved review and all sources before any successful result.
  const answerBelongsToQuestion = async (questionId: string, answerRef: string, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return false
    const loaded = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[questionId] : undefined)
    if (loaded.status !== "ok" || !isThread(loaded.value) || loaded.value.id !== questionId || !await input.host.revalidate(context)) return false
    const thread = loaded.value
    if (!thread.messages[0]?.sourceContext?.reviewContext) return answerEvidence.belongsToQuestion(questionId, answerRef, context)
    if (thread.kind === "comment" || thread.recipientRef !== context.binding.principalRef && !thread.messages.some((message) => message.authorRef === context.binding.principalRef)) return false
    const message = thread.messages.findLast((entry, index) => index > 0 && entry.authorRef === thread.recipientRef)
    const basis = message ? threadMessageContext(thread, message) : undefined
    return !!message && !!basis?.reviewContext && basis.evidenceRefs.every((ref) => ref.installationId === context.binding.installationId && ref.projectId === context.binding.projectId) && answerReference(questionId, message) === answerRef && await input.host.revalidate(context)
  }
  const admittedAnswers = new WeakMap<object, () => boolean>()
  const observedAnswers = new WeakMap<TrustedDomainContext, {
    questionId: string; refId: string; projectionDigest: string; current: () => boolean
  }>()
  const readSelfReviewThread = async (questionId: string, context: TrustedDomainContext, issued?: Extract<BusinessEvidenceRef, { kind: "record" }>) => {
    const persistence = input.host.persistence
    const source = input.reviewAnswerSource
    const evidence = input.evidence
    const state = input.state
    const denied = { status: "denied" as const, reason: "answer-unavailable" }
    const observed = !issued ? observedAnswers.get(context) : undefined
    const proof = issued ?? observed
    if (!proof) return undefined
    const unsupported = () => admittedAnswers.has(proof) || issued && answerEvidence.issuedForPreparation(issued) ? denied : undefined
    const proofCurrent = () => issued ? answerEvidence.issuedTo(issued, context)
      : observed?.questionId === questionId && observedAnswers.get(context) === observed && observed.current()
    if (!proofCurrent() || !source || !isRegisteredAnswerSource(evidence, source) || !isInstalledSfStateRead(readAnswerState) || state.read !== readAnswerState ||
      !hasSfDashboardSourceFence(persistence)) return unsupported()
    const host = input.host
    const requestFor = host.requestFor
    const revalidate = host.revalidate
    const request = host.requestFor(context)
    const fence = persistence.dashboardSourceFence
    const resolve = source.resolve
    const observe = source.observe
    const access = source.fence
    const current = admittedAnswers.get(proof) ?? (() => !!request && !request.signal.aborted && input.host === host &&
      host.requestFor === requestFor && host.revalidate === revalidate && requestFor.call(host, context) === request &&
      input.state === state && state.read === readAnswerState && input.reviewAnswerSource === source &&
      source.resolve === resolve && source.observe === observe && source.fence === access && input.evidence === evidence && isRegisteredAnswerSource(evidence, source) &&
      host.persistence === persistence && persistence.dashboardSourceFence === fence && hasSfDashboardSourceFence(persistence) &&
      proofCurrent())
    if (!request || !current() || !await input.host.revalidate(context) || !current()) return denied
    const stored = await state.read(request, "threads", (value, actor) => actor.principalRef === context.binding.principalRef &&
      actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion ? value.threads[questionId] : undefined)
    if (!current()) return denied
    if (stored.status !== "ok") return denied
    const thread = stored.value
    if (!isThread(thread) || thread.id !== questionId || thread.kind === "comment" || thread.recipientRef !== context.binding.principalRef ||
      !thread.messages.every((message) => message.authorRef === thread.recipientRef)) return unsupported()
    const first = thread.messages[0]
    const basis = first && threadMessageContext(thread, first)
    const firstDigest = digestSfValue(basis)
    if (!basis?.reviewContext || basis.evidenceRefs.some((ref) => ref.kind !== "record" || ref.target.surface !== "dashboard" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) ||
      digestSfValue(basis.evidenceRefs) !== digestSfValue(thread.evidenceRefs) ||
      thread.messages.some((message) => digestSfValue(threadMessageContext(thread, message)) !== firstDigest)) return unsupported()
    const message = thread.messages.findLast((_entry, index) => index > 0)
    if (!message || proof.refId !== answerReference(questionId, message) ||
      (issued?.target.projectionDigest ?? observed?.projectionDigest) !== digestSfValue({ threadId: questionId, message, period: basis.period, sourceRefs: basis.evidenceRefs })) return denied
    if (!await authority.readRecipient(thread.recipientRef, context) || !current() ||
      !await authority.readHistoricalSources(basis.evidenceRefs, context) || !current() || !await input.host.revalidate(context) || !current()) return denied
    admittedAnswers.set(proof, current)
    return { status: "ok" as const, value: thread }
  }
  const answerReuse = input.confirmationSource ? createAnswerReusePort<T>({
    host: input.host,
    currentAnswer: (context, issued) => {
      const proof = issued ?? observedAnswers.get(context)
      return !proof || (admittedAnswers.get(proof)?.() ?? true)
    },
    state: input.state,
    now: () => Date.parse(input.now()),
    target: input.creationTarget,
    reviewSource: input.reviewAnswerSource,
    answer: async (questionId, context, issued) => {
      const host = input.host
      const requestFor = host.requestFor
      const revalidate = host.revalidate
      const canonicalRead = threadReads.read
      const request = requestFor.call(host, context)
      const binding = digestSfValue([context.kind, context.binding])
      const current = () => !!request && !request.signal.aborted && input.host === host && host.requestFor === requestFor &&
        host.revalidate === revalidate && threadReads.read === canonicalRead && requestFor.call(host, context) === request &&
        binding === digestSfValue([context.kind, context.binding])
      if (!request || !await host.revalidate(context) || !current()) return { status: "denied", reason: "answer-unavailable" }
      // This body is private until the answer port runs its independent C05
      // scope/observation fences. Every lookup still rereads the exact C08 thread.
      const ownReview = await readSelfReviewThread(questionId, context, issued)
      const visible = ownReview ?? await threadReads.read(questionId, context)
      if (visible.status !== "ok") return visible
      const message = visible.value.messages.findLast((entry, index) => index > 0 && entry.authorRef === visible.value.recipientRef)
      if (!message || visible.value.kind === "comment") return { status: "unavailable", reason: "answer-unavailable" }
      const raw = ownReview ?? await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[questionId] : undefined)
      if (raw.status !== "ok" || !isThread(raw.value) || raw.value.id !== questionId || raw.value.recipientRef !== visible.value.recipientRef || raw.value.kind !== visible.value.kind || raw.value.state !== visible.value.state || digestSfValue(raw.value.messages) !== digestSfValue(visible.value.messages) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-unavailable" }
      if (!current()) return { status: "denied", reason: "answer-unavailable" }
      const refId = answerReference(questionId, message)
      if (!issued && !ownReview && !observedAnswers.has(context) && context.kind === "ui" && message.sourceContext?.reviewContext &&
        raw.value.recipientRef === context.binding.principalRef && raw.value.messages.every((entry) => entry.authorRef === context.binding.principalRef)) {
        const basis = message.sourceContext
        observedAnswers.set(context, { questionId, refId, current,
          projectionDigest: digestSfValue({ threadId: questionId, message, period: basis.period, sourceRefs: basis.evidenceRefs }) })
      }
      return { status: "ok", value: { id: message.id, ref: refId, authorRef: message.authorRef, questionId, body: message.body, digest: digestSfValue({ questionId, ...message }), threadDigest: digestSfValue(raw.value) } }
    },
    belongsToQuestion: answerBelongsToQuestion,
    scopeForAnswer: async (questionId, answerRef, context, issued) => {
      // Current-domain answers keep the actor-scoped source issued by the
      // authenticated reader. Its observedVersion remains historical; do not
      // replace its current scope with a different page's original incarnation.
      const ownReview = await readSelfReviewThread(questionId, context, issued)
      const thread = ownReview ?? await threadReads.read(questionId, context)
      if (thread.status !== "ok" || thread.value.kind === "comment" || thread.value.id !== questionId) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const message = thread.value.messages.find((entry, index) => index > 0 && entry.authorRef === thread.value.recipientRef && answerReference(thread.value.id, entry) === answerRef)
      if (!message) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const basis: ThreadSourceContext = message.sourceContext ?? thread.value
      if (basis.reviewContext || thread.value.messages[0]?.sourceContext?.reviewContext) {
        // C05 has an explicit immutable message basis. It must satisfy the full
        // canonical check and cannot fall through to current-domain confirmation.
        const pinned = threadMessageContext(thread.value, message)
        const source = input.reviewAnswerSource
        const resolve = source?.resolve
        if (!pinned?.reviewContext || !source || !resolve || !ownReview && !await authority.historicalSources(pinned.evidenceRefs, context)) return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        const reviewBasis = { ...pinned, reviewContext: pinned.reviewContext }
        const current = () => input.reviewAnswerSource === source && source.resolve === resolve
        if (!current()) return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        // resolve performs the producer's two current C05 reads. Repeating the
        // whole authorizer around it would recollect exactly the same sources.
        const derived = await resolve.call(source, reviewBasis, context)
        if (derived.status !== "ok" || !current() || !await input.host.revalidate(context) || !current()) return { status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" }
        return { status: "ok", value: { scope: derived.value.scope, reviewBasis } }
      }
      if (!basis.evidenceRefs.length || basis.evidenceRefs.some((ref) => ref.kind !== "record")) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const evidence = basis.evidenceRefs as readonly Extract<BusinessEvidenceRef, { kind: "record" }>[]
      const source = evidence.find((ref) => ref.refId === basis.sourceRef)
      if (!source || source.kind !== "record" || source.refId !== basis.sourceRef || !source.target.period || digestSfValue(source.target.period) !== digestSfValue(basis.period)) return { status: "unavailable", reason: "answer-scope-unavailable" }
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
  return { ...collaboration, questions, cycle, caseSelection, confirmation, answerReuse, threadHistory, threadReads, authorizeThreadSourceContinuity, listRecipients, storageVersion, recipientThread, recipientActions, replyInstalledReview, captureWorkSource, resolveWorkDestination, recordEvidence, selections, sourceFence: createCollaborationSourceFence({ host: input.host, scopedSources: input.scopedSources }), resolveQuestion: createQuestionSource(threadReads), answerEvidence, resolveAnswer: answerEvidence.resolve, projectAnswer: answerEvidence.project, capabilities: createCollaborationCapabilities(dispatch) }
}
