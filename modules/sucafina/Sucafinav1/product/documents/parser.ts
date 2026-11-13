import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { extract } from "@orchestra/rag-studio/extract"
import type { PortResult } from "../contracts/ports.ts"
import type { PrivateDocumentParser } from "./extract.ts"
import { extractDocxText } from "./docx.ts"

export function createPrivateDocumentParser(limits: { maxBytes: number; maxTextLength: number; maxPages: number; maxXmlBytes: number; maxZipEntries: number; maxConcurrent?: number }): PrivateDocumentParser {
  let active = 0
  const limit = limits.maxConcurrent ?? 2
  async function bounded(work: () => Promise<PortResult<string>>): Promise<PortResult<string>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || active >= limit) return { status: "unavailable", reason: "document-parser-busy" }
    active += 1
    try { return await work() } finally { active -= 1 }
  }
  return {
    maxBytes: limits.maxBytes,
    maxTextLength: limits.maxTextLength,
    extractDocx: (bytes, signal) => bounded(() => extractDocxText(bytes, limits.maxXmlBytes, limits.maxZipEntries, signal)),
    extractPdf: (bytes, signal): Promise<PortResult<string>> => bounded(async () => {
      if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
      if (!Number.isSafeInteger(limits.maxPages) || limits.maxPages < 1) return { status: "failed", reason: "invalid page limit" }
      if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return { status: "failed", reason: "invalid PDF" }
      try {
        const { getDocumentProxy } = await import("unpdf")
        const pdf = await getDocumentProxy(bytes.slice())
        const pages = pdf.numPages
        await pdf.destroy()
        if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
        if (!Number.isSafeInteger(pages) || pages < 1 || pages > limits.maxPages) return { status: "failed", reason: "PDF page limit exceeded" }
        const directory = await mkdtemp(path.join(tmpdir(), "sf-document-"))
        try {
          const file = path.join(directory, "document.pdf")
          await Bun.write(file, bytes)
          const parsed = await extract(file)
          if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
          if ("failed" in parsed) return { status: "failed", reason: parsed.failed === "no_text_layer" ? "PDF has no text layer" : "PDF unavailable" }
          return { status: "ok", value: parsed.text }
        } finally {
          await rm(directory, { recursive: true, force: true })
        }
      } catch {
        return { status: "failed", reason: "invalid or protected PDF" }
      }
    }),
  }
}
