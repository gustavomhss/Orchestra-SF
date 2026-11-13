import type { Actor, Environment, Result, Snapshot } from "../../runtime/contract.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import { domain } from "../../runtime/planner.ts"

/** Apply supported forecast overrides to an isolated Planner snapshot through the real command. */
export function simulatePlannerOperations(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string, operations: readonly ScenarioOperation[]) {
  const preview = structuredClone(snapshot)
  const version = rows(domain.view(preview, actor, environment).data.versions).find((item) => item.id === versionId)
  if (!version) return { status: "unavailable" as const, reason: "version-unavailable" }
  const targets = new Set<string>()
  for (const operation of operations) {
    const separator = operation.targetRef.lastIndexOf(":")
    const id = operation.targetRef.slice(0, separator)
    const month = Number(operation.targetRef.slice(separator + 1))
    if (separator < 1 || !Number.isInteger(month) || month < 1 || month > 12 || targets.has(operation.targetRef)) return { status: "needs-input" as const, reason: "invalid-or-duplicate-target" }
    targets.add(operation.targetRef)
    if (operation.kind !== "replace" || operation.replacementRef) return { status: "needs-input" as const, reason: "operation-requires-explicit-domain-mapping" }
    const line = rows(object(version.summary).lines).find((item) => item.id === id)
    if (!line) return { status: "needs-input" as const, reason: "line-unavailable" }
    if (month <= Number(version.closed)) return { status: "needs-input" as const, reason: "month-closed" }
    const monthStart = `${version.year}-${String(month).padStart(2, "0")}-01`
    const monthEnd = `${version.year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(Number(version.year), month, 0)).getUTCDate()).padStart(2, "0")}`
    if (operation.period && (operation.period.start !== monthStart || operation.period.end !== monthEnd)) return { status: "needs-input" as const, reason: "period-mismatch" }
    if (operation.currency && operation.currency !== (line.cur || "USD")) return { status: "needs-input" as const, reason: "currency-mismatch" }
    if (typeof operation.amount !== "number" || !Number.isFinite(operation.amount)) return { status: "needs-input" as const, reason: "amount-required" }
    const key = `${versionId}:${id.startsWith("HR:") ? "hrAF" : "lines"}:${id}`
    const result: Result = domain.execute(preview, actor, { page: line.sec === "capex" ? "CAPEX" : "OPEX", action: "save", id, version: preview.versions[key]?.version ?? 0, values: { versionId, [`f${month - 1}`]: operation.amount } }, environment)
    if (!result.ok) return { status: result.status === 403 ? "denied" as const : result.status === 409 ? "conflict" as const : "needs-input" as const, reason: "planner-command-rejected" }
  }
  return { status: "ok" as const, view: domain.view(preview, actor, environment) }
}
