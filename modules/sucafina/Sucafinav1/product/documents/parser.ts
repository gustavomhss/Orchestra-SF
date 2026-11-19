import { Worker } from "node:worker_threads"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { PortResult } from "../contracts/ports.ts"
import type { PrivateDocumentParser } from "./extract.ts"

// Shared across parser instances: creating another host does not buy another
// compute slot, worker, or input-memory reservation in the same process.
let active = 0
let reservedInputBytes = 0
const retiring = new Set<Worker>()
const maxActive = 2
// Two failed boots may retire while one bounded recovery probe is admitted.
// A fourth resident worker is never created, even if terminate() is delayed.
const maxResidentWorkers = maxActive + 1
// This is an input-payload budget, not an RSS claim. Worker heaps remain bounded
// separately by resourceLimits and the resident-worker cap below.
const maxConcurrentInputBytes = 40 * 1024 * 1024

export type ParserRuntimeOptions = {
  createWorker?: (kind: "pdf" | "docx") => Worker
  retirementGraceMs?: number
  terminationTimeoutMs?: number
  /** Testable lower ceiling; production callers may not raise the process budget. */
  maxConcurrentBytes?: number
}

type WorkerTermination = { settled: boolean; completion: Promise<void> }

export function createPrivateDocumentParser(
  limits: { maxBytes: number; maxTextLength: number; maxPages: number; maxXmlBytes: number; maxZipEntries: number; timeoutMs?: number },
  runtime: ParserRuntimeOptions = {},
): PrivateDocumentParser {
  const timeout = limits.timeoutMs ?? 15_000
  const retirementGrace = runtime.retirementGraceMs ?? timeout
  const terminationTimeout = runtime.terminationTimeoutMs ?? Math.min(timeout, 5_000)
  const concurrentByteLimit = runtime.maxConcurrentBytes ?? maxConcurrentInputBytes
  if (![retirementGrace, terminationTimeout, concurrentByteLimit].every((value) => Number.isSafeInteger(value) && value > 0) || concurrentByteLimit > maxConcurrentInputBytes)
    throw new Error("Invalid document parser lifecycle limits")
  const createWorker = runtime.createWorker ?? ((kind: "pdf" | "docx") => new Worker(new URL("./parser-worker.ts", import.meta.url), {
    workerData: { kind },
    resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
  }))

  async function run(kind: "pdf" | "docx", bytes: Uint8Array, signal?: AbortSignal): Promise<PortResult<string>> {
    if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
    if (![limits.maxBytes, limits.maxTextLength, limits.maxPages, limits.maxXmlBytes, limits.maxZipEntries, timeout].every((value) => Number.isSafeInteger(value) && value > 0) || bytes.byteLength < 1 || bytes.byteLength > limits.maxBytes)
      return { status: "failed", reason: "invalid document limits" }
    if (kind === "pdf" && (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"))
      return { status: "failed", reason: "invalid PDF" }
    if (active >= maxActive || active + retiring.size >= maxResidentWorkers || reservedInputBytes + bytes.byteLength > concurrentByteLimit)
      return { status: "unavailable", reason: "document-parser-busy" }

    const started = performance.now()
    active += 1
    reservedInputBytes += bytes.byteLength
    let activeReleased = false
    let reservationReleased = false
    const releaseActive = () => {
      if (activeReleased) return
      activeReleased = true
      active -= 1
    }
    const releaseReservation = () => {
      if (reservationReleased) return
      reservationReleased = true
      reservedInputBytes -= bytes.byteLength
      if (reservedInputBytes < 0) throw new Error("Document parser byte reservation underflow")
    }
    const worker = (() => {
      try { return createWorker(kind) }
      catch { return undefined }
    })()
    if (!worker) {
      releaseActive()
      releaseReservation()
      return { status: "unavailable", reason: "document-parser-unavailable" }
    }

    const ready = new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      worker.once("message", (message: unknown) => finish(!!message && typeof message === "object" && "status" in message && message.status === "ready"))
      worker.once("error", () => finish(false))
      worker.once("exit", () => finish(false))
    })
    const start = await waitForReady(ready, timeout, signal)
    if (!start || signal?.aborted) {
      // No document payload has crossed into this worker yet, so the input-byte
      // reservation can be released even while the boot worker retires.
      retireWorker(worker, ready, retirementGrace, terminationTimeout)
      releaseActive()
      releaseReservation()
      return { status: "unavailable", reason: signal?.aborted ? "cancelled" : "document-parser-start-timeout" }
    }

    let directory: string | undefined
    try {
      directory = kind === "pdf" ? await mkdtemp(path.join(tmpdir(), "sf-document-")) : undefined
      const file = directory ? path.join(directory, "document.pdf") : undefined
      if (file) await Bun.write(file, bytes)
      if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
      const remaining = timeout - (performance.now() - started)
      if (remaining <= 0) return { status: "unavailable", reason: "document-parser-timeout" }
      // Transfer one dedicated copy. The caller retains its bytes and the worker no longer clones them again.
      const payload = bytes.slice()
      return await new Promise<PortResult<string>>((resolve) => {
        let settled = false
        const timer = setTimeout(() => finish({ status: "unavailable", reason: "document-parser-timeout" }), remaining)
        const abort = () => finish({ status: "unavailable", reason: "cancelled" })
        const finish = (result: PortResult<string>) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener("abort", abort)
          resolve(result)
        }
        signal?.addEventListener("abort", abort, { once: true })
        if (signal?.aborted) { abort(); return }
        worker.once("error", () => finish({ status: "failed", reason: "document-parser-error" }))
        worker.once("exit", () => finish({ status: "failed", reason: "document-parser-exit" }))
        worker.once("message", (value: unknown) => {
          if (!value || typeof value !== "object" || !("status" in value)) return finish({ status: "failed", reason: "document-parser-invalid-result" })
          if (value.status === "ok" && "value" in value && typeof value.value === "string" && value.value.length <= limits.maxTextLength)
            return finish({ status: "ok", value: value.value })
          if (value.status === "failed" && "reason" in value && typeof value.reason === "string")
            return finish({ status: "failed", reason: value.reason })
          return finish({ status: "failed", reason: "document-parser-invalid-result" })
        })
        worker.postMessage({ kind, bytes: payload, file, maxPages: limits.maxPages, maxXmlBytes: limits.maxXmlBytes, maxZipEntries: limits.maxZipEntries }, [payload.buffer])
      })
    } catch {
      return { status: "unavailable", reason: "document-parser-unavailable" }
    } finally {
      try {
        const termination = await terminateWorker(worker, terminationTimeout)
        if (termination.settled) releaseReservation()
        else {
          retainUntilStopped(worker, termination.completion)
          // The transferred payload may still be resident. Keep its reservation
          // until the actual worker termination promise settles.
          void termination.completion.then(releaseReservation)
        }
      } finally {
        try { if (directory) await rm(directory, { recursive: true, force: true }) } finally { releaseActive() }
      }
    }
  }

  return {
    maxBytes: limits.maxBytes,
    maxTextLength: limits.maxTextLength,
    extractPdf: (bytes, signal) => run("pdf", bytes, signal),
    extractDocx: (bytes, signal) => run("docx", bytes, signal),
  }
}

function waitForReady(ready: Promise<boolean>, timeout: number, signal?: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      resolve(value)
    }
    const abort = () => finish(false)
    const timer = setTimeout(() => finish(false), timeout)
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) { abort(); return }
    void ready.then(finish, () => finish(false))
  })
}

function retireWorker(worker: Worker, ready: Promise<boolean>, graceMs: number, terminationTimeoutMs: number) {
  if (retiring.has(worker)) return
  retiring.add(worker)
  worker.unref()
  void (async () => {
    await Promise.race([ready.then(() => undefined, () => undefined), delay(graceMs)])
    const termination = await terminateWorker(worker, terminationTimeoutMs)
    if (termination.settled) retiring.delete(worker)
    else void termination.completion.then(() => retiring.delete(worker))
  })()
}

async function terminateWorker(worker: Worker, timeoutMs: number): Promise<WorkerTermination> {
  worker.unref()
  let settled = false
  let completion: Promise<void>
  try {
    completion = worker.terminate().then(
      () => { settled = true },
      () => { settled = true },
    )
  } catch {
    settled = true
    completion = Promise.resolve()
  }
  await Promise.race([completion, delay(timeoutMs)])
  return { settled, completion }
}

function retainUntilStopped(worker: Worker, completion: Promise<void>) {
  retiring.add(worker)
  void completion.then(() => retiring.delete(worker))
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
