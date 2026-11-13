import { Worker } from "node:worker_threads"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { PortResult } from "../contracts/ports.ts"
import type { PrivateDocumentParser } from "./extract.ts"

// Shared across parser instances: creating another host does not buy another compute slot.
let active = 0
const maxActive = 2

export function createPrivateDocumentParser(limits: { maxBytes: number; maxTextLength: number; maxPages: number; maxXmlBytes: number; maxZipEntries: number; timeoutMs?: number }): PrivateDocumentParser {
  const timeout = limits.timeoutMs ?? 15_000
  async function run(kind: "pdf" | "docx", bytes: Uint8Array, signal?: AbortSignal): Promise<PortResult<string>> {
    if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
    if (![limits.maxBytes, limits.maxTextLength, limits.maxPages, limits.maxXmlBytes, limits.maxZipEntries, timeout].every((value) => Number.isSafeInteger(value) && value > 0) || bytes.byteLength < 1 || bytes.byteLength > limits.maxBytes) return { status: "failed", reason: "invalid document limits" }
    if (kind === "pdf" && (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")) return { status: "failed", reason: "invalid PDF" }
    if (active >= maxActive) return { status: "unavailable", reason: "document-parser-busy" }
    active += 1
    const worker = (() => {
      try { return new Worker(new URL("./parser-worker.ts", import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } }) }
      catch { return undefined }
    })()
    if (!worker) { active -= 1; return { status: "unavailable", reason: "document-parser-unavailable" } }
    const ready = new Promise<boolean>((resolve) => {
      worker.once("message", (message: unknown) => resolve(!!message && typeof message === "object" && "status" in message && message.status === "ready"))
      worker.once("error", () => resolve(false))
      worker.once("exit", () => resolve(false))
    })
    const start = await new Promise<boolean>((resolve) => {
      const finish = (value: boolean) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve(value) }
      const abort = () => finish(false)
      const timer = setTimeout(() => finish(false), timeout)
      signal?.addEventListener("abort", abort, { once: true })
      if (signal?.aborted) finish(false)
      ready.then(finish)
    })
    if (!start || signal?.aborted) {
      // Bun can crash if termination occurs while imports are transpiling. Retain the slot until boot settles.
      void ready.then(() => worker.terminate()).catch(() => undefined).finally(() => { active -= 1 })
      return { status: "unavailable", reason: signal?.aborted ? "cancelled" : "document-parser-start-timeout" }
    }
    let directory: string | undefined
    try {
      directory = kind === "pdf" ? await mkdtemp(path.join(tmpdir(), "sf-document-")) : undefined
      const file = directory ? path.join(directory, "document.pdf") : undefined
      if (file) await Bun.write(file, bytes)
      if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
      return await new Promise<PortResult<string>>((resolve) => {
        const timer = setTimeout(() => finish({ status: "unavailable", reason: "document-parser-timeout" }), timeout)
        const abort = () => finish({ status: "unavailable", reason: "cancelled" })
        const finish = (result: PortResult<string>) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve(result) }
        signal?.addEventListener("abort", abort, { once: true })
        if (signal?.aborted) { abort(); return }
        worker.once("error", () => finish({ status: "failed", reason: "document-parser-error" }))
        worker.once("exit", () => finish({ status: "failed", reason: "document-parser-exit" }))
        worker.once("message", (value: unknown) => {
          if (!value || typeof value !== "object" || !("status" in value)) return finish({ status: "failed", reason: "document-parser-invalid-result" })
          if (value.status === "ok" && "value" in value && typeof value.value === "string" && value.value.length <= limits.maxTextLength) return finish({ status: "ok", value: value.value })
          if (value.status === "failed" && "reason" in value && typeof value.reason === "string") return finish({ status: "failed", reason: value.reason })
          return finish({ status: "failed", reason: "document-parser-invalid-result" })
        })
        worker.postMessage({ kind, bytes, file, maxPages: limits.maxPages, maxXmlBytes: limits.maxXmlBytes, maxZipEntries: limits.maxZipEntries })
      })
    } catch {
      return { status: "unavailable", reason: "document-parser-unavailable" }
    } finally {
      try { await worker.terminate() } finally {
        try { if (directory) await rm(directory, { recursive: true, force: true }) } finally { active -= 1 }
      }
    }
  }
  return { maxBytes: limits.maxBytes, maxTextLength: limits.maxTextLength, extractPdf: (bytes, signal) => run("pdf", bytes, signal), extractDocx: (bytes, signal) => run("docx", bytes, signal) }
}
