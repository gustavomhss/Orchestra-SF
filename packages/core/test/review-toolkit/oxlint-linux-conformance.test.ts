import { expect } from "bun:test"
import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { Effect } from "effect"
import { BackendToolkit } from "../../src/backend-toolkit"
import pinned from "../../src/backend-toolkit/packs/oxlint"
import { LayerNode } from "../../src/effect/layer-node"
import { AppProcess } from "../../src/process"
import { ReviewSarif } from "../../src/review-toolkit/sarif"
import { expectSpawn } from "../fixture/omni-expect"
import { ReviewNativeFixture } from "../fixture/review-native"
import { tmpdir } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"
import { jail } from "../lib/sandbox-host"

const it = testEffect(LayerNode.compile(LayerNode.group([AppProcess.node])))
const fixture = Effect.acquireRelease(Effect.promise(async () => {
  const temp = await tmpdir()
  const root = path.join(temp.path, "oxlint review root")
  await mkdir(path.join(root, ".git"), { recursive: true })
  await mkdir(path.join(root, ".host"), { recursive: true })
  await mkdir(path.join(root, "nested"), { recursive: true })
  await writeFile(path.join(root, ".oxlintrc.json"), "{")
  await writeFile(path.join(root, "nested", ".oxlintrc.json"), "{")
  await writeFile(path.join(root, ".host", "oxlint.json"), JSON.stringify({ rules: { "no-debugger": "error" } }))
  await writeFile(path.join(root, "clean.js"), "const answer = 42;\nconsole.log(answer);\n")
  await writeFile(path.join(root, "broken.js"), "debugger;\n")
  return { temp, root, install: path.join(temp.path, "toolkit") }
}), (value) => Effect.promise(() => value.temp[Symbol.asyncDispose]()))

it.live("pinned oxlint native conformance requires Linux confinement", () => Effect.sync(() => {
  expect(process.platform).toBe("linux")
  expect(jail, "conformance-missing: sandbox").toBeTruthy()
}))

it.live("pinned oxlint emits bounded SARIF findings under explicit host config", () => Effect.gen(function* () {
  expect(process.platform).toBe("linux")
  expect(jail, "conformance-missing: sandbox").toBeTruthy()
  expectSpawn(import.meta.path)
  const f = yield* fixture
  const provision = (effect: ReturnType<typeof BackendToolkit.ensure<string>>) => effect.pipe(
    Effect.provideService(BackendToolkit.Root, f.install),
    Effect.provideService(BackendToolkit.Manifest, { oxlint: pinned }),
  )
  const installed = yield* provision(BackendToolkit.ensure<string>("oxlint"))
  const run = (phase: string, args: string[]) => Effect.gen(function* () {
    const result = yield* ReviewNativeFixture.run({ executable: installed.executable, args, root: f.root })
    console.log(`oxlint native ${phase}: ${JSON.stringify({ exitCode: result.exitCode, stdout: result.stdout.data.toString("base64"), stderr: result.stderr.data.toString("base64") })}`)
    return result
  })
  const version = yield* run("version", ["--version"])
  expect(version.exitCode).toBe(0)
  expect(version.stdout.data.toString("utf8").trim().split(/\s+/)).toContain("1.91.0")
  const common = ["--config", path.join(f.root, ".host", "oxlint.json"), "--disable-nested-config", "--no-ignore", "--format", "sarif", "--"]
  const clean = yield* run("clean", [...common, path.join(f.root, "clean.js")])
  expect(clean.exitCode).toBe(0)
  const cleanParsed = ReviewSarif.parseSarif(clean.stdout.data.toString("utf8"), { pack: "oxlint", root: f.root })
  expect(cleanParsed).toMatchObject({ status: "ok", results: [] })
  const broken = yield* run("broken", [...common, path.join(f.root, "broken.js")])
  expect(broken.exitCode).toBe(1)
  const parsed = ReviewSarif.parseSarif(broken.stdout.data.toString("utf8"), { pack: "oxlint", root: f.root })
  expect(parsed).toMatchObject({ status: "ok", results: [{ rule: "eslint/no-debugger", path: "broken.js", line: 1 }] })
  expect((yield* Effect.promise(() => readdir(path.join(f.root, "nested")))).sort()).toEqual([".oxlintrc.json"])
  expect(yield* Effect.promise(() => readFile(path.join(f.root, ".host", "oxlint.json"), "utf8"))).toBe(JSON.stringify({ rules: { "no-debugger": "error" } }))
}), 180_000)
