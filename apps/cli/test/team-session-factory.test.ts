import { expect } from "bun:test"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { sessionOwnerFixture } from "../../../packages/core/test/fixture/session-owner"

const it = testEffect(LayerNode.compile(AppProcess.node))

it.live.skipIf(process.platform === "win32")(
  "the real CLI Team Session factory starts, owns its SSE lifetime, disposes and reopens private fixture storage",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const fixture = yield* Effect.acquireRelease(
      Effect.promise(() => sessionOwnerFixture({ storageLayout: "installation" })),
      (fixture) => Effect.promise(() => fixture[Symbol.asyncDispose]()),
    )
    const processService = yield* AppProcess.Service
    // Database.path reads startup flags at import time, so configure a fresh process instead of replacing that guard.
    const result = yield* processService.run(ChildProcess.make(process.execPath, [
      path.join(import.meta.dir, "fixture", "team-session-factory.ts"), fixture.directory, fixture.workspaceDirectory,
    ], {
      cwd: path.resolve(import.meta.dir, ".."),
      env: {
        ORCHESTRA_DB: fixture.filename,
        ORCHESTRA_INHERIT_CREDENTIALS: "0",
        ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(fixture.directory, "credential.key"),
        ORCHESTRA_DISABLE_MODELS_FETCH: "true",
        ORCHESTRA_MODELS_PATH: path.resolve(import.meta.dir, "../../../packages/core/test/plugin/fixtures/models-dev.json"),
        XDG_DATA_HOME: path.join(fixture.directory, "xdg-data"),
        XDG_CONFIG_HOME: path.join(fixture.directory, "xdg-config"),
        XDG_CACHE_HOME: path.join(fixture.directory, "xdg-cache"),
        XDG_STATE_HOME: path.join(fixture.directory, "xdg-state"),
      },
    }))
    if (result.exitCode !== 0) throw new Error("Team Session factory smoke failed: " + result.stderr.toString() + result.stdout.toString())
    expect(result.stdout.toString()).toContain("TEAM_SESSION_FACTORY_SMOKE_OK")
    expect(fixture.business.all("SELECT id FROM session")).toEqual([])
    expect(fixture.control.pendingWriters(fixture.storage)).toEqual([])
  })),
  30_000,
)
