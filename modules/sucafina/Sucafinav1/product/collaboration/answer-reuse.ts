import { digestSfValue } from "../contracts/canonical.ts"
import type { ConfirmationScope } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationScopeObservation } from "./confirmation.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"

type Answer = { id: string; ref: string; authorRef: string; questionId: string; body: string; digest: string }
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
  observe: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<T | Exclude<ConfirmationScopeObservation, T>>
  fence: (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => Promise<boolean>
  authorizeConfirmation: (context: TrustedDomainContext, questionId: string, answerRef: string, mutation: { expectedStorageVersion: number; idempotencyKey: string }) => Promise<boolean>
}) {
  const key = (questionId: string, answerId: string, context: TrustedDomainContext) => `sf:answer-baseline:${digestSfValue({ questionId, answerId, installationId: context.binding.installationId, projectId: context.binding.projectId })}`
  const snapshots = input.host.persistence as PersistenceWithSnapshots
  const capture = async (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => snapshots.transactionAll ? snapshots.transactionAll(async () => ({ commit: false, value: await input.fence(scope, observation, context) })) : false
  return {
    confirm: async (questionId: string, answerRef: string, mutation: { expectedStorageVersion: number; idempotencyKey: string }, context: TrustedDomainContext): Promise<PortResult<{ answerRef: string; observedVersion: number }>> => {
      if (context.kind !== "ui" || !questionId.trim() || !answerRef.trim() || !input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied", reason: "answer-confirmation-unavailable" }
      if (!mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim()) return { status: "needs-input", reason: "invalid-answer-confirmation" }
      const selectedMutation = structuredClone(mutation)
      const answer = await input.answer(questionId, context)
      if (answer.status !== "ok") return answer
      const derived = await input.scopeForAnswer(questionId, answer.value.ref, context)
      if (derived.status !== "ok") return derived
      const scope = structuredClone(derived.value.scope)
      if (answer.value.questionId !== questionId || answer.value.ref !== answerRef || !answer.value.body.trim() || !answer.value.digest || !await input.belongsToQuestion(questionId, answer.value.ref, context) || !await input.authorizeConfirmation(context, questionId, answerRef, selectedMutation)) return { status: "denied", reason: "answer-confirmation-unavailable" }
      const observation = await input.observe(scope, context)
      if (observation.state !== "available" || !Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint || !observation.scopeFingerprint || observation.incarnation !== scope.sourceRef.incarnation) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const request = input.host.requestFor(context)
      if (!request || !snapshots.transactionAll || !snapshots.currentSnapshots) return { status: "unavailable", reason: "answer-source-fence-unavailable" }
      const baseline: Baseline = { answerId: answer.value.id, answerRef: answer.value.ref, answerDigest: answer.value.digest, questionId, confirmerRef: context.binding.principalRef, installationId: context.binding.installationId, projectId: context.binding.projectId, scope, physicalIncarnation: observation.physicalIncarnation, sourceFingerprint: observation.sourceFingerprint, dependencyFingerprint: observation.dependencyFingerprint, scopeFingerprint: observation.scopeFingerprint, observedVersion: observation.sourceVersion }
      const saved = await input.state.transaction(request, { namespace: "threads", sourceFence: "all", expectedStorageVersion: selectedMutation.expectedStorageVersion, idempotencyKey: selectedMutation.idempotencyKey, commandDigest: digestSfValue({ questionId, answerId: answer.value.id, answerDigest: answer.value.digest, scope }), targetRef: input.target.ref, targetIncarnation: input.target.incarnation }, async (state, authority) => {
        const original = state.threads[questionId]
        const live = snapshots.currentSnapshots?.()
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !original || digestSfValue(original) !== answer.value.digest || !await input.authorizeConfirmation(context, questionId, answerRef, selectedMutation) || !live || !await input.fence(scope, observation, context)) return { commit: false, value: false }
        state.threads[key(questionId, answer.value.id, context)] = baseline
        return { commit: true, value: true }
      })
      if (saved.status === "preview") return { status: "conflict", reason: "answer-confirmation-not-committed" }
      if (saved.status !== "ok" || !saved.value || !await input.host.revalidate(context)) return { status: saved.status === "conflict" ? "stale" : saved.status === "ok" ? "unavailable" : saved.status, reason: saved.status === "ok" ? "answer-confirmation-unavailable" : saved.reason }
      return { status: "ok", value: { answerRef: answer.value.ref, observedVersion: observation.sourceVersion } }
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
      const stored = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[baselineKey] as Baseline | undefined : undefined)
      if (stored.status !== "ok" || !stored.value || stored.value.questionId !== questionId || stored.value.answerId !== candidate.value.id || stored.value.answerRef !== candidate.value.ref || stored.value.answerDigest !== candidate.value.digest || stored.value.installationId !== context.binding.installationId || stored.value.projectId !== context.binding.projectId || digestSfValue(scopeIdentity(stored.value.scope)) !== digestSfValue(scopeIdentity(scope))) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const observation = await input.observe(scope, context)
      if (observation.state === "access-unavailable" || observation.state === "dependency-unavailable") return { status: "unavailable", reason: "answer-reuse-unavailable" }
      if (observation.state !== "available" || observation.physicalIncarnation !== stored.value.physicalIncarnation || observation.sourceFingerprint !== stored.value.sourceFingerprint || observation.dependencyFingerprint !== stored.value.dependencyFingerprint || observation.scopeFingerprint !== stored.value.scopeFingerprint || observation.incarnation !== scope.sourceRef.incarnation) return { status: "stale", reason: "answer-scope-changed" }
      const fenced = await capture(scope, observation, context)
      if (!fenced || !await input.host.revalidate(context)) return { status: "stale", reason: "answer-scope-changed" }
      const again = await input.answer(questionId, context)
      if (again.status !== "ok" || again.value.id !== candidate.value.id || again.value.ref !== candidate.value.ref || again.value.digest !== candidate.value.digest || again.value.authorRef !== candidate.value.authorRef || !await input.belongsToQuestion(questionId, again.value.ref, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "answer-reuse-unavailable" }
      const latest = await input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[baselineKey] as Baseline | undefined : undefined)
      if (latest.status !== "ok" || !latest.value || digestSfValue(latest.value) !== digestSfValue(stored.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "answer-baseline-changed" }
      return { status: "ok", value: { answerRef: again.value.ref, answer: again.value.body, authorRef: again.value.authorRef, observedVersion: stored.value.observedVersion } }
    },
  }
}

function scopeIdentity(scope: ConfirmationScope) {
  return { surface: scope.sourceRef.surface, type: scope.sourceRef.type, id: scope.sourceRef.id, fields: [...scope.fields].sort(), period: scope.period, materialDependencies: scope.materialDependencies.map((dependency) => ({ surface: dependency.surface, type: dependency.type, id: dependency.id, fields: [...dependency.fields].sort(), period: dependency.period })).toSorted((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))), scopeDefinitionVersion: scope.scopeDefinitionVersion }
}
