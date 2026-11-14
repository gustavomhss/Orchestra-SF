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
    const scatter = renderReviewSensitivity(chart)
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
      title: `${section.title} · ${section.period.start} – ${section.period.end}`,
      lines: [
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
        ...projection.values.map((value) => `${value.id}: ${value.value === null ? "unavailable" : String(value.value)}${value.unit ? ` ${value.unit}` : ""}${value.currency ? ` ${value.currency}` : ""} · ${value.period.start} – ${value.period.end} · sources: ${value.sourceRefs.map((ref: BusinessEvidenceRef) => ref.refId).join(", ") || "unavailable"}`),
        ...projection.missing.map((missing) => `${missing.field}: ${missing.reason}`),
        ...(projection.values.length ? [] : [section.count ? "No values available for the selected records." : "No records."]),
      ],
    }]
  })
  const selectedRefs = sections.flatMap((section) => section?.sourceRefs ?? [])
  const comments = review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, selectedRefs))
  if (review.comments.length > comments.length) content.push({ title: "Comment coverage", images: [], lines: ["Some preserved comments do not match the selected section sources and are omitted."] })
  if (comments.length) content.push({ title: "Preserved comments", images: [], lines: comments.map((comment) => {
    return `${comment.id} v${comment.version} · ${comment.authorRef} · ${comment.createdAt}: ${comment.content}`
  }) })
  const name = options.title.replace(/[^a-z0-9]+/gi, "_") || "Review"
  if (options.format === "docx") {
    const { Document, Packer, Paragraph, HeadingLevel, ImageRun } = await import("docx")
    const document = new Document({ title: options.title, sections: [{ children: [
      new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }),
      new Paragraph(`Review ${review.id} v${review.version} · ${review.createdAt}`),
      ...content.flatMap((section) => [new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }), ...section.images.map((image) => new Paragraph({ children: [new ImageRun({ type: "png", data: image, transformation: { width: 600, height: 260 }, altText: { name: "Review chart", description: "Captured series and values are listed in the following text." } })] })), ...section.lines.map((line) => new Paragraph(line))]),
    ] }] })
    return { ok: true, name: `${name}.docx`, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array(await Packer.toBuffer(document)) }
  }
  const { default: PptxGenJS } = await import("pptxgenjs")
  const presentation = new PptxGenJS()
  presentation.layout = "LAYOUT_WIDE"
  presentation.title = options.title
  if (!content.length) {
    const slide = presentation.addSlide()
    slide.addText(`${options.title} · no sections selected`, { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 20 })
  }
  content.forEach((section) => {
    const title = Array.from(section.title)
    const heading = title.length > 32 ? `${title.slice(0, 31).join("")}…` : section.title
    const lines = title.length > 32 ? [`Full section title: ${section.title}`, ...section.lines] : section.lines
    section.images.forEach((image, page) => {
      const slide = presentation.addSlide()
      slide.addText(`${heading} · chart ${page + 1}/${section.images.length}`, { x: 0.6, y: 0.3, w: 12.1, h: 0.6, fontSize: 20, bold: true })
      slide.addImage({ data: `data:image/png;base64,${Buffer.from(image).toString("base64")}`, x: 0.7, y: 1.1, w: 11.8, h: 5.1, altText: "Review chart. Captured series and values follow in text." })
    })
    lines.forEach((line, index) => {
    const fragments = line.replace(/\r\n|\r|\n/g, " ↵ ").match(/.{1,60}(?:\s|$)|\S{1,60}/gu)?.map((fragment) => fragment.trim()) ?? [""]
    fragments.forEach((fragment, part) => {
      const slide = presentation.addSlide()
      slide.addText(`${heading} · ${index + 1}/${lines.length}${fragments.length > 1 ? ` · ${part + 1}/${fragments.length}` : ""}`, { x: 0.6, y: 0.35, w: 12.1, h: 0.7, fontSize: 20, bold: true })
      slide.addText(fragment, { x: 0.6, y: 1.3, w: 12.1, h: 5.4, fontSize: 14, margin: 0.08 })
    })
    })
  })
  const output = await presentation.write({ outputType: "uint8array" })
  if (!(output instanceof Uint8Array)) throw new Error("Unexpected presentation output")
  return { ok: true, name: `${name}.pptx`, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes: output }
}
