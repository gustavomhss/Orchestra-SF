import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { omniControlScope } from "../../../script/test-ci-request.ts"

const root = path.resolve(import.meta.dirname, "../../..")
const source = "90861699b40d7093adbba70a69ac866eb517090f"
const testPath = "modules/sucafina/Sucafinav1/test/po-export-residual.test.ts"
const harnessPath = "packages/core/test/po-export.node-smoke.mjs"
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
const runner = git("rev-parse", "HEAD")
git("fetch", "--no-tags", "--depth=2", "origin", source, runner)
assert.equal(git("rev-parse", "HEAD^"), source)
assert.deepEqual(git("diff", "--name-only", source, runner).split("\n").sort(), [".ci-run.json", harnessPath, testPath].sort())
assert.ok(git("diff", "--name-only", source, runner).split("\n").every((file) => file === ".ci-run.json" || file === harnessPath || file === testPath))
const request = JSON.parse(readFileSync(path.join(root, ".ci-run.json"), "utf8"))
assert.equal(request.runner, "node")
console.log("PO_DIAGNOSTIC_SOURCE", source, "RUNNER", runner, "PRODUCT_UNCHANGED")
test("real PO original producer and egress on unchanged dev", () => {
  const result = spawnSync("bun", ["test", "./" + testPath, "--timeout", "120000"], {
    cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GITHUB_ACTIONS: "false", ORCHESTRA_OMNI_CONTROL: omniControlScope({ runner: "bun", args: [testPath] }) },
  })
  process.stdout.write(result.stdout ?? "")
  process.stderr.write(result.stderr ?? "")
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0)
})
