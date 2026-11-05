import { expect, test } from "bun:test"
import path from "path"
import { readFile } from "fs/promises"
import { Effect } from "effect"
import { ReviewPackAstGrep } from "../../src/review-toolkit/packs/ast-grep"
import { ReviewSarif } from "../../src/review-toolkit/sarif"
import { tmpdir } from "../fixture/tmpdir"

const parse = (text: string) => ReviewSarif.parseJson(ReviewPackAstGrep.parserId, text, { pack: "ast-grep", root: "/repo" })

function good(extra: Record<string, unknown> = {}) {
  return {
    ruleId: ReviewPackAstGrep.rules[0].id,
    file: "src/a.js",
    message: "direct eval",
    text: "eval(input)",
    range: { start: { line: 1, column: 0 }, end: { line: 1, column: 11 } },
    ...extra,
  }
}

test("normalizes ast-grep JSON to one-based rule, path and message", () => {
  const text = JSON.stringify([{
    text: "eval(input)",
    range: {
      byteOffset: { start: 14, end: 25 },
      start: { line: 1, column: 0 },
      end: { line: 1, column: 11 },
    },
    file: "/repo/src/match.js",
    lines: "eval(input)",
    charCount: { leading: 0, trailing: 0 },
    language: "JavaScript",
    ruleId: "lucy-js-eval",
    severity: "info",
    note: null,
    message: "direct eval",
  }])
  const parsed = ReviewSarif.parseJson(ReviewPackAstGrep.parserId, text, { pack: "ast-grep", root: "/repo" })
  expect(parsed).toEqual({
    status: "ok",
    results: [{
      pack: "ast-grep",
      rule: "lucy-js-eval",
      path: "src/match.js",
      line: 2,
      endLine: 2,
      snippet: "eval(input)",
      message: "direct eval",
      suppressions: [],
    }],
    excluded: [],
  })
})

test("an empty ast-grep array is a clean report; one invalid row fails the whole report", () => {
  expect(parse("not json")).toEqual({ status: "acquisition-error", reason: "malformed-json" })
  expect(parse(JSON.stringify({ matches: [] }))).toEqual({ status: "acquisition-error", reason: "not-ast-grep-json" })
  expect(parse("[]")).toEqual({ status: "ok", results: [], excluded: [] })
  expect(parse(JSON.stringify([{ ruleId: "", file: "a.js", range: { start: { line: 0 } } }]))).toEqual({
    status: "acquisition-error",
    reason: "empty-rule",
  })
  expect(parse(JSON.stringify([good({ ruleId: "" })]))).toEqual({ status: "acquisition-error", reason: "empty-rule" })
  expect(parse(JSON.stringify([good({ file: "" })]))).toEqual({ status: "acquisition-error", reason: "file-missing" })
  expect(parse(JSON.stringify([good({ range: { start: { line: 0 } } })]))).toEqual({
    status: "acquisition-error",
    reason: "range-invalid",
  })
  expect(parse(JSON.stringify([good({ range: { start: { line: 4 }, end: { line: 1 } } })]))).toEqual({
    status: "acquisition-error",
    reason: "range-invalid",
  })
  expect(parse(JSON.stringify([good({ range: { start: { line: 1.5 }, end: { line: 2 } } })]))).toEqual({
    status: "acquisition-error",
    reason: "range-invalid",
  })
  expect(parse(JSON.stringify([good(), { ruleId: "", file: "src/a.js", range: { start: { line: 0 }, end: { line: 0 } } }]))).toEqual({
    status: "acquisition-error",
    reason: "empty-rule",
  })
  expect(parse(JSON.stringify([good({ ruleId: "hostile-const" })]))).toEqual({
    status: "acquisition-error",
    reason: "unknown-rule:hostile-const",
  })
  for (const rule of ReviewPackAstGrep.rules) {
    const parsed = parse(JSON.stringify([good({ ruleId: rule.id })]))
    expect(parsed.status).toBe("ok")
    if (parsed.status === "ok") expect(parsed.results.map((result) => result.rule)).toEqual([rule.id])
  }
})

test("an ast-grep path must resolve inside the scanned root", () => {
  const relative = parse(JSON.stringify([good({ file: "src/a.js" })]))
  const inside = parse(JSON.stringify([good({ file: "/repo/src/a.js" })]))
  expect(relative).toEqual(inside)
  if (inside.status === "ok") expect(inside.results[0]?.path).toBe("src/a.js")
  expect(parse(JSON.stringify([good({ file: "/other/a.js" })]))).toEqual({ status: "acquisition-error", reason: "path-outside" })
  expect(parse(JSON.stringify([good({ file: "../etc/passwd" })]))).toEqual({ status: "acquisition-error", reason: "path-outside" })
  expect(parse(JSON.stringify([good({ file: "/repo/../etc/passwd" })]))).toEqual({ status: "acquisition-error", reason: "path-outside" })
  expect(parse(JSON.stringify([good({ file: "/repo-evil/a.js" })]))).toEqual({ status: "acquisition-error", reason: "path-outside" })
})

test("the host template scans with host rules and does not rewrite", () => {
  const argv = ReviewPackAstGrep.templates[ReviewPackAstGrep.templateId]({
    executable: "/host/ast-grep",
    root: "/scratch/snapshot",
    report: "/scratch/reports/ast-grep.json",
  })
  expect(argv[0]).toBe("/host/ast-grep")
  expect(argv[1]).toBe("scan")
  expect(argv.at(-1)).toBe("/scratch/snapshot")
  expect(argv).toContain("--json=compact")
  expect(argv).toContain("--config")
  expect(argv).toContain("--rule")
  expect(argv).toContain("--no-ignore")
  expect(argv).not.toContain("--update-all")
  expect(argv).not.toContain("-U")
  expect(argv).not.toContain("--interactive")
  expect(argv).not.toContain("run")
  const config = argv[argv.indexOf("--config") + 1]
  const rule = argv[argv.indexOf("--rule") + 1]
  expect(config).toBe("/scratch/reports/sgconfig.yml")
  expect(rule).toBe("/scratch/reports/lucy-rules.yml")
  expect(config.includes("/scratch/snapshot")).toBe(false)
})

test("host rules are the frozen eval patterns and carry no rewrite", async () => {
  const made = await tmpdir()
  try {
    await Effect.runPromise(ReviewPackAstGrep.prepare(made.path))
    const rules = await readFile(path.join(made.path, ReviewPackAstGrep.rulesName), "utf8")
    expect(rules).toContain("id: lucy-js-eval")
    expect(rules).toContain("language: JavaScript")
    expect(rules).toContain("id: lucy-ts-eval")
    expect(rules).toContain("language: TypeScript")
    expect(rules).toContain(`pattern: '${ReviewPackAstGrep.pattern}'`)
    expect(rules).toContain("severity: info")
    expect(rules).not.toContain("fix:")
    expect(rules).not.toContain("Tsx")
    expect(await readFile(path.join(made.path, ReviewPackAstGrep.configName), "utf8")).toBe("ruleDirs: []\n")
  } finally {
    await made[Symbol.asyncDispose]()
  }
})
