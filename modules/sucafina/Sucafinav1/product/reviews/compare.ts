import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"

/** Compare only identical source incarnations and definitions; unknown provenance never becomes a fabricated delta. */
export function compareReviews(previous: PreservedReview | null, current: PreservedReview) {
  if (!previous) return { state: "first-review" as const, changes: [] }
  const values = (review: PreservedReview) => review.sections.flatMap((section) => {
    const projection = section.content as DomainProjection
    if (!projection || typeof projection.engineVersion !== "string" || !projection.engineVersion || !Array.isArray(projection.values)) return []
    return projection.values.flatMap((value) => {
      if (!value || (typeof value.value === "number" && !Number.isFinite(value.value)) || !Array.isArray(value.sourceRefs) || value.sourceRefs.length !== 1 || !value.period || typeof value.period.start !== "string" || typeof value.period.end !== "string") return []
      const ref = value.sourceRefs[0] as BusinessEvidenceRef | undefined
      if (ref?.kind === "record" && Array.isArray(ref.target?.fields)) return [{ sectionId: section.id, value, engineVersion: projection.engineVersion, fields: JSON.stringify([[...ref.target.fields].sort(), ref.target.period ?? null]), key: JSON.stringify([section.id, value.id, ref.installationId, ref.projectId, ref.target.surface, ref.target.recordType, ref.target.recordId, ref.target.incarnation]) }]
      if (ref?.kind !== "calculation" || !ref.target || !ref.target.period || ref.target.period.start !== value.period.start || ref.target.period.end !== value.period.end || ref.target.currency !== value.currency || !ref.target.engineVersion || !Array.isArray(ref.target.sourceRefs) || !ref.target.sourceRefs.length || ref.target.sourceRefs.some((source: BusinessEvidenceRef) => source?.kind !== "record" || !Array.isArray(source.target?.fields))) return []
      const sources = ref.target.sourceRefs.filter((source: BusinessEvidenceRef): source is Extract<BusinessEvidenceRef, { kind: "record" }> => source?.kind === "record")
      return [{
        sectionId: section.id, value, engineVersion: JSON.stringify([projection.engineVersion, ref.target.engineVersion]),
        fields: JSON.stringify(sources.map((source) => JSON.stringify([source.target.surface, source.target.recordType, source.target.recordId, source.target.incarnation, [...source.target.fields].sort(), source.target.period ?? null])).sort()),
        key: JSON.stringify([section.id, value.id, ref.installationId, ref.projectId, ref.target.calculationId, sources.map((source) => JSON.stringify([source.installationId, source.projectId, source.target.surface, source.target.recordType, source.target.recordId, source.target.incarnation])).sort()]),
      }]
    })
  })
  const before = values(previous)
  const after = values(current)
  if (new Set(before.map((entry) => entry.key)).size !== before.length || new Set(after.map((entry) => entry.key)).size !== after.length)
    return { state: "unavailable" as const, changes: [], limitations: ["Duplicate record identities prevent comparison."] }
  const keys = [...new Set([...before.map((entry) => entry.key), ...after.map((entry) => entry.key)])]
  type Value = DomainProjection["values"][number]
  type Change = { kind: "added"; after: Value } | { kind: "removed"; before: Value } | { kind: "incompatible"; before: Value; after: Value } | { kind: "changed"; before: Value; after: Value; delta?: number }
  return {
    state: "compared" as const,
    changes: keys.flatMap<Change>((key) => {
      const left = before.find((entry) => entry.key === key)
      const right = after.find((entry) => entry.key === key)
      if (!left) return [{ kind: "added" as const, after: right!.value }]
      if (!right) return [{ kind: "removed" as const, before: left.value }]
      const comparable = left.engineVersion === right.engineVersion && left.fields === right.fields && left.value.period.start === right.value.period.start && left.value.period.end === right.value.period.end && left.value.currency === right.value.currency && left.value.unit === right.value.unit && left.value.granularity === right.value.granularity
      if (!comparable) return [{ kind: "incompatible" as const, before: left.value, after: right.value }]
      if (left.value.value === right.value.value && left.value.evidenceState === right.value.evidenceState) return []
      if (typeof left.value.value === "number" && typeof right.value.value === "number" && !Number.isFinite(right.value.value - left.value.value)) return [{ kind: "incompatible" as const, before: left.value, after: right.value }]
      return [{ kind: "changed" as const, before: left.value, after: right.value, ...(typeof left.value.value === "number" && typeof right.value.value === "number" ? { delta: right.value.value - left.value.value } : {}) }]
    }),
    limitations: ["Values without a single record or fully identified calculation are not compared."],
  }
}
