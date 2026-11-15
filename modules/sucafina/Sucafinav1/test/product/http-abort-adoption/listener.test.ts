import { expect, test } from "bun:test"
import { createServer, request, type IncomingMessage } from "node:http"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { BodyLimit } from "../../../../../../packages/server/src/body-limit.ts"
import { composeSfInstallation } from "../../../../../../apps/cli/src/sucafina-product/installation.ts"

type NodeServer = { layer: (evaluate: () => ReturnType<typeof createServer>, options: { host: string; port: number }) => Layer.Layer<HttpServer.HttpServer, unknown> }

function latch() {
  const state = { resolve: () => {} }
  const promise = new Promise<void>((resolve) => { state.resolve = resolve })
  return { promise, open: () => state.resolve() }
}

async function within<T>(work: Promise<T>, label: string): Promise<T> {
  const timer = { value: undefined as ReturnType<typeof setTimeout> | undefined }
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer.value = setTimeout(() => reject(new Error(`HTTP_ABORT_94_${label}_DEADLINE`)), 5000)
    })])
  } finally { clearTimeout(timer.value) }
}

async function turn() { await new Promise<void>((resolve) => setImmediate(resolve)) }

/** Actual NodeHttpServer/Effect listener and the production installation adapter. No server-side error/data observer. */
async function withListener(
  handler: (web: Request) => Promise<Response>,
  run: (ctx: { origin: string; incoming: IncomingMessage[]; web: Request[] }) => Promise<void>,
) {
  const cli = createRequire(path.resolve(import.meta.dir, "../../../../../../apps/cli/package.json"))
  const platform = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href) as { NodeHttpServer: NodeServer }
  const server = createServer()
  const incoming: IncomingMessage[] = []
  const web: Request[] = []
  server.on("request", (source) => { incoming.push(source) })
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const service = yield* HttpServer.HttpServer
      if (service.address._tag !== "TcpAddress") throw new Error("HTTP_ABORT_94_TCP_REQUIRED")
      const origin = `http://127.0.0.1:${service.address.port}`
      const installation = yield* Effect.promise(() => composeSfInstallation({
        mount: "/probe",
        dispose() {},
        handler: (value: Request) => { web.push(value); return handler(value) },
      }, origin))
      yield* Layer.build(HttpRouter.serve(Layer.mergeAll(BodyLimit.layer, installation.layer), { disableLogger: true, disableListenLog: true }).pipe(Layer.provide(installation.privacy)))
      yield* Effect.addFinalizer(() => Effect.sync(() => server.closeAllConnections?.()))
      yield* Effect.promise(() => run({ origin, incoming, web }))
    })).pipe(Effect.provide(platform.NodeHttpServer.layer(() => server, { host: "127.0.0.1", port: 0 }))), { signal: AbortSignal.timeout(18000) })
  } finally { server.closeAllConnections?.() }
}

test("HTTP abort94: normal POST reaches real EOF without aborting the final Request, then cleans up", async () => {
  const body = Buffer.from('{"action":"list","scope":{}}')
  expect(body.byteLength).toBe(28)
  await withListener(async (web) => {
    const bytes = await web.arrayBuffer()
    return Response.json({ received: bytes.byteLength })
  }, async ({ origin, incoming, web }) => {
    const result = await within(new Promise<{ status: number; body: string }>((resolve, reject) => {
      const outgoing = request(`${origin}/probe`, { method: "POST", agent: false, headers: {
        "content-length": String(body.byteLength), connection: "close",
      } }, (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.once("error", reject)
        response.once("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }))
      })
      outgoing.once("error", reject)
      outgoing.end(body)
    }), "NORMAL_POST")
    expect(result.status).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ received: 28 })
    expect(incoming).toHaveLength(1)
    expect(web).toHaveLength(1)
    await turn()
    await turn()
    expect(incoming[0]!.complete).toBe(true)
    expect(incoming[0]!.aborted).toBe(false)
    expect(web[0]!.signal.aborted).toBe(false)
    expect(incoming[0]!.listenerCount("aborted")).toBe(0)
    if (incoming[0]!.closed) {
      expect(incoming[0]!.listenerCount("error")).toBe(0)
      expect(incoming[0]!.listenerCount("close")).toBe(0)
    }
  })
}, 22000)

test("HTTP abort94: partial disconnect aborts the FINAL Request and rejects/releases its reader without queued-error crash", async () => {
  const first = latch()
  const settled = latch()
  const state = { rejected: false, eof: 0, postRead: 0, unlocked: false, bytes: 0 }
  await withListener(async (web) => {
    const stream = web.body
    if (!stream) throw new Error("HTTP_ABORT_94_BODY_REQUIRED")
    const reader = stream.getReader()
    try {
      while (true) {
        const item = await reader.read()
        if (item.done) { state.eof++; break }
        state.bytes += item.value.byteLength
        first.open()
      }
      state.postRead++
      return new Response(null, { status: 200 })
    } catch {
      state.rejected = true
      return new Response(null, { status: 400 })
    } finally {
      reader.releaseLock()
      state.unlocked = !stream.locked
      settled.open()
    }
  }, async ({ origin, incoming, web }) => {
    const outgoing = request(`${origin}/probe`, { method: "POST", agent: false, headers: {
      "content-length": "4096", connection: "close",
    } })
    // Intentional client disconnect; do not attach a diagnostic error handler to server IncomingMessage.
    outgoing.on("error", () => {})
    try {
      outgoing.write(Buffer.from("partial-94"))
      await within(first.promise, "FIRST_BODY_READ")
      expect(state.bytes).toBe(10)
      expect(web).toHaveLength(1)
      outgoing.destroy()
      await within(settled.promise, "ABORTED_READER_SETTLED")
      await turn()
      await turn()
      expect(state.rejected).toBe(true)
      expect(state.eof).toBe(0)
      expect(state.postRead).toBe(0)
      expect(state.unlocked).toBe(true)
      expect(web[0]!.signal.aborted).toBe(true)
      expect(incoming).toHaveLength(1)
      expect(incoming[0]!.complete).toBe(false)
      expect(incoming[0]!.aborted).toBe(true)
      expect(incoming[0]!.destroyed).toBe(true)
      expect(incoming[0]!.listenerCount("data")).toBe(0)
      expect(incoming[0]!.listenerCount("readable")).toBe(0)
      expect(incoming[0]!.listenerCount("error")).toBe(0)
      expect(incoming[0]!.listenerCount("aborted")).toBe(0)
      expect(incoming[0]!.listenerCount("close")).toBe(0)
    } finally { outgoing.destroy() }
  })
}, 22000)
