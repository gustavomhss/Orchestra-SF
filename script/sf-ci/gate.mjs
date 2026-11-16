import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

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

export function checkReceipt(receipt, suite, meta, reportBytes) {
  if (!receipt || receipt.schemaVersion !== 1) fail("invalid receipt schema")
  if (receipt.suiteId !== suite.id || receipt.kind !== suite.kind) fail("receipt suite mismatch")
  if (receipt.sourceSha !== meta.sha || receipt.checkoutSha !== meta.sha) fail("candidate or checkout SHA mismatch")
  if (receipt.runId !== String(meta.runId) || receipt.attempt !== String(meta.attempt)) fail("run identity mismatch")
  if (receipt.runnerOS !== "Linux" || receipt.runnerArch !== "X64") fail("non-Linux-x64 runner")
  if (receipt.status !== "PASS" || receipt.exitCode !== 0) fail("not a successful execution")
  if (receipt.reportSha256 !== digest(reportBytes)) fail("report artifact digest mismatch")
  const count = suite.kind === "bun"
    ? countBunReport(reportBytes.toString("utf8"))
    : countPlaywrightReport(reportBytes.toString("utf8"), suite.specFile)
  if (receipt.executedTests !== count) fail("receipt test count mismatch")
  return count
}

export function verifyAll({ manifest, receipts, reports, needs, sha, runId, attempt }) {
  const suites = validateManifest(manifest)
  if (!/^[a-f0-9]{40}$/.test(String(sha))) fail("invalid candidate SHA")
  if (!/^[0-9]+$/.test(String(runId)) || !/^[0-9]+$/.test(String(attempt))) fail("missing run identity")
  for (const job of JOBS) {
    if (needs?.[job]?.result !== "success") fail("missing, skipped, cancelled or failed job: " + job)
  }
  if (Object.keys(receipts).length !== suites.length || Object.keys(reports).length !== suites.length) {
    fail("missing or extra suite artifacts")
  }
  let sum = 0
  for (const suite of suites) {
    if (!Object.hasOwn(receipts, suite.id) || !Object.hasOwn(reports, suite.id)) fail("missing suite: " + suite.id)
    sum += checkReceipt(receipts[suite.id], suite, { sha, runId, attempt }, reports[suite.id])
  }
  return { suiteCount: suites.length, executedTests: sum, candidateSha: sha, runId: String(runId) }
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"))
}
function reportName(kind) {
  return kind === "bun" ? "summary.json" : "report.json"
}
function realRunMeta() {
  const sha = process.env.GITHUB_SHA
  const runId = process.env.GITHUB_RUN_ID
  const attempt = process.env.GITHUB_RUN_ATTEMPT
  if (!/^[a-f0-9]{40}$/.test(sha || "") || !/^[0-9]+$/.test(runId || "") ||
      !/^[0-9]+$/.test(attempt || "")) fail("invalid GitHub Actions identity")
  return { sha, runId, attempt }
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
    const receipt = {
      schemaVersion: 1, suiteId: id, kind: suite.kind,
      status: "PASS", exitCode: 0, sourceSha: meta.sha, checkoutSha: checkout,
      runId: String(meta.runId), attempt: String(meta.attempt),
      runnerOS: process.env.RUNNER_OS, runnerArch: process.env.RUNNER_ARCH,
      executedTests: count, reportSha256: digest(reportBytes),
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
    })
    console.log("SF_CI_ALL_SUITES_PASS " + JSON.stringify(result))
    return
  }
  fail("unknown CLI command")
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli()
