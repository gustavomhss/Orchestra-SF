export * as ReviewAnalyze from "./analyze"

import path from "path"
import { lstat, mkdir, readdir, realpath, writeFile } from "fs/promises"
import { Effect, Option, Schema } from "effect"
import { FSUtil } from "../fs-util"
import { ReviewCatalog } from "../review/catalog"
import { ResearchProcess } from "../research-toolkit/process"
import { ProbeRun } from "../research-toolkit/probe/run"
import { Probe } from "../research-toolkit/probe/types"
import { ToolSafetySandbox } from "../tool-safety-sandbox"
import { ReviewItem } from "./item"
import { ReviewNoise } from "./noise"
import { ReviewSarif } from "./sarif"
import { ReviewScratch } from "./scratch-copy"
import { ReviewPackAstGrep } from "./packs/ast-grep"
import { ReviewPackGitleaks } from "./packs/gitleaks"
import { ReviewPackRepo } from "./packs/repo"
import { ReviewPackSquawk } from "./packs/squawk"

// K6 analyze half (design §7.2, §8.6, plan WP 1.4): the host runs the routed packs before any model turn, each confined
// in a scratch copy (head, and base for the new-only step), keeps every raw output as a citable artifact, normalizes it
// through the catalog and hands the entries to the noise pipeline. The model sees only the capped items per lens and
// pages the retained rest of its own lens. A report that cannot be read is `acquisition-error`, never a pass; a tool
// that is not installed is `not-run`; nothing is installed and nothing reaches the network.

export type Lane = "no-build" | "repo" | "build"
export type Status = "pass" | "fail" | "not-run" | "acquisition-error"

export type Check = {
  readonly id: string
  readonly pack: string
  readonly version: string
  readonly lane: string
  readonly status: Status
  readonly reason?: string
  /** The check executed repository code (plan R4). */
  readonly workspaceExecuted: boolean
  /** The retained raw output. */
  readonly uri?: string
}

type Pipeline = typeof ReviewNoise.pipeline
type PipelineInput = Parameters<Pipeline>[0]

export type RunInput = {
  readonly worktree: string
  /** The base revision: the new-only step's tree and the source of the repository's declared gates. */
  readonly base: string
  /** The head revision; omitted, the working tree as it is now. */
  readonly head?: string
  readonly tier: string
  readonly catalog?: ReviewCatalog.Catalog
  /** The host directory that keeps this review's artifacts. */
  readonly store: string
  readonly changed: PipelineInput["changed"]
  readonly addedSuppressions?: PipelineInput["addedSuppressions"]
  /** D6: repository code runs only for the project the owner opened, never for an external target. */
  readonly trusted: boolean
  /** The highest lane this run may enter: no-build, then repo, then build. */
  readonly lane: Lane
  readonly packs: ReadonlyArray<string>
  readonly scope: "diff" | "files"
  readonly files?: ReadonlyArray<string>
}

export class Failed extends Schema.TaggedErrorClass<Failed>()("ReviewAnalyze.Failed", { reason: Schema.String }) {}

const LANES: ReadonlyArray<string> = ["no-build", "repo", "build"]
const PAGE = 20
const SCAN_MS = 5 * 60_000
const GATE_MS = 10 * 60_000
const GATE_BYTES = 16 * 1024 * 1024
const CACHED = 64
const RETAINED = /^review:([0-9a-f-]{36})\/retained\.json$/

// Base results by pack, version, template and the base commit's tree: a rereview, or a second review over the same base,
// reads them instead of scanning again.
const baseCache = new Map<string, { results: ReadonlyArray<ReviewSarif.Raw>; uri: string }>()

/** Host only: runs the routed packs and the noise pipeline once, before any model turn. */
export const run = Effect.fn("ReviewAnalyze.run")(function* (input: RunInput, pipeline: Pipeline = ReviewNoise.pipeline) {
  const catalog = input.catalog ?? ReviewCatalog.current
  const id = Bun.randomUUIDv7()
  const context = {
    input,
    catalog,
    write: (name: string, text: string) =>
      Effect.promise(() => Bun.write(path.join(input.store, id, name), text)).pipe(Effect.as(`review:${id}/${name}`)),
    head: yield* Effect.cached(copy(input.head === undefined
      ? { worktree: input.worktree, tree: true }
      : { worktree: input.worktree, revision: input.head })),
    base: yield* Effect.cached(copy({ worktree: input.worktree, revision: input.base })),
  }
  // No-build packs first: a repository gate may rewrite files in the head copy.
  const ordered = input.packs
    .map((packID) => ({ packID, pack: catalog.packs.find((entry) => entry.id === packID) }))
    .toSorted((a, b) => LANES.indexOf(a.pack?.lane ?? "build") - LANES.indexOf(b.pack?.lane ?? "build"))
  const outcomes = yield* Effect.forEach(ordered, (entry) => runPack(entry.packID, entry.pack, context), { concurrency: 1 })
  const inScope = (entry: ReviewSarif.Entry) => input.scope === "diff" || (input.files ?? []).includes(entry.item.path)
  const result = pipeline({
    head: outcomes.flatMap((outcome) => outcome.head).filter(inScope),
    base: outcomes.flatMap((outcome) => outcome.base).filter(inScope),
    changed: input.changed,
    ...(input.addedSuppressions === undefined ? {} : { addedSuppressions: input.addedSuppressions }),
    tier: input.tier,
    catalog,
  })
  const retained = yield* context.write("retained.json", JSON.stringify(result.retained))
  const debt = yield* context.write("debt.json", JSON.stringify(result.debt))
  return {
    checks: outcomes.flatMap((outcome) => outcome.checks),
    items: result.items,
    retained: { uri: retained, total: result.retained.total, unread: result.retained.unread },
    debt: { uri: debt, total: result.debt.length },
  }
}, Effect.scoped)

/** A lens child pages its own lens of the retained artifact; the host binds `lens` to the caller's routed lens. */
export const page = Effect.fn("ReviewAnalyze.page")(function* (input: {
  readonly store: string
  readonly uri: string
  readonly lens: string
  readonly filter?: { readonly rule?: string; readonly path?: string; readonly class?: string }
  readonly cursor?: string
}) {
  const match = RETAINED.exec(input.uri)
  if (!match) return yield* new Failed({ reason: `artifact-unknown: ${input.uri}` })
  const text = yield* Effect.promise(() => Bun.file(path.join(input.store, match[1], "retained.json")).text().catch(() => undefined))
  const json = text === undefined ? Option.none() : Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(text)
  const retained = Option.flatMap(json, Schema.decodeUnknownOption(Retained))
  if (Option.isNone(retained)) return yield* new Failed({ reason: `artifact-unreadable: ${input.uri}` })
  const start = input.cursor === undefined ? 0 : Number(input.cursor)
  if (!Number.isSafeInteger(start) || start < 0) return yield* new Failed({ reason: `cursor-invalid: ${input.cursor}` })
  const filter = input.filter
  const matching = retained.value.items.filter((item) =>
    item.lens === input.lens &&
    (filter?.rule === undefined || item.rule === filter.rule) &&
    (filter?.path === undefined || item.path === filter.path) &&
    (filter?.class === undefined || item.class === filter.class))
  const next = start + PAGE
  return { items: matching.slice(start, next), ...(next < matching.length ? { cursor: String(next) } : {}) }
})

const Retained = Schema.Struct({ items: Schema.Array(ReviewItem.ToolItem) })

type Pack = ReviewCatalog.Catalog["packs"][number]
type Copy = { readonly snapshot: ReviewScratch.Snapshot } | { readonly failed: string }
type Context = {
  readonly input: RunInput
  readonly catalog: ReviewCatalog.Catalog
  readonly write: (name: string, text: string) => Effect.Effect<string>
  readonly head: ReturnType<typeof copy>
  readonly base: ReturnType<typeof copy>
}
type Outcome = { readonly checks: Check[]; readonly head: ReviewSarif.Entry[]; readonly base: ReviewSarif.Entry[] }

const runPack = Effect.fnUntraced(function* (packID: string, pack: Pack | undefined, context: Context) {
  const lane = context.input.lane
  if (!pack) return only({ id: packID, pack: packID, version: "unknown", lane, status: "not-run", reason: "unknown pack", workspaceExecuted: false })
  const refused = (reason: string) => only(check(pack, "not-run", reason))
  if (LANES.indexOf(pack.lane) > LANES.indexOf(lane)) return refused(`lane: ${pack.lane} is above ${lane}`)
  if (pack.status === "dropped") return refused("dropped")
  // Squawk's argv is effectful (it stats the copy). The static template scanners stay as they are.
  if (pack.backend === "pinned" && pack.id === ReviewPackSquawk.manifest.id) return yield* squawked(pack, context)
  const scanner = pack.backend === "pinned" ? pinnedScanner(pack.id) : undefined
  if (scanner) return yield* scanned(pack, scanner, context)
  if (pack.backend === "repo") return yield* gates(pack, context)
  return refused("not-built")
})

type ScanInput = { executable: string; root: string; report: string }
type Scanner = {
  readonly locate: typeof ReviewPackGitleaks.locate
  readonly templates: Readonly<Record<string, (input: ScanInput) => string[]>>
  readonly prepare?: (directory: string) => Effect.Effect<void>
  readonly sink?: "stdout"
  readonly completedExits?: readonly number[]
}

function pinnedScanner(id: string): Scanner | undefined {
  if (id === ReviewPackGitleaks.manifest.id) return ReviewPackGitleaks
  if (id === ReviewPackAstGrep.manifest.id) return ReviewPackAstGrep
  return undefined
}

/** A pinned scanner over the head copy and, for the new-only step, the base copy. */
const scanned = Effect.fnUntraced(function* (pack: Pack, scanner: Scanner, context: Context) {
  const located = yield* scanner.locate()
  if ("absent" in located) return only(check(pack, "not-run", located.absent))
  const template = scanner.templates[pack.template]
  if (!template) return only(check(pack, "not-run", `template unknown: ${pack.template}`))
  const completed: readonly number[] = scanner.completedExits ?? [0]
  const scan = (copied: Copy, side: "head" | "base") => Effect.gen(function* () {
    if ("failed" in copied) return { status: "not-run" as const, reason: copied.failed }
    const snapshot = copied.snapshot
    // Outside the scanned copy. A report-file scanner may write only that file; a stdout scanner writes nothing.
    const report = path.join(snapshot.scratch, "reports", `${pack.id}.${pack.output.format}`)
    yield* Effect.promise(() => mkdir(path.dirname(report), { recursive: true }))
    if (scanner.prepare) yield* scanner.prepare(path.dirname(report))
    if (scanner.sink !== "stdout") yield* Effect.promise(() => writeFile(report, ""))
    const ran = yield* confined({
      argv: template({ executable: located.executable, root: snapshot.root, report }),
      cwd: snapshot.scratch,
      write: scanner.sink === "stdout" ? [] : [report],
      env: ResearchProcess.environment(), timeoutMs: SCAN_MS, maxBytes: Probe.Limits.outputBytes,
    })
    if ("denied" in ran) return { status: "not-run" as const, reason: ran.denied }
    const text = scanner.sink === "stdout"
      ? ran.outcome.stdout.data.toString("utf8")
      : yield* Effect.promise(() => Bun.file(report).text().catch(() => ""))
    const uri = yield* context.write(`raw/${pack.id}-${side}.${pack.output.format}`, text)
    const unsettled = settle(ran.outcome)
    if (unsettled) return { ...unsettled, uri }
    if (!completed.includes(ran.outcome.exitCode ?? -1))
      return { status: "acquisition-error" as const, reason: `exit ${ran.outcome.exitCode}: ${firstLine(ran.outcome.stderr.data)}`, uri }
    const options = { pack: pack.id, root: snapshot.root }
    const parsed = pack.output.format === "sarif"
      ? ReviewSarif.parseSarif(text, options)
      : ReviewSarif.parseJson(pack.output.parser, text, options)
    if (parsed.status === "acquisition-error") return { status: "acquisition-error" as const, reason: parsed.reason, uri }
    return { status: "ok" as const, results: parsed.results, uri }
  })
  const head = yield* scan(yield* context.head, "head")
  if (head.status !== "ok") return only(check(pack, head.status, head.reason, head.uri))
  const tree = yield* ResearchProcess.git(context.input.worktree, ["rev-parse", "--verify", `${context.input.base}^{tree}`]).pipe(
    Effect.map((data) => data.toString("utf8").trim()),
    Effect.orElseSucceed(() => undefined),
  )
  const key = tree === undefined ? undefined : `${pack.id}@${pack.version}:${pack.template}:${tree}`
  const cached = key === undefined ? undefined : baseCache.get(key)
  const base = cached ? { status: "ok" as const, ...cached } : yield* scan(yield* context.base, "base")
  // Without the base, every head item would pass as new: none reach the model.
  if (base.status !== "ok") return only(check(pack, base.status, `base: ${base.reason}`, "uri" in base ? base.uri : undefined))
  if (key !== undefined && !cached) remember(key, { results: base.results, uri: base.uri })
  const lookup = rules(context.catalog)
  const changed = context.input.changed
  const onChanged = (file: string, line: number, endLine?: number) =>
    (changed[file] ?? []).some((range) => line <= range.end && (endLine ?? line) >= range.start)
  return {
    checks: [check(pack, head.results.length > 0 ? "fail" : "pass", undefined, head.uri)],
    head: ReviewSarif.toItems(head.results, lookup, onChanged).items,
    base: ReviewSarif.toItems(base.results, lookup).items,
  } satisfies Outcome
})

/** Squawk over the copied tree only: host TOML, explicit regular `.sql` paths, stdout retained before settle. */
const squawked = Effect.fnUntraced(function* (pack: Pack, context: Context) {
  if (pack.output.format !== "json") return only(check(pack, "not-run", `template unknown: ${pack.template}`))
  if (pack.output.parser !== "squawk" || pack.template !== "squawk-json")
    return only(check(pack, "not-run", `template unknown: ${pack.template}`))
  const located = yield* ReviewPackSquawk.locate()
  if ("absent" in located) return only(check(pack, "not-run", located.absent))
  // No Squawk baseCache: the key would have to include the selected files, and a tree-only key reuses another selection.
  const scan = (copied: Copy, side: "head" | "base") => Effect.gen(function* () {
    if ("failed" in copied) return { status: "not-run" as const, reason: copied.failed }
    const snapshot = copied.snapshot
    const selected = yield* Effect.promise(() => sqlSelection(snapshot.root, context.input, side))
    if ("refused" in selected) return { status: "not-run" as const, reason: selected.refused }
    if (selected.files.length === 0) {
      if (side === "head") return { status: "not-run" as const, reason: "no-input" }
      const uri = yield* context.write(`raw/${pack.id}-base.json`, JSON.stringify({ invoked: false, reason: "no-eligible-base-input" }))
      return { status: "ok" as const, results: [], uri, emptyBase: true as const }
    }
    const config = yield* ReviewPackSquawk.prepare(path.join(snapshot.scratch, "squawk-host"))
    const built = yield* ReviewPackSquawk.argv({ executable: located.executable, config, root: snapshot.root, files: selected.files })
    if (built.status !== "ok") return { status: "not-run" as const, reason: built.reason }
    const ran = yield* confined({
      argv: built.argv, cwd: snapshot.scratch, write: [], env: ResearchProcess.environment(),
      timeoutMs: SCAN_MS, maxBytes: Probe.Limits.outputBytes,
    })
    if ("denied" in ran) return { status: "not-run" as const, reason: ran.denied }
    // The captured stdout, including a truncated or unknown-rule report, is retained before settle classifies it.
    const text = ran.outcome.stdout.data.toString("utf8")
    const uri = yield* context.write(`raw/${pack.id}-${side}.json`, text)
    const settled = ReviewPackSquawk.settle(ran.outcome, snapshot.root)
    if (settled.status === "not-run") return { status: "not-run" as const, reason: settled.reason, uri }
    if (settled.status !== "ok") return { status: "acquisition-error" as const, reason: settled.reason, uri }
    return { status: "ok" as const, results: settled.results, uri }
  })
  const head = yield* scan(yield* context.head, "head")
  if (head.status !== "ok") return only(check(pack, head.status, head.reason, head.uri))
  const base = yield* scan(yield* context.base, "base")
  if (base.status !== "ok") return only(check(pack, base.status, `base: ${base.reason}`, "uri" in base ? base.uri : undefined))
  const lookup = rules(context.catalog)
  const changed = context.input.changed
  const onChanged = (file: string, line: number, endLine?: number) =>
    (changed[file] ?? []).some((range) => line <= range.end && (endLine ?? line) >= range.start)
  const coverage = "emptyBase" in base && base.emptyBase ? "base: no eligible SQL input; no base scanner invocation" : undefined
  return {
    checks: [check(pack, head.results.length > 0 ? "fail" : "pass", coverage, head.uri)],
    head: ReviewSarif.toItems(head.results, lookup, onChanged).items,
    base: ReviewSarif.toItems(base.results, lookup).items,
  } satisfies Outcome
})

async function sqlSelection(root: string, input: RunInput, side: "head" | "base") {
  if (input.scope !== "files") return { files: await regularSql(root) }
  const requested = input.files ?? []
  // Lexical containment before existence, so a missing base file is not how an escape gets through.
  const escaped = requested.find((file) => file.includes("\0") || !FSUtil.contains(root, path.resolve(root, file)))
  if (escaped) return { refused: escaped.includes("\0") ? "nul" : "path-outside" }
  const files: string[] = []
  for (const file of requested.filter((entry) => path.basename(entry).endsWith(".sql"))) {
    const absolute = path.resolve(root, file)
    const info = await lstat(absolute).catch((error: NodeJS.ErrnoException) => error)
    if (info instanceof Error) {
      if (side === "base" && (info.code === "ENOENT" || info.code === "ENOTDIR")) continue
      return { refused: info.code === "ENOENT" ? "missing" : info.code === "EACCES" || info.code === "EPERM" ? "unreadable" : `fs-${info.code ?? "error"}` }
    }
    if (info.isSymbolicLink()) return { refused: "symlink" }
    if (info.isDirectory()) return { refused: "directory" }
    if (!info.isFile()) return { refused: "not-file" }
    const physical = await realpath(absolute).catch((error: NodeJS.ErrnoException) => error)
    if (physical instanceof Error || !FSUtil.contains(root, physical)) return { refused: "path-outside" }
    files.push(absolute)
  }
  return { files }
}

async function regularSql(root: string) {
  const found: string[] = []
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && entry.name.endsWith(".sql")) found.push(full)
    }
  }
  await walk(root)
  return found.sort()
}

/** The base revision's declared gates, each run confined in the head copy (plan R4); they yield checks, not items. */
const gates = Effect.fnUntraced(function* (pack: Pack, context: Context) {
  const version = context.input.base
  const refused = (reason: string) => only({ ...check(pack, "not-run", reason), version })
  if (!context.input.trusted) return refused("untrusted target: repository code does not run (D6)")
  const base = yield* context.base
  if ("failed" in base) return refused(base.failed)
  const declared = yield* ReviewPackRepo.gates(base.snapshot.root)
  if (declared.length === 0) return refused("no declared gates")
  const head = yield* context.head
  if ("failed" in head) return refused(head.failed)
  const root = head.snapshot.root
  const checks = yield* Effect.forEach(declared, (gate, index) => Effect.gen(function* () {
    const result = (status: Status, reason?: string, uri?: string): Check => ({
      id: gate.id, pack: pack.id, version, lane: pack.lane, status, ...(reason === undefined ? {} : { reason }),
      workspaceExecuted: true, ...(uri === undefined ? {} : { uri }),
    })
    if ("skip" in gate) return result("not-run", gate.skip)
    const env = ResearchProcess.environment()
    const program = ReviewPackRepo.program(gate.argv[0], env)
    if (!program) return result("not-run", `${gate.argv[0]} absent`)
    const ran = yield* confined({
      argv: [program.binary, ...gate.argv.slice(1)], cwd: root, write: [root],
      env: Object.fromEntries(Object.entries({ ...env, ...program.env }).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      timeoutMs: GATE_MS, maxBytes: GATE_BYTES, tailBytes: Probe.Limits.outputBytes,
    })
    if ("denied" in ran) return result("not-run", ran.denied)
    const text = `${ran.outcome.stdout.data.toString("utf8")}\n${ran.outcome.stderr.data.toString("utf8")}`
    const uri = yield* context.write(`raw/repo-${index}.log`, text)
    if (text.includes(ProbeRun.GUARD)) return result("not-run", ProbeRun.GUARD, uri)
    const unsettled = settle(ran.outcome)
    if (unsettled) return result(unsettled.status, unsettled.reason, uri)
    // 127 is a shell's "command not found": a tool the gate calls is not installed.
    if (ran.outcome.exitCode === 127) return result("not-run", `${gate.command}: a tool it calls is absent`, uri)
    if (ran.outcome.exitCode === 0) return result("pass", undefined, uri)
    return result("fail", `exit ${ran.outcome.exitCode}`, uri)
  }), { concurrency: 1 })
  return { checks, head: [], base: [] } satisfies Outcome
})

/** One host-owned argv under `ToolSafetySandbox.confine` through AppProcess/omni; never unconfined (plan R9). */
const confined = Effect.fnUntraced(function* (input: {
  readonly argv: ReadonlyArray<string>
  readonly cwd: string
  readonly write: ReadonlyArray<string>
  readonly env: Record<string, string>
  readonly timeoutMs: number
  readonly maxBytes: number
  readonly tailBytes?: number
}) {
  const launch = yield* ToolSafetySandbox.confine({
    command: input.argv[0], args: input.argv.slice(1), cwd: input.cwd, env: input.env, write: input.write,
  }).pipe(
    Effect.map((value) => ({ value })),
    Effect.catch((error) => Effect.succeed({ denied: `sandbox: ${error.reason}` })),
  )
  if ("denied" in launch) return launch
  const outcome = yield* ResearchProcess.run({
    command: launch.value.command, args: launch.value.args, cwd: input.cwd,
    env: Object.fromEntries(Object.entries(launch.value.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    timeoutMs: input.timeoutMs, maxBytes: input.maxBytes, maxRssBytes: Probe.Limits.rssBytes,
    ...(input.tailBytes === undefined ? {} : { tailBytes: input.tailBytes }),
  })
  return { outcome }
})

const copy = (input: Parameters<typeof ReviewScratch.create>[0]) =>
  ReviewScratch.create(input).pipe(
    Effect.map((snapshot): Copy => ({ snapshot })),
    Effect.catch((error) => Effect.succeed<Copy>({ failed: `scratch: ${error.reason}` })),
  )

/** A run that did not finish on its own: limits are `not-run`, a broken run is `acquisition-error`. */
function settle(outcome: ResearchProcess.Outcome) {
  if (outcome.timedOut) return { status: "not-run" as const, reason: "timeout" }
  if (outcome.memoryExceeded) return { status: "not-run" as const, reason: "memory cap" }
  if (outcome.overflow) return { status: "acquisition-error" as const, reason: "output cap" }
  if (outcome.failure !== undefined) return { status: "acquisition-error" as const, reason: outcome.failure }
  return undefined
}

/** The catalog rule for a native rule id, else the pack's `*` rule. Dropped rules never reach the pipeline. */
function rules(catalog: ReviewCatalog.Catalog): ReviewSarif.Lookup {
  return (pack, rule) => {
    const entry = catalog.rules.find((item) => item.pack === pack && item.rule === rule) ??
      catalog.rules.find((item) => item.pack === pack && item.rule === "*")
    const severity = entry ? (entry.severity["*"] ?? Object.values(entry.severity)[0]) : undefined
    if (!entry || !severity || entry.status === "dropped") return undefined
    return { class: entry.class, lens: entry.lens, severity, status: entry.status, triage: entry.triage }
  }
}

function check(pack: Pack, status: Status, reason?: string, uri?: string): Check {
  return {
    id: pack.id, pack: pack.id, version: pack.version, lane: pack.lane, status,
    ...(reason === undefined ? {} : { reason }),
    workspaceExecuted: pack.lane !== "no-build",
    ...(uri === undefined ? {} : { uri }),
  }
}

function only(entry: Check): Outcome {
  return { checks: [entry], head: [], base: [] }
}

function remember(key: string, value: { results: ReadonlyArray<ReviewSarif.Raw>; uri: string }) {
  baseCache.set(key, value)
  if (baseCache.size > CACHED) baseCache.delete(baseCache.keys().next().value!)
}

function firstLine(data: Buffer) {
  return data.toString("utf8").trim().split("\n")[0]?.slice(0, 240) || "no output"
}
