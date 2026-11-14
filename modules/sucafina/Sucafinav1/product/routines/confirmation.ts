import type { ConfirmationScope, ConfirmationValidityProjection } from "../contracts/context.ts"
import type { ForecastCompareRequest } from "../contracts/operations.ts"
import type { PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ForecastReviewHost } from "./forecast.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** Ask C06 for confirmations of the exact authorized scopes supplied by the host. */
export function createScopedConfirmationIndex(input: {
  resolveScopes: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly ConfirmationScope[]>>
  confirmation: { find: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<PortResult<{ confirmationIds: readonly string[] }>> }
  revalidate: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: ForecastCompareRequest, context: TrustedDomainContext): Promise<PortResult<readonly string[]>> => {
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    const scopes = await input.resolveScopes(request, context)
    if (scopes.status !== "ok") return scopes
    const found = await Promise.all(scopes.value.map((scope) => input.confirmation.find(scope, context)))
    const error = found.find((result) => result.status !== "ok")
    if (error && error.status !== "ok") return error
    const current = await input.resolveScopes(request, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(scopes.value)) return { status: "stale", reason: "confirmation-scope-changed" }
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    return { status: "ok", value: [...new Set(found.flatMap((result) => result.status === "ok" ? result.value.confirmationIds : []))] }
  }
}

/** The index selects confirmation IDs for this exact authorized scope; it cannot assert validity. */
export function createForecastConfirmationHost(input: {
  planner: PlannerPort
  confirmation?: { project: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection>> }
  listConfirmationIds: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly string[]>>
  revalidate: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<boolean>
  responsibles?: ForecastReviewHost["responsibles"]
  recordedReasons?: ForecastReviewHost["recordedReasons"]
  facts?: ForecastReviewHost["facts"]
  revalidateFacts?: ForecastReviewHost["revalidateFacts"]
}): ForecastReviewHost {
  return {
    planner: input.planner,
    revalidate: input.revalidate,
    responsibles: input.responsibles,
    recordedReasons: input.recordedReasons,
    facts: input.facts,
    revalidateFacts: input.revalidateFacts,
    confirmations: async (request, context) => {
      if (!input.confirmation) return { status: "unavailable", reason: "confirmation-producer-unavailable" }
      if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
      const selected = await input.listConfirmationIds(request, context)
      if (selected.status !== "ok") return selected
      const ids = [...new Set(selected.value)]
      if (ids.some((id) => !id.trim())) return { status: "unavailable", reason: "confirmation-index-invalid" }
      const projected = await Promise.all(ids.map((id) => input.confirmation!.project(id, context)))
      if (projected.some((result, index) => result.status !== "ok" || result.value.confirmationId !== ids[index] || result.value.state === "unavailable")) return { status: "unavailable", reason: "confirmation-source-unavailable" }
      const current = await input.listConfirmationIds(request, context)
      if (current.status !== "ok") return current
      if (digestSfValue([...new Set(current.value)].sort()) !== digestSfValue(ids.sort())) return { status: "stale", reason: "confirmation-selection-changed" }
      if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
      return { status: "ok", value: projected.flatMap((result) => result.status === "ok" ? [result.value] : []) }
    },
  }
}

