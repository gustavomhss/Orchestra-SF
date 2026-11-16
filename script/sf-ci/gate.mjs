import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { selectSuiteFiles, sha256Lines, bunCoverageIdentity, playwrightCoverageIdentity,
  checkCoverageBaseline } from "./selection.mjs"

export const REQUIRED = [
  "CI-SF", "CI-CLI", "CI-APP-SRC", "CI-APP-BROWSER", "CI-ATLAS-BUSINESS",
  "CI-UI-OPERATIONS", "CI-UI-DECISIONS", "CI-UI-REPORTS",
]
const PROOFS = ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06"]
const JOBS = ["preflight", "static", "omni", "unit", "ui"]
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const fail = (message) => { throw new Error("SF_CI_FAIL_CLOSED: " + message) }

export function validateManifest(manifest) {
  assert.equal(manifest?.schemaVersion, 1, "manifest version")
  assert.equal(manifest?.product, "Orchestra-SF", "product identity")
  assert.deepEqual(manifest?.target && [manifest.target.os, manifest.target.arch], ["Linux", "X64"])
  const suites = manifest.suites
  if (!Array.isArray(suites)) fail("missing suites")
  if (new Set(suites.map((s) => s.id)).size !== suites.length) fail("duplicate suite")
  const sfProduct = suites.find((s) => s.id === "CI-SF")
  if (sfProduct?.selection?.kind !== "full-except-release-only" ||
      JSON.stringify(sfProduct.selection.releaseOnlyFiles) !==
        JSON.stringify(["Sucafinav1/test/parity-pitr.test.ts"])) {
    fail("Linux SF unit and release-only recovery boundary drift")
  }
  const sfBrowser = suites.find((s) => s.id === "CI-APP-BROWSER")
  if (sfBrowser?.selection?.kind !== "directory" ||
      sfBrowser.selection.testDirectory !== "test-browser/sucafina-native" ||
      JSON.stringify(sfBrowser.selection.releaseOnlyFiles) !==
        JSON.stringify(["test-browser/sucafina-native/transport-integration.test.ts"])) {
    fail("the SF installed browser directory cannot be removed or replaced")
  }
  const appUnit = suites.find((s) => s.id === "CI-APP-SRC")
  if (appUnit?.selection?.kind !== "directory" || appUnit.selection.testDirectory !== "src") {
    fail("app unit suite must be manifest-driven and include all app src tests")
  }
  if (sfProduct.selection.testDirectory !== ".") {
    fail("SF complete unit subtree must remain admitted")
  }
  for (const id of ["CI-CLI", "CI-ATLAS-BUSINESS"]) {
    const selected = suites.find((s) => s.id === id)?.selection
    if (selected?.kind !== "explicit" || !Array.isArray(selected.testFiles) || selected.testFiles.length < 1 ||
        new Set(selected.testFiles).size !== selected.testFiles.length ||
        selected.testFiles.some((file) => !/^test\/[\w/-]+\.test\.ts$/.test(file))) {
      fail("invalid product selection: " + id)
    }
  }
  if (JSON.stringify(suites.map((s) => s.id)) !== JSON.stringify(REQUIRED)) fail("normative suite IDs changed")
  for (const suite of suites) {
    if (!["bun", "playwright"].includes(suite.kind)) fail("unknown runner: " + suite.id)
    if (typeof suite.directory !== "string" || !/^[\w/-]+$/.test(suite.directory)) fail("bad directory")
    if (suite.kind === "playwright" && !/^e2e\/sucafina\/[\w-]+\.spec\.ts$/.test(suite.specFile)) {
      fail("invalid selected E2E spec: " + suite.id)
    }
    if (suite.kind === "bun" && suite.specFile !== undefined) fail("unexpected bun specFile")
    if (suite.kind === "bun" && !["explicit", "directory", "full-except-release-only"].includes(suite.selection?.kind)) {
      fail("Bun selection is not manifest-governed: " + suite.id)
    }
    if (suite.coverageBaseline?.schemaVersion !== 1 ||
        !["HISTORIC_SUCCESSFUL_ARTIFACT", "PENDING_REAL_COMPLETE_RUN"].includes(suite.coverageBaseline?.status)) {
      fail("unversioned coverage baseline state: " + suite.id)
    }
  }
  if (JSON.stringify(manifest.separateReleaseProofs) !== JSON.stringify(PROOFS)) fail("AM proof inventory drift")
  return suites
}

export function countBunReport(raw) {
  let report
  try { report = JSON.parse(raw) } catch { fail("invalid Bun summary") }
  const counts = report?.counts
  if (report?.status !== "PASS") fail("Bun JUnit verifier rejected report")
  if (!Number.isSafeInteger(counts?.product_executed) || counts.product_executed < 1) fail("zero Bun tests")
  if ((counts?.failures ?? -1) !== 0 || (counts?.errors ?? -1) !== 0) fail("Bun failure/error")
  if ((counts?.skipped ?? -1) !== 0) fail("unreviewed skipped Bun tests")
  return counts.product_executed
}

export function countPlaywrightReport(raw, exactSpec) {
  let report
  try { report = JSON.parse(raw) } catch { fail("invalid Playwright report") }
  if (!Array.isArray(report.suites)) fail("missing Playwright suites")
  const stats = report.stats
  if (!stats || stats.unexpected !== 0 || stats.flaky !== 0 || stats.skipped !== 0) {
    fail("Playwright unexpected/flaky/skipped status")
  }
  let count = 0
  const visit = (suite, inheritedFile = "") => {
    const suiteFile = suite.file || inheritedFile
    for (const spec of suite.specs || []) {
      const file = String(spec.file || suiteFile).replaceAll("\\", "/")
      if (!file.endsWith(exactSpec)) fail("wrong Playwright spec selected: " + file)
      if (!Array.isArray(spec.tests) || spec.tests.length === 0) fail("unexecuted Playwright spec")
      for (const test of spec.tests) {
        if (test.expectedStatus !== "passed" || !Array.isArray(test.results) || test.results.length !== 1 ||
            test.results[0]?.status !== "passed") fail("Playwright test not passed exactly once")
        count++
      }
    }
    for (const child of suite.suites || []) visit(child, suiteFile)
  }
  for (const suite of report.suites) visit(suite)
  if (count < 1 || stats.expected !== count) fail("Playwright selected/executed count mismatch")
  return count
}


export function minimalPlaywrightEvidence(raw, exactSpec) {
  const original = JSON.parse(raw)
  const expected = countPlaywrightReport(raw, exactSpec)
  const suites = original.suites.map((suite) => {
    const visit = (input) => ({
      file: input.file,
      specs: (input.specs || []).map((spec) => ({
        file: spec.file,
        idHash: digest(String(spec.id || [spec.title, spec.line, spec.column].join("@"))),
        tests: spec.tests.map((test) => ({
          expectedStatus: test.expectedStatus,
          results: test.results.map((result) => ({ status: result.status })),
        })),
      })),
      suites: (input.suites || []).map(visit),
    })
    return visit(suite)
  })
  const safe = {
    stats: {
      expected: original.stats.expected, unexpected: original.stats.unexpected,
      flaky: original.stats.flaky, skipped: original.stats.skipped,
    },
    suites,
  }
  if (countPlaywrightReport(JSON.stringify(safe), exactSpec) !== expected) {
    fail("Playwright evidence minimization changed execution count")
  }
  return JSON.stringify(safe) + "\n"
}

function coverageForReport(bytes, suite) {
  const raw = bytes.toString("utf8")
  return suite.kind === "bun"
    ? bunCoverageIdentity(raw)
    : playwrightCoverageIdentity(raw, suite.specFile)
}

export function checkReceipt(receipt, suite, meta, reportBytes, selectedFiles) {
  if (!receipt || receipt.schemaVersion !== 1) fail("invalid receipt schema")
  if (receipt.suiteId !== suite.id || receipt.kind !== suite.kind) fail("receipt suite mismatch")
  if (receipt.sourceSha !== meta.sha || receipt.checkoutSha !== meta.sha) fail("candidate or checkout SHA mismatch")
  if (receipt.runId !== String(meta.runId) || receipt.attempt !== String(meta.attempt)) fail("run identity mismatch")
  if (receipt.treeSha !== meta.treeSha || !/^[a-f0-9]{40}$/.test(receipt.treeSha || "")) fail("tree identity mismatch")
  if (receipt.manifestSha256 !== meta.manifestSha256) fail("manifest bytes identity mismatch")
  if (receipt.runnerOS !== "Linux" || receipt.runnerArch !== "X64") fail("non-Linux-x64 runner")
  if (receipt.status !== "PASS" || receipt.exitCode !== 0) fail("not a successful execution")
  if (receipt.reportSha256 !== digest(reportBytes)) fail("report artifact digest mismatch")
  const count = suite.kind === "bun"
    ? countBunReport(reportBytes.toString("utf8"))
    : countPlaywrightReport(reportBytes.toString("utf8"), suite.specFile)
  if (receipt.executedTests !== count) fail("receipt test count mismatch")
  const coverage = checkCoverageBaseline(suite, coverageForReport(reportBytes, suite))
  const selected = sha256Lines(selectedFiles)
  if (coverage.filesSha256 !== selected) fail("selected files were not all executed: " + suite.id)
  if (receipt.selectedFilesSha256 !== selected ||
      receipt.coverageFilesSha256 !== coverage.filesSha256 ||
      receipt.coverageCaseSha256 !== coverage.casesSha256 ||
      receipt.executedFiles !== coverage.fileCount) {
    fail("case/file/selection receipt identity mismatch: " + suite.id)
  }
  return count
}

export function requirePrerequisites(needs) {
  if (needs === null || typeof needs !== "object" || Array.isArray(needs)) {
    fail("upstream job conclusions missing")
  }
  const missing = JOBS.filter((job) => needs[job]?.result !== "success")
  if (missing.length) {
    fail("upstream jobs not successful: " + missing.map((job) =>
      job + "=" + String(needs[job]?.result ?? "missing")).join(", "))
  }
  return JOBS.length
}

export function verifyAll({ manifest, receipts, reports, needs, sha, runId, attempt, treeSha,
  selectionProvider = selectSuiteFiles }) {
  const suites = validateManifest(manifest)
  if (!/^[a-f0-9]{40}$/.test(String(sha))) fail("invalid candidate SHA")
  if (!/^[0-9]+$/.test(String(runId)) || !/^[0-9]+$/.test(String(attempt))) fail("missing run identity")
  if (!/^[a-f0-9]{40}$/.test(String(treeSha))) fail("missing tree identity")
  requirePrerequisites(needs)
  if (Object.keys(receipts).length !== suites.length || Object.keys(reports).length !== suites.length) {
    fail("missing or extra suite artifacts")
  }
  let sum = 0
  for (const suite of suites) {
    if (!Object.hasOwn(receipts, suite.id) || !Object.hasOwn(reports, suite.id)) fail("missing suite: " + suite.id)
    const selection = selectionProvider(manifest, suite.id)
    sum += checkReceipt(receipts[suite.id], suite, { sha, runId, attempt, treeSha,
      manifestSha256: digest(JSON.stringify(manifest)) }, reports[suite.id], selection)
  }
  return { suiteCount: suites.length, executedTests: sum, candidateSha: sha, runId: String(runId) }
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"))
}
function reportName(kind) {
  return kind === "bun" ? "summary.json" : "report.json"
}
function realTreeSha() {
  const treeSha = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim()
  if (!/^[a-f0-9]{40}$/.test(treeSha)) fail("invalid checked-out tree identity")
  return treeSha
}
function realRunMeta() {
  const sha = process.env.GITHUB_SHA
  const runId = process.env.GITHUB_RUN_ID
  const attempt = process.env.GITHUB_RUN_ATTEMPT
  if (!/^[a-f0-9]{40}$/.test(sha || "") || !/^[0-9]+$/.test(runId || "") ||
      !/^[0-9]+$/.test(attempt || "")) fail("invalid GitHub Actions identity")
  return { sha, runId, attempt }
}
export function releaseOnlySelection(manifest, id) {
  const suites = validateManifest(manifest)
  const suite = suites.find((entry) => entry.id === id)
  const selected = suite?.selection?.releaseOnlyFiles
  if (!suite || !Array.isArray(selected) || selected.length !== 1 ||
      !selected.every((name) => /^[\w/-]+\.test\.ts$/.test(name))) {
    fail("invalid release-only selection: " + String(id))
  }
  return [...selected]
}

export function requiredSelection(manifest, id) {
  const suites = validateManifest(manifest)
  const suite = suites.find((entry) => entry.id === id)
  const selected = suite?.selection
  if (!suite || selected?.kind !== "explicit" || !Array.isArray(selected.testFiles)) {
    fail("no explicit product test files for " + String(id))
  }
  return [...selected.testFiles]
}

function cli() {
  const command = process.argv[2]
  const manifest = readJson("sf/ci/suites.json")
  const suites = validateManifest(manifest)
  if (command === "manifest") {
    console.log("SF_CI_MANIFEST_OK " + suites.length + " suites, 6 independent AM proofs; Linux X64")
    return
  }
  const meta = realRunMeta()
  if (command === "sanitize-playwright") {
    const id = process.env.SF_SUITE_ID
    const suite = suites.find((entry) => entry.id === id && entry.kind === "playwright")
    if (!suite || process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") {
      fail("invalid Playwright minimization request")
    }
    const reportFile = path.join("sf-ci-evidence", id, "report.json")
    const safe = minimalPlaywrightEvidence(readFileSync(reportFile, "utf8"), suite.specFile)
    writeFileSync(reportFile, safe, { mode: 0o600 })
    console.log("SF_CI_PLAYWRIGHT_EVIDENCE_MINIMIZED " + id)
    return
  }
  if (command === "release-only") {
    const suite = suites.find((entry) => entry.id === process.env.SF_SUITE_ID)
    for (const name of releaseOnlySelection(manifest, process.env.SF_SUITE_ID)) {
      const filename = path.join(suite.directory, name)
      if (!statSync(filename, { throwIfNoEntry: false })?.isFile()) {
        fail("release-owned proof file missing: " + filename)
      }
      process.stdout.write(name + "\n")
    }
    return
  }
  if (command === "precheck") {
    requirePrerequisites(JSON.parse(process.env.SF_NEEDS_JSON || "null"))
    console.log("SF_CI_REQUIRED_JOB_CONCLUSIONS_PASS")
    return
  }
  if (command === "select") {
    if (process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") fail("selection must run on Linux X64")
    for (const name of selectSuiteFiles(manifest, process.env.SF_SUITE_ID)) process.stdout.write(name + "\n")
    return
  }
  if (command === "coverage") {
    const id = process.env.SF_SUITE_ID
    const suite = suites.find((entry) => entry.id === id)
    if (!suite || process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") fail("invalid coverage request")
    const output = path.join("sf-ci-evidence", id)
    const reportBytes = readFileSync(path.join(output, reportName(suite.kind)))
    const coverage = coverageForReport(reportBytes, suite)
    const expectedFiles = selectSuiteFiles(manifest, id)
    if (coverage.filesSha256 !== sha256Lines(expectedFiles)) fail("coverage omitted selected file: " + id)
    console.log("SF_CI_COVERAGE_CANDIDATE " + JSON.stringify({ suiteId: id, ...meta,
      cases: coverage.cases, files: coverage.fileCount,
      casesSha256: coverage.casesSha256, filesSha256: coverage.filesSha256,
      baselineStatus: suite.coverageBaseline.status }))
    return
  }
  if (command === "receipt") {
    const id = process.env.SF_SUITE_ID
    const suite = suites.find((entry) => entry.id === id)
    if (!suite) fail("unknown suite receipt request")
    if (process.env.SF_TEST_EXIT_CODE !== "0") fail("test command failed: " + String(id))
    if (process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") fail("unsupported runner")
    const checkout = process.env.SF_CHECKOUT_SHA
    if (checkout !== meta.sha) fail("checkout mismatch")
    const output = path.join("sf-ci-evidence", id)
    const reportBytes = readFileSync(path.join(output, reportName(suite.kind)))
    const count = suite.kind === "bun"
      ? countBunReport(reportBytes.toString("utf8"))
      : countPlaywrightReport(reportBytes.toString("utf8"), suite.specFile)
    const coverage = checkCoverageBaseline(suite, coverageForReport(reportBytes, suite))
    const selected = sha256Lines(selectSuiteFiles(manifest, id))
    if (coverage.filesSha256 !== selected) fail("not every manifest-selected file executed: " + id)
    const receipt = {
      schemaVersion: 1, suiteId: id, kind: suite.kind,
      status: "PASS", exitCode: 0, sourceSha: meta.sha, checkoutSha: checkout,
      runId: String(meta.runId), attempt: String(meta.attempt),
      treeSha: realTreeSha(), manifestSha256: digest(JSON.stringify(manifest)),
      runnerOS: process.env.RUNNER_OS, runnerArch: process.env.RUNNER_ARCH,
      executedTests: count, executedFiles: coverage.fileCount,
      selectedFilesSha256: selected, coverageFilesSha256: coverage.filesSha256,
      coverageCaseSha256: coverage.casesSha256, reportSha256: digest(reportBytes),
    }
    mkdirSync(output, { recursive: true })
    writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n")
    console.log("SF_CI_SUITE_PASS " + id + " " + count + " tests " + meta.sha)
    return
  }
  if (command === "verify") {
    const root = "sf-ci-collected"
    const names = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    if (names.length !== suites.length || names.some((name) => !REQUIRED.includes(name.replace(/^sf-evidence-/, "")))) {
      fail("artifact directory inventory mismatch")
    }
    const receipts = {}
    const reports = {}
    for (const suite of suites) {
      const dir = path.join(root, "sf-evidence-" + suite.id)
      receipts[suite.id] = readJson(path.join(dir, "receipt.json"))
      reports[suite.id] = readFileSync(path.join(dir, reportName(suite.kind)))
    }
    const result = verifyAll({
      manifest, receipts, reports, needs: JSON.parse(process.env.SF_NEEDS_JSON || "null"), ...meta,
      treeSha: realTreeSha(),
    })
    console.log("SF_CI_ALL_SUITES_PASS " + JSON.stringify(result))
    return
  }
  fail("unknown CLI command")
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli()
