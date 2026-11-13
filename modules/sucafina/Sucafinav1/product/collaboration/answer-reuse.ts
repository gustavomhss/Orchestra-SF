import { digestSfValue } from "../contracts/canonical.ts"
import type { ConfirmationScope } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationObserver } from "./confirmation.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"

type Answer = { id: string; ref: string; authorRef: string; questionId: string; body: string; digest: string; threadDigest: string }
export type AnswerConfirmationMutation = { expectedStorageVersion: number; idempotencyKey: string; observationRef: string; observedSourceVersion: number; expectedScopeFingerprint: string }
type Baseline = { answerId: string; answerRef: string; answerDigest: string; questionId: string; confirmerRef: string; installationId: string; projectId: string; scope: ConfirmationScope; physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string; scopeFingerprint: string; observedVersion: number }
type PersistenceWithSnapshots = DomainPortHost["persistence"] & {
  transactionAll?: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>) => Promise<T>
  currentSnapshots?: () => Readonly<Record<Surface, Snapshot>> | undefined
}

/** Private temporal proof for answer reuse; scope and fingerprints are always producer-owned. */
export function createAnswerReusePort<T extends AvailableConfirmationScopeObservation>(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">
  state: SfProductStatePort
  target: { ref: string; incarnation: string }
  answer: (questionId: string, context: TrustedDomainContext) => Promise<PortResult<Answer>>
  belongsToQuestion: (questionId: string, answerRef: string, context: TrustedDomainContext) => Promise<boolean>
  scopeForAnswer: (questionId: string, answerRef: string, context: TrustedDomainContext) => Promise<PortResult<{ scope: ConfirmationScope }>>
  observe: ConfirmationObserver<T>["observe"]
  fence: (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => Promise<boolean>
  authorizeConfirmation: (context: TrustedDomainContext, questionId: string, answerRef: string, mutation: AnswerConfirmationMutation) => Promise<boolean>
  now?: () => number
}) {
  const key = (questionId: string, answerId: string, context: TrustedDomainContext) => `sf:answer-baseline:${digestSfValue({ questionId, answerId, installationId: context.binding.installationId, projectId: context.binding.projectId })}`
  const snapshots = input.host.persistence as PersistenceWithSnapshots
  const capture = async (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => snapshots.transactionAll ? snapshots.transactionAll(async () => ({ commit: false, value: await input.fence(scope, observation, context) })) : false
  const now = input.now ?? Date.now
  const identity = (context: TrustedDomainContext) => digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion })
  const observations = new Map<string, { authority: string; issuedAt: number; expiresAt: number; answer: Answer; scope: ConfirmationScope; observation: T }>()
  const currentReceipt = (receipt: { issuedAt: number; expiresAt: number }) => { const instant = now(); return Number.isFinite(instant) && instant >= receipt.issuedAt && instant < receipt.expiresAt }
  return {
    prepare: async (questionId: string, answerRef: string, context: TrustedDomainContext) => {
      if (context.kind !== "ui" || typeof questionId !== "string" || !questionId.trim() || typeof answerRef !== "string" || !answerRef.trim() || !input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied" as const, reason: "answer-observation-unavailable" }
      const answer = await input.answer(questionId, context)
      if (answer.status !== "ok") return answer
      if (answer.value.questionId !== questionId || answer.value.ref !== answerRef || !answer.value.body.trim() || !answer.value.authorRef.trim() || !await input.belongsToQuestion(questionId, answerRef, context)) return { status: "unavailable" as const, reason: "answer-observation-unavailable" }
      const derived = await input.scopeForAnswer(questionId, answerRef, context)
      if (derived.status !== "ok") return derived
      const scope = structuredClone(derived.value.scope)
      const observation = await input.observe(scope, context)
      if (observation.state !== "available" || !Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.scopeFingerprint || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint || observation.incarnation !== scope.sourceRef.incarnation) return { status: "unavailable" as const, reason: "answer-scope-unavailable" }
      const again = await input.answer(questionId, context)
      if (again.status !== "ok" || answerIdentity(again.value) !== answerIdentity(answer.value) || !await input.belongsToQuestion(questionId, answerRef, context) || !await input.host.revalidate(context) || !await capture(scope, observation, context)) return { status: "stale" as const, reason: "answer-observation-changed" }
      const issuedAt = now()
      const expiresAt = issuedAt + 5 * 60 * 1000
      if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return { status: "unavailable" as const, reason: "answer-observation-clock-unavailable" }
      const observationRef = crypto.randomUUID()
      observations.set(observationRef, structuredClone({ authority: identity(context), issuedAt, expiresAt, answer: answer.value, scope, observation }))
      if (observations.size > 512) observations.delete(observations.keys().next().value!)
      return { status: "ok" as const, value: { observationRef, observedSourceVersion: observation.sourceVersion, expectedScopeFingerprint: observation.scopeFingerprint, answerRef, answer: answer.value.body, authorRef: answer.value.authorRef, scope, observation: structuredClone(observation) } }
    },
    confirm: async (questionId: string, answerRef: string, mutation: AnswerConfirmationMutation, context: TrustedDomainContext): Promise<PortResult<{ answerRef: string; observedVersion: number }>> => {
      if (context.kind !== "ui" || typeof questionId !== "string" || !questionId.trim() || typeof answerRef !== "string" || !answerRef.trim() || !input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied", reason: "answer-confirmation-unavailable" }
      if (!mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim() || typeof mutation.observationRef !== "string" || !Number.isSafeInteger(mutation.observedSourceVersion) || mutation.observedSourceVersion < 1 || typeof mutation.expectedScopeFingerprint !== "string" || !mutation.expectedScopeFingerprint.trim()) return { status: "needs-input", reason: "invalid-answer-confirmation" }
      const selectedMutation = structuredClone(mutation)
      const observed = observations.get(selectedMutation.observationRef)
      if (!observed || !currentReceipt(observed) || observed.authority !== identity(context) || observed.answer.questionId !== questionId || observed.answer.ref !== answerRef || observed.observation.sourceVersion !== selectedMutation.observedSourceVersion || observed.observation.scopeFingerprint !== selectedMutation.expectedScopeFingerprint) return { status: "denied", reason: "answer-observation-unavailable" }
      const answer = await input.answer(questionId, context)
      if (answer.status !== "ok") return answer
      const derived = await input.scopeForAnswer(questionId, answer.value.ref, context)
      if (derived.status !== "ok") return derived
      const scope = structuredClone(derived.value.scope)
      if (answer.value.questionId !== questionId || answer.value.ref !== answerRef || !answer.value.body.trim() || !answer.value.digest || !await input.belongsToQuestion(questionId, answer.value.ref, context) || !await input.authorizeConfirmation(context, questionId, answerRef, selectedMutation)) return { status: "denied", reason: "answer-confirmation-unavailable" }
      if (answerIdentity(answer.value) !== answerIdentity(observed.answer) || digestSfValue(scopeIdentity(scope)) !== digestSfValue(scopeIdentity(observed.scope))) return { status: "stale", reason: "answer-observation-changed" }
      const observation = await input.observe(scope, context)
      if (observation.state !== "available" || !Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint || !observation.scopeFingerprint || observation.incarnation !== scope.sourceRef.incarnation) return { status: "unavailable", reason: "answer-scope-unavailable" }
      if (observation.physicalIncarnation !== observed.observation.physicalIncarnation || observation.sourceFingerprint !== observed.observation.sourceFingerprint || observation.dependencyFingerprint !== observed.observation.dependencyFingerprint || observation.scopeFingerprint !== observed.observation.scopeFingerprint) return { status: "conflict", reason: "answer-scope-changed" }
      const request = input.host.requestFor(context)
      if (!request || !snapshots.transactionAll || !snapshots.currentSnapshots) return { status: "unavailable", reason: "answer-source-fence-unavailable" }
      const baseline: Baseline = { answerId: answer.value.id, answerRef: answer.value.ref, answerDigest: answer.value.digest, questionId, confirmerRef: context.binding.principalRef, installationId: context.binding.installationId, projectId: context.binding.projectId, scope: observed.scope, physicalIncarnation: observation.physicalIncarnation, sourceFingerprint: observation.sourceFingerprint, dependencyFingerprint: observation.dependencyFingerprint, scopeFingerprint: observation.scopeFingerprint, observedVersion: observed.observation.sourceVersion }
      const saved = await input.state.transaction(request, { namespace: "threads", expectedStorageVersion: selectedMutation.expectedStorageVersion, idempotencyKey: selectedMutation.idempotencyKey, commandDigest: digestSfValue({ questionId, answerId: answer.value.id, answerDigest: answer.value.digest, scope: observed.scope, observedSourceVersion: selectedMutation.observedSourceVersion, expectedScopeFingerprint: selectedMutation.expectedScopeFingerprint }), targetRef: input.target.ref, targetIncarnation: input.target.incarnation }, async (state, authority) => {
        const original = state.threads[questionId]
        const live = snapshots.currentSnapshots?.()
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !original || digestSfValue(original) !== answer.value.threadDigest || !await input.authorizeConfirmation(context, questionId, answerRef, selectedMutation) || !currentReceipt(observed) || !live || !await input.fence(scope, observation, context)) return { commit: false, value: false }
        const previous = state.threads[key(questionId, answer.value.id, context)]
        if (previous) state.threads[`sf:answer-history:${digestSfValue(previous)}`] = structuredClone(previous)
        state.threads[key(questionId, answer.value.id, context)] = baseline
        return { commit: true, value: true }
      })
      if ("reason" in saved) return { status: saved.status === "conflict" ? "stale" : saved.status, reason: saved.reason }
      if (saved.status === "preview") return { status: "conflict", reason: "answer-confirmation-not-committed" }
      if (!saved.value || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-confirmation-unavailable" }
      if (!await capture(scope, observation, context)) return { status: "stale", reason: "answer-scope-changed" }
      return { status: "ok", value: { answerRef: answer.value.ref, observedVersion: observed.observation.sourceVersion } }
    },
    read: async (questionId: string, context: TrustedDomainContext): Promise<PortResult<{ answerRef: string; answer: string; authorRef: string; observedVersion: number }>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "answer-reuse-unavailable" }
      const candidate = await input.answer(questionId, context)
      if (candidate.status !== "ok") return candidate
      if (candidate.value.questionId !== questionId || !await input.belongsToQuestion(questionId, candidate.value.ref, context)) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const derived = await input.scopeForAnswer(questionId, candidate.value.ref, context)
      if (derived.status !== "ok") return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const scope = derived.value.scope
      const baselineKey = key(questionId, candidate.value.id, context)
      const readBaseline = () => input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? { baseline: state.threads[baselineKey] as Baseline | undefined } : undefined)
      const stored = await readBaseline()
      if (stored.status !== "ok" || !stored.value) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const baseline = stored.value.baseline
      if (baseline === undefined) {
        const current = await input.observe(scope, context)
        if (current.state !== "available" || current.incarnation !== scope.sourceRef.incarnation || !current.physicalIncarnation || !current.sourceFingerprint || !current.dependencyFingerprint || !current.scopeFingerprint) return { status: "unavailable", reason: "answer-reuse-unavailable" }
        const answer = await input.answer(questionId, context)
        if (answer.status !== "ok" || answerIdentity(answer.value) !== answerIdentity(candidate.value) || !await input.belongsToQuestion(questionId, answer.value.ref, context) || !await input.host.revalidate(context) || !await capture(scope, current, context)) return { status: "unavailable", reason: "answer-reuse-unavailable" }
        return { status: "needs-input", reason: "answer-unconfirmed" }
      }
      if (!baseline || baseline.questionId !== questionId || baseline.answerId !== candidate.value.id || baseline.answerRef !== candidate.value.ref || baseline.answerDigest !== candidate.value.digest || baseline.installationId !== context.binding.installationId || baseline.projectId !== context.binding.projectId || digestSfValue(scopeIdentity(baseline.scope)) !== digestSfValue(scopeIdentity(scope))) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const observation = await input.observe(scope, context)
      if (observation.state === "access-unavailable" || observation.state === "dependency-unavailable") return { status: "unavailable", reason: "answer-reuse-unavailable" }
      if (observation.state !== "available" || observation.physicalIncarnation !== baseline.physicalIncarnation || observation.sourceFingerprint !== baseline.sourceFingerprint || observation.dependencyFingerprint !== baseline.dependencyFingerprint || observation.scopeFingerprint !== baseline.scopeFingerprint || observation.incarnation !== scope.sourceRef.incarnation) return { status: "stale", reason: "answer-scope-changed" }
      const fenced = await capture(scope, observation, context)
      if (!fenced || !await input.host.revalidate(context)) return { status: "stale", reason: "answer-scope-changed" }
      const again = await input.answer(questionId, context)
      if (again.status !== "ok" || again.value.id !== candidate.value.id || again.value.ref !== candidate.value.ref || again.value.digest !== candidate.value.digest || again.value.authorRef !== candidate.value.authorRef || !await input.belongsToQuestion(questionId, again.value.ref, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const latest = await readBaseline()
      if (latest.status !== "ok" || !latest.value?.baseline || digestSfValue(latest.value.baseline) !== digestSfValue(baseline) || !await input.host.revalidate(context)) return { status: "stale", reason: "answer-baseline-changed" }
      if (!await capture(scope, observation, context)) return { status: "stale", reason: "answer-scope-changed" }
      return { status: "ok", value: { answerRef: again.value.ref, answer: again.value.body, authorRef: again.value.authorRef, observedVersion: baseline.observedVersion } }
    },
  }
}

function answerIdentity(answer: Answer) {
  return digestSfValue({ id: answer.id, ref: answer.ref, authorRef: answer.authorRef, questionId: answer.questionId, body: answer.body, digest: answer.digest })
}

function scopeIdentity(scope: ConfirmationScope) {
  return { surface: scope.sourceRef.surface, type: scope.sourceRef.type, id: scope.sourceRef.id, fields: [...scope.fields].sort(), period: scope.period, materialDependencies: scope.materialDependencies.map((dependency) => ({ surface: dependency.surface, type: dependency.type, id: dependency.id, fields: [...dependency.fields].sort(), period: dependency.period })).toSorted((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))), scopeDefinitionVersion: scope.scopeDefinitionVersion }
}

