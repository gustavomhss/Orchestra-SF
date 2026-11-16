import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { countBunReport, countPlaywrightReport, minimalPlaywrightEvidence, verifyAll, REQUIRED, validateManifest, requiredSelection, requirePrerequisites, releaseOnlySelection } from "./gate.mjs"

const report = Buffer.from(JSON.stringify({ status: "PASS", counts: { product_executed: 2, failures: 0, errors: 0, skipped: 0 } }))
const digest = createHash("sha256").update(report).digest("hex")
const sha = "a".repeat(40)
const runId = "123"
const attempt = "1"
const manifest = {
  schemaVersion: 1, product: "Orchestra-SF", target: { os: "Linux", arch: "X64" },
  suites: REQUIRED.map((id) => id.startsWith("CI-UI-")
    ? { id, kind: "playwright", directory: "packages/app-shell", specFile: "e2e/sucafina/" + id.split("-").at(-1).toLowerCase() + ".spec.ts" }
    : { id, kind: "bun", directory: "modules/sucafina",
      ...(id === "CI-APP-BROWSER"
        ? { selection: { kind: "directory", testDirectory: "test-browser/sucafina-native",
            releaseOnlyFiles: ["test-browser/sucafina-native/transport-integration.test.ts"] } }
        : {}),
      ...(id === "CI-SF"
        ? { selection: { kind: "full-except-release-only",
            releaseOnlyFiles: ["Sucafinav1/test/parity-pitr.test.ts"] } }
        : {}),
      ...(id === "CI-CLI" || id === "CI-ATLAS-BUSINESS"
        ? { selection: { kind: "explicit", testFiles: ["test/sf-authorized-sample.test.ts"] } }
        : {}),
    }),
  separateReleaseProofs: ["AM01","AM02","AM03","AM04","AM05","AM06"],
}
function playwright(suite) {
  const data = {
    suites: [{ file: suite.specFile, specs: [{ tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }] }] }],
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  }
  return Buffer.from(JSON.stringify(data))
}
function fixture() {
  const reports = {}
  const receipts = {}
  for (const suite of manifest.suites) {
    const bytes = suite.kind === "bun" ? report : playwright(suite)
    reports[suite.id] = bytes
    receipts[suite.id] = {
      schemaVersion: 1, suiteId: suite.id, kind: suite.kind, status: "PASS",
      exitCode: 0, sourceSha: sha, checkoutSha: sha, runId, attempt,
      runnerOS: "Linux", runnerArch: "X64", executedTests: suite.kind === "bun" ? 2 : 1,
      reportSha256: createHash("sha256").update(bytes).digest("hex"),
    }
  }
  const needs = Object.fromEntries(["preflight","static","omni","unit","ui"].map((name) => [name, { result: "success" }]))
  return { manifest, reports, receipts, needs, sha, runId, attempt }
}
test("eight normative suites and six independent AM proofs remain explicit", () => {
  assert.equal(validateManifest(manifest).length, 8)
  assert.equal(verifyAll(fixture()).suiteCount, 8)
})
test("removed/duplicate/invalid SF host selections never pass manifest admission", () => {
  for (const files of [[], ["test/duplicate.test.ts", "test/duplicate.test.ts"], ["../escape.test.ts"], ["test/windows.exe"]]) {
    const invalid = structuredClone(manifest)
    invalid.suites.find((s) => s.id === "CI-CLI").selection.testFiles = files
    assert.throws(() => validateManifest(invalid), /SF_CI_FAIL_CLOSED/)
  }
})
test("Playwright artifact evidence retains only admission data and never raw attachments/secrets", () => {
  const suite = manifest.suites[5]
  const original = JSON.parse(playwright(suite).toString("utf8"))
  const secret = "SENSITIVE_ONLY_IN_RAW_PLAYWRIGHT_REPORT"
  original.suites[0].title = secret
  original.suites[0].specs[0].tests[0].results[0].stdout = [secret]
  original.suites[0].specs[0].tests[0].results[0].attachments = [{ name: secret, body: secret }]
  original.metadata = { token: secret }
  const sanitized = minimalPlaywrightEvidence(JSON.stringify(original), suite.specFile)
  assert.equal(countPlaywrightReport(sanitized, suite.specFile), 1)
  assert.equal(sanitized.includes(secret), false)
  assert.equal(sanitized.includes("attachments"), false)
})
test("removing or widening the installed SF browser selection fails closed", () => {
  for (const testDirectory of [undefined, "", "test-browser", "test-browser/other"]) {
    const invalid = structuredClone(manifest)
    invalid.suites.find((s) => s.id === "CI-APP-BROWSER").selection.testDirectory = testDirectory
    assert.throws(() => validateManifest(invalid), /SF_CI_FAIL_CLOSED/)
  }
})
test("CI workflow has one automatic trigger and preserves exhaustive green coverage", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sf-ci.yml", import.meta.url), "utf8")
  assert.match(workflow, /^  pull_request:/m)
  assert.doesNotMatch(workflow, /^  push:/m)
  assert.match(workflow, /bun test --timeout 30000 --bail=5/)
  assert.match(workflow, /sucafina-native --bail=5/)
  assert.match(workflow, /--max-failures=2/)
  assert.doesNotMatch(workflow, /--pass-with-no-tests|continue-on-error: true|--retry\s+[1-9]/)
})
test("selected files are read only from the validated Linux SF manifest", () => {
  assert.deepEqual(requiredSelection(manifest, "CI-CLI"), ["test/sf-authorized-sample.test.ts"])
  assert.deepEqual(requiredSelection(manifest, "CI-ATLAS-BUSINESS"), ["test/sf-authorized-sample.test.ts"])
  assert.throws(() => requiredSelection(manifest, "CI-SF"), /SF_CI_FAIL_CLOSED/)
  assert.throws(() => requiredSelection(manifest, "CI-APP-BROWSER"), /SF_CI_FAIL_CLOSED/)
})
test("upstream failures list every failed, skipped or missing job, not only the first", () => {
  const data = fixture()
  data.needs.static.result = "failure"
  data.needs.unit.result = "cancelled"
  delete data.needs.ui
  assert.throws(() => requirePrerequisites(data.needs), /static=failure, unit=cancelled, ui=missing/)
  assert.equal(requirePrerequisites(fixture().needs), 5)
})
test("live installed and macOS-local recovery proofs are release-owned, never silently discarded", () => {
  assert.deepEqual(releaseOnlySelection(manifest, "CI-SF"), ["Sucafinav1/test/parity-pitr.test.ts"])
  assert.deepEqual(releaseOnlySelection(manifest, "CI-APP-BROWSER"),
    ["test-browser/sucafina-native/transport-integration.test.ts"])
  for (const id of ["CI-SF", "CI-APP-BROWSER"]) {
    const tampered = structuredClone(manifest)
    delete tampered.suites.find((s) => s.id === id).selection.releaseOnlyFiles
    assert.throws(() => releaseOnlySelection(tampered, id))
    assert.throws(() => validateManifest(tampered))
  }
})
test("the two relocated proofs remain explicitly blocked by the real Azure release boundary", () => {
  const releaseWorkflow = readFileSync(new URL("../../.github/workflows/sf-release.yml", import.meta.url), "utf8")
  assert.match(releaseWorkflow, /Sucafinav1\/test\/parity-pitr\.test\.ts/)
  assert.match(releaseWorkflow, /sucafina-native\/transport-integration\.test\.ts/)
  assert.match(releaseWorkflow, /AZURE_APP_ACTIVATION_NOT_COMPOSED/)
  assert.match(releaseWorkflow, /process\.exit\(1\)/)
})
test("zero product tests fail", () => {
  assert.throws(() => countBunReport(JSON.stringify({ status: "PASS", counts: { product_executed: 0, failures: 0, errors: 0, skipped: 0 } })))
})
test("playwright requires the exact requested spec and one clean execution", () => {
  const suite = manifest.suites[5]
  assert.equal(countPlaywrightReport(playwright(suite).toString(), suite.specFile), 1)
  assert.throws(() => countPlaywrightReport(playwright(suite).toString(), "e2e/sucafina/other.spec.ts"))
})
const mutations = [
  ["missing suite", (a) => { delete a.receipts["CI-SF"] }],
  ["missing artifact", (a) => { delete a.reports["CI-SF"] }],
  ["job cancelled", (a) => { a.needs.unit.result = "cancelled" }],
  ["job skipped", (a) => { a.needs.ui.result = "skipped" }],
  ["job failed", (a) => { a.needs.static.result = "failure" }],
  ["missing job", (a) => { delete a.needs.omni }],
  ["different source SHA", (a) => { a.receipts["CI-SF"].sourceSha = "b".repeat(40) }],
  ["different checkout SHA", (a) => { a.receipts["CI-SF"].checkoutSha = "b".repeat(40) }],
  ["different run", (a) => { a.receipts["CI-SF"].runId = "999" }],
  ["different attempt", (a) => { a.receipts["CI-SF"].attempt = "2" }],
  ["wrong OS", (a) => { a.receipts["CI-SF"].runnerOS = "Windows" }],
  ["wrong arch", (a) => { a.receipts["CI-SF"].runnerArch = "ARM64" }],
  ["unexecuted", (a) => { a.receipts["CI-SF"].executedTests = 0 }],
  ["forged digest", (a) => { a.receipts["CI-SF"].reportSha256 = "0".repeat(64) }],
  ["false pass", (a) => { a.receipts["CI-SF"].status = "BLOCKED" }],
  ["error code", (a) => { a.receipts["CI-SF"].exitCode = 1 }],
  ["extra suite", (a) => { a.receipts.EXTRA = a.receipts["CI-SF"]; a.reports.EXTRA = report }],
]
for (const [name, mutate] of mutations) test(name + " cannot produce green", () => {
  const data = fixture()
  mutate(data)
  assert.throws(() => verifyAll(data), { message: /SF_CI_FAIL_CLOSED|Expected values to be strictly equal/ })
})
test("manifest removed requirement cannot produce green", () => {
  const data = fixture()
  data.manifest.suites.pop()
  assert.throws(() => verifyAll(data), /SF_CI_FAIL_CLOSED/)
})
test("test reporter skips cannot produce green", () => {
  assert.throws(() => countBunReport(JSON.stringify({ status: "PASS", counts: { product_executed: 2, failures: 0, errors: 0, skipped: 1 } })))
})
