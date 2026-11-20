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
].map(Object.freeze))
export function exactRequest() {
  return {
    package: "sucafina", packageSelector: "packages/sucafina", directory: "modules/sucafina", runner: "bun",
    args: [...files.map((file) => "./" + file), "--timeout", "120000"],
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
  const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "teamsProfileScanner"))
  if (!isDeepStrictEqual(body, exactRequest())) fail("exact three-control request required")
  const request = JSON.parse(JSON.stringify(normalize(body)))
  if (!isDeepStrictEqual(request, exactRequest())) fail("normalized control request changed")
  const requestSha256 = hash(canonical(request))
  if (!envelope || !sha(envelope.candidateSha) || !sha(envelope.candidateTree) ||
      !isDeepStrictEqual(envelope, {
        schema: "teams-profile-scanner-v1", candidateSha: envelope.candidateSha,
        candidateTree: envelope.candidateTree, requestSha256, selection: "controls",
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
  "script/sf-ci/team-profile-scanner.mjs", "script/sf2h/final-bundle/verify-bun-report.py",
  "script/sf2h/operations-scanner/setup.sh", "script/sf2h/operations-scanner/service.mjs",
  "script/sf2h/operations-scanner/cleanup.sh", "script/sf2h/operations-scanner/tools.lock.json",
  "modules/sucafina/bunfig.toml", ...files.map((file) => "modules/sucafina/" + file),
])
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
  if (receipt.schema !== "teams-profile-scanner-admission-v1" || !isDeepStrictEqual(receipt.execution, execution(env)) ||
      !Array.isArray(receipt.integrity) || receipt.integrity.length !== criticalFiles.length ||
      receipt.integrity.some((item, index) => item.path !== criticalFiles[index] || item.sha256 !== hash(readFileSync(fileAt(root, item.path)))))
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
function sourceOf(entry, workspace) {
  for (const candidate of [entry.file, entry.classname]) {
    if (typeof candidate !== "string") continue
    const value = candidate.replaceAll("\\", "/").replace(/^\.\//, "")
    for (const file of files) if ([file, "modules/sucafina/" + file, workspace + "/modules/sucafina/" + file].includes(value)) return file
  }
}
export function verifyScannerEvidence(input) {
  const { admission, env, summary, report, log, nonce, setup, service, packageEvidence, databases, daemonControls, cleanup, lock } = input
  requireHost(env)
  if (!isDeepStrictEqual(admission.execution, execution(env)) || input.exitCode !== 0 ||
      env.ORCHESTRA_CHANNEL !== "prod" || env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER !== "strict" ||
      env.ORCHESTRA_OMNI_CONTROL !== "declared" || !/^[a-f0-9]{32}$/.test(nonce) ||
      env.ORCHESTRA_OMNI_CONTROL_NONCE !== nonce) fail("execution, source or strict invocation mismatch")
  if (summary.schema_version !== 1 || summary.status !== "PASS" || summary.report_sha256 !== hash(report) ||
      !Array.isArray(summary.issues) || summary.issues.length || !Array.isArray(summary.cases) ||
      summary.counts.product_executed !== expectedCases.length ||
      ["failures", "errors", "skipped", "todo_identified"].some((key) => !zero(summary.counts[key])))
    fail("nonempty successful JUnit evidence required")
  const productCases = summary.cases.filter((entry) => entry.known_control_or_hook === 0)
  if (productCases.length !== expectedCases.length ||
      productCases.some((entry) => entry.executed !== 1 || entry.product_executed !== 1 ||
        ["failures", "errors", "skipped", "todo_identified"].some((key) => !zero(entry[key]))))
    fail("every declared product case must execute successfully")
  const observed = productCases.map((entry) => JSON.stringify([sourceOf(entry, env.GITHUB_WORKSPACE), entry.name])).sort()
  if (!isDeepStrictEqual(observed, expectedCases.map((entry) => JSON.stringify(entry)).sort()))
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
  const omni = controlVerdict({ name: "Teams scanner controls" }, "omni control nonce: " + nonce + "\n" + log)
  return {
    schema: "teams-profile-scanner-receipt-v1", status: "PASS", candidateSha: admission.envelope.candidateSha,
    candidateTree: admission.envelope.candidateTree, snapshotSha: env.GITHUB_SHA,
    requestSha256: admission.envelope.requestSha256, run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT,
    cases: expectedCases, omni, omniPositive: omni.startsWith("omni positive control: pass ("),
    proofClass: "COMPONENT_REAL_CLAMD", installedTeamsProof: false,
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
    const integrity = criticalFiles.map((file) => ({ path: file, sha256: hash(readFileSync(fileAt(root, file))) }))
    mkdirSync(directory, { mode: 0o700 })
    save(path.join(directory, "admission.json"), { ...admission, integrity, rawRequestSha256: hash(raw) })
    appendFileSync(process.env.GITHUB_ENV, "ORCHESTRA_CHANNEL=prod\nORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict\nORCHESTRA_OMNI_CONTROL=declared\n")
    appendFileSync(process.env.GITHUB_OUTPUT, "admitted=true\n")
    console.info("TEAMS_SCANNER_ADMITTED " + canonical(admission))
    return
  }
  const admission = readTeamsScannerAdmission(root)
  if (action === "integrity") return
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
    nonce: readFileSync(path.join(directory, "omni-nonce.txt"), "utf8").trim(),
    setup: daemon("setup.json"), service: daemon("service.json"), packageEvidence: daemon("package.json"),
    databases: daemon("databases.json"), daemonControls: daemon("daemon-controls.json"), cleanup: daemon("cleanup.json"),
    lock: JSON.parse(readFileSync(fileAt(root, "script/sf2h/operations-scanner/tools.lock.json"), "utf8")),
  })
  receipt.evidence = ["report.xml", "summary.json", "bun.log", "exit-code.txt", "omni-nonce.txt", "admission.json"]
    .map((name) => ({ path: name, sha256: hash(readFileSync(path.join(directory, name))) }))
  save(path.join(directory, "receipt.json"), receipt)
  console.info("TEAMS_SCANNER_RECEIPT " + canonical(receipt))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await cli()
