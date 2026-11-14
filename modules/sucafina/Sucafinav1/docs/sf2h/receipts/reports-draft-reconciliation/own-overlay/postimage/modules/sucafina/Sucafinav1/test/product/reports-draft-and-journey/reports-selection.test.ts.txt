import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { playwrightArgs, validateRequest } from "../../../../../../script/test-ci-request.ts"
import { locateTestPackage } from "../../../../../../script/test-ci-location.ts"

// A collection regression of the existing Playwright interface, not a second
// runner for the journeys. --list starts no product fixture or web server.
// test-ci's JSON listing failure currently discards stdout; retain the actual
// diagnostic here while keeping its exit failure and exact four-case oracle.
test("the existing production Playwright interface collects all four Reports journeys", async () => {
  expectSpawn(import.meta.path)
  const directory = fileURLToPath(new URL("../../../../../../packages/app-shell/", import.meta.url))
  const repository = fileURLToPath(new URL("../../../../../../", import.meta.url))
  const request = validateRequest({
    package: "app", packageSelector: "packages/app", directory: "packages/app-shell",
    runner: "playwright", args: ["e2e/sucafina/reports.spec.ts"],
    config: "e2e/playwright.production.config.ts", env: { ORCHESTRA_CHANNEL: "prod" },
  }, (file) => Bun.file(repository + file).size > 0, (selector) => locateTestPackage(repository, selector))
  const command = ChildProcess.make("bun", [
    "run", "test:e2e:local", ...playwrightArgs(request), "--list", "--reporter=json",
  ], { cwd: directory, env: { ...process.env, ORCHESTRA_CHANNEL: "prod" }, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const launcher = yield* AppProcess.Service
    return yield* launcher.run(command, { maxOutputBytes: 256 * 1024, maxErrorBytes: 64 * 1024 })
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  expect(result.stdoutTruncated).toBe(false)
  expect(result.stderrTruncated).toBe(false)
  if (result.exitCode !== 0) {
    console.error("REPORTS_COLLECTION_STDOUT", result.stdout.toString("utf8"))
    console.error("REPORTS_COLLECTION_STDERR", result.stderr.toString("utf8"))
  }
  expect(result.exitCode).toBe(0)
  const report = JSON.parse(result.stdout.toString("utf8")) as { errors: unknown[]; suites: Suite[] }
  expect(report.errors).toEqual([])
  const titles = report.suites.flatMap(collect)
  expect(titles).toHaveLength(4)
  expect(titles.map((title) => title.match(/^RPT-0[1-4]/)?.[0]).sort()).toEqual(["RPT-01", "RPT-02", "RPT-03", "RPT-04"])
})

type Suite = { suites?: Suite[]; specs?: { title: string; tests: unknown[] }[] }
function collect(suite: Suite): string[] {
  return [...(suite.specs ?? []).filter((spec) => spec.tests.length > 0).map((spec) => spec.title), ...(suite.suites ?? []).flatMap(collect)]
}

