import { parentPort } from "node:worker_threads"
import { extract } from "@orchestra/rag-studio/extract"
import { getDocumentProxy, getResolvedPDFJS } from "unpdf"
import { extractDocxText } from "./docx.ts"

// No document bytes are sent until the module graph has finished loading.
await Promise.all([getResolvedPDFJS(), import("jszip"), import("saxes")])
parentPort?.postMessage({ status: "ready" })
parentPort?.once("message", async (message: { kind: "pdf" | "docx"; bytes: Uint8Array; file?: string; maxPages: number; maxXmlBytes: number; maxZipEntries: number }) => {
  try {
    if (message.kind === "docx") return parentPort?.postMessage(await extractDocxText(message.bytes, message.maxXmlBytes, message.maxZipEntries))
    const pdf = await getDocumentProxy(message.bytes.slice())
    const pages = pdf.numPages
    await pdf.destroy()
    if (!Number.isSafeInteger(pages) || pages < 1 || pages > message.maxPages || !message.file) return parentPort?.postMessage({ status: "failed", reason: "PDF page limit exceeded" })
    const parsed = await extract(message.file)
    if ("failed" in parsed) return parentPort?.postMessage({ status: "failed", reason: parsed.failed === "no_text_layer" ? "PDF has no text layer" : "PDF unavailable" })
    return parentPort?.postMessage({ status: "ok", value: parsed.text })
  } catch {
    parentPort?.postMessage({ status: "failed", reason: "invalid or protected document" })
  }
})
