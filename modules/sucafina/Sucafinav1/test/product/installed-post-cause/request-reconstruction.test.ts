import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import type { IncomingMessage } from "node:http"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { markIncoming79, withListener79 } from "./listener79.ts"
import type { Snapshot79 } from "./listener79.ts"

const repository = path.resolve(import.meta.dir, "../../../../../..")
const cli = createRequire(path.join(repository, "apps/cli/package.json"))
const { NodeHttpServerRequest } = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href)
const { composeSfInstallation } = await import(pathToFileURL(path.join(repository, "apps/cli/src/sucafina-product/installation.ts")).href)
const payload = '{"action":"list","scope":{}}'
const variants = ["direct", "one-argument", "signal-init", "empty-init", "explicit-body"] as const
type Variant79 = typeof variants[number]
type Cancel79 = "same-body" | "not-distinct" | "locked" | "pending" | "resolved" | "rejected"
type End79 = "eof" | "read-error" | "deadline" | "transport-abort" | "stopped"
type Capture79 = { take: () => Snapshot79[] }

async function readReconstruction79(input: {
  variant: Variant79
  first: Request
  selected: Request
  originalBody: ReadableStream<Uint8Array>
  controller: AbortController
  signal: AbortSignal
  source: IncomingMessage
  capture: Capture79
}) {
  const body = input.selected.body
  if (!body) throw new Error("M79_RECONSTRUCTION_BODY_REQUIRED")
  const reader = body.getReader()
  const started = performance.now()
  const state = {
    stopped: false, reads: 0, bytes: 0, eof: 0, chunks: [] as Uint8Array[],
    readLoopSettled: false, readerReleased: false,
    selectedCancel: "pending" as Cancel79, originalCancel: "pending" as Cancel79,
    companionCancel: "not-distinct" as Cancel79,
    serverTimerCleared: false, outcome: "read-error" as End79,
  }
  const stop = { resolve: (_outcome: End79) => {} }
  const stopped = new Promise<End79>((resolve) => { stop.resolve = resolve })
  const aborted = () => stop.resolve("transport-abort")
  input.signal.addEventListener("abort", aborted, { once: true })
  const timer = setTimeout(() => stop.resolve("deadline"), 800)
  if (input.signal.aborted) aborted()
  const readTask = (async (): Promise<End79> => {
    try {
      while (true) {
        state.reads++
        markIncoming79(input.source, "reconstruction.reader.read.start")
        const next = await reader.read()
        // A cancel-induced done is never counted as the observed transport EOF.
        if (state.stopped) return "stopped"
        markIncoming79(input.source, next.done ? "reconstruction.reader.read.done" : "reconstruction.reader.read.value")
        if (next.done) { state.eof++; return "eof" }
        state.bytes += next.value.byteLength
        state.chunks.push(next.value)
        if (state.bytes > 64) return "read-error"
      }
    } catch { return "read-error" }
    finally { state.readLoopSettled = true }
  })()

  const observed = await (async () => {
    try {
      state.outcome = await Promise.race([readTask, stopped])
      // Freeze observations before abort/cancel or a cancel-induced reader result.
      const beforeCancel = input.capture.take().find((trace) => trace.id === `reconstruct-${input.variant}`)
      return {
        variant: input.variant, outcome: state.outcome, elapsedMs: Math.round(performance.now() - started),
        reads: state.reads, bytes: state.bytes, eof: state.eof,
        exactBytes: Buffer.concat(state.chunks).equals(Buffer.from(payload)),
        sameRequest: input.first === input.selected,
        sameBody: input.originalBody === body,
        signalAborted: input.selected.signal.aborted,
        beforeCancel,
      }
    } finally {
      state.stopped = true
      clearTimeout(timer)
      state.serverTimerCleared = true
      input.signal.removeEventListener("abort", aborted)
      const cancellations: Promise<unknown>[] = []
      const cancel = (which: "selectedCancel" | "originalCancel" | "companionCancel", work: () => Promise<unknown>) => {
        try {
          state[which] = "pending"
          const pending = work().then(
            () => { state[which] = "resolved" },
            () => { state[which] = "rejected" },
          )
          cancellations.push(pending)
        } catch { state[which] = "rejected" }
      }
      // The original Effect stream and the selected reader are distinct for the
      // broken init-object constructor. Both reachable sources get cancellation.
      if (state.outcome !== "eof") input.controller.abort()
      cancel("selectedCancel", () => reader.cancel())
      try { reader.releaseLock(); state.readerReleased = true } catch {}
      if (input.originalBody === body) state.originalCancel = "same-body"
      else if (input.originalBody.locked) state.originalCancel = "locked"
      else cancel("originalCancel", () => input.originalBody.cancel())
      // A constructor may expose a replacement tee branch on the first Request.
      // Inspect only after freezing the outcome, and never attach another reader.
      const companion = input.first.body
      if (companion && companion !== input.originalBody && companion !== body) {
        if (companion.locked) state.companionCancel = "locked"
        else cancel("companionCancel", () => companion.cancel())
      }

      // Bun's defective reconstruction can create a phantom tee companion that
      // Request.body does not expose. Its cancel promise cannot block teardown.
      const cleanup = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
      try {
        await Promise.race([Promise.all(cancellations), new Promise<void>((resolve) => {
          cleanup.timer = setTimeout(resolve, 80)
        })])
        await Promise.resolve()
      } finally { if (cleanup.timer) clearTimeout(cleanup.timer) }
    }
  })()
  return { ...observed, cleanup: {
    readerReleased: state.readerReleased, selectedBodyLocked: body.locked,
    readLoopSettled: state.readLoopSettled, selectedCancel: state.selectedCancel,
    originalCancel: state.originalCancel, companionCancel: state.companionCancel,
    serverTimerCleared: state.serverTimerCleared,
    sourceDataListeners: input.source.listenerCount("data"),
    sourceReadableListeners: input.source.listenerCount("readable"),
  } }
}

async function sendReconstruction79(listener: string, variant: Variant79, capture: Capture79) {
  const controller = new AbortController()
  const state = { timedOut: false, beforeAbort: undefined as Snapshot79[] | undefined }
  const timer = setTimeout(() => {
    state.beforeAbort = capture.take()
    state.timedOut = true
    controller.abort()
  }, 1800)
  try {
    const response = await fetch(`${listener}/reconstruct/${variant}`, { method: "POST", body: payload,
      headers: { "content-type": "application/json", "content-length": "28", connection: "close", "x-m79-probe-id": `reconstruct-${variant}` },
      signal: controller.signal,
    })
    const result = await response.json() as Awaited<ReturnType<typeof readReconstruction79>>
    return { status: response.status, result, ...state }
  } finally { clearTimeout(timer) }
}

test("M79 Request reconstruction isolates init-object body loss with one identical reader consumer", async () => {
  expect(Buffer.byteLength(payload)).toBe(28)
  const context = { capture: undefined as Capture79 | undefined }
  await withListener79({
    compose: async (value, origin) => {
      const installation = await composeSfInstallation(value, origin)
      const routes = variants.map((variant) => HttpRouter.add("POST", `/reconstruct/${variant}`, Effect.gen(function* () {
        const incoming = yield* HttpServerRequest.HttpServerRequest
        const source = NodeHttpServerRequest.toIncomingMessage(incoming)
        const controller = new AbortController()
        // The actual pinned conversion, captured Effect context, Node source
        // options, HWM, and initial signal are identical in all five variants.
        const first = yield* HttpServerRequest.toWeb(incoming, { signal: controller.signal })
        const originalBody = first.body
        if (!originalBody || !context.capture) throw new Error("M79_RECONSTRUCTION_CONTEXT_REQUIRED")
        markIncoming79(source, "reconstruction.construct.start")
        const explicitInit = { method: first.method, headers: first.headers, body: originalBody, signal: controller.signal, duplex: "half" }
        const selected = variant === "direct" ? first
          : variant === "one-argument" ? new Request(first)
          : variant === "signal-init" ? new Request(first, { signal: controller.signal })
          : variant === "empty-init" ? new Request(first, {})
          : new Request(first.url, explicitInit)
        markIncoming79(source, "reconstruction.construct.complete")
        const capture = context.capture
        const result = yield* Effect.tryPromise({
          try: (signal) => readReconstruction79({ variant, first, selected, originalBody, controller, signal, source, capture }),
          catch: () => "reconstruction-control-failed" as const,
        })
        return HttpServerResponse.jsonUnsafe(result, { status: result.outcome === "deadline" ? 408 : result.outcome === "eof" ? 200 : 503 })
      })))
      return { ...installation, layer: Layer.mergeAll(installation.layer, ...routes) }
    },
    create: async () => ({ mount: "/probe", dispose() {}, async handler() { return new Response(null, { status: 404 }) } }),
    run: async ({ listener, capture }) => {
      context.capture = capture
      for (const variant of variants) {
        const reply = await sendReconstruction79(listener, variant, capture)
        console.log("M79_RECONSTRUCTION " + JSON.stringify(reply))
        expect(reply.timedOut).toBe(false)
        const result = reply.result
        const negative = variant === "signal-init" || variant === "empty-init"
        expect(reply.status).toBe(negative ? 408 : 200)
        expect(result.outcome).toBe(negative ? "deadline" : "eof")
        expect(result.bytes).toBe(negative ? 0 : 28)
        expect(result.eof).toBe(negative ? 0 : 1)
        expect(result.exactBytes).toBe(!negative)
        expect(result.signalAborted).toBe(false)
        expect(result.beforeCancel?.readBytes).toBe(28)
        expect(result.beforeCancel?.pushNull).toBe(1)
        expect(result.beforeCancel?.node.readableEnded).toBe(true)
        expect(result.cleanup.readerReleased).toBe(true)
        expect(result.cleanup.selectedBodyLocked).toBe(false)
        expect(result.cleanup.readLoopSettled).toBe(true)
        expect(result.cleanup.serverTimerCleared).toBe(true)
        expect(result.cleanup.sourceDataListeners).toBe(0)
        expect(result.cleanup.sourceReadableListeners).toBe(0)
        // Positive cases must end cleanly. Negative cases report the phantom
        // tee's cancel status honestly; "pending" is not renamed to success.
        if (!negative) expect(result.cleanup.selectedCancel).toBe("resolved")
      }
    },
  })
}, 12000)
