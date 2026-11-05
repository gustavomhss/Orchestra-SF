import { expect, test } from "bun:test"
import path from "path"
import { readFile } from "fs/promises"
import { Effect } from "effect"
import { ReviewPackAstGrep } from "../../src/review-toolkit/packs/ast-grep"
import { ReviewSarif } from "../../src/review-toolkit/sarif"
import { tmpdir } from "../fixture/tmpdir"

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

test("an unreadable ast-grep report is an acquisition error, never a pass", () => {
  expect(ReviewSarif.parseJson(ReviewPackAstGrep.parserId, "not json", { pack: "ast-grep" })).toEqual({
    status: "acquisition-error",
    reason: "malformed-json",
  })
  expect(ReviewSarif.parseJson(ReviewPackAstGrep.parserId, JSON.stringify({ matches: [] }), { pack: "ast-grep" })).toEqual({
    status: "acquisition-error",
    reason: "not-ast-grep-json",
  })
  expect(ReviewSarif.parseJson(ReviewPackAstGrep.parserId, "[]", { pack: "ast-grep" })).toEqual({
    status: "ok",
    results: [],
    excluded: [],
  })
  const emptyRule = ReviewSarif.parseJson(ReviewPackAstGrep.parserId, JSON.stringify([{
    ruleId: "",
    file: "a.js",
    range: { start: { line: 0 } },
  }]), { pack: "ast-grep" })
  expect(emptyRule).toEqual({ status: "ok", results: [], excluded: [{ reason: "no-rule", count: 1 }] })
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
