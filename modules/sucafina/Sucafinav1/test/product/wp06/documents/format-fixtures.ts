import JSZip from "jszip"

type DocumentFormat = "txt" | "docx" | "pdf"
type DocumentFixture = { extension: DocumentFormat; mediaType: "text/plain" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; bytes: Uint8Array }

/** A real one-page digital PDF with fixed objects, font, coordinates and byte offsets. */
export function digitalPdf(text: string) {
  const lines = text.split("\n").map((line) => line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"))
  const stream = `BT /F1 12 Tf 20 140 Td ${lines.map((line, index) => `${index ? "0 -20 Td " : ""}(${line}) Tj`).join(" ")} ET`
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
  const file = { value: "%PDF-1.4\n" }
  const offsets = objects.map((object, index) => { const offset = new TextEncoder().encode(file.value).length; file.value += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset })
  const xref = new TextEncoder().encode(file.value).length
  file.value += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(file.value)
}

/** Actual bytes enter the production attachment/worker path; no parsed document or authority is fabricated. */
export async function documentFormatFixture(format: DocumentFormat, text: string): Promise<DocumentFixture> {
  if (format === "txt") return { extension: format, mediaType: "text/plain", bytes: new TextEncoder().encode(text) }
  if (format === "pdf") return { extension: format, mediaType: "application/pdf", bytes: digitalPdf(text) }
  const archive = new JSZip()
  const options = { date: new Date("2026-01-01T00:00:00Z"), createFolders: false }
  const escaped = (line: string) => line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  archive.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', options)
  archive.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', options)
  archive.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split("\n").map((line) => `<w:p><w:r><w:t xml:space="preserve">${escaped(line)}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`, options)
  return { extension: format, mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: await archive.generateAsync({ type: "uint8array", compression: "STORE", platform: "UNIX" }) }
}
