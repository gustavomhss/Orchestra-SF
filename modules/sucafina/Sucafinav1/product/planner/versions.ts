import { domain } from "../../runtime/planner.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { plannerKeys } from "../../src/nav.ts"

export type PlannerVersionRequest =
  | { action: "create"; revision: number }
  | { action: "save"; id: string; revision: number; name: string; year?: number }
  | { action: "copy"; id: string; revision: number; name: string }
  | { action: "lock" | "unlock" | "official" | "delete"; id: string; revision: number }

/** Version metadata contains no financial or personnel details, including on conflicts. */
export function plannerVersions(snapshot: Snapshot, actor: Actor, environment: Environment, selectedId?: string) {
  if (!plannerKeys(actor).includes("Versions")) return undefined
  const view = domain.view(snapshot, actor, environment)
  const writable = actor.canWrite && actor.roles.includes("admin")
  const versions = rows(view.data.versions).map((version) => {
    const id = text(version.id)
    const year = Number(version.year)
    const official = String(object(view.data.officials)[String(year)] ?? "") === id
    const locked = version.locked === true
    return {
      id, name: text(version.name), year,
      state: official ? "official" as const : locked ? "locked" as const : "draft" as const,
      revision: snapshot.versions[`versions:${id}`]?.version ?? 0,
      officialRevision: snapshot.versions[`officials:${year}`]?.version ?? 0,
      actions: { save: writable, changeYear: writable && !locked && !official, copy: writable, lock: writable && !locked, unlock: writable && locked && !official, official: writable, delete: writable && !official },
    }
  })
  return {
    versions,
    selectedId: selectedId === undefined ? null : versions.find((version) => version.id === selectedId)?.id ?? null,
    selectionState: selectedId === undefined ? "unselected" as const : versions.some((version) => version.id === selectedId) ? "selected" as const : "unavailable" as const,
    create: { allowed: writable && versions.length === 0, revision: snapshot.versions["versions:first"]?.version ?? 0 },
  }
}

export function plannerVersionCommand(request: PlannerVersionRequest): Command {
  if (request.action === "create") return { page: "Versions", action: "save", id: "", version: request.revision, values: {} }
  if (request.action === "save") return { page: "Versions", action: "save", id: request.id, version: request.revision, values: { name: request.name, ...(request.year === undefined ? {} : { year: request.year }) } }
  if (request.action === "copy") return { page: "Versions", action: "copy", id: request.id, version: request.revision, values: { name: request.name } }
  return { page: "Versions", action: request.action, id: request.id, version: request.revision, values: {} }
}

export function validPlannerVersionRequest(value: unknown): value is PlannerVersionRequest {
  const request = object(value)
  if (Object.getPrototypeOf(request) !== Object.prototype && Object.getPrototypeOf(request) !== null) return false
  if (typeof request.action !== "string") return false
  if (!Number.isSafeInteger(request.revision) || Number(request.revision) < 0) return false
  const keys = Reflect.ownKeys(request)
  if (request.action === "create") return keys.length === 2 && keys.every((key) => key === "action" || key === "revision")
  if (typeof request.id !== "string" || !request.id.trim()) return false
  if (request.action === "save") return typeof request.name === "string" && (request.year === undefined || Number.isSafeInteger(request.year)) && keys.length >= 4 && keys.every((key) => ["action", "id", "revision", "name", "year"].includes(String(key)))
  if (request.action === "copy") return typeof request.name === "string" && keys.length === 4 && keys.every((key) => ["action", "id", "revision", "name"].includes(String(key)))
  return ["lock", "unlock", "official", "delete"].includes(String(request.action)) && keys.length === 3 && keys.every((key) => ["action", "id", "revision"].includes(String(key)))
}
