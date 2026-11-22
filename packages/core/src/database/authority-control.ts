export * as AuthorityControl from "./authority-control"

import { Effect } from "effect"
import { randomUUID } from "node:crypto"
import { AuthorityGeneration } from "../session/authority-generation"
import type { AuthoritySqlFence } from "./authority-sql-fence"

export type Driver = AuthoritySqlFence.Driver
export type Mode = "active" | "draining" | "suspended"
type Record = Readonly<{ generation: number; mode: Mode; planHash: string }>

function unavailable(cause?: unknown) {
  return cause instanceof AuthorityGeneration.GenerationError ? cause : new AuthorityGeneration.GenerationError("unavailable")
}

function atomic<A>(driver: Driver, operation: () => A): A {
  if (driver.inTransaction()) throw unavailable()
  driver.execute("BEGIN IMMEDIATE")
  try {
    const result = operation()
    driver.execute("COMMIT")
    return result
  } catch (error) {
    if (driver.inTransaction()) driver.execute("ROLLBACK")
    throw error
  }
}

/** This store is excluded from business checkpoints; never restore it from a data backup. */
export function open(driver: Driver, options: { initialize?: boolean } = {}) {
  atomic(driver, () => {
    const expected = ["sf_control_meta", "sf_control_store", "sf_control_writer", "sf_control_journal"]
    const found = driver.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'sf_control_%'")
      .map((row) => row.name)
    if ((options.initialize === false || found.length) && (found.length !== expected.length || expected.some((name) => !found.includes(name))))
      throw unavailable()
    if (options.initialize === false) return
    driver.execute("CREATE TABLE IF NOT EXISTS sf_control_meta (id INTEGER PRIMARY KEY CHECK (id = 1), schema_version INTEGER NOT NULL CHECK (schema_version = 1), control_id TEXT NOT NULL)")
    driver.execute("CREATE TABLE IF NOT EXISTS sf_control_store (storage_id TEXT PRIMARY KEY NOT NULL, generation INTEGER NOT NULL CHECK (generation >= 1), mode TEXT NOT NULL CHECK (mode IN ('active', 'draining', 'suspended')), plan_hash TEXT NOT NULL)")
    driver.execute("CREATE TABLE IF NOT EXISTS sf_control_writer (id TEXT PRIMARY KEY NOT NULL, storage_id TEXT NOT NULL REFERENCES sf_control_store(storage_id), generation INTEGER NOT NULL CHECK (generation >= 1), state TEXT NOT NULL CHECK (state IN ('active', 'completed', 'failed', 'unknown')))")
    driver.execute("CREATE TABLE IF NOT EXISTS sf_control_journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, storage_id TEXT NOT NULL, generation INTEGER NOT NULL, transition TEXT NOT NULL, reference TEXT NOT NULL)")
    driver.execute("INSERT INTO sf_control_meta (id, schema_version, control_id) VALUES (1, 1, ?) ON CONFLICT(id) DO NOTHING", [randomUUID()])
  })
  const metadata = driver.all("SELECT id, schema_version, control_id FROM sf_control_meta")
  if (metadata.length !== 1 || metadata[0]?.id !== 1 || metadata[0]?.schema_version !== 1 ||
      typeof metadata[0]?.control_id !== "string" || !metadata[0].control_id) throw unavailable()
  const controlId = metadata[0].control_id
  const read = (storage: string): Record | undefined => {
    const rows = driver.all("SELECT generation, mode, plan_hash FROM sf_control_store WHERE storage_id = ?", [storage])
    if (!rows.length) return undefined
    const row = rows[0]
    if (rows.length !== 1 || !row || typeof row.generation !== "number" ||
        !Number.isSafeInteger(row.generation) || row.generation < 1 ||
        (row.mode !== "active" && row.mode !== "draining" && row.mode !== "suspended") ||
        typeof row.plan_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.plan_hash)) throw unavailable()
    return Object.freeze({ generation: row.generation, mode: row.mode, planHash: row.plan_hash })
  }
  const journal = (storage: string, generation: number, transition: string, reference: string) =>
    driver.execute("INSERT INTO sf_control_journal (storage_id, generation, transition, reference) VALUES (?, ?, ?, ?)", [storage, generation, transition, reference])
  const current = (storage: string, marker: () => AuthoritySqlFence.Marker | undefined, activeOnly = true) => {
    const recorded = read(storage)
    const business = marker()
    if (!recorded && !business) return undefined
    if (!recorded || !business || business.controlId !== controlId || recorded.generation !== business.generation ||
        recorded.mode === "suspended" || activeOnly && recorded.mode !== "active") throw unavailable()
    return recorded.generation
  }

  return Object.freeze({
    controlId,
    inspect: (storage: string) => read(storage),
    /** Diagnostic metadata only; no content, token, cookie, user name or raw idempotency key. */
    pendingWriters: (storage: string) => driver.all("SELECT id, generation, state FROM sf_control_writer WHERE storage_id = ? AND state IN ('active', 'unknown') ORDER BY id", [storage]),
    source(storage: string, marker: () => AuthoritySqlFence.Marker | undefined): AuthorityGeneration.Source {
      if (!storage) throw unavailable()
      return Object.freeze({
        storageID: storage,
        current: Effect.try({ try: () => current(storage, marker), catch: unavailable }),
        verifyGeneration: (expected: number) => Effect.try({
          try: () => current(storage, marker) === expected, catch: unavailable,
        }),
        acquire: (expected: number) => Effect.try({
          try: () => {
            const id = randomUUID()
            atomic(driver, () => {
              if (current(storage, marker) !== expected) throw new AuthorityGeneration.GenerationError("stale-generation")
              driver.execute("INSERT INTO sf_control_writer (id, storage_id, generation, state) VALUES (?, ?, ?, 'active')", [id, storage, expected])
              journal(storage, expected, "writer-admitted", id)
            })
            let released = false
            return Object.freeze({
              generation: expected,
              verify: () => {
                if (released || current(storage, marker, false) !== expected) return false
                return driver.all("SELECT state FROM sf_control_writer WHERE id = ? AND storage_id = ? AND generation = ?", [id, storage, expected])[0]?.state === "active"
              },
              release: (outcome: "completed" | "failed") => Effect.try({
                try: () => {
                  if (released) throw unavailable()
                  atomic(driver, () => {
                    const row = driver.all("SELECT state FROM sf_control_writer WHERE id = ?", [id])[0]
                    if (row?.state !== "active") throw unavailable()
                    driver.execute("UPDATE sf_control_writer SET state = ? WHERE id = ? AND state = 'active'", [outcome, id])
                    journal(storage, expected, "writer-" + outcome, id)
                  })
                  released = true
                },
                catch: unavailable,
              }),
            })
          },
          catch: unavailable,
        }),
      })
    },
    /** Called by an explicit, reviewed migration, never by normal startup or a Team selection. */
    registerSuspended(storage: string, planHash: string) {
      if (!storage || !/^[a-f0-9]{64}$/.test(planHash)) throw unavailable()
      return atomic(driver, () => {
        const existing = read(storage)
        if (existing) {
          if (existing.planHash !== planHash || existing.mode !== "suspended") throw unavailable()
          return existing.generation
        }
        driver.execute("INSERT INTO sf_control_store (storage_id, generation, mode, plan_hash) VALUES (?, 1, 'suspended', ?)", [storage, planHash])
        journal(storage, 1, "migration-registered", planHash)
        return 1
      })
    },
    beginMaintenance(storage: string, expected: number) {
      return atomic(driver, () => {
        const recorded = read(storage)
        if (!recorded || recorded.generation !== expected || recorded.mode !== "active") throw new AuthorityGeneration.GenerationError("stale-generation")
        driver.execute("UPDATE sf_control_store SET mode = 'draining' WHERE storage_id = ?", [storage])
        journal(storage, expected, "maintenance-started", recorded.planHash)
      })
    },
    /** No timeout/TTL steals a writer. A crashed or unknown writer keeps the cut blocked. */
    suspendDrained(storage: string, expected: number) {
      return atomic(driver, () => {
        const recorded = read(storage)
        if (!recorded || recorded.generation !== expected || recorded.mode !== "draining" ||
            driver.all("SELECT 1 FROM sf_control_writer WHERE storage_id = ? AND state IN ('active', 'unknown') LIMIT 1", [storage]).length) throw unavailable()
        driver.execute("UPDATE sf_control_store SET mode = 'suspended' WHERE storage_id = ?", [storage])
        journal(storage, expected, "maintenance-drained", recorded.planHash)
      })
    },
    advanceSuspended(storage: string, expected: number, planHash: string) {
      if (!/^[a-f0-9]{64}$/.test(planHash) || !Number.isSafeInteger(expected + 1)) throw unavailable()
      return atomic(driver, () => {
        const recorded = read(storage)
        if (!recorded || recorded.mode !== "suspended" || recorded.generation !== expected ||
            driver.all("SELECT 1 FROM sf_control_writer WHERE storage_id = ? AND state IN ('active', 'unknown') LIMIT 1", [storage]).length) throw unavailable()
        driver.execute("UPDATE sf_control_store SET generation = ?, plan_hash = ? WHERE storage_id = ?", [expected + 1, planHash, storage])
        journal(storage, expected + 1, "generation-advanced", planHash)
        return expected + 1
      })
    },
    activate(storage: string, expected: number, planHash: string, marker: () => AuthoritySqlFence.Marker | undefined) {
      return atomic(driver, () => {
        const recorded = read(storage)
        const business = marker()
        if (!recorded || recorded.mode !== "suspended" || recorded.generation !== expected ||
            recorded.planHash !== planHash || !business || business.controlId !== controlId ||
            business.generation !== expected ||
            driver.all("SELECT 1 FROM sf_control_writer WHERE storage_id = ? AND state IN ('active', 'unknown') LIMIT 1", [storage]).length) throw unavailable()
        driver.execute("UPDATE sf_control_store SET mode = 'active' WHERE storage_id = ?", [storage])
        journal(storage, expected, "authority-activated", planHash)
      })
    },
  })
}
