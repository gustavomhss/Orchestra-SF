import type { Browser } from "@playwright/test"
import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"

// One Node-owned Chromium for the entire sequential Bun selection. The published
// WP02 driver owns the extra-stdio descriptors and connects through its Unix pipe.
// Startup is a named test so Omni attributes that real spawn to its own body.
// Never launch a replacement: each consumer receives an exclusive lease with
// fresh contexts. browser-startup.test.ts is first; browser-lifecycle.test.ts last.
const pool: {
  browser?: Browser
  driver?: Awaited<ReturnType<typeof launchBrowserDriver>>
  pid?: number
  lease?: number
  launches: number
  acquisitions: number
  releases: number
  releasing: boolean
  sealed: boolean
  closing: boolean
  starting: boolean
  disconnected: boolean
  disconnection?: Promise<void>
  driverClosed: boolean
  processExited: boolean
  verified: boolean
  failed: boolean
  failure?: unknown
  shutdown?: Promise<void>
} = { launches: 0, acquisitions: 0, releases: 0, releasing: false, sealed: false,
  closing: false, starting: false, disconnected: false, driverClosed: false,
  processExited: false, verified: false, failed: false }

async function bounded<T>(operation: Promise<T>, stage: string, timeout = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("WP01 browser timed out: " + stage)), timeout)
    })])
  } finally { clearTimeout(timer) }
}

function poison(error: unknown) {
  if (!pool.failed) { pool.failed = true; pool.failure = error }
}

async function requireLifecycleSelection() {
  // Autodiscovery and selection/order-changing flags cannot guarantee cleanup.
  // The integrator names every file, startup first and finalizer last; this guard
  // runs before the driver is started or Chromium is created.
  // Bun test exposes only the current entry and passthrough in process.argv.
  // This Linux lane reads its actual OS command line, never a stale request file.
  const invalid = () => new Error("WP01 browser tests require the Linux lane with explicit test files, browser-startup.test.ts first and browser-lifecycle.test.ts last. Use the named Actions selection; only --timeout is supported. Other platforms, autodiscovery, filters, isolation, sharding and parallel/reordered execution need an integrator-owned lifecycle.")
  if (process.platform !== "linux") throw invalid()
  const command = (await bounded(Bun.file("/proc/self/cmdline").text(), "read actual Linux test selection", 5_000)).split("\0")
  if (command.at(-1) === "") command.pop()
  const executable = command[0]
  if (!executable || executable !== "bun" && resolve(executable) !== resolve(process.execPath) || command[1] !== "test") throw invalid()
  const args = command.slice(2)
  const files: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === undefined) throw invalid()
    if (arg === "--timeout") {
      if (!/^[1-9]\d*$/.test(args[++index] ?? "")) throw invalid()
      continue
    }
    if (/^--timeout=[1-9]\d*$/.test(arg)) continue
    if (arg.startsWith("-") || !arg.endsWith(".test.ts") || /[*?\[\]{}]/.test(arg)) throw invalid()
    files.push(resolve(arg))
  }
  const startup = resolve(import.meta.dir, "browser-startup.test.ts")
  const finalizer = resolve(import.meta.dir, "browser-lifecycle.test.ts")
  if (files.length < 3 || files[0] !== startup || files.at(-1) !== finalizer || new Set(files).size !== files.length) throw invalid()
  const entries = await bounded(Promise.allSettled(files.map((file) => stat(file))), "verify named test files", 5_000)
  if (entries.some((entry) => entry.status !== "fulfilled" || !entry.value.isFile())) throw invalid()
  console.info("WP01 browser explicit selection admitted", { executable, command: command[1], files, startup, finalizer })
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
  pool.processExited = true
}

function shutdownBrowser(): Promise<void> {
  if (pool.shutdown) return pool.shutdown
  const browser = pool.browser
  const driver = pool.driver
  if (!browser || !driver) return Promise.reject(new Error("WP01 browser driver was never acquired in this shared module"))
  pool.closing = true
  pool.shutdown = (async () => {
    const failures: unknown[] = []
    console.info("WP01 browser final close starting", { pid: pool.pid, connected: browser.isConnected() })
    try {
      await bounded(Promise.all([driver.close(), pool.disconnection]), "final driver close and disconnected event")
      pool.driverClosed = true
    } catch (error) { failures.push(error) }
    try {
      if (pool.pid === undefined) throw new Error("WP01 browser PID was not obtained through CDP")
      await observeProcessExit(pool.pid)
    } catch (error) { failures.push(error) }
    if (!pool.disconnected || browser.isConnected()) failures.push(new Error("WP01 browser disconnected event was not confirmed"))
    console.info("WP01 browser final close observed", { pid: pool.pid, disconnected: pool.disconnected,
      connected: browser.isConnected(), driverClosed: pool.driverClosed, processExited: pool.processExited })
    if (failures.length) throw new AggregateError(failures, "WP01 browser final process cleanup failed")
  })()
  return pool.shutdown
}

async function startBrowser(): Promise<Browser> {
  const deadline = performance.now() + 10_000
  const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()))
  const startup = new AbortController()
  const timer = setTimeout(() => startup.abort(new Error("WP01 browser timed out: single Node-owned Chromium launch and PID acquisition")), 10_000)
  try {
    await requireLifecycleSelection()
    if (startup.signal.aborted) throw startup.signal.reason
    if (pool.failed || pool.sealed) throw new Error("WP01 browser startup is no longer admitted")
    console.info("WP01 browser launch phase", { phase: "published Node browser driver through AppProcess" })
    // The deadline cancels and awaits the driver's owned AppProcess scope.
    // Racing this await alone would abandon an in-flight driver outside pool.
    const driver = await launchBrowserDriver("wp01-shared-pool", { signal: startup.signal, timeoutMs: remaining() })
    const browser = driver.browser
    pool.driver = driver
    pool.browser = browser
    pool.launches++
    pool.disconnection = new Promise<void>((resolve) => {
      browser.once("disconnected", () => {
        pool.disconnected = true
        if (!pool.closing) poison(new Error("WP01 shared browser disconnected before its finalizer"))
        console.info("WP01 browser disconnected", { pid: pool.pid, expected: pool.closing })
        resolve()
      })
    })
    if (pool.failed || pool.sealed || startup.signal.aborted) {
      await shutdownBrowser()
      throw new Error("WP01 browser launch completed after its acquisition deadline")
    }
    console.info("WP01 browser launch phase", { phase: "read actual browser PID through CDP" })
    const session = await bounded(browser.newBrowserCDPSession(), "open browser CDP session", remaining())
    const failures: unknown[] = []
    try {
      const result = await bounded(session.send("SystemInfo.getProcessInfo"), "read browser process information", remaining())
      const processes = result.processInfo.filter((entry) => entry.type === "browser")
      const pid = processes[0]?.id
      if (processes.length !== 1 || typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid)
        throw new Error("CDP did not identify exactly one distinct browser process")
      pool.pid = pid
      if (!processExists(pid)) throw new Error("The CDP browser PID is absent before cleanup")
    } catch (error) { failures.push(error) }
    try { await bounded(session.detach(), "detach browser PID session", remaining()) }
    catch (error) { failures.push(error) }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "WP01 browser PID acquisition and CDP cleanup failed")
    if (pool.failed || pool.sealed || startup.signal.aborted) {
      await shutdownBrowser()
      throw new Error("WP01 browser PID acquisition completed after its deadline")
    }
    console.info("WP01 browser launch complete", { pid: pool.pid, launches: pool.launches })
    return browser
  } catch (error) {
    poison(error)
    console.error("WP01 browser acquisition failure observed", { pid: pool.pid, launches: pool.launches,
      reason: error instanceof Error ? error.message : String(error) })
    if (pool.browser) {
      try { await shutdownBrowser() }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "WP01 browser acquisition and cleanup failed") }
    }
    throw error
  } finally { clearTimeout(timer) }
}

/** The first named test owns the only Omni spawn. The driver keeps its published
 * AppProcess scope open until final close; a completed startup test does not close it. */
export async function startWp01BrowserPool() {
  if (pool.sealed || pool.failed || pool.starting || pool.browser || pool.launches !== 0)
    throw new Error("WP01 browser startup must run exactly once before every lease")
  pool.starting = true
  try {
    const browser = await startBrowser()
    if (!browser.isConnected() || browser.contexts().length !== 0 || pool.lease !== undefined)
      throw new Error("WP01 browser startup did not produce a connected, empty pool")
    return { launches: pool.launches, pid: pool.pid, connected: browser.isConnected(),
      activeLease: pool.lease !== undefined, contexts: browser.contexts().length }
  } catch (error) { poison(error); throw error }
  finally { pool.starting = false }
}

/** A lease is reserved before any await. No concurrent caller or replacement
 * Chromium is admitted. Existing consumers keep isolated contexts per case. */
export async function launchWp01Browser(): Promise<Browser> {
  if (pool.sealed) throw new Error("WP01 browser selection has already been finalized")
  if (pool.failed) throw new Error("WP01 browser pool is unavailable after an earlier failure", { cause: pool.failure })
  if (pool.lease !== undefined) {
    const error = new Error("Concurrent WP01 browser leases are not allowed")
    poison(error)
    throw error
  }
  const lease = pool.acquisitions + 1
  pool.lease = lease
  try {
    const browser = pool.browser
    if (!browser || pool.starting) throw new Error("WP01 browser-startup.test.ts must complete before any browser lease")
    if (pool.failed || !browser.isConnected() || browser.contexts().length !== 0)
      throw new Error("WP01 browser cannot admit a lease without a connected, empty context set")
    pool.acquisitions++
    console.info("WP01 browser lease acquired", { pid: pool.pid, lease, acquisitions: pool.acquisitions })
    return browser
  } catch (error) {
    poison(error)
    pool.lease = undefined
    throw error
  }
}

/** Release closes pages and contexts, never Chromium. A failed release poisons
 * the pool so no later file can inherit uncertain state. At most 5s + 5s. */
export async function closeWp01Browser(browser: Browser): Promise<void> {
  if (browser !== pool.browser || pool.lease === undefined || pool.releasing || pool.sealed) {
    const error = new Error("WP01 browser release does not own an active exclusive lease")
    poison(error)
    throw error
  }
  pool.releasing = true
  const failures: unknown[] = []
  const contexts = browser.contexts()
  try {
    try {
      const outcomes = await bounded(Promise.allSettled(contexts.flatMap((context) => context.pages().map((page) => page.close({ runBeforeUnload: false })))), "close lease pages", 5_000)
      for (const outcome of outcomes) if (outcome.status === "rejected") failures.push(outcome.reason)
    } catch (error) { failures.push(error) }
    try {
      const outcomes = await bounded(Promise.allSettled(contexts.map((context) => context.close())), "close lease contexts", 5_000)
      for (const outcome of outcomes) if (outcome.status === "rejected") failures.push(outcome.reason)
    } catch (error) { failures.push(error) }
    if (!browser.isConnected()) failures.push(new Error("WP01 browser disconnected during lease release"))
    if (browser.contexts().length !== 0) failures.push(new Error("WP01 browser contexts remain after lease release"))
    if (failures.length) throw new AggregateError(failures, "WP01 browser lease cleanup failed")
    pool.releases++
    console.info("WP01 browser lease released", { pid: pool.pid, lease: pool.lease, releases: pool.releases, contexts: 0 })
    pool.lease = undefined
  } catch (error) { poison(error); throw error }
  finally { pool.releasing = false }
}

/** Must run in the final selected test file. Seal first, attempt physical cleanup
 * even on contract violations, and retain every original failure. */
export async function finishWp01BrowserLifecycle() {
  if (pool.sealed) throw new Error("WP01 browser lifecycle was already finalized")
  pool.sealed = true
  const failures: unknown[] = []
  const activeLease = pool.lease !== undefined
  const contexts = pool.browser?.contexts().length ?? 0
  if (pool.failed) failures.push(pool.failure)
  if (pool.launches !== 1) failures.push(new Error("WP01 selection did not share exactly one Chromium launch"))
  if (activeLease || pool.releasing) failures.push(new Error("WP01 browser lease remains active at finalization"))
  if (contexts !== 0) failures.push(new Error("WP01 browser contexts remain at finalization"))
  if (pool.acquisitions === 0 || pool.acquisitions !== pool.releases) failures.push(new Error("WP01 browser acquisition/release counts do not match"))
  try { await shutdownBrowser() } catch (error) { failures.push(error) }
  const evidence = { launches: pool.launches, acquisitions: pool.acquisitions, releases: pool.releases,
    pid: pool.pid, activeLease, contexts, disconnected: pool.disconnected, driverClosed: pool.driverClosed,
    processExited: pool.processExited }
  console.info("WP01 browser lifecycle final evidence", evidence)
  if (failures.length) throw new AggregateError(failures, "WP01 browser lifecycle verification failed")
  pool.verified = true
  return evidence
}

/** Emit the published driver proof only after the finalizer's assertions pass. */
export function reportWp01BrowserLifecycle() {
  if (!pool.verified || !pool.driverClosed || !pool.driver) throw new Error("WP01 browser proof requires successful finalization")
  pool.driver.report()
}
