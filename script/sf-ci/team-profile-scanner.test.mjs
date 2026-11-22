import test from "node:test"
import assert from "node:assert/strict"
import { admitScanner, canonical, exactRequest, expectedCases, files, hash, parseScannerRequest, verifyScannerEvidence } from "./team-profile-scanner.mjs"

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
    G06_MALFORMED_FILE: { sha: snapshotSha, run: "123", transport: "loopback-http", benign: true,
      digest: "7".repeat(64), bytes: 100, scanner_accepted: true, staged: true, preview_status: 400,
      preview_result: "needs-input", preview_durable_effects: 0, main_clean_after: true },
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
  ["malformed file accepted as preview", (e) => { e.log = e.log.replace('"preview_status":400', '"preview_status":200') }],
  ["malformed file durable effect", (e) => { e.log = e.log.replace('"preview_durable_effects":0', '"preview_durable_effects":1') }],
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
