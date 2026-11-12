import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { lstat, mkdir, open, realpath } from "node:fs/promises"
import { userInfo } from "node:os"
import { join } from "node:path"
import { buildRecoveryPlan } from "./recovery-plan.ts"
import { loadRecoveryConfiguration } from "../runtime/local-recovery.ts"
import { loadLocalConfiguration } from "../runtime/local-configuration.ts"

async function command() {
  const [mode, file, binary] = process.argv.slice(2)
  if (!["--prepare", "--activate", "--ensure"].includes(mode ?? "") || !file || !binary || process.argv.length !== 5) throw new Error("Usage: recovery-service.ts --prepare|--activate|--ensure /absolute/private/installation.json /absolute/private/tools/litestream/litestream")
  const loaded = await loadLocalConfiguration(file)
  const owner = userInfo()
  if (loaded.config.authentication !== "local-operator" || loaded.config.localOperator?.uid !== owner.uid) throw new Error("Actual-owner local installation required")
  if (binary !== join(loaded.directory, "tools", "litestream", "litestream")) throw new Error("Dedicated installation recovery executable required")
  await checked(binary, 0o755)
  if (mode === "--ensure" && !await loadRecoveryConfiguration(loaded.directory)) throw new Error("Reviewed recovery metadata is required")
  const plan = buildRecoveryPlan({ installationDirectory: loaded.directory, binary, home: owner.homedir, uid: owner.uid, installationId: loaded.config.localOperator.installationId })
  const directory = join(loaded.directory, "recovery")
  await mkdir(directory, { mode: 0o700 }).catch((error: unknown) => { if (!exists(error)) throw error })
  await checked(directory, 0o700, true)
  await writeExclusive(plan.configurationPath, plan.configuration)
  const metadata = {
    directory, binary, binarySha256: hash(await Bun.file(binary).bytes()),
    configurationPath: plan.configurationPath, configurationSha256: hash(new TextEncoder().encode(plan.configuration)),
    databasePath: plan.databasePath, label: plan.label, plistPath: plan.plistPath, uid: owner.uid,
  }
  await writeExclusive(join(directory, "recovery.json"), JSON.stringify(metadata, null, 2) + "\n")
  await writeExclusive(join(directory, `${plan.label}.plist`), plan.plist)
  if (mode === "--prepare") { console.info("Recovery plan prepared; review the private configuration before activation."); return }
  if (process.platform !== "darwin") throw new Error("Recovery LaunchAgent activation requires macOS")
  const launchAgents = join(owner.homedir, "Library", "LaunchAgents")
  const parent = await lstat(launchAgents)
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== owner.uid || await realpath(launchAgents) !== launchAgents) throw new Error("Owned canonical LaunchAgents directory required")
  await writeExclusive(plan.plistPath, plan.plist)
  const environment = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: owner.homedir }
  const existing = Bun.spawnSync(["/bin/launchctl", "print", `gui/${owner.uid}/${plan.label}`], { env: environment, timeout: 5000 })
  if (existing.exitCode === 0) {
    if (mode !== "--ensure") throw new Error("Recovery label already loaded; verify the existing service rather than replacing it")
    const state = new TextDecoder().decode(existing.stdout)
    const actual = state.match(/\n\s*arguments = \{([\s\S]*?)\n\s*\}/)?.[1].split("\n").map((line) => line.trim()).filter(Boolean)
    const expected = [binary, "replicate", "-config", plan.configurationPath, "-no-expand-env"]
    if (state.split("\n").find((line) => line.trim().startsWith("program = "))?.trim() !== `program = ${binary}` || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Loaded recovery service differs from the reviewed plan")
    console.info("Reviewed recovery service is loaded.")
    return
  }
  const started = Bun.spawnSync(["/bin/launchctl", "bootstrap", `gui/${owner.uid}`, plan.plistPath], { env: environment, timeout: 10000 })
  if (started.exitCode !== 0) throw new Error("Recovery LaunchAgent activation failed; inspect the private service logs")
  console.info("Recovery LaunchAgent activated. Qualify a replica restore before declaring recovery ready.")
}

function hash(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
function exists(error: unknown) { return error !== null && typeof error === "object" && "code" in error && error.code === "EEXIST" }
async function checked(file: string, mode: number, directory = false) {
  const info = await lstat(file)
  if (await realpath(file) !== file || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o777) !== mode || (directory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) throw new Error("Owned canonical recovery path with reviewed permissions required")
}
async function writeExclusive(file: string, content: string) {
  const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600).catch(async (error: unknown) => {
    if (!exists(error)) throw error
    await checked(file, 0o600)
    if (await Bun.file(file).text() !== content) throw new Error("Refusing to replace an existing recovery installation file")
    return undefined
  })
  if (handle) { try { await handle.writeFile(content); await handle.sync() } finally { await handle.close() } }
  await checked(file, 0o600)
}
if (import.meta.main) await command()
