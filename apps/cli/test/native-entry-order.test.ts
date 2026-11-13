import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Exit } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { InstallationVersion } from "@orchestra/core/installation/version"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url))

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "orchestra-native-entry-"))
  await chmod(root, 0o700)
  await Promise.all(["data", "config", "cache", "state", "tmp", "installation"].map((name) =>
    mkdir(path.join(root, name), { mode: 0o700 }),
  ))
  const configuration = path.join(root, "installation", "invalid.json")
  await Bun.write(configuration, "{invalid-private-fixture\n")
  await chmod(configuration, 0o600)
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "HUGR_OMNI_ADDON", "HUGR_OMNI_SUPERVISOR"].includes(key.toUpperCase()),
  ))
  return {
    root,
    configuration,
    database: path.join(root, "installation", "host-data", "orchestra.db"),
    environment: {
      ...inherited,
      USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root,
      TMPDIR: path.join(root, "tmp"), TMP: path.join(root, "tmp"), TEMP: path.join(root, "tmp"),
      XDG_DATA_HOME: path.join(root, "data"), XDG_CONFIG_HOME: path.join(root, "config"),
      XDG_CACHE_HOME: path.join(root, "cache"), XDG_STATE_HOME: path.join(root, "state"),
      ORCHESTRA_TEST_HOME: root,
      ORCHESTRA_DISABLE_MODELS_FETCH: "1",
      ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1",
    },
  }
}

function run(args: string[], root: string, environment: Record<string, string | undefined>) {
  return Effect.runPromise(Effect.gen(function* () {
    const app = yield* AppProcess.Service
    return yield* Effect.exit(app.run(ChildProcess.make(process.execPath, [entry, ...args], {
      cwd: root, env: environment, extendEnv: false,
      stdin: "ignore", stdout: "pipe", stderr: "pipe", forceKillAfter: "2 seconds",
    }), { timeout: 15_000, maxOutputBytes: 128 * 1024, maxErrorBytes: 128 * 1024 }))
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.scoped))
}

test("ordinary source --version succeeds without opening a database", async () => {
  const local = await fixture()
  try {
    expectSpawn(import.meta.path)
    const result = await run(["--version"], local.root, { ...local.environment, ORCHESTRA_DB: local.database })
    if (!Exit.isSuccess(result)) throw new Error("Source --version did not complete within its owned process scope")
    expect(result.value.exitCode, result.value.stderr.toString()).toBe(0)
    expect(result.value.stdout.toString().trim()).toBe(InstallationVersion)
    expect(existsSync(local.database)).toBe(false)
    expect(existsSync(path.join(local.root, "data", "orchestra", "orchestra.db"))).toBe(false)
  } finally {
    await rm(local.root, { recursive: true, force: true })
  }
}, 60_000)

test("selected invalid installation is rejected by source entry before Core paths or database", async () => {
  const local = await fixture()
  try {
    expectSpawn(import.meta.path)
    const result = await run(["serve", "--hostname", "localhost", "--port", "4111"], local.root, {
      ...local.environment,
      ORCHESTRA_SF_INSTALLATION: local.configuration,
      ORCHESTRA_DB: local.database,
      ORCHESTRA_CONFIG_DIR: path.join(local.root, "installation", "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(local.root, "installation", "host-credential.key"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
      ORCHESTRA_WEB_UI_DIR: path.join(local.root, "missing-native-web"),
    })
    // A baseline listener is confined to this scoped Omni child; timeout closes its process tree before inspection.
    const created = ["data", "config", "cache", "state", "tmp"].filter((name) =>
      existsSync(path.join(local.root, name, "orchestra")),
    )
    expect(created).toEqual([])
    expect(existsSync(local.database)).toBe(false)
    expect(existsSync(path.join(local.root, "data", "orchestra", "orchestra.db"))).toBe(false)
    expect(await Bun.file(local.configuration).text()).toBe("{invalid-private-fixture\n")
    if (!Exit.isSuccess(result)) throw new Error("Selected source entry did not reject within its owned process scope")
    expect(result.value.exitCode).not.toBe(0)
    expect(result.value.stderr.toString()).toContain("Native installation")
    expect(result.value.stderr.toString()).not.toContain("hugr-omni CLI preflight failed")
  } finally {
    await rm(local.root, { recursive: true, force: true })
  }
}, 60_000)
