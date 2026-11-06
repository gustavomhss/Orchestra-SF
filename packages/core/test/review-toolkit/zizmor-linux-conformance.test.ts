import { expect } from "bun:test"
import path from "node:path"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { Effect } from "effect"
import { BackendToolkit } from "../../src/backend-toolkit"
import pinned from "../../src/backend-toolkit/packs/zizmor"
import { LayerNode } from "../../src/effect/layer-node"
import { AppProcess } from "../../src/process"
import { ReviewSarif } from "../../src/review-toolkit/sarif"
import { expectSpawn } from "../fixture/omni-expect"
import { ReviewNativeFixture } from "../fixture/review-native"
import { tmpdir } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"
import { jail } from "../lib/sandbox-host"

const it = testEffect(LayerNode.compile(LayerNode.group([AppProcess.node])))
const CLEAN = "name: CI\non: push\npermissions: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n"
const BROKEN = CLEAN.replace("      - run: echo ok", "      - uses: actions/checkout@main")
const WORKFLOW = ".github/workflows/ci.yml"
const POISON = "jobs: [deliberately invalid YAML\n"

it.live("zizmor Linux native report conformance", () => Effect.gen(function* () {
  expect(process.platform).toBe("linux")
  expect(jail, "conformance-missing: sandbox").toBeTruthy()
  expectSpawn(import.meta.path)
  const temp = yield* Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (value) => Effect.promise(() => value[Symbol.asyncDispose]()),
  )
  const root = path.join(temp.path, "project")
  const install = path.join(temp.path, "toolkit")
  yield* Effect.promise(async () => {
    await mkdir(path.join(root, ".git"), { recursive: true })
    await mkdir(path.join(root, ".github/workflows"), { recursive: true })
    await mkdir(path.join(root, "nested"), { recursive: true })
    await writeFile(path.join(root, WORKFLOW), CLEAN)
    await writeFile(path.join(root, ".github/zizmor.yml"), POISON)
    await writeFile(path.join(root, "nested/zizmor.yaml"), POISON)
  })
  const before = yield* Effect.promise(() => Promise.all([
    readFile(path.join(root, WORKFLOW), "utf8"),
    readFile(path.join(root, ".github/zizmor.yml"), "utf8"),
    readFile(path.join(root, "nested/zizmor.yaml"), "utf8"),
    readdir(root),
  ]))
  const ready = yield* BackendToolkit.ensure<string>("zizmor").pipe(
    Effect.provideService(BackendToolkit.Root, install),
    Effect.provideService(BackendToolkit.Manifest, { zizmor: pinned }),
  )
  const executable = ready.executable
  const scan = (phase: string) => Effect.gen(function* () {
    const outcome = yield* ReviewNativeFixture.run({
      executable,
      args: ["--offline", "--no-config", "--no-ignores", "--format", "sarif", "--", WORKFLOW],
      root,
    })
    // Keep bounded native evidence in the test log for both successful and failing phases.
    console.info(`[zizmor ${phase}] stdout=${outcome.stdout.data.toString("utf8")} stderr=${outcome.stderr.data.toString("utf8")} exit=${outcome.exitCode}`)
    expect(outcome.failure).toBeUndefined()
    expect(outcome.timedOut).toBe(false)
    expect(outcome.overflow).toBe(false)
    expect(outcome.memoryExceeded).toBe(false)
    expect(outcome.stdout.truncated).toBe(false)
    expect(outcome.stderr.truncated).toBe(false)
    return outcome
  })
  const version = yield* ReviewNativeFixture.run({ executable, args: ["--version"], root })
  console.info(`[zizmor version] stdout=${version.stdout.data.toString("utf8")} stderr=${version.stderr.data.toString("utf8")} exit=${version.exitCode}`)
  expect(version.exitCode).toBe(0)
  expect(version.stdout.data.toString("utf8").trim()).toBe("zizmor 1.32.0")
  const clean = yield* scan("clean")
  expect(clean.exitCode).toBe(0)
  const cleanParsed = ReviewSarif.parseSarif(clean.stdout.data.toString("utf8"), { pack: "zizmor", root })
  expect(cleanParsed).toEqual({ status: "ok", results: [], excluded: [] })
  yield* Effect.promise(() => writeFile(path.join(root, WORKFLOW), BROKEN))
  const broken = yield* scan("broken")
  // SARIF deliberately reports findings with exit 0; a plain run does not have that contract.
  expect(broken.exitCode).toBe(0)
  const parsed = ReviewSarif.parseSarif(broken.stdout.data.toString("utf8"), { pack: "zizmor", root })
  if (parsed.status !== "ok") throw new Error(`native SARIF refused: ${parsed.reason}`)
  expect(parsed.results.some((entry) => entry.rule === "unpinned-uses" && entry.path === WORKFLOW && entry.line === 8)).toBe(true)
  expect(parsed.excluded).toEqual([])
  yield* Effect.promise(async () => {
    expect(await readFile(path.join(root, WORKFLOW), "utf8")).toBe(BROKEN)
    expect(await readFile(path.join(root, ".github/zizmor.yml"), "utf8")).toBe(before[1])
    expect(await readFile(path.join(root, "nested/zizmor.yaml"), "utf8")).toBe(before[2])
    expect(await readdir(root)).toEqual(before[3])
  })
}))
