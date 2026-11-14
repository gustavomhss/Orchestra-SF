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
  now: () => number
}) {
  const observations = new Map<string, { issuedAt: number; expires: number; physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string }>()
  const key = (scope: ConfirmationScope, version: number, fingerprint: string, context: TrustedDomainContext) => digestSfValue({
    scope: { ...scope, fields: [...scope.fields].sort(), materialDependencies: scope.materialDependencies.map((dependency) => ({ ...dependency, fields: [...dependency.fields].sort() })).toSorted((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))) }, version, fingerprint, installationId: context.binding.installationId, projectId: context.binding.projectId,
    principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion,
  })
  return {
    prepare: async (scope: ConfirmationScope, context: TrustedDomainContext): Promise<PortResult<T>> => {
      const selected = structuredClone(scope)
      if (context.kind !== "ui" || !input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied", reason: "observation-access-unavailable" }
      const observation = await input.observe(selected, context)
      if (observation.state !== "available") return { status: "unavailable", reason: observation.state }
      if (!Number.isSafeInteger(observation.sourceVersion) || observation.sourceVersion < 1 || !observation.scopeFingerprint || !observation.physicalIncarnation || !observation.sourceFingerprint || !observation.dependencyFingerprint || observation.incarnation !== selected.sourceRef.incarnation || !await input.host.revalidate(context)) return { status: "unavailable", reason: "observation-unavailable" }
      const issuedAt = input.now()
      const expires = issuedAt + 5 * 60 * 1000
      if (!Number.isFinite(issuedAt) || !Number.isFinite(expires)) return { status: "unavailable", reason: "observation-clock-unavailable" }
      observations.set(key(selected, observation.sourceVersion, observation.scopeFingerprint, context), { issuedAt, expires, physicalIncarnation: observation.physicalIncarnation, sourceFingerprint: observation.sourceFingerprint, dependencyFingerprint: observation.dependencyFingerprint })
      if (observations.size > 512) observations.delete(observations.keys().next().value!)
      return { status: "ok", value: structuredClone(observation) }
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
