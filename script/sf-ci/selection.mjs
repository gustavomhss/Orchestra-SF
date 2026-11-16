import { createHash } from "node:crypto"
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs"
import path from "node:path"

/** Manifest is authoritative; this module never infers a platform outside Linux/X64. */
export const sha256Lines = (items) => createHash("sha256").update([...items].sort().join("\n")).digest("hex")
export const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex")

const fail = (message) => { throw new Error("SF_CI_FAIL_CLOSED: " + message) }
const isTestFile = (file) => /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file)
const validateRelative = (name) => {
  if (typeof name !== "string" || !name || !/^[a-zA-Z0-9_./-]+$/.test(name) ||
      name.startsWith("/") || name.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("unsafe manifest path: " + String(name))
  }
  return name
}
function ensureContained(root, relative, kind) {
  const resolved = path.join(root, validateRelative(relative))
  const info = lstatSync(resolved, { throwIfNoEntry: false })
  if (!info || info.isSymbolicLink() || (kind === "file" ? !info.isFile() : !info.isDirectory())) {
    fail("missing/unsafe " + kind + " in selected candidate: " + relative)
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
export function bunCoverageIdentity(raw) {
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
  const files = [...new Set(cases.map((name) => name.split("\0", 1)[0]))].sort()
  return { cases: cases.length, files, fileCount: files.length,
    casesSha256: sha256Lines(cases), filesSha256: sha256Lines(files) }
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
      const file = validateRelative(String(spec.file || suiteFile).replaceAll("\\", "/"))
      if (file !== exactSpec || !Array.isArray(spec.tests) || !/^[a-f0-9]{64}$/.test(spec.idHash || "")) {
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
