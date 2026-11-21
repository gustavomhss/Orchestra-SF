import { randomUUID } from "node:crypto"
import { digestSfValue } from "../contracts/canonical.ts"
import type { Period } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { createRoutineReviewResultReader } from "../routines/review-result.ts"
import type { ReviewSection } from "./port.ts"
import type { ReviewAgendaPreview } from "./selection.ts"

export type RoutineReviewSelectionRequest = { runRef: string; resultRef: string; outputDigest: string }
export type RoutineReviewSelection = ReviewAgendaPreview & { period: Period; routine: RoutineReviewSelectionRequest; previousReviewRef?: string }

/** A C07 body is opened by its producer, never submitted as an agenda by the caller. */
export function createReviewRoutineSelection(input: {
  results: Pick<ReturnType<typeof createRoutineReviewResultReader>, "read">
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  now: () => string
  maxSelections?: number
}) {
  const maximum = input.maxSelections ?? 128
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("SF_REVIEW_ROUTINE_LIMIT_INVALID")
  const lifetime = 15 * 60 * 1000
  const selections = new Map<string, { binding: string; request: RoutineReviewSelectionRequest; snapshot: Omit<RoutineReviewSelection, "selectionRef">; digest: string; expiresAt: number }>()
  const prune = (at: number) => { for (const [ref, selection] of selections) if (selection.expiresAt <= at) selections.delete(ref) }
  const read = async (request: RoutineReviewSelectionRequest, context: TrustedDomainContext): Promise<PortResult<Omit<RoutineReviewSelection, "selectionRef">>> => {
    const loaded = await input.results.read(request.runRef, context)
    if (loaded.status !== "ok") return loaded
    const result = loaded.value
    if (result.run.runRef !== request.runRef || result.run.resultRef !== request.resultRef || result.execution.runRef !== request.runRef || result.execution.resultRef !== request.resultRef || result.execution.outputDigest !== request.outputDigest || result.output.runRef !== request.runRef || result.output.resultRef !== request.resultRef || result.output.outputDigest !== request.outputDigest) return { status: "stale", reason: "routine-review-result-changed" }
    if (result.run.principalRef !== context.binding.principalRef || result.run.projectId !== context.binding.projectId || result.output.principalRef !== context.binding.principalRef || result.output.projectId !== context.binding.projectId) return { status: "denied", reason: "routine-review-unavailable" }
    if (!result.agendaSnapshot || !isSfPeriod(result.draft.period) || result.draft.coverage.unavailableTopics !== 0 || result.draft.coverage.omittedTopics !== 0 || result.draft.coverage.includedRecordCount === null) return { status: "unavailable", reason: "routine-review-snapshot-unavailable" }
    const previous = result.draft.previousReview
    if (previous && "status" in previous) return { status: "unavailable", reason: "routine-review-previous-unavailable" }
    return { status: "ok", value: structuredClone({ ...result.agendaSnapshot, period: result.draft.period, routine: request, ...(previous ? { previousReviewRef: previous.id } : {}) }) }
  }
  return {
    async create(incoming: RoutineReviewSelectionRequest, context: TrustedDomainContext): Promise<PortResult<RoutineReviewSelection>> {
      if (!validRoutineSelectionRequest(incoming)) return { status: "needs-input", reason: "invalid-routine-review" }
      const request = structuredClone(incoming)
      const binding = bindingDigest(context)
      const startedAt = Date.parse(input.now())
      if (!Number.isFinite(startedAt)) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      prune(startedAt)
      if (selections.size >= maximum) return { status: "unavailable", reason: "agenda-selection-capacity-reached" }
      if (!await input.revalidate(context)) return { status: "denied", reason: "routine-review-unavailable" }
      const loaded = await read(request, context)
      if (loaded.status !== "ok") return loaded
      if (binding !== bindingDigest(context) || !await input.revalidate(context)) return { status: "denied", reason: "routine-review-unavailable" }
      const completedAt = Date.parse(input.now())
      if (!Number.isFinite(completedAt) || completedAt < startedAt) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      prune(completedAt)
      if (selections.size >= maximum) return { status: "unavailable", reason: "agenda-selection-capacity-reached" }
      const selectionRef = `review-routine:${randomUUID()}`
      const snapshot = structuredClone(loaded.value)
      selections.set(selectionRef, { binding, request, snapshot, digest: digestSfValue(snapshot), expiresAt: completedAt + lifetime })
      return { status: "ok", value: { ...structuredClone(snapshot), selectionRef } }
    },
    async select(selectionRef: string, incomingRefs: readonly string[], context: TrustedDomainContext, incomingPeriod?: Period): Promise<PortResult<readonly ReviewSection[]>> {
      if (typeof selectionRef !== "string" || !Array.isArray(incomingRefs) || !incomingRefs.length || incomingRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || new Set(incomingRefs).size !== incomingRefs.length || (incomingPeriod !== undefined && !isSfPeriod(incomingPeriod))) return { status: "needs-input", reason: "invalid-agenda-sections" }
      const sectionRefs = [...incomingRefs]
      const period = incomingPeriod ? { ...incomingPeriod } : undefined
      const startedAt = Date.parse(input.now())
      if (!Number.isFinite(startedAt)) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      prune(startedAt)
      const selected = selections.get(selectionRef)
      if (!selected || selected.binding !== bindingDigest(context) || !await input.revalidate(context)) return { status: "denied", reason: "agenda-selection-unavailable" }
      if (sectionRefs.some((ref) => !selected.snapshot.sectionRefs.includes(ref))) return { status: "needs-input", reason: "invalid-agenda-sections" }
      const loaded = await read(structuredClone(selected.request), context)
      if (loaded.status !== "ok") return loaded
      if (digestSfValue(loaded.value) !== selected.digest) return { status: "stale", reason: "routine-review-result-changed" }
      const ordered = sectionRefs.map((ref) => selected.snapshot.sections.find((section) => section.id === ref)!)
      if (period && ordered.some((section) => section.period.start < period.start || section.period.end > period.end)) return { status: "needs-input", reason: "review-period-does-not-cover-selected-sections" }
      if (!await input.revalidate(context)) return { status: "denied", reason: "routine-review-unavailable" }
      const completedAt = Date.parse(input.now())
      if (!Number.isFinite(completedAt) || completedAt < startedAt) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      if (completedAt >= selected.expiresAt || selections.get(selectionRef) !== selected || selected.binding !== bindingDigest(context)) return { status: "denied", reason: "agenda-selection-unavailable" }
      return { status: "ok", value: structuredClone(ordered) }
    },
    release(selectionRef: string) { selections.delete(selectionRef) },
    // Provenance comes from this private registry after its authenticated reader,
    // never from a caller's prefix or claim about the source of the selection.
    isHistoricalSelection(selectionRef: string, context: TrustedDomainContext) {
      const selected = selections.get(selectionRef)
      const at = Date.parse(input.now())
      return !!selected && Number.isFinite(at) && at < selected.expiresAt && selected.binding === bindingDigest(context)
    },
  }
}

function validRoutineSelectionRequest(value: unknown): value is RoutineReviewSelectionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const request = value as Record<string, unknown>
  return Object.keys(request).every((key) => ["runRef", "resultRef", "outputDigest"].includes(key)) && typeof request.runRef === "string" && !!request.runRef.trim() && typeof request.resultRef === "string" && !!request.resultRef.trim() && typeof request.outputDigest === "string" && /^[a-f0-9]{64}$/.test(request.outputDigest)
}

function bindingDigest(context: TrustedDomainContext) {
  return digestSfValue([context.binding.installationId, context.binding.projectId, context.binding.principalRef, context.binding.accessRevision, context.binding.policyVersion])
}
