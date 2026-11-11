export * as ReviewOsv from "./osv"

import path from "path"
import { readdir } from "fs/promises"
import { Effect } from "effect"
import { BackendToolkit } from "../backend-toolkit"
import { Global } from "../global"
import pinned from "../backend-toolkit/packs/osv-scanner"
import { Probe } from "../research-toolkit/probe/types"
import { ResearchProcess } from "../research-toolkit/process"
import { ReviewTypeAware } from "./type-aware"
import { osv } from "../review/catalog/osv"
import type { ReviewAnalyze } from "./analyze"

// Design §7.3 and D7. The closed review argv is the documented offline scan at tag v2.7.1:
// `osv-scanner scan source -r <copy> --offline`. `fix` is never passed. The review does not download
// the database. v2.7.1's download command is a host refresh outside the review, not this argv.

export const DATABASE_ABSENT = "not run: osv advisory database absent"
const TEMPLATE = "osv-offline"
const TIMEOUT_MS = 10 * 60_000
const OUTPUT_BYTES = 16 * 1024 * 1024
const NAMES = new Set((osv.pack.detection.paths ?? []).map((pattern) => path.posix.basename(pattern)))

type Confine = ReviewAnalyze.Confine

/** Closed argv. No `fix`, no download flag. */
export function argv(bin: string, root: string) {
  return [bin, "scan", "source", "-r", root, "--offline"]
}

export function lockfiles(changed: readonly string[]) {
  return changed.filter(lockfile).sort()
}

export function databaseDir() {
  return path.join(Global.Path.cache, "osv-scanner")
}

export const databaseReady = Effect.fn("ReviewOsv.databaseReady")(function* (dir: string) {
  const names = yield* Effect.promise(() => readdir(path.join(dir, "osv-scalibr")).catch(() => [] as string[]))
  const hits = yield* Effect.promise(() => Promise.all(names.filter(ecosystem).map((name) =>
    Bun.file(path.join(dir, "osv-scalibr", name, "all.zip")).exists(),
  )))
  return hits.some(Boolean)
})

export const run = Effect.fn("ReviewOsv.run")(function* (
  pack: ReviewAnalyze.Pack,
  context: ReviewAnalyze.RunContext,
  confine: Confine,
) {
  if (pack.template !== TEMPLATE) return finished(pack, "not-run", false, "not-built")
  if (pack.status === "dropped") return finished(pack, "not-run", false, "dropped")
  if (lockfiles(Object.keys(context.input.changed)).length === 0) return finished(pack, "not-run", false, "target-missing: lockfile")
  const dir = databaseDir()
  if (!(yield* databaseReady(dir))) return finished(pack, "not-run", false, DATABASE_ABSENT)
  const located = yield* locate()
  if (!located.ok) return finished(pack, "not-run", false, located.reason)
  const head = yield* context.head
  if ("failed" in head) return finished(pack, "not-run", false, head.failed)
  const command = argv(located.executable, head.snapshot.root)
  const ran = yield* confine({
    argv: command,
    cwd: head.snapshot.root,
    write: [],
    env: { ...ResearchProcess.environment(), OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY: dir },
    timeoutMs: TIMEOUT_MS,
    maxBytes: OUTPUT_BYTES,
    tailBytes: Probe.Limits.outputBytes,
  })
  if ("denied" in ran) return finished(pack, "not-run", false, ran.denied)
  const stdout = ran.outcome.stdout.data.toString("utf8")
  const stderr = ran.outcome.stderr.data.toString("utf8")
  const text = [`$ ${command.join(" ")}`, "stdout:", stdout, "stderr:", stderr].join("\n")
  const uri = yield* context.write("raw/osv-scanner.log", text)
  const unsettled = settle(ran.outcome)
  if (unsettled) return finished(pack, unsettled.status, true, unsettled.reason, uri)
  if (ran.outcome.exitCode === 0) return finished(pack, "pass", true, undefined, uri)
  if (ran.outcome.exitCode === 1) return finished(pack, "fail", true, "findings", uri)
  if (ran.outcome.exitCode === 128) return finished(pack, "not-run", true, "no packages found", uri)
  return finished(pack, "acquisition-error", true, `exit ${ran.outcome.exitCode}`, uri)
})

function lockfile(file: string) {
  return !file.split("/").includes("..") && !file.includes("\0") && NAMES.has(path.posix.basename(file))
}

function ecosystem(name: string) {
  return name !== "." && name !== ".." && !name.includes("/") && !name.includes("\0")
}

const locate = Effect.fnUntraced(function* () {
  if (process.platform !== "linux" || process.arch !== "x64") return { ok: false as const, reason: ReviewTypeAware.UNQUALIFIED }
  const target = yield* BackendToolkit.Target
  if ("target" in target && target.target !== "linux-x64") return { ok: false as const, reason: ReviewTypeAware.UNQUALIFIED }
  const ready = yield* BackendToolkit.ensure<string>(pinned.id).pipe(
    Effect.provideService(BackendToolkit.Manifest, { [pinned.id]: pinned }),
    Effect.map((installed) => installed.executable),
    Effect.catch((error) => Effect.succeed(error)),
  )
  if (typeof ready !== "string") return { ok: false as const, reason: `${pinned.id} absent: ${cause(ready)}` }
  return { ok: true as const, executable: ready }
})

function cause(error: unknown) {
  if (error && typeof error === "object" && "reason" in error && typeof error.reason === "string") return error.reason
  return "fetch-failed"
}

function settle(outcome: ResearchProcess.Outcome) {
  if (outcome.timedOut) return { status: "not-run" as const, reason: "timeout" }
  if (outcome.memoryExceeded) return { status: "not-run" as const, reason: "memory cap" }
  if (outcome.overflow) return { status: "acquisition-error" as const, reason: "output cap" }
  if (outcome.failure !== undefined) return { status: "acquisition-error" as const, reason: outcome.failure }
  return undefined
}

function finished(
  pack: ReviewAnalyze.Pack,
  status: ReviewAnalyze.Status,
  workspaceExecuted: boolean,
  reason?: string,
  uri?: string,
): ReviewAnalyze.Outcome {
  return {
    checks: [{
      id: pack.id,
      pack: pack.id,
      version: pack.version,
      lane: pack.lane,
      status,
      ...(reason === undefined ? {} : { reason }),
      workspaceExecuted,
      ...(uri === undefined ? {} : { uri }),
    }],
    head: [],
    base: [],
  }
}
