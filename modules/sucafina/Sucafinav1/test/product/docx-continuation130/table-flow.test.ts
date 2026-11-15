import { expect, test } from "bun:test"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { readReviewArtifactRenderDigest, readReviewArtifactSeal, renderPreservedReview } from "../../../product/reviews/render.ts"
import { exportFixture } from "../wp07/export-fixture.ts"
import { historicalExportFixture } from "../wp07/historical-export-fixture.ts"

type XmlRow = { xml: string; cells: string[] }

function xmlText(xml: string) {
  const found: string[] = []
  const parser = new SaxesParser({ xmlns: false })
  let inText = false
  parser.on("opentag", (tag) => { if (tag.name === "w:t") inText = true })
  parser.on("text", (text) => { if (inText) found.push(text) })
  parser.on("closetag", (tag) => { if (tag.name === "w:t") inText = false })
  parser.write(xml).close()
  return found.join("")
}

function xmlParagraphs(cell: string) {
  return (cell.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? []).map((xml) => ({ xml, text: xmlText(xml) }))
}

function xmlRows(table: string): XmlRow[] {
  return (table.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) ?? []).map((xml) => ({
    xml,
    cells: xml.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) ?? [],
  }))
}

async function inspectDocx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const document = await zip.file("word/document.xml")?.async("string")
  const core = await zip.file("docProps/core.xml")?.async("string")
  if (!document || !core) throw new Error("Missing DOCX document or preserved core metadata")
  const tables = (document.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g) ?? []).map(xmlRows)
  return { zip, document, core, tables }
}

function originalCellText(rows: readonly XmlRow[], column: number) {
  return rows.map((row, index) => xmlParagraphs(row.cells[column]!)
    .slice(index === 0 ? 0 : 1)
    .map((paragraph) => paragraph.text).join("")).join("")
}

test("all exported DOCX table rows keep a nonblank captured value, associated period and sources, and bounded no-split fragments", async () => {
  const fixture = exportFixture()
  const result = await renderPreservedReview(fixture.review, { title: "Captured DOCX rows", format: "docx", sectionRefs: fixture.sectionRefs })
  if (!result.ok) throw new Error("DOCX export unavailable")
  const parts = await inspectDocx(result.bytes)
  expect(parts.tables).toHaveLength(2)
  const sourceRowCount = fixture.review.sections.reduce((total, section) => total + (section.content as DomainProjection).values.length, 0)
  const generated = parts.tables.flatMap((table) => {
    expect(table[0]?.xml).toContain("w:tblHeader")
    expect(xmlText(table[0]!.cells[0]!)).toBe("Captured value")
    expect(xmlText(table[0]!.cells[1]!)).toBe("Period")
    expect(xmlText(table[0]!.cells[2]!)).toBe("Sources")
    return table.slice(1)
  })
  expect(generated.length).toBeGreaterThanOrEqual(sourceRowCount)
  for (const row of generated) {
    expect(row.cells).toHaveLength(3)
    expect(row.xml).toMatch(/<w:cantSplit(?:\s|\/|>)/)
    for (const cell of row.cells) {
      const paragraphs = xmlParagraphs(cell)
      expect(paragraphs.some((paragraph) => paragraph.text.length > 0)).toBe(true)
      // A physically unsplittable row contains at most 12 intended body lines
      // (plus a short carry marker), never one hidden page-sized paragraph.
      expect((paragraphs.at(-1)?.xml.match(/<w:br(?:\s|\/|>)/g) ?? []).length).toBeLessThanOrEqual(11)
    }
  }
  const all = generated.map((row) => row.cells.map(xmlText).join(" ")).join(" ")
  expect(all).toContain("END-NOTE-25")
  expect(all).toContain("outlook-11")
  expect(parts.document).toContain('w:lineRule="atLeast"')
  expect(parts.core).toContain("Sucafina")
  expect(Object.keys(parts.zip.files).filter((name) => /^word\/media\/.*\.png$/.test(name))).toHaveLength(1)
  expect(readReviewArtifactSeal(result, fixture.review, fixture.sectionRefs)).toBeDefined()
  expect(readReviewArtifactRenderDigest(result, fixture.review, fixture.sectionRefs)).toBeDefined()
})

test("oversized captured text and source references become complete identified continuation rows rather than clipped or blank split cells", async () => {
  const fixture = exportFixture()
  const historical = historicalExportFixture()
  const sample = (historical.review.sections[0]!.content as DomainProjection).values[0]!.sourceRefs[0]!
  const refId = "source:long:" + "evidence-<a>&-Café-漢字-".repeat(100) + "END-DOCX-SOURCE"
  const rawRef = { ...sample, refId, refDigest: "" }
  const sourceRef = { ...rawRef, refDigest: digestSfEvidenceRef(rawRef) }
  const id = "DOCX-CONTINUATION-ROW"
  const value = ("Café & <source> · 漢字 · e\u0301 · 👩🏽‍💻\r\n" + "captured facts and units remain attached. ").repeat(85) + "END-DOCX-VALUE"
  const projection = fixture.review.sections[0]!.content as DomainProjection
  Object.assign(projection.values[0]!, { id, value, sourceRefs: [sourceRef] })
  const result = await renderPreservedReview(fixture.review, { title: "Long captured values", format: "docx", sectionRefs: fixture.sectionRefs })
  if (!result.ok) throw new Error("Long DOCX export unavailable")
  const parts = await inspectDocx(result.bytes)
  const projectRows = parts.tables[0]!.slice(1)
  const nextRecordIndex = projectRows.findIndex((row) => xmlText(row.cells[0]!).includes("PRJ-02:"))
  expect(nextRecordIndex).toBeGreaterThan(4)
  const continuation = projectRows.slice(0, nextRecordIndex)
  expect(xmlText(continuation[0]!.cells[0]!)).toContain(id + ":")
  for (const row of continuation.slice(1)) {
    expect(xmlParagraphs(row.cells[0]!)[0]!.text).toContain("Record 1 · " + id + " (continued)")
    expect(xmlParagraphs(row.cells[1]!)[0]!.text).toContain("2026-01-01")
    expect(xmlParagraphs(row.cells[2]!)[0]!.text).toContain("Sources (continued")
    expect(row.xml).toContain("w:cantSplit")
  }
  expect(originalCellText(continuation, 0)).toBe(id + ": " + value.replace(/\r\n|\r|\n/g, " ↵ "))
  expect(originalCellText(continuation, 1)).toBe("2026-01-01 – 2026-12-31")
  expect(originalCellText(continuation, 2)).toBe(refId)
  expect(parts.document).toContain("END-DOCX-VALUE")
  expect(parts.document).toContain("END-DOCX-SOURCE")
  expect(parts.document).toContain("END-NOTE-25")
  expect(readReviewArtifactSeal(result, fixture.review, fixture.sectionRefs)).toBeDefined()
})

test("an exceptionally long opaque identifier remains complete while repeated continuation labels stay bounded", async () => {
  const fixture = exportFixture()
  const id = "opaque:" + "漢字👩🏽‍💻".repeat(220) + ":END"
  const projection = fixture.review.sections[0]!.content as DomainProjection
  Object.assign(projection.values[0]!, { id, value: "compact-value" })
  const result = await renderPreservedReview(fixture.review, { title: "Opaque row identity", format: "docx", sectionRefs: fixture.sectionRefs })
  if (!result.ok) throw new Error("Opaque-ID DOCX export unavailable")
  const parts = await inspectDocx(result.bytes)
  const rows = parts.tables[0]!.slice(1)
  const nextRecordIndex = rows.findIndex((row) => xmlText(row.cells[0]!).includes("PRJ-02:"))
  expect(nextRecordIndex).toBeGreaterThan(1)
  const segments = rows.slice(0, nextRecordIndex)
  const carry = xmlParagraphs(segments[1]!.cells[0]!)[0]!.text
  expect(carry).toContain("Record 1 · ")
  expect(carry).toContain("…")
  expect(carry.length).toBeLessThan(180)
  expect(originalCellText(segments, 0)).toBe(id + ": compact-value")
  expect(segments.every((row) => row.xml.includes("w:cantSplit"))).toBe(true)
})
