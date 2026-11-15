import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"

export type Installation79 = {
  mount: `/${string}`
  handler: (request: Request) => Promise<Response | undefined>
  dispose: () => void | Promise<void>
  transport?: unknown
}

type Composed79 = Installation79 & {
  layer: Layer.Layer<never, never, HttpRouter.HttpRouter>
  privacy: Layer.Layer<never>
}

type NodeServer79 = {
  layer: (
    evaluate: () => ReturnType<typeof createServer>,
    options: { host: string; port: number },
  ) => Layer.Layer<HttpServer.HttpServer, unknown>
}

type Event79 = { sequence: number; elapsedMs: number; event: string }
type Mark79 = (event: string) => void
// Module-local identity tables. No globals, Request replacement or stream substitution.
const webMarks79 = new WeakMap<Request, Mark79>()
const incomingMarks79 = new WeakMap<object, Mark79>()

export function mark79(request: Request, event: string) {
  webMarks79.get(request)?.(event)
}

export function markIncoming79(source: object, event: string) {
  incomingMarks79.get(source)?.(event)
}

export type Snapshot79 = {
  id: string
  method: string
  declaredLength: number | null
  chunked: boolean
  events: Event79[]
  droppedEvents: number
  node: ReturnType<typeof nodeState79>
  socket: {
    destroyed: boolean
    readableEnded: boolean
    eofInProgress: boolean | null
    pushCalls: number
    pushNull: number
    pushedBytes: number
  }
  readCalls: number
  readNull: number
  readBytes: number
  readValueCallers: string[]
  pushCalls: number
  pushNull: number
  pushedBytes: number
  bodyReaderCalls: number
  bodyReadCalls: number
  bodyReadDone: number
  bodyReadBytes: number
  handlerEntered: boolean
  handlerCompleted: boolean
  responseFinished: boolean
  signalAborted: boolean | null
}

export async function withListener79<T>(options: {
  compose: (value: unknown, origin: string) => Promise<Composed79>
  create: (listener: string) => Promise<Installation79>
  run: (context: {
    listener: string
    server: ReturnType<typeof createServer>
    installation: Installation79
    capture: { take: () => Snapshot79[] }
  }) => Promise<T>
  port?: number
  hostname?: string
  observeRequestErrors?: boolean
}) {
  // Resolve the existing adapter from its owning package, as microsoft-node.test.ts does.
  // This helper is published at test/product/installed-post-cause/listener79.ts.
  const cli = createRequire(path.resolve(import.meta.dir, "../../../../../../apps/cli/package.json"))
  const platform = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href) as { NodeHttpServer: NodeServer79 }
  const server = createServer()
  const capture = capture79(server, options.observeRequestErrors ?? true)
  const hostname = options.hostname ?? "127.0.0.1"
  try {
    return await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const httpServer = yield* HttpServer.HttpServer
      if (httpServer.address._tag !== "TcpAddress") throw new Error("M79_TCP_LISTENER_REQUIRED")
      const listener = `http://${hostname}:${httpServer.address.port}`
      const application = yield* Effect.acquireRelease(
        Effect.promise(() => options.create(listener)),
        (application) => Effect.promise(async () => { await application.dispose() }),
      )
      // Close only this fixture's sockets before app/server scope disposal can wait on them.
      yield* Effect.addFinalizer(() => Effect.sync(() => capture.closeConnections()))
      const handler = application.handler
      const installation = yield* Effect.promise(() => options.compose({
        ...application,
        handler(this: Installation79, request: Request) {
          capture.observe(request)
          mark79(request, "handler.enter")
          const result = Reflect.apply(handler, this, [request]) as Promise<Response | undefined>
          result.then(
            () => mark79(request, "handler.complete"),
            () => mark79(request, "handler.rejected"),
          )
          return result
        },
      }, listener))
      yield* Layer.build(HttpRouter.serve(installation.layer, { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provide(installation.privacy),
      ))
      return yield* Effect.promise(() => options.run({ listener, server, installation, capture }))
    })).pipe(Effect.provide(platform.NodeHttpServer.layer(() => server, { host: hostname, port: options.port ?? 0 }))))
  } finally {
    capture.closeConnections()
    capture.dispose()
    const cleanup = capture.cleanupState()
    console.log("M79_CLEANUP " + JSON.stringify(cleanup))
    if (cleanup.listening || cleanup.openOwnedSockets || cleanup.remainingObservers) throw new Error("M79_LISTENER_CLEANUP_FAILED")
  }
}

function capture79(server: ReturnType<typeof createServer>, observeRequestErrors: boolean) {
  const restore: Array<() => void> = []
  const sockets = new Set<IncomingMessage["socket"]>()
  const socketStates = new WeakMap<IncomingMessage["socket"], { pushCalls: number; pushNull: number; pushedBytes: number }>()
  const records: Array<{
    incoming: IncomingMessage
    id: string
    started: number
    events: Event79[]
    droppedEvents: number
    readCalls: number
    readNull: number
    readBytes: number
    readValueCallers: string[]
    pushCalls: number
    pushNull: number
    pushedBytes: number
    bodyReaderCalls: number
    bodyReadCalls: number
    bodyReadDone: number
    bodyReadBytes: number
    web?: Request
    handlerEntered: boolean
    handlerCompleted: boolean
    responseFinished: boolean
    mark: Mark79
  }> = []

  function replace(target: object, name: string, wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) {
    const previous = Object.getOwnPropertyDescriptor(target, name)
    const original: unknown = Reflect.get(target, name)
    if (typeof original !== "function") throw new Error("M79_METHOD_MISSING")
    Object.defineProperty(target, name, { configurable: true, writable: true, value: wrap(original as (...args: unknown[]) => unknown) })
    restore.push(() => {
      if (previous) Object.defineProperty(target, name, previous)
      else Reflect.deleteProperty(target, name)
    })
  }

  function connection(socket: IncomingMessage["socket"]) {
    sockets.add(socket)
    const state = { pushCalls: 0, pushNull: 0, pushedBytes: 0 }
    socketStates.set(socket, state)
    replace(socket, "push", (original) => function(this: unknown, ...args: unknown[]) {
      state.pushCalls++
      if (args[0] === null) state.pushNull++
      state.pushedBytes += byteLength79(args[0])
      return Reflect.apply(original, this, args)
    })
  }

  function incoming(request: IncomingMessage, response: ServerResponse) {
    const token = request.headers["x-m79-probe-id"]
    const record = {
      incoming: request,
      id: typeof token === "string" && /^[A-Za-z0-9_-]{1,48}$/.test(token) ? token : `req-${records.length + 1}`,
      started: performance.now(), events: [] as Event79[], droppedEvents: 0,
      readCalls: 0, readNull: 0, readBytes: 0, readValueCallers: [] as string[],
      pushCalls: 0, pushNull: 0, pushedBytes: 0,
      bodyReaderCalls: 0, bodyReadCalls: 0, bodyReadDone: 0, bodyReadBytes: 0,
      handlerEntered: false, handlerCompleted: false, responseFinished: false,
      web: undefined as Request | undefined,
      mark: (_event: string) => {},
    }
    record.mark = (event) => {
      if (event === "handler.enter") record.handlerEntered = true
      if (event === "handler.complete") record.handlerCompleted = true
      if (event === "node.response.finish") record.responseFinished = true
      if (record.events.length === 100) { record.droppedEvents++; return }
      record.events.push({ sequence: record.events.length + 1, elapsedMs: Math.round((performance.now() - record.started) * 1000) / 1000,
        event: /^[A-Za-z0-9_.:-]{1,80}$/.test(event) ? event : "invalid-mark" })
    }
    records.push(record)
    incomingMarks79.set(request, record.mark)
    restore.push(() => incomingMarks79.delete(request))
    record.mark("node.request")
    replace(request, "read", (original) => function(this: unknown, ...args: unknown[]) {
      record.readCalls++
      record.mark("node.read.start")
      const result: unknown = Reflect.apply(original, this, args)
      if (result === null) record.readNull++
      record.readBytes += byteLength79(result)
      if (result !== null && record.readValueCallers.length < 8) {
        const caller = new Error().stack?.split("\n").slice(1).find((line) => !line.includes("installed-post-cause/listener79.ts")) ?? ""
        record.readValueCallers.push(caller.includes("platform-node") ? "effect-node-adapter" : /readable|node:stream|internal\/streams/.test(caller) ? "node-readable" : "unclassified")
      }
      record.mark(result === null ? "node.read.null" : "node.read.value")
      return result
    })
    replace(request, "push", (original) => function(this: unknown, ...args: unknown[]) {
      record.pushCalls++
      if (args[0] === null) record.pushNull++
      record.pushedBytes += byteLength79(args[0])
      record.mark(args[0] === null ? "node.push.null" : "node.push.value")
      return Reflect.apply(original, this, args)
    })
    // No data/readable observer: those change the mode of the stream under diagnosis.
    for (const event of ["end", "aborted", ...(observeRequestErrors ? ["error"] : []), "close"]) {
      const listener = () => record.mark(`node.${event}`)
      request.on(event, listener)
      restore.push(() => request.off(event, listener))
    }
    for (const event of ["finish", "close"]) {
      const listener = () => record.mark(`node.response.${event}`)
      response.on(event, listener)
      restore.push(() => response.off(event, listener))
    }
  }

  server.on("connection", connection)
  server.prependListener("request", incoming)
  restore.push(() => server.off("connection", connection), () => server.off("request", incoming))

  return {
    observe(request: Request) {
      const token = request.headers.get("x-m79-probe-id")
      const record = token ? records.find((item) => item.id === token && !item.web) : records.find((item) => !item.web && item.incoming.method === request.method)
      if (!record) throw new Error("M79_REQUEST_CORRELATION_MISSING")
      record.web = request
      webMarks79.set(request, record.mark)
      restore.push(() => webMarks79.delete(request))
      const abort = () => record.mark("web.signal.abort")
      request.signal.addEventListener("abort", abort, { once: true })
      restore.push(() => request.signal.removeEventListener("abort", abort))
      for (const name of ["text", "json", "arrayBuffer"]) {
        replace(request, name, (original) => function(this: unknown, ...args: unknown[]) {
          record.mark(`web.${name}.start`)
          const result = Reflect.apply(original, this, args) as Promise<unknown>
          result.then(() => record.mark(`web.${name}.complete`), () => record.mark(`web.${name}.rejected`))
          return result
        })
      }
      const body = request.body
      if (!body) return
      const readers = new WeakSet<object>()
      replace(body, "getReader", (original) => function(this: unknown, ...args: unknown[]) {
        record.bodyReaderCalls++
        record.mark("web.getReader.start")
        const reader = Reflect.apply(original, this, args) as ReadableStreamDefaultReader<unknown>
        record.mark("web.getReader.complete")
        if (readers.has(reader)) return reader
        readers.add(reader)
        replace(reader, "read", (read) => function(this: unknown, ...args: unknown[]) {
          record.bodyReadCalls++
          record.mark("web.reader.read.start")
          const result = Reflect.apply(read, this, args) as Promise<ReadableStreamReadResult<unknown>>
          result.then((value) => {
            if (value.done) record.bodyReadDone++
            record.bodyReadBytes += byteLength79(value.value)
            record.mark(value.done ? "web.reader.read.done" : "web.reader.read.value")
          }, () => record.mark("web.reader.read.rejected"))
          return result
        })
        replace(reader, "cancel", (cancel) => function(this: unknown, ...args: unknown[]) {
          record.mark("web.reader.cancel.start")
          const result = Reflect.apply(cancel, this, args) as Promise<void>
          result.then(() => record.mark("web.reader.cancel.complete"), () => record.mark("web.reader.cancel.rejected"))
          return result
        })
        replace(reader, "releaseLock", (release) => function(this: unknown, ...args: unknown[]) {
          record.mark("web.reader.releaseLock")
          return Reflect.apply(release, this, args)
        })
        return reader
      })
    },
    take(): Snapshot79[] {
      return records.map((record) => {
        const length = record.incoming.headers["content-length"]
        const socket = record.incoming.socket
        return {
          id: record.id, method: record.incoming.method ?? "UNKNOWN",
          declaredLength: typeof length === "string" && /^\d{1,12}$/.test(length) ? Number(length) : null,
          chunked: record.incoming.headers["transfer-encoding"] === "chunked",
          events: record.events.map((event) => ({ ...event })), droppedEvents: record.droppedEvents,
          node: nodeState79(record.incoming),
          socket: { destroyed: socket.destroyed, readableEnded: socket.readableEnded, eofInProgress: eof79(socket),
            ...(socketStates.get(socket) ?? { pushCalls: 0, pushNull: 0, pushedBytes: 0 }) },
          readCalls: record.readCalls, readNull: record.readNull, readBytes: record.readBytes, readValueCallers: [...record.readValueCallers],
          pushCalls: record.pushCalls, pushNull: record.pushNull, pushedBytes: record.pushedBytes,
          bodyReaderCalls: record.bodyReaderCalls, bodyReadCalls: record.bodyReadCalls,
          bodyReadDone: record.bodyReadDone, bodyReadBytes: record.bodyReadBytes,
          handlerEntered: record.handlerEntered, handlerCompleted: record.handlerCompleted,
          responseFinished: record.responseFinished, signalAborted: record.web?.signal.aborted ?? null,
        }
      })
    },
    closeConnections() {
      server.closeAllConnections?.()
      sockets.forEach((socket) => { if (!socket.destroyed) socket.destroy() })
    },
    dispose() { restore.splice(0).reverse().forEach((close) => close()) },
    cleanupState() {
      return { listening: server.listening, diagnosticErrorObserver: observeRequestErrors, trackedSockets: sockets.size,
        openOwnedSockets: [...sockets].filter((socket) => !socket.destroyed).length, remainingObservers: restore.length }
    },
  }
}

function nodeState79(request: IncomingMessage) {
  return { complete: request.complete, readableEnded: request.readableEnded, destroyed: request.destroyed,
    aborted: request.aborted, readableLength: request.readableLength, eofInProgress: eof79(request) }
}

function eof79(value: object): boolean | null {
  const symbol = Object.getOwnPropertySymbols(value).find((key) => key.description === "eofInProgress")
  if (!symbol) return null
  const flag: unknown = Reflect.get(value, symbol)
  return typeof flag === "boolean" ? flag : null
}

function byteLength79(value: unknown) {
  if (typeof value === "string") return Buffer.byteLength(value)
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (value instanceof ArrayBuffer) return value.byteLength
  return 0
}
