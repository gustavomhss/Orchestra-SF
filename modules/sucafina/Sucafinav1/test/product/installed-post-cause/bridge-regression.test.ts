import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { request } from "node:http"
import type { IncomingMessage } from "node:http"
import { setImmediate } from "node:timers/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { withListener79 } from "./listener79.ts"
import type { Snapshot79 } from "./listener79.ts"

// Published beside listener79.ts. The overlay materializes the real installation
// at this path; this test does not import a copied or simulated bridge.
const repository = path.resolve(import.meta.dir, "../../../../../..")
const { composeSfInstallation } = await import(pathToFileURL(path.join(repository, "apps/cli/src/sucafina-product/installation.ts")).href)

function latch79() {
  const state = { open: () => {} }
  const promise = new Promise<void>((resolve) => { state.open = resolve })
  return { promise, open: () => state.open() }
}

async function within79<T>(work: Promise<T>, label: string, milliseconds = 1800): Promise<T> {
  const state = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      state.timer = setTimeout(() => reject(new Error(`M79_${label}_TIMEOUT`)), milliseconds)
    })])
  } finally { if (state.timer) clearTimeout(state.timer) }
}

function digest79(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }

function upload79(url: string, id: string, capture: { take: () => Snapshot79[] }, headers: Record<string, string> = {}) {
  const done = latch79()
  const state = {
    status: 0, text: "", error: "", timedOut: false, settled: false, sentBytes: 0, endRequested: false,
    beforeAbort: undefined as Snapshot79[] | undefined,
    response: undefined as IncomingMessage | undefined,
  }
  const finish = (error = "") => {
    if (state.settled) return
    state.settled = true
    state.error = error
    done.open()
  }
  const client = request(url, { method: "POST", agent: false, headers: {
    connection: "close", "content-type": "application/octet-stream", "x-m79-probe-id": id, ...headers,
  } }, (response) => {
    state.response = response
    state.status = response.statusCode ?? 0
    response.setEncoding("utf8")
    // This is the client response. No data/readable observer is added to the
    // server IncomingMessage under diagnosis.
    response.on("data", (chunk: string) => {
      if (state.text.length + chunk.length > 2048) {
        finish("response-budget")
        response.destroy()
        client.destroy()
        return
      }
      state.text += chunk
    })
    response.once("end", () => finish())
    response.once("aborted", () => finish("response-aborted"))
    response.once("error", () => finish("response-error"))
  })
  client.setNoDelay(true)
  client.once("error", () => finish("client-error"))
  const timer = setTimeout(() => {
    if (state.settled) return
    state.beforeAbort = capture.take()
    state.timedOut = true
    finish("client-timeout")
    client.destroy()
  }, 2500)
  return {
    state,
    done: done.promise,
    write: (bytes: Uint8Array) => within79(new Promise<void>((resolve, reject) => {
      client.write(bytes, (error) => {
        if (error) reject(new Error("M79_CLIENT_WRITE_FAILED"))
        else { state.sentBytes += bytes.byteLength; resolve() }
      })
    }), "CLIENT_WRITE"),
    end: () => within79(new Promise<void>((resolve) => { state.endRequested = true; client.end(resolve) }), "CLIENT_END"),
    disconnect: () => { state.beforeAbort = capture.take(); client.destroy() },
    dispose: () => { clearTimeout(timer); state.response?.destroy(); client.destroy() },
  }
}

function noBodyObservers79(source: IncomingMessage) {
  expect(source.listenerCount("data")).toBe(0)
  expect(source.listenerCount("readable")).toBe(0)
}

// The only post-read counter is a synthetic transport sentinel. It is not
// evidence of domain authorization, durable state, or an installed journey.
test("M79 bridge preserves split UTF-8 bytes and real EOF after a paused consumer", async () => {
  for (const declared of [false, true]) {
    const first = latch79()
    const resume = latch79()
    const settled = latch79()
    const prefix = Buffer.from('{"value":"')
    const tail = Buffer.from("☕".repeat(10003) + 'tail"}')
    const expected = Buffer.concat([prefix, tail])
    const state = {
      reads: 0, eof: 0, postRead: 0, bytes: [] as Uint8Array[],
      unlocked: false, source: undefined as IncomingMessage | undefined,
      paused: undefined as Snapshot79[] | undefined,
    }
    await withListener79({
      compose: composeSfInstallation,
      create: async () => ({ mount: "/probe", dispose() {}, async handler(request) {
        const body = request.body
        if (!body) throw new Error("M79_BODY_REQUIRED")
        const reader = body.getReader()
        try {
          while (true) {
            const result = await reader.read()
            if (result.done) { state.eof++; break }
            state.reads++
            state.bytes.push(result.value)
            if (state.reads === 1) { first.open(); await resume.promise }
            await setImmediate()
          }
          state.postRead++
          const received = Buffer.concat(state.bytes)
          return Response.json({ bytes: received.byteLength, sha256: digest79(received) })
        } finally { reader.releaseLock(); state.unlocked = !body.locked; settled.open() }
      } }),
      run: async ({ listener, server, capture }) => {
        const remember = (source: IncomingMessage) => { state.source = source }
        server.on("request", remember)
        const id = declared ? "slow-declared" : "slow-chunked"
        const upload = upload79(`${listener}/probe`, id, capture, declared ? { "content-length": String(expected.byteLength) } : {})
        try {
          await upload.write(prefix)
          await within79(first.promise, "FIRST_READ")
          // Split inside a UTF-8 code point. The consumer stays paused while the
          // entire tail and transport EOF are sent; no declared length closes it.
          for (const [start, end] of [[0, 1], [1, 4097], [4097, 16003], [16003, tail.byteLength]] as const) {
            await upload.write(tail.subarray(start, end))
          }
          await upload.end()
          await setImmediate()
          await setImmediate()
          state.paused = capture.take()
          expect(state.postRead).toBe(0)
          expect(state.eof).toBe(0)
          resume.open()
          await within79(upload.done, "SLOW_REPLY")
          await within79(settled.promise, "SLOW_HANDLER")
          await setImmediate()
          expect(upload.state.timedOut).toBe(false)
          expect(upload.state.error).toBe("")
          expect(upload.state.status).toBe(200)
          expect(JSON.parse(upload.state.text)).toEqual({ bytes: expected.byteLength, sha256: digest79(expected) })
          expect(Buffer.concat(state.bytes).equals(expected)).toBe(true)
          expect(state.reads).toBeGreaterThanOrEqual(2)
          expect(state.eof).toBe(1)
          expect(state.postRead).toBe(1)
          expect(state.unlocked).toBe(true)
          const trace = capture.take().find((item) => item.id === id)
          expect(trace?.bodyReadDone).toBe(1)
          expect(trace?.bodyReadBytes).toBe(expected.byteLength)
          expect(trace?.node.readableEnded).toBe(true)
          expect(trace?.signalAborted).toBe(false)
          if (!state.source) throw new Error("M79_SOURCE_REQUIRED")
          noBodyObservers79(state.source)
        } finally {
          resume.open()
          console.log("M79_BRIDGE_REGRESSION " + JSON.stringify({ case: id, expectedBytes: expected.byteLength,
            status: upload.state.status, timedOut: upload.state.timedOut, reads: state.reads, eof: state.eof,
            postRead: state.postRead, unlocked: state.unlocked, paused: state.paused,
            beforeAbort: upload.state.beforeAbort, traces: capture.take() }))
          upload.dispose()
          server.off("request", remember)
        }
      },
    })
  }
}, 12000)

test("M79 bridge returns 413 before upload EOF and releases the body reader", async () => {
  const state = { postRead: 0, rejected: false, unlocked: false, source: undefined as IncomingMessage | undefined }
  await withListener79({
    compose: composeSfInstallation,
    create: async () => ({ mount: "/probe", dispose() {}, async handler(request) {
      const body = request.body
      if (!body) throw new Error("M79_BODY_REQUIRED")
      const reader = body.getReader()
      try {
        while (!(await reader.read()).done) {}
        state.postRead++
        return new Response(null, { status: 200 })
      } catch { state.rejected = true; return new Response(null, { status: 400 }) }
      finally { reader.releaseLock(); state.unlocked = !body.locked }
    } }),
    run: async ({ listener, server, capture }) => {
      const remember = (source: IncomingMessage) => { state.source = source }
      server.on("request", remember)
      // The real installed sf=workbench branch sets the 65,536-byte budget.
      const upload = upload79(`${listener}/probe?sf=workbench`, "limit-open-upload", capture)
      try {
        await upload.write(Buffer.alloc(65536, 0x61))
        await upload.write(Buffer.from([0x62]))
        // Deliberately do not call end(): a successful response cannot wait for EOF.
        await within79(upload.done, "LIMIT_REPLY")
        await setImmediate()
        expect(upload.state.timedOut).toBe(false)
        expect(upload.state.error).toBe("")
        expect(upload.state.status).toBe(413)
        expect(state.postRead).toBe(0)
        expect(state.rejected).toBe(true)
        expect(state.unlocked).toBe(true)
        if (!state.source) throw new Error("M79_SOURCE_REQUIRED")
        // Bun can mark complete during local discard; client intent is the EOF oracle.
        expect(upload.state.sentBytes).toBe(65537)
        expect(upload.state.endRequested).toBe(false)
        noBodyObservers79(state.source)
      } finally {
        console.log("M79_BRIDGE_REGRESSION " + JSON.stringify({ case: "limit-open-upload", sentBytes: upload.state.sentBytes, endRequested: upload.state.endRequested,
          status: upload.state.status, timedOut: upload.state.timedOut, postRead: state.postRead,
          rejected: state.rejected, unlocked: state.unlocked, beforeAbort: upload.state.beforeAbort, traces: capture.take() }))
        upload.dispose()
        server.off("request", remember)
      }
    },
  })
}, 7000)

test("M79 bridge rejects a disconnected partial upload with no late post-read step", async () => {
  const first = latch79()
  const settled = latch79()
  const state = {
    postRead: 0, rejected: false, eof: 0, unlocked: false,
    request: undefined as Request | undefined, source: undefined as IncomingMessage | undefined,
  }
  await withListener79({
    observeRequestErrors: false,
    compose: composeSfInstallation,
    create: async () => ({ mount: "/probe", dispose() {}, async handler(request) {
      state.request = request
      const body = request.body
      if (!body) throw new Error("M79_BODY_REQUIRED")
      const reader = body.getReader()
      try {
        while (true) {
          const result = await reader.read()
          if (result.done) { state.eof++; break }
          first.open()
        }
        state.postRead++
        return new Response(null, { status: 200 })
      } catch { state.rejected = true; return new Response(null, { status: 400 }) }
      finally { reader.releaseLock(); state.unlocked = !body.locked; settled.open() }
    } }),
    run: async ({ listener, server, capture }) => {
      const remember = (source: IncomingMessage) => { state.source = source }
      server.on("request", remember)
      const upload = upload79(`${listener}/probe`, "disconnect-partial", capture, { "content-length": "4096" })
      try {
        await upload.write(Buffer.from("partial-79"))
        await within79(first.promise, "DISCONNECT_FIRST_READ")
        upload.disconnect()
        const before = upload.state.beforeAbort?.find((trace) => trace.id === "disconnect-partial")
        expect(before?.declaredLength).toBe(4096)
        expect(before?.bodyReadBytes).toBe(10)
        expect(upload.state.sentBytes).toBe(10)
        expect(upload.state.endRequested).toBe(false)
        await within79(settled.promise, "DISCONNECT_HANDLER")
        await setImmediate()
        await setImmediate()
        expect(state.rejected).toBe(true)
        expect(state.eof).toBe(0)
        expect(state.postRead).toBe(0)
        expect(state.unlocked).toBe(true)
        expect(state.request?.signal.aborted).toBe(true)
        if (!state.source) throw new Error("M79_SOURCE_REQUIRED")
        expect(state.source.destroyed).toBe(true)
        noBodyObservers79(state.source)
        expect(state.source.listenerCount("error")).toBe(0)
      } finally {
        console.log("M79_BRIDGE_REGRESSION " + JSON.stringify({ case: "disconnect-partial", sentBytes: upload.state.sentBytes, endRequested: upload.state.endRequested,
          postRead: state.postRead, rejected: state.rejected, eof: state.eof, unlocked: state.unlocked,
          beforeAbort: upload.state.beforeAbort, traces: capture.take() }))
        upload.dispose()
        server.off("request", remember)
      }
    },
  })
}, 7000)
