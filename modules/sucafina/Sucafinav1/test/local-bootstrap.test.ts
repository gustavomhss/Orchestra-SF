import { afterEach, expect, test } from "bun:test"
import { chmod, lstat, mkdtemp, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadLocalConfiguration, prepareLocalConfiguration, requireLocalIsolation } from "../runtime/local-configuration.ts"
import { bootstrapLocalSurface } from "../runtime/local-bootstrap.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { LocalIdentity } from "../runtime/local-contract.ts"

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })
async function directory() { const value = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-local-")); directories.push(value); return value }

test("private setup is idempotent, keys distinct and public identity remains unconfigured", async () => {
  const root = await directory()
  const file = await prepareLocalConfiguration(root)
  const initial = await loadLocalConfiguration(file)
  expect(initial.config.tenantId).toBeNull()
  expect(initial.config.clientId).toBeNull()
  expect(initial.config.scanner).toBeNull()
  expect(initial.config.groups).toEqual({ dashboard: {}, planner: {}, procurement: {} })
  expect(new Set(Object.values(initial.keys).map((key) => Buffer.from(key).toString("hex"))).size).toBe(3)
  await prepareLocalConfiguration(root)
  expect((await loadLocalConfiguration(file)).keys).toEqual(initial.keys)
  expect((await lstat(root)).mode & 0o777).toBe(0o700)
  expect((await lstat(file)).mode & 0o777).toBe(0o600)
})

test("publicly accessible existing directories and symlinked configuration are refused", async () => {
  const root = await directory()
  await chmod(root, 0o755)
  await expect(prepareLocalConfiguration(root)).rejects.toThrow()
  expect((await lstat(root)).mode & 0o777).toBe(0o755)
  await chmod(root, 0o700)
  const file = await prepareLocalConfiguration(root)
  const alias = path.join(root, "alias.json")
  await symlink(file, alias)
  await expect(loadLocalConfiguration(alias)).rejects.toThrow()
})

test("startup isolation checks every host path before permitting migration", async () => {
  const root = await directory()
  await prepareLocalConfiguration(root)
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  await requireLocalIsolation(root, environment)
  for (const variable of Object.keys(environment)) await expect(requireLocalIsolation(root, { ...environment, [variable]: "/other/application" })).rejects.toThrow()
})

test("role bootstrap requires verified admin and never overwrites deliberate saved edits", async () => {
  const store = await openLocalStore(path.join(await directory(), "business"))
  const person = { id: "c84a2527-62c6-48dd-93e2-015c606783ec", name: "Real Directory Admin" }
  const membership = { admin: false, name: "" }
  const identity: LocalIdentity = {
    handle: async () => undefined, prepare: async () => {}, directory: async () => [person], person: async () => person,
    authenticate: async (_request, context) => { membership.name = context?.roleMap.find((row) => row.role === "admin")?.entra ?? ""; return { id: person.id, canWrite: membership.admin, roles: membership.admin ? [{ surface: "planner", role: "admin" }] : [] } },
  }
  const input = { request: new Request("http://localhost:4110/sucafina/planner"), surface: "planner" as const, groups: { admin: "Exact Directory Group" }, identity, store }
  try {
    expect(await bootstrapLocalSurface(input)).toBe(false)
    expect(membership.name).toBe("Exact Directory Group")
    membership.admin = true
    expect(await bootstrapLocalSurface(input)).toBe(true)
    await store.transaction("planner", async (snapshot) => {
      expect(snapshot.audit[0].who).toBe(person.id)
      expect(snapshot.audit[0].name).toBe(person.name)
      expect(snapshot.audit[0].was).toBeUndefined()
      expect(snapshot.versions.dataset.version).toBe(1)
      snapshot.data.roleMap = []
      return { commit: true, value: undefined }
    })
    expect(await bootstrapLocalSurface(input)).toBe(false)
    await store.transaction("planner", async (snapshot) => { expect(snapshot.data.roleMap).toEqual([]); return { commit: false, value: undefined } })
  } finally { await store.dispose() }
})


test("startup refuses insecure or aliased temporary directories and incompatible redirect port", async () => {
  const root = await directory()
  const file = await prepareLocalConfiguration(root)
  const config = await Bun.file(file).json()
  config.origin = "http://localhost:4112"
  await Bun.write(file, JSON.stringify(config))
  await expect(loadLocalConfiguration(file)).rejects.toThrow()
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  await chmod(path.join(root, "host-tmp"), 0o755)
  await expect(requireLocalIsolation(root, environment)).rejects.toThrow()
  await rm(path.join(root, "host-tmp"), { recursive: true })
  await symlink(await directory(), path.join(root, "host-tmp"))
  await expect(requireLocalIsolation(root, environment)).rejects.toThrow()
})
