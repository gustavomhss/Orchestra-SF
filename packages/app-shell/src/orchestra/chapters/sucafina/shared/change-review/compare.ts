import type { SfDisplayValue, SfMessage, SfText, SfUnit } from "../frame/types"
import type { SfReviewField, SfReviewSnapshot } from "./types"

export type SfReviewDifference = "changed" | "same" | "unavailable"
export type SfReviewComparison = Readonly<{
  path: string
  occurrence: number
  label: SfMessage
  base?: SfReviewField
  current?: SfReviewField
  proposed?: SfReviewField
  difference: SfReviewDifference
  sourceChanged: boolean
}>

/** Compare display DTOs only. Paths remain opaque; no financial effect is inferred. */
export function sfReviewComparison(
  base: SfReviewSnapshot | null,
  current: SfReviewSnapshot | null,
  proposed: SfReviewSnapshot,
): readonly SfReviewComparison[] {
  const original = indexFields(base)
  const live = indexFields(current)
  const draft = indexFields(proposed)
  const paths = [...new Set([...original.keys(), ...live.keys(), ...draft.keys()])]
  return paths.flatMap((path) => {
    const before = original.get(path) ?? []
    const now = live.get(path) ?? []
    const after = draft.get(path) ?? []
    // Retain repeated producer paths without inventing an identity between them.
    const ambiguous = before.length > 1 || now.length > 1 || after.length > 1
    return Array.from({ length: Math.max(before.length, now.length, after.length) }, (_, occurrence) => {
      const baseField = before[occurrence]
      const currentField = now[occurrence]
      const proposedField = after[occurrence]
      const reference = current === null ? baseField : currentField
      return {
        path,
        occurrence,
        label: (proposedField ?? currentField ?? baseField)!.label,
        base: baseField,
        current: currentField,
        proposed: proposedField,
        difference: ambiguous ? "unavailable" as const : difference(reference, proposedField),
        sourceChanged: !ambiguous && difference(baseField, currentField) === "changed",
      }
    })
  })
}

function indexFields(snapshot: SfReviewSnapshot | null): ReadonlyMap<string, readonly SfReviewField[]> {
  const result = new Map<string, SfReviewField[]>()
  if (!snapshot || snapshot.kind === "not-provided") return result
  for (const field of snapshot.fields) {
    const values = result.get(field.path)
    if (values) values.push(field)
    else result.set(field.path, [field])
  }
  return result
}

function difference(before: SfReviewField | undefined, after: SfReviewField | undefined): SfReviewDifference {
  if (!before || !after || !comparable(before.value) || !comparable(after.value)) return "unavailable"
  return sameValue(before.value, after.value) ? "same" : "changed"
}

function comparable(value: SfDisplayValue): boolean {
  if (value.kind === "missing" || value.kind === "unavailable") return false
  if (value.kind === "number") return Number.isFinite(value.value)
  if (value.kind === "list") return value.items.every(comparable)
  return true
}

function sameMessage(a: SfMessage, b: SfMessage): boolean {
  if (a.key !== b.key) return false
  const keys = Object.keys(a.params ?? {})
  return keys.length === Object.keys(b.params ?? {}).length && keys.every((key) => a.params?.[key] === b.params?.[key])
}

function sameText(a: SfText, b: SfText): boolean {
  if (a.kind === "data") return b.kind === "data" && a.text === b.text
  return b.kind === "message" && sameMessage(a.message, b.message)
}

function sameUnit(a: SfUnit, b: SfUnit): boolean {
  if (a.kind === "currency") return b.kind === "currency" && a.code === b.code
  if (a.kind === "percent") return b.kind === "percent"
  return a.kind === b.kind && (b.kind === "quantity" || b.kind === "unspecified") && sameMessage(a.label, b.label)
}

function sameValue(a: SfDisplayValue, b: SfDisplayValue): boolean {
  if (a.kind === "text") return b.kind === "text" && sameText(a.text, b.text)
  if (a.kind === "number") return b.kind === "number" && a.value === b.value && sameUnit(a.unit, b.unit)
  if (a.kind === "boolean") return b.kind === "boolean" && a.value === b.value
  if (a.kind === "date") return b.kind === "date" && a.isoDate === b.isoDate
  if (a.kind === "timestamp") return b.kind === "timestamp" && a.isoTimestamp === b.isoTimestamp && a.timezone === b.timezone
  if (a.kind === "missing" || a.kind === "unavailable") return false
  return b.kind === "list" && a.items.length === b.items.length && a.items.every((item, index) => sameValue(item, b.items[index]!))
}
