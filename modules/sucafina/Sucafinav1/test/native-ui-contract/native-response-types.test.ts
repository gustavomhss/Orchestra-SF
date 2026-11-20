import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import path from "node:path"

// Qualification-only companion for this exact Native response candidate. This file
// stays on the proof source; it is not part of the permanent CI-SF inventory.
// Each command is the package's canonical typecheck, through the original
// process service. It neither evaluates nor supplies guardrail approval.
for (const directory of ["packages/app-shell", "modules/sucafina"]) {
  test(`Native response candidate retains the canonical type contract in ${directory}`, async () => {
    expectSpawn(import.meta.path)
    const bun = Bun.which("bun")
    if (!bun) throw new Error("The configured Bun executable is unavailable")
    const result = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(bun, ["typecheck"], {
        cwd: path.resolve(import.meta.dir, "../../../../..", directory), extendEnv: true,
      }), { timeout: "150 seconds", maxOutputBytes: 262144, maxErrorBytes: 262144 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    console.info("SF_NATIVE_RESPONSE_CANONICAL_TYPES", JSON.stringify({ directory, exitCode: result.exitCode,
      stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated }))
    if (result.stdout.length) console.info(result.stdout.toString("utf8"))
    if (result.stderr.length) console.error(result.stderr.toString("utf8"))
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
    expect(result.exitCode).toBe(0)
  }, 180000)
}
