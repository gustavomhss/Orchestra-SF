import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { prepareOperatorAccess } from "../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import path from "node:path"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { archiveDistribution, prepareDistribution, verifyDistribution } from "../script/distribution-payload"
import { prepareNpmDistribution } from "../script/distribution-npm"
import { verifyFactoryPackageReceipt } from "../script/factory-receipt-check"
import { requireSfFactoryRunIdentity } from "./fixture/factory-proof-identity"

const target = "linux-x64-baseline"
const cli = path.resolve(import.meta.dir, "..")
const root = path.resolve(cli, "../..")
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const isWebSourceMap = (name: string) => /\.map(?:\.(?:gz|br))?$/i.test(name)

async function webBuildFilePaths(root: string, current = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, current), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = current ? `${current}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new Error("SF_FACTORY_WEB_SOURCE_SYMLINK")
    if (entry.isDirectory()) files.push(...await webBuildFilePaths(root, relative))
    else if (entry.isFile()) files.push(relative)
    else throw new Error("SF_FACTORY_WEB_SOURCE_NOT_REGULAR")
  }
  return files.sort()
}

function actualCheckoutSha() {
  const result = Bun.spawnSync(["git", "rev-parse", "--verify", "HEAD"], {
    cwd: root, stdout: "pipe", stderr: "pipe",
  })
  const sha = result.stdout.toString().trim()
  if (result.exitCode !== 0 || !/^[0-9a-f]{40}$/.test(sha))
    throw new Error("SF_FACTORY_CHECKOUT_SHA_UNAVAILABLE")
  return sha
}

function verifiedRunIdentity() {
  const expectedSourceSHA = process.env.SF_FACTORY_EXPECTED_SOURCE_SHA ?? ""
  return requireSfFactoryRunIdentity({
    // The selected source SHA comes from the event's actual PR head (or push).
    // Do not use GITHUB_SHA as sourceSHA for a pull_request: that is refs/pull/*/merge.
    sourceSHA: expectedSourceSHA,
    checkoutSHA: actualCheckoutSha(),
    expectedSourceSHA,
    workflowSHA: process.env.GITHUB_SHA ?? "",
    eventName: process.env.SF_FACTORY_EVENT_NAME as "push" | "pull_request",
    runID: process.env.SF_FACTORY_RUN_ID ?? "",
    runAttempt: process.env.SF_FACTORY_RUN_ATTEMPT ?? "",
  })
}

// Dedicated Ubuntu native lane, not a unit fixture. Builds a REAL compiled Bun
// executable, archives, extracts, launches it and reads the real SF status route.
test("extracted Linux SF distribution loads its owner-selected factory outside the checkout", async () => {
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
    process.platform !== "linux" || process.arch !== "x64" || process.versions.bun !== "1.3.14")
    throw new Error("SF_FACTORY_HOSTED_LINUX_X64_BUN_1_3_14_REQUIRED")
  const initialIdentity = verifiedRunIdentity()
  const tracked = Bun.spawnSync(["git", "status", "--porcelain", "--untracked-files=no"], {
    cwd: root, stdout: "pipe", stderr: "pipe",
  })
  if (tracked.exitCode !== 0 || tracked.stdout.toString().trim())
    throw new Error("SF_FACTORY_TRACKED_CHECKOUT_DIRTY")
  const workspace = await realpath(root)
  const external = await mkdtemp(path.join(await realpath(tmpdir()), `sf-factory-package-${initialIdentity.runID}-${initialIdentity.runAttempt}-`))
  if (external === workspace || external.startsWith(workspace + path.sep))
    throw new Error("SF_FACTORY_TEST_NOT_OUTSIDE_CHECKOUT")
  const webDist = path.join(root, "apps/web/dist")
  const preexistingWeb = await lstat(webDist).then(() => true, (error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false
    throw error
  })
  if (preexistingWeb) throw new Error("SF_FACTORY_WEB_DIST_NOT_CLEAN")
  let ownsWeb = false
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

    // Qualify the very same archive containing CLI + SF factory + public Web.
    // Original Vite maps stay in the private build tree; #254 strips them only
    // from the published payload, rejects inline maps and checks verification.
    ownsWeb = true
    const webBuild = Bun.spawn([
      process.execPath, "run", "--cwd", path.join(root, "apps/web"), "build",
    ], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe" })
    const [webOut, webErr, webCode] = await Promise.all([
      new Response(webBuild.stdout).text(), new Response(webBuild.stderr).text(), webBuild.exited,
    ])
    if (webCode !== 0) throw new Error(`SF_FACTORY_WEB_BUILD_FAILED (${webCode}):\n${webErr.slice(-8000)}\\n${webOut.slice(-2000)}`)
    const rawWebFiles = await webBuildFilePaths(webDist)
    const rawWebSourceMaps = rawWebFiles.filter(isWebSourceMap)
    expect(rawWebSourceMaps.length).toBeGreaterThan(0) // Negative control: builder still contains private maps.
    const webIndexSha256 = digest(await readFile(path.join(webDist, "index.html")))
    const manifest = await prepareDistribution({ dist: path.join(cli, "dist"), web: webDist, out: payload, version, target })
    expect((await verifyDistribution(payload, { version, target }))).toEqual(manifest)
    const metadata = await Bun.file(path.join(payload, "package.json")).json()
    expect(metadata.sfFactory).toBe("bin/local/entry.mjs")
    const publishedWebFiles = manifest.files.filter((item) => item.path.startsWith("bin/web/"))
    expect(publishedWebFiles.length).toBe(rawWebFiles.length - rawWebSourceMaps.length)
    expect(publishedWebFiles.length).toBeGreaterThan(0)
    expect(publishedWebFiles.filter((entry) => isWebSourceMap(entry.path))).toHaveLength(0)
    expect(manifest.files.find((entry) => entry.path === "bin/web/index.html")?.sha256)
      .toBe(webIndexSha256)
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
    expect([...files.keys()].filter((name) => name.startsWith("bin/web/") && isWebSourceMap(name))).toHaveLength(0)
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

    // The npm channel reconstructs each target package from the verified payload.
    // It must retain the SF declaration instead of rejecting its copied assets.
    const npmRoot = path.join(external, "npm")
    await prepareNpmDistribution({ payloads: [payload], out: npmRoot })
    const npmTarget = path.join(npmRoot, `cli-${target}`)
    const npmManifest = await verifyDistribution(npmTarget, { version, target })
    const npmMetadata = await Bun.file(path.join(npmTarget, "package.json")).json()
    expect(npmMetadata.sfFactory).toBe("bin/local/entry.mjs")
    expect(npmManifest.files.find((file) => file.path === "bin/local/entry.mjs")?.sha256)
      .toBe(closure.bundle.sha256)
    expect(await Bun.file(path.join(npmRoot, "cli/package.json")).exists()).toBe(true)

    const config = await prepareLocalConfiguration(privateDir)
    // An unconfigured /status never builds the decisions host. Activate a real
    // local operator so the CLI/factory identity split fails during composition.
    const access = await prepareOperatorAccess(config, true)
    const handoff = (await readFile(access.artifact, "utf8"))
      .match(/location\.replace\(("(?:\\.|[^"\\])*")\)/)?.[1]
    if (!handoff) throw new Error("SF_FACTORY_OPERATOR_HANDOFF_UNAVAILABLE")
    const loginUrl: string = JSON.parse(handoff)
    if (new URL(loginUrl).origin !== "http://localhost:4110" ||
      new URL(loginUrl).pathname !== "/sucafina/auth/local")
      throw new Error("SF_FACTORY_OPERATOR_HANDOFF_ORIGIN_INVALID")
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
    expect(status).toMatchObject({ login: "local-operator", uploads: "unavailable-scanner-not-configured" })
    expect(child.exitCode).toBeNull()
    const webResponse = await fetch("http://localhost:4110/", {
      redirect: "error", signal: AbortSignal.timeout(15000),
    })
    expect(webResponse.status).toBe(200)
    expect(digest(new Uint8Array(await webResponse.arrayBuffer()))).toBe(webIndexSha256)
    // This is the full extracted native binary with real owner enrollment.
    const login = await fetch(loginUrl, { redirect: "manual", signal: AbortSignal.timeout(15000) })
    expect(login.status).toBe(303)
    const cookie = login.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("SF_FACTORY_AUTHENTICATED_COOKIE_MISSING")
    const dashboard = await fetch("http://localhost:4110/sucafina/dashboard", {
      headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(15000),
    })
    expect(dashboard.status).toBe(200)
    expect(await dashboard.text()).toContain("Homologação local")
    const currentChoiceEndpoint = "/sucafina/dashboard?sf=current-choice&format=json"
    const currentChoice = await fetch("http://localhost:4110" + currentChoiceEndpoint, {
      headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(15000),
    })
    expect(currentChoice.status).toBe(200)
    expect(await currentChoice.json()).toMatchObject({ status: "ok", value: { cases: [] } })
    // Re-read the real checkout HEAD immediately before certifying the archive.
    // The success receipt MUST be rejected if the source branch changed in-flight.
    const runIdentity = verifiedRunIdentity()
    if (runIdentity.sourceSHA !== initialIdentity.sourceSHA ||
      runIdentity.runID !== initialIdentity.runID || runIdentity.runAttempt !== initialIdentity.runAttempt)
      throw new Error("SF_FACTORY_RUN_IDENTITY_CHANGED")
    const receipt = {
      schema: "sf-factory-package-proof-v1", sourceSHA: runIdentity.sourceSHA,
      checkoutSHA: runIdentity.checkoutSHA, expectedSourceSHA: runIdentity.expectedSourceSHA,
      workflowSHA: runIdentity.workflowSHA, eventName: runIdentity.eventName,
      runID: runIdentity.runID, runAttempt: runIdentity.runAttempt, version, target,
      archiveFile: "orchestra-sf-factory-linux-x64-baseline.tar.gz",
      archiveSha256: archive.sha256,
      manifestSha256: digest(await readFile(path.join(payload, "distribution.json"))),
      bundleSha256: closure.bundle.sha256,
      compilerInputCount: closure.inputs.length,
      assetCount: closure.assets.length,
      web: {
        originalFileCount: rawWebFiles.length,
        originalSourceMapCount: rawWebSourceMaps.length,
        publishedFileCount: publishedWebFiles.length,
        publishedSourceMapCount: 0,
        indexSha256: webIndexSha256,
      },
      checkedEndpoint: "/sucafina/status",
      status: 200,
      authentication: "local-operator", loginStatus: login.status,
      authenticatedDashboardStatus: dashboard.status,
      currentChoiceEndpoint, currentChoiceStatus: currentChoice.status,
      origin: "http://localhost:4110",
      extractedOutsideCheckout: true,
    }
    // An upload from another workflow run/attempt must never share this namespace.
    const evidenceDir = path.join(root, "distribution-logs", `${runIdentity.runID}-${runIdentity.runAttempt}`)
    await mkdir(evidenceDir, { recursive: true })
    // Publish only qualification artifacts (not a GitHub release). Hashes pin
    // the same compressed bytes that were extracted and executed above.
    await writeFile(path.join(evidenceDir, receipt.archiveFile), compressed, { flag: "wx" })
    await writeFile(path.join(evidenceDir, "distribution.json"),
      await readFile(path.join(payload, "distribution.json")), { flag: "wx" })
    await writeFile(path.join(evidenceDir, "factory-closure.json"),
      await readFile(path.join(payload, "bin/local/closure.json")), { flag: "wx" })
    await writeFile(path.join(evidenceDir, "factory-package-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" })
    const expectedReceiptIdentity = {
      sourceSHA: runIdentity.sourceSHA,
      checkoutSHA: runIdentity.checkoutSHA,
      workflowSHA: runIdentity.workflowSHA,
      eventName: runIdentity.eventName,
      runID: runIdentity.runID,
      runAttempt: runIdentity.runAttempt,
    }
    // Independent reread of the uploaded bytes, not the producer's captured Map.
    const attested = await verifyFactoryPackageReceipt(evidenceDir, expectedReceiptIdentity)
    expect(attested.archiveSha256).toBe(receipt.archiveSha256)
    expect(attested.webSourceMaps).toBe(0)
    const receiptFile = path.join(evidenceDir, "factory-package-receipt.json")
    const genuineReceiptBytes = await readFile(receiptFile)
    try {
      await writeFile(receiptFile, JSON.stringify({ ...receipt, currentChoiceStatus: 503 }) + "\n")
      await expect(verifyFactoryPackageReceipt(evidenceDir, expectedReceiptIdentity))
        .rejects.toThrow("SF_FACTORY_RECEIPT_QUALIFICATION_FIELDS_INVALID")
    } finally {
      await writeFile(receiptFile, genuineReceiptBytes)
    }
    try {
      await writeFile(receiptFile, JSON.stringify({ ...receipt, sourceSHA: "0".repeat(40) }) + "\n")
      await expect(verifyFactoryPackageReceipt(evidenceDir, expectedReceiptIdentity))
        .rejects.toThrow("SF_FACTORY_RECEIPT_SOURCE_SHA_MISMATCH")
    } finally {
      await writeFile(receiptFile, genuineReceiptBytes)
    }
    const manifestFile = path.join(evidenceDir, "distribution.json")
    const genuineManifestBytes = await readFile(manifestFile)
    try {
      await writeFile(manifestFile, Buffer.concat([genuineManifestBytes, Buffer.from("\n")]))
      await expect(verifyFactoryPackageReceipt(evidenceDir, expectedReceiptIdentity))
        .rejects.toThrow("SF_FACTORY_RECEIPT_ARCHIVE_OR_MANIFEST_DIGEST_MISMATCH")
    } finally {
      await writeFile(manifestFile, genuineManifestBytes)
    }
    // No successful receipt marker is emitted until both tamper controls pass.
    expect((await verifyFactoryPackageReceipt(evidenceDir, expectedReceiptIdentity)).sourceSHA)
      .toBe(runIdentity.checkoutSHA)
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
    if (ownsWeb) await rm(webDist, { recursive: true, force: true })
  }
}, 1_800_000)

test("factory receipt fails closed on divergent source SHA, PR synthetic merge SHA, dirty checkout and invalid run identity", () => {
  const base = {
    sourceSHA: "a".repeat(40),
    checkoutSHA: "a".repeat(40),
    expectedSourceSHA: "a".repeat(40),
    workflowSHA: "b".repeat(40),
    eventName: "pull_request" as const,
    runID: "43988598685",
    runAttempt: "1",
  }
  expect(requireSfFactoryRunIdentity(base).sourceSHA).toBe(base.checkoutSHA)
  expect(() => requireSfFactoryRunIdentity({ ...base, sourceSHA: base.workflowSHA }))
    .toThrow("SF_FACTORY_SOURCE_SHA_MISMATCH")
  expect(() => requireSfFactoryRunIdentity({ ...base, checkoutSHA: "c".repeat(40) }))
    .toThrow("SF_FACTORY_SOURCE_SHA_MISMATCH")
  expect(() => requireSfFactoryRunIdentity({ ...base, expectedSourceSHA: "c".repeat(40) }))
    .toThrow("SF_FACTORY_SOURCE_SHA_MISMATCH")
  expect(() => requireSfFactoryRunIdentity({ ...base, eventName: "push" }))
    .toThrow("SF_FACTORY_PUSH_WORKFLOW_SHA_MISMATCH")
  expect(() => requireSfFactoryRunIdentity({ ...base, runID: "../other-run" }))
    .toThrow("SF_FACTORY_RUN_IDENTITY_INVALID")
})
