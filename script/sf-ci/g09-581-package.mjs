import assert from "node:assert/strict"
import { hash, parseCanonicalJson } from "./team-profile-residue.mjs"

export const original = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  sourceSHA: "aff245e1aaf79a38548e50da6c8e7763d2e1ae01",
  sourceTreeSHA: "bf92de86276f09b03595863d663ab82eb4e7f42d",
  runId: 44924237467,
  runAttempt: 1,
  checkRunId: 136906703128,
  workflowId: 417570814,
  workflowSHA: "a4c4ec4a20bef465505aba3671b1e9c90f43f9f5",
  artifactId: 14715072445,
  containerDigest: "sha256:ec102a042d20e9145c6b7f917158859f193f62711f263fc45e76f216f80dc2e8",
  bun: "1.4.1",
  bunRevision: "1.4.1+4661e494f",
  bunArchiveSha256: "a8c9c6738202e2fced555dd860a953c56c0cd059f75041e7010ae81a32802646",
  packedCliSha256: "91ffe736421c0a50c1593a53a58f5eabca2084e25b20123e256445f4a0aa5924",
  ledgerSha256: "9abde0e89d51d297ceca7775261cd13335839241c9492312986816d66bf33d02",
  webManifestSha256: "b7e591022af4fe8ae3c0554ec1b7308307cfcc43d244743030514c4db266598b",
  tar: "orchestra-sf-entra-linux-x64-baseline.tar.gz",
  tarSHA: "1032007345eb3e8584063fc2999ce3c7eafbf5bc3e4e77649b7827c9cf1c63a0",
  manifestSHA: "61d33386367239b4336325291109bdc7c79dcd1ad86277ffe9cfce132511f894",
})

export function verifyProducer(run, artifact) {
  assert.deepEqual([run.id, run.run_attempt, run.workflow_id, run.path, run.status, run.conclusion, run.event,
    run.head_sha, run.head_branch, run.repository.id, run.repository.full_name],
  [original.runId, original.runAttempt, original.workflowId, ".github/workflows/app-build.yml",
    "completed", "success", "workflow_dispatch", original.workflowSHA, "c17-bun-proof",
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
