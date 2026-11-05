import { expect, test } from "bun:test"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { Effect } from "effect"
import { ReviewPackSquawk } from "../../src/review-toolkit/packs/squawk"
import { ReviewSquawkReport } from "../../src/review-toolkit/packs/squawk-report"
import type { Outcome } from "../../src/research-toolkit/process"
import { Probe } from "../../src/research-toolkit/probe/types"
import pinned from "../../src/backend-toolkit/packs/squawk"
import { tmpdir } from "../fixture/tmpdir"

// Unit fixtures only. No squawk binary was run; these do not claim host conformance.

const root = "/repo"
const parse = (text: string, scanned = root) => ReviewSquawkReport.parseReport(text, { root: scanned })

function row(extra: Record<string, unknown> = {}) {
  return {
    file: "/repo/a.sql", line: 1, column: 2, line_end: 1, column_end: 8,
    level: "Warning", message: "needs a lock timeout", help: null, rule_name: "require-lock-timeout",
    ...extra,
  }
}

function reported(file: string, scanned: string) {
  const parsed = parse(JSON.stringify([row({ file })]), scanned)
  return parsed.status === "ok" ? parsed.results[0]?.path : parsed.reason
}

function outcome(patch: Partial<Outcome> = {}, stdout = "[]\n", stderr = ""): Outcome {
  return {
    exitCode: 0, durationMs: 1, timedOut: false, overflow: false, memoryExceeded: false,
    stdout: { data: Buffer.from(stdout), bytes: Buffer.byteLength(stdout), truncated: false },
    stderr: { data: Buffer.from(stderr), bytes: Buffer.byteLength(stderr), truncated: false },
    ...patch,
  }
}

const invoke = (files: readonly string[], extra: { config?: string; root?: string; executable?: string } = {}) =>
  ReviewPackSquawk.argv({
    executable: extra.executable ?? "/opt/My Tools/squawk",
    config: extra.config ?? "/host/my squawk?.toml",
    root: extra.root ?? root,
    files,
  })

test("a known Warning becomes a one-based inclusive squawk raw result", () => {
  expect(parse(JSON.stringify([row()]))).toEqual({
    status: "ok",
    excluded: [],
    results: [{
      pack: "squawk", rule: "require-lock-timeout", path: "a.sql", line: 2, endLine: 2,
      message: "needs a lock timeout", suppressions: [],
    }],
  })
  const wrapped = parse(JSON.stringify([row({ line: 4, column: 3, line_end: 5, column_end: 0 })]))
  if (wrapped.status === "ok") expect(wrapped.results[0]).toMatchObject({ line: 5, endLine: 5 })
  expect(parse(JSON.stringify([row({ line: 1, column: 4, line_end: 3, column_end: 2 })]))).toMatchObject({
    status: "ok", results: [{ line: 2, endLine: 4 }],
  })
  expect(parse(JSON.stringify([row({ line_end: 0, column_end: 0 })]))).toEqual({ status: "acquisition-error", reason: "range-invalid" })
})

test("the closed native inventory is the 45 display ids, not an alias or a class map", () => {
  expect(ReviewSquawkReport.RULES).toHaveLength(45)
  expect(ReviewPackSquawk.RULES).toBe(ReviewSquawkReport.RULES)
  expect([...ReviewSquawkReport.RULES]).not.toContain("prefer-timestamptz")
  expect([...ReviewSquawkReport.RULES]).not.toContain("syntax-error")
  expect(ReviewPackSquawk.manifest.version).toBe("2.67.0")
  expect(ReviewPackSquawk.manifest.license).toBe("Apache-2.0")
  expect(ReviewPackSquawk.manifest.targets).toBe(pinned.targets)
  expect(ReviewPackSquawk.manifest.fit).toEqual({ role: "check", input: "The reviewed tree in lucy's scratch copy", skills: [] })
  expect(ReviewPackSquawk.pgVersion).toBe("unspecified")
  expect(ReviewPackSquawk.upstreamVersionDefault).toBe("15.0.0")
  expect(ReviewPackSquawk.includes).toBe("additive")
  for (const rule of ReviewSquawkReport.RULES) expect(parse(JSON.stringify([row({ rule_name: rule })])).status).toBe("ok")
})

test("one invalid row fails the whole mixed report", () => {
  expect(parse(JSON.stringify([row(), row({ rule_name: "not-a-rule" })]))).toEqual({ status: "acquisition-error", reason: "unknown-rule" })
  expect(parse(JSON.stringify([row(), { rule_name: "syntax-error", level: "Error" }]))).toEqual({ status: "acquisition-error", reason: "syntax-error" })
  expect(parse("not json")).toEqual({ status: "acquisition-error", reason: "malformed-json" })
  expect(parse("{}")).toEqual({ status: "acquisition-error", reason: "not-squawk-json" })
  expect(parse(JSON.stringify([row({ level: "Error" })]))).toEqual({ status: "acquisition-error", reason: "level-invalid" })
})

test("syntax-error and an unknown id are acquisition errors; an empty array is not itself a pass", () => {
  expect(parse(JSON.stringify([row({ rule_name: "syntax-error", level: "Error" })]))).toEqual({ status: "acquisition-error", reason: "syntax-error" })
  expect(parse(JSON.stringify([row({ rule_name: "prefer-timestamptz" })]))).toEqual({ status: "acquisition-error", reason: "unknown-rule" })
  expect(parse("[]")).toEqual({ status: "ok", results: [], excluded: [] })
})

test("containment follows the root path flavor and keeps a posix backslash", () => {
  expect(reported("/repo/src\\a.sql", "/repo")).toBe("src\\a.sql")
  expect(reported("/repo/src\\..\\a.sql", "/repo")).toBe("src\\..\\a.sql")
  expect(reported("C:/repo/src\\a.sql", "C:/repo")).toBe("src/a.sql")
  expect(reported("C:\\repo\\src\\..\\a.sql", "C:/repo")).toBe("path-outside")
  expect(reported("/other/a.sql", "/repo")).toBe("path-outside")
  expect(reported("/repo-evil/a.sql", "/repo")).toBe("path-outside")
  expect(reported("/a.sql", "/")).toBe("a.sql")
  expect(reported("C:foo.sql", "C:/repo")).toBe("path-outside")
  expect(reported("\\\\server\\share\\repo\\a.sql", "\\\\server\\share\\repo")).toBe("a.sql")
  expect(reported("\\\\other\\share\\a.sql", "\\\\server\\share\\repo")).toBe("path-outside")
})

test("exit 0 plus [] is clean; exit 1 alone is never a finding", () => {
  expect(ReviewPackSquawk.settle(outcome(), root)).toEqual({ status: "ok", results: [], excluded: [] })
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 1 }), root)).toEqual({ status: "acquisition-error", reason: "exit-mismatch" })
  const warning = `${JSON.stringify([row()])}\n`
  const reported = ReviewPackSquawk.settle(outcome({ exitCode: 1 }, warning), root)
  expect(reported.status).toBe("ok")
  if (reported.status === "ok") expect(reported.results.map((item) => item.rule)).toEqual(["require-lock-timeout"])
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 0 }, warning), root)).toEqual({ status: "acquisition-error", reason: "exit-mismatch" })
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 1 }, "[]\n", "Configuration error: failed to parse config\n"), root)).toEqual({
    status: "acquisition-error", reason: "configuration-error",
  })
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 1 }, warning, "Failed to find files: boom\n"), root)).toEqual({
    status: "acquisition-error", reason: "configuration-error",
  })
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 1 }, JSON.stringify([row({ rule_name: "syntax-error", level: "Error" })])), root)).toEqual({
    status: "acquisition-error", reason: "syntax-error",
  })
  expect(ReviewPackSquawk.settle(outcome({ timedOut: true, exitCode: null }), root)).toEqual({ status: "not-run", reason: "timeout" })
  expect(ReviewPackSquawk.settle(outcome({ failure: "spawn" }), root)).toEqual({ status: "not-run", reason: "spawn-failure" })
  expect(ReviewPackSquawk.settle(outcome({ exitCode: 2 }, warning), root)).toEqual({ status: "acquisition-error", reason: "exit-2" })
  expect(ReviewPackSquawk.settle(outcome({ overflow: true }), root)).toEqual({ status: "acquisition-error", reason: "truncated" })
  expect(ReviewPackSquawk.settle(outcome({}, ""), root)).toEqual({ status: "acquisition-error", reason: "missing-report" })
})

test("prepare writes the host toml outside the tree and does not claim a postgres version", async () => {
  await using made = await tmpdir()
  const config = await Effect.runPromise(ReviewPackSquawk.prepare(path.join(made.path, "host")))
  expect(config.startsWith(made.path)).toBe(true)
  expect(await readFile(config, "utf8")).toBe(ReviewPackSquawk.hostToml)
  expect(ReviewPackSquawk.hostToml).toBe("assume_in_transaction = false\nincluded_rules = []\nexcluded_rules = []\n")
  expect(ReviewPackSquawk.hostToml).not.toContain("pg_version")
})

test("argv is a literal escaped file list, never a directory, shell quote, or install", () => {
  expect(invoke(["/repo/my file.sql", "/repo/a?b*c[d]e.sql", "/repo/**.sql", "/repo/src\\a.sql"])).toEqual({
    status: "ok",
    argv: [
      "/opt/My Tools/squawk", "--config", "/host/my squawk?.toml", "--reporter", "json", "--",
      "/repo/my file.sql", "/repo/a[?]b[*]c[[]d[]]e.sql", "/repo/[*][*].sql", "/repo/src\\a.sql",
    ],
  })
  expect(invoke([])).toEqual({ status: "not-run", reason: "no-input" })
  expect(invoke(["/other/a.sql"])).toEqual({ status: "not-run", reason: "path-outside" })
  expect(invoke(["/repo/a.sql"], { config: "/repo/squawk.toml" })).toEqual({ status: "not-run", reason: "config-inside" })
  expect(invoke(["/repo/a.txt"])).toEqual({ status: "not-run", reason: "not-sql" })
  expect(invoke(["/repo/a.sql/"])).toEqual({ status: "not-run", reason: "directory" })
  expect(invoke(["/repo/a\0.sql"])).toEqual({ status: "not-run", reason: "nul" })
  expect(invoke(["\\\\?\\C:\\repo\\a.sql"], { root: "\\\\?\\C:\\repo", config: "\\\\?\\C:\\host\\squawk.toml" })).toEqual({
    status: "unsupported", reason: "glob-literal-unverified",
  })
  expect(invoke([`/repo/${"a".repeat(Probe.Limits.outputBytes)}.sql`])).toEqual({ status: "not-run", reason: "argv-bound" })
  const built = invoke(["/repo/a.sql"])
  if (built.status === "ok") {
    expect(built.argv).not.toContain("--no-config")
    expect(built.argv.join("\0")).not.toContain("\"")
  }
})

test("locate observes status and does not install", async () => {
  const source = await readFile(new URL("../../src/review-toolkit/packs/squawk.ts", import.meta.url), "utf8")
  expect(source).toContain("BackendToolkit.status")
  expect(source).not.toMatch(/BackendToolkit\.(ensure|prefetch|prepare)/)
})
