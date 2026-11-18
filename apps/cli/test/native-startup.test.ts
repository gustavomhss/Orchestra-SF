import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readdir, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadLocalConfiguration, prepareLocalConfiguration, requireLocalIsolation } from "@orchestra/sucafina/configuration"
import { NativeStartup } from "../src/native-startup"

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "native-startup-"))
  roots.push(root)
  await chmod(root, 0o700)
  const configuration = await prepareLocalConfiguration(root)
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Fixture requires an OS owner UID")
  const config = await Bun.file(configuration).json()
  await Bun.write(configuration, JSON.stringify({ ...config, origin: "http://localhost:4111", authentication: "local-operator", localOperator: { installationId: randomUUID(), uid, buyer: true } }))
  await chmod(configuration, 0o600)
  const webRoot = path.join(root, "public-web")
  await mkdir(webRoot, { mode: 0o755 })
  await Bun.write(path.join(webRoot, "index.html"), "<!doctype html><title>Public fixture</title>")
  // This public marker is a verifier fixture, not evidence of a production web build.
  await Bun.write(path.join(webRoot, "native-manifest.json"), JSON.stringify({ product: "Orchestra-SF", native: true, version: 1 }))
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
    TMPDIR: path.join(root, "host-tmp"),
    XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
    EXAMPLE_PROVIDER_SETTING: "provider-unchanged-fixture",
  }
  const input = { configuration, argv: ["serve", "--hostname", "localhost", "--port", "4111"], environment, webRoot } satisfies NativeStartup.VerifyInput
  return { root, configuration, webRoot, environment, input, uid }
}

async function rejects(input: NativeStartup.VerifyInput, context: string, secret = "fixture-private-secret") {
  const error: unknown = await NativeStartup.verify(input).then(() => undefined, (failure: unknown) => failure)
  expect(error, context).toBeInstanceOf(Error)
  if (!(error instanceof Error)) throw new Error(`Expected a bounded native rejection: ${context}`)
  expect(error.message, context).toMatch(/^Native installation\b/)
  expect(error.message, context).not.toContain(secret)
  expect(error.message.length, context).toBeLessThan(512)
  expect(error.cause, context).toBeUndefined()
}

async function inventory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name)
    const info = await lstat(file)
    if (entry.isDirectory()) return [`dir:${file}:${info.mode & 0o777}`, ...await inventory(file)]
    return [`file:${file}:${info.mode & 0o777}:${Buffer.from(await Bun.file(file).arrayBuffer()).toString("hex")}`]
  }))
  return nested.flat().sort()
}

test("unset selector returns undefined without reading other input or touching files", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "native-disabled-"))
  roots.push(root)
  const before = await inventory(root)
  const input: NativeStartup.VerifyInput = {
    configuration: undefined,
    get argv(): readonly string[] { throw new Error("argv was read") },
    get environment(): Readonly<Record<string, string | undefined>> { throw new Error("environment was read") },
    get webRoot(): string { throw new Error("web root was read") },
  }
  expect(await NativeStartup.verify(input)).toBeUndefined()
  expect(await inventory(root)).toEqual(before)
})

test("real owner configuration and isolated environment admit both explicit argument orders without changing private files", async () => {
  const f = await fixture()
  const loaded = await loadLocalConfiguration(f.configuration)
  expect(loaded.config.origin).toBe("http://localhost:4111")
  expect(loaded.config.localOperator?.uid).toBe(f.uid)
  await requireLocalIsolation(f.root, f.environment)
  await Bun.write(path.join(f.root, "business", "existing-data.bin"), "existing-private-data")
  await chmod(path.join(f.root, "business", "existing-data.bin"), 0o600)
  const before = await inventory(f.root)
  const environment = { ...f.environment }
  const admission = { configuration: f.configuration, origin: "http://localhost:4111", webRoot: f.webRoot }
  expect(await NativeStartup.verify(f.input)).toEqual(admission)
  expect(await NativeStartup.verify({ ...f.input, argv: ["serve", "--port", "4111", "--hostname", "localhost"] })).toEqual(admission)
  expect(f.environment).toEqual(environment)
  expect(await inventory(f.root)).toEqual(before)
  expect(await Bun.file(path.join(f.root, "host-data", "orchestra.db")).exists()).toBe(false)
  expect(await Bun.file(path.join(f.root, "business-local", "installation.sqlite")).exists()).toBe(false)
  expect(Object.keys(admission).sort()).toEqual(["configuration", "origin", "webRoot"])
})

test("explicit empty, relative, missing and symlinked selectors fail closed", async () => {
  const f = await fixture()
  const alias = path.join(f.root, "installation-alias.json")
  await symlink(f.configuration, alias)
  for (const configuration of ["", "installation.json", path.join(f.root, "missing.json"), alias])
    await rejects({ ...f.input, configuration }, `selector ${configuration}`)
})

test("only exact serve hostname and port pairs are accepted", async () => {
  const f = await fixture()
  const invalid: string[][] = [
    [], ["serve"], ["--version"], ["serve", "--hostname", "localhost"], ["serve", "--port", "4111"],
    ["serve", "--hostname", "127.0.0.1", "--port", "4111"], ["serve", "--hostname", "localhost", "--port", "4110"],
    ["serve", "--hostname", "localhost", "--port", "0"], ["serve", "--hostname=localhost", "--port", "4111"],
    ["serve", "--hostname", "localhost", "--port=4111"], ["serve", "--hostname", "localhost", "--port", "4111", "--port", "4111"],
    ["serve", "--hostname", "localhost", "--hostname", "localhost", "--port", "4111"],
    ["serve", "--hostname", "localhost", "--port", "4111", "--register"],
    ["serve", "--hostname", "localhost", "--port", "4111", "--cors", "*"],
    ["serve", "--hostname", "localhost", "--port", "4111", "extra"],
  ]
  for (const argv of invalid) await rejects({ ...f.input, argv }, JSON.stringify(argv))
})

test("inherited credentials and alternate host config are forbidden even when empty", async () => {
  const f = await fixture()
  for (const name of ["ORCHESTRA_SERVER_PASSWORD", "ORCHESTRA_SERVER_USERNAME", "ORCHESTRA_CONFIG", "ORCHESTRA_CONFIG_CONTENT"]) {
    for (const value of ["", "fixture-private-secret"])
      await rejects({ ...f.input, environment: { ...f.environment, [name]: value } }, `${name} present`)
  }
  for (const value of [undefined, "", "0", "true"])
    await rejects({ ...f.input, environment: { ...f.environment, ORCHESTRA_DISABLE_PROJECT_CONFIG: value } }, "project config guard")
})

test("each isolated host location and credential-inheritance guard is required", async () => {
  const f = await fixture()
  for (const name of ["ORCHESTRA_DB", "ORCHESTRA_INHERIT_CREDENTIALS", "ORCHESTRA_CONFIG_DIR", "ORCHESTRA_CREDENTIAL_KEY_FILE", "TMPDIR", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
    await rejects({ ...f.input, environment: { ...f.environment, [name]: undefined } }, `${name} missing`)
    await rejects({ ...f.input, environment: { ...f.environment, [name]: path.join(f.root, "other") } }, `${name} alternate`)
  }
  const alias = path.join(f.root, "cache-alias")
  await symlink(path.join(f.root, "host-cache"), alias)
  await rejects({ ...f.input, environment: { ...f.environment, XDG_CACHE_HOME: alias } }, "XDG alias")
  await rejects({ ...f.input, environment: { ...f.environment, TMPDIR: path.join(f.root, "host-tmp", "..", "host-tmp") + "/" } }, "TMPDIR alias")
})

test("origin and explicit local-operator ownership are mandatory", async () => {
  const f = await fixture()
  const original = await Bun.file(f.configuration).json()
  for (const patch of [
    { origin: "http://localhost:4110" }, { origin: "http://127.0.0.1:4111" }, { origin: "http://localhost:4111/" },
    { authentication: "microsoft" }, { authentication: undefined }, { authentication: "local-operator", localOperator: undefined },
    { authentication: "local-operator", localOperator: { installationId: randomUUID(), uid: f.uid + 1 } },
    { authentication: "local-operator", localOperator: { installationId: "invalid", uid: f.uid } },
  ]) {
    await Bun.write(f.configuration, JSON.stringify({ ...original, ...patch }))
    await chmod(f.configuration, 0o600)
    await rejects(f.input, JSON.stringify(patch))
  }
})

test("private configuration and keys reject insecure, aliased, missing and duplicate material", async () => {
  const f = await fixture()
  await chmod(f.configuration, 0o644)
  await rejects(f.input, "public config mode")
  await chmod(f.configuration, 0o600)
  await chmod(path.join(f.root, "host-tmp"), 0o755)
  await rejects(f.input, "public temporary directory")
  await chmod(path.join(f.root, "host-tmp"), 0o700)
  const bank = path.join(f.root, "bank.key")
  const bankBytes = await Bun.file(bank).arrayBuffer()
  await Bun.write(bank, await Bun.file(path.join(f.root, "session.key")).arrayBuffer())
  await rejects(f.input, "duplicate bank and session keys")
  await Bun.write(bank, "short")
  await rejects(f.input, "short bank key")
  await Bun.write(bank, bankBytes)
  await chmod(bank, 0o644)
  await rejects(f.input, "public bank key")
  await chmod(bank, 0o600)
  await rm(bank)
  await symlink(path.join(f.root, "assets.key"), bank)
  await rejects(f.input, "symlinked bank key")
  await rm(bank)
  await rejects(f.input, "missing bank key")
})

test("web root must be canonical absolute with a regular index and native public marker", async () => {
  const f = await fixture()
  for (const webRoot of [undefined, "", "public-web", `${f.webRoot}/.`, path.join(f.root, "missing-web")])
    await rejects({ ...f.input, webRoot }, `web root ${webRoot}`)
  await rm(path.join(f.webRoot, "index.html"))
  await rejects(f.input, "missing index")
  await mkdir(path.join(f.webRoot, "index.html"))
  await rejects(f.input, "index is directory")
})

test("native marker rejects missing, malformed, legacy and wrong-profile assets", async () => {
  const f = await fixture()
  const marker = path.join(f.webRoot, "native-manifest.json")
  await rm(marker)
  await rejects(f.input, "missing marker")
  for (const content of [
    "{invalid fixture-private-secret", "null", "[]", "{}", JSON.stringify({ product: "Orchestra", native: true, version: 1 }),
    JSON.stringify({ product: "Orchestra-SF", native: false, version: 1 }),
    JSON.stringify({ product: "Orchestra-SF", native: true, version: 2 }),
    JSON.stringify({ product: "Orchestra-SF", native: "true", version: 1 }),
  ]) {
    await Bun.write(marker, content)
    await rejects(f.input, "invalid public marker")
  }
})

test("malformed private configuration fails with bounded errors that do not leak provider content", async () => {
  const f = await fixture()
  await Bun.write(f.configuration, '{"provider":"fixture-private-secret", invalid')
  await chmod(f.configuration, 0o600)
  await rejects(f.input, "malformed private configuration")
  expect(await Bun.file(path.join(f.root, "host-data", "orchestra.db")).exists()).toBe(false)
  expect(await Bun.file(path.join(f.root, "business-local", "installation.sqlite")).exists()).toBe(false)
})
