import { randomUUID, timingSafeEqual } from "node:crypto"
import { constants } from "node:fs"
import { link, lstat, open, realpath, unlink } from "node:fs/promises"
import path from "node:path"
import { isIP } from "node:net"
import type { LocalConfiguration } from "./local-configuration.ts"
import { emptyMap } from "../src/identity.ts"

const microsoftUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type MicrosoftConfiguration = LocalConfiguration & {
  deployment: "azure-https"
  authentication: "microsoft"
  tenantId: string
  clientId: string
  teams?: "direct"
  supremeAdminGroupId?: string
  /** Opaque grant envelopes for the product policy to validate. */
  grants: readonly Readonly<Record<string, unknown> & { principalRef: string }>[]
  listenerOrigin: string
  ingressOrigin: string
  workspaceDirectory: string
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

/** Use the owner-only proxy credential without exposing it to installation handlers. */
export async function loadMicrosoftIngressAuthorizer(directory: string) {
  const proof = (await privateBytes(path.join(directory, "ingress-secret.txt"), 66)).toString("utf8").replace(/\r?\n$/, "")
  if (!/^[a-f0-9]{64}$/.test(proof)) throw new Error("Invalid Microsoft ingress credential")
  const expected = Buffer.from(proof, "hex")
  return (received: string | undefined) => typeof received === "string" && /^[a-f0-9]{64}$/.test(received) &&
    timingSafeEqual(expected, Buffer.from(received, "hex"))
}

export function validateMicrosoftConfiguration(value: unknown): MicrosoftConfiguration {
  if (!record(value) || value.version !== 1 || value.deployment !== "azure-https" || value.authentication !== "microsoft" || Object.keys(value).some((key) => !["version", "deployment", "authentication", "origin", "listenerOrigin", "ingressOrigin", "mount", "tenantId", "clientId", "teams", "supremeAdminGroupId", "groups", "grants", "workspaceDirectory", "scanner", "sessionSeconds", "loginSeconds"].includes(key))) throw new Error("Explicit Microsoft HTTPS configuration required")
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
  if ("teams" in value && value.teams !== "direct") throw new Error("Invalid Microsoft Teams capability")
  if ("supremeAdminGroupId" in value && (typeof value.supremeAdminGroupId !== "string" || !microsoftUuid.test(value.supremeAdminGroupId))) throw new Error("Immutable Microsoft supreme administration group ID required")
  if (typeof value.workspaceDirectory !== "string" || !path.isAbsolute(value.workspaceDirectory) || path.resolve(value.workspaceDirectory) !== value.workspaceDirectory) throw new Error("Separate canonical Microsoft agent workspace required")
  if (!("scanner" in value) || (value.scanner !== null && (!record(value.scanner) || value.scanner.host !== "127.0.0.1" || typeof value.scanner.port !== "number" || !Number.isInteger(value.scanner.port) || value.scanner.port < 1 || value.scanner.port > 65535 || Object.keys(value.scanner).some((key) => !["host", "port"].includes(key))))) throw new Error("Invalid Microsoft scanner configuration")
  const sessionSeconds = value.sessionSeconds ?? 28800
  const loginSeconds = value.loginSeconds ?? 600
  if (typeof sessionSeconds !== "number" || !Number.isSafeInteger(sessionSeconds) || sessionSeconds < 60 || sessionSeconds > 28800 || typeof loginSeconds !== "number" || !Number.isSafeInteger(loginSeconds) || loginSeconds < 30 || loginSeconds > 600) throw new Error("Invalid Microsoft session lifetime")
  if (!Array.isArray(value.grants) || value.grants.length > 1000) throw new Error("Explicit Microsoft product grants required")
  const grants = Object.freeze(value.grants.map((grant: unknown) => {
    if (!record(grant) || typeof grant.principalRef !== "string" || !microsoftUuid.test(grant.principalRef))
      throw new Error("Resource-tenant object ID required for product grant")
    const fields = Object.fromEntries(Object.entries(grant).map(([key, field]) => [key, freezeGrantJson(field)]))
    return Object.freeze({ ...fields, principalRef: grant.principalRef.toLowerCase() })
  }))
  const configured = value.groups
  if (!record(configured) || Object.keys(configured).length !== 3) throw new Error("Explicit Microsoft surface assignments required")
  const groups: LocalConfiguration["groups"] = { dashboard: {}, planner: {}, procurement: {} }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    const mapping = configured[surface]
    if (!record(mapping)) throw new Error("Explicit Microsoft surface assignments required")
    for (const [role, group] of Object.entries(mapping)) {
      if (!emptyMap().some((row) => row.surface === surface && row.role === role) ||
        typeof group !== "string" || !group.startsWith("group:") || !microsoftUuid.test(group.slice(6)))
        throw new Error("Immutable Microsoft group assignment required")
      groups[surface][role] = group.toLowerCase()
    }
    Object.freeze(groups[surface])
  }
  Object.freeze(groups)
  return Object.freeze({ version: 1, deployment: "azure-https", authentication: "microsoft", origin: value.origin, listenerOrigin: value.listenerOrigin as string, ingressOrigin: value.ingressOrigin as string, mount: value.mount, tenantId: value.tenantId.toLowerCase(), clientId: value.clientId.toLowerCase(), ...(value.teams === "direct" ? { teams: value.teams } : {}), ...(typeof value.supremeAdminGroupId === "string" ? { supremeAdminGroupId: value.supremeAdminGroupId.toLowerCase() } : {}), groups, grants, workspaceDirectory: value.workspaceDirectory, scanner: value.scanner === null ? null : Object.freeze({ host: "127.0.0.1", port: (value.scanner as { port: number }).port }), sessionSeconds, loginSeconds })
}

/** Persist the namespace before opening cloud data. Reusing a directory for another tenant/app is rejected. */
export async function bindMicrosoftInstallation(directory: string, config: MicrosoftConfiguration) {
  await privateDirectory(directory)
  const file = path.join(directory, "microsoft-identity.json")
  const binding = { version: 1, tenantId: config.tenantId, clientId: config.clientId }
  const exists = (target: string) => lstat(target).then(() => true).catch((error: unknown) => {
    if (hasCode(error, "ENOENT")) return false
    throw error
  })
  if (!await exists(file)) {
    if (await exists(path.join(directory, "business-microsoft")) && !await exists(file))
      throw new Error("Unbound Microsoft business directory cannot be adopted")
    const temporary = path.join(directory, `.microsoft-identity-${randomUUID()}.tmp`)
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    try {
      try {
        await handle.writeFile(`${JSON.stringify(binding)}\n`)
        await handle.sync()
      } finally { await handle.close() }
      // Publish the complete marker atomically without replacing a concurrent binding.
      await link(temporary, file).catch((error: unknown) => { if (!hasCode(error, "EEXIST")) throw error })
    } finally { await unlink(temporary) }
  }
  const stored = privateJson((await privateBytes(file, 4096, true)).toString("utf8"))
  if (!record(stored) || Object.keys(stored).length !== 3 || stored.version !== 1 || stored.tenantId !== config.tenantId || stored.clientId !== config.clientId) throw new Error("Microsoft installation identity cannot change")
  // A concurrent reader can see the link before the publisher has synced it.
  const parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try { await parent.sync() }
  finally { await parent.close() }
}

async function privateDirectory(directory: string) {
  const metadata = await lstat(directory)
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || process.getuid?.() !== metadata.uid || (metadata.mode & 0o077) !== 0 || await realpath(directory) !== directory) throw new Error("Private owner-only Microsoft directory required")
}

async function privateBytes(file: string, maximum: number, linkedIdentity = false) {
  if (await realpath(path.dirname(file)) !== path.dirname(file)) throw new Error("Private Microsoft file path required")
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const metadata = await handle.stat()
    // Only the binding marker may have a second link while publication is finishing.
    const privateLinks = metadata.nlink === 1 || (linkedIdentity && metadata.nlink === 2)
    if (!metadata.isFile() || process.getuid?.() !== metadata.uid || (metadata.mode & 0o077) !== 0 || !privateLinks || metadata.size < 1 || metadata.size > maximum) throw new Error("Private owner-only Microsoft file required")
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

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function freezeGrantJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value
  if (Array.isArray(value)) return Object.freeze(value.map(freezeGrantJson))
  if (record(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, field]) => [key, freezeGrantJson(field)])))
  throw new Error("Invalid Microsoft product grant envelope")
}
