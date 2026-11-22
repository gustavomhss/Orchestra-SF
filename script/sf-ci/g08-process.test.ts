/** Process-boundary controls only: no installed host, Microsoft identity, reservation or G08 approval. */
import assert from "node:assert/strict"
import { constants } from "node:fs"
import { chmod, lstat, mkdtemp, open, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "bun:test"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Omni } from "@orchestra/core/omni"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { observeAggregateCheckout, runPrivateCommand, streamPrivateCommand } from "./g08-installed-evidence.mjs"

const budget = 30_000
async function isolated(work: (root: string) => Promise<void>) {
  assert.equal(process.platform, "linux", "These controls require the original Linux Actions runtime")
  assert.equal(process.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER, "strict")
  const root = await mkdtemp(path.join(os.tmpdir(), "sf-g08-process-"))
  await chmod(root, 0o700)
  try { await work(root) } finally { await rm(root, { recursive: true, force: true }) }
}
function counts(before: ReturnType<typeof Omni.snapshot>, expected: number) {
  const after = Omni.snapshot()
  assert.equal(after.spawns - before.spawns, expected)
  assert.equal(after.delegations - before.delegations, 0)
}
async function openReferences(file: string) {
  const names = await readdir("/proc/self/fd")
  const links = await Promise.all(names.map(async (name) => {
    try { return await readlink("/proc/self/fd/" + name) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
      throw error
    }
  }))
  return links.filter((target) => target === file).length
}
async function git(root: string, args: string[]) {
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make("git", args, {
      cwd: root, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    }), { maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
  }), LayerNode.compile(AppProcess.node))))
  assert.equal(result.exitCode, 0)
  assert.equal(result.stdoutTruncated, false)
  assert.equal(result.stderrTruncated, false)
  return result.stdout.toString("utf8").trim()
}
async function repository(root: string) {
  await git(root, ["init", "--quiet"])
  await writeFile(path.join(root, "tracked.txt"), "original\n")
  await git(root, ["add", "tracked.txt"])
  await git(root, ["-c", "user.name=G08 process control", "-c", "user.email=g08-control@example.invalid",
    "commit", "--quiet", "-m", "isolated process control"])
  return { sha: await git(root, ["rev-parse", "HEAD"]), tree: await git(root, ["rev-parse", "HEAD^{tree}"]) }
}
async function inDirectory<T>(root: string, work: () => Promise<T>) {
  const previous = process.cwd()
  process.chdir(root)
  try { return await work() } finally { process.chdir(previous) }
}

test("private command drains binary stdout beyond the old capture cap and keeps its nonzero exit", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const before = Omni.snapshot(), file = path.join(root, "stdout.log")
  const expected = Buffer.alloc(2 * 1024 * 1024 + 37)
  for (let index = 0; index < expected.length; index++) expected[index] = index % 251
  const result = await runPrivateCommand(root, "stdout.log", process.execPath, ["-e", String.raw`
    const fs = require("node:fs")
    if (process.env.SF_G08_PROCESS_CONTROL !== "exact" || process.cwd() !== process.env.SF_G08_CONTROL_CWD ||
        fs.readFileSync(0).length !== 0) process.exit(99)
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 37)
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251
    for (let offset = 0; offset < bytes.length;) offset += fs.writeSync(1, bytes, offset, bytes.length - offset)
    process.exit(7)
  `], { SF_G08_PROCESS_CONTROL: "exact", SF_G08_CONTROL_CWD: root }, root)
  assert.deepEqual(result, { exit: 7, signal: null })
  assert.deepEqual(await readFile(file), expected)
  assert.equal((await lstat(file)).mode & 0o777, 0o600)
  assert.equal(await openReferences(file), 0, "The original private log handle must be closed")
  counts(before, 1)
}), budget)

test("private command drains stderr bytes and closes the log after a successful exit", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const before = Omni.snapshot(), file = path.join(root, "stderr.log")
  const result = await runPrivateCommand(root, "stderr.log", process.execPath, ["-e",
    'require("node:fs").writeSync(2, Buffer.from([0,255,10,13,42])); process.exit(0)'], {}, root)
  assert.deepEqual(result, { exit: 0, signal: null })
  assert.deepEqual(await readFile(file), Buffer.from([0, 255, 10, 13, 42]))
  assert.equal(await openReferences(file), 0)
  counts(before, 1)
}), budget)

test("a terminal signal refuses execution after draining the original output and closing its log", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const before = Omni.snapshot(), file = path.join(root, "signal.log")
  await assert.rejects(runPrivateCommand(root, "signal.log", process.execPath, ["-e",
    'require("node:fs").writeSync(1, "BEFORE_SIGNAL\\n"); process.kill(process.pid, "SIGTERM")'], {}, root),
  (error: unknown) => error instanceof AggregateError && error.errors.length > 0)
  assert.equal(await readFile(file, "utf8"), "BEFORE_SIGNAL\n")
  assert.equal(await openReferences(file), 0)
  counts(before, 1)
}), budget)

test("a missing executable refuses execution and still closes the newly created private log", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const before = Omni.snapshot(), file = path.join(root, "missing.log")
  await assert.rejects(runPrivateCommand(root, "missing.log", path.join(root, "does-not-exist"), [], {}, root),
    /G08_PRIVATE_COMMAND_FAILED/)
  assert.equal((await readFile(file)).length, 0)
  assert.equal(await openReferences(file), 0)
  assert.equal(Omni.snapshot().delegations - before.delegations, 0)
}), budget)

test("exclusive and no-follow output opening refuses existing bytes or a link before any spawn", () => isolated(async (root) => {
  const before = Omni.snapshot(), file = path.join(root, "original.log")
  await writeFile(file, "ORIGINAL_BYTES\n", { mode: 0o600 })
  await symlink(file, path.join(root, "linked.log"))
  for (const name of ["original.log", "linked.log"])
    await assert.rejects(runPrivateCommand(root, name, process.execPath, ["-e", "process.exit(0)"], {}, root))
  assert.equal(await readFile(file, "utf8"), "ORIGINAL_BYTES\n")
  counts(before, 0)
}), budget)

test("a real failing sink interrupts the command scope and releases its live child", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const before = Omni.snapshot(), pidFile = path.join(root, "child.pid")
  const handle = await open("/dev/full", constants.O_WRONLY)
  let pid = 0
  try {
    await assert.rejects(streamPrivateCommand(handle, process.execPath, ["-e", String.raw`
      const fs = require("node:fs")
      fs.writeFileSync("child.pid", String(process.pid))
      setInterval(() => fs.writeSync(1, Buffer.alloc(4096, 65)), 10)
    `], {}, root))
    pid = Number(await readFile(pidFile, "utf8"))
    assert(Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid)
    assert.throws(() => process.kill(pid, 0), (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH",
      "The admitted process scope must stop the child before the sink rejection settles")
    counts(before, 1)
  } finally {
    await handle.close()
    // Cleanup only after the refusal assertion; it cannot turn a leaked child into a passing control.
    if (!pid) {
      try { pid = Number(await readFile(pidFile, "utf8")) } catch {}
    }
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, "SIGKILL") }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error }
    }
  }
}), budget)

test("the real checkout observer binds HEAD and tree and freshly refuses tracked drift", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const candidate = await repository(root)
  await inDirectory(root, async () => {
    const before = Omni.snapshot()
    const first = await observeAggregateCheckout(candidate)
    assert.deepEqual(first.candidate, candidate)
    assert.equal(first.trackedClean, true)
    assert.equal(typeof first.observedAt, "string")
    assert.equal(Object.hasOwn(first, "installed"), false)
    await writeFile(path.join(root, "tracked.txt"), "changed\n")
    await assert.rejects(observeAggregateCheckout(candidate), /G08_AGGREGATE_EXACT_CLEAN_CHECKOUT_REQUIRED/)
    await git(root, ["add", "tracked.txt"])
    await assert.rejects(observeAggregateCheckout(candidate), /G08_AGGREGATE_EXACT_CLEAN_CHECKOUT_REQUIRED/)
    counts(before, 10)
  })
}), budget)

test("the real checkout observer refuses another SHA or tree without accepting caller metadata", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  const candidate = await repository(root)
  await inDirectory(root, async () => {
    const before = Omni.snapshot()
    await assert.rejects(observeAggregateCheckout({ ...candidate, sha: "0".repeat(40) }),
      /G08_AGGREGATE_EXACT_CLEAN_CHECKOUT_REQUIRED/)
    await assert.rejects(observeAggregateCheckout({ ...candidate, tree: "0".repeat(40) }),
      /G08_AGGREGATE_EXACT_CLEAN_CHECKOUT_REQUIRED/)
    counts(before, 6)
  })
}), budget)

test("failed real Git observations in a directory without a repository never qualify", () => isolated(async (root) => {
  expectSpawn(import.meta.path)
  await inDirectory(root, async () => {
    const before = Omni.snapshot()
    await assert.rejects(observeAggregateCheckout({ sha: "0".repeat(40), tree: "0".repeat(40) }),
      /G08_AGGREGATE_CHECKOUT_OBSERVATION_FAILED/)
    counts(before, 3)
  })
}), budget)
