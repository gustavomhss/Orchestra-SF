import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { projectPlannerSource } from "../planner/port.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BaselineCoverage, BaselineCoverageRequest } from "./baseline-coverage.ts"

/** Fence a single Planner source and the exact human classification under the storage lock. */
export function createDecisionBaselineFence(input: {
  resolveActor: (snapshot: Snapshot, context: TrustedDomainContext) => Actor | undefined
  matchesIntent: (context: TrustedDomainContext, action: "decisions.coverage", payload: BaselineCoverageRequest) => boolean
}) {
  return (snapshot: Snapshot, request: BaselineCoverageRequest, record: BaselineCoverage, context: TrustedDomainContext) => {
    try {
      if (context.kind !== "ui" || !input.matchesIntent(context, "decisions.coverage", request) || request.source.target.surface !== "planner" || request.source.target.recordType !== "planner-version" || digestSfValue(record.source) !== digestSfValue(request.source)) return false
      const actor = input.resolveActor(snapshot, context)
      if (!actor || actor.id !== context.binding.principalRef) return false
      const refs = [request.source, ...request.basis.sourceRefs, ...request.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      return verifyDecisionPlannerSources(snapshot, refs, actor, context) && input.matchesIntent(context, "decisions.coverage", request)
    } catch { return false }
  }
}

/** Fail closed on non-Planner references until a host supplies their surface-specific fence. */
export function verifyDecisionPlannerSources(snapshot: Snapshot, refs: readonly BusinessEvidenceRef[], actor: Actor, context: TrustedDomainContext) {
  try {
    if (!refs.length || actor.id !== context.binding.principalRef) return false
    return refs.every((ref) => {
      if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: ref.target.recordType, recordId: ref.target.recordId, selector: sfPlannerProjectionSelector(snapshot, actor) }
      const identity = sfScopedSourceIdentity(snapshot, scope)
      const projection = projectPlannerSource(snapshot, actor, ref.target.recordId)
      return !!identity && identity.incarnation === ref.target.incarnation && identity.version === ref.target.version && !!projection && digestSfValue(Object.keys(projection).sort()) === digestSfValue([...ref.target.fields].sort()) && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
    })
  } catch { return false }
}
