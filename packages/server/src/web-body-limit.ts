import { Effect, Stream } from "effect"
import { HttpServerError, HttpServerRequest } from "effect/unstable/http"

/** Limit the Web producer's reads while keeping its authenticated source object. */
export function boundedWebRequest(request: HttpServerRequest.HttpServerRequest, limit: number) {
  const source = request.source
  if (!(source instanceof Request) || !source.body) return request
  const originalBody = source.body
  const state: {
    bytes: number
    ended: boolean
    reader?: ReadableStreamDefaultReader<Uint8Array>
    controller?: ReadableStreamDefaultController<Uint8Array>
  } = { bytes: 0, ended: false }
  const release = (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    // Cleanup must not turn a settled EOF/error into an unfinished body.
    void Promise.resolve().then(() => reader.releaseLock()).catch(() => undefined)
  }
  const stop = (reason: unknown) => {
    if (state.ended) return
    state.ended = true
    source.signal.removeEventListener("abort", aborted)
    if (state.reader) {
      void state.reader.cancel(reason).catch(() => undefined)
      release(state.reader)
      return
    }
    void originalBody.cancel(reason).catch(() => undefined)
  }
  const fail = (reason: unknown) => {
    if (state.ended) return
    state.controller?.error(reason)
    stop(reason)
  }
  const aborted = () => fail(source.signal.reason ?? new DOMException("Request aborted", "AbortError"))
  const body = new ReadableStream<Uint8Array>({
    start(controller) { state.controller = controller },
    async pull(controller) {
      if (state.ended) return
      if (source.signal.aborted) return aborted()
      try {
        if (!state.reader) {
          if (source.bodyUsed) throw new TypeError("Request body already used")
          state.reader = originalBody.getReader()
          source.signal.addEventListener("abort", aborted, { once: true })
        }
        const chunk = await state.reader.read()
        if (state.ended) return
        if (chunk.done) {
          state.ended = true
          source.signal.removeEventListener("abort", aborted)
          controller.close()
          release(state.reader)
          return
        }
        if (!(chunk.value instanceof Uint8Array)) throw new TypeError("Request body must contain bytes")
        state.bytes += chunk.value.byteLength
        if (state.bytes > limit) return fail(new Error("maxBytes exceeded"))
        controller.enqueue(chunk.value)
      } catch (cause) { fail(cause) }
    },
    cancel(reason) { stop(reason) },
  }, { highWaterMark: 0 })
  const parseError = (cause: unknown) => new HttpServerError.HttpServerError({
    reason: new HttpServerError.RequestParseError({ request, cause }),
  })
  const bytes = Effect.runSync(Effect.cached(Effect.tryPromise({
    try: (signal) => {
      const interrupt = () => fail(signal.reason ?? new DOMException("Body read interrupted", "AbortError"))
      signal.addEventListener("abort", interrupt, { once: true })
      if (signal.aborted) interrupt()
      // Response only consumes the bounded stream; the original Request is never cloned or replaced.
      return new Response(body).arrayBuffer().finally(() => signal.removeEventListener("abort", interrupt))
    },
    catch: parseError,
  })))
  const text = Effect.runSync(Effect.cached(Effect.map(bytes, (value) => new TextDecoder().decode(value))))
  const stream = Stream.fromReadableStream({ evaluate: () => body, onError: parseError })
  const view = (current: HttpServerRequest.HttpServerRequest): HttpServerRequest.HttpServerRequest => new Proxy(current, {
    get(target, property, receiver) {
      if (property === "arrayBuffer") return bytes
      if (property === "text") return text
      if (property === "stream") return stream
      if (property === "modify") return (options: Parameters<HttpServerRequest.HttpServerRequest["modify"]>[0]) =>
        view(target.modify(options))
      // The pin's json/urlParamsBody/multipart accessors read this.text/this.stream.
      return Reflect.get(target, property, receiver)
    },
  })
  return view(request)
}

export function cancelUnreadWebBody(request: HttpServerRequest.HttpServerRequest) {
  if (request.source instanceof Request && request.source.body && !request.source.body.locked)
    void request.source.body.cancel(new Error("maxBytes exceeded")).catch(() => undefined)
}
