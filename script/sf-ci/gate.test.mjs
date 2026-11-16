import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { countBunReport, countPlaywrightReport, minimalPlaywrightEvidence, verifyAll, REQUIRED, validateManifest, requiredSelection, requirePrerequisites, releaseOnlySelection } from "./gate.mjs"
import { bunCoverageIdentity, playwrightCoverageIdentity, checkCoverageBaseline, sha256Lines } from "./selection.mjs"

const report = Buffer.from(JSON.stringify({ status: "PASS",
  counts: { tests: 2, product_executed: 2, failures: 0, errors: 0, skipped: 0 },
  cases: ["first real test", "second real test"].map((name) => ({
    name, classname: "", file: "test/sf-authorized-sample.test.ts",
    failures: 0, errors: 0, skipped: 0, executed: 1, product_executed: 1,
  })),
}))
const digest = createHash("sha256").update(report).digest("hex")
const sha = "a".repeat(40)
const runId = "123"
const attempt = "1"
const treeSha = "c".repeat(40)
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
        ? { selection: { kind: "full-except-release-only", testDirectory: "Sucafinav1/test",
            releaseOnlyFiles: ["Sucafinav1/test/parity-pitr.test.ts"] } }
        : {}),
      ...(id === "CI-APP-SRC" ? { selection: { kind: "directory", testDirectory: "src" } } : {}),
      ...(id === "CI-CLI" || id === "CI-ATLAS-BUSINESS"
        ? { selection: { kind: "explicit", testFiles: ["test/sf-authorized-sample.test.ts"] } }
        : {}),
    }),
  separateReleaseProofs: ["AM01","AM02","AM03","AM04","AM05","AM06"],
}
function playwright(suite) {
  const data = {
    suites: [{ file: suite.specFile, specs: [{
      id: "case-source-id", title: "case source title",
      idHash: createHash("sha256").update("case-source-id").digest("hex"),
      tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }],
    }] }],
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  }
  return Buffer.from(JSON.stringify(data))
}
// Synthetic fixture is independently versioned; production baselines cite an authentic Actions artifact.
for (const suite of manifest.suites) {
  const inventory = suite.kind === "bun"
    ? bunCoverageIdentity(report.toString("utf8"))
    : playwrightCoverageIdentity(playwright(suite).toString("utf8"), suite.specFile)
  suite.coverageBaseline = {
    schemaVersion: 1, status: "HISTORIC_SUCCESSFUL_ARTIFACT",
    minimumCases: inventory.cases, minimumFiles: inventory.fileCount,
    casesSha256: inventory.casesSha256, filesSha256: inventory.filesSha256,
  }
}
function fixture() {
  const reports = {}
  const receipts = {}
  for (const suite of manifest.suites) {
    const bytes = suite.kind === "bun" ? report : playwright(suite)
    reports[suite.id] = bytes
    const inventory = suite.kind === "bun"
      ? bunCoverageIdentity(bytes.toString("utf8"))
      : playwrightCoverageIdentity(bytes.toString("utf8"), suite.specFile)
    receipts[suite.id] = {
      schemaVersion: 1, suiteId: suite.id, kind: suite.kind, status: "PASS",
      exitCode: 0, sourceSha: sha, checkoutSha: sha, runId, attempt,
      treeSha, manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
      runnerOS: "Linux", runnerArch: "X64", executedTests: suite.kind === "bun" ? 2 : 1,
      executedFiles: inventory.fileCount, selectedFilesSha256: sha256Lines(inventory.files),
      coverageFilesSha256: inventory.filesSha256, coverageCaseSha256: inventory.casesSha256,
      reportSha256: createHash("sha256").update(bytes).digest("hex"),
    }
  }
  const needs = Object.fromEntries(["preflight","static","omni","unit","ui"].map((name) => [name, { result: "success" }]))
  return { manifest, reports, receipts, needs, sha, runId, attempt, treeSha,
    selectionProvider: (_manifest, id) => id.startsWith("CI-UI-")
      ? [manifest.suites.find((s) => s.id === id).specFile]
      : ["test/sf-authorized-sample.test.ts"] }
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
test("Q01 two pure contracts remain in the PR suite while three F04 proofs stay release-only", () => {
  const base = new URL("../../packages/app-shell/test-browser/sucafina-native/", import.meta.url)
  const portable = readFileSync(new URL("transport-contract.test.ts", base), "utf8")
  const installed = readFileSync(new URL("transport-integration.test.ts", base), "utf8")
  for (const id of ["Q01-TRANSPORT-REGISTRY", "Q01-TRANSPORT-PILOT-ROUTES"]) {
    assert.match(portable, new RegExp(id))
    assert.doesNotMatch(installed, new RegExp(id))
  }
  for (const id of ["Q01-TRANSPORT-GUEST", "Q01-TRANSPORT-INVALID-OWNER", "Q01-TRANSPORT-STALE-FENCE"]) {
    assert.match(installed, new RegExp(id))
    assert.doesNotMatch(portable, new RegExp(id))
  }
  assert.match(installed, /readNativeManifest/)
  assert.doesNotMatch(portable, /readNativeManifest/)
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
  ["wrong tree", (a) => { a.receipts["CI-SF"].treeSha = "f".repeat(40) }],
  ["wrong manifest digest", (a) => { a.receipts["CI-SF"].manifestSha256 = "0".repeat(64) }],
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

test("M4 authentic baseline cannot silently shrink into one test", () => {
  const data = fixture()
  data.manifest = structuredClone(manifest)
  const suite = data.manifest.suites.find((item) => item.id === "CI-APP-SRC")
  suite.coverageBaseline.minimumCases += 1
  assert.throws(() => verifyAll(data), /missing\/changed baseline case or file/)
})
test("M4 missing baseline remains BLOCKED rather than passing with one test", () => {
  const data = fixture()
  data.manifest = structuredClone(manifest)
  data.manifest.suites.find((item) => item.id === "CI-SF").coverageBaseline.status = "PENDING_REAL_COMPLETE_RUN"
  assert.throws(() => verifyAll(data), /coverage baseline requires authentic successful run/)
})
test("B2 changing a selected file without the executed file evidence is RED", () => {
  const data = fixture()
  data.selectionProvider = (_manifest, id) => id === "CI-CLI" ? ["test/another-file.test.ts"]
    : id.startsWith("CI-UI-") ? [manifest.suites.find((s) => s.id === id).specFile]
      : ["test/sf-authorized-sample.test.ts"]
  assert.throws(() => verifyAll(data), /selected files were not all executed/)
})
test("CI-06 receipt binds exact test identity, not just nonzero count", () => {
  const data = fixture()
  data.receipts["CI-ATLAS-BUSINESS"].coverageCaseSha256 = "0".repeat(64)
  assert.throws(() => verifyAll(data), /case\/file\/selection receipt identity mismatch/)
})
test("forged summary cases with unchanged product count cannot masquerade as coverage", () => {
  const tampered = JSON.parse(report.toString("utf8"))
  tampered.cases.splice(0, 1)
  assert.throws(() => bunCoverageIdentity(tampered), /casecase inventory|testcase inventory\/count disagreement/)
})
test("opaque Playwright evidence retains stable case fingerprint but removes source title", () => {
  const suite = manifest.suites.find((s) => s.id === "CI-UI-OPERATIONS")
  const minimized = minimalPlaywrightEvidence(playwright(suite).toString("utf8"), suite.specFile)
  const cases = playwrightCoverageIdentity(minimized, suite.specFile)
  assert.equal(cases.cases, 1)
  assert.match(minimized, /idHash/)
  assert.doesNotMatch(minimized, /case source title/)
})
test("all suite families have a manifest declaration; no hidden Windows or macOS target", () => {
  assert.equal(validateManifest(manifest).length, 8)
  const broken = structuredClone(manifest)
  delete broken.suites.find((s) => s.id === "CI-APP-SRC").selection
  assert.throws(() => validateManifest(broken), /app unit suite must be manifest-driven/)
  assert.deepEqual([manifest.target.os, manifest.target.arch], ["Linux", "X64"])
})
