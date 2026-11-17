import type { Browser } from "@playwright/test"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"

// Bun runs the admitted selection concurrently and in an order it does not expose
// (a whole-tree CI selection is neither the argv order nor alphabetical), so a
// browser cannot be shared across files by position: a first/last pair of lifecycle
// files cannot be guaranteed to run first and last. Every lease therefore owns one
// Chromium from the published WP02 driver, and the release that ends the lease
// observes the real physical teardown before it returns. That keeps exactly the
// invariant the shared pool used to prove — one launch per lease, no replacement
// after a failure, no leftover context, the actual browser PID gone — in any file
// order and in parallel files. browser-startup.test.ts declares the Omni spawn of
// its own launch; browser-lifecycle.test.ts proves the whole lease/release boundary.
const startupTimeoutMs = 30_000

type Driver = Awaited<ReturnType<typeof launchBrowserDriver>>

type Lease = {
  driver: Driver
  browser: Browser
  pid: number
  launch: number
  acquisitions: number
  releases: number
  disconnected: boolean
  disconnection: Promise<void>
  unexpectedDisconnect?: Error
}

const leases = new Map<Browser, Lease>()
let launches = 0

export type Wp01BrowserEvidence = {
  launch: number
  pid: number
  acquisitions: number
  releases: number
  contexts: number
  driverClosed: boolean
  disconnected: boolean
  processExited: boolean
}

/** Last-resort reaper: a test that dies mid-lease must not orphan a real Chromium.
 * This is not a lifecycle proof; every completion below still observes the exit. */
process.on("exit", () => {
  for (const lease of leases.values()) {
    if (lease.pid <= 0) continue
    try { process.kill(lease.pid, "SIGTERM") } catch {}
  }
})

async function bounded<T>(operation: Promise<T>, stage: string, timeout = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("WP01 browser timed out: " + stage)), timeout)
    })])
  } finally { clearTimeout(timer) }
}

function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") return false
    throw error
  }
}

async function observeProcessExit(pid: number) {
  const deadline = performance.now() + 10_000
  while (processExists(pid)) {
    if (performance.now() >= deadline) throw new Error("WP01 browser process " + pid + " remains present after close")
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }
}

/** One Node-owned Chromium per lease, started through the published WP02 driver.
 * The acquisition deadline covers preparation, launch, connect and PID acquisition;
 * the Node process receives that same absolute deadline. */
async function startBrowser(): Promise<Lease> {
  // The physical teardown proof this harness publishes is a Linux observation.
  if (process.platform !== "linux")
    throw new Error("WP01 browser ownership proofs require the Linux lane")
  const deadline = performance.now() + startupTimeoutMs
  const deadlineEpochMs = Date.now() + startupTimeoutMs
  const remaining = () => {
    const value = Math.ceil(deadline - performance.now())
    if (value <= 0) throw new Error("WP01 browser acquisition deadline expired")
    return value
  }
  const startup = new AbortController()
  const timer = setTimeout(() => startup.abort(new Error("WP01 browser timed out: single Node-owned Chromium launch and PID acquisition")), startupTimeoutMs)
  let lease: Lease | undefined
  try {
    console.info("WP01 browser launch phase", { phase: "published Node browser driver through AppProcess", startupTimeoutMs })
    // The deadline cancels and awaits the driver's owned AppProcess scope.
    // Racing this await alone would abandon an in-flight driver outside the lease.
    const driver = await launchBrowserDriver("wp01-shared-pool", { signal: startup.signal, timeoutMs: remaining(), deadlineEpochMs })
    const browser = driver.browser
    const started: Lease = { driver, browser, pid: 0, launch: ++launches, acquisitions: 0, releases: 0,
      disconnected: false, disconnection: Promise.resolve() }
    lease = started
    started.disconnection = new Promise<void>((resolve) => {
      browser.once("disconnected", () => {
        started.disconnected = true
        if (leases.get(browser) === started) started.unexpectedDisconnect = new Error("WP01 browser disconnected before its release")
        console.info("WP01 browser disconnected", { pid: started.pid })
        resolve()
      })
    })
    if (!browser.isConnected() || browser.contexts().length !== 0)
      throw new Error("WP01 browser launch did not produce a connected, empty lease")
    if (startup.signal.aborted) throw new Error("WP01 browser launch completed after its acquisition deadline")
    console.info("WP01 browser launch phase", { phase: "read actual browser PID through CDP" })
    const session = await bounded(browser.newBrowserCDPSession(), "open browser CDP session", remaining())
    const failures: unknown[] = []
    try {
      const result = await bounded(session.send("SystemInfo.getProcessInfo"), "read browser process information", remaining())
      const processes = result.processInfo.filter((entry) => entry.type === "browser")
      const pid = processes[0]?.id
      if (processes.length !== 1 || typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid)
        throw new Error("CDP did not identify exactly one distinct browser process")
      started.pid = pid
      if (!processExists(pid)) throw new Error("The CDP browser PID is absent before cleanup")
    } catch (error) { failures.push(error) }
    try {
      await bounded(session.detach(), "detach browser PID session", remaining())
    }
    catch (error) { failures.push(error) }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "WP01 browser PID acquisition and CDP cleanup failed")
    if (startup.signal.aborted) throw new Error("WP01 browser PID acquisition completed after its deadline")
    leases.set(browser, started)
    console.info("WP01 browser launch complete", { pid: started.pid, launch: started.launch })
    return started
  } catch (error) {
    console.error("WP01 browser acquisition failure observed", { launches,
      reason: error instanceof Error ? error.message : String(error) })
    // A failed acquisition owns no reusable browser; never leave its scope open.
    if (lease && !leases.has(lease.browser)) {
      try { await closeBrowser(lease) }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "WP01 browser acquisition and cleanup failed") }
    }
    throw error
  } finally { clearTimeout(timer) }
}

/** Closes one owned lease completely: pages, contexts, the driver scope, the
 * disconnected event and the actual browser PID. Every failure is retained. */
async function closeBrowser(lease: Lease): Promise<{ evidence: Wp01BrowserEvidence; report: () => void }> {
  const { browser, driver } = lease
  const failures: unknown[] = []
  if (lease.unexpectedDisconnect) failures.push(lease.unexpectedDisconnect)
  const contexts = browser.contexts()
  console.info("WP01 browser release starting", { pid: lease.pid, contexts: contexts.length })
  try {
    const outcomes = await bounded(Promise.allSettled(contexts.flatMap((context) => context.pages().map((page) => page.close({ runBeforeUnload: false })))), "close lease pages", 5_000)
    for (const outcome of outcomes) if (outcome.status === "rejected") failures.push(outcome.reason)
  } catch (error) { failures.push(error) }
  try {
    const outcomes = await bounded(Promise.allSettled(contexts.map((context) => context.close())), "close lease contexts", 5_000)
    for (const outcome of outcomes) if (outcome.status === "rejected") failures.push(outcome.reason)
  } catch (error) { failures.push(error) }
  let driverClosed = false
  try {
    await bounded(Promise.all([driver.close(), lease.disconnection]), "driver close and disconnected event")
    driverClosed = true
  } catch (error) { failures.push(error) }
  try {
    if (lease.pid <= 0) throw new Error("WP01 browser PID was not obtained through CDP")
    await observeProcessExit(lease.pid)
  } catch (error) { failures.push(error) }
  if (browser.isConnected() || !lease.disconnected) failures.push(new Error("WP01 browser disconnected event was not confirmed"))
  lease.releases++
  const evidence: Wp01BrowserEvidence = { launch: lease.launch, pid: lease.pid, acquisitions: lease.acquisitions,
    releases: lease.releases, contexts: browser.contexts().length, driverClosed,
    disconnected: lease.disconnected, processExited: lease.pid > 0 && !processExists(lease.pid) }
  console.info("WP01 browser release observed", evidence)
  if (failures.length) throw new AggregateError(failures, "WP01 browser lease cleanup failed")
  return { evidence, report: () => driver.report() }
}

/** Starts the one Chromium this file owns and takes no lease. The caller releases
 * it with closeWp01Browser, whose evidence carries the physical teardown. */
export async function startWp01BrowserPool() {
  const lease = await startBrowser()
  return { browser: lease.browser, launch: lease.launch, pid: lease.pid, connected: lease.browser.isConnected(),
    activeLease: false, contexts: lease.browser.contexts().length }
}

/** A lease over its own Chromium. Two files (or two tests) may hold one at a time
 * in parallel; each release owns the teardown of the browser it leased. */
export async function launchWp01Browser(): Promise<Browser> {
  const lease = await startBrowser()
  lease.acquisitions++
  console.info("WP01 browser lease acquired", { pid: lease.pid, lease: lease.launch })
  return lease.browser
}

/** Releases every page and context of this lease, then closes its driver and
 * observes the actual browser process exit. At most 5s + 5s + 10s + 10s. */
export async function closeWp01Browser(browser: Browser): Promise<{ evidence: Wp01BrowserEvidence; report: () => void }> {
  const lease = leases.get(browser)
  if (!lease) throw new Error("WP01 browser release does not own a leased browser")
  // One release per lease: a second close is a contract violation, not a no-op.
  leases.delete(browser)
  return closeBrowser(lease)
}
