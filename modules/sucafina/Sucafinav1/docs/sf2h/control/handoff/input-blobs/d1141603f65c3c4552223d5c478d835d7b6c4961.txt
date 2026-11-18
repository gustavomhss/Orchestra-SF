import { variance } from "../../src/planner-accounts.ts"
import type { DomainProjection } from "../contracts/context.ts"

/** Explain the change in visible components without attributing a business cause. */
export function comparePlannerVersions(baseline: DomainProjection, candidate: DomainProjection) {
  if (baseline.context.currency !== candidate.context.currency || baseline.context.period.start !== candidate.context.period.start || baseline.context.period.end !== candidate.context.period.end) return { status: "incompatible" as const, rows: [] }
  if (new Set(baseline.components.map((component) => component.id)).size !== baseline.components.length || new Set(candidate.components.map((component) => component.id)).size !== candidate.components.length) return { status: "unavailable" as const, rows: [] }
  const ids = [...new Set([...baseline.components.map((component) => component.id), ...candidate.components.map((component) => component.id)])]
  return { status: "ok" as const, rows: ids.map((id) => {
    const before = baseline.components.find((component) => component.id === id)
    const after = candidate.components.find((component) => component.id === id)
    const compatible = before && after && before.currency === baseline.context.currency && after.currency === candidate.context.currency && before.period.start === after.period.start && before.period.end === after.period.end
    const known = compatible && before.amount !== null && after.amount !== null && Number.isFinite(before.amount) && Number.isFinite(after.amount)
    return { id, state: !before ? "added" as const : !after ? "removed" as const : !compatible ? "incompatible" as const : "matched" as const, before: before ?? null, after: after ?? null, difference: known ? variance(after!.amount!, before!.amount!).value : null }
  }) }
}
