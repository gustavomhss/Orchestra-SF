#!/usr/bin/env node
// Acceptance of delegated, path-scoped consolidation ports. Read-only: never mutates Git.
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"

const REQUIRED_OPTIONS = ["ledger", "manifest", "branch", "base"]
const PORT_BUNDLES = new Set(["B0", "B1", "B2", "B3"])
const LEDGER_BUNDLES = new Set([...PORT_BUNDLES, "FINAL"])
const SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i

class AcceptanceError extends Error {
  constructor(code, detail) {
    super(detail)
    this.name = "AcceptanceError"
    this.code = code
  }
}

function reject(code, detail) {
  throw new AcceptanceError(code, detail)
}

function parseArgs(argv) {
  const parsed = Object.create(null)
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (!flag?.startsWith("--") || !REQUIRED_OPTIONS.includes(flag.slice(2)) ||
        value === undefined || value.length === 0 || value.startsWith("--") ||
        Object.hasOwn(parsed, flag.slice(2))) {
      reject("INVALID_ARGUMENTS", `expected exactly --ledger, --manifest, --branch and --base; invalid ${flag ?? "<missing>"}`)
    }
    parsed[flag.slice(2)] = value
  }
  for (const key of REQUIRED_OPTIONS) {
    if (!Object.hasOwn(parsed, key)) reject("INVALID_ARGUMENTS", `missing --${key}`)
  }
  if (!SHA.test(parsed.base)) reject("INVALID_ARGUMENTS", "--base must be a full commit SHA")
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(parsed.branch) ||
      parsed.branch.includes("..") || parsed.branch.endsWith("/") ||
      parsed.branch.includes("@{")) {
    reject("INVALID_ARGUMENTS", "--branch must be a plain, unambiguous ref name")
  }
  return parsed
}

function runGit(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  })
  if (result.error || result.status === null || (!allowFailure && result.status !== 0)) {
    reject("GIT_FAILURE", `${args[0]}: ${result.error?.message ?? result.stderr.trim() ?? "unknown failure"}`)
  }
  return result
}

function validPath(value, origin) {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") ||
      value.includes("\\") || /[\0\r\n\t]/.test(value) ||
      value.split("/").some((part) => part === "" || part === "." || part === "..") ||
      value === "__all__") {
    reject(origin, `invalid repository-relative path ${JSON.stringify(value)}`)
  }
  return value
}

function prNumber(value, origin) {
  if (Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^#?[1-9][0-9]*$/.test(value)) {
    const n = Number(value.replace(/^#/, ""))
    if (Number.isSafeInteger(n)) return n
  }
  reject(origin, `invalid source PR ${JSON.stringify(value)}`)
}

function tuple(pr, bundle, path) {
  return `${pr}\0${bundle}\0${path}`
}

async function loadLedger(file) {
  let body
  try { body = await readFile(file, "utf8") } catch (error) {
    reject("LEDGER_UNREADABLE", `${file}: ${error.message}`)
  }
  const replay = new Set()
  const blocked = new Set()
  const scopes = new Map()
  let records = 0
  let replayCount = 0
  const lines = body.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) reject("DIRTY_LEDGER", `empty ledger line ${index + 1}`)
    let entry
    try { entry = JSON.parse(line) } catch {
      reject("DIRTY_LEDGER", `invalid JSON on line ${index + 1}`)
    }
    if (!entry || Array.isArray(entry) || typeof entry !== "object" ||
        typeof entry.disposition !== "string") {
      reject("DIRTY_LEDGER", `invalid ledger record on line ${index + 1}`)
    }
    records++
    if (entry.disposition !== "REPLAY") continue
    const path = validPath(entry.scope?.path ?? entry.path, "DIRTY_LEDGER")
    if (entry.path !== undefined && entry.scope?.path !== undefined && entry.path !== entry.scope.path) {
      reject("DIRTY_LEDGER", `conflicting path fields on line ${index + 1}`)
    }
    const pr = prNumber(entry.source_pr, "DIRTY_LEDGER")
    if (!LEDGER_BUNDLES.has(entry.bundle)) {
      reject("DIRTY_LEDGER", `REPLAY line ${index + 1} has unsupported bundle ${JSON.stringify(entry.bundle)}`)
    }
    const key = tuple(pr, entry.bundle, path)
    if (entry.owner_decision_required === true) blocked.add(key)
    replay.add(key)
    if (!scopes.has(entry.bundle)) scopes.set(entry.bundle, new Set())
    scopes.get(entry.bundle).add(path)
    replayCount++
  }
  if (records === 0 || replayCount === 0) reject("EMPTY_LEDGER", "ledger contains no REPLAY path records")
  return { replay, blocked, scopes, records, replayCount }
}

async function loadManifest(file) {
  let body
  try { body = await readFile(file, "utf8") } catch (error) {
    reject("MANIFEST_UNREADABLE", `${file}: ${error.message}`)
  }
  const rows = []
  const unique = new Set()
  const lines = body.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line === "sha\tsource_pr\tpath") continue
    const columns = line.split("\t")
    if (columns.length !== 3 || !SHA.test(columns[0])) {
      reject("DIRTY_MANIFEST", `line ${index + 1} must be sha<TAB>source_pr<TAB>path`)
    }
    const sha = columns[0].toLowerCase()
    const pr = prNumber(columns[1], "DIRTY_MANIFEST")
    const path = validPath(columns[2], "DIRTY_MANIFEST")
    const key = `${sha}\0${path}`
    if (unique.has(key)) reject("DIRTY_MANIFEST", `duplicate manifest entry for ${sha} ${path}`)
    unique.add(key)
    rows.push({ sha, pr, path })
  }
  if (rows.length === 0) reject("EMPTY_MANIFEST", "manifest has no path entries")
  return rows
}

function resolveCommit(ref) {
  const result = runGit(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])
  const sha = result.stdout.trim()
  if (!SHA.test(sha)) reject("GIT_FAILURE", `unable to resolve ${ref} to a full commit SHA`)
  return sha.toLowerCase()
}

function linearCommits(base, branch) {
  const ancestor = runGit(["merge-base", "--is-ancestor", base, branch], { allowFailure: true })
  if (ancestor.status !== 0) {
    if (ancestor.status === 1) reject("BASE_NOT_ANCESTOR", `${base} is not an ancestor of ${branch}`)
    reject("GIT_FAILURE", `merge-base: ${ancestor.stderr.trim()}`)
  }
  const lines = runGit(["rev-list", "--parents", "--reverse", `${base}..${branch}`])
    .stdout.trim().split("\n").filter(Boolean)
  if (lines.length === 0) reject("EMPTY_BRANCH", "base..branch has no commits")
  const parsed = lines.map((line) => line.split(" "))
  for (const parts of parsed) {
    if (parts.length !== 2) reject("MERGE_COMMIT", `${parts[0]} has ${parts.length - 1} parents, expected 1`)
  }
  let parent = base
  const commits = []
  for (const parts of parsed) {
    if (parts[1] !== parent) reject("NONLINEAR_HISTORY", `${parts[0]} is not a direct descendant of ${parent}`)
    parent = parts[0]
    commits.push(parts[0])
  }
  if (parent !== branch) reject("NONLINEAR_HISTORY", "the final commit differs from branch HEAD")
  return commits
}

function metadata(sha) {
  const message = runGit(["show", "-s", "--format=%B", sha]).stdout
  const parsed = runGit(["interpret-trailers", "--parse"], { input: message }).stdout
  const trailers = parsed.trim().split(/\r?\n/)
  const prs = trailers.filter((line) => /^Source-PR\s*:/i.test(line))
  const bundles = trailers.filter((line) => /^Campaign-Bundle\s*:/i.test(line))
  if (prs.length === 0) reject("MISSING_SOURCE_PR_TRAILER", `${sha} lacks Source-PR: #N`)
  if (prs.length !== 1) reject("DUPLICATE_SOURCE_PR_TRAILER", `${sha} has ${prs.length} Source-PR trailers`)
  if (bundles.length === 0) reject("MISSING_BUNDLE_TRAILER", `${sha} lacks Campaign-Bundle: BX`)
  if (bundles.length !== 1) reject("DUPLICATE_BUNDLE_TRAILER", `${sha} has ${bundles.length} Campaign-Bundle trailers`)
  const prValue = prs[0].replace(/^Source-PR\s*:\s*/i, "").trim()
  if (!/^#[1-9][0-9]*$/.test(prValue)) {
    reject("INVALID_SOURCE_PR_TRAILER", `${sha} has malformed Source-PR: ${prValue}`)
  }
  const pr = prNumber(prValue, "INVALID_SOURCE_PR_TRAILER")
  const bundle = bundles[0].replace(/^Campaign-Bundle\s*:\s*/i, "").trim()
  if (!PORT_BUNDLES.has(bundle)) reject("INVALID_BUNDLE_TRAILER", `${sha} has unsupported Campaign-Bundle: ${bundle}`)
  const rawPaths = runGit(["show", "--format=", "--name-only", "--no-renames", "-z", "--no-ext-diff", sha, "--"]).stdout
  const paths = rawPaths.split("\0").map((path) => path.replace(/^\n/, "")).filter(Boolean)
    .map((path) => validPath(path, "INVALID_GIT_PATH"))
  if (paths.length === 0) reject("EMPTY_COMMIT", `${sha} changes no paths`)
  return { sha, pr, bundle, paths }
}

function protectedPath(path) {
  return path === "bun.lock" || path === ".github" || path.startsWith(".github/") ||
    path.startsWith("modules/sucafina/Sucafinav1/docs/")
}

function verify(commits, manifest, ledger) {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]))
  const manifestBySha = new Map()
  for (const row of manifest) {
    const commit = bySha.get(row.sha)
    if (!commit) reject("MANIFEST_SHA_OUT_OF_RANGE", `manifest SHA ${row.sha} not in base..branch`)
    if (row.pr !== commit.pr) {
      reject("MANIFEST_SOURCE_PR_MISMATCH", `${row.sha} manifest #${row.pr} vs trailer #${commit.pr}`)
    }
    if (!manifestBySha.has(row.sha)) manifestBySha.set(row.sha, new Set())
    manifestBySha.get(row.sha).add(row.path)
  }
  const scopedPaths = new Set([...ledger.scopes.values()].flatMap((paths) => [...paths]))
  const seen = new Map()
  for (const commit of commits) {
    const declared = manifestBySha.get(commit.sha) ?? new Set()
    for (const path of commit.paths) {
      if (seen.has(path)) {
        reject("DUPLICATE_PATH", `${path} ported in both ${seen.get(path)} and ${commit.sha}`)
      }
      seen.set(path, commit.sha)
      const accepted = ledger.replay.has(tuple(commit.pr, commit.bundle, path))
      if (protectedPath(path) && !accepted) {
        reject("PROTECTED_PATH_NOT_APPROVED", `${path} lacks matching REPLAY ledger record for B${commit.bundle.slice(1)} PR #${commit.pr}`)
      }
      if (!scopedPaths.has(path)) reject("FOREIGN_PATH", `${path} absent from every REPLAY bundle scope`)
      if (!ledger.scopes.get(commit.bundle)?.has(path)) {
        reject("WRONG_BUNDLE", `${path} is not owned by ${commit.bundle} in the REPLAY ledger`)
      }
      if (!accepted) reject("LEDGER_MISMATCH", `${path} lacks REPLAY for PR #${commit.pr}, ${commit.bundle}`)
      if (ledger.blocked.has(tuple(commit.pr, commit.bundle, path))) {
        reject("OWNER_DECISION_REQUIRED", `${path} PR #${commit.pr} ${commit.bundle} requires an owner decision`)
      }
      if (!declared.has(path)) reject("UNMANIFESTED_PATH", `${commit.sha} changes ${path} but manifest omits it`)
    }
    for (const path of declared) {
      if (!commit.paths.includes(path)) {
        reject("MANIFEST_PATH_MISSING", `${commit.sha} manifest claims ${path} absent from git show --name-only`)
      }
    }
  }
  return seen.size
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const [ledger, manifest] = await Promise.all([loadLedger(args.ledger), loadManifest(args.manifest)])
  const base = resolveCommit(args.base)
  if (base !== args.base.toLowerCase()) reject("BASE_SHA_MISMATCH", `resolved ${base} differs from pinned ${args.base}`)
  const branch = resolveCommit(args.branch)
  const commits = linearCommits(base, branch).map(metadata)
  const paths = verify(commits, manifest, ledger)
  process.stdout.write(`${JSON.stringify({ status: "PASS", base, branch, commits: commits.length, paths, manifest_rows: manifest.length, ledger_records: ledger.records })}\n`)
}

main().catch((error) => {
  const code = error instanceof AcceptanceError ? error.code : "INTERNAL_ERROR"
  process.stderr.write(`${code}: ${error.message}\n`)
  process.exitCode = 1
})
