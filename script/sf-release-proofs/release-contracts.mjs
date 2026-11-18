/**
 * SF F04/AM release admission contracts: pure predicates for fail-closed gates.
 *
 * These are structural/security checks only. A structurally valid object is NOT
 * proof that Azure, Entra, the original producer or reviewer actions happened.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"

export const CI_JOB_IDS = Object.freeze([
  "sf/preflight", "sf/static-and-contracts", "sf/linux-native-omni",
  "sf/test-CI-SF", "sf/test-CI-CLI", "sf/test-CI-APP-SRC",
  "sf/test-CI-APP-BROWSER", "sf/test-CI-ATLAS-BUSINESS",
  "sf/test-CI-UI-OPERATIONS", "sf/test-CI-UI-DECISIONS",
  "sf/test-CI-UI-REPORTS", "sf/verify",
])
export const CI_RECIPE_IDS = Object.freeze(CI_JOB_IDS.filter((id) => id.startsWith("sf/test-")))
export const PROOF_IDS = Object.freeze([
  "Q01-TRANSPORT-GUEST", "Q01-TRANSPORT-INVALID-OWNER",
  "Q01-TRANSPORT-STALE-FENCE", "U39", "U40",
  "AM01", "AM02", "AM03", "AM04", "AM05", "AM06",
])
export const AZURE_IDS = Object.freeze([
  "AZ01-DEPLOY", "AZ02-ENTRA", "AZ03-RESTORE-ROLLBACK",
  "AZ07-PROTECTED-IMMUTABLE-RELEASE",
])
const HEX40 = /^[0-9a-f]{40}$/
const HEX64 = /^[0-9a-f]{64}$/
const POSINT = /^[1-9][0-9]*$/
export function requireProof(value, code) {
  if (!value) throw new Error(code)
}
export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}
export function memberSet(actual, expected, key) {
  requireProof(Array.isArray(actual) && actual.length === expected.length &&
    actual.every((row) => row && typeof row[key] === "string") &&
    new Set(actual.map((row) => row[key])).size === expected.length &&
    expected.every((id) => actual.some((row) => row[key] === id)),
    "F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE")
}
export function assertFactoryReceipt(receipt, candidateSha, runHeadSha) {
  requireProof(HEX40.test(candidateSha ?? "") &&
    HEX40.test(runHeadSha ?? "") && runHeadSha === candidateSha,
    "F04_FACTORY_GITHUB_HEAD_SHA_NOT_C")
  requireProof(receipt?.schema === "sf-factory-package-proof-v1" &&
    receipt.sourceSHA === candidateSha &&
    receipt.checkoutSHA === candidateSha &&
    receipt.expectedSourceSHA === candidateSha &&
    HEX40.test(receipt.workflowSHA ?? "") &&
    ["push", "pull_request"].includes(receipt.eventName) &&
    (receipt.eventName !== "push" || receipt.workflowSHA === candidateSha) &&
    POSINT.test(String(receipt.runID ?? "")) &&
    POSINT.test(String(receipt.runAttempt ?? "")),
    "F04_FACTORY_SOURCE_CHECKOUT_EXPECTED_SHA_MISMATCH")
  requireProof(receipt.archiveFile === "orchestra-sf-factory-linux-x64-baseline.tar.gz" &&
    receipt.target === "linux-x64-baseline" &&
    HEX64.test(receipt.archiveSha256 ?? "") &&
    HEX64.test(receipt.manifestSha256 ?? "") &&
    HEX64.test(receipt.bundleSha256 ?? "") &&
    Number.isSafeInteger(receipt.compilerInputCount) &&
    receipt.compilerInputCount >= 750 &&
    receipt.assetCount === 24 &&
    receipt.checkedEndpoint === "/sucafina/status" &&
    receipt.origin === "http://localhost:4110" &&
    receipt.status === 200 &&
    receipt.extractedOutsideCheckout === true,
    "F04_FACTORY_UBUNTU_PACKAGE_PROOF_INCOMPLETE")
  return true
}
export function assertCliBuildReceipt(receipt, candidateSha) {
  requireProof(receipt?.schema === "orchestra-web-build-proof-v1" &&
    receipt.repository === "gustavomhss/Orchestra-SF" &&
    receipt.sourceSHA === candidateSha &&
    HEX40.test(receipt.workflowSHA ?? "") &&
    receipt.target === "linux-x64-baseline" &&
    receipt.manifest?.target === "linux-x64-baseline" &&
    receipt.manifest?.schema === "orchestra-distribution-v1" &&
    receipt.archive?.file === "orchestra-sf-linux-x64-baseline.tar.gz" &&
    HEX64.test(receipt.archive?.sha256 ?? "") &&
    receipt.inspected === true,
    "F04_CLI_BUILD_RECEIPT_SOURCE_C_NOT_QUALIFIED")
  const files=receipt.manifest.files
  requireProof(Array.isArray(files) && files.length>=4 &&
    files.every((f)=>f && typeof f.path === "string" &&
      HEX64.test(f.sha256??"") && typeof f.executable === "boolean") &&
    new Set(files.map((f)=>f.path)).size===files.length,
    "F04_CLI_BUILD_MANIFEST_INCOMPLETE")
  const at=(f)=>files.find((x)=>x.path===f)
  requireProof(at("bin/orchestra")?.executable===true &&
    at("bin/web/index.html")?.executable===false &&
    !!at("bin/hugr_omni.node") && at("bin/hugr-omni-supervisor")?.executable===true,
    "F04_CLI_OR_WEB_OMNI_MISSING")
  return at("bin/orchestra").sha256
}
export function verifyOwnerDetachedSignature(payload, signatureBase64, publicKeyPem, pinnedPemSha256) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
  const keyBytes = Buffer.isBuffer(publicKeyPem) ? publicKeyPem : Buffer.from(publicKeyPem)
  requireProof(HEX64.test(pinnedPemSha256 ?? "") && sha256(keyBytes) === pinnedPemSha256,
    "F04_GATE_OWNER_PIN_MISMATCH")
  requireProof(typeof signatureBase64 === "string" &&
    /^[A-Za-z0-9+/]{86}==$/.test(signatureBase64),
    "F04_GATE_OWNER_SIGNATURE_INVALID")
  const key = createPublicKey(keyBytes)
  const signature = Buffer.from(signatureBase64, "base64")
  requireProof(key.asymmetricKeyType === "ed25519" && signature.length===64 &&
    signature.toString("base64")===signatureBase64 &&
    verifySignature(null, bytes, key, signature),
    "F04_GATE_OWNER_SIGNATURE_INVALID")
  return true
}
function checkDistribution(b, ctx) {
  const C=ctx.candidateSha
  const d=b?.distribution
  const cli=d?.cli
  const factory=d?.factory
  const installed=d?.installed
  requireProof(cli?.artifactName === "orchestra-sf-linux-" + C &&
    Number.isSafeInteger(cli.runId) && cli.runId>0 &&
    Number.isSafeInteger(cli.attempt) && cli.attempt>0 &&
    cli.sourceSHA === C && cli.checkoutSHA === C && cli.selectedRevision === C &&
    cli.archiveFile === "orchestra-sf-linux-x64-baseline.tar.gz" &&
    [cli.archiveSha256,cli.binarySha256,cli.buildReceiptSha256].every(x=>HEX64.test(x??"")),
    "F04_GATE_CLI_ARCHIVE_BUILD_RECEIPT_C_MISMATCH")
  requireProof(typeof factory?.artifactName==="string" &&
    factory.artifactName.startsWith("sf-factory-package-") &&
    factory.artifactName.includes(C) &&
    Number.isSafeInteger(factory.runId) && factory.runId>0 &&
    Number.isSafeInteger(factory.attempt) && factory.attempt>0 &&
    factory.githubRunHeadSha===C &&
    factory.sourceSHA===C && factory.checkoutSHA===C && factory.expectedSourceSHA===C &&
    factory.archiveFile==="orchestra-sf-factory-linux-x64-baseline.tar.gz" &&
    factory.extractedOutsideCheckout===true &&
    [factory.archiveSha256,factory.manifestSha256,factory.bundleSha256,
      factory.factoryReceiptSha256,factory.githubRunSnapshotSha256].every(x=>HEX64.test(x??"")),
    "F04_GATE_FACTORY_ARCHIVE_SOURCE_OR_HEAD_MISMATCH")
  const releaseRoot="/opt/orchestra-sf/releases/"+C
  requireProof(installed?.sourceSha === C &&
    installed.artifactSha256===ctx.artifactSha256 &&
    installed.releaseRoot===releaseRoot &&
    installed.binaryPath===releaseRoot+"/bin/orchestra" &&
    installed.factoryPath===releaseRoot+"/factory/installation.mjs" &&
    installed.policyRoot===releaseRoot+"/product/ai" &&
    installed.webRoot===releaseRoot+"/web" &&
    installed.cliBinarySha256===cli.binarySha256 &&
    installed.factoryBundleSha256===factory.bundleSha256 &&
    installed.policyAssetCount===24 &&
    HEX64.test(installed.installationReceiptSha256??""),
    "F04_GATE_INSTALLED_RELEASE_PATH_OR_BINARY_DIGEST_DRIFT")
}
export function validateSignedBundleStructure(b, ctx, expectedOwnerPersonId) {
  const C=ctx.candidateSha
  requireProof(HEX40.test(C??"") && HEX40.test(ctx.treeSha??"") &&
    HEX64.test(ctx.artifactSha256??"") && HEX64.test(ctx.manifestSha256??"") &&
    b?.schema==="sf2h.f04-am-go-no-go.v1" &&
    b.candidateSha===C && b.treeSha===ctx.treeSha &&
    b.artifactSha256===ctx.artifactSha256 &&
    b.installedArtifactSha256===ctx.artifactSha256 &&
    b.manifestSha256===ctx.manifestSha256,
    "F04_GATE_FROZEN_C_TREE_MANIFEST_ARTIFACT_MISMATCH")
  checkDistribution(b,ctx)
  const ci=b.ci
  requireProof(ci?.candidateSha===C && ci.checkoutSha===C &&
    ci.effectiveGithubSha===C &&
    Number.isSafeInteger(ci.runId) && ci.runId>0 &&
    Number.isSafeInteger(ci.attempt) && ci.attempt>0 &&
    ci.verify==="success", "F04_GATE_CI_NOT_PROVEN_ON_EXACT_C")
  memberSet(ci.jobs, CI_JOB_IDS,"id")
  for(const j of ci.jobs){
    requireProof(j.conclusion==="success" &&
      Number.isSafeInteger(j.jobId) && j.jobId>0 &&
      j.runId===ci.runId && j.attempt===ci.attempt &&
      j.sourceSha===C && j.checkoutSha===C &&
      HEX64.test(j.artifactOrLogSha256??""),
      "F04_GATE_CI_JOB_NOT_QUALIFIED")
  }
  memberSet(ci.recipeReceipts, CI_RECIPE_IDS,"id")
  for(const entry of ci.recipeReceipts){
    const r=entry.receipt
    requireProof(HEX64.test(entry.sha256??"") &&
      r?.schemaVersion===1 && r.suiteId===entry.id &&
      ["bun","playwright"].includes(r.kind) &&
      r.status==="PASS" && r.exitCode===0 &&
      r.sourceSha===C && r.checkoutSha===C &&
      r.runId===String(ci.runId) && r.attempt===String(ci.attempt) &&
      r.runnerOS==="Linux" && r.runnerArch==="X64" &&
      Number.isSafeInteger(r.executedTests) && r.executedTests>0 &&
      HEX64.test(r.reportSha256??""),
      "F04_GATE_EIGHT_CI_RECIPE_SOURCE_OR_COVERAGE_MISMATCH")
  }
  memberSet(b.proofs,PROOF_IDS,"id")
  for(const p of b.proofs)
    requireProof(p.status==="PASS_REVIEWED" &&
      typeof p.independentReviewRef==="string" && p.independentReviewRef.length>=8 &&
      HEX64.test(p.processReceiptSha256??"") &&
      HEX64.test(p.originalProducerObservationSha256??""),
      "F04_GATE_PROOF_REVIEW_OR_DIGEST_MISSING")
  memberSet(b.azure,AZURE_IDS,"id")
  for(const a of b.azure)
    requireProof(a.status==="PASS_REVIEWED" && a.candidateSha===C &&
      a.artifactSha256===ctx.artifactSha256 &&
      HEX64.test(a.immutableEvidenceSha256??"") &&
      typeof a.independentReviewRef==="string" && a.independentReviewRef.length>=8,
      "F04_GATE_AZURE_NOT_QUALIFIED")
  const reviews=b.reviews
  requireProof(Array.isArray(reviews) && reviews.length===3 &&
    reviews.every(r=>typeof r.personId==="string" && !!r.personId &&
      typeof r.reviewRef==="string" && r.reviewRef.length>=8 &&
      HEX64.test(r.signedReviewSha256??"") && r.disposition==="APPROVE") &&
    new Set(reviews.map(r=>r.personId)).size===3,
    "F04_GATE_THREE_INDEPENDENT_REVIEWS_REQUIRED")
  requireProof(typeof expectedOwnerPersonId==="string" && expectedOwnerPersonId.trim() &&
    b.owner?.personId===expectedOwnerPersonId && b.owner.decision==="GO" &&
    typeof b.owner.approvalRef==="string" && b.owner.approvalRef.length>=8 &&
    typeof b.owner.approvedUtc==="string" &&
    !Number.isNaN(Date.parse(b.owner.approvedUtc)) &&
    !reviews.some(r=>r.personId===b.owner.personId),
    "F04_GATE_EXPLICIT_SEPARATE_HUMAN_OWNER_GO_REQUIRED")
  return true
}
