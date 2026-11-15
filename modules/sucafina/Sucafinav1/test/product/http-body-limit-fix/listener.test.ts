import { beforeAll, expect, test } from "bun:test"
import { createServer, request, type IncomingHttpHeaders, type IncomingMessage } from "node:http"
import { connect } from "node:net"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { BodyLimit } from "../../../../../../packages/server/src/body-limit.ts"
import { composeSfInstallation } from "../../../../../../apps/cli/src/sucafina-product/installation.ts"
import { binaryFixture } from "./binary-fixture.ts"
import { draftBody, workbenchFixture } from "./workbench-fixture.ts"

type NodeServer = { layer: (evaluate: () => ReturnType<typeof createServer>, options: { host: string; port: number }) => Layer.Layer<HttpServer.HttpServer, unknown> }
let NodeHttpServer: NodeServer
beforeAll(async () => {
  // Resolve the actual CLI adapter without adding a new module dependency or importing a source postimage.
  const cli = createRequire(path.resolve(import.meta.dir, "../../../../../../apps/cli/package.json"))
  const platform = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href) as { NodeHttpServer: NodeServer }
  NodeHttpServer = platform.NodeHttpServer
})

type Incoming = { source: IncomingMessage; closed: Promise<void> }
type Listener = { origin: string; port: number; incoming: Incoming[]; web: Request[]; server: ReturnType<typeof createServer> }
type Application = { handler: (request: Request) => Promise<Response | undefined>; close: () => Promise<void> }

async function withListener<F extends Application>(make: (origin: string) => Promise<F>, run: (fixture: F, listener: Listener) => Promise<void>) {
  const server = createServer()
  const incoming: Incoming[] = []
  const web: Request[] = []
  // Observe lifecycle only; adding a data handler here would change the body consumer under test.
  server.on("request", (source) => {
    const closed = new Promise<void>((resolve) => source.once("close", resolve))
    incoming.push({ source, closed })
  })
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const service = yield* HttpServer.HttpServer
      if (service.address._tag !== "TcpAddress") throw new Error("Expected ephemeral TCP listener")
      const port = service.address.port
      const origin = `http://127.0.0.1:${port}`
      const f = yield* Effect.acquireRelease(Effect.promise(() => make(origin)), (f) => Effect.promise(() => f.close()))
      const installation = yield* Effect.promise(() => composeSfInstallation({
        mount: "/sucafina", handler: (request: Request) => { web.push(request); return f.handler(request) }, dispose: f.close,
      }, origin))
      yield* Layer.build(HttpRouter.serve(Layer.mergeAll(BodyLimit.layer, installation.layer), { disableLogger: true, disableListenLog: true }).pipe(Layer.provide(installation.privacy)))
      // Close live sockets before the scoped Node server waits for its own shutdown.
      yield* Effect.addFinalizer(() => Effect.sync(() => server.closeAllConnections?.()))
      yield* Effect.promise(() => run(f, { origin, port, incoming, web, server }))
    })).pipe(Effect.provide(NodeHttpServer.layer(() => server, { host: "127.0.0.1", port: 0 }))))
  } finally { server.closeAllConnections?.() }
}

const workbenchPath = "/sucafina/dashboard?sf=workbench-command"
const chunks = (bytes: Uint8Array, size = 4093) => Array.from({ length: Math.ceil(bytes.byteLength / size) }, (_, index) => bytes.slice(index * size, (index + 1) * size))
const domainHeaders = (f: { origin: string; cookie: string }, type = "application/json") => ({ origin: f.origin, cookie: f.cookie, "content-type": type })

function post(origin: string, pathname: string, headers: Record<string, string>, body: readonly Uint8Array[]) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; bytes: Buffer }>((resolve, reject) => {
    const outgoing = request(`${origin}${pathname}`, { method: "POST", agent: false, headers: { connection: "close", "transfer-encoding": "chunked", ...headers } }, (response) => {
      const result: Buffer[] = []
      response.on("data", (chunk: Buffer) => result.push(chunk))
      response.once("error", reject)
      response.once("end", () => resolve({ status: response.statusCode!, headers: response.headers, bytes: Buffer.concat(result) }))
    })
    outgoing.setTimeout(8000, () => outgoing.destroy(new Error("HTTP body listener response timed out")))
    outgoing.once("error", reject)
    for (const chunk of body) outgoing.write(chunk)
    outgoing.end()
  })
}

/** No terminating chunk or client EOF is sent. A full-buffering adapter cannot answer this request. */
function answerWithoutEof(listener: Listener, head: string, body: readonly Uint8Array[] = []) {
  return new Promise<string>((resolve, reject) => {
    const socket = connect(listener.port, "127.0.0.1")
    let received = ""
    let answered = false
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("Expected a response before body EOF")) }, 8000)
    const finish = () => {
      if (answered) return
      answered = true
      clearTimeout(timer)
      socket.destroy()
      if (received.includes("\r\n\r\n")) resolve(received)
      else reject(new Error("Socket closed before HTTP response headers"))
    }
    socket.on("data", (bytes) => { received += bytes.toString("latin1"); if (received.includes("\r\n\r\n")) finish() })
    socket.once("error", finish)
    socket.once("close", finish)
    socket.once("connect", () => { socket.write(head); for (const bytes of body) socket.write(bytes) })
  })
}

function rawHead(listener: Listener, pathname: string, headers: Record<string, string>) {
  return `POST ${pathname} HTTP/1.1\r\nHost: ${new URL(listener.origin).host}\r\nConnection: close\r\n${Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join("")}\r\n`
}

async function released(request: Incoming) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([request.closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Incoming request was not released")), 8000) })])
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(request.source.destroyed).toBe(true)
    expect(request.source.listenerCount("data")).toBe(0)
    expect(request.source.listenerCount("readable")).toBe(0)
  } finally { clearTimeout(timer) }
}

test("Actual Node/Effect listener accepts the 65536-byte Workbench boundary and rejects malformed bodies without new effects", async () => {
  await withListener(async (origin) => { const f = await workbenchFixture(origin); return { ...f, handler: f.app } }, async (f, listener) => {
    const json = JSON.stringify(draftBody("Node café ☕ 😀"))
    const bytes = new TextEncoder().encode(json + " ".repeat(65536 - new TextEncoder().encode(json).byteLength))
    const valid = await post(listener.origin, workbenchPath, { ...domainHeaders(f), "idempotency-key": "listener-valid-74" }, chunks(bytes, 7))
    expect(valid.status).toBe(200)
    expect(JSON.parse(valid.bytes.toString()).value.objective).toBe("Node café ☕ 😀")
    expect(valid.headers["cache-control"]).toBe("no-store")
    expect(f.observed.dispatches).toHaveLength(1)
    expect(f.observed.dispatches[0]?.request).toBe(listener.web[0])
    expect(f.observed.authentication).toContain(listener.web[0]!)
    expect(listener.incoming[0]?.source.headers["content-length"]).toBeUndefined()
    expect(listener.incoming[0]?.source.headers["transfer-encoding"]).toBe("chunked")
    const before = await f.snapshot()
    const invalidUtf8 = new TextEncoder().encode(JSON.stringify(draftBody("x")))
    const objectiveOffset = Buffer.from(invalidUtf8).indexOf('"objective":"x"') + '"objective":"'.length
    invalidUtf8[objectiveOffset] = 0xff
    for (const body of [new TextEncoder().encode("{"), invalidUtf8]) {
      const invalid = await post(listener.origin, workbenchPath, { ...domainHeaders(f), "idempotency-key": "listener-invalid-74" }, chunks(body, 3))
      expect(invalid.status).toBe(400)
      expect(JSON.parse(invalid.bytes.toString())).toEqual({ status: "invalid" })
      expect(await f.snapshot()).toEqual(before)
    }
    expect(f.observed.admissions).toHaveLength(1)
    expect(f.observed.commands).toHaveLength(1)
    expect(f.observed.dispatches).toHaveLength(1)
    for (const request of listener.incoming) { await released(request); expect(request.source.complete).toBe(true) }
  })
}, 30000)

test("Actual Node/Effect listener refuses chunked UTF-8 excess and a false length before EOF and releases readers", async () => {
  await withListener(async (origin) => { const f = await workbenchFixture(origin); return { ...f, handler: f.app } }, async (f, listener) => {
    const before = await f.snapshot()
    const json = JSON.stringify(draftBody("☕".repeat(24000)))
    const bytes = new TextEncoder().encode(json)
    expect(json.length).toBeLessThan(65536)
    expect(bytes.byteLength).toBeGreaterThan(65536)
    const frames = chunks(bytes).map((chunk) => Buffer.concat([Buffer.from(`${chunk.byteLength.toString(16)}\r\n`), chunk, Buffer.from("\r\n")]))
    const excess = await answerWithoutEof(listener, rawHead(listener, workbenchPath, { ...domainHeaders(f), "transfer-encoding": "chunked", "idempotency-key": "listener-excess-74" }), frames)
    expect(excess).toMatch(/^HTTP\/1\.1 413/)
    expect(excess.toLowerCase()).toContain("connection: close")
    expect(excess.toLowerCase()).toContain("cache-control: no-store")
    expect(listener.incoming[0]?.source.complete).toBe(false)
    await released(listener.incoming[0]!)

    const declared = await answerWithoutEof(listener, rawHead(listener, workbenchPath, { ...domainHeaders(f), "content-length": "65537" }))
    expect(declared).toMatch(/^HTTP\/1\.1 413/)
    expect(listener.incoming[1]?.source.complete).toBe(false)
    await released(listener.incoming[1]!)
    expect(listener.web).toHaveLength(1) // An excessive declared hint never enters the application.
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.commands).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  })
}, 30000)

test("Actual Node/Effect listener rejects a short declared body and aborts a truncated upload without writes or readers", async () => {
  await withListener(async (origin) => { const f = await workbenchFixture(origin); return { ...f, handler: f.app } }, async (f, listener) => {
    const before = await f.snapshot()
    const bytes = new TextEncoder().encode(JSON.stringify(draftBody()))
    // HTTP framing admits only two bytes; the domain receives invalid JSON instead of trusting the extra wire bytes.
    const short = await answerWithoutEof(listener, rawHead(listener, workbenchPath, { ...domainHeaders(f), "content-length": "2", "idempotency-key": "listener-short-74" }), [bytes])
    expect(short).toMatch(/^HTTP\/1\.1 400/)
    await released(listener.incoming[0]!)

    const admitted = new Promise<void>((resolve) => listener.server.once("request", () => resolve()))
    const socket = connect(listener.port, "127.0.0.1")
    socket.on("error", () => {}) // The intentional peer disconnect is the stimulus, not a client failure.
    try {
      await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject) })
      socket.write(rawHead(listener, workbenchPath, { ...domainHeaders(f), "content-length": String(bytes.byteLength + 100), "idempotency-key": "listener-truncated-74" }))
      socket.write(bytes.slice(0, Math.floor(bytes.byteLength / 2)))
      await admitted
      await new Promise<void>((resolve) => setImmediate(resolve))
      socket.destroy()
      await released(listener.incoming[1]!)
      expect(listener.incoming[1]?.source.complete).toBe(false)
      expect(listener.incoming[1]?.source.aborted).toBe(true)
      expect(f.observed.admissions).toHaveLength(0)
      expect(f.observed.commands).toHaveLength(0)
      expect(f.observed.dispatches).toHaveLength(0)
      expect(await f.snapshot()).toEqual(before)
    } finally { socket.destroy() }
  })
}, 30000)

test("Actual Node/Effect listener preserves an authorized binary upload above 65536 bytes and scanner refusal leaves SQLite unchanged", async () => {
  await withListener(binaryFixture, async (f, listener) => {
    const before = await f.state()
    const altered = new Uint8Array(f.accepted)
    altered[altered.length - 1] = altered[altered.length - 1]! ^ 1
    const refused = await post(listener.origin, f.uploadPath(), domainHeaders(f, "image/bmp"), chunks(altered, 1021))
    expect(refused.status).toBe(422)
    expect(f.scans).toHaveLength(1)
    expect(f.scans[0]?.accepted).toBe(false)
    expect(await f.state()).toEqual(before)

    expect(f.accepted.byteLength).toBeGreaterThan(65536)
    const accepted = await post(listener.origin, f.uploadPath(), domainHeaders(f, "image/bmp"), chunks(f.accepted, 1021))
    expect(accepted.status).toBe(200)
    expect(JSON.parse(accepted.bytes.toString())).toMatchObject({ ok: true })
    expect(f.scans).toHaveLength(2)
    expect(f.scans[1]).toEqual({ digest: f.acceptedDigest, type: "image/bmp", bytes: f.accepted.byteLength, accepted: true })
    const committed = await f.state()
    expect(committed.files).toHaveLength(1)
    expect(committed.files[0]?.bytes).toEqual(f.accepted)
    expect(committed.snapshot.versions["contracts:binary-c1"]?.version).toBe(4)
    expect(committed.snapshot.versions.dataset?.version).toBe(8)
    expect(committed.snapshot.audit).toHaveLength(1)

    const stale = await post(listener.origin, f.uploadPath(), domainHeaders(f, "image/bmp"), chunks(f.accepted))
    expect(stale.status).toBe(409)
    expect(await f.state()).toEqual(committed)
    expect((await f.logout())?.status).toBe(204)
    const scansBefore = f.scans.length
    const forbidden = await post(listener.origin, f.uploadPath(4), domainHeaders(f, "image/bmp"), chunks(f.accepted))
    expect(forbidden.status).toBe(403)
    expect(f.scans).toHaveLength(scansBefore)
    expect(await f.state()).toEqual(committed)
    for (const request of listener.incoming) await released(request)
  })
}, 30000)
