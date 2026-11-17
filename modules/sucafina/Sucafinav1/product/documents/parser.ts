import { Worker } from "node:worker_threads"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { PortResult } from "../contracts/ports.ts"
import type { PrivateDocumentParser } from "./extract.ts"

// Shared across parser instances: creating another host does not buy another compute slot.
let active = 0
const retiring = new Set<Worker>()
const maxActive = 2
const maxResidentWorkers = maxActive * 2

type ParserRuntimeOptions = {
  createWorker?: (kind: "pdf" | "docx") => Worker
  retirementGraceMs?: number
  terminationTimeoutMs?: number
}

export function createPrivateDocumentParser(
  limits: { maxBytes: number; maxTextLength: number; maxPages: number; maxXmlBytes: number; maxZipEntries: number; timeoutMs?: number },
  runtime: ParserRuntimeOptions = {},
): PrivateDocumentParser {
  const timeout = limits.timeoutMs ?? 15_000
  const retirementGrace = runtime.retirementGraceMs ?? timeout
  const terminationTimeout = runtime.terminationTimeoutMs ?? Math.min(timeout, 5_000)
  if (![retirementGrace, terminationTimeout].every((value) => Number.isSafeInteger(value) && value > 0))
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
    if (active >= maxActive || active + retiring.size >= maxResidentWorkers)
      return { status: "unavailable", reason: "document-parser-busy" }

    const started = performance.now()
    active += 1
    let released = false
    const release = () => {
      if (released) return
      released = true
      active -= 1
    }
    const worker = (() => {
      try { return createWorker(kind) }
      catch { return undefined }
    })()
    if (!worker) {
      release()
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
      retireWorker(worker, ready, retirementGrace, terminationTimeout)
      release()
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
      try { await terminateWorker(worker, terminationTimeout) } finally {
        try { if (directory) await rm(directory, { recursive: true, force: true }) } finally { release() }
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
    await terminateWorker(worker, terminationTimeoutMs)
  })().finally(() => retiring.delete(worker))
}

async function terminateWorker(worker: Worker, timeoutMs: number) {
  worker.unref()
  await Promise.race([
    worker.terminate().then(() => undefined, () => undefined),
    delay(timeoutMs),
  ])
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
