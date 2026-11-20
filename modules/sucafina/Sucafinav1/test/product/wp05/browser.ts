import type { Page } from "@playwright/test"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"

/** Keep browser waits and the owned Node/Chrome transport inside the test lifetime. */
export async function inspectWp05Browser(label: string, inspect: (page: Page, phase: (name: string) => void) => Promise<void>) {
  const startedAt = Date.now()
  console.info("WP05 browser phase", { label, phase: "fixture-setup", elapsedMs: 0 })
  // This harness mounts a pure renderer on about:blank. Its canonical Planner
  // ports run in the caller; no installation, session or legacy console is used.
  // Node owns Chrome's DevTools descriptors through the existing bounded
  // driver. Repeated renderer probes must not recycle those pipes through Bun.
  const fixture = await launchBrowserDriver("wp05-renderer").then(async (driver) => {
    try {
      const page = await driver.browser.newPage({ viewport: { width: 1440, height: 1000 } })
      return { browser: driver.browser, page, dispose: driver.close, report: driver.report }
    } catch (error) {
      try { await driver.close() }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], `WP05 browser ${label} setup and cleanup failed`) }
      throw error
    }
  }).catch((error: unknown) => {
    console.error("WP05 browser fixture setup failed", { label, phase: "fixture-setup", elapsedMs: Date.now() - startedAt }, error)
    throw error
  })
  const deadline = {
    milliseconds: 60000,
    phase: "navigate",
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    error: undefined as Error | undefined,
  }
  const phase = (name: string) => {
    if (deadline.error) throw deadline.error
    deadline.phase = name
    console.info("WP05 browser phase", { label, phase: name, elapsedMs: Date.now() - startedAt, connected: fixture.browser.isConnected(), pageClosed: fixture.page.isClosed() })
  }
  fixture.page.on("close", () => console.info("WP05 browser page closed", { label, phase: deadline.phase, elapsedMs: Date.now() - startedAt }))
  fixture.browser.on("disconnected", () => console.info("WP05 browser disconnected", { label, phase: deadline.phase, elapsedMs: Date.now() - startedAt }))
  const outcome = { failed: false, error: undefined as unknown }
  try {
    const expired = new Promise<never>((_, reject) => {
      deadline.timer = setTimeout(() => {
        deadline.error = new Error(`WP05 browser ${label} exceeded ${deadline.milliseconds}ms during ${deadline.phase}`)
        reject(deadline.error)
      }, deadline.milliseconds)
    })
    const body = async () => {
      // The renderer receives one blank page; all source/authority checks stay in the caller.
      const page = fixture.page
      phase("navigate")
      if (page.isClosed() || !fixture.browser.isConnected()) throw new Error(`WP05 browser ${label} returned a closed fixture before navigation`)
      page.setDefaultTimeout(10000)
      page.setDefaultNavigationTimeout(10000)
      await page.goto("about:blank")
      phase("inspect")
      await inspect(page, phase)
    }
    // The race retains rejection handlers if closing the browser rejects a pending operation.
    await Promise.race([body(), expired])
    console.info("WP05 browser assertions completed", { label, phase: deadline.phase })
  } catch (error) {
    outcome.failed = true
    outcome.error = error
    console.error("WP05 browser body failed", { label, phase: deadline.phase }, error)
  } finally {
    if (deadline.timer) clearTimeout(deadline.timer)
    deadline.phase = outcome.failed ? "cleanup-after-failure" : "cleanup"
    try {
      await fixture.dispose()
    } catch (cleanupError) {
      if (outcome.failed) throw new AggregateError([outcome.error, cleanupError], `WP05 browser ${label} failed in its body and cleanup`)
      throw cleanupError
    }
  }
  if (outcome.failed) throw outcome.error
  fixture.report()
}
