import type { PortResult } from "../contracts/ports.ts"

// DOCX is ZIP/XML, not UTF-8 text. Bound decompression before building the XML string.
export async function extractDocxText(bytes: Uint8Array, maxXmlBytes: number, maxEntries: number, signal?: AbortSignal): Promise<PortResult<string>> {
  if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
  if (!Number.isSafeInteger(maxXmlBytes) || maxXmlBytes < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) return { status: "failed", reason: "invalid DOCX limits" }
  try {
    const { default: JSZip } = await import("jszip")
    const { SaxesParser } = await import("saxes")
    const zip = await JSZip.loadAsync(bytes)
    if (Object.keys(zip.files).length > maxEntries) return { status: "failed", reason: "DOCX entry limit exceeded" }
    if (zip.file("EncryptionInfo") || zip.file("EncryptedPackage")) return { status: "failed", reason: "protected DOCX" }
    const document = zip.file("word/document.xml")
    if (!document) return { status: "failed", reason: "DOCX document XML missing" }
    const xml = await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = []
      let length = 0
      const stream = document.nodeStream("nodebuffer")
      stream.on("data", (chunk: Uint8Array) => {
        if (signal?.aborted) { stream.pause(); reject(new Error("cancelled")); return }
        length += chunk.byteLength
        if (length > maxXmlBytes) {
          stream.pause()
          reject(new Error("DOCX XML limit exceeded"))
          return
        }
        chunks.push(chunk)
      })
      stream.on("error", reject)
      stream.on("end", () => {
        const result = new Uint8Array(length)
        let offset = 0
        chunks.forEach((chunk) => {
          result.set(chunk, offset)
          offset += chunk.byteLength
        })
        resolve(result)
      })
      stream.resume()
    })
    const parser = new SaxesParser({ xmlns: true })
    const words: string[] = []
    let inText = false
    parser.on("doctype", () => { throw new Error("DOCTYPE forbidden") })
    parser.on("opentag", (tag) => {
      if (tag.uri !== "http://schemas.openxmlformats.org/wordprocessingml/2006/main") return
      if (tag.local === "t") inText = true
      if (tag.local === "tab") words.push("\t")
      if (tag.local === "br" || tag.local === "cr") words.push("\n")
    })
    parser.on("text", (text) => { if (inText) words.push(text) })
    parser.on("closetag", (tag) => {
      if (tag.uri !== "http://schemas.openxmlformats.org/wordprocessingml/2006/main") return
      if (tag.local === "t") inText = false
      if (tag.local === "p") words.push("\n")
    })
    parser.write(new TextDecoder("utf-8", { fatal: true }).decode(xml)).close()
    return { status: "ok", value: words.join("") }
  } catch {
    if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
    return { status: "failed", reason: "invalid, protected, or oversized DOCX" }
  }
}
