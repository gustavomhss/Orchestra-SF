import { object } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationObserver } from "./confirmation.ts"
import { answerReuseBaselineKey } from "./answer-reuse.ts"
import type { AnswerReuseBaseline } from "./answer-reuse.ts"
import { isThread } from "./threads.ts"
import { threadMessageContext } from "./thread-context.ts"
import type { createReviewAnswerSource } from "../reviews/review-answer-source.ts"
import type { ReviewThreadContext } from "../reviews/thread-context.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type AnswerWork = { state: "unconfirmed" } | {
  state: "valid" | "stale"
  sourceRefs: readonly BusinessEvidenceRef[]
  period: Period
  observedVersion: number
  sourceVersion: number
  reason?: "answer-changed" | "material-change" | "dependency-change"
  reviewContext?: ReviewThreadContext
}

/** The current producer evaluates the reviewed scope; historical answer text never enters this projection. */
export function createAnswerWorkPort<T extends AvailableConfirmationScopeObservation & { evidence: RecordEvidence }>(input: {
  host: DomainPortHost
  state: SfProductStatePort
  source: ConfirmationObserver<T> & {
    verifyManifest: (scope: AnswerReuseBaseline["scope"], context: TrustedDomainContext) => Promise<boolean>
    fenceManifest: (scope: AnswerReuseBaseline["scope"], context: TrustedDomainContext) => Promise<boolean>
  }
  reviewSource?: ReturnType<typeof createReviewAnswerSource>
  authorizeHistoricalSources?: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeSources: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
}) {
  return { project: async (questionId: string, context: TrustedDomainContext): Promise<PortResult<AnswerWork>> => {
    const request = input.host.requestFor(context)
    if (!request || typeof questionId !== "string" || !questionId.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "answer-work-unavailable" }
    const read = () => input.state.read(request, "threads", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
      const thread = state.threads[questionId]
      if (!isThread(thread) || thread.id !== questionId || thread.recipientRef !== context.binding.principalRef) return undefined
      const answer = thread.messages.findLast((message, index) => index > 0 && message.authorRef === thread.recipientRef)
      return { thread, answer, baseline: answer ? state.threads[answerReuseBaselineKey(questionId, answer.id, context)] : undefined }
    })
    const loaded = await read()
    if (loaded.status !== "ok" || !loaded.value) return { status: "unavailable", reason: "answer-work-unavailable" }
    const { thread, answer, baseline } = loaded.value
    if (thread.kind === "comment" || !answer || baseline === undefined) return { status: "ok", value: { state: "unconfirmed" } }
    if (!isBaseline(baseline) || baseline.questionId !== questionId || baseline.answerId !== answer.id || baseline.installationId !== context.binding.installationId || baseline.projectId !== context.binding.projectId) return { status: "unavailable", reason: "answer-work-unavailable" }
    const scope = baseline.scope
    const basis = threadMessageContext(thread, answer)
    if (!basis) return { status: "unavailable", reason: "answer-work-unavailable" }
    if (basis.reviewContext || baseline.reviewBasis) {
      const source = input.reviewSource
      const authorize = input.authorizeHistoricalSources
      const reviewed = baseline.reviewBasis
      if (!source || !authorize || !reviewed || !basis.reviewContext || digestSfValue(reviewed) !== digestSfValue(basis)) return { status: "unavailable", reason: "answer-work-unavailable" }
      const resolve = source.resolve
      const observe = source.observe
      const fence = source.fence
      const host = input.host
      const revalidate = host.revalidate
      const persistence = host.persistence
      const transactionAll = persistence.transactionAll
      const current = () => input.reviewSource === source && source.resolve === resolve && source.observe === observe && source.fence === fence && input.authorizeHistoricalSources === authorize && input.host === host && host.revalidate === revalidate && host.persistence === persistence && persistence.transactionAll === transactionAll
      if (!transactionAll) return { status: "unavailable", reason: "answer-work-unavailable" }
      const derived = await resolve.call(source, reviewed, context)
      if (!current() || derived.status !== "ok" || digestSfValue(derived.value.scope) !== digestSfValue(scope) || !await authorize(reviewed.evidenceRefs, context) || !current()) return { status: "unavailable", reason: "answer-work-unavailable" }
      const observation = await observe.call(source, scope, reviewed, context)
      if (!current() || observation.state !== "available" || observation.physicalIncarnation !== baseline.physicalIncarnation || observation.incarnation !== scope.sourceRef.incarnation || observation.sourceFingerprint !== baseline.sourceFingerprint || observation.dependencyFingerprint !== baseline.dependencyFingerprint || observation.scopeFingerprint !== baseline.scopeFingerprint || observation.sourceVersion !== baseline.observedVersion) return { status: "unavailable", reason: "answer-work-unavailable" }
      const again = await read()
      if (!current() || again.status !== "ok" || !again.value || digestSfValue(again.value.thread) !== digestSfValue(thread) || digestSfValue(again.value.baseline) !== digestSfValue(baseline) || !await authorize(reviewed.evidenceRefs, context) || !current() || !await revalidate.call(host, context) || !current()) return { status: "unavailable", reason: "answer-work-unavailable" }
      if (!await transactionAll.call(persistence, async () => ({ commit: false, value: current() && await fence.call(source, scope, observation, reviewed, context) && current() })).catch(() => false) || !current()) return { status: "unavailable", reason: "answer-work-unavailable" }
      const changed = baseline.answerDigest !== digestSfValue({ questionId, ...answer })
      return { status: "ok", value: { state: changed ? "stale" : "valid", sourceRefs: reviewed.evidenceRefs, period: scope.period, observedVersion: baseline.observedVersion, sourceVersion: observation.sourceVersion, reviewContext: reviewed.reviewContext, ...(changed ? { reason: "answer-changed" } : {}) } }
    }
    const originals = basis.evidenceRefs.filter((ref) => ref.refId === basis.sourceRef)
    const original = originals[0]
    if (originals.length !== 1 || !original || original.kind !== "record" || original.target.surface !== scope.sourceRef.surface || original.target.recordType !== scope.sourceRef.type || original.target.recordId !== scope.sourceRef.id || digestSfValue([...original.target.fields].sort()) !== digestSfValue([...scope.fields].sort()) || digestSfValue(basis.period) !== digestSfValue(scope.period) || !await input.source.verifyManifest(scope, context)) return { status: "unavailable", reason: "answer-work-unavailable" }
    const dependencies = basis.evidenceRefs.filter((ref) => ref !== original)
    if (basis.evidenceRefs.some((ref) => ref.kind !== "record" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) || dependencies.length !== scope.materialDependencies.length || scope.materialDependencies.some((dependency) => dependencies.filter((ref) => ref.kind === "record" && ref.target.surface === dependency.surface && ref.target.recordType === dependency.type && ref.target.recordId === dependency.id && digestSfValue([...ref.target.fields].sort()) === digestSfValue([...dependency.fields].sort()) && digestSfValue(ref.target.period) === digestSfValue(dependency.period)).length !== 1)) return { status: "unavailable", reason: "answer-work-unavailable" }
    const observation = await input.source.observe(scope, context)
    if (observation.state !== "available" || observation.physicalIncarnation !== baseline.physicalIncarnation || !Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.sourceFingerprint || !observation.dependencyFingerprint || !observation.scopeFingerprint) return { status: "unavailable", reason: "answer-work-unavailable" }
    const current = observation.evidence
    if (current.kind !== "record" || current.refDigest !== digestSfEvidenceRef(current) || current.installationId !== context.binding.installationId || current.projectId !== context.binding.projectId || current.target.surface !== scope.sourceRef.surface || current.target.recordType !== scope.sourceRef.type || current.target.recordId !== scope.sourceRef.id || current.target.incarnation !== observation.incarnation || current.target.version !== observation.sourceVersion || digestSfValue([...current.target.fields].sort()) !== digestSfValue([...scope.fields].sort()) || digestSfValue(current.target.period) !== digestSfValue(scope.period) || !await input.authorizeSources([current], context)) return { status: "unavailable", reason: "answer-work-unavailable" }
    const reason = baseline.answerDigest !== digestSfValue({ questionId, ...answer }) ? "answer-changed" as const
      : observation.sourceFingerprint !== baseline.sourceFingerprint ? "material-change" as const
        : observation.dependencyFingerprint !== baseline.dependencyFingerprint ? "dependency-change" as const
          : observation.scopeFingerprint !== baseline.scopeFingerprint ? "material-change" as const : undefined
    const again = await read()
    if (again.status !== "ok" || !again.value || digestSfValue(again.value.thread) !== digestSfValue(thread) || digestSfValue(again.value.baseline) !== digestSfValue(baseline) || !await input.authorizeSources([current], context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-work-unavailable" }
    const transactionAll = input.host.persistence.transactionAll
    if (!transactionAll || !await transactionAll(async () => ({ commit: false, value: await input.source.fenceManifest(scope, context) && await input.source.fence(scope, observation, context) })).catch(() => false)) return { status: "unavailable", reason: "answer-work-unavailable" }
    return { status: "ok", value: { state: reason ? "stale" : "valid", sourceRefs: [current], period: scope.period, observedVersion: baseline.observedVersion, sourceVersion: observation.sourceVersion, ...(reason ? { reason } : {}) } }
  } }
}

function isBaseline(value: unknown): value is AnswerReuseBaseline {
  const baseline = object(value)
  const scope = object(baseline.scope)
  const source = object(scope.sourceRef)
  const identity = (ref: Record<string, unknown>) => ["dashboard", "planner", "procurement"].includes(String(ref.surface)) && [ref.type, ref.id, ref.incarnation].every((entry) => typeof entry === "string" && !!entry.trim())
  const fields = (value: unknown) => Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && !!entry.trim()) && new Set(value).size === value.length
  return [baseline.answerId, baseline.answerRef, baseline.answerDigest, baseline.questionId, baseline.confirmerRef, baseline.installationId, baseline.projectId, baseline.physicalIncarnation, baseline.sourceFingerprint, baseline.dependencyFingerprint, baseline.scopeFingerprint].every((entry) => typeof entry === "string" && !!entry.trim()) && Number.isSafeInteger(baseline.observedVersion) && Number(baseline.observedVersion) > 0 && identity(source) && fields(scope.fields) && isSfPeriod(scope.period) && typeof scope.scopeDefinitionVersion === "string" && !!scope.scopeDefinitionVersion.trim() && Array.isArray(scope.materialDependencies) && scope.materialDependencies.every((entry) => {
    const dependency = object(entry)
    return identity(dependency) && fields(dependency.fields) && isSfPeriod(dependency.period) && Number.isSafeInteger(dependency.version) && Number(dependency.version) > 0 && typeof dependency.observedAt === "string" && Number.isFinite(Date.parse(dependency.observedAt))
  })
}


