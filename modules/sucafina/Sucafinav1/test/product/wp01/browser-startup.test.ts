import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { closeWp01Browser, startWp01BrowserPool } from "./browser-fixture.ts"

// Bun owns the file order of an admitted selection, so this file cannot be "first":
// it proves the launch boundary of the one Chromium it starts itself. This test owns
// its AppProcess spawn, every consumer leases its own browser, and browser-lifecycle
// proves the lease/release/exit boundary. One 30s acquisition deadline includes
// launch/connect/PID; keep 5s for owned cancellation observation. A stalled scope
// remains a failure, never a proof.
test("WP01 starts one Node-owned Chromium through Omni and proves its physical teardown", async () => {
  expectSpawn(import.meta.path)
  const start = await startWp01BrowserPool()
  expect(start.launch).toBeGreaterThan(0)
  expect(start.pid).toBeGreaterThan(0)
  expect(start.connected).toBe(true)
  expect(start.activeLease).toBe(false)
  expect(start.contexts).toBe(0)
  const teardown = await closeWp01Browser(start.browser)
  expect(teardown.evidence).toMatchObject({ pid: start.pid, contexts: 0, acquisitions: 0, releases: 1,
    driverClosed: true, disconnected: true, processExited: true })
}, 35_000)
