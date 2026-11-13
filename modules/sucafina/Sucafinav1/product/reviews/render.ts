import type { ReviewOutcomeComparison } from "./outcome.ts"
import { reviewOutcomeComparisonLines, validOutcomeComparison, reviewOutcomeLines, validReviewOutcome } from "./outcome.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import { reviewDecisionLines, validReviewDecision } from "./decision.ts"
import { addReportTextSlides, addReportValueSlides, fitSlideText, reviewCoverageLines, SLIDE_HEADING } from "./report-layout.ts"
import { createHash } from "node:crypto"
import { reviewInclusion } from "./inclusion.ts"
import type { ReviewInclusion } from "./inclusion.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { Artifact } from "../../runtime/artifact.ts"
import { matchesSelectedSources } from "./references.ts"
import { renderReviewBars, renderReviewChart, renderReviewTimeline, renderReviewWaterfall, renderReviewSensitivity } from "./chart.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ReviewChart } from "./port.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { ArtifactResult } from "../../runtime/artifact.ts"

/** The caller must obtain the review through an access-revalidating port immediately before rendering. */
export async function renderPreservedReview(review: PreservedReview, options: { title: string; format: "pptx" | "docx"; sectionRefs: readonly string[] }): Promise<ArtifactResult> {
  if (new Set(options.sectionRefs).size !== options.sectionRefs.length) return { ok: false, status: 422, errors: ["Duplicate section."] }
  const sections = options.sectionRefs.map((id) => review.sections.find((section) => section.id === id))
  if (sections.some((section) => !section)) return { ok: false, status: 422, errors: ["Selected section is unavailable."] }
  if (sections.some((section) => {
    const projection = section?.content as DomainProjection | undefined
    return !section || !projection || !Array.isArray(projection.values) || !Number.isSafeInteger(section.count) || section.count < 0 || !Array.isArray(projection.missing) || !projection.context || !Array.isArray(projection.context.sourceRefs) || projection.values.some((value: DomainProjection["values"][number]) => !value || typeof value.id !== "string" || !value.period || !Array.isArray(value.sourceRefs) || (value.value !== null && typeof value.value !== "string" && typeof value.value !== "boolean" && (typeof value.value !== "number" || !Number.isFinite(value.value))))
  })) return { ok: false, status: 422, errors: ["Section content is invalid."] }
  const content = sections.flatMap((section) => {
    if (!section) return []
    const projection = section.content as DomainProjection
    const chart = (projection as DomainProjection & { reviewChart?: ReviewChart }).reviewChart
    const lineImage = renderReviewChart(projection, chart)
    const bars = renderReviewBars(projection, chart)
    const timeline = renderReviewTimeline(projection, chart)
    const waterfall = renderReviewWaterfall(projection, chart)
    const scatter = renderReviewSensitivity(projection, chart)
    const images = lineImage ? [lineImage] : bars ?? timeline ?? waterfall ?? (scatter ? [scatter] : [])
    const chartValues = images.length && chart?.status === "ok" ? chart.series.flatMap((series) => series.values.filter((value) => typeof value.value === "number")) : []
    const range = waterfall && chart?.status === "ok" && chart.waterfall?.status === "ok" ? chart.waterfall.segments.flatMap((segment) => [segment.start, segment.end].filter((value): value is number => value !== null)) : chartValues.map((entry) => Number(entry.value))
    const chartMinimum = range.reduce((value, entry) => Math.min(value, entry), 0)
    const chartMaximum = range.reduce((value, entry) => Math.max(value, entry), 0)
    const chartDates = chartValues.map((value) => value.period.start).sort()
    const sensitivityPoints = scatter && chart?.status === "ok" && chart.sensitivity ? chart.sensitivity.result.evaluated.filter((point) => Number.isFinite(point.parameterValue) && point.value !== null && Number.isFinite(point.value)) : []
    const sensitivityMinX = sensitivityPoints.reduce((value, point) => Math.min(value, point.parameterValue), Infinity)
    const sensitivityMaxX = sensitivityPoints.reduce((value, point) => Math.max(value, point.parameterValue), -Infinity)
    const sensitivityMinY = sensitivityPoints.reduce((value, point) => Math.min(value, point.value!), Infinity)
    const sensitivityMaxY = sensitivityPoints.reduce((value, point) => Math.max(value, point.value!), -Infinity)
    const waterfallIds = waterfall && chart?.status === "ok" && chart.waterfall?.status === "ok" ? [chart.waterfall.finalValueId, ...chart.waterfall.segments.flatMap((segment) => [segment.startValueId, segment.endValueId, segment.componentValueId])] : []
    const waterfallValues = projection.values.filter((value) => waterfallIds.includes(value.id))
    const waterfallUnit = waterfallValues.find((value) => value.currency)?.currency ?? waterfallValues.find((value) => value.unit)?.unit ?? "unit unavailable"
    return [{
      images,
      table: projection.values.map((value) => ({ value: `${value.id}: ${value.value === null ? "unavailable" : String(value.value)}${value.unit ? ` ${value.unit}` : ""}${value.currency ? ` ${value.currency}` : ""}`, period: `${value.period.start} – ${value.period.end}`, sources: value.sourceRefs.map((ref: BusinessEvidenceRef) => ref.refId).join(", ") || "unavailable" })),
      figureCaption: chart?.status === "ok" ? `${chart.viewId} · ${timeline ? "dates" : scatter ? `${chart.sensitivity?.parameterUnit ?? "unavailable"} → ${chart.sensitivity?.resultUnit ?? "unavailable"}` : waterfall ? waterfallUnit : [...new Set(chart.series.map((series) => series.unit))].join(" / ")} · ${section.period.start} – ${section.period.end}` : "",
      title: `${section.title} · ${section.period.start} – ${section.period.end}`,
      lines: [
        ...(typeof (projection as DomainProjection & { reviewAgendaNote?: unknown }).reviewAgendaNote === "string" ? [`Agenda note: ${(projection as DomainProjection & { reviewAgendaNote: string }).reviewAgendaNote}`] : []),
        ...((projection as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison && validOutcomeComparison((projection as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison) ? reviewOutcomeComparisonLines((projection as DomainProjection & { reviewOutcomeComparison: ReviewOutcomeComparison }).reviewOutcomeComparison) : []),
        ...((projection as DomainProjection & { reviewOutcome?: ObservedResultProjection }).reviewOutcome && validReviewOutcome((projection as DomainProjection & { reviewOutcome?: ObservedResultProjection }).reviewOutcome) ? [...reviewOutcomeLines((projection as DomainProjection & { reviewOutcome: ObservedResultProjection }).reviewOutcome), `Outcome snapshot: ${JSON.stringify((projection as DomainProjection & { reviewOutcome: ObservedResultProjection }).reviewOutcome)}`] : []),
        ...(projection.decision ? validReviewDecision(projection.decision) ? [...reviewDecisionLines(projection.decision), `Decision snapshot: ${JSON.stringify(projection.decision)}`] : ["Decision details unavailable."] : []),
        `Selected records: ${section.count}`,
        ...(chart ? images.length && chart.status === "ok" ? [
          lineImage
            ? `Financial trajectory · ${chart.series[0]!.unit}; horizontal axis: ${chartDates[0]} – ${chartDates.at(-1)}; vertical axis: ${chartMinimum} – ${chartMaximum}, with zero marked.`
            : bars ? chart.viewId === "BI04" ? "Capacity and cost panels use separate scales and units; zero is marked on each panel." : `Category bars · ${chart.series[0]!.unit}; horizontal axis: ${chartMinimum} – ${chartMaximum}, with zero marked.`
            : timeline ? `Timeline · ${projection.context.period.start} – ${projection.context.period.end}; filled green: completed; hollow blue: planned; hollow gray: unknown.`
            : waterfall ? `Waterfall · ${chartMinimum} – ${chartMaximum} ${waterfallUnit}; green: rising, orange: falling; zero marked.`
            : `Sensitivity scatter · X ${sensitivityMinX} – ${sensitivityMaxX}; Y ${sensitivityMinY} – ${sensitivityMaxY}; each point is a producer-evaluated result, with no interpolated threshold.`,
          ...(waterfall && chart.waterfall?.status === "ok" ? [`Reconciliation: ${chart.waterfall.reconciliation}; final: ${chart.waterfall.final ?? "unavailable"} ${waterfallUnit}.`, ...chart.waterfall.segments.map((segment, index) => `Waterfall page ${Math.floor(index / 8) + 1}, row ${index % 8 + 1}: ${segment.label} · ${segment.start ?? "unavailable"} → ${segment.end ?? "unavailable"} · contribution ${segment.amount ?? "unavailable"} · source ${segment.componentValueId}`)] : timeline && chart.timeline?.status === "ok" ? chart.timeline.items.map((item, index) => `Timeline page ${Math.floor(index / 8) + 1}, row ${index % 8 + 1}: ${item.label} · ${item.state} · ${item.date ?? "unavailable"}${item.date && (item.date < projection.context.period.start || item.date > projection.context.period.end) ? " · outside displayed period" : ""}`) : chart.series.map((series, index) => `${["Green", "Blue", "Orange", "Purple"][index]}: ${series.label} (${series.unit})`)),
          ...(bars ? chart.viewId === "BI04" ? chart.series.flatMap((series, seriesIndex) => {
            const numbers = series.values.flatMap((value) => typeof value.value === "number" ? [value.value] : [])
            const minimum = numbers.reduce((result, value) => Math.min(result, value), 0)
            const maximum = numbers.reduce((result, value) => Math.max(result, value), 0)
            const offset = chart.series.slice(0, seriesIndex).reduce((result, item) => result + Math.ceil(item.values.length / 8), 0)
            return [`${series.label}: scale ${minimum} – ${maximum} ${series.unit}.`, ...series.values.map((value, index) => `Chart page ${offset + Math.floor(index / 8) + 1}, bar ${index % 8 + 1}: ${series.label} · ${value.id} · ${value.value ?? "unavailable"} ${series.unit} · ${value.period.start} – ${value.period.end}`)]
          }) : chart.series.flatMap((series) => series.values.map((value) => ({ series, value }))).map((entry, index) => `Chart page ${Math.floor(index / 8) + 1}, bar ${index % 8 + 1}: ${entry.series.label} · ${entry.value.id} · ${entry.value.value ?? "unavailable"} ${entry.series.unit} · ${entry.value.period.start} – ${entry.value.period.end}`) : []),
          ...chart.limitations,
        ] : [chart.status === "ok" ? `Chart ${chart.viewId} unavailable in this export; the captured data follows.` : `Chart unavailable: ${chart.reason}`] : []),
        ...(chart?.status === "ok" && chart.sensitivity ? [
          `Sensitivity parameter ${chart.sensitivity.result.parameterRef} · bounds: ${chart.sensitivity.result.bounds.minimum} – ${chart.sensitivity.result.bounds.maximum} (${chart.sensitivity.result.bounds.steps} steps) · reported unit: ${chart.sensitivity.result.unit || "unavailable"} · X: ${chart.sensitivity.parameterUnit || "unit unavailable"} · Y: ${chart.sensitivity.resultUnit || "unit unavailable"} · ${chart.sensitivity.result.comparisonStatus} · engine ${chart.sensitivity.result.engineVersion}`,
          chart.sensitivity.result.thresholdEvidence.state === "sampled" && Number.isFinite(chart.sensitivity.result.thresholdEvidence.interval.minimum) && Number.isFinite(chart.sensitivity.result.thresholdEvidence.interval.maximum) && chart.sensitivity.result.thresholdEvidence.interval.minimum <= chart.sensitivity.result.thresholdEvidence.interval.maximum
            ? `Sampled threshold interval: ${chart.sensitivity.result.thresholdEvidence.interval.minimum} – ${chart.sensitivity.result.thresholdEvidence.interval.maximum} ${chart.sensitivity.parameterUnit || "unit unavailable"}`
            : chart.sensitivity.result.thresholdEvidence.state === "exact" && chart.sensitivity.result.threshold === chart.sensitivity.result.thresholdEvidence.value
              ? `Exact threshold: ${chart.sensitivity.result.threshold} ${chart.sensitivity.parameterUnit || "unit unavailable"}`
              : "Threshold unavailable.",
          ...chart.sensitivity.result.evaluated.map((point) => `Sensitivity point: ${point.parameterValue} ${chart.sensitivity!.parameterUnit || "unit unavailable"} → ${point.value ?? "unavailable"} ${chart.sensitivity!.resultUnit || "unit unavailable"} · result ${point.resultRef}`),
          ...chart.sensitivity.result.unresolvedConditions.map((condition) => `${condition.category}: ${condition.reason} · sources: ${condition.evidenceRefs.map((ref) => ref.refId).join(", ") || "unavailable"}`),
          ...chart.sensitivity.result.costCoverageRefs.map((ref) => `Coverage: ${ref}`),
          ...chart.sensitivity.result.evidenceRefs.map((ref) => `Sensitivity source: ${ref.refId}`),
          ...(chart.sensitivity.result.thresholdEvidence.state === "unavailable" ? [] : chart.sensitivity.result.thresholdEvidence.evidenceRefs.map((ref) => `Threshold source: ${ref.refId}`)),
        ] : []),
        ...projection.missing.map((missing) => `${missing.field}: ${missing.reason}`),
        ...(projection.values.length ? [] : [section.count ? "No values available for the selected records." : "No records."]),
      ],
    }]
  })
  const selectedRefs = sections.flatMap((section) => section?.sourceRefs ?? [])
  const comments = review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, selectedRefs))
  if (review.comments.length > comments.length) content.push({ title: "Comment coverage", images: [], table: [], figureCaption: "", lines: ["Some preserved comments do not match the selected section sources and are omitted."] })
  if (comments.length) content.push({ title: "Preserved comments", images: [], table: [], figureCaption: "", lines: comments.map((comment) => {
    return `${comment.id} v${comment.version} · ${comment.authorRef} · ${comment.createdAt}: ${comment.content}`
  }) })
  const coverage = reviewCoverageLines(review, options.sectionRefs)
  if (coverage) content.unshift({ title: "Coverage", images: [], table: [], figureCaption: "", lines: [...coverage] })
  const name = options.title.replace(/[^a-z0-9]+/gi, "_") || "Review"
  if (options.format === "docx") {
    const { Document, Packer, Paragraph, HeadingLevel, ImageRun, Footer, PageNumber, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, TableLayoutType } = await import("docx")
    const document = new Document({
      title: options.title,
      creator: "Sucafina",
      styles: { default: { document: { run: { font: "Aptos", size: 22, color: "243C30" }, paragraph: { spacing: { after: 120, line: 280 } } }, heading1: { run: { color: "173D2C", size: 30 }, paragraph: { spacing: { before: 260, after: 160 }, keepNext: true } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("Preserved review · Page "), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(" of "), new TextRun({ children: [PageNumber.TOTAL_PAGES] })] })] }) },
        children: [
      new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }),
      new Paragraph(`Review ${review.id} v${review.version} · ${review.createdAt}`),
      new Paragraph("This material contains the selected preserved sections in order. Human agenda notes and comments are identified separately from captured values. Each section keeps its own period and coverage."),
      ...content.flatMap((section) => [
        new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
        ...section.images.flatMap((image, index) => [
          new Paragraph({ text: `Captured figure ${index + 1}/${section.images.length} · ${section.figureCaption}. Row numbers correspond to the chart captions and complete data below.`, keepNext: true }),
          new Paragraph({ children: [new ImageRun({ type: "png", data: image, transformation: { width: 600, height: 260 }, altText: { name: section.title, description: "Captured chart with labeled axes. Series, periods, units and every source value follow in the data table." } })] }),
        ]),
        ...section.lines.map((line) => new Paragraph({ text: line, widowControl: true })),
        ...(section.table.length ? [new Table({
          width: { size: 9906, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [4900, 2100, 2906],
          rows: [
            new TableRow({ tableHeader: true, children: ["Captured value", "Period", "Sources"].map((label) => new TableCell({ shading: { fill: "E4ECE6" }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })] })) }),
            ...section.table.map((row) => new TableRow({ children: [row.value, row.period, row.sources].map((text, column) => new TableCell({ margins: { top: 100, bottom: 100, left: 100, right: 100 }, children: [new Paragraph({ children: fitSlideText(text, { fontSize: 10, boxWidthInches: [4900, 2100, 2906][column]! / 1440, marginInches: 0.1 }).map((fragment, index) => new TextRun({ text: fragment, size: 20, ...(index ? { break: 1 } : {}) })), widowControl: false, spacing: { after: 0, line: 240 } })] })) })),
          ],
        })] : []),
      ]),
    ] }] })
    const artifact = { ok: true as const, name: `${name}.docx`, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array(await Packer.toBuffer(document)) }
    sealReviewArtifact(artifact, review, options)
    return artifact
  }
  const { default: PptxGenJS } = await import("pptxgenjs")
  const presentation = new PptxGenJS()
  presentation.layout = "LAYOUT_WIDE"
  presentation.author = "Sucafina"
  presentation.title = options.title
  addReportTextSlides(presentation, options.title, [
    `Review ${review.id} v${review.version} · ${review.createdAt}`,
    `${sections.length} selected section(s), in the preserved selection order.`,
    "Human agenda notes and comments are identified separately from captured values. Each section keeps its own period and coverage.",
  ], "Preserved review")
  if (!content.length) {
    const slide = presentation.addSlide()
    slide.addText(`${options.title} · no sections selected`, { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 20 })
  }
  content.forEach((section, sectionIndex) => {
    const titles = fitSlideText(section.title, SLIDE_HEADING)
    const heading = titles.length > 2 ? `Section ${sectionIndex + 1}` : titles.join("\n")
    if (titles.length > 2 && section.images.length) addReportTextSlides(presentation, "Section title", [section.title], "Preserved review")
    section.images.forEach((image, page) => {
      const slide = presentation.addSlide()
      slide.background = { color: "F6F8F5" }
      slide.addText(heading, { x: 0.6, y: 0.3, w: 12.1, h: 0.85, fontSize: 20, fontFace: "Aptos", color: "173D2C", bold: true, margin: 0 })
      slide.addText(`Figure ${page + 1}/${section.images.length} · ${section.figureCaption}`, { x: 0.6, y: 1.2, w: 12.1, h: 0.3, fontSize: 12, color: "607469", margin: 0 })
      slide.addImage({ data: `data:image/png;base64,${Buffer.from(image).toString("base64")}`, x: 0.8, y: 1.65, w: 11.6, h: 5.03, altText: "Captured chart with labeled axes. All source values, periods, units and chart captions follow." })
      slide.addText("Preserved review · chart rows retain producer order", { x: 0.6, y: 7.0, w: 11.6, h: 0.2, fontSize: 9, color: "607469", margin: 0 })
      slide.addSlideNumber({ x: 12.2, y: 7.0, w: 0.5, h: 0.2, fontSize: 9, color: "607469", margin: 0 })
    })
    addReportTextSlides(presentation, section.title, section.lines, "Preserved review")
    addReportValueSlides(presentation, section.title, section.table)
  })
  const output = await presentation.write({ outputType: "uint8array" })
  if (!(output instanceof Uint8Array)) throw new Error("Unexpected presentation output")
  const artifact = { ok: true as const, name: `${name}.pptx`, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes: output }
  sealReviewArtifact(artifact, review, options)
  return artifact
}

const seals = new WeakMap<Artifact, { digest: string; inclusion: ReviewInclusion; renderDigest: string }>()

function sealReviewArtifact(artifact: Artifact, review: PreservedReview, options: { title: string; format: "pptx" | "docx"; sectionRefs: readonly string[] }) {
  const inclusion = reviewInclusion(review, options.sectionRefs)
  if (inclusion) seals.set(artifact, { digest: createHash("sha256").update(artifact.bytes).digest("hex"), inclusion, renderDigest: digestSfValue({ rendererVersion: "wp07-paginated-v2", title: options.title, format: options.format }) })
}

/** A store can verify this receipt but only the renderer can create it. */
export function readReviewArtifactSeal(artifact: Artifact, review: PreservedReview, sectionRefs: readonly string[]) {
  const seal = seals.get(artifact)
  const expected = reviewInclusion(review, sectionRefs)
  if (!seal || !expected || seal.digest !== createHash("sha256").update(artifact.bytes).digest("hex") || digestSfValue(seal.inclusion) !== digestSfValue(expected)) return undefined
  return structuredClone(seal.inclusion)
}

/** Container timestamps are excluded; all caller-controlled rendering inputs remain part of the retry identity. */
export function readReviewArtifactRenderDigest(artifact: Artifact, review: PreservedReview, sectionRefs: readonly string[]) {
  return readReviewArtifactSeal(artifact, review, sectionRefs) ? seals.get(artifact)?.renderDigest : undefined
}
