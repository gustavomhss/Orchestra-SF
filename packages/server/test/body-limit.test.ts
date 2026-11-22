import { expect, test } from "bun:test"
import { connect } from "node:net"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { Context, Effect, Layer, Stream } from "effect"
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { BodyLimit } from "../src/body-limit"
import { ownerA, sessionHttpFixture } from "./fixture/session-http"

const MiB = 1024 * 1024

// Routes read their body the way the API does (`orDie`), behind the real middleware, on a real TCP server.
const read = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  return HttpServerResponse.text(String((yield* Effect.orDie(request.arrayBuffer)).byteLength))
})
// Match HttpApiBuilder's JSON path: text is bounded/cached, then JSON.parse can throw a SyntaxError defect.
const readJson = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const text = yield* Effect.orDie(request.text)
  if (text !== "") JSON.parse(text)
  return HttpServerResponse.empty()
})
const routes = Layer.mergeAll(
  HttpRouter.add("POST", "/api/other", read),
  HttpRouter.add("POST", "/api/json", readJson),
  HttpRouter.add("POST", "/api/json-defect", readJson.pipe(Effect.andThen(Effect.die(new SyntaxError("handler defect"))))),
  HttpRouter.add("POST", "/api/session/ses_1/prompt", read),
  BodyLimit.layer,
)
const it = testEffect(
  HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provideMerge(NodeHttpServer.layerTest),
    Layer.provideMerge(NodeServices.layer),
  ),
)

const post = (route: string, size: number) =>
  HttpClientRequest.post(route).pipe(HttpClientRequest.bodyText("a".repeat(size)), HttpClient.execute)

// A raw socket declares or streams a body the HTTP client would not send, and stops reading as soon as the answer's
// headers arrive, so the server cutting the connection short cannot hide the status line.
const answer = (port: number, head: string, body?: () => AsyncIterable<string>) =>
  new Promise<string>((resolve) => {
    const socket = connect(port, "127.0.0.1")
    let received = ""
    socket.on("data", (data) => {
      received += data.toString()
      if (!received.includes("\r\n\r\n")) return
      socket.destroy()
      resolve(received)
    })
    socket.on("error", () => resolve(received))
    socket.on("close", () => resolve(received))
    socket.write(head)
    if (!body) return
    void (async () => {
      for await (const chunk of body()) {
        if (socket.destroyed) return
        await new Promise((written) => socket.write(chunk, written))
      }
    })()
  })

const port = Effect.gen(function* () {
  const server = yield* HttpServer.HttpServer
  if (server.address._tag !== "TcpAddress") return yield* Effect.die("Expected a TCP address")
  return server.address.port
})

const declared = (route: string, length: number) =>
  `POST ${route} HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${length}\r\n\r\n`

it.live("a body inside the limit is read", () =>
  Effect.gen(function* () {
    const response = yield* post("/api/other", 1024)
    expect(response.status).toBe(200)
    expect(yield* response.text).toBe("1024")
  }),
)

it.live("a body declared over the default limit is refused with 413 before it is read", () =>
  Effect.gen(function* () {
    const target = yield* port
    const received = yield* Effect.promise(() => answer(target, declared("/api/other", BodyLimit.DEFAULT_LIMIT + 1)))
    expect(received).toMatch(/^HTTP\/1\.1 413/)
    expect(received).toContain("PayloadTooLargeError")
  }),
)

it.live("a body over the default limit but inside the upload limit is read on an upload route only", () =>
  Effect.gen(function* () {
    const size = BodyLimit.DEFAULT_LIMIT + MiB
    const upload = yield* post("/api/session/ses_1/prompt", size)
    expect(upload.status).toBe(200)
    expect(yield* upload.text).toBe(String(size))
  }),
)

it.live("a body declared over the upload limit is refused with 413 on an upload route", () =>
  Effect.gen(function* () {
    const target = yield* port
    const received = yield* Effect.promise(() =>
      answer(target, declared("/api/session/ses_1/prompt", BodyLimit.UPLOAD_LIMIT + 1)),
    )
    expect(received).toMatch(/^HTTP\/1\.1 413/)
  }),
)

it.live("a chunked body with no declared length is cut off at the limit with 413", () =>
  Effect.gen(function* () {
    const target = yield* port
    const chunk = "a".repeat(MiB)
    const received = yield* Effect.promise(() =>
      answer(
        target,
        "POST /api/other HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n",
        async function* () {
          for (let sent = 0; sent <= BodyLimit.DEFAULT_LIMIT; sent += MiB) yield `${MiB.toString(16)}\r\n${chunk}\r\n`
          yield "0\r\n\r\n"
        },
      ),
    )
    expect(received).toMatch(/^HTTP\/1\.1 413/)
  }),
)

it.live("malformed JSON inside the body limit is a declared 400", () =>
  Effect.gen(function* () {
    const response = yield* HttpClientRequest.post("/api/json").pipe(
      HttpClientRequest.bodyText("{invalid"),
      HttpClientRequest.setHeader("content-type", "application/json; charset=utf-8"),
      HttpClient.execute,
    )
    expect(response.status).toBe(400)
    expect(yield* response.json).toEqual({
      _tag: "InvalidRequestError", message: "Invalid JSON request body", kind: "Payload",
    })
  }),
)

it.live("a handler SyntaxError with valid JSON remains a server defect", () =>
  Effect.gen(function* () {
    const response = yield* HttpClientRequest.post("/api/json-defect").pipe(
      HttpClientRequest.bodyText('{"valid":true}'),
      HttpClientRequest.setHeader("content-type", "application/json"),
      HttpClient.execute,
    )
    expect(response.status).toBe(500)
    yield* response.text
  }),
)


it.live("a handler SyntaxError with an empty JSON body remains a server defect", () =>
  Effect.gen(function* () {
    const response = yield* HttpClientRequest.post("/api/json-defect").pipe(
      HttpClientRequest.bodyText(""),
      HttpClientRequest.setHeader("content-type", "application/json"),
      HttpClient.execute,
    )
    expect(response.status).toBe(500)
    yield* response.text
  }),
)

test("the Web view preserves the original Request and shares bounded bytes across modified readers", async () => {
  const original = new Request("https://body-component.example/api/bytes", {
    method: "POST", headers: { "content-type": "application/json" }, body: '{"valid":true}',
  })
  const observed = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    expect(request.source).toBe(original)
    const modified = request.modify({ url: "/api/bytes?view=modified" })
    expect(modified.source).toBe(original)
    const bytes = yield* Effect.orDie(modified.arrayBuffer)
    expect(new TextDecoder().decode(bytes)).toBe('{"valid":true}')
    expect(yield* Effect.orDie(request.text)).toBe('{"valid":true}')
    expect(yield* Effect.orDie(modified.json)).toEqual({ valid: true })
    return HttpServerResponse.empty()
  })
  const web = HttpRouter.toWebHandler(Layer.mergeAll(
    HttpRouter.add("POST", "/api/bytes", observed), BodyLimit.layer,
  ).pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  try {
    expect(original.bodyUsed).toBe(false)
    const response = await web.handler(original, Context.makeUnsafe<unknown>(new Map()))
    expect(response.status).toBe(204)
    expect(original.bodyUsed).toBe(true)
  } finally { await web.dispose() }
})

test("Web text, arrayBuffer, stream and modified views enforce actual bytes before decoding", async () => {
  const byteCount = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    if (request.url === "/api/stream") {
      yield* Stream.runCollect(request.stream)
    } else if (request.url === "/api/array") {
      yield* Effect.orDie(request.arrayBuffer)
    } else {
      const view = request.url === "/api/modified" ? request.modify({ url: request.url }) : request
      yield* Effect.orDie(view.text)
    }
    return HttpServerResponse.empty()
  })
  const web = HttpRouter.toWebHandler(Layer.mergeAll(
    ...["text", "array", "stream", "modified"].map((name) => HttpRouter.add("POST", "/api/" + name, byteCount)),
    BodyLimit.withLimit(() => 4),
  ).pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  try {
    for (const name of ["text", "array", "stream", "modified"]) {
      const observed = { cancelled: 0, pulls: 0 }
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (observed.pulls === 3) return controller.close()
          observed.pulls++
          controller.enqueue(new Uint8Array(5))
        },
        cancel() { observed.cancelled++ },
      }, { highWaterMark: 0 })
      const response = await web.handler(new Request("https://body-component.example/api/" + name, {
        method: "POST", body, headers: { "content-type": "application/json" },
      }), Context.makeUnsafe<unknown>(new Map()))
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({ _tag: "PayloadTooLargeError" })
      expect(observed.pulls).toBe(1)
      expect(observed.cancelled).toBe(1)
    }
  } finally { await web.dispose() }
})

test("a Web handler SyntaxError with empty JSON stays500 while malformed nonempty JSON is400", async () => {
  const web = HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  try {
    for (const [pathname, body, status] of [
      ["/api/json-defect", "", 500], ["/api/json-defect", '{"valid":true}', 500], ["/api/json", "{invalid", 400],
    ] as const) {
      const response = await web.handler(new Request("https://body-component.example" + pathname, {
        method: "POST", body, headers: { "content-type": "application/json" },
      }), Context.makeUnsafe<unknown>(new Map()))
      expect(response.status).toBe(status)
      await response.arrayBuffer()
    }
  } finally { await web.dispose() }
})

const corporate = test.skipIf(process.platform === "win32")

corporate("the actual prefixed Session Web adapter cancels over-limit bodies without writes or resume", async () => {
  await using fixture = await sessionHttpFixture()
  await fixture.run((http) => Effect.gen(function* () {
    const own = yield* fixture.seed("ses_http_actual_byte_limit")
    const snapshot = () => JSON.stringify({
      sessions: fixture.business.all("SELECT * FROM session"),
      owners: fixture.business.all("SELECT * FROM session_owner"),
      inputs: fixture.business.all("SELECT * FROM session_input"),
      events: fixture.business.all("SELECT * FROM event"),
    })
    const before = snapshot()
    for (const [suffix, limit] of [["/rename", BodyLimit.DEFAULT_LIMIT], ["/prompt", BodyLimit.UPLOAD_LIMIT]] as const) {
      const observed = { chunks: 0, cancelled: 0 }
      const chunk = new Uint8Array(MiB).fill(97)
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (observed.chunks > limit / MiB + 2) return controller.close()
          observed.chunks++
          controller.enqueue(chunk)
        },
        cancel() { observed.cancelled++ },
      }, { highWaterMark: 0 })
      const request = http.request("/api/session/" + own.id + suffix, ownerA, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      })
      expect(request.headers.has("content-length")).toBe(false)
      const admissions = http.originals.length
      const response = yield* Effect.promise(() => http.direct(request))
      expect(response.status).toBe(413)
      expect(yield* Effect.promise(() => response.json())).toMatchObject({ _tag: "PayloadTooLargeError" })
      expect(observed.chunks).toBe(limit / MiB + 1)
      expect(observed.cancelled).toBe(1)
      expect(http.originals.length).toBeGreaterThan(admissions)
      expect(http.originals.slice(admissions).every((original) => original === request)).toBe(true)
      expect(snapshot()).toBe(before)
      expect(fixture.calls.resumes).toBe(0)
      expect(fixture.calls.wakes).toBe(0)
      expect(fixture.control.pendingWriters(fixture.storage)).toEqual([])
    }
  }))
})

corporate("the actual prefixed upload route keeps its larger byte cap with no declared length", async () => {
  await using fixture = await sessionHttpFixture()
  await fixture.run((http) => Effect.gen(function* () {
    const own = yield* fixture.seed("ses_http_actual_upload_limit")
    const request = http.request("/api/session/" + own.id + "/prompt", ownerA, {
      method: "POST", headers: { "content-type": "application/json" },
      body: "a".repeat(BodyLimit.DEFAULT_LIMIT + 1),
    })
    request.headers.delete("content-length")
    expect(request.headers.has("content-length")).toBe(false)
    const response = yield* Effect.promise(() => http.direct(request))
    // Fully consumed under 64MiB, then rejected by the original JSON parser.
    expect(response.status).toBe(400)
    expect(yield* Effect.promise(() => response.json())).toMatchObject({ _tag: "InvalidRequestError" })
    expect(fixture.calls.resumes).toBe(0)
    expect(fixture.calls.wakes).toBe(0)
    expect(fixture.business.all("SELECT * FROM session_input")).toEqual([])
    expect(fixture.control.pendingWriters(fixture.storage)).toEqual([])
  }))
})
