import { expect, test } from "bun:test"
import path from "node:path"
import { Cause, Effect, Exit, Layer } from "effect"
import { Database } from "../src/database/database"
import { AuthorityControl } from "../src/database/authority-control"
import { AuthorityControlFile } from "../src/database/authority-control-file"
import { AuthoritySqlFence } from "../src/database/authority-sql-fence"
import { openAuthorityControl } from "../src/database/sqlite.bun"
import { AuthorityGeneration } from "../src/session/authority-generation"
import { AuthorityGenerationRuntime } from "../src/session/authority-generation-runtime"
import { tmpdir } from "./fixture/tmpdir"

const runtime = (filename: string) =>
  AuthorityGenerationRuntime.layer.pipe(Layer.provideMerge(Database.layerFromPath(filename)))
const unavailable = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.gen(function* () {
  const exit = yield* effect.pipe(Effect.exit)
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(AuthorityGeneration.GenerationError)
})

test("technical startup and generation reads never create a private control store on any platform", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "technical.sqlite")
  await Effect.runPromise(Effect.gen(function* () {
    const generation = yield* AuthorityGeneration.Service
    expect(yield* Effect.promise(() => Bun.file(filename + ".authority.sqlite").exists())).toBe(false)
    expect(yield* generation.current).toBeUndefined()
    expect(yield* generation.current).toBeUndefined()
    expect(yield* generation.verifyGeneration(1)).toBe(false)
    yield* unavailable(generation.withWriter(1, Effect.void))
    expect(yield* Effect.promise(() => Bun.file(filename + ".authority.sqlite").exists())).toBe(false)
  }).pipe(Effect.provide(runtime(filename)), Effect.scoped))
  expect(await Bun.file(filename + ".authority.sqlite").exists()).toBe(false)
})

test("an unmarked in-memory technical database does not require POSIX control-file support", async () => {
  await Effect.runPromise(Effect.gen(function* () {
    const generation = yield* AuthorityGeneration.Service
    expect(yield* generation.current).toBeUndefined()
    expect(yield* generation.verifyGeneration(1)).toBe(false)
    yield* unavailable(generation.withWriter(1, Effect.void))
  }).pipe(Effect.provide(runtime(":memory:")), Effect.scoped))
})

test("a corporate marker observed after technical startup cannot recreate missing durable authority", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "late-marker.sqlite")
  await Effect.runPromise(Effect.gen(function* () {
    const generation = yield* AuthorityGeneration.Service
    expect(yield* generation.current).toBeUndefined()
    const business = openAuthorityControl(filename)
    try {
      business.execute("BEGIN IMMEDIATE")
      AuthoritySqlFence.install(business, { generation: 1, controlId: "missing-private-control" })
      business.execute("COMMIT")
      yield* unavailable(generation.current)
      yield* unavailable(generation.verifyGeneration(1))
      yield* unavailable(generation.withWriter(1, Effect.void))
      expect(yield* Effect.promise(() => Bun.file(filename + ".authority.sqlite").exists())).toBe(false)
    } finally { business.close() }
  }).pipe(Effect.provide(runtime(filename)), Effect.scoped))
})

test.skipIf(process.platform === "win32")("an existing private authority record without its business marker never downgrades to technical mode", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "missing-marker.sqlite")
  await Effect.runPromise(Effect.gen(function* () {
    const database = yield* Database.Service
    const generation = yield* AuthorityGeneration.Service
    expect(yield* generation.current).toBeUndefined()
    const driver = AuthorityControlFile.open(filename + ".authority.sqlite", openAuthorityControl)
    try {
      const control = AuthorityControl.open(driver)
      if (!database.storageID) throw new Error("Production database identity required")
      control.registerSuspended(database.storageID, "a".repeat(64))
      yield* unavailable(generation.current)
      yield* unavailable(generation.withWriter(1, Effect.void))
      expect(control.inspect(database.storageID)?.generation).toBe(1)
      expect(control.inspect(database.storageID)?.mode).toBe("suspended")
    } finally { driver.close() }
  }).pipe(Effect.provide(runtime(filename)), Effect.scoped))
})
