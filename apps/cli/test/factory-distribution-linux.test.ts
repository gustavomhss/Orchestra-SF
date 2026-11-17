import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { archiveDistribution, prepareDistribution, verifyDistribution } from "../script/distribution-payload"

const target = "linux-x64-baseline"
const cli = path.resolve(import.meta.dir, "..")
const root = path.resolve(cli, "../..")
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

// Dedicated Ubuntu native lane, not a unit fixture. Builds a REAL compiled Bun
// executable, archives, extracts, launches it and reads the real SF status route.
test("extracted Linux SF distribution loads its owner-selected factory outside the checkout", async () => {
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
    process.platform !== "linux" || process.arch !== "x64" || process.versions.bun !== "1.3.14")
    throw new Error("SF_FACTORY_HOSTED_LINUX_X64_BUN_1_3_14_REQUIRED")
  const workspace = await realpath(root)
  const external = await mkdtemp(path.join(await realpath(tmpdir()), "sf-factory-package-"))
  if (external === workspace || external.startsWith(workspace + path.sep))
    throw new Error("SF_FACTORY_TEST_NOT_OUTSIDE_CHECKOUT")
  const privateDir = path.join(external, "private-installation")
  const modelFile = path.join(external, "models.json")
  const payload = path.join(external, "payload")
  const extracted = path.join(external, "extracted")
  const archivePath = path.join(external, "factory-linux.tar.gz")
  const version = String((await Bun.file(path.join(cli, "package.json")).json()).version)
  let child: Bun.Subprocess | undefined
  try {
    await writeFile(modelFile, "{}\n", { flag: "wx" })
    const build = Bun.spawn([
      process.execPath, "script/build.ts", "--target", target, "--single", "--skip-install",
    ], {
      cwd: cli,
      env: { ...process.env, ORCHESTRA_VERSION: version, ORCHESTRA_CHANNEL: "dev", MODELS_DEV_API_JSON: modelFile },
      stdout: "pipe", stderr: "pipe",
    })
    const [buildOut, buildErr, buildCode] = await Promise.all([
      new Response(build.stdout).text(), new Response(build.stderr).text(), build.exited,
    ])
    if (buildCode !== 0) throw new Error(`SF_FACTORY_NATIVE_BUILD_FAILED (${buildCode}):\n${buildErr.slice(-8000)}\n${buildOut.slice(-2000)}`)

    const manifest = await prepareDistribution({ dist: path.join(cli, "dist"), out: payload, version, target })
    expect((await verifyDistribution(payload, { version, target }))).toEqual(manifest)
    const metadata = await Bun.file(path.join(payload, "package.json")).json()
    expect(metadata.sfFactory).toBe("bin/local/entry.mjs")
    const sf = (name: string) => manifest.files.find((item) => item.path === name)
    for (const filename of ["bin/orchestra", "bin/local/entry.mjs", "bin/local/closure.json",
      "bin/product/ai/manifests/resident.json"]) {
      expect(sf(filename)?.sha256).toMatch(/^[a-f0-9]{64}$/)
    }
    const closure = await Bun.file(path.join(payload, "bin/local/closure.json")).json()
    expect(closure.schema).toBe("sf-factory-closure-v1")
    expect(closure.bundle.sha256).toBe(sf("bin/local/entry.mjs")?.sha256)
    expect(closure.assets).toHaveLength(24)
    expect(closure.inputs.length).toBeGreaterThan(20)
    expect(closure.inputs.some((item: { path: string }) =>
      item.path === "modules/sucafina/Sucafinav1/local/entry.ts")).toBe(true)
    expect(closure.inputs.some((item: { path: string }) =>
      item.path.startsWith("apps/cli/src/sucafina-product/native-ui/"))).toBe(true)

    const archive = await archiveDistribution({ directory: payload, file: archivePath })
    const compressed = await readFile(archivePath)
    expect(digest(compressed)).toBe(archive.sha256)
    // The consumer gets only decoded archive bytes. No bun install, link to
    // node_modules, module source, or build tree is copied into this location.
    const files = await new Bun.Archive(compressed).files()
    const expected = new Set([...manifest.files.map((file) => file.path), "distribution.json", "checksums.sha256"])
    expect([...files.keys()].sort()).toEqual([...expected].sort())
    await mkdir(extracted, { recursive: true })
    for (const [relative, file] of files) {
      if (!expected.has(relative) || relative.startsWith("/") ||
        relative.split("/").some((part) => !part || part === "." || part === ".."))
        throw new Error("SF_FACTORY_ARCHIVE_ENTRY_UNSAFE")
      const to = path.join(extracted, relative)
      await mkdir(path.dirname(to), { recursive: true })
      const bytes = Buffer.from(await file.arrayBuffer())
      await writeFile(to, bytes, { flag: "wx", mode: 0o644 })
      const declared = manifest.files.find((item) => item.path === relative)
      if (declared) {
        expect(digest(bytes)).toBe(declared.sha256)
        await chmod(to, declared.executable ? 0o755 : 0o644)
      }
    }
    expect(await verifyDistribution(extracted, { version, target })).toEqual(manifest)
    expect(await lstat(path.join(extracted, "node_modules")).then(() => true, () => false)).toBe(false)
    expect(path.join(extracted, "bin/local/entry.mjs").startsWith(workspace + path.sep)).toBe(false)

    // Fault injection: a changed policy or changed bundle must invalidate the
    // distribution; restore the genuine archived bytes before running.
    for (const relative of ["bin/local/entry.mjs", "bin/product/ai/skills/sf-explicar-forecast/SKILL.md"]) {
      const file = path.join(extracted, relative)
      const original = await readFile(file)
      await writeFile(file, Buffer.concat([original, Buffer.from("\n# tamper\n")]))
      await expect(verifyDistribution(extracted, { version, target })).rejects.toThrow()
      await writeFile(file, original)
    }
    expect(await verifyDistribution(extracted, { version, target })).toEqual(manifest)

    const config = await prepareLocalConfiguration(privateDir)
    const env = {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        ["PATH", "LANG", "LC_ALL", "TZ"].includes(key))),
      HOME: privateDir,
      XDG_DATA_HOME: path.join(privateDir, "host-data"),
      XDG_CONFIG_HOME: path.join(privateDir, "host-config"),
      XDG_CACHE_HOME: path.join(privateDir, "host-cache"),
      XDG_STATE_HOME: path.join(privateDir, "host-state"),
      ORCHESTRA_CONFIG_DIR: path.join(privateDir, "host-config"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
      ORCHESTRA_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(privateDir, "host-credential.key"),
      ORCHESTRA_DB: path.join(privateDir, "host-data/orchestra.db"),
      TMPDIR: path.join(privateDir, "host-tmp"),
      SUCAFINA_LOCAL_CONFIG: config,
    }
    const launcher = path.join(extracted, "bin/orchestra")
    const factory = path.join(extracted, "bin/local/entry.mjs")
    child = Bun.spawn([launcher, "serve", "--hostname", "localhost", "--port", "4110", "--installation", factory], {
      cwd: privateDir, env, stdout: "pipe", stderr: "pipe",
    })
    const logs: string[] = []
    const collect = (stream: ReadableStream<Uint8Array>) =>
      new Response(stream).text().then((output) => { logs.push(output.slice(-5000)) }).catch(() => undefined)
    const drains = [collect(child.stdout as ReadableStream<Uint8Array>),
      collect(child.stderr as ReadableStream<Uint8Array>)]
    let response: Response | undefined
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) break
      try {
        const current = await fetch("http://localhost:4110/sucafina/status", {
          signal: AbortSignal.timeout(1000), redirect: "manual",
        })
        if (current.status === 200) { response = current; break }
      } catch { /* listener not ready yet */ }
      await Bun.sleep(500)
    }
    if (!response) throw new Error(`SF_FACTORY_COMPILED_INSTALLATION_NEVER_READY exit=${child.exitCode} ${logs.join("\n")}`)
    expect(response.headers.get("content-type")).toContain("application/json")
    const status: unknown = await response.json()
    expect(status).toMatchObject({ login: "not-configured", uploads: "unavailable-scanner-not-configured" })
    expect(child.exitCode).toBeNull()
    const receipt = {
      schema: "sf-factory-package-proof-v1", sourceSHA: process.env.GITHUB_SHA, version, target,
      archiveSha256: archive.sha256,
      manifestSha256: digest(await readFile(path.join(payload, "distribution.json"))),
      bundleSha256: closure.bundle.sha256,
      compilerInputCount: closure.inputs.length,
      assetCount: closure.assets.length,
      checkedEndpoint: "/sucafina/status",
      status: 200,
      origin: "http://localhost:4110",
      extractedOutsideCheckout: true,
    }
    const evidenceDir = path.join(root, "distribution-logs")
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(path.join(evidenceDir, "factory-package-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" })
    console.info("SF_FACTORY_PACKAGE_QUALIFIED " + JSON.stringify(receipt))
    child.kill("SIGTERM")
    await Promise.race([child.exited, Bun.sleep(5000)])
    if (child.exitCode === null) child.kill("SIGKILL")
    await child.exited
    await Promise.all(drains)
  } finally {
    if (child?.exitCode === null) {
      child.kill("SIGKILL")
      await child.exited
    }
    await rm(external, { recursive: true, force: true })
  }
}, 1_800_000)
