import { describe, expect, test } from "bun:test"
import { ResearchProcess } from "../../src/research-toolkit/process"
import { ReviewActionlintReport } from "../../src/review-toolkit/packs/actionlint-report"
import { ReviewActionlintResult } from "../../src/review-toolkit/packs/actionlint-result"

const root = "/review/project"
const paths = [{ file: ".github/workflows/input-0.yaml", path: ".github/workflows/original.yaml" }] as const
const options = { root, paths }
const row = { message: "bad expression", filepath: "/review/project/.github/workflows/input-0.yaml", line: 4, column: 2, kind: "expression", snippet: "${{ nope }}", end_column: 9 }
const captured = (data: Buffer, truncated = false) => ({ data, bytes: data.length, truncated })
const outcome = (stdout: Buffer, exitCode: number | null = 1): ResearchProcess.Outcome => ({
  exitCode, durationMs: 0, timedOut: false, overflow: false, memoryExceeded: false,
  stdout: captured(stdout), stderr: captured(Buffer.alloc(0)),
})
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))

describe("actionlint native report policy", () => {
  test("maps known diagnostics through projected paths without inventing endLine", () => {
    const parsed = ReviewActionlintReport.parseReport(JSON.stringify([row]), options)
    expect(parsed).toMatchObject({ status: "ok", results: [{ pack: "actionlint", rule: "expression", path: ".github/workflows/original.yaml", line: 4, message: row.message, snippet: row.snippet, suppressions: [] }] })
    if (parsed.status === "ok") expect(parsed.results[0].endLine).toBeUndefined()
    expect(ReviewActionlintReport.parseReport("[]", options)).toMatchObject({ status: "ok", results: [] })
  })

  test("rejects malformed, mixed, unknown, syntax and unsafe rows as a whole", () => {
    for (const [report, reason] of [
      ["{", "malformed-json"], ["{}", "not-actionlint-json"], ["[null]", "not-actionlint-json"],
      [JSON.stringify([row, { ...row, filepath: "/outside/x.yaml" }]), "path-outside"],
      [JSON.stringify([{ ...row, filepath: "/review/project/.github/workflows/unmapped.yaml" }]), "path-unmapped"],
      [JSON.stringify([{ ...row, kind: "shellcheck" }]), "unknown-rule"],
      [JSON.stringify([{ ...row, kind: "syntax-check" }]), "syntax-error"],
      [JSON.stringify([{ ...row, message: "" }]), "message-invalid"],
      [JSON.stringify([{ ...row, filepath: "" }]), "file-missing"],
      [JSON.stringify([{ ...row, line: 0 }]), "line-invalid"],
      [JSON.stringify([{ ...row, line: 1.5 }]), "line-invalid"],
      [JSON.stringify([{ ...row, column: 0 }]), "column-invalid"],
      [JSON.stringify([{ ...row, column: Number.MAX_SAFE_INTEGER + 1 }]), "column-invalid"],
      [JSON.stringify([{ ...row, snippet: 2 }]), "snippet-invalid"],
      [JSON.stringify([{ ...row, filepath: "/review/project/../outside" }]), "path-outside"],
    ] as const) expect(ReviewActionlintReport.parseReport(report, options)).toMatchObject({ status: "acquisition-error", reason })
  })

  test("validates nonempty bijective safe path map even for clean reports", () => {
    for (const invalid of [[], [{ file: paths[0].file, path: paths[0].path }, { file: paths[0].file, path: "other" }], [{ file: paths[0].file, path: paths[0].path }, { file: "other", path: paths[0].path }], [{ file: "/absolute/input.yaml", path: "x" }], [{ file: "input.yaml", path: "/absolute/source.yaml" }], [{ file: "../input.yaml", path: "x" }], [{ file: "input.yaml", path: "../source.yaml" }], [{ file: "input\0.yaml", path: "x" }], [{ file: "input.yaml", path: "source\0.yaml" }]])
      expect(ReviewActionlintReport.parseReport("[]", { root, paths: invalid })).toMatchObject({ status: "acquisition-error" })
    expect(ReviewActionlintReport.parseReport("[]", { root: "relative", paths })).toMatchObject({ status: "acquisition-error" })
  })

  test("settles strict process outcomes and exit agreement", () => {
    expect(ReviewActionlintResult.settle(outcome(bytes([]), 0), options)).toMatchObject({ status: "ok", results: [] })
    expect(ReviewActionlintResult.settle(outcome(bytes([row]), 1), options)).toMatchObject({ status: "ok", results: [{ path: paths[0].path }] })
    for (const bad of [outcome(Buffer.from([0xff])), outcome(Buffer.alloc(0)), outcome(bytes([]), 1), outcome(bytes([row]), 0), outcome(bytes([row]), 2), { ...outcome(bytes([row])), exitCode: null }, { ...outcome(bytes([row])), stdout: captured(bytes([row]), true) }, { ...outcome(bytes([row])), overflow: true }, { ...outcome(bytes([row])), stderr: captured(Buffer.from([0xff])) }, { ...outcome(bytes([row])), stderr: captured(Buffer.from("bad")) }, { ...outcome(bytes([row])), stderr: captured(Buffer.from("bad"), true) }, { ...outcome(bytes([row])), failure: new Error("spawn") }])
      expect(ReviewActionlintResult.settle(bad, options).status).toBe("acquisition-error")
    expect(ReviewActionlintResult.settle({ ...outcome(bytes([row])), timedOut: true }, options)).toMatchObject({ status: "not-run", reason: "timeout" })
    expect(ReviewActionlintResult.settle({ ...outcome(bytes([row])), memoryExceeded: true }, options)).toMatchObject({ status: "not-run", reason: "memory-exceeded" })
  })
})
