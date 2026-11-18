#!/usr/bin/env node
/**
 * A9 release proof gate. Not a deploy trigger.
 * GO requires independently reviewed live receipts, all 12 CI jobs on C,
 * real Azure restore/Entra/deploy evidence AND an externally signed owner GO.
 * A runner or PR author cannot grant themselves GO.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import path from "node:path"
import { runnerIdentity, privateRoot, privateFile, verifyInstalled } from "./installed-manifest.mjs"
import { validateSignedBundleStructure, verifyOwnerDetachedSignature, sha256 } from "./release-contracts.mjs"
import { verifyDistributionOnDisk } from "./verify-distribution.mjs"

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
async function checkedDir(dir) {
  const s=await lstat(dir)
  must(s.isDirectory()&&!s.isSymbolicLink()&&(s.mode&0o777)===0o700 &&
    (typeof process.getuid!=="function"||s.uid===process.getuid()) &&
    await realpath(dir)===dir, "F04_GATE_PRIVATE_DIRECTORY_0700_REQUIRED")
  return dir
}
async function verifyRealCiReceiptBytes(b,root) {
  const folder=await checkedDir(path.join(root,"ci-receipts"))
  for(const row of b.ci.recipeReceipts){
    const id=row.id.slice("sf/test-".length)
    must(/^CI-[A-Z-]+$/.test(id),"F04_GATE_CI_RECEIPT_ID_INVALID")
    const bytes=await checkedEvidence(path.join(folder,id+".json"),folder)
    must(sha256(bytes)===row.sha256 && 
      isDeepStrictEqual(JSON.parse(bytes.toString("utf8")),row.receipt) &&
      row.receipt.sourceSha===b.candidateSha &&
      row.receipt.checkoutSha===b.candidateSha,
      "F04_GATE_RAW_CI_RECEIPT_SOURCE_OR_DIGEST_DRIFT")
  }
}
async function verifyAzureFiles(b,root){
  const folder=await checkedDir(path.join(root,"azure-evidence"))
  for(const a of b.azure){
    must(/^AZ0[1237]-[A-Z-]+$/.test(a.id),"F04_GATE_AZURE_ID_INVALID")
    const bytes=await checkedEvidence(path.join(folder,a.id+".json"),folder)
    const doc=JSON.parse(bytes.toString("utf8"))
    must(sha256(bytes)===a.immutableEvidenceSha256 &&
      doc.id===a.id && doc.candidateSha===b.candidateSha &&
      doc.artifactSha256===b.artifactSha256 && doc.status==="PASS_REVIEWED",
      "F04_GATE_RAW_AZURE_WITNESS_DIGEST_OR_C_MISMATCH")
  }
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
  verifyOwnerDetachedSignature(raw,signature,key,keyPin)
  const b = JSON.parse(raw.toString("utf8"))
  validateSignedBundleStructure(b,{...ctx,manifestSha256:installed.manifestSha256},
    process.env.SF_NATIVE_OWNER_PERSON_ID)
  await verifyDistributionOnDisk(b.distribution,ctx,root)
  await verifyRealCiReceiptBytes(b,root)
  exactMembers(b.proofs, PROOFS, "id")
  const witnessKeyPath = process.env.SF_NATIVE_WITNESS_PUBLIC_KEY_FILE
  const witnessPin = process.env.SF_NATIVE_WITNESS_TRUST_SHA256
  must(typeof witnessKeyPath === "string" && path.isAbsolute(witnessKeyPath) &&
    SHA256.test(witnessPin ?? ""), "F04_GATE_WITNESS_TRUST_PIN_REQUIRED")
  const witnessKeyBytes = await readFile(witnessKeyPath)
  must(sha(witnessKeyBytes) === witnessPin, "F04_GATE_WITNESS_KEY_PIN_MISMATCH")
  const witnessKey = createPublicKey(witnessKeyBytes)
  must(witnessKey.asymmetricKeyType === "ed25519", "F04_GATE_WITNESS_KEY_TYPE_INVALID")
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
    const batchBytes = await checkedEvidence(path.join(folder, "receipt.json"), folder)
    const observationBytes = await checkedEvidence(path.join(folder, "observation-receipt.json"), folder)
    const witnessBytes = await privateFile(path.join(root, mode + "-witness.json"), root)
    const witnessSignature = (await privateFile(path.join(root, mode + "-witness.sig"), root, 2048))
      .toString("utf8").trim()
    must(/^[A-Za-z0-9+/]{86}==$/.test(witnessSignature) &&
      verifySignature(null, witnessBytes, witnessKey, Buffer.from(witnessSignature, "base64")),
      "F04_GATE_WITNESS_SIGNATURE_NOT_VERIFIED")
    const w = JSON.parse(witnessBytes)
    must(w.schema === "sf2h.native-original-producer-witness.v1" &&
      w.proofId === mode && w.candidateSha === ctx.candidateSha &&
      w.treeSha === ctx.treeSha && w.artifactSha256 === ctx.artifactSha256 &&
      w.manifestSha256 === installed.manifestSha256 &&
      w.processReceiptSha256 === sha(batchBytes) &&
      w.reportSha256 === JSON.parse(batchBytes).reportSha256 &&
      SHA256.test(w.originalProducerSha256 ?? "") &&
      SHA256.test(w.actorAuthorizationSha256 ?? "") &&
      SHA256.test(w.taskPermissionRelaySha256 ?? "") &&
      (mode !== "q01" || (SHA256.test(w.negativeDenialSha256 ?? "") &&
        SHA256.test(w.zeroNetworkDispatchSha256 ?? ""))) &&
      (mode === "q01" || (SHA256.test(w.sourceCasSha256 ?? "") &&
        Array.isArray(w.operationReceiptSha256) && w.operationReceiptSha256.length > 0 &&
        w.operationReceiptSha256.every((v) => SHA256.test(v)))),
      "F04_GATE_SIGNED_ORIGINAL_PRODUCER_WITNESS_INCOMPLETE")
    must(sha(processBytes) === proof.processReceiptSha256 &&
      sha(observationBytes) === proof.originalProducerObservationSha256,
      "F04_GATE_PROOF_EVIDENCE_DIGEST_DRIFT")
    const processReceipt = JSON.parse(processBytes)
    const observed = JSON.parse(observationBytes)
    must(processReceipt.proofId === proof.id || processReceipt.proofId === mode,
      "F04_GATE_PROOF_ID_MISMATCH")
    must(processReceipt.status === "TEST_EXECUTED_REQUIRE_ORIGINAL_PRODUCER_WITNESS_AND_REVIEW" &&
      observed.status === "SIGNED_ORIGINAL_PRODUCER_OBSERVATION_PENDING_INDEPENDENT_REVIEW" &&
      observed.proofId === mode && observed.processReceiptSha256 === sha(batchBytes) &&
      observed.witnessSha256 === sha(witnessBytes) &&
      observed.witnessKeySha256 === sha(witnessKeyBytes) &&
      processReceipt.sourceSha === ctx.candidateSha &&
      processReceipt.gitCheckoutSha === ctx.candidateSha &&
      processReceipt.githubEventSha === ctx.candidateSha &&
      Number.isSafeInteger(processReceipt.githubRunId) && processReceipt.githubRunId > 0 &&
      Number.isSafeInteger(processReceipt.githubRunAttempt) && processReceipt.githubRunAttempt > 0 &&
      Number.isSafeInteger(processReceipt.githubJobId) && processReceipt.githubJobId > 0 &&
      processReceipt.exitCode === 0 &&
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
  await verifyAzureFiles(b,root)
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
    cliBuildRunId: b.distribution.cli.runId, factoryRunId: b.distribution.factory.runId,
    ownerSignedBundleSha256: sha(raw), ciRunId: ci.runId, proofCount: b.proofs.length,
    azureCount: b.azure.length, independentReviewCount: reviewers.length }))
}
main().catch((err) => {
  console.error(JSON.stringify({ verdict: "NO_GO",
    code: err?.message?.startsWith("F04_") ? err.message : "F04_GATE_INPUT_OR_EVIDENCE_REJECTED" }))
  process.exitCode = 3
})
