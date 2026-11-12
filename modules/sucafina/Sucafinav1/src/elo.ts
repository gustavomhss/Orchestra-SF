// Secção 6. app.pmo é lista de nomes. O admin do planner grava. Não importa projects. Não é página.

import { surfaceAdmin } from "./identity.ts"
import type { ResolvedActor } from "./identity.ts"
import { writeVersioned } from "./records.ts"
import type { Change, Versioned } from "./records.ts"

export function readPmoNames(
  names: string[],
  projects: { name: string }[],
): { names: string[]; projects: { name: string }[]; imported: false } {
  return { names: names.slice(), projects: projects.slice(), imported: false }
}

export function setPmoNames(
  current: Versioned<string[]> | null,
  names: readonly string[],
  version: number,
  actor: ResolvedActor,
  at: string,
  audit: Change[],
): { ok: true; row: Versioned<string[]> } | { ok: false; status?: 409; stored?: string[]; by?: string } {
  if (!surfaceAdmin(actor, "planner")) return { ok: false }
  const next: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed || next.includes(trimmed)) continue
    next.push(trimmed)
  }
  return writeVersioned(current, version, next, actor, at, audit)
}
