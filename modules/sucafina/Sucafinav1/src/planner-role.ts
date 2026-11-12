// Papel e lock do planner. A conta do spread não muda.

import { lockAllows, normName } from "./planner-accounts.ts"

export type DirectoryPerson = { id: string; name: string }

export function presentSalary<T extends { rates?: unknown; rateOverride?: unknown; cost?: unknown; inc?: unknown; total?: unknown }>(
  view: T,
  actor: { roles: string[] },
): Omit<T, "rates" | "rateOverride" | "cost" | "inc"> | T {
  if (actor.roles.includes("admin") || actor.roles.includes("hr") || actor.roles.includes("finance")) return view
  const { rates: _rates, rateOverride: _override, cost: _cost, inc: _inc, ...rest } = view
  return rest
}

export function assignOwner(current: { id: string; name: string } | null, importedName: string, directory: DirectoryPerson[]) {
  const wanted = normName(importedName)
  const found = directory.find((person) => normName(person.name) === wanted)
  if (!found) return { owner: current, warning: importedName }
  return { owner: { id: found.id, name: found.name }, warning: null }
}

export type PlanVersion = { id: string; year: number; locked: boolean }

export type PlannerActor = { id: string; canWrite: boolean; roles: string[]; domains?: string[] }

export type PlannerLine = { ownerId?: string; domain?: string; hr?: boolean }

export function makeOfficial(
  versions: PlanVersion[],
  officials: Record<string, string>,
  id: string,
  actor: { canWrite: boolean; roles: string[] },
): { ok: true; versions: PlanVersion[]; officials: Record<string, string> } | { ok: false } {
  if (!actor.canWrite || !actor.roles.includes("admin")) return { ok: false }
  const target = versions.find((version) => version.id === id)
  if (!target) return { ok: false }
  const next = versions.map((version) => (version.id === id ? { ...version, locked: true } : version))
  return { ok: true, versions: next, officials: { ...officials, [String(target.year)]: id } }
}

export function plannerField(
  field: string,
  version: PlanVersion,
  officialId: string | undefined,
  actor: PlannerActor,
  line?: PlannerLine,
): boolean {
  if (!actor.canWrite) return false
  if (line?.hr && field === "budget") return false
  const locked = version.locked
  const official = officialId === version.id
  if (actor.roles.includes("admin")) return lockAllows(field, locked, official, true)
  if (actor.roles.includes("finance") && financeField(field, locked)) return true
  if (actor.roles.includes("hr") && hrField(field, locked)) return true
  if (actor.roles.includes("budget owner") && ownerField(field, actor, line)) return lockAllows(field, locked, official, true)
  return false
}

function financeField(field: string, locked: boolean): boolean {
  if (field === "closedThrough" || field === "actual" || field === "forecast") return true
  if (field === "fx") return !locked
  return false
}

function hrField(field: string, locked: boolean): boolean {
  if (locked) return false
  return field === "rate" || field === "headcount" || field === "increase"
}

function ownerField(field: string, actor: PlannerActor, line: PlannerLine | undefined): boolean {
  if (field !== "forecast" || !line) return false
  if (line.ownerId === actor.id) return true
  if (!line.domain) return false
  return actor.domains?.includes(line.domain) === true
}

export function deleteRate(id: string, positions: { rateId?: string | null }[], canWrite: boolean): { ok: boolean } {
  if (!canWrite) return { ok: false }
  if (positions.some((position) => position.rateId === id)) return { ok: false }
  return { ok: true }
}

const HEADCOUNT_COLUMNS = ["Name", "Title", "Type", "Leader", "Location", "Start", "End", "Status"] as const

// Secção 6. O Excel continua ficheiro. Lê as oito colunas. Não lê Classification, Outlook, Notes, rate card, aumento, rateOverride.
export function migratePlanner<T>(versions: T[], actor: { canWrite: boolean; roles: string[] }, confirmed: boolean): { ok: false } | { ok: true; versions: T[] } {
  if (!actor.canWrite || !actor.roles.includes("admin") || confirmed !== true) return { ok: false }
  return { ok: true, versions: versions.map((version) => structuredClone(version)) }
}

export function importHeadcount(rows: Record<string, unknown>[]): { file: true; live: false; rows: Record<string, unknown>[] } {
  return {
    file: true,
    live: false,
    rows: rows.map((row) => {
      const next: Record<string, unknown> = {}
      for (const column of HEADCOUNT_COLUMNS) next[column] = row[column]
      return next
    }),
  }
}
