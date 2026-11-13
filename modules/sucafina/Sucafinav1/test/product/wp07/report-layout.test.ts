import { expect, test } from "bun:test"
import { fitSlideText, reviewCoverageLines, SLIDE_BODY } from "../../../product/reviews/report-layout.ts"

test("slide pagination preserves whole graphemes and all text", () => {
  const text = `${"👩🏽‍💻 ".repeat(80)}${"漢字".repeat(80)}e\u0301`
  const pages = fitSlideText(text, SLIDE_BODY)
  expect(pages.length).toBeGreaterThan(1)
  expect(pages.join("")).toBe(text)
  expect(pages.every((page) => !page.startsWith("\u200d") && !page.endsWith("\u200d"))).toBe(true)
})

test("coverage names selected sections and omitted comments without changing counts", () => {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const review = { id: "review", version: 1, createdAt: "2026-11-13", sourceRefs: [], comments: [], sections: [{ id: "s", title: "Empty", period, count: 0, sourceRefs: [], content: { values: [], missing: [] } }] }
  expect(reviewCoverageLines(review, ["s"])?.join(" ")).toContain("records 0")
  expect(reviewCoverageLines(review, ["missing"])).toBeUndefined()
})
