import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { hash, parseCanonicalJson, readTarArchive, verifyArtifact, verifyGitSource } from "./team-profile-residue.mjs"

const env = process.env
const [mode, directory, producerPackage, installedRelease] = process.argv.slice(2)
assert(["receipt", "metadata", "provenance"].includes(mode), "unknown evidence operation")
assert.equal(process.argv.length, mode === "receipt" ? 6 : 4)
assert.equal(env.GITHUB_ACTIONS, "true")
assert.equal(env.GITHUB_REPOSITORY, "gustavomhss/Orchestra-SF")
assert.equal(env.GITHUB_REPOSITORY_ID, "1455724710")
assert.equal(env.GITHUB_REF, "refs/heads/g09-final-review")
assert.equal(env.RUNNER_OS, "Linux")
assert.equal(env.RUNNER_ARCH, "X64")
assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/)
assert.equal(env.SF_PRODUCT_SOURCE_SHA, env.GITHUB_SHA)
for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"]) assert.match(env[key] ?? "", /^[1-9][0-9]*$/)

const root = await realpath(process.cwd()), temporary = await realpath(env.RUNNER_TEMP)
const within = (base, target) => {
  const relative = path.relative(base, target)
  return relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)
}
const externalDirectory = async (value) => {
  assert(path.isAbsolute(value), "absolute evidence directory required")
  const resolved = await realpath(value)
  assert(within(temporary, resolved) && !within(root, resolved), "evidence must be outside checkout in RUNNER_TEMP")
  assert((await lstat(resolved)).isDirectory())
  return resolved
}
const evidence = await externalDirectory(directory)
const json = async (file) => JSON.parse(await readFile(file, "utf8"))
const canonical = async (file) => parseCanonicalJson(await readFile(file), path.basename(file))
const write = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 })
async function fileHash(file) {
  const digest = createHash("sha256")
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest("hex")
}
const verified = verifyGitSource(await readFile(path.join(evidence, "commit.raw")),
  await readFile(path.join(evidence, "tracked.z")), env.GITHUB_SHA)
const source = { sha: verified.sha, tree: verified.tree, trackedCount: verified.entries.length }
const archiveFile = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
const receiptFile = "g09-artifact-receipt.json"
const inventoryFile = archiveFile + ".inventory.json"

if (mode === "receipt") {
  const packaged = await externalDirectory(producerPackage), release = await externalDirectory(installedRelease)
  assert.equal(path.basename(release), source.sha)
  const compressed = await readFile(path.join(packaged, archiveFile)), files = readTarArchive(compressed)
  const archiveSha256 = hash(compressed), byPath = new Map(files.map((file) => [file.path, file]))
  const descriptor = JSON.parse(byPath.get("distribution.json")?.text ?? "null")
  const native = await canonical(path.join(packaged, "orchestra-sf-entra-package-receipt.json"))
  assert.deepEqual([native.schema, native.proof, native.sourceSHA, native.checkoutSHA, native.expectedSourceSHA,
    native.target, native.archiveFile, native.archiveSha256, native.manifestSha256, native.bundleSha256, native.runID, native.runAttempt],
  ["sf-entra-factory-package-v1", "packaged", source.sha, source.sha, source.sha, "linux-x64-baseline",
    archiveFile, archiveSha256, byPath.get("distribution.json")?.sha256, byPath.get("bin/local/entry.mjs")?.sha256,
    env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT])
  const inputs = await canonical(path.join(temporary, "g09-build-inputs.json"))
  assert.deepEqual(inputs, { sourceSHA: source.sha, channel: "prod", brand: "sucafina", viteEnvironmentInputs: 0 })
  const installed = await json(path.join(release, ".a7-source.json"))
  assert.deepEqual([installed.sourceSHA, installed.archiveSha256, installed.manifestSha256],
    [source.sha, archiveSha256, native.manifestSha256])
  // The existing installer already verifies the complete release and modes.
  // Bind this receipt to every actual extracted member, without extracting again.
  for (const file of files) {
    const member = path.join(release, file.path)
    assert.equal(await realpath(member), member, "installed symlink: " + file.path)
    assert((await lstat(member)).isFile(), "installed member is not a regular file")
    assert.equal(await fileHash(member), file.sha256, "installed member differs: " + file.path)
  }
  assert.equal(descriptor.target, "linux-x64-baseline")
  assert.equal(files.length, descriptor.files.length + 2)
  const inventory = { schema: "sf-teams-archive-inventory-v1", sourceSHA: source.sha, sourceTreeSHA: source.tree,
    archiveFile, archiveSha256, files: files.map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))
      .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }
  const inventoryBytes = Buffer.from(JSON.stringify(inventory, null, 2) + "\n")
  await writeFile(path.join(packaged, inventoryFile), inventoryBytes, { flag: "wx", mode: 0o600 })
  await write(path.join(packaged, receiptFile), {
    schema: "sf-teams-production-artifact-v1", proofRole: "sf-production-archive",
    sourceSHA: source.sha, sourceTreeSHA: source.tree, target: descriptor.target, version: descriptor.version,
    archiveFile, archiveSha256, archiveBytes: compressed.length, manifestSha256: native.manifestSha256,
    inventoryFile, inventorySha256: hash(inventoryBytes), fileCount: descriptor.files.length,
    archiveFileCount: files.length, webFileCount: descriptor.files.filter((file) => file.path.startsWith("bin/web/")).length,
    brand: inputs.brand, channel: inputs.channel, viteEnvironmentInputs: inputs.viteEnvironmentInputs,
    extractedVerified: true, nativeBrowserProof: "REQUIRED_SEPARATELY", fullSfCi: "REQUIRED_SEPARATELY",
  })
  await write(path.join(packaged, "g09-build-inputs.json"), inputs)
  console.log(JSON.stringify({ operation: mode, sourceSHA: source.sha, archiveSha256, members: files.length }))
} else {
  for (const key of ["CANDIDATE_ARTIFACT_ID", "CANDIDATE_PRODUCER_CHECK_RUN_ID"])
    assert.match(env[key] ?? "", /^[1-9][0-9]*$/)
  assert.equal(env.CANDIDATE_ARTIFACT_NAME, "orchestra-sf-entra-linux-" + source.sha)
  const expectedDigest = "sha256:" + (env.CANDIDATE_ARTIFACT_DIGEST ?? "").replace(/^sha256:/, "")
  assert.match(expectedDigest, /^sha256:[a-f0-9]{64}$/)
  const artifact = await json(path.join(evidence, "artifact.json")), run = await json(path.join(evidence, "run.json"))
  const jobs = await json(path.join(evidence, "jobs.json"))
  assert.deepEqual([String(run.id), String(run.run_attempt), run.head_sha, run.head_branch, run.path, run.event,
    String(run.repository.id), run.repository.full_name],
  [env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT, source.sha, "g09-final-review", ".github/workflows/g09-final.yml",
    "push", env.GITHUB_REPOSITORY_ID, env.GITHUB_REPOSITORY])
  assert.equal(jobs.total_count, jobs.jobs.length, "complete current-attempt job inventory required")
  const checkURL = "https://api.github.com/repos/" + env.GITHUB_REPOSITORY + "/check-runs/" + env.CANDIDATE_PRODUCER_CHECK_RUN_ID
  const producers = jobs.jobs.filter((job) => job.check_run_url === checkURL)
  assert.equal(producers.length, 1, "exact producer check run required")
  const producer = producers[0]
  assert.deepEqual([producer.name, String(producer.run_id), producer.head_sha, producer.status, producer.conclusion],
    ["teams-profile-artifact", env.GITHUB_RUN_ID, source.sha, "completed", "success"])
  assert.deepEqual([String(artifact.id), artifact.name, artifact.digest, artifact.expired,
    String(artifact.workflow_run.id), String(artifact.workflow_run.repository_id),
    String(artifact.workflow_run.head_repository_id), artifact.workflow_run.head_sha],
  [env.CANDIDATE_ARTIFACT_ID, env.CANDIDATE_ARTIFACT_NAME, expectedDigest, false, env.GITHUB_RUN_ID,
    env.GITHUB_REPOSITORY_ID, env.GITHUB_REPOSITORY_ID, source.sha])
  const archiveZip = path.join(evidence, "artifact.zip")
  assert.equal((await lstat(archiveZip)).size, artifact.size_in_bytes, "downloaded ZIP size differs")
  const artifactZipSha256 = await fileHash(archiveZip)
  assert.equal("sha256:" + artifactZipSha256, artifact.digest, "downloaded ZIP digest differs")
  if (mode === "metadata") {
    console.log(JSON.stringify({ operation: mode, artifactId: String(artifact.id), artifactZipSha256, producerJobId: String(producer.id) }))
  } else {
    const packaged = await externalDirectory(path.join(evidence, "package"))
    const paths = { package: packaged, archive: path.join(packaged, archiveFile),
      receipt: path.join(packaged, receiptFile), inventory: path.join(packaged, inventoryFile),
      nativeReceipt: path.join(packaged, "orchestra-sf-entra-package-receipt.json"),
      compileProvenance: path.join(packaged, "compile-provenance.json"),
      compileEvidence: path.join(packaged, "compile-evidence.json"),
      cliSourceMapIndex: path.join(packaged, "cli-source-map-index.json"),
      cliSourceMaps: path.join(packaged, "cli-source-maps.tar.gz") }
    const compressed = await readFile(paths.archive), files = readTarArchive(compressed)
    const inventoryBytes = await readFile(paths.inventory), receiptBytes = await readFile(paths.receipt)
    const provenance = { schema: "teams-profile-residue-provenance-v1", runId: env.GITHUB_RUN_ID,
      runAttempt: env.GITHUB_RUN_ATTEMPT, workflowSHA: env.GITHUB_SHA, sourceSHA: source.sha, sourceTreeSHA: source.tree,
      producerJob: "teams-profile-artifact",
      artifact: { id: String(artifact.id), name: artifact.name, digest: artifact.digest,
        workflowRunId: String(artifact.workflow_run.id), headSha: artifact.workflow_run.head_sha, expired: artifact.expired },
      archiveSha256: hash(compressed), inventorySha256: hash(inventoryBytes), receiptSha256: hash(receiptBytes) }
    verifyArtifact({ source, archiveFile, compressed, files, inventoryBytes, receiptBytes, provenance,
      env: { ...env, SF_TEAMS_RESIDUE_ARTIFACT_ID: String(artifact.id), SF_TEAMS_RESIDUE_ARTIFACT_DIGEST: artifact.digest } })
    const byPath = new Map(files.map((file) => [file.path, file]))
    const native = await canonical(paths.nativeReceipt)
    assert.deepEqual([native.schema, native.proof, native.sourceSHA, native.checkoutSHA, native.expectedSourceSHA,
      native.target, native.archiveFile, native.archiveSha256, native.manifestSha256, native.bundleSha256, native.runID, native.runAttempt],
    ["sf-entra-factory-package-v1", "packaged", source.sha, source.sha, source.sha, "linux-x64-baseline",
      archiveFile, provenance.archiveSha256, byPath.get("distribution.json")?.sha256, byPath.get("bin/local/entry.mjs")?.sha256,
      env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT])
    const binarySha256 = files.find((file) => file.path === "bin/orchestra")?.sha256
    assert.match(binarySha256 ?? "", /^[a-f0-9]{64}$/)
    const compile = await canonical(paths.compileProvenance), ledger = await json(paths.compileEvidence)
    assert.deepEqual([compile.schema, compile.sourceSHA, compile.sourceTreeSHA, compile.workflowSHA, compile.runId,
      compile.runAttempt, compile.job, compile.checkRunId, compile.target, compile.binary?.path, compile.binary?.sha256,
      compile.archiveSha256],
    ["sf-linux-compile-provenance-v2", source.sha, source.tree, env.GITHUB_SHA, env.GITHUB_RUN_ID,
      env.GITHUB_RUN_ATTEMPT, "teams-profile-artifact", env.CANDIDATE_PRODUCER_CHECK_RUN_ID, "linux-x64-baseline",
      "bin/orchestra", binarySha256, provenance.archiveSha256])
    assert.deepEqual([ledger.schema, ledger.target, ledger.binary?.sha256], ["orchestra-compile-evidence-v2", compile.target, binarySha256])
    assert(Array.isArray(ledger.inputs) && ledger.inputs.length > 0)
    for (const [key, filename] of [["ledger", "compile-evidence.json"], ["webManifest", "web-build-manifest.json"],
      ["cliSourceMaps", "cli-source-maps.tar.gz"]]) {
      assert.equal(compile[key]?.file, filename)
      assert.equal(compile[key]?.sha256, await fileHash(path.join(packaged, filename)), "compiler sidecar differs: " + filename)
    }
    assert.equal(compile.cliSourceMaps.index, "cli-source-map-index.json")
    assert.equal(compile.cliSourceMaps.indexSha256, await fileHash(paths.cliSourceMapIndex))
    const binding = { schema: "sf-g09-candidate-binding-v1", sourceSHA: source.sha, sourceTreeSHA: source.tree,
      workflowSHA: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
      producerJobId: String(producer.id), producerCheckRunId: env.CANDIDATE_PRODUCER_CHECK_RUN_ID,
      artifactId: String(artifact.id), artifactDigest: artifact.digest, artifactZipSha256,
      archiveSha256: provenance.archiveSha256, binarySha256,
      compileProvenanceSha256: await fileHash(paths.compileProvenance), compileEvidenceSha256: await fileHash(paths.compileEvidence),
      cliSourceMapIndexSha256: await fileHash(paths.cliSourceMapIndex), cliSourceMapsSha256: await fileHash(paths.cliSourceMaps), paths }
    await write(path.join(evidence, "artifact-provenance.json"), provenance)
    await write(path.join(evidence, "candidate-binding.json"), binding)
    console.log(JSON.stringify({ operation: mode, sourceSHA: source.sha, artifactId: binding.artifactId,
      archiveSha256: binding.archiveSha256, binarySha256, members: files.length }))
  }
}
