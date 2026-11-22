import test from "node:test"
import assert from "node:assert/strict"
import { admitScanner, canonical, exactRequest, expectedCases, files, hash, importCases, importFiles, microsoftCases, microsoftFiles, parseScannerRequest, verifyScannerEvidence } from "./team-profile-scanner.mjs"

// All observations below are synthetic inputs to the verifier. They are never
// service evidence, a Teams tenant observation, or an actual G06 receipt.
function fixture() {
  const candidateSha = "a".repeat(40), candidateTree = "b".repeat(40), snapshotSha = "c".repeat(40)
  const request = exactRequest()
  const envelope = { schema: "teams-profile-scanner-v1", candidateSha, candidateTree, requestSha256: hash(canonical(request)), selection: "controls" }
  const input = { ...request, teamsProfileScanner: envelope }
  const env = {
    GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "gustavomhss/Orchestra-SF", GITHUB_REPOSITORY_ID: "1455724710",
    GITHUB_EVENT_NAME: "push", RUNNER_OS: "Linux", RUNNER_ARCH: "X64", GITHUB_SHA: snapshotSha,
    GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_WORKSPACE: "/fixture/repo", RUNNER_TEMP: "/fixture/tmp",
    GITHUB_REF_NAME: "tp-scan-" + candidateSha.slice(0, 12) + envelope.requestSha256.slice(0, 12) + "1",
    SF_TEAMS_SCANNER_HEAD: snapshotSha, SF_TEAMS_SCANNER_PARENT: candidateSha, SF_TEAMS_SCANNER_TREE: candidateTree,
    SF_TEAMS_SCANNER_CHANGED: ".ci-run.json",
    ORCHESTRA_CHANNEL: "prod", ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "strict", ORCHESTRA_OMNI_CONTROL: "declared",
    ORCHESTRA_OMNI_CONTROL_NONCE: "d".repeat(32),
  }
  const admission = admitScanner(input, env)
  const report = Buffer.from("synthetic JUnit bytes for a verifier unit test")
  const cases = expectedCases.map(([file, name]) => ({ file, name, classname: "", failures: 0, errors: 0, skipped: 0, todo_identified: 0, executed: 1, known_control_or_hook: 0, product_executed: 1 }))
  const summary = { schema_version: 1, status: "PASS", report_sha256: hash(report), issues: [], counts: {
    tests: expectedCases.length, failures: 0, errors: 0, skipped: 0, todo_identified: 0, executed: expectedCases.length, known_control_or_hook: 0, product_executed: expectedCases.length,
  }, cases }
  const root = env.RUNNER_TEMP + "/sf-teams-profile-scan-123-1.Abcdef"
  const lock = { version: "1.5.0", asset: { url: "https://example.invalid/pinned.deb", sha256: "f".repeat(64), size: 100 },
    database: { mirror: "official.invalid", required: ["main", "daily", "bytecode"] },
    services: { main: { port: 3310 }, error: { port: 3311 } } }
  const setup = { schema: "teams-profile-scanner-setup-v1", status: "READY", syntheticDatabase: false,
    productSnapshot: snapshotSha, runId: "123", runAttempt: "1", root, teamsProfile: envelope, controls: "PASS_DAEMON_ONLY" }
  const service = { github_sha: snapshotSha, run_id: "123", run_attempt: "1", work_directory: root }
  for (const [index, kind] of ["main", "error"].entries()) service[kind] = {
    pid: 200 + index, host: "127.0.0.1", port: lock.services[kind].port,
    executable: root + "/root/usr/local/sbin/clamd", config: root + "/clamd-" + kind + ".conf", start_time: "42", listen_inode: "55",
  }
  const records = {
    OPERATIONS63_REAL_CLAMD: { sha: snapshotSha, run: "123", version: "ClamAV 1.5.0/1", clean: true, eicar: false, clean_after: true, eicar_bytes: 68, clean_bytes: 1000 },
    OPERATIONS63_REAL_ERROR: { response: "INSTREAM size limit exceeded. ERROR", admitted: false, main_clean: true },
    OPERATIONS63_REAL_DOWN: { pid: service.error.pid, connection_refused: true, admitted: false, main_clean: true },
    OPERATIONS75_REAL_MALFORMED: { sha: snapshotSha, run: "123", replies: [
      { response: "UNKNOWN COMMAND", clean_after: true }, { response: "UNKNOWN COMMAND", clean_after: true },
    ] },
    OPERATIONS75_PRIVATE_IMPORT: { clean: true, eicar: false, clean_after: true, denied_durable_effects: 0 },
    OPERATIONS75_PRIVATE_UPLOAD: { clean: true, eicar: false, clean_after: true, denied_durable_effects: 0 },
    OPERATIONS75_PRIVATE_DOWN: { connection_refused: true, import_admitted: false, upload_admitted: false, denied_durable_effects: 0, main_clean: true },
    G06_MALFORMED_FILE: { sha: snapshotSha, run: "123", transport: "loopback-http",
      inputs: ["format-mismatch", "truncated-xlsx"].map((kind) => ({ kind, benign: true,
        digest: "7".repeat(64), bytes: 100, scanner_accepted: true, staged: true,
        rejected_at: "preview", http_status: 400, result: "needs-input", durable_effects: 0 })),
      truncated_source_bytes: 122, truncated_source_digest: "8".repeat(64),
      truncated_removed_bytes: 22, main_clean_after: true },
  }
  const log = Object.entries(records).map(([name, value]) => name + " " + JSON.stringify(value)).join("\n") +
    "\n" + Array.from({ length: 4 }, () => 'G06_PRIVATE_CLEANUP {"fixtures":1,"directories_removed":true}').join("\n") +
    "\nomni positive control [" + env.ORCHESTRA_OMNI_CONTROL_NONCE + "]: not applicable (no spawn declared)\n"
  const evidence = { admission, env, summary, report, log, nonce: env.ORCHESTRA_OMNI_CONTROL_NONCE, exitCode: 0, setup, service, lock,
    packageEvidence: { source: lock.asset.url, expected: lock.asset, actual: { bytes: 100, sha256: lock.asset.sha256 } },
    databases: { origin: lock.database.mirror, freshclamCompleted: true, testDatabasesEnabled: true, officialDatabaseOnly: true, syntheticDatabase: false,
      files: lock.database.required.map((name) => ({ name: name + ".cvd", bytes: 100, sha256: "e".repeat(64) })) },
    daemonControls: { controls: ["main", "error"].map((kind) => ({ kind, clean: "stream: OK", eicar: "stream: EICAR FOUND", cleanAfter: "stream: OK" })),
      sizeError: "INSTREAM size limit exceeded. ERROR" },
    cleanup: { state: "STOPPED", evidencePreserved: true, results: [
      { kind: "main", status: "STOPPED", pid: 200, startTime: "42" }, { kind: "error", status: "ABSENT" },
    ] },
  }
  return { input, env, evidence }
}

test("admission binds one exact candidate and three control files plus the malformed file obligation without claiming campaign75", () => {
  const f = fixture()
  const admitted = admitScanner(f.input, f.env)
  assert.deepEqual(admitted.request, exactRequest())
  assert.equal(admitted.envelope.schema, "teams-profile-scanner-v1")
  assert.equal(Object.hasOwn(admitted.envelope, "sourceBranch"), false)
  assert.equal(Object.hasOwn(admitted.envelope, "mission"), false)
  assert.deepEqual(parseScannerRequest(JSON.stringify(f.input, null, 2) + "\n"), f.input)
})
for (const [name, mutate] of [
  ["foreign repository", (f) => { f.env.GITHUB_REPOSITORY = "somewhere/else" }],
  ["foreign repository id", (f) => { f.env.GITHUB_REPOSITORY_ID = "1" }],
  ["pull request merge", (f) => { f.env.GITHUB_EVENT_NAME = "pull_request" }],
  ["non Linux", (f) => { f.env.RUNNER_OS = "Windows" }],
  ["non x64", (f) => { f.env.RUNNER_ARCH = "ARM64" }],
  ["different checkout", (f) => { f.env.SF_TEAMS_SCANNER_HEAD = "f".repeat(40) }],
  ["multiple parents", (f) => { f.env.SF_TEAMS_SCANNER_PARENT += " " + "f".repeat(40) }],
  ["wrong parent", (f) => { f.env.SF_TEAMS_SCANNER_PARENT = "f".repeat(40) }],
  ["wrong tree", (f) => { f.env.SF_TEAMS_SCANNER_TREE = "f".repeat(40) }],
  ["extra changed source", (f) => { f.env.SF_TEAMS_SCANNER_CHANGED += "\nproduct.ts" }],
  ["historical branch", (f) => { f.env.GITHUB_REF_NAME = "sf-ops75-" + "a".repeat(12) + "c" + "b".repeat(12) + "1" }],
  ["missing control", (f) => { f.input.args.shift() }],
  ["extra selector", (f) => { f.input.args.push("--test-name-pattern", "clean") }],
  ["unapproved environment", (f) => { f.input.env.GUARDRAIL_APPROVED = "protected-paths" }],
  ["weaker spawner", (f) => { f.input.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER = "1" }],
  ["spoofed mission", (f) => { f.input.teamsProfileScanner.mission = 75 }],
  ["wrong digest", (f) => { f.input.teamsProfileScanner.requestSha256 = "f".repeat(64) }],
  ["zero run", (f) => { f.env.GITHUB_RUN_ID = "0" }],
]) test("admission rejects " + name, () => {
  const f = fixture(); mutate(f)
  assert.throws(() => admitScanner(f.input, f.env), /TEAMS_SCANNER_FAIL_CLOSED/)
})
test("normalization cannot silently retarget the exact package or invocation", () => {
  const f = fixture()
  assert.throws(() => admitScanner(f.input, f.env, (input) => ({ ...input, directory: "modules/other" })), /normalized/)
})
for (const raw of ['{"package":"sucafina","package":"sucafina"}\n', "{", " ".repeat(16385), "{}"]) {
  test("raw request grammar, duplicate evidence and size are enforced " + raw.length, () => {
    assert.throws(() => parseScannerRequest(raw))
  })
}
test("verifier distinguishes real-component receipt scope from installed Teams and no-spawn from Omni pass", () => {
  const { evidence } = fixture()
  const result = verifyScannerEvidence(evidence)
  assert.equal(result.status, "PASS")
  assert.equal(result.proofClass, "COMPONENT_REAL_CLAMD")
  assert.equal(result.installedTeamsProof, false)
  assert.equal(result.omniPositive, false)
  assert.deepEqual(result.cases, expectedCases)
})
for (const [name, mutate] of [
  ["nonzero test exit", (e) => { e.exitCode = 1 }],
  ["missing exit", (e) => { delete e.exitCode }],
  ["changed run", (e) => { e.env.GITHUB_RUN_ID = "124" }],
  ["nonprod", (e) => { e.env.ORCHESTRA_CHANNEL = "dev" }],
  ["weaker invocation", (e) => { e.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER = "1" }],
  ["stale nonce", (e) => { e.nonce = "f".repeat(32) }],
  ["zero cases", (e) => { e.summary.cases = []; e.summary.counts.product_executed = 0 }],
  ["one missing case", (e) => { e.summary.cases.pop() }],
  ["duplicated case", (e) => { e.summary.cases[0] = e.summary.cases[1] }],
  ["wrong source", (e) => { e.summary.cases[0].file = "foreign/" + files[0] }],
  ["skipped case", (e) => { e.summary.cases[0].skipped = 1 }],
  ["todo count", (e) => { e.summary.counts.todo_identified = 1 }],
  ["hidden error", (e) => { e.summary.counts.errors = 1 }],
  ["different XML", (e) => { e.report = Buffer.from("other") }],
  ["synthetic database", (e) => { e.databases.syntheticDatabase = true }],
  ["missing official db", (e) => { e.databases.files.pop() }],
  ["binary mismatch", (e) => { e.packageEvidence.actual = { ...e.packageEvidence.actual, sha256: "0".repeat(64) } }],
  ["stale service", (e) => { e.service.github_sha = "f".repeat(40) }],
  ["foreign root", (e) => { e.service.work_directory = "/different" }],
  ["public port", (e) => { e.service.main.host = "0.0.0.0" }],
  ["wrong daemon pid", (e) => { e.service.error.pid = e.service.main.pid }],
  ["missing process start", (e) => { delete e.service.main.start_time }],
  ["missing socket inode", (e) => { delete e.service.error.listen_inode }],
  ["wrong binary path", (e) => { e.service.main.executable = "/usr/sbin/clamd" }],
  ["false daemon EICAR", (e) => { e.daemonControls.controls[0].eicar = "stream: OK" }],
  ["missing size error", (e) => { delete e.daemonControls.sizeError }],
  ["negative product EICAR", (e) => { e.log = e.log.replace('"eicar":false', '"eicar":true') }],
  ["missing private boundary", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("OPERATIONS75_PRIVATE_DOWN ")).join("\n") }],
  ["duplicate product evidence", (e) => { e.log += "\n" + e.log.split("\n")[0] }],
  ["missing benign malformed file", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("G06_MALFORMED_FILE ")).join("\n") }],
  ["malformed file bypassed scanner", (e) => { e.log = e.log.replace('"scanner_accepted":true', '"scanner_accepted":false') }],
  ["malformed file accepted as preview", (e) => { e.log = e.log.replace('"http_status":400', '"http_status":200') }],
  ["malformed file durable effect", (e) => { e.log = e.log.replace('"durable_effects":0', '"durable_effects":1') }],
  ["truncation mislabeled as other input", (e) => { e.log = e.log.replace('"kind":"truncated-xlsx"', '"kind":"format-mismatch"') }],
  ["truncated bytes mismatch", (e) => { e.log = e.log.replace('"truncated_source_bytes":122', '"truncated_source_bytes":200') }],
  ["malformed file in-process shortcut", (e) => { e.log = e.log.replace('"transport":"loopback-http"', '"transport":"direct-handler"') }],
  ["private fixture not removed", (e) => { e.log = e.log.replace('"directories_removed":true', '"directories_removed":false') }],
  ["missing private fixture cleanup", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("G06_PRIVATE_CLEANUP ")).join("\n") }],
  ["missing cleanup", (e) => { e.cleanup.state = "RUNNING" }],
  ["wrong cleanup PID", (e) => { e.cleanup.results[0].pid = 999 }],
  ["only one cleanup", (e) => { e.cleanup.results.pop() }],
  ["missing Omni", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("omni positive control")).join("\n") }],
]) test("verifier rejects " + name, () => {
  const { evidence } = fixture(); mutate(evidence)
  assert.throws(() => verifyScannerEvidence(evidence))
})
test("Bun classname and absolute file spellings still identify only the exact sources", () => {
  const { evidence } = fixture()
  for (const entry of evidence.summary.cases) {
    entry.classname = "./" + entry.file
    entry.file = ""
  }
  assert.equal(verifyScannerEvidence(evidence).status, "PASS")
  for (let index = 0; index < evidence.summary.cases.length; index++) {
    evidence.summary.cases[index].file = evidence.env.GITHUB_WORKSPACE + "/modules/sucafina/" + expectedCases[index][0]
    evidence.summary.cases[index].classname = ""
  }
  assert.equal(verifyScannerEvidence(evidence).status, "PASS")
})

test("truncated XLSX refusal preserves an observed scanner boundary without inventing parser coverage", () => {
  const { evidence } = fixture()
  evidence.log = evidence.log.split("\n").map((line) => {
    if (!line.startsWith("G06_MALFORMED_FILE ")) return line
    const record = JSON.parse(line.slice("G06_MALFORMED_FILE ".length))
    Object.assign(record.inputs[1], { scanner_accepted: false, staged: false,
      rejected_at: "admission", http_status: 403, result: "denied" })
    return "G06_MALFORMED_FILE " + JSON.stringify(record)
  }).join("\n")
  const result = verifyScannerEvidence(evidence)
  assert.equal(result.malformedApplicationFile.inputs[0].rejected_at, "preview")
  assert.equal(result.malformedApplicationFile.inputs[1].rejected_at, "admission")
  assert.equal(result.proofClass, "COMPONENT_REAL_CLAMD")
  assert.equal(result.installedTeamsProof, false)
})

function microsoftFixture() {
  const f = fixture()
  const request = exactRequest("controls-with-teams")
  const envelope = { ...f.input.teamsProfileScanner, schema: "teams-profile-scanner-v2",
    selection: "controls-with-teams", requestSha256: hash(canonical(request)) }
  f.input = { ...request, teamsProfileScanner: envelope }
  f.env.GITHUB_REF_NAME = "tp-scan-" + envelope.candidateSha.slice(0, 12) + envelope.requestSha256.slice(0, 12) + "1"
  f.env.G05_SOURCE_TREE = "9".repeat(40)
  f.evidence.admission = admitScanner(f.input, f.env)
  f.evidence.setup.teamsProfile = envelope
  f.evidence.summary.cases = microsoftCases.map(([file, name]) => ({ file, name, classname: "", failures: 0, errors: 0,
    skipped: 0, todo_identified: 0, executed: 1, known_control_or_hook: 0, product_executed: 1 }))
  Object.assign(f.evidence.summary.counts, { tests: microsoftCases.length, executed: microsoftCases.length, product_executed: microsoftCases.length })
  const teams = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"]
  const transport = { protocol: "http:", listener: "127.0.0.1", port: 4000, requests: 50, loopbackPeers: 50, ingressRequests: 50 }
  const durable = teams.map((teamObjectId) => ({ teamObjectId, before: "6".repeat(64), after: "6".repeat(64) }))
  const accepted = (team) => ({ httpStatus: 200, bytes: 100, digest: "7".repeat(64), storedDigest: "7".repeat(64),
    versionBefore: 1, versionAfter: 2, downloadStatus: 200, foreignDownloadStatus: 403,
    otherTeam: { teamObjectId: teams.find((id) => id !== team), before: "6".repeat(64), after: "6".repeat(64) } })
  const eicarDigest = hash(Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64"))
  for (const [index, id] of ["private-upload", "denied-owner", "scanner-outage"].entries()) {
    const daemon = index === 2 ? f.evidence.service.error : f.evidence.service.main
    const result = id === "private-upload"
      ? { observations: teams.map((teamObjectId) => ({ teamObjectId, before: accepted(teamObjectId), after: accepted(teamObjectId),
          rejected: { httpStatus: 422, bytes: 68, digest: eicarDigest, durable } })), mainCleanAfter: true }
      : id === "denied-owner" ? { attempts: ["wrong-installation", "wrong-tenant", "selector-route-mismatch", "disabled-team", "revoked-membership"]
          .map((kind) => ({ kind, httpStatus: 403, durable })), mainCleanAfter: true }
      : { connectionRefused: true, attempts: teams.map((teamObjectId) => ({ teamObjectId, httpStatus: 422,
          bytes: 100, digest: "8".repeat(64), durable })), mainCleanAfter: true }
    const value = { schema: "orchestra.g06.microsoft-team-control/1", control: id, status: "PASS",
      sourceSha: f.env.GITHUB_SHA, runId: f.env.GITHUB_RUN_ID, runAttempt: f.env.GITHUB_RUN_ATTEMPT,
      proofClass: "COMPONENT_REAL_CLAMD", composition: "MICROSOFT_TEAM_FACTORY", identityProvider: "CONTROLLED_ENTRA_GRAPH",
      runtimeFactory: "createMicrosoftInstallation", installedTeamsProof: false, finalCandidate: false,
      scanner: { host: daemon.host, port: daemon.port, pid: daemon.pid },
      binding: { installationId: String(index + 1).repeat(64), tenantId: "11111111-1111-4111-8111-111111111111",
        principalObjectId: "33333333-3333-4333-8333-333333333333", teamObjectIds: teams },
      transport, graphRequests: ["/v1.0/me/joinedTeams"], cleanup: { completed: true, directoryRemoved: true }, result }
    f.evidence.log += "G06_MICROSOFT_TEAM_" + id.toUpperCase().replaceAll("-", "_") + " " + JSON.stringify(value) + "\n"
  }
  const ids = ["anonymous-denied", "signed-session-admitted", "team-a-write", "team-b-write", "team-read-isolation",
    "wrong-installation-denied", "wrong-tenant-denied", "selector-route-mismatch-denied", "disabled-team-denied",
    "revoked-membership-denied", "denied-writes-have-no-effect"]
  f.evidence.g05 = { schema: "orchestra.g05.team-http/1", sourceSha: f.env.GITHUB_SHA, sourceTree: f.env.G05_SOURCE_TREE,
    runId: f.env.GITHUB_RUN_ID, runAttempt: f.env.GITHUB_RUN_ATTEMPT, proofClass: "HTTP_LOOPBACK_MICROSOFT_COMPONENT",
    identityProvider: "CONTROLLED_ENTRA_GRAPH", runtimeFactory: "createMicrosoftInstallation", installedTeamsProof: false,
    finalCandidate: false, cleanup: { completed: true }, transport, graphRequests: ["/v1.0/me/joinedTeams"],
    summary: { expected: 11, pass: 11, pending: 0 }, cases: ids.map((id) => ({ id, status: "pass" })),
    durableComparison: { teams: durable } }
  return f
}
function changeMicrosoft(evidence, id, mutate) {
  const prefix = "G06_MICROSOFT_TEAM_" + id.toUpperCase().replaceAll("-", "_") + " "
  evidence.log = evidence.log.split("\n").map((line) => {
    if (!line.startsWith(prefix)) return line
    const record = JSON.parse(line.slice(prefix.length))
    mutate(record)
    return prefix + JSON.stringify(record)
  }).join("\n")
}
test("expanded selection preserves all eight legacy cases, adds three Microsoft cases and retains the original G05 case", () => {
  const f = microsoftFixture()
  assert.deepEqual(microsoftFiles.slice(0, files.length), files)
  assert.deepEqual(microsoftCases.slice(0, expectedCases.length), expectedCases)
  assert.equal(microsoftCases.length, 12)
  assert.equal(admitScanner(f.input, f.env).envelope.schema, "teams-profile-scanner-v2")
  const result = verifyScannerEvidence(f.evidence)
  assert.equal(result.status, "PASS")
  assert.deepEqual(result.legacyCases, expectedCases)
  assert.deepEqual(result.cases, microsoftCases)
  assert.equal(result.microsoftTeams.controls.length, 3)
  assert.equal(result.microsoftTeams.g05Controls.length, 11)
  assert.equal(result.microsoftTeams.installedTeamsProof, false)
  assert.equal(result.microsoftTeams.teamsPrivateImportProof, false)
  assert.equal(result.microsoftTeams.g06Closed, false)
  assert.match(result.microsoftTeams.blocker, /import-admit\/import-preview/)
  assert.equal(result.microsoftTeams.candidateSha, f.input.teamsProfileScanner.candidateSha)
  assert.equal(result.microsoftTeams.snapshotSha, f.env.GITHUB_SHA)
  assert.notEqual(result.microsoftTeams.candidateSha, result.microsoftTeams.snapshotSha)
})
for (const [name, mutate] of [
  ["legacy schema with expanded selection", (f) => { f.input.teamsProfileScanner.schema = "teams-profile-scanner-v1" }],
  ["unknown selection", (f) => { f.input.teamsProfileScanner.selection = "teams-only" }],
  ["dropped legacy case file", (f) => { f.input.args.shift() }],
  ["missing G05 selector", (f) => { f.input.args.splice(4, 1) }],
  ["duplicated Teams selector", (f) => { f.input.args[4] = f.input.args[3] }],
]) test("expanded admission rejects " + name, () => {
  const f = microsoftFixture(); mutate(f)
  assert.throws(() => admitScanner(f.input, f.env), /TEAMS_SCANNER_FAIL_CLOSED/)
})
for (const [name, mutate] of [
  ["missing Microsoft marker", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("G06_MICROSOFT_TEAM_PRIVATE_UPLOAD ")).join("\n") }],
  ["duplicated Microsoft marker", (e) => { e.log += "\n" + e.log.split("\n").find((line) => line.startsWith("G06_MICROSOFT_TEAM_PRIVATE_UPLOAD ")) }],
  ["installed promotion", (e) => changeMicrosoft(e, "private-upload", (v) => { v.installedTeamsProof = true })],
  ["real authority claim", (e) => changeMicrosoft(e, "private-upload", (v) => { v.identityProvider = "REAL_ENTRA" })],
  ["substituted factory", (e) => changeMicrosoft(e, "private-upload", (v) => { v.runtimeFactory = "createOperationsInstallation" })],
  ["stale run", (e) => changeMicrosoft(e, "private-upload", (v) => { v.runId = "1" })],
  ["wrong scanner endpoint", (e) => changeMicrosoft(e, "private-upload", (v) => { v.scanner.port += 1 })],
  ["wrong owned PID", (e) => changeMicrosoft(e, "scanner-outage", (v) => { v.scanner.pid -= 1 })],
  ["direct handler transport", (e) => changeMicrosoft(e, "private-upload", (v) => { v.transport.protocol = "direct-handler" })],
  ["missing real TCP peer", (e) => changeMicrosoft(e, "private-upload", (v) => { v.transport.loopbackPeers -= 1 })],
  ["missing ingress traversal", (e) => changeMicrosoft(e, "private-upload", (v) => { v.transport.ingressRequests -= 1 })],
  ["missing Graph admission", (e) => changeMicrosoft(e, "private-upload", (v) => { v.graphRequests = [] })],
  ["incomplete cleanup", (e) => changeMicrosoft(e, "private-upload", (v) => { v.cleanup.completed = false })],
  ["remaining directory", (e) => changeMicrosoft(e, "denied-owner", (v) => { v.cleanup.directoryRemoved = false })],
  ["missing clean blob", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].before.storedDigest = "0".repeat(64) })],
  ["no positive version change", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].before.versionAfter = 1 })],
  ["foreign private download admitted", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].before.foreignDownloadStatus = 200 })],
  ["other Team changed on clean upload", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].before.otherTeam.after = "0".repeat(64) })],
  ["wrong EICAR payload", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].rejected.digest = "0".repeat(64) })],
  ["EICAR admitted", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].rejected.httpStatus = 200 })],
  ["EICAR durable change", (e) => changeMicrosoft(e, "private-upload", (v) => { v.result.observations[0].rejected.durable[0].after = "0".repeat(64) })],
  ["missing owner refusal", (e) => changeMicrosoft(e, "denied-owner", (v) => { v.result.attempts.pop() })],
  ["owner refusal changed a blob", (e) => changeMicrosoft(e, "denied-owner", (v) => { v.result.attempts[0].durable[1].after = "0".repeat(64) })],
  ["missing owned outage", (e) => changeMicrosoft(e, "scanner-outage", (v) => { v.result.connectionRefused = false })],
  ["missing second Team outage", (e) => changeMicrosoft(e, "scanner-outage", (v) => { v.result.attempts.pop() })],
  ["main daemon unhealthy", (e) => changeMicrosoft(e, "scanner-outage", (v) => { v.result.mainCleanAfter = false })],
  ["missing G05 receipt", (e) => { delete e.g05 }],
  ["G05 different snapshot tree", (e) => { e.g05.sourceTree = "0".repeat(40) }],
  ["G05 control omitted", (e) => { e.g05.cases.pop() }],
  ["G05 control duplicated", (e) => { e.g05.cases[0] = e.g05.cases[1] }],
  ["G05 cleanup incomplete", (e) => { e.g05.cleanup.completed = false }],
  ["G05 denied durable write", (e) => { e.g05.durableComparison.teams[0].after = "0".repeat(64) }],
]) test("expanded verifier rejects " + name, () => {
  const { evidence } = microsoftFixture(); mutate(evidence)
  assert.throws(() => verifyScannerEvidence(evidence), /TEAMS_SCANNER_FAIL_CLOSED/)
})


function importFixture() {
  const f = microsoftFixture()
  const request = exactRequest("controls-with-imports")
  const envelope = { ...f.input.teamsProfileScanner, schema: "teams-profile-scanner-v3",
    selection: "controls-with-imports", requestSha256: hash(canonical(request)) }
  f.input = { ...request, teamsProfileScanner: envelope }
  f.env.GITHUB_REF_NAME = "tp-scan-" + envelope.candidateSha.slice(0, 12) + envelope.requestSha256.slice(0, 12) + "1"
  f.evidence.admission = admitScanner(f.input, f.env)
  f.evidence.setup.teamsProfile = envelope
  f.evidence.summary.cases = importCases.map(([file, name]) => ({ file, name, classname: "", failures: 0, errors: 0,
    skipped: 0, todo_identified: 0, executed: 1, known_control_or_hook: 0, product_executed: 1 }))
  Object.assign(f.evidence.summary.counts, { tests: importCases.length, executed: importCases.length, product_executed: importCases.length })
  const teams = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"]
  const durable = teams.map((teamObjectId) => ({ teamObjectId, before: "6".repeat(64), after: "6".repeat(64) }))
  const accepted = (team) => ({ httpStatus: 200, ref: "7".repeat(64), bytes: 100, digest: "7".repeat(64),
    storedDigest: "7".repeat(64), proofDigest: "8".repeat(64), catalogDigest: "9".repeat(64),
    otherTeam: { teamObjectId: teams.find((id) => id !== team), before: "6".repeat(64), after: "6".repeat(64) } })
  const eicarDigest = hash(Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64"))
  for (const [index, id] of ["private-admission", "malformed-file", "denied-owner", "scanner-outage"].entries()) {
    const daemon = index === 3 ? f.evidence.service.error : f.evidence.service.main
    const result = id === "private-admission"
      ? { observations: teams.map((teamObjectId) => ({ teamObjectId, before: accepted(teamObjectId), after: accepted(teamObjectId),
          refused: { httpStatus: 403, bytes: 68, digest: eicarDigest, durable } })),
          intakeLimit: { pending: 2, busy: { httpStatus: 503, retryAfter: "1" }, released: [400, 400], durable }, mainCleanAfter: true }
      : id === "malformed-file"
        ? { observations: ["format-mismatch", "truncated-xlsx"].map((kind) => ({ kind, digest: "7".repeat(64), bytes: 100,
            scannerAccepted: true, staged: true, rejectedAt: "preview", httpStatus: 400, admission: accepted(teams[0]), durable })),
          truncatedSourceDigest: "8".repeat(64), truncatedSourceBytes: 122, truncatedRemovedBytes: 22, mainCleanAfter: true }
        : id === "denied-owner"
          ? { attempts: ["wrong-installation", "wrong-tenant", "selector-route-mismatch", "revoked-membership"]
              .map((kind) => ({ kind, httpStatus: 403, durable })),
            foreignReference: { httpStatus: 503, durable },
            missingGrant: { httpStatus: 403, explicitGrants: 0, binding: "e".repeat(64), cleanupComplete: true, durable },
            configurationRevocation: { source: "private-installation-file",
              observations: ["grants:before-request", "roles:before-request", "grants:after-request-body",
                "roles:after-request-body", "unavailable:before-request"].map((value) => {
                  const [kind, boundary] = value.split(":")
                  return { kind, boundary, httpStatus: kind === "unavailable" ? 503 : 403,
                    originalBodyObserved: boundary === "after-request-body", restoredReadStatus: 200, durable }
                }), cleanAfterRestore: accepted(teams[0]) },
            mainCleanAfter: true }
          : { connectionRefused: true, attempts: teams.map((teamObjectId) => ({ teamObjectId, httpStatus: 403,
              bytes: 100, digest: "8".repeat(64), durable })), mainCleanAfter: true }
    const value = { schema: "orchestra.g06.microsoft-team-import-control/2", control: id, status: "PASS",
      sourceSha: f.env.GITHUB_SHA, runId: f.env.GITHUB_RUN_ID, runAttempt: f.env.GITHUB_RUN_ATTEMPT,
      proofClass: "COMPONENT_REAL_CLAMD", composition: "MICROSOFT_TEAM_NATIVE_IMPORT", identityProvider: "CONTROLLED_ENTRA_GRAPH",
      runtimeFactory: "createMicrosoftInstallation", installedTeamsProof: false, finalCandidate: false,
      scanner: { host: daemon.host, port: daemon.port, pid: daemon.pid },
      binding: { installationId: String(index + 5).repeat(64), tenantId: "11111111-1111-4111-8111-111111111111",
        principalObjectId: "33333333-3333-4333-8333-333333333333", teamObjectIds: teams },
      transport: { protocol: "http:", listener: "127.0.0.1", port: 4000, requests: 50, loopbackPeers: 50, ingressRequests: 50 },
      graphRequests: ["/v1.0/me/joinedTeams"], cleanup: { completed: true, directoryRemoved: true }, result }
    f.evidence.log += "G06_MICROSOFT_IMPORT_" + id.toUpperCase().replaceAll("-", "_") + " " + JSON.stringify(value) + "\n"
  }
  return f
}
function changeImport(evidence, id, mutate) {
  const prefix = "G06_MICROSOFT_IMPORT_" + id.toUpperCase().replaceAll("-", "_") + " "
  evidence.log = evidence.log.split("\n").map((line) => {
    if (!line.startsWith(prefix)) return line
    const record = JSON.parse(line.slice(prefix.length))
    mutate(record)
    return prefix + JSON.stringify(record)
  }).join("\n")
}
test("native import selection preserves twelve prior cases and binds four component import controls to the candidate", () => {
  const f = importFixture()
  assert.deepEqual(importFiles.slice(0, microsoftFiles.length), microsoftFiles)
  assert.deepEqual(importCases.slice(0, microsoftCases.length), microsoftCases)
  assert.equal(importFiles.length, 6)
  assert.equal(importCases.length, 16)
  assert.equal(admitScanner(f.input, f.env).envelope.schema, "teams-profile-scanner-v3")
  const result = verifyScannerEvidence(f.evidence)
  assert.equal(result.status, "PASS")
  assert.deepEqual(result.cases, importCases)
  assert.equal(result.microsoftTeams.controls.length, 3)
  assert.equal(result.microsoftTeams.g05Controls.length, 11)
  assert.equal(result.microsoftTeams.teamsPrivateImportProof, false)
  assert.equal(result.microsoftImports.controls.length, 4)
  assert.equal(result.microsoftImports.componentPrivateImportProof, true)
  assert.equal(result.microsoftImports.installedTeamsProof, false)
  assert.equal(result.microsoftImports.finalCandidate, false)
  assert.equal(result.microsoftImports.g06Closed, false)
  assert.equal(result.microsoftImports.candidateSha, f.input.teamsProfileScanner.candidateSha)
  assert.equal(result.microsoftImports.snapshotSha, f.env.GITHUB_SHA)
  assert.notEqual(result.microsoftImports.candidateSha, result.microsoftImports.snapshotSha)
})
for (const [name, mutate] of [
  ["legacy schema with import selection", (f) => { f.input.teamsProfileScanner.schema = "teams-profile-scanner-v1" }],
  ["team schema with import selection", (f) => { f.input.teamsProfileScanner.schema = "teams-profile-scanner-v2" }],
  ["missing native import file", (f) => { f.input.args.splice(5, 1) }],
  ["different native file order", (f) => { [f.input.args[0], f.input.args[5]] = [f.input.args[5], f.input.args[0]] }],
]) test("native import admission rejects " + name, () => {
  const f = importFixture(); mutate(f)
  assert.throws(() => admitScanner(f.input, f.env), /TEAMS_SCANNER_FAIL_CLOSED/)
})
for (const [name, mutate] of [
  ["wrong snapshot", (r) => { r.sourceSha = "f".repeat(40) }],
  ["wrong run", (r) => { r.runId = "124" }],
  ["wrong attempt", (r) => { r.runAttempt = "2" }],
  ["different factory", (r) => { r.runtimeFactory = "testReplacement" }],
  ["claiming live identity", (r) => { r.identityProvider = "REAL_ENTRA_GRAPH" }],
  ["claiming installed proof", (r) => { r.installedTeamsProof = true }],
  ["claiming final candidate", (r) => { r.finalCandidate = true }],
  ["foreign scanner", (r) => { r.scanner.pid += 10 }],
  ["public listener", (r) => { r.transport.listener = "0.0.0.0" }],
  ["unobserved peer", (r) => { r.transport.loopbackPeers -= 1 }],
  ["unobserved ingress", (r) => { r.transport.ingressRequests -= 1 }],
  ["no joined Teams authority", (r) => { r.graphRequests = [] }],
  ["incomplete cleanup", (r) => { r.cleanup.completed = false }],
  ["remaining directory", (r) => { r.cleanup.directoryRemoved = false }],
  ["unhealthy main scanner", (r) => { r.result.mainCleanAfter = false }],
  ["missing shared intake observation", (r) => { delete r.result.intakeLimit }],
  ["accepted third intake", (r) => { r.result.intakeLimit.busy.httpStatus = 200 }],
  ["unreleased intake", (r) => { r.result.intakeLimit.released.pop() }],
  ["durable intake effect", (r) => { r.result.intakeLimit.durable[0].after = "9".repeat(64) }],
  ["no second Team", (r) => { r.result.observations.pop() }],
  ["accepted EICAR", (r) => { r.result.observations[0].refused.httpStatus = 200 }],
  ["different EICAR bytes", (r) => { r.result.observations[0].refused.digest = "8".repeat(64) }],
  ["no clean after EICAR", (r) => { r.result.observations[0].after.httpStatus = 403 }],
  ["unverified private blob", (r) => { r.result.observations[0].before.storedDigest = "8".repeat(64) }],
  ["missing admission proof", (r) => { delete r.result.observations[0].before.proofDigest }],
  ["changed foreign store", (r) => { r.result.observations[0].before.otherTeam.after = "9".repeat(64) }],
  ["durable effect on refused bytes", (r) => { r.result.observations[0].refused.durable[0].after = "9".repeat(64) }],
]) test("native import receipt rejects " + name, () => {
  const { evidence } = importFixture()
  changeImport(evidence, "private-admission", mutate)
  assert.throws(() => verifyScannerEvidence(evidence), /TEAMS_SCANNER_FAIL_CLOSED/)
})
for (const [name, id, mutate] of [
  ["missing format mismatch staging", "malformed-file", (r) => { r.result.observations[0].staged = false }],
  ["malformed refusal by unsupported media", "malformed-file", (r) => { r.result.observations[0].httpStatus = 415 }],
  ["malformed refused before the original parser", "malformed-file", (r) => {
    Object.assign(r.result.observations[0], { scannerAccepted: false, staged: false, rejectedAt: "admission", httpStatus: 403 })
  }],
  ["changed state during malformed preview", "malformed-file", (r) => { r.result.observations[0].durable[0].after = "9".repeat(64) }],
  ["unbound truncated file", "malformed-file", (r) => { r.result.truncatedRemovedBytes = 21 }],
  ["missing refused owner", "denied-owner", (r) => { r.result.attempts.pop() }],
  ["accepted foreign reference", "denied-owner", (r) => { r.result.foreignReference.httpStatus = 200 }],
  ["effects from foreign reference", "denied-owner", (r) => { r.result.foreignReference.durable[1].after = "9".repeat(64) }],
  ["implicit grant", "denied-owner", (r) => { r.result.missingGrant.explicitGrants = 1 }],
  ["accepted absent grant", "denied-owner", (r) => { r.result.missingGrant.httpStatus = 200 }],
  ["uncleaned no-grant fixture", "denied-owner", (r) => { r.result.missingGrant.cleanupComplete = false }],
  ["reused no-grant installation", "denied-owner", (r) => { r.result.missingGrant.binding = "5".repeat(64) }],
  ["missing current private configuration", "denied-owner", (r) => { delete r.result.configurationRevocation }],
  ["inferred configuration source", "denied-owner", (r) => { r.result.configurationRevocation.source = "startup-object" }],
  ["missing private revocation boundary", "denied-owner", (r) => { r.result.configurationRevocation.observations.pop() }],
  ["duplicate private revocation boundary", "denied-owner", (r) => { r.result.configurationRevocation.observations[1] = r.result.configurationRevocation.observations[0] }],
  ["accepted changed private grants", "denied-owner", (r) => { r.result.configurationRevocation.observations[0].httpStatus = 200 }],
  ["body boundary unobserved", "denied-owner", (r) => { r.result.configurationRevocation.observations[2].originalBodyObserved = false }],
  ["effect after private revocation", "denied-owner", (r) => { r.result.configurationRevocation.observations[2].durable[0].after = "9".repeat(64) }],
  ["private policy not restored", "denied-owner", (r) => { r.result.configurationRevocation.observations[3].restoredReadStatus = 403 }],
  ["fallback after unreadable private policy", "denied-owner", (r) => { r.result.configurationRevocation.observations[4].httpStatus = 200 }],
  ["missing clean import after restoration", "denied-owner", (r) => { delete r.result.configurationRevocation.cleanAfterRestore }],
  ["wrong stopped daemon", "scanner-outage", (r) => { r.scanner.pid = 200 }],
  ["unobserved refused connection", "scanner-outage", (r) => { r.result.connectionRefused = false }],
  ["missing second Team outage", "scanner-outage", (r) => { r.result.attempts.pop() }],
  ["accepted outage", "scanner-outage", (r) => { r.result.attempts[0].httpStatus = 200 }],
]) test("native import receipt rejects " + name, () => {
  const { evidence } = importFixture()
  changeImport(evidence, id, mutate)
  assert.throws(() => verifyScannerEvidence(evidence), /TEAMS_SCANNER_FAIL_CLOSED/)
})
test("native import malformed control records actual antivirus rejection of truncated XLSX without replacing the parser case", () => {
  const { evidence } = importFixture()
  changeImport(evidence, "malformed-file", (r) => {
    Object.assign(r.result.observations[1], { scannerAccepted: false, staged: false, rejectedAt: "admission", httpStatus: 403 })
    delete r.result.observations[1].admission
  })
  const result = verifyScannerEvidence(evidence)
  assert.equal(result.microsoftImports.controls[1].result.observations[0].rejectedAt, "preview")
  assert.equal(result.microsoftImports.controls[1].result.observations[1].rejectedAt, "admission")
})
for (const [name, mutate] of [
  ["missing original stopped-daemon marker", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("OPERATIONS63_REAL_DOWN ")).join("\n") }],
  ["missing native import marker", (e) => { e.log = e.log.split("\n").filter((line) => !line.startsWith("G06_MICROSOFT_IMPORT_PRIVATE_ADMISSION ")).join("\n") }],
  ["duplicate native import marker", (e) => { e.log += "\n" + e.log.split("\n").find((line) => line.startsWith("G06_MICROSOFT_IMPORT_PRIVATE_ADMISSION ")) }],
  ["missing legacy selection case", (e) => { e.summary.cases.shift() }],
  ["missing G05 selection case", (e) => { e.summary.cases.splice(11, 1) }],
  ["reused control installation", (e) => { changeImport(e, "malformed-file", (r) => { r.binding.installationId = "5".repeat(64) }) }],
]) test("native selection rejects " + name, () => {
  const { evidence } = importFixture(); mutate(evidence)
  assert.throws(() => verifyScannerEvidence(evidence), /TEAMS_SCANNER_FAIL_CLOSED/)
})
