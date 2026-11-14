// Explicit Bun file for the auxiliary Actions request. The .check.ts suffix keeps
// Playwright's broad discovery from importing a Bun test into its own runner.
import "../../../../../script/test-omni-control.ts"
import { expect, test } from "bun:test"
import { realpathSync, statSync } from "node:fs"
import path from "node:path"
import type { JSONReport, JSONReportSpec, JSONReportSuite } from "@playwright/test/reporter"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { ChildProcess, Effect } from "@orchestra/core/test/fixture/omni-effect"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { locateTestPackage } from "../../../../../script/test-ci-location.ts"
import { playwrightArgs, validateRequest, validateSelection } from "../../../../../script/test-ci-request.ts"

test("auxiliary: canonical Operations selection lists exactly five unexecuted production cases", async () => {
  expect(process.env.GITHUB_RUN_ID).toMatch(/^\d+$/)
  expect(process.env.GITHUB_SHA).toMatch(/^[a-f0-9]{40}$/)
  expect(process.env.ORCHESTRA_CHANNEL).toBe("prod")
  expect(process.env.ORCHESTRA_OMNI_CONTROL).toBe("declared")
  expect(process.env.ORCHESTRA_OMNI_CONTROL_RUN).toBe(String(process.pid))

  const root = realpathSync(path.resolve(import.meta.dirname, "../../../../.."))
  // This is the final nominal recipe, validated by the same functions as test-ci.
  // It is distinct from the outer Bun request that runs this one auxiliary case.
  const request = validateRequest({
    package: "app",
    packageSelector: "packages/app",
    directory: "packages/app-shell",
    runner: "playwright",
    args: ["e2e/sucafina/operations.spec.ts"],
    env: { ORCHESTRA_CHANNEL: "prod" },
    config: "e2e/playwright.production.config.ts",
  }, (file) => {
    const absolute = path.resolve(root, file)
    return (statSync(absolute, { throwIfNoEntry: false })?.isFile() ?? false) &&
      realpathSync(absolute).startsWith(root + path.sep)
  }, (selector) => locateTestPackage(root, selector))
  expect(request.directory).toBe("packages/app-shell")
  expect(request.runner).toBe("playwright")
  expect(request.args).toEqual(["e2e/sucafina/operations.spec.ts"])
  expect(request.config).toBe("e2e/playwright.production.config.ts")

  const cwd = path.resolve(root, request.directory!)
  // Match test-ci.yml's actual list command, including its exact anchored file
  // arguments. --list collects the real graph without starting app or host.
  const args = ["run", "test:e2e:local", ...playwrightArgs(request), "--trace", "retain-on-failure", "--list", "--reporter=json"]
  expectSpawn(import.meta.path)
  const listed = await Effect.runPromise(Effect.gen(function* () {
    const app = yield* AppProcess.Service
    return yield* app.run(ChildProcess.make(process.execPath, args, {
      cwd,
      env: { ...process.env, ...request.env },
    }))
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  if (listed.exitCode !== 0) {
    throw new Error("Operations auxiliary selection failed: " + listed.stderr.toString("utf8") + listed.stdout.toString("utf8"))
  }
  expect(listed.stdoutTruncated).toBe(false)
  expect(listed.stderrTruncated).toBe(false)

  const report = JSON.parse(listed.stdout.toString("utf8")) as JSONReport
  expect(report.errors).toEqual([])
  expect(report.config.configFile).toBe(path.resolve(cwd, request.config!))
  expect(report.config.rootDir).toBe(path.resolve(cwd, "e2e"))
  expect(report.config.metadata.bundle).toBe("production")
  expect(report.config.workers).toBe(1)
  expect(report.config.projects.map((project) => ({
    name: project.name,
    retries: project.retries,
    repeatEach: project.repeatEach,
  }))).toEqual([{ name: "chromium", retries: 0, repeatEach: 1 }])

  const selected = report.suites.filter(hasTests).map((suite) => path.resolve(report.config.rootDir, suite.file))
  validateSelection(request.args.map((file) => path.resolve(cwd, file)), selected)
  expect(report.suites).toHaveLength(1)
  expect(report.suites[0]!.suites?.map((suite) => suite.title)).toEqual(["CI-UI-OPERATIONS"])
  const specs = report.suites.flatMap(collectSpecs)
  expect(specs.map((spec) => spec.title)).toEqual([
    "OP-PROC-01 real comparison preserves the J04 values and exact C02 drilldown",
    "OP-PROC-02 pending sourcing keeps its submitted FX while the future PO changes",
    "OP-PROC-03 missing FX stays unavailable and refuses submission without a new version",
    "OP-IMPORT-01 real preview and one Apply recover the same receipt without duplicate effects",
    "OP-DOC-01 real schema and confirmation preserve exact evidence through source revocation",
  ])
  expect(new Set(specs.map((spec) => spec.id)).size).toBe(5)
  for (const spec of specs) {
    expect(path.resolve(report.config.rootDir, spec.file)).toBe(path.resolve(cwd, request.args[0]!))
    expect(spec.tests).toHaveLength(1)
    expect(spec.tests[0]!.projectName).toBe("chromium")
    expect(spec.tests[0]!.expectedStatus).toBe("passed")
    expect(spec.tests[0]!.results).toEqual([])
  }

  // Only the auxiliary case can pass here. Empty execution results explicitly
  // keep this list/validator proof separate from CI-UI-OPERATIONS acceptance.
  console.info("OPERATIONS_AUXILIARY_SELECTION " + JSON.stringify({
    kind: "AUXILIARY_LIST_AND_VALIDATE_SELECTION",
    selection: "CI-UI-OPERATIONS",
    snapshot: process.env.GITHUB_SHA,
    normalizedRequest: request,
    command: ["bun", ...args],
    configFile: path.relative(root, report.config.configFile!),
    bundle: report.config.metadata.bundle,
    selected: selected.map((file) => path.relative(root, file)),
    cases: specs.map((spec) => ({ id: spec.id, title: spec.title, project: spec.tests[0]!.projectName, executions: spec.tests[0]!.results.length })),
    journeyExecution: "NOT_RUN",
  }))
})

function hasTests(suite: JSONReportSuite): boolean {
  return suite.specs.some((spec) => spec.tests.length > 0) || (suite.suites ?? []).some(hasTests)
}

function collectSpecs(suite: JSONReportSuite): JSONReportSpec[] {
  return [...suite.specs, ...(suite.suites ?? []).flatMap(collectSpecs)]
}
