import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { RecallFeatures } from "./recall.ts"

/** Features are derived from the current authorized case, not user-supplied similarity labels. */
export function deriveAuthorizedRecallFeatures(projection: AuthorizedCaseProjection, call: TrustedDomainContext): RecallFeatures | undefined {
  const context = projection.context
  const value = projection.case
  if (![context.installationId, context.projectId, context.principalRef, context.accessRevision, context.policyVersion].every((item) => item.trim()) || context.kind !== call.kind || context.installationId !== call.binding.installationId || context.projectId !== call.binding.projectId || context.principalRef !== call.binding.principalRef || context.accessRevision !== call.binding.accessRevision || context.policyVersion !== call.binding.policyVersion) return undefined
  if (!value.id.trim() || !value.incarnation.trim() || !Number.isSafeInteger(value.version) || value.version < 1 || !value.participants.includes(call.binding.principalRef)) return undefined
  // A precedent is a different case. Its reader must prove current access; deriving
  // comparison features does not change the originating native session's binding.
  if (call.kind === "native" && (context.kind !== "native" || context.profileId !== call.binding.profileId)) return undefined
  const types = [...new Set(value.costCoverageBases.map((basis) => basis.decisionType))]
  if (types.length !== 1 || !types[0]?.trim() || !isSfPeriod(value.horizon)) return undefined
  const results = [...value.alternatives.map((alternative) => alternative.result), ...value.choices.map((choice) => choice.result)]
  if (results.some((result) => result.horizon.start !== value.horizon.start || result.horizon.end !== value.horizon.end)) return undefined
  const components = results.flatMap((result) => result.components.map((component) => component.id))
  const restrictions = results.flatMap((result) => result.restrictions)
  if ([...components, ...restrictions].some((item) => !item.trim())) return undefined
  return { decisionType: types[0], horizon: `${value.horizon.start}/${value.horizon.end}`, components: [...new Set(components)].sort(), restrictions: [...new Set(restrictions)].sort(), resultAvailable: results.length > 0 && results.every((result) => result.comparisonStatus === "complete") }
}
