import { expect, test } from "bun:test"
import { finishWp01BrowserLifecycle, reportWp01BrowserLifecycle } from "./browser-fixture.ts"

// The startup file is first and this file is last in the explicit Actions selection.
// The pool must survive the startup test and every intermediate file. Only actual
// lease consumers increment the counts; a separate module cache cannot satisfy us.
test("WP01 shares one Chromium across files, releases every lease, and proves final process exit", async () => {
  const evidence = await finishWp01BrowserLifecycle()
  expect(evidence.launches).toBe(1)
  expect(evidence.acquisitions).toBeGreaterThan(0)
  expect(evidence.releases).toBe(evidence.acquisitions)
  expect(evidence.activeLease).toBe(false)
  expect(evidence.contexts).toBe(0)
  expect(evidence.pid).toBeGreaterThan(0)
  expect(evidence.disconnected).toBe(true)
  expect(evidence.driverClosed).toBe(true)
  expect(evidence.processExited).toBe(true)
  reportWp01BrowserLifecycle()
}, 25_000)
