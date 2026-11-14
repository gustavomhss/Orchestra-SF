import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"

// The exclusive write lease excludes workflows. Execute the exact required
// commands through the existing surgical Actions runner and Omni instead.
// Diagnostics are printed intact and nonzero exits remain failed assertions.
test("ui-work package typecheck and repository guards use the canonical commands", async () => {
  expectSpawn(import.meta.path)
  const root = resolve(import.meta.dir, "../../../../../../..")
  const results = await Effect.runPromise(Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const run = (command: string, args: string[], cwd: string) => process.run(ChildProcess.make(command, args, { cwd }), { timeout: "90 seconds", combineOutput: true })
    const typecheck = yield* run("bun", ["typecheck"], resolve(root, "modules/sucafina"))
    console.info("UI_WORK_TYPECHECK", typecheck.exitCode, typecheck.output?.toString())
    const base = yield* run("git", ["fetch", "--no-tags", "origin", "+refs/heads/dev:refs/remotes/origin/dev"], root)
    console.info("UI_WORK_GUARD_BASE", base.exitCode, base.output?.toString())
    if (base.exitCode !== 0) return { typecheck: typecheck.exitCode, base: base.exitCode, guards: undefined }
    const guards = yield* run("bun", ["run", "check:guards", "--base", "origin/dev"], root)
    console.info("UI_WORK_GUARDS", guards.exitCode, guards.output?.toString())
    return { typecheck: typecheck.exitCode, base: base.exitCode, guards: guards.exitCode }
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  expect(results).toEqual({ typecheck: 0, base: 0, guards: 0 })
}, 120_000)
