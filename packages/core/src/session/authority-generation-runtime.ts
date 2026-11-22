export * as AuthorityGenerationRuntime from "./authority-generation-runtime"

import { openAuthorityControl } from "#sqlite"
import { Effect, Layer } from "effect"
import { lstatSync } from "node:fs"
import { AuthorityControlFile } from "../database/authority-control-file"
import { AuthorityControl } from "../database/authority-control"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { AuthorityGeneration } from "./authority-generation"

export const layer = Layer.effect(AuthorityGeneration.Service, Effect.gen(function* () {
  const database = yield* Database.Service
  const filename = database.filename
  const marker = database.authorityMarker
  if (!filename || !database.storageID || !marker)
    return yield* Effect.die(new AuthorityGeneration.GenerationError("unavailable"))
  const storageID = database.storageID
  const file = AuthorityGeneration.filename(filename)
  const controlPath = file ? file + ".authority.sqlite" : ":memory:"
  const retained: {
    driver?: ReturnType<typeof openAuthorityControl>
    source?: AuthorityGeneration.Source
  } = {}
  yield* Effect.addFinalizer(() => Effect.sync(() => retained.driver?.close()))
  const source = Effect.try({
    try: () => {
      if (retained.source) return retained.source
      // Technical startup must not create a control file or require POSIX private-file support.
      // Reobserve both inputs on every call; a later corporate marker or control file closes this path.
      const current = marker()
      const exists = file !== undefined && controlExists(controlPath)
      if (!current && !exists) return undefined
      // A missing durable control cannot be recreated from the business checkpoint.
      if (!exists) throw new AuthorityGeneration.GenerationError("unavailable")
      const driver = AuthorityControlFile.open(controlPath, openAuthorityControl, { create: false })
      try {
        const control = AuthorityControl.open(driver, { initialize: false })
        retained.source = control.source(storageID, marker)
        retained.driver = driver
        return retained.source
      } catch (error) {
        driver.close()
        throw error
      }
    },
    catch: (error) => error instanceof AuthorityGeneration.GenerationError ? error :
      new AuthorityGeneration.GenerationError("unavailable"),
  })
  return AuthorityGeneration.make({
    storageID,
    current: source.pipe(Effect.flatMap((value) => value ? value.current : Effect.succeed(undefined))),
    verifyGeneration: (expected) => source.pipe(
      Effect.flatMap((value) => value ? value.verifyGeneration(expected) : Effect.succeed(false)),
    ),
    acquire: (expected) => source.pipe(Effect.flatMap((value) => value ? value.acquire(expected) :
      Effect.fail(new AuthorityGeneration.GenerationError("unavailable")))),
  })
}))

function controlExists(filename: string): boolean {
  try { lstatSync(filename); return true }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}

/** Explicit dependency: SessionOwner must not depend on contribution construction order. */
export const node = makeGlobalNode({ service: AuthorityGeneration.Service, layer, deps: [Database.node] })
