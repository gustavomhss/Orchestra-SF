import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, lstat, mkdtemp, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createNativeInstallation } from "../../src/native-installation.ts"
import { loadLocalConfiguration, prepareLocalConfiguration, requireLocalIsolation } from "../runtime/local-configuration.ts"

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function prepared() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-origin-"))
  roots.push(root)
  await chmod(root, 0o700)
  return { root, file: await prepareLocalConfiguration(root) }
}

async function configure(file: string, patch: Record<string, unknown>) {
  const value: unknown = await Bun.file(file).json()
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuration object required")
  await Bun.write(file, JSON.stringify({ ...value, ...patch }))
  await chmod(file, 0o600)
}

function isolated(root: string) {
  return {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"),
    XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
  }
}

test("preparation defaults to legacy origin and both explicit origins load with the same private keys", async () => {
  const fixture = await prepared()
  const legacy = await loadLocalConfiguration(fixture.file)
  expect(legacy.config.origin).toBe("http://localhost:4110")
  expect(legacy.config.scanner).toBeNull()
  expect(new Set(Object.values(legacy.keys).map((key) => Buffer.from(key).toString("hex"))).size).toBe(3)
  expect((await lstat(fixture.root)).mode & 0o777).toBe(0o700)
  expect((await lstat(fixture.file)).mode & 0o777).toBe(0o600)
  await configure(fixture.file, { origin: "http://localhost:4111" })
  const native = await loadLocalConfiguration(fixture.file)
  expect(native.config.origin).toBe("http://localhost:4111")
  expect(native.keys).toEqual(legacy.keys)
  await prepareLocalConfiguration(fixture.root)
  const repeated = await loadLocalConfiguration(fixture.file)
  expect(repeated.config.origin).toBe("http://localhost:4111")
  expect(repeated.keys).toEqual(native.keys)
})

test("only exact canonical localhost origins are accepted", async () => {
  const fixture = await prepared()
  for (const origin of [
    "http://localhost:4112", "http://example.com:4110", "http://127.0.0.1:4110", "http://127.0.0.1:4111",
    "https://localhost:4110", "http://localhost", "http://localhost:80", "http://user:pass@localhost:4110",
    "http://localhost:4110/", "http://localhost:4111/path", "http://localhost:4111?x=1", "http://localhost:4111#part",
  ]) {
    await configure(fixture.file, { origin })
    await expect(loadLocalConfiguration(fixture.file), origin).rejects.toThrow()
  }
})

test("scanner collision follows selected origin while the other origin port remains allowed", async () => {
  const fixture = await prepared()
  for (const [origin, selected, other] of [
    ["http://localhost:4110", 4110, 4111],
    ["http://localhost:4111", 4111, 4110],
  ] as const) {
    await configure(fixture.file, { origin, scanner: { host: "127.0.0.1", port: selected } })
    await expect(loadLocalConfiguration(fixture.file), origin).rejects.toThrow("Invalid local scanner")
    await configure(fixture.file, { scanner: { host: "127.0.0.1", port: other } })
    expect((await loadLocalConfiguration(fixture.file)).config.scanner).toEqual({ host: "127.0.0.1", port: other })
  }
})

test("scanner still requires IPv4 loopback and a positive integer port through 65535", async () => {
  const fixture = await prepared()
  for (const origin of ["http://localhost:4110", "http://localhost:4111"]) {
    for (const scanner of [
      { host: "localhost", port: 5000 }, { host: "127.0.0.2", port: 5000 },
      { host: "127.0.0.1", port: 0 }, { host: "127.0.0.1", port: -1 },
      { host: "127.0.0.1", port: 65536 }, { host: "127.0.0.1", port: 1.5 }, { host: "127.0.0.1", port: "5000" },
    ]) {
      await configure(fixture.file, { origin, scanner })
      await expect(loadLocalConfiguration(fixture.file), `${origin} ${JSON.stringify(scanner)}`).rejects.toThrow("Invalid local scanner")
    }
    for (const port of [1, 65535]) {
      await configure(fixture.file, { origin, scanner: { host: "127.0.0.1", port } })
      expect((await loadLocalConfiguration(fixture.file)).config.scanner?.port).toBe(port)
    }
  }
})

test("both origins retain private paths, independent keys and startup isolation", async () => {
  const fixture = await prepared()
  const environment = isolated(fixture.root)
  for (const origin of ["http://localhost:4110", "http://localhost:4111"]) {
    await configure(fixture.file, { origin })
    await loadLocalConfiguration(fixture.file)
    await requireLocalIsolation(fixture.root, environment)
    await expect(requireLocalIsolation(fixture.root, { ...environment, ORCHESTRA_DB: "/other/orchestra.db" })).rejects.toThrow()
    await chmod(fixture.file, 0o644)
    await expect(loadLocalConfiguration(fixture.file)).rejects.toThrow()
    await chmod(fixture.file, 0o600)
    const alias = path.join(fixture.root, "alias.json")
    await symlink(fixture.file, alias)
    await expect(loadLocalConfiguration(alias)).rejects.toThrow()
    await rm(alias)
  }
  await Bun.write(path.join(fixture.root, "bank.key"), await Bun.file(path.join(fixture.root, "session.key")).arrayBuffer())
  await chmod(path.join(fixture.root, "bank.key"), 0o600)
  await expect(loadLocalConfiguration(fixture.file)).rejects.toThrow("Independent installation keys required")
})

test("native factory requires exact configured origin and isolated environment", async () => {
  const fixture = await prepared()
  for (const [origin, other] of [
    ["http://localhost:4110", "http://localhost:4111"],
    ["http://localhost:4111", "http://localhost:4110"],
  ] as const) {
    await configure(fixture.file, { origin })
    const options = { configuration: fixture.file, origin, environment: isolated(fixture.root) }
    await expect(createNativeInstallation({ ...options, origin: other })).rejects.toThrow("Installation origin mismatch")
    await expect(createNativeInstallation({ ...options, environment: {} })).rejects.toThrow()
    const installation = await createNativeInstallation(options)
    try {
      expect((await installation.handle(new Request(`${origin}/api/sucafina/status`)))?.status).toBe(200)
      expect((await installation.handle(new Request(`${other}/api/sucafina/status`)))?.status).toBe(403)
    } finally {
      await installation.dispose()
    }
  }
})

test("real local-operator enrollment and session are bound to the 4111 origin", async () => {
  const fixture = await prepared()
  const origin = "http://localhost:4111"
  const other = "http://localhost:4110"
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Local operator requires OS owner UID")
  const installationId = randomUUID()
  await configure(fixture.file, {
    origin,
    authentication: "local-operator",
    localOperator: { installationId, uid, buyer: true },
  })
  const options = { configuration: fixture.file, origin, environment: isolated(fixture.root) }
  const native = await createNativeInstallation(options)
  const session = await (async () => {
    try {
      const artifact = await native.enroll()
      expect(artifact.artifact).toBe(path.join(fixture.root, "open-native.html"))
      const html = await Bun.file(artifact.artifact).text()
      const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
      if (!encoded) throw new Error("Enrollment navigation required")
      const target = new URL(JSON.parse(encoded), origin)
      expect(target.origin).toBe(origin)
      expect(target.pathname).toBe("/api/sucafina/auth/local")
      expect(target.searchParams.get("code")).toMatch(/^[a-f0-9]{64}$/)
      const response = await native.handle(new Request(target))
      expect(response?.status).toBe(303)
      const header = response?.headers.getSetCookie()[0]
      if (!header) throw new Error("Session cookie required")
      expect(header).toContain("HttpOnly")
      const cookie = header.split(";")[0]!
      const status = await native.handle(new Request(`${origin}/api/sucafina/status`, { headers: { cookie } }))
      expect(status?.status).toBe(200)
      expect(await status?.json()).toMatchObject({
        configured: true,
        authentication: "local-operator",
        authenticated: true,
        principal: { id: `macos:${installationId}:${uid}` },
      })
      expect((await native.handle(new Request(`${other}/api/sucafina/status`, { headers: { cookie } })))?.status).toBe(403)
      expect((await native.handle(new Request(`${origin}/api/sucafina/auth/logout`, {
        method: "POST", headers: { cookie, origin: other },
      })))?.status).toBe(403)
      return cookie
    } finally {
      await native.dispose()
    }
  })()
  await configure(fixture.file, { origin: other })
  const legacy = await createNativeInstallation({ ...options, origin: other })
  try {
    const status = await legacy.handle(new Request(`${other}/api/sucafina/status`, { headers: { cookie: session } }))
    expect(status?.status).toBe(200)
    expect(await status?.json()).toMatchObject({ configured: true, authentication: "local-operator", authenticated: false })
    expect((await legacy.handle(new Request(`${other}/api/sucafina/dashboard/state?page=IT%20Risks&year=2026&month=1`, {
      headers: { cookie: session },
    })))?.status).toBe(401)
  } finally {
    await legacy.dispose()
  }
})
