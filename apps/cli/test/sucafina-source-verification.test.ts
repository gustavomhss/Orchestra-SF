// Snapshot-only verification for the Sucafina design wave. Do not integrate this file into product.
import { expect } from "bun:test"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

const repository = path.resolve(import.meta.dir, "../../..")
const source = "db4ef5271c7040bcdb1f952c17f9c7109379f9df"
const checks = testEffect(LayerNode.compile(AppProcess.node))

function requireHostedCandidate() {
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
    throw new Error("This verification wrapper requires the actual Linux GitHub Actions candidate")
  }
  // test-ci intentionally sets GITHUB_ACTIONS=false for its Bun runner; it is not our admission signal.
  process.stdout.write(JSON.stringify({
    verification: "sf-interface-source-observations-round-four",
    candidate: process.env.GITHUB_SHA,
    run: process.env.GITHUB_RUN_ID,
    source,
  }) + "\n")
}

function runCommand(label: string, executable: string, args: readonly string[], cwd: string, timeout = 240_000) {
  return Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    const result = yield* processes.run(ChildProcess.make(executable, [...args], {
      cwd,
      // No approval carried in from a runner environment may relax the guard invocation.
      env: { GUARDRAIL_APPROVED: "" },
      extendEnv: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      killSignal: "SIGTERM",
      forceKillAfter: "5 seconds",
    }), {
      timeout,
      maxOutputBytes: 1_048_576,
      maxErrorBytes: 1_048_576,
    })
    const output = result.stdout.toString("utf8")
    const error = result.stderr.toString("utf8")
    process.stdout.write(JSON.stringify({
      gate: label,
      command: [executable, ...args],
      cwd: path.relative(repository, cwd) || ".",
      exitCode: result.exitCode,
      stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated,
    }) + "\n" + output + error + "\n")
    if (result.stdoutTruncated || result.stderrTruncated) {
      throw new Error(label + " exceeded the bounded evidence capture")
    }
    expect(result.exitCode, label).toBe(0)
    return output
  })
}


// Three complete cases retain their 105s cooperative / 120s Bun bounds.
// The new wrapper allows their full 360s total plus process and harness closure.
checks.live("scenario-source-observation retains all three complete producer controls", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("scenario-source-observation", process.execPath, [
    "test", "./test/product/wp10/integration/scenario-source-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 390_000)
}), 420_000)
