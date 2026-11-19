import { Option, Schema } from "effect"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { createSfPortfolioClient } from "@orchestra/client/sucafina/portfolio"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import type { SfUiState } from "../../shared/frame"
import { sfReadControls, sfReadPortfolioHistory, sfReadPortfolioResult, sfReadSensitivityResult,
  sfUnwrapPort, type SfCaseControls, type SfCaseVersionRef, type SfPortfolioHistory,
  type SfPortfolioResultView, type SfSensitivityResultView } from "./model"

type OpResult<T> = Readonly<{ status: "ok"; value: T }> |
  Readonly<{ status: "failed"; state: SfUiState; reason: string }>
export type SfPortfolioOperation = Readonly<{
  kind: "replace" | "defer" | "include" | "exclude"
  targetRef: string
  replacementRef?: string
  amount?: number
  currency?: string
  period?: Readonly<{ start: string; end: string }>
}>
export type SfPortfolioRequest = Readonly<{
  scope: Readonly<{ horizon: Readonly<{ start: string; end: string }>; currency: string }>
  candidateRefs: readonly string[]
  operations: readonly SfPortfolioOperation[]
  constraints: readonly string[]
  priorities: readonly string[]
  explorationLimit: number
}>
export type SfSensitivityRequest = Readonly<{
  scenarioRef: string
  parameterBounds: Readonly<{ parameterRef: string; minimum: number; maximum: number; steps: number }>
  criterion: Readonly<{ id: string; operator: "lte" | "gte" | "eq"; value: number }>
}>
export type SfPortfolioPreview = Readonly<{
  portfolio: SfPortfolioResultView
  selections: readonly Readonly<{ combinationId: string; selectedCandidateRefs: readonly string[] }>[]
  evaluationDigest: string
}>
export type SfRecordedPortfolioProjection = Readonly<{
  resultRef: string; caseRef: SfCaseVersionRef; result: SfPortfolioResultView
}>
export type SfRecordedSensitivityProjection = Readonly<{
  resultRef: string; caseRef: SfCaseVersionRef; result: SfSensitivityResultView
}>
export type SfSensitivityUnits = Readonly<{
  caseRef: SfCaseVersionRef
  scenarioRef: string
  baselineRef: string
  parameterRef: string
  parameterUnit: string
  resultUnit: string
  unit: string
  engineVersion: string
  sourceRefs: readonly string[]
}>

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
const string = (value: unknown): value is string => typeof value === "string"
/**
 * A target operation must be independently published READY by the host.
 * Public routing, successful URL parsing, or a remembered case never confers
 * a grant. Selection/readers are still fenced by the host on each call.
 */
export function sfPortfolioReady(context: SfContext, operationId: string, family: "portfolio" | "decisions"): boolean {
  return context.availability.some((resource) =>
    resource.family === family && resource.state === "ready" &&
    resource.operations.some((op) => op.operationId === operationId &&
      op.state === "ready" && op.operational))
}
function fail(reason: string, state: SfUiState = "unavailable"): OpResult<never> {
  return { status: "failed", state, reason }
}
function transportResult(result: Readonly<{
  kind: "transport-error"; reason: string
}> | Readonly<{ kind: "response"; status: number; body: unknown }>, write = false): OpResult<unknown> {
  if (result.kind === "transport-error") return fail(result.reason,
    (result.reason === "outcome-unknown" || (write && ["network", "timeout", "aborted"].includes(result.reason))) ? "outcome-unknown" :
      result.reason === "aborted" ? "stale" : "unavailable")
  if (result.status !== 200 && result.status !== 201) return fail("producer-status-" + result.status,
    result.status === 401 ? "session-expired" : result.status === 403 ? "denied" :
      result.status === 404 ? "not-found" : result.status === 409 ? "conflict" :
        result.status === 400 || result.status === 422 ? "invalid" : "unavailable")
  const value = sfUnwrapPort(result.body)
  if (value === null) {
    const status = record(result.body) && string(result.body.status) ? result.body.status : ""
    return fail("producer-" + status, status === "stale" ? "stale" :
      status === "conflict" ? "conflict" : status === "denied" ? "denied" :
        status === "needs-input" ? "invalid" : "unavailable")
  }
  return { status: "ok", value }
}
/** Authoritative conversion from the case-typed, versioned candidate resolver. */
export function sfCandidateRef(caseRef: string, caseVersion: number, alternativeId: string, alternativeVersion: number): string | null {
  if (!caseRef.startsWith("case:") || !Number.isSafeInteger(caseVersion) || caseVersion < 1 ||
    !alternativeId || !Number.isSafeInteger(alternativeVersion) || alternativeVersion < 1) return null
  return "portfolio-candidate:" + encodeURIComponent(caseRef) + ":" + caseVersion + ":" +
    encodeURIComponent(alternativeId) + ":" + alternativeVersion
}
export async function sfDecisionControls(
  transport: SfTransport, context: SfContext, caseRef: string | undefined, signal: AbortSignal,
): Promise<OpResult<SfCaseControls>> {
  const id = "decisions.controls.read"
  if (!sfPortfolioReady(context, id, "decisions")) return fail("decisions-controls-not-admitted", "denied")
  const payload = caseRef === undefined ? {} : { case: caseRef }
  const input = Schema.decodeUnknownOption(SfDecisions.operations[id].input)(payload)
  if (Option.isNone(input)) return fail("decisions-controls-input-mismatch")
  const result = transportResult(await createSfDecisionsClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  const decoded = sfReadControls({ status: "ok", value: result.value }, caseRef)
  return decoded ? { status: "ok", value: decoded } : fail("decisions-controls-projection-mismatch")
}
export async function sfPortfolioHistory(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef, signal: AbortSignal,
): Promise<OpResult<SfPortfolioHistory>> {
  const id = "portfolio.decision-portfolio-results"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("portfolio-results-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef })
  if (Option.isNone(input)) return fail("portfolio-results-input-mismatch")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  const data = sfReadPortfolioHistory(result.value)
  return data ? { status: "ok", value: data } : fail("portfolio-results-projection-mismatch")
}
export async function sfPortfolioRecorded(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef,
  resultRef: string, signal: AbortSignal,
): Promise<OpResult<SfRecordedPortfolioProjection>> {
  const id = "portfolio.decision-portfolio-read"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("portfolio-read-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef, resultRef })
  if (Option.isNone(input)) return fail("portfolio-read-input-mismatch")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  if (!record(result.value) || result.value.portfolioResultRef !== resultRef ||
    !record(result.value.caseRef)) return fail("portfolio-read-projection-mismatch")
  const proof = result.value.caseRef
  if (proof.id !== caseRef.id || proof.incarnation !== caseRef.incarnation ||
    proof.version !== caseRef.version) return fail("portfolio-case-version-changed", "stale")
  const portfolio = sfReadPortfolioResult(result.value.portfolio)
  return portfolio ? { status: "ok", value: { resultRef, caseRef, result: portfolio } } :
    fail("portfolio-read-projection-mismatch")
}
export async function sfPortfolioPreviewRequest(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef,
  request: SfPortfolioRequest, signal: AbortSignal,
): Promise<OpResult<SfPortfolioPreview>> {
  const id = "portfolio.decision-portfolio-preview"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("portfolio-preview-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef, request })
  if (Option.isNone(input)) return fail("portfolio-preview-input-mismatch", "invalid")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  const source = result.value
  if (!record(source) || !Array.isArray(source.selections) || !string(source.evaluationDigest)) return fail("portfolio-preview-projection-mismatch")
  const portfolio = sfReadPortfolioResult(source.portfolio)
  if (!portfolio) return fail("portfolio-preview-projection-mismatch")
  const selections: SfPortfolioPreview["selections"][number][] = []
  for (const selected of source.selections) {
    if (!record(selected) || !string(selected.combinationId) || !Array.isArray(selected.selectedCandidateRefs) ||
      !selected.selectedCandidateRefs.every(string)) return fail("portfolio-preview-selection-mismatch")
    selections.push({ combinationId: selected.combinationId, selectedCandidateRefs: selected.selectedCandidateRefs })
  }
  return { status: "ok", value: { portfolio, selections, evaluationDigest: source.evaluationDigest } }
}
export async function sfPortfolioEvaluate(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef, request: SfPortfolioRequest,
  idempotencyKey: string, signal: AbortSignal,
): Promise<OpResult<SfRecordedPortfolioProjection>> {
  const id = "portfolio.decision-portfolio-evaluate"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("portfolio-evaluate-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef, request })
  if (Option.isNone(input)) return fail("portfolio-evaluate-input-mismatch", "invalid")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal, idempotencyKey }), true)
  if (result.status !== "ok") return result
  if (!record(result.value) || !string(result.value.portfolioResultRef) || !record(result.value.caseRef) ||
    result.value.caseRef.id !== caseRef.id || result.value.caseRef.incarnation !== caseRef.incarnation ||
    result.value.caseRef.version !== caseRef.version) return fail("portfolio-evaluate-result-mismatch", "stale")
  const portfolio = sfReadPortfolioResult(result.value.portfolio)
  return portfolio ? { status: "ok", value: { resultRef: result.value.portfolioResultRef, caseRef, result: portfolio } } :
    fail("portfolio-evaluate-result-mismatch")
}
export async function sfSensitivityUnitsForSelection(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef,
  scenarioRef: string, baselineRef: string, parameterRef: string, signal: AbortSignal,
): Promise<OpResult<SfSensitivityUnits>> {
  const id = "portfolio.decision-sensitivity-units"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("sensitivity-units-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({
    caseRef, scenarioRef, baselineRef, parameterRef,
  })
  if (Option.isNone(input)) return fail("sensitivity-units-input-mismatch", "invalid")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  const raw = result.value
  if (!record(raw) || !record(raw.caseRef) || raw.caseRef.id !== caseRef.id ||
      raw.caseRef.incarnation !== caseRef.incarnation || raw.caseRef.version !== caseRef.version ||
      !record(raw.units) || !string(raw.units.parameterUnit) || !string(raw.units.resultUnit) ||
      !string(raw.units.engineVersion) || !string(raw.units.baselineRef) ||
      raw.units.baselineRef !== baselineRef || raw.units.parameterRef !== parameterRef ||
      !Array.isArray(raw.units.sourceRefs)) return fail("sensitivity-units-projection-mismatch")
  const sources: string[] = []
  for (const source of raw.units.sourceRefs) {
    if (!record(source) || !string(source.refId)) return fail("sensitivity-units-source-mismatch")
    sources.push(source.refId)
  }
  return { status: "ok", value: { caseRef, scenarioRef, baselineRef, parameterRef,
    parameterUnit: raw.units.parameterUnit, resultUnit: raw.units.resultUnit,
    unit: raw.units.resultUnit, engineVersion: raw.units.engineVersion, sourceRefs: sources } }
}
export async function sfSensitivityRecorded(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef,
  resultRef: string, signal: AbortSignal,
): Promise<OpResult<SfRecordedSensitivityProjection>> {
  const id = "portfolio.decision-sensitivity-read"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("sensitivity-read-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef, resultRef })
  if (Option.isNone(input)) return fail("sensitivity-read-input-mismatch")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal }))
  if (result.status !== "ok") return result
  if (!record(result.value) || result.value.sensitivityResultRef !== resultRef ||
      !record(result.value.caseRef) || result.value.caseRef.id !== caseRef.id ||
      result.value.caseRef.incarnation !== caseRef.incarnation ||
      result.value.caseRef.version !== caseRef.version) return fail("sensitivity-read-projection-mismatch", "stale")
  const sensitivity = sfReadSensitivityResult(result.value.sensitivity)
  return sensitivity ? { status: "ok", value: { resultRef, caseRef, result: sensitivity } } :
    fail("sensitivity-read-projection-mismatch")
}
export async function sfSensitivityEvaluate(
  transport: SfTransport, context: SfContext, caseRef: SfCaseVersionRef, request: SfSensitivityRequest,
  idempotencyKey: string, signal: AbortSignal,
): Promise<OpResult<SfRecordedSensitivityProjection>> {
  const id = "portfolio.decision-sensitivity-evaluate"
  if (!sfPortfolioReady(context, id, "portfolio")) return fail("sensitivity-evaluate-not-admitted", "denied")
  const input = Schema.decodeUnknownOption(SfPortfolio[id].input)({ caseRef, request })
  if (Option.isNone(input)) return fail("sensitivity-evaluate-input-mismatch", "invalid")
  const result = transportResult(await createSfPortfolioClient(transport)[id](input.value, { signal, idempotencyKey }))
  if (result.status !== "ok") return result
  if (!record(result.value) || !string(result.value.sensitivityResultRef) ||
      !record(result.value.caseRef) || result.value.caseRef.id !== caseRef.id ||
      result.value.caseRef.incarnation !== caseRef.incarnation ||
      result.value.caseRef.version !== caseRef.version) return fail("sensitivity-evaluate-result-mismatch", "stale")
  const sensitivity = sfReadSensitivityResult(result.value.sensitivity)
  return sensitivity ? { status: "ok", value: { resultRef: result.value.sensitivityResultRef,
    caseRef, result: sensitivity } } : fail("sensitivity-evaluate-result-mismatch")
}
