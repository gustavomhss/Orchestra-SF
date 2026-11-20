import assert from "node:assert/strict"
import { after, test } from "node:test"
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync, gunzipSync } from "node:zlib"
import { auditResidues, buildReachability, controlCases, findOccurrences, gitBlob, gitObject, gitTree,
  hash, parseArguments, parseCanonicalJson, parseTrackedInventory, readSource, readTarArchive, record,
  requiredEntrypoints, requirePrivateStagePaths, seeds, surfaces, validateManifest, verifyArtifact, verifyControls, verifyGitSource } from "./team-profile-residue.mjs"

const completed = new Set(), registered = new Set()
function control(name, body) {
  assert(controlCases.includes(name) && !registered.has(name), "exact negative control name")
  registered.add(name)
  test(name, async () => { await body(); completed.add(name) })
}
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n")
const source = { sha: "1".repeat(40), tree: "2".repeat(40) }
const env = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "gustavomhss/Orchestra-SF", GITHUB_REPOSITORY_ID: "1455724710",
  GITHUB_SHA: "3".repeat(40), SF_PRODUCT_SOURCE_SHA: source.sha, GITHUB_RUN_ID: "314", GITHUB_RUN_ATTEMPT: "2",
  RUNNER_OS: "Linux", RUNNER_ARCH: "X64", SF_TEAMS_RESIDUE_ARTIFACT_ID: "2718",
  SF_TEAMS_RESIDUE_ARTIFACT_DIGEST: "sha256:" + "4".repeat(64),
}
const execution = { sourceSHA: source.sha, sourceTreeSHA: source.tree, workflowSHA: env.GITHUB_SHA,
  runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT }
function catalog(qualify = false) {
  return { schema: "teams-profile-residue-catalog-v1",
    status: qualify ? "QUALIFICATION_REQUESTED" : "DIAGNOSTIC_UNQUALIFIED",
    review: { status: qualify ? "required" : "pending", reason: "Synthetic unit-control catalog; never operational proof.", surfaces: [...surfaces] },
    seeds: [...seeds], entrypoints: requiredEntrypoints.map((entry) => ({ ...entry })), dispositions: [] }
}
function treeFixture(entries) {
  const inventory = Buffer.from(entries.map((entry) => entry.mode + " " + entry.type + " " + entry.oid + "\t" + entry.path + "\0").join(""))
  const commit = Buffer.from("tree " + gitTree(entries) + "\nauthor Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n\nfixture\n")
  return { inventory, commit, sha: gitObject("commit", commit) }
}
function tar(members) {
  const blocks = members.flatMap((member) => {
    const bytes = Buffer.from(member.data ?? ""), header = Buffer.alloc(512)
    assert(Buffer.byteLength(member.path) <= 100)
    header.write(member.path)
    header.write("0000644\0", 100, 8, "ascii")
    header.write("0000000\0", 108, 8, "ascii"); header.write("0000000\0", 116, 8, "ascii")
    header.write(bytes.length.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii")
    header.write("00000000000\0", 136, 12, "ascii")
    header.fill(32, 148, 156); header[156] = (member.type ?? "0").charCodeAt(0)
    header.write("ustar\0", 257, 6, "ascii"); header.write("00", 263, 2, "ascii")
    const sum = header.reduce((total, byte) => total + byte, 0)
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii")
    return [header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]
  })
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]))
}
function artifactFixture() {
  const payload = [
    { path: "bin/orchestra", data: Buffer.from([0, 1, 2, ...Buffer.from("projectId")]) },
    { path: "bin/local/entry.mjs", data: Buffer.from("export const ready = true\n") },
    { path: "bin/web/index.html", data: Buffer.from('<script type="module" src="./assets/app.js"></script>\n') },
    { path: "bin/web/assets/app.js", data: Buffer.from("export const projectId = 'synthetic-control'\n") },
  ]
  const distribution = { version: "0.0.0-test", target: "linux-x64-baseline",
    files: payload.map((item) => ({ path: item.path, byteLength: item.data.length, sha256: hash(item.data), executable: item.path === "bin/orchestra" })) }
  const members = [...payload, { path: "distribution.json", data: json(distribution) },
    { path: "checksums.sha256", data: Buffer.from(payload.map((item) => hash(item.data) + "  " + item.path).join("\n") + "\n") }]
  const compressed = tar(members), files = readTarArchive(compressed), archiveFile = "synthetic-sf.tar.gz"
  const inventoryBytes = json({ schema: "sf-teams-archive-inventory-v1", sourceSHA: source.sha, sourceTreeSHA: source.tree,
    archiveFile, archiveSha256: hash(compressed), files: files.map((file) => ({ path: file.path, byteLength: file.byteLength, sha256: file.sha256 })) })
  const receiptBytes = json({ schema: "sf-teams-production-artifact-v1", proofRole: "sf-production-archive",
    sourceSHA: source.sha, sourceTreeSHA: source.tree, target: distribution.target, version: distribution.version,
    archiveFile, archiveSha256: hash(compressed), archiveBytes: compressed.length,
    manifestSha256: hash(json(distribution)), inventoryFile: archiveFile + ".inventory.json", inventorySha256: hash(inventoryBytes),
    fileCount: payload.length, archiveFileCount: members.length, webFileCount: 2,
    brand: "sucafina", channel: "prod", viteEnvironmentInputs: 0, extractedVerified: true,
    nativeBrowserProof: "REQUIRED_SEPARATELY", fullSfCi: "REQUIRED_SEPARATELY" })
  const provenance = { schema: "teams-profile-residue-provenance-v1", ...execution, producerJob: "teams-profile-artifact",
    artifact: { id: env.SF_TEAMS_RESIDUE_ARTIFACT_ID, name: "synthetic-unit-control", digest: env.SF_TEAMS_RESIDUE_ARTIFACT_DIGEST,
      workflowRunId: env.GITHUB_RUN_ID, headSha: source.sha, expired: false },
    archiveSha256: hash(compressed), inventorySha256: hash(inventoryBytes), receiptSha256: hash(receiptBytes) }
  return { source, env, archiveFile, compressed, files, inventoryBytes, receiptBytes, provenance, members }
}
function auditFixture(qualify = false) {
  const value = catalog(qualify), catalogBytes = json(value)
  const files = new Map(requiredEntrypoints.filter((entry) => entry.domain === "source")
    .map((entry) => [entry.path, record("source", entry.path, "export const ready = true\n")]))
  files.set("apps/cli/src/index.ts", record("source", "apps/cli/src/index.ts", "export const technical = 'Project.resolve'\n"))
  for (const filename of ["script/sf-ci/team-profile-residue.mjs", "script/sf-ci/team-profile-residue.test.mjs"])
    files.set(filename, record("source", filename, "// Synthetic unit fixture bytes, not a real control receipt.\n"))
  files.set("sf/ci/team-profile-residue.json", record("source", "sf/ci/team-profile-residue.json", catalogBytes))
  const packed = artifactFixture(), records = [...files.values(), ...packed.files]
  return { source, env, records, catalogBytes, artifact: verifyArtifact(packed), value }
}
function obligation(fixture) {
  const file = fixture.records.find((item) => item.path === "script/sf-ci/team-profile-residue.test.mjs")
  return { path: file.path, fileSha256: file.sha256, caseName: controlCases[0] }
}
function disposition(fixture, occurrence) {
  return { occurrenceId: occurrence.id, classification: "different-meaning", symbol: occurrence.seed,
    producer: occurrence.path, consumer: "Synthetic unit-control consumer", entrypoints: [],
    storeField: null, action: "retain synthetic control", owner: "unit-test", reason: "Synthetic assertion of the audit contract, not a real residue approval.",
    testObligations: [obligation(fixture)], reviewSource: source.sha }
}
function complete(fixture) {
  const report = auditResidues(fixture), proof = obligation(fixture)
  const evidenceBinding = { ...report.binding, workflowSHA: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, archiveSha256: fixture.artifact.archiveSha256,
    artifactId: fixture.artifact.artifact.id, artifactDigest: fixture.artifact.artifact.digest }
  const review = { schema: "teams-profile-residue-review-v1", status: "reviewed", ...evidenceBinding,
    reviewSource: source.sha, reviewer: "synthetic-unit-control", reason: "Exercises qualification conditions; never real product acceptance.",
    surfaces: [...surfaces], dispositions: report.occurrences.map((item) => disposition(fixture, item)),
    gaps: report.reachability.findings.map((item) => ({ findingId: item.id, classification: "different-meaning",
      producer: item.path ?? "synthetic graph", consumer: "synthetic unit-control", entrypoints: [], action: "retain synthetic control",
      owner: "unit-test", reason: "Synthetic bounded graph control, not runtime approval.", testObligations: [proof], reviewSource: source.sha })),
    testObligations: [proof] }
  const controls = { schema: "teams-profile-residue-controls-v1", ...execution,
    scannerSha256: fixture.records.find((item) => item.path === "script/sf-ci/team-profile-residue.mjs").sha256,
    testSha256: proof.fileSha256, complete: true, cases: controlCases.map((name) => ({ name, status: "pass" })) }
  const proofs = { schema: "teams-profile-residue-proofs-v1", ...evidenceBinding,
    cases: [{ ...proof, status: "pass", jobId: "1234", evidenceSha256: hash("synthetic evidence fixture") }] }
  return { ...fixture, review, controls, proofs }
}

control(controlCases[0], () => {
  assert.equal(gitBlob(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a")
  // These tree IDs were produced by GitHub's Git-object API, independently of
  // the implementation under test. Dot-vs-directory ordering and modes matter.
  assert.equal(gitTree([{ path: "hello.txt", mode: "100644", type: "blob", oid: gitBlob(Buffer.from("hello\n")) }]),
    "aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7")
  const input = [
    ["a.c", "100644", "value\n"], ["a/x", "100644", "hello\n"], ["exec", "100755", "hello\n"],
    ["link", "120000", "a/x"], ["space name/雪.ts", "100644", "export const snow = 1\n"],
  ].map(([relative, mode, bytes]) => ({ path: relative, mode, type: "blob", oid: gitBlob(Buffer.from(bytes)) }))
  assert.equal(gitTree(input), "2bb8839f55844e44fb22cd46279a3e911a1c5679")
  const actual = treeFixture(input), verified = verifyGitSource(actual.commit, actual.inventory, actual.sha)
  assert.equal(verified.tree, "2bb8839f55844e44fb22cd46279a3e911a1c5679")
  assert.equal(verified.entries.length, 5)
})

control(controlCases[1], () => {
  const entry = { path: "a.ts", mode: "100644", type: "blob", oid: gitBlob(Buffer.from("one")) }
  const fixture = treeFixture([entry, { ...entry, path: "b.ts" }])
  assert.throws(() => verifyGitSource(fixture.commit, treeFixture([entry]).inventory, fixture.sha), /reproduce/)
  assert.throws(() => verifyGitSource(fixture.commit, fixture.inventory, "9".repeat(40)), /commit bytes/)
  for (const pathname of ["../secret", "/tmp/secret", "a\\b", "a//b", "a/./b", "a\nb", "a\tb"]) {
    assert.throws(() => parseTrackedInventory(Buffer.from("100644 blob " + entry.oid + "\t" + pathname + "\0")), /inventory path|tree row/)
  }
  assert.throws(() => parseTrackedInventory(Buffer.from("100644 blob " + entry.oid + "\ta.ts")), /truncated/)
  assert.throws(() => parseTrackedInventory(Buffer.concat([treeFixture([entry]).inventory, treeFixture([entry]).inventory])), /duplicate/)
  assert.throws(() => parseTrackedInventory(Buffer.from("160000 blob " + entry.oid + "\ta.ts\0")), /tree row/)
  assert.throws(() => gitTree([entry, { ...entry, path: "a.ts/child" }]), /parent directory/)
})

control(controlCases[2], async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sf-residue-source-"))
  try {
    const bytes = Buffer.from("Project.resolve\n"), entries = [{ path: "script.ts", mode: "100755", type: "blob", oid: gitBlob(bytes) }]
    await writeFile(path.join(root, "script.ts"), bytes); await chmod(path.join(root, "script.ts"), 0o755)
    const tree = treeFixture(entries), verified = verifyGitSource(tree.commit, tree.inventory, tree.sha)
    const read = await readSource(root, verified)
    assert.equal(read.byteBoundCount, 1); assert.equal(read.records[0].sha256, hash(bytes)); assert.equal(read.contentsComplete, true)
    await writeFile(path.join(root, "script.ts"), "changed")
    await assert.rejects(readSource(root, verified), /differ from Git/)
    await writeFile(path.join(root, "script.ts"), bytes); await chmod(path.join(root, "script.ts"), 0o644)
    await assert.rejects(readSource(root, verified), /executable mode/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

control(controlCases[3], async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sf-residue-links-"))
  const outside = await mkdtemp(path.join(tmpdir(), "sf-residue-outside-"))
  try {
    await writeFile(path.join(outside, "private.ts"), "must not be read")
    await symlink(outside, path.join(root, "escape"))
    const linked = { path: "escape/private.ts", mode: "100644", type: "blob", oid: gitBlob(Buffer.from("must not be read")) }
    const nested = treeFixture([linked])
    await assert.rejects(readSource(root, verifyGitSource(nested.commit, nested.inventory, nested.sha)), /real in-checkout directory/)
    const entries = [{ path: "escape", mode: "120000", type: "blob", oid: gitBlob(Buffer.from(outside)) },
      { path: "unloaded", mode: "160000", type: "commit", oid: "5".repeat(40) }]
    const raw = treeFixture(entries), loaded = await readSource(root, verifyGitSource(raw.commit, raw.inventory, raw.sha))
    assert.equal(loaded.contentsComplete, false); assert.equal(loaded.trackedCount, 2); assert.equal(loaded.byteBoundCount, 1)
    assert.deepEqual(loaded.gaps.map((item) => item.kind).sort(), ["gitlink-contents-unavailable", "symlink-target-not-followed"])
    assert.equal(loaded.records[0].text, outside)
    assert(!loaded.records.some((item) => item.path.endsWith("private.ts")))
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) }
})

control(controlCases[4], () => {
  const utf16 = Buffer.concat([Buffer.from([255, 254]), Buffer.from("projectId", "utf16le")])
  const records = [record("source", "docs/history.md", "projectId twice projectId"),
    record("source", "source.ts", utf16), record("archive", "bin/orchestra", Buffer.from([0, ...Buffer.from("Project.resolve"), 0]))]
  const result = findOccurrences(records)
  assert.equal(result.length, 4)
  assert.equal(new Set(result.map((item) => item.id)).size, 4)
  assert(result.some((item) => item.domain === "archive" && item.encoding === "utf8"))
  assert(result.some((item) => item.encoding === "utf16le" && item.byteOffset === 2))
  const planted = findOccurrences([...records, record("archive", "bin/web/new.js", "const profileProject = 1")])
  assert(planted.length > result.length)
  assert.equal(record("source", "safe.ts", "projectId", { sha256: "forged", domain: "forged", path: "../forged" }).sha256, hash("projectId"))
})

control(controlCases[5], () => {
  const fixture = auditFixture(), initial = auditResidues(fixture)
  const selected = initial.occurrences.find((item) => item.path === "apps/cli/src/index.ts")
  const value = { ...fixture.value, dispositions: [disposition(fixture, selected)] }
  const bytes = json(value)
  const records = fixture.records.map((file) => file.path === "sf/ci/team-profile-residue.json" ? record("source", file.path, bytes) : file)
  const observed = auditResidues({ ...fixture, records, catalogBytes: bytes })
  assert.equal(observed.occurrences.filter((item) => item.disposition !== null).length, 1)
  assert(observed.counts.unclassified > 0)
  const changed = records.map((file) => file.path === selected.path ? record(file.domain, file.path, "Project.resolve + projectId") : file)
  assert.throws(() => auditResidues({ ...fixture, records: changed, catalogBytes: bytes }), /stale or foreign occurrence/)
})

control(controlCases[6], () => {
  const value = catalog()
  assert.throws(() => validateManifest({ ...value, exclusions: ["**/docs/**"] }), /unknown or missing/)
  assert.throws(() => validateManifest({ ...value, status: "PASS" }), /self-certify/)
  assert.throws(() => validateManifest({ ...value, seeds: value.seeds.slice(1) }), /mandatory literal/)
  assert.throws(() => validateManifest({ ...value, entrypoints: value.entrypoints.filter((entry) => entry.surface !== "cli-command-registry") }), /mandatory runtime/)
  assert.throws(() => validateManifest({ ...value, dispositions: [{ pattern: "projectId", classification: "technical-placement" }] }), /unknown or missing/)
  assert.throws(() => parseCanonicalJson(Buffer.from('{"a":1,"a":2}'), "test"), /canonical/)
  assert.throws(() => parseArguments(["--source", ".", "--manifest", "catalog.json", "--output", "/tmp/report", "--source", "other"]), /duplicate/)
  assert.throws(() => parseArguments(["--source", ".", "--manifest", "catalog.json", "--output", "/tmp/report"]), /selection/)
  const sourceOnly = ["--source", ".", "--manifest", "catalog.json", "--output", "/tmp/report"]
  assert.throws(() => parseArguments([...sourceOnly, "--diagnostic-source-only", "--installed-release", "/opt/release"]), /selection/)
  assert.equal(parseArguments([...sourceOnly, "--archive", "/tmp/archive.tar.gz", "--installed-release", "/opt/release"])["installed-release"], "/opt/release")
  assert.throws(() => parseArguments([...sourceOnly, "--diagnostic-source-only", "--stage-private-release", "/tmp/release"]), /selection/)
  assert.throws(() => parseArguments([...sourceOnly, "--archive", "/tmp/a.tgz", "--installed-release", "/opt/release",
    "--stage-private-release", "/tmp/release"]), /selection/)
  const archive = [...sourceOnly, "--archive", "/tmp/a.tgz"]
  assert.throws(() => parseArguments([...archive, "--service-pid", "123"]), /selection/)
  const installed = [...archive, "--installed-release", "/opt/release"]
  for (const pid of ["0", "1e2", "9007199254740992"])
    assert.throws(() => parseArguments([...installed, "--service-pid", pid]), /selection/)
  assert.equal(parseArguments([...installed, "--service-pid", "123"])["service-pid"], "123")
})

test("private staging confines the verified archive and its report to separate fresh runner paths", async (t) => {
  const temporary = await realpath(await mkdtemp(path.join(tmpdir(), "teams-stage-audit-")))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const root = path.join(temporary, "checkout"), runnerTemp = path.join(temporary, "runner")
  await Promise.all([mkdir(root), mkdir(runnerTemp)])
  const destination = path.join(runnerTemp, "release"), output = path.join(runnerTemp, "report.json")
  const args = { root, runnerTemp, destination, output }
  await assert.doesNotReject(requirePrivateStagePaths(args))
  await assert.rejects(requirePrivateStagePaths({ ...args, destination: path.join(root, "release") }), /outside the checkout/)
  await assert.rejects(requirePrivateStagePaths({ ...args, output: destination }), /separate/)
  await assert.rejects(requirePrivateStagePaths({ ...args, output: path.join(temporary, "report.json") }), /inside RUNNER_TEMP/)
  await writeFile(output, "keep")
  await assert.rejects(requirePrivateStagePaths(args), /fresh report path/)
})

control(controlCases[7], () => {
  const records = [
    record("source", "entry.ts", "import { value } from './target'; function load() { return import(selectPath()) }; value();\n"),
    record("source", "target.ts", "export function value() { return 'projectId' }\n"),
    record("archive", "bin/web/index.html", '<script src="./assets/app.js"></script>\n'),
    record("archive", "bin/web/assets/app.js", "export const x = 1\n"),
  ]
  const graph = buildReachability(records, [{ id: "entry", domain: "source", path: "entry.ts", surface: "cli-entry" }])
  assert(graph.edges.some((edge) => edge.targets.includes("target.ts") && edge.status === "resolved"))
  assert.equal(graph.unresolved.length, 1)
  assert.equal(graph.unresolved[0].specifier, null)
  assert(graph.calls.some((call) => call.caller === "load" && call.resolution === "lexical-callsite-only"))
  assert.deepEqual(graph.reachable["target.ts"][0].importPath, ["entry.ts", "target.ts"])
  assert.equal(graph.semanticCallGraphQualified, false)
  const packed = buildReachability(records, [{ id: "web", domain: "archive", path: "bin/web/index.html", surface: "web-entry" }], "archive")
  assert(packed.edges.some((edge) => edge.kind === "html-content-reference" && edge.targets.includes("bin/web/assets/app.js")))
})

control(controlCases[8], () => {
  const fixture = artifactFixture()
  assert.equal(fixture.files.length, 6)
  assert.equal(fixture.files.find((file) => file.path === "bin/orchestra").encoding, "binary")
  assert(findOccurrences(fixture.files).some((item) => item.path === "bin/web/assets/app.js" && item.seed === "projectId"))
  for (const member of fixture.members) {
    const file = fixture.files.find((file) => file.path === member.path)
    assert.equal(file.sha256, hash(member.data))
    assert.equal(file.byteLength, member.data.length)
  }
})

control(controlCases[9], () => {
  for (const relative of ["../outside", "/etc/secret", "a/../secret", "a\\secret"])
    assert.throws(() => readTarArchive(tar([{ path: relative, data: "x" }])), /unsafe inventory path/)
  for (const type of ["1", "2", "3", "4", "6", "L"])
    assert.throws(() => readTarArchive(tar([{ path: "link", data: "", type }])), /unsupported member/)
  assert.throws(() => readTarArchive(tar([{ path: "same", data: "a" }, { path: "same", data: "b" }])), /duplicate/)
  assert.throws(() => readTarArchive(tar([{ path: "parent", data: "a" }, { path: "parent/child", data: "b" }])), /parent directory/)
  const raw = gunzipSync(tar([{ path: "file", data: "projectId" }]))
  const broken = Buffer.from(raw); broken[0] ^= 1
  assert.throws(() => readTarArchive(gzipSync(broken)), /checksum/)
  assert.throws(() => readTarArchive(gzipSync(raw.subarray(0, raw.length - 512))), /truncated end marker|did not close/)
  assert.throws(() => readTarArchive(Buffer.from("not an archive")), /actual gzip/)
})

control(controlCases[10], () => {
  const fixture = artifactFixture(), receipt = verifyArtifact(fixture)
  assert.equal(receipt.status, "BOUND")
  assert.equal(receipt.source.sha, source.sha)
  assert.notEqual(receipt.source.sha, receipt.workflowSHA)
  assert.equal(receipt.workflowSHA, env.GITHUB_SHA)
  assert.equal(receipt.memberCount, fixture.files.length)
  assert.equal(receipt.archiveSha256, hash(fixture.compressed))
  assert.equal(receipt.inventorySha256, hash(fixture.inventoryBytes))
})

control(controlCases[11], () => {
  const fixture = artifactFixture()
  assert.throws(() => verifyArtifact({ ...fixture, env: { ...env, SF_PRODUCT_SOURCE_SHA: env.GITHUB_SHA } }), /hosted source/)
  assert.throws(() => verifyArtifact({ ...fixture, provenance: { ...fixture.provenance, workflowSHA: source.sha } }), /provenance/)
  assert.throws(() => verifyArtifact({ ...fixture, provenance: { ...fixture.provenance, runId: "999" } }), /provenance/)
  assert.throws(() => verifyArtifact({ ...fixture, provenance: { ...fixture.provenance,
    artifact: { ...fixture.provenance.artifact, headSha: env.GITHUB_SHA } } }), /provenance/)
  assert.throws(() => verifyArtifact({ ...fixture, env: { ...env, SF_TEAMS_RESIDUE_ARTIFACT_DIGEST: "sha256:" + "9".repeat(64) } }), /provenance/)
  assert.throws(() => verifyArtifact({ ...fixture, files: fixture.files.slice(1) }), /count mismatch/)
  const inventory = parseCanonicalJson(fixture.inventoryBytes, "test")
  inventory.files[0].sha256 = "0".repeat(64)
  const inventoryBytes = json(inventory), receipt = parseCanonicalJson(fixture.receiptBytes, "test")
  receipt.inventorySha256 = hash(inventoryBytes)
  assert.throws(() => verifyArtifact({ ...fixture, inventoryBytes, receiptBytes: json(receipt) }), /actual archive members/)
  const changed = Buffer.from(fixture.compressed); changed[changed.length - 5] ^= 1
  assert.throws(() => verifyArtifact({ ...fixture, compressed: changed }), /actual bytes/)
})

control(controlCases[12], () => {
  assert.deepEqual(findOccurrences([record("source", "no-matches.txt", "ordinary unrelated content")]), [])
  const fixture = auditFixture(), report = auditResidues({ ...fixture, artifact: undefined,
    records: fixture.records.filter((file) => file.domain === "source") })
  assert.equal(report.status, "DIAGNOSTIC_UNQUALIFIED")
  assert(report.blockers.includes("same-run-actual-archive-missing"))
  assert(report.blockers.includes("independent-current-source-review-missing"))
  assert(report.blockers.includes("executed-test-obligations-missing"))
  assert.equal(report.review.status, "MISSING")
  assert.equal(report.proofs.status, "MISSING")
  assert(report.blockers.includes("executed-negative-controls-missing"))
  assert(report.counts.unknownOccurrences > 0)
  assert(report.occurrences.every((item) => item.disposition === null))
})

control(controlCases[13], () => {
  const fixture = complete(auditFixture(true))
  assert.equal(auditResidues(fixture).status, "PASS")
  const missingReview = auditResidues({ ...fixture, review: undefined })
  assert.equal(missingReview.status, "DIAGNOSTIC_UNQUALIFIED")
  assert(missingReview.blockers.includes("independent-current-source-review-missing"))
  assert(!missingReview.blockers.includes("executed-test-obligations-missing"))
  assert.equal(auditResidues({ ...fixture, controls: undefined }).status, "DIAGNOSTIC_UNQUALIFIED")
  const missingProofs = auditResidues({ ...fixture, proofs: undefined })
  assert.equal(missingProofs.status, "DIAGNOSTIC_UNQUALIFIED")
  assert(missingProofs.blockers.includes("executed-test-obligations-missing"))
  assert(!missingProofs.blockers.includes("independent-current-source-review-missing"))
  assert.equal(auditResidues({ ...fixture, review: { ...fixture.review, gaps: [] } }).status, "DIAGNOSTIC_UNQUALIFIED")
  assert.equal(auditResidues({ ...fixture, proofs: { ...fixture.proofs, cases: [] } }).status, "DIAGNOSTIC_UNQUALIFIED")
  assert.throws(() => auditResidues({ ...fixture, review: { ...fixture.review, graphSha256: "9".repeat(64) } }), /complete exact current audit/)
  for (const field of ["runAttempt", "archiveSha256", "artifactId", "artifactDigest", "occurrencesSha256", "gapsSha256"]) {
    assert.throws(() => auditResidues({ ...fixture, review: { ...fixture.review, [field]: "wrong" } }), /complete exact current audit/)
    assert.throws(() => auditResidues({ ...fixture, proofs: { ...fixture.proofs, [field]: "wrong" } }), /exact audit/)
  }
  const active = structuredClone(fixture.review)
  active.dispositions[0].classification = "active-legacy"
  const denied = auditResidues({ ...fixture, review: active })
  assert.equal(denied.status, "DIAGNOSTIC_UNQUALIFIED"); assert.equal(denied.counts.activeLegacy, 1)
  active.dispositions[0].classification = "orphan"
  assert.equal(auditResidues({ ...fixture, review: active }).counts.orphan, 1)
  assert.throws(() => auditResidues({ ...fixture, proofs: { ...fixture.proofs,
    cases: fixture.proofs.cases.map((item) => ({ ...item, status: "skipped" })) } }), /skipped failed/)
})

control(controlCases[14], () => {
  const fixture = complete(auditFixture(true))
  const originalBytes = Buffer.from(fixture.catalogBytes)
  assert(fixture.review.dispositions.some((item) => item.producer === "sf/ci/team-profile-residue.json"))
  const report = auditResidues(fixture)
  assert.equal(report.status, "PASS")
  assert.equal(report.counts.unclassified, 0); assert.equal(report.counts.activeLegacy, 0); assert.equal(report.counts.orphan, 0)
  assert.equal(report.review.status, "BOUND")
  assert.deepEqual(fixture.catalogBytes, originalBytes)
  assert.equal(report.binding.catalogSha256, hash(originalBytes))
  assert.equal(report.binding.sourceSHA, source.sha)
  // The review is an external exact-source sidecar. Its contents never change
  // the file whose occurrence IDs it reviews, and current bytes remain bound.
  const stale = { ...fixture.review, sourceTreeSHA: "9".repeat(40) }
  assert.throws(() => auditResidues({ ...fixture, review: stale }), /complete exact current audit/)
  const planted = [...fixture.records, record("archive", "bin/web/added.js", "profileProject")]
  assert.throws(() => auditResidues({ ...fixture, records: planted }), /complete exact current audit/)
})

control(controlCases[15], () => {
  const fixture = complete(auditFixture(true))
  assert.equal(verifyControls(fixture.controls, source, fixture.records, env).status, "VERIFIED")
  assert.throws(() => verifyControls({ ...fixture.controls, cases: fixture.controls.cases.slice(1) }, source, fixture.records, env), /negative controls/)
  assert.throws(() => verifyControls({ ...fixture.controls, cases: fixture.controls.cases.map((item, index) =>
    index === 0 ? { ...item, status: "skipped" } : item) }, source, fixture.records, env), /negative controls/)
  assert.throws(() => verifyControls({ ...fixture.controls, cases: fixture.controls.cases.map((item, index) =>
    index === 0 ? fixture.controls.cases[1] : item) }, source, fixture.records, env), /negative controls/)
  assert.throws(() => verifyControls({ ...fixture.controls, testSha256: "9".repeat(64) }, source, fixture.records, env), /negative controls/)
  assert.throws(() => verifyControls({ ...fixture.controls, runAttempt: "1" }, source, fixture.records, env), /negative controls/)
})

// Only actual returned test bodies can produce this receipt. A failed, skipped,
// cancelled, omitted or renamed control leaves no complete receipt. The trusted
// job also requires Node's exit status and preserves its real TAP output.
after(async () => {
  assert.deepEqual([...registered].sort(), [...controlCases].sort(), "all required controls registered")
  assert.deepEqual([...completed].sort(), [...controlCases].sort(), "all required control bodies returned")
  const output = process.env.SF_TEAMS_RESIDUE_CONTROLS_FILE
  if (!output) return
  assert.equal(process.env.GITHUB_ACTIONS, "true")
  assert.equal(process.env.GITHUB_REPOSITORY, "gustavomhss/Orchestra-SF")
  assert.equal(process.env.GITHUB_REPOSITORY_ID, "1455724710")
  assert.equal(process.env.RUNNER_OS, "Linux"); assert.equal(process.env.RUNNER_ARCH, "X64")
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/)
  assert.match(process.env.GITHUB_RUN_ID ?? "", /^[1-9][0-9]*$/)
  assert.match(process.env.GITHUB_RUN_ATTEMPT ?? "", /^[1-9][0-9]*$/)
  assert(path.isAbsolute(output)); assert(path.isAbsolute(process.env.RUNNER_TEMP ?? ""))
  const root = await realpath(fileURLToPath(new URL("../..", import.meta.url)))
  const temporary = await realpath(process.env.RUNNER_TEMP), parent = await realpath(path.dirname(output))
  const relative = path.relative(temporary, parent), sourceRelative = path.relative(root, parent)
  assert(relative === "" || !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
  assert(sourceRelative === ".." || sourceRelative.startsWith(".." + path.sep) || path.isAbsolute(sourceRelative))
  const verified = verifyGitSource(await readFile(process.env.SF_TEAMS_RESIDUE_COMMIT_FILE),
    await readFile(process.env.SF_TEAMS_RESIDUE_TRACKED_FILE), process.env.SF_PRODUCT_SOURCE_SHA)
  const scannerBytes = await readFile(new URL("./team-profile-residue.mjs", import.meta.url))
  const testBytes = await readFile(fileURLToPath(import.meta.url))
  assert.equal(gitBlob(scannerBytes), verified.entries.find((entry) => entry.path === "script/sf-ci/team-profile-residue.mjs")?.oid)
  assert.equal(gitBlob(testBytes), verified.entries.find((entry) => entry.path === "script/sf-ci/team-profile-residue.test.mjs")?.oid)
  const receipt = { schema: "teams-profile-residue-controls-v1", sourceSHA: verified.sha, sourceTreeSHA: verified.tree,
    workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    scannerSha256: hash(scannerBytes), testSha256: hash(testBytes), complete: true,
    cases: controlCases.map((name) => ({ name, status: "pass" })) }
  await writeFile(output, json(receipt), { flag: "wx", mode: 0o600 })
})
