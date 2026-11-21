import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview, SourceRef } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { reviewProjectionEvidence, reviewProjectionSources, validChart, validReviewCommentRefs, validSectionProjection } from "../reviews/port.ts"
import type { ReviewSection } from "../reviews/port.ts"
import { validReviewDecision } from "../reviews/decision.ts"
import { validOutcomeComparison, validReviewOutcome } from "../reviews/outcome.ts"
import type { ReviewAgendaPreview } from "../reviews/selection.ts"
import type { AuthorizedRoutineArtifactResult } from "./result-access.ts"
import type { ReviewDraft } from "./review.ts"

export type RoutineReviewResult = Omit<AuthorizedRoutineArtifactResult, "output"> & {
  output: Omit<AuthorizedRoutineArtifactResult["output"], "content">
  draft: ReviewDraft
  agendaSnapshot?: Omit<ReviewAgendaPreview, "selectionRef">
}

/** Consume the same authenticated immutable output used by product pages and file reads. */
export function createRoutineReviewResultReader(input: {
  openResult: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<AuthorizedRoutineArtifactResult>>
  /** Current domain gates also cover comment history, decisions, outcomes and sensitivity. Source access alone is insufficient. */
  authorizeReview: (context: TrustedDomainContext, snapshot: { sections: readonly ReviewSection[]; comments: PreservedReview["comments"]; sourceRefs: readonly SourceRef[] }) => Promise<boolean>
  /** The host's C17 reader checks every nested record, document, calculation and decision reference. */
  revalidateEvidence: (context: TrustedDomainContext, refs: readonly BusinessEvidenceRef[]) => Promise<boolean>
}) {
  const read = async (runRef: string, context: TrustedDomainContext): Promise<PortResult<RoutineReviewResult>> => {
    if (!nonempty(runRef)) return { status: "needs-input", reason: "routine-run-required" }
    const opened = await input.openResult(runRef, context)
    if (opened.status !== "ok") return opened
    const result = structuredClone(opened.value)
    if (result.run.runRef !== runRef || result.run.admission !== "admitted" || result.run.principalRef !== context.binding.principalRef ||
      result.run.projectId !== context.binding.projectId || result.execution.state !== "completed" || result.execution.runRef !== runRef ||
      result.execution.resultRef !== result.run.resultRef || result.output.runRef !== runRef || result.output.resultRef !== result.run.resultRef ||
      !/^[a-f0-9]{64}$/.test(result.output.outputDigest) || result.output.outputDigest !== result.execution.outputDigest)
      return { status: "unavailable", reason: "routine-review-unverified" }
    const content = result.output.content
    if (!record(content) || content.synthesisIncluded !== false || !record(content.draft)) return { status: "unavailable", reason: "routine-review-format-unavailable" }
    const draft = content.draft
    if (!validDraft(draft, result, context)) return { status: "unavailable", reason: "routine-review-draft-invalid" }
    const agenda = content.agendaSnapshot
    if (agenda !== undefined && !validAgenda(agenda, draft, result, context)) return { status: "unavailable", reason: "routine-review-agenda-invalid" }
    if (draft.sections.some((section, index) => !validReviewCommentRefs(section.content, agenda?.sections[index]?.comments ?? []))) return { status: "unavailable", reason: "routine-review-comment-association-invalid" }
    const sections = [...draft.sections.map(draftSection), ...(agenda?.sections ?? []),
      ...(draft.previousReview && !("status" in draft.previousReview) ? draft.previousReview.sections.map(draftSection) : [])]
    const comments = [...(agenda?.sections.flatMap((section) => section.comments ?? []) ?? []),
      ...(draft.previousReview && !("status" in draft.previousReview) ? draft.previousReview.comments : [])]
    const sourceRefs = [...sections.flatMap((section) => reviewProjectionSources(section.projection)), ...comments.flatMap((comment) => comment.sourceRefs)]
    if (!sourcesBound(sourceRefs, result.output.sourceRefs)) return { status: "unavailable", reason: "routine-review-source-invalid" }
    const snapshot = { sections, comments, sourceRefs }
    if (!await input.authorizeReview(context, structuredClone(snapshot))) return { status: "denied", reason: "routine-review-access-unavailable" }
    const refs = sections.flatMap((section) => reviewProjectionEvidence(section.projection, section))
    if (!await input.revalidateEvidence(context, structuredClone(refs))) return { status: "denied", reason: "routine-review-evidence-unavailable" }
    const current = await input.openResult(runRef, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(result)) return { status: "stale", reason: "routine-review-result-changed" }
    if (!await input.authorizeReview(context, structuredClone(snapshot))) return { status: "denied", reason: "routine-review-access-unavailable" }
    if (!await input.revalidateEvidence(context, structuredClone(refs))) return { status: "denied", reason: "routine-review-evidence-unavailable" }
    // Topics and other preparation fields are not the reopened review contract.
    // Return only its decoded draft and agenda, retaining the immutable output identity.
    const { content: _content, ...output } = result.output
    return { status: "ok", value: { run: result.run, execution: result.execution, output, draft, ...(agenda ? { agendaSnapshot: agenda } : {}) } }
  }
  return { read: (runRef: string, context: TrustedDomainContext) => read(runRef, context).catch((): PortResult<RoutineReviewResult> => ({ status: "unavailable", reason: "routine-review-unavailable" })) }
}

function validDraft(draft: unknown, result: AuthorizedRoutineArtifactResult, context: TrustedDomainContext): draft is ReviewDraft {
  if (!record(draft) || !keys(draft, ["kind", "previousReview", "period", "sections", "pendencies", "nextSteps", "coverage"]) || draft.kind !== "review-draft" ||
    (draft.period !== null && !isSfPeriod(draft.period)) || !Array.isArray(draft.sections) || !Array.isArray(draft.pendencies) || !Array.isArray(draft.nextSteps) ||
    !record(draft.coverage) || !keys(draft.coverage, ["selectedTopics", "includedTopics", "unavailableTopics", "omittedTopics", "includedRecordCount"])) return false
  const coverage = draft.coverage
  if (!count(coverage.selectedTopics) || !count(coverage.includedTopics) || !count(coverage.unavailableTopics) || !count(coverage.omittedTopics) ||
    coverage.includedTopics !== draft.sections.length || coverage.selectedTopics !== coverage.includedTopics + coverage.unavailableTopics + coverage.omittedTopics ||
    new Set(draft.sections.map((section) => section?.id)).size !== draft.sections.length) return false
  if (draft.sections.some((section: ReviewDraft["sections"][number]) => !record(section) || !keys(section, ["id", "title", "period", "count", "sourceRefs", "content"]) ||
    (section.count !== null && !count(section.count)) || !Array.isArray(section.sourceRefs) ||
    !validSectionContents(draftSection(section)) ||
    !matchesProjectionPrincipal(section.content, context) || digestSfValue(section.sourceRefs) !== digestSfValue(section.content.context.sourceRefs) ||
    (draft.period !== null && digestSfValue(draft.period) !== digestSfValue(section.period)) ||
    !sourcesBound(reviewProjectionSources(section.content), result.output.sourceRefs))) return false
  const records = draft.sections.some((section) => section.count === null) ? null : draft.sections.reduce((sum, section) => sum + section.count!, 0)
  if (coverage.includedRecordCount !== records) return false
  const topicRefs = new Set(draft.sections.map((section) => section.id))
  if (draft.pendencies.some((pending: ReviewDraft["pendencies"][number]) => !record(pending) || !keys(pending, ["topicRef", "kind", "reason", "evaluatedAt", "missing"]) || !topicRefs.has(pending.topicRef) ||
    !["material-review", "unconfirmed"].includes(pending.kind) || !Array.isArray(pending.missing) || pending.missing.some((entry: DomainProjection["missing"][number]) => !record(entry) || !keys(entry, ["field", "reason"]) || typeof entry.field !== "string" ||
      !["missing", "unavailable", "restricted", "not-applicable", "incompatible-currency", "missing-fx", "missing-rate", "unconfirmed"].includes(entry.reason)) ||
    (pending.evaluatedAt !== null && !date(pending.evaluatedAt)) ||
    (pending.reason !== null && !["unchanged-scope", "material-change", "dependency-change", "source-removed", "source-replaced", "access-unavailable", "dependency-unavailable"].includes(pending.reason)))) return false
  if (draft.nextSteps.some((step: ReviewDraft["nextSteps"][number]) => !record(step) || !keys(step, ["kind", "topicRef", "message"]) ||
    !["review-material", "confirm-scope", "check-source-access", "select-matching-period"].includes(step.kind) || !nonempty(step.message) ||
    (step.topicRef !== undefined && !topicRefs.has(step.topicRef)))) return false
  if (draft.previousReview === null) return true
  if (!record(draft.previousReview)) return false
  if ("status" in draft.previousReview) return keys(draft.previousReview, ["status", "reason"]) && draft.previousReview.status === "unavailable" &&
    typeof draft.previousReview.reason === "string" && ["prior-review-source-unavailable", "prior-review-mismatch"].includes(draft.previousReview.reason)
  const previous = draft.previousReview
  const comments = previous.comments
  const previousRefs = previous.sourceRefs
  if (!Array.isArray(comments) || !Array.isArray(previousRefs)) return false
  return keys(previous, ["id", "version", "createdAt", "sourceRefs", "sections", "comments", "previousReviewRef"]) && nonempty(previous.id) &&
    count(previous.version) && previous.version > 0 && date(previous.createdAt) && (previous.previousReviewRef === undefined || nonempty(previous.previousReviewRef)) && sourcesBound(previousRefs, result.output.sourceRefs) &&
    Array.isArray(previous.sections) && previous.sections.every((section: PreservedReview["sections"][number]) => record(section) && keys(section, ["id", "title", "period", "content", "count", "sourceRefs"]) && nonempty(section.id) && typeof section.title === "string" && count(section.count) &&
      Array.isArray(section.sourceRefs) && sourcesBound(section.sourceRefs, previousRefs) && isSfPeriod(section.period) &&
      validSectionContents(draftSection(section)) &&
      validReviewCommentRefs(section.content, comments) &&
      digestSfValue(section.sourceRefs) === digestSfValue((section.content as DomainProjection).context.sourceRefs) &&
      sourcesBound(reviewProjectionSources(section.content as DomainProjection), previousRefs) &&
      matchesProjectionPrincipal(section.content as DomainProjection, context)) &&
    comments.every((comment) => validComment(comment, previousRefs))
}

function validAgenda(agenda: unknown, draft: ReviewDraft, result: AuthorizedRoutineArtifactResult, context: TrustedDomainContext): agenda is Omit<ReviewAgendaPreview, "selectionRef"> {
  if (!record(agenda) || !keys(agenda, ["sectionRefs", "sections", "sectionRecordRefs", "agendaNotes", "gaps"]) ||
    !Array.isArray(agenda.sectionRefs) || !Array.isArray(agenda.sections) || !Array.isArray(agenda.sectionRecordRefs) || !Array.isArray(agenda.agendaNotes) || !Array.isArray(agenda.gaps) ||
    agenda.sectionRefs.some((ref) => !nonempty(ref)) || new Set(agenda.sectionRefs).size !== agenda.sectionRefs.length ||
    agenda.sections.length !== agenda.sectionRefs.length || digestSfValue(agenda.sectionRefs) !== digestSfValue(draft.sections.map((section) => section.id))) return false
  const sections = agenda.sections
  const sectionRefs = agenda.sectionRefs
  const agendaNotes = agenda.agendaNotes
  if (sections.some((section, index) => !validAgendaSection(section, result, context) || section.id !== sectionRefs[index] ||
    digestSfValue({ id: section.id, title: section.title, period: section.period, count: section.recordCount, sourceRefs: section.projection.context.sourceRefs, content: section.projection }) !== digestSfValue(draft.sections[index]))) return false
  if (agenda.sectionRecordRefs.length !== sections.length || new Set(agenda.sectionRecordRefs.map((item) => item?.sectionRef)).size !== sections.length ||
    agenda.sectionRecordRefs.some((item) => !record(item) || !keys(item, ["sectionRef", "recordRefs"]) || !Array.isArray(item.recordRefs) ||
      item.recordRefs.some((ref) => !nonempty(ref)) || new Set(item.recordRefs).size !== item.recordRefs.length ||
      sections.find((section) => section.id === item.sectionRef)?.recordCount !== item.recordRefs.length)) return false
  if (new Set(agendaNotes.map((note) => note?.sectionRef)).size !== agendaNotes.length ||
    agendaNotes.some((note) => !record(note) || !keys(note, ["sectionRef", "text"]) || !nonempty(note.text) || note.text.length > 2000 ||
      sections.find((section) => section.id === note.sectionRef)?.agendaNote !== note.text) ||
    sections.some((section) => section.agendaNote !== undefined && !agendaNotes.some((note) => note.sectionRef === section.id && note.text === section.agendaNote))) return false
  return agenda.gaps.every((gap) => record(gap) && keys(gap, ["id", "reason"]) && nonempty(gap.id) && nonempty(gap.reason))
}

function validAgendaSection(section: ReviewSection, result: AuthorizedRoutineArtifactResult, context: TrustedDomainContext) {
  return record(section) && keys(section, ["id", "title", "period", "recordCount", "projection", "agendaNote", "outcome", "outcomeComparison", "chart", "comments"]) &&
    count(section.recordCount) && validSectionContents(section) && matchesProjectionPrincipal(section.projection, context) &&
    sourcesBound(reviewProjectionSources(section.projection), result.output.sourceRefs) &&
    validReviewCommentRefs(section.projection, section.comments ?? []) &&
    (section.agendaNote === undefined || (typeof section.agendaNote === "string" && section.agendaNote.length <= 2000)) &&
    (section.comments === undefined || section.comments.every((comment) => validComment(comment, result.output.sourceRefs)))
}

function validComment(comment: PreservedReview["comments"][number], allowed: readonly SourceRef[]) {
  return record(comment) && keys(comment, ["id", "version", "content", "authorRef", "createdAt", "sourceRefs"]) && nonempty(comment.id) && count(comment.version) && comment.version > 0 &&
    typeof comment.content === "string" && nonempty(comment.authorRef) && date(comment.createdAt) && Array.isArray(comment.sourceRefs) && comment.sourceRefs.length > 0 && sourcesBound(comment.sourceRefs, allowed)
}

function validSectionContents(section: ReviewSection) {
  return validSectionProjection(section) && validChart(section.projection, section.chart) && validReviewDecision(section.projection.decision) &&
    validReviewOutcome(section.outcome) && validOutcomeComparison(section.outcomeComparison) &&
    (!section.outcomeComparison || digestSfValue(section.outcomeComparison.observation) === digestSfValue(section.outcome)) &&
    section.projection.values.every((value) => (value.value === null || typeof value.value === "string" || typeof value.value === "boolean" || typeof value.value === "number" && Number.isFinite(value.value)) &&
      (value.value === null || value.sourceRefs.length > 0))
}

function draftSection(section: { id: string; title: string; period: ReviewSection["period"]; count: number | null; content: unknown }): ReviewSection {
  const projection = section.content as DomainProjection & { reviewChart?: ReviewSection["chart"]; reviewOutcome?: ReviewSection["outcome"]; reviewOutcomeComparison?: ReviewSection["outcomeComparison"] }
  return { id: section.id, title: section.title, period: section.period, recordCount: section.count ?? 0, projection,
    chart: projection?.reviewChart, outcome: projection?.reviewOutcome, outcomeComparison: projection?.reviewOutcomeComparison }
}

function sourcesBound(refs: readonly SourceRef[], allowed: readonly SourceRef[]) {
  const digest = (ref: SourceRef) => digestSfValue({ ...ref, fields: [...ref.fields].sort(), observedAt: "" })
  const admitted = new Set(allowed.map(digest))
  return refs.every((ref) => record(ref) && Array.isArray(ref.fields) && admitted.has(digest(ref)))
}

function matchesPrincipal(value: { principalRef: string; projectId: string; installationId: string }, context: TrustedDomainContext) {
  return value.principalRef === context.binding.principalRef && value.projectId === context.binding.projectId && value.installationId === context.binding.installationId
}

function matchesProjectionPrincipal(projection: DomainProjection, context: TrustedDomainContext) {
  return matchesPrincipal(projection.context, context) && (!projection.comparison || matchesPrincipal(projection.comparison.context, context))
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function keys(value: object, allowed: readonly string[]) {
  return [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key))
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && !!value.trim()
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function date(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}
