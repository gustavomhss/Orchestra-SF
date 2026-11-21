import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { C12ProposalAction } from "./c12-proposal.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { isReviewDigest } from "../decisions/receipt-review-binding.ts"
import type { createProcurementDecisionHost } from "./decision-host.ts"
import { readProcurementBody } from "./http-body.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Decisions = ReturnType<typeof createProcurementDecisionHost>
type Apply = Parameters<Decisions["apply"]>[0]
type Recover = Parameters<Decisions["recover"]>[0]
type Review = Parameters<Decisions["reviewChange"]>[0]
type Proposal = Review & { action?: C12ProposalAction }
type Prepare = Parameters<Decisions["prepareChanges"]>[0]

/** Narrow HTTP adapter over the real Procurement/WP11 services and full human intent. */
export function createProcurementDecisionHttp(input: {
  origin: string
  mount: string
  runtime: () => {
    human: ReturnType<typeof createSfHumanAuthority>
    decisions: Decisions
    withCase: <T>(context: TrustedUiContext, caseRef: CaseRef, options: { allowHistoricalRetry?: boolean }, action: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
  } | undefined
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    const proposalMode = mode === "decision-proposal-review" || mode === "decision-proposal-advance"
    if (!proposalMode && mode !== "decision-prepare-changes" && mode !== "decision-review" && mode !== "decision-apply" && mode !== "decision-recover") return undefined
    if (surface !== "procurement" || url.origin !== input.origin || url.pathname !== `${input.mount}/procurement` || request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site") return response({ status: "denied", reason: "decision-origin-unavailable" })
    if (request.method !== "POST") return response({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return response({ status: "needs-input", reason: "invalid-decision-query" })
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response({ status: "needs-input", reason: "invalid-content-type" }, 415)
    const bytes = await readProcurementBody(request, 131072).catch(() => undefined)
    if (!bytes) return response({ status: "needs-input", reason: "request-too-large" }, 413)
    const payload: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
    const parsed = parse(mode!, payload)
    if (!parsed) return response({ status: "needs-input", reason: "invalid-decision-input" })
    const runtime = input.runtime()
    if (!runtime) return response({ status: "unavailable", reason: "decision-runtime-unavailable" })
    const action = mode === "decision-proposal-review" ? "decisions.procurement-proposal.review" : mode === "decision-proposal-advance" ? "decisions.procurement-proposal.advance" :
      mode === "decision-prepare-changes" ? "decisions.prepare-changes" : mode === "decision-review" ? "decisions.portfolio.read" : "decisions.apply"
    const admitted = await runtime.human.admit(request, action, parsed)
    if (admitted.status !== "ok") return response(admitted)
    try {
      if (proposalMode && "changeId" in parsed) {
        const selected = { caseRef: parsed.caseRef, choiceId: parsed.choiceId, changeId: parsed.changeId }
        // An assigned Procurement approver is authorized for the narrow proposal
        // even when they do not participate in the wider Decisions case.
        return response("action" in parsed && parsed.action
          ? await runtime.decisions.proposal.advance(selected, parsed.action, admitted.value)
          : await runtime.decisions.proposal.review(selected, admitted.value))
      }
      return await runtime.withCase(admitted.value, parsed.caseRef, { allowHistoricalRetry: mode !== "decision-review" }, async (): Promise<PortResult<Response>> => {
        if (mode === "decision-prepare-changes" && "operations" in parsed) return { status: "ok", value: response(await runtime.decisions.prepareChanges(parsed, admitted.value)) }
        if (!("changeId" in parsed)) return { status: "needs-input", reason: "invalid-decision-input" }
        const selected: Review = { caseRef: parsed.caseRef, choiceId: parsed.choiceId, changeId: parsed.changeId }
        if (mode === "decision-review") return { status: "ok", value: response(await runtime.decisions.reviewChange(selected, admitted.value)) }
        if (!("reviewDigest" in parsed) && !(mode === "decision-recover" && "purpose" in parsed && parsed.purpose === "recover")) return { status: "needs-input", reason: "invalid-decision-input" }
        const result = mode === "decision-recover"
          ? await runtime.decisions.recover("reviewDigest" in parsed ? { ...selected, reviewDigest: parsed.reviewDigest } : { ...selected, purpose: "recover" }, admitted.value)
          : "reviewDigest" in parsed ? await runtime.decisions.apply({ ...selected, reviewDigest: parsed.reviewDigest }, admitted.value) : { status: "needs-input" as const, reason: "invalid-decision-input" }
        return { status: "ok", value: result.status === "ok" ? response({ status: "ok", value: { receiptId: result.value.id, surface: result.value.surface, version: result.value.version, outcome: result.value.result.ok ? "applied" : result.value.result.status === 409 ? "conflict" : "failed" } }) : response(result) }
      }).then((result) => result.status === "ok" ? result.value : response(result))
    } catch {
      return response({ status: "unavailable", reason: "decision-request-unavailable" })
    } finally { runtime.human.finish(admitted.value) }
  }
}

function parse(mode: string, value: unknown): Prepare | Apply | Recover | Proposal | (Review & { purpose: "review" }) | undefined {
  if (!object(value) || !caseRef(value.caseRef) || typeof value.choiceId !== "string" || !value.choiceId.trim()) return undefined
  if (mode === "decision-prepare-changes") {
    if (!closed(value, ["caseRef", "choiceId", "operations"])) return undefined
    const operations = decodeSfOperationInput("sf_change_prepare", { caseRef: encodeCaseRef(value.caseRef), choiceRef: value.choiceId, operations: value.operations })
    return operations.ok ? { caseRef: value.caseRef, choiceId: value.choiceId, operations: operations.value.operations } : undefined
  }
  if (typeof value.changeId !== "string" || !value.changeId.trim()) return undefined
  if (mode === "decision-proposal-review") return closed(value, ["caseRef", "choiceId", "changeId"]) ? { caseRef: value.caseRef, choiceId: value.choiceId, changeId: value.changeId } : undefined
  if (mode === "decision-proposal-advance") {
    const action = value.action
    return closed(value, ["caseRef", "choiceId", "changeId", "action"]) && object(action) && closed(action, ["kind", "reviewDigest"]) &&
      (action.kind === "submit" || action.kind === "approve") && typeof action.reviewDigest === "string" && isReviewDigest(action.reviewDigest)
      ? { caseRef: value.caseRef, choiceId: value.choiceId, changeId: value.changeId, action: { kind: action.kind, reviewDigest: action.reviewDigest } } : undefined
  }
  if (mode === "decision-review") return closed(value, ["purpose", "caseRef", "choiceId", "changeId"]) && value.purpose === "review" ? { purpose: "review", caseRef: value.caseRef, choiceId: value.choiceId, changeId: value.changeId } : undefined
  if (mode === "decision-recover" && value.purpose === "recover") return closed(value, ["purpose", "caseRef", "choiceId", "changeId"]) ? { purpose: "recover", caseRef: value.caseRef, choiceId: value.choiceId, changeId: value.changeId } : undefined
  return closed(value, ["caseRef", "choiceId", "changeId", "reviewDigest"]) && typeof value.reviewDigest === "string" && isReviewDigest(value.reviewDigest) ? { caseRef: value.caseRef, choiceId: value.choiceId, changeId: value.changeId, reviewDigest: value.reviewDigest } : undefined
}

function response(result: PortResult<unknown>, status?: number) {
  return Response.json(result, { status: status ?? (result.status === "ok" ? 200 : result.status === "needs-input" ? 400 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : 503), headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function closed(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)) }
function caseRef(value: unknown): value is CaseRef { return object(value) && closed(value, ["id", "incarnation", "version"]) && typeof value.id === "string" && !!value.id.trim() && typeof value.incarnation === "string" && !!value.incarnation.trim() && Number.isSafeInteger(value.version) && Number(value.version) >= 1 }


