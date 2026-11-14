import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmationScope, DomainProjection } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { AvailableConfirmationScopeObservation, ConfirmationObserver } from "./confirmation.ts"

export type CollaborationConfirmationObservation = AvailableConfirmationScopeObservation & {
  evidence: Extract<BusinessEvidenceRef, { kind: "record" }>
  projection: DomainProjection
}

export type CollaborationConfirmationSource = ConfirmationObserver<CollaborationConfirmationObservation> & {
  verifyManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
  fenceManifest: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<boolean>
}

/** Compose producer-owned observers; an absent surface cannot borrow another domain's manifest. */
export function createCollaborationConfirmationSource(input: {
  dashboard?: CollaborationConfirmationSource
  planner?: CollaborationConfirmationSource
  procurement?: CollaborationConfirmationSource
}): CollaborationConfirmationSource {
  const sources = { ...input }
  const sourceFor = (scope: ConfirmationScope) => scope?.sourceRef?.surface === "dashboard" ? sources.dashboard
    : scope?.sourceRef?.surface === "planner" ? sources.planner
      : scope?.sourceRef?.surface === "procurement" ? sources.procurement : undefined
  return {
    verifyManifest: async (scope, context) => await sourceFor(scope)?.verifyManifest(scope, context) === true,
    fenceManifest: async (scope, context) => await sourceFor(scope)?.fenceManifest(scope, context) === true,
    observe: async (scope, context) => {
      const selected = structuredClone(scope)
      const source = sourceFor(selected)
      if (!source || !await source.verifyManifest(selected, context)) return { state: "dependency-unavailable", sourceVersion: 0 }
      return source.observe(selected, context)
    },
    fence: async (scope, observation, context) => {
      const selected = structuredClone(scope)
      const source = sourceFor(selected)
      return !!source && await source.fenceManifest(selected, context) && await source.fence(selected, observation, context)
    },
  }
}
