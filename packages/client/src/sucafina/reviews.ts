/**
 * A07 — operation-specific wrappers. The authority/URL/cookie/header/owner
 * fence stays in F02 SfTransport; this layer has neither fetch nor a URL API.
 */
import type { Schema } from "effect"
import {
  SfDashboardDashboardAgenda, SfDashboardDashboardCapture,
  SfDashboardDashboardHistory, SfDashboardDashboardReview,
  SfDashboardDashboardReviewPreserve, SfProjectionReview,
  SfReviewsExportDocx, SfReviewsExportPptx, SfReviewsReportPrepare,
  SfReviewsReviewSource, SfReviewsReviewThreadContext, SfReviewsReviewUpdate,
  SfReviewsReviewAgendaOptions, SfReviewsReviewAgenda, SfReviewsReviewPreserve,
} from "@orchestra/schema/sucafina/reviews"
import type { SfCallOptions, SfTransport } from "./transport"

type Input<S> = S extends { readonly input: Schema.Schema<infer A> } ? A : never
type Failure = Readonly<{ kind: "transport-error"; reason: "contract-mismatch" | "contract-unavailable" }>
const mismatch = (): Failure => ({ kind: "transport-error", reason: "contract-mismatch" })
const unavailable = (): Failure => ({ kind: "transport-error", reason: "contract-unavailable" })
const text = (value: string, max = 16_384) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max
const distinct = (values: readonly string[], minimum: number, maximum: number) =>
  Array.isArray(values) && values.length >= minimum && values.length <= maximum &&
  values.every((v) => text(v)) && new Set(values).size === values.length
const date = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const at = new Date(value)
  return Number.isFinite(at.getTime()) && at.toISOString().slice(0, 10) === value
}
const period = (value: { readonly start: string; readonly end: string }) =>
  value && date(value.start) && date(value.end) && value.start <= value.end
const mutationKey = (options: SfCallOptions) =>
  typeof options.idempotencyKey === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(options.idempotencyKey)
const readOptions = (options: SfCallOptions) =>
  !!options.signal && options.idempotencyKey === undefined
const agenda = (value: Input<typeof SfDashboardDashboardAgenda>) =>
  !!value && Array.isArray(value.sections) && value.sections.length >= 1 && value.sections.length <= 30 &&
  value.sections.every((s) =>
    text(s.id) && text(s.title) && text(s.selectionRef) && text(s.topic) &&
    period(s.period) && (s.recordRefs === undefined || distinct(s.recordRefs, 0, 512))) &&
  new Set(value.sections.map((s) => s.id)).size === value.sections.length
const review = (value: Input<typeof SfDashboardDashboardReviewPreserve>) =>
  !!value && text(value.selectionRef) && distinct(value.sectionRefs, 1, 512) &&
  (value.previousReviewRef === undefined || text(value.previousReviewRef))
const source = (value: Input<typeof SfReviewsReviewSource>) =>
  !!value && text(value.reviewRef, 2048) && text(value.referenceId)
const threadContext = (value: Input<typeof SfReviewsReviewThreadContext>) =>
  !!value && text(value.reviewRef, 2048) && text(value.sectionId) && !!value.basis &&
  text(value.basis.sourceRef) && text(value.basis.sourceIncarnation) &&
  Number.isSafeInteger(value.basis.observedVersion) && value.basis.observedVersion >= 1 &&
  period(value.basis.period) && Array.isArray(value.basis.evidenceRefs) &&
  value.basis.evidenceRefs.length >= 1 && value.basis.evidenceRefs.length <= 512 &&
  value.basis.evidenceRefs.filter((ref) => ref.refId === value.basis.sourceRef).length === 1
const projection = (value: Input<typeof SfProjectionReview>) => {
  if (!value || typeof value !== "object") return false
  if (value.page !== undefined && !text(value.page)) return false
  if (value.reviewRef !== undefined && !text(value.reviewRef, 2048)) return false
  if (value.previousReviewRef !== undefined && !text(value.previousReviewRef, 2048)) return false
  if (value.reviewRef && value.previousReviewRef) return false
  if (value.sectionId !== undefined && (!value.reviewRef || !text(value.sectionId))) return false
  if (value.reviewThread !== undefined && (!value.reviewRef || !text(value.reviewThread, 2048))) return false
  const message = [value.reviewMessage, value.reviewIncarnation, value.reviewVersion]
  if (message.some((v) => v !== undefined) && (!value.reviewThread ||
    !message.every((v) => typeof v === "string" && text(v, 2048)) ||
    !/^[1-9]\d*$/.test(value.reviewVersion ?? "") ||
    !Number.isSafeInteger(Number(value.reviewVersion)))) return false
  const now = new Date().getUTCFullYear()
  const window = {
    start: value.start ?? String(now) + "-01-01",
    end: value.end ?? String(now) + "-12-31",
  }
  return period(window)
}
const report = (value: Input<typeof SfReviewsExportDocx>) =>
  ["2024", "2025", "2026", "2027"].includes(value.year) &&
  Array.isArray(value.topic) && value.topic.length >= 1 && value.topic.length <= 40 &&
  value.topic.every((v) => text(v, 120)) && new Set(value.topic).size === value.topic.length &&
  (value.title === undefined || value.title.length <= 200)

/**
 * Keys are intentionally fixed; no generic action/payload dispatch.
 * Existing "export.docx/pptx" prepare an HTML review workspace rather than
 * bytes. A URL/navigation must be composed by F01 against the selected owner,
 * never fetched/parsed as a JSON result by the native client. The two methods
 * remain unavailable. Report preparation uses a separate original producer.
 */
export function createSfReviewsClient(transport: SfTransport) {
  return {
    "reviews.review-agenda-options": (
      input: Input<typeof SfReviewsReviewAgendaOptions>, options: SfCallOptions,
    ) => period(input) && readOptions(options)
      ? transport.execute(SfReviewsReviewAgendaOptions, input, options)
      : Promise.resolve(mismatch()),
    "reviews.review-agenda": (
      input: Input<typeof SfReviewsReviewAgenda>, options: SfCallOptions,
    ) => !!input && Array.isArray(input.items) && input.items.length >= 1 && input.items.length <= 30 &&
      distinct(input.items.map((item) => item.id), 1, 30) && input.items.every((item) => period(item.period)) &&
      readOptions(options)
      ? transport.execute(SfReviewsReviewAgenda, input, options)
      : Promise.resolve(mismatch()),
    "reviews.review-preserve": (
      input: Input<typeof SfReviewsReviewPreserve>, options: SfCallOptions,
    ) => review(input) && mutationKey(options)
      ? transport.execute(SfReviewsReviewPreserve, input, options)
      : Promise.resolve(mismatch()),
    "dashboard.dashboard-agenda": (
      input: Input<typeof SfDashboardDashboardAgenda>, options: SfCallOptions,
    ) => agenda(input) && readOptions(options)
      ? transport.execute(SfDashboardDashboardAgenda, input, options)
      : Promise.resolve(mismatch()),
    "dashboard.dashboard-capture": (
      input: Input<typeof SfDashboardDashboardCapture>, options: SfCallOptions,
    ) => text(input.sourceRef) && mutationKey(options)
      ? transport.execute(SfDashboardDashboardCapture, input, options)
      : Promise.resolve(mismatch()),
    "dashboard.dashboard-history": (
      input: Input<typeof SfDashboardDashboardHistory>, options: SfCallOptions,
    ) => text(input.id) && readOptions(options)
      ? transport.execute(SfDashboardDashboardHistory, input, options)
      : Promise.resolve(mismatch()),
    "dashboard.dashboard-review": (
      input: Input<typeof SfDashboardDashboardReview>, options: SfCallOptions,
    ) => text(input.id) && readOptions(options)
      ? transport.execute(SfDashboardDashboardReview, input, options)
      : Promise.resolve(mismatch()),
    "dashboard.dashboard-review-preserve": (
      input: Input<typeof SfDashboardDashboardReviewPreserve>, options: SfCallOptions,
    ) => review(input) && mutationKey(options)
      ? transport.execute(SfDashboardDashboardReviewPreserve, input, options)
      : Promise.resolve(mismatch()),
    "projection.review": (
      input: Input<typeof SfProjectionReview>, options: SfCallOptions,
    ) => projection(input) && readOptions(options)
      ? transport.execute(SfProjectionReview, input, options)
      : Promise.resolve(mismatch()),
    "reviews.export.docx": (
      input: Input<typeof SfReviewsExportDocx>, options: SfCallOptions,
    ) => Promise.resolve(report(input) && readOptions(options) ? unavailable() : mismatch()),
    "reviews.export.pptx": (
      input: Input<typeof SfReviewsExportPptx>, options: SfCallOptions,
    ) => Promise.resolve(report(input) && readOptions(options) ? unavailable() : mismatch()),
    "reviews.report.prepare": (
      input: Input<typeof SfReviewsReportPrepare>, options: SfCallOptions,
    ) => !!input && text(input.reviewRef, 2048) && distinct(input.sectionRefs, 1, 512) &&
      (input.format === "docx" || input.format === "pptx") && mutationKey(options)
      ? transport.execute(SfReviewsReportPrepare, input, options)
      : Promise.resolve(mismatch()),
    "reviews.review-source": (
      input: Input<typeof SfReviewsReviewSource>, options: SfCallOptions,
    ) => source(input) && readOptions(options)
      ? transport.execute(SfReviewsReviewSource, input, options)
      : Promise.resolve(mismatch()),
    "reviews.review-thread-context": (
      input: Input<typeof SfReviewsReviewThreadContext>, options: SfCallOptions,
    ) => threadContext(input) && readOptions(options)
      ? transport.execute(SfReviewsReviewThreadContext, input, options)
      : Promise.resolve(mismatch()),
    "reviews.review-update": (
      input: Input<typeof SfReviewsReviewUpdate>, options: SfCallOptions,
    ) => text(input.reviewRef, 2048) && readOptions(options)
      ? transport.execute(SfReviewsReviewUpdate, input, options)
      : Promise.resolve(mismatch()),
  } as const
}
