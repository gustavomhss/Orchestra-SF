import assert from "node:assert/strict"
import { once } from "node:events"
import { lstat, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createConnection } from "node:net"
import { test } from "node:test"
import { setTimeout } from "node:timers/promises"

assert.equal(process.release.name, "node")
assert.equal(process.versions.bun, undefined)

// Use the same installed Playwright dependency as the driver. This is its real
// WebSocketServer, paired with Node's native WebSocket in the unchanged forward.
const dependency = createRequire(import.meta.url)
const playwright = createRequire(dependency.resolve("@playwright/test/package.json"))
const core = createRequire(playwright.resolve("playwright/package.json"))
const { wsServer } = core("playwright-core/lib/utilsBundle")

// Execute the committed bridge implementation verbatim, without starting Chrome
// or reproducing the forwarding algorithm in the test. Delimiter drift fails.
const source = await readFile(new URL("./browser-driver-fixture.ts", import.meta.url), "utf8")
function section(text, start, end) {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length)
  assert.ok(first >= 0 && last > first, "Committed browser bridge section missing")
  const repeated = text.indexOf(start, first + start.length)
  assert.ok(repeated === -1 || repeated >= last, "Ambiguous browser bridge section")
  return text.slice(first, last)
}
const opening = "const nodeDriver = String.raw" + String.fromCharCode(96) + "\n"
const driver = section(source, opening, "\n" + String.fromCharCode(96) + "\n\ntype Ready").slice(opening.length)
const imports = section(driver, 'import { readFileSync }', '\nif (process.versions.bun')
const limits = section(source, "const limits = ", "\nconst nodeDriver = ")
const implementation = section(driver, "const failed = Promise.withResolvers()", "\ntry {\n  inspectLaunch()")
const listen = section(driver, '  await new Promise((resolve, reject) => {\n    listener.once("error", reject)',
  "\n  const child = server.process()")
const removal = section(driver, "  await rm(directory, { recursive: true, force: true })", "\n  if (failure) throw failure")
const moduleSource = [
  imports, "export async function createBridge(remoteEndpoint) {", limits, implementation,
  "server = { wsEndpoint: () => remoteEndpoint }", listen,
  "return { directory, endpoint, directoryMode, socketMode, stats, lifecycle, failed: failed.promise,",
  "get socket() { return socket }, get completion() { return bridge }, get failure() { return failure },",
  "closeListener: () => new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve())),",
  "remove: async () => {", removal,
  "return { socket: lifecycle.socketRemoved, directory: lifecycle.directoryRemoved } },",
  "dispose: async () => { socket?.destroy(); if (websocket && websocket.readyState < WebSocket.CLOSING) websocket.close(1000);",
  "if (listener.listening) await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));",
  "await rm(directory, { recursive: true, force: true }) } }", "}",
].join("\n")
const { createBridge } = await import("data:text/javascript;base64," + Buffer.from(moduleSource).toString("base64"))

async function fixture(context) {
  const remote = new wsServer({ host: "127.0.0.1", port: 0 })
  const errors = [], chunks = [], connected = Promise.withResolvers()
  let bridge, client, remoteClosing
  const closeRemote = () => remoteClosing ??= new Promise((resolve, reject) =>
    remote.close((error) => error ? reject(error) : resolve()))
  remote.on("error", (error) => errors.push(error))
  remote.on("connection", (peer) => {
    peer.on("error", (error) => errors.push(error))
    connected.resolve(peer)
  })
  context.after(async () => {
    client?.destroy()
    for (const peer of remote.clients) peer.terminate()
    await bridge?.dispose()
    await closeRemote()
  })
  await once(remote, "listening")
  const address = remote.address()
  assert.ok(address && typeof address === "object")
  bridge = await createBridge("ws://127.0.0.1:" + address.port)
  assert.equal(bridge.directoryMode, 0o700)
  assert.equal(bridge.socketMode, 0o600)
  client = createConnection({ path: bridge.endpoint, allowHalfOpen: true })
  client.on("error", (error) => errors.push(error))
  client.on("data", (chunk) => chunks.push(chunk))
  client.pause()
  const clientClosed = new Promise((resolve) => client.once("close", resolve))
  await once(client, "connect")
  const peer = await connected.promise
  return { remote, peer, bridge, client, clientClosed, chunks, errors, closeRemote }
}

async function until(bridge, signal, condition) {
  while (!condition()) {
    if (bridge.failure) throw bridge.failure
    await setTimeout(1, undefined, { signal })
  }
  if (bridge.failure) throw bridge.failure
}

test("Node browser bridge preserves pending reverse writes after real Unix EOF and proves clean physical close",
  { timeout: 10_000 }, async (context) => {
    const value = await fixture(context)
    const request = '{ "id": 1, "method": "fixture.reverse-write", "params": { "label": "ação ☕" } }'
    const sent = once(value.peer, "message")
    value.client.write(request + "\0")
    const [observed] = await sent
    assert.equal(observed.toString("utf8"), request)
    // Pausing the real Unix receiver makes this bounded WebSocket frame exceed
    // the kernel socket buffer. Its write callback must remain pending at EOF.
    const response = JSON.stringify({ id: 1, result: { text: "x".repeat(2 * 1024 * 1024) } })
    const expected = Buffer.from(response + "\0", "utf8")
    assert.ok(expected.length < value.bridge.stats.maxFrameBytes)
    await new Promise((resolve, reject) => value.peer.send(response, (error) => error ? reject(error) : resolve()))
    await until(value.bridge, context.signal, () => value.bridge.lifecycle.queuedWriteBytes === expected.length)
    assert.equal(value.bridge.stats.framesFromBrowser, 0)
    assert.ok(value.bridge.socket.writableLength > 0)
    value.client.end()
    await until(value.bridge, context.signal, () => value.bridge.lifecycle.pipeEnded)
    assert.equal(value.bridge.socket.readableEnded, true)
    assert.equal(value.bridge.socket.destroyed, false)
    assert.equal(value.bridge.socket.writableEnded, false)
    assert.equal(value.bridge.lifecycle.queuedWriteBytes, expected.length)
    value.client.resume()
    const [, hadError] = await Promise.all([value.bridge.completion, value.clientClosed])
    assert.equal(hadError, false)
    assert.deepEqual(Buffer.concat(value.chunks), expected)
    assert.deepEqual(value.errors, [])
    assert.equal(value.bridge.failure, undefined)
    assert.equal(value.bridge.stats.maxFrameBytes, 16 * 1024 * 1024)
    assert.equal(value.bridge.stats.maxQueuedBytes, 32 * 1024 * 1024)
    assert.equal(value.bridge.stats.acceptedClients, 1)
    assert.equal(value.bridge.stats.framesToBrowser, 1)
    assert.equal(value.bridge.stats.framesFromBrowser, 1)
    assert.ok(value.bridge.stats.peakQueuedBytes <= value.bridge.stats.maxQueuedBytes)
    assert.ok(value.bridge.stats.peakBufferedBytes <= value.bridge.stats.maxQueuedBytes)
    await value.bridge.closeListener()
    assert.equal(value.bridge.lifecycle.listenerClosed, true)
    assert.deepEqual(await value.bridge.remove(), { socket: true, directory: true })
    await assert.rejects(lstat(value.bridge.endpoint), { code: "ENOENT" })
    await assert.rejects(lstat(value.bridge.directory), { code: "ENOENT" })
    assert.deepEqual(value.bridge.lifecycle, {
      bridgeClosed: true, listenerClosed: true, socketClosed: true, pipeEnded: true,
      webSocketOpened: true, webSocketClosed: true, webSocketCloseCode: 1000, webSocketCloseWasClean: true,
      pendingFrameBytes: 0, queuedWriteBytes: 0, socketRemoved: true, directoryRemoved: true,
    })
    await value.closeRemote()
    assert.equal(value.remote.address(), null)
  })

for (const [name, payload, message] of [
  ["incomplete", '{"id":1', "Browser pipe ended with an incomplete frame"],
  ["empty", "\0", "Invalid browser pipe frame length"],
]) {
  test("Node browser bridge still rejects a real " + name + " Unix frame", { timeout: 10_000 }, async (context) => {
    const value = await fixture(context)
    value.client.end(payload)
    await assert.rejects(value.bridge.failed, (error) => {
      assert.equal(error.message, message)
      return true
    })
    assert.equal(value.bridge.stats.framesToBrowser, 0)
    assert.equal(value.bridge.lifecycle.bridgeClosed, false)
    assert.notEqual(value.bridge.lifecycle.webSocketCloseCode, 1000)
  })
}
