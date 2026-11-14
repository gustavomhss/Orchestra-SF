import { readFileSync } from "node:fs"
import path from "node:path"
import { validateSelection } from "../../test-ci-request.ts"

// Runtime observations only: this does not approve product criteria, C/G7 or D/G8.
export function validatePlaywrightRuntime(request, runtime, listed) {
  if (request?.runner !== "playwright" || typeof request.directory !== "string")
    fail("a normalized Playwright request with directory is required")
  if (!Array.isArray(request.args) || !request.args.every((file) => typeof file === "string"))
    fail("the request must contain exact spec paths")
  const expected = request.args.map((file) => path.resolve(request.directory, file))
  const before = collect(listed, false)
  const after = collect(runtime, true)
  if (path.resolve(listed.config.rootDir) !== path.resolve(runtime.config.rootDir))
    fail("listed and runtime roots differ")
  validateSelection(expected, [...new Set(before.map((test) => test.file))])
  validateSelection(expected, [...new Set(after.map((test) => test.file))])
  const identities = new Set(before.map((test) => test.identity))
  if (identities.size !== before.length || new Set(after.map((test) => test.identity)).size !== after.length)
    fail("duplicate test identities")
  if (before.length !== after.length || after.some((test) => !identities.has(test.identity)))
    fail("runtime test identities differ from the listed selection")
  const executed = after.filter((test) => test.executed)
  // An individually skipped test is retained, but every requested file must execute.
  validateSelection(expected, [...new Set(executed.map((test) => test.file))])
  if (executed.length === 0) fail("zero tests executed")
  return {
    kind: "PLAYWRIGHT_RUNTIME_OBSERVATION",
    listed_tests: before.length,
    runtime_tests: after.length,
    executed_tests: executed.length,
    passed_tests: executed.length,
    skipped_tests: after.length - executed.length,
    selected_files: [...new Set(after.map((test) => path.relative(process.cwd(), test.file).replaceAll("\\", "/")))].sort(),
    identity_check: "exact IDs with location fallback when IDs are absent",
    product_acceptance: "NOT_EVALUATED",
  }
}

function collect(report, runtime) {
  if (!report || typeof report.config?.rootDir !== "string" || !path.isAbsolute(report.config.rootDir))
    fail("report must identify its absolute rootDir")
  if (!Array.isArray(report.suites) || !Array.isArray(report.errors) || report.errors.length !== 0)
    fail("report is malformed or contains errors")
  if (runtime && (report.stats?.unexpected > 0 || report.stats?.flaky > 0))
    fail("runtime report contains unexpected or flaky tests")
  const found = []
  function visit(suite, inheritedFile, titles) {
    const suiteFile = suite.file ?? inheritedFile
    const titlePath = [...titles, suite.title ?? ""]
    for (const spec of suite.specs ?? []) {
      if (typeof (spec.file ?? suiteFile) !== "string" || !Array.isArray(spec.tests))
        fail("spec has no file or test array")
      const file = path.resolve(report.config.rootDir, spec.file ?? suiteFile)
      for (const test of spec.tests) {
        const id = test.testId ?? test.id ?? spec.id
        const project = test.projectId ?? test.projectName ?? ""
        const identity = JSON.stringify(typeof id === "string" && id.length > 0
          ? [file, "id", id, project]
          : [file, "location", titlePath, spec.title, spec.line, spec.column, project])
        let executed = false
        if (runtime) {
          if (!["expected", "skipped"].includes(test.status) || !Array.isArray(test.results))
            fail(`incomplete or unsuccessful test: ${identity}`)
          if (test.results.length === 0) {
            if (test.status !== "skipped" && test.expectedStatus !== "skipped")
              fail(`test has no result: ${identity}`)
          } else {
            if (test.results.length !== 1) fail(`unexpected retry or duplicate result: ${identity}`)
            const result = test.results[0]
            if (!result || !["passed", "skipped"].includes(result.status) || result.error || result.errors?.length)
              fail(`failed, timed out, interrupted or erroneous result: ${identity}`)
            if (result.retry !== undefined && result.retry !== 0) fail(`unexpected retry: ${identity}`)
            executed = result.status === "passed"
            if (executed && test.status !== "expected") fail(`inconsistent passed status: ${identity}`)
          }
        }
        found.push({ file, identity, executed })
      }
    }
    for (const child of suite.suites ?? []) visit(child, suiteFile, titlePath)
  }
  for (const suite of report.suites) visit(suite, undefined, [])
  return found
}

function fail(message) {
  throw new Error(`FINAL_CI_RUNTIME: ${message}`)
}

// Usage from the repository root; request.json may be the runner's request receipt.
if (import.meta.main) {
  const files = process.argv.slice(2)
  if (files.length !== 3) fail("usage: node verify-runtime.mjs request.json listed.json runtime.json")
  const [request, listed, runtime] = files.map((file) => JSON.parse(readFileSync(file, "utf8")))
  process.stdout.write(JSON.stringify(validatePlaywrightRuntime(request.request ?? request, runtime, listed), null, 2) + "\n")
}
