import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { ConfirmationCommand, ConfirmationRecord, ConfirmationScope, ConfirmationValidityProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { CollaborationHumanAuthority } from "./human.ts"

/** The domain resolves the authorized material scope on every use; version alone is not a fingerprint. */
export type ConfirmationScopeObservation =
  | { state: "available"; sourceVersion: number; incarnation: string; physicalIncarnation: string; scopeFingerprint: string; sourceFingerprint: string; dependencyFingerprint: string }
  | { state: "removed"; sourceVersion: number }
  | { state: "replaced"; sourceVersion: number }
  | { state: "access-unavailable"; sourceVersion: number }
  | { state: "dependency-unavailable"; sourceVersion: number }

export type AvailableConfirmationScopeObservation = Extract<ConfirmationScopeObservation, { state: "available" }>
export type ConfirmationObserver<T extends AvailableConfirmationScopeObservation> = {
  observe: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<T | Exclude<ConfirmationScopeObservation, AvailableConfirmationScopeObservation>>
  fence: (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => Promise<boolean>
}

type ConfirmationBaseline = { physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string }

export function projectConfirmation(record: ConfirmationRecord & Partial<ConfirmationBaseline>, observation: ConfirmationScopeObservation, evaluatedAt: string): ConfirmationValidityProjection {
  const base = { confirmationId: record.id, evaluatedSourceVersion: observation.sourceVersion, evaluatedAt }
  if (observation.state === "access-unavailable" || observation.state === "dependency-unavailable")
    return { ...base, state: "unavailable", reason: observation.state }
  if (observation.state === "removed") return { ...base, state: "stale", reason: "source-removed" }
  if (observation.state === "replaced") return { ...base, state: "stale", reason: "source-replaced" }
  if (!record.physicalIncarnation || !record.sourceFingerprint || !record.dependencyFingerprint)
    return { ...base, state: "unavailable", reason: "dependency-unavailable" }
  if (observation.physicalIncarnation !== record.physicalIncarnation) return { ...base, state: "stale", reason: "source-replaced" }
  if (observation.sourceFingerprint !== record.sourceFingerprint)
    return { ...base, state: "stale", reason: "material-change", scopeFingerprint: observation.scopeFingerprint }
  if (observation.dependencyFingerprint !== record.dependencyFingerprint)
    return { ...base, state: "stale", reason: "dependency-change", scopeFingerprint: observation.scopeFingerprint }
  if (observation.scopeFingerprint !== record.observedScopeFingerprint)
    return { ...base, state: "unavailable", reason: "dependency-unavailable" }
  return { ...base, state: "valid", reason: "unchanged-scope", scopeFingerprint: observation.scopeFingerprint }
}

/** The host resolves scope and dependencies outside the protected metadata transaction. */
export function createConfirmationPort<T extends AvailableConfirmationScopeObservation>(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  observe: ConfirmationObserver<T>["observe"]
  /** Read-only source fence; it must never refresh or write a scoped-source registry. */
  fence: ConfirmationObserver<T>["fence"]
  verifyObserved: (command: ConfirmationCommand, context: TrustedDomainContext) => Promise<ConfirmationBaseline | undefined>
  creationTarget: { ref: string; incarnation: string }
  human: CollaborationHumanAuthority
  createId: () => string
  now: () => string
}) {
  const port = {
    confirm: async (command: ConfirmationCommand, context: TrustedDomainContext): Promise<PortResult<ConfirmationRecord>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-confirmation-required" }
      if (!isSfPeriod(command.scope.period) || !command.scope.fields.length || command.scope.fields.some((field) => !field.trim()) || new Set(command.scope.fields).size !== command.scope.fields.length || !command.scope.scopeDefinitionVersion.trim() || !command.idempotencyKey.trim() || !command.expectedScopeFingerprint.trim() || !Number.isSafeInteger(command.observedSourceVersion) || command.observedSourceVersion < 1 || !Number.isSafeInteger(command.expectedStorageVersion) || command.expectedStorageVersion < 0)
        return { status: "needs-input", reason: "invalid-confirmation" }
      const selected = structuredClone(command)
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.confirmation.confirm", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
      const displayed = await input.verifyObserved(structuredClone(selected), context)
      if (!displayed) return { status: "denied", reason: "observation-unverified" }
      const observation = await input.observe(structuredClone(selected.scope), context)
      if (observation.state !== "available" || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint) return { status: "unavailable", reason: "scope-unavailable" }
      if (observation.incarnation !== selected.scope.sourceRef.incarnation || observation.scopeFingerprint !== selected.expectedScopeFingerprint || observation.physicalIncarnation !== displayed.physicalIncarnation || observation.sourceFingerprint !== displayed.sourceFingerprint || observation.dependencyFingerprint !== displayed.dependencyFingerprint) return { status: "conflict", reason: "material-scope-changed" }
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
      const record: ConfirmationRecord & ConfirmationBaseline = { physicalIncarnation: displayed.physicalIncarnation, sourceFingerprint: observation.sourceFingerprint, dependencyFingerprint: observation.dependencyFingerprint, id: input.createId(), sourceRef: selected.scope.sourceRef, scope: selected.scope, observedSourceVersion: selected.observedSourceVersion, observedScopeFingerprint: selected.expectedScopeFingerprint, authorId: context.binding.principalRef, confirmedAt: input.now(), auditRef: input.createId() }
      if (!record.id.trim() || !record.auditRef.trim()) return { status: "unavailable", reason: "identity-unavailable" }
      const saved = await input.state.transaction(request, { namespace: "confirmations", expectedStorageVersion: selected.expectedStorageVersion, idempotencyKey: selected.idempotencyKey, commandDigest: digestSfValue({ scope: selected.scope, observedSourceVersion: selected.observedSourceVersion, expectedScopeFingerprint: selected.expectedScopeFingerprint }), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.confirmation.confirm", selected) || state.confirmations[record.id]) return { commit: false, value: null }
        if (!await input.fence(structuredClone(selected.scope), observation, context)) return { commit: false, value: null }
        state.confirmations[record.id] = record
        return { commit: true, value: record }
      })
      if (saved.status === "preview") return { status: "conflict", reason: "confirmation-not-committed" }
      if (saved.status !== "ok") return saved
      if (!saved.value) return { status: "conflict", reason: "confirmation-not-committed" }
      const current = await input.observe(saved.value.scope, context)
      if (!await input.host.revalidate(context) || current.state !== "available") return { status: "unavailable", reason: "scope-unavailable" }
      if (current.incarnation !== saved.value.sourceRef.incarnation || current.scopeFingerprint !== saved.value.observedScopeFingerprint || current.physicalIncarnation !== displayed.physicalIncarnation || current.sourceFingerprint !== displayed.sourceFingerprint || current.dependencyFingerprint !== displayed.dependencyFingerprint) return { status: "stale", reason: "scope-changed-after-commit" }
      return { status: "ok", value: { id: saved.value.id, sourceRef: saved.value.sourceRef, observedSourceVersion: saved.value.observedSourceVersion, observedScopeFingerprint: saved.value.observedScopeFingerprint, scope: saved.value.scope, authorId: saved.value.authorId, confirmedAt: saved.value.confirmedAt, auditRef: saved.value.auditRef } }
    },
    project: async (id: string, context: TrustedDomainContext): Promise<PortResult<ConfirmationValidityProjection>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
      const found = await input.state.read(request, "confirmations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (found.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
      if (found.status !== "ok") return found
      const record = found.value as (ConfirmationRecord & Partial<ConfirmationBaseline>) | undefined
      if (!record) return { status: "unavailable", reason: "confirmation-unavailable" }
      const observation = await input.observe(record.scope, context)
      if (!await input.host.revalidate(context)) return { status: "ok", value: projectConfirmation(record, { state: "access-unavailable", sourceVersion: record.observedSourceVersion }, input.now()) }
      const again = await input.state.read(request, "confirmations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(record)) return { status: "unavailable", reason: "confirmation-unavailable" }
      const initial = projectConfirmation(record, observation, input.now())
      const current = projectConfirmation(record, await input.observe(record.scope, context), input.now())
      if (!await input.host.revalidate(context)) return { status: "ok", value: projectConfirmation(record, { state: "access-unavailable", sourceVersion: record.observedSourceVersion }, input.now()) }
      if (initial.state !== current.state || initial.reason !== current.reason || initial.evaluatedSourceVersion !== current.evaluatedSourceVersion || ("scopeFingerprint" in initial ? initial.scopeFingerprint : undefined) !== ("scopeFingerprint" in current ? current.scopeFingerprint : undefined)) return { status: "stale", reason: "confirmation-source-changed" }
      return { status: "ok", value: current }
    },
  }
  return {
    ...port,
    inspect: async (id: string, context: TrustedDomainContext): Promise<PortResult<{ confirmationId: string; authorId: string; confirmedAt: string; observedSourceVersion: number; period: ConfirmationScope["period"]; validity: ConfirmationValidityProjection }>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
      const found = await input.state.read(request, "confirmations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (found.status !== "ok" || !found.value) return { status: "unavailable", reason: "confirmation-unavailable" }
      const record = found.value
      const validity = await port.project(id, context)
      if (validity.status !== "ok") return validity
      const again = await input.state.read(request, "confirmations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.confirmations[id] : undefined)
      if (again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(record) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "confirmation-unavailable" }
      const current = await port.project(id, context)
      if (current.status !== "ok" || current.value.state !== validity.value.state || current.value.reason !== validity.value.reason || current.value.evaluatedSourceVersion !== validity.value.evaluatedSourceVersion || ("scopeFingerprint" in current.value ? current.value.scopeFingerprint : undefined) !== ("scopeFingerprint" in validity.value ? validity.value.scopeFingerprint : undefined)) return { status: "unavailable", reason: "confirmation-unavailable" }
      return { status: "ok", value: { confirmationId: record.id, authorId: record.authorId, confirmedAt: record.confirmedAt, observedSourceVersion: record.observedSourceVersion, period: record.scope.period, validity: current.value } }
    },
  }
}
