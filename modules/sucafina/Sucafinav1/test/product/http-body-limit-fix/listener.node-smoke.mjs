import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer, request } from "node:http"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const cli = createRequire(new URL("../../../../../../apps/cli/package.json", import.meta.url))
const { Effect, FileSystem, Layer } = await import(pathToFileURL(cli.resolve("effect")).href)
const { HttpRouter, HttpServer, HttpServerRequest } = await import(pathToFileURL(cli.resolve("effect/unstable/http")).href)
const { NodeHttpServer } = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href)
const { composeSfInstallation } = await import(new URL("../../../../../../apps/cli/src/sucafina-product/installation.ts", import.meta.url).href)

/** Real Node/Effect/production bridge with the local installation boundary.
 * Microsoft identity/privacy is exercised separately by microsoft-bridge.test.ts on the existing Bun domain graph.
 * That graph's bare JSON imports require Bun; this probe neither rewrites them nor supplies a substitute loader.
 */
async function listener(run, maximum = 16 * 1024 * 1024, signal) {
  const server = createServer()
  const received = []
  server.on("request", (incoming) => received.push(incoming))
  const observed = { requests: [], completed: [], aborted: Promise.withResolvers(), reading: Promise.withResolvers() }
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const bound = yield* HttpServer.HttpServer
      assert.equal(bound.address._tag, "TcpAddress")
      const origin = `http://127.0.0.1:${bound.address.port}`
      const installation = yield* Effect.promise(() => composeSfInstallation({
        mount: "/sucafina",
        dispose() {},
        async handler(incoming) {
          observed.requests.push(incoming)
          assert.equal(new URL(incoming.url).origin, origin)
          assert.equal(incoming.headers.get("host"), new URL(origin).host)
          const url = new URL(incoming.url)
          if (url.pathname.endsWith("/unread")) return new Response(null, { status: 403 })
          if (url.pathname.endsWith("/throw")) throw new Error("private-body-token-must-not-escape")
          if (url.pathname.endsWith("/abort")) {
            incoming.signal.addEventListener("abort", () => observed.aborted.resolve(incoming), { once: true })
            observed.reading.resolve(incoming)
          }
          try {
            const bytes = new Uint8Array(await incoming.arrayBuffer())
            if (url.searchParams.get("sf")?.startsWith("workbench")) JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
            observed.completed.push({ request: incoming, bytes: bytes.length, digest: createHash("sha256").update(bytes).digest("hex") })
            return Response.json({ bytes: bytes.length, digest: createHash("sha256").update(bytes).digest("hex") })
          } catch {
            // A real consumer may swallow a reader error. The bridge must still return its own 413.
            return Response.json({ status: "invalid" }, { status: 400 })
          }
        },
      }, origin))
      const budget = HttpRouter.middleware((effect) => effect.pipe(Effect.provideService(HttpServerRequest.MaxBodySize, FileSystem.Size(maximum))), { global: true })
      yield* Layer.build(HttpRouter.serve(Layer.merge(installation.layer, budget), { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provide(installation.privacy),
      ))
      yield* Effect.addFinalizer(() => Effect.sync(() => server.closeAllConnections()))
      yield* Effect.promise(() => run({ origin, observed, received }))
    })).pipe(Effect.provide(NodeHttpServer.layer(() => server, { host: "127.0.0.1", port: 0 }))), { signal })
  } finally { server.closeAllConnections() }
}

function send(f, body, { path = "/sucafina/dashboard?sf=workbench-command", headers = {}, end = true } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = request(f.origin + path, {
      method: "POST",
      headers: { host: new URL(f.origin).host, origin: f.origin, "content-type": "application/json", connection: "close", ...headers },
    }, (response) => {
      const chunks = []
      response.on("data", (chunk) => chunks.push(chunk))
      response.on("error", reject)
      response.on("end", () => {
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") })
        outgoing.destroy()
      })
    })
    outgoing.on("error", reject)
    outgoing.setTimeout(3000, () => outgoing.destroy(new Error("HTTP body response did not finish")))
    if (body?.length) outgoing.write(body)
    if (end) outgoing.end()
    else outgoing.flushHeaders()
  })
}

async function released(incoming) {
  if (!incoming.destroyed) await new Promise((resolve) => incoming.once("close", resolve))
  await new Promise(setImmediate)
  assert.equal(incoming.destroyed, true)
  assert.equal(incoming.listenerCount("data"), 0)
  assert.equal(incoming.listenerCount("readable"), 0)
}

test("Node runtime: bounded streaming keeps 413, UTF-8 bytes, no EOF dependency and private error responses", { timeout: 20000 }, async (t) => {
  t.diagnostic(`Runtime ${process.release.name} ${process.version}; production NodeHttpServer and SF composition`)
  assert.equal(process.versions.bun, undefined)
  await listener(async (f) => {
    const json = JSON.stringify({ objective: "Revisão ☕ 😀" })
    const exact = Buffer.from(json + " ".repeat(65536 - Buffer.byteLength(json)))
    const good = await send(f, exact)
    assert.equal(good.status, 200)
    assert.equal(JSON.parse(good.body).bytes, 65536)
    assert.equal(f.observed.completed.length, 1)
    assert.equal(f.observed.completed[0].request, f.observed.requests[0])

    const bad = await send(f, Buffer.from("{"))
    assert.equal(bad.status, 400)
    assert.equal(bad.body, '{"status":"invalid"}')
    const over = Buffer.from(JSON.stringify({ objective: "☕".repeat(24000) }))
    assert.ok(over.length > 65536)
    const oversized = await send(f, over, { end: false })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.body, '{"status":"invalid"}')
    assert.equal(oversized.headers["cache-control"], "no-store")
    assert.equal(oversized.headers["x-content-type-options"], "nosniff")
    assert.equal(oversized.headers.connection, "close")
    assert.equal(f.observed.completed.length, 1)

    const calls = f.observed.requests.length
    const declared = await send(f, null, { headers: { "content-length": "65537" }, end: false })
    assert.equal(declared.status, 413)
    assert.equal(f.observed.requests.length, calls)
    const tooShortJson = await send(f, Buffer.from('{"ok":true}'), { headers: { "content-length": "2" } })
    assert.equal(tooShortJson.status, 400)
    assert.equal(f.observed.completed.length, 1)

    // Delegated Workbench consumers receive the same 64KiB transport budget.
    const delegated = await send(f, over, { path: "/sucafina/planner?sf=workbench-analysis", end: false })
    assert.equal(delegated.status, 413)
    const unread = await send(f, Buffer.from("pending"), { path: "/sucafina/unread", end: false })
    assert.equal(unread.status, 403)
    assert.equal(unread.headers.connection, "close")
    const thrown = await send(f, Buffer.from("pending"), { path: "/sucafina/throw", end: false })
    assert.equal(thrown.status, 503)
    assert.equal(thrown.body.includes("private-body-token"), false)
    assert.equal(thrown.headers["cache-control"], "no-store")

    const denied = await send(f, null, { headers: { host: "evil.example" } })
    assert.equal(denied.status, 403)
    const forged = await send(f, null, { headers: { "x-forwarded-proto": "https" } })
    assert.equal(forged.status, 403)
    for (const incoming of f.received) await released(incoming)
  }, undefined, t.signal)
})

test("Node runtime: global stream budget cuts off chunked data and preserves binary octets", { timeout: 20000 }, async (t) => {
  await listener(async (f) => {
    const bytes = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256))
    const good = await send(f, bytes, { path: "/sucafina/binary", headers: { "content-type": "application/octet-stream", "content-length": String(bytes.length) } })
    assert.equal(good.status, 200)
    assert.equal(JSON.parse(good.body).digest, createHash("sha256").update(bytes).digest("hex"))
    const oversized = await send(f, Buffer.alloc(4097), { path: "/sucafina/binary", end: false })
    assert.equal(oversized.status, 413)
    // An explicit smaller host budget also applies to contract uploads.
    const contract = await send(f, Buffer.alloc(4097), { path: "/sucafina/dashboard?upload=contract", end: false })
    assert.equal(contract.status, 413)
    assert.equal(f.observed.completed.length, 1)
    for (const incoming of f.received) await released(incoming)
  }, 4096, t.signal)
})

test("Node runtime: disconnected/truncated input aborts the original Request and releases its reader", { timeout: 10000 }, async (t) => {
  await listener(async (f) => {
    const outgoing = request(f.origin + "/sucafina/abort", { method: "POST", headers: { host: new URL(f.origin).host, "content-length": "4096", connection: "close" } })
    outgoing.on("error", () => {})
    outgoing.write(Buffer.from("truncated"))
    const active = await f.observed.reading.promise
    outgoing.destroy()
    const aborted = await f.observed.aborted.promise
    assert.equal(aborted, active)
    assert.equal(active.signal.aborted, true)
    await new Promise(setImmediate)
    await new Promise(setImmediate)
    assert.equal(f.observed.completed.length, 0)
    assert.equal(f.received[0].complete, false)
    assert.equal(f.received[0].listenerCount("readable"), 0)
    await released(f.received[0])
  }, undefined, t.signal)
})
