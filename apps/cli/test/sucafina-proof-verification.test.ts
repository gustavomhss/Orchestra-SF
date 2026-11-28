// Snapshot-only verification. This driver is not part of the #613 product candidate.
import { expect } from "bun:test"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

const repository = path.resolve(import.meta.dir, "../../..")
const module = path.join(repository, "modules/sucafina/Sucafinav1")
const source = "2228172b29080b411850ec98a4cdaa66020db5e6"
const sourceTree = "2fe9f134f907b771104f75ef1442cb24c5beb72a"
const historicalCompositionBase = "4b62fa9f8ef2e29d1b0e2470045c459487b9c0cc"
const checks = testEffect(LayerNode.compile(AppProcess.node))

function requireHostedCandidate() {
  if (!/^[a-f0-9]{40}$/.test(source) || !/^[a-f0-9]{40}$/.test(sourceTree))
    throw new Error("C20 source and tree must be bound to reviewed Git objects before execution")
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
    throw new Error("This verification requires its actual Linux GitHub Actions snapshot")
  }
  process.stdout.write(JSON.stringify({
    verification: "sf613-c20-scenario-candidates-focal", source, sourceTree,
    snapshot: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID,
    historicalCompositionBase,
  }) + "\n")
}

function runCommand(label: string, executable: string, args: readonly string[], cwd: string, timeout = 180_000, printOutput = true) {
  return Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    const started = performance.now()
    const result = yield* processes.run(ChildProcess.make(executable, [...args], {
      cwd, env: { GUARDRAIL_APPROVED: "" }, extendEnv: true,
      stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "5 seconds",
    }), { timeout, maxOutputBytes: 1_048_576, maxErrorBytes: 1_048_576 })
    const output = result.stdout.toString("utf8")
    const error = result.stderr.toString("utf8")
    process.stdout.write(JSON.stringify({
      gate: label, source, sourceTree, snapshot: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID,
      command: [executable, ...args], cwd: path.relative(repository, cwd) || ".",
      exitCode: result.exitCode, durationMs: Math.round(performance.now() - started),
      stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated,
    }) + "\n" + (printOutput ? output : "") + error + "\n")
    if (result.stdoutTruncated || result.stderrTruncated)
      throw new Error(label + " exceeded the bounded evidence capture")
    expect(result.exitCode, label).toBe(0)
    return output
  })
}

checks.live("snapshot identifies the exact reviewed product source and tree", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  process.stdout.write(JSON.stringify({ scenarioCandidatesManifest: {
    source, sourceTree, qualification: false, sourcePaths: 17, productDeltaPaths: 1, candidateDeltaPaths: 2,
    deltaBase: "7393cd010086f4a12d61ae9bb5db13534bd18aa0",
    expectedGroups: 8, expectedCommands: 14, functionalProcessesLaunched: 4,
    staticDeclarationSites: { casesContract: 7, projection: 5, portfolioSelection: 3, scenarioLookup: 1 },
    expectedControlReports: 7, preservedC16Outcomes: 31, identityProjectionOracles: 9, nameFilter: null,
    mechanism: "existing closed scenario-candidates factory clones the complete decisionResults graph before filtering; original lookup predicate, late request key and guards preserved",
    callbackIdentity: "factory creates a new callback; no identity, name or toString equivalence with the prior inline arrow",
    assertions: "whole-file cases contract, C08 projection, Portfolio and scenario lookup consumers; explicit read-set effects only; observed test and assertion totals require actual footers",
    casesControlsMs: { cooperativePerTest: 12000, bunPerTest: 15000, declaredTests: 7, nominalSum: 105000, process: 120000, parent: 180000 },
    projectionControlsMs: { inheritedC14: { cooperativePerTest: 110000, bunPerTest: 120000, selectedTests: 2 }, inheritedC15: { cooperativePerTest: 18000, bunPerTest: 20000, selectedTests: 2 }, retainedC16: { cooperativePerTest: 8000, bunPerTest: 10000, selectedTests: 1 }, selectedTests: 5, nominalSum: 290000, process: 300000, parent: 360000 },
    portfolioControlsMs: { inheritedCooperative: [12000, 12000], inheritedBun: [15000, 15000], addedCooperative: 18000, addedBun: 20000, declaredTests: 3, nominalSum: 50000, process: 120000, parent: 180000 },
    scenarioControlsMs: { cooperative: 18000, bun: 20000, declaredTests: 1, internalInvocations: 14, nominalSum: 20000, process: 45000, parent: 60000 },
    typecheckMs: { process: 240000, parent: 300000 },
    guardsMs: { defaultProcess: 180000, parent: 600000 },
    snapshotOverlays: [".ci-run.json", "apps/cli/test/sucafina-proof-verification.test.ts"],
  } }) + "\n")
  yield* runCommand("fetch source parent", "git", [
    "fetch", "--no-tags", "--depth=2", "origin", process.env.GITHUB_SHA!,
  ], repository, 60_000)
  const head = yield* runCommand("snapshot identity", "git", ["rev-parse", "HEAD"], repository, 30_000)
  const snapshot = process.env.GITHUB_SHA
  if (typeof snapshot !== "string") throw new Error("The Actions snapshot SHA is required")
  expect(head.trim()).toBe(snapshot)
  const candidate = yield* runCommand("source identity", "git", [
    "show", "-s", "--format=%H%n%T", "HEAD^",
  ], repository, 30_000)
  expect(candidate.trim().split("\n")).toEqual([source, sourceTree])
  const sourceFiles = [
    ["modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts","1017609000bdbdb39fc0510b045dc6dfde371faf"],
    ["modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts","b7de9404461591ce0162d496ec917a47fb72a479"],
    ["modules/sucafina/Sucafinav1/runtime/local-store.ts","5fc0028474aa52c148a30c093d39bc9a471f9a24"],
    ["apps/cli/src/sucafina-product/planner-calculation-root.ts","244d46ee41e9ce288a7260938174a57161137bab"],
    ["modules/sucafina/Sucafinav1/product/integration/source-inventory.ts","eac8e0b28e591b7cc50ef5cb7fb1ebe768526509"],
    ["modules/sucafina/Sucafinav1/product/integration/source-projections.ts","ccc5ea87046144843e1751b1288e907974d24ca5"],
    ["modules/sucafina/Sucafinav1/product/host-binding/acl-state-authorize.ts","f183dd1049ef205c38395bda99c83efa8eddc80a"],
    ["modules/sucafina/Sucafinav1/product/integration/product-authority.ts","dc483ab92936e410f529bf5c5d2bd52fbc6ffffb"],
    ["modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts","5b453e1672aa98616e814ac64900517d1ae4f60a"],
    ["modules/sucafina/Sucafinav1/runtime/contract.ts","39e6da84a3dd815721484affaf8315731ded073b"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/c08-snapshot-projection.test.ts","6bef21db9129db064b018f5f0bf632306e3a16ec"],
    ["modules/sucafina/Sucafinav1/product/host-binding/captured-context-identity.ts","11661b32f4dc782558b39902c0f396145cbe8a4a"],
    ["modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts","44cff7d70fca11ca022f863d7811b9a2610186fd"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/cases-read-contract.test.ts","b6938565cb8b468a454178688ea88a4ec88da9fa"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-selection-preferences-read.test.ts","68ae48f9a039180824f5471a1de27c0ca34be088"],
    ["modules/sucafina/Sucafinav1/product/decisions/scenario-lookup.ts","c8dd1c26b46ea7c287db80d0ca5746205e45f1ef"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/scenario-lookup-selection.test.ts","1c4b73e4d170a358c0065bd674817f98edd6e86f"],
  ] as const
  const observed: { path: string; sha: string }[] = []
  const gitBlob = (bytes: Uint8Array) => new Bun.CryptoHasher("sha1")
    .update("blob " + bytes.byteLength + "\0").update(bytes).digest("hex")
  for (const [file, expected] of sourceFiles) {
    const bytes = yield* Effect.promise(() => readFile(path.join(repository, file)))
    const actual = gitBlob(bytes)
    expect(actual, file).toBe(expected)
    observed.push({ path: file, sha: actual })
  }
  process.stdout.write(JSON.stringify({ gate: "reviewed source blobs", source, sourceTree,
    snapshot, files: observed, expectedGroups: 8, expectedCommands: 14,
    functionalProcessesLaunched: 4, staticDeclarationSites: { casesContract: 7, projection: 5, portfolioSelection: 3, scenarioLookup: 1 },
    expectedControlReports: 7 }) + "\n")
}), 180_000)

checks.live("complete cases read-set preserves original guards and late case lookups", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("complete cases read-set contract whole-file", process.execPath,
    ["test", "./test/product/wp10/integration/cases-read-contract.test.ts"], module, 120_000)
}), 180_000)

checks.live("C14/C15/C16/C17 C08 projection and closed case selection preserve authorization and full-path equivalence", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("C14/C15/C16/C17 snapshot projection and closed case selection", process.execPath,
    ["test", "./test/product/wp10/integration/c08-snapshot-projection.test.ts"], module, 300_000)
}), 360_000)

checks.live("the CLI package preserves its original types", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("CLI package typecheck", process.execPath, ["run", "typecheck"], path.join(repository, "apps/cli"), 240_000)
}), 300_000)

checks.live("the Sucafina package preserves its original types", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("Sucafina package typecheck", process.execPath, ["run", "typecheck"], module, 240_000)
}), 300_000)

checks.live("canonical guards use current origin dev and its actual merge base", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const shallow = yield* runCommand("inspect history completeness", "git", [
    "rev-parse", "--is-shallow-repository",
  ], repository, 30_000)
  yield* runCommand("fetch current dev and source ancestry", "git", [
    "fetch", "--no-tags", ...(shallow.trim() === "true" ? ["--unshallow"] : []),
    "origin", "+refs/heads/dev:refs/remotes/origin/dev", process.env.GITHUB_SHA!,
  ], repository, 120_000)
  const dev = (yield* runCommand("current dev identity", "git", [
    "rev-parse", "--verify", "refs/remotes/origin/dev^{commit}",
  ], repository, 30_000)).trim()
  const mergeBase = (yield* runCommand("actual guard merge base", "git", [
    "merge-base", "HEAD", "origin/dev",
  ], repository, 30_000)).trim()
  expect(dev).toMatch(/^[a-f0-9]{40}$/)
  expect(mergeBase).toMatch(/^[a-f0-9]{40}$/)
  process.stdout.write(JSON.stringify({ gate: "guard ancestry", source, sourceTree, dev, mergeBase,
    historicalCompositionBase, command: "bun run check:guards --base origin/dev --json" }) + "\n")
  const output = yield* runCommand("canonical guardrails", process.execPath, [
    "run", "check:guards", "--base", "origin/dev", "--json",
  ], repository)
  const report: unknown = JSON.parse(output)
  expect(report).toMatchObject({ base: mergeBase, bootstrap: false, errors: [], approved: [] })
  if (!report || typeof report !== "object" || !("rules" in report) ||
      typeof report.rules !== "number" || report.rules < 1)
    throw new Error("Canonical guards did not evaluate rules from the actual merge base")
}), 600_000)

checks.live("Portfolio selection preserves its cases and preferences read contracts", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("Portfolio selection cases and preferences whole-file", process.execPath,
    ["test", "./test/product/wp10/integration/portfolio-selection-preferences-read.test.ts"], module, 120_000)
  expect(output).toContain("SF_C19_PORTFOLIO_CASES ")
}), 180_000)

checks.live("Scenario lookup preserves complete candidate reads, fallback and fresh authority", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("Scenario lookup complete candidates whole-file", process.execPath,
    ["test", "./test/product/wp10/integration/scenario-lookup-selection.test.ts"], module, 45_000)
  expect(output).toContain("SF_C20_SCENARIO_LOOKUP ")
}), 60_000)
