import { expect, test } from "bun:test"
import { limitRequestBody, readRequestBody } from "../runtime/request-body.ts"

const bytes = (value: string) => new TextEncoder().encode(value)

function fixture(input: { chunks?: readonly Uint8Array<ArrayBuffer>[]; brokenRelease?: boolean; pending?: boolean }) {
  const state = {
    pulls: 0, readers: 0, releases: 0, cancellationAttempts: 0, sourceCancellations: 0,
    closed: undefined as Promise<"closed" | "errored"> | undefined,
    controller: undefined as ReadableStreamDefaultController<Uint8Array<ArrayBuffer>> | undefined,
  }
  const started = Promise.withResolvers<void>()
  const chunks = [...(input.chunks ?? [])]
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) { state.controller = controller },
    pull(controller) {
      state.pulls++
      started.resolve()
      if (input.pending) return
      const chunk = chunks.shift()
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
    cancel() { state.sourceCancellations++ },
  }, { highWaterMark: 0 })
  const getReader = source.getReader.bind(source)
  Object.defineProperty(source, "getReader", { value: () => {
    state.readers++
    const reader = getReader()
    // Observe the original closed promise before release changes its reader ownership.
    state.closed = reader.closed.then(() => "closed", () => "errored")
    const cancel = reader.cancel.bind(reader)
    Object.defineProperty(reader, "cancel", { value: () => {
      state.cancellationAttempts++
      return cancel()
    } })
    const release = reader.releaseLock.bind(reader)
    Object.defineProperty(reader, "releaseLock", { value: () => {
      state.releases++
      if (input.brokenRelease) throw new TypeError("controlled native release fault")
      release()
    } })
    return reader
  } })
  return { source, state, started: started.promise }
}

function request(source: ReadableStream<Uint8Array<ArrayBuffer>>, input: { length?: string; signal?: AbortSignal } = {}) {
  const headers = input.length === undefined ? undefined : { "content-length": input.length }
  const value = new Request("https://fixture.example.test/body", {
    method: "POST", body: source, headers, signal: input.signal,
  })
  expect(value.body).toBe(source)
  return value
}

test("request body validates exact bytes at EOF and releases its single source reader", async () => {
  const f = fixture({ chunks: [bytes("a"), new Uint8Array(), bytes("bc")] })
  const original = request(f.source, { length: "3" })
  expect(await readRequestBody(original, 3)).toEqual(bytes("abc"))
  expect(original.bodyUsed).toBe(true)
  expect(f.state.readers).toBe(1)
  expect(f.state.pulls).toBe(4)
  expect(f.state.releases).toBe(1)
  expect(f.state.cancellationAttempts).toBe(0)
  expect(await f.state.closed).toBe("closed")
  expect(f.source.locked).toBe(false)
})

test("validated EOF settles despite a source release fault without rereading or claiming lock release", async () => {
  const f = fixture({ chunks: [bytes("ab"), bytes("cd")], brokenRelease: true })
  const original = request(f.source)
  expect(await readRequestBody(original, 4)).toEqual(bytes("abcd"))
  expect(original.bodyUsed).toBe(true)
  expect(f.state.readers).toBe(1)
  expect(f.state.pulls).toBe(3)
  expect(f.state.releases).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(f.state.sourceCancellations).toBe(0) // The source had already reached EOF.
  expect(await f.state.closed).toBe("closed")
  expect(f.source.locked).toBe(true) // A failed runtime release is not a successful unlock.
})

test("an actual byte overrun remains 413 and cancels before the next chunk despite release failure", async () => {
  const f = fixture({ chunks: [bytes("ab"), bytes("cde"), bytes("never read")], brokenRelease: true })
  const original = request(f.source)
  await expect(readRequestBody(original, 4)).rejects.toMatchObject({ name: "RequestBodyError", status: 413 })
  expect(f.state.pulls).toBe(2)
  expect(f.state.readers).toBe(1)
  expect(f.state.releases).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(f.state.sourceCancellations).toBe(1)
  expect(await f.state.closed).toBe("closed")
})

test.each([
  { label: "under-declared", body: "abcde", declared: "4", pulls: 1 },
  { label: "truncated", body: "abc", declared: "4", pulls: 2 },
])("a $label body remains 400 despite source release failure", async ({ body, declared, pulls }) => {
  const f = fixture({ chunks: [bytes(body)], brokenRelease: true })
  await expect(readRequestBody(request(f.source, { length: declared }), 8))
    .rejects.toMatchObject({ name: "RequestBodyError", status: 400 })
  expect(f.state.pulls).toBe(pulls)
  expect(f.state.releases).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(await f.state.closed).toBe("closed")
})

test("abort of a pending read settles as 400 and closes the source despite release failure", async () => {
  const controller = new AbortController()
  const f = fixture({ pending: true, brokenRelease: true })
  const rejected = expect(readRequestBody(request(f.source, { signal: controller.signal }), 8))
    .rejects.toMatchObject({ name: "RequestBodyError", status: 400 })
  await f.started
  controller.abort()
  await rejected
  expect(f.state.pulls).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(f.state.sourceCancellations).toBe(1)
  expect(await f.state.closed).toBe("closed")
})

test("a source error remains a body rejection while reader cleanup still runs", async () => {
  const f = fixture({ pending: true, brokenRelease: true })
  const rejected = expect(readRequestBody(request(f.source), 8))
    .rejects.toMatchObject({ name: "RequestBodyError", status: 400 })
  await f.started
  f.state.controller!.error(new Error("controlled upstream failure must not be public"))
  await rejected
  expect(f.state.releases).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(await f.state.closed).toBe("errored")
})

test("disposing an incompletely read bounded body cancels once and does not mark completion", async () => {
  const f = fixture({ chunks: [bytes("ab"), bytes("must not be read")], brokenRelease: true })
  const bounded = limitRequestBody(f.source, { limit: 20, signal: new AbortController().signal })
  const reader = bounded.body!.getReader()
  expect((await reader.read()).value).toEqual(bytes("ab"))
  bounded.dispose()
  bounded.dispose()
  await expect(reader.read()).rejects.toMatchObject({ name: "RequestBodyError", status: 400 })
  expect(bounded.complete()).toBe(false)
  expect(f.state.pulls).toBe(1)
  expect(f.state.cancellationAttempts).toBe(1)
  expect(f.state.sourceCancellations).toBe(1)
  expect(await f.state.closed).toBe("closed")
  reader.releaseLock()
})
