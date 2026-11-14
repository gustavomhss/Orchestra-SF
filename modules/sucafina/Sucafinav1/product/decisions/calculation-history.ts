import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { StoredDecisionResult } from "./result-store.ts"

/** A ledger reader names the current case and the exact historical reference; it cannot supply a ledger event. */
export type HistoricalCalculationRead = {
  caseRef: { id: string; incarnation: string; version: number }
  eventId: string
  reference: Extract<BusinessEvidenceRef, { kind: "calculation" }>
}

/** Association only. Current case authorization and canonical source replay remain the callers' responsibility. */
export function historicalCalculationMatches(decision: DecisionCase | undefined, stored: StoredDecisionResult, request: HistoricalCalculationRead, context: TrustedDomainContext): boolean {
  try {
    const ref = request.reference
    if (!decision || stored.kind !== "scenario" || stored.schema !== "sf-decision-result-v1" || ref.kind !== "calculation" ||
      digestSfValue(request.caseRef) !== digestSfValue({ id: decision.id, incarnation: decision.incarnation, version: decision.version }) ||
      stored.caseRef.id !== decision.id || stored.caseRef.incarnation !== decision.incarnation || !Number.isSafeInteger(stored.caseRef.version) || stored.caseRef.version < 1 || stored.caseRef.version > decision.version ||
      ref.refId !== `planner-calculation:${encodeURIComponent(stored.resultRef)}` || ref.evidenceLevel !== "proposal" || ref.target.calculationId !== "planner:scenario" || ref.target.engineVersion !== "planner-runtime-v1" ||
      ref.target.runId !== stored.resultRef || ref.target.inputDigest !== stored.requestDigest || ref.target.resultDigest !== stored.resultDigest || stored.resultDigest !== digestSfValue(stored.result) ||
      digestSfValue(ref.target.sourceRefs) !== digestSfValue(stored.sourceRefs) || digestSfValue(ref.target.period) !== digestSfValue(stored.result.horizon) ||
      ref.target.currency !== stored.result.currency || stored.result.currency !== decision.currency ||
      ![decision.horizon.start, decision.horizon.end].every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))) || decision.horizon.start > decision.horizon.end ||
      stored.result.horizon.start < decision.horizon.start || stored.result.horizon.end > decision.horizon.end ||
      !request.eventId.trim()) return false
    const events = decision.ledger.filter((event) => event.id === request.eventId)
    if (events.length !== 1) return false
    const event = events[0]!
    if (event.caseRef.id !== decision.id || event.caseRef.incarnation !== decision.incarnation || !Number.isSafeInteger(event.caseRef.version) || event.caseRef.version < stored.caseRef.version || event.caseRef.version > decision.version ||
      !["analysis-accepted", "choice-recorded", "reconsideration-accepted"].includes(event.kind) || !/^[a-f0-9]{64}$/.test(event.outputDigest)) return false
    sfEvidenceSourceMaps([ref, ...event.evidenceRefs, ...stored.sourceRefs])
    const graph = (refs: readonly BusinessEvidenceRef[]): readonly BusinessEvidenceRef[] => refs.flatMap((value) => [value, ...(value.kind === "calculation" ? graph(value.target.sourceRefs) : value.kind === "case-event" ? graph(value.target.evidenceRefs) : [])])
    const ledgerRefs = graph(event.evidenceRefs)
    if (![ref, ...ledgerRefs, ...graph(stored.sourceRefs)].every((value) => value.installationId === context.binding.installationId && value.projectId === context.binding.projectId)) return false
    return ledgerRefs.some((value) => digestSfValue(value) === digestSfValue(ref))
  } catch { return false }
}
