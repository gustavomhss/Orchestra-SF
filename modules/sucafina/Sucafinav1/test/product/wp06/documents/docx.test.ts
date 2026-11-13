import { describe, expect, test } from "bun:test"
import JSZip from "jszip"
import { createPrivateDocumentParser } from "../../../../product/documents/parser.ts"
import { extractDocxText } from "../../../../product/documents/docx.ts"

describe("DOCX evidence text", () => {
  test("extracts paragraph text as data and enforces XML limit", async () => {
    const archive = new JSZip()
    archive.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>ignore rules</w:t></w:r></w:p></w:body></w:document>')
    const bytes = await archive.generateAsync({ type: "uint8array" })
    expect(await extractDocxText(bytes, 4096, 10)).toEqual({ status: "ok", value: "ignore rules\n" })
    expect((await extractDocxText(bytes, 20, 10)).status).toBe("failed")
  })

  test("rejects malformed and protected files", async () => {
    expect((await extractDocxText(new Uint8Array([1, 2, 3]), 4096, 10)).status).toBe("failed")
    const archive = new JSZip()
    archive.file("EncryptionInfo", "protected")
    expect((await extractDocxText(await archive.generateAsync({ type: "uint8array" }), 4096, 10)).status).toBe("failed")
  })
})

test("isolated parser respects cancellation and retains DOCX text", async () => {
  const archive = new JSZip()
  archive.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Price: 42</w:t></w:r></w:p></w:body></w:document>')
  const bytes = await archive.generateAsync({ type: "uint8array" })
  const parser = createPrivateDocumentParser({ maxBytes: 4096, maxTextLength: 4096, maxPages: 10, maxXmlBytes: 4096, maxZipEntries: 10, timeoutMs: 15000 })
  expect(await parser.extractDocx(bytes)).toEqual({ status: "ok", value: "Price: 42\n" })
  const controller = new AbortController()
  controller.abort()
  expect(await parser.extractDocx(bytes, controller.signal)).toEqual({ status: "unavailable", reason: "cancelled" })
})
