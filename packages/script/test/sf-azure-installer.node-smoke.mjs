import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Azure Entra installer preserves a temporary VM layout offline", () => {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.platform, "linux");
  assert.equal(process.arch, "x64");

  // Real root-owned files and permissions, with all installer paths redirected by the fixture.
  const suite = fileURLToPath(new URL("../../../sf/azure/vm/test_install_factory_distribution.py", import.meta.url));
  const result = spawnSync("sudo", ["-n", "/usr/bin/python3", "-B", suite], {
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
