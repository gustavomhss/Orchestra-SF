import { isSfPeriod } from "../contracts/validation.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import { canonicalSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"

/** An outcome is producer-owned; display values and limitations without deriving causes. */
export function validReviewOutcome(value: ObservedResultProjection | undefined) {
  if (value === undefined) return true
  return !!value && onlyKeys(value, ["caseRef", "expected", "observed", "cutoff", "currency", "sourceRefs", "limitations"]) && !!value.caseRef && onlyKeys(value.caseRef, ["id", "incarnation", "version"]) && typeof value.caseRef.id === "string" && !!value.caseRef.id.trim() && typeof value.caseRef.incarnation === "string" && !!value.caseRef.incarnation.trim() && Number.isSafeInteger(value.caseRef.version) && value.caseRef.version > 0 && (value.expected === null || (typeof value.expected === "number" && Number.isFinite(value.expected))) && (value.observed === null || (typeof value.observed === "number" && Number.isFinite(value.observed))) && typeof value.cutoff === "string" && Number.isFinite(Date.parse(value.cutoff)) && typeof value.currency === "string" && !!value.currency.trim() && Array.isArray(value.sourceRefs) && value.sourceRefs.length > 0 && value.sourceRefs.every(validEvidence) && Array.isArray(value.limitations) && value.limitations.every((entry) => typeof entry === "string")
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
  return !!value && onlyKeys(value, ["status", "caseRef", "choiceId", "criterionRef", "unit", "currency", "period", "expected", "observed", "delta", "cutoff", "sourceRefs", "baselineRefs", "limitations", "compatibility", "summary", "observation"]) && onlyKeys(value.caseRef, ["id", "incarnation", "version"]) && onlyKeys(value.compatibility, ["metric", "unit", "period", "currency", "coverage", "compatible"]) && onlyKeys(value.summary, ["facts", "pending", "causality"]) && value.status === "comparable" && !!value.observation && validReviewOutcome(value.observation) && !!value.caseRef && [value.choiceId, value.criterionRef, value.unit].every((part) => typeof part === "string" && !!part.trim()) && value.currency === value.observation.currency && value.caseRef.id === value.observation.caseRef.id && value.caseRef.incarnation === value.observation.caseRef.incarnation && value.caseRef.version === value.observation.caseRef.version && value.expected === value.observation.expected && value.observed === value.observation.observed && Number.isFinite(value.expected) && Number.isFinite(value.observed) && Number.isFinite(value.delta) && value.delta === value.observed - value.expected && value.cutoff === value.observation.cutoff && !!value.period && isSfPeriod(value.period) && Array.isArray(value.sourceRefs) && canonicalSfValue(value.sourceRefs) === canonicalSfValue(value.observation.sourceRefs) && Array.isArray(value.baselineRefs) && value.baselineRefs.every(validEvidence) && Array.isArray(value.limitations) && value.limitations.every((line) => typeof line === "string") && value.compatibility?.compatible === true && value.compatibility.metric === true && value.compatibility.unit === true && value.compatibility.period === true && value.compatibility.currency === true && value.compatibility.coverage === "complete" && value.summary?.causality === "not-attributed" && Array.isArray(value.summary.facts) && value.summary.facts.every((line) => typeof line === "string") && Array.isArray(value.summary.pending) && value.summary.pending.every((line) => typeof line === "string")
}

export function reviewOutcomeComparisonLines(value: ReviewOutcomeComparison) {
  return [`Choice ${value.choiceId} · criterion ${value.criterionRef} · ${value.period.start} – ${value.period.end} · ${value.unit} · ${value.currency}`, `Expected ${value.expected} · observed ${value.observed} · difference ${value.delta}`, `Observation cutoff: ${value.cutoff} · coverage ${value.compatibility.coverage}`, ...value.baselineRefs.map((ref) => `Preserved baseline source: ${ref.refId}`), ...value.sourceRefs.map((ref) => `Observed source: ${ref.refId}`), ...value.summary.facts, ...value.summary.pending, ...value.limitations, "The observation does not establish causality."]
}

function onlyKeys(value: unknown, allowed: readonly string[]) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key))
}

function validEvidence(ref: ObservedResultProjection["sourceRefs"][number]) {
  return decodeSfOperationInput("sf_evidence_get", { evidenceRef: ref }).ok && !!ref && typeof ref === "object" && ref.schema === "sf-evidence-v1" && [ref.refId, ref.installationId, ref.projectId, ref.refDigest].every((part) => typeof part === "string" && !!part.trim()) && ["record", "document", "calculation", "receipt", "case-event", "policy"].includes(ref.kind) && !!ref.target && typeof ref.target === "object"
}

