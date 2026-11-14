import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"

// Focused recheck of the two receipt-format findings from run 43622153636.
// The unchanged foreign typecheck failure remains recorded by static-gates.
test("ui-work receipt cleanup satisfies the unchanged repository guards", async () => {
  expectSpawn(import.meta.path)
  const root = resolve(import.meta.dir, "../../../../../../..")
  const result = await Effect.runPromise(Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const base = yield* process.run(ChildProcess.make("git", ["fetch", "--no-tags", "origin", "+refs/heads/dev:refs/remotes/origin/dev"], { cwd: root }), { timeout: "90 seconds", combineOutput: true })
    console.info("UI_WORK_GUARD_BASE", base.exitCode, base.output?.toString())
    if (base.exitCode !== 0) return { base: base.exitCode, guards: undefined }
    const guards = yield* process.run(ChildProcess.make("bun", ["run", "check:guards", "--base", "origin/dev"], { cwd: root }), { timeout: "90 seconds", combineOutput: true })
    console.info("UI_WORK_GUARDS", guards.exitCode, guards.output?.toString())
    return { base: base.exitCode, guards: guards.exitCode }
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  expect(result).toEqual({ base: 0, guards: 0 })
}, 120_000)
