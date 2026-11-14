import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect, Fiber, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import playwrightPackage from "@playwright/test/package.json" with { type: "json" }
import { object } from "../../../runtime/contract.ts"

// Bun 1.3.14 can finalize recycled extra stdio descriptors used by Chromium's
// DevTools pipes (oven-sh/bun#47956 and #47561). Node owns those descriptors;
// the Bun test talks to the same installed Playwright over a loopback WebSocket.
const nodeDriver = `
import { readFile } from "node:fs/promises"
if (process.versions.bun || process.release.name !== "node") throw new Error("The browser driver requires Node")
const { chromium } = await import(process.argv[1])
const version = JSON.parse(await readFile(new URL(process.argv[2]), "utf8")).version
const stopped = new Promise((resolve) => process.stdin.once("end", resolve))
process.stdin.resume()
const server = await chromium.launchServer({ host: "127.0.0.1", channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15000 })
const child = server.process()
console.log(JSON.stringify({ event: "ready", runtime: process.release.name, nodeVersion: process.versions.node,
  playwrightVersion: version, pid: process.pid, browserPid: child.pid, browserStdioCount: child.stdio.length,
  browserUsesPipe: child.spawnargs.includes("--remote-debugging-pipe"), endpoint: server.wsEndpoint() }))
await stopped
await server.close()
console.log(JSON.stringify({ event: "closed", browserExitCode: child.exitCode, browserSignal: child.signalCode }))
if (child.exitCode !== 0 || child.signalCode !== null) throw new Error("Chromium did not close normally")
`

type Ready = { nodeVersion: string; playwrightVersion: string; pid: number; browserPid: number; browserStdioCount: number; browserUsesPipe: boolean; endpoint: string }

async function within<T>(work: Promise<T>, timeout: number, name: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} exceeded ${timeout} ms`)), timeout) })]) }
  finally { if (timer !== undefined) clearTimeout(timer) }
}

/** Each caller declares expectSpawn in its own test and reports only after assertions and cleanup succeed. */
export async function launchBrowserDriver(consumer: "host-contextual-controls" | "host-draft-conflict" | "host-write-authority" | "dashboard-monthly" | "personal-views" | "preview-in-flight") {
  const node = Bun.which("node")
  if (!node) throw new Error("Node is unavailable for the Playwright browser driver")
  const { chromium } = await import("@playwright/test")
  const started = performance.now(), ready = Promise.withResolvers<Ready>(), stop = Promise.withResolvers<void>()
  const abort = new AbortController()
  const observed: { pid?: number; ready?: Ready; closed?: { browserExitCode: number; browserSignal: null }; proof?: object } = {}
  const receive = (line: string) => {
    try {
      if (!line || line.length > 8192) throw new Error("Invalid browser driver message")
      const value = object(JSON.parse(line))
      if (value.event === "ready") {
        if (observed.ready || value.runtime !== "node" || typeof value.nodeVersion !== "string" || !/^\d+\.\d+\.\d+/.test(value.nodeVersion) || value.playwrightVersion !== playwrightPackage.version || typeof value.pid !== "number" || value.pid !== observed.pid || value.pid === process.pid || typeof value.browserPid !== "number" || !Number.isSafeInteger(value.browserPid) || value.browserPid <= 0 || value.browserStdioCount !== 5 || value.browserUsesPipe !== true || typeof value.endpoint !== "string") throw new Error("Browser driver runtime or pipe ownership mismatch")
        const endpoint = new URL(value.endpoint)
        if (endpoint.protocol !== "ws:" || endpoint.hostname !== "127.0.0.1" || !endpoint.port) throw new Error("Browser driver endpoint is not loopback")
        observed.ready = { nodeVersion: value.nodeVersion, playwrightVersion: value.playwrightVersion, pid: value.pid, browserPid: value.browserPid,
          browserStdioCount: value.browserStdioCount, browserUsesPipe: value.browserUsesPipe, endpoint: value.endpoint }
        ready.resolve(observed.ready)
        return
      }
      if (value.event !== "closed" || observed.closed || value.browserExitCode !== 0 || value.browserSignal !== null) throw new Error("Browser driver shutdown was not clean")
      observed.closed = { browserExitCode: value.browserExitCode, browserSignal: value.browserSignal }
    } catch (error) { ready.reject(error); throw error }
  }
  const finished = Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const child = yield* process.spawn(ChildProcess.make(node, ["--input-type=module", "-e", nodeDriver, import.meta.resolve("@playwright/test"), import.meta.resolve("@playwright/test/package.json")], {
      extendEnv: true, stdin: Stream.fromEffect(Effect.promise(() => stop.promise)).pipe(Stream.drain), stdout: "pipe", stderr: "pipe",
    }))
    observed.pid = Number(child.pid)
    const stdout = yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.filter((line) => line.length > 0), Stream.runForEach((line) => Effect.sync(() => receive(line)))))
    const stderr = yield* Effect.forkScoped(AppProcess.collectStream(child.stderr, 16384))
    const exitCode = yield* child.exitCode
    yield* Fiber.join(stdout)
    const errors = yield* Fiber.join(stderr)
    if (exitCode !== 0) throw new Error(`Node browser driver exited ${exitCode}: ${errors.buffer.toString("utf8")}`)
    return { exitCode }
  }).pipe(Effect.raceFirst(AppProcess.waitForAbort(abort.signal)), Effect.scoped, Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
  const cleanup = async <T>(work: () => Promise<T>) => {
    try { return await within(work(), 5000, "Browser driver cleanup") }
    catch (error) {
      stop.resolve()
      abort.abort(error)
      // The failed cleanup stays failed; wait for the owned process scope to release.
      await Promise.allSettled([finished])
      throw error
    }
  }
  try {
    const metadata = await within(Promise.race([ready.promise, finished.then(() => { throw new Error("Browser driver exited before connection") })]), 15000, "Browser driver launch")
    const browser = await chromium.connect(metadata.endpoint, { timeout: Math.max(1, 15000 - Math.round(performance.now() - started)) })
    const browserVersion = browser.version()
    let closing: Promise<void> | undefined
    return { browser,
      close: () => closing ??= cleanup(async () => {
        for (const context of browser.contexts()) await context.close()
        if (browser.contexts().length) throw new Error("Browser contexts remained open")
        await browser.close()
        if (browser.isConnected()) throw new Error("Browser connection remained open")
        stop.resolve()
        const result = await finished
        if (!observed.closed) throw new Error("Node did not confirm Chromium shutdown")
        observed.proof = { consumer, clientRuntime: { name: "bun", version: process.versions.bun, pid: process.pid },
          driverRuntime: { name: "node", version: metadata.nodeVersion, pid: metadata.pid }, playwrightVersion: metadata.playwrightVersion,
          browserVersion, browserPid: metadata.browserPid, transport: "playwright-websocket", spawnBoundary: "AppProcess",
          browserStdioCount: metadata.browserStdioCount, browserUsesPipe: metadata.browserUsesPipe, browserPipeOwner: "node",
          lifecycle: { remainingContexts: browser.contexts().length, connected: browser.isConnected(), nodeExitCode: result.exitCode, ...observed.closed } }
      }),
      report: () => {
        if (!observed.proof) throw new Error("Browser driver proof requires completed cleanup")
        console.info("SF_WP02_BROWSER_DRIVER_PROOF", JSON.stringify(observed.proof))
      },
    }
  } catch (error) {
    try { await cleanup(async () => { stop.resolve(); await finished }) }
    catch (closed) { throw new AggregateError([error, closed], "Browser driver startup and cleanup failed") }
    throw error
  }
}
