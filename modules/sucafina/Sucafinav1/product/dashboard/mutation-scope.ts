import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { applyDashboardPreview } from "./commands.ts"
import { normalizeDashboardRecords } from "./records.ts"

export type DashboardMutationScope = {
  period: Period
  targets: readonly { source: SourceRef; scope: SfSourceScope }[]
  creates: readonly { type: string; id: string; fields: readonly string[]; period: Period }[]
  impactDigest: string
  reservedIds: readonly string[]
  observedAt: string
}

// Inspect the domain's actual staged result, including cascades and generated records.
// Unknown collection shapes are rejected rather than silently omitted from the proof.
export function dashboardMutationImpact(before: Snapshot, after: Snapshot, command: Command, period: Period) {
  const changes: { type: string; id: string; operation: "create" | "update" | "delete"; fields: string[]; period: Period; before: unknown; after: unknown }[] = []
  const validPeriod = (value: Period) => /^\d{4}-\d{2}-\d{2}$/.test(value.start) && /^\d{4}-\d{2}-\d{2}$/.test(value.end) && value.start <= value.end && [value.start, value.end].every((date) => Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date)
  if (!validPeriod(period)) return undefined
  const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
  const rowPeriod = (left: Record<string, unknown> | undefined, right: Record<string, unknown> | undefined): Period | undefined => {
    const years = [left?.year, right?.year].filter((value) => value !== undefined)
    const months = [left?.month, right?.month].filter((value) => value !== undefined)
    if (years.some((year) => !Number.isInteger(year) || Number(year) < 1 || Number(year) > 9999) || new Set(years).size > 1 || months.some((month) => !Number.isInteger(month) || Number(month) < 1 || Number(month) > 12) || new Set(months).size > 1 || (months.length && !years.length)) return undefined
    const rawYear = years[0] ?? command.values.year
    if (rawYear === undefined) return period
    const year = typeof rawYear === "number" ? rawYear : typeof rawYear === "string" && /^\d{4}$/.test(rawYear) ? Number(rawYear) : NaN
    if (!Number.isInteger(year) || year < 1 || year > 9999) return undefined
    const y = String(year).padStart(4, "0")
    if (!months.length) return { start: `${y}-01-01`, end: `${y}-12-31` }
    const month = Number(months[0])
    return { start: `${y}-${String(month).padStart(2, "0")}-01`, end: `${y}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(Number(year), month, 0)).getUTCDate()).padStart(2, "0")}` }
  }
  for (const type of [...new Set([...Object.keys(before.data), ...Object.keys(after.data)])].sort()) {
    const left = before.data[type]
    const right = after.data[type]
    if (digestSfValue(left) === digestSfValue(right)) continue
    const keyed = ["budgetYtd", "deviations", "budgetCurrentMonth", "revenueByYear"].includes(type)
    const arrays = (Array.isArray(left) || left === undefined) && (Array.isArray(right) || right === undefined)
    const leftRows = keyed ? normalizeDashboardRecords(type, left) : arrays ? left ?? [] : left === undefined ? [] : [{ ...record(left), id: "__singleton__" }]
    const rightRows = keyed ? normalizeDashboardRecords(type, right) : arrays ? right ?? [] : right === undefined ? [] : [{ ...record(right), id: "__singleton__" }]
    if (!keyed && !arrays && ((left !== undefined && !record(left)) || (right !== undefined && !record(right)))) return undefined
    if (!Array.isArray(leftRows) || !Array.isArray(rightRows)) return undefined
    const index = (items: unknown[]) => {
      const records = items.map(record)
      if (records.some((row) => !row || !((typeof row.id === "string" && !!row.id) || (typeof row.id === "number" && Number.isSafeInteger(row.id)))) || new Set(records.map((row) => String(row?.id))).size !== records.length) return undefined
      return new Map(records.map((row) => [String(row!.id), row!]))
    }
    const a = index(leftRows), b = index(rightRows)
    if (!a || !b) return undefined
    for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const previous = a.get(id), next = b.get(id)
      if (digestSfValue(previous) === digestSfValue(next)) continue
      const changed = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])].filter((field) => field !== "id" && digestSfValue(previous?.[field]) !== digestSfValue(next?.[field])).sort()
      const range = rowPeriod(previous, next)
      if (!range) return undefined
      changes.push({ type, id, operation: !previous ? "create" : !next ? "delete" : "update", fields: changed, period: range, before: previous, after: next })
    }
  }
  return changes
}

export function dashboardImpactCovered(impact: NonNullable<ReturnType<typeof dashboardMutationImpact>>, scope: DashboardMutationScope) {
  return impact.every((change) => {
    if (change.period.start < scope.period.start || change.period.end > scope.period.end) return false
    const grants = change.operation === "create" ? scope.creates : scope.targets.map((entry) => entry.source)
    return grants.some((grant) => grant.type === change.type && grant.id === change.id && change.fields.every((field) => grant.fields.includes(field)) && grant.period.start <= change.period.start && grant.period.end >= change.period.end)
  })
}

/** Host-only proof builder. Grants must be independently authorized before calling. */
export function prepareDashboardMutationScope(input: { snapshot: Snapshot; actor: Actor; environment: Environment; command: Command; baseDigest: string; previewDigest: string; period: Period; targets: DashboardMutationScope["targets"]; creates: DashboardMutationScope["creates"]; reservedIds: readonly string[] }) {
  const staged = structuredClone(input.snapshot)
  let used = 0
  const result = applyDashboardPreview(staged, input.actor, input.command, { ...input.environment, id: () => input.reservedIds[used++] ?? "" }, input.baseDigest, input.previewDigest)
  if (!result.ok || used !== input.reservedIds.length || new Set(input.reservedIds).size !== input.reservedIds.length || input.reservedIds.some((id) => !id)) return undefined
  const impact = dashboardMutationImpact(input.snapshot, staged, input.command, input.period)
  if (!impact?.length) return undefined
  const scope: DashboardMutationScope = { period: structuredClone(input.period), targets: structuredClone(input.targets), creates: structuredClone(input.creates), impactDigest: digestSfValue(impact), reservedIds: [...input.reservedIds], observedAt: input.environment.at }
  return dashboardImpactCovered(impact, scope) ? scope : undefined
}
