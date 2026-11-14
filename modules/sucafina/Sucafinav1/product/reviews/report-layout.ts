import { selectedReviewComments } from "./comment-selection.ts"
import type { ReviewChart } from "./port.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type PptxGenJS from "pptxgenjs"

/** Geometry for text the caller already authorized. This module does not read sources, grant access, or draw charts. */
export const SLIDE_BODY = { fontSize: 14, boxWidthInches: 12.1, marginInches: 0.08 }
export const SLIDE_HEADING = { fontSize: 20, boxWidthInches: 12.1, marginInches: 0 }
/** Matches the row pitch in chart.ts. Captions use this; the raster stays there. */
export const CHART_ROWS_PER_PAGE = 8
export const SLIDE_ROWS_PER_PAGE = 16

export function fitSlideText(text: string, box: SlideBox) {
  return pack(text.replace(/\r\n|\r|\n/g, " ↵ "), columnBudget(box))
}

/** Keep a paragraph together when it fits; long paragraphs continue on the next page without omission. */
export function paginateSlideText(lines: readonly string[], box: SlideBox = SLIDE_BODY, rowsPerPage = SLIDE_ROWS_PER_PAGE) {
  if (!Number.isSafeInteger(rowsPerPage) || rowsPerPage < 1) throw new Error("Invalid slide row count")
  const pages: string[][] = [[]]
  lines.forEach((line) => {
    const fragments = fitSlideText(line, box)
    if (fragments.length <= rowsPerPage && pages.at(-1)!.length && pages.at(-1)!.length + fragments.length > rowsPerPage) pages.push([])
    fragments.forEach((fragment) => {
      if (pages.at(-1)!.length === rowsPerPage) pages.push([])
      pages.at(-1)!.push(fragment)
    })
    if (pages.at(-1)!.length < rowsPerPage) pages.at(-1)!.push("")
  })
  return pages.filter((page) => page.some((line) => line.length)).map((page) => page.at(-1) === "" ? page.slice(0, -1) : page)
}

/** A bounded row grid makes the complete text usable in a deck, including long notes and titles. */
export function addReportTextSlides(presentation: PptxGenJS, title: string, lines: readonly string[], footer = "") {
  const headingLines = fitSlideText(title, SLIDE_HEADING)
  if (headingLines.length > 2) addReportTextSlides(presentation, "Section title", [title], footer)
  const heading = headingLines.length > 2 ? "Section continued" : headingLines.join("\n")
  const pages = paginateSlideText(lines.length ? lines : ["No records."])
  pages.forEach((page, index) => {
    const slide = presentation.addSlide()
    slide.background = { color: "F6F8F5" }
    slide.addText(heading, { x: 0.6, y: 0.3, w: 12.1, h: 0.85, fontSize: 20, fontFace: "Aptos", color: "173D2C", bold: true, margin: 0, valign: "top", breakLine: false })
    page.forEach((line, row) => {
      if (line) slide.addText(line, { x: 0.6, y: 1.4 + row * 0.32, w: 12.1, h: 0.3, fontSize: 14, fontFace: "Aptos", color: "243C30", margin: 0, valign: "top", breakLine: false })
    })
    slide.addText(`${footer ? `${footer} · ` : ""}Page ${index + 1}/${pages.length}`, { x: 0.6, y: 7.0, w: 11.6, h: 0.2, fontSize: 9, color: "607469", margin: 0 })
    slide.slideNumber = { x: 12.2, y: 7.0, w: 0.5, h: 0.2, fontSize: 9, color: "607469", margin: 0 }
  })
}

export type ReportValueRow = { value: string; period: string; sources: string }

/** Explicit row heights avoid Office auto-pagination discarding a long cell or moving it over another row. */
export function addReportValueSlides(presentation: PptxGenJS, title: string, rows: readonly ReportValueRow[]) {
  if (!rows.length) return
  const widths = [6.2, 2.4, 3.5]
  const pages: { cells: string[]; height: number }[][] = [[]]
  const used = { height: 0 }
  rows.forEach((row) => {
    const cells = [row.value, row.period, row.sources].map((text, index) => fitSlideText(text, { fontSize: 12, boxWidthInches: widths[index]!, marginInches: 0.08 }))
    const length = Math.max(...cells.map((cell) => cell.length))
    for (let offset = 0; offset < length; offset += 14) {
      const count = Math.min(14, length - offset)
      const height = count * 0.25 + 0.14
      if (used.height + height > 4.9 && pages.at(-1)!.length) { pages.push([]); used.height = 0 }
      pages.at(-1)!.push({ cells: cells.map((cell) => cell.slice(offset, offset + 14).join("\n")), height })
      used.height += height
    }
  })
  const heading = fitSlideText(title, SLIDE_HEADING)
  if (heading.length > 2) addReportTextSlides(presentation, "Data table title", [title], "Preserved review")
  pages.forEach((page, index) => {
    const slide = presentation.addSlide()
    slide.background = { color: "F6F8F5" }
    slide.addText(heading.length > 2 ? "Captured data continued" : heading.join("\n"), { x: 0.6, y: 0.3, w: 12.1, h: 0.85, fontSize: 20, fontFace: "Aptos", color: "173D2C", bold: true, margin: 0 })
    const tableOptions = { x: 0.6, w: 12.1, colW: widths, fontFace: "Aptos", fontSize: 12, color: "243C30", margin: 0.06, autoPage: false, border: { type: "solid" as const, pt: 0.4, color: "D8E2DB" } }
    slide.addTable([["Captured value", "Period", "Sources"].map((text) => ({ text }))], { ...tableOptions, y: 1.25, h: 0.4, rowH: 0.4, fill: { color: "E4ECE6" }, bold: true })
    const position = { y: 1.65 }
    page.forEach((row) => {
      slide.addTable([row.cells.map((text) => ({ text }))], { ...tableOptions, y: position.y, h: row.height, rowH: row.height, fill: { color: "FFFFFF" }, valign: "top" })
      position.y += row.height
    })
    slide.addText(`Preserved review · Complete data ${index + 1}/${pages.length} · Long values continue in the next row`, { x: 0.6, y: 7.0, w: 11.6, h: 0.2, fontSize: 9, color: "607469", margin: 0 })
    slide.slideNumber = { x: 12.2, y: 7.0, w: 0.5, h: 0.2, fontSize: 9, color: "607469", margin: 0 }
  })
}

export function chartSlot(index: number) {
  return { page: Math.floor(index / CHART_ROWS_PER_PAGE) + 1, row: (index % CHART_ROWS_PER_PAGE) + 1 }
}

/** Counts and periods from the captured review. Undefined when the selection is not exactly the preserved sections. */
export function reviewCoverageLines(review: PreservedReview, sectionRefs: readonly string[]) {
  if (new Set(sectionRefs).size !== sectionRefs.length) return undefined
  const sections = sectionRefs.map((id) => review.sections.find((section) => section.id === id))
  if (sections.some((section) => !section)) return undefined
  const comments = selectedReviewComments(review, sectionRefs)
  if (!comments) return undefined
  return [
    `Coverage: ${sections.length} section(s) in selection order.`,
    ...sections.flatMap((section) => section ? [coverageLine(section)] : []),
    `Comments in this selection: ${comments.length}. Comments omitted: ${review.comments.length - comments.length}.`,
  ]
}

export type SlideBox = { fontSize: number; boxWidthInches: number; marginInches: number }

function coverageLine(section: PreservedReview["sections"][number]) {
  const projection = capturedProjection(section.content)
  const values = projection?.values ?? []
  const missing = projection?.missing ?? []
  const numeric = values.filter((value) => typeof value.value === "number" && Number.isFinite(value.value)).length
  const periods = periodList([{ start: section.period.start, end: section.period.end }, ...values.flatMap((value) => value.period ? [value.period] : [])])
  const empty = section.count === 0 || values.length === 0
  return `${section.title} · ${section.period.start} – ${section.period.end} · records ${section.count} · values ${values.length} · numeric ${numeric} · missing ${missing.length} · ${empty ? "section without data" : "section with data"} · periods ${periods} · ${chartLine(projection?.reviewChart)}`
}

function chartLine(chart: ReviewChart | undefined) {
  if (!chart) return "no chart captured"
  if (chart.status === "unavailable") return `chart unavailable: ${chart.reason || "unspecified"}`
  return `captured chart ${chart.viewId}; the table keeps every captured value; a figure appears only when the review renderer accepts this snapshot`
}

function capturedProjection(content: unknown): (Pick<DomainProjection, "values" | "missing"> & { reviewChart?: ReviewChart }) | undefined {
  if (!content || typeof content !== "object") return undefined
  const projection = content as { values?: unknown; missing?: unknown; reviewChart?: ReviewChart }
  if (!Array.isArray(projection.values) || !Array.isArray(projection.missing)) return undefined
  return projection as Pick<DomainProjection, "values" | "missing"> & { reviewChart?: ReviewChart }
}

function periodList(periods: readonly { start: string; end: string }[]) {
  const seen = new Set<string>()
  return periods.flatMap((period) => {
    const key = `${period.start}/${period.end}`
    if (seen.has(key)) return []
    seen.add(key)
    return [`${period.start} – ${period.end}`]
  }).join("; ") || "none"
}

function columnBudget(box: SlideBox) {
  const inner = (box.boxWidthInches - 2 * box.marginInches) * 72
  // A conservative glyph budget leaves room for font substitution in Office/LibreOffice.
  const column = box.fontSize * 0.6
  if (!Number.isFinite(inner) || !Number.isFinite(column) || inner <= 0 || column <= 0) return 1
  return Math.max(1, Math.floor(inner / column))
}

function pack(text: string, budget: number) {
  const clusters = graphemes(text)
  if (!clusters.length) return [""]
  const pages: string[][] = [[]]
  let used = 0
  for (const cluster of clusters) {
    const width = clusterWidth(cluster)
    const page = pages[pages.length - 1]!
    if (width > 0 && used > 0 && used + width > budget) {
      const boundary = page.findLastIndex((part) => /\s/u.test(part))
      const tail = boundary >= Math.floor(page.length / 2) ? page.splice(boundary + 1) : []
      pages.push([...tail, cluster])
      used = tail.reduce((total, part) => total + clusterWidth(part), width)
      continue
    }
    page.push(cluster)
    used += width
  }
  return pages.map((page) => page.join(""))
}

function graphemes(text: string) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment)
}

function clusterWidth(cluster: string) {
  const chars = [...cluster]
  if (!chars.length || chars.every((char) => /\p{M}/u.test(char) || char === "\u200d" || char === "\u200b" || char === "\ufeff")) return 0
  if (chars.some((char) => wide(char) || /\p{Extended_Pictographic}/u.test(char) || /[MW@%&]/.test(char))) return 2
  return 1
}

function wide(char: string) {
  const code = char.codePointAt(0) ?? 0
  return (code >= 0x1100 && code <= 0x115f)
    || (code >= 0x2329 && code <= 0x232a)
    || (code >= 0x2e80 && code <= 0xa4cf)
    || (code >= 0xac00 && code <= 0xd7a3)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe10 && code <= 0xfe19)
    || (code >= 0xfe30 && code <= 0xfe6f)
    || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6)
    || (code >= 0x1f300 && code <= 0x1faff)
    || (code >= 0x20000 && code <= 0x3fffd)
}

