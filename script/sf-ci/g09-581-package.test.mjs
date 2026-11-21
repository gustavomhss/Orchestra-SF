import assert from "node:assert/strict"
import test from "node:test"
import { original, verifyOriginalBytes, verifyProducer } from "./g09-581-package.mjs"

const run = {
  id: original.runId, run_attempt: original.runAttempt, workflow_id: original.workflowId,
  path: ".github/workflows/app-build.yml", status: "completed", conclusion: "success", event: "workflow_dispatch",
  head_sha: original.workflowSHA, head_branch: "azure-package-proof",
  repository: { id: original.repositoryId, full_name: original.repository },
}
const artifact = {
  id: original.artifactId, name: "orchestra-sf-entra-linux-" + original.sourceSHA,
  digest: original.containerDigest, expired: false,
  workflow_run: {
    id: original.runId, repository_id: original.repositoryId,
    head_repository_id: original.repositoryId, head_sha: original.workflowSHA,
  },
}

test("historical provenance requires the original successful run and its exact immutable artifact", () => {
  verifyProducer(run, artifact)
  for (const changed of [{ id: run.id + 1 }, { run_attempt: 2 }, { head_sha: original.sourceSHA }, { conclusion: "failure" }]) {
    assert.throws(() => verifyProducer({ ...run, ...changed }, artifact), /untrusted original package run/)
  }
  for (const changed of [{ id: artifact.id + 1 }, { expired: true }, { digest: "sha256:" + "0".repeat(64) }, {
    workflow_run: { ...artifact.workflow_run, head_repository_id: 0 },
  }]) {
    assert.throws(() => verifyProducer(run, { ...artifact, ...changed }), /untrusted original artifact/)
  }
})

test("historical provenance rejects substituted ZIP and tar bytes before using the receipt", () => {
  assert.throws(() => verifyOriginalBytes({
    source: { sha: original.sourceSHA, tree: original.sourceTreeSHA },
    zip: Buffer.from("different zip"), compressed: Buffer.from("different tar"),
  }), /source or package bytes differ/)
})

test("the historical catalog requests a signed review without accepting built-in dispositions", async () => {
  const { readFile } = await import("node:fs/promises")
  const { parseCanonicalJson, validateManifest } = await import("./team-profile-residue.mjs")
  const manifest = validateManifest(parseCanonicalJson(
    await readFile(new URL("./g09-581-catalog.json", import.meta.url)), "historical catalog",
  ))
  assert.equal(manifest.review.status, "required")
  assert.deepEqual(manifest.dispositions, [])
})
