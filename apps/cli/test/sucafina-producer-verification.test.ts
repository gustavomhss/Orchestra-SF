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
const source = "d008b222e06f803c96966111b4b4419fcdc44eb8"
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
    verification: "sf-interface-producers-round-four-final",
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


// 5 complete cases; original Bun bounds total 600s, plus 30s process allowance.
checks.live("planner-recall-observation retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("planner-recall-observation", process.execPath, [
    "test", "./test/product/wp10/integration/planner-recall-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 630_000)
}), 660_000)


// 2 complete cases; original Bun bounds total 240s, plus 30s process allowance.
checks.live("current-choice-source-authority retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("current-choice-source-authority", process.execPath, [
    "test", "./test/product/wp10/integration/current-choice-source-authority.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 270_000)
}), 300_000)


// 2 complete cases; original Bun bounds total 240s, plus 30s process allowance.
checks.live("planner-record-proof-scope retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("planner-record-proof-scope", process.execPath, [
    "test", "./test/product/wp10/integration/planner-record-proof-scope.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 270_000)
}), 300_000)


// 3 complete cases; original Bun bounds total 360s, plus 30s process allowance.
checks.live("scenario-source-observation retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("scenario-source-observation", process.execPath, [
    "test", "./test/product/wp10/integration/scenario-source-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 390_000)
}), 420_000)


// 2 complete cases; original Bun bounds total 240s, plus 30s process allowance.
checks.live("portfolio-source-observation verifies the complete Portfolio source composition", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("portfolio-source-observation", process.execPath, [
    "test", "./test/product/wp10/integration/portfolio-source-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 270_000)
}), 300_000)


// 1 complete cases; original Bun bounds total 120s, plus 30s process allowance.
checks.live("finance-pair-observation retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("finance-pair-observation", process.execPath, [
    "test", "./test/product/wp10/integration/finance-pair-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 150_000)
}), 180_000)


// 2 complete cases; original Bun bounds total 240s, plus 30s process allowance.
checks.live("scenario-phase-observation retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("scenario-phase-observation", process.execPath, [
    "test", "./test/product/wp10/integration/scenario-phase-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 270_000)
}), 300_000)


// 1 complete cases; original Bun bounds total 120s, plus 30s process allowance.
checks.live("calculation-observation retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("calculation-observation", process.execPath, [
    "test", "./test/product/wp10/integration/calculation-observation.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 150_000)
}), 180_000)


// 1 complete cases; original Bun bounds total 120s, plus 30s process allowance.
checks.live("calculation-ancestry-composition retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("calculation-ancestry-composition", process.execPath, [
    "test", "./test/product/wp10/integration/calculation-ancestry-composition.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 150_000)
}), 180_000)


// 1 complete cases; original Bun bounds total 120s, plus 30s process allowance.
checks.live("scenario-subtotal-source retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("scenario-subtotal-source", process.execPath, [
    "test", "./test/product/wp10/integration/scenario-subtotal-source.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 150_000)
}), 180_000)


// 4 complete cases; original Bun bounds total 180s, plus 30s process allowance.
checks.live("sucafina-case-read-scope retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("sucafina-case-read-scope", process.execPath, [
    "test", "./test/sucafina-case-read-scope.test.ts",
  ], path.join(repository, "apps/cli"), 210_000)
}), 240_000)


// 14 complete cases; original Bun bounds total 70s, plus 30s process allowance.
checks.live("operator-identity retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("operator-identity", process.execPath, [
    "test", "./test/operator-identity.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 100_000)
}), 130_000)


// 1 complete cases; original Bun bounds total 300s, plus 30s process allowance.
checks.live("sensitivity-publication retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("sensitivity-publication", process.execPath, [
    "test", "./test/product/wp10/integration/sensitivity-publication.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 330_000)
}), 360_000)


// 3 complete cases; original Bun bounds total 720s, plus 30s process allowance.
checks.live("sensitivity-classification retains its complete original producer regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("sensitivity-classification", process.execPath, [
    "test", "./test/product/wp10/integration/sensitivity-classification.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 750_000)
}), 780_000)

// 6 complete cases; original Bun bounds total 195s, plus 30s process allowance.
checks.live("atlas-capture-selectors retains complete protocol and native publication controls", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("atlas-capture-selectors", process.execPath, [
    "test", "./test/product/wp10/integration/atlas-capture-selectors.test.ts",
  ], path.join(repository, "modules/sucafina/Sucafinav1"), 225_000)
}), 255_000)

// 1 complete case; original Bun bound is 850s, plus 30s process allowance.
checks.live("sucafina-reviewer-recall retains the real native Atlas regression", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("sucafina-reviewer-recall", process.execPath, [
    "test", "./test/sucafina-reviewer-recall.test.ts",
  ], path.join(repository, "apps/cli"), 880_000)
}), 910_000)
