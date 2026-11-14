import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect, Fiber, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { lstat } from "node:fs/promises"
import { dirname } from "node:path"
import playwrightPackage from "@playwright/test/package.json" with { type: "json" }
import { object } from "../../../runtime/contract.ts"

// Bun 1.3.14 can finalize recycled extra stdio descriptors used by Chromium's
// DevTools pipes (oven-sh/bun#47956 and #47561). Node owns those descriptors;
// Bun uses Playwright's public Unix-pipe connection, avoiding its bundled ws
// HTTP upgrade on Bun as well. The Node bridge forwards the original JSON text.
const transport = "playwright-unix-pipe-node-websocket"
const limits = { maxFrameBytes: 16 * 1024 * 1024, maxQueuedBytes: 32 * 1024 * 1024 }
const nodeDriver = String.raw`
import { chmod, lstat, mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout } from "node:timers/promises"
if (process.versions.bun || process.release.name !== "node") throw new Error("The browser driver requires Node")
const { chromium } = await import(process.argv[1])
const version = JSON.parse(await readFile(new URL(process.argv[2]), "utf8")).version
const limits = JSON.parse(process.argv[3])
const stopped = new Promise((resolve) => process.stdin.once("end", resolve))
process.stdin.resume()
const failed = Promise.withResolvers()
void failed.promise.catch(() => {})
const directory = await mkdtemp(join(tmpdir(), "sf-wp02-driver-"))
await chmod(directory, 0o700)
const endpoint = join(directory, "browser.sock")
const stats = { framing: "json-nul", acceptedClients: 0, framesToBrowser: 0, framesFromBrowser: 0,
  peakQueuedBytes: 0, peakBufferedBytes: 0, ...limits }
const lifecycle = { bridgeClosed: false, listenerClosed: false, socketClosed: false, pipeEnded: false,
  webSocketOpened: false, webSocketClosed: false, webSocketCloseCode: 0, webSocketCloseWasClean: false,
  pendingFrameBytes: 0, queuedWriteBytes: 0, socketRemoved: false, directoryRemoved: false }
let server, socket, websocket, bridge, failure
const fail = (error) => {
  if (failure) return
  failure = error
  failed.reject(error)
  socket?.destroy()
  if (websocket && websocket.readyState < WebSocket.CLOSING) websocket.close(4000, "bridge failed")
}
const missing = async (path) => {
  try { await lstat(path); return false }
  catch (error) { if (error.code === "ENOENT") return true; throw error }
}
const listener = createServer({ allowHalfOpen: true }, (client) => {
  stats.acceptedClients++
  if (stats.acceptedClients !== 1) { client.destroy(); fail(new Error("The browser bridge accepts one client")); return }
  socket = client
  bridge = forward(client)
  void bridge.catch(fail)
})
listener.on("error", fail)
listener.once("close", () => { lifecycle.listenerClosed = true })
async function forward(client) {
  const opened = Promise.withResolvers(), closed = Promise.withResolvers(), pipeClosed = Promise.withResolvers()
  void opened.promise.catch(() => {})
  let closing = false, pending = Buffer.alloc(0), writes = Promise.resolve()
  client.on("error", fail)
  client.once("close", (hadError) => {
    lifecycle.socketClosed = true
    if (hadError) fail(new Error("The browser pipe closed with an error"))
    pipeClosed.resolve()
  })
  websocket = new WebSocket(server.wsEndpoint())
  websocket.addEventListener("open", () => { lifecycle.webSocketOpened = true; opened.resolve() }, { once: true })
  websocket.addEventListener("error", () => {
    const error = new Error("The Node browser WebSocket failed")
    opened.reject(error); fail(error)
  })
  websocket.addEventListener("close", (event) => {
    lifecycle.webSocketClosed = true
    lifecycle.webSocketCloseCode = event.code
    lifecycle.webSocketCloseWasClean = event.wasClean
    closed.resolve()
    if (!closing || event.code !== 1000 || !event.wasClean) {
      const error = new Error("The Node browser WebSocket closed unexpectedly")
      opened.reject(error); fail(error)
    }
  }, { once: true })
  websocket.addEventListener("message", (event) => {
    try {
      if (typeof event.data !== "string" || event.data.includes("\0")) throw new Error("Invalid browser WebSocket frame")
      const length = Buffer.byteLength(event.data, "utf8")
      if (length > limits.maxFrameBytes || lifecycle.queuedWriteBytes + length + 1 > limits.maxQueuedBytes) throw new Error("Browser bridge output exceeded its bound")
      JSON.parse(event.data)
      const frame = Buffer.from(event.data + "\0", "utf8")
      lifecycle.queuedWriteBytes += frame.length
      stats.peakQueuedBytes = Math.max(stats.peakQueuedBytes, lifecycle.queuedWriteBytes)
      // One write callback at a time preserves order and applies socket backpressure.
      writes = writes.then(() => new Promise((resolve, reject) => {
        client.write(frame, (error) => {
          if (error) { reject(error); return }
          lifecycle.queuedWriteBytes -= frame.length
          stats.framesFromBrowser++
          resolve()
        })
      }))
      void writes.catch(fail)
    } catch (error) { fail(error) }
  })
  await opened.promise
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  // The async iterator pauses incoming reads while the WebSocket is backpressured.
  for await (const chunk of client) {
    if (failure) throw failure
    if (pending.length + chunk.length > limits.maxQueuedBytes) throw new Error("Browser bridge input exceeded its bound")
    pending = Buffer.concat([pending, chunk])
    let end = pending.indexOf(0)
    while (end !== -1) {
      if (end === 0 || end > limits.maxFrameBytes) throw new Error("Invalid browser pipe frame length")
      const frame = pending.subarray(0, end), text = decoder.decode(frame)
      JSON.parse(text)
      while (websocket.bufferedAmount + frame.length > limits.maxQueuedBytes) {
        if (failure || websocket.readyState !== WebSocket.OPEN) throw failure ?? new Error("Browser WebSocket closed during backpressure")
        await setTimeout(1)
      }
      if (websocket.readyState !== WebSocket.OPEN) throw new Error("Browser WebSocket is not open")
      websocket.send(text)
      stats.framesToBrowser++
      stats.peakBufferedBytes = Math.max(stats.peakBufferedBytes, websocket.bufferedAmount)
      pending = pending.subarray(end + 1)
      end = pending.indexOf(0)
    }
    lifecycle.pendingFrameBytes = pending.length
    if (pending.length > limits.maxFrameBytes) throw new Error("Unterminated browser pipe frame exceeded its bound")
  }
  lifecycle.pipeEnded = client.readableEnded
  if (!lifecycle.pipeEnded || pending.length) throw new Error("Browser pipe ended with an incomplete frame")
  while (websocket.bufferedAmount) {
    if (failure || websocket.readyState !== WebSocket.OPEN) throw failure ?? new Error("Browser WebSocket closed before draining")
    await setTimeout(1)
  }
  closing = true
  websocket.close(1000)
  await closed.promise
  await writes
  client.end()
  await pipeClosed.promise
  if (failure) throw failure
  lifecycle.bridgeClosed = client.destroyed && websocket.readyState === WebSocket.CLOSED
}
try {
  server = await chromium.launchServer({ host: "127.0.0.1", channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15000 })
  await new Promise((resolve, reject) => {
    listener.once("error", reject)
    listener.listen(endpoint, () => { listener.removeListener("error", reject); resolve() })
  })
  await chmod(endpoint, 0o600)
  const directoryMode = (await lstat(directory)).mode & 0o777, socketMode = (await lstat(endpoint)).mode & 0o777
  const child = server.process()
  console.log(JSON.stringify({ event: "ready", runtime: process.release.name, nodeVersion: process.versions.node,
    playwrightVersion: version, pid: process.pid, browserPid: child.pid, browserStdioCount: child.stdio.length,
    browserUsesPipe: child.spawnargs.includes("--remote-debugging-pipe"), endpoint, directoryMode, socketMode }))
  await Promise.race([stopped, failed.promise])
  if (!bridge) throw new Error("Browser driver stopped before a pipe connected")
  // Playwright's logical close can precede the physical Unix EOF.
  await Promise.race([bridge, failed.promise])
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  await server.close()
  await rm(directory, { recursive: true, force: true })
  lifecycle.socketRemoved = await missing(endpoint)
  lifecycle.directoryRemoved = await missing(directory)
  if (failure) throw failure
  if (child.exitCode !== 0 || child.signalCode !== null) throw new Error("Chromium did not close normally")
  console.log(JSON.stringify({ event: "closed", browserExitCode: child.exitCode, browserSignal: child.signalCode,
    bridge: { ...stats, directoryMode, socketMode }, lifecycle }))
} catch (error) {
  fail(error)
  console.error("SF_WP02_BROWSER_BRIDGE_FAILURE", JSON.stringify({ bridge: stats, lifecycle }))
  await Promise.allSettled([
    new Promise((resolve) => listener.close(resolve)),
    server?.close(),
  ])
  await rm(directory, { recursive: true, force: true })
  throw error
}
`

type Ready = { nodeVersion: string; playwrightVersion: string; pid: number; browserPid: number; browserStdioCount: number; browserUsesPipe: boolean; endpoint: string; directoryMode: number; socketMode: number }

function count(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid browser bridge count")
  return value
}

function closedMessage(value: ReturnType<typeof object>) {
  const bridge = object(value.bridge), lifecycle = object(value.lifecycle)
  if (value.browserExitCode !== 0 || value.browserSignal !== null || bridge.framing !== "json-nul" || bridge.acceptedClients !== 1 || bridge.maxFrameBytes !== limits.maxFrameBytes || bridge.maxQueuedBytes !== limits.maxQueuedBytes || bridge.directoryMode !== 0o700 || bridge.socketMode !== 0o600) throw new Error("Browser driver shutdown or bridge configuration mismatch")
  const framesToBrowser = count(bridge.framesToBrowser), framesFromBrowser = count(bridge.framesFromBrowser)
  const peakQueuedBytes = count(bridge.peakQueuedBytes), peakBufferedBytes = count(bridge.peakBufferedBytes)
  if (!framesToBrowser || !framesFromBrowser || peakQueuedBytes > limits.maxQueuedBytes || peakBufferedBytes > limits.maxQueuedBytes) throw new Error("Browser bridge did not forward bounded traffic")
  if (lifecycle.bridgeClosed !== true || lifecycle.listenerClosed !== true || lifecycle.socketClosed !== true || lifecycle.pipeEnded !== true || lifecycle.webSocketOpened !== true || lifecycle.webSocketClosed !== true || lifecycle.webSocketCloseCode !== 1000 || lifecycle.webSocketCloseWasClean !== true || lifecycle.pendingFrameBytes !== 0 || lifecycle.queuedWriteBytes !== 0 || lifecycle.socketRemoved !== true || lifecycle.directoryRemoved !== true) throw new Error("Browser bridge shutdown was not clean")
  return { browserExitCode: value.browserExitCode, browserSignal: value.browserSignal,
    bridge: { framing: bridge.framing, acceptedClients: bridge.acceptedClients, framesToBrowser, framesFromBrowser,
      peakQueuedBytes, peakBufferedBytes, maxFrameBytes: bridge.maxFrameBytes, maxQueuedBytes: bridge.maxQueuedBytes,
      directoryMode: bridge.directoryMode, socketMode: bridge.socketMode },
    lifecycle: { bridgeClosed: lifecycle.bridgeClosed, listenerClosed: lifecycle.listenerClosed, socketClosed: lifecycle.socketClosed,
      pipeEnded: lifecycle.pipeEnded, webSocketOpened: lifecycle.webSocketOpened, webSocketClosed: lifecycle.webSocketClosed,
      webSocketCloseCode: lifecycle.webSocketCloseCode, webSocketCloseWasClean: lifecycle.webSocketCloseWasClean,
      pendingFrameBytes: lifecycle.pendingFrameBytes, queuedWriteBytes: lifecycle.queuedWriteBytes,
      socketRemoved: lifecycle.socketRemoved, directoryRemoved: lifecycle.directoryRemoved } }
}

async function missing(path: string) {
  try { await lstat(path); return false }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return true; throw error }
}

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
  const observed: { pid?: number; ready?: Ready; closed?: ReturnType<typeof closedMessage>; proof?: object } = {}
  const receive = (line: string) => {
    try {
      if (!line || line.length > 8192) throw new Error("Invalid browser driver message")
      const value = object(JSON.parse(line))
      if (value.event === "ready") {
        if (observed.ready || value.runtime !== "node" || typeof value.nodeVersion !== "string" || !/^\d+\.\d+\.\d+/.test(value.nodeVersion) || value.playwrightVersion !== playwrightPackage.version || typeof value.pid !== "number" || value.pid !== observed.pid || value.pid === process.pid || typeof value.browserPid !== "number" || !Number.isSafeInteger(value.browserPid) || value.browserPid <= 0 || value.browserPid === value.pid || value.browserPid === process.pid || value.browserStdioCount !== 5 || value.browserUsesPipe !== true || typeof value.endpoint !== "string" || value.directoryMode !== 0o700 || value.socketMode !== 0o600) throw new Error("Browser driver runtime or pipe ownership mismatch")
        if (!value.endpoint.startsWith("/") || !value.endpoint.endsWith("/browser.sock") || value.endpoint.includes("\0") || URL.canParse(value.endpoint)) throw new Error("Browser driver endpoint is not a Unix pipe")
        observed.ready = { nodeVersion: value.nodeVersion, playwrightVersion: value.playwrightVersion, pid: value.pid, browserPid: value.browserPid,
          browserStdioCount: value.browserStdioCount, browserUsesPipe: value.browserUsesPipe, endpoint: value.endpoint,
          directoryMode: value.directoryMode, socketMode: value.socketMode }
        ready.resolve(observed.ready)
        return
      }
      if (value.event !== "closed" || !observed.ready || observed.closed) throw new Error("Unexpected browser driver shutdown message")
      observed.closed = closedMessage(value)
    } catch (error) { ready.reject(error); throw error }
  }
  const finished = Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const child = yield* process.spawn(ChildProcess.make(node, ["--input-type=module", "-e", nodeDriver, import.meta.resolve("@playwright/test"), import.meta.resolve("@playwright/test/package.json"), JSON.stringify(limits)], {
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
    const [directory, socket] = await Promise.all([lstat(dirname(metadata.endpoint)), lstat(metadata.endpoint)])
    if (!directory.isDirectory() || !socket.isSocket() || (directory.mode & 0o777) !== metadata.directoryMode || (socket.mode & 0o777) !== metadata.socketMode) throw new Error("Browser Unix pipe permissions differ in the client")
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
        if (!await missing(metadata.endpoint) || !await missing(dirname(metadata.endpoint))) throw new Error("Browser Unix pipe resources remained in the client")
        observed.proof = { consumer, clientRuntime: { name: "bun", version: process.versions.bun, pid: process.pid },
          driverRuntime: { name: "node", version: metadata.nodeVersion, pid: metadata.pid }, playwrightVersion: metadata.playwrightVersion,
          browserVersion, browserPid: metadata.browserPid, transport, spawnBoundary: "AppProcess",
          browserStdioCount: metadata.browserStdioCount, browserUsesPipe: metadata.browserUsesPipe, browserPipeOwner: "node",
          bridge: observed.closed.bridge,
          lifecycle: { remainingContexts: browser.contexts().length, connected: browser.isConnected(), nodeExitCode: result.exitCode,
            browserExitCode: observed.closed.browserExitCode, browserSignal: observed.closed.browserSignal, ...observed.closed.lifecycle } }
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
