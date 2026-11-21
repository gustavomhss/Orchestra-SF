/**
 * N25/U18: presentation mapping of the existing A04 decision producers.
 * No authorization, route decoding, financial arithmetic or receipt synthesis.
 */
import type { Schema } from "effect"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransportFailure, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfCoverage, SfCopyKey, SfDisplayValue, SfMessage, SfUiState } from "../../shared/frame"

export type SfCaseRead = Schema.Schema.Type<(typeof SfDecisions.operations)["projection.case"]["output"]>
export type SfCase = Extract<SfCaseRead, { status: "ok" }>["value"]["projection"]["case"]
export type SfCaseChoice = SfCase["choices"][number]
export type SfCaseChange = SfCase["preparedChanges"][number]
export type SfCaseReceipt = SfCase["receipts"][number]
export type SfChoiceRead = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.choice.read"]["output"]>
export type SfChoiceOptions = Extract<SfChoiceRead, { status: "ok" }>["value"]
export type SfChoicePreparation = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.current-choice-prepare"]["output"]>
export type SfChoiceReview = Extract<SfChoicePreparation, { status: "ok" }>["value"]
export type SfDecisionReviewRead = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-review"]["output"]>
export type SfDecisionReview = Extract<SfDecisionReviewRead, { status: "ok" }>["value"]

export const u18Key = (key: string) => key as SfCopyKey
export const u18Message = (key: string): SfMessage => ({ key: u18Key(key) })
export const u18Missing = (): SfDisplayValue => ({ kind: "missing", reason: u18Message("sf.common.unknown") })
export const u18Text = (value: string | number | boolean | null | undefined): SfDisplayValue =>
  value === null || value === undefined ? u18Missing() :
  { kind: "text", text: { kind: "data", text: String(value) } }

export function u18PortState(
  output: SfTransportResult<{ readonly status: string }>,
): SfUiState {
  if (output.kind === "transport-error") return "unavailable"
  if (output.status === 401) return "session-expired"
  if (output.status === 403 || output.body.status === "denied") return "denied"
  if (output.status === 404) return "not-found"
  if (output.body.status === "conflict" || output.status === 409 && output.body.status !== "stale") return "conflict"
  if (output.body.status === "stale") return "stale"
  if (output.body.status === "needs-input" || output.body.status === "invalid") return "invalid"
  return "unavailable"
}

export function u18TransportState(error: SfTransportFailure): SfUiState {
  return error.reason === "outcome-unknown" || error.reason === "network"
    ? "outcome-unknown"
    : "unavailable"
}

export function u18ErrorKey(state: SfUiState): SfCopyKey {
  if (state === "denied" || state === "session-expired") return u18Key("sf.u18.error.denied")
  if (state === "not-found" || state === "invalid") return u18Key("sf.u18.error.invalid")
  if (state === "conflict" || state === "stale") return u18Key("sf.u18.error.conflict")
  if (state === "outcome-unknown") return u18Key("sf.common.operationUnknown")
  return u18Key("sf.u18.error.unavailable")
}

export function u18Coverage(source: { coverageState: "complete" | "pending" | "unavailable"; issues: readonly string[] }): SfCoverage {
  const state = source.coverageState === "complete" ? "complete"
    : source.coverageState === "pending" ? "partial" : "unavailable"
  return {
    state,
    summary: u18Message(state === "complete" ? "sf.u18.choice.coverageComplete" : state === "partial" ? "sf.u18.choice.coveragePartial" : "sf.u18.choice.coverageUnknown"),
    reasons: source.issues.map((issue) => ({ key: u18Key("sf.u18.choice.conditionNamed"), params: { note: issue } })),
    knownCount: null,
    expectedCount: null,
  }
}

/** Route-bound case references are opaque; never manufacture a new case/owner. */
export function u18OriginalCaseRef(value: SfCase): { id: string; incarnation: string; version: number } {
  return { id: value.id, incarnation: value.incarnation, version: value.version }
}

export function u18ReceiptForChange(change: SfCaseChange, receipts: readonly SfCaseReceipt[]): SfCaseReceipt | undefined {
  return change.receiptRef ? receipts.find((receipt) => receipt.id === change.receiptRef) : undefined
}

export function u18Ref(value: string): SfRef {
  return value as SfRef
}
