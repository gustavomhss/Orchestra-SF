import assert from "node:assert/strict"
import { hash, parseCanonicalJson } from "./team-profile-residue.mjs"

export const original = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  sourceSHA: "761abac2f8ee4106db0347189ff304a4a79bf026",
  sourceTreeSHA: "77729b280763c07a82d55ad9de78a66fd53fc991",
  runId: 44919211871,
  runAttempt: 1,
  checkRunId: 136891359086,
  workflowId: 417570814,
  workflowSHA: "652fc3d2d251edbf843d9e219a3435248bf3dec5",
  artifactId: 14713077730,
  containerDigest: "sha256:c3a31e10b25e81cc1b6e8234f77ed16ed6ea86c4d3c7e6026b67f5fc6187e8e7",
  tar: "orchestra-sf-entra-linux-x64-baseline.tar.gz",
  tarSHA: "7a2ab7102528a7de1998b30635bb02e3907ea1afc033e07d71c12cc6906158e9",
  manifestSHA: "32a2e3e98c2e9e477035348bb339c82a412ec4e893f73c1fa9c4e041e62cec22",
})

export function verifyProducer(run, artifact) {
  assert.deepEqual([run.id, run.run_attempt, run.workflow_id, run.path, run.status, run.conclusion, run.event,
    run.head_sha, run.head_branch, run.repository.id, run.repository.full_name],
  [original.runId, original.runAttempt, original.workflowId, ".github/workflows/app-build.yml",
    "completed", "success", "workflow_dispatch", original.workflowSHA, "azure-package-proof",
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
  assert.match(packedCliSha256 ?? "", /^[0-9a-f]{64}$/, "packed CLI is missing")
  // Bun and Vite emit canonical JSON without a trailing newline. Hash the original bytes below.
  const parseBuildOutput = (bytes, label) => parseCanonicalJson(Buffer.concat([bytes, Buffer.from("\n")]), label)
  const compileEvidence = parseBuildOutput(compileEvidenceBytes, "compiler evidence")
  const compileProvenance = parseCanonicalJson(compileProvenanceBytes, "compiler provenance")
  const webManifest = parseBuildOutput(webManifestBytes, "Web build manifest")
  assert.deepEqual([compileEvidence.schema, compileEvidence.target, compileEvidence.bun, compileEvidence.binary?.sha256],
    ["orchestra-compile-evidence-v2", receipt.target, "1.3.14", packedCliSha256], "compiler evidence does not bind the packed CLI")
  assert(Array.isArray(compileEvidence.inputs) && compileEvidence.inputs.length > 0 &&
    Object.keys(compileEvidence.metafile?.outputs ?? {}).length > 0, "empty compiler evidence")
  const compileEvidenceSha256 = hash(compileEvidenceBytes)
  const webManifestSha256 = hash(webManifestBytes)
  assert.deepEqual(compileProvenance, {
    schema: "sf-linux-compile-provenance-v1", sourceSHA: source.sha, sourceTreeSHA: source.tree,
    workflowSHA: original.workflowSHA, runId: String(original.runId), runAttempt: String(original.runAttempt),
    job: "build", checkRunId: String(original.checkRunId), target: receipt.target, bun: compileEvidence.bun,
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
