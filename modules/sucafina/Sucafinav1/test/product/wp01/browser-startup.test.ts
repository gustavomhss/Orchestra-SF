import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { startWp01BrowserPool } from "./browser-fixture.ts"

// First in the explicit Actions selection. This test owns the one AppProcess
// spawn; consumers only lease it, and browser-lifecycle.test.ts closes it last.
test("WP01 starts one Node-owned Chromium through Omni before leasing it across files", async () => {
  expectSpawn(import.meta.path)
  const evidence = await startWp01BrowserPool()
  expect(evidence.launches).toBe(1)
  expect(evidence.pid).toBeGreaterThan(0)
  expect(evidence.connected).toBe(true)
  expect(evidence.activeLease).toBe(false)
  expect(evidence.contexts).toBe(0)
}, 15_000)
