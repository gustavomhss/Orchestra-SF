import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

export type FactoryReceiptIdentity = {
  sourceSHA: string
  checkoutSHA: string
  workflowSHA: string
  eventName: "push" | "pull_request"
  runID: string
  runAttempt: string
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const sha40 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/.test(value)
const sha64 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value)
const runNumber = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)
const validPath = (value: unknown): value is string =>
  typeof value === "string" && /^[\x20-\x7e]+$/.test(value) &&
  !/[\\:<>"|?*]/.test(value) && !value.startsWith("/") &&
  value.split("/").every((part) => part && part !== "." && part !== "..")
const sourceMap = (name: string) => /\.map(?:\.(?:gz|br))?$/i.test(name)
function fail(code: string): never { throw new Error(`SF_FACTORY_RECEIPT_${code}`) }

/**
 * An independent validator for the actual uploaded archive, not the build-time
 * manifest object. Called after real extracted native execution, before upload.
 * Refuses a PR synthetic merge SHA substituted for the branch source.
 */
export async function verifyFactoryPackageReceipt(directory: string, expected: FactoryReceiptIdentity) {
  if (!sha40(expected.sourceSHA) || !sha40(expected.checkoutSHA) || !sha40(expected.workflowSHA) ||
    !runNumber(expected.runID) || !runNumber(expected.runAttempt) ||
    !["push", "pull_request"].includes(expected.eventName)) fail("EXPECTED_RUN_IDENTITY_INVALID")
  if (expected.sourceSHA !== expected.checkoutSHA ||
    (expected.eventName === "push" && expected.sourceSHA !== expected.workflowSHA))
    fail("EXPECTED_SOURCE_SHA_MISMATCH")

  const receipt: unknown = JSON.parse(await readFile(path.join(directory, "factory-package-receipt.json"), "utf8"))
  if (!object(receipt) || receipt.schema !== "sf-factory-package-proof-v1")
    fail("SCHEMA_INVALID")
  if (receipt.sourceSHA !== expected.sourceSHA ||
    receipt.checkoutSHA !== expected.checkoutSHA ||
    receipt.expectedSourceSHA !== expected.sourceSHA)
    fail("SOURCE_SHA_MISMATCH")
  if (receipt.workflowSHA !== expected.workflowSHA || receipt.eventName !== expected.eventName ||
    receipt.runID !== expected.runID || receipt.runAttempt !== expected.runAttempt)
    fail("WORKFLOW_IDENTITY_MISMATCH")
  if (receipt.archiveFile !== "orchestra-sf-factory-linux-x64-baseline.tar.gz" ||
    !sha64(receipt.archiveSha256) || !sha64(receipt.manifestSha256) ||
    !sha64(receipt.bundleSha256) || receipt.version !== "1.18.27" ||
    receipt.target !== "linux-x64-baseline" || receipt.assetCount !== 24 ||
    !Number.isSafeInteger(receipt.compilerInputCount) || Number(receipt.compilerInputCount) < 1 ||
    receipt.checkedEndpoint !== "/sucafina/status" || receipt.status !== 200 ||
    receipt.authentication !== "local-operator" || receipt.loginLandingStatus !== 200 ||
    receipt.dashboardGateStatus !== 303 || receipt.currentChoiceGateStatus !== 303 ||
    receipt.authenticatedDashboardStatus !== 404 || receipt.authenticatedCurrentChoiceStatus !== 200 ||
    receipt.authenticatedCurrentChoiceState !== "ok" ||
    receipt.currentChoiceEndpoint !== "/sucafina/dashboard?sf=current-choice&format=json" ||
    receipt.origin !== "http://localhost:4120" || receipt.extractedOutsideCheckout !== true)
    fail("QUALIFICATION_FIELDS_INVALID")
  const web = receipt.web
  if (!object(web) || !Number.isSafeInteger(web.originalFileCount) ||
    !Number.isSafeInteger(web.originalSourceMapCount) || !Number.isSafeInteger(web.publishedFileCount) ||
    Number(web.originalFileCount) <= 0 || Number(web.originalSourceMapCount) <= 0 ||
    Number(web.publishedFileCount) <= 0 || web.publishedSourceMapCount !== 0 ||
    !sha64(web.indexSha256) ||
    Number(web.publishedFileCount) !== Number(web.originalFileCount) - Number(web.originalSourceMapCount))
    fail("WEB_MAP_PROOF_INVALID")

  const [archiveBytes, manifestBytes, closureBytes] = await Promise.all([
    readFile(path.join(directory, receipt.archiveFile)),
    readFile(path.join(directory, "distribution.json")),
    readFile(path.join(directory, "factory-closure.json")),
  ])
  if (sha256(archiveBytes) !== receipt.archiveSha256 ||
    sha256(manifestBytes) !== receipt.manifestSha256)
    fail("ARCHIVE_OR_MANIFEST_DIGEST_MISMATCH")
  const manifest: unknown = JSON.parse(manifestBytes.toString("utf8"))
  if (!object(manifest) || Object.keys(manifest).sort().join(",") !== "files,schema,target,version" ||
    manifest.schema !== "orchestra-distribution-v1" || manifest.target !== receipt.target ||
    manifest.version !== receipt.version || !Array.isArray(manifest.files) || !manifest.files.length)
    fail("MANIFEST_INVALID")
  const files = manifest.files as unknown[]
  if (files.some((file) => !object(file) || Object.keys(file).sort().join(",") !== "executable,path,sha256" ||
    !validPath(file.path) || !sha64(file.sha256) || typeof file.executable !== "boolean"))
    fail("MANIFEST_ENTRY_INVALID")
  const named = files as { path: string; sha256: string; executable: boolean }[]
  const paths = named.map((file) => file.path)
  if (new Set(paths).size !== paths.length || paths.join("\n") !== [...paths].sort().join("\n"))
    fail("MANIFEST_PATH_SET_INVALID")
  const lookup = new Map(named.map((file) => [file.path, file]))
  if (!lookup.get("bin/orchestra")?.executable ||
    lookup.get("bin/local/entry.mjs")?.sha256 !== receipt.bundleSha256 ||
    !lookup.has("bin/product/ai/manifests/resident.json") ||
    !lookup.has("bin/web/index.html") ||
    lookup.get("bin/web/index.html")?.sha256 !== web.indexSha256 ||
    lookup.get("bin/local/closure.json")?.sha256 !== sha256(closureBytes))
    fail("REQUIRED_FACTORY_OR_WEB_HASH_MISSING")
  const webFiles = named.filter((file) => file.path.startsWith("bin/web/"))
  if (webFiles.length !== web.publishedFileCount || webFiles.some((file) => sourceMap(file.path)))
    fail("WEB_SOURCE_MAP_IN_MANIFEST")
  const closure: unknown = JSON.parse(closureBytes.toString("utf8"))
  if (!object(closure) || closure.schema !== "sf-factory-closure-v1" ||
    !object(closure.bundle) || closure.bundle.path !== "bin/local/entry.mjs" ||
    closure.bundle.sha256 !== receipt.bundleSha256 ||
    !Array.isArray(closure.inputs) || closure.inputs.length !== receipt.compilerInputCount ||
    !Array.isArray(closure.assets) || closure.assets.length !== receipt.assetCount)
    fail("FACTORY_CLOSURE_MISMATCH")

  const archived = await new Bun.Archive(archiveBytes).files()
  const expectedFiles = [...paths, "distribution.json", "checksums.sha256"].sort()
  if ([...archived.keys()].sort().join("\n") !== expectedFiles.join("\n"))
    fail("ARCHIVE_SET_MISMATCH")
  const archivedManifest = archived.get("distribution.json")
  const archivedClosure = archived.get("bin/local/closure.json")
  if (!archivedManifest || !Buffer.from(await archivedManifest.arrayBuffer()).equals(manifestBytes) ||
    !archivedClosure || !Buffer.from(await archivedClosure.arrayBuffer()).equals(closureBytes))
    fail("ARCHIVE_DESCRIPTOR_BYTES_MISMATCH")
  for (const item of named) {
    const file = archived.get(item.path)
    if (!file || sha256(new Uint8Array(await file.arrayBuffer())) !== item.sha256)
      fail("ARCHIVED_FILE_SHA256_MISMATCH")
  }
  const table = archived.get("checksums.sha256")
  const expectedTable = [...named, { path: "distribution.json", sha256: sha256(manifestBytes) }]
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(({ path: name, sha256: digest }) => `${digest}  ${name}\n`).join("")
  if (!table || Buffer.from(await table.arrayBuffer()).toString("utf8") !== expectedTable)
    fail("CHECKSUM_TABLE_MISMATCH")
  const packageFile = archived.get("package.json")
  const metadata: unknown = packageFile ? JSON.parse(await packageFile.text()) : undefined
  if (!object(metadata) || metadata.sfFactory !== "bin/local/entry.mjs")
    fail("FACTORY_NOT_DECLARED")
  return Object.freeze({
    sourceSHA: receipt.sourceSHA, checkoutSHA: receipt.checkoutSHA,
    workflowSHA: receipt.workflowSHA, runID: receipt.runID, runAttempt: receipt.runAttempt,
    archiveSha256: receipt.archiveSha256, manifestSha256: receipt.manifestSha256,
    fileCount: named.length, webFileCount: webFiles.length, webSourceMaps: 0,
  })
}

if (import.meta.main) {
  const [directory] = process.argv.slice(2)
  if (!directory) throw new Error("Usage: bun script/factory-receipt-check.ts <run-scoped-directory>")
  const result = await verifyFactoryPackageReceipt(directory, {
    sourceSHA: process.env.SF_FACTORY_EXPECTED_SOURCE_SHA ?? "",
    checkoutSHA: process.env.SF_FACTORY_CHECKOUT_SHA ?? "",
    workflowSHA: process.env.GITHUB_SHA ?? "",
    eventName: process.env.GITHUB_EVENT_NAME as "push" | "pull_request",
    runID: process.env.GITHUB_RUN_ID ?? "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  })
  console.info("SF_FACTORY_RECEIPT_VERIFIED " + JSON.stringify(result))
}
