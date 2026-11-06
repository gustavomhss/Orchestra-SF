import { expect, test } from "bun:test"
import type { ResearchProcess } from "../../src/research-toolkit/process"
import { ReviewOxlintResult } from "../../src/review-toolkit/packs/oxlint-result"
import { ReviewZizmorResult } from "../../src/review-toolkit/packs/zizmor-result"

const options = { root: "/native", paths: [{ file: "a.js", path: "src/a.js" }], rules: ["eslint(no-debugger)"] }
const report = (pack = "oxlint", version = "1.91.0") => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: pack, version } }, results: [{ ruleId: "eslint(no-debugger)", level: "error", message: { text: "framing stays valid" }, locations: [{ physicalLocation: { artifactLocation: { uri: "a.js" }, region: { startLine: 1 } } }] }] }] })
const outcome = (data: Uint8Array, exitCode: number, stderr: string | Uint8Array = ""): ResearchProcess.Outcome => ({
  exitCode, durationMs: 1, timedOut: false, memoryExceeded: false, overflow: false,
  stdout: { data: Buffer.from(data), bytes: data.byteLength, truncated: false },
  stderr: { data: Buffer.from(stderr), bytes: typeof stderr === "string" ? Buffer.byteLength(stderr) : stderr.byteLength, truncated: false },
})

test("native settlements reject invalid UTF-8 within valid JSON framing", () => {
  const text = report()
  const messageByte = Buffer.from(text).indexOf(Buffer.from("framing stays valid")) + 2
  const corrupted = Buffer.from(text)
  corrupted[messageByte] = 0xff
  expect(ReviewOxlintResult.settle(outcome(corrupted, 1), options)).toEqual({ status: "acquisition-error", reason: "not-utf8" })
  const stderr = Buffer.from(" INFO native fixture\n")
  stderr[stderr.indexOf(Buffer.from("fixture")) + 1] = 0xff
  expect(ReviewZizmorResult.settle(outcome(Buffer.from(report("zizmor", "1.32.0")), 0, stderr))).toEqual({ status: "acquisition-error", reason: "not-utf8" })
  expect(ReviewOxlintResult.settle(outcome(Buffer.from(text), 1), options).status).toBe("ok") // parser-dependent positive control
  expect(ReviewZizmorResult.settle(outcome(Buffer.from(report("zizmor", "1.32.0")), 0, " INFO native fixture\n"), options).status).toBe("ok") // parser-dependent positive control
})

test("caller identity extras cannot override pinned native identity", () => {
  const caller = { ...options, pack: "driver-report", version: "9.9.9" }
  expect(ReviewOxlintResult.settle(outcome(Buffer.from(report()), 1), caller).status).toBe("ok") // pinned positive control; parser dependency remains red under scaffold
  expect(ReviewOxlintResult.settle(outcome(Buffer.from(report("driver-report", "9.9.9")), 1), caller).status).toBe("acquisition-error")
})
