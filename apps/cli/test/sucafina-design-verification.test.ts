// Snapshot-only verification for the Sucafina design wave. Do not integrate this file into product.
import { expect } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

const repository = path.resolve(import.meta.dir, "../../..")
const app = path.join(repository, "packages/app-shell")
const generated = path.join(app, "src/orchestra/palette/generated")
const dev = "b5297b938735eab8ae37a686f01015f37c727724"
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
    verification: "sf-design-wave-one",
    candidate: process.env.GITHUB_SHA,
    run: process.env.GITHUB_RUN_ID,
    guardBase: dev,
  }) + "\n")
}

function runCommand(label: string, executable: string, args: readonly string[], cwd: string, timeout = 180_000) {
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

async function paletteSnapshot() {
  const names = (await readdir(generated)).toSorted()
  return Promise.all(names.map(async (name) => ({
    name,
    content: await readFile(path.join(generated, name), "utf8"),
  })))
}

checks.live("the composed app-shell passes its package typecheck", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("app-shell typecheck", process.execPath, ["typecheck"], app, 240_000)
}), 300_000)

checks.live("the composed candidate passes guardrails from the exact dev base", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  // This updates only the disposable checkout's remote-tracking ref, never the remote repository.
  yield* runCommand("fetch pinned guard base", "git", [
    "fetch", "--no-tags", "--depth=1", "origin", dev + ":refs/remotes/origin/dev",
  ], repository, 60_000)
  const resolved = yield* runCommand("resolve pinned guard base", "git", [
    "rev-parse", "--verify", "refs/remotes/origin/dev^{commit}",
  ], repository, 30_000)
  expect(resolved.trim()).toBe(dev)
  const output = yield* runCommand("guardrails", process.execPath, [
    "run", "check:guards", "--base", "origin/dev", "--json",
  ], repository)
  const report: unknown = JSON.parse(output)
  expect(report).toMatchObject({ base: dev, bootstrap: false, errors: [], approved: [] })
  if (!report || typeof report !== "object" || !("rules" in report) ||
      typeof report.rules !== "number" || report.rules < 1) {
    throw new Error("Guardrails did not evaluate any rules from the pinned base")
  }
}), 300_000)

checks.live("the palette writer preserves the committed generated files exactly", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const before = yield* Effect.promise(paletteSnapshot)
  expect(before.length).toBeGreaterThan(0)
  yield* runCommand("palette generation", process.execPath, ["run", "script/orchestra-palettes.ts"], app, 120_000)
  const after = yield* Effect.promise(paletteSnapshot)
  expect(after.map((entry) => entry.name)).toEqual(before.map((entry) => entry.name))
  const changed = before.filter((entry, index) => entry.content !== after[index]?.content).map((entry) => entry.name)
  process.stdout.write(JSON.stringify({ gate: "palette byte parity", files: before.length, changed }) + "\n")
  expect(changed).toEqual([])
}), 180_000)
