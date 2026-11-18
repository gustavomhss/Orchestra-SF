import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"
import { validOutcomeComparison, validReviewOutcome } from "./outcome.ts"
import { matchesSelectedSources } from "./references.ts"

type Value = DomainProjection["values"][number]
type ProjectionContent = DomainProjection & { reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison }
type Entry = { value: Value; engineVersion: string; fields: string; key: string; recordKey: string; aligned: boolean }
type Row = { sectionId: string; valueId: string; value: Value; identity?: Entry }
type Change =
  | { kind: "added"; after: Value; sectionId: string; reviewId: string; basis: string }
  | { kind: "removed"; before: Value; sectionId: string; reviewId: string; basis: string }
  | { kind: "incompatible"; before: Value; after: Value; sectionId: string; reviewId: string; previousReviewId: string; basis: string }
  | { kind: "changed"; before: Value; after: Value; sectionId: string; reviewId: string; previousReviewId: string; basis: string; delta?: number }
type Omission = { sectionId: string; valueId: string; reason: "identification-lost" | "identification-unavailable" }
type IndexedSection = { readable: boolean; rows: Row[]; idless: number }
type Pair = { changes: Change[]; omissions: Omission[]; limitations: string[] }

/** Prefer stable row IDs, then an unambiguous canonical record/field identity. Never pair by a display name. */
export function compareReviews(previous: PreservedReview | null, current: PreservedReview) {
  if (!previous) return current.previousReviewRef ? unavailable("The preserved previous reference is not available for comparison.") : firstReview(current)
  if (current.previousReviewRef && current.previousReviewRef !== previous.id) return unavailable("The preserved previous reference does not match the review supplied for comparison.")
  const left = index(previous)
  const right = index(current)
  if (left.duplicate || right.duplicate) return unavailable("Duplicate record identities prevent comparison.")
  const previousFacts = factsOf(previous)
  const currentFacts = factsOf(current)
  const paired = [...new Set([...left.sections.keys(), ...right.sections.keys()])].map((sectionId) => pairSection(sectionId, previous, current, left.sections.get(sectionId), right.sections.get(sectionId)))
  return {
    state: "compared" as const,
    changes: paired.flatMap((part) => part.changes),
    omissions: paired.flatMap((part) => part.omissions),
    comments: [...previousFacts.comments.matched, ...currentFacts.comments.matched],
    outcomeComparisons: [...previousFacts.comparisons, ...currentFacts.comparisons],
    outcomes: [...previousFacts.outcomes, ...currentFacts.outcomes],
    limitations: [
      "Values without a single record or fully identified calculation are not compared.",
      "Forwarding state is read separately from the canonical action; it does not change the preserved financial base.",
      ...paired.flatMap((part) => part.limitations),
      ...previousFacts.limitations,
      ...currentFacts.limitations,
    ],
  }
}

function firstReview(current: PreservedReview) {
  const facts = factsOf(current)
  return {
    state: "first-review" as const,
    changes: [] as Change[],
    omissions: [] as Omission[],
    comments: facts.comments.matched,
    outcomeComparisons: facts.comparisons,
    outcomes: facts.outcomes,
    limitations: ["Forwarding state is read separately from the canonical action; it does not change the preserved financial base.", ...facts.limitations],
  }
}

function unavailable(limitation: string) {
  return { state: "unavailable" as const, changes: [] as Change[], limitations: [limitation] }
}

function index(review: PreservedReview) {
  const projections = review.sections.map((section) => readSection(section))
  const identified = projections.flatMap((section) => section.rows.flatMap((row) => row.identity ? [row.identity.key] : []))
  const duplicate = new Set(projections.map((section) => section.id)).size !== projections.length
    || projections.some((section) => new Set(section.rows.map((row) => row.valueId)).size !== section.rows.length)
    || new Set(identified).size !== identified.length
  return { sections: new Map(projections.map((section) => [section.id, section])), duplicate }
}

function readSection(section: PreservedReview["sections"][number]): IndexedSection & { id: string } {
  const projection = section.content as ProjectionContent
  const readable = !!projection && typeof projection.engineVersion === "string" && !!projection.engineVersion && Array.isArray(projection.values)
  if (!readable) return { id: section.id, readable: false, rows: [], idless: 0 }
  const rows = projection.values.flatMap((value) => {
    if (!value || typeof value.id !== "string" || !value.id) return []
    return [{ sectionId: section.id, valueId: value.id, value, identity: identify(section.id, projection.engineVersion, value) }]
  })
  return { id: section.id, readable: true, rows, idless: projection.values.filter((value) => !value || typeof value.id !== "string" || !value.id).length }
}

function pairSection(sectionId: string, previous: PreservedReview, current: PreservedReview, left: IndexedSection | undefined, right: IndexedSection | undefined): Pair {
  if (left && right && (!left.readable || !right.readable)) {
    const known = [...left.rows, ...right.rows]
    return {
      changes: [],
      omissions: known.map((row) => ({ sectionId, valueId: row.valueId, reason: "identification-lost" as const })),
      limitations: [...(known.length ? [] : [`Omitted: section ${sectionId} · projection unavailable`]), ...(left.idless + right.idless ? [`Omitted: section ${sectionId} · value without id`] : [])],
    }
  }
  const present = left ?? right
  if (!present?.readable) return { changes: [], omissions: [], limitations: present ? [`Omitted: section ${sectionId} · projection unavailable`] : [] }
  const leftRows = new Map((left?.rows ?? []).map((row) => [row.valueId, row]))
  const rightRows = new Map((right?.rows ?? []).map((row) => [row.valueId, row]))
  const pairs: { before?: Row; after?: Row }[] = []
  for (const [id, before] of leftRows) {
    const after = rightRows.get(id)
    if (!after) continue
    pairs.push({ before, after })
    leftRows.delete(id)
    rightRows.delete(id)
  }
  for (const [id, before] of leftRows) {
    if (!before.identity) continue
    const sameIdentity = (row: Row) => !!row.identity && row.identity.recordKey === before.identity!.recordKey && row.identity.fields === before.identity!.fields
    const candidates = [...rightRows.values()].filter(sameIdentity)
    if (candidates.length !== 1 || [...leftRows.values()].filter(sameIdentity).length !== 1) continue
    const after = candidates[0]!
    pairs.push({ before, after })
    leftRows.delete(id)
    rightRows.delete(after.valueId)
  }
  pairs.push(...[...leftRows.values()].map((before) => ({ before })), ...[...rightRows.values()].map((after) => ({ after })))
  return {
    changes: pairs.flatMap(({ before, after }) => {
      if (before && after) return samePair(before, after, previous.id, current.id)
      if (before) return compositionChange(before, previous.id, "removed")
      if (after) return compositionChange(after, current.id, "added")
      return []
    }),
    omissions: pairs.flatMap<Omission>(({ before, after }) => {
      const valueId = after?.valueId ?? before!.valueId
      if (before && after && (!before.identity || !after.identity)) return [{ sectionId, valueId, reason: "identification-lost" as const }]
      if ((before && !after && !before.identity) || (after && !before && !after.identity)) return [{ sectionId, valueId, reason: "identification-unavailable" as const }]
      return []
    }),
    limitations: (left?.idless ?? 0) + (right?.idless ?? 0) ? [`Omitted: section ${sectionId} · value without id`] : [],
  }
}

function compositionChange(row: Row, reviewId: string, kind: "added" | "removed"): Change[] {
  if (!row.identity) return []
  if (kind === "removed") return [{ kind: "removed", before: row.value, sectionId: row.sectionId, reviewId, basis: basisOf(row.identity) }]
  return [{ kind: "added", after: row.value, sectionId: row.sectionId, reviewId, basis: basisOf(row.identity) }]
}

function samePair(before: Row, after: Row, previousId: string, currentId: string): Change[] {
  if (!before.identity || !after.identity) return []
  const basis = `${basisOf(before.identity)} → ${basisOf(after.identity)}`
  const change = { before: before.value, after: after.value, sectionId: after.sectionId, reviewId: currentId, previousReviewId: previousId, basis }
  if (before.identity.recordKey !== after.identity.recordKey) return [{ kind: "incompatible", ...change }]
  const comparable = before.identity.aligned && after.identity.aligned && before.identity.engineVersion === after.identity.engineVersion && before.identity.fields === after.identity.fields && samePeriod(before.value, after.value) && before.value.currency === after.value.currency && before.value.unit === after.value.unit && before.value.granularity === after.value.granularity
  if (!comparable || nonFinite(before.value.value) || nonFinite(after.value.value)) return [{ kind: "incompatible", ...change }]
  if (before.value.value === after.value.value && before.value.evidenceState === after.value.evidenceState) return []
  if (typeof before.value.value === "number" && typeof after.value.value === "number" && !Number.isFinite(after.value.value - before.value.value)) return [{ kind: "incompatible", ...change }]
  return [{ kind: "changed", ...change, ...(typeof before.value.value === "number" && typeof after.value.value === "number" ? { delta: after.value.value - before.value.value } : {}) }]
}

function identify(sectionId: string, engineVersion: string, value: Value): Entry | undefined {
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length !== 1) return undefined
  const ref = value.sourceRefs[0] as BusinessEvidenceRef | undefined
  if (ref?.kind === "record" && validRecord(ref)) return {
    value, aligned: !ref.target.period || !!value.period && ref.target.period.start <= value.period.start && ref.target.period.end >= value.period.end, engineVersion,
    fields: JSON.stringify([[...ref.target.fields].sort(), ref.target.period ?? null]),
    key: JSON.stringify([sectionId, value.id, ref.installationId, ref.projectId, ref.target.surface, ref.target.recordType, ref.target.recordId, ref.target.incarnation]),
    recordKey: JSON.stringify([ref.installationId, ref.projectId, ref.target.surface, ref.target.recordType, ref.target.recordId, ref.target.incarnation]),
  }
  if (ref?.kind !== "calculation" || !ref.target?.engineVersion || !ref.target.calculationId || !Array.isArray(ref.target.sourceRefs) || !ref.target.sourceRefs.length || ref.target.sourceRefs.some((source: BusinessEvidenceRef) => source?.kind !== "record" || !validRecord(source))) return undefined
  const sources = ref.target.sourceRefs.filter((source: BusinessEvidenceRef): source is Extract<BusinessEvidenceRef, { kind: "record" }> => source?.kind === "record")
  const period = ref.target.period
  const valuePeriod = value.period
  return {
    value,
    aligned: !!period && !!valuePeriod && period.start === valuePeriod.start && period.end === valuePeriod.end && ref.target.currency === value.currency,
    engineVersion: JSON.stringify([engineVersion, ref.target.engineVersion]),
    fields: JSON.stringify(sources.map((source) => JSON.stringify([source.target.surface, source.target.recordType, source.target.recordId, source.target.incarnation, [...source.target.fields].sort(), source.target.period ?? null])).sort()),
    key: JSON.stringify([sectionId, value.id, ref.installationId, ref.projectId, ref.target.calculationId, sources.map((source) => JSON.stringify([source.installationId, source.projectId, source.target.surface, source.target.recordType, source.target.recordId, source.target.incarnation])).sort()]),
    recordKey: JSON.stringify([ref.installationId, ref.projectId, ref.target.calculationId, sources.map((source) => JSON.stringify([source.installationId, source.projectId, source.target.surface, source.target.recordType, source.target.recordId, source.target.incarnation])).sort()]),
  }
}

function validRecord(ref: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  return !!ref.target && [ref.installationId, ref.projectId, ref.target.surface, ref.target.recordType, ref.target.recordId, ref.target.incarnation].every((value) => typeof value === "string" && !!value.trim()) && Number.isSafeInteger(ref.target.version) && ref.target.version >= 0 && Array.isArray(ref.target.fields) && ref.target.fields.length > 0 && ref.target.fields.every((field) => typeof field === "string" && !!field.trim()) && new Set(ref.target.fields).size === ref.target.fields.length
}

function basisOf(entry: Entry) {
  const ref = entry.value.sourceRefs[0] as BusinessEvidenceRef | undefined
  const identity = ref?.kind === "record"
    ? `${ref.target.surface}:${ref.target.recordType}:${ref.target.recordId}@${ref.target.incarnation} v${ref.target.version} · fields ${[...ref.target.fields].sort().join(", ") || "none"} · record period ${ref.target.period ? `${ref.target.period.start}–${ref.target.period.end}` : "unavailable"}`
    : ref?.kind === "calculation"
      ? `${ref.target.calculationId} · model ${ref.target.engineVersion} · run ${ref.target.runId} · target ${ref.target.period ? `${ref.target.period.start}–${ref.target.period.end}` : "period unavailable"} ${ref.target.currency}`
      : "basis unavailable"
  const period = entry.value.period ? `${entry.value.period.start}–${entry.value.period.end}` : "period unavailable"
  const amount = [entry.value.currency, entry.value.unit].filter((part): part is string => !!part).join(" ") || "unit unavailable"
  return `${identity} · ${period} · ${amount} · ${entry.value.granularity ?? "granularity unavailable"} · projection ${entry.engineVersion}`
}

function samePeriod(left: Value, right: Value) {
  return !!left.period && !!right.period && left.period.start === right.period.start && left.period.end === right.period.end
}

function nonFinite(value: Value["value"]) {
  return typeof value === "number" && !Number.isFinite(value)
}

function commentsOf(review: PreservedReview) {
  const selected = review.sections.flatMap((section) => section.sourceRefs)
  const matched = review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, selected)).map((comment) => ({
    reviewId: review.id, id: comment.id, version: comment.version, authorRef: comment.authorRef, createdAt: comment.createdAt, content: comment.content,
  }))
  return { matched, unmatched: review.comments.length - matched.length }
}

function factsOf(review: PreservedReview) {
  const comments = commentsOf(review)
  const sections = review.sections.map((section) => ({ sectionId: section.id, projection: section.content as ProjectionContent }))
  const comparisons = sections.flatMap((section) => section.projection?.reviewOutcomeComparison && validOutcomeComparison(section.projection.reviewOutcomeComparison) ? [{ reviewId: review.id, sectionId: section.sectionId, comparison: section.projection.reviewOutcomeComparison }] : [])
  const outcomes = sections.flatMap((section) => section.projection?.reviewOutcome && validReviewOutcome(section.projection.reviewOutcome) ? [{ reviewId: review.id, sectionId: section.sectionId, projection: section.projection.reviewOutcome }] : [])
  const invalidComparisons = sections.filter((section) => section.projection?.reviewOutcomeComparison && !validOutcomeComparison(section.projection.reviewOutcomeComparison)).length
  const invalidOutcomes = sections.filter((section) => section.projection?.reviewOutcome && !validReviewOutcome(section.projection.reviewOutcome)).length
  const unmatched = comments.unmatched === 0 ? [] : [comments.unmatched === 1 ? "1 preserved comment does not match the selected section sources and is omitted." : `${comments.unmatched} preserved comments do not match the selected section sources and are omitted.`]
  return {
    comments, comparisons, outcomes,
    limitations: [...unmatched, ...(invalidComparisons ? ["An outcome comparison failed validation and was not shown."] : []), ...(invalidOutcomes ? ["An outcome failed validation and was not shown."] : [])],
  }
}
