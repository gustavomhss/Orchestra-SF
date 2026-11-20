import { types } from "node:util"
import { createHash } from "node:crypto"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { isReviewSensitivityBound } from "./sensitivity.ts"
import { validateReviewWaterfall } from "./waterfall.ts"
import { validReviewOutcome, validOutcomeComparison } from "./outcome.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import { validReviewDecision, reviewDecisionEvidence, reviewDecisionSources } from "./decision.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { readCommentRefs, validCommentRefs } from "./comment-selection.ts"
import type { ReviewCommentRef } from "./comment-selection.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period, PreservedReview, SourceRef } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type ReviewWaterfall =
  | { status: "ok"; finalValueId: string; final: number | null; reconciliation: "reconciled" | "unreconciled" | "unavailable"; segments: readonly { label: string; startValueId: string; endValueId: string; componentValueId: string; start: number | null; end: number | null; amount: number | null; source: DomainProjection["values"][number] }[] }
  | { status: "unavailable"; reason: string }
export type ReviewChart =
  | { status: "ok"; viewId: string; series: readonly { id: string; label: string; unit: string; role: string; valueIds: readonly string[]; alignmentKeys?: readonly string[]; values: DomainProjection["values"] }[]; limitations: readonly string[]; unassigned: DomainProjection["values"]; sensitivity?: { result: SensitivityResult; parameterUnit: string; resultUnit: string }; waterfall?: ReviewWaterfall; timeline?: { status: "ok"; items: readonly { label: string; dateValueId: string; state: "planned" | "completed" | "unknown"; date: string | null; source: DomainProjection["values"][number] }[] } | { status: "unavailable"; reason: string } }
  | { status: "unavailable"; reason: string }
export type ReviewSection = { id: string; title: string; period: Period; recordCount: number; projection: DomainProjection; agendaNote?: string; outcome?: ObservedResultProjection; outcomeComparison?: ReviewOutcomeComparison; chart?: ReviewChart; comments?: readonly { id: string; version: number; content: string; authorRef: string; createdAt: string; sourceRefs: readonly SourceRef[] }[] }
export type HistoricalSelectionProof = {
  kind: "server-issued-result"
  selectionRef: string
  resultDigest: string
  stamps: readonly { sectionId: string; role: "projection" | "comparison"; principalRef: string; installationId: string; projectId: string; accessRevision: string; policyVersion: string }[]
}
export type ReviewHost = {
  state: SfProductStatePort
  creationTarget: { ref: string; incarnation: string }
  now: () => string
  requestFor: (binding: TrustedDomainContext) => Request | undefined
  authorizeSections: (binding: TrustedDomainContext, sections: readonly { id: string; sourceRefs: readonly SourceRef[] }[]) => Promise<boolean>
  authorizeComments: (binding: TrustedDomainContext, comments: PreservedReview["comments"]) => Promise<boolean>
  authorizeOutcomeComparison: (binding: TrustedDomainContext, outcomes: readonly ReviewOutcomeComparison[]) => Promise<boolean>
  authorizeOutcome: (binding: TrustedDomainContext, outcomes: readonly ObservedResultProjection[]) => Promise<boolean>
  authorizeDecision: (binding: TrustedDomainContext, decisions: readonly NonNullable<DomainProjection["decision"]>[]) => Promise<boolean>
  authorizeSensitivity: (binding: TrustedDomainContext, results: readonly SensitivityResult[]) => Promise<boolean>
  revalidate: (binding: TrustedDomainContext, refs: readonly SourceRef[]) => Promise<boolean>
  revalidateEvidence: (binding: TrustedDomainContext, refs: readonly BusinessEvidenceRef[]) => Promise<boolean>
  /** Read-only classification keeps unavailable evidence distinct from refusal. */
  revalidateReadEvidence?: (binding: TrustedDomainContext, refs: readonly BusinessEvidenceRef[]) => Promise<boolean>
  revalidateReadAccess?: (binding: TrustedDomainContext) => Promise<boolean>
  select: (selectionRef: string, sectionRefs: readonly string[], binding: TrustedDomainContext, period?: Period) => Promise<PortResult<readonly ReviewSection[]>>
  /** Only a re-read immutable server-issued result may retain historical authority stamps. */
  isHistoricalSelection?: (selectionRef: string, binding: TrustedDomainContext) => Promise<HistoricalSelectionProof | false> | false
}

type ReviewReadValidation = Readonly<{
  current: () => boolean
  validate: (id: string, value: PreservedReview, binding: TrustedDomainContext, unchanged: () => boolean) => Promise<PortResult<PreservedReview>>
}>
const reviewReadValidations = new WeakMap<object, { read: unknown; validation: ReviewReadValidation }>()

/** Only the exact factory port can lend its own body validation to a protected
 * C08 reader. The consumer must supply an isolated body from that actual read;
 * this function does not find a body, authenticate a receipt or retain authority. */
export function sfReviewReadValidation(port: object): ReviewReadValidation | undefined {
  const registered = reviewReadValidations.get(port)
  const descriptor = registered ? Object.getOwnPropertyDescriptor(port, "read") : undefined
  return descriptor && "value" in descriptor && descriptor.value === registered?.read ? registered.validation : undefined
}

export function createReviewPort(host: ReviewHost, readDependenciesCurrent?: () => boolean) {
  const validateBody = async (id: string, value: PreservedReview, binding: TrustedDomainContext, current: () => Promise<boolean>, unchanged: () => boolean): Promise<PortResult<PreservedReview>> => {
    if (!unchanged()) return { status: "denied", reason: "binding-unavailable" } as const
    if (value.id !== id) return { status: "denied", reason: "review-target-changed" } as const
    if (!Array.isArray(value.sections) || !Array.isArray(value.comments)) return { status: "unavailable", reason: "invalid-review-sources" } as const
    if (!validReviewSources(value)) return { status: "unavailable", reason: "invalid-review-sources" } as const
    const projections = value.sections.map((section) => section.content as DomainProjection)
    // Classify source uncertainty before legacy boolean selection gates can
    // collapse a temporarily unavailable source into a negative decision.
    if (host.revalidateReadEvidence && (!await host.revalidateReadEvidence(binding, projections.flatMap((projection) => reviewProjectionEvidence(projection))) || !unchanged())) return { status: "denied", reason: "access-unavailable" } as const
    if (!(await host.authorizeSections(binding, value.sections)) || !unchanged() || !(await host.authorizeComments(binding, value.comments)) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    const comparisons = value.sections.flatMap((section) => {
      const comparison = (section.content as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison
      return comparison ? [comparison] : []
    })
    if (!(await host.authorizeOutcomeComparison(binding, comparisons)) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    const outcomes = value.sections.flatMap((section) => {
      const outcome = (section.content as DomainProjection & { reviewOutcome?: ObservedResultProjection }).reviewOutcome
      return outcome ? [outcome] : []
    })
    if (!(await host.authorizeOutcome(binding, outcomes)) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    const decisions = value.sections.flatMap((section) => (section.content as DomainProjection).decision ? [(section.content as DomainProjection).decision!] : [])
    if (!(await host.authorizeDecision(binding, decisions)) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    const charts = value.sections.map((section) => (section.content as DomainProjection & { reviewChart?: ReviewChart }).reviewChart)
    if (!(await host.authorizeSensitivity(binding, charts.flatMap((chart) => chart?.status === "ok" && chart.sensitivity ? [chart.sensitivity.result] : []))) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    // Root and projection may contain the same exact source. Deduplicate only
    // the complete body in this pass; distinct versions/scopes remain checked.
    const sources = [...new Map([...value.sourceRefs, ...projections.flatMap(reviewProjectionSources)].map((ref) => [digestSfValue(ref), ref] as const)).values()]
    if (!(await host.revalidate(binding, sources)) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    if (projections.some((projection) => !projection || !Array.isArray(projection.values) || projection.values.some((value: DomainProjection["values"][number]) => !Array.isArray(value.sourceRefs) || (value.value !== null && typeof value.value !== "string" && typeof value.value !== "boolean" && (typeof value.value !== "number" || !Number.isFinite(value.value))) || (value.value !== null && value.sourceRefs.length === 0)))) return { status: "unavailable", reason: "evidence-unavailable" } as const
    if (!(await (host.revalidateReadEvidence ?? host.revalidateEvidence)(binding, projections.flatMap((projection) => reviewProjectionEvidence(projection)))) || !unchanged()) return { status: "denied", reason: "access-unavailable" } as const
    if (!await current() || !unchanged()) return { status: "denied", reason: "binding-unavailable" } as const
    return { status: "ok", value } as const
  }
  const reviews = {
    async preview(selectionRef: string, incomingRefs: readonly string[], binding: TrustedDomainContext, period?: Period): Promise<PortResult<readonly ReviewSection[]>> {
      if (typeof selectionRef !== "string" || !selectionRef.trim() || !Array.isArray(incomingRefs) || !incomingRefs.length || incomingRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || new Set(incomingRefs).size !== incomingRefs.length || (period !== undefined && !isSfPeriod(period))) return { status: "needs-input", reason: "invalid-selection" } as const
      const sectionRefs = [...incomingRefs]
      const resolved = await host.select(selectionRef, sectionRefs, binding, period ? { ...period } : undefined)
      if (resolved.status !== "ok") return resolved
      if (!Array.isArray(resolved.value) || resolved.value.some((section) => !validSectionProjection(section))) return { status: "unavailable", reason: "invalid-section-projection" } as const
      const selected: { status: "ok"; value: readonly ReviewSection[] } = { status: "ok", value: structuredClone(resolved.value) }
      if (selected.value.some((section) => !validReviewCommentRefs(section.projection, section.comments ?? []))) return { status: "unavailable", reason: "invalid-comment-association" } as const
      if (selected.value.some((section) => !validOutcomeComparison(section.outcomeComparison) || (section.outcomeComparison && (!section.outcome || digestSfValue(section.outcomeComparison.observation) !== digestSfValue(section.outcome))))) return { status: "unavailable", reason: "invalid-outcome-comparison" } as const
      if (!(await host.authorizeOutcomeComparison(binding, selected.value.flatMap((section) => section.outcomeComparison ? [section.outcomeComparison] : [])))) return { status: "denied", reason: "access-unavailable" } as const
      if (selected.value.some((section) => !validReviewOutcome(section.outcome))) return { status: "unavailable", reason: "invalid-outcome-snapshot" } as const
      if (!(await host.authorizeOutcome(binding, selected.value.flatMap((section) => section.outcome ? [section.outcome] : [])))) return { status: "denied", reason: "access-unavailable" } as const
      if (selected.value.some((section) => !validReviewDecision(section.projection.decision))) return { status: "unavailable", reason: "invalid-decision-snapshot" } as const
      if (!(await host.authorizeDecision(binding, selected.value.flatMap((section) => section.projection.decision ? [section.projection.decision] : [])))) return { status: "denied", reason: "access-unavailable" } as const
      if (!(await host.authorizeSections(binding, selected.value.map((section) => ({ id: section.id, sourceRefs: section.projection.context.sourceRefs })))) || !(await host.authorizeComments(binding, selected.value.flatMap((section) => section.comments ?? []))) || !(await host.authorizeSensitivity(binding, selected.value.flatMap((section) => section.chart?.status === "ok" && section.chart.sensitivity ? [section.chart.sensitivity.result] : [])))) return { status: "denied", reason: "access-unavailable" } as const
      if (selected.value.length !== sectionRefs.length || selected.value.some((section, index) => section.id !== sectionRefs[index]))
        return { status: "unavailable", reason: "selection-incomplete" } as const
      if (selected.value.some((section) => section.agendaNote !== undefined && (typeof section.agendaNote !== "string" || section.agendaNote.length > 2000))) return { status: "needs-input", reason: "invalid-agenda-note" } as const
      if (selected.value.some((section) => !Number.isSafeInteger(section.recordCount) || section.recordCount < 0)) return { status: "unavailable", reason: "invalid-record-count" } as const
      if (selected.value.some((section) => (section.comments ?? []).some((comment) => !validComment(comment)))) return { status: "unavailable", reason: "invalid-comment-snapshot" } as const
      const comments = selected.value.flatMap((section) => section.comments ?? [])
      const versions = new Map<string, string>()
      if (comments.some((comment) => {
        const key = JSON.stringify([comment.id, comment.version])
        const digest = digestSfValue(comment)
        const previous = versions.get(key)
        versions.set(key, digest)
        return previous !== undefined && previous !== digest
      })) return { status: "unavailable", reason: "conflicting-comment-snapshot" } as const
      if (selected.value.some((section) => !validChart(section.projection, section.chart))) return { status: "unavailable", reason: "chart-projection-mismatch" } as const
      const drifted = selected.value.some((section) => sectionAuthorityContexts(section).some((item) => item.context.accessRevision !== binding.binding.accessRevision || item.context.policyVersion !== binding.binding.policyVersion))
      const historical = drifted ? await historicalAuthorityProof(host, selectionRef, binding) : undefined
      if (selected.value.some((section) => sectionAuthorityContexts(section).some((item) => item.context.principalRef !== binding.binding.principalRef || item.context.installationId !== binding.binding.installationId || item.context.projectId !== binding.binding.projectId || ((item.context.accessRevision !== binding.binding.accessRevision || item.context.policyVersion !== binding.binding.policyVersion) && !retainsIssuedStamp(historical, section.id, item.role, item.context)))))
        return { status: "denied", reason: "context-mismatch" } as const
      if (selected.value.some((section) => section.projection.values.some((value) => (value.value !== null && typeof value.value !== "string" && typeof value.value !== "boolean" && (typeof value.value !== "number" || !Number.isFinite(value.value))) || (value.value !== null && value.sourceRefs.length === 0)))) return { status: "unavailable", reason: "evidence-unavailable" } as const
      if (!(await host.revalidateEvidence(binding, selected.value.flatMap((section) => reviewProjectionEvidence(section.projection, section))))) return { status: "denied", reason: "access-unavailable" } as const
      if (!(await host.revalidate(binding, selected.value.flatMap((section) => [...reviewProjectionSources(section.projection), ...(section.comments ?? []).flatMap((comment) => comment.sourceRefs)]))))
        return { status: "denied", reason: "access-unavailable" } as const
      return { status: "ok", value: structuredClone(selected.value) } as const
    },
    async preserve(incoming: { id: string; selectionRef: string; sectionRefs: readonly string[]; previousReviewRef?: string; expectedStorageVersion: number; idempotencyKey: string; targetIncarnation: string }, binding: TrustedDomainContext): Promise<PortResult<PreservedReview>> {
      const request = host.requestFor(binding)
      if (!request) return { status: "denied", reason: "binding-unavailable" } as const
      if (!incoming || typeof incoming !== "object" || typeof incoming.id !== "string" || !incoming.id.trim()) return { status: "needs-input", reason: "invalid-review-identity" } as const
      if (typeof incoming.selectionRef !== "string" || !incoming.selectionRef.trim() || !Array.isArray(incoming.sectionRefs) || !incoming.sectionRefs.length || incoming.sectionRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || new Set(incoming.sectionRefs).size !== incoming.sectionRefs.length || !Number.isSafeInteger(incoming.expectedStorageVersion) || incoming.expectedStorageVersion < 0 || typeof incoming.idempotencyKey !== "string" || !incoming.idempotencyKey.trim() || (incoming.previousReviewRef !== undefined && (typeof incoming.previousReviewRef !== "string" || !incoming.previousReviewRef.trim() || incoming.previousReviewRef === incoming.id))) return { status: "needs-input", reason: "invalid-review-request" } as const
      const input = structuredClone(incoming)
      if (!host.creationTarget.ref || !host.creationTarget.incarnation || input.targetIncarnation !== host.creationTarget.incarnation) return { status: "denied", reason: "creation-target-unavailable" } as const
      const command = {
        namespace: "reviews" as const, expectedStorageVersion: input.expectedStorageVersion, idempotencyKey: input.idempotencyKey,
        commandDigest: createHash("sha256").update(JSON.stringify({ id: input.id, selectionRef: input.selectionRef, sectionRefs: input.sectionRefs, previousReviewRef: input.previousReviewRef, targetIncarnation: input.targetIncarnation, principalRef: binding.binding.principalRef })).digest("hex"), targetRef: host.creationTarget.ref, targetIncarnation: input.targetIncarnation,
      }
      // Probe the durable idempotency record before consulting mutable source data.
      const prior = await host.state.transaction<unknown>(request, command, async () => ({ commit: false, value: null }))
      if ("reason" in prior) return prior
      if (prior.status === "ok") return reopenReviewReceipt(prior.value, input.id, (id) => this.read(id, binding))
      if (input.previousReviewRef) {
        const previous = await this.read(input.previousReviewRef, binding)
        if (previous.status !== "ok") return previous
      }
      const selected = await this.preview(input.selectionRef, input.sectionRefs, binding)
      if (selected.status !== "ok") return selected
      const refs = selected.value.flatMap((section) => [...reviewProjectionSources(section.projection), ...(section.comments ?? []).flatMap((comment) => comment.sourceRefs)])
      if (!(await host.authorizeOutcomeComparison(binding, selected.value.flatMap((section) => section.outcomeComparison ? [section.outcomeComparison] : []))) || !(await host.authorizeOutcome(binding, selected.value.flatMap((section) => section.outcome ? [section.outcome] : []))) || !(await host.authorizeDecision(binding, selected.value.flatMap((section) => section.projection.decision ? [section.projection.decision] : []))) || !(await host.authorizeSections(binding, selected.value.map((section) => ({ id: section.id, sourceRefs: section.projection.context.sourceRefs })))) || !(await host.authorizeComments(binding, selected.value.flatMap((section) => section.comments ?? []))) || !(await host.authorizeSensitivity(binding, selected.value.flatMap((section) => section.chart?.status === "ok" && section.chart.sensitivity ? [section.chart.sensitivity.result] : []))) || !(await host.revalidate(binding, refs)) || !(await host.revalidateEvidence(binding, selected.value.flatMap((section) => reviewProjectionEvidence(section.projection, section))))) return { status: "denied", reason: "access-unavailable" } as const
      const createdAt = host.now()
      if (!Number.isFinite(Date.parse(createdAt))) return { status: "unavailable", reason: "invalid-host-time" } as const
      const review: PreservedReview = {
        id: input.id, version: 1, createdAt, sourceRefs: refs,
        sections: selected.value.map((section) => ({ id: section.id, title: section.title, period: section.period, content: { ...section.projection, ...(section.chart ? { reviewChart: section.chart } : {}), ...(section.agendaNote !== undefined ? { reviewAgendaNote: section.agendaNote } : {}), ...(section.outcome ? { reviewOutcome: section.outcome } : {}), ...(section.outcomeComparison ? { reviewOutcomeComparison: section.outcomeComparison } : {}), ...(section.comments ? { reviewCommentRefs: [...new Map(section.comments.map((comment) => [JSON.stringify([comment.id, comment.version]), { id: comment.id, version: comment.version, digest: digestSfValue(comment) }] as const)).values()] } : {}) }, count: section.recordCount, sourceRefs: section.projection.context.sourceRefs })),
        comments: [...new Map(selected.value.flatMap((section) => section.comments ?? []).map((comment) => [JSON.stringify([comment.id, comment.version]), comment] as const)).values()], ...(input.previousReviewRef ? { previousReviewRef: input.previousReviewRef } : {}),
      }
      const result = await host.state.transaction<unknown>(request, command, async (state) => {
        if (state.reviews[input.id]) return { commit: false, value: null }
        state.reviews[input.id] = structuredClone(review)
        // The immutable body lives once in reviews. C08 persists this result as
        // its idempotency value, so store only its exact identity and full digest.
        return { commit: true, value: { schema: "sf-review-receipt-v1", reviewRef: input.id, reviewDigest: digestSfValue(state.reviews[input.id]) } }
      })
      if ("reason" in result) return result
      if (result.status !== "ok") return { status: "unavailable", reason: "not-committed" }
      if (!result.value) return { status: "conflict", reason: "review-exists" } as const
      // Another identical call may have committed between the probe and this
      // transaction. Reopen the receipt C08 actually returned, not our candidate.
      return reopenReviewReceipt(result.value, input.id, (id) => this.read(id, binding))
    },
    async read(id: string, binding: TrustedDomainContext): Promise<PortResult<PreservedReview>> {
      const request = host.requestFor(binding)
      const current = async () => !!request && host.requestFor(binding) === request && await (host.revalidateReadAccess ? host.revalidateReadAccess(binding) : host.revalidate(binding, [])) && host.requestFor(binding) === request
      try {
        if (!request || !await current()) return { status: "denied", reason: "binding-unavailable" } as const
        const result = await host.state.read(request, "reviews", (state) => state.reviews[id] ? structuredClone(state.reviews[id]) : null)
        if (!await current()) return { status: "denied", reason: "binding-unavailable" } as const
        if ("reason" in result) return result
        if (result.status !== "ok") return { status: "unavailable", reason: "not-committed" }
        if (!result.value) return { status: "denied", reason: "review-target-changed" } as const
        return await validateBody(id, result.value, binding, current, () => true)
      } catch {
        const authorized = await current().catch(() => undefined)
        if (authorized === false) return { status: "denied", reason: "binding-unavailable" }
        return { status: "unavailable", reason: "review-read-unavailable" }
      }
    },
  }
  // Opaque/accessor hosts retain their complete original read. Inspect only
  // own data descriptors; do not invoke a getter while recognizing a factory.
  if (types.isProxy(host) || Object.getPrototypeOf(host) !== Object.prototype) return reviews
  const names = ["state", "requestFor", "revalidateReadAccess", "revalidate", "revalidateReadEvidence", "revalidateEvidence",
    "authorizeSections", "authorizeComments", "authorizeOutcomeComparison", "authorizeOutcome", "authorizeDecision", "authorizeSensitivity"] as const
  const methods = names.map((name) => [name, Object.getOwnPropertyDescriptor(host, name)] as const)
  if (methods.some(([, descriptor]) => descriptor && !("value" in descriptor))) return reviews
  const state = host.state
  if (types.isProxy(state) || Object.getPrototypeOf(state) !== Object.prototype) return reviews
  const readState = Object.getOwnPropertyDescriptor(state, "read")
  if (!readState || !("value" in readState)) return reviews
  // Identity is only an admission/egress fence. Every dependency callback above
  // still runs on every validation, including callbacks with mutable closures.
  const currentDependencies = () => methods.every(([name, prior]) => {
    const current = Object.getOwnPropertyDescriptor(host, name)
    return prior ? !!current && "value" in current && current.value === prior.value : current === undefined
  }) && Object.getOwnPropertyDescriptor(state, "read")?.value === readState.value && (!readDependenciesCurrent || readDependenciesCurrent())
  const validation: ReviewReadValidation = Object.freeze({
    current: currentDependencies,
    validate: async (id, value, binding, unchanged) => {
      const request = host.requestFor(binding)
      const current = async () => currentDependencies() && unchanged() && !!request && host.requestFor(binding) === request &&
        await (host.revalidateReadAccess ? host.revalidateReadAccess(binding) : host.revalidate(binding, [])) &&
        currentDependencies() && unchanged() && host.requestFor(binding) === request
      try {
        if (!request || !await current()) return { status: "denied", reason: "binding-unavailable" }
        return await validateBody(id, value, binding, current, () => currentDependencies() && unchanged())
      } catch {
        const authorized = await current().catch(() => undefined)
        if (authorized === false) return { status: "denied", reason: "binding-unavailable" }
        return { status: "unavailable", reason: "review-read-unavailable" }
      }
    },
  })
  reviewReadValidations.set(reviews, { read: reviews.read, validation })
  return reviews
}

async function reopenReviewReceipt(value: unknown, expectedId: string, read: (id: string) => Promise<PortResult<PreservedReview>>): Promise<PortResult<PreservedReview>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unavailable", reason: "receipt-unavailable" }
  const receipt = "schema" in value
    ? value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 && "reviewRef" in value && typeof value.reviewRef === "string" && !!value.reviewRef.trim() && "reviewDigest" in value && typeof value.reviewDigest === "string" && /^[a-f0-9]{64}$/.test(value.reviewDigest)
      ? { reviewRef: value.reviewRef, reviewDigest: value.reviewDigest }
      : undefined
    // Legacy C08 receipts contain the whole review. They remain readable; no
    // migration or rewrite is needed, and their body is never returned directly.
    : "id" in value && typeof value.id === "string" && !!value.id.trim() && "version" in value && Number.isSafeInteger(value.version) && Number(value.version) > 0 && "createdAt" in value && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && "sourceRefs" in value && Array.isArray(value.sourceRefs) && "sections" in value && Array.isArray(value.sections) && "comments" in value && Array.isArray(value.comments)
      ? { reviewRef: value.id, reviewDigest: digestSfValue(value) }
      : undefined
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable" }
  if (receipt.reviewRef !== expectedId) return { status: "conflict", reason: "preserved-review-changed" }
  const result = await read(expectedId)
  if (result.status !== "ok") return result
  if (digestSfValue(result.value) !== receipt.reviewDigest) return { status: "conflict", reason: "preserved-review-changed" }
  return result
}

async function historicalAuthorityProof(host: ReviewHost, selectionRef: string, binding: TrustedDomainContext) {
  if (!host.isHistoricalSelection) return undefined
  try {
    const proof = await host.isHistoricalSelection(selectionRef, binding)
    if (!proof || typeof proof !== "object" || proof.kind !== "server-issued-result" || proof.selectionRef !== selectionRef || !/^[a-f0-9]{64}$/.test(proof.resultDigest) || !Array.isArray(proof.stamps)) return undefined
    return proof
  } catch {
    return undefined
  }
}

function sectionAuthorityContexts(section: ReviewSection) {
  return [{ role: "projection" as const, context: section.projection.context }, ...(section.projection.comparison ? [{ role: "comparison" as const, context: section.projection.comparison.context }] : [])]
}

function retainsIssuedStamp(proof: HistoricalSelectionProof | undefined, sectionId: string, role: "projection" | "comparison", context: DomainProjection["context"]) {
  return !!proof && proof.stamps.some((stamp) => !!stamp && stamp.sectionId === sectionId && stamp.role === role && stamp.principalRef === context.principalRef && stamp.installationId === context.installationId && stamp.projectId === context.projectId && stamp.accessRevision === context.accessRevision && stamp.policyVersion === context.policyVersion)
}

type ReviewProjection = DomainProjection & { reviewChart?: ReviewChart; reviewAgendaNote?: string; reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison; reviewCommentRefs?: readonly ReviewCommentRef[] }

function validReviewSources(review: PreservedReview) {
  if (!onlyKeys(review, ["id", "version", "createdAt", "sourceRefs", "sections", "comments", "previousReviewRef"]) || typeof review.id !== "string" || !review.id.trim() || !Number.isSafeInteger(review.version) || review.version < 1 || typeof review.createdAt !== "string" || !Number.isFinite(Date.parse(review.createdAt)) || !Array.isArray(review.sourceRefs) || !review.sourceRefs.every(validSourceRef) || (review.previousReviewRef !== undefined && (typeof review.previousReviewRef !== "string" || !review.previousReviewRef.trim())) || !Array.isArray(review.sections) || !review.sections.length || !Array.isArray(review.comments)) return false
  if (new Set(review.sections.map((section) => section?.id)).size !== review.sections.length) return false
  const allowed = new Set(review.sourceRefs.map((ref) => digestSfValue(ref)))
  if (new Set(review.comments.map((comment) => JSON.stringify([comment?.id, comment?.version]))).size !== review.comments.length) return false
  return review.sections.every((section) => {
    if (!onlyKeys(section, ["id", "title", "period", "content", "count", "sourceRefs"]) || !Number.isSafeInteger(section.count) || section.count < 0 || !Array.isArray(section.sourceRefs)) return false
    const projection = section.content as ReviewProjection
    return validSectionProjection({ id: section.id, title: section.title, period: section.period, recordCount: section.count, projection }) &&
      validReviewCommentRefs(projection, review.comments) && digestSfValue(section.sourceRefs) === digestSfValue(projection.context.sourceRefs) && section.sourceRefs.every((ref: SourceRef) => allowed.has(digestSfValue(ref)))
  }) && review.comments.every((comment) => validComment(comment) && comment.sourceRefs.every((ref: SourceRef) => allowed.has(digestSfValue(ref))))
}

export function validSectionProjection(section: ReviewSection) {
  if (!onlyKeys(section, ["id", "title", "period", "recordCount", "projection", "agendaNote", "outcome", "outcomeComparison", "chart", "comments"]) || typeof section.id !== "string" || !section.id.trim() || typeof section.title !== "string" || !isSfPeriod(section.period)) return false
  const projection = section.projection as ReviewProjection
  if (!onlyKeys(projection, ["context", "version", "engineVersion", "decision", "comparison", "components", "values", "missing", "reviewChart", "reviewAgendaNote", "reviewOutcome", "reviewOutcomeComparison", "reviewCommentRefs"])) return false
  // Only these review-owned extensions sit outside the canonical domain schema.
  // The decoder validates comparison, decision, cells and their nested references.
  const { reviewChart, reviewAgendaNote, reviewOutcome, reviewOutcomeComparison, reviewCommentRefs: _commentRefs, ...core } = projection
  if (!decodeSfOperationOutput("sf_dashboard_read", core).ok || !isSfPeriod(projection.context.period) || digestSfValue(section.period) !== digestSfValue(projection.context.period) || !validReviewDecision(projection.decision)) return false
  return validChart(projection, reviewChart) && (reviewAgendaNote === undefined || typeof reviewAgendaNote === "string" && reviewAgendaNote.length <= 2000) &&
    validReviewOutcome(reviewOutcome) && validOutcomeComparison(reviewOutcomeComparison) &&
    (!reviewOutcomeComparison || digestSfValue(reviewOutcomeComparison.observation) === digestSfValue(reviewOutcome)) &&
    readCommentRefs(projection) !== false && (section.comments === undefined || Array.isArray(section.comments) && validReviewCommentRefs(projection, section.comments))
}

function validComment(comment: PreservedReview["comments"][number]) {
  return onlyKeys(comment, ["id", "version", "content", "authorRef", "createdAt", "sourceRefs"]) && typeof comment.id === "string" && !!comment.id && Number.isSafeInteger(comment.version) && comment.version > 0 && typeof comment.content === "string" && typeof comment.authorRef === "string" && !!comment.authorRef && typeof comment.createdAt === "string" && Number.isFinite(Date.parse(comment.createdAt)) && Array.isArray(comment.sourceRefs) && comment.sourceRefs.length > 0 && comment.sourceRefs.every(validSourceRef)
}

function validSourceRef(ref: SourceRef) {
  return onlyKeys(ref, ["surface", "type", "id", "incarnation", "version", "fields", "period", "observedAt"]) && ["dashboard", "planner", "procurement"].includes(ref.surface) && [ref.type, ref.id, ref.incarnation, ref.observedAt].every((value) => typeof value === "string" && !!value.trim()) && Number.isSafeInteger(ref.version) && ref.version >= 0 && Array.isArray(ref.fields) && ref.fields.every((field) => typeof field === "string") && isSfPeriod(ref.period) && Number.isFinite(Date.parse(ref.observedAt))
}

function onlyKeys(value: unknown, allowed: readonly string[]) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key))
}

export function validChart(projection: DomainProjection, chart: ReviewChart | undefined) {
  if (chart === undefined) return true
  if (!chart || typeof chart !== "object" || Array.isArray(chart)) return false
  if (chart.status === "unavailable") return onlyKeys(chart, ["status", "reason"]) && typeof chart.reason === "string" && !!chart.reason
  if (!onlyKeys(chart, ["status", "viewId", "series", "limitations", "unassigned", "sensitivity", "waterfall", "timeline"])) return false
  if (chart.status !== "ok" || typeof chart.viewId !== "string" || !chart.viewId || !Array.isArray(chart.series) || !Array.isArray(chart.limitations) || !Array.isArray(chart.unassigned) || !Array.isArray(projection.values)) return false
  type Series = Extract<ReviewChart, { status: "ok" }>["series"][number]
  type Value = DomainProjection["values"][number]
  type TimelineItem = Extract<NonNullable<Extract<ReviewChart, { status: "ok" }>["timeline"]>, { status: "ok" }>["items"][number]
  if (chart.limitations.some((limitation: string) => typeof limitation !== "string") || chart.series.some((series: Series) => !onlyKeys(series, ["id", "label", "unit", "role", "valueIds", "alignmentKeys", "values"]) || typeof series.id !== "string" || !series.id || typeof series.label !== "string" || !series.label || typeof series.unit !== "string" || !series.unit || typeof series.role !== "string" || !series.role || !Array.isArray(series.values) || !Array.isArray(series.valueIds) || (series.alignmentKeys !== undefined && (!Array.isArray(series.alignmentKeys) || series.alignmentKeys.length !== series.valueIds.length || series.alignmentKeys.some((key: string) => typeof key !== "string" || !key) || new Set(series.alignmentKeys).size !== series.alignmentKeys.length))) || chart.unassigned.some((value: Value) => !value || typeof value.id !== "string")) return false
  if (chart.sensitivity !== undefined && (!onlyKeys(chart.sensitivity, ["result", "parameterUnit", "resultUnit"]) || !isReviewSensitivityBound(projection, chart) || typeof chart.sensitivity.parameterUnit !== "string" || typeof chart.sensitivity.resultUnit !== "string" || !decodeSfOperationOutput("sf_sensitivity_evaluate", chart.sensitivity.result).ok)) return false
  if (chart.waterfall !== undefined && (!chart.waterfall || typeof chart.waterfall !== "object" || !onlyKeys(chart.waterfall, chart.waterfall.status === "ok" ? ["status", "finalValueId", "final", "reconciliation", "segments"] : ["status", "reason"]) || chart.waterfall.status === "ok" && (!Array.isArray(chart.waterfall.segments) || chart.waterfall.segments.some((segment) => !onlyKeys(segment, ["label", "startValueId", "endValueId", "componentValueId", "start", "end", "amount", "source"]))))) return false
  if (!validateReviewWaterfall(projection, chart.waterfall)) return false
  // Validate captured bodies against one per-pass index. Rehashing every candidate
  // for every chart cell made authorized reads quadratic in the captured data.
  // The full canonical body remains the identity; no digest survives this call.
  const projectionValueDigests = new Set(projection.values.map((value) => digestSfValue(value)))
  if (chart.timeline !== undefined && (!chart.timeline || typeof chart.timeline !== "object" || !onlyKeys(chart.timeline, chart.timeline.status === "ok" ? ["status", "items"] : ["status", "reason"]) || chart.timeline.status !== "ok" && chart.timeline.status !== "unavailable")) return false
  if (chart.timeline?.status === "unavailable" && (typeof chart.timeline.reason !== "string" || !chart.timeline.reason.trim())) return false
  if (chart.timeline?.status === "ok" && (!Array.isArray(chart.timeline.items) || chart.timeline.items.some((item: TimelineItem) => !onlyKeys(item, ["label", "dateValueId", "state", "date", "source"]) || !item.source || typeof item.label !== "string" || item.dateValueId !== item.source.id || !["planned", "completed", "unknown"].includes(item.state) || !projectionValueDigests.has(digestSfValue(item.source)) || (item.date !== null && (item.source.evidenceState === "absent" || typeof item.source.value !== "string" || item.date !== item.source.value || !isSfPeriod({ start: item.date, end: item.date }))) || (item.state === "completed" && (item.date === null || item.source.evidenceState !== "confirmed"))))) return false
  const values = [...chart.series.flatMap((series: Series) => series.values), ...chart.unassigned]
  const ids = [...chart.series.flatMap((series: Series) => series.valueIds), ...chart.unassigned.map((value: Value) => value.id)]
  return values.length === projection.values.length && new Set(ids).size === values.length &&
    chart.series.every((series: Series) => series.valueIds.length === series.values.length && series.valueIds.every((id: string, index: number) => id === series.values[index]?.id)) &&
    values.every((value: Value) => projectionValueDigests.has(digestSfValue(value)))
}

export function reviewChartEvidence(chart: ReviewChart | undefined): readonly BusinessEvidenceRef[] {
  if (!chart || chart.status !== "ok" || !chart.sensitivity) return []
  const result = chart.sensitivity.result
  return [...result.evidenceRefs, ...result.unresolvedConditions.flatMap((condition) => condition.evidenceRefs), ...(result.thresholdEvidence.state === "unavailable" ? [] : result.thresholdEvidence.evidenceRefs)]
}


/** All typed source identities in the preserved projection, including comparison and decision components. */
export function reviewProjectionSources(projection: DomainProjection): readonly SourceRef[] {
  return [...projection.context.sourceRefs, ...projection.components.flatMap((component) => component.sourceRefs),
    ...(projection.comparison?.context.sourceRefs ?? []), ...reviewDecisionSources(projection.decision)]
}

/** Every evidence-bearing cell and sidecar uses the same current C17 gates, including drilldowns. */
export function reviewProjectionEvidence(projection: DomainProjection, extras?: Pick<ReviewSection, "chart" | "outcome" | "outcomeComparison">): readonly BusinessEvidenceRef[] {
  const preserved = projection as ReviewProjection
  const values = [...projection.values, ...(projection.comparison?.values ?? [])]
  const refs = [...values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])]),
    ...reviewDecisionEvidence(projection.decision),
    ...[preserved.reviewChart, extras?.chart].flatMap(reviewChartEvidence),
    ...[preserved.reviewOutcome, extras?.outcome].flatMap((outcome) => outcome?.sourceRefs ?? []),
    ...[preserved.reviewOutcomeComparison, extras?.outcomeComparison].flatMap((comparison) => comparison ? [...comparison.baselineRefs, ...comparison.sourceRefs, ...comparison.observation.sourceRefs] : [])]
  const result: BusinessEvidenceRef[] = []
  const seen = new WeakSet<object>()
  while (refs.length) {
    const ref = refs.pop()!
    if (seen.has(ref)) continue
    seen.add(ref)
    result.push(ref)
    if (ref.kind === "calculation") refs.push(...ref.target.sourceRefs)
    if (ref.kind === "case-event") refs.push(...ref.target.evidenceRefs)
  }
  return result
}


/** Validates immutable membership only; callers still recheck C06/C17 access. */
export function validReviewCommentRefs(projection: unknown, comments: PreservedReview["comments"]) {
  return validCommentRefs(projection, comments, digestSfValue)
}

