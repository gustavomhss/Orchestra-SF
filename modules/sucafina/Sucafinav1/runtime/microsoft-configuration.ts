import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import path from "node:path"
import { isIP } from "node:net"
import type { LocalConfiguration } from "./local-configuration.ts"
import { microsoftPolicy, microsoftUuid, record } from "./microsoft-policy.ts"

export type MicrosoftConfiguration = LocalConfiguration & {
  deployment: "azure-https"
  authentication: "microsoft"
  tenantId: string
  clientId: string
  listenerOrigin: string
  ingressOrigin: string
  workspaceDirectory: string
  grants: ReturnType<typeof microsoftPolicy>["grants"]
  sessionSeconds: number
  loginSeconds: number
}

/** Loads no tenant defaults and no operator fallback. Secret values stay in private server closures. */
export async function loadMicrosoftConfiguration(file: string) {
  if (!path.isAbsolute(file) || path.resolve(file) !== file) throw new Error("Explicit canonical Microsoft configuration path required")
  const directory = path.dirname(file)
  await privateDirectory(directory)
  const value = privateJson((await privateBytes(file, 262144)).toString("utf8"))
  const config = validateMicrosoftConfiguration(value)
  await privateDirectory(config.workspaceDirectory)
  if (within(directory, config.workspaceDirectory) || within(config.workspaceDirectory, directory)) throw new Error("Microsoft credentials must be outside the agent workspace")
  const keys = await Promise.all(["session", "bank", "assets"].map(async (name) => {
    const bytes = await privateBytes(path.join(directory, `${name}.key`), 32)
    if (bytes.byteLength !== 32) throw new Error("Invalid Microsoft installation key")
    return new Uint8Array(bytes)
  }))
  if (new Set(keys.map((key) => Buffer.from(key).toString("hex"))).size !== keys.length) throw new Error("Independent Microsoft installation keys required")
  const clientSecret = async () => {
    const secret = (await privateBytes(path.join(directory, "client-secret.txt"), 4098)).toString("utf8").replace(/\r?\n$/, "")
    if (!secret || secret.length > 4096 || !/^[\x21-\x7e]+$/.test(secret)) throw new Error("Private Microsoft client credential unavailable")
    return secret
  }
  // Validate availability before any business database opens; retain only the reader.
  await clientSecret()
  return { config, directory, keys: { session: keys[0], bank: keys[1], assets: keys[2] }, clientSecret }
}

export function validateMicrosoftConfiguration(value: unknown): MicrosoftConfiguration {
  if (!record(value) || value.version !== 1 || value.deployment !== "azure-https" || value.authentication !== "microsoft" || Object.keys(value).some((key) => !["version", "deployment", "authentication", "origin", "listenerOrigin", "ingressOrigin", "mount", "tenantId", "clientId", "groups", "grants", "workspaceDirectory", "scanner", "sessionSeconds", "loginSeconds"].includes(key))) throw new Error("Explicit Microsoft HTTPS configuration required")
  if (typeof value.origin !== "string" || !URL.canParse(value.origin)) throw new Error("Microsoft HTTPS public origin required")
  const origin = new URL(value.origin)
  if (origin.origin !== value.origin || origin.protocol !== "https:" || origin.port || isIP(origin.hostname) || origin.hostname.startsWith("[") || !origin.hostname.includes(".") || origin.hostname.endsWith(".") || origin.hostname.endsWith(".localhost") || origin.hostname.endsWith(".local") || origin.hostname.includes("..")) throw new Error("Microsoft HTTPS public origin required")
  for (const key of ["listenerOrigin", "ingressOrigin"] as const) {
    if (typeof value[key] !== "string" || !URL.canParse(value[key])) throw new Error("Explicit Microsoft proxy origin required")
    const url = new URL(value[key])
    if (url.origin !== value[key] || url.protocol !== "http:" || !url.hostname) throw new Error("Explicit Microsoft HTTP proxy origin required")
  }
  if (typeof value.mount !== "string" || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value.mount)) throw new Error("Invalid Microsoft mount")
  if (typeof value.tenantId !== "string" || !microsoftUuid.test(value.tenantId) || typeof value.clientId !== "string" || !microsoftUuid.test(value.clientId)) throw new Error("Microsoft resource tenant and client IDs required")
  if (typeof value.workspaceDirectory !== "string" || !path.isAbsolute(value.workspaceDirectory) || path.resolve(value.workspaceDirectory) !== value.workspaceDirectory) throw new Error("Separate canonical Microsoft agent workspace required")
  if (!("scanner" in value) || (value.scanner !== null && (!record(value.scanner) || value.scanner.host !== "127.0.0.1" || typeof value.scanner.port !== "number" || !Number.isInteger(value.scanner.port) || value.scanner.port < 1 || value.scanner.port > 65535 || Object.keys(value.scanner).some((key) => !["host", "port"].includes(key))))) throw new Error("Invalid Microsoft scanner configuration")
  const sessionSeconds = value.sessionSeconds ?? 28800
  const loginSeconds = value.loginSeconds ?? 600
  if (typeof sessionSeconds !== "number" || !Number.isSafeInteger(sessionSeconds) || sessionSeconds < 60 || sessionSeconds > 28800 || typeof loginSeconds !== "number" || !Number.isSafeInteger(loginSeconds) || loginSeconds < 30 || loginSeconds > 600) throw new Error("Invalid Microsoft session lifetime")
  const policy = microsoftPolicy(value)
  return Object.freeze({ version: 1, deployment: "azure-https", authentication: "microsoft", origin: value.origin, listenerOrigin: value.listenerOrigin as string, ingressOrigin: value.ingressOrigin as string, mount: value.mount, tenantId: value.tenantId.toLowerCase(), clientId: value.clientId.toLowerCase(), groups: policy.groups, grants: policy.grants, workspaceDirectory: value.workspaceDirectory, scanner: value.scanner === null ? null : Object.freeze({ host: "127.0.0.1", port: (value.scanner as { port: number }).port }), sessionSeconds, loginSeconds })
}

/** Persist the namespace before opening cloud data. Reusing a directory for another tenant/app is rejected. */
export async function bindMicrosoftInstallation(directory: string, config: MicrosoftConfiguration) {
  const file = path.join(directory, "microsoft-identity.json")
  const binding = { version: 1, tenantId: config.tenantId, clientId: config.clientId }
  const existing = await lstat(file).catch((error: unknown) => { if (hasCode(error, "ENOENT")) return undefined; throw error })
  if (!existing) {
    if (await lstat(path.join(directory, "business-microsoft")).catch((error: unknown) => { if (hasCode(error, "ENOENT")) return undefined; throw error })) throw new Error("Unbound Microsoft business directory cannot be adopted")
    const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600).catch((error: unknown) => { if (hasCode(error, "EEXIST")) return undefined; throw error })
    if (handle) {
      try { await handle.writeFile(`${JSON.stringify(binding)}\n`); await handle.sync() }
      finally { await handle.close() }
    }
  }
  const stored = privateJson((await privateBytes(file, 4096)).toString("utf8"))
  if (!record(stored) || Object.keys(stored).length !== 3 || stored.version !== 1 || stored.tenantId !== config.tenantId || stored.clientId !== config.clientId) throw new Error("Microsoft installation identity cannot change")
}

async function privateDirectory(directory: string) {
  const metadata = await lstat(directory)
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || process.getuid?.() !== metadata.uid || (metadata.mode & 0o077) !== 0 || await realpath(directory) !== directory) throw new Error("Private owner-only Microsoft directory required")
}

async function privateBytes(file: string, maximum: number) {
  if (await realpath(path.dirname(file)) !== path.dirname(file)) throw new Error("Private Microsoft file path required")
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const metadata = await handle.stat()
    if (!metadata.isFile() || process.getuid?.() !== metadata.uid || (metadata.mode & 0o077) !== 0 || metadata.nlink !== 1 || metadata.size < 1 || metadata.size > maximum) throw new Error("Private owner-only Microsoft file required")
    const bytes = await handle.readFile()
    if (bytes.byteLength > maximum) throw new Error("Microsoft private file exceeds limit")
    return bytes
  } finally { await handle.close() }
}

function within(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function hasCode(value: unknown, code: string) {
  return value instanceof Error && "code" in value && value.code === code
}

function privateJson(value: string): unknown {
  try { return JSON.parse(value) }
  catch { throw new Error("Invalid private Microsoft configuration JSON") }
}
