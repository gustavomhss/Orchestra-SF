import { afterAll, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"

const cli = path.resolve(import.meta.dirname, "..")
const target = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
const binary = path.join(cli, "dist", `cli-${target}`, "bin", `orchestra${process.platform === "win32" ? ".exe" : ""}`)
const roots: string[] = []
const build: { result?: Promise<{ version: string }> } = {}

afterAll(async () => {
  // Each run() has already closed its owned process scope before these private fixtures are removed.
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function sandbox() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "native-compiled-"))
  roots.push(root)
  await chmod(root, 0o700)
  await Promise.all(["host-data", "host-config", "host-cache", "host-state", "host-tmp", "installation"].map((name) =>
    mkdir(path.join(root, name), { mode: 0o700 }),
  ))
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "HUGR_OMNI_ADDON", "HUGR_OMNI_SUPERVISOR"].includes(key.toUpperCase()),
  ))
  return {
    root,
    database: path.join(root, "host-data", "orchestra.db"),
    environment: {
      ...inherited,
      XDG_DATA_HOME: path.join(root, "host-data"),
      XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"),
      XDG_STATE_HOME: path.join(root, "host-state"),
      TMPDIR: path.join(root, "host-tmp"), TMP: path.join(root, "host-tmp"), TEMP: path.join(root, "host-tmp"),
      ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
      ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_DISABLE_MODELS_FETCH: "1",
      ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1",
      NO_COLOR: "1",
    },
  }
}

function run(args: string[], cwd: string, environment: Record<string, string | undefined>, timeout = 30_000) {
  return Effect.runPromise(Effect.gen(function* () {
    const app = yield* AppProcess.Service
    return yield* app.run(ChildProcess.make(args[0]!, args.slice(1), {
      cwd, env: environment, extendEnv: false,
      stdin: "ignore", stdout: "pipe", stderr: "pipe", forceKillAfter: "2 seconds",
    }), { timeout, maxOutputBytes: 4 * 1024 * 1024, maxErrorBytes: 4 * 1024 * 1024 })
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.scoped,
  ))
}

function compiled() {
  return build.result ??= (async () => {
    if (process.env.GITHUB_ACTIONS !== "false" || !process.env.RUNNER_OS)
      throw new Error("Compiled entry acceptance requires the hosted test-ci runner")
    const local = await sandbox()
    const metadata = await Bun.file(path.join(cli, "package.json")).json()
    const version = `${metadata.version}-native-entry-test`
    const models = path.join(local.root, "models.json")
    await Bun.write(models, "{}")
    const artifacts = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      ["OMNI_ARTIFACTS", "TREE_SITTER_ARTIFACTS", "RIPGREP_ARCHIVES"].includes(key),
    ))
    const result = await run([process.execPath, "script/build.ts", "--skip-install", "--single", "--target", target], cli, {
      ...local.environment, ...artifacts,
      ORCHESTRA_VERSION: version, ORCHESTRA_CHANNEL: "dev", MODELS_DEV_API_JSON: models,
    }, 600_000)
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(await Bun.file(binary).exists()).toBe(true)
    const manifest = await Bun.file(path.join(cli, "dist", `cli-${target}`, "package.json")).json()
    expect(manifest).toMatchObject({
      name: `@humanguardrail/cli-${target}`, version,
      repository: { type: "git", url: "git+https://github.com/gustavomhss/hugr-orchestra.git" },
      os: [process.platform], cpu: [process.arch],
    })
    return { version }
  })()
}

function noDatabase(local: Awaited<ReturnType<typeof sandbox>>) {
  expect(existsSync(local.database)).toBe(false)
  expect(existsSync(path.join(local.root, "host-data", "orchestra", "orchestra.db"))).toBe(false)
  expect(existsSync(path.join(local.root, "installation", "business-local", "installation.sqlite"))).toBe(false)
}

test("actual compiled entry prints the exact configured version without opening a database", async () => {
  expectSpawn(import.meta.path)
  const artifact = await compiled()
  const local = await sandbox()
  const result = await run([binary, "--version"], local.root, local.environment)
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  expect(result.stdout.toString().trim()).toBe(artifact.version)
  noDatabase(local)
}, 660_000)

test("actual compiled entry exposes ordinary owned help without opening a database", async () => {
  expectSpawn(import.meta.path)
  await compiled()
  const local = await sandbox()
  const result = await run([binary, "--help"], local.root, local.environment)
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  expect(result.stdout.toString()).toContain("orchestra")
  expect(result.stdout.toString()).toContain("--help")
  expect(result.stdout.toString()).toContain("--version")
  expect(result.stdout.toString()).not.toContain("lildax")
  noDatabase(local)
}, 660_000)

test("actual compiled selected entry rejects malformed private setup before broken Omni or Core paths", async () => {
  expectSpawn(import.meta.path)
  await compiled()
  const local = await sandbox()
  const configuration = path.join(local.root, "installation", "installation.json")
  const privateContent = '{"private":"NATIVE-COMPILED-PRIVATE-SENTINEL", invalid\n'
  await Bun.write(configuration, privateContent)
  await chmod(configuration, 0o600)
  const result = await run([binary, "serve", "--hostname", "localhost", "--port", "4111"], local.root, {
    ...local.environment,
    ORCHESTRA_SF_INSTALLATION: configuration,
    ORCHESTRA_WEB_UI_DIR: path.join(local.root, "missing-native-web"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(local.root, "installation", "host-credential.key"),
    HUGR_OMNI_ADDON: path.join(local.root, "missing-omni", "hugr_omni.node"),
    HUGR_OMNI_SUPERVISOR: path.join(local.root, "missing-omni", "hugr-omni-supervisor"),
  })
  expect(result.exitCode).not.toBe(0)
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`
  const rejection = result.stderr.toString().split(/\r?\n/).find((line) => /^(?:(?:Error|error): )?Native installation\b/.test(line))
  expect(rejection).toBeDefined()
  expect(rejection!.length).toBeLessThan(512)
  expect(output).not.toContain("NATIVE-COMPILED-PRIVATE-SENTINEL")
  expect(output).not.toContain("hugr-omni CLI preflight failed")
  expect(output).not.toContain("server listening on")
  expect(await Bun.file(configuration).text()).toBe(privateContent)
  noDatabase(local)
  expect(["host-data", "host-config", "host-cache", "host-state", "host-tmp"].filter((name) =>
    existsSync(path.join(local.root, name, "orchestra")),
  )).toEqual([])
}, 660_000)
