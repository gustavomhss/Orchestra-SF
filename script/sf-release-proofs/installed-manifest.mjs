#!/usr/bin/env node
/**
 * A9 / F04: installer-bound emission of sf2h.native-installed-manifest.v1.
 *
 * No actor, cookie, session, grant, or installed source is synthesized here.
 * The authorized Azure installer supplies a signed claim AFTER A7 deploy and
 * A8's observed original-producer / Entra bindings. Missing evidence is fatal.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { execFileSync } from "node:child_process"
import { lstat, mkdir, open, readFile, realpath, unlink } from "node:fs/promises"
import path from "node:path"

const SHA40 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const ROOT_NAME = "native-installed-manifest.json"
const CLAIM_NAME = "installer-claim.json"
const SIGNATURE_NAME = "installer-claim.sig"
const RECEIPT_NAME = "manifest-receipt.json"

function must(ok, code) { if (!ok) throw new Error(code) }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex") }
function exact(obj, keys) {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj) &&
    Object.keys(obj).length === keys.length && keys.every((key) => Object.hasOwn(obj, key))
}
function txt(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 &&
    !/[\x00-\x1f\x7f]/.test(value)
}
function git(args) {
  try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() }
  catch { throw new Error("F04_REPOSITORY_CHECKOUT_REQUIRED") }
}
export function runnerIdentity() {
  must(process.platform === "linux" && process.arch === "x64" &&
    process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_OS === "Linux" &&
    process.env.RUNNER_ARCH === "X64", "F04_AUTHORIZED_LINUX_ACTIONS_RUNNER_REQUIRED")
  const candidateSha = process.env.SF_NATIVE_CANDIDATE_SHA
  const treeSha = process.env.SF_NATIVE_CANDIDATE_TREE_SHA
  const artifactSha256 = process.env.SF_NATIVE_INSTALLED_ARTIFACT_SHA256
  must(SHA40.test(candidateSha ?? "") && SHA40.test(treeSha ?? "") &&
    SHA256.test(artifactSha256 ?? ""), "F04_FROZEN_C_TREE_ARTIFACT_REQUIRED")
  must(git(["rev-parse", "HEAD"]) === candidateSha &&
    git(["rev-parse", "HEAD^{tree}"]) === treeSha,
    "F04_CHECKOUT_MUST_EQUAL_FROZEN_C")
  return { candidateSha, treeSha, artifactSha256 }
}
function rootPath() {
  const root = process.env.SF_NATIVE_SCRATCH_ROOT
  must(typeof root === "string" && path.isAbsolute(root) && root === path.resolve(root) &&
    root !== "/" && !root.endsWith("/"), "F04_ABSOLUTE_PRIVATE_SCRATCH_ROOT_REQUIRED")
  return root
}
async function noSymlinkComponents(fullPath) {
  let item = path.parse(fullPath).root
  for (const part of fullPath.slice(item.length).split(path.sep).filter(Boolean)) {
    item = path.join(item, part)
    const stat = await lstat(item)
    must(!stat.isSymbolicLink(), "F04_SYMLINK_IN_PRIVATE_PATH")
  }
}
export async function privateRoot({ create = false } = {}) {
  const root = rootPath()
  if (create) {
    try { await mkdir(root, { mode: 0o700 }) }
    catch (err) { if (err?.code !== "EEXIST") throw err }
  }
  await noSymlinkComponents(root)
  const stat = await lstat(root)
  must(stat.isDirectory() && !stat.isSymbolicLink() &&
    (stat.mode & 0o777) === 0o700 &&
    (typeof process.getuid !== "function" || stat.uid === process.getuid()) &&
    await realpath(root) === root, "F04_SCRATCH_ROOT_MUST_BE_0700_OWNED_REAL_DIRECTORY")
  return root
}
export async function privateFile(file, root, max = 65536) {
  must(path.isAbsolute(file) && path.resolve(file) === file && path.dirname(file) === root,
    "F04_PRIVATE_FILE_MUST_BE_DIRECT_CHILD")
  const s = await lstat(file)
  must(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 &&
    s.size > 0 && s.size <= max && (s.mode & 0o777) === 0o600 &&
    (typeof process.getuid !== "function" || s.uid === process.getuid()) &&
    await realpath(file) === file, "F04_FILE_MUST_BE_0600_OWNED_REGULAR")
  return readFile(file)
}
export async function createPrivateFile(file, root, content) {
  must(path.dirname(file) === root && path.resolve(file) === file,
    "F04_PRIVATE_OUTPUT_MUST_BE_IN_SCRATCH_ROOT")
  const h = await open(file, "wx", 0o600)
  try {
    await h.writeFile(content)
    await h.sync()
  } catch (err) {
    await h.close()
    await unlink(file).catch(() => {})
    throw err
  }
  await h.close()
  await privateFile(file, root, 1024 * 1024)
}
function validateTarget(obj) {
  const keys = ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin",
    "installationId", "projectId", "hostId", "mount", "chapterHref"]
  must(exact(obj, keys) && keys.every((key) => txt(obj[key])), "F04_TARGET_EXACT_FIELDS_REQUIRED")
  for (const key of ["discoveryOrigin", "shellOrigin", "publicOrigin"]) {
    let url
    try { url = new URL(obj[key]) }
    catch { throw new Error("F04_TARGET_ORIGIN_INVALID") }
    must(url.origin === obj[key] && url.protocol === "https:" &&
      !url.username && !url.password && !url.hash, "F04_AZURE_HTTPS_ORIGIN_REQUIRED")
  }
  must(/^\/[A-Za-z0-9_/-]+$/.test(obj.mount) &&
    !obj.mount.includes("//") && !obj.mount.endsWith("/") &&
    obj.chapterHref.startsWith("/") && !obj.chapterHref.startsWith("//") &&
    new URL(obj.chapterHref, obj.shellOrigin).origin === obj.shellOrigin,
    "F04_INVALID_MOUNT_OR_CHAPTER")
}
function validateManifest(m, ctx, root) {
  must(exact(m, ["schema", "candidateSha", "target", "wrongServer",
    "wrongProject", "wrongInstallation", "actors", "scratchRoot"]) &&
    m.schema === "sf2h.native-installed-manifest.v1" &&
    m.candidateSha === ctx.candidateSha && m.scratchRoot === root,
    "F04_MANIFEST_SCHEMA_C_OR_ROOT_MISMATCH")
  for (const key of ["target", "wrongServer", "wrongProject", "wrongInstallation"])
    validateTarget(m[key])
  must(m.target.serverKey !== m.wrongServer.serverKey &&
    m.target.projectId !== m.wrongProject.projectId &&
    m.target.installationId !== m.wrongInstallation.installationId &&
    m.target.publicOrigin === m.wrongProject.publicOrigin &&
    m.target.publicOrigin === m.wrongInstallation.publicOrigin &&
    new Set(["target", "wrongServer", "wrongProject", "wrongInstallation"]
      .map((k) => JSON.stringify(m[k]))).size === 4,
    "F04_THREE_REAL_WRONG_BOUNDARIES_REQUIRED")
  must(exact(m.actors, ["requester", "holder", "denied"]) ||
    exact(m.actors, ["requester", "holder", "denied", "dashboardAdmin"]),
    "F04_EXACT_ACTOR_SET_REQUIRED")
  const values = Object.values(m.actors)
  must(values.every(txt) && new Set(values).size === values.length,
    "F04_ACTOR_REFS_MUST_BE_DISTINCT_REAL_PRINCIPALS")
}
async function signedInstallerClaim(ctx, root) {
  const payloadBytes = await privateFile(path.join(root, CLAIM_NAME), root)
  const sigBytes = await privateFile(path.join(root, SIGNATURE_NAME), root, 2048)
  const trustedKeyFile = process.env.SF_NATIVE_INSTALLER_PUBLIC_KEY_FILE
  const trustedKeyHash = process.env.SF_NATIVE_INSTALLER_TRUST_SHA256
  must(typeof trustedKeyFile === "string" && path.isAbsolute(trustedKeyFile) &&
    SHA256.test(trustedKeyHash ?? ""), "F04_PINNED_EXTERNAL_INSTALLER_TRUST_REQUIRED")
  const keyBytes = await readFile(trustedKeyFile)
  must(sha(keyBytes) === trustedKeyHash, "F04_INSTALLER_PUBLIC_KEY_PIN_MISMATCH")
  const publicKey = createPublicKey(keyBytes)
  must(publicKey.asymmetricKeyType === "ed25519", "F04_ED25519_INSTALLER_KEY_REQUIRED")
  const encodedSignature = sigBytes.toString("utf8").trim()
  must(/^[A-Za-z0-9+/]{86}==$/.test(encodedSignature) ||
    /^[A-Za-z0-9+/]{87}=$/.test(encodedSignature),
    "F04_INSTALLER_SIGNATURE_INVALID_ENCODING")
  must(verifySignature(null, payloadBytes, publicKey, Buffer.from(encodedSignature, "base64")),
    "F04_INSTALLER_SIGNATURE_DID_NOT_VERIFY")
  const claim = JSON.parse(payloadBytes.toString("utf8"))
  must(exact(claim, ["schema", "candidateSha", "treeSha", "artifactSha256",
    "manifest", "observations"]) && claim.schema === "sf2h.native-installer-attestation.v1" &&
    claim.candidateSha === ctx.candidateSha &&
    claim.treeSha === ctx.treeSha &&
    claim.artifactSha256 === ctx.artifactSha256,
    "F04_SIGNED_INSTALLER_C_TREE_ARTIFACT_MISMATCH")
  const obs = claim.observations
  must(exact(obs, ["installationReceiptSha256", "entraActorWitnessSha256",
    "originalProducerWitnessSha256", "observedAt"]) &&
    ["installationReceiptSha256", "entraActorWitnessSha256", "originalProducerWitnessSha256"]
      .every((key) => SHA256.test(obs[key])) &&
    txt(obs.observedAt) && Number.isFinite(Date.parse(obs.observedAt)),
    "F04_INDEPENDENT_ORIGINAL_INSTALLER_WITNESSES_REQUIRED")
  validateManifest(claim.manifest, ctx, root)
  return { claim, claimSha256: sha(payloadBytes), trustKeySha256: sha(keyBytes) }
}
export async function verifyInstalled() {
  const ctx = runnerIdentity()
  const root = await privateRoot()
  const { claim, claimSha256, trustKeySha256 } = await signedInstallerClaim(ctx, root)
  const file = path.join(root, ROOT_NAME)
  must(process.env.SF_NATIVE_INSTALLED_MANIFEST === file,
    "F04_MANIFEST_PATH_MUST_EQUAL_INSTALLED_OUTPUT")
  const bytes = await privateFile(file, root)
  let installed
  try { installed = JSON.parse(bytes.toString("utf8")) }
  catch { throw new Error("F04_INSTALLED_MANIFEST_MALFORMED") }
  must(JSON.stringify(installed) === JSON.stringify(claim.manifest),
    "F04_INSTALLED_MANIFEST_DIFFERS_FROM_SIGNED_INSTALLER")
  const receipt = JSON.parse((await privateFile(path.join(root, RECEIPT_NAME), root)).toString("utf8"))
  must(exact(receipt, ["schema", "status", "candidateSha", "treeSha", "artifactSha256",
    "manifestSha256", "signedClaimSha256", "trustKeySha256", "actorRefsSha256",
    "createdUtc"]) && receipt.schema === "sf2h.installed-manifest-receipt.v1" &&
    receipt.status === "SIGNED_INSTALLER_SOURCE_VERIFIED_NOT_LIVE_ACCEPTANCE" &&
    receipt.candidateSha === ctx.candidateSha && receipt.treeSha === ctx.treeSha &&
    receipt.artifactSha256 === ctx.artifactSha256 &&
    receipt.manifestSha256 === sha(bytes) && receipt.signedClaimSha256 === claimSha256 &&
    receipt.trustKeySha256 === trustKeySha256 &&
    receipt.actorRefsSha256 === sha(Object.values(installed.actors).sort().join("\n")),
    "F04_MANIFEST_RECEIPT_MISMATCH")
  return { ctx, root, manifest: installed, manifestSha256: sha(bytes), receipt }
}
async function main() {
  const command = process.argv[2]
  if (!["prepare-root", "emit", "verify"].includes(command) || process.argv.length !== 3)
    throw new Error("F04_USAGE_PREPARE_ROOT_EMIT_VERIFY")
  const ctx = runnerIdentity()
  if (command === "prepare-root") {
    await privateRoot({ create: true })
    console.log(JSON.stringify({ status: "PRIVATE_ROOT_READY_NOT_AUTHENTICATED", candidateSha: ctx.candidateSha }))
    return
  }
  if (command === "emit") {
    const root = await privateRoot()
    const { claim, claimSha256, trustKeySha256 } = await signedInstallerClaim(ctx, root)
    const data = Buffer.from(JSON.stringify(claim.manifest, null, 2) + "\n", "utf8")
    const receipt = {
      schema: "sf2h.installed-manifest-receipt.v1",
      status: "SIGNED_INSTALLER_SOURCE_VERIFIED_NOT_LIVE_ACCEPTANCE",
      ...ctx, manifestSha256: sha(data), signedClaimSha256: claimSha256,
      trustKeySha256, actorRefsSha256: sha(Object.values(claim.manifest.actors).sort().join("\n")),
      createdUtc: new Date().toISOString(),
    }
    await createPrivateFile(path.join(root, ROOT_NAME), root, data)
    await createPrivateFile(path.join(root, RECEIPT_NAME), root,
      Buffer.from(JSON.stringify(receipt, null, 2) + "\n"))
    const check = await verifyInstalled()
    console.log(JSON.stringify({ status: check.receipt.status, candidateSha: ctx.candidateSha,
      manifestSha256: check.manifestSha256, actorCount: Object.keys(check.manifest.actors).length }))
    return
  }
  const check = await verifyInstalled()
  console.log(JSON.stringify({ status: check.receipt.status, candidateSha: ctx.candidateSha,
    manifestSha256: check.manifestSha256, actorCount: Object.keys(check.manifest.actors).length }))
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  main().catch((err) => { console.error(err?.message?.startsWith("F04_") ? err.message :
    "F04_PRIVATE_INSTALLER_OPERATION_FAILED"); process.exitCode = 2 })
