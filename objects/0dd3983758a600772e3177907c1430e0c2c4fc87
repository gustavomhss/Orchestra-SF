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
const source = "dffc62a08bdba74f1a9322d49cde095e81535f55"
const sourceTree = "0da48e0d15de780d981a5bce3e49e382a6e61849"
const sourceBase = "455c02a7a05a6dd3262ae15b184419897366fde4"
const historicalCompositionBase = "4b62fa9f8ef2e29d1b0e2470045c459487b9c0cc"
const checks = testEffect(LayerNode.compile(AppProcess.node))

function requireHostedCandidate() {
  if (!/^[a-f0-9]{40}$/.test(source) || !/^[a-f0-9]{40}$/.test(sourceTree))
    throw new Error("E13 diagnostic source and tree must be bound to reviewed Git objects before execution")
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
    throw new Error("This verification requires its actual Linux GitHub Actions snapshot")
  }
  process.stdout.write(JSON.stringify({
    verification: "sf613-e13-preview-causal-focal", source, sourceTree,
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

checks.live("snapshot identifies the exact reviewed E13 diagnostic source, tree and parent", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  process.stdout.write(JSON.stringify({ previewE13Manifest: {
    source, sourceTree, sourceBase, qualification: false, productChange: false,
    sourceOverlayPaths: 7, sourceWorkingPins: 22, workingPins: 24, focalControlPaths: 2,
    sourceOverlay: { added: 2, modified: 5 }, snapshotDelta: { added: 3, modified: 1 },
    sourceRequest: { path: ".ci-run.json", git: "eda49a023c07599de00f5af9642ee92b9d9adf3b", bytes: 295 },
    expectedGroups: 8, expectedCommands: 14, functionalProcessesLaunched: 4,
    expectedTestDeclarations: 40, preservedTestDeclarations: 39, addedTestDeclarations: 1,
    expectedControlReports: 10, preservedControlReports: 9, preservedC16Outcomes: 31, identityProjectionOracles: 9, captureLazyOracles: 8, nameFilter: null,
    mechanism: "temporary E13 Request phase observation over clean C18; inherited functional controls and an isolated synthetic observer control remain separate",
    assertions: "C13/C14/C15/C16/C17 and C18 whole-file controls remain literal; E13 covers seven isolated mechanism modes with synthetic inputs and real denial/early-return callers; no current Analytics, CPU or latency qualification",
    readonlyControlsMs: { bunPerTest: 45000, selectedTests: 7, nominalSum: 315000, process: 360000, parent: 420000 },
    projectionControlsMs: { inheritedC14: { cooperativePerTest: 110000, bunPerTest: 120000, selectedTests: 2 }, inheritedC15: { cooperativePerTest: 18000, bunPerTest: 20000, selectedTests: 2 }, retainedC16: { cooperativePerTest: 8000, bunPerTest: 10000, selectedTests: 1 }, selectedTests: 5, nominalSum: 290000, process: 300000, parent: 360000 },
    captureControlsMs: { preservedTests: 26, addedTests: 1, selectedTests: 27, inheritedTimeoutsUnchanged: true, addedBunPerTest: 10000, loadingChildren: 11, addedChildren: 1, childProcess: 3000, process: 180000, parent: 240000 },
    observationControlsMs: { bunPerTest: 35000, selectedTests: 1, childModes: 7, childProcess: 3000, childForceKillAfter: 1000, childOutputBytes: 65536, childErrorBytes: 65536, reportBytes: 16384, process: 60000, parent: 90000 },
    observationModes: ["flow", "mechanism", "foreign-noop", "get-store", "output", "overflow", "unavailable"],
    typecheckMs: { process: 240000, parent: 300000 },
    guardsMs: { defaultProcess: 180000, parent: 600000 },
    snapshotOverlays: [".ci-run.json", "apps/cli/test/sucafina-proof-verification.test.ts", "apps/cli/test/sf613-preview-e13-observation.test.ts", "apps/cli/test/fixture/sf613-preview-e13-observation.ts"],
  } }) + "\n")
  yield* runCommand("fetch source parent", "git", [
    "fetch", "--no-tags", "--depth=3", "origin", process.env.GITHUB_SHA!,
  ], repository, 60_000)
  const head = yield* runCommand("snapshot identity", "git", ["rev-parse", "HEAD"], repository, 30_000)
  const snapshot = process.env.GITHUB_SHA
  if (typeof snapshot !== "string") throw new Error("The Actions snapshot SHA is required")
  expect(head.trim()).toBe(snapshot)
  const candidate = yield* runCommand("source identity", "git", [
    "show", "-s", "--format=%H%n%T%n%P", "HEAD^",
  ], repository, 30_000)
  expect(candidate.trim().split("\n")).toEqual([source, sourceTree, sourceBase])
  const sourceFiles = [
    ["modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts","1017609000bdbdb39fc0510b045dc6dfde371faf"],
    ["modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts","b7de9404461591ce0162d496ec917a47fb72a479"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/current-choice-readonly.test.ts","8b01895b0f3b1623646d14a82adb66bf13ca841b"],
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
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/captured-context-identity.test.ts","0b9b7b786ab1c327104f25b9945aa79e9b857c03"],
    ["apps/cli/test/fixture/sucafina-captured-context-loading.ts","ecd3af6b2d0b5a41a58959855e7e93bc09522c39"],
    ["apps/cli/test/fixture/sucafina-captured-context-lazy.ts","b82b6f8471d9c7a6aa8dc776cec38d82fe27fc56"],
    ["modules/sucafina/Sucafinav1/runtime/preview-progress-e13-diagnostic.ts","470bf3d86370e145ae5b0f54dc8bc5eff01d20d0"],
    ["apps/cli/src/sucafina-product/portfolio-http.ts","138cd8c8a09ac36549ae503f457f81dd0ee95f12"],
    ["modules/sucafina/Sucafinav1/product/portfolio/port.ts","dc0df7519a9a4ab57273e8695398240a13e1d12d"],
    ["modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts","729e8d1ac7ad326fa8c2d94871b03e0a28801079"],
    ["apps/cli/test/fixture/sucafina-native-installation.ts","4f50466a5a00a6e3e0f781c244ae3df6f72510f8"],
    ["packages/app-shell/e2e/sucafina/design-support/installation.ts","47e13f21e5d00fc8689123d7b87175960288b029"],
    ["apps/cli/test/sf613-preview-e13-observation.test.ts","00389741844e45cd1a507a7e07c370edcf891f93"],
    ["apps/cli/test/fixture/sf613-preview-e13-observation.ts","19d732eb4f2d46f9d769e078489ff09fc6701102"],
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
  process.stdout.write(JSON.stringify({ gate: "reviewed working blobs", source, sourceTree, sourceBase,
    snapshot, files: observed, sourceOverlayPaths: 7, sourceWorkingPins: 22, focalControlPaths: 2, expectedGroups: 8, expectedCommands: 14,
    functionalProcessesLaunched: 4, expectedTestDeclarations: 40, expectedControlReports: 10 }) + "\n")
}), 180_000)

checks.live("CurrentChoice readonly composition preserves default and unfenced routes", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  yield* runCommand("CurrentChoice readonly composition", process.execPath,
    ["test", "./test/product/wp10/integration/current-choice-readonly.test.ts"], module, 360_000)
}), 420_000)

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

checks.live("C18 whole-file captured context identity preserves canonical fallback and lazy capture", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("C18 captured context identity whole-file", process.execPath,
    ["test", "./test/product/wp10/integration/captured-context-identity.test.ts"], module, 180_000)
  expect(output).toContain("SF_C18_CAPTURE_LAZY ")
}), 240_000)

checks.live("E13 isolated causal observation preserves work and bounded Request phases", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("E13 causal observation whole-file", process.execPath,
    ["test", "./test/sf613-preview-e13-observation.test.ts"], path.join(repository, "apps/cli"), 60_000)
  expect(output).toContain("SF_E13_OBSERVATION_CONTROL ")
}), 90_000)
