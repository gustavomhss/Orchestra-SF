/** Exact native report/fixture binding. A parser or manually supplied JSON never qualifies LIVE. */
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { digest, privateText, readPlan, reportSpecs, writePrivate } from "./g08-private-evidence.mjs"
import { nativeRole, nativeSelectedCase, nativeTitles } from "../../packages/app-shell/e2e/sucafina/native/fixture/case-contract.ts"

export const originalSource = "687759276c2c9121c2cfd20a5994b277ceb7ee4d"
export const normativeSource = "736a5087c223629be4d73c8a4535d615fcafd96a"
export const groups = ["U15", "U39", "U40"]
export const f04Titles = [
  "Q01-TRANSPORT-GUEST true installed context refuses a caller without real session",
  "Q01-TRANSPORT-INVALID-OWNER rejects a malformed selector without an actor",
  "Q01-TRANSPORT-STALE-FENCE never invokes network on a disposed generation",
]
const object = (value) => {
  assert(value && typeof value === "object" && !Array.isArray(value), "F04_RECORD_REQUIRED")
  return value
}
export function verifyNativeReport(value, suite, executed = false) {
  assert(groups.includes(suite) || suite === "ALL" && !executed, "F04_SINGLE_EXECUTED_SUITE_REQUIRED")
  const report = object(value), config = object(report.config), specs = reportSpecs(report)
  const selected = suite === "ALL" ? groups : [suite]
  const expected = selected.flatMap((group) => nativeTitles[group].map((title, index) => ({
    group, title, file: "sucafina/native/journeys/" + group.toLowerCase() + ".spec.ts", number: index + 1,
  })))
  assert.deepEqual(specs.map((spec) => [spec.file.replaceAll("\\", "/"), spec.title]).sort(),
    expected.map((item) => [item.file, item.title]).sort(), "F04_EXACT_6_22_22_ORIGINAL_INVENTORY_REQUIRED")
  assert.deepEqual(report.errors ?? [], [], "F04_REPORT_ERRORS")
  assert(config.workers === 1 && !config.shard && !config.grepInvert &&
    JSON.stringify(config.grep ?? {}) === "{}", "F04_UNFILTERED_SINGLE_WORKER_REQUIRED")
  assert(Array.isArray(config.projects) && config.projects.length === 1, "F04_SINGLE_PROJECT_REQUIRED")
  const project = object(config.projects[0])
  assert(project.name === "chromium" && project.retries === 0 && project.repeatEach === 1, "F04_NO_RETRIES_OR_REPEATS")
  for (const spec of specs) {
    assert(Array.isArray(spec.tests) && spec.tests.length === 1, "F04_ONE_RESULT_REQUIRED")
    const entry = object(spec.tests[0])
    assert(entry.projectName === "chromium" && entry.expectedStatus === "passed" &&
      (entry.annotations ?? []).length === 0, "F04_ORIGINAL_EXPECTED_PASS_REQUIRED")
    assert(Array.isArray(entry.results), "F04_RESULTS_REQUIRED")
    if (!executed) { assert.equal(entry.results.length, 0, "F04_LIST_CANNOT_CONTAIN_EXECUTIONS"); continue }
    assert(spec.ok === true && entry.status === "expected" && entry.results.length === 1, "F04_NO_SKIP_OR_FLAKY")
    const result = object(entry.results[0])
    assert(result.status === "passed" && result.retry === 0 && (result.errors ?? []).length === 0 &&
      (result.attachments ?? []).length === 0, "F04_SINGLE_CLEAN_PRIVATE_RESULT_REQUIRED")
  }
  if (executed) {
    const stats = object(report.stats)
    assert(stats.expected === expected.length && stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0,
      "F04_NO_NONPASS_STATISTICS")
  }
  return expected.map((item) => ({ id: item.group + "-" + String(item.number).padStart(2, "0"),
    group: item.group, number: item.number, caseId: nativeSelectedCase(item.group, item.title),
    titleSha256: digest(item.title), state: executed ? "REPORT_PASS_REQUIRES_HOST_CHAIN" : "LISTED_NOT_RUN" }))
}
export function verifyNativeObservations(manifest, selected, inventory, observations, detached) {
  assert(["sf2h.native-installed-manifest.v2", "sf-g08-native-installed-v1"].includes(manifest.schema) &&
    selected.schema === "sf2h.native-selected-installation.v2" &&
    selected.manifestSha256 === digest(JSON.stringify(manifest)) &&
    selected.candidateSha === manifest.candidateSha, "F04_PRIVATE_SELECTION_BINDING")
  assert.deepEqual(selected.invocation, manifest.invocation, "F04_PRIVATE_INVOCATION_MISMATCH")
  assert.equal(manifest.invocation.role, nativeRole(selected.suite), "F04_PRIVATE_ROLE_MISMATCH")
  assert.equal(observations.length, inventory.length, "F04_ALL_CASE_OBSERVATIONS_REQUIRED")
  for (const item of inventory) {
    const matches = observations.filter((entry) => entry.suite === item.group && entry.number === item.number)
    assert.equal(matches.length, 1, "F04_UNIQUE_ORIGINAL_CASE_OBSERVATION_REQUIRED")
    const observed = object(matches[0]), caseInput = selected.selections.find((entry) => entry.caseId === item.caseId)
    assert(caseInput && observed.schema === "sf2h.native-case-observation.v2" &&
      observed.candidateSha === manifest.candidateSha && observed.caseId === item.caseId &&
      observed.titleSha256 === item.titleSha256 && observed.bodyCompleted === true &&
      observed.actor === caseInput.actor && observed.principalRef === manifest.actors[caseInput.actor] &&
      observed.selectedManifestSha256 === digest(JSON.stringify(selected)), "F04_CASE_OBSERVATION_BINDING_REQUIRED")
    assert.deepEqual(observed.invocation, manifest.invocation, "F04_CASE_RUN_CHANGED")
    assert.deepEqual(observed.target, caseInput.target, "F04_CASE_TEAM_CHANGED")
    const cleanup = object(observed.cleanup), callback = object(cleanup.callback)
    assert(cleanup.completed === true && cleanup.originalPagesPreserved === true &&
      Number.isSafeInteger(cleanup.ownPagesClosed) && cleanup.ownPagesClosed >= 1 &&
      callback.cleanupCompleted === true && callback.cleanupScope === "OWN_PAGES_AND_CALLBACK_CHANGES_ONLY" &&
      Number.isSafeInteger(callback.ownedPagesClosed) && Number.isSafeInteger(callback.callbackRestorations) &&
      callback.ownedPagesClosed >= 0 && callback.callbackRestorations >= 0, "F04_OBSERVED_CLEANUP_REQUIRED")
    if (item.caseId === "revoked" || item.caseId === "stale" && selected.suite !== "U15")
      assert(callback.callbackRestorations === 1 && callback.ownedPagesClosed >= 1, "F04_REAL_CALLBACK_AND_RESTORATION_REQUIRED")
  }
  assert(detached.schema === "sf2h.native-browser-detached.v2" && detached.candidateSha === manifest.candidateSha &&
    detached.contextsPreserved === true && detached.clientDisconnected === true, "F04_ORIGINAL_BROWSER_DISCONNECTION_REQUIRED")
  assert.deepEqual(detached.invocation, manifest.invocation, "F04_DETACH_RUN_CHANGED")
  return { cases: inventory.length, cleanupScope: "OWN_PAGES_AND_CALLBACK_CHANGES_ONLY", parserResult: "VERIFIED" }
}
export function nativeReportReceipt(input) {
  assert(groups.includes(input.suite), "F04_NATIVE_SUITE_REQUIRED")
  return { schema: "sf2h.native-report-observation.v2", status: "ORIGINAL_REPORT_AND_FIXTURE_VERIFIED",
    source: input.source, invocation: input.invocation, suite: input.suite, inventory: input.inventory,
    bindings: input.bindings, files: input.files, originalSource, normativeSource,
    installed: false, liveQualified: false, g08Closed: false, finalCandidate: false, productionCutover: false,
    limits: [
      "This report verifier does not establish the original workflow/job/artifact chain or qualify LIVE.",
      "The final coordinator must verify original hosted execution and before/after service observations on the same C/T/tar/reservation.",
      "F04, the nine Teams obligations, AZ02 and the remaining go-live gates retain their independent evidence.",
      "Cleanup covers owned pages and callback changes; disposal of the reserved isolated dataset is a separate host obligation.",
    ] }
}
/** Original Bun formatter, exact titles/file/run/C. Parser output alone is never LIVE. */
export function verifyF04JUnit(xml, binding) {
  assert(typeof xml === "string" && xml.length <= 2_000_000 && !/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/.test(xml),
    "F04_CLOSED_ORIGINAL_JUNIT_REQUIRED")
  const root = xml.match(/<testsuites\b([^>]*)>/), suite = [...xml.matchAll(/<testsuite\b([^>]*)>/g)]
  const attribute = (text, name) => {
    const values = [...text.matchAll(new RegExp("(?:^|\\s)" + name + '="([^"]*)"', "g"))]
    assert.equal(values.length, 1, "F04_JUNIT_ATTRIBUTE_REQUIRED")
    return values[0][1]
  }
  assert(root && suite.length === 1 && attribute(root[1], "tests") === "3" && attribute(root[1], "failures") === "0" &&
    attribute(root[1], "skipped") === "0" && attribute(suite[0][1], "tests") === "3" &&
    attribute(suite[0][1], "failures") === "0" && attribute(suite[0][1], "skipped") === "0" &&
    attribute(suite[0][1], "file") === "test-browser/sucafina-native/transport-integration.test.ts" &&
    !/<(?:failure|error|skipped)\b/.test(xml), "F04_THREE_ORIGINAL_BUN_PASSES_REQUIRED")
  const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)]
  assert.equal(cases.length, 3, "F04_EXACT_THREE_CASES_REQUIRED")
  assert.equal((xml.match(/<testcase\b/g) ?? []).length, 3, "F04_EXTRA_CASE_NOT_ALLOWED")
  assert.deepEqual(cases.map((entry) => attribute(entry[1], "name")).sort(), [...f04Titles].sort(), "F04_ORIGINAL_TITLES_REQUIRED")
  assert(cases.every((entry) => attribute(entry[1], "file") === "test-browser/sucafina-native/transport-integration.test.ts"),
    "F04_ORIGINAL_FILE_REQUIRED")
  const properties = [...xml.matchAll(/<property\b([^>]*?)\/>/g)]
  const values = (name) => properties.filter((entry) => attribute(entry[1], "name") === name)
    .map((entry) => attribute(entry[1], "value"))
  assert.deepEqual(values("ci"), ["https://github.com/gustavomhss/Orchestra-SF/actions/runs/" + binding.runId], "F04_ORIGINAL_RUN_REQUIRED")
  assert.deepEqual(values("commit"), [binding.sha], "F04_ORIGINAL_C_REQUIRED")
  return f04Titles.map((title, index) => ({ id: "F04-" + String(index + 1).padStart(2, "0"),
    titleSha256: digest(title), state: "REPORT_PASS_REQUIRES_HOST_CHAIN" }))
}
export function verifyOmni(log, nonce) {
  assert(/^[0-9a-f]{32}$/.test(nonce), "F04_FRESH_NONCE_REQUIRED")
  const matches = [...log.matchAll(/omni positive control \[([0-9a-f]{32})\]: (pass|not applicable|FAIL|off)/g)]
  assert(matches.length === 1 && matches[0][1] === nonce && ["pass", "not applicable"].includes(matches[0][2]),
    "F04_FRESH_DECLARED_OMNI_REQUIRED")
  return { nonce, verdict: matches[0][2] }
}
async function main() {
  const [mode, suite, file, output] = process.argv.slice(2)
  if (mode === "list") {
    const inventory = verifyNativeReport(JSON.parse(await readFile(file, "utf8")), suite, false)
    assert(output && path.isAbsolute(output), "F04_EXPLICIT_LIST_OUTPUT_REQUIRED")
    await writeFile(output, JSON.stringify({ schema: "sf2h.native-listed-v2", inventory,
      installedExecuted: 0, liveQualified: false, originalSource, normativeSource }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    console.log("Native original inventory " + inventory.length + " LISTED_NOT_RUN")
    return
  }
  if (mode === "record-f04") {
    assert(suite && !file && !output, "F04_PRIVATE_ROOT_ARGUMENT_REQUIRED")
    const root = suite, plan = await readPlan(root)
    const { readG08NativeManifest: readNativeManifest } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/g08-readiness.ts")
    const { requireNativeInstalledHost } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts")
    const manifest = await readNativeManifest(), host = await requireNativeInstalledHost(manifest)
    assert.equal(manifest.scratchRoot, root, "F04_ORIGINAL_PRIVATE_ROOT_REQUIRED")
    const junit = await privateText(root, "f04.junit.xml", 2_000_000), log = await privateText(root, "f04.log", 4_000_000)
    assert.equal(await privateText(root, "f04-exit-code.txt", 16), "0\n", "F04_ORIGINAL_PROCESS_FAILED")
    const inventory = verifyF04JUnit(junit, { sha: plan.candidate.sha, runId: plan.invocation.runId })
    const omni = verifyOmni(log, process.env.ORCHESTRA_OMNI_CONTROL_NONCE)
    await writePrivate(root, "f04-report-observation.json", {
      schema: "sf2h.f04-report-observation.v2", status: "ORIGINAL_BUN_REPORT_VERIFIED",
      source: plan.candidate, invocation: manifest.invocation, runtime: "BUN_HAPPYDOM_NO_CDP", inventory, omni,
      bindings: { planSha256: host.planSha256, actorsReferenceSha256: host.actorsReferenceSha256,
        packageReceiptSha256: host.packageSha256, hostBeforeSha256: host.hostSha256,
        reservationSha256: digest(JSON.stringify(plan.reservation)) },
      files: [{ path: "f04.junit.xml", sha256: digest(junit) }, { path: "f04.log", sha256: digest(log) }],
      installed: false, liveQualified: false, g08Closed: false, finalCandidate: false, productionCutover: false,
      limits: ["Original job/artifact and before/after host chain still require independent verification; metadata/parser input cannot qualify LIVE."],
    })
    console.log("F04 original three-control report verified; LIVE chain remains required")
    return
  }
  assert(mode === "record" && groups.includes(suite) && file && !output, "F04_MODE_REQUIRED")
  const root = file, plan = await readPlan(root)
  const { readG08NativeManifest: readNativeManifest } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/g08-readiness.ts")
  const { readNativeSelectedInstallation } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts")
  const { requireNativeInstalledHost } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts")
  const manifest = await readNativeManifest()
  assert.equal(manifest.scratchRoot, root, "F04_ORIGINAL_PRIVATE_ROOT_REQUIRED")
  const selected = await readNativeSelectedInstallation(manifest, suite)
  const host = await requireNativeInstalledHost(manifest)
  const bytes = await privateText(root, "native-playwright.json", 32 * 1024 * 1024)
  const inventory = verifyNativeReport(JSON.parse(bytes), suite, true)
  const files = [{ path: "native-playwright.json", sha256: digest(bytes) }]
  const observations = []
  for (const item of inventory) {
    const name = "native-case-" + suite.toLowerCase() + "-" + String(item.number).padStart(2, "0") + ".json"
    const raw = await privateText(root, name, 65536)
    observations.push(JSON.parse(raw))
    files.push({ path: name, sha256: digest(raw) })
  }
  const detached = await privateText(root, "native-browser-detached.json", 65536)
  files.push({ path: "native-browser-detached.json", sha256: digest(detached) })
  verifyNativeObservations(manifest, selected, inventory, observations, JSON.parse(detached))
  const receipt = nativeReportReceipt({ suite, source: plan.candidate, invocation: manifest.invocation, inventory,
    bindings: { planSha256: host.planSha256, actorsReferenceSha256: host.actorsReferenceSha256,
        packageReceiptSha256: host.packageSha256, hostBeforeSha256: host.hostSha256,
      reservationSha256: digest(JSON.stringify(plan.reservation)), selectedSha256: digest(JSON.stringify(selected)) }, files })
  await writePrivate(root, "native-report-observation.json", receipt)
  console.log("Native original report verified; LIVE chain remains required")
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message.match(/F04_[A-Z0-9_]+/)?.[0] ?? "F04_PRIVATE_EVIDENCE_REFUSED" : "F04_PRIVATE_EVIDENCE_REFUSED")
    process.exitCode = 1
  })
