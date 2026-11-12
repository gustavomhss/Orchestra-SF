// Secção 5. Versão diferente recusa e devolve o gravado e quem gravou. Duas linhas diferentes ficam as duas.

export type Row = { version: number; by: string; value: unknown }

export function createRecord(
  rows: Record<string, Row>,
  id: string,
  value: unknown,
  actor: { id: string; canWrite: boolean },
): { ok: true; row: Row } | { ok: false; status?: 409; stored?: unknown; by?: string } {
  if (!actor.canWrite) return { ok: false }
  const current = rows[id]
  if (current) return { ok: false, status: 409, stored: current.value, by: current.by }
  const row = { version: 1, by: actor.id, value }
  rows[id] = row
  return { ok: true, row }
}

export type Change = { who: string; at: string; was: unknown; became: unknown }

export type Versioned<T> = { version: number; by: string; value: T }

export function writeVersioned<T>(
  current: Versioned<T> | null,
  version: number,
  value: T,
  actor: { id: string; canWrite: boolean },
  at: string,
  audit: Change[],
): { ok: true; row: Versioned<T> } | { ok: false; status?: 409; stored?: T; by?: string } {
  if (!actor.canWrite) return { ok: false }
  if (!current) {
    if (version !== 0) return { ok: false, status: 409 }
    const row = { version: 1, by: actor.id, value }
    audit.push({ who: actor.id, at, was: null, became: value })
    return { ok: true, row }
  }
  if (current.version !== version) return { ok: false, status: 409, stored: current.value, by: current.by }
  const row = { version: current.version + 1, by: actor.id, value }
  audit.push({ who: actor.id, at, was: current.value, became: value })
  return { ok: true, row }
}

export function writeRecord(
  rows: Record<string, Row>,
  id: string,
  version: number,
  value: unknown,
  actor: { id: string; canWrite: boolean },
): { ok: true; row: Row } | { ok: false; status?: 409; stored?: unknown; by?: string } {
  if (!actor.canWrite) return { ok: false }
  const current = rows[id]
  if (!current || current.version !== version) return { ok: false, status: 409, stored: current?.value, by: current?.by }
  const row = { version: current.version + 1, by: actor.id, value }
  rows[id] = row
  return { ok: true, row }
}
