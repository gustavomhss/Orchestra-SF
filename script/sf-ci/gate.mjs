import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, lstatSync, realpathSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { parseShardCosts, planShards } from "./shard-plan.mjs"

export const REQUIRED = [
  "CI-SF", "CI-CLI", "CI-APP-SRC", "CI-APP-BROWSER", "CI-ATLAS-BUSINESS",
  "CI-UI-OPERATIONS", "CI-UI-DECISIONS", "CI-UI-REPORTS",
]
// Canonical admission roots prevent a manifest edit from silently narrowing product coverage.
const SUITE_DIRECTORIES = Object.freeze({
  "CI-SF": "modules/sucafina",
  "CI-CLI": "apps/cli",
  "CI-APP-SRC": "packages/app-shell",
  "CI-APP-BROWSER": "packages/app-shell",
  "CI-ATLAS-BUSINESS": "modules/atlas/boundary",
  "CI-UI-OPERATIONS": "packages/app-shell",
  "CI-UI-DECISIONS": "packages/app-shell",
  "CI-UI-REPORTS": "packages/app-shell",
})
const PROOFS = ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06"]
const JOBS = ["preflight", "static", "omni", "unit", "unit-sf", "ui"]
// CI-SF is the only suite that outgrows one Linux job. Its parts are a strict
// partition of the manifest selection, proven complete and disjoint below.
export const SHARDED = Object.freeze({ "CI-SF": 8 })
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const fail = (message) => { throw new Error("SF_CI_FAIL_CLOSED: " + message) }


/** Manifest is authoritative; this module never infers a platform outside Linux/X64. */
export const sha256Lines = (items) => createHash("sha256").update([...items].sort().join("\n")).digest("hex")

/**
 * Bun schedules test files on its own, so a fixture that requires one ordered
 * process (WP01's browser pool: startup first, finalizer last) cannot run inside
 * this suite. Those files are declared in the manifest, excluded from the
 * selection, and asserted to stay excluded.
 */
const BROWSER_POOL_ENTRY = "wp01/browser-fixture.ts"

function staticImports(file) {
  let text
  try { text = readFileSync(file, "utf8") } catch { fail("shard input is unreadable: " + file) }
  const found = []
  for (const match of text.matchAll(/(?:from|import|require)\s*\(?\s*["'](\.[^"']+)["']/g)) {
    const specifier = match[1]
    const target = path.resolve(path.dirname(file), specifier)
    const candidates = [target, target + ".ts", target + ".tsx", target + ".mts", target + ".js",
      path.join(target, "index.ts"), path.join(target, "index.tsx"), path.join(target, "index.js")]
    if (/\.js$/.test(target)) candidates.push(target.replace(/\.js$/, ".ts"), target.replace(/\.js$/, ".tsx"))
    const candidate = candidates.find((entry) => existsSync(entry) && statSync(entry).isFile())
    if (candidate) found.push(candidate)
  }
  return found
}

/** Whole static graph reachable from the selection; missing/cycle edges never decide alone. */
function staticGraph(files, root) {
  const graph = new Map()
  const queue = files.map((file) => path.resolve(root, file))
  while (queue.length) {
    const file = queue.pop()
    if (graph.has(file)) continue
    const imports = staticImports(file)
    graph.set(file, imports)
    for (const next of imports) if (!graph.has(next)) queue.push(next)
  }
  return graph
}

/** Files whose static import closure occupies the WP01 ordered browser pool. */
export function browserPoolConsumers(files, root = process.cwd()) {
  const graph = staticGraph(files, root)
  const reaching = new Set([...graph.keys()].filter((file) => file.split(path.sep).join("/").endsWith(BROWSER_POOL_ENTRY)))
  let changed = reaching.size > 0
  while (changed) {
    changed = false
    for (const [file, imports] of graph) {
      if (reaching.has(file)) continue
      if (!imports.some((next) => reaching.has(next))) continue
      reaching.add(file)
      changed = true
    }
  }
  return new Set(files.map((file) => path.resolve(root, file)).filter((file) => reaching.has(file)))
}

const shardCosts = parseShardCosts(JSON.parse(
  readFileSync(new URL("../../sf/ci/shard-costs.json", import.meta.url), "utf8"),
))

/** Historical costs distribute the complete selection; they never select files. */
export function shardFiles(files, index, count) {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(index) || index < 1 || index > count) {
    fail("invalid shard index/count")
  }
  return planShards(files, count, shardCosts)[index - 1].files
}
function shardRequest(suiteId) {
  const count = SHARDED[suiteId]
  if (!count) return null
  const raw = process.env.SF_SHARD_INDEX
  if (raw === undefined || raw === "") return null
  if (!/^[0-9]+$/.test(raw) || process.env.SF_SHARD_COUNT !== String(count)) fail("shard count drift: " + suiteId)
  const index = Number(raw)
  if (index < 1 || index > count) fail("shard index out of range: " + suiteId)
  return { index, count }
}
function evidenceId(suiteId, shard) {
  return shard ? `${suiteId}-shard-${shard.index}` : suiteId
}
function suiteRoot(manifest, suiteId, repoRoot = process.cwd()) {
  const suite = manifest.suites.find((entry) => entry.id === suiteId)
  if (!suite) fail("unknown suite root: " + suiteId)
  return path.join(repoRoot, suite.directory)
}
function shardSelection(manifest, suiteId, shard, repoRoot = process.cwd()) {
  const full = selectSuiteFiles(manifest, suiteId, repoRoot)
  return shard ? shardFiles(full, shard.index, shard.count) : full
}

const isTestFile = (file) => /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file)
const validateRelative = (name) => {
  if (typeof name !== "string" || !name || !/^[a-zA-Z0-9_./-]+$/.test(name) ||
      name.startsWith("/") || name.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("unsafe manifest path: " + String(name))
  }
  return name
}
function ensureContained(root, relative, kind) {
  const segments = validateRelative(relative).split("/")
  let resolved = root
  // Reject symlinks at every component, including a parent that points back
  // inside the checkout and would otherwise bypass explicit admission.
  for (let i = 0; i < segments.length; i++) {
    resolved = path.join(resolved, segments[i])
    const info = lstatSync(resolved, { throwIfNoEntry: false })
    const leaf = i === segments.length - 1
    if (!info || info.isSymbolicLink() ||
        (leaf ? (kind === "file" ? !info.isFile() : !info.isDirectory()) : !info.isDirectory())) {
      fail("missing/unsafe " + kind + " in selected candidate: " + relative)
    }
  }
  const actual = realpathSync(resolved)
  const prefix = realpathSync(root) + path.sep
  if (!actual.startsWith(prefix)) fail("selection escaped checkout: " + relative)
  return resolved
}
function discover(root, relative) {
  // "." is the one literal full-module root, not an untrusted relative path.
  // CI-SF must include porta/*.test.ts as well as Sucafinav1/test/**.
  const dir = relative === "." ? realpathSync(root) : ensureContained(root, relative, "directory")
  const found = []
  const walk = (physical, name) => {
    for (const entry of readdirSync(physical, { withFileTypes: true })) {
      // Bun does not collect dependency trees or VCS metadata as product tests.
      if (entry.name === "node_modules" || entry.name === ".git") continue
      const next = name ? name + "/" + entry.name : entry.name
      if (entry.isSymbolicLink()) {
        // E.g. app-shell/src/custom-elements.d.ts is an existing harmless type
        // symlink. Do not traverse links or admit linked test files/directories.
        const target = statSync(path.join(physical, entry.name), { throwIfNoEntry: false })
        if (target?.isFile() && !isTestFile(next)) continue
        fail("unsafe test tree symlink: " + next)
      }
      if (entry.isDirectory()) walk(path.join(physical, entry.name), next)
      else if (entry.isFile() && isTestFile(next)) {
        validateRelative(next)
        found.push(next)
      }
    }
  }
  walk(dir, relative === "." ? "" : relative)
  return found.sort()
}
/** Paths are relative to suite.directory; stdout select is the only command input to the runner. */
export function selectSuiteFiles(manifest, suiteId, repoRoot = process.cwd()) {
  const suite = manifest.suites.find((item) => item.id === suiteId)
  if (!suite) fail("unknown suite: " + suiteId)
  const root = ensureContained(repoRoot, suite.directory, "directory")
  if (suite.kind === "playwright") {
    ensureContained(root, suite.specFile, "file")
    return [suite.specFile]
  }
  const selection = suite.selection
  if (!selection) fail("Bun suite missing manifest selection: " + suiteId)
  let files
  if (selection.kind === "explicit") {
    if (!Array.isArray(selection.testFiles) || selection.testFiles.length === 0) fail("empty explicit selection")
    files = selection.testFiles.map((name) => {
      if (!isTestFile(name)) fail("explicit path is not a test: " + name)
      ensureContained(root, name, "file")
      return name
    })
  } else if (selection.kind === "directory" || selection.kind === "full-except-release-only") {
    files = discover(root, selection.testDirectory)
  } else fail("unknown selection: " + suiteId)
  const harnessOwned = selection.harnessOwnedFiles || []
  if (!Array.isArray(harnessOwned) || new Set(harnessOwned).size !== harnessOwned.length) {
    fail("invalid harness-owned inventory")
  }
  for (const name of harnessOwned) {
    ensureContained(root, name, "file")
    if (!isTestFile(name) || !files.includes(name)) fail("harness-owned file is outside admitted selection: " + name)
  }
  // All roots share one graph; membership still proves both exclusion directions.
  const consumers = browserPoolConsumers(files, root)
  for (const name of harnessOwned) {
    if (!consumers.has(path.resolve(root, name))) {
      fail("harness-owned file does not reach the ordered pool: " + name)
    }
  }
  files = files.filter((name) => !harnessOwned.includes(name))
  const remaining = files.find((name) => consumers.has(path.resolve(root, name)))
  if (remaining) fail("ordered browser pool file is still selected: " + path.resolve(root, remaining))
  const excluded = selection.releaseOnlyFiles || []
  if (!Array.isArray(excluded) || new Set(excluded).size !== excluded.length) fail("invalid release-only inventory")
  for (const name of excluded) {
    ensureContained(root, name, "file")
    if (!files.includes(name)) fail("release-only file is outside admitted selection: " + name)
  }
  const accepted = files.filter((name) => !excluded.includes(name)).sort()
  if (accepted.length === 0 || new Set(accepted).size !== accepted.length) fail("empty/duplicate suite selection: " + suiteId)
  return accepted
}
/** Converts summary to a stable multiset of case identities; duplicate parametrized titles stay counted. */
function bunCaseKeys(raw) {
  let data
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw } catch { fail("invalid Bun coverage JSON") }
  if (data?.status !== "PASS" || !Array.isArray(data.cases) || data.cases.length === 0) fail("missing Bun case evidence")
  const cases = data.cases.filter((row) => row.product_executed === 1).map((row) => {
    const file = validateRelative(String(row.file || "").replaceAll("\\", "/"))
    if (!isTestFile(file) || typeof row.name !== "string" || !row.name.trim()) fail("missing Bun case identity")
    if (row.skipped || row.failures || row.errors || row.executed !== 1) fail("unexecuted Bun case")
    return file + "\0" + String(row.classname || "") + "\0" + row.name
  })
  if (cases.length !== data.counts?.product_executed || data.cases.length !== data.counts?.tests) {
    fail("Bun testcase inventory/count disagreement")
  }
  return cases
}
export function bunCoverageIdentity(raw) {
  const cases = bunCaseKeys(raw)
  const files = [...new Set(cases.map((name) => name.split("\0", 1)[0]))].sort()
  return { cases: cases.length, files, fileCount: files.length,
    casesSha256: sha256Lines(cases), filesSha256: sha256Lines(files) }
}

/** Playwright emits a testDir-relative file; canonicalize only that one known
 * root against the exact manifest entry, never by suffix or wildcard. */
function canonicalPlaywrightSpec(reported, exactSpec) {
  const file = validateRelative(String(reported).replaceAll("\\", "/"))
  if (!/^e2e\/sucafina\/[\w-]+\.spec\.ts$/.test(exactSpec)) fail("invalid Playwright manifest spec")
  const canonical = file.startsWith("e2e/") ? file : "e2e/" + file
  if (canonical !== exactSpec) fail("wrong Playwright spec selected: " + file)
  return canonical
}
/** Playwright minimized evidence retains only salted-free opaque case IDs and source file paths. */
export function playwrightCoverageIdentity(raw, exactSpec) {
  let data
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw } catch { fail("invalid Playwright coverage JSON") }
  if (!Array.isArray(data?.suites)) fail("missing Playwright coverage suites")
  const cases = [], files = new Set()
  const visit = (suite, inheritedFile = "") => {
    const suiteFile = suite.file || inheritedFile
    for (const spec of suite.specs || []) {
      const file = canonicalPlaywrightSpec(spec.file || suiteFile, exactSpec)
      if (!Array.isArray(spec.tests) || !/^[a-f0-9]{64}$/.test(spec.idHash || "")) {
        fail("unbound Playwright case identity/file: " + file)
      }
      files.add(file)
      spec.tests.forEach((t, index) => {
        if (t.expectedStatus !== "passed" || !Array.isArray(t.results) || t.results.length !== 1 ||
            t.results[0]?.status !== "passed") fail("incomplete Playwright execution")
        cases.push(file + "\0" + spec.idHash + "\0" + index)
      })
    }
    for (const child of suite.suites || []) visit(child, suiteFile)
  }
  for (const suite of data.suites) visit(suite)
  if (!cases.length || cases.length !== data.stats?.expected) fail("Playwright coverage case count mismatch")
  const selected = [...files].sort()
  return { cases: cases.length, files: selected, fileCount: selected.length,
    casesSha256: sha256Lines(cases), filesSha256: sha256Lines(selected) }
}
export function checkCoverageBaseline(suite, coverage) {
  const baseline = suite.coverageBaseline
  if (baseline?.schemaVersion !== 1 || baseline.status !== "HISTORIC_SUCCESSFUL_ARTIFACT") {
    fail("coverage baseline requires authentic successful run and independent review: " + suite.id)
  }
  if (!/^[a-f0-9]{64}$/.test(baseline.filesSha256) || !/^[a-f0-9]{64}$/.test(baseline.casesSha256) ||
      !Number.isSafeInteger(baseline.minimumCases) || baseline.minimumCases < 1 ||
      !Number.isSafeInteger(baseline.minimumFiles) || baseline.minimumFiles < 1) {
    fail("malformed coverage baseline: " + suite.id)
  }
  if (coverage.cases < baseline.minimumCases || coverage.fileCount < baseline.minimumFiles ||
      coverage.filesSha256 !== baseline.filesSha256 || coverage.casesSha256 !== baseline.casesSha256) {
    fail("missing/changed baseline case or file inventory: " + suite.id)
  }
  return coverage
}


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
    if (suite.directory !== SUITE_DIRECTORIES[suite.id]) fail("suite directory drift: " + suite.id)
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
      canonicalPlaywrightSpec(spec.file || suiteFile, exactSpec)
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

export function checkReceipt(receipt, suite, meta, reportBytes, selectedFiles, options = {}) {
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
  // A shard part records real execution identity; the reviewed union baseline
  // is enforced by verifyShardedSuite once every part passes its own checks.
  const coverage = options.skipBaseline
    ? coverageForReport(reportBytes, suite)
    : checkCoverageBaseline(suite, coverageForReport(reportBytes, suite))
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

function verifyShardedSuite({ manifest, suite, parts, meta, selectionProvider, repoRoot = process.cwd() }) {
  const count = SHARDED[suite.id]
  if (!Array.isArray(parts) || parts.length !== count) fail("missing shard parts: " + suite.id)
  const full = selectionProvider(manifest, suite.id)
  const caseKeys = []
  let sum = 0
  parts.forEach((part, offset) => {
    const shard = { index: offset + 1, count }
    const selection = shardFiles(full, shard.index, shard.count)
    const executed = checkReceipt(part.receipt, suite, meta, part.report, selection, { skipBaseline: true })
    if (part.receipt.shard?.index !== shard.index || part.receipt.shard?.count !== shard.count) {
      fail("shard receipt identity mismatch: " + suite.id)
    }
    caseKeys.push(...bunCaseKeys(part.report.toString("utf8")))
    sum += executed
  })
  const baseline = suite.coverageBaseline
  if (baseline?.schemaVersion !== 1 || baseline.status !== "HISTORIC_SUCCESSFUL_ARTIFACT") {
    fail("coverage baseline requires authentic successful run and independent review: " + suite.id)
  }
  const files = [...new Set(caseKeys.map((key) => key.split("\0", 1)[0]))].sort()
  if (!Number.isSafeInteger(baseline.minimumCases) || baseline.minimumCases < 1 ||
      !Number.isSafeInteger(baseline.minimumFiles) || baseline.minimumFiles < 1) {
    fail("malformed coverage baseline: " + suite.id)
  }
  if (sha256Lines(files) !== baseline.filesSha256 || sha256Lines(caseKeys) !== baseline.casesSha256 ||
      files.length < baseline.minimumFiles || caseKeys.length < baseline.minimumCases) {
    fail("missing/changed baseline case or file inventory: " + suite.id)
  }
  return sum
}

export function verifyAll({ manifest, receipts, reports, shards = {}, needs, sha, runId, attempt, treeSha,
  selectionProvider = selectSuiteFiles, repoRoot = process.cwd() }) {
  const suites = validateManifest(manifest)
  if (!/^[a-f0-9]{40}$/.test(String(sha))) fail("invalid candidate SHA")
  if (!/^[0-9]+$/.test(String(runId)) || !/^[0-9]+$/.test(String(attempt))) fail("missing run identity")
  if (!/^[a-f0-9]{40}$/.test(String(treeSha))) fail("missing tree identity")
  requirePrerequisites(needs)
  const sharded = suites.filter((suite) => SHARDED[suite.id])
  const plain = suites.filter((suite) => !SHARDED[suite.id])
  if (Object.keys(receipts).length !== plain.length || Object.keys(reports).length !== plain.length) {
    fail("missing or extra suite artifacts")
  }
  if (Object.keys(shards).length !== sharded.length ||
      sharded.some((suite) => !Object.hasOwn(shards, suite.id))) {
    fail("missing or extra shard artifacts")
  }
  const meta = { sha, runId, attempt, treeSha, manifestSha256: digest(JSON.stringify(manifest)) }
  let sum = 0
  for (const suite of plain) {
    if (!Object.hasOwn(receipts, suite.id) || !Object.hasOwn(reports, suite.id)) fail("missing suite: " + suite.id)
    const selection = selectionProvider(manifest, suite.id)
    sum += checkReceipt(receipts[suite.id], suite, meta, reports[suite.id], selection)
  }
  for (const suite of sharded) {
    sum += verifyShardedSuite({ manifest, suite, parts: shards[suite.id], meta, selectionProvider, repoRoot })
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
  // A6 workflow, not JS tooling, runs git rev-parse HEAD^{tree}; never spawn
  // a process from the gate or weaken the protected spawn-imports guard.
  const treeSha = process.env.SF_CHECKOUT_TREE_SHA
  if (!/^[a-f0-9]{40}$/.test(treeSha || "")) {
    fail("missing actual Linux checkout tree SHA; A6 must export SF_CHECKOUT_TREE_SHA")
  }
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
  if (command === "plan") {
    const id = process.argv[3]
    const count = SHARDED[id]
    if (!count) fail("plan requires a sharded suite ID")
    const files = selectSuiteFiles(manifest, id)
    const shards = planShards(files, count, shardCosts).map((part, index) => ({
      index: index + 1, files: part.files, historicalLoadSeconds: part.loadSeconds,
      unprofiledFiles: part.unprofiledFiles,
    }))
    console.log(JSON.stringify({
      schemaVersion: 1, suiteId: id, algorithm: "LPT",
      profileStatus: "HISTORICAL_RED_OR_PARTIAL", fallbackSeconds: shardCosts.fallbackSeconds,
      selectedFiles: files.length, selectedFilesSha256: sha256Lines(files), shards,
    }, null, 2))
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
    const id = process.env.SF_SUITE_ID
    for (const name of shardSelection(manifest, id, shardRequest(id))) process.stdout.write(name + "\n")
    return
  }
  if (command === "coverage") {
    const id = process.env.SF_SUITE_ID
    const shard = shardRequest(id)
    const suite = suites.find((entry) => entry.id === id)
    if (!suite || process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") fail("invalid coverage request")
    const output = path.join("sf-ci-evidence", evidenceId(id, shard))
    const reportBytes = readFileSync(path.join(output, reportName(suite.kind)))
    const coverage = coverageForReport(reportBytes, suite)
    const expectedFiles = shardSelection(manifest, id, shard)
    if (coverage.filesSha256 !== sha256Lines(expectedFiles)) fail("coverage omitted selected file: " + id)
    console.log("SF_CI_COVERAGE_CANDIDATE " + JSON.stringify({ suiteId: id, ...meta,
      cases: coverage.cases, files: coverage.fileCount,
      casesSha256: coverage.casesSha256, filesSha256: coverage.filesSha256,
      baselineStatus: suite.coverageBaseline.status }))
    return
  }
  if (command === "receipt") {
    const id = process.env.SF_SUITE_ID
    const shard = shardRequest(id)
    const suite = suites.find((entry) => entry.id === id)
    if (!suite) fail("unknown suite receipt request")
    if (process.env.SF_TEST_EXIT_CODE !== "0") fail("test command failed: " + String(id))
    if (process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64") fail("unsupported runner")
    const checkout = process.env.SF_CHECKOUT_SHA
    if (checkout !== meta.sha) fail("checkout mismatch")
    const output = path.join("sf-ci-evidence", evidenceId(id, shard))
    const reportBytes = readFileSync(path.join(output, reportName(suite.kind)))
    const count = suite.kind === "bun"
      ? countBunReport(reportBytes.toString("utf8"))
      : countPlaywrightReport(reportBytes.toString("utf8"), suite.specFile)
    // A shard receipt records real execution identity; the reviewed union
    // baseline is enforced by verify. PENDING suites may produce evidence but
    // still fail verification until an authentic baseline is versioned.
    const coverage = shard
      ? coverageForReport(reportBytes, suite)
      : checkCoverageBaseline(suite, coverageForReport(reportBytes, suite))
    const selected = sha256Lines(shardSelection(manifest, id, shard))
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
      ...(shard ? { shard: { index: shard.index, count: shard.count } } : {}),
    }
    mkdirSync(output, { recursive: true })
    writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n")
    console.log("SF_CI_SUITE_PASS " + id + " " + count + " tests " + meta.sha)
    return
  }
  if (command === "verify") {
    const root = "sf-ci-collected"
    const names = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    const expected = suites.flatMap((suite) => {
      const count = SHARDED[suite.id] || 1
      return Array.from({ length: count }, (_, offset) =>
        count === 1 ? "sf-evidence-" + suite.id : `sf-evidence-${suite.id}-shard-${offset + 1}`)
    })
    if (names.length !== expected.length || names.some((name) => !expected.includes(name))) {
      fail("artifact directory inventory mismatch")
    }
    const receipts = {}
    const reports = {}
    const shards = {}
    for (const suite of suites) {
      const count = SHARDED[suite.id] || 1
      if (count === 1) {
        const dir = path.join(root, "sf-evidence-" + suite.id)
        receipts[suite.id] = readJson(path.join(dir, "receipt.json"))
        reports[suite.id] = readFileSync(path.join(dir, reportName(suite.kind)))
        continue
      }
      shards[suite.id] = Array.from({ length: count }, (_, offset) => {
        const dir = path.join(root, `sf-evidence-${suite.id}-shard-${offset + 1}`)
        return { receipt: readJson(path.join(dir, "receipt.json")),
          report: readFileSync(path.join(dir, reportName(suite.kind))) }
      })
    }
    const result = verifyAll({
      manifest, receipts, reports, shards, needs: JSON.parse(process.env.SF_NEEDS_JSON || "null"), ...meta,
      treeSha: realTreeSha(),
    })
    console.log("SF_CI_ALL_SUITES_PASS " + JSON.stringify(result))
    return
  }
  fail("unknown CLI command")
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli()
