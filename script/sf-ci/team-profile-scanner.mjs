import { createHash } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { controlVerdict, validateRequest } from "../test-ci-request.ts"
import { locateTestPackage } from "../test-ci-location.ts"

const fail = (message) => { throw new Error("TEAMS_SCANNER_FAIL_CLOSED: " + message) }
export const hash = (value) => createHash("sha256").update(value).digest("hex")
export const canonical = (value) => Array.isArray(value) ? "[" + value.map(canonical).join(",") + "]"
  : value !== null && typeof value === "object"
    ? "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}"
    : JSON.stringify(value)
export const files = Object.freeze([
  "Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts",
  "Sucafinav1/test/product/operations-installed-finish/real-malformed.check.ts",
  "Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts",
])
export const expectedCases = Object.freeze([
  [files[0], "real ClamD INSTREAM accepts clean, rejects EICAR and accepts clean again"],
  [files[0], "real ClamD size-limit error is rejected while both real daemons remain responsive"],
  [files[0], "real ClamD outage fails closed after the owned error daemon is stopped"],
  [files[1], "real ClamD rejects unknown and malformed INSTREAM commands and remains healthy"],
  [files[2], "real private import admission persists clean bytes and rejects EICAR without durable effects"],
  [files[2], "real private supplier upload commits clean bytes and rejects EICAR before mutation"],
  [files[2], "private import and supplier upload fail closed against the stopped owned real daemon"],
  [files[2], "real HTTP import preview rejects a benign malformed file after clean ClamD admission without durable preview effects"],
].map(Object.freeze))
export const microsoftFiles = Object.freeze([
  ...files,
  "Sucafinav1/test/product/teams-scanner/private-admission.check.ts",
  "Sucafinav1/test/g05-http-team-isolation.test.ts",
])
export const microsoftCases = Object.freeze([
  ...expectedCases,
  [microsoftFiles[3], "Microsoft Team private upload persists clean bytes and rejects real EICAR with isolated storage"],
  [microsoftFiles[3], "Microsoft Team private upload rejects wrong owners and revoked membership without durable effects"],
  [microsoftFiles[3], "Microsoft Team private upload fails closed against the stopped owned real ClamD"],
  [microsoftFiles[4], "G05 loopback HTTP admits Teams and rejects wrong owners without cross-Team effects"],
].map(Object.freeze))
export const importFiles = Object.freeze([
  ...microsoftFiles,
  "Sucafinav1/test/product/teams-scanner/private-import.check.ts",
])
export const importCases = Object.freeze([
  ...microsoftCases,
  [importFiles[5], "Microsoft Team private import admits clean bytes and rejects real EICAR with isolated staging"],
  [importFiles[5], "Microsoft Team original import preview rejects benign malformed bytes after real clean staging"],
  [importFiles[5], "Microsoft Team private import rejects foreign ownership missing grants and revoked membership"],
  [importFiles[5], "Microsoft Team private import fails closed against the stopped owned real ClamD"],
].map(Object.freeze))
export function selectionInventory(selection = "controls") {
  if (selection === "controls") return { files, cases: expectedCases, schema: "teams-profile-scanner-v1" }
  if (selection === "controls-with-teams") return { files: microsoftFiles, cases: microsoftCases, schema: "teams-profile-scanner-v2" }
  if (selection === "controls-with-imports") return { files: importFiles, cases: importCases, schema: "teams-profile-scanner-v3" }
  fail("unknown control selection")
}
export function exactRequest(selection = "controls") {
  const selected = selectionInventory(selection)
  return {
    package: "sucafina", packageSelector: "packages/sucafina", directory: "modules/sucafina", runner: "bun",
    args: [...selected.files.map((file) => "./" + file), "--timeout", "120000"],
    env: { ORCHESTRA_CHANNEL: "prod", ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "strict" },
  }
}
export function parseScannerRequest(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 16384) fail("request too large or not text")
  const input = JSON.parse(raw)
  if (raw !== JSON.stringify(input, null, 2) + "\n") fail("canonical raw JSON request required; duplicate keys are forbidden")
  return input
}
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
const execution = (env) => ({
  snapshotSha: env.GITHUB_SHA, run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT,
  branch: env.GITHUB_REF_NAME, os: env.RUNNER_OS, arch: env.RUNNER_ARCH,
})
const requireHost = (env) => {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      env.GITHUB_REPOSITORY_ID !== "1455724710" || env.GITHUB_EVENT_NAME !== "push" ||
      env.RUNNER_OS !== "Linux" || env.RUNNER_ARCH !== "X64" || !sha(env.GITHUB_SHA) ||
      !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? "") || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? ""))
    fail("exact hosted Linux x64 identity required")
}
export function admitScanner(input, env, normalize = (body) => body) {
  requireHost(env)
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("request object required")
  const envelope = input.teamsProfileScanner
  const selected = selectionInventory(envelope?.selection)
  const expected = exactRequest(envelope?.selection)
  const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "teamsProfileScanner"))
  if (!isDeepStrictEqual(body, expected)) fail("exact control selection required")
  const request = JSON.parse(JSON.stringify(normalize(body)))
  if (!isDeepStrictEqual(request, expected)) fail("normalized control request changed")
  const requestSha256 = hash(canonical(request))
  if (!envelope || !sha(envelope.candidateSha) || !sha(envelope.candidateTree) ||
      !isDeepStrictEqual(envelope, {
        schema: selected.schema, candidateSha: envelope.candidateSha,
        candidateTree: envelope.candidateTree, requestSha256, selection: envelope.selection,
      })) fail("candidate and normalized request envelope mismatch")
  const branch = "^tp-scan-" + envelope.candidateSha.slice(0, 12) + requestSha256.slice(0, 12) + "[1-9][0-9]{0,2}$"
  if (!new RegExp(branch).test(env.GITHUB_REF_NAME ?? "") ||
      env.SF_TEAMS_SCANNER_HEAD !== env.GITHUB_SHA ||
      env.SF_TEAMS_SCANNER_PARENT !== envelope.candidateSha || env.SF_TEAMS_SCANNER_TREE !== envelope.candidateTree ||
      env.SF_TEAMS_SCANNER_CHANGED !== ".ci-run.json" || env.GITHUB_SHA === envelope.candidateSha)
    fail("single-parent request-only snapshot required")
  return { schema: "teams-profile-scanner-admission-v1", envelope, request, execution: execution(env) }
}
const criticalFiles = Object.freeze([
  ".ci-run.json", ".github/workflows/sf-operations-scanner.yml",
  ".github/actions/setup-bun/action.yml", ".github/actions/omni-binaries/action.yml",
  "script/test-ci-request.ts", "script/test-ci-location.ts", "script/test-omni-control.ts",
  "script/sf-ci/team-profile-scanner.mjs", "script/sf2h/operations-scanner/verify-bun-report.py",
  "script/sf2h/operations-scanner/setup.sh", "script/sf2h/operations-scanner/service.mjs",
  "script/sf2h/operations-scanner/cleanup.sh", "script/sf2h/operations-scanner/tools.lock.json",
  "modules/sucafina/bunfig.toml", ...files.map((file) => "modules/sucafina/" + file),
])
function criticalFor(selection) {
  selectionInventory(selection)
  return selection === "controls" ? criticalFiles : [...criticalFiles,
    "modules/sucafina/Sucafinav1/test/fixture/microsoft-http.ts",
    ...selectionInventory(selection).files.slice(files.length).map((file) => "modules/sucafina/" + file),
    ...(selection === "controls-with-imports" ? [
      "apps/cli/src/sucafina-product/team-imports.ts",
      "modules/sucafina/Sucafinav1/runtime/team-business.ts",
      "modules/sucafina/Sucafinav1/local/microsoft-entry.ts",
      "modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts",
      "apps/cli/src/sucafina-product/import-services.ts",
      "modules/sucafina/Sucafinav1/product/interface/import-http.ts",
      "modules/sucafina/Sucafinav1/product/imports/staged-files.ts",
    ] : []),
  ]
}
function fileAt(root, relative) {
  const name = path.resolve(root, relative)
  if (!name.startsWith(root + path.sep) || !statSync(name, { throwIfNoEntry: false })?.isFile() ||
      realpathSync(name) !== name) fail("missing, escaped or aliased input: " + relative)
  return name
}
function evidenceDirectory(root) { return path.join(root, "teams-profile-scanner-evidence") }
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })
export function readTeamsScannerAdmission(root = realpathSync(process.env.GITHUB_WORKSPACE ?? "."), env = process.env) {
  requireHost(env)
  const receipt = JSON.parse(readFileSync(path.join(evidenceDirectory(root), "admission.json"), "utf8"))
  const critical = criticalFor(receipt.envelope?.selection)
  if (receipt.schema !== "teams-profile-scanner-admission-v1" || !isDeepStrictEqual(receipt.execution, execution(env)) ||
      !Array.isArray(receipt.integrity) || receipt.integrity.length !== critical.length ||
      receipt.integrity.some((item, index) => item.path !== critical[index] || item.sha256 !== hash(readFileSync(fileAt(root, item.path)))))
    fail("admission or tracked source identity changed")
  const raw = readFileSync(fileAt(root, ".ci-run.json"), "utf8")
  if (hash(raw) !== receipt.rawRequestSha256) fail("raw request changed")
  const checked = admitScanner(parseScannerRequest(raw), {
    ...env, SF_TEAMS_SCANNER_HEAD: receipt.execution.snapshotSha, SF_TEAMS_SCANNER_PARENT: receipt.envelope.candidateSha,
    SF_TEAMS_SCANNER_TREE: receipt.envelope.candidateTree, SF_TEAMS_SCANNER_CHANGED: ".ci-run.json",
  })
  if (!isDeepStrictEqual(checked.envelope, receipt.envelope) || !isDeepStrictEqual(checked.request, receipt.request))
    fail("admission does not describe the request")
  return receipt
}
const zero = (value) => Number.isSafeInteger(value) && value === 0
function productObservation(log, marker) {
  const values = log.split(/\r?\n/).filter((line) => line.startsWith(marker + " "))
  if (values.length !== 1) fail("missing or duplicated actual control: " + marker)
  try { return JSON.parse(values[0].slice(marker.length + 1)) } catch { fail("malformed actual control: " + marker) }
}
function sourceOf(entry, workspace, selectedFiles) {
  for (const candidate of [entry.file, entry.classname]) {
    if (typeof candidate !== "string") continue
    const value = candidate.replaceAll("\\", "/").replace(/^\.\//, "")
    for (const file of selectedFiles) if ([file, "modules/sucafina/" + file, workspace + "/modules/sucafina/" + file].includes(value)) return file
  }
}
export function verifyScannerEvidence(input) {
  const { admission, env, summary, report, log, nonce, setup, service, packageEvidence, databases, daemonControls, cleanup, lock } = input
  requireHost(env)
  const selected = selectionInventory(admission.envelope.selection)
  if (!isDeepStrictEqual(admission.execution, execution(env)) || input.exitCode !== 0 ||
      env.ORCHESTRA_CHANNEL !== "prod" || env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER !== "strict" ||
      env.ORCHESTRA_OMNI_CONTROL !== "declared" || !/^[a-f0-9]{32}$/.test(nonce) ||
      env.ORCHESTRA_OMNI_CONTROL_NONCE !== nonce) fail("execution, source or strict invocation mismatch")
  if (summary.schema_version !== 1 || summary.status !== "PASS" || summary.report_sha256 !== hash(report) ||
      !Array.isArray(summary.issues) || summary.issues.length || !Array.isArray(summary.cases) ||
      summary.counts.product_executed !== selected.cases.length ||
      ["failures", "errors", "skipped", "todo_identified"].some((key) => !zero(summary.counts[key])))
    fail("nonempty successful JUnit evidence required")
  const productCases = summary.cases.filter((entry) => entry.known_control_or_hook === 0)
  if (productCases.length !== selected.cases.length ||
      productCases.some((entry) => entry.executed !== 1 || entry.product_executed !== 1 ||
        ["failures", "errors", "skipped", "todo_identified"].some((key) => !zero(entry[key]))))
    fail("every declared product case must execute successfully")
  const observed = productCases.map((entry) => JSON.stringify([sourceOf(entry, env.GITHUB_WORKSPACE, selected.files), entry.name])).sort()
  if (!isDeepStrictEqual(observed, selected.cases.map((entry) => JSON.stringify(entry)).sort()))
    fail("exact file and case inventory required")
  if (setup.schema !== "teams-profile-scanner-setup-v1" || setup.status !== "READY" || setup.syntheticDatabase !== false ||
      setup.productSnapshot !== env.GITHUB_SHA || setup.runId !== env.GITHUB_RUN_ID || setup.runAttempt !== env.GITHUB_RUN_ATTEMPT ||
      !isDeepStrictEqual(setup.teamsProfile, admission.envelope) || setup.controls !== "PASS_DAEMON_ONLY")
    fail("current real daemon setup required")
  if (packageEvidence.source !== lock.asset.url || !isDeepStrictEqual(packageEvidence.expected, lock.asset) ||
      packageEvidence.actual.sha256 !== lock.asset.sha256 || packageEvidence.actual.bytes !== lock.asset.size ||
      databases.origin !== lock.database.mirror || databases.freshclamCompleted !== true || databases.testDatabasesEnabled !== true ||
      databases.officialDatabaseOnly !== true || databases.syntheticDatabase !== false ||
      !Array.isArray(databases.files) || lock.database.required.some((name) =>
        databases.files.filter((file) => new RegExp("^" + name + "\\.(cvd|cld)$").test(file.name) &&
          /^[a-f0-9]{64}$/.test(file.sha256) && file.bytes > 0).length !== 1))
    fail("pinned ClamAV and official signature databases required")
  if (service.github_sha !== env.GITHUB_SHA || service.run_id !== env.GITHUB_RUN_ID || service.run_attempt !== env.GITHUB_RUN_ATTEMPT ||
      service.work_directory !== setup.root || path.dirname(service.work_directory) !== env.RUNNER_TEMP ||
      !new RegExp("^sf-teams-profile-scan-" + env.GITHUB_RUN_ID + "-" + env.GITHUB_RUN_ATTEMPT + "\\.[A-Za-z0-9]+$").test(path.basename(service.work_directory)))
    fail("owned service does not belong to this invocation")
  for (const kind of ["main", "error"]) {
    const value = service[kind]
    if (!value || !Number.isSafeInteger(value.pid) || value.pid < 2 || value.host !== "127.0.0.1" ||
        value.port !== lock.services[kind].port || !/^[0-9]+$/.test(String(value.start_time)) ||
        !/^[0-9]+$/.test(String(value.listen_inode)) ||
        value.executable !== path.join(service.work_directory, "root/usr/local/sbin/clamd") ||
        value.config !== path.join(service.work_directory, "clamd-" + kind + ".conf"))
      fail("actual loopback process ownership missing")
  }
  if (service.main.pid === service.error.pid || !Array.isArray(daemonControls.controls) || daemonControls.controls.length !== 2 ||
      ["main", "error"].some((kind) => daemonControls.controls.filter((item) => item.kind === kind && item.clean === "stream: OK" &&
        item.cleanAfter === "stream: OK" && /EICAR.*FOUND$/i.test(item.eicar)).length !== 1) ||
      !/INSTREAM size limit exceeded.*ERROR/i.test(daemonControls.sizeError)) fail("discriminating daemon controls missing")
  const clean = productObservation(log, "OPERATIONS63_REAL_CLAMD")
  const malformed = productObservation(log, "OPERATIONS75_REAL_MALFORMED")
  const error = productObservation(log, "OPERATIONS63_REAL_ERROR")
  const down = productObservation(log, "OPERATIONS63_REAL_DOWN")
  const imported = productObservation(log, "OPERATIONS75_PRIVATE_IMPORT")
  const uploaded = productObservation(log, "OPERATIONS75_PRIVATE_UPLOAD")
  const privateDown = productObservation(log, "OPERATIONS75_PRIVATE_DOWN")
  const malformedFile = productObservation(log, "G06_MALFORMED_FILE")
  if (clean.sha !== env.GITHUB_SHA || clean.run !== env.GITHUB_RUN_ID || !clean.version.startsWith("ClamAV " + lock.version + "/") ||
      clean.clean !== true || clean.eicar !== false || clean.clean_after !== true || clean.eicar_bytes !== 68 || !(clean.clean_bytes > 0) ||
      malformed.sha !== env.GITHUB_SHA || malformed.run !== env.GITHUB_RUN_ID || malformed.replies?.length !== 2 ||
      malformed.replies.some((item) => item.response !== "UNKNOWN COMMAND" || item.clean_after !== true) ||
      !/INSTREAM size limit exceeded.*ERROR/.test(error.response) || error.admitted !== false || error.main_clean !== true ||
      down.pid !== service.error.pid || down.connection_refused !== true || down.admitted !== false || down.main_clean !== true ||
      [imported, uploaded].some((item) => item.clean !== true || item.eicar !== false || item.clean_after !== true || item.denied_durable_effects !== 0) ||
      privateDown.connection_refused !== true || privateDown.import_admitted !== false || privateDown.upload_admitted !== false ||
      privateDown.denied_durable_effects !== 0 || privateDown.main_clean !== true) fail("actual product scanner controls missing or negative")
  if (cleanup.state !== "STOPPED" || cleanup.evidencePreserved !== true || cleanup.results?.length !== 2 ||
      ["main", "error"].some((kind) => cleanup.results.filter((item) => item.kind === kind &&
        (item.status === "ABSENT" || item.status === "STOPPED" && item.pid === service[kind].pid && String(item.startTime) === String(service[kind].start_time))).length !== 1))
    fail("owned daemon cleanup must complete before a positive receipt")
  if (malformedFile.sha !== env.GITHUB_SHA || malformedFile.run !== env.GITHUB_RUN_ID ||
      malformedFile.transport !== "loopback-http" || malformedFile.main_clean_after !== true ||
      !Array.isArray(malformedFile.inputs) || malformedFile.inputs.length !== 2 ||
      !isDeepStrictEqual(malformedFile.inputs.map((item) => item.kind).sort(), ["format-mismatch", "truncated-xlsx"]) ||
      malformedFile.inputs.some((item) => item.benign !== true || !/^[a-f0-9]{64}$/.test(item.digest) ||
        !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.durable_effects !== 0 ||
        !(item.scanner_accepted === true && item.staged === true && item.rejected_at === "preview" &&
          item.http_status === 400 && item.result === "needs-input" ||
          item.kind === "truncated-xlsx" && item.scanner_accepted === false && item.staged === false &&
          item.rejected_at === "admission" && item.http_status === 403 && item.result === "denied")) ||
      malformedFile.truncated_removed_bytes !== 22 ||
      !/^[a-f0-9]{64}$/.test(malformedFile.truncated_source_digest) ||
      malformedFile.truncated_source_bytes !== malformedFile.inputs.find((item) => item.kind === "truncated-xlsx")?.bytes + 22)
    fail("both benign malformed inputs require actual scanner and HTTP rejection boundaries without durable effects")
  const fixtureCleanup = log.split(/\r?\n/).filter((line) => line.startsWith("G06_PRIVATE_CLEANUP "))
    .map((line) => JSON.parse(line.slice("G06_PRIVATE_CLEANUP ".length)))
  if (fixtureCleanup.length !== 4 || fixtureCleanup.some((item) => item.fixtures !== 1 || item.directories_removed !== true))
    fail("every real private HTTP fixture must be removed before a positive receipt")
  const microsoftTeams = admission.envelope.selection !== "controls"
    ? verifyMicrosoftTeamEvidence({ admission, env, service, log, g05: input.g05 }) : undefined
  const microsoftImports = admission.envelope.selection === "controls-with-imports"
    ? verifyMicrosoftImportEvidence({ admission, env, service, log }) : undefined
  const omni = controlVerdict({ name: "Teams scanner controls" }, "omni control nonce: " + nonce + "\n" + log)
  return {
    schema: "teams-profile-scanner-receipt-v1", status: "PASS", candidateSha: admission.envelope.candidateSha,
    candidateTree: admission.envelope.candidateTree, snapshotSha: env.GITHUB_SHA,
    requestSha256: admission.envelope.requestSha256, run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT,
    cases: selected.cases, legacyCases: expectedCases, omni, omniPositive: omni.startsWith("omni positive control: pass ("),
    proofClass: "COMPONENT_REAL_CLAMD", installedTeamsProof: false,
    malformedProtocol: malformed, malformedApplicationFile: malformedFile,
    privateFixtureCleanup: { completed: fixtureCleanup.length, directoriesRemoved: true },
    finalCandidate: false, g06Closed: false,
    ...(microsoftTeams ? { microsoftTeams } : {}),
    ...(microsoftImports ? { microsoftImports } : {}),
  }
}

const teamControlIds = Object.freeze(["private-upload", "denied-owner", "scanner-outage"])
const g05ControlIds = Object.freeze([
  "anonymous-denied", "signed-session-admitted", "team-a-write", "team-b-write", "team-read-isolation",
  "wrong-installation-denied", "wrong-tenant-denied", "selector-route-mismatch-denied",
  "disabled-team-denied", "revoked-membership-denied", "denied-writes-have-no-effect",
])
const digestValue = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const guid = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
function sameDurable(values, teams) {
  return Array.isArray(values) && values.length === 2 &&
    isDeepStrictEqual(values.map((value) => value.teamObjectId).sort(), [...teams].sort()) &&
    values.every((value) => digestValue(value.before) && value.before === value.after)
}
function actualTransport(value) {
  return value?.protocol === "http:" && value.listener === "127.0.0.1" &&
    Number.isInteger(value.port) && value.port > 0 && value.port < 65536 &&
    Number.isSafeInteger(value.requests) && value.requests > 0 &&
    value.loopbackPeers === value.requests && value.ingressRequests === value.requests
}
export function verifyMicrosoftTeamEvidence({ admission, env, service, log, g05 }) {
  if (!["controls-with-teams", "controls-with-imports"].includes(admission.envelope.selection)) fail("Microsoft selection required")
  const controls = teamControlIds.map((id) =>
    productObservation(log, "G06_MICROSOFT_TEAM_" + id.toUpperCase().replaceAll("-", "_")))
  for (const [index, value] of controls.entries()) {
    const daemon = index === 2 ? service.error : service.main
    const teams = value.binding?.teamObjectIds
    if (value.schema !== "orchestra.g06.microsoft-team-control/1" || value.control !== teamControlIds[index] ||
        value.status !== "PASS" || value.sourceSha !== env.GITHUB_SHA || value.runId !== env.GITHUB_RUN_ID ||
        value.runAttempt !== env.GITHUB_RUN_ATTEMPT || value.proofClass !== "COMPONENT_REAL_CLAMD" ||
        value.composition !== "MICROSOFT_TEAM_FACTORY" || value.identityProvider !== "CONTROLLED_ENTRA_GRAPH" ||
        value.runtimeFactory !== "createMicrosoftInstallation" || value.installedTeamsProof !== false || value.finalCandidate !== false ||
        value.scanner?.host !== "127.0.0.1" || value.scanner.port !== daemon.port || value.scanner.pid !== daemon.pid ||
        !digestValue(value.binding?.installationId) || !guid(value.binding?.tenantId) || !guid(value.binding?.principalObjectId) ||
        !Array.isArray(teams) || teams.length !== 2 || !teams.every(guid) || new Set(teams).size !== 2 ||
        !actualTransport(value.transport) || !value.graphRequests?.includes("/v1.0/me/joinedTeams") ||
        value.cleanup?.completed !== true || value.cleanup.directoryRemoved !== true || value.result?.mainCleanAfter !== true)
      fail("actual Microsoft Team factory, identity, transport, scanner or cleanup missing")
  }
  if (new Set(controls.map((value) => value.binding.installationId)).size !== 3)
    fail("three independently cleaned Microsoft installations required")
  const uploaded = controls[0]
  const observations = uploaded.result.observations
  if (!Array.isArray(observations) || observations.length !== 2 ||
      !isDeepStrictEqual(observations.map((value) => value.teamObjectId).sort(), [...uploaded.binding.teamObjectIds].sort()))
    fail("both Teams require private upload controls")
  const eicarDigest = hash(Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64"))
  for (const value of observations) {
    for (const accepted of [value.before, value.after]) {
      if (accepted?.httpStatus !== 200 || !Number.isSafeInteger(accepted.bytes) || accepted.bytes < 1 ||
          !digestValue(accepted.digest) || accepted.storedDigest !== accepted.digest ||
          !Number.isSafeInteger(accepted.versionBefore) || accepted.versionBefore < 0 || accepted.versionAfter !== accepted.versionBefore + 1 ||
          accepted.downloadStatus !== 200 || accepted.foreignDownloadStatus !== 403 ||
          accepted.otherTeam?.teamObjectId !== uploaded.binding.teamObjectIds.find((id) => id !== value.teamObjectId) ||
          !digestValue(accepted.otherTeam.before) || accepted.otherTeam.before !== accepted.otherTeam.after)
        fail("clean Team upload, blob bytes, signed download or isolation missing")
    }
    if (value.rejected?.httpStatus !== 422 || value.rejected.bytes !== 68 || value.rejected.digest !== eicarDigest ||
        !sameDurable(value.rejected.durable, uploaded.binding.teamObjectIds))
      fail("real EICAR Team refusal without durable effects required")
  }
  const denied = controls[1]
  if (!Array.isArray(denied.result.attempts) ||
      !isDeepStrictEqual(denied.result.attempts.map((value) => value.kind).sort(),
        ["wrong-installation", "wrong-tenant", "selector-route-mismatch", "disabled-team", "revoked-membership"].sort()) ||
      denied.result.attempts.some((value) => value.httpStatus !== 403 || !sameDurable(value.durable, denied.binding.teamObjectIds)))
    fail("every Team owner and revocation refusal must preserve both complete stores")
  const outage = controls[2]
  if (outage.result.connectionRefused !== true || !Array.isArray(outage.result.attempts) || outage.result.attempts.length !== 2 ||
      !isDeepStrictEqual(outage.result.attempts.map((value) => value.teamObjectId).sort(), [...outage.binding.teamObjectIds].sort()) ||
      outage.result.attempts.some((value) => value.httpStatus !== 422 || !digestValue(value.digest) ||
        !Number.isSafeInteger(value.bytes) || value.bytes < 1 || !sameDurable(value.durable, outage.binding.teamObjectIds)))
    fail("owned real daemon outage must refuse both Teams without durable effects")
  if (g05?.schema !== "orchestra.g05.team-http/1" || g05.sourceSha !== env.GITHUB_SHA ||
      !sha(env.G05_SOURCE_TREE) || g05.sourceTree !== env.G05_SOURCE_TREE ||
      g05.runId !== env.GITHUB_RUN_ID || g05.runAttempt !== env.GITHUB_RUN_ATTEMPT ||
      g05.proofClass !== "HTTP_LOOPBACK_MICROSOFT_COMPONENT" || g05.identityProvider !== "CONTROLLED_ENTRA_GRAPH" ||
      g05.runtimeFactory !== "createMicrosoftInstallation" || g05.installedTeamsProof !== false || g05.finalCandidate !== false ||
      g05.cleanup?.completed !== true || !actualTransport(g05.transport) ||
      !g05.graphRequests?.includes("/v1.0/me/joinedTeams") ||
      g05.summary?.expected !== 11 || g05.summary.pass !== 11 || g05.summary.pending !== 0 ||
      !Array.isArray(g05.cases) || !isDeepStrictEqual(g05.cases.map((value) => value.id).sort(), [...g05ControlIds].sort()) ||
      g05.cases.some((value) => value.status !== "pass") ||
      !sameDurable(g05.durableComparison?.teams, controls[0].binding.teamObjectIds))
    fail("all eleven original G05 Team controls and their current receipt must survive extraction")
  return {
    schema: "teams-profile-scanner-microsoft-receipt-v1", status: "PASS",
    candidateSha: admission.envelope.candidateSha, candidateTree: admission.envelope.candidateTree,
    snapshotSha: env.GITHUB_SHA, snapshotTree: env.G05_SOURCE_TREE, requestSha256: admission.envelope.requestSha256,
    run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT,
    proofClass: "COMPONENT_REAL_CLAMD", composition: "MICROSOFT_TEAM_FACTORY", identityProvider: "CONTROLLED_ENTRA_GRAPH",
    installedTeamsProof: false, finalCandidate: false, g06Closed: false,
    controls, g05Controls: g05ControlIds,
    teamsPrivateImportProof: false,
    blocker: "This upload receipt does not exercise native import-admit/import-preview; a separate private import receipt is required.",
  }
}

const importControlIds = Object.freeze(["private-admission", "malformed-file", "denied-owner", "scanner-outage"])
export function verifyMicrosoftImportEvidence({ admission, env, service, log }) {
  if (admission.envelope.selection !== "controls-with-imports") fail("private import selection required")
  const controls = importControlIds.map((id) =>
    productObservation(log, "G06_MICROSOFT_IMPORT_" + id.toUpperCase().replaceAll("-", "_")))
  for (const [index, value] of controls.entries()) {
    const daemon = index === 3 ? service.error : service.main
    const teams = value.binding?.teamObjectIds
    if (value.schema !== "orchestra.g06.microsoft-team-import-control/2" || value.control !== importControlIds[index] ||
        value.status !== "PASS" || value.sourceSha !== env.GITHUB_SHA || value.runId !== env.GITHUB_RUN_ID ||
        value.runAttempt !== env.GITHUB_RUN_ATTEMPT || value.proofClass !== "COMPONENT_REAL_CLAMD" ||
        value.composition !== "MICROSOFT_TEAM_NATIVE_IMPORT" || value.identityProvider !== "CONTROLLED_ENTRA_GRAPH" ||
        value.runtimeFactory !== "createMicrosoftInstallation" || value.installedTeamsProof !== false || value.finalCandidate !== false ||
        value.scanner?.host !== "127.0.0.1" || value.scanner.port !== daemon.port || value.scanner.pid !== daemon.pid ||
        !digestValue(value.binding?.installationId) || !guid(value.binding?.tenantId) || !guid(value.binding?.principalObjectId) ||
        !Array.isArray(teams) || teams.length !== 2 || !teams.every(guid) || new Set(teams).size !== 2 ||
        !actualTransport(value.transport) || !value.graphRequests?.includes("/v1.0/me/joinedTeams") ||
        value.cleanup?.completed !== true || value.cleanup.directoryRemoved !== true || value.result?.mainCleanAfter !== true)
      fail("actual Microsoft private import composition, daemon, transport or cleanup missing")
  }
  if (new Set(controls.map((value) => value.binding.installationId)).size !== 4)
    fail("four separately cleaned private import installations required")
  const clean = (value, team, teams) => value?.httpStatus === 200 && digestValue(value.ref) &&
    Number.isSafeInteger(value.bytes) && value.bytes > 0 && digestValue(value.digest) &&
    value.storedDigest === value.digest && digestValue(value.proofDigest) && digestValue(value.catalogDigest) &&
    value.otherTeam?.teamObjectId === teams.find((id) => id !== team) &&
    digestValue(value.otherTeam?.before) && value.otherTeam.before === value.otherTeam.after
  const admitted = controls[0]
  const observations = admitted.result.observations
  const intake = admitted.result.intakeLimit
  if (intake?.pending !== 2 || intake.busy?.httpStatus !== 503 || intake.busy.retryAfter !== "1" ||
      !isDeepStrictEqual(intake.released, [400, 400]) || !sameDurable(intake.durable, admitted.binding.teamObjectIds))
    fail("original shared intake limit and released requests must be observed over HTTP without durable effects")
  const eicarDigest = hash(Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64"))
  if (!Array.isArray(observations) || observations.length !== 2 ||
      !isDeepStrictEqual(observations.map((value) => value.teamObjectId).sort(), [...admitted.binding.teamObjectIds].sort()) ||
      observations.some((value) => !clean(value.before, value.teamObjectId, admitted.binding.teamObjectIds) ||
        !clean(value.after, value.teamObjectId, admitted.binding.teamObjectIds) ||
        value.refused?.httpStatus !== 403 || value.refused.bytes !== 68 || value.refused.digest !== eicarDigest ||
        !sameDurable(value.refused.durable, admitted.binding.teamObjectIds)))
    fail("both Teams require real clean/EICAR/clean private staging with unchanged foreign stores")
  const malformed = controls[1]
  const inputs = malformed.result.observations
  if (!Array.isArray(inputs) || inputs.length !== 2 ||
      !isDeepStrictEqual(inputs.map((value) => value.kind).sort(), ["format-mismatch", "truncated-xlsx"]) ||
      inputs.some((value) => !digestValue(value.digest) || !Number.isSafeInteger(value.bytes) || value.bytes < 1 ||
        !sameDurable(value.durable, malformed.binding.teamObjectIds) ||
        !(value.scannerAccepted === true && value.staged === true && value.rejectedAt === "preview" &&
          value.httpStatus === 400 && clean(value.admission, malformed.binding.teamObjectIds[0], malformed.binding.teamObjectIds) ||
          value.kind === "truncated-xlsx" && value.scannerAccepted === false && value.staged === false &&
          value.rejectedAt === "admission" && value.httpStatus === 403)) ||
      !digestValue(malformed.result.truncatedSourceDigest) || malformed.result.truncatedRemovedBytes !== 22 ||
      malformed.result.truncatedSourceBytes !== inputs.find((value) => value.kind === "truncated-xlsx")?.bytes + 22)
    fail("private malformed files need a real clean staging and original parser refusal without preview effects")
  const denied = controls[2]
  if (!Array.isArray(denied.result.attempts) ||
      !isDeepStrictEqual(denied.result.attempts.map((value) => value.kind).sort(),
        ["wrong-installation", "wrong-tenant", "selector-route-mismatch", "revoked-membership"].sort()) ||
      denied.result.attempts.some((value) => value.httpStatus !== 403 || !sameDurable(value.durable, denied.binding.teamObjectIds)) ||
      denied.result.foreignReference?.httpStatus !== 503 || !sameDurable(denied.result.foreignReference.durable, denied.binding.teamObjectIds) ||
      denied.result.missingGrant?.httpStatus !== 403 || denied.result.missingGrant.explicitGrants !== 0 ||
      !digestValue(denied.result.missingGrant.binding) || controls.some((value) => value.binding.installationId === denied.result.missingGrant.binding) ||
      denied.result.missingGrant.cleanupComplete !== true || !sameDurable(denied.result.missingGrant.durable, denied.binding.teamObjectIds))
    fail("private importer must preserve owner, grant and membership refusal with independent complete-store equality")

  const configuration = denied.result.configurationRevocation
  const configurationCases = ["grants:before-request", "roles:before-request",
    "grants:after-request-body", "roles:after-request-body", "unavailable:before-request"]
  if (configuration?.source !== "private-installation-file" || !Array.isArray(configuration.observations) ||
      !isDeepStrictEqual(configuration.observations.map((value) => value.kind + ":" + value.boundary).sort(), configurationCases.sort()) ||
      configuration.observations.some((value) =>
        value.httpStatus !== (value.kind === "unavailable" ? 503 : 403) ||
        value.originalBodyObserved !== (value.boundary === "after-request-body") ||
        value.restoredReadStatus !== 200 || !sameDurable(value.durable, denied.binding.teamObjectIds)) ||
      !clean(configuration.cleanAfterRestore, denied.binding.teamObjectIds[0], denied.binding.teamObjectIds))
    fail("private configuration revocation before admission and after original body consumption must preserve both stores and recover explicitly")
  const outage = controls[3]
  if (outage.result.connectionRefused !== true || !Array.isArray(outage.result.attempts) || outage.result.attempts.length !== 2 ||
      !isDeepStrictEqual(outage.result.attempts.map((value) => value.teamObjectId).sort(), [...outage.binding.teamObjectIds].sort()) ||
      outage.result.attempts.some((value) => value.httpStatus !== 403 || !digestValue(value.digest) ||
        !Number.isSafeInteger(value.bytes) || value.bytes < 1 || !sameDurable(value.durable, outage.binding.teamObjectIds)))
    fail("owned real daemon outage must refuse private imports in both Teams without durable effects")
  return {
    schema: "teams-profile-scanner-microsoft-import-receipt-v2", status: "PASS",
    candidateSha: admission.envelope.candidateSha, candidateTree: admission.envelope.candidateTree,
    snapshotSha: env.GITHUB_SHA, snapshotTree: env.G05_SOURCE_TREE, requestSha256: admission.envelope.requestSha256,
    run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, proofClass: "COMPONENT_REAL_CLAMD",
    composition: "MICROSOFT_TEAM_NATIVE_IMPORT", identityProvider: "CONTROLLED_ENTRA_GRAPH",
    componentPrivateImportProof: true, installedTeamsProof: false, finalCandidate: false, g06Closed: false,
    controls,
  }
}

async function cli() {
  const [action, file] = process.argv.slice(2)
  const root = realpathSync(process.env.GITHUB_WORKSPACE ?? ".")
  const directory = evidenceDirectory(root)
  if (action === "admit") {
    if (file !== ".ci-run.json" || existsSync(directory)) fail("fresh request evidence directory required")
    const filename = fileAt(root, file)
    if (statSync(filename).size > 16384) fail("request too large")
    const raw = readFileSync(filename, "utf8")
    const input = parseScannerRequest(raw)
    const admission = admitScanner(input, process.env, (body) =>
      validateRequest(body, (file) => statSync(path.resolve(root, file), { throwIfNoEntry: false })?.isFile() ?? false,
        (selector) => locateTestPackage(root, selector)))
    const integrity = criticalFor(admission.envelope.selection).map((file) => ({ path: file, sha256: hash(readFileSync(fileAt(root, file))) }))
    mkdirSync(directory, { mode: 0o700 })
    save(path.join(directory, "admission.json"), { ...admission, integrity, rawRequestSha256: hash(raw) })
    appendFileSync(process.env.GITHUB_ENV, "ORCHESTRA_CHANNEL=prod\nORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict\nORCHESTRA_OMNI_CONTROL=declared\n")
    appendFileSync(process.env.GITHUB_OUTPUT, "admitted=true\n")
    console.info("TEAMS_SCANNER_ADMITTED " + canonical(admission))
    return
  }
  const admission = readTeamsScannerAdmission(root)
  if (action === "integrity") return
  if (action === "arguments") { process.stdout.write(admission.request.args.join("\n") + "\n"); return }
  if (action !== "verify") fail("unknown action")
  const read = (name) => JSON.parse(readFileSync(path.join(directory, name), "utf8"))
  const scanner = realpathSync(process.env.SF_OPERATIONS_SCANNER_EVIDENCE ?? "")
  if (path.basename(scanner) !== "evidence" || path.dirname(path.dirname(scanner)) !== realpathSync(process.env.RUNNER_TEMP))
    fail("scanner evidence escaped this job")
  const daemon = (name) => JSON.parse(readFileSync(path.join(scanner, name), "utf8"))
  const report = readFileSync(path.join(directory, "report.xml"))
  const log = readFileSync(path.join(directory, "bun.log"), "utf8")
  const rawExit = readFileSync(path.join(directory, "exit-code.txt"), "utf8").trim()
  if (!/^(0|[1-9][0-9]{0,2})$/.test(rawExit) || Number(rawExit) > 255) fail("actual test exit status required")
  const receipt = verifyScannerEvidence({
    admission, env: process.env, summary: read("summary.json"), report, log, exitCode: Number(rawExit),
    ...(admission.envelope.selection !== "controls" ? { g05: read("g05-team-http.json") } : {}),
    nonce: readFileSync(path.join(directory, "omni-nonce.txt"), "utf8").trim(),
    setup: daemon("setup.json"), service: daemon("service.json"), packageEvidence: daemon("package.json"),
    databases: daemon("databases.json"), daemonControls: daemon("daemon-controls.json"), cleanup: daemon("cleanup.json"),
    lock: JSON.parse(readFileSync(fileAt(root, "script/sf2h/operations-scanner/tools.lock.json"), "utf8")),
  })
  if (receipt.microsoftTeams) save(path.join(directory, "microsoft-teams-receipt.json"), receipt.microsoftTeams)
  if (receipt.microsoftImports) save(path.join(directory, "microsoft-imports-receipt.json"), receipt.microsoftImports)
  receipt.evidence = ["report.xml", "summary.json", "bun.log", "exit-code.txt", "omni-nonce.txt", "admission.json", "arguments.txt",
    ...(receipt.microsoftTeams ? ["g05-team-http.json", "microsoft-teams-receipt.json"] : []),
    ...(receipt.microsoftImports ? ["microsoft-imports-receipt.json"] : [])]
    .map((name) => ({ path: name, sha256: hash(readFileSync(path.join(directory, name))) }))
  receipt.scannerEvidence = ["setup.json", "service.json", "package.json", "databases.json", "daemon-controls.json", "cleanup.json", "configuration.json", "tools.lock.json"]
    .map((name) => ({ path: name, sha256: hash(readFileSync(path.join(scanner, name))) }))
  save(path.join(directory, "receipt.json"), receipt)
  console.info("TEAMS_SCANNER_RECEIPT " + canonical(receipt))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await cli()
