import { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../integration/dashboard-sources.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { ConfirmationCommand, ConfirmationScope, DomainProjection } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createProcurementPort } from "../procurement/port.ts"
import type { createProcurementCollectionRegistry } from "../procurement/sources.ts"
import { createCollaborationCapabilities } from "./capabilities.ts"
import type { CollaborationCapabilityHost } from "./capabilities.ts"
import { createCollaborationAuthority } from "./authority.ts"
import { createCollaborationComposition } from "./composition.ts"
import { createCollaborationDispatch } from "./dispatch.ts"
import { createWorkSelectionPort } from "./selection.ts"
import type { WorkSelectionPort } from "./selection.ts"
import { createQuestionSource } from "./question-source.ts"
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
import { createThreadAnswerEvidence } from "./evidence.ts"
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
  cases: Pick<DecisionCasePort, "read">
  authority: SfDomainValidation
  human: CollaborationHumanAuthority
  issueForActor?: (target: Extract<BusinessEvidenceRef, { kind: "record" }>["target"], context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  captureWorkSource?: (memberRef: string, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
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
  const authority = createCollaborationAuthority({ host: input.host, evidence: input.evidence })
  const selections = input.workSelections ?? createWorkSelectionPort({ collections: input.collections, authority, captureMember: input.captureWorkSource })
  const reissue = input.issueForActor ? createCollaborationReissuer({ host: input.host, issueForActor: input.issueForActor, authorize: (ref, context) => authority.sources([ref], context) }) : undefined
  const recipientThread = reissue ? createRecipientThreadReader({ host: input.host, state: input.state, reissue, authorize: authority.sources }) : undefined
  const confirmation = (() => {
    if (!input.confirmationSource || typeof input.confirmationSource.verifyManifest !== "function" || typeof input.confirmationSource.fenceManifest !== "function") return undefined
    const source = input.confirmationSource
    const observe: ConfirmationObserver<T>["observe"] = async (scope, context) => {
      if (!await source.verifyManifest(scope, context)) return { state: "dependency-unavailable", sourceVersion: 0 }
      return source.observe(scope, context)
    }
    const fence: ConfirmationObserver<T>["fence"] = async (scope, observation, context) => await source.fenceManifest(scope, context) && await source.fence(scope, observation, context)
    const observations = createConfirmationObservationReceipts({ host: input.host, observe, now: () => Date.parse(input.now()) })
    const port = createConfirmationPort({ host: input.host, state: input.state, creationTarget: input.creationTarget, human: input.human, observe, fence, verifyObserved: observations.verifyObserved, createId: input.createId, now: input.now })
    const work = async (id: string, context: TrustedDomainContext): Promise<PortResult<{ state: "valid" | "stale"; sourceRefs: readonly BusinessEvidenceRef[] }>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "confirmation-work-unavailable" }
      const stored = await input.state.read(request, "confirmations", (state, current) => current.principalRef === context.binding.principalRef && current.accessRevision === context.binding.accessRevision && current.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (stored.status !== "ok" || !stored.value || stored.value.authorId !== context.binding.principalRef) return { status: "unavailable", reason: "confirmation-work-unavailable" }
      const validity = await port.project(id, context)
      if (validity.status !== "ok" || validity.value.state === "unavailable") return { status: "unavailable", reason: "confirmation-work-unavailable" }
      if (validity.value.state === "valid") return { status: "ok", value: { state: "valid", sourceRefs: [] } }
      const current = await observe(stored.value.scope, context)
      if (current.state !== "available") return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const refs = [current.evidence]
      if (!await authority.sources(refs, context)) return { status: "unavailable", reason: "confirmation-work-source-unavailable" }
      const again = await port.project(id, context)
      if (again.status !== "ok" || again.value.state !== "stale" || (again.value.reason !== validity.value.reason || again.value.evaluatedSourceVersion !== validity.value.evaluatedSourceVersion || again.value.scopeFingerprint !== validity.value.scopeFingerprint) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "confirmation-work-changed" }
      return { status: "ok", value: { state: "stale", sourceRefs: refs } }
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
    return { prepare, confirm, project: port.project, inspect: port.inspect, work }
  })()
  const collaboration = createCollaborationComposition({ host: input.host, state: input.state, creationTarget: input.creationTarget, evidence: input.evidence, procurement: input.procurement, selections, recordEvidence, human: input.human, recipientThread, reissue, confirmationWork: confirmation?.work, createId: input.createId, now: input.now })
  const threadReads = createRecipientAwareThreadReads(collaboration.threads, recipientThread)
  const dispatch = createCollaborationDispatch({ collaboration, threadReads, cases: input.cases, requiredAuthority: input.requiredAuthority, createReceipt: async (context, operation, digest, resultDigest) => {
    if (!await input.authority.revalidateDomainContext(context)) return undefined
    return input.authority.receiptFor(context, operation, digest, resultDigest)
  } })
  const captureWorkSource = async (memberRef: string, context: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    if (!input.captureWorkSource || typeof memberRef !== "string" || !memberRef.trim()) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    const captured = await input.captureWorkSource(memberRef, context)
    if (captured.status !== "ok") return captured
    if (!await authority.sources([captured.value], context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-source-capture-unavailable" }
    return captured
  }
  const recipientActions = recipientThread ? createRecipientThreadActions({ state: input.state, host: input.host, human: input.human, mutationFence: createCollaborationMutationFence(input.host), read: recipientThread, creationTarget: input.creationTarget, createId: input.createId, now: input.now }) : undefined
  const answerEvidence = createThreadAnswerEvidence(threadReads)

  return { ...collaboration, confirmation, recipientThread, recipientActions, captureWorkSource, recordEvidence, selections, sourceFence: createCollaborationSourceFence({ host: input.host, scopedSources: input.scopedSources }), resolveQuestion: createQuestionSource(threadReads), answerEvidence, resolveAnswer: answerEvidence.resolve, projectAnswer: answerEvidence.project, capabilities: createCollaborationCapabilities(dispatch) }
}
