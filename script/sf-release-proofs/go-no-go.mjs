#!/usr/bin/env node
/**
 * A9 release proof gate. Not a deploy trigger.
 * GO requires independently reviewed live receipts, all 12 CI jobs on C,
 * real Azure restore/Entra/deploy evidence AND an externally signed owner GO.
 * A runner or PR author cannot grant themselves GO.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { runnerIdentity, privateRoot, privateFile, verifyInstalled } from "./installed-manifest.mjs"

const CI = ["sf/preflight", "sf/static-and-contracts", "sf/linux-native-omni",
  "sf/test-CI-SF", "sf/test-CI-CLI", "sf/test-CI-APP-SRC",
  "sf/test-CI-APP-BROWSER", "sf/test-CI-ATLAS-BUSINESS",
  "sf/test-CI-UI-OPERATIONS", "sf/test-CI-UI-DECISIONS",
  "sf/test-CI-UI-REPORTS", "sf/verify"]
const PROOFS = ["Q01-TRANSPORT-GUEST", "Q01-TRANSPORT-INVALID-OWNER",
  "Q01-TRANSPORT-STALE-FENCE", "U39", "U40",
  "AM01", "AM02", "AM03", "AM04", "AM05", "AM06"]
const AZURE = ["AZ01-DEPLOY", "AZ02-ENTRA", "AZ03-RESTORE-ROLLBACK",
  "AZ07-PROTECTED-IMMUTABLE-RELEASE"]
const SHA256 = /^[0-9a-f]{64}$/
const SHA40 = /^[0-9a-f]{40}$/
function must(ok, code) { if (!ok) throw new Error(code) }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex") }
function exactMembers(actual, expected, field) {
  must(Array.isArray(actual) && actual.length === expected.length &&
    actual.every((row) => typeof row?.[field] === "string") &&
    new Set(actual.map((row) => row[field])).size === expected.length &&
    expected.every((id) => actual.some((row) => row[field] === id)),
    "F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE")
}
async function checkedEvidence(file, directory) {
  must(path.dirname(file) === directory && path.resolve(file) === file,
    "F04_GATE_EVIDENCE_PATH_ESCAPE")
  const st = await lstat(file)
  must(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 &&
    (st.mode & 0o777) === 0o600 && st.size > 0 && st.size <= 1024 * 1024 &&
    (typeof process.getuid !== "function" || st.uid === process.getuid()) &&
    await realpath(file) === file, "F04_GATE_NONPRIVATE_EVIDENCE_FILE")
  return readFile(file)
}
async function main() {
  must(process.argv.length === 3 && process.argv[2] === "check",
    "F04_GATE_USAGE_CHECK")
  const ctx = runnerIdentity()
  const installed = await verifyInstalled()
  const root = await privateRoot()
  const raw = await privateFile(path.join(root, "go-no-go-bundle.json"), root, 1024 * 1024)
  const signature = (await privateFile(path.join(root, "go-no-go-bundle.sig"), root, 2048))
    .toString("utf8").trim()
  const keyFile = process.env.SF_NATIVE_OWNER_PUBLIC_KEY_FILE
  const keyPin = process.env.SF_NATIVE_OWNER_TRUST_SHA256
  must(typeof keyFile === "string" && path.isAbsolute(keyFile) &&
    SHA256.test(keyPin ?? ""), "F04_GATE_OWNER_PUBLIC_KEY_PIN_REQUIRED")
  const key = await readFile(keyFile)
  must(sha(key) === keyPin, "F04_GATE_OWNER_PIN_MISMATCH")
  const signingKey = createPublicKey(key)
  must(signingKey.asymmetricKeyType === "ed25519" &&
    /^[A-Za-z0-9+/]{86}==$/.test(signature) &&
    verifySignature(null, raw, signingKey, Buffer.from(signature, "base64")),
    "F04_GATE_OWNER_SIGNATURE_INVALID")
  const b = JSON.parse(raw.toString("utf8"))
  must(b.schema === "sf2h.f04-am-go-no-go.v1" &&
    b.candidateSha === ctx.candidateSha && b.treeSha === ctx.treeSha &&
    b.artifactSha256 === ctx.artifactSha256 &&
    b.installedArtifactSha256 === ctx.artifactSha256 &&
    b.manifestSha256 === installed.manifestSha256,
    "F04_GATE_FROZEN_C_TREE_MANIFEST_ARTIFACT_MISMATCH")
  const ci = b.ci
  must(ci?.candidateSha === ctx.candidateSha &&
    ci.checkoutSha === ctx.candidateSha && ci.effectiveGithubSha === ctx.candidateSha &&
    Number.isSafeInteger(ci.runId) && ci.runId > 0 &&
    Number.isSafeInteger(ci.attempt) && ci.attempt > 0 &&
    ci.verify === "success" &&
    Array.isArray(ci.jobs), "F04_GATE_CI_NOT_PROVEN_ON_EXACT_C")
  exactMembers(ci.jobs, CI, "id")
  for (const job of ci.jobs) {
    must(job.conclusion === "success" && Number.isSafeInteger(job.jobId) &&
      job.jobId > 0 && job.runId === ci.runId && job.attempt === ci.attempt &&
      job.checkoutSha === ctx.candidateSha &&
      SHA256.test(job.artifactOrLogSha256),
      "F04_GATE_CI_JOB_NOT_QUALIFIED")
  }
  must(Array.isArray(ci.recipeReceipts) && ci.recipeReceipts.length === 8 &&
    ci.recipeReceipts.every((r) => typeof r.id === "string" &&
      SHA256.test(r.sha256) && r.checkoutSha === ctx.candidateSha),
    "F04_GATE_EIGHT_CI_RECIPE_RECEIPTS_REQUIRED")
  exactMembers(ci.recipeReceipts, CI.filter((v) => v.startsWith("sf/test-")), "id")
  exactMembers(b.proofs, PROOFS, "id")
  const proofDir = path.join(root, "proofs")
  for (const proof of b.proofs) {
    must(proof.status === "PASS_REVIEWED" &&
      typeof proof.independentReviewRef === "string" &&
      proof.independentReviewRef.length >= 8 &&
      SHA256.test(proof.processReceiptSha256) &&
      SHA256.test(proof.originalProducerObservationSha256),
      "F04_GATE_PROOF_REVIEW_OR_DIGEST_MISSING")
    const mode = proof.id.startsWith("Q01-") ? "q01" : proof.id.toLowerCase()
    const folder = path.join(proofDir, mode)
    const processName = mode === "q01" ? proof.id.toLowerCase() + ".json" : "receipt.json"
    const processBytes = await checkedEvidence(path.join(folder, processName), folder)
    const observationBytes = await checkedEvidence(path.join(folder, "observation-receipt.json"), folder)
    must(sha(processBytes) === proof.processReceiptSha256 &&
      sha(observationBytes) === proof.originalProducerObservationSha256,
      "F04_GATE_PROOF_EVIDENCE_DIGEST_DRIFT")
    const processReceipt = JSON.parse(processBytes)
    const observed = JSON.parse(observationBytes)
    must(processReceipt.proofId === proof.id || processReceipt.proofId === mode,
      "F04_GATE_PROOF_ID_MISMATCH")
    must(processReceipt.status === "TEST_EXECUTED_REQUIRE_ORIGINAL_PRODUCER_WITNESS_AND_REVIEW" &&
      observed.status === "SIGNED_ORIGINAL_PRODUCER_OBSERVATION_PENDING_INDEPENDENT_REVIEW" &&
      observed.proofId === mode && processReceipt.exitCode === 0 &&
      processReceipt.skipped === 0 && processReceipt.retries === 0 &&
      processReceipt.executedCount > 0 &&
      processReceipt.candidateSha === ctx.candidateSha &&
      observed.candidateSha === ctx.candidateSha &&
      processReceipt.treeSha === ctx.treeSha && observed.treeSha === ctx.treeSha &&
      processReceipt.artifactSha256 === ctx.artifactSha256 &&
      observed.artifactSha256 === ctx.artifactSha256 &&
      processReceipt.manifestSha256 === installed.manifestSha256 &&
      observed.manifestSha256 === installed.manifestSha256 &&
      SHA256.test(observed.witnessSha256),
      "F04_GATE_PROOF_ORIGINAL_PRODUCER_NOT_OBSERVED")
  }
  exactMembers(b.azure, AZURE, "id")
  for (const a of b.azure) {
    must(a.status === "PASS_REVIEWED" && SHA256.test(a.immutableEvidenceSha256) &&
      a.candidateSha === ctx.candidateSha &&
      a.artifactSha256 === ctx.artifactSha256 &&
      typeof a.independentReviewRef === "string" && a.independentReviewRef.length >= 8,
      "F04_GATE_AZURE_RESTORE_ENTRA_DEPLOY_RELEASE_NOT_ATTESTED")
  }
  const reviewers = b.reviews
  must(Array.isArray(reviewers) && reviewers.length === 3 &&
    reviewers.every((r) => typeof r.personId === "string" && r.personId &&
      typeof r.reviewRef === "string" && r.reviewRef.length >= 8 &&
      SHA256.test(r.signedReviewSha256) && r.disposition === "APPROVE") &&
    new Set(reviewers.map((r) => r.personId)).size === 3,
    "F04_GATE_THREE_INDEPENDENT_REVIEWS_REQUIRED")
  must(b.owner?.decision === "GO" && typeof b.owner.personId === "string" &&
    !!b.owner.personId && !reviewers.some((r) => r.personId === b.owner.personId) &&
    typeof b.owner.approvalRef === "string" && b.owner.approvalRef.length >= 8 &&
    Number.isFinite(Date.parse(b.owner.approvedUtc)) &&
    SHA40.test(b.candidateSha),
    "F04_GATE_EXPLICIT_SEPARATE_HUMAN_OWNER_GO_REQUIRED")
  console.log(JSON.stringify({ verdict: "GO_OWNER_SIGNED_EVIDENCE_ACCEPTED_NOT_DEPLOY_EXECUTED",
    candidateSha: ctx.candidateSha, manifestSha256: installed.manifestSha256,
    ownerSignedBundleSha256: sha(raw), ciRunId: ci.runId, proofCount: b.proofs.length,
    azureCount: b.azure.length, independentReviewCount: reviewers.length }))
}
main().catch((err) => {
  console.error(JSON.stringify({ verdict: "NO_GO",
    code: err?.message?.startsWith("F04_") ? err.message : "F04_GATE_INPUT_OR_EVIDENCE_REJECTED" }))
  process.exitCode = 3
})
