import { isSfPeriod } from "../contracts/validation.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"

/** An outcome is producer-owned; display values and limitations without deriving causes. */
export function validReviewOutcome(value: ObservedResultProjection | undefined) {
  if (value === undefined) return true
  return !!value && !!value.caseRef && typeof value.caseRef.id === "string" && !!value.caseRef.id && typeof value.caseRef.incarnation === "string" && !!value.caseRef.incarnation && Number.isSafeInteger(value.caseRef.version) && value.caseRef.version > 0 && (value.expected === null || (typeof value.expected === "number" && Number.isFinite(value.expected))) && (value.observed === null || (typeof value.observed === "number" && Number.isFinite(value.observed))) && typeof value.cutoff === "string" && Number.isFinite(Date.parse(value.cutoff)) && typeof value.currency === "string" && !!value.currency && Array.isArray(value.sourceRefs) && value.sourceRefs.length > 0 && value.sourceRefs.every((ref) => !!ref && typeof ref === "object" && typeof ref.refId === "string" && !!ref.refId && (ref.kind !== "record" || !!ref.target)) && Array.isArray(value.limitations) && value.limitations.every((entry) => typeof entry === "string")
}

export function reviewOutcomeLines(value: ObservedResultProjection) {
  return [
    `Outcome case ${value.caseRef.id} v${value.caseRef.version} · cutoff ${value.cutoff}`,
    `Expected: ${value.expected ?? "unavailable"} ${value.currency}`,
    `Observed: ${value.observed ?? "unavailable"} ${value.currency}`,
    ...value.sourceRefs.map((ref) => `Outcome source: ${ref.refId}${ref.kind === "record" && ref.target.period ? ` · ${ref.target.period.start} – ${ref.target.period.end}` : ""}`),
    ...value.limitations,
  ]
}

/** The comparable projection returned by WP14; its complete producer result is preserved. */
export type ReviewOutcomeComparison = {
  status: "comparable"
  caseRef: ObservedResultProjection["caseRef"]
  choiceId: string
  criterionRef: string
  unit: string
  currency: string
  period: import("../contracts/context.ts").Period
  expected: number
  observed: number
  delta: number
  cutoff: string
  sourceRefs: ObservedResultProjection["sourceRefs"]
  baselineRefs: ObservedResultProjection["sourceRefs"]
  limitations: readonly string[]
  compatibility: { metric: boolean; unit: boolean; period: boolean; currency: boolean; coverage: "complete" | "partial" | "unknown"; compatible: boolean }
  summary: { facts: readonly string[]; pending: readonly string[]; causality: "not-attributed" }
  observation: ObservedResultProjection
}

export function validOutcomeComparison(value: ReviewOutcomeComparison | undefined) {
  if (value === undefined) return true
  return !!value && value.status === "comparable" && !!value.observation && validReviewOutcome(value.observation) && !!value.caseRef && !!value.choiceId && !!value.criterionRef && !!value.unit && value.currency === value.observation.currency && value.caseRef.id === value.observation.caseRef.id && value.caseRef.incarnation === value.observation.caseRef.incarnation && value.caseRef.version === value.observation.caseRef.version && value.expected === value.observation.expected && value.observed === value.observation.observed && Number.isFinite(value.expected) && Number.isFinite(value.observed) && Number.isFinite(value.delta) && value.delta === value.observed - value.expected && value.cutoff === value.observation.cutoff && !!value.period && isSfPeriod(value.period) && Array.isArray(value.sourceRefs) && JSON.stringify(value.sourceRefs) === JSON.stringify(value.observation.sourceRefs) && Array.isArray(value.baselineRefs) && Array.isArray(value.limitations) && value.limitations.every((line) => typeof line === "string") && value.compatibility?.compatible === true && value.compatibility.metric === true && value.compatibility.unit === true && value.compatibility.period === true && value.compatibility.currency === true && value.compatibility.coverage === "complete" && value.summary?.causality === "not-attributed" && Array.isArray(value.summary.facts) && value.summary.facts.every((line) => typeof line === "string") && Array.isArray(value.summary.pending) && value.summary.pending.every((line) => typeof line === "string")
}

export function reviewOutcomeComparisonLines(value: ReviewOutcomeComparison) {
  return [`Choice ${value.choiceId} · criterion ${value.criterionRef} · ${value.period.start} – ${value.period.end} · ${value.unit} · ${value.currency}`, `Expected ${value.expected} · observed ${value.observed} · difference ${value.delta}`, ...value.summary.facts, ...value.summary.pending, ...value.limitations, `Outcome comparison snapshot: ${JSON.stringify(value)}`]
}
