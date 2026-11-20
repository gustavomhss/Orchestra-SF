export * as AuthorityGenerationRuntime from "./authority-generation-runtime"

import { openAuthorityControl } from "#sqlite"
import { Effect, Layer } from "effect"
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
  const file = AuthorityGeneration.filename(filename)
  const controlPath = file ? file + ".authority.sqlite" : ":memory:"
  const driver = controlPath === ":memory:" ? openAuthorityControl(controlPath) :
    AuthorityControlFile.open(controlPath, openAuthorityControl)
  yield* Effect.addFinalizer(() => Effect.sync(() => driver.close()))
  const control = AuthorityControl.open(driver)
  return AuthorityGeneration.make(control.source(database.storageID, marker))
}))

/** Explicit dependency: SessionOwner must not depend on contribution construction order. */
export const node = makeGlobalNode({ service: AuthorityGeneration.Service, layer, deps: [Database.node] })
