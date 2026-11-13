import { expect, test } from "bun:test"
import { fitSlideText, paginateSlideText, reviewCoverageLines, SLIDE_BODY, SLIDE_ROWS_PER_PAGE } from "../../../product/reviews/report-layout.ts"

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

test("long notes share bounded pages and keep every fragment instead of one slide per visual line", () => {
  const lines = Array.from({ length: 25 }, (_, index) => `Project ${index + 1}: ${"A long note retains all of its words. ".repeat(8)} END-${index + 1}`)
  const pages = paginateSlideText(lines)
  expect(pages.length).toBeGreaterThan(1)
  expect(pages.length).toBeLessThan(25)
  expect(pages.every((page) => page.length <= SLIDE_ROWS_PER_PAGE)).toBe(true)
  const visible = pages.flat().join("").replace(/\s/gu, "")
  expect(visible).toBe(lines.join("").replace(/\s/gu, ""))
})

test("a paragraph longer than one page continues without losing its final note", () => {
  const long = `${"漢字 e\u0301 👩🏽‍💻 ".repeat(300)}END-LONG-NOTE`
  const pages = paginateSlideText([long])
  expect(pages.length).toBeGreaterThan(1)
  expect(pages.flat().join("")).toBe(long)
  expect(pages.at(-1)?.join("")).toContain("END-LONG-NOTE")
})
