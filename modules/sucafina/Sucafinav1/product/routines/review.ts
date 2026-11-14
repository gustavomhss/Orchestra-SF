import { digestSfValue } from "../contracts/canonical.ts"
import type { ConfirmationValidityProjection, DomainProjection, Period, PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { routineProjectionMaterial, routineValueMaterial } from "./material.ts"

/** The host resolves the selection, confirmation, and any selected prior review under the caller's current authority. */
export type ReviewPreparationHost = {
  readTopic: (topicRef: string, context: TrustedDomainContext) => Promise<PortResult<{
    projection: DomainProjection
    recordCount?: number
    previousProjection?: DomainProjection | null
    confirmation: ConfirmationValidityProjection | null
  }>>
  /** Source-authorized C05 record. A caller ref is not a review. */
  readPreviousReview?: (reviewRef: string, context: TrustedDomainContext) => Promise<PortResult<PreservedReview>>
  /** Revalidate current and selected historical sources before any result leaves the host. */
  revalidate: (topicRefs: readonly string[], context: TrustedDomainContext) => Promise<boolean>
}

export type ProjectionChange = { state: "added"; current: DomainProjection["values"][number] } | { state: "removed"; previous: DomainProjection["values"][number] } | { state: "changed"; previous: DomainProjection["values"][number]; current: DomainProjection["values"][number]; delta: number | null }

type TopicFreshness = {
  evaluatedAt: string
  evaluatedSourceVersion: number
  scopeFingerprint?: string
}

type AvailableTopic = {
  state: "available"
  topicRef: string
  projection: DomainProjection
  changes: readonly ProjectionChange[] | null
  review: "confirmed" | "pending"
  missing: DomainProjection["missing"]
  freshness: TopicFreshness | null
  confirmationReason: ConfirmationValidityProjection["reason"] | null
  recordCount: number | null
  /** Source observation dates are separate from a later human confirmation. */
  sourceObservedAt: readonly string[]
  /** C02/WP07 do not expose the last material update; observation and confirmation are not updates. */
  lastUpdate: { state: "unknown"; reason: "source-update-time-unavailable"; message: string }
}

type HiddenTopic = { state: "unavailable"; reason: "source-unavailable" | "period-mismatch" }

export type PreparedTopic = AvailableTopic | HiddenTopic

export type AuthorizedPriorReview =
  | PreservedReview
  | { status: "unavailable"; reason: "prior-review-source-unavailable" | "prior-review-mismatch" }
  | null

export type ReviewDraft = {
  kind: "review-draft"
  previousReview: AuthorizedPriorReview
  period: Period | null
  sections: readonly {
    id: string
    title: string
    period: Period
    count: number | null
    sourceRefs: readonly DomainProjection["context"]["sourceRefs"][number][]
    content: DomainProjection
  }[]
  pendencies: readonly {
    topicRef: string
    kind: "material-review" | "unconfirmed"
    reason: ConfirmationValidityProjection["reason"] | null
    evaluatedAt: string | null
    missing: DomainProjection["missing"]
  }[]
  nextSteps: readonly { kind: "review-material" | "confirm-scope" | "check-source-access" | "select-matching-period"; topicRef?: string; message: string }[]
  coverage: { selectedTopics: number; includedTopics: number; unavailableTopics: number; omittedTopics: number; includedRecordCount: number | null }
}

/** C06 state and scope fingerprint decide the charge. evaluatedSourceVersion is not compared with a global version. */
export function confirmationCharge(confirmation: ConfirmationValidityProjection | null) {
  if (!confirmation) return "pending" as const
  if (confirmation.state === "stale") return "pending" as const
  if (confirmation.state === "unavailable") return "unavailable" as const
  if (confirmation.reason !== "unchanged-scope" || !confirmation.scopeFingerprint.trim()) return "unavailable" as const
  return "confirmed" as const
}

/** Prepare facts without model synthesis, inferred totals, or mutation of the authorized prior review. */
export async function prepareFactualReview(input: {
  topicRefs: readonly string[]
  period?: Period
  currentReviewRef?: string
  previousReviewRef?: string
  host: ReviewPreparationHost
  context: TrustedDomainContext
}) {
  const topics = await Promise.all([...new Set(input.topicRefs)].map((topicRef) => readPreparedTopic(topicRef, input)))
  const previousReview = await loadPreviousReview(input)
  if (previousReview.status === "denied") return { status: "denied", reason: "access-changed" } as const
  const egressRefs = [...new Set([...input.topicRefs, input.currentReviewRef, input.previousReviewRef].filter((ref): ref is string => !!ref))]
  if (!await input.host.revalidate(egressRefs, input.context)) return { status: "denied", reason: "access-changed" } as const
  const currentReview = await loadPreviousReview(input)
  if (currentReview.status === "denied" || currentReview.currentDigest !== previousReview.currentDigest || digestSfValue(currentReview.value) !== digestSfValue(previousReview.value)) return { status: "denied", reason: "access-changed" } as const
  const currentTopics = await Promise.all([...new Set(input.topicRefs)].map((topicRef) => readPreparedTopic(topicRef, input)))
  if (currentTopics.some((topic, index) => topics[index]?.state === "available" && topic.state === "unavailable")) return { status: "denied", reason: "access-changed" } as const
  if (currentTopics.some((topic, index) => topicMaterialDigest(topic) !== topicMaterialDigest(topics[index]!))) return { status: "stale", reason: "review-source-changed" } as const
  if (!await input.host.revalidate(egressRefs, input.context)) return { status: "denied", reason: "access-changed" } as const
  return { status: "ok", value: { topics, draft: draftFrom(topics, input.period, previousReview.value), synthesisIncluded: false as const } } as const
}

async function readPreparedTopic(topicRef: string, input: { period?: Period; host: ReviewPreparationHost; context: TrustedDomainContext }): Promise<PreparedTopic> {
  const read = await input.host.readTopic(topicRef, input.context)
  if (read.status !== "ok") return hidden("source-unavailable")
  const result = { value: structuredClone(read.value) }
  if (confirmationCharge(result.value.confirmation) === "unavailable") return hidden("source-unavailable")
  if (input.period && !samePeriod(input.period, result.value.projection.context?.period)) return hidden("period-mismatch")
  if ([result.value.projection, result.value.previousProjection].some((projection) => projection?.missing.some((entry) => entry.reason === "restricted"))) return hidden("source-unavailable")
  const redacted = { previous: result.value.previousProjection, current: result.value.projection }
  const changes = redacted.previous ? compareProjections(redacted.previous, redacted.current) : null
  if (changes === undefined) return hidden("source-unavailable")
  return {
    state: "available",
    topicRef,
    projection: redacted.current,
    changes,
    review: confirmationCharge(result.value.confirmation) === "confirmed" ? "confirmed" : "pending",
    missing: redacted.current.missing,
    freshness: freshness(result.value.confirmation),
    confirmationReason: result.value.confirmation && result.value.confirmation.state !== "unavailable" ? result.value.confirmation.reason : null,
    recordCount: Number.isSafeInteger(result.value.recordCount) && (result.value.recordCount ?? -1) >= 0 ? result.value.recordCount! : null,
    sourceObservedAt: [...new Set(redacted.current.context?.sourceRefs.map((ref) => ref.observedAt) ?? [])].sort(),
    lastUpdate: { state: "unknown", reason: "source-update-time-unavailable", message: "A fonte não informa a data da última atualização. A data de leitura e a confirmação humana não indicam a idade do dado." },
  }
}

async function loadPreviousReview(input: { currentReviewRef?: string; previousReviewRef?: string; host: ReviewPreparationHost; context: TrustedDomainContext }): Promise<{ status: "denied" } | { status: "ok"; value: AuthorizedPriorReview; currentDigest?: string }> {
  if (!input.previousReviewRef) return { status: "ok", value: null }
  if (!input.host.readPreviousReview) return { status: "ok", value: { status: "unavailable", reason: "prior-review-source-unavailable" } }
  const current = input.currentReviewRef ? await input.host.readPreviousReview(input.currentReviewRef, input.context) : undefined
  if (current?.status === "denied") return { status: "denied" }
  if (current && current.status !== "ok") return { status: "ok", value: { status: "unavailable", reason: "prior-review-source-unavailable" } }
  if (current?.status === "ok" && (current.value.id !== input.currentReviewRef || current.value.previousReviewRef !== input.previousReviewRef)) return { status: "ok", value: { status: "unavailable", reason: "prior-review-mismatch" } }
  const read = await input.host.readPreviousReview(input.previousReviewRef, input.context)
  if (read.status === "denied") return { status: "denied" }
  if (read.status !== "ok") return { status: "ok", value: { status: "unavailable", reason: "prior-review-source-unavailable" } }
  if (read.value.id !== input.previousReviewRef) return { status: "ok", value: { status: "unavailable", reason: "prior-review-mismatch" } }
  return { status: "ok", value: structuredClone(read.value), ...(current?.status === "ok" ? { currentDigest: digestSfValue(current.value) } : {}) }
}

function draftFrom(topics: readonly PreparedTopic[], period: Period | undefined, previousReview: AuthorizedPriorReview): ReviewDraft {
  const available = topics.flatMap((topic) => topic.state === "available" ? [topic] : [])
  const included = available.filter((topic) => !!(period ?? topic.projection.context?.period ?? coveredPeriod(topic.projection)))
  return {
    kind: "review-draft",
    previousReview,
    period: period ?? null,
    sections: available.flatMap((topic) => {
      const sectionPeriod = period ?? topic.projection.context?.period ?? coveredPeriod(topic.projection)
      if (!sectionPeriod) return []
      const restricted = topic.missing.some((entry) => entry.reason === "restricted")
      return [{
        id: topic.topicRef,
        title: topic.topicRef,
        period: sectionPeriod,
        count: topic.recordCount,
        sourceRefs: restricted ? [] : topic.projection.context?.sourceRefs ?? [],
        content: topic.projection,
      }]
    }),
    pendencies: available.flatMap((topic) => {
      if (topic.review !== "pending") return []
      return [{
        topicRef: topic.topicRef,
        kind: topic.confirmationReason && topic.confirmationReason !== "unchanged-scope" ? "material-review" as const : "unconfirmed" as const,
        reason: topic.confirmationReason,
        evaluatedAt: topic.freshness?.evaluatedAt ?? null,
        missing: topic.missing,
      }]
    }),
    nextSteps: [
      ...available.filter((topic) => topic.review === "pending").map((topic) => ({
        kind: topic.confirmationReason && topic.confirmationReason !== "unchanged-scope" ? "review-material" as const : "confirm-scope" as const,
        topicRef: topic.topicRef,
        message: topic.confirmationReason && topic.confirmationReason !== "unchanged-scope"
          ? "Revise a alteração e os faltantes no recorte indicado; confirme a revisão na superfície responsável."
          : "Confira os fatos e os faltantes do recorte; registre a confirmação humana na superfície responsável.",
      })),
      ...(topics.some((topic) => topic.state === "unavailable" && topic.reason === "source-unavailable") ? [{ kind: "check-source-access" as const, message: "Uma fonte está indisponível. Confira o acesso e a versão na superfície de origem; não há solicitação de confirmação para dados sem acesso." }] : []),
      ...(topics.some((topic) => topic.state === "unavailable" && topic.reason === "period-mismatch") ? [{ kind: "select-matching-period" as const, message: "Selecione uma fonte autorizada que cubra o período solicitado." }] : []),
    ],
    coverage: { selectedTopics: topics.length, includedTopics: included.length, unavailableTopics: topics.length - available.length, omittedTopics: available.length - included.length, includedRecordCount: included.some((topic) => topic.recordCount === null) ? null : included.reduce((sum, topic) => sum + topic.recordCount!, 0) },
  }
}

function topicMaterialDigest(topic: PreparedTopic) {
  return digestSfValue(topic.state === "available" ? { ...topic, projection: routineProjectionMaterial(topic.projection), sourceObservedAt: [], freshness: topic.freshness ? { ...topic.freshness, evaluatedAt: "" } : null } : topic)
}

/** Compare matching domain values without deriving a cause or adding an absent number as zero. Callers must pass already redacted projections. */
export function compareProjections(previous: DomainProjection, current: DomainProjection) {
  const key = (value: DomainProjection["values"][number]) => JSON.stringify([value.id, value.period.start, value.period.end, value.granularity])
  const before = new Map(previous.values.map((value) => [key(value), value]))
  const after = new Map(current.values.map((value) => [key(value), value]))
  if (before.size !== previous.values.length || after.size !== current.values.length) return undefined
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap<ProjectionChange>((id) => {
    const oldValue = before.get(id)
    const newValue = after.get(id)
    if (!oldValue) return newValue ? [{ state: "added" as const, current: newValue }] : []
    if (!newValue) return [{ state: "removed" as const, previous: oldValue }]
    if (routineValueMaterial(previous, oldValue).value === routineValueMaterial(current, newValue).value && oldValue.unit === newValue.unit && oldValue.currency === newValue.currency && oldValue.evidenceState === newValue.evidenceState) return []
    const delta = typeof oldValue.value === "number" && Number.isFinite(oldValue.value) && typeof newValue.value === "number" && Number.isFinite(newValue.value) && oldValue.unit === newValue.unit && oldValue.currency === newValue.currency && oldValue.evidenceState !== "absent" && newValue.evidenceState !== "absent" ? newValue.value - oldValue.value : null
    return [{ state: "changed" as const, previous: oldValue, current: newValue, delta }]
  })
}

function hidden(reason: HiddenTopic["reason"]): HiddenTopic {
  return { state: "unavailable", reason }
}

function samePeriod(requested: Period, source: Period | undefined) {
  if (!source) return false
  return source.start === requested.start && source.end === requested.end
}

function coveredPeriod(projection: DomainProjection) {
  const start = projection.values.map((value) => value.period.start).sort()[0]
  const end = projection.values.map((value) => value.period.end).sort().at(-1)
  if (!start || !end) return undefined
  return { start, end }
}

function freshness(confirmation: ConfirmationValidityProjection | null): TopicFreshness | null {
  if (!confirmation || confirmation.state === "unavailable") return null
  const scopeFingerprint = confirmation.scopeFingerprint?.trim()
  if (!scopeFingerprint) return { evaluatedAt: confirmation.evaluatedAt, evaluatedSourceVersion: confirmation.evaluatedSourceVersion }
  return { evaluatedAt: confirmation.evaluatedAt, evaluatedSourceVersion: confirmation.evaluatedSourceVersion, scopeFingerprint }
}


