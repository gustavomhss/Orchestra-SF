import assert from "node:assert/strict"
import { hash, parseCanonicalJson } from "./team-profile-residue.mjs"

export const original = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  sourceSHA: "0869f0467d7f89ae752c3cc2aa44c5f77c40d3e6",
  sourceTreeSHA: "30b8140a9329b190b14d43757c7f4d6e0e92dc9f",
  runId: 44911103813,
  runAttempt: 1,
  workflowId: 417570814,
  workflowSHA: "a1109e8f42d0f15088679a4e2d48338e8a37186d",
  artifactId: 14709069818,
  containerDigest: "sha256:9d02f7b2147dead61cb3a1fec6e161b8cbf39b7515f8b2a6c7377ea8582a8f68",
  tar: "orchestra-sf-entra-linux-x64-baseline.tar.gz",
  tarSHA: "f6973ae1f18749aa93e776bec47eed36aca5e0144e51f4e033622bc094dd3c7e",
  manifestSHA: "cafe594324c89cb0f0395850a7ae5ccd410ae1cfc358894ad11313ab2a24fb1f",
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

export function verifyOriginalBytes({ source, zip, compressed, receiptBytes, proofBytes, archiveFiles }) {
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
  return {
    status: "BOUND", source, workflowSHA: original.workflowSHA, runId: String(original.runId),
    runAttempt: String(original.runAttempt), artifact: { id: String(original.artifactId), digest: original.containerDigest },
    archiveFile: original.tar, archiveSha256: original.tarSHA, receiptSha256: hash(receiptBytes),
    ciProofSha256: hash(proofBytes), memberCount: rows.size,
  }
}
