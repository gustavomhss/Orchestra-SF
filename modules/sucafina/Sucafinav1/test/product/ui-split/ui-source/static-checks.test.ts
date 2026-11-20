import { expect, test } from "bun:test"
import path from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"

// Hosted-only adapter for the required package commands. No workflow is edited and
// no broad test suite is selected. Nonzero diagnostics remain failures, including foreign files.
const root = path.resolve(import.meta.dir, "../../../../../../..")
async function run(command: string, args: string[], cwd = root) {
  const result = await Effect.runPromise(Effect.gen(function* () {
    const service = yield* AppProcess.Service
    return yield* service.run(ChildProcess.make(command, args, { cwd }), { timeout: "120 seconds" })
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  console.log("UI_SOURCE_STATIC_COMMAND", JSON.stringify({ command, args, cwd, exitCode: result.exitCode }))
  if (result.stdout.length) console.log(result.stdout.toString("utf8"))
  if (result.stderr.length) console.error(result.stderr.toString("utf8"))
  expect(result.stdoutTruncated).toBe(false)
  expect(result.stderrTruncated).toBe(false)
  return result
}

test("hosted package typecheck: bun typecheck in modules/sucafina", async () => {
  expectSpawn(import.meta.path)
  const result = await run(process.execPath, ["typecheck"], path.join(root, "modules/sucafina"))
  expect(result.exitCode).toBe(0)
}, 180000)

test("hosted repository guards: actual origin/dev base and bun run check:guards", async () => {
  expectSpawn(import.meta.path)
  const shallow = await run("git", ["rev-parse", "--is-shallow-repository"])
  expect(shallow.exitCode).toBe(0)
  const fetch = await run("git", ["fetch", "--no-tags", ...(shallow.stdout.toString("utf8").trim() === "true" ? ["--unshallow"] : []), "origin", "dev:refs/remotes/origin/dev"])
  expect(fetch.exitCode).toBe(0)
  const refs = await run("git", ["rev-parse", "HEAD", "origin/dev"])
  expect(refs.exitCode).toBe(0)
  const result = await run(process.execPath, ["run", "check:guards", "--base", "origin/dev"])
  expect(result.exitCode).toBe(0)
}, 300000)
