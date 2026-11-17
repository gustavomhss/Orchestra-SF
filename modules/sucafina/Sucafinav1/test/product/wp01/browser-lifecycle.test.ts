import { expect, test } from "bun:test"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

// Bun owns the file order of an admitted selection, so this file cannot be "last":
// it proves the whole lease boundary on the one Chromium it leases itself. Two
// isolated contexts stand in for two consumers, the release closes both and the
// driver, and only then does the published driver proof report a clean shutdown of
// Node, Chromium and the transport.
test("WP01 leases, releases every context and proves final process exit", async () => {
  const browser = await launchWp01Browser()
  const first = await browser.newContext()
  const second = await browser.newContext()
  await first.newPage()
  await second.newPage()
  expect(browser.contexts()).toHaveLength(2)

  const teardown = await closeWp01Browser(browser)
  expect(teardown.evidence).toMatchObject({ contexts: 0, acquisitions: 1, releases: 1,
    driverClosed: true, disconnected: true, processExited: true })
  expect(teardown.evidence.pid).toBeGreaterThan(0)
  expect(browser.isConnected()).toBe(false)
  expect(browser.contexts()).toHaveLength(0)
  teardown.report()
}, 25_000)
