import { Option, Schema } from "effect"
import { unwrap } from "solid-js/store"
import { SfReviewDomainProjection, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import type { SfUiState } from "../../shared/frame"

export type PreservedReview = Schema.Schema.Type<typeof SfReviewPreserved>
export type PreservedSection = PreservedReview["sections"][number]
export type ReviewProjection = Schema.Schema.Type<typeof SfReviewDomainProjection>
export type PreservedValue = ReviewProjection["values"][number]
export type PreservedComponent = ReviewProjection["components"][number]
export type PreservedSourceRef = PreservedSection["sourceRefs"][number]

const bindingKeys = ["reviewThread", "reviewMessage", "reviewIncarnation", "reviewVersion"] as const

export type ReviewLocationBinding = Readonly<{
  reviewThread?: string
  reviewMessage?: string
  reviewIncarnation?: string
  reviewVersion?: string
}>

/** URL bindings the installed review discussion asserts. Bodies never enter the query. */
export function reviewLocationBinding(): ReviewLocationBinding {
  if (typeof location === "undefined") return {}
  const params = new URLSearchParams(location.search)
  const thread = params.get("reviewThread") ?? undefined
  const message = params.get("reviewMessage") ?? undefined
  const incarnation = params.get("reviewIncarnation") ?? undefined
  const version = params.get("reviewVersion") ?? undefined
  return {
    ...(thread ? { reviewThread: thread } : {}),
    ...(message ? { reviewMessage: message } : {}),
    ...(incarnation ? { reviewIncarnation: incarnation } : {}),
    ...(version ? { reviewVersion: version } : {}),
  }
}

export function bindReviewLocation(next: ReviewLocationBinding) {
  if (typeof history === "undefined" || typeof location === "undefined") return
  const url = new URL(location.href)
  for (const key of bindingKeys) {
    const value = next[key]
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  history.replaceState(history.state, "", url)
}

export function preservedRecordSources(section: PreservedSection) {
  const projection = readPreservedProjection(section.content)
  if (!projection) return []
  const records = projection.values.flatMap((value) => value.sourceRefs.filter((ref) => ref.kind === "record"))
  return [...new Map(records.map((ref) => [ref.refId, ref])).values()]
}

/** Basis for the source the operator selected. Evidence stays the producer value's own refs. */
export function preservedSourceBasis(section: PreservedSection, sourceRef: string) {
  const projection = readPreservedProjection(section.content)
  if (!projection || !sourceRef) return undefined
  const value = projection.values.find((entry) => entry.sourceRefs.some((ref) => ref.kind === "record" && ref.refId === sourceRef))
  const source = value?.sourceRefs.find((ref) => ref.kind === "record" && ref.refId === sourceRef)
  if (!value || !source || source.kind !== "record" || source.target.version < 1) return undefined
  return {
    sourceRef: source.refId,
    sourceIncarnation: source.target.incarnation,
    observedVersion: source.target.version,
    period: section.period,
    evidenceRefs: value.sourceRefs,
  }
}

/** Captured meeting line. Literal producer fields only; no client total or FX. */
export function preservedMeetingLine(value: PreservedValue) {
  const shown = value.value === null ? "unavailable" : String(value.value)
  const unit = value.unit ? ` ${value.unit}` : ""
  const currency = value.currency ? ` ${value.currency}` : ""
  const sources = value.sourceRefs.map((ref) => ref.refId).join(", ") || "source unavailable"
  return `${value.id}: ${shown}${unit}${currency} · ${value.period.start} – ${value.period.end} · ${sources}`
}

/** The record basis the C05 producer will re-read. Empty when the section has no single covering record. */
export function preservedAnswerBasis(section: PreservedSection) {
  const projection = readPreservedProjection(section.content)
  if (!projection) return undefined
  const value = projection.values.find((entry) => {
    const records = entry.sourceRefs.filter((ref) => ref.kind === "record" && covers(ref.target.period, section.period))
    return records.length === 1 && entry.sourceRefs.filter((ref) => ref.refId === records[0]!.refId).length === 1
  })
  const source = value?.sourceRefs.find((ref) => ref.kind === "record" && covers(ref.target.period, section.period))
  if (!value || !source || source.kind !== "record" || source.target.version < 1) return undefined
  return {
    sourceRef: source.refId,
    sourceIncarnation: source.target.incarnation,
    observedVersion: source.target.version,
    period: section.period,
    evidenceRefs: value.sourceRefs,
  }
}

function covers(period: { start: string; end: string } | undefined, section: { start: string; end: string }) {
  return !!period && period.start <= section.start && period.end >= section.end
}

/** Public review content is a producer-owned JSON value, not an editable or numeric model. */
export function readPreservedProjection(content: unknown): ReviewProjection | undefined {
  // Solid adds symbol metadata to reactive objects. Restore only a store proxy
  // to plain source data before applying the unchanged, closed producer codec.
  let source: unknown = content
  try {
    const unwrapped = unwrap(content)
    if (unwrapped !== content) source = structuredClone(unwrapped)
  } catch { return undefined }
  const decoded = Schema.decodeUnknownOption(SfReviewDomainProjection)(source)
  return Option.isSome(decoded) ? decoded.value : undefined
}

export function reviewReadState(reply: { kind: "transport-error"; reason: string } | { kind: "response"; status: number; body: { status: string } }): SfUiState {
  if (reply.kind === "transport-error") return reply.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable"
  if (reply.body.status === "denied") return "denied"
  if (reply.body.status === "stale") return "stale"
  if (reply.body.status === "conflict" || reply.body.status === "provider-conflict") return "conflict"
  if (reply.body.status === "invalid" || reply.body.status === "needs-input") return "invalid"
  return "unavailable"
}

/** Equality of decoded, source-authored material. This never computes or normalizes financial numbers. */
export function sameSourceMaterial(previous: unknown, current: unknown): boolean {
  return JSON.stringify(previous) === JSON.stringify(current)
}

/** Unknown scopes are not comparable, even if section identifiers happen to match. */
export function comparableReviewSections(previous: PreservedReview, current: PreservedReview): boolean {
  if (!previous.sections.length || previous.sections.length !== current.sections.length) return false
  const first = readPreservedProjection(previous.sections[0].content)
  if (!first) return false
  const previousIds = new Set(previous.sections.map((section) => section.id))
  const currentById = new Map(current.sections.map((section) => [section.id, section]))
  if (previousIds.size !== previous.sections.length || currentById.size !== current.sections.length) return false
  return previous.sections.every((before) => {
    const after = currentById.get(before.id)
    if (!after || before.period.start !== after.period.start || before.period.end !== after.period.end) return false
    const left = readPreservedProjection(before.content), right = readPreservedProjection(after.content)
    if (!left || !right ||
        left.context.installationId !== first.context.installationId ||
        left.context.projectId !== first.context.projectId ||
        left.context.installationId !== right.context.installationId ||
        left.context.projectId !== right.context.projectId ||
        left.context.currency !== right.context.currency ||
        left.context.surface !== right.context.surface ||
        left.engineVersion !== right.engineVersion) return false
    return left.context.period.start === right.context.period.start &&
      left.context.period.end === right.context.period.end
  })
}

/** Compare literal values, evidence metadata and per-value ancestry independently; never infer FX or totals. */
export function preservedValueRows(previous: PreservedSection, current: PreservedSection) {
  const before = readPreservedProjection(previous.content), after = readPreservedProjection(current.content)
  if (!before || !after) return []
  const a = new Map(before.values.map((entry) => [entry.id, entry]))
  const b = new Map(after.values.map((entry) => [entry.id, entry]))
  return [...new Set([...a.keys(), ...b.keys()])].flatMap((id) => {
    const left = a.get(id), right = b.get(id)
    const valueChanged = left?.value !== right?.value
    const numericChanged = valueChanged && typeof left?.value === "number" && typeof right?.value === "number"
    const attributesChanged = left?.unit !== right?.unit || left?.currency !== right?.currency ||
      left?.evidenceState !== right?.evidenceState || left?.granularity !== right?.granularity ||
      !sameSourceMaterial(left?.period, right?.period)
    const provenanceChanged = !sameSourceMaterial(left?.sourceRefs, right?.sourceRefs) ||
      !sameSourceMaterial(left?.drilldown, right?.drilldown)
    return valueChanged || attributesChanged || provenanceChanged
      ? [{ id, before: left, after: right, valueChanged, numericChanged, attributesChanged, provenanceChanged }]
      : []
  })
}

/** Producer-authored projection components have their own currency, evidence state and source lineage. */
export function preservedComponentRows(previous: PreservedSection, current: PreservedSection) {
  const before = readPreservedProjection(previous.content), after = readPreservedProjection(current.content)
  if (!before || !after) return []
  const a = new Map(before.components.map((entry) => [entry.id, entry]))
  const b = new Map(after.components.map((entry) => [entry.id, entry]))
  return [...new Set([...a.keys(), ...b.keys()])].flatMap((id) => {
    const left = a.get(id), right = b.get(id)
    const valueChanged = left?.amount !== right?.amount
    const numericChanged = valueChanged && typeof left?.amount === "number" && typeof right?.amount === "number"
    const attributesChanged = left?.currency !== right?.currency ||
      left?.evidenceState !== right?.evidenceState || !sameSourceMaterial(left?.period, right?.period)
    const provenanceChanged = !sameSourceMaterial(left?.sourceRefs, right?.sourceRefs)
    return valueChanged || attributesChanged || provenanceChanged
      ? [{ id, before: left, after: right, valueChanged, numericChanged, attributesChanged, provenanceChanged }]
      : []
  })
}

/** A source-only revision is a real difference, but is not a financial delta. */
export function preservedSectionHasChanges(previous: PreservedSection, current: PreservedSection): boolean {
  const before = readPreservedProjection(previous.content), after = readPreservedProjection(current.content)
  if (!before || !after) return true
  return previous.title !== current.title || previous.count !== current.count ||
    !sameSourceMaterial(previous.sourceRefs, current.sourceRefs) ||
    before.version !== after.version ||
    !sameSourceMaterial(before.context.sourceRefs, after.context.sourceRefs) ||
    !sameSourceMaterial(before.missing, after.missing) ||
    preservedValueRows(previous, current).length > 0 ||
    preservedComponentRows(previous, current).length > 0
}
