import assert from "node:assert/strict"
import { hash, parseCanonicalJson } from "./team-profile-residue.mjs"

export const original = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  sourceSHA: "e32bd1186d966de218d49825aca00728d2e87175",
  sourceTreeSHA: "7aa75b671a2d52cd01197bf6bbdf8eff70fa76c7",
  runId: 44937176924,
  runAttempt: 1,
  checkRunId: 136946260313,
  workflowId: 417570814,
  workflowSHA: "47c0e101f3ce03edd58e5ca84fe88fec9f09e591",
  artifactId: 14720407018,
  containerDigest: "sha256:b94e62d50aec2a06422ee69c5fc8c319cd20be1f9ef0e66898a7fd6f9c92b15c",
  bun: "1.4.1",
  bunRevision: "1.4.1+4661e494f",
  bunArchiveSha256: "a8c9c6738202e2fced555dd860a953c56c0cd059f75041e7010ae81a32802646",
  packedCliSha256: "50156243867766b0db81c4a12091ed204b0046ac9d12b8cc97c7ec33b9ae882d",
  ledgerSha256: "9d26d74340518aabfeaf49f71fffec576f4d4733ff000da9c22347f399b7a594",
  webManifestSha256: "90138f95e16d81600bab0ba9c6f03e20f479b383370d0e63c467ead4ddcd7b07",
  tar: "orchestra-sf-entra-linux-x64-baseline.tar.gz",
  tarSHA: "04226af757d903dc496f6a5f5599864f325a278c5cf141216a5ce7a36bb3a9c1",
  manifestSHA: "0d08fcbdc405c943e0a2942bc899cef215990fbd0fc5957cea5b287a32c72a9a",
})

export function verifyProducer(run, artifact) {
  assert.deepEqual([run.id, run.run_attempt, run.workflow_id, run.path, run.status, run.conclusion, run.event,
    run.head_sha, run.head_branch, run.repository.id, run.repository.full_name],
  [original.runId, original.runAttempt, original.workflowId, ".github/workflows/app-build.yml",
    "completed", "success", "workflow_dispatch", original.workflowSHA, "c17-team-proof",
    original.repositoryId, original.repository], "untrusted original package run")
  assert.deepEqual([artifact.id, artifact.name, artifact.digest, artifact.expired, artifact.workflow_run.id,
    artifact.workflow_run.repository_id, artifact.workflow_run.head_repository_id, artifact.workflow_run.head_sha],
  [original.artifactId, "orchestra-sf-entra-linux-" + original.sourceSHA, original.containerDigest, false,
    original.runId, original.repositoryId, original.repositoryId, original.workflowSHA], "untrusted original artifact")
}

export function verifyOriginalBytes({
  source, zip, compressed, receiptBytes, proofBytes, archiveFiles,
  compileEvidenceBytes, compileProvenanceBytes, webManifestBytes,
}) {
  assert.deepEqual([source.sha, source.tree, "sha256:" + hash(zip), hash(compressed)],
    [original.sourceSHA, original.sourceTreeSHA, original.containerDigest, original.tarSHA], "source or package bytes differ")
  const receipt = parseCanonicalJson(receiptBytes, "Entra package receipt")
  assert.deepEqual([receipt.schema, receipt.proof, receipt.sourceSHA, receipt.checkoutSHA, receipt.expectedSourceSHA,
    receipt.archiveFile, receipt.archiveSha256, receipt.manifestSha256, receipt.target,
    receipt.runID, receipt.runAttempt], ["sf-entra-factory-package-v1", "packaged", original.sourceSHA, original.sourceSHA,
    original.sourceSHA, original.tar, original.tarSHA, original.manifestSHA, "linux-x64-baseline",
    String(original.runId), String(original.runAttempt)], "original package receipt does not bind the source and run")
  const proof = JSON.parse(proofBytes)
  assert.deepEqual([proof.sourceSHA, proof.temporaryInstall, proof.nativeWeb, proof.chromium, proof.noTeam, proof.directTeam, proof.syntheticProvider],
    [original.sourceSHA, true, true, true, 403, 403, true], "original installed CI proof differs")
  const rows = new Map(archiveFiles.map((file) => [file.path, file]))
  assert.equal(rows.size, archiveFiles.length)
  const manifest = rows.get("distribution.json")
  assert.equal(manifest?.sha256, original.manifestSHA)
  const listed = JSON.parse(manifest.text).files
  assert.equal(listed.length + 2, rows.size)
  assert(rows.has("checksums.sha256"))
  assert.equal(new Set(listed.map((item) => item.path)).size, listed.length)
  for (const item of listed) assert.equal(rows.get(item.path)?.sha256, item.sha256, "manifest mismatch: " + item.path)
  const packedCliSha256 = rows.get("bin/orchestra")?.sha256
  assert.equal(packedCliSha256, original.packedCliSha256, "packed CLI differs")
  // Bun and Vite emit canonical JSON without a trailing newline. Hash the original bytes below.
  const parseBuildOutput = (bytes, label) => parseCanonicalJson(Buffer.concat([bytes, Buffer.from("\n")]), label)
  const compileEvidence = parseBuildOutput(compileEvidenceBytes, "compiler evidence")
  const compileProvenance = parseCanonicalJson(compileProvenanceBytes, "compiler provenance")
  const webManifest = parseBuildOutput(webManifestBytes, "Web build manifest")
  assert.deepEqual([compileEvidence.schema, compileEvidence.target, compileEvidence.bun, compileEvidence.binary?.sha256],
    ["orchestra-compile-evidence-v2", receipt.target, original.bun, packedCliSha256], "compiler evidence does not bind the packed CLI")
  assert(Array.isArray(compileEvidence.inputs) && compileEvidence.inputs.length > 0 &&
    Object.keys(compileEvidence.metafile?.outputs ?? {}).length > 0, "empty compiler evidence")
  const compileEvidenceSha256 = hash(compileEvidenceBytes)
  const webManifestSha256 = hash(webManifestBytes)
  assert.deepEqual([compileEvidenceSha256, webManifestSha256],
    [original.ledgerSha256, original.webManifestSha256], "compiler or Web evidence differs")
  assert.deepEqual(compileProvenance, {
    schema: "sf-linux-compile-provenance-v1", sourceSHA: source.sha, sourceTreeSHA: source.tree,
    workflowSHA: original.workflowSHA, runId: String(original.runId), runAttempt: String(original.runAttempt),
    job: "build", checkRunId: String(original.checkRunId), target: receipt.target, bun: compileEvidence.bun,
    bunRevision: original.bunRevision, bunArchiveSha256: original.bunArchiveSha256,
    archiveSha256: original.tarSHA, manifestSha256: original.manifestSHA,
    binary: { path: "bin/orchestra", sha256: packedCliSha256 },
    ledger: { file: "compile-evidence.json", sha256: compileEvidenceSha256 },
    webManifest: { file: "web-build-manifest.json", sha256: webManifestSha256 },
  }, "compiler provenance does not bind the immutable package and producer")
  const outputs = Object.values(webManifest)
  assert(outputs.some((entry) => entry?.isEntry === true) && outputs.every((entry) =>
    typeof entry?.file === "string" && rows.has("bin/web/" + entry.file)), "Web manifest names an unpackaged output")
  return {
    status: "BOUND", source, workflowSHA: original.workflowSHA, runId: String(original.runId),
    runAttempt: String(original.runAttempt), artifact: { id: String(original.artifactId), digest: original.containerDigest },
    archiveFile: original.tar, archiveSha256: original.tarSHA, receiptSha256: hash(receiptBytes),
    ciProofSha256: hash(proofBytes), memberCount: rows.size,
    compileEvidenceSha256, packedCliSha256, compileProvenanceSha256: hash(compileProvenanceBytes), webManifestSha256,
  }
}

export function verifyInstalledC17({ receiptBytes, log, spec, source, artifact, archive }) {
  const receipt = parseCanonicalJson(receiptBytes, "installed C17 receipt")
  assert.deepEqual([
    receipt.schema, receipt.status, receipt.caseName, receipt.sourceSHA, receipt.sourceTreeSHA,
    receipt.workflowSHA, receipt.runId, receipt.runAttempt, receipt.jobId, receipt.tarSha256,
    receipt.binary?.path, receipt.binary?.sha256, receipt.factory?.path, receipt.factory?.sha256,
    receipt.spec?.path, receipt.spec?.sha256, receipt.evidenceSha256,
    receipt.syntheticEntra, receipt.teamDecisionsEnabled, receipt.beforeAtlas, receipt.prepared,
    receipt.reload, receipt.replay, receipt.noTeam, receipt.crossTeam, receipt.revoked, receipt.promotion,
  ], [
    "sf-c17-installed-team-proof-v1", "pass",
    "C17 CurrentChoice calculates and persists the recorded Planner scenario for the admitted Microsoft Team",
    source.sha, source.tree, original.workflowSHA, String(original.runId), String(original.runAttempt),
    String(original.checkRunId), original.tarSHA,
    "bin/orchestra", artifact.packedCliSha256, "bin/local/entry.mjs",
    archive.find((row) => row.path === "bin/local/entry.mjs")?.sha256,
    spec.path, spec.sha256, hash(log),
    true, true, 503, 200, 200, 200, 403, 403, 403, false,
  ], "installed C17 proof is not bound to this tar and job")
  assert(log.includes(Buffer.from("C17_TEAM_PACKAGE_OK")) && log.includes(Buffer.from("C17_TEAM_PREPARE_REPLAY_OK")),
    "C17 markers missing from the producer log")
  return hash(receiptBytes)
}
