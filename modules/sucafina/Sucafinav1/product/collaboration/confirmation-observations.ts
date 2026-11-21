import { digestSfValue } from "../contracts/canonical.ts"
import type { ConfirmationCommand, ConfirmationScope } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ConfirmationScopeObservation } from "./confirmation.ts"

type Available = Extract<ConfirmationScopeObservation, { state: "available" }>

/** Private, short-lived proof that the same principal received this exact material observation. */
export function createConfirmationObservationReceipts<T extends Available>(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  observe: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<T | Exclude<ConfirmationScopeObservation, Available>>
  fence?: (scope: ConfirmationScope, observation: T, context: TrustedDomainContext) => Promise<boolean>
  now: () => number
}) {
  const observations = new Map<string, { issuedAt: number; expires: number; scope: ConfirmationScope; observation: T; physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string }>()
  const key = (scope: ConfirmationScope, version: number, fingerprint: string, context: TrustedDomainContext) => digestSfValue({
    scope: { ...scope, fields: [...scope.fields].sort(), materialDependencies: scope.materialDependencies.map((dependency) => ({ ...dependency, fields: [...dependency.fields].sort() })).toSorted((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))) }, version, fingerprint, installationId: context.binding.installationId, projectId: context.binding.projectId,
    principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion,
  })
  return {
    prepare: async (scope: ConfirmationScope, context: TrustedDomainContext): Promise<PortResult<T & { selectionRef: string }>> => {
      const selected = structuredClone(scope)
      const request = input.host.requestFor(context)
      const binding = digestSfValue([context.kind, context.binding])
      const scopeDigest = digestSfValue(selected)
      const current = () => !!request && !request.signal.aborted && digestSfValue([context.kind, context.binding]) === binding && digestSfValue(selected) === scopeDigest && digestSfValue(scope) === scopeDigest
      if (context.kind !== "ui" || !request || !await input.host.revalidate(context) || !current()) return { status: "denied", reason: "observation-access-unavailable" }
      const observation = await input.observe(selected, context)
      if (observation.state !== "available") return { status: "unavailable", reason: observation.state }
      const observedDigest = digestSfValue(observation)
      if (!Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.scopeFingerprint || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint || observation.incarnation !== selected.sourceRef.incarnation || !await input.host.revalidate(context) || !current() || digestSfValue(observation) !== observedDigest) return { status: "unavailable", reason: "observation-unavailable" }
      const issuedAt = input.now()
      const expires = issuedAt + 5 * 60 * 1000
      if (!Number.isFinite(issuedAt) || !Number.isFinite(expires)) return { status: "unavailable", reason: "observation-clock-unavailable" }
      const identity = key(selected, observation.sourceVersion, observation.scopeFingerprint, context)
      observations.set(identity, { issuedAt, expires, scope: structuredClone(selected), observation: structuredClone(observation), physicalIncarnation: observation.physicalIncarnation, sourceFingerprint: observation.sourceFingerprint, dependencyFingerprint: observation.dependencyFingerprint })
      if (observations.size > 512) observations.delete(observations.keys().next().value!)
      return { status: "ok", value: { ...structuredClone(observation), selectionRef: "confirmation-selection:" + identity } }
    },
    readSelection: async (selectionRef: string, context: TrustedDomainContext): Promise<PortResult<{ selectionRef: string; scope: ConfirmationScope; observation: T }>> => {
      if (typeof selectionRef !== "string" || !/^confirmation-selection:[a-f0-9]{64}$/.test(selectionRef)) return { status: "needs-input", reason: "invalid-confirmation-selection" }
      const identity = selectionRef.slice("confirmation-selection:".length)
      const entry = observations.get(identity)
      const request = input.host.requestFor(context)
      const fence = input.fence
      const binding = digestSfValue([context.kind, context.binding])
      const before = input.now()
      const current = () => !!request && !request.signal.aborted && digestSfValue([context.kind, context.binding]) === binding && observations.get(identity) === entry
      if (context.kind !== "ui" || !request || !entry || !fence || !Number.isFinite(before) || before < entry.issuedAt || before >= entry.expires || !await input.host.revalidate(context) || !current()) return { status: "unavailable", reason: "confirmation-selection-unavailable" }
      const scope = structuredClone(entry.scope)
      const scopeDigest = digestSfValue(scope)
      if (key(scope, entry.observation.sourceVersion, entry.observation.scopeFingerprint, context) !== identity) return { status: "unavailable", reason: "confirmation-selection-unavailable" }
      const matches = (value: ConfirmationScopeObservation): value is T => value.state === "available" && value.sourceVersion === entry.observation.sourceVersion && value.incarnation === entry.observation.incarnation && value.physicalIncarnation === entry.physicalIncarnation && value.scopeFingerprint === entry.observation.scopeFingerprint && value.sourceFingerprint === entry.sourceFingerprint && value.dependencyFingerprint === entry.dependencyFingerprint
      const first = await input.observe(structuredClone(scope), context)
      const firstDigest = digestSfValue(first)
      if (!matches(first) || !await fence(structuredClone(scope), first, context) || !await input.host.revalidate(context) || !current() || digestSfValue(scope) !== scopeDigest || digestSfValue(first) !== firstDigest) return { status: "stale", reason: "confirmation-selection-changed" }
      const second = await input.observe(structuredClone(scope), context)
      const secondDigest = digestSfValue(second)
      if (!matches(second) || !await fence(structuredClone(scope), second, context) || !await input.host.revalidate(context) || !current() || digestSfValue(scope) !== scopeDigest || digestSfValue(second) !== secondDigest) return { status: "stale", reason: "confirmation-selection-changed" }
      const after = input.now()
      if (!Number.isFinite(after) || after < before || after >= entry.expires || !current()) return { status: "stale", reason: "confirmation-selection-expired" }
      return { status: "ok", value: { selectionRef, scope, observation: structuredClone(second) } }
    },
    verifyObserved: async (command: ConfirmationCommand, context: TrustedDomainContext) => {
      const identity = key(command.scope, command.observedSourceVersion, command.expectedScopeFingerprint, context)
      const observed = observations.get(identity)
      const before = input.now()
      if (context.kind !== "ui" || !input.host.requestFor(context) || !observed || !Number.isFinite(before) || before < observed.issuedAt || before >= observed.expires || !await input.host.revalidate(context)) return undefined
      const after = input.now()
      if (!Number.isFinite(after) || after < before || after >= observed.expires || observations.get(identity) !== observed) return undefined
      return { physicalIncarnation: observed.physicalIncarnation, sourceFingerprint: observed.sourceFingerprint, dependencyFingerprint: observed.dependencyFingerprint }
    },
  }
}
