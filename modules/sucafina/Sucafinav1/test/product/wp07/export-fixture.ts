import JSZip from "jszip"
import { SaxesParser } from "saxes"
import type { DomainProjection, PreservedReview, SourceRef } from "../../../product/contracts/context.ts"
import type { ReviewChart } from "../../../product/reviews/port.ts"
import { empty } from "../../fixture/persistence.ts"

/** Explicit synthetic corpus shared by the hosted content checks and visual export inspection. */
export function exportFixture() {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const projectSource: SourceRef = { surface: "dashboard", type: "project", id: "synthetic-projects", incarnation: "fixture-projects-v1", version: 1, fields: ["name", "notes"], period, observedAt: "2026-11-13T04:01:10Z" }
  const forecastSource: SourceRef = { ...projectSource, surface: "planner", type: "forecast", id: "synthetic-forecast", incarnation: "fixture-forecast-v1", fields: ["amount"] }
  const context = { installationId: "fixture", projectId: "fixture", principalRef: "fixture-admin", accessRevision: "fixture-access-v1", policyVersion: "fixture-policy-v1", surface: "dashboard" as const, period, currency: "USD", sourceRefs: [projectSource], capabilities: [] }
  const note = (index: number) => `Project ${index + 1} records the complete meeting note: Café, ação and e\u0301 retain their characters. The delivery owner confirmed the described scope; the next review must verify the source again. This note deliberately spans several visual lines so that pagination preserves its middle and final sentences. Reference ${"W".repeat(155)}. END-NOTE-${String(index + 1).padStart(2, "0")}.`
  const projects: DomainProjection = { context, version: 1, engineVersion: "synthetic-fixture-v1", components: [], missing: [], values: Array.from({ length: 25 }, (_, index) => ({ id: `PRJ-${String(index + 1).padStart(2, "0")}`, value: note(index), period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" })) }
  const monthly = [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000]
  const actual: (number | null)[] = [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null]
  const forecast: (number | null)[] = [null, null, null, null, null, null, null, null, null, 38000, 112000, 40000]
  const series = [
    { id: "budget", label: "Budget", role: "budget" as const, amounts: monthly },
    { id: "actual", label: "Observed actual", role: "actual" as const, amounts: actual },
    { id: "outlook", label: "Open forecast", role: "outlook" as const, amounts: forecast },
  ].map((entry) => {
    const values: DomainProjection["values"] = entry.amounts.map((value, index) => ({ id: `${entry.id}-${String(index + 1).padStart(2, "0")}`, value, currency: "USD", period: { start: `2026-${String(index + 1).padStart(2, "0")}-01`, end: new Date(Date.UTC(2026, index + 1, 0)).toISOString().slice(0, 10) }, granularity: "month", sourceRefs: [], drilldown: null, evidenceState: value === null ? "absent" : "confirmed" }))
    return { id: entry.id, label: entry.label, unit: "USD", role: entry.role, valueIds: values.map((value) => value.id), values }
  })
  const chart: ReviewChart = { status: "ok", viewId: "BI01", series, limitations: ["Synthetic FX03 monthly vectors. Closed-month forecast and future actual remain unavailable; no interpolation fills gaps."], unassigned: [] }
  const finance: DomainProjection & { reviewChart: ReviewChart } = { context: { ...context, surface: "planner", sourceRefs: [forecastSource] }, version: 1, engineVersion: "synthetic-fixture-v1", components: [], missing: [], values: series.flatMap((entry) => [...entry.values]), reviewChart: chart }
  const missing: DomainProjection & { reviewChart: ReviewChart } = { context: { ...context, period: { start: "2026-11-01", end: "2026-11-30" }, sourceRefs: [] }, version: 1, engineVersion: "synthetic-fixture-v1", components: [], values: [], missing: [{ field: "actual", reason: "unavailable" }], reviewChart: { status: "unavailable", reason: "No authorized series was captured for this section." } }
  const review: PreservedReview = {
    id: "synthetic-wp07-long-review", version: 1, createdAt: "2026-11-13T04:01:10Z", sourceRefs: [projectSource, forecastSource],
    comments: [{ id: "meeting-comment", version: 3, authorRef: "synthetic-reviewer", createdAt: "2026-11-13T04:01:10Z", content: "Human comment: this is the preserved version 3 note, separate from calculated figures. The source thread may later change without rewriting this review. END-COMMENT-V3", sourceRefs: [projectSource] }],
    sections: [
      { id: "projects", title: "Projects — 25 selected records with complete notes", period, count: 25, sourceRefs: [projectSource], content: projects },
      { id: "finance", title: "Financial trajectory — monthly source values", period, count: 1, sourceRefs: [forecastSource], content: finance },
      { id: "missing", title: "Empty monthly section", period: missing.context.period, count: 0, sourceRefs: [], content: missing },
    ],
  }
  const legacy = empty()
  legacy.data.projects = Array.from({ length: 25 }, (_, index) => ({ id: `legacy-${index + 1}`, name: `LEGACY-PROJECT-${String(index + 1).padStart(2, "0")}`, title: "Delivery", status: "Planned", priority: "Normal", notes: note(index) }))
  return { review, sectionRefs: review.sections.map((section) => section.id), legacy }
}

export async function extractReportText(bytes: Uint8Array, format: "pptx" | "docx") {
  const zip = await JSZip.loadAsync(bytes)
  const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const parts: string[] = []
  for (const path of paths) {
    const parser = new SaxesParser({ xmlns: false })
    parser.on("text", (text) => parts.push(text))
    parser.write(await zip.file(path)!.async("string")).close()
  }
  return { text: parts.join("\n"), pages: format === "pptx" ? paths.length : null, figures: Object.keys(zip.files).filter((path) => /^(word|ppt)\/media\/.*\.png$/.test(path)).length }
}
