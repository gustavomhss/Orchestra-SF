// Independent recovery diagnostic. This does not reconstruct or replace the
// unavailable signed checkpoint or its local validator.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

const pin = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  source: "3ef84da65d6b8ad7cd3250412bbcabdf90924172",
  tree: "48d57887656fd2e325dee97a7c066bcb8e84bbc8",
  producer: "b1e3c29c1b7462872aa3d23b2777a5b619dfb6cb",
  run: 44944208924,
  job: "136967815702",
  artifact: 14722264806,
  zip: "84e5f993f0d32e91c3fcb7e815e40c3155c1c1c17b80c4d394d3eb57b2b151ec",
  tar: "dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83",
  elf: "ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f",
  ledger: "3921b2dd5d7df9ac9aa979264cff827901b5da162dd2976f00105bc92775cde9",
  index: "1b0f15f4d6017878743453356d4a3933d0f2b2e2682514717ea2d52df22d5bb4",
  maps: "6b80a904c0e253b308f80dfa028e636c6898d0ecc15c09c97fa3d8c658f6ef52",
  provenance: "aac471725c52584caef45edbc15b64efe0e037ca72ef0ca758471065c926f22a",
  supplement: "80ea2faec0de396115ffcd120bbeda2ceba837f336072cf2dc2277a89f7d1380",
  scanner: "ebed903a650cd979d30faa5f4ba6d1f1b175036a",
  scannerTree: "3ecc2c76b4c5b57cc591a16c08d66d5d03795ac6",
  scannerBlob: "10ae99ab085821f0e312ee05479cad3fb723c7b0",
  catalogBlob: "b7fd3d80f40905c058deec057414e9e995cacaf4",
  testsBlob: "1c96c20dffc38eff3b1f3f2b62fedfff37d284e2",
})
const tarName = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const blob = (bytes) => createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex")
const args = process.argv.slice(2)
assert.equal(args.length, 4, "usage: g09-current-inventory.mjs <candidate> <scanner> <input> <output>")
const [candidate, scannerRoot, input] = await Promise.all(args.slice(0, 3).map((value) => realpath(value)))
const output = path.resolve(args[3])
for (const root of [candidate, scannerRoot, input])
  assert(output !== root && !output.startsWith(root + path.sep), "diagnostic output must be outside the inputs")
await mkdir(output, { recursive: true })
assert.equal(await realpath(output), output, "diagnostic output must not traverse symlinks")
const read = (name) => readFile(path.join(input, name))
const write = (name, value) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 })
async function bound(name, expected) {
  const bytes = await read(name)
  assert.equal(sha256(bytes), expected, "changed evidence bytes: " + name)
  return bytes
}

assert.deepEqual([process.env.GITHUB_ACTIONS, process.env.GITHUB_REPOSITORY, process.env.GITHUB_REPOSITORY_ID,
  process.env.RUNNER_OS, process.env.RUNNER_ARCH], ["true", pin.repository, String(pin.repositoryId), "Linux", "X64"])
assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/)
for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "G09_CHECK_RUN_ID"])
  assert.match(process.env[key] ?? "", /^[1-9][0-9]*$/, "missing diagnostic execution identity: " + key)

const scannerPath = path.join(scannerRoot, "script/sf-ci/team-profile-residue.mjs")
const scannerBytes = await readFile(scannerPath)
assert.equal(blob(scannerBytes), pin.scannerBlob, "published scanner changed")
assert.equal(createRequire(scannerPath)("typescript").version, "5.9.3", "scanner parser version differs")
const scanner = await import(pathToFileURL(scannerPath).href)
const toolSource = scanner.verifyGitSource(await read("scanner.commit"), await read("scanner.tree"), pin.scanner)
assert.equal(toolSource.tree, pin.scannerTree)
const toolFiles = []
for (const [name, oid] of [["team-profile-residue.mjs", pin.scannerBlob],
  ["team-profile-residue.test.mjs", pin.testsBlob], ["g09-581-catalog.json", pin.catalogBlob]]) {
  const relative = "script/sf-ci/" + name
  const bytes = await readFile(path.join(scannerRoot, relative))
  assert.equal(blob(bytes), oid)
  assert.equal(toolSource.entries.find((entry) => entry.path === relative)?.oid, oid)
  toolFiles.push({ path: relative, gitBlob: oid, sha256: sha256(bytes) })
}
const catalogBytes = await readFile(path.join(scannerRoot, "script/sf-ci/g09-581-catalog.json"))
const catalog = scanner.validateManifest(scanner.parseCanonicalJson(catalogBytes, "published catalog"))
assert.equal(catalog.dispositions.length, 0, "the independent diagnostic must not inherit dispositions")

const source = scanner.verifyGitSource(await read("source.commit"), await read("source.tree"), pin.source)
assert.equal(source.tree, pin.tree)
const loaded = await scanner.readSource(candidate, source)
const metadata = JSON.parse(await read("artifact.json"))
const producer = JSON.parse(await read("producer-run.json"))
assert.deepEqual([metadata.id, metadata.digest, metadata.size_in_bytes, metadata.workflow_run.id,
  metadata.workflow_run.head_sha, metadata.workflow_run.repository_id, metadata.workflow_run.head_repository_id],
[pin.artifact, "sha256:" + pin.zip, 124863454, pin.run, pin.producer, pin.repositoryId, pin.repositoryId])
assert.deepEqual([producer.id, producer.run_attempt, producer.head_sha, producer.status, producer.conclusion,
  producer.path, producer.event, producer.repository.id, producer.repository.full_name],
[pin.run, 1, pin.producer, "completed", "success", ".github/workflows/app-build.yml", "workflow_dispatch", pin.repositoryId, pin.repository])
assert.equal((await bound("original.zip", pin.zip)).length, 124863454)
const archive = scanner.readTarArchive(await bound(tarName, pin.tar))
assert.equal(archive.length, 1391, "exact tar member count differs")
const members = new Map(archive.map((file) => [file.path, file]))
assert.equal(members.size, archive.length)
assert.equal(members.get("bin/orchestra")?.sha256, pin.elf)
const distribution = JSON.parse(members.get("distribution.json")?.text ?? "null")
assert(Array.isArray(distribution?.files))
assert.equal(distribution.files.length + 2, archive.length)
assert.equal(new Set(distribution.files.map((item) => item.path)).size, distribution.files.length)
assert(members.has("checksums.sha256"))
for (const item of distribution.files)
  assert.equal(members.get(item.path)?.sha256, item.sha256, "distribution differs: " + item.path)
await bound("compile-evidence.json", pin.ledger)
await bound("cli-source-map-index.json", pin.index)
await bound("cli-source-maps.tar.gz", pin.maps)
const provenance = JSON.parse(await bound("compile-provenance.json", pin.provenance))
assert.deepEqual([provenance.sourceSHA, provenance.sourceTreeSHA, provenance.workflowSHA,
  String(provenance.runId), String(provenance.runAttempt), String(provenance.checkRunId),
  provenance.archiveSha256, provenance.binary?.path, provenance.binary?.sha256],
[pin.source, pin.tree, pin.producer, String(pin.run), "1", pin.job, pin.tar, "bin/orchestra", pin.elf])
await write("independent-diagnostic-acquisition.json", {
  schema: "sf-g09-diagnostic-acquisition-v1", status: "INPUTS_VERIFIED", formalG09Pass: false,
  sourceSHA: pin.source, sourceTreeSHA: pin.tree, sourceFiles: loaded.records.length,
  sourceReadGaps: loaded.gaps.length, artifactId: String(pin.artifact), archiveMembers: archive.length,
  zipSha256: pin.zip, archiveSha256: pin.tar, elfSha256: pin.elf,
  scannerSourceSHA: pin.scanner, scannerSourceTreeSHA: pin.scannerTree, scannerFiles: toolFiles,
  execution: { workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, jobId: process.env.G09_CHECK_RUN_ID },
  scanCompleted: false, inheritedClassifications: 0, inheritedSignatures: 0,
})

// The unmodified scanner produces a fresh unsigned report. No signed review,
// producer attestation, trust anchors or historical validator are supplied.
const report = scanner.auditResidues({
  source: { sha: source.sha, tree: source.tree, trackedCount: source.entries.length },
  records: [...loaded.records, ...archive], sourceGaps: loaded.gaps, catalogBytes,
  artifact: {
    status: "BOUND", source: { sha: source.sha, tree: source.tree },
    workflowSHA: pin.producer, runId: String(pin.run), runAttempt: "1",
    artifact: { id: String(pin.artifact), digest: "sha256:" + pin.zip },
    archiveFile: tarName, archiveSha256: pin.tar, packedCliSha256: pin.elf,
    memberCount: archive.length,
    note: "Exact physical inputs bound by this independent diagnostic; no inherited classification or execution qualification.",
  },
  env: process.env,
})
assert.equal(report.status, "DIAGNOSTIC_UNQUALIFIED")
assert.equal(report.counts.classified, 0)
assert(report.occurrences.every((item) => item.disposition === null))
assert(report.reachability.findings.every((item) => item.disposition === null))
assert(report.blockers.includes("independent-current-source-review-missing"))
assert(report.blockers.includes("executed-negative-controls-missing"))
assert(report.blockers.includes("executed-test-obligations-missing"))

const supplement = JSON.parse(await bound("supplement-proof.json", pin.supplement))
assert.deepEqual([supplement.schema, String(supplement.artifactId), supplement.sourceSHA, supplement.sourceTreeSHA,
  supplement.archiveSha256, supplement.elfSha256, supplement.cliSourceMapIndexSha256,
  String(supplement.runId), String(supplement.runAttempt), String(supplement.jobId), supplement.workflowSHA],
["sf-g09-existing-tar-slice-v1", String(pin.artifact), pin.source, pin.tree, pin.tar, pin.elf, pin.index,
  "44953866078", "1", "136997537583", "2d8c15a7811bd0497eb6b50a2df48fded6802f79"])
const configCase = supplement.cases.find((item) => item.name ===
  "resolve all 50 reviewed tsconfig inheritance edges at the exact source and exclude the configs from the packaged tar")
const solidCase = supplement.cases.find((item) => item.name ===
  "verify 33 Solid identifier offsets and declared origin anchors in the published ELF")
assert.equal(configCase?.status, "pass")
assert.equal(solidCase?.status, "pass")
assert.equal(configCase.findings.length, 50)
assert.equal(solidCase.occurrences.length, 33)
const occurrenceById = new Map(report.occurrences.map((item) => [item.id, item]))
const findingById = new Map(report.reachability.findings.map((item) => [item.id, item]))
const correspondence = [
  ...configCase.findings.map((item) => {
    const found = findingById.get(item.id)
    return { kind: "tsconfig-finding", id: item.id, path: item.sourcePath,
      present: found !== undefined, exactIdentity: found?.domain === "source" &&
        found.path === item.sourcePath && found.kind === "tsconfig-extends-requires-review",
      receiptEvidence: { resolution: item.resolution, buildSelection: item.buildSelection },
      classificationInherited: false, executedThisRun: false }
  }),
  ...solidCase.occurrences.map((item) => {
    const found = occurrenceById.get(item.id)
    return { kind: "solid-occurrence", id: item.id, sourcePath: item.repoPath, elfOffset: item.elfOffset,
      present: found !== undefined, exactIdentity: found?.domain === "archive" && found.path === "bin/orchestra" &&
        found.fileSha256 === pin.elf && found.byteOffset === item.elfOffset,
      receiptEvidence: { endOfBunSpan: item.endOfBunSpan, tuiExecution: item.tuiExecution },
      sourcePathOrigin: "published-supplement-receipt", sourceAttributionCheckedThisRun: false,
      classificationInherited: false, executedThisRun: false }
  }),
]
assert.equal(new Set(correspondence.map((item) => item.id)).size, 83)

const packageRoots = loaded.records.filter((item) => item.path.endsWith("/package.json"))
  .map((item) => path.posix.dirname(item.path)).sort((a, b) => b.length - a.length)
function pathBucket(item) {
  if (item.domain === "source")
    return packageRoots.find((root) => item.path.startsWith(root + "/")) ?? item.path.split("/").slice(0, 2).join("/")
  return item.path.split("/").slice(0, 3).join("/")
}
function edgeFamily(item) {
  if (item.kind !== "unresolved-import-or-content-edge") return item.kind
  const value = item.edge?.specifier
  if (value === null) return "dynamic-specifier-not-resolved"
  if (typeof value !== "string") return "unclassified-edge-shape"
  if (item.edge.kind === "html-content-reference") return "html-content-reference"
  if (value.startsWith(".")) return "relative-reference"
  if (value.startsWith("#")) return "package-import-map-reference"
  if (value.startsWith("/")) return "absolute-reference"
  return "package-or-alias:" + (value.startsWith("@") ? value.split("/").slice(0, 2).join("/") : value.split("/")[0])
}
function group(items, describe) {
  const groups = new Map()
  for (const item of items) {
    const dimensions = describe(item)
    const key = JSON.stringify(dimensions)
    if (!groups.has(key)) groups.set(key, { dimensions, ids: [], paths: new Set(), specifiers: new Set() })
    const current = groups.get(key)
    current.ids.push(item.id)
    current.paths.add(item.path)
    if (item.edge?.specifier !== undefined) current.specifiers.add(item.edge.specifier)
  }
  return [...groups.values()].map((item) => ({
    groupId: sha256(JSON.stringify(item.dimensions)), ...item.dimensions, navigationOnly: true,
    classification: null, count: item.ids.length, ids: item.ids.sort(),
    paths: [...item.paths].sort(), specifiers: [...item.specifiers].sort(),
  })).sort((a, b) => b.count - a.count || a.groupId.localeCompare(b.groupId))
}
const groups = {
  schema: "sf-g09-diagnostic-groups-v1", status: "NAVIGATION_ONLY", formalG09Pass: false,
  sourceSHA: pin.source, archiveSha256: pin.tar, binding: report.binding,
  occurrenceGroups: group(report.occurrences, (item) => ({ domain: item.domain,
    pathBucket: pathBucket(item), seed: item.seed, encoding: item.encoding })),
  findingGroups: group(report.reachability.findings, (item) => ({ domain: item.domain,
    pathBucket: pathBucket(item), findingKind: item.kind, edgeKind: item.edge?.kind ?? null,
    causeCandidate: edgeFamily(item) })),
  caveat: "These groups organize exact IDs only. A common group key does not prove a common semantic disposition or a common test obligation.",
}
for (const [items, expected] of [[groups.occurrenceGroups, report.occurrences.length],
  [groups.findingGroups, report.reachability.findings.length]]) {
  assert.equal(items.reduce((count, item) => count + item.count, 0), expected)
  assert.equal(new Set(items.flatMap((item) => item.ids)).size, expected)
}

// Re-read source and scanner inputs after scanning; do not bless a drifted checkout.
await scanner.readSource(candidate, source)
assert.equal(sha256(await readFile(scannerPath)), sha256(scannerBytes))
assert.equal(sha256(await readFile(path.join(scannerRoot, "script/sf-ci/g09-581-catalog.json"))), sha256(catalogBytes))
const reportBytes = Buffer.from(JSON.stringify(report, null, 2) + "\n")
const diagnosticValidator = { harnessSha256: sha256(await readFile(new URL(import.meta.url))),
  scannerSourceSHA: pin.scanner, scannerFiles: toolFiles, typescript: "5.9.3" }
const metadataOut = {
  schema: "sf-g09-independent-diagnostic-v1", status: "DIAGNOSTIC_UNQUALIFIED", formalG09Pass: false,
  inheritedClassifications: 0, inheritedSignatures: 0, tuiCasesExecuted: 0, rebuild: false,
  sourceSHA: pin.source, sourceTreeSHA: pin.tree, artifactId: String(pin.artifact),
  zipSha256: pin.zip, archiveSha256: pin.tar, elfSha256: pin.elf,
  execution: { workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, jobId: process.env.G09_CHECK_RUN_ID },
  scanner: { sourceSHA: pin.scanner, sourceTreeSHA: pin.scannerTree, files: toolFiles, typescript: "5.9.3" },
  diagnosticValidator, diagnosticValidatorSha256: sha256(JSON.stringify(diagnosticValidator)),
  reportSha256: sha256(reportBytes), binding: report.binding, counts: report.counts,
  previousCheckpoint: { available: false, originalValidator: "1b35f7641a54bfe3bf0229c13b547993570b98fc",
    reportedCounts: { occurrences: 19718, findings: 3146, classifiedOccurrences: 2079, classifiedFindings: 235 },
    rawCountsEqual: report.occurrences.length === 19718 && report.reachability.findings.length === 3146,
    completeInventoryEquality: "NOT_VERIFIABLE_WITHOUT_THE_ORIGINAL_REPORT",
    pendingIdSetEquality: "NOT_VERIFIABLE_WITHOUT_THE_SIGNED_REVIEW",
    signedCheckpointReplaced: false },
  recoveredSubset: { receiptSha256: pin.supplement, requested: 83,
    matched: correspondence.filter((item) => item.exactIdentity).length,
    complete: correspondence.every((item) => item.exactIdentity),
    limitation: "Matching these 83 IDs does not establish equality of the complete inventory or inherit their classifications." },
  blockers: report.blockers,
}
await writeFile(path.join(output, "independent-diagnostic-report.json"), reportBytes, { flag: "wx", mode: 0o600 })
await write("independent-diagnostic-metadata.json", metadataOut)
await write("independent-diagnostic-groups.json", groups)
await write("independent-diagnostic-correspondence.json", {
  schema: "sf-g09-diagnostic-correspondence-v1", formalG09Pass: false,
  receiptSha256: pin.supplement, classificationsInherited: false, rows: correspondence,
})
console.log(JSON.stringify({ status: metadataOut.status, formalG09Pass: false, counts: report.counts,
  knownSubsetMatched: metadataOut.recoveredSubset.matched, completeInventoryEquality: metadataOut.previousCheckpoint.completeInventoryEquality,
  reportSha256: metadataOut.reportSha256, occurrenceGroups: groups.occurrenceGroups.length, findingGroups: groups.findingGroups.length }))
