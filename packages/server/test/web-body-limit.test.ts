import { expect, test } from "bun:test"
import { NodeServices } from "@effect/platform-node"
import { Effect, Fiber, Layer, Schema, Stream } from "effect"
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { BodyLimit } from "../src/body-limit"
import { boundedWebRequest } from "../src/web-body-limit"

function suppliedBody(chunks: readonly Uint8Array[]) {
  const state = { pulls: 0, cancelled: 0 }
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[state.pulls++]
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
    cancel() { state.cancelled++ },
  }, { highWaterMark: 0 })
  return { body, state }
}

function pendingBody() {
  const started = Promise.withResolvers<void>()
  const cancelled = Promise.withResolvers<void>()
  const body = new ReadableStream<Uint8Array>({
    pull() { started.resolve() },
    cancel() { cancelled.resolve() },
  }, { highWaterMark: 0 })
  return { body, started: started.promise, cancelled: cancelled.promise }
}

test("bounded Web views share original bytes through text, json, arrayBuffer and modify", async () => {
  const input = new TextEncoder().encode('{"value":"café"}')
  const f = suppliedBody([input.subarray(0, 11), input.subarray(11)])
  const original = new Request("http://localhost/api/original", { method: "POST", body: f.body })
  const request = boundedWebRequest(HttpServerRequest.fromWeb(original), input.byteLength)
  const modified = request.modify({ url: "/api/modified" })
  expect(request.source).toBe(original)
  expect(modified.source).toBe(original)
  expect(modified.url).toBe("/api/modified")
  expect(modified.originalUrl).toBe(original.url)
  expect(await Effect.runPromise(modified.text)).toBe('{"value":"café"}')
  expect(await Effect.runPromise(request.json)).toEqual({ value: "café" })
  expect(new Uint8Array(await Effect.runPromise(modified.arrayBuffer))).toEqual(input)
  expect(await Effect.runPromise(request.text)).toBe('{"value":"café"}')
  expect(f.state).toEqual({ pulls: 3, cancelled: 0 })

  const oversized = suppliedBody([input, input])
  const source = new Request("http://localhost/api/limited", { method: "POST", body: oversized.body,
    headers: { "content-length": "1" } })
  const limited = boundedWebRequest(HttpServerRequest.fromWeb(source), input.byteLength - 1).modify({ url: "/api/changed" })
  expect(limited.source).toBe(source)
  const result = await Effect.runPromise(Effect.exit(limited.text))
  expect(result._tag).toBe("Failure")
  expect(oversized.state).toEqual({ pulls: 1, cancelled: 1 })
})

test("aborting the original Web Request cancels a pending bounded read", async () => {
  const f = pendingBody()
  const controller = new AbortController()
  const source = new Request("http://localhost/api/abort", { method: "POST", body: f.body, signal: controller.signal })
  const request = boundedWebRequest(HttpServerRequest.fromWeb(source), BodyLimit.DEFAULT_LIMIT)
  const result = Effect.runPromise(Effect.exit(request.text))
  await f.started
  controller.abort()
  await f.cancelled
  expect((await result)._tag).toBe("Failure")
  expect(request.source).toBe(source)
}, 5000)

test("interrupting the Effect cancels the original pending Web reader", async () => {
  const f = pendingBody()
  const source = new Request("http://localhost/api/interrupt", { method: "POST", body: f.body })
  const request = boundedWebRequest(HttpServerRequest.fromWeb(source), BodyLimit.DEFAULT_LIMIT)
  const fiber = Effect.runFork(request.arrayBuffer)
  await f.started
  await Effect.runPromise(Fiber.interrupt(fiber))
  await f.cancelled
  expect(request.source).toBe(source)
}, 5000)

function webApi() {
  const calls: string[] = []
  const originals: object[] = []
  const api = HttpApi.make("bounded-web").add(HttpApiGroup.make("body").add(
    HttpApiEndpoint.post("empty", "/api/empty"),
    HttpApiEndpoint.post("emptyDefect", "/api/empty-defect"),
    HttpApiEndpoint.post("json", "/api/json", { payload: Schema.Struct({ value: Schema.String }) }),
    HttpApiEndpoint.post("jsonDefect", "/api/json-defect", { payload: Schema.Struct({ value: Schema.String }) }),
  ))
  const handlers = HttpApiBuilder.group(api, "body", (group) => group
    .handle("empty", ({ request }) => Effect.sync(() => { calls.push("empty"); originals.push(request.source) }))
    // This payload-free handler does not read or parse the body before its own defect.
    .handle("emptyDefect", ({ request }) => Effect.sync(() => {
      calls.push("emptyDefect"); originals.push(request.source)
      throw new SyntaxError("payload-free handler defect")
    }))
    .handle("json", ({ request }) => Effect.sync(() => { calls.push("json"); originals.push(request.source) }))
    .handle("jsonDefect", ({ request }) => Effect.sync(() => {
      calls.push("jsonDefect"); originals.push(request.source)
      throw new SyntaxError("decoded handler defect")
    })))
  const routes = HttpApiBuilder.layer(api).pipe(
    Layer.provide(handlers), Layer.provide(BodyLimit.layer),
    Layer.provide(HttpServer.layerServices), Layer.provide(NodeServices.layer),
  )
  return { ...HttpRouter.toWebHandler(routes, { disableLogger: true }), calls, originals }
}

test("real Web HttpApi preserves empty JSON semantics and distinguishes parsing from handler defects", async () => {
  const http = webApi()
  try {
    for (const [route, body, status, invoked] of [
      ["/empty", "", 204, true],
      ["/empty-defect", "", 500, true],
      ["/json", "{invalid", 400, false],
      ["/json", '{"value":"valid"}', 204, true],
      ["/json-defect", '{"value":"valid"}', 500, true],
    ] as const) {
      const original = new Request("http://localhost/api" + route, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      })
      const response = await http.handler(original)
      expect(response.status).toBe(status)
      if (status === 400) expect(await response.json()).toEqual({
        _tag: "InvalidRequestError", message: "Invalid JSON request body", kind: "Payload",
      })
      else await response.text()
      expect(http.originals.includes(original)).toBe(invoked)
    }
    expect(http.calls).toEqual(["empty", "emptyDefect", "json", "jsonDefect"])
  } finally { await http.dispose() }
})

test("declared Web overflow cancels the untouched source before decoding or invoking a handler", async () => {
  const http = webApi()
  const f = suppliedBody([new TextEncoder().encode('{"value":"unused"}')])
  const original = new Request("http://localhost/api/json", {
    method: "POST", body: f.body,
    headers: { "content-type": "application/json", "content-length": String(BodyLimit.DEFAULT_LIMIT + 1) },
  })
  try {
    const response = await http.handler(original)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ _tag: "PayloadTooLargeError" })
    expect(f.state).toEqual({ pulls: 0, cancelled: 1 })
    expect(http.calls).toEqual([])
  } finally { await http.dispose() }
})

test("typed Web stream overflow returns 413 and cancels the original body through a modified view", async () => {
  const f = suppliedBody([new Uint8Array(5), new Uint8Array(5)])
  const original = new Request("http://localhost/api/stream", { method: "POST", body: f.body })
  const consume = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const modified = request.modify({ url: request.url })
    expect(request.source).toBe(original)
    expect(modified.source).toBe(original)
    // Deliberately retain the typed failure channel; no orDie hides the missing middleware boundary.
    yield* Stream.runCollect(modified.stream)
    return HttpServerResponse.empty()
  })
  const routes = Layer.mergeAll(HttpRouter.add("POST", "/api/stream", consume), BodyLimit.withLimit(() => 4))
    .pipe(Layer.provide(HttpServer.layerServices))
  const http = HttpRouter.toWebHandler(routes, { disableLogger: true })
  try {
    expect(original.headers.has("content-length")).toBe(false)
    const response = await http.handler(original)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ _tag: "PayloadTooLargeError" })
    expect(f.state).toEqual({ pulls: 1, cancelled: 1 })
  } finally { await http.dispose() }
})

test("a payload-free handler SyntaxError neither reads nor reclassifies malformed request bytes", async () => {
  const http = webApi()
  const f = suppliedBody([new TextEncoder().encode("{invalid")])
  const original = new Request("http://localhost/api/empty-defect", {
    method: "POST", body: f.body, headers: { "content-type": "application/json" },
  })
  try {
    const response = await http.handler(original)
    expect(response.status).toBe(500)
    await response.text()
    expect(http.calls).toEqual(["emptyDefect"])
    expect(http.originals).toEqual([original])
    expect(original.bodyUsed).toBe(false)
    expect(f.state).toEqual({ pulls: 0, cancelled: 0 })
  } finally {
    await original.body?.cancel()
    await http.dispose()
  }
})
