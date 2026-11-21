/** Public errors contain no body, URL, cookie or upstream failure details. */
export class RequestBodyError extends Error {
  readonly status: 400 | 413

  constructor(status: 400 | 413) {
    super(status === 413 ? "Request body too large" : "Invalid request body")
    this.name = "RequestBodyError"
    this.status = status
  }
}

/** Validate the hint without allocating from it; the stream must still match it. */
export function requestBodyLength(value: string | null, limit: number): number | undefined {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("Finite request body limit required")
  if (value === null) return undefined
  if (!/^[0-9]+$/.test(value)) throw new RequestBodyError(400)
  const length = Number(value)
  if (length > limit || !Number.isSafeInteger(length)) throw new RequestBodyError(413)
  return length
}

/** One lazy reader, zero read-ahead and a byte budget checked before enqueueing. */
export function limitRequestBody(source: ReadableStream<Uint8Array> | null, input: {
  limit: number
  declared?: number
  signal: AbortSignal
}) {
  const state = {
    bytes: 0,
    ended: false,
    complete: !source,
    failure: undefined as RequestBodyError | undefined,
    reader: undefined as ReadableStreamDefaultReader<Uint8Array> | undefined,
    controller: undefined as ReadableStreamDefaultController<Uint8Array> | undefined,
  }
  const release = (cancel: boolean) => {
    input.signal.removeEventListener("abort", aborted)
    const reader = state.reader
    state.reader = undefined
    // Cancel closes pending reads synchronously. Do not await an arbitrary source's cancel hook.
    if (reader) {
      if (cancel) void reader.cancel().catch(() => undefined)
      reader.releaseLock()
      return
    }
    if (cancel && source && !source.locked) void source.cancel().catch(() => undefined)
  }
  const reject = (status: 400 | 413) => {
    if (state.ended) return
    state.ended = true
    state.failure = new RequestBodyError(status)
    state.controller?.error(state.failure)
    release(true)
  }
  const aborted = () => reject(400)
  const body = source ? new ReadableStream<Uint8Array>({
    start(controller) {
      state.controller = controller
      input.signal.addEventListener("abort", aborted, { once: true })
      if (input.signal.aborted) aborted()
    },
    async pull(controller) {
      if (state.ended) return
      try {
        const reader = state.reader ??= source.getReader()
        for (;;) {
          const chunk = await reader.read()
          if (state.ended) return
          if (input.signal.aborted) return reject(400)
          if (chunk.done) {
            if (input.declared !== undefined && state.bytes !== input.declared) return reject(400)
            state.ended = true
            state.complete = true
            release(false)
            controller.close()
            return
          }
          if (!(chunk.value instanceof Uint8Array)) return reject(400)
          if (!chunk.value.byteLength) continue
          if (chunk.value.byteLength > input.limit - state.bytes) return reject(413)
          if (input.declared !== undefined && chunk.value.byteLength > input.declared - state.bytes) return reject(400)
          state.bytes += chunk.value.byteLength
          controller.enqueue(chunk.value)
          return
        }
      } catch {
        reject(400)
      }
    },
    cancel() {
      if (state.ended) return
      state.ended = true
      release(true)
    },
  }, { highWaterMark: 0 }) : null
  if (!source && input.declared) state.failure = new RequestBodyError(400)
  return {
    body,
    failure: () => state.failure,
    complete: () => state.complete,
    dispose() {
      if (state.ended) return
      state.ended = true
      state.controller?.error(new RequestBodyError(400))
      release(true)
    },
  }
}

/** Read the existing Request once; no cloning after authentication or command binding. */
export async function readRequestBody(request: Request, limit: number): Promise<Uint8Array> {
  const declared = (() => {
    try {
      return requestBodyLength(request.headers.get("content-length"), limit)
    } catch (error) {
      if (request.body && !request.body.locked) void request.body.cancel().catch(() => undefined)
      throw error
    }
  })()
  const bounded = limitRequestBody(request.body, { limit, declared, signal: request.signal })
  const reader = bounded.body?.getReader()
  const chunks: Uint8Array[] = []
  const size = { bytes: 0 }
  try {
    if (bounded.failure()) throw bounded.failure()
    if (request.signal.aborted) throw new RequestBodyError(400)
    if (!reader) return new Uint8Array()
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size.bytes += chunk.value.byteLength
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size.bytes)
    chunks.reduce((offset, chunk) => {
      bytes.set(chunk, offset)
      return offset + chunk.byteLength
    }, 0)
    return bytes
  } finally {
    reader?.releaseLock()
    bounded.dispose()
  }
}
