import { randomBytes } from "node:crypto"
import { lstat, mkdir, open, realpath } from "node:fs/promises"
import path from "node:path"
import { emptyMap } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"

export type LocalConfiguration = {
  version: 1
  origin: string
  mount: string
  tenantId: string | null
  clientId: string | null
  groups: Record<Surface, Record<string, string>>
  authentication?: "microsoft" | "local-operator"
  localOperator?: { installationId: string; uid: number; buyer?: boolean }
  scanner: { host: "127.0.0.1"; port: number } | null
}

export async function prepareLocalConfiguration(directory: string) {
  if (!path.isAbsolute(directory)) throw new Error("Absolute private installation directory required")
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await requirePrivate(directory, true)
  const file = path.join(directory, "installation.json")
  const config: LocalConfiguration = { version: 1, origin: "http://localhost:4110", mount: "/sucafina", tenantId: null, clientId: null, groups: { dashboard: {}, planner: {}, procurement: {} }, scanner: null }
  for (const name of ["session", "bank", "assets"]) await createPrivate(path.join(directory, `${name}.key`), randomBytes(32))
  await createPrivate(path.join(directory, "host-credential.key"), Buffer.from(randomBytes(32).toString("base64")))
  await createPrivate(file, Buffer.from(`${JSON.stringify(config, null, 2)}\n`))
  for (const name of ["host-data", "host-config", "host-cache", "host-state", "host-tmp", "business"]) {
    await mkdir(path.join(directory, name), { mode: 0o700 })
      .catch((error: unknown) => { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error })
    await requirePrivate(path.join(directory, name), true)
  }
  return file
}

export async function loadLocalConfiguration(file: string) {
  if (!path.isAbsolute(file)) throw new Error("Explicit absolute local configuration required")
  const directory = path.dirname(file)
  await requirePrivate(directory, true)
  await requirePrivate(file, false)
  const value: unknown = await Bun.file(file).json()
  if (value === null || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("origin" in value) || typeof value.origin !== "string" || !("mount" in value) || typeof value.mount !== "string") throw new Error("Invalid installation configuration")
  const origin = new URL(value.origin)
  if (value.origin !== origin.origin || origin.protocol !== "http:" || origin.hostname !== "localhost" || origin.port !== "4110" || !/^\/[A-Za-z0-9_-]+$/.test(value.mount)) throw new Error("Fixed localhost installation origin required")
  const record = value as Record<string, unknown>
  if (record.authentication !== undefined && record.authentication !== "microsoft" && record.authentication !== "local-operator") throw new Error("Invalid authentication profile")
  if (record.authentication === "local-operator") {
    requireLocalOperator(record.localOperator)
  }
  for (const name of ["tenantId", "clientId"] as const) if (!(name in record) || (record[name] !== null && (typeof record[name] !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record[name] as string)))) throw new Error("Entra public application identifiers required")
  if (!("groups" in value) || !value.groups || typeof value.groups !== "object") throw new Error("Invalid role groups")
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    if (!(surface in value.groups)) throw new Error("Missing surface groups")
    const groups: unknown = value.groups[surface as keyof typeof value.groups]
    if (!groups || typeof groups !== "object" || Array.isArray(groups) || Object.entries(groups).some(([role, group]) => !emptyMap().some((row) => row.surface === surface && row.role === role) || typeof group !== "string" || !group.trim())) throw new Error("Invalid configured group")
  }
  if (!("scanner" in value) || (value.scanner !== null && (typeof value.scanner !== "object" || !("host" in value.scanner) || value.scanner.host !== "127.0.0.1" || !("port" in value.scanner) || typeof value.scanner.port !== "number" || !Number.isInteger(value.scanner.port) || value.scanner.port < 1 || value.scanner.port > 65535 || value.scanner.port === 4110))) throw new Error("Invalid local scanner")
  const keys = await Promise.all(["session", "bank", "assets"].map(async (name) => {
    const keyFile = path.join(directory, `${name}.key`)
    await requirePrivate(keyFile, false)
    const bytes = new Uint8Array(await Bun.file(keyFile).arrayBuffer())
    if (bytes.length !== 32) throw new Error("Invalid installation key")
    return bytes
  }))
  if (new Set(keys.map((key) => Buffer.from(key).toString("hex"))).size !== keys.length) throw new Error("Independent installation keys required")
  return { config: value as LocalConfiguration, directory, keys: { session: keys[0], bank: keys[1], assets: keys[2] } }
}

/** Check before the host's migration, not after opening its database. */
export async function requireLocalIsolation(directory: string, environment: Readonly<Record<string, string | undefined>> = process.env) {
  if (environment.ORCHESTRA_DB !== path.join(directory, "host-data", "orchestra.db")) throw new Error("Dedicated host database required before installation startup")
  if (environment.ORCHESTRA_INHERIT_CREDENTIALS !== "0" || environment.ORCHESTRA_CONFIG_DIR !== path.join(directory, "host-config") || environment.ORCHESTRA_CREDENTIAL_KEY_FILE !== path.join(directory, "host-credential.key") || environment.TMPDIR !== path.join(directory, "host-tmp")) throw new Error("Dedicated host configuration and credential scope required")
  await requirePrivate(path.join(directory, "host-tmp"), true)
  await requirePrivate(path.join(directory, "host-credential.key"), false)
  for (const [variable, name] of [["XDG_DATA_HOME", "host-data"], ["XDG_CONFIG_HOME", "host-config"], ["XDG_CACHE_HOME", "host-cache"], ["XDG_STATE_HOME", "host-state"]]) {
    if (environment[variable] !== path.join(directory, name)) throw new Error("Isolated child environment required")
    await requirePrivate(path.join(directory, name), true)
  }
}
async function requirePrivate(file: string, directory: boolean) {
  const metadata = await lstat(file)
  if (metadata.isSymbolicLink() || (directory ? !metadata.isDirectory() : !metadata.isFile()) || (metadata.mode & 0o077) !== 0 || (process.getuid && metadata.uid !== process.getuid()) || await realpath(file) !== path.resolve(file)) throw new Error("Private owner-only installation path required")
}
async function createPrivate(file: string, bytes: Uint8Array) {
  const handle = await open(file, "wx", 0o600).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return undefined
    throw error
  })
  if (!handle) { await requirePrivate(file, false); return }
  await handle.writeFile(bytes).finally(() => handle.close())
}


export function requireLocalOperator(value: unknown): { installationId: string; uid: number; buyer?: boolean } {
  if (!value || typeof value !== "object" || !("installationId" in value) || typeof value.installationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.installationId) || !("uid" in value) || typeof value.uid !== "number" || !Number.isSafeInteger(value.uid) || value.uid < 0 || value.uid !== process.getuid?.()) throw new Error("Local operator must be the actual installation owner")
  if ("buyer" in value && typeof value.buyer !== "boolean") throw new Error("Explicit boolean local buyer policy required")
  return { installationId: value.installationId, uid: value.uid, ...("buyer" in value ? { buyer: value.buyer as boolean } : {}) }
}
