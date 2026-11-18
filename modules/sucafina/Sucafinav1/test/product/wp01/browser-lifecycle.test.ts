import { expect, test } from "bun:test"
import { finishWp01BrowserLifecycle } from "./browser-fixture.ts"

// This file is mandatory and last in the explicit Actions selection. The focused
// preview-browser selection supplies three real leases from a different file;
// its receipt checks that exact count. Other explicit selections may supply one
// or more leases. A separate module cache cannot satisfy this finalizer.
test("WP01 shares one Chromium across files, releases every lease, and proves final process exit", async () => {
  const evidence = await finishWp01BrowserLifecycle()
  expect(evidence.launches).toBe(1)
  expect(evidence.acquisitions).toBeGreaterThan(0)
  expect(evidence.releases).toBe(evidence.acquisitions)
  expect(evidence.activeLease).toBe(false)
  expect(evidence.contexts).toBe(0)
  expect(evidence.pid).toBeGreaterThan(0)
  expect(evidence.disconnected).toBe(true)
  expect(evidence.processExited).toBe(true)
}, 25_000)
