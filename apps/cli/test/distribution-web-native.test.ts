import { expect, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, sep } from "node:path"
import { Schema } from "effect"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { archiveDistribution, prepareDistribution, verifyDistribution } from "../script/distribution-payload"
import { pins, downloadDistributionDeno, distributionDenoVersion, requireDistributionDenoVersion } from "../../../script/distribution-deno"
import { captureOracle, cli, command, nativeLibc, sandbox, sha256, snapshot, successful, target } from "./fixture/distribution-native"
import { emergencyStop, qualify, stopServices } from "./fixture/distribution-native-proof"

// Hosted Linux x64 glibc witness of the existing packager. Runs the compiled
// payload CLI. Not UI, SSO, business acceptance, or model inference.
const interrupt = () => { void stopServices().then(() => process.exit(1), () => process.exit(1)) }

test("hosted linux x64 glibc qualifies packaged native CLI and built web from the same source", async () => {
  expectSpawn(import.meta.path)
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux") throw new Error("HOSTED_LINUX_CI_REQUIRED")
  if (process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF") throw new Error("GITHUB_REPOSITORY_MISMATCH")
  if (process.platform !== "linux" || process.arch !== "x64" || nativeLibc?.kind !== "glibc" || process.versions.bun !== "1.3.14" || target !== "linux-x64-baseline")
    throw new Error("LINUX_X64_GLIBC_BUN_1_3_14_REQUIRED")
  const workspace = process.env.GITHUB_WORKSPACE
  if (!workspace) throw new Error("GITHUB_WORKSPACE_REQUIRED")
  const workflowSHA = process.env.GITHUB_SHA ?? ""
  if (!/^[a-f0-9]{40}$/.test(workflowSHA)) throw new Error("WORKFLOW_SHA_INVALID")
  const sourceExpected = process.env.SOURCE_REVISION ?? workflowSHA
  if (!/^[a-f0-9]{40}$/.test(sourceExpected)) throw new Error("SOURCE_REVISION_INVALID")
  const repo = resolve(cli, "../..")
  const webDist = resolve(repo, "apps/web/dist")
  const state: { directory?: string; hidden?: string; ownsWeb: boolean; deno?: string; denoVersion?: string; denoCaptured: boolean } = { ownsWeb: false, denoCaptured: false }
  process.once("exit", emergencyStop)
  process.once("SIGINT", interrupt)
  process.once("SIGTERM", interrupt)
  process.once("SIGHUP", interrupt)
  try {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "orchestra-web-native-"))
    state.directory = directory
    expect(directory.startsWith(`${await realpath(repo)}${sep}`)).toBe(false)
    const box = await sandbox(join(directory, "builder"))
    const version = Schema.decodeUnknownSync(Schema.Struct({
      version: Schema.String.check(Schema.isPattern(/^[\x21-\x7e]+$/)),
    }))(await Bun.file(join(cli, "package.json")).json()).version
    const oracle = await captureOracle()
    const modelsResponse = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(30_000) })
    if (!modelsResponse.ok) throw new Error("MODELS_METADATA_HTTP_FAILED")
    const modelsBytes = Buffer.from(await modelsResponse.arrayBuffer())
    const catalog: unknown = JSON.parse(modelsBytes.toString("utf8"))
    if (typeof catalog !== "object" || catalog === null || Array.isArray(catalog)) throw new Error("MODELS_METADATA_INVALID")
    const providers = Object.values(catalog)
    const listed = providers.some((provider: unknown) => {
      if (typeof provider !== "object" || provider === null || Array.isArray(provider) || !("models" in provider)) return false
      const models = provider.models
      return typeof models === "object" && models !== null && !Array.isArray(models) && Object.keys(models).length > 0
    })
    if (!providers.length || !listed) throw new Error("MODELS_METADATA_INVALID")
    const models = join(directory, "models.json")
    await writeFile(models, modelsBytes, { flag: "wx" })
    const modelsSha256 = sha256(modelsBytes)
    expect(sha256(await readFile(models))).toBe(modelsSha256)
    const buildenv = { ...box.env, ORCHESTRA_VERSION: version, ORCHESTRA_CHANNEL: "dev", MODELS_DEV_API_JSON: models }
    if (Object.keys(buildenv).some((key) => /^(GITHUB_|GH_|NPM_TOKEN|NODE_AUTH_TOKEN|SENTRY_AUTH_TOKEN|AZURE_)/.test(key)))
      throw new Error("BUILD_ENV_SECRET_PRESENT")
    const git = { cwd: repo, env: buildenv }
    await requireCleanSource(git)
    const sourceSHA = await successful(["git", "rev-parse", "HEAD"], git, 15_000)
    if (!/^[a-f0-9]{40}$/.test(sourceSHA) || sourceSHA !== sourceExpected) throw new Error("SOURCE_SHA_MISMATCH")
    const cliArgs = [process.execPath, "script/build.ts", "--single", "--skip-install", "--target", target]
    const compiled = await command(cliArgs, { cwd: cli, env: buildenv }, 900_000)
    if (compiled.code !== 0) throw new Error(`CLI_BUILD_FAILED code=${compiled.code}\n${compiled.stderr}`)
    const present = await lstat(webDist).then(() => true, (error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false
      throw error
    })
    if (present) throw new Error("WEB_DIST_ALREADY_PRESENT")
    state.ownsWeb = true
    const webBuild = await command([process.execPath, "run", "--cwd", resolve(repo, "apps/web"), "build"], { cwd: repo, env: buildenv }, 600_000)
    if (webBuild.code !== 0) throw new Error(`WEB_BUILD_FAILED code=${webBuild.code}\n${webBuild.stderr}`)
    const webSnap = await snapshot(webDist)
    if (!webSnap) throw new Error("WEB_DIST_MISSING")
    const index = webSnap.files.get("index.html")
    const asset = [...webSnap.files.keys()].filter((file) => file.endsWith(".js")).sort()[0]
    const assetFile = asset === undefined ? undefined : webSnap.files.get(asset)
    if (!index || index.bytes.length === 0 || asset === undefined || !assetFile || assetFile.bytes.length === 0)
      throw new Error("WEB_DIST_ENTRY_MISSING")
    const indexSha256 = sha256(index.bytes)
    const assetSha256 = sha256(assetFile.bytes)
    const run = await sandbox(join(directory, "run"))
    const payload = join(run.directory, "payload")
    const manifest = await prepareDistribution({ dist: resolve(cli, "dist"), web: webDist, out: payload, version, target })
    expect(await verifyDistribution(payload, { version, target })).toEqual(manifest)
    expect(Array.isArray(manifest.files)).toBe(true)
    const packed = await snapshot(payload)
    if (!packed) throw new Error("PAYLOAD_SNAPSHOT_MISSING")
    for (const path of ["bin/orchestra", "bin/hugr_omni.node", "bin/hugr-omni-supervisor", "bin/web/index.html", `bin/web/${asset}`]) {
      const entry = manifest.files.find((file) => file.path === path)
      const file = packed.files.get(path)
      if (!entry || !file || typeof entry.executable !== "boolean" || !/^[a-f0-9]{64}$/.test(entry.sha256) || sha256(file.bytes) !== entry.sha256 || file.executable !== entry.executable)
        throw new Error(`REQUIRED_DISTRIBUTION_FILE_MISSING: ${path}`)
    }
    const names = [...packed.files.keys()]
    expect(names.some((file) => file.startsWith("bin/tree-sitter/"))).toBe(true)
    expect(names.some((file) => file.startsWith("bin/ripgrep/"))).toBe(true)
    for (const [path, file] of webSnap.files) {
      const copied = packed.files.get(`bin/web/${path}`)
      if (!copied || !copied.bytes.equals(file.bytes)) throw new Error(`WEB_BYTES_MISMATCH: ${path}`)
      expect(sha256(copied.bytes)).toBe(sha256(file.bytes))
    }
    const hidden = join(directory, "hidden-web-dist")
    await rename(webDist, hidden)
    state.hidden = hidden
    const denoDir = join(directory, "deno")
    await mkdir(denoDir)
    const pin = pins["linux-x64"]
    const downloaded = await downloadDistributionDeno(`https://github.com/denoland/deno/releases/download/v${distributionDenoVersion}/deno-${pin[0]}.zip`, pin[1])
    const zip = join(directory, "deno.zip")
    await writeFile(zip, downloaded.bytes, { flag: "wx" })
    await successful(["unzip", "-q", zip, "-d", denoDir], box, 15_000)
    const deno = join(denoDir, "deno")
    await chmod(deno, 0o700)
    requireDistributionDenoVersion(await successful([deno, "--version"], box, 15_000))
    state.deno = process.env.ORCHESTRA_DISTRIBUTION_DENO
    state.denoVersion = process.env.ORCHESTRA_DISTRIBUTION_DENO_VERSION
    state.denoCaptured = true
    process.env.ORCHESTRA_DISTRIBUTION_DENO = deno
    process.env.ORCHESTRA_DISTRIBUTION_DENO_VERSION = distributionDenoVersion
    const seen = { web: false }
    console.info("WEB_NATIVE_STAGE before-qualify")
    await qualify({
      launcher: join(payload, "bin/orchestra"), payload, box: run, version, oracle,
      inspectWeb: async (endpoint) => {
        const body = async (pathname: string) => {
          const response = await fetch(new URL(pathname, endpoint), { redirect: "error", signal: AbortSignal.timeout(15_000) })
          expect(response.status).toBe(200)
          return sha256(Buffer.from(await response.arrayBuffer()))
        }
        expect(await body("/")).toBe(indexSha256)
        expect(await body(`/${asset}`)).toBe(assetSha256)
        seen.web = true
      },
    })
    console.info("WEB_NATIVE_STAGE after-qualify")
    expect(seen.web).toBe(true)
    expect(await snapshot(payload)).toEqual(packed)
    await requireCleanSource(git)
    const logs = join(workspace, "distribution-logs")
    await mkdir(logs, { recursive: true })
    const archiveFile = "orchestra-sf-linux-x64-baseline.tar.gz"
    console.info("WEB_NATIVE_STAGE before-archive")
    const archived = await archiveDistribution({ directory: payload, file: join(logs, archiveFile) })
    const archiveSha256 = sha256(await readFile(join(logs, archiveFile)))
    expect(archiveSha256).toBe(archived.sha256)
    expect(archived.version).toBe(version)
    expect(archived.target).toBe(target)
    const receipt = {
      schema: "orchestra-web-build-proof-v1", repository: "gustavomhss/Orchestra-SF", sourceSHA, workflowSHA, target, version, modelsSha256,
      archive: { file: archiveFile, sha256: archiveSha256 }, manifest,
      web: { indexSha256, asset, assetSha256 }, inspected: true, providerProof: false,
    }
    const receiptPath = join(logs, "build-receipt.json")
    const handle = await open(receiptPath, "wx")
    try { await handle.writeFile(`${JSON.stringify(receipt)}\n`) } finally { await handle.close() }
    expect(await Bun.file(receiptPath).json()).toEqual(receipt)
    console.info("WEB_NATIVE_STAGE receipt-written")
    console.info(`WEB_NATIVE_QUALIFIED ${JSON.stringify({
      schema: "orchestra-web-build-summary-v1",
      repository: receipt.repository,
      sourceSHA: receipt.sourceSHA,
      workflowSHA: receipt.workflowSHA,
      target: receipt.target,
      version: receipt.version,
      modelsSha256: receipt.modelsSha256,
      archive: receipt.archive,
      web: receipt.web,
      manifestFileCount: manifest.files.length,
      manifestSha256: sha256(JSON.stringify(manifest)),
      inspected: receipt.inspected,
      providerProof: receipt.providerProof,
    })}`)
  } finally {
    await stopServices()
    if (state.denoCaptured && state.deno === undefined) delete process.env.ORCHESTRA_DISTRIBUTION_DENO
    if (state.denoCaptured && state.deno !== undefined) process.env.ORCHESTRA_DISTRIBUTION_DENO = state.deno
    if (state.denoCaptured && state.denoVersion === undefined) delete process.env.ORCHESTRA_DISTRIBUTION_DENO_VERSION
    if (state.denoCaptured && state.denoVersion !== undefined) process.env.ORCHESTRA_DISTRIBUTION_DENO_VERSION = state.denoVersion
    process.off("exit", emergencyStop)
    process.off("SIGINT", interrupt)
    process.off("SIGTERM", interrupt)
    process.off("SIGHUP", interrupt)
    if (state.hidden) await rm(state.hidden, { recursive: true, force: true })
    if (!state.hidden && state.ownsWeb) await rm(webDist, { recursive: true, force: true })
    if (state.directory) await rm(state.directory, { recursive: true, force: true })
  }
}, 1_800_000)

// Tracked worktree versus HEAD. Central CI rewrites .ci-run.json key order only.
async function requireCleanSource(git: Parameters<typeof successful>[1]) {
  const changed = await successful(["git", "diff", "--name-only", "HEAD"], git, 30_000)
  if (!changed) return
  if (changed !== ".ci-run.json") throw new Error(`TRACKED_SOURCE_DIRTY ${changed}`)
  const committed: unknown = JSON.parse(await successful(["git", "show", "HEAD:.ci-run.json"], git, 30_000))
  expect(await Bun.file(join(git.cwd, ".ci-run.json")).json()).toEqual(committed)
}
