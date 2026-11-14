import type { ReviewActionClosure, ReviewActionHandoff } from "./closure-action.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { createMeetingViewFromReads } from "./meeting.ts"
import type { ReviewComparisonRead } from "./comparison-port.ts"
import type { ReviewAgendaItem, ReviewAgendaPreview } from "./selection.ts"
import type { ReviewPrepareRequest } from "../contracts/operations.ts"
import type { MeetingMaterialProposal, ReviewDraft } from "../contracts/outputs.ts"
import { decodeSfContributionEnvelope, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { ReviewContribution, ReviewContributionRequest } from "./contribution.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"

/** Uses the mounted application's same-origin route; each read obtains a fresh host lease. */
export function createReviewBrowser(input: {
  reviewRef: string
  checkUpdate: (reviewRef: string) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
  openSource?: (reference: BusinessEvidenceRef) => void | Promise<void>
  openReviewSection?: (reviewRef: string, sectionId: string) => void | Promise<void>
}) {
  const post = createReviewPost()
  const read = async (reviewRef: string): Promise<PortResult<PreservedReview>> => {
    const url = new URL(window.location.href)
    url.search = ""
    url.hash = ""
    url.searchParams.set("sf", "review-read")
    url.searchParams.set("reviewRef", reviewRef)
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
    if (!response?.ok) return { status: "unavailable", reason: "review-unavailable" }
    const result: unknown = await response.json().catch(() => undefined)
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("id" in result.value) || result.value.id !== reviewRef || !("sections" in result.value) || !Array.isArray(result.value.sections) || !("comments" in result.value) || !Array.isArray(result.value.comments)) return { status: "unavailable", reason: "review-unavailable" }
    return { status: "ok", value: result.value as PreservedReview }
  }
  const readComparison = async (reviewRef: string): Promise<PortResult<ReviewComparisonRead>> => {
    const url = reviewUrl("review-comparison")
    url.searchParams.set("reviewRef", reviewRef)
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
    const value: unknown = await response?.json().catch(() => undefined)
    if (!response?.ok || !isResult(value) || value.status !== "ok" || !value.value || typeof value.value !== "object" || !("comparison" in value.value) || !("forwardings" in value.value) || !Array.isArray(value.value.forwardings) || !("forwardingCoverage" in value.value) || !["complete", "partial", "unavailable"].includes(String(value.value.forwardingCoverage)) || !("limitations" in value.value) || !Array.isArray(value.value.limitations)) return { status: "unavailable", reason: "review-comparison-unavailable" }
    return { status: "ok", value: value.value as ReviewComparisonRead }
  }
  const view = createMeetingViewFromReads({ reviewRef: input.reviewRef, read, readComparison, checkUpdate: input.checkUpdate, requestUpdate: input.requestUpdate, openSource: input.openSource, openReviewSection: input.openReviewSection })
  return {
    ...view,
    readComparison,
    async confirmAction(handoff: ReviewActionHandoff): Promise<PortResult<{ closureRef: string; review: PreservedReview; topic: HotTopic; relationId: string }>> {
      const { response, result } = await post("review-close", { reviewRef: input.reviewRef, handoff })
      if (!response?.ok) return { status: "unavailable", reason: "handoff-unavailable" }
      if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("closureRef" in result.value) || typeof result.value.closureRef !== "string") return { status: "unavailable", reason: "handoff-unavailable" }
      return result as PortResult<{ closureRef: string; review: PreservedReview; topic: HotTopic; relationId: string }>
    },
    async readClosure(closureRef: string): Promise<PortResult<{ closure: ReviewActionClosure; review: PreservedReview; currentAction: HotTopic }>> {
      const url = new URL(window.location.href)
      url.search = ""
      url.hash = ""
      url.searchParams.set("sf", "review-closure")
      url.searchParams.set("closureRef", closureRef)
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
      if (!response?.ok) return { status: "unavailable", reason: "closure-unavailable" }
      const result: unknown = await response.json().catch(() => undefined)
      if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !result.value || typeof result.value !== "object" || !("closure" in result.value) || !result.value.closure || typeof result.value.closure !== "object" || !("id" in result.value.closure) || result.value.closure.id !== closureRef) return { status: "unavailable", reason: "closure-unavailable" }
      return result as PortResult<{ closure: ReviewActionClosure; review: PreservedReview; currentAction: HotTopic }>
    },
  }
}

/** Browser actions keep the selected order and require an explicit human preserve command. */
export function createReviewPreparationBrowser() {
  const post = createReviewPost()
  return {
    async contribution(payload: ReviewContributionRequest): Promise<PortResult<ReviewContribution>> {
      const { response, result } = await post("review-contribution", payload)
      if (!response?.ok || !isResult(result) || result.status !== "ok" || !result.value || typeof result.value !== "object" || !("kind" in result.value) || !["DecisionBrief", "MeetingMaterialProposal"].includes(String(result.value.kind)) || !("links" in result.value) || !Array.isArray(result.value.links) || !("output" in result.value) || !result.value.output || typeof result.value.output !== "object" || !("id" in result.value.output) || result.value.output.id !== payload.outputRef) return unavailable(result, "review-contribution-unavailable")
      const output = decodeSfContributionEnvelope(result.value.output)
      if (!output.ok || output.value.state !== "ready" || output.value.kind !== result.value.kind) return { status: "unavailable", reason: "review-contribution-invalid" }
      if (payload.expectedOutputDigest && output.value.outputDigest !== payload.expectedOutputDigest) return { status: "stale", reason: "review-contribution-changed" }
      return { status: "ok", value: { ...result.value, output: output.value } as ReviewContribution }
    },
    async agenda(items: readonly ReviewAgendaItem[]): Promise<PortResult<ReviewAgendaPreview>> {
      const { response, result } = await post("review-agenda", { items })
      if (!response?.ok || !isResult(result) || result.status !== "ok" || !result.value || typeof result.value !== "object" || !("selectionRef" in result.value) || typeof result.value.selectionRef !== "string" || !("sections" in result.value) || !Array.isArray(result.value.sections) || !("sectionRefs" in result.value) || !Array.isArray(result.value.sectionRefs)) return unavailable(result, "agenda-unavailable")
      return { status: "ok", value: result.value as ReviewAgendaPreview }
    },
    async preview(payload: ReviewPrepareRequest): Promise<PortResult<ReviewDraft>> {
      const { response, result } = await post("review-preview", payload)
      const decoded = isResult(result) && result.status === "ok" && "result" in result ? decodeSfOperationOutput("sf_review_prepare", result.result) : undefined
      if (!response?.ok || !decoded?.ok) return unavailable(result, "review-preview-unavailable")
      return { status: "ok", value: decoded.value }
    },
    async preserve(payload: { selectionRef: string; sectionRefs: readonly string[]; previousReviewRef?: string }): Promise<PortResult<PreservedReview>> {
      const { response, result } = await post("review-preserve", payload)
      if (!response?.ok || !isResult(result) || result.status !== "ok" || !result.value || typeof result.value !== "object" || !("id" in result.value) || typeof result.value.id !== "string" || !("sections" in result.value) || !Array.isArray(result.value.sections) || !("comments" in result.value) || !Array.isArray(result.value.comments)) return unavailable(result, "review-preserve-unavailable")
      return { status: "ok", value: result.value as PreservedReview }
    },
    async report(payload: { reviewRef: string; sectionRefs: readonly string[]; format: "docx" | "pptx" }): Promise<PortResult<MeetingMaterialProposal>> {
      const { response, result } = await post("review-report", payload)
      const decoded = isResult(result) && result.status === "ok" && "result" in result ? decodeSfOperationOutput("sf_report_prepare", result.result) : undefined
      if (!response?.ok || !decoded?.ok || decoded.value.reviewSelectionRef !== payload.reviewRef) return unavailable(result, "report-unavailable")
      return { status: "ok", value: decoded.value }
    },
    downloadUrl(artifactRef: string) {
      if (!/^report:[a-f0-9]{64}$/.test(artifactRef)) return undefined
      const url = reviewUrl("review-download")
      url.searchParams.set("artifactRef", artifactRef)
      return url.toString()
    },
  }
}

function createReviewPost() {
  const intents = new Map<string, string>()
  return async (mode: string, payload: unknown) => {
    const body = JSON.stringify(payload)
    const intent = `${mode}:${body}`
    const key = intents.get(intent) ?? crypto.randomUUID()
    intents.set(intent, key)
    const response = await fetch(reviewUrl(mode), { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body }).catch(() => undefined)
    const result: unknown = await response?.json().catch(() => undefined)
    return { response, result }
  }
}

function reviewUrl(mode: string) {
  const url = new URL(window.location.href)
  url.search = ""
  url.hash = ""
  url.searchParams.set("sf", mode)
  return url
}

function isResult(value: unknown): value is { status: string; value?: unknown; result?: unknown; reason?: unknown } {
  return !!value && typeof value === "object" && "status" in value && typeof value.status === "string"
}

function unavailable(value: unknown, fallback: string): Exclude<PortResult<never>, { status: "ok" }> {
  if (isResult(value) && typeof value.reason === "string") {
    if (value.status === "denied" || value.status === "needs-input" || value.status === "stale" || value.status === "conflict" || value.status === "unavailable") return { status: value.status, reason: value.reason }
  }
  return { status: "unavailable", reason: fallback }
}
