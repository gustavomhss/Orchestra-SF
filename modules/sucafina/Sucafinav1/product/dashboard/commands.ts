import { DashboardBudget } from "../../runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../runtime/dashboard-people.ts"
import { DashboardOperations } from "../../runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import type { Actor, Command, Environment, Result, Snapshot } from "../../runtime/contract.ts"
import { rows } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { projectDashboardSource } from "./port.ts"

// The host reserves generated IDs across preview and apply and checks baseDigest before committing.
// The same domain command and authority are evaluated again in the applying transaction.
export function simulateDashboardCommand(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) {
  const before = projectDashboardSource(structuredClone(snapshot), actor, environment, command.page)
  if (!before) return { status: "denied" as const, reason: "page-unavailable" }
  const staged = structuredClone(snapshot)
  const result = executeDashboardCommand(staged, actor, command, environment)
  if (!result.ok) return result.status === 409 ? { status: "conflict" as const, reason: "source-changed" as const, by: result.by, stored: visibleStored(snapshot, before, result.stored) } : { status: result.status === 403 ? "denied" as const : "invalid" as const, reason: "command-rejected" as const }
  const after = projectDashboardSource(staged, actor, environment, command.page)
  if (!after) return { status: "denied" as const, reason: "page-unavailable" }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  const summary = command.page === "All Projects" && command.action === "import" ? importSummary(result.value) : undefined
  return { status: "preview" as const, baseDigest: previewBaseDigest(snapshot, before, command.page), commandDigest: digestSfValue({ actor, command }), before, after, changedFields: keys.filter((key) => digestSfValue(before[key]) !== digestSfValue(after[key])), changes: projectionChanges(before, after), warnings: [...(result.warnings ?? []), "System timestamps use the apply time and may differ from the preview."], summary }
}

type PreviewValue = { state: "absent" | "undefined" } | { state: "value"; value: unknown }
export type DashboardPreviewChange = { path: string; before: PreviewValue; after: PreviewValue }

// Diff only actor-filtered projections. Stable record IDs prevent unrelated row movement from looking like edits.
function projectionChanges(before: Record<string, unknown>, after: Record<string, unknown>): DashboardPreviewChange[] {
  const changes: DashboardPreviewChange[] = []
  const describe = (present: boolean, value: unknown): PreviewValue => !present ? { state: "absent" } : value === undefined ? { state: "undefined" } : { state: "value", value }
  const segment = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1")
  const visit = (path: string, left: unknown, right: unknown, leftPresent: boolean, rightPresent: boolean) => {
    if (leftPresent === rightPresent && digestSfValue(left) === digestSfValue(right)) return
    const leftArray = Array.isArray(left) ? left : []
    const rightArray = Array.isArray(right) ? right : []
    if ((Array.isArray(left) || !leftPresent) && (Array.isArray(right) || !rightPresent) && (leftArray.length || rightArray.length)) {
      const all = [...leftArray, ...rightArray]
      const ids = (items: unknown[]) => items.map((item) => item && typeof item === "object" && !Array.isArray(item) && (typeof (item as Record<string, unknown>).id === "string" || typeof (item as Record<string, unknown>).id === "number") ? String((item as Record<string, unknown>).id) : "")
      const leftIds = ids(leftArray)
      const rightIds = ids(rightArray)
      const keyed = all.length > 0 && [...leftIds, ...rightIds].every(Boolean) && new Set(leftIds).size === leftIds.length && new Set(rightIds).size === rightIds.length
      if (keyed) {
        const keys = [...new Set([...leftIds, ...rightIds])].sort()
        keys.forEach((key) => {
          const l = leftIds.indexOf(key)
          const r = rightIds.indexOf(key)
          visit(`${path}/@id=${segment(key)}`, leftArray[l], rightArray[r], l >= 0, r >= 0)
        })
        if (leftIds.length && rightIds.length && leftIds.join("\0") !== rightIds.join("\0")) changes.push({ path: `${path}/@order`, before: describe(true, leftIds), after: describe(true, rightIds) })
        return
      }
      Array.from({ length: Math.max(leftArray.length, rightArray.length) }, (_, index) => index).forEach((index) => visit(`${path}/${index}`, leftArray[index], rightArray[index], index < leftArray.length, index < rightArray.length))
      return
    }
    const leftObject = left && typeof left === "object" && !Array.isArray(left) ? left as Record<string, unknown> : undefined
    const rightObject = right && typeof right === "object" && !Array.isArray(right) ? right as Record<string, unknown> : undefined
    if ((leftObject || !leftPresent) && (rightObject || !rightPresent) && (Object.keys(leftObject ?? {}).length || Object.keys(rightObject ?? {}).length)) {
      const keys = [...new Set([...Object.keys(leftObject ?? {}), ...Object.keys(rightObject ?? {})])].sort()
      keys.forEach((key) => visit(`${path}/${segment(key)}`, leftObject?.[key], rightObject?.[key], !!leftObject && Object.hasOwn(leftObject, key), !!rightObject && Object.hasOwn(rightObject, key)))
      return
    }
    changes.push({ path: path || "/", before: describe(leftPresent, left), after: describe(rightPresent, right) })
  }
  visit("", before, after, true, true)
  return changes
}

function executeDashboardCommand(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  const selected = [DashboardBudget, DashboardPeople, DashboardOperations, DashboardPortfolio].find((domain) => (domain.pages as readonly string[]).includes(command.page))
  if (!selected) return { ok: false, status: 400, errors: ["Unknown dashboard page"] }
  return selected.domain.execute(snapshot, actor, command, environment)
}

export function applyDashboardPreview(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, baseDigest: string, commandDigest: string): Result {
  const projection = projectDashboardSource(structuredClone(snapshot), actor, environment, command.page)
  if (!projection) return { ok: false, status: 403, errors: ["Page is unavailable"] }
  if (previewBaseDigest(snapshot, projection, command.page) !== baseDigest || digestSfValue({ actor, command }) !== commandDigest) return { ok: false, status: 409, errors: ["Preview is stale"] }
  const result = executeDashboardCommand(snapshot, actor, command, environment)
  if (!result.ok) return result.status === 409 ? { ok: false, status: 409, errors: ["The stored record changed."], by: result.by, stored: visibleStored(snapshot, projection, result.stored) } : { ok: false, status: result.status, errors: ["Command rejected; review your access and current data."] }
  return { ok: true, warnings: result.warnings, value: command.page === "All Projects" && command.action === "import" ? importSummary(result.value) : undefined }
}

/** The submitted command stays with the client. `stored` is the same projected row, never the raw record. */
function visibleStored(snapshot: Snapshot, projection: Record<string, unknown> | undefined, stored: unknown): unknown {
  if (!projection || stored === undefined || stored === null || typeof stored !== "object") return undefined
  const record = stored as Record<string, unknown>
  const id = typeof record.id === "string" || typeof record.id === "number" ? String(record.id) : undefined
  if (id) {
    const collections = Object.entries(snapshot.data).filter(([, value]) => rows(value).some((item) => String(item.id ?? "") === id && digestSfValue(item) === digestSfValue(record)))
    if (collections.length !== 1) return undefined
    const matches = rows(projection[collections[0]![0]]).filter((item) => String(item.id ?? "") === id)
    if (matches.length === 1) return matches[0]
    return undefined
  }
  for (const value of Object.values(projection)) if (digestSfValue(value) === digestSfValue(stored)) return value
  return undefined
}

function previewBaseDigest(snapshot: Snapshot, projection: Record<string, unknown>, page: string) {
  const references = Object.entries(projection).flatMap(([collection, value]) => rows(value).flatMap((row) => {
    if (typeof row.id !== "string" && typeof row.id !== "number") return []
    const id = String(row.id)
    const identity = snapshot.sfSources?.records[JSON.stringify([collection, id])]
    return identity ? [{ collection, id, incarnation: identity.incarnation, alive: identity.alive }] : []
  }))
  const pageIdentity = snapshot.sfSources?.records[JSON.stringify(["dashboard-page", page])]
  return digestSfValue({ projection, references: references.sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id)), pageIncarnation: pageIdentity?.incarnation })
}

function importSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const result = value as Record<string, unknown>
  if (![result.added, result.updated, result.ignored].every((count) => Number.isSafeInteger(count) && Number(count) >= 0)) return undefined
  return { added: Number(result.added), updated: Number(result.updated), ignored: Number(result.ignored) }
}
