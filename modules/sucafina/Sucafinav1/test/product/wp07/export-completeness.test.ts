import { expect, test } from "bun:test"
import JSZip from "jszip"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { exportFixture, extractReportText } from "./export-fixture.ts"

test("presentation keeps its title and review reference alongside the selected material", async () => {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const review = { id: "review-cover-42", version: 1, createdAt: "2026-11-13", sourceRefs: [], comments: [], sections: [{ id: "empty", title: "Empty selection", period, count: 0, sourceRefs: [], content: { values: [], missing: [], context: { sourceRefs: [] } } }] }
  const result = await renderPreservedReview(review, { title: "Annual meeting", format: "pptx", sectionRefs: ["empty"] })
  if (!result.ok) throw new Error("presentation unavailable")
  const zip = await JSZip.loadAsync(result.bytes)
  const slides = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
  const text = (await Promise.all(slides.map((path) => zip.file(path)!.async("string")))).join(" ")
  expect(text).toContain("Annual meeting")
  expect(text).toContain("review-cover-42")
  expect(text).toContain("Empty selection")
})

test("25 long project notes, every monthly value, missing series and captured comments survive both formats", async () => {
  const fixture = exportFixture()
  for (const format of ["pptx", "docx"] as const) {
    const result = await renderPreservedReview(fixture.review, { title: "Complete review", format, sectionRefs: fixture.sectionRefs })
    if (!result.ok) throw new Error("report unavailable")
    const extracted = await extractReportText(result.bytes, format)
    const text = extracted.text.replace(/\s/gu, "")
    for (let index = 1; index <= 25; index++) {
      const id = String(index).padStart(2, "0")
      expect(text.split(`PRJ-${id}:`).length - 1).toBe(1)
      expect(text.split(`END-NOTE-${id}`).length - 1).toBe(1)
    }
    expect(text).toContain("END-COMMENT-V3")
    expect(text).toContain("Noauthorizedserieswascaptured")
    expect(text).toContain("outlook-11:112000USD")
    expect(text).toContain("actual-12:unavailableUSD")
    expect(extracted.figures).toBe(1)
    if (format === "pptx") expect(extracted.pages!).toBeLessThan(60)
  }
})
