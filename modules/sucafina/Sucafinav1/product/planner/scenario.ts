import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import { domain } from "../../runtime/planner.ts"

/** Apply forecast operations to an isolated snapshot through the real Planner command. */
export function simulatePlannerOperations(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string, operations: readonly ScenarioOperation[]) {
  const preview = structuredClone(snapshot)
  const targets = new Set<string>()
  for (const operation of operations) {
    const version = rows(domain.view(preview, actor, environment).data.versions).find((item) => item.id === versionId)
    if (!version) return { status: "unavailable" as const, reason: "version-unavailable" }
    const separator = operation.targetRef.lastIndexOf(":")
    const id = operation.targetRef.slice(0, separator)
    const month = Number(operation.targetRef.slice(separator + 1))
    if (separator < 1 || !Number.isInteger(month) || month < 1 || month > 12 || targets.has(operation.targetRef)) return { status: "needs-input" as const, reason: "invalid-or-duplicate-target" }
    if (!["replace", "include", "exclude", "defer"].includes(operation.kind)) return { status: "needs-input" as const, reason: "unsupported-operation" }
    if (operation.replacementRef) return { status: "needs-input" as const, reason: "replacement-evidence-unresolved" }
    const line = rows(object(version.summary).lines).find((item) => item.id === id)
    if (!line) return { status: "needs-input" as const, reason: "line-unavailable" }
    if (month <= Number(version.closed)) return { status: "needs-input" as const, reason: "month-closed" }
    if (operation.currency && operation.currency !== (line.cur || "USD")) return { status: "needs-input" as const, reason: "currency-mismatch" }
    const key = `${versionId}:${id.startsWith("HR:") ? "hrAF" : "lines"}:${id}`
    const apply = (updates: Record<string, unknown>) => domain.execute(preview, actor, { page: line.sec === "capex" ? "CAPEX" : "OPEX", action: "save", id, version: preview.versions[key]?.version ?? 0, values: { versionId, ...updates } }, environment)
    const monthPeriod = (value: number) => ({ start: `${version.year}-${String(value).padStart(2, "0")}-01`, end: `${version.year}-${String(value).padStart(2, "0")}-${String(new Date(Date.UTC(Number(version.year), value, 0)).getUTCDate()).padStart(2, "0")}` })
    const actualPeriod = monthPeriod(month)
    const forecast = Array.isArray(line.f) ? line.f : []
    const budget = Array.isArray(line.b) ? line.b : []
    const effective = (index: number) => forecast[index] == null ? budget[index] : forecast[index]
    const updates: Record<string, number> = {}
    if (operation.kind === "defer") {
      if (!operation.period || operation.amount !== undefined) return { status: "needs-input" as const, reason: "defer-requires-destination" }
      const destination = Number(operation.period.start.slice(5, 7))
      if (!Number.isInteger(destination) || destination < 1 || destination > 12 || destination <= Number(version.closed) || destination === month || operation.period.start !== monthPeriod(destination).start || operation.period.end !== monthPeriod(destination).end || targets.has(`${id}:${destination}`)) return { status: "needs-input" as const, reason: "invalid-defer-destination" }
      const from = effective(month - 1)
      const to = effective(destination - 1)
      if (typeof from !== "number" || !Number.isFinite(from) || typeof to !== "number" || !Number.isFinite(to)) return { status: "needs-input" as const, reason: "defer-value-unavailable" }
      updates[`f${month - 1}`] = 0
      updates[`f${destination - 1}`] = from + to
      targets.add(`${id}:${destination}`)
    } else {
      if (operation.period && (operation.period.start !== actualPeriod.start || operation.period.end !== actualPeriod.end)) return { status: "needs-input" as const, reason: "period-mismatch" }
      if (operation.kind === "exclude") {
        if (operation.amount !== undefined) return { status: "needs-input" as const, reason: "exclude-does-not-accept-amount" }
        updates[`f${month - 1}`] = 0
      } else {
        if (typeof operation.amount !== "number" || !Number.isFinite(operation.amount)) return { status: "needs-input" as const, reason: "amount-required" }
        if (operation.kind === "include" && (forecast[month - 1] != null || (typeof budget[month - 1] === "number" && budget[month - 1] !== 0))) return { status: "needs-input" as const, reason: "contribution-already-present" }
        updates[`f${month - 1}`] = operation.amount
      }
    }
    targets.add(operation.targetRef)
    const result = apply(updates)
    if (!result.ok) return { status: result.status === 403 ? "denied" as const : result.status === 409 ? "conflict" as const : "needs-input" as const, reason: "planner-command-rejected" }
  }
  return { status: "ok" as const, view: domain.view(preview, actor, environment) }
}
