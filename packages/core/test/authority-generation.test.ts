import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { Context, Effect, Exit } from "effect"
import { EffectDrizzleSqlite } from "@orchestra/effect-drizzle-sqlite"
import { sql } from "drizzle-orm"
import path from "node:path"
import { layer, openAuthorityControl } from "../src/database/sqlite.bun"
import { AuthoritySqlFence } from "../src/database/authority-sql-fence"
import { AuthorityControl } from "../src/database/authority-control"
import { AuthorityGeneration } from "../src/session/authority-generation"
import { tmpdir } from "./fixture/tmpdir"

const plan = "a".repeat(64)
async function fixture(activate = true) {
  const directory = await tmpdir()
  const filename = path.join(directory.path, "business.sqlite")
  const business = openAuthorityControl(filename)
  business.execute("CREATE TABLE protected_item (id TEXT PRIMARY KEY, value INTEGER NOT NULL)")
  const old = new Database(filename)
  old.run("PRAGMA foreign_keys = ON")
  old.run("PRAGMA busy_timeout = 1")
  const prepared = old.prepare("INSERT INTO protected_item (id, value) VALUES (?, ?)")
  const controlDriver = openAuthorityControl(path.join(directory.path, "authority.sqlite"))
  const control = AuthorityControl.open(controlDriver)
  const storage = AuthorityGeneration.storageID(business, filename)
  const marker = () => AuthoritySqlFence.marker(business)
  if (activate) {
    control.registerSuspended(storage, plan)
    business.execute("BEGIN IMMEDIATE")
    AuthoritySqlFence.install(business, { generation: 1, controlId: control.controlId }, ["protected_item"])
    business.execute("COMMIT")
    control.activate(storage, 1, plan, marker)
  }
  const generation = AuthorityGeneration.make(control.source(storage, marker))
  const guarded = AuthoritySqlFence.make(business, storage)
  const command = (query: string, params: readonly unknown[] = []) => Effect.withFiber((fiber) =>
    Effect.sync(() => guarded(query, fiber.context, () => business.all(query, params))))
  const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      yield* command("BEGIN IMMEDIATE")
      const result = yield* effect
      yield* command("COMMIT")
      return result
    }).pipe(Effect.ensuring(Effect.sync(() => { if (business.inTransaction()) business.execute("ROLLBACK") })))
  return {
    filename, business, old, prepared, controlDriver, control, storage, marker, generation, guarded, command, transaction,
    async [Symbol.asyncDispose]() {
      if (business.inTransaction()) business.execute("ROLLBACK")
      prepared.finalize()
      old.close(true)
      business.close()
      controlDriver.close()
      await directory[Symbol.asyncDispose]()
    },
  }
}

test("an actual unmarked technical store has no corporate generation and keeps technical SQL behavior", async () => {
  await using f = await fixture(false)
  expect(await Effect.runPromise(f.generation.current)).toBeUndefined()
  await Effect.runPromise(f.command("INSERT INTO protected_item VALUES ('technical', 1)"))
  expect(f.business.all("SELECT value FROM protected_item")).toEqual([{ value: 1 }])
})

test("a marked store with missing, foreign or suspended control fails closed", async () => {
  await using f = await fixture()
  const other = openAuthorityControl(":memory:")
  try {
    const missing = AuthorityGeneration.make(AuthorityControl.open(other).source(f.storage, f.marker))
    expect(Exit.isFailure(await Effect.runPromise(missing.current.pipe(Effect.exit)))).toBe(true)
    f.control.beginMaintenance(f.storage, 1)
    f.control.suspendDrained(f.storage, 1)
    expect(Exit.isFailure(await Effect.runPromise(f.generation.current.pipe(Effect.exit)))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromise(f.generation.withWriter(1, Effect.void).pipe(Effect.exit)))).toBe(true)
  } finally { other.close() }
})

test("protected writes need a private writer proof even when the old statement was prepared before the cut", async () => {
  await using f = await fixture()
  expect(() => f.prepared.run("old", 1)).toThrow("sf-authority-writer-required")
  expect(Exit.isFailure(await Effect.runPromise(f.command("INSERT INTO protected_item VALUES ('unowned', 1)").pipe(Effect.exit)))).toBe(true)
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([])
})

test("a valid writer commits atomically and never exposes its permit to another open connection", async () => {
  await using f = await fixture()
  await Effect.runPromise(f.generation.withWriter(1, f.transaction(Effect.gen(function* () {
    yield* f.command("INSERT INTO protected_item VALUES ('new', 2)")
    expect(f.old.query("SELECT writer_permit FROM sf_authority_generation").get()).toEqual({ writer_permit: null })
    expect(() => f.prepared.run("racing-old", 1)).toThrow()
  }))))
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([{ id: "new", value: 2 }])
  expect(f.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
  expect(() => f.prepared.run("late-old", 1)).toThrow("sf-authority-writer-required")
  expect(f.control.pendingWriters(f.storage)).toEqual([])
})

test("SQLite rejects COMMIT with an uncleared permit even if an adapter omits its cleanup", async () => {
  await using f = await fixture()
  f.business.execute("BEGIN IMMEDIATE")
  f.business.execute("UPDATE sf_authority_generation SET writer_permit = 'forgotten' WHERE id = 1")
  f.business.execute("INSERT INTO protected_item VALUES ('must-rollback', 1)")
  expect(() => f.business.execute("COMMIT")).toThrow()
  f.business.execute("ROLLBACK")
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([])
  expect(f.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
})

test("rollback removes the uncommitted permit and all protected data changes", async () => {
  await using f = await fixture()
  const result = await Effect.runPromise(f.generation.withWriter(1, f.transaction(Effect.gen(function* () {
    yield* f.command("INSERT INTO protected_item VALUES ('rollback', 1)")
    return yield* Effect.fail("intentional-failure")
  }))).pipe(Effect.exit))
  expect(Exit.isFailure(result)).toBe(true)
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([])
  expect(f.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
  expect(f.control.pendingWriters(f.storage)).toEqual([])
  expect(f.controlDriver.all("SELECT state FROM sf_control_writer")).toEqual([{ state: "failed" }])
})

test("an unrelated fiber cannot borrow a live transaction on the same SQLite connection", async () => {
  await using f = await fixture()
  await Effect.runPromise(f.generation.withWriter(1, f.transaction(Effect.sync(() => {
    expect(() => f.guarded("INSERT INTO protected_item VALUES ('borrowed', 1)", Context.empty(),
      () => f.business.all("INSERT INTO protected_item VALUES ('borrowed', 1)"))).toThrow("writer-required")
  }))))
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([])
})

test("a captured fiber context is useless after its writer has finished", async () => {
  await using f = await fixture()
  let captured: Context.Context<never> | undefined
  await Effect.runPromise(f.generation.withWriter(1, Effect.withFiber((fiber) => Effect.sync(() => { captured = fiber.context }))))
  if (!captured) throw new Error("Writer context was not captured")
  expect(AuthorityGeneration.writerFor(captured, f.storage, 1)).toBeUndefined()
  expect(() => f.guarded("INSERT INTO protected_item VALUES ('late', 1)", captured,
    () => f.business.all("INSERT INTO protected_item VALUES ('late', 1)"))).toThrow("sf-authority-writer-required")
})

test("reentrant writers share one lease, while a different store or generation is refused", async () => {
  await using f = await fixture()
  const other = AuthorityGeneration.make(f.control.source("foreign-storage", () => undefined))
  await Effect.runPromise(f.generation.withWriter(1, Effect.gen(function* () {
    yield* f.generation.withWriter(1, f.transaction(f.command("INSERT INTO protected_item VALUES ('nested', 1)")))
    expect(Exit.isFailure(yield* f.generation.withWriter(2, Effect.void).pipe(Effect.exit))).toBe(true)
    expect(Exit.isFailure(yield* other.withWriter(1, Effect.void).pipe(Effect.exit))).toBe(true)
    expect(f.controlDriver.all("SELECT id FROM sf_control_writer")).toHaveLength(1)
  })))
})

test("maintenance stops new admissions and waits for an already admitted writer without TTL stealing", async () => {
  await using f = await fixture()
  const lease = await Effect.runPromise(f.control.source(f.storage, f.marker).acquire(1))
  f.control.beginMaintenance(f.storage, 1)
  expect(lease.verify()).toBe(true)
  expect(() => f.control.suspendDrained(f.storage, 1)).toThrow()
  expect(Exit.isFailure(await Effect.runPromise(f.generation.withWriter(1, Effect.void).pipe(Effect.exit)))).toBe(true)
  await Effect.runPromise(lease.release("completed"))
  f.control.suspendDrained(f.storage, 1)
  expect(f.control.inspect(f.storage)?.mode).toBe("suspended")
})

test("a new generation cannot accept an earlier data marker, including after restart", async () => {
  await using f = await fixture()
  f.control.beginMaintenance(f.storage, 1)
  f.control.suspendDrained(f.storage, 1)
  expect(f.control.advanceSuspended(f.storage, 1, "b".repeat(64))).toBe(2)
  expect(() => f.control.activate(f.storage, 2, "b".repeat(64), f.marker)).toThrow()
  f.business.execute("BEGIN IMMEDIATE")
  AuthoritySqlFence.install(f.business, { generation: 2, controlId: f.control.controlId }, ["protected_item"])
  f.business.execute("COMMIT")
  f.control.activate(f.storage, 2, "b".repeat(64), f.marker)
  const restarted = AuthorityGeneration.make(AuthorityControl.open(f.controlDriver).source(f.storage, f.marker))
  expect(await Effect.runPromise(restarted.current)).toBe(2)
  expect(await Effect.runPromise(restarted.verifyGeneration(1))).toBe(false)
  // Simulates an older marker being restored; this is a negative fence test, not a recovery qualification.
  f.business.execute("UPDATE sf_authority_generation SET generation = 1")
  expect(Exit.isFailure(await Effect.runPromise(restarted.current.pipe(Effect.exit)))).toBe(true)
})

test("corporate runtime SQL cannot disable foreign keys, remove triggers or rewrite its marker", async () => {
  await using f = await fixture()
  for (const query of ["PRAGMA foreign_keys = OFF", "DROP TRIGGER sf_authority_protected_item_insert",
    "UPDATE sf_authority_generation SET generation = 99", "PRAGMA writable_schema = ON"]) {
    expect(Exit.isFailure(await Effect.runPromise(f.command(query).pipe(Effect.exit)))).toBe(true)
  }
  expect(f.marker()?.generation).toBe(1)
})

test("the production Bun adapter carries the private proof through a real EffectDrizzle transaction", async () => {
  await using f = await fixture()
  await Effect.runPromise(Effect.gen(function* () {
    const db = yield* EffectDrizzleSqlite.makeWithDefaults()
    yield* db.run("PRAGMA foreign_keys = ON")
    const refused = yield* db.transaction((tx) => tx.run(sql.raw("INSERT INTO protected_item VALUES ('missing', 1)")), { behavior: "immediate" }).pipe(Effect.exit)
    expect(Exit.isFailure(refused)).toBe(true)
    yield* f.generation.withWriter(1, db.transaction((tx) => tx.run(sql.raw("INSERT INTO protected_item VALUES ('adapter', 3)")), { behavior: "immediate" }))
  }).pipe(Effect.provide(layer({ filename: f.filename })), Effect.scoped))
  expect(f.business.all("SELECT * FROM protected_item")).toEqual([{ id: "adapter", value: 3 }])
})

test("a partially missing control journal is refused instead of silently recreating lost writer history", async () => {
  await using f = await fixture()
  f.controlDriver.execute("DROP TABLE sf_control_writer")
  expect(() => AuthorityControl.open(f.controlDriver)).toThrow("unavailable")
  expect(f.controlDriver.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sf_control_writer'")).toEqual([])
})
