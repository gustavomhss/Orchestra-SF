import { expect, test } from "bun:test"
import { createPrivateDocumentParser } from "../../../../product/documents/parser.ts"

test("a valid PDF without a text layer is refused without inventing extracted text", async () => {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"]
  const file = { value: "%PDF-1.4\n" }
  const offsets = objects.map((object, index) => {
    const offset = new TextEncoder().encode(file.value).length
    file.value += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = new TextEncoder().encode(file.value).length
  file.value += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const parser = createPrivateDocumentParser({ maxBytes: 4096, maxTextLength: 4096, maxPages: 5, maxXmlBytes: 4096, maxZipEntries: 10, timeoutMs: 15000 })
  expect(await parser.extractPdf(new TextEncoder().encode(file.value))).toEqual({ status: "failed", reason: "PDF has no text layer" })
}, 30_000)
