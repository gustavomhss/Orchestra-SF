import { Option, Schema } from "effect"
import { SfReviewDomainProjection, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import type { SfUiState } from "../../shared/frame"

export type PreservedReview = Schema.Schema.Type<typeof SfReviewPreserved>
export type PreservedSection = PreservedReview["sections"][number]
export type ReviewProjection = Schema.Schema.Type<typeof SfReviewDomainProjection>

/** Public review content is a producer-owned JSON value, not an editable or numeric model. */
export function readPreservedProjection(content: unknown): ReviewProjection | undefined {
  const decoded = Schema.decodeUnknownOption(SfReviewDomainProjection)(content)
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

export function comparableReviewSections(previous: PreservedReview, current: PreservedReview): boolean {
  if (previous.sections.length !== current.sections.length) return false
  const currentById = new Map(current.sections.map((section) => [section.id, section]))
  if (currentById.size !== current.sections.length) return false
  return previous.sections.every((before) => {
    const after = currentById.get(before.id)
    if (!after || before.period.start !== after.period.start || before.period.end !== after.period.end) return false
    const left = readPreservedProjection(before.content), right = readPreservedProjection(after.content)
    if (!left || !right || left.context.currency !== right.context.currency ||
        left.context.surface !== right.context.surface || left.engineVersion !== right.engineVersion) return false
    return left.context.period.start === right.context.period.start &&
      left.context.period.end === right.context.period.end
  })
}

/** Compare source-authored scalars literally; no FX, totals, percentages or guessed zeros. */
export function preservedValueRows(previous: PreservedSection, current: PreservedSection) {
  const before = readPreservedProjection(previous.content), after = readPreservedProjection(current.content)
  if (!before || !after) return []
  const a = new Map(before.values.map((entry) => [entry.id, entry]))
  const b = new Map(after.values.map((entry) => [entry.id, entry]))
  return [...new Set([...a.keys(), ...b.keys()])].flatMap((id) => {
    const left = a.get(id), right = b.get(id)
    return left?.value === right?.value && left?.evidenceState === right?.evidenceState &&
      left?.unit === right?.unit && left?.currency === right?.currency ? [] :
      [{ id, before: left, after: right }]
  })
}
