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
    const state = !before ? "added" as const : !after ? "removed" as const : !compatible ? "incompatible" as const : "matched" as const
    const delta = known ? variance(after!.amount!, before!.amount!).value : null
    const difference = delta !== null && Number.isFinite(delta) ? delta : null
    return {
      id,
      state,
      before: before ?? null,
      after: after ?? null,
      difference,
      explanation: state === "added" ? "Present only in the candidate projection." : state === "removed" ? "Present only in the baseline projection." : state === "incompatible" ? "Component periods or currencies do not match the projection context." : difference === null ? "A finite numeric difference is unavailable." : difference === 0 ? "The projected amount is unchanged." : "The projected amount changed; this comparison does not identify a cause.",
      evidenceStates: [...new Set([before?.evidenceState, after?.evidenceState].filter((value): value is NonNullable<typeof value> => value !== undefined))],
    }
  }) }
}
