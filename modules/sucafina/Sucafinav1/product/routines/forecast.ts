import type { ConfirmationValidityProjection } from "../contracts/context.ts"
import type { ForecastCompareRequest } from "../contracts/operations.ts"
import type { FinancialAnalysis, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { compareProjections, confirmationCharge, type ProjectionChange } from "./review.ts"
import { routineProjectionMaterial } from "./material.ts"
import { forecastConfirmationCoverageDigest } from "./confirmation.ts"
import type { ForecastConfirmationCoverage } from "./confirmation.ts"

export type ForecastResponsibility = { readonly valueId: string; readonly responsibleRef: string; readonly evidenceRefs: readonly BusinessEvidenceRef[] }
export type ForecastRecordedReason = { readonly valueId: string; readonly reason: string | null; readonly evidenceRefs: readonly BusinessEvidenceRef[] }
export type ForecastFacts = {
  /** Candidate outlook minus budget; positive means spending above budget. */
  budgetMargin: { value: number | null; currency: string; evidenceRefs: readonly BusinessEvidenceRef[] }
  absentActual: readonly { valueId: string; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  inheritedBudget: readonly { valueId: string; evidenceRefs: readonly BusinessEvidenceRef[] }[]
  responsibles: readonly { valueId: string; responsibleRef: string; evidenceRefs: readonly BusinessEvidenceRef[] }[]
}

/** The host reads the same C06 validity projection used by collaboration and revalidates all sources on egress. */
export type ForecastReviewHost = {
  planner: Pick<PlannerPort, "compareForecast">
  confirmations: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly ConfirmationValidityProjection[]>>
  /** Every selected scope is retained, including explicit C06 absence. IDs alone do not prove coverage. */
  confirmationCoverage?: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<ForecastConfirmationCoverage>>
  revalidate: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<boolean>
  /** Absent until composition supplies a real owner source. Missing does not invent an owner. */
  responsibles?: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly ForecastResponsibility[]>>
  /** Absent until composition supplies recorded reasons. Missing does not invent a justification. */
  recordedReasons?: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly ForecastRecordedReason[]>>
  facts?: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<ForecastFacts>>
  revalidateFacts?: (request: ForecastCompareRequest, facts: ForecastFacts, context: TrustedDomainContext) => Promise<boolean>
}

/** Re-read the Planner's authenticated facets and require the same evidence and values at egress. */
export function createForecastFactsAccess(facts: NonNullable<ForecastReviewHost["facts"]>) {
  return {
    facts,
    async revalidateFacts(request: ForecastCompareRequest, previous: ForecastFacts, context: TrustedDomainContext) {
      const current = await facts(request, context)
      return current.status === "ok" && digestSfValue(current.value) === digestSfValue(previous)
    },
  }
}

type AssignmentFacet = {
  status: "ready" | "unavailable"
  reason?: string
  groups: readonly { responsibleRef: string; valueIds: readonly string[] }[]
  unassigned: readonly string[]
}

type JustificationFacet = {
  status: "ready" | "unavailable"
  reason?: string
  items: readonly ({ valueId: string; state: "absent" } | { valueId: string; state: "recorded"; text: string })[]
}

const producerSemanticsUnavailable = { status: "unavailable", reason: "producer-semantics-unavailable" } as const

/** The Planner computes all values. Margin, inherited budget, and missing actual are reported only when the producer names them. */
export async function prepareForecastReview(input: { request: ForecastCompareRequest; context: TrustedDomainContext; host: ForecastReviewHost }) {
  const compared = await input.host.planner.compareForecast(input.request, input.context)
  if (compared.status !== "ok") return compared
  const comparison = { value: structuredClone(compared.value) }
  if ([comparison.value.baseline, comparison.value.candidate].some((projection) => projection.missing.some((entry) => entry.reason === "restricted"))) return { status: "unavailable", reason: "review-source-unavailable" } as const
  const confirmed = await readConfirmationSnapshot(input.host, input.request, input.context)
  if (confirmed.status !== "ok") return confirmed
  const confirmations = { value: structuredClone(confirmed.value.confirmations) }
  const coverage = confirmed.value.coverage
  if (confirmations.value.some((entry) => confirmationCharge(entry) === "unavailable")) return { status: "unavailable", reason: "review-source-unavailable" } as const
  const changes = compareProjections(comparison.value.baseline, comparison.value.candidate)
  if (changes === undefined) return { status: "unavailable", reason: "projection-identity-invalid" } as const
  const observedFacts = input.host.facts ? await input.host.facts(input.request, input.context) : { status: "unavailable", reason: "producer-semantics-unavailable" } as const
  const facts = observedFacts.status === "ok" ? { status: "ok" as const, value: structuredClone(observedFacts.value) } : observedFacts
  if (facts.status === "denied") return { status: "denied", reason: "access-changed" } as const
  if (facts.status !== "ok" && facts.status !== "unavailable" && facts.status !== "needs-input") return facts
  if (facts.status === "ok" && (!facts.value.budgetMargin.currency.trim() || (facts.value.budgetMargin.value !== null && (!Number.isFinite(facts.value.budgetMargin.value) || !facts.value.budgetMargin.evidenceRefs.length)) || [...facts.value.absentActual, ...facts.value.inheritedBudget, ...facts.value.responsibles].some((entry) => !entry.valueId.trim() || !entry.evidenceRefs.length))) return { status: "unavailable", reason: "producer-facts-invalid" } as const
  const assignment = await assignmentFor(facts.status === "ok" ? { ...input.host, responsibles: async () => ({ status: "ok", value: facts.value.responsibles }) } : input.host, input.request, input.context, changes)
  if (assignment.status !== "ok") return assignment
  const justifications = await justificationsFor(input.host, input.request, input.context, changes, facts.status === "ok" ? facts.value.inheritedBudget.map((entry) => entry.valueId) : [])
  if (justifications.status !== "ok") return justifications
  const currentComparison = await input.host.planner.compareForecast(input.request, input.context)
  if (currentComparison.status !== "ok") return currentComparison
  const comparisonDigest = (value: FinancialAnalysis) => digestSfValue({ ...value, baseline: routineProjectionMaterial(value.baseline), candidate: routineProjectionMaterial(value.candidate) })
  if (comparisonDigest(currentComparison.value) !== comparisonDigest(comparison.value)) return { status: "stale", reason: "forecast-source-changed" } as const
  const currentConfirmations = await readConfirmationSnapshot(input.host, input.request, input.context)
  if (currentConfirmations.status !== "ok") return currentConfirmations
  if (currentConfirmations.value.confirmations.some((entry) => confirmationCharge(entry) === "unavailable")) return { status: "unavailable", reason: "review-source-unavailable" } as const
  const confirmationDigest = (values: readonly ConfirmationValidityProjection[]) => digestSfValue(values.map((entry) => ({ ...entry, evaluatedAt: "", evaluatedSourceVersion: 0 })).sort((left, right) => left.confirmationId.localeCompare(right.confirmationId)))
  if (confirmationDigest(currentConfirmations.value.confirmations) !== confirmationDigest(confirmations.value) ||
    (coverage ? forecastConfirmationCoverageDigest(coverage) : null) !== (currentConfirmations.value.coverage ? forecastConfirmationCoverageDigest(currentConfirmations.value.coverage) : null)) return { status: "stale", reason: "confirmation-source-changed" } as const
  const currentAssignment = await assignmentFor(facts.status === "ok" ? { ...input.host, responsibles: async () => ({ status: "ok", value: facts.value.responsibles }) } : input.host, input.request, input.context, changes)
  if (currentAssignment.status !== "ok") return currentAssignment
  const currentJustifications = await justificationsFor(input.host, input.request, input.context, changes, facts.status === "ok" ? facts.value.inheritedBudget.map((entry) => entry.valueId) : [])
  if (currentJustifications.status !== "ok") return currentJustifications
  if (digestSfValue(currentAssignment.value) !== digestSfValue(assignment.value) || digestSfValue(currentJustifications.value) !== digestSfValue(justifications.value)) return { status: "stale", reason: "forecast-context-changed" } as const
  if (facts.status === "ok" && (!input.host.revalidateFacts || !await input.host.revalidateFacts(input.request, facts.value, input.context))) return { status: "denied", reason: "access-changed" } as const
  if (!await input.host.revalidate(input.request, input.context)) return { status: "denied", reason: "access-changed" } as const
  const gaps = classifyGaps(comparison.value)
  const allConfirmed = !!coverage && coverage.scopes.length > 0 && coverage.scopes.every((entry) => entry.confirmation !== null && confirmationCharge(entry.confirmation) === "confirmed")
  return {
    status: "ok",
    value: {
      comparison: comparison.value,
      confirmations: confirmations.value,
      confirmationCoverage: coverage ? { state: "checked" as const, scopes: coverage.scopes } : { state: "unavailable" as const, reason: "confirmation-scope-coverage-unavailable" },
      pendingConfirmationIds: [...new Set(confirmations.value.flatMap((entry) => entry.state === "stale" ? [entry.confirmationId] : []))],
      reviewState: allConfirmed ? "confirmed" as const : confirmations.value.length === 0 ? "unconfirmed" as const : "pending" as const,
      measured: {
        differenceAgainstBase: comparison.value.knownDifference,
        completeDifference: comparison.value.completeDifference,
        budgetMargin: facts.status === "ok" ? facts.value.budgetMargin : producerSemanticsUnavailable,
        budgetMarginBasis: "outlook-minus-budget",
      },
      gaps: { ...gaps, absentActual: facts.status === "ok" ? facts.value.absentActual : producerSemanticsUnavailable, inheritedBudget: facts.status === "ok" ? facts.value.inheritedBudget : producerSemanticsUnavailable },
      changes,
      assignment: assignment.value,
      justifications: justifications.value,
      synthesisIncluded: false as const,
      complete: allConfirmed && facts.status === "ok" && facts.value.budgetMargin.value !== null && facts.value.absentActual.length === 0 && assignment.value.status === "ready" && assignment.value.unassigned.length === 0 && justifications.value.status === "ready" && justifications.value.items.every((item) => item.state === "recorded") && comparison.value.comparison.comparisonStatus === "complete" && gaps.missingFx.length === 0 && gaps.missingRate.length === 0,
    },
  } as const
}

async function readConfirmationSnapshot(host: ForecastReviewHost, request: ForecastCompareRequest, context: TrustedDomainContext): Promise<PortResult<{ confirmations: readonly ConfirmationValidityProjection[]; coverage: ForecastConfirmationCoverage | null }>> {
  if (host.confirmationCoverage) {
    const result = await host.confirmationCoverage(request, context)
    if (result.status !== "ok") return result
    const coverage = structuredClone(result.value)
    if (coverage.scopes.some((entry) => entry.confirmation?.state === "unavailable")) return { status: "unavailable", reason: "review-source-unavailable" }
    return { status: "ok", value: { confirmations: coverage.scopes.flatMap((entry) => entry.confirmation ? [entry.confirmation] : []), coverage } }
  }
  const result = await host.confirmations(request, context)
  return result.status === "ok" ? { status: "ok", value: { confirmations: structuredClone(result.value), coverage: null } } : result
}

async function assignmentFor(host: ForecastReviewHost, request: ForecastCompareRequest, context: TrustedDomainContext, changes: readonly ProjectionChange[]): Promise<PortResult<AssignmentFacet>> {
  if (!host.responsibles) return { status: "ok", value: { status: "unavailable", reason: "responsible-source-unavailable", groups: [], unassigned: [] } }
  const listed = await host.responsibles(request, context)
  if (listed.status === "denied") return { status: "denied", reason: "access-changed" }
  if (listed.status !== "ok") return { status: "ok", value: { status: "unavailable", reason: "responsible-source-unavailable", groups: [], unassigned: [] } }
  const owners = ownerIndex(listed.value)
  if (!owners) return { status: "ok", value: { status: "unavailable", reason: "responsible-source-ambiguous", groups: [], unassigned: [] } }
  const ids = [...new Set(changes.map(changeId))].sort()
  const groups = [...new Set(ids.flatMap((id) => {
    const owner = owners.get(id)
    return owner ? [owner] : []
  }))].sort().map((responsibleRef) => ({ responsibleRef, valueIds: ids.filter((id) => owners.get(id) === responsibleRef) }))
  return { status: "ok", value: { status: "ready", groups, unassigned: ids.filter((id) => !owners.has(id)) } }
}

async function justificationsFor(host: ForecastReviewHost, request: ForecastCompareRequest, context: TrustedDomainContext, changes: readonly ProjectionChange[], inherited: readonly string[]): Promise<PortResult<JustificationFacet>> {
  if (!host.recordedReasons) return { status: "ok", value: { status: "unavailable", reason: "justification-source-unavailable", items: [] } }
  const recorded = await host.recordedReasons(request, context)
  if (recorded.status === "denied") return { status: "denied", reason: "access-changed" }
  if (recorded.status !== "ok") return { status: "ok", value: { status: "unavailable", reason: "justification-source-unavailable", items: [] } }
  const reasons = reasonIndex(recorded.value)
  if (!reasons) return { status: "ok", value: { status: "unavailable", reason: "justification-source-ambiguous", items: [] } }
  return {
    status: "ok",
    value: {
      status: "ready",
      items: [...new Set([...changes.map(changeId), ...inherited])].sort().map((valueId) => {
        const reason = reasons.get(valueId)
        if (!reason?.trim()) return { valueId, state: "absent" as const }
        return { valueId, state: "recorded" as const, text: reason }
      }),
    },
  }
}

function ownerIndex(entries: readonly ForecastResponsibility[]) {
  if (entries.some((entry) => !entry.valueId.trim() || !entry.responsibleRef.trim() || !entry.evidenceRefs.length)) return undefined
  const ids = [...new Set(entries.map((entry) => entry.valueId))]
  if (ids.some((id) => new Set(entries.filter((entry) => entry.valueId === id).map((entry) => entry.responsibleRef)).size > 1)) return undefined
  return new Map(ids.flatMap((id) => {
    const owner = entries.find((entry) => entry.valueId === id)?.responsibleRef
    return owner ? [[id, owner] as const] : []
  }))
}

function reasonIndex(entries: readonly ForecastRecordedReason[]) {
  if (entries.some((entry) => !entry.valueId.trim() || !entry.evidenceRefs.length)) return undefined
  const ids = [...new Set(entries.map((entry) => entry.valueId))]
  if (ids.some((id) => new Set(entries.filter((entry) => entry.valueId === id).map((entry) => entry.reason)).size > 1)) return undefined
  return new Map(ids.flatMap((id) => {
    const reason = entries.find((entry) => entry.valueId === id)?.reason ?? null
    return [[id, reason] as const]
  }))
}

function classifyGaps(analysis: FinancialAnalysis) {
  const missing = [...analysis.baseline.missing, ...analysis.candidate.missing]
  return {
    absentActual: producerSemanticsUnavailable,
    missingFx: unique(missing.flatMap((entry) => entry.reason === "missing-fx" ? [entry.field] : [])),
    missingRate: unique(missing.flatMap((entry) => entry.reason === "missing-rate" ? [entry.field] : [])),
    inheritedBudget: producerSemanticsUnavailable,
    declared: analysis.gaps,
  }
}

function changeId(change: ProjectionChange) {
  if (change.state === "removed") return change.previous.id
  return change.current.id
}

function unique(values: readonly string[]) {
  return [...new Set(values)].sort()
}

