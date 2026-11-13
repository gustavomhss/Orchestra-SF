import { matchesSelectedSources } from "./references.ts"
import type { ReviewChart } from "./port.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"

/** Geometry for text the caller already authorized. This module does not read sources, grant access, or draw charts. */
export const SLIDE_BODY = { fontSize: 14, boxWidthInches: 12.1, marginInches: 0.08 }
export const SLIDE_HEADING = { fontSize: 20, boxWidthInches: 12.1, marginInches: 0 }
/** Matches the row pitch in chart.ts. Captions use this; the raster stays there. */
export const CHART_ROWS_PER_PAGE = 8

export function fitSlideText(text: string, box: SlideBox) {
  return pack(text.replace(/\r\n|\r|\n/g, " ↵ "), columnBudget(box))
}

export function chartSlot(index: number) {
  return { page: Math.floor(index / CHART_ROWS_PER_PAGE) + 1, row: (index % CHART_ROWS_PER_PAGE) + 1 }
}

/** Counts and periods from the captured review. Undefined when the selection is not exactly the preserved sections. */
export function reviewCoverageLines(review: PreservedReview, sectionRefs: readonly string[]) {
  if (new Set(sectionRefs).size !== sectionRefs.length) return undefined
  const sections = sectionRefs.map((id) => review.sections.find((section) => section.id === id))
  if (sections.some((section) => !section)) return undefined
  const selectedRefs = sections.flatMap((section) => section?.sourceRefs ?? [])
  const comments = review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, selectedRefs))
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
  const column = box.fontSize * 0.5
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
      pages.push([cluster])
      used = width
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
