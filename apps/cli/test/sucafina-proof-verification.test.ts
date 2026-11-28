// Snapshot-only E15 diagnostic verification. This driver and overlay do not qualify or belong to the #613 product candidate.
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
const source = "908dab0b3124cea5aa4015fa6a5b96128e730c77"
const sourceTree = "6b2065d3d159b0b4c3cad54f646bd109426f3b43"
const historicalCompositionBase = "4b62fa9f8ef2e29d1b0e2470045c459487b9c0cc"
const checks = testEffect(LayerNode.compile(AppProcess.node))

function requireHostedCandidate() {
  if (!/^[a-f0-9]{40}$/.test(source) || !/^[a-f0-9]{40}$/.test(sourceTree))
    throw new Error("E15 diagnostic source and tree must be bound to reviewed Git objects before execution")
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
    throw new Error("This verification requires its actual Linux GitHub Actions snapshot")
  }
  process.stdout.write(JSON.stringify({
    verification: "sf613-e15-route-persistence-diagnostic-focal", source, sourceTree,
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

checks.live("snapshot identifies the exact reviewed E15 diagnostic source and tree", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  process.stdout.write(JSON.stringify({ e15DiagnosticManifest: {
    source, sourceTree, qualification: false,
    cleanBase: "29374ab6a0f38dd9ff8848a083c61ea35dcecdfb", cleanBaseTree: "fe8221e56daf5fd7de8a79b29d2d485055b8c45a",
    diagnosticSourceDelta: { modified: 16, added: 2, includesOriginalAnalyticsRequest: true },
    sourceCodePaths: 30, focalControlPaths: 2, workingFilePins: 32,
    expectedGroups: 10, expectedCommands: 16, functionalProcessesLaunched: 6,
    staticDeclarationSites: { casesContract: 7, projection: 5, portfolioSelection: 3, scenarioLookup: 1, nativeScenarioSelection: 1, routeDiagnostic: 1 },
    expectedControlReports: 9, routeDiagnosticChildModes: 10, nameFilter: null,
    mechanism: "observe the first canonical route, exact callback links, native selection and first persistence tail; no added product authorization, selection, read or business callback",
    identityBoundary: "source and sourceTree identify the diagnostic parent; observer event source and sourceTree identify the clean S21 base; .ci-run.json is intentionally replaced in this focal snapshot",
    assertions: "five retained whole-file C21 functional controls plus one E15 observer family; actual test, assertion and subprocess totals require received footers and receipts",
    casesControlsMs: { cooperativePerTest: 12000, bunPerTest: 15000, declaredTests: 7, nominalSum: 105000, process: 120000, parent: 180000 },
    projectionControlsMs: { inheritedC14: { cooperativePerTest: 110000, bunPerTest: 120000, selectedTests: 2 }, inheritedC15: { cooperativePerTest: 18000, bunPerTest: 20000, selectedTests: 2 }, retainedC16: { cooperativePerTest: 8000, bunPerTest: 10000, selectedTests: 1 }, selectedTests: 5, nominalSum: 290000, process: 300000, parent: 360000 },
    portfolioControlsMs: { inheritedCooperative: [12000, 12000], inheritedBun: [15000, 15000], addedCooperative: 18000, addedBun: 20000, declaredTests: 3, nominalSum: 50000, process: 120000, parent: 180000 },
    scenarioControlsMs: { cooperative: 18000, bun: 20000, declaredTests: 1, internalInvocations: 14, nominalSum: 20000, process: 45000, parent: 60000 },
    nativeScenarioControlsMs: { cooperative: 18000, bun: 20000, declaredTests: 1, nominalSum: 20000, process: 45000, parent: 60000 },
    routeDiagnosticControlsMs: { child: 3000, childKillGrace: 1000, sequentialChildren: 10, bun: 45000, declaredTests: 1, process: 60000, parent: 90000, childStdoutCap: 65536, childStderrCap: 65536, reportCap: 16384 },
    typecheckMs: { process: 240000, parent: 300000 },
    guardsMs: { defaultProcess: 180000, parent: 600000 },
    snapshotOverlays: [".ci-run.json", "apps/cli/test/sucafina-proof-verification.test.ts",
      "apps/cli/test/fixture/sucafina-preview-route-e15-diagnostic.ts", "apps/cli/test/sucafina-preview-route-e15-diagnostic.test.ts"],
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
    ["modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts","d00519c139524b8b1b2699ac40868a40f1a18d02"],
    ["modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts","3942f378f6d94f53b5622df2a459e127d410f543"],
    ["modules/sucafina/Sucafinav1/runtime/local-store.ts","637913f32c8b5489c2c90b78d309d52e2f3ee94c"],
    ["apps/cli/src/sucafina-product/planner-calculation-root.ts","244d46ee41e9ce288a7260938174a57161137bab"],
    ["modules/sucafina/Sucafinav1/product/integration/source-inventory.ts","eac8e0b28e591b7cc50ef5cb7fb1ebe768526509"],
    ["modules/sucafina/Sucafinav1/product/integration/source-projections.ts","ccc5ea87046144843e1751b1288e907974d24ca5"],
    ["modules/sucafina/Sucafinav1/product/host-binding/acl-state-authorize.ts","f183dd1049ef205c38395bda99c83efa8eddc80a"],
    ["modules/sucafina/Sucafinav1/product/integration/product-authority.ts","dc483ab92936e410f529bf5c5d2bd52fbc6ffffb"],
    ["modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts","c9a887ede73e2ebf72b4c7c25c01c2396708454a"],
    ["modules/sucafina/Sucafinav1/runtime/contract.ts","b3bcbd8e9842ce3e8f966eb7e988474e3ba3f149"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/c08-snapshot-projection.test.ts","6bef21db9129db064b018f5f0bf632306e3a16ec"],
    ["modules/sucafina/Sucafinav1/product/host-binding/captured-context-identity.ts","11661b32f4dc782558b39902c0f396145cbe8a4a"],
    ["modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts","44cff7d70fca11ca022f863d7811b9a2610186fd"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/cases-read-contract.test.ts","b6938565cb8b468a454178688ea88a4ec88da9fa"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-selection-preferences-read.test.ts","68ae48f9a039180824f5471a1de27c0ca34be088"],
    ["modules/sucafina/Sucafinav1/product/decisions/scenario-lookup.ts","cd71a9d8440cdc94cf6663928063c38449a25721"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/scenario-lookup-selection.test.ts","1c4b73e4d170a358c0065bd674817f98edd6e86f"],
    ["modules/sucafina/Sucafinav1/test/product/wp10/integration/scenario-candidates-native-projection.test.ts","b62d93080073964d7adc993c3a5c02277abab38a"],
    ["apps/cli/src/sucafina-product/portfolio-http.ts","9cbbba7a3292f22e766aad41e6066eb69ae6424a"],
    ["modules/sucafina/Sucafinav1/product/portfolio/port.ts","9267e181901f4bf9d33f85de0b223f18dbc1df17"],
    ["modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts","8d4e1583efe5611114cd495b71197c7e1bb690df"],
    ["modules/sucafina/Sucafinav1/product/portfolio/analysis.ts","90146429a3a264f4d66f5b74d1502715a58c1099"],
    ["modules/sucafina/Sucafinav1/product/portfolio/production.ts","a3f69c5d987769a2ad66685f447002bf4307b2e1"],
    ["apps/cli/test/fixture/sucafina-native-installation.ts","8df288b2386618a7961ba20c1054e466cff39c95"],
    ["packages/app-shell/e2e/sucafina/design-support/installation.ts","5989de182f65c2a6faf20218adf8b20af6dfa000"],
    ["apps/cli/src/sucafina-product/portfolio-authority.ts","ff0f95cb0edef96bda838f35712599e449d45031"],
    ["apps/cli/src/sucafina-product/finance-pair-observation.ts","2eed03d569ffe4c558cf3f737affb88899062629"],
    ["modules/sucafina/Sucafinav1/product/decisions/result-store.ts","8fce115635205bf07f2727cb3782677ee98ef482"],
    ["modules/sucafina/Sucafinav1/product/planner/persistence.ts","e0d5decb4aa4e5f94885cd11c5afbbffbd96d279"],
    ["modules/sucafina/Sucafinav1/runtime/preview-progress-e15-diagnostic.ts","19948fe790a44f66b18775c34ac3df8ffc1228a4"],
    ["apps/cli/test/fixture/sucafina-preview-route-e15-diagnostic.ts","06ad7e879bf15e4c2e1287a70f07524a618fd052"],
    ["apps/cli/test/sucafina-preview-route-e15-diagnostic.test.ts","6a5bdff45c61e1c17e31ee3d9ce43c320d30104e"],
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
    snapshot, files: observed, expectedGroups: 10, expectedCommands: 16,
    functionalProcessesLaunched: 6, sourceCodePaths: 30, focalControlPaths: 2,
    staticDeclarationSites: { casesContract: 7, projection: 5, portfolioSelection: 3, scenarioLookup: 1, nativeScenarioSelection: 1, routeDiagnostic: 1 },
    expectedControlReports: 9 }) + "\n")
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

checks.live("Native scenario candidates retain complete results and refuse changed authority", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("Native scenario candidates selection whole-file", process.execPath,
    ["test", "./test/product/wp10/integration/scenario-candidates-native-projection.test.ts"], module, 45_000)
  expect(output).toContain("SF_C21_NATIVE_SCENARIO_SELECTION ")
}), 60_000)

checks.live("E15 route controls preserve ownership, native forwarding and persistence boundaries", () => Effect.gen(function* () {
  requireHostedCandidate()
  expectSpawn(import.meta.path)
  const output = yield* runCommand("E15 route observer controls whole-file", process.execPath,
    ["test", "./test/sucafina-preview-route-e15-diagnostic.test.ts"], path.join(repository, "apps/cli"), 60_000)
  expect(output).toContain("SF_E15_ROUTE_CONTROL ")
}), 90_000)
