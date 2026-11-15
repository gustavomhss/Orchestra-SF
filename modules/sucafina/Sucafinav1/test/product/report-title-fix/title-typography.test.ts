import { expect, test } from "bun:test"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { renderPreservedReview, readReviewArtifactSeal, readReviewArtifactRenderDigest } from "../../../product/reviews/render.ts"
import { createReport } from "../../../runtime/reports.ts"
import { exportFixture } from "../wp07/export-fixture.ts"

const titles = [
  { caseId: "short", text: "Quarterly review" },
  { caseId: "long-opaque-id", text: "Review review:" + "0123456789abcdef".repeat(4) },
  { caseId: "extreme", text: "Review " + ("Café-東京-🟢-e\u0301 ").repeat(130) + " END-EXTREME-TITLE" },
  { caseId: "unicode", text: "Revisão · Café, ação, 東京, 中文, e\u0301, 😀 & <source> — review:" + "fedcba9876543210".repeat(4) },
]

async function documentParts(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const document = await zip.file("word/document.xml")?.async("string")
  const styles = await zip.file("word/styles.xml")?.async("string")
  const core = await zip.file("docProps/core.xml")?.async("string")
  if (!document || !styles || !core) throw new Error("DOCX lacks document, styles or original core metadata")
  const paragraphs: { xml: string; text: string }[] = []
  const spans = document.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? []
  for (const xml of spans) {
    const texts: string[] = []
    let insideText = false
    const parser = new SaxesParser({ xmlns: false })
    parser.on("opentag", (tag) => { if (tag.name === "w:t") insideText = true })
    parser.on("text", (value) => { if (insideText) texts.push(value) })
    parser.on("closetag", (tag) => { if (tag.name === "w:t") insideText = false })
    parser.write(xml).close()
    paragraphs.push({ xml, text: texts.join("") })
  }
  return { zip, document, styles, core, paragraphs, fullText: paragraphs.map((paragraph) => paragraph.text).join("\n") }
}

function expectTitleFlow(
  parts: Awaited<ReturnType<typeof documentParts>>,
  title: string,
) {
  const first = parts.paragraphs[0]
  if (!first) throw new Error("Missing first DOCX title paragraph")
  // Retain complete original title, including the opaque ID, Unicode and XML-special text.
  expect(first.text).toBe(title)
  expect(first.xml).toContain('w:pStyle w:val="Title"')
  expect(first.xml).toContain('w:lineRule="atLeast"')
  expect(first.xml).toContain('w:line="760"')
  expect(first.xml).toContain('w:after="240"')
  expect(first.xml).toContain('w:widowControl')
  expect(parts.styles).toContain('w:rFonts w:ascii="Aptos"')
  expect(parts.core).toContain("Sucafina")
  expect(parts.core).toContain("dc:title")
  // OOXML checks alone cannot certify absence of physical overlap.
  // VIS88-001 still requires the genuine hosted reader88 PDF/PNG comparison.
}

for (const item of titles) {
  test("preserved review DOCX title flow: " + item.caseId, async () => {
    const fixture = exportFixture()
    const result = await renderPreservedReview(fixture.review, {
      title: item.text, format: "docx", sectionRefs: fixture.sectionRefs,
    })
    if (!result.ok) throw new Error("Preserved review renderer refused title case " + item.caseId)
    const parts = await documentParts(result.bytes)
    expectTitleFlow(parts, item.text)
    expect(parts.fullText).toContain("Review " + fixture.review.id)
    expect(parts.fullText).toContain("END-NOTE-25")
    expect(parts.fullText).toContain("END-COMMENT-V3")
    expect(parts.fullText).toContain("Financial trajectory")
    expect(parts.document).toContain("<w:tbl>")
    expect(Object.keys(parts.zip.files).some((path) => /^word\/media\/.*\.png$/.test(path))).toBe(true)
    expect(readReviewArtifactSeal(result, fixture.review, fixture.sectionRefs)).toBeDefined()
    expect(readReviewArtifactRenderDigest(result, fixture.review, fixture.sectionRefs)).toBeDefined()
  })

  test("CIO dashboard DOCX title flow: " + item.caseId, async () => {
    const fixture = exportFixture()
    const result = await createReport(
      fixture.legacy,
      { id: "admin", canWrite: true, roles: ["admin"] },
      { at: "2026-11-13T04:01:10Z", id: () => "unused", directory: [] },
      { title: item.text, format: "docx", year: 2026, topics: ["All Projects"] },
    )
    if (!result.ok) throw new Error("CIO report refused title case " + item.caseId)
    const parts = await documentParts(result.bytes)
    expectTitleFlow(parts, item.text)
    expect(parts.fullText).toContain("Presenter script")
    expect(parts.fullText).toContain("LEGACY-PROJECT-25")
    expect(parts.fullText).toContain("END-NOTE-25")
    expect(parts.fullText).toContain("Selection order")
    expect(parts.fullText).toContain("FY 2026")
  })
}
