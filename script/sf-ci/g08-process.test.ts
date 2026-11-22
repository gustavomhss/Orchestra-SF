// Real subprocess and byte controls; they do not execute any installed G08 group.
import { test, expect } from "bun:test"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises"
import { AppProcess } from "../../packages/core/src/process.ts"
import { LayerNode } from "../../packages/core/src/effect/layer-node.ts"
import { expectSpawn } from "../../packages/core/test/fixture/omni-expect.ts"

const require = createRequire(new URL("../../packages/core/package.json", import.meta.url))
const { Effect } = await import(pathToFileURL(require.resolve("effect")).href)
const { ChildProcess } = await import(pathToFileURL(require.resolve("effect/unstable/process")).href)

const fixture = path.join(import.meta.dir, "fixtures/g08-process-child.ts")
const layer = LayerNode.compile(AppProcess.node)

async function command(executable: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  return Effect.runPromise(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(executable, args, {
      cwd, env, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "5 seconds",
    }), { timeout: 30_000, maxOutputBytes: 1_048_576, maxErrorBytes: 1_048_576 })
  }).pipe(Effect.provide(layer)))
}
async function scratch(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "g08-process-"))
  try { await run(root) }
  finally { await rm(root, { recursive: true, force: true }) }
}
async function candidate(root: string) {
  await writeFile(path.join(root, "tracked.txt"), "original\n")
  for (const args of [
    ["init", "--quiet"],
    ["add", "--", "tracked.txt"],
    ["-c", "user.name=G08 control", "-c", "user.email=g08@example.invalid", "commit", "--quiet", "-m", "control"],
  ]) expect((await command("git", args, root)).exitCode).toBe(0)
  const sha = await command("git", ["rev-parse", "HEAD"], root)
  const tree = await command("git", ["rev-parse", "HEAD^{tree}"], root)
  expect(sha.exitCode).toBe(0); expect(tree.exitCode).toBe(0)
  expect(sha.stdoutTruncated || tree.stdoutTruncated).toBe(false)
  return { sha: sha.stdout.toString("utf8").trim(), tree: tree.stdout.toString("utf8").trim() }
}
async function control(root: string, mode: string, input = "") {
  // The child must select strict Omni locally even when its ambient rollback flag is off.
  const result = await command(process.execPath, [fixture, mode, input], root, {
    ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "0",
  })
  expect(result.stdoutTruncated || result.stderrTruncated).toBe(false)
  const receipt = JSON.parse(result.stdout.toString("utf8"))
  expect(receipt.qualification).toBe(false)
  expect(receipt.ambientMode).toBe("0")
  expect(receipt.omni.delegations).toBe(0)
  expect(receipt.openLogHandles).toBe(0)
  return { result, receipt }
}

test("G08 observes the actual Git HEAD tree and clean checkout through three own strict Omni spawns", async () => {
  expectSpawn(import.meta.path)
  await scratch(async (root) => {
    const actual = await candidate(root)
    const { result, receipt } = await control(root, "checkout", JSON.stringify(actual))
    expect(result.exitCode).toBe(0)
    expect(receipt.outcome.resolved).toBe(true)
    expect(receipt.outcome.value.candidate).toEqual(actual)
    expect(receipt.outcome.value.trackedClean).toBe(true)
    expect(Number.isFinite(Date.parse(receipt.outcome.value.observedAt))).toBe(true)
    expect(receipt.omni.spawns).toBe(3)
  })
})
test("G08 re-observes tracked drift in the same process after its original clean observation", async () => {
  expectSpawn(import.meta.path)
  await scratch(async (root) => {
    const actual = await candidate(root)
    const { result, receipt } = await control(root, "drift", JSON.stringify(actual))
    expect(result.exitCode).toBe(0)
    expect(receipt.outcome.resolved).toBe(true)
    expect(receipt.outcome.value.first.candidate).toEqual(actual)
    expect(receipt.outcome.value.second.refused).toBe(true)
    expect(receipt.outcome.value.second.reason).toContain("G08_AGGREGATE_EXACT_CLEAN_CHECKOUT_REQUIRED")
    expect(receipt.omni.spawns).toBe(6)
  })
})
test("G08 streams all original stdout and stderr bytes to a private closed file beyond capture limits", async () => {
  expectSpawn(import.meta.path)
  await scratch(async (root) => {
    const { result, receipt } = await control(root, "output")
    expect(result.exitCode).toBe(0)
    expect(receipt.outcome).toEqual({ resolved: true, value: { exit: 0, signal: null } })
    expect(receipt.omni.spawns).toBe(1)
    const bytes = await readFile(path.join(root, "capture.log"))
    expect(bytes.byteLength).toBe(1_048_613 + 1_048_619)
    expect(bytes.filter((byte) => byte === 65).length).toBe(1_048_613)
    expect(bytes.filter((byte) => byte === 66).length).toBe(1_048_619)
    expect((await stat(path.join(root, "capture.log"))).mode & 0o777).toBe(0o600)
  })
})
for (const mode of ["nonzero", "signal", "missing"]) {
  test("G08 preserves the original " + mode + " failure and closes its private log without a positive result", async () => {
    expectSpawn(import.meta.path)
    await scratch(async (root) => {
      const { result, receipt } = await control(root, mode)
      const bytes = await readFile(path.join(root, "capture.log"))
      expect((await stat(path.join(root, "capture.log"))).mode & 0o777).toBe(0o600)
      if (mode === "nonzero") {
        expect(result.exitCode).toBe(0)
        expect(receipt.outcome).toEqual({ resolved: true, value: { exit: 7, signal: null } })
        expect(receipt.omni.spawns).toBe(1)
        expect(bytes.toString("utf8")).toContain("before-exit\n")
        expect(bytes.toString("utf8")).toContain("refused\n")
        return
      }
      expect(result.exitCode).not.toBe(0)
      expect(receipt.outcome.resolved).toBe(false)
      if (mode === "signal") {
        expect(receipt.omni.spawns).toBe(1)
        console.log(JSON.stringify({ control: "G08_ORIGINAL_SIGNAL_CAUSE", observed: receipt.outcome.originalProcessFailure }))
        expect(receipt.outcome.originalProcessFailure).toEqual({
          tag: "PlatformError", reasonTag: "Unknown", module: "ChildProcess", method: "exitCode",
          pathOrDescriptor: process.execPath + ' -e await Bun.write(Bun.stdout, "before-signal\\n"); process.kill(process.pid, "SIGTERM")',
          causeName: "Error", causeMessage: "Process interrupted due to receipt of signal: 'SIGTERM'", sameCause: true,
        })
        expect(bytes.toString("utf8")).toBe("before-signal\n")
        return
      }
      expect(bytes.byteLength).toBe(0)
    })
  })
}
for (const existing of ["file", "symlink"]) {
  test("G08 refuses a pre-existing " + existing + " before spawning and preserves its original bytes", async () => {
    expectSpawn(import.meta.path)
    await scratch(async (root) => {
      const target = path.join(root, existing === "file" ? "capture.log" : "retained.txt")
      await writeFile(target, "retained original\n")
      if (existing === "symlink") await symlink("retained.txt", path.join(root, "capture.log"))
      const { result, receipt } = await control(root, "protected")
      expect(result.exitCode).not.toBe(0)
      expect(receipt.outcome.resolved).toBe(false)
      expect(receipt.outcome.errorCode).toBe("EEXIST")
      expect(receipt.omni.spawns).toBe(0)
      expect(await readFile(target, "utf8")).toBe("retained original\n")
    })
  })
}
