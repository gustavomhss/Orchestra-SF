// Release-only assembler. Run with Bun 1.3.14 on the exact checked-out source SHA.
// Does not deploy, start a service, or claim authenticated native-browser acceptance.
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const cli = path.join(root, "apps/cli")
const web = path.join(root, "apps/web")
const target = "linux-x64-baseline"
const destination = process.argv[2]
const expectedSHA = process.env.SOURCE_REVISION
if (!destination || !path.isAbsolute(destination) || !destination.endsWith(".tar.gz"))
  throw new Error("SF_ORCHESTRA_WEB_ABSOLUTE_ARCHIVE_PATH_REQUIRED")
if (!expectedSHA || !/^[0-9a-f]{40}$/.test(expectedSHA))
  throw new Error("SF_ORCHESTRA_WEB_SOURCE_REVISION_REQUIRED")
if (process.platform !== "linux" || process.arch !== "x64" || process.versions.bun !== "1.3.14")
  throw new Error("SF_ORCHESTRA_WEB_LINUX_X64_BUN_1_3_14_REQUIRED")

const observed = spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: root, encoding: "utf8" })
if (observed.status !== 0 || observed.stdout.trim() !== expectedSHA)
  throw new Error("SF_ORCHESTRA_WEB_SOURCE_SHA_MISMATCH")

// Vite publishes VITE_* values into client assets. This release has no
// externally configured public VITE_* inputs: never inherit CI secrets or
// an untracked .env file into the immutable Sucafina browser bundle.
const viteKeys = Object.keys(process.env).filter((key) => key.startsWith("VITE_")).sort()
if (viteKeys.length)
  throw new Error("SF_ORCHESTRA_WEB_VITE_INPUT_FORBIDDEN: " + viteKeys.join(","))
for (const filename of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (await stat(path.join(web, filename)).then(() => true, (error) => {
    if (error && typeof error === "object" && error.code === "ENOENT") return false
    throw error
  }))
    throw new Error("SF_ORCHESTRA_WEB_VITE_ENV_FILE_FORBIDDEN: " + filename)
}

const sourceChecks = [
  ["apps/cli/src/commands/handlers/serve.ts", /sucafinaInstallations:\s*installation\?\.discovery/],
  ["apps/cli/src/sucafina-product/installation.ts", /discovery\?:\s*SfTrustedInstallationSource/],
  ["packages/app-shell/src/orchestra/sidebar.tsx", /sfNativeChapterEntry/],
]
for (const [relative, required] of sourceChecks) {
  if (!required.test(await readFile(path.join(root, relative), "utf8")))
    throw new Error(`SF_ORCHESTRA_WEB_NATIVE_WIRING_NOT_IN_SOURCE: ${relative}`)
}
const brandRoot = path.join(root, "packages/app-shell/public/brand/sucafina")
const brandFiles = [
  "logo-original.svg", "lockup-primary.svg", "lockup-inverse.svg",
  "mark-primary.svg", "mark-inverse.svg", "favicon.svg", "site.webmanifest",
]
for (const filename of brandFiles) {
  const bytes = await readFile(path.join(brandRoot, filename))
  if (bytes.length < 100) throw new Error(`SF_ORCHESTRA_WEB_ARTWORK_MISSING: ${filename}`)
}

async function command(cmd, cwd, env) {
  const child = Bun.spawn({ cmd, cwd, env, stdout: "inherit", stderr: "inherit" })
  if ((await child.exited) !== 0) throw new Error(`SF_ORCHESTRA_WEB_BUILD_FAILED: ${cmd.join(" ")}`)
}

const version = JSON.parse(await readFile(path.join(cli, "package.json"), "utf8")).version
await command([process.execPath, "script/build.ts", "--target", target, "--single", "--skip-install"], cli, {
  ...process.env, ORCHESTRA_VERSION: version, ORCHESTRA_CHANNEL: "prod",
})
// Corporate identity belongs to the build, NOT the systemd runtime environment.
await rm(path.join(web, "dist"), { recursive: true, force: true })
await command([process.execPath, "run", "build"], web, {
  ...process.env, ORCHESTRA_BRAND: "sucafina", ORCHESTRA_CHANNEL: "prod",
})

const nativeRoot = path.join(cli, "dist", `cli-${target}`)
const nativePackage = JSON.parse(await readFile(path.join(nativeRoot, "package.json"), "utf8"))
if (nativePackage.sfFactory !== "bin/local/entry.mjs" || nativePackage.version !== version)
  throw new Error("SF_ORCHESTRA_WEB_SF_FACTORY_NOT_BUNDLED")
const indexPath = path.join(web, "dist/index.html")
const index = await readFile(indexPath, "utf8")
if (!/data-orchestra-brand=["']sucafina["']/.test(index) ||
    !/data-sucafina-artwork=["']ready["']/.test(index) ||
    !/<title>Sucafina<\/title>/.test(index))
  throw new Error("SF_ORCHESTRA_WEB_BRANDED_INDEX_NOT_BUILT")

const { prepareDistribution, verifyDistribution, archiveDistribution } =
  await import(pathToFileURL(path.join(cli, "script/distribution-payload.ts")).href)
const staging = await mkdtemp(path.join(tmpdir(), "sf-orchestra-web-release-"))
let ownsArchive = false
let archiveVerified = false
try {
  const payload = path.join(staging, "payload")
  const manifest = await prepareDistribution({
    dist: path.join(cli, "dist"), web: path.join(web, "dist"), out: payload, version, target,
  })
  if (JSON.stringify(await verifyDistribution(payload, { version, target })) !== JSON.stringify(manifest))
    throw new Error("SF_ORCHESTRA_WEB_DISTRIBUTION_VERIFY_MISMATCH")
  const entries = new Set(manifest.files.map((item) => item.path))
  const requiredFiles = [
    "bin/orchestra", "bin/local/entry.mjs", "bin/local/closure.json", "bin/web/index.html",
    ...brandFiles.map((file) => `bin/web/brand/sucafina/${file}`),
  ]
  for (const file of requiredFiles)
    if (!entries.has(file)) throw new Error(`SF_ORCHESTRA_WEB_DISTRIBUTION_MISSING: ${file}`)
  if (!manifest.files.some((item) => /^bin\/web\/assets\/.*\.js$/.test(item.path)) ||
      manifest.files.some((item) => item.path.startsWith("bin/web/") && /\.map(?:\.(?:gz|br))?$/.test(item.path)))
    throw new Error("SF_ORCHESTRA_WEB_ASSETS_INCOMPLETE_OR_SOURCE_MAPS_LEAKED")
  if ((await stat(destination).then(() => true, () => false)))
    throw new Error("SF_ORCHESTRA_WEB_ARCHIVE_ALREADY_EXISTS")
  await mkdir(path.dirname(destination), { recursive: true })
  const archive = await archiveDistribution({ directory: payload, file: destination })
  ownsArchive = true
  const compressed = await readFile(destination)
  const sha256 = createHash("sha256").update(compressed).digest("hex")
  if (sha256 !== archive.sha256) throw new Error("SF_ORCHESTRA_WEB_ARCHIVE_DIGEST_MISMATCH")

  // Audit the ACTUAL delivered archive, not just the build tree. Extraction
  // outside the checkout and verifyDistribution prove every JS/CSS asset,
  // index.html, factory entry and closure against the embedded descriptor.
  const tarFiles = await new Bun.Archive(compressed).files()
  const expectedFiles = new Set([
    ...manifest.files.map((entry) => entry.path), "distribution.json", "checksums.sha256",
  ])
  if (tarFiles.size !== expectedFiles.size ||
      [...tarFiles.keys()].some((name) => !expectedFiles.has(name) || name.startsWith("/") ||
        name.split("/").some((part) => !part || part === "." || part === "..")))
    throw new Error("SF_ORCHESTRA_WEB_ARCHIVE_FILE_SET_MISMATCH")
  const extracted = path.join(staging, "extracted")
  await mkdir(extracted, { recursive: true })
  const declared = new Map(manifest.files.map((entry) => [entry.path, entry]))
  for (const [relative, file] of tarFiles) {
    const destinationFile = path.join(extracted, relative)
    const descriptor = declared.get(relative)
    await mkdir(path.dirname(destinationFile), { recursive: true })
    await writeFile(destinationFile, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o644 })
    if (descriptor?.executable) await chmod(destinationFile, 0o755)
  }
  if (JSON.stringify(await verifyDistribution(extracted, { version, target })) !== JSON.stringify(manifest))
    throw new Error("SF_ORCHESTRA_WEB_EXTRACTED_DISTRIBUTION_MISMATCH")
  archiveVerified = true
  console.log("SF_ORCHESTRA_WEB_PACKAGE_VERIFIED " + JSON.stringify({
    sourceSHA: expectedSHA, target, version, sha256, fileCount: manifest.files.length,
    webFileCount: manifest.files.filter((item) => item.path.startsWith("bin/web/")).length,
    brand: "sucafina", viteEnvironmentInputs: 0, extractedVerified: true,
    nativeBrowserProof: "REQUIRED_SEPARATELY", fullSfCi: "REQUIRED_SEPARATELY",
  }))
} finally {
  if (ownsArchive && !archiveVerified) await rm(destination, { force: true })
  await rm(staging, { recursive: true, force: true })
}
