import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { chmod, lstat, mkdtemp, realpath, rm } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import { object } from "./contract.ts"
import { openLocalStore } from "./local-store.ts"

export type RecoveryConfiguration = {
  binary: string
  binarySha256: string
  configurationPath: string
  configurationSha256: string
  databasePath: string
  directory: string
}

export async function loadRecoveryConfiguration(installationDirectory: string): Promise<RecoveryConfiguration | undefined> {
  const file = join(installationDirectory, "recovery", "recovery.json")
  if (!await Bun.file(file).exists()) return undefined
  await privatePath(file, false)
  const data = object(await Bun.file(file).json())
  const directory = join(installationDirectory, "recovery")
  if (data.directory !== directory || data.databasePath !== join(installationDirectory, "business-local", "installation.sqlite") || data.configurationPath !== join(directory, "litestream.yml") || typeof data.binary !== "string" || typeof data.binarySha256 !== "string" || typeof data.configurationSha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.binarySha256) || !/^[a-f0-9]{64}$/.test(data.configurationSha256)) throw new Error("Invalid recovery installation metadata")
  return { binary: data.binary, binarySha256: data.binarySha256, configurationPath: String(data.configurationPath), configurationSha256: data.configurationSha256, databasePath: String(data.databasePath), directory }
}

/** A restored full SQLite database never replaces the live database or its authentication table.
 * Only the caller's business snapshot/blob adapter can leave this private disposable workspace. */
export async function withRecoveryPoint<T>(configuration: RecoveryConfiguration, at: string | undefined, work: (store: Awaited<ReturnType<typeof openLocalStore>>) => Promise<T>): Promise<T> {
  if (at !== undefined && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(at) || !Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now())) throw new Error("A valid past UTC recovery time is required")
  await privatePath(configuration.directory, true)
  await privatePath(configuration.configurationPath, false)
  await privatePath(configuration.binary, false, true)
  if (digest(await Bun.file(configuration.binary).bytes()) !== configuration.binarySha256 || digest(await Bun.file(configuration.configurationPath).bytes()) !== configuration.configurationSha256) throw new Error("Recovery executable or configuration changed")
  const scratch = await mkdtemp(join(configuration.directory, ".restore-"))
  const database = join(scratch, "installation.sqlite")
  const state = { store: undefined as Awaited<ReturnType<typeof openLocalStore>> | undefined }
  try {
    await runRecoveryCommand([configuration.binary, "restore", "-config", configuration.configurationPath, "-no-expand-env", ...(at ? ["-timestamp", at] : []), "-o", database, configuration.databasePath], configuration.directory)
    await chmod(database, 0o600)
    await privatePath(database, false)
    // macOS needs writable WAL sidecars even for inspection of this disposable copy.
    const inspection = new Database(database, { strict: true })
    try {
      inspection.exec("PRAGMA query_only=ON")
      const integrity = inspection.query("PRAGMA integrity_check").all()
      if (integrity.length !== 1 || Object.values(object(integrity[0]))[0] !== "ok") throw new Error("Recovered SQLite integrity check failed")
      if (!inspection.query("SELECT name FROM sqlite_master WHERE type='table' AND name='snapshots'").get() || !inspection.query("SELECT name FROM sqlite_master WHERE type='table' AND name='blobs'").get()) throw new Error("Recovered business tables are missing")
    } finally { inspection.close() }
    state.store = await openLocalStore(scratch)
    return await work(state.store)
  } finally {
    try { await state.store?.dispose() } finally { await rm(scratch, { recursive: true, force: true }) }
  }
}

export async function runRecoveryCommand(argv: string[], cwd: string, options: { timeoutMs?: number } = {}) {
  const timeout = options.timeoutMs ?? 180000
  if (!Number.isSafeInteger(timeout) || timeout < 50 || timeout > 180000) throw new Error("Invalid recovery command deadline")
  const child = Bun.spawn(argv, { cwd, env: { PATH: "/usr/bin:/bin", HOME: cwd, TMPDIR: cwd }, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  const state = { error: null as string | null, escalation: undefined as ReturnType<typeof setTimeout> | undefined }
  const stop = (reason: string) => {
    state.error ??= reason
    if (child.exitCode !== null || state.escalation) return
    child.kill("SIGTERM")
    state.escalation = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL") }, 1000)
  }
  const deadline = setTimeout(() => stop("Recovery command exceeded its deadline"), timeout)
  const read = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader()
    const size = { bytes: 0 }
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) return
        size.bytes += part.value.byteLength
        if (size.bytes > 256 * 1024) { stop("Recovery command output limit exceeded"); throw new Error("Recovery command output limit exceeded") }
      }
    } finally { reader.releaseLock() }
  }
  const readers = Promise.allSettled([read(child.stdout), read(child.stderr)])
  try {
    const exit = await child.exited
    const outputs = await readers
    if (state.error) throw new Error(state.error)
    if (outputs.some((result) => result.status === "rejected")) throw new Error("Could not inspect recovery command output")
    if (exit !== 0) throw new Error("Recovery command failed; inspect private service logs")
  } finally {
    if (child.exitCode === null) stop("Recovery command cancelled")
    await child.exited
    await readers
    clearTimeout(deadline)
    if (state.escalation) clearTimeout(state.escalation)
  }
}

function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
async function privatePath(path: string, directory: boolean, executable = false) {
  if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) throw new Error("Recovery paths must be canonical")
  const info = await lstat(path)
  if (info.isSymbolicLink() || info.uid !== process.getuid?.() || (directory ? !info.isDirectory() : !info.isFile()) || (!directory && info.nlink !== 1) || (info.mode & 0o777) !== (directory ? 0o700 : executable ? 0o755 : 0o600)) throw new Error("Recovery paths must be owned with private data permissions")
}
