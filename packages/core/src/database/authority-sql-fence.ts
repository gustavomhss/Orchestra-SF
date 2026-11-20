export * as AuthoritySqlFence from "./authority-sql-fence"

import type { Context } from "effect"
import { randomUUID } from "node:crypto"
import { AuthorityGeneration } from "../session/authority-generation"

export type Row = Record<string, unknown>
export interface Driver {
  readonly all: (query: string, params?: readonly unknown[]) => Row[]
  readonly execute: (query: string, params?: readonly unknown[]) => void
  readonly inTransaction: () => boolean
}

export type Marker = Readonly<{ generation: number; controlId: string }>
export const protectedTables = Object.freeze([
  "session", "message", "part", "session_context_epoch", "session_input", "session_message",
  "todo", "session_share", "session_owner", "event", "event_sequence",
])

export function marker(driver: Driver): Marker | undefined {
  const exists = driver.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sf_authority_generation'")
  if (!exists.length) return undefined
  const rows = driver.all("SELECT id, generation, control_id, writer_permit FROM sf_authority_generation")
  if (!rows.length) return undefined
  const row = rows[0]
  if (rows.length !== 1 || !row || row.id !== 1 || typeof row.generation !== "number" ||
      !Number.isSafeInteger(row.generation) || row.generation < 1 ||
      typeof row.control_id !== "string" || !row.control_id)
    throw new AuthorityGeneration.GenerationError("unavailable")
  return Object.freeze({ generation: row.generation, controlId: row.control_id })
}

/**
 * Installed only by the explicit maintenance cut in an already-held IMMEDIATE transaction.
 * The permit references an impossible parent row, so SQLite itself refuses COMMIT while
 * it remains non-null. The active permit is never visible to another connection.
 */
export function install(driver: Driver, input: Marker, tables: readonly string[] = protectedTables) {
  if (!driver.inTransaction() || !Number.isSafeInteger(input.generation) || input.generation < 1 || !input.controlId)
    throw new AuthorityGeneration.GenerationError("writer-required")
  if (driver.all("PRAGMA foreign_keys")[0]?.foreign_keys !== 1)
    throw new AuthorityGeneration.GenerationError("unavailable")
  if (!tables.length || new Set(tables).size !== tables.length ||
      tables.some((table) => !/^[a-z][a-z0-9_]*$/.test(table) || table.startsWith("sf_authority_")))
    throw new AuthorityGeneration.GenerationError("unavailable")
  driver.execute("CREATE TABLE IF NOT EXISTS sf_authority_permit_sentinel (nonce TEXT PRIMARY KEY NOT NULL CHECK (0))")
  driver.execute("CREATE TABLE IF NOT EXISTS sf_authority_generation (id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL CHECK (generation >= 1), control_id TEXT NOT NULL, writer_permit TEXT REFERENCES sf_authority_permit_sentinel(nonce) DEFERRABLE INITIALLY DEFERRED)")
  const before = marker(driver)
  if (before && (before.controlId !== input.controlId || input.generation !== before.generation + 1))
    throw new AuthorityGeneration.GenerationError("stale-generation")
  driver.execute("INSERT INTO sf_authority_generation (id, generation, control_id, writer_permit) VALUES (1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET generation = excluded.generation, writer_permit = NULL",
    [input.generation, input.controlId])
  for (const table of tables) {
    if (driver.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]).length !== 1)
      throw new AuthorityGeneration.GenerationError("unavailable")
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      const trigger = "sf_authority_" + table + "_" + operation.toLowerCase()
      driver.execute('DROP TRIGGER IF EXISTS "' + trigger + '"')
      driver.execute('CREATE TRIGGER "' + trigger + '" BEFORE ' + operation + ' ON "' + table +
        '" WHEN NOT EXISTS (SELECT 1 FROM sf_authority_generation WHERE id = 1 AND generation = ' +
        input.generation + " AND writer_permit IS NOT NULL) BEGIN SELECT RAISE(ABORT, 'sf-authority-writer-required'); END")
    }
  }
}

function command(query: string) {
  // SQLite comments before a statement do not change its admission class.
  const text = query.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, "").trim().replace(/;\s*$/, "")
  const keyword = /^[a-z]+/i.exec(text)?.[0]?.toUpperCase()
  return { text, keyword }
}

/** Lives next to one physical SQLite connection, not on the Request or in a renderer DTO. */
export function make(driver: Driver, storageID: string) {
  let active: Readonly<{ proof: object; generation: number; permit: string }> | undefined
  const denied = () => { throw new AuthorityGeneration.GenerationError("writer-required") }
  return function execute<A>(query: string, context: Context.Context<never>, run: () => A): A {
    const current = marker(driver)
    if (!current) return run()
    const sql = command(query)
    const proof = AuthorityGeneration.writerFor(context, storageID, current.generation)
    const rollback = sql.keyword === "ROLLBACK" && /^ROLLBACK(?:\s+TRANSACTION)?$/i.test(sql.text)
    if (rollback) {
      try { return run() } finally { active = undefined }
    }
    if (active && (proof !== active.proof || !driver.inTransaction())) return denied()
    if (sql.keyword === "PRAGMA") {
      // Preserve connection setup; schema/FK bypasses and arbitrary PRAGMA setters are forbidden.
      if (!/^PRAGMA\s+(?:foreign_keys(?:\s*=\s*(?:ON|1))?|journal_mode(?:\s*=\s*WAL)?|synchronous(?:\s*=\s*NORMAL)?|busy_timeout(?:\s*=\s*\d+)?|cache_size(?:\s*=\s*-?\d+)?|wal_checkpoint(?:\s*\(\s*PASSIVE\s*\))?|table_info\s*\([^;]*\)|index_list\s*\([^;]*\)|foreign_key_list\s*\([^;]*\))$/i.test(sql.text))
        return denied()
      return run()
    }
    if (["CREATE", "DROP", "ALTER", "ATTACH", "DETACH", "VACUUM", "REINDEX"].includes(sql.keyword ?? "")) return denied()
    if (sql.keyword !== "SELECT" && sql.keyword !== "EXPLAIN" &&
        /\bsf_authority_(?:generation|permit_sentinel)\b/i.test(sql.text)) return denied()
    if (sql.keyword === "BEGIN") {
      if (active || driver.inTransaction()) return denied()
      if (!proof) return run()
      if (!/^BEGIN\s+IMMEDIATE(?:\s+TRANSACTION)?$/i.test(sql.text) ||
          driver.all("PRAGMA foreign_keys")[0]?.foreign_keys !== 1) return denied()
      const result = run()
      try {
        // Re-read after acquiring SQLite's writer lock; a cut may have raced the first read.
        const locked = marker(driver)
        if (!locked || locked.generation !== current.generation || locked.controlId !== current.controlId ||
            AuthorityGeneration.writerFor(context, storageID, locked.generation) !== proof) return denied()
        const permit = randomUUID()
        driver.execute("UPDATE sf_authority_generation SET writer_permit = ? WHERE id = 1 AND generation = ? AND writer_permit IS NULL", [permit, current.generation])
        if (driver.all("SELECT writer_permit FROM sf_authority_generation WHERE id = 1")[0]?.writer_permit !== permit) return denied()
        active = Object.freeze({ proof, generation: current.generation, permit })
        return result
      } catch (error) {
        try { driver.execute("ROLLBACK") } finally { active = undefined }
        throw error
      }
    }
    if (sql.keyword === "COMMIT" || sql.keyword === "END") {
      if (!active) return run()
      if (!/^(?:COMMIT|END)(?:\s+TRANSACTION)?$/i.test(sql.text) || !proof) return denied()
      driver.execute("UPDATE sf_authority_generation SET writer_permit = NULL WHERE id = 1 AND writer_permit = ?", [active.permit])
      const result = run()
      active = undefined
      return result
    }
    // Triggers refuse protected writes outside the owned transaction, including WITH/REPLACE.
    // During it, every statement checks the private fiber proof, closing same-connection borrowing.
    return run()
  }
}
