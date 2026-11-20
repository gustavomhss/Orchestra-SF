import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
for (const [name, directory] of [["sucafina", "../../modules/sucafina/"], ["cli", "./"]]) test(name + " package compiler", () => {
  console.info("SF_AUDIT_COMPILER_PRODUCT", "feeda92842bc4f26aec83901b5162543e9ca4bdd", name)
  const result = spawnSync("bun", ["run", "typecheck"], {
    cwd: new URL(directory, import.meta.url), encoding: "utf8", timeout: 900000, maxBuffer: 24 * 1024 * 1024,
  })
  process.stdout.write(result.stdout ?? "")
  process.stderr.write(result.stderr ?? "")
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0, name + " typecheck")
})
