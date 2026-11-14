import { expect, test } from "bun:test"
import JSZip from "jszip"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { exportFixture, extractReportText } from "./export-fixture.ts"
import { historicalExportFixture } from "./historical-export-fixture.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { selectedReviewComments } from "../../../product/reviews/comment-selection.ts"
import { validReviewCommentRefs } from "../../../product/reviews/port.ts"
import { reviewInclusion } from "../../../product/reviews/inclusion.ts"

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

test("an explicit immutable section association keeps both actor scopes and omits unselected comments in DOCX and PPTX", async () => {
  const fixture = historicalExportFixture()
  expect(selectedReviewComments(fixture.review, fixture.sectionRefs, digestSfValue)).toEqual([fixture.original, fixture.reply])
  expect(reviewInclusion(fixture.review, fixture.sectionRefs)?.comments).toEqual([fixture.original, fixture.reply].map((comment) => ({ id: comment.id, version: comment.version, digest: digestSfValue(comment) })))
  const legacy = structuredClone(fixture.review)
  delete (legacy.sections[0]!.content as { reviewCommentRefs?: unknown }).reviewCommentRefs
  // No actor continuity is inferred by the legacy source matcher.
  expect(selectedReviewComments(legacy, fixture.sectionRefs, digestSfValue)).toEqual([fixture.reply])
  for (const format of ["docx", "pptx"] as const) {
    const result = await renderPreservedReview(fixture.review, { title: "Historical comments", format, sectionRefs: fixture.sectionRefs })
    if (!result.ok) throw new Error("Historical report unavailable")
    const text = (await extractReportText(result.bytes, format)).text.replace(/\s/gu, "")
    for (const marker of ["END-HISTORICAL-A-V3", "END-HISTORICAL-B-V1", "captured-amount:1320USD", "actual:unavailableUSD"]) expect(text.split(marker).length - 1).toBe(1)
    expect(text).not.toContain(fixture.unselected.content)
  }
})

test.each(["digest", "version", "membership", "duplicate", "metadata"])("comment association rejects changed %s before inclusion or rendering", async (attack) => {
  const fixture = historicalExportFixture()
  const projection = fixture.review.sections[0]!.content as { reviewCommentRefs: { id: string; version: number; digest: string }[] }
  const ref = projection.reviewCommentRefs[0]!
  if (attack === "digest") ref.digest = "f".repeat(64)
  if (attack === "version") ref.version++
  if (attack === "membership") ref.id = "unknown-comment"
  if (attack === "duplicate") projection.reviewCommentRefs.push({ ...ref })
  if (attack === "metadata") Object.assign(ref, { privateDiagnostic: { salary: 123 } })
  expect(validReviewCommentRefs(projection, fixture.review.comments)).toBe(false)
  expect(selectedReviewComments(fixture.review, fixture.sectionRefs, digestSfValue)).toBeUndefined()
  expect(reviewInclusion(fixture.review, fixture.sectionRefs)).toBeUndefined()
  expect(await renderPreservedReview(fixture.review, { title: "Invalid association", format: "docx", sectionRefs: fixture.sectionRefs })).toEqual({ ok: false, status: 422, errors: ["Comment association is invalid."] })
})

