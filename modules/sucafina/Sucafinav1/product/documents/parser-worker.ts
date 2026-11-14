import { parentPort, workerData } from "node:worker_threads"
import type { PortResult } from "../contracts/ports.ts"

type DocumentMessage = { kind: "pdf" | "docx"; bytes: Uint8Array; file?: string; maxPages: number; maxXmlBytes: number; maxZipEntries: number }

// The host sends only the format at boot. Load that format's graph before accepting
// bytes, so DOCX never initializes PDFJS and cancellation can safely terminate a ready worker.
const boot: unknown = workerData
if (!boot || typeof boot !== "object" || !("kind" in boot)) throw new Error("document-parser-format-missing")
const kind = boot.kind
const parse = await loadParser(kind)
parentPort?.postMessage({ status: "ready" })
parentPort?.once("message", async (message: DocumentMessage) => {
  try {
    if (message.kind !== kind) return parentPort?.postMessage({ status: "failed", reason: "document-parser-format-mismatch" })
    parentPort?.postMessage(await parse(message))
  } catch {
    parentPort?.postMessage({ status: "failed", reason: "invalid or protected document" })
  }
})

async function loadParser(kind: unknown): Promise<(message: DocumentMessage) => Promise<PortResult<string>>> {
  if (kind === "docx") {
    const { extractDocxText } = await import("./docx.ts")
    await Promise.all([import("jszip"), import("saxes")])
    return (message) => extractDocxText(message.bytes, message.maxXmlBytes, message.maxZipEntries)
  }
  if (kind !== "pdf") throw new Error("document-parser-format-invalid")
  const { extract } = await import("@orchestra/rag-studio/extract")
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf")
  await getResolvedPDFJS()
  return async (message) => {
    const pdf = await getDocumentProxy(message.bytes.slice())
    const pages = pdf.numPages
    await pdf.destroy()
    if (!Number.isSafeInteger(pages) || pages < 1 || pages > message.maxPages || !message.file) return { status: "failed", reason: "PDF page limit exceeded" }
    const parsed = await extract(message.file)
    if ("failed" in parsed) return { status: "failed", reason: parsed.failed === "no_text_layer" ? "PDF has no text layer" : "PDF unavailable" }
    return { status: "ok", value: parsed.text }
  }
}
