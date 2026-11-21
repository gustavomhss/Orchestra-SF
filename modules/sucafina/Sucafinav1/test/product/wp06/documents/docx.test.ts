import { describe, expect, test } from "bun:test"
import JSZip from "jszip"
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
