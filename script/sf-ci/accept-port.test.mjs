import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const harness = fileURLToPath(new URL("./accept-port.mjs", import.meta.url))
const A = "modules/sucafina/Sucafinav1/runtime/local-store.ts"
const B = "modules/sucafina/Sucafinav1/runtime/procurement.ts"

function git(repo, ...args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" })
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`)
  return result.stdout.trim()
}

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "accept-port-test-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  git(dir, "init", "-q", "-b", "main")
  git(dir, "config", "user.name", "Port Fixture")
  git(dir, "config", "user.email", "fixture@example.invalid")
  git(dir, "config", "commit.gpgsign", "false")
  writeFileSync(path.join(dir, "base.txt"), "baseline\n")
  git(dir, "add", "base.txt")
  git(dir, "commit", "-qm", "chore(test): fixture baseline")
  const base = git(dir, "rev-parse", "HEAD")
  git(dir, "checkout", "-qb", "port")
  return { dir, base }
}

function addCommit(f, { paths = [A], pr = 71, bundle = "B2", message, trailers } = {}) {
  for (const file of paths) {
    const dest = path.join(f.dir, file)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, `fixture for ${file}, PR #${pr}\n`)
  }
  git(f.dir, "add", "-A")
  const commitMessage = message ?? `feat(sf): replay source PR #${pr}\n\n${trailers ?? `Source-PR: #${pr}\nCampaign-Bundle: ${bundle}`}`
  git(f.dir, "commit", "-qm", commitMessage)
  return git(f.dir, "rev-parse", "HEAD")
}

function record(pathname = A, pr = 71, bundle = "B2", extra = {}) {
  return {
    schema_version: "orchestra-sf-consolidation-ledger-v1",
    source_pr: pr, scope: { path: pathname }, bundle, disposition: "REPLAY",
    owner_decision_required: false, ...extra,
  }
}

function invoke(f, { rows, ledger = [record()], manifestText, branch = "port" } = {}) {
  const manifest = path.join(f.dir, "commits.tsv")
  const ledgerFile = path.join(f.dir, "ledger.jsonl")
  writeFileSync(ledgerFile, ledger.map((entry) => JSON.stringify(entry)).join("\n") + "\n")
  writeFileSync(manifest, manifestText ?? `sha\tsource_pr\tpath\n${rows.map((row) => `${row.sha}\t${row.pr}\t${row.path}`).join("\n")}\n`)
  return spawnSync(process.execPath, [harness, "--ledger", ledgerFile, "--manifest", manifest,
    "--branch", branch, "--base", f.base], { cwd: f.dir, encoding: "utf8" })
}

function expectReject(result, code) {
  assert.equal(result.status, 1, `expected ${code}, stdout=${result.stdout}, stderr=${result.stderr}`)
  assert.match(result.stderr, new RegExp(`^${code}: `))
  assert.doesNotMatch(result.stdout, /"status":"PASS"/)
}

test("accepts a linear, fully declared B2 port", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }] })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "PASS", base: f.base, branch: sha, commits: 1, paths: 1,
    manifest_rows: 1, ledger_records: 1,
  })
})

test("accepts a protected path only with exact REPLAY authorization", (t) => {
  const f = fixture(t)
  const file = ".github/workflows/allowed.yml"
  const sha = addCommit(f, { paths: [file], bundle: "B1" })
  const result = invoke(f, { rows: [{ sha, pr: 71, path: file }], ledger: [record(file, 71, "B1")] })
  assert.equal(result.status, 0, result.stderr)
})

test("rejects missing Source-PR trailer", (t) => {
  const f = fixture(t)
  const sha = addCommit(f, { trailers: "Campaign-Bundle: B2" })
  expectReject(invoke(f, { rows: [{ sha, pr: 71, path: A }] }), "MISSING_SOURCE_PR_TRAILER")
})

test("rejects missing bundle trailer", (t) => {
  const f = fixture(t)
  const sha = addCommit(f, { trailers: "Source-PR: #71" })
  expectReject(invoke(f, { rows: [{ sha, pr: 71, path: A }] }), "MISSING_BUNDLE_TRAILER")
})

test("rejects duplicate PR trailers", (t) => {
  const f = fixture(t)
  const sha = addCommit(f, { trailers: "Source-PR: #71\nSource-PR: #72\nCampaign-Bundle: B2" })
  expectReject(invoke(f, { rows: [{ sha, pr: 71, path: A }] }), "DUPLICATE_SOURCE_PR_TRAILER")
})

test("rejects a commit declaring the wrong bundle", (t) => {
  const f = fixture(t)
  const sha = addCommit(f, { bundle: "B1" })
  expectReject(invoke(f, { rows: [{ sha, pr: 71, path: A }] }), "WRONG_BUNDLE")
})

test("rejects a foreign path outside all REPLAY scopes", (t) => {
  const f = fixture(t)
  const foreign = "unowned/foreign.ts"
  const sha = addCommit(f, { paths: [foreign] })
  expectReject(invoke(f, { rows: [{ sha, pr: 71, path: foreign }] }), "FOREIGN_PATH")
})

test("rejects repeat ports even if separate PRs both claim the path", (t) => {
  const f = fixture(t)
  const first = addCommit(f, { pr: 71 })
  const second = addCommit(f, { pr: 72 })
  const result = invoke(f, { rows: [{ sha: first, pr: 71, path: A }, { sha: second, pr: 72, path: A }],
    ledger: [record(A, 71), record(A, 72)] })
  expectReject(result, "DUPLICATE_PATH")
})

test("rejects merge commits even with valid trailers", (t) => {
  const f = fixture(t)
  git(f.dir, "checkout", "-qb", "side", f.base)
  addCommit(f, { paths: [B], pr: 72 })
  git(f.dir, "checkout", "-q", "port")
  const sha = addCommit(f)
  git(f.dir, "merge", "--no-ff", "-m", "merge side", "side")
  const merge = git(f.dir, "rev-parse", "HEAD")
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }, { sha: merge, pr: 71, path: B }],
    ledger: [record(), record(B, 71)] })
  expectReject(result, "MERGE_COMMIT")
})

test("rejects a dirty TSV manifest", (t) => {
  const f = fixture(t)
  addCommit(f)
  const result = invoke(f, { manifestText: "sha\tsource_pr\tpath\nnot-a-sha\t#71\tfoo.ts\n" })
  expectReject(result, "DIRTY_MANIFEST")
})

test("rejects an empty manifest rather than passing vacuously", (t) => {
  const f = fixture(t)
  addCommit(f)
  expectReject(invoke(f, { manifestText: "sha\tsource_pr\tpath\n" }), "EMPTY_MANIFEST")
})

test("rejects a protected .github path without exact ledger authorization", (t) => {
  const f = fixture(t)
  const file = ".github/workflows/unapproved.yml"
  const sha = addCommit(f, { paths: [file], bundle: "B1" })
  const result = invoke(f, { rows: [{ sha, pr: 71, path: file }], ledger: [record(file, 71, "B2")] })
  expectReject(result, "PROTECTED_PATH_NOT_APPROVED")
})

test("rejects an unmanifested changed path", (t) => {
  const f = fixture(t)
  const sha = addCommit(f, { paths: [A, B] })
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }], ledger: [record(A), record(B)] })
  expectReject(result, "UNMANIFESTED_PATH")
})

test("rejects a mismatched source PR despite matching path and bundle", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }], ledger: [record(A, 72)] })
  expectReject(result, "LEDGER_MISMATCH")
})

test("rejects a manifest path not changed in its commit", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }, { sha, pr: 71, path: B }] })
  expectReject(result, "MANIFEST_PATH_MISSING")
})

test("rejects non-ancestor branches", (t) => {
  const f = fixture(t)
  git(f.dir, "checkout", "--orphan", "other")
  git(f.dir, "rm", "-q", "-rf", ".")
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }], branch: "other" })
  expectReject(result, "BASE_NOT_ANCESTOR")
})

test("rejects owner-decision-required REPLAY rows", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }],
    ledger: [record(A, 71, "B2", { owner_decision_required: true })] })
  expectReject(result, "OWNER_DECISION_REQUIRED")
})


test("ignores unrelated FINAL ledger replay scope while checking B2", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }],
    ledger: [record(A, 71, "B2"), record(B, 272, "FINAL")] })
  assert.equal(result.status, 0, result.stderr)
})

test("does not block an unrelated bundle for a pending owner decision", (t) => {
  const f = fixture(t)
  const sha = addCommit(f)
  const result = invoke(f, { rows: [{ sha, pr: 71, path: A }],
    ledger: [record(A), record(B, 72, "B1", { owner_decision_required: true })] })
  assert.equal(result.status, 0, result.stderr)
})
