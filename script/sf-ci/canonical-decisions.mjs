#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const BASE = "ec3df1315cfd3e3077c09f7bc1f42a608448b1c0"
export const CONSOLIDATION_DIR = "docs/qa/sucafina/consolidation"
export const MATRIX_FILE = `${CONSOLIDATION_DIR}/conflict-matrix.json`
export const LEDGER_FILE = `${CONSOLIDATION_DIR}/ledger.jsonl`
export const OUTPUT_FILE = `${CONSOLIDATION_DIR}/canonical-decisions.json`
export const SCHEMA_VERSION = "orchestra-sf-canonical-decisions-v1"
export const IMMUTABLE_BUNDLE = "FINAL"

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/
const DECLARATION =
  /^[ \t]*export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|type|interface|enum|namespace)\s+([A-Za-z_$][\w$]*)/gm
const NAMED_EXPORT = /^[ \t]*export\s+(?:type\s+)?\{([^}]*)\}/gm
const NAMESPACE_EXPORT = /^[ \t]*export\s+\*\s+as\s+([A-Za-z_$][\w$]*)/gm
const DEFAULT_EXPORT = /^[ \t]*export\s+default\b/m

export function parseExportNames(text) {
  if (typeof text !== "string" || text.trim() === "") return []
  const names = new Set()
  for (const match of text.matchAll(DECLARATION)) names.add(match[1])
  if (DEFAULT_EXPORT.test(text)) names.add("default")
  for (const match of text.matchAll(NAMED_EXPORT)) {
    for (const part of match[1].split(",")) {
      const specifier = part.trim().replace(/^type\s+/, "")
      if (specifier === "") continue
      const [source, alias] = specifier.split(/\s+as\s+/)
      const name = (alias ?? source).trim()
      if (name !== "") names.add(name)
    }
  }
  for (const match of text.matchAll(NAMESPACE_EXPORT)) names.add(match[1])
  return [...names].sort()
}

const isSubset = (subset, superset) => {
  const set = new Set(superset)
  return subset.every((name) => set.has(name))
}

const shortSha = (sha) => (typeof sha === "string" ? sha.slice(0, 12) : "none")

const attempt = (run) => {
  try {
    return run()
  } catch {
    return null
  }
}

export function decidePath(input) {
  const sources = input.sources
  if (!Array.isArray(sources) || sources.length < 2) throw new Error(`NOT_DIVERGED: ${input.path} has ${sources?.length ?? 0} source(s)`)

  const rejected = []
  const maximal = sources.filter(
    (source) => !sources.some((other) => other.pr !== source.pr && other.head !== source.head && input.isAncestor(source.head, other.head)),
  )
  for (const source of sources) {
    if (maximal.includes(source)) continue
    const descendant = sources.find(
      (other) => other.pr !== source.pr && other.head !== source.head && input.isAncestor(source.head, other.head),
    )
    rejected.push({
      pr: source.pr,
      reason: `ancestry: head ${shortSha(source.head)} is an ancestor of #${descendant.pr} (${shortSha(descendant.head)})`,
    })
  }
  const ancestryEvidence = rejected.length
    ? [
        {
          type: "ancestry",
          ref: maximal.map((source) => `${source.pr}:${shortSha(source.head)}`).join(","),
          detail: `${rejected.length} of ${sources.length} source head(s) are ancestors of a descendant head`,
        },
      ]
    : []

  if (maximal.length === 1) {
    const winner = maximal[0]
    return record(input, {
      winner,
      kind: "ancestry",
      evidence: [
        ...ancestryEvidence,
        {
          type: "ancestry",
          ref: `${winner.pr}:${winner.head}`,
          detail: `head ${shortSha(winner.head)} is the only descendant head among ${sources.length} source(s)`,
        },
      ],
      rejected,
    })
  }

  const baseExports = input.base?.blob ? input.base.exports : []
  const superseded = baseExports.length === 0 ? [] : maximal.filter((source) => isSubset(source.exports, baseExports))
  for (const source of superseded) {
    rejected.push({
      pr: source.pr,
      reason:
        source.blob === null
          ? `base-superset: source deletes the path; base keeps it with ${baseExports.length} export(s)`
          : `base-superset: all ${source.exports.length} export(s) present in base (${baseExports.length} export(s))`,
    })
  }
  const remaining = maximal.filter((source) => !superseded.includes(source))
  const identical = superseded.filter((source) => source.blob === input.base.blob).length
  const baseEvidence = superseded.length
    ? [
        {
          type: "base-superset",
          ref: `${BASE}:${input.path}`,
          detail: `base blob ${shortSha(input.base.blob)} exports ${baseExports.length} name(s) and covers ${superseded.length} source(s), ${identical} with the identical blob`,
        },
      ]
    : []

  if (remaining.length === 0) {
    return {
      path: input.path,
      bundle: input.bundle,
      chosen_pr: null,
      chosen_blob: input.base.blob,
      kind: "base-superset",
      evidence: [
        ...ancestryEvidence,
        ...baseEvidence,
        {
          type: "base-superset",
          ref: `${BASE}:${input.path}`,
          detail: `base blob is canonical; every source is covered by the base export set`,
        },
      ],
      rejected,
    }
  }

  if (remaining.length === 1) {
    return record(input, {
      winner: remaining[0],
      kind: rejected.length ? "base-superset" : "export-superset",
      evidence: [
        ...ancestryEvidence,
        ...baseEvidence,
        {
          type: rejected.length ? "base-superset" : "export-superset",
          ref: `${remaining[0].pr}:${remaining[0].head}`,
          detail: `only candidate not rejected by an earlier rule; exports ${remaining[0].exports.length} name(s)`,
        },
      ],
      rejected,
    })
  }

  const strictWinners = remaining.filter((source) =>
    remaining.every(
      (other) =>
        other.pr === source.pr ||
        (source.exports.length > other.exports.length && isSubset(other.exports, source.exports)),
    ),
  )
  if (strictWinners.length === 1) {
    const winner = strictWinners[0]
    for (const source of remaining) {
      if (source.pr === winner.pr) continue
      rejected.push({
        pr: source.pr,
        reason: `export-subset: ${source.exports.length} export(s) are a strict subset of #${winner.pr} (${winner.exports.length} export(s))`,
      })
    }
    return record(input, {
      winner,
      kind: "export-superset",
      evidence: [
        ...ancestryEvidence,
        ...baseEvidence,
        {
          type: "export-superset",
          ref: `${winner.pr}:${winner.head}`,
          detail: `exports ${winner.exports.length} name(s), a strict superset of every remaining source (${remaining.map((source) => `${source.pr}:${source.exports.length}`).join(", ")})`,
        },
      ],
      rejected,
    })
  }

  const newestTime = Math.max(...remaining.map((source) => source.headTime))
  const tied = remaining.filter((source) => source.headTime === newestTime)
  for (const source of remaining) {
    if (source.headTime === newestTime) continue
    rejected.push({
      pr: source.pr,
      reason: `newest-head: head time ${new Date(source.headTime * 1000).toISOString()} is older than #${tied[0].pr} (${new Date(newestTime * 1000).toISOString()}); exports ${source.exports.length} vs ${tied[0].exports.length}`,
    })
  }
  if (tied.length > 1) {
    const identicalExports = new Set(tied.map((source) => source.exports.join("\u0000"))).size === 1
    for (const source of tied) {
      rejected.push({
        pr: source.pr,
        reason: identicalExports
          ? `needs-input: identical head time ${new Date(newestTime * 1000).toISOString()} and identical ${source.exports.length} export(s)`
          : `needs-input: identical head time ${new Date(newestTime * 1000).toISOString()} but ${source.exports.length} export(s) differ`,
      })
    }
    return {
      path: input.path,
      bundle: input.bundle,
      chosen_pr: null,
      chosen_blob: null,
      kind: "NEEDS_INPUT",
      evidence: [
        ...ancestryEvidence,
        ...baseEvidence,
        {
          type: "newest-head",
          ref: tied.map((source) => `${source.pr}:${shortSha(source.head)}`).join(","),
          detail: `${tied.length} source(s) tie on head time ${new Date(newestTime * 1000).toISOString()} (${identicalExports ? "identical" : "differing"} export sets)`,
        },
      ],
      rejected,
    }
  }

  const winner = tied[0]
  return record(input, {
    winner,
    kind: "newest-head",
    evidence: [
      ...ancestryEvidence,
      ...baseEvidence,
      {
        type: "newest-head",
        ref: `${winner.pr}:${winner.head}`,
        detail: `head time ${new Date(winner.headTime * 1000).toISOString()} is the newest of ${remaining.length} remaining source(s); exports ${winner.exports.length}`,
      },
    ],
    rejected,
  })
}

function record(input, decision) {
  const winner = decision.winner
  return {
    path: input.path,
    bundle: input.bundle,
    chosen_pr: winner.pr,
    chosen_blob: winner.blob,
    kind: decision.kind,
    evidence: decision.evidence,
    rejected: decision.rejected.sort((a, b) => a.pr - b.pr),
  }
}

function gitText(repo, args) {
  const result = Bun.spawnSync(["git", ...args], { cwd: repo, stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`)
  return result.stdout.toString()
}

function requireBlobText(repo, blob) {
  return gitText(repo, ["cat-file", "blob", blob])
}

function readLedger(repo) {
  const ledgerPath = path.join(repo, LEDGER_FILE)
  const expected = JSON.parse(readFileSync(path.join(repo, MATRIX_FILE), "utf8")).ledgerSha256
  const actual = createHash("sha256").update(readFileSync(ledgerPath)).digest("hex")
  if (expected !== actual) throw new Error(`LEDGER_DRIFT: ${LEDGER_FILE} sha256 ${actual} does not match matrix ${expected}`)
  const byPath = new Map()
  for (const line of readFileSync(ledgerPath, "utf8").split("\n")) {
    if (line.trim() === "") continue
    const entry = JSON.parse(line)
    const current = byPath.get(entry.scope.path)
    if (!current) {
      byPath.set(entry.scope.path, { bundle: entry.bundle, prs: new Set([entry.source_pr]) })
      continue
    }
    if (current.bundle !== entry.bundle) throw new Error(`LEDGER_BUNDLE_CONFLICT: ${entry.scope.path} is ${current.bundle} and ${entry.bundle}`)
    current.prs.add(entry.source_pr)
  }
  return byPath
}

function ancestryIndex(repo, heads) {
  const parents = new Map()
  for (const line of gitText(repo, ["rev-list", "--parents", ...heads]).trim().split("\n")) {
    const [commit, ...rest] = line.split(" ")
    parents.set(commit, rest)
  }
  const reachable = new Map()
  return (ancestor, descendant) => {
    if (ancestor === descendant) return true
    if (!reachable.has(descendant)) {
      const seen = new Set()
      const stack = [...(parents.get(descendant) ?? [])]
      while (stack.length > 0) {
        const commit = stack.pop()
        if (seen.has(commit)) continue
        seen.add(commit)
        stack.push(...(parents.get(commit) ?? []))
      }
      reachable.set(descendant, seen)
    }
    return reachable.get(descendant).has(ancestor)
  }
}

function headTimes(repo, heads) {
  const times = new Map()
  for (const line of gitText(repo, ["log", "--no-walk=unsorted", "--format=%H %ct", ...heads]).trim().split("\n")) {
    const [head, seconds] = line.split(" ")
    times.set(head, Number(seconds))
  }
  return times
}

export function buildDecisions(repo) {
  const matrix = JSON.parse(readFileSync(path.join(repo, MATRIX_FILE), "utf8"))
  const ledger = readLedger(repo)
  const diverged = matrix.paths.filter((entry) => entry.kind === "diverged")
  if (diverged.length === 0) throw new Error("NO_DIVERGED_PATHS: matrix has no diverged paths")

  const seen = new Set()
  for (const entry of diverged) {
    if (seen.has(entry.path)) throw new Error(`DUPLICATE_PATH: ${entry.path}`)
    seen.add(entry.path)
    const ledgerEntry = ledger.get(entry.path)
    if (!ledgerEntry) throw new Error(`MISSING_LEDGER_PATH: ${entry.path}`)
    if (ledgerEntry.bundle !== entry.bundle) {
      throw new Error(`BUNDLE_MISMATCH: ${entry.path} is ${entry.bundle} in the matrix and ${ledgerEntry.bundle} in the ledger`)
    }
    if (ledgerEntry.bundle === IMMUTABLE_BUNDLE) throw new Error(`IMMUTABLE_RECEIPT: ${entry.path} belongs to bundle ${IMMUTABLE_BUNDLE}`)
    const prs = entry.sources.map((source) => source.pr)
    if (new Set(prs).size !== prs.length) throw new Error(`DUPLICATE_SOURCE: ${entry.path} lists a PR twice`)
    for (const pr of prs) {
      if (!ledgerEntry.prs.has(pr)) throw new Error(`UNKNOWN_SOURCE: ${entry.path} source #${pr} is absent from the ledger`)
    }
  }

  const heads = [...new Set(diverged.flatMap((entry) => entry.sources.map((source) => source.head)))]
  const isAncestor = ancestryIndex(repo, heads)
  const times = headTimes(repo, heads)
  const text = new Map()
  const exportsOf = (blob) => {
    if (blob === null) return []
    if (!text.has(blob)) text.set(blob, requireBlobText(repo, blob))
    return parseExportNames(text.get(blob))
  }
  const baseBlobs = new Map()
  const baseBlobOf = (filePath) => {
    if (!baseBlobs.has(filePath)) {
      const blob = CODE_FILE.test(filePath)
        ? attempt(() => gitText(repo, ["rev-parse", "--verify", "--quiet", `${BASE}:${filePath}`]).trim())
        : null
      baseBlobs.set(filePath, blob ? blob : null)
    }
    return baseBlobs.get(filePath)
  }

  const entries = diverged
    .map((entry) => {
      const baseBlob = baseBlobOf(entry.path)
      return decidePath({
        path: entry.path,
        bundle: entry.bundle,
        base: { blob: baseBlob, exports: baseBlob ? exportsOf(baseBlob) : [] },
        sources: entry.sources.map((source) => ({
          pr: source.pr,
          head: source.head,
          blob: source.blob,
          exports: exportsOf(source.blob),
          headTime: times.get(source.head),
        })),
        isAncestor,
      })
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  if (entries.length !== diverged.length) throw new Error(`COUNT_MISMATCH: ${entries.length} decisions for ${diverged.length} paths`)
  for (const entry of entries) {
    if (entry.chosen_pr === null && entry.kind !== "base-superset" && entry.kind !== "NEEDS_INPUT") {
      throw new Error(`UNRESOLVED_CHOICE: ${entry.path} has no chosen PR for kind ${entry.kind}`)
    }
    const expectedPrs = diverged
      .find((candidate) => candidate.path === entry.path)
      .sources.map((source) => source.pr)
      .sort((a, b) => a - b)
    const accounted = [...(entry.chosen_pr === null ? [] : [entry.chosen_pr]), ...entry.rejected.map((item) => item.pr)].sort(
      (a, b) => a - b,
    )
    if (accounted.join(",") !== expectedPrs.join(",")) {
      throw new Error(`SOURCE_ACCOUNTING: ${entry.path} accounts for ${accounted.join(",")} but the matrix lists ${expectedPrs.join(",")}`)
    }
  }

  const byBundle = {}
  const byKind = {}
  for (const entry of entries) {
    byBundle[entry.bundle] = (byBundle[entry.bundle] ?? 0) + 1
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    base: BASE,
    ledgerSha256: matrix.ledgerSha256,
    counts: {
      paths: entries.length,
      byBundle: Object.fromEntries(Object.entries(byBundle).sort(([a], [b]) => (a < b ? -1 : 1))),
      byKind: Object.fromEntries(Object.entries(byKind).sort(([a], [b]) => (a < b ? -1 : 1))),
      needsInput: entries.filter((entry) => entry.kind === "NEEDS_INPUT").length,
    },
    entries,
  }
}

export function renderDecisions(decisions) {
  return `${JSON.stringify(decisions, null, 2)}\n`
}

function main(argv) {
  const repoIndex = argv.indexOf("--repo")
  const repo = path.resolve(repoIndex === -1 ? process.cwd() : argv[repoIndex + 1])
  const decisions = buildDecisions(repo)
  const rendered = renderDecisions(decisions)
  const target = path.join(repo, OUTPUT_FILE)
  if (argv.includes("--check")) {
    const current = attempt(() => readFileSync(target, "utf8"))
    if (current !== rendered) {
      process.stderr.write(`canonical-decisions: ${OUTPUT_FILE} is stale\n`)
      return 1
    }
    process.stdout.write(`canonical-decisions: ${decisions.counts.paths} path(s) reproduced byte-for-byte\n`)
    return 0
  }
  writeFileSync(target, rendered)
  const needsInput = decisions.entries.filter((entry) => entry.kind === "NEEDS_INPUT")
  process.stdout.write(
    `canonical-decisions: wrote ${decisions.counts.paths} path(s); ${needsInput.length} needs input\n${needsInput
      .map((entry) => `  NEEDS_INPUT ${entry.path}`)
      .join("\n")}${needsInput.length ? "\n" : ""}`,
  )
  return needsInput.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
