// Isolated subprocess controls for the original G08 process path. No installed host or authority.
import path from "node:path"
import { readdir, readlink, writeFile } from "node:fs/promises"
import { Omni } from "@orchestra/core/omni"
import { captureOriginalCommand, observeAggregateCheckout } from "../g08-installed-evidence.mjs"

const [mode, input] = process.argv.slice(2)
const before = Omni.snapshot()
const root = process.cwd()
const output = path.join(root, "capture.log")

async function exercise() {
  if (mode === "checkout") return observeAggregateCheckout(JSON.parse(input))
  if (mode === "drift") {
    const candidate = JSON.parse(input)
    const first = await observeAggregateCheckout(candidate)
    await writeFile(path.join(root, "tracked.txt"), "changed after the first observation\n")
    const second = await observeAggregateCheckout(candidate).then(
      () => ({ refused: false, reason: "" }),
      (error: unknown) => ({ refused: true, reason: String(error) }),
    )
    return { first, second }
  }
  const programs: Record<string, string> = {
    output: 'await Bun.write(Bun.stdout, "A".repeat(1048613)); await Bun.write(Bun.stderr, "B".repeat(1048619))',
    nonzero: 'await Bun.write(Bun.stdout, "before-exit\\n"); await Bun.write(Bun.stderr, "refused\\n"); process.exit(7)',
    signal: 'await Bun.write(Bun.stdout, "before-signal\\n"); process.kill(process.pid, "SIGTERM")',
    protected: 'await Bun.write(Bun.stdout, "MUST_NOT_RUN\\n")',
  }
  if (mode === "missing")
    return captureOriginalCommand(root, "capture.log", path.join(root, "absent-original-executable"), [], process.env)
  if (!Object.hasOwn(programs, mode)) throw new Error("G08_PROCESS_CONTROL_MODE_INVALID")
  return captureOriginalCommand(root, "capture.log", process.execPath, ["-e", programs[mode]], process.env)
}

async function openLogHandles() {
  const targets = await Promise.all((await readdir("/proc/self/fd")).map(async (entry) => {
    try { return await readlink("/proc/self/fd/" + entry) }
    catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null
      throw error
    }
  }))
  return targets.filter((target) => target === output).length
}
const outcome = await exercise().then(
  (value) => ({ resolved: true, value }),
  (error: unknown) => ({
    resolved: false,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null,
    originalSignalFailure: String(error).includes("Process interrupted due to receipt of signal: 'SIGTERM'"),
  }),
)
const after = Omni.snapshot()
if (!outcome.resolved) process.exitCode = 1
console.log(JSON.stringify({
  qualification: false,
  ambientMode: process.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER,
  outcome,
  omni: { spawns: after.spawns - before.spawns, delegations: after.delegations - before.delegations },
  openLogHandles: await openLogHandles(),
}))
