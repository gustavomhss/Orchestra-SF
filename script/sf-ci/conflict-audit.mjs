#!/usr/bin/env node
/**
 * Read-only replay conflict inventory. This command reads source heads; it never
 * chooses a winner, ports product files, merges, or modifies existing PRs.
 *
 * Usage:
 *   node script/sf-ci/conflict-audit.mjs [--ledger FILE] [--output FILE]
 *   node script/sf-ci/conflict-audit.mjs --check --choices FILE
 *
 * The canonical 37,603-record Phase A ledger is required by default. For a
 * fixture use --expected-records N explicitly. Do not use the example ledger
 * as the campaign inventory. Output never contains timestamps or guesses.
 *
 * --choices is an owner-supplied JSON object mapping conflicted paths to PR
 * numbers, e.g. {"src/example.ts": 71}. It is never inferred from the port.
 * --check fails closed on a ported conflict without an explicit choice.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const DEFAULT_LEDGER = "docs/qa/sucafina/consolidation/ledger.jsonl"
const LOCAL_LEDGER = "/tmp/phase-a/consolidation-ledger.jsonl"
const LEDGER_REF = "refs/remotes/origin/consolidation-ledger"
const FROZEN_LEDGER_BLOB = "796737d9d58f87364feab6d583a1b4ff5708d81a"
const FROZEN_LEDGER_SHA256 = "5cbc3cb03cf8008270d5533a3d9d789bc0908376b438cae56131c7733f83f4d8"
const DEFAULT_OUTPUT = "docs/qa/sucafina/consolidation/conflict-matrix.json"
const DEFAULT_BASE = "refs/remotes/origin/close-final-candidate"
const DEFAULT_INTEGRATION = "refs/remotes/origin/consolidate/90-integration"
const SHA = /^[0-9a-f]{40}$/i

function fail(code, detail) {
  const err = new Error(`${code}: ${detail}`)
  err.code = code
  throw err
}
function assertPath(p) {
  if (typeof p !== "string" || p === "__all__" || !p || p.startsWith("/") ||
      p.includes("\\") || p.includes("\0") || p.includes("\n") || p.includes("\r") ||
      p.split("/").some((s) => !s || s === "." || s === "..")) {
    fail("INVALID_LEDGER_PATH", JSON.stringify(p))
  }
  return p
}
function git(args, opts = {}) {
  const result = spawnSync("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 })
  if (result.error) fail("GIT_EXEC_ERROR", `${args[0]}: ${result.error.message}`)
  if (result.status !== 0 && !opts.allowFailure) {
    fail("GIT_ERROR", `${args.join(" ")} (exit ${result.status}): ${String(result.stderr).trim()}`)
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
function gitText(args, opts) { return git(args, opts).stdout.toString("utf8").trim() }
function refSha(ref) {
  const r = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFailure: true })
  return r.status === 0 ? r.stdout.toString("utf8").trim() : null
}
function ensureRef(ref, remoteBranch) {
  // Default moving refs must be refreshed, not silently taken from an old
  // checkout. Explicit immutable SHA arguments already pin their own object.
  if (ref === `refs/remotes/origin/${remoteBranch}`) {
    git(["fetch", "--no-tags", "origin", `+refs/heads/${remoteBranch}:${ref}`])
  }
  if (!refSha(ref)) fail("MISSING_REF", ref)
}
function ensurePrHead(pr, expected) {
  const ref = `refs/prhead/${pr}`
  if (!refSha(ref)) git(["fetch", "--no-tags", "origin", `+refs/pull/${pr}/head:${ref}`])
  const actual = refSha(ref)
  if (!actual) fail("MISSING_PR_HEAD", `#${pr}`)
  if (actual !== expected) {
    // Preserve the frozen source rather than silently using a moved PR head.
    // The immutable commit is an audit input, not an owner-approved replay.
    if (!refSha(expected)) git(["fetch", "--no-tags", "origin", expected])
    if (!refSha(expected)) fail("MISSING_SNAPSHOT_HEAD", `#${pr}: ${expected}`)
    console.error(`SNAPSHOT_HEAD_MOVED: #${pr}: live=${actual} frozen=${expected}`)
    return expected
  }
  return ref
}
function readLedger(filename, expectedRecords) {
  let raw
  if (existsSync(filename)) raw = readFileSync(filename)
  else if (filename === DEFAULT_LEDGER) {
    // WP5's authoritative 46 MB ledger lives on its own branch. A read-only
    // fetch avoids copying it into WP9's two-file-only commit scope.
    git(["fetch", "--no-tags", "origin", `+refs/heads/consolidation-ledger:${LEDGER_REF}`])
    const oid = gitText(["rev-parse", "--verify", `${LEDGER_REF}:${DEFAULT_LEDGER}`])
    if (oid !== FROZEN_LEDGER_BLOB) fail("LEDGER_SNAPSHOT_DRIFT", `expected ${FROZEN_LEDGER_BLOB}, found ${oid}`)
    raw = git(["show", `${LEDGER_REF}:${DEFAULT_LEDGER}`]).stdout
  } else fail("MISSING_LEDGER", `required snapshot is missing: ${filename}`)
  if (filename === DEFAULT_LEDGER) {
    const sha = createHash("sha256").update(raw).digest("hex")
    if (sha !== FROZEN_LEDGER_SHA256) fail("LEDGER_SNAPSHOT_DRIFT", `SHA-256 expected ${FROZEN_LEDGER_SHA256}, found ${sha}`)
  }
  const grouped = new Map()
  let replayCount = 0, records = 0, unassignedReplayRecords = 0
  const sourceHeads = new Map()
  const lines = raw.toString("utf8").split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) fail("EMPTY_LEDGER_LINE", `${filename}:${i + 1}`)
    records++
    let record
    try { record = JSON.parse(line) } catch { fail("INVALID_LEDGER_JSON", `${filename}:${i + 1}`) }
    if (record?.disposition !== "REPLAY") continue
    if (record.scope?.path === "__all__") fail("INVALID_REPLAY_RECORD", `aggregate REPLAY record: ${filename}:${i + 1}`)
    if (record.source_state !== "OPEN") {
      if (record.source_state == null) fail("MISSING_SOURCE_STATE", `${filename}:${i + 1}`)
      continue
    }
    replayCount++
    if (record.bundle === "NONE") unassignedReplayRecords++
    const p = assertPath(record.scope?.path)
    const pr = record.source_pr
    const head = record.source_head
    const bundle = record.bundle
    if (!Number.isSafeInteger(pr) || pr < 1 || typeof head !== "string" || !SHA.test(head) ||
        typeof bundle !== "string" || !bundle) {
      fail("INVALID_REPLAY_RECORD", `${filename}:${i + 1}`)
    }
    const priorHead = sourceHeads.get(pr)
    if (priorHead && priorHead !== head.toLowerCase()) {
      fail("INCONSISTENT_HEAD", `PR #${pr} has multiple snapshots in ledger`)
    }
    sourceHeads.set(pr, head.toLowerCase())
    let group = grouped.get(p)
    if (!group) { group = { bundle, sources: new Map() }; grouped.set(p, group) }
    if (group.bundle !== bundle) fail("NEEDS-INPUT", `path ${p} has bundles ${group.bundle} and ${bundle}`)
    const old = group.sources.get(pr)
    if (old && old !== head.toLowerCase()) fail("INCONSISTENT_HEAD", `${p} #${pr}`)
    group.sources.set(pr, head.toLowerCase())
  }
  if (records !== expectedRecords) {
    fail("LEDGER_RECORD_COUNT_MISMATCH", `${filename}: expected ${expectedRecords}, found ${records}`)
  }
  if (replayCount === 0) fail("EMPTY_REPLAY_INVENTORY", filename)
  return { raw, grouped, records, replayCount, openReplayPrs: sourceHeads.size, unassignedReplayRecords }
}
function chunks(items, size) {
  const result = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}
function blobsForHead(head, paths) {
  const blobs = new Map()
  for (const batch of chunks(paths.sort(), 100)) {
    // Match exact bytes, never Git's glob/pathspec-magic interpretation.
    const output = git(["ls-tree", "-r", "-z", head, "--", ...batch.map((p) => `:(literal)${p}`)]).stdout
    for (const item of output.toString("utf8").split("\0")) {
      if (!item) continue
      const m = item.match(/^[0-7]{6} (blob|commit) ([a-f0-9]{40})\t(.*)$/)
      if (!m) fail("INVALID_GIT_TREE", `head=${head}`)
      const [, type, oid, p] = m
      if (!batch.includes(p)) continue // Git pathspec may match a prefix.
      if (type !== "blob") fail("NON_BLOB_PATH", `${head}:${p}`)
      blobs.set(p, oid)
    }
  }
  return blobs
}
function isAncestor(older, newer, cache) {
  if (older === newer) return true
  const key = `${older}:${newer}`
  if (cache.has(key)) return cache.get(key)
  const r = git(["merge-base", "--is-ancestor", older, newer], { allowFailure: true })
  if (r.status !== 0 && r.status !== 1) fail("ANCESTRY_ERROR", `${older} vs ${newer}`)
  const yes = r.status === 0
  cache.set(key, yes)
  return yes
}
function classify(sources, ancestorCache) {
  if (new Set(sources.map((x) => x.blob)).size === 1) return "same-blob"
  // A mixed partial order is genuinely diverged, even if one pair is related.
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      if (!isAncestor(sources[i].head, sources[j].head, ancestorCache) &&
          !isAncestor(sources[j].head, sources[i].head, ancestorCache)) return "diverged"
    }
  }
  return "one-ahead"
}
function stableJson(value) {
  const ordered = (v) => Array.isArray(v) ? v.map(ordered)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordered(v[k])]))
      : v
  return JSON.stringify(ordered(value), null, 2) + "\n"
}
function inventory(ledger) {
  const overlapping = [...ledger.grouped.entries()].filter(([, x]) => x.sources.size >= 2)
  const requests = new Map()
  for (const [p, group] of overlapping) for (const [pr, head] of group.sources) {
    let req = requests.get(pr)
    if (!req) { req = { head, paths: new Set() }; requests.set(pr, req) }
    if (req.head !== head) fail("INCONSISTENT_HEAD", `#${pr}: ${req.head} vs ${head}`)
    req.paths.add(p)
  }
  if (gitText(["rev-parse", "--is-shallow-repository"]) !== "false") {
    git(["fetch", "--unshallow", "--no-tags", "origin"])
    if (gitText(["rev-parse", "--is-shallow-repository"]) !== "false") {
      fail("SHALLOW_HISTORY", "one-ahead requires complete ancestry history")
    }
  }
  const byPr = new Map()
  const missingPrs = [...requests.keys()].filter((pr) => !refSha(`refs/prhead/${pr}`))
  for (const batch of chunks(missingPrs.sort((a, b) => a - b), 32)) {
    git(["fetch", "--no-tags", "origin", ...batch.map((pr) => `+refs/pull/${pr}/head:refs/prhead/${pr}`)])
  }
  for (const [pr, req] of [...requests].sort((a, b) => a[0] - b[0])) {
    const ref = ensurePrHead(pr, req.head)
    byPr.set(pr, blobsForHead(ref, [...req.paths]))
  }
  const ancestorCache = new Map()
  const paths = overlapping.map(([p, group]) => {
    const sources = [...group.sources.entries()].sort((a, b) => a[0] - b[0]).map(([pr, head]) => ({
      pr, blob: byPr.get(pr).get(p) ?? null, head,
    }))
    return { path: p, bundle: group.bundle, sources, kind: classify(sources, ancestorCache) }
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const conflicted = paths.filter((row) => row.kind !== "same-blob")
  const byBundle = {}
  for (const row of conflicted) byBundle[row.bundle] = (byBundle[row.bundle] ?? 0) + 1
  const top20 = paths.slice().sort((a, b) => b.sources.length - a.sources.length ||
    (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).slice(0, 20)
    .map((row) => ({ path: row.path, bundle: row.bundle, sourceCount: row.sources.length, kind: row.kind }))
  return {
    schemaVersion: 1,
    ledgerSha256: createHash("sha256").update(ledger.raw).digest("hex"),
    paths,
    summary: { ledgerRecords: ledger.records, replayRecordsFromOpenPrs: ledger.replayCount,
      openReplayPrs: ledger.openReplayPrs,
      unassignedReplayRecords: ledger.unassignedReplayRecords,
      unassignedOverlappingPaths: paths.filter((row) => row.bundle === "NONE").length,
      unassignedConflictedPaths: conflicted.filter((row) => row.bundle === "NONE").length,
      totalOverlappingPaths: paths.length, totalConflictedPaths: conflicted.length,
      byBundle, top20BySourceCount: top20 },
  }
}
function selectedPrs(choicesFile, rows) {
  if (!choicesFile) return new Map()
  let data
  try { data = JSON.parse(readFileSync(choicesFile, "utf8")) }
  catch (err) { fail("INVALID_CHOICES", `${choicesFile}: ${err.message}`) }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("INVALID_CHOICES", "expected a path-to-PR object")
  const known = new Map(rows.map((row) => [row.path, row]))
  const selected = new Map()
  for (const [p, value] of Object.entries(data)) {
    const row = known.get(p)
    if (!row || row.kind === "same-blob") fail("INVALID_CHOICE", `not a conflicted path: ${p}`)
    const pr = typeof value === "number" ? value : value?.pr
    if (!Number.isSafeInteger(pr) || !row.sources.some((s) => s.pr === pr)) fail("INVALID_CHOICE", `${p}: PR ${pr}`)
    selected.set(p, pr)
  }
  return selected
}
function auditPort(matrix, args) {
  ensureRef(args.base, "close-final-candidate")
  ensureRef(args.integration, "consolidate/90-integration")
  const base = refSha(args.base), integration = refSha(args.integration)
  if (!base || !integration) fail("MISSING_INTEGRATION", `${args.base} or ${args.integration}`)
  const bases = gitText(["merge-base", "--all", base, integration]).split(/\s+/).filter(Boolean)
  if (bases.length !== 1) fail("AMBIGUOUS_MERGE_BASE", `${bases.length} candidates`)
  const conflicted = matrix.paths.filter((row) => row.kind !== "same-blob")
  const selections = selectedPrs(args.choices, matrix.paths)
  const ported = new Set()
  for (const batch of chunks(conflicted.map((x) => x.path), 100)) {
    // A net diff can be empty if a path was ported and then reverted. Walk
    // actual commit changes (including merge parents); do not miss the port.
    if (!batch.length) continue
    const names = git(["log", "--full-history", "-m", "--no-renames", "--format=", "--name-only", "-z",
      `${bases[0]}..${integration}`, "--", ...batch.map((p) => `:(literal)${p}`)])
      .stdout.toString("utf8").split("\0")
      .map((name) => name.replace(/^\n+|\n+$/g, "")).filter(Boolean)
    const allowed = new Set(batch)
    for (const name of names) if (allowed.has(name)) ported.add(name)
  }
  const portBlobs = blobsForHead(integration, [...ported])
  const failures = []
  for (const row of conflicted) {
    if (!ported.has(row.path)) continue
    const chosen = selections.get(row.path)
    if (chosen == null) {
      failures.push(`NEEDS-INPUT: ${row.path}: ported with divergent sources; choose one of ${row.sources.map((s) => `#${s.pr}`).join(", ")}`)
      continue
    }
    const expected = row.sources.find((s) => s.pr === chosen).blob
    const actual = portBlobs.get(row.path) ?? null
    if (actual !== expected) {
      failures.push(`PORT_BLOB_MISMATCH: ${row.path}: chosen #${chosen} blob=${expected} integration=${actual}`)
    }
  }
  if (failures.length) fail("PORT_CHECK_FAILED", failures.join("\n"))
  return { checkedPortedConflicts: ported.size }
}
function options(argv) {
  const result = { ledger: existsSync(DEFAULT_LEDGER) ? DEFAULT_LEDGER :
    existsSync(LOCAL_LEDGER) ? LOCAL_LEDGER : DEFAULT_LEDGER,
    output: DEFAULT_OUTPUT, check: false, choices: null,
    expectedRecords: 37603,
    base: DEFAULT_BASE, integration: DEFAULT_INTEGRATION }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === "--check") result.check = true
    else if (["--ledger", "--output", "--choices", "--base", "--integration", "--expected-records"].includes(key)) {
      const value = argv[++i]
      if (!value || value.startsWith("--")) fail("ARGUMENT_ERROR", `missing value for ${key}`)
      if (key === "--expected-records") {
        const number = Number(value)
        if (!Number.isSafeInteger(number) || number <= 0) fail("ARGUMENT_ERROR", "expected-records must be a positive integer")
        result.expectedRecords = number
      } else result[key.slice(2)] = value
    } else if (key === "--help") {
      process.stdout.write("Usage: node script/sf-ci/conflict-audit.mjs [--ledger FILE] [--output FILE] [--check] [--choices FILE] [--expected-records N] [--base REF] [--integration REF]\n")
      process.exit(0)
    } else fail("ARGUMENT_ERROR", `unknown option: ${key}`)
  }
  return result
}
function main() {
  const args = options(process.argv.slice(2))
  const matrix = inventory(readLedger(args.ledger, args.expectedRecords))
  const json = stableJson(matrix)
  if (args.check) {
    if (!existsSync(args.output) || readFileSync(args.output, "utf8") !== json) {
      fail("MATRIX_STALE", `${args.output} does not equal regenerated inventory`)
    }
    const result = auditPort(matrix, args)
    console.log(`PASS: ${matrix.summary.totalConflictedPaths} conflicts; ${result.checkedPortedConflicts} ported conflicts checked`)
  } else {
    const target = resolve(args.output)
    mkdirSync(dirname(target), { recursive: true })
    const tmp = `${target}.tmp-${process.pid}`
    try { writeFileSync(tmp, json, { flag: "wx" }); renameSync(tmp, target) }
    finally { if (existsSync(tmp)) unlinkSync(tmp) }
    console.log(`WROTE ${args.output}: ${matrix.summary.totalConflictedPaths} conflicted paths / ${matrix.summary.totalOverlappingPaths} overlaps`)
  }
}
try { main() } catch (err) {
  console.error(err.message)
  process.exitCode = 1
}
