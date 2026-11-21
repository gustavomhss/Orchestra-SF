import assert from "node:assert/strict"
import { readFile, writeFile, realpath } from "node:fs/promises"
import path from "node:path"
import { auditResidues, gitBlob, hash, parseCanonicalJson, readSource, readTarArchive, record, verifyGitSource } from "./team-profile-residue.mjs"
import { original, verifyOriginalBytes, verifyProducer } from "./g09-581-package.mjs"

const [candidateArg, producerArg, evidenceRoot] = process.argv.slice(2)
const env = process.env
const reportPath = path.join(evidenceRoot, "report.json")
const read = (name) => readFile(path.join(evidenceRoot, name))
const optional = async (name) => {
  const bytes = await read(name).catch((error) => {
    if (error.code !== "ENOENT") throw error
  })
  return bytes === undefined ? undefined : parseCanonicalJson(bytes, name)
}
async function audit() {
  assert.deepEqual([env.GITHUB_ACTIONS, env.GITHUB_REPOSITORY, Number(env.GITHUB_REPOSITORY_ID), env.RUNNER_OS,
    env.RUNNER_ARCH, env.GITHUB_REF],
  ["true", original.repository, original.repositoryId, "Linux", "X64", "refs/heads/g09-581-proof"])
  const candidate = await realpath(candidateArg)
  const producer = await realpath(producerArg)
  const verified = verifyGitSource(await read("source.commit"), await read("source.tree"), original.sourceSHA)
  const { sha, tree } = verified
  const source = { sha, tree, trackedCount: verified.entries.length }
  assert.equal(tree, original.sourceTreeSHA)
  verifyProducer(JSON.parse(await read("producer-run.json")), JSON.parse(await read("producer-artifact.json")))
  const compressed = await read(original.tar)
  const archiveFiles = readTarArchive(compressed)
  const artifact = verifyOriginalBytes({
    source, zip: await read("original.zip"), compressed, archiveFiles,
    receiptBytes: await read("orchestra-sf-entra-package-receipt.json"), proofBytes: await read("ci-validation.json"),
  })
  const tool = verifyGitSource(await read("tool.commit"), await read("tool.tree"), env.GITHUB_SHA)
  const toolPaths = ["team-profile-residue.mjs", "team-profile-residue.test.mjs", "g09-581-package.mjs", "g09-581.mjs"]
  const toolRecords = await Promise.all(toolPaths.map(async (name) => {
    const relative = "script/sf-ci/" + name
    const bytes = await readFile(new URL(name, import.meta.url))
    assert.equal(gitBlob(bytes), tool.entries.find((entry) => entry.path === relative)?.oid)
    return record("source", relative, bytes)
  }))
  const catalogBytes = await readFile(new URL("g09-581-catalog.json", import.meta.url))
  assert.equal(gitBlob(catalogBytes), tool.entries.find((entry) => entry.path === "script/sf-ci/g09-581-catalog.json")?.oid)
  const producerSource = verifyGitSource(await read("producer.commit"), await read("producer.tree"), original.workflowSHA)
  const evidenceFiles = new Map()
  for (const name of ["entra-native-http.mjs", "entra-native-provider.mjs"]) {
    const relative = ".github/ci/" + name
    const bytes = await readFile(path.join(producer, relative))
    assert.equal(gitBlob(bytes), producerSource.entries.find((entry) => entry.path === relative)?.oid)
    evidenceFiles.set(relative, record("source", relative, bytes))
  }
  const historical = {
    toolSource: tool, toolRecords, evidenceFiles,
    validatorSha256: hash(JSON.stringify(toolRecords.map((file) => [file.path, file.sha256]))),
  }
  const loaded = await readSource(candidate, verified)
  const report = auditResidues({
    source, records: [...loaded.records, ...archiveFiles], sourceGaps: loaded.gaps, artifact, catalogBytes,
    controls: await optional("controls.json"), review: await optional("review.json"), proofs: await optional("proofs.json"),
    trust: env.G09_TRUST_JSON ? JSON.parse(env.G09_TRUST_JSON) : undefined, env, historical,
  })
  return report
}
try {
  const report = await audit()
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  console.log(JSON.stringify({ status: report.status, counts: report.counts, blockers: report.blockers }))
  process.exitCode = report.status === "PASS" ? 0 : 2
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  await writeFile(reportPath, JSON.stringify({ status: "FAIL_CLOSED", reason }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  console.error(reason)
  process.exitCode = 1
}
