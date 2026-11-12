// Secção 3. O mapa grupo para papel. A coluna Entra nasce vazia. O Teams responde fora daqui: esta conta está neste grupo?

import { writeVersioned } from "./records.ts"
import type { Change } from "./records.ts"

export type Surface = "dashboard" | "planner" | "procurement"

export type RoleRow = { surface: Surface; role: string; entra: string | null; version: number; by: string }

export type ResolvedActor = { id: string; canWrite: boolean; roles: { surface: Surface; role: string }[] }

const ROWS: RoleRow[] = [
  { surface: "dashboard", role: "admin", entra: null, version: 0, by: "" },
  { surface: "dashboard", role: "domain leader", entra: null, version: 0, by: "" },
  { surface: "dashboard", role: "contributor", entra: null, version: 0, by: "" },
  { surface: "dashboard", role: "viewer", entra: null, version: 0, by: "" },
  { surface: "planner", role: "admin", entra: null, version: 0, by: "" },
  { surface: "planner", role: "finance", entra: null, version: 0, by: "" },
  { surface: "planner", role: "hr", entra: null, version: 0, by: "" },
  { surface: "planner", role: "budget owner", entra: null, version: 0, by: "" },
  { surface: "planner", role: "viewer", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "requester", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "buyer", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "approver", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "supplier admin", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "admin", entra: null, version: 0, by: "" },
  { surface: "procurement", role: "viewer", entra: null, version: 0, by: "" },
]

const ACT_ROLES = ["requester", "buyer", "approver", "admin"]

export function emptyMap(): RoleRow[] {
  return ROWS.map((row) => ({ ...row }))
}

export function plugGroup(map: RoleRow[], surface: Surface, role: string, entra: string): RoleRow[] {
  if (!entra) return map.map((row) => ({ ...row }))
  return map.map((row) => (row.surface === surface && row.role === role ? { ...row, entra } : { ...row }))
}

export function resolve(id: string, map: RoleRow[], member: (group: string) => boolean): {
  id: string
  canWrite: boolean
  roles: { surface: Surface; role: string }[]
} {
  const roles = map.flatMap((row) => {
    if (!row.entra) return []
    if (!member(row.entra)) return []
    return [{ surface: row.surface, role: row.role }]
  })
  const canWrite = roles.some((role) => role.role !== "viewer")
  return { id, canWrite, roles }
}

export function actActor(resolved: { id: string; roles: { surface: Surface; role: string }[] }): {
  id: string
  canWrite: boolean
  roles: string[]
} {
  const roles = resolved.roles.flatMap((role) => (role.surface === "procurement" && ACT_ROLES.includes(role.role) ? [role.role] : []))
  return { id: resolved.id, canWrite: roles.length > 0, roles }
}

export function surfaceAdmin(actor: ResolvedActor, surface: Surface): boolean {
  return actor.canWrite && actor.roles.some((role) => role.surface === surface && role.role === "admin")
}

export function setGroupName(
  map: RoleRow[],
  surface: Surface,
  role: string,
  entra: string,
  version: number,
  actor: ResolvedActor,
  at: string,
  audit: Change[],
): { ok: true; map: RoleRow[] } | { ok: false; status?: 409; stored?: string | null; by?: string } {
  if (!surfaceAdmin(actor, surface)) return { ok: false }
  const index = map.findIndex((row) => row.surface === surface && row.role === role)
  if (index < 0) return { ok: false }
  const current = map[index]
  const name = entra.trim()
  const written = writeVersioned({ version: current.version, by: current.by, value: current.entra }, version, name ? name : null, actor, at, audit)
  if (!written.ok) return written
  const next = map.slice()
  next[index] = { ...current, entra: written.row.value, version: written.row.version, by: written.row.by }
  return { ok: true, map: next }
}
