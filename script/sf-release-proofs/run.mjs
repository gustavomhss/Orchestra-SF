#!/usr/bin/env node
/**
 * A9 W4 installed Azure proof executor; does NOT mint actors, manifests,
 * permissions, grants, native producer receipts or an approval.
 * Usage: node script/sf-release-proofs/run.mjs run|attest q01|u39|u40|am01..am06
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { spawnSync, execFileSync } from "node:child_process"
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runnerIdentity, privateRoot, privateFile, verifyInstalled } from "./installed-manifest.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CAT_PATH = path.join(ROOT, "script/sf-release-proofs/catalog.json")
const SHA256 = /^[a-f0-9]{64}$/
const modes = ["q01", "u39", "u40", "am01", "am02", "am03", "am04", "am05", "am06"]
function must(cond, code) { if (!cond) throw new Error(code) }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex") }
function runGit(args) {
  try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim() }
  catch { throw new Error("F04_PROOF_GIT_SOURCE_REQUIRED") }
}
async function verifyDir(dir) {
  const st = await lstat(dir)
  must(st.isDirectory() && !st.isSymbolicLink() && (st.mode & 0o777) === 0o700 &&
    (typeof process.getuid !== "function" || st.uid === process.getuid()) &&
    await realpath(dir) === dir, "F04_PROOF_DIRECTORY_NOT_0700")
  return dir
}
async function evidenceFile(file, parent) {
  must(path.dirname(file) === parent && path.resolve(file) === file, "F04_EVIDENCE_PATH_ESCAPE")
  const st = await lstat(file)
  must(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 &&
    (st.mode & 0o777) === 0o600 && st.size > 0 &&
    (typeof process.getuid !== "function" || st.uid === process.getuid()) &&
    await realpath(file) === file, "F04_EVIDENCE_FILE_NOT_PRIVATE")
  return readFile(file)
}
async function writePrivate(file, parent, bytes) {
  must(path.dirname(file) === parent && path.resolve(file) === file, "F04_EVIDENCE_OUTPUT_ESCAPE")
  const h = await open(file, "wx", 0o600)
  try { await h.writeFile(bytes); await h.sync() } finally { await h.close() }
  await evidenceFile(file, parent)
}
function command(cmd, args, cwd, env) {
  return spawnSync(cmd, args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
}
function selectFiles(cat, mode) {
  if (mode.startsWith("am")) return cat[mode].files.map((f) => path.join("modules/sucafina", f))
  return [path.join(cat[mode].cwd, cat[mode].file)]
}
function checkTrackedSelection(cat, mode) {
  const selected = selectFiles(cat, mode)
  must(selected.length > 0 && new Set(selected).size === selected.length, "F04_SELECTION_EMPTY_OR_DUPLICATED")
  for (const file of selected) {
    must(runGit(["ls-files", "--", file]) === file, "F04_SELECTED_SOURCE_NOT_TRACKED")
  }
  if (mode.startsWith("am")) {
    const dir = "modules/sucafina/Sucafinav1/test/product/integrated-proofs/" + mode
    const actual = runGit(["ls-files", "--", dir]).split("\n")
      .filter((s) => s.endsWith(".test.ts")).sort()
    must(JSON.stringify(actual) === JSON.stringify([...selected].sort()),
      "F04_AM_DISCOVERY_DRIFT_INCLUDING_A5_SEQUENCE_INTEGRITY")
  }
  return selected.map((file) => ({ path: file, sha256: sha(
    Buffer.from(runGit(["hash-object", file]) + "\n")) }))
}
async function validateReport(mode, report) {
  const res = command("python3", [path.join(ROOT, "script/sf-release-proofs/verify-junit.py"), report, mode], ROOT, process.env)
  must(res.status === 0 && !res.error, "F04_JUNIT_CASE_IDENTITY_GATE_RED")
  const parsed = JSON.parse(res.stdout)
  must(parsed.status === "TEST_CASES_VERIFIED_NOT_LIVE_ACCEPTANCE" &&
    parsed.proofId === mode && parsed.skipped === 0 && parsed.failed === 0 &&
    parsed.todo === 0 && parsed.caseCount > 0,
    "F04_JUNIT_SUMMARY_UNACCEPTABLE")
  return parsed
}
function sourceDigests(selected) {
  return selected.map(({ path: f }) => ({
    file: f, sha256: sha(execFileSync("git", ["show", "HEAD:" + f], { cwd: ROOT })),
  }))
}
function runnerEvidence(ctx, installed, mode, report, summary, files) {
  const runId = process.env.GITHUB_RUN_ID
  const attempt = process.env.GITHUB_RUN_ATTEMPT
  const job = process.env.SF_NATIVE_PROOF_JOB_ID
  must(/^[1-9]\d*$/.test(runId ?? "") && /^[1-9]\d*$/.test(attempt ?? "") &&
    /^[1-9]\d*$/.test(job ?? ""), "F04_GITHUB_RUN_ATTEMPT_AND_JOB_ID_REQUIRED")
  return {
    schema: "sf2h.native-proof-run-receipt.v1",
    status: "TEST_EXECUTED_REQUIRE_ORIGINAL_PRODUCER_WITNESS_AND_REVIEW",
    proofId: mode, candidateSha: ctx.candidateSha, treeSha: ctx.treeSha,
    artifactSha256: ctx.artifactSha256, manifestSha256: installed.manifestSha256,
    gitCheckoutSha: runGit(["rev-parse", "HEAD"]),
    githubRunId: Number(runId), githubRunAttempt: Number(attempt),
    githubJobId: Number(job), runner: "Linux/X64",
    reportSha256: sha(report), sourceFiles: sourceDigests(files),
    caseIds: summary.cases, executedCount: summary.caseCount,
    skipped: 0, retries: 0, exitCode: 0, createdUtc: new Date().toISOString(),
  }
}
async function execute(mode, installed, cat, folder) {
  const { ctx } = installed
  must(runGit(["status", "--porcelain", "--untracked-files=no"]) === "",
    "F04_PROOF_CHECKOUT_DIRTY")
  const selected = checkTrackedSelection(cat, mode)
  const evidence = path.join(folder, mode)
  await mkdir(evidence, { mode: 0o700 })
  await verifyDir(evidence)
  const reportPath = path.join(evidence, "report.xml")
  const logPath = path.join(evidence, "process.log")
  const spec = cat[mode]
  let cmd, args, cwd, env = { ...process.env }
  process.umask(0o077)
  if (mode === "q01") {
    cwd = path.join(ROOT, spec.cwd)
    cmd = "bun"
    args = ["test", "--conditions=browser", "--preload", "../../script/test-omni-control.ts",
      "--preload", "./happydom.ts", "./" + spec.file,
      "--reporter=junit", "--reporter-outfile=" + reportPath]
    env.ORCHESTRA_OMNI_CONTROL = "declared"
  } else if (mode === "u39" || mode === "u40") {
    cwd = path.join(ROOT, spec.cwd)
    cmd = "bun"
    args = ["run", "test:e2e:local", spec.file, "--config",
      "e2e/playwright.production.config.ts", "--workers", "1", "--retries", "0",
      "--reporter=junit"]
    env.PLAYWRIGHT_JUNIT_OUTPUT_FILE = reportPath
    env.PLAYWRIGHT_JUNIT_STRIP_ANSI = "true"
  } else {
    cwd = path.join(ROOT, spec.cwd)
    cmd = "bun"
    args = ["test", ...spec.files, "--reporter=junit", "--reporter-outfile=" + reportPath]
  }
  const res = command(cmd, args, cwd, env)
  await writePrivate(logPath, evidence,
    Buffer.from((res.stdout ?? "") + "\n" + (res.stderr ?? "") || "NO_OUTPUT"))
  must(!res.error && res.signal === null && res.status === 0,
    "F04_PROOF_PROCESS_RED_OR_INTERRUPTED")
  const report = await evidenceFile(reportPath, evidence)
  must(report.length <= 32 * 1024 * 1024, "F04_JUNIT_OVERSIZE")
  const summary = await validateReport(mode, reportPath)
  must(summary.reportSha256 === sha(report), "F04_JUNIT_REPORT_DIGEST_DRIFT")
  await writePrivate(path.join(evidence, "summary.json"), evidence,
    Buffer.from(JSON.stringify(summary, null, 2) + "\n"))
  const receipt = runnerEvidence(ctx, installed, mode, report, summary, selected)
  await writePrivate(path.join(evidence, "receipt.json"), evidence,
    Buffer.from(JSON.stringify(receipt, null, 2) + "\n"))
  if (mode === "q01") {
    // Three individual receipts; all are tied to the actual single three-case run.
    for (const id of cat.q01.caseIds) {
      const found = summary.cases.filter((s) => s.includes(id))
      must(found.length === 1, "F04_Q01_CASE_RECEIPT_NOT_UNIQUE")
      await writePrivate(path.join(evidence, id.toLowerCase() + ".json"), evidence,
        Buffer.from(JSON.stringify({
          ...receipt, schema: "sf2h.native-q01-case-receipt.v1",
          proofId: id, caseIds: found, executedCount: 1,
        }, null, 2) + "\n"))
    }
  }
  console.log(JSON.stringify({ proofId: mode, status: receipt.status,
    caseCount: summary.caseCount, reportSha256: receipt.reportSha256,
    candidateSha: ctx.candidateSha }))
}
async function attest(mode, installed, folder) {
  const { ctx, root } = installed
  const dir = await verifyDir(path.join(folder, mode))
  const bytes = await evidenceFile(path.join(dir, "receipt.json"), dir)
  const receipt = JSON.parse(bytes)
  must(receipt.status === "TEST_EXECUTED_REQUIRE_ORIGINAL_PRODUCER_WITNESS_AND_REVIEW" &&
    receipt.proofId === mode && receipt.candidateSha === ctx.candidateSha &&
    receipt.treeSha === ctx.treeSha && receipt.artifactSha256 === ctx.artifactSha256 &&
    receipt.manifestSha256 === installed.manifestSha256,
    "F04_EXECUTED_RECEIPT_BOUNDARY_MISMATCH")
  const witnessBytes = await privateFile(path.join(root, mode + "-witness.json"), root)
  const sigBytes = await privateFile(path.join(root, mode + "-witness.sig"), root, 2048)
  const keyPath = process.env.SF_NATIVE_WITNESS_PUBLIC_KEY_FILE
  const pin = process.env.SF_NATIVE_WITNESS_TRUST_SHA256
  must(typeof keyPath === "string" && path.isAbsolute(keyPath) && SHA256.test(pin ?? ""),
    "F04_INDEPENDENT_WITNESS_TRUST_ANCHOR_REQUIRED")
  const keyBytes = await readFile(keyPath)
  must(sha(keyBytes) === pin, "F04_WITNESS_KEY_PIN_MISMATCH")
  const key = createPublicKey(keyBytes)
  const encoded = sigBytes.toString("utf8").trim()
  must(key.asymmetricKeyType === "ed25519" && /^[A-Za-z0-9+/]{86}==$/.test(encoded) &&
    verifySignature(null, witnessBytes, key, Buffer.from(encoded, "base64")),
    "F04_INDEPENDENT_WITNESS_SIGNATURE_INVALID")
  const w = JSON.parse(witnessBytes)
  must(w.schema === "sf2h.native-original-producer-witness.v1" &&
    w.proofId === mode && w.candidateSha === ctx.candidateSha &&
    w.treeSha === ctx.treeSha && w.artifactSha256 === ctx.artifactSha256 &&
    w.manifestSha256 === installed.manifestSha256 &&
    w.processReceiptSha256 === sha(bytes) && w.reportSha256 === receipt.reportSha256 &&
    [w.originalProducerSha256, w.actorAuthorizationSha256, w.taskPermissionRelaySha256,
      w.sourceCasSha256].every((v) => SHA256.test(v ?? "")) &&
    typeof w.witnessedBy === "string" && !!w.witnessedBy &&
    typeof w.observedUtc === "string" && Number.isFinite(Date.parse(w.observedUtc)) &&
    Array.isArray(w.operationReceiptSha256) && w.operationReceiptSha256.length > 0 &&
    w.operationReceiptSha256.every((v) => SHA256.test(v)),
    "F04_WITNESS_ORIGINAL_AUTHORITY_OR_DIGEST_INCOMPLETE")
  const observation = {
    schema: "sf2h.native-proof-observation-receipt.v1",
    status: "SIGNED_ORIGINAL_PRODUCER_OBSERVATION_PENDING_INDEPENDENT_REVIEW",
    proofId: mode, candidateSha: ctx.candidateSha, treeSha: ctx.treeSha,
    artifactSha256: ctx.artifactSha256, manifestSha256: installed.manifestSha256,
    processReceiptSha256: sha(bytes), witnessSha256: sha(witnessBytes),
    witnessKeySha256: sha(keyBytes), witnessedBy: w.witnessedBy,
    createdUtc: new Date().toISOString(),
  }
  await writePrivate(path.join(dir, "observation-receipt.json"), dir,
    Buffer.from(JSON.stringify(observation, null, 2) + "\n"))
  console.log(JSON.stringify({ proofId: mode, status: observation.status,
    candidateSha: ctx.candidateSha, witnessSha256: observation.witnessSha256 }))
}
async function main() {
  const [action, mode] = process.argv.slice(2)
  must(process.argv.length === 4 && ["run", "attest"].includes(action) &&
    modes.includes(mode), "F04_USAGE_RUN_OR_ATTEST_VALID_PROOF_ID")
  runnerIdentity()
  const installed = await verifyInstalled()
  const catalog = JSON.parse(await readFile(CAT_PATH, "utf8"))
  must(catalog.schema === "sf2h.f04-am-proofs-catalog.v1", "F04_PROOF_CATALOG_NOT_ADMITTED")
  const root = await privateRoot()
  const folder = path.join(root, "proofs")
  if (action === "run") {
    try { await mkdir(folder, { mode: 0o700 }) }
    catch (e) { if (e?.code !== "EEXIST") throw e }
    await verifyDir(folder)
    await execute(mode, installed, catalog, folder)
  } else {
    await verifyDir(folder)
    await attest(mode, installed, folder)
  }
}
main().catch((err) => {
  console.error(err?.message?.startsWith("F04_") ? err.message :
    "F04_PROOF_EXECUTION_REJECTED")
  process.exitCode = 2
})
