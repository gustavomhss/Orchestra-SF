import type { Browser, BrowserServer } from "@playwright/test"

type BrowserOwner = {
  server: BrowserServer
  child: ReturnType<BrowserServer["process"]>
  browser?: Browser
  exit: Promise<void>
  exited: boolean
  serverClosed: boolean
  closing?: Promise<void>
}

const owners = new WeakMap<Browser, BrowserOwner>()
const retainedChildren = new Set<ReturnType<BrowserServer["process"]>>()
// Bun 1.3.14 can finalize an old extra-stdio handle after its fd has been reused
// by the next Chromium (oven-sh/bun#47956, #47561). Keep every ChildProcess,
// including terminated children, reachable until the BUN RUNNER exits.
// This listener roots the Set without replacing spawn or any global API.
process.once("exit", () => retainedChildren.clear())

async function bounded<T>(operation: Promise<T>, stage: string, timeout = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`WP01 browser timed out: ${stage}`)), timeout)
    })])
  } finally { clearTimeout(timer) }
}

function ownServer(server: BrowserServer): BrowserOwner {
  const child = server.process()
  retainedChildren.add(child)
  let observedExit = () => {}
  const exit = new Promise<void>((resolve) => { observedExit = resolve })
  const owner: BrowserOwner = { server, child, exit, exited: child.exitCode !== null || child.signalCode !== null, serverClosed: false }
  if (owner.exited) observedExit()
  else child.once("exit", () => { owner.exited = true; observedExit() })
  server.once("close", () => { owner.serverClosed = true })
  return owner
}

function state(owner: BrowserOwner) {
  return { pid: owner.child.pid, exitCode: owner.child.exitCode, signal: owner.child.signalCode,
    exitObserved: owner.exited, serverCloseObserved: owner.serverClosed, connected: owner.browser?.isConnected() ?? false }
}

function confirmClosed(owner: BrowserOwner) {
  if (!owner.exited || owner.child.exitCode === null && owner.child.signalCode === null)
    throw new Error("WP01 browser child termination was not confirmed")
  if (owner.browser?.isConnected()) throw new Error("WP01 browser client remains connected after process termination")
}

function closeOwner(owner: BrowserOwner): Promise<void> {
  if (owner.closing) return owner.closing
  owner.closing = (async () => {
    console.info("WP01 browser cleanup starting", state(owner))
    try {
      await bounded(Promise.all([owner.browser?.close(), owner.server.close(), owner.exit]), "graceful close and observed exit")
      confirmClosed(owner)
      console.info("WP01 browser cleanup complete", { mode: "graceful", ...state(owner) })
    } catch (gracefulError) {
      const cause = gracefulError instanceof Error ? { name: gracefulError.name, message: gracefulError.message.replace(/(?:https?|wss?):\/\/\S+/g, "[redacted URL]") } : { name: "Error", message: "Non-Error cleanup failure" }
      console.warn("WP01 browser graceful cleanup failed; terminating the exclusive test instance", { cause, ...state(owner) })
      try {
        // Playwright 1.59.1 BrowserServer.kill kills the process group on Linux
        // and waits for process cleanup. Independently require the child exit.
        await bounded(Promise.all([owner.browser?.close(), owner.server.kill(), owner.exit]), "forced close and observed exit")
        confirmClosed(owner)
        console.info("WP01 browser cleanup complete", { mode: "forced", ...state(owner) })
      } catch (forcedError) {
        throw new AggregateError([gracefulError, forcedError], "WP01 browser process cleanup failed")
      }
    }
  })()
  return owner.closing
}

/** Startup has one 10s deadline. A failed startup may need a further 20s to
 * prove cleanup; beforeAll callers allow 35s. No test/assertion retry occurs. */
export async function launchWp01Browser(): Promise<Browser> {
  const deadline = performance.now() + 10_000
  const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()))
  let expired = false
  let owner: BrowserOwner | undefined
  try {
    return await bounded((async () => {
      const { chromium } = await import("@playwright/test")
      if (expired) throw new Error("Browser driver loaded after the startup deadline")
      const server = await chromium.launchServer({ channel: "chrome", headless: true, args: ["--no-sandbox"], host: "127.0.0.1", timeout: remaining() })
      owner = ownServer(server)
      if (expired) { await closeOwner(owner); throw new Error("Browser server completed after the startup deadline") }
      const browser = await chromium.connect(server.wsEndpoint(), { timeout: remaining() })
      owner.browser = browser
      owners.set(browser, owner)
      if (expired) {
        await bounded(browser.close(), "disconnect late browser client")
        await closeOwner(owner)
        throw new Error("Browser client completed after the startup deadline")
      }
      return browser
    })(), "launch server and connect", 10_000)
  } catch (error) {
    expired = true
    if (owner) {
      try { await closeOwner(owner) }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "WP01 browser startup and cleanup failed") }
    }
    throw error
  }
}

/** At most 10s graceful + 10s forced cleanup. Callers must not wrap this in a
 * shorter deadline; afterAll allows 25s. Product/assertion failures remain errors. */
export async function closeWp01Browser(browser: Browser): Promise<void> {
  const owner = owners.get(browser)
  if (!owner) throw new Error("Browser is not owned by the WP01 fixture")
  await closeOwner(owner)
}
