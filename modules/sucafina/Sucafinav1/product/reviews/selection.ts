import { randomUUID } from "node:crypto"
import type { DomainProjection, Period, SourceRef } from "../contracts/context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BiPresentation } from "../analytics/semantics.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { ReviewSection } from "./port.ts"
import { validOutcomeComparison, validReviewOutcome } from "./outcome.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"

export type DashboardTopic = "budget" | "projects" | "hot-topics" | "talent-review" | "opex-detail" | "capex-projects" | "headcount" | "team-structure" | "all-projects" | "it-operations" | "it-security" | "it-risks" | "vendor-contracts" | "stakeholders" | "executive" | "it-performance"
type AgendaBase = { id: string; period: Period; recordRefs?: readonly string[]; agendaNote?: string; threadIds?: readonly string[]; biView?: Pick<BiViewRequest, "viewId" | "selectionRef">; outcome?: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string } }
export type ReviewAgendaItem =
  | (AgendaBase & { kind: "dashboard"; topic: string; selectionRef: string })
  | (AgendaBase & { kind: "forecast-comparison"; title: string; baseRef: string; candidateRef: string; currency: string; sides: readonly ("baseline" | "candidate")[] })
  | (AgendaBase & { kind: "procurement-request"; title: string; requestRef: string })
  | (AgendaBase & { kind: "procurement-supplier"; title: string; supplierRef: string; fields: readonly string[] })
  | (AgendaBase & { kind: "procurement-contract"; title: string; contractRef: string; fields: readonly string[] })

export type ReviewAgendaPreview = {
  selectionRef: string
  sectionRefs: readonly string[]
  sections: readonly ReviewSection[]
  sectionRecordRefs: readonly { sectionRef: string; recordRefs: readonly string[] }[]
  agendaNotes: readonly { sectionRef: string; text: string }[]
  gaps: readonly { id: string; reason: string }[]
}

/** Structural copy of WP02 aac2a2ccc6; C17 refs are opaque, omitted selects all authorized, [] selects none. */
export type DashboardAgendaSelectionRequest = { selectionRef: string; topic: string; period: Period; recordRefs?: readonly string[] }
export type DashboardAgendaSelector = (request: DashboardAgendaSelectionRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; recordRefs: readonly string[]; recordCount: number }>>
/** Structural copy of WP14 d6c97669d6's adapter result; inject the authorized factory output. */
export type ReviewOutcomeAdapter = (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string }, context: TrustedDomainContext) => Promise<{ status: "ready"; observation: ObservedResultProjection; comparison: ReviewOutcomeComparison } | { status: "unavailable" }>
export type ReviewAgendaPorts = {
  planner: Pick<BusinessPorts["planner"], "compareForecast">
  procurement: Pick<BusinessPorts["procurement"], "read" | "readSupplier" | "readContract">
  selectDashboardAgenda: DashboardAgendaSelector
  /** Bind to WP05 9c539e6800's authorized readBiPresentation and captureBiReviewChart exports. */
  readBiPresentation?: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>
  captureBiReviewChart?: (projection: DomainProjection, presentation: BiPresentation) => NonNullable<ReviewSection["chart"]>
  threadComments?: { capture: (threadId: string, sources: readonly SourceRef[], context: TrustedDomainContext) => Promise<PortResult<NonNullable<ReviewSection["comments"]>>> }
  /** Bind to WP14 d6c97669d6's host-authorized createSfReviewOutcomeAdapter. */
  reviewOutcome?: ReviewOutcomeAdapter
}

const dashboardTopics: Record<DashboardTopic, { page: string; title: string }> = {
  budget: { page: "Budget Overview", title: "Budget" },
  projects: { page: "Portfolio Dashboard", title: "Projects" },
  "hot-topics": { page: "Hot Topics & Actions", title: "Hot Topics" },
  "talent-review": { page: "Talent Review", title: "Talent Review" },
  "opex-detail": { page: "OPEX Detail", title: "OPEX Detail" },
  "capex-projects": { page: "CAPEX Projects", title: "CAPEX Projects" },
  headcount: { page: "Headcount Overview", title: "Headcount" },
  "team-structure": { page: "Team Structure", title: "Team Structure" },
  "all-projects": { page: "All Projects", title: "All Projects" },
  "it-operations": { page: "IT Operations", title: "IT Operations" },
  "it-security": { page: "IT Security KPIs", title: "IT Security" },
  "it-risks": { page: "IT Risks", title: "IT Risks" },
  "vendor-contracts": { page: "Vendor Contracts", title: "Vendor Contracts" },
  stakeholders: { page: "Stakeholder Management", title: "Stakeholders" },
  executive: { page: "Executive Dashboard", title: "Executive Dashboard" },
  "it-performance": { page: "IT Performance Contract", title: "IT Performance Contract" },
}

/** Resolves an ordered, editable agenda through the authenticated C02 producer ports. */
export function createReviewAgendaSelection(input: {
  ports: ReviewAgendaPorts
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  now: () => string
  maxSelections?: number
}) {
  const selections = new Map<string, { binding: Pick<TrustedDomainContext["binding"], "installationId" | "projectId" | "principalRef" | "accessRevision" | "policyVersion">; items: readonly ReviewAgendaItem[]; sections: readonly ReviewSection[]; digests: ReadonlyMap<string, string>; expiresAt: number }>()
  const maximum = input.maxSelections ?? 128
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("SF_REVIEW_AGENDA_LIMIT_INVALID")
  const lifetime = 15 * 60 * 1000
  const prune = (at: number) => {
    for (const [ref, selection] of selections) if (selection.expiresAt <= at) selections.delete(ref)
  }
  const preview = async (selectionRef: string, incoming: readonly ReviewAgendaItem[], context: TrustedDomainContext): Promise<PortResult<ReviewAgendaPreview>> => {
    if (typeof selectionRef !== "string" || !selectionRef.trim() || !Array.isArray(incoming) || !incoming.length || incoming.some((item) => !validAgendaItem(item)) || new Set(incoming.map((item) => item.id)).size !== incoming.length) return { status: "needs-input", reason: "invalid-or-empty-agenda" }
    const items = structuredClone(incoming)
    if (!await input.revalidate(context)) return { status: "denied", reason: "agenda-authority-unavailable" }
    const sections: ReviewSection[] = []
    const sectionRecordRefs: { sectionRef: string; recordRefs: readonly string[] }[] = []
    const agendaNotes: { sectionRef: string; text: string }[] = []
    for (const item of items) {
      if (item.kind === "dashboard") {
        if (!isDashboardTopic(item.topic)) return { status: "unavailable", reason: "dashboard-topic-unsupported" }
        const topic = dashboardTopics[item.topic]
        const selected = await input.ports.selectDashboardAgenda({ selectionRef: item.selectionRef, topic: item.topic, period: item.period, ...(item.recordRefs === undefined ? {} : { recordRefs: item.recordRefs }) }, context)
        if (selected.status !== "ok") return selected
        if (!selected.value || typeof selected.value !== "object" || !Array.isArray(selected.value.recordRefs) || selected.value.recordRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || !Number.isSafeInteger(selected.value.recordCount) || selected.value.recordCount < 0 || selected.value.recordCount !== selected.value.recordRefs.length || new Set(selected.value.recordRefs).size !== selected.value.recordRefs.length || (item.recordRefs !== undefined && digestRefs(selected.value.recordRefs) !== digestRefs(item.recordRefs))) return { status: "unavailable", reason: "dashboard-record-count-or-selection-invalid" }
        const projection = selected.value.projection
        if (!validAgendaProjection(projection)) return { status: "unavailable", reason: "dashboard-projection-invalid" }
        if (!matchesContext(projection, context) || projection.context.surface !== "dashboard" || projection.context.period.start !== item.period.start || projection.context.period.end !== item.period.end || projection.context.sourceRefs.length === 0 || projection.context.sourceRefs.some((ref) => !ref || ref.surface !== "dashboard" || ref.type !== "dashboard-page" || ref.id !== topic.page)) return { status: "denied", reason: "dashboard-section-access-unavailable" }
        if (item.recordRefs?.length === 0 && (projection.values.length > 0 || projection.components.length > 0 || projection.missing.length > 0)) return { status: "unavailable", reason: "empty-dashboard-selection-returned-data" }
        const section = await captureReviewChart({ id: item.id, title: topic.title, period: item.period, recordCount: selected.value.recordCount, projection }, item, input.ports, context)
        if (section.status !== "ok") return section
        sections.push(item.agendaNote ? { ...section.value, agendaNote: item.agendaNote } : section.value)
        sectionRecordRefs.push({ sectionRef: item.id, recordRefs: selected.value.recordRefs })
        if (item.agendaNote) agendaNotes.push({ sectionRef: item.id, text: item.agendaNote })
        continue
      }
      if (item.kind === "forecast-comparison") {
        if (!item.sides.length || new Set(item.sides).size !== item.sides.length || (item.recordRefs !== undefined && item.recordRefs.some((ref) => !item.sides.some((side) => forecastSideRef(item.id, side) === ref)))) return { status: "needs-input", reason: "invalid-forecast-side-selection" }
        const analysis = await input.ports.planner.compareForecast({ baseRef: item.baseRef, candidateRef: item.candidateRef, period: item.period, currency: item.currency }, context)
        if (analysis.status !== "ok") return { ...analysis, reason: "forecast-source-unavailable" }
        const selectedSides = item.recordRefs ?? item.sides.map((side) => forecastSideRef(item.id, side))
        for (const side of item.sides) {
          if (!selectedSides.includes(forecastSideRef(item.id, side))) continue
          const projection = side === "baseline" ? analysis.value.baseline : analysis.value.candidate
          if (!matchesContext(projection, context) || projection.context.period.start !== item.period.start || projection.context.period.end !== item.period.end || projection.context.sourceRefs.length !== 1) return { status: "denied", reason: "forecast-section-access-unavailable" }
          const section = await captureReviewChart({ id: `${item.id}:${side}`, title: `${item.title} · ${side}`, period: item.period, recordCount: 1, projection }, item, input.ports, context)
          if (section.status !== "ok") return section
          sections.push(item.agendaNote ? { ...section.value, agendaNote: item.agendaNote } : section.value)
          sectionRecordRefs.push({ sectionRef: `${item.id}:${side}`, recordRefs: [forecastSideRef(item.id, side)] })
          if (item.agendaNote) agendaNotes.push({ sectionRef: `${item.id}:${side}`, text: item.agendaNote })
        }
        continue
      }
      if (item.recordRefs?.length === 0) continue
      const result = item.kind === "procurement-request"
        ? await input.ports.procurement.read({ requestRef: item.requestRef }, context)
        : item.kind === "procurement-supplier"
          ? await input.ports.procurement.readSupplier({ supplierRef: item.supplierRef, fields: item.fields }, context)
          : await input.ports.procurement.readContract({ contractRef: item.contractRef, fields: item.fields }, context)
      if (result.status !== "ok") return { ...result, reason: "procurement-source-unavailable" }
      if (!validAgendaProjection(result.value)) return { status: "unavailable", reason: "procurement-projection-invalid" }
      const source = result.value.context.sourceRefs[0]
      const sourceRef = source ? `${source.surface}:${source.type}:${source.id}:${source.incarnation}:${source.version}` : ""
      if (!matchesContext(result.value, context) || result.value.context.period.start !== item.period.start || result.value.context.period.end !== item.period.end || result.value.context.sourceRefs.length !== 1 || !sourceRef) return { status: "denied", reason: "procurement-section-access-unavailable" }
      if (item.recordRefs !== undefined && (item.recordRefs.length !== 1 || item.recordRefs[0] !== sourceRef)) return { status: "unavailable", reason: "procurement-record-identity-unavailable" }
      const section = await captureReviewChart({ id: item.id, title: item.title, period: item.period, recordCount: 1, projection: result.value }, item, input.ports, context)
      if (section.status !== "ok") return section
      sections.push(item.agendaNote ? { ...section.value, agendaNote: item.agendaNote } : section.value)
      sectionRecordRefs.push({ sectionRef: item.id, recordRefs: [sourceRef] })
      if (item.agendaNote) agendaNotes.push({ sectionRef: item.id, text: item.agendaNote })
    }
    if (!sections.length) return { status: "needs-input", reason: "agenda-has-no-selected-sections" }
    if (!await input.revalidate(context)) return { status: "denied", reason: "agenda-authority-unavailable" }
    if (new Set(sections.map((section) => section.id)).size !== sections.length) return { status: "unavailable", reason: "agenda-section-identity-collision" }
    return { status: "ok", value: { selectionRef, sectionRefs: sections.map((section) => section.id), sections, sectionRecordRefs, agendaNotes, gaps: [
      ...(!sections.some((section) => section.outcomeComparison) ? [{ id: "outcome-comparison-not-requested", reason: "No selected section supplied a requested, authorized observed-outcome comparison." }] : []),
    ] } }
  }
  return {
    async create(incoming: readonly ReviewAgendaItem[], context: TrustedDomainContext) {
      if (!Array.isArray(incoming) || !incoming.length || incoming.some((item) => !validAgendaItem(item))) return { status: "needs-input" as const, reason: "invalid-or-empty-agenda" }
      const items = structuredClone(incoming)
      const { installationId, projectId, principalRef, accessRevision, policyVersion } = context.binding
      const binding = { installationId, projectId, principalRef, accessRevision, policyVersion }
      const at = Date.parse(input.now())
      if (!Number.isFinite(at)) return { status: "unavailable" as const, reason: "agenda-clock-unavailable" }
      prune(at)
      if (selections.size >= maximum) return { status: "unavailable" as const, reason: "agenda-selection-capacity-reached" }
      const selectionRef = `review-agenda:${randomUUID()}`
      const result = await preview(selectionRef, items, context)
      if (result.status !== "ok") return result
      const frozen = items.map((item) => {
        if (item.kind === "forecast-comparison") return { ...item, recordRefs: result.value.sectionRecordRefs.filter((entry) => item.sides.some((side) => entry.sectionRef === forecastSideRef(item.id, side))).flatMap((entry) => entry.recordRefs) }
        const selected = result.value.sectionRecordRefs.find((entry) => entry.sectionRef === item.id)
        return selected ? { ...item, recordRefs: selected.recordRefs } : item
      })
      const committedAt = Date.parse(input.now())
      if (!Number.isFinite(committedAt) || committedAt < at) return { status: "unavailable" as const, reason: "agenda-clock-unavailable" }
      prune(committedAt)
      if (selections.size >= maximum) return { status: "unavailable" as const, reason: "agenda-selection-capacity-reached" }
      const expiresAt = committedAt + lifetime
      if (!sameBinding(binding, context.binding)) return { status: "denied" as const, reason: "agenda-authority-unavailable" }
      const sections = structuredClone(result.value.sections)
      selections.set(selectionRef, { binding, items: structuredClone(frozen), sections, digests: new Map(sections.map((section) => [section.id, sectionDigest(section)])), expiresAt })
      return result
    },
    preview,
    async select(selectionRef: string, incomingRefs: readonly string[], context: TrustedDomainContext, incomingPeriod?: Period): Promise<PortResult<readonly ReviewSection[]>> {
      if (typeof selectionRef !== "string" || !Array.isArray(incomingRefs) || incomingRefs.some((ref) => typeof ref !== "string")) return { status: "needs-input", reason: "invalid-agenda-sections" }
      if (incomingPeriod !== undefined && !isSfPeriod(incomingPeriod)) return { status: "needs-input", reason: "invalid-review-period" }
      const sectionRefs = [...incomingRefs]
      const period = incomingPeriod ? { ...incomingPeriod } : undefined
      const at = Date.parse(input.now())
      if (!Number.isFinite(at)) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      prune(at)
      const selected = selections.get(selectionRef)
      if (!selected || !sameBinding(selected.binding, context.binding)) return { status: "denied", reason: "agenda-selection-unavailable" }
      if (!await input.revalidate(context)) return { status: "denied", reason: "agenda-authority-unavailable" }
      if (!sectionRefs.length || new Set(sectionRefs).size !== sectionRefs.length || sectionRefs.some((ref) => !selected.items.some((item) => item.kind === "forecast-comparison" ? item.sides.some((side) => ref === `${item.id}:${side}`) : item.id === ref))) return { status: "needs-input", reason: "invalid-agenda-sections" }
      const wanted = new Set(sectionRefs)
      const items = selected.items
        .filter((item) => item.kind === "forecast-comparison" ? item.sides.some((side) => wanted.has(`${item.id}:${side}`)) : wanted.has(item.id))
        .map((item): ReviewAgendaItem => {
          if (item.kind !== "forecast-comparison") return item
          const sides = item.sides.filter((side) => wanted.has(`${item.id}:${side}`))
          return { ...item, sides, recordRefs: item.recordRefs?.filter((ref) => sides.some((side) => forecastSideRef(item.id, side) === ref)) }
        })
      const current = await preview(selectionRef, items, context)
      if (current.status !== "ok") return current
      const sections = new Map(current.value.sections.map((section) => [section.id, section]))
      const ordered = sectionRefs.map((ref) => sections.get(ref))
      if (ordered.some((section) => !section)) return { status: "unavailable", reason: "agenda-section-removed" }
      if (period && ordered.some((section) => section!.period.start < period.start || section!.period.end > period.end)) return { status: "needs-input", reason: "review-period-does-not-cover-selected-sections" }
      if (ordered.some((section) => sectionDigest(section!) !== selected.digests.get(section!.id))) return { status: "stale", reason: "agenda-preview-changed" }
      if (!await input.revalidate(context)) return { status: "denied", reason: "agenda-authority-unavailable" }
      const completedAt = Date.parse(input.now())
      if (!Number.isFinite(completedAt) || completedAt < at) return { status: "unavailable", reason: "agenda-clock-unavailable" }
      if (completedAt >= selected.expiresAt || selections.get(selectionRef) !== selected || !sameBinding(selected.binding, context.binding)) return { status: "denied", reason: "agenda-selection-unavailable" }
      return { status: "ok", value: structuredClone(sectionRefs.map((ref) => selected.sections.find((section) => section.id === ref)!)) }
    },
    release(selectionRef: string) { selections.delete(selectionRef) },
  }
}

function validAgendaItem(item: unknown): item is ReviewAgendaItem {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false
  const value = item as Record<string, unknown>
  const kindKeys = value.kind === "dashboard" ? ["topic", "selectionRef"] : value.kind === "forecast-comparison" ? ["title", "baseRef", "candidateRef", "currency", "sides"] : value.kind === "procurement-request" ? ["title", "requestRef"] : value.kind === "procurement-supplier" ? ["title", "supplierRef", "fields"] : value.kind === "procurement-contract" ? ["title", "contractRef", "fields"] : undefined
  if (!kindKeys || Object.keys(value).some((key) => !["id", "kind", "period", "recordRefs", "agendaNote", "threadIds", "biView", "outcome", ...kindKeys].includes(key))) return false
  if (typeof value.id !== "string" || !value.id.trim() || !isSfPeriod(value.period) || (value.recordRefs !== undefined && (!Array.isArray(value.recordRefs) || value.recordRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || new Set(value.recordRefs).size !== value.recordRefs.length)) || (value.agendaNote !== undefined && (typeof value.agendaNote !== "string" || value.agendaNote.length > 2000))) return false
  if (value.threadIds !== undefined && (!Array.isArray(value.threadIds) || value.threadIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(value.threadIds).size !== value.threadIds.length)) return false
  if (value.biView !== undefined && (!value.biView || typeof value.biView !== "object" || Array.isArray(value.biView) || Object.keys(value.biView).some((key) => !["viewId", "selectionRef"].includes(key)) || typeof (value.biView as Record<string, unknown>).viewId !== "string" || !(value.biView as Record<string, unknown>).viewId || typeof (value.biView as Record<string, unknown>).selectionRef !== "string" || !(value.biView as Record<string, unknown>).selectionRef)) return false
  if (value.outcome !== undefined && (!value.outcome || typeof value.outcome !== "object" || Array.isArray(value.outcome) || Object.keys(value.outcome).some((key) => !["caseRef", "choiceId"].includes(key)) || typeof (value.outcome as Record<string, unknown>).choiceId !== "string" || !(value.outcome as Record<string, unknown>).choiceId || !validOutcomeCaseRef((value.outcome as Record<string, unknown>).caseRef))) return false
  if (value.kind === "dashboard") return typeof value.topic === "string" && !!value.topic.trim() && typeof value.selectionRef === "string" && !!value.selectionRef.trim()
  if (value.kind === "forecast-comparison") return typeof value.title === "string" && !!value.title.trim() && typeof value.baseRef === "string" && !!value.baseRef.trim() && typeof value.candidateRef === "string" && !!value.candidateRef.trim() && typeof value.currency === "string" && !!value.currency.trim() && Array.isArray(value.sides) && value.sides.every((side) => side === "baseline" || side === "candidate")
  if (value.kind === "procurement-request") return typeof value.title === "string" && !!value.title.trim() && typeof value.requestRef === "string" && !!value.requestRef.trim()
  if (value.kind === "procurement-supplier" || value.kind === "procurement-contract") return typeof value.title === "string" && !!value.title.trim() && typeof (value.kind === "procurement-supplier" ? value.supplierRef : value.contractRef) === "string" && !!(value.kind === "procurement-supplier" ? value.supplierRef : value.contractRef) && Array.isArray(value.fields) && value.fields.length > 0 && value.fields.every((field) => typeof field === "string" && !!field.trim()) && new Set(value.fields).size === value.fields.length
  return false
}

function matchesContext(projection: DomainProjection, context: TrustedDomainContext) {
  return validAgendaProjection(projection) && projection.context.installationId === context.binding.installationId && projection.context.projectId === context.binding.projectId && projection.context.principalRef === context.binding.principalRef && projection.context.accessRevision === context.binding.accessRevision && projection.context.policyVersion === context.binding.policyVersion
}

function validAgendaProjection(projection: DomainProjection) {
  return !!projection && typeof projection === "object" && !!projection.context && isSfPeriod(projection.context.period) && Array.isArray(projection.context.sourceRefs) && projection.context.sourceRefs.every((ref) => !!ref && typeof ref === "object") && Array.isArray(projection.values) && projection.values.every((value) => !!value && typeof value.id === "string" && Array.isArray(value.sourceRefs) && (value.value === null || typeof value.value === "string" || typeof value.value === "boolean" || typeof value.value === "number" && Number.isFinite(value.value))) && Array.isArray(projection.components) && projection.components.every((component) => !!component && Array.isArray(component.sourceRefs) && component.sourceRefs.every((ref) => !!ref && typeof ref === "object") && (component.amount === null || typeof component.amount === "number" && Number.isFinite(component.amount))) && Array.isArray(projection.missing)
}

function digestRefs(refs: readonly string[]) { return JSON.stringify([...refs].sort()) }

function isDashboardTopic(topic: string): topic is DashboardTopic {
  return Object.hasOwn(dashboardTopics, topic)
}

function sameBinding(left: Pick<TrustedDomainContext["binding"], "installationId" | "projectId" | "principalRef" | "accessRevision" | "policyVersion">, right: TrustedDomainContext["binding"]) {
  return left.installationId === right.installationId && left.projectId === right.projectId && left.principalRef === right.principalRef && left.accessRevision === right.accessRevision && left.policyVersion === right.policyVersion
}

/** A repeated authorized observation may advance its timestamp; the selected content and source identity must remain exact. */
function sectionDigest(section: ReviewSection) {
  const source = (ref: SourceRef) => Object.fromEntries(Object.entries(ref).filter(([key]) => key !== "observedAt"))
  return digestSfValue({
    ...section,
    projection: { ...section.projection, context: { ...section.projection.context, sourceRefs: section.projection.context.sourceRefs.map(source) }, components: section.projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(source) })) },
    ...(section.comments ? { comments: section.comments.map((comment) => ({ ...comment, sourceRefs: comment.sourceRefs.map(source) })) } : {}),
  })
}

async function captureReviewChart(section: ReviewSection, item: ReviewAgendaItem, ports: ReviewAgendaPorts, context: TrustedDomainContext): Promise<PortResult<ReviewSection>> {
  const charted = await captureReviewChartData(section, item, ports, context)
  if (charted.status !== "ok") return charted
  const captured = charted.value
  const outcome = item.outcome ? await ports.reviewOutcome?.(item.outcome, context) : undefined
  if (item.outcome && (!outcome || outcome.status !== "ready" || !outcome.observation || !validReviewOutcome(outcome.observation) || !validOutcomeComparison(outcome.comparison) || digestSfValue(outcome.observation.caseRef) !== digestSfValue(item.outcome.caseRef) || digestSfValue(outcome.comparison.caseRef) !== digestSfValue(item.outcome.caseRef) || outcome.comparison.choiceId !== item.outcome.choiceId || digestSfValue(outcome.comparison.observation) !== digestSfValue(outcome.observation))) return { status: "unavailable", reason: "review-outcome-snapshot-unavailable" }
  const comments = item.threadIds?.length ? await Promise.all(item.threadIds.map((id) => ports.threadComments?.capture(id, section.projection.context.sourceRefs, context))) : []
  if (comments.some((comment) => !comment || comment.status !== "ok")) return { status: "unavailable", reason: "thread-access-unavailable" }
  return { status: "ok", value: { ...captured, ...(outcome?.status === "ready" ? { outcome: outcome.observation, outcomeComparison: outcome.comparison } : {}), ...(comments.length ? { comments: comments.flatMap((comment) => comment?.status === "ok" ? comment.value : []) } : {}) } }
}

async function captureReviewChartData(section: ReviewSection, item: ReviewAgendaItem, ports: ReviewAgendaPorts, context: TrustedDomainContext): Promise<PortResult<ReviewSection>> {
  if (!item.biView) return { status: "ok", value: section }
  if (!ports.readBiPresentation || !ports.captureBiReviewChart) return { status: "unavailable", reason: "bi-review-chart-producer-unavailable" }
  const read = await ports.readBiPresentation({ ...item.biView, period: item.period }, context)
  if (read.status !== "ok") return { ...read, reason: "bi-presentation-unavailable" }
  if (digestSfValue(read.value.projection) !== digestSfValue(section.projection) || !matchesContext(read.value.projection, context) || read.value.projection.context.period.start !== item.period.start || read.value.projection.context.period.end !== item.period.end || read.value.presentation.viewId !== item.biView.viewId) return { status: "stale", reason: "bi-presentation-projection-mismatch" }
  return { status: "ok", value: { ...section, chart: ports.captureBiReviewChart(read.value.projection, read.value.presentation) } }
}

function validOutcomeCaseRef(value: unknown): value is ObservedResultProjection["caseRef"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const ref = value as Record<string, unknown>
  return Object.keys(ref).every((key) => ["id", "incarnation", "version"].includes(key)) && typeof ref.id === "string" && !!ref.id.trim() && typeof ref.incarnation === "string" && !!ref.incarnation.trim() && Number.isSafeInteger(ref.version) && (ref.version as number) > 0
}

function forecastSideRef(itemId: string, side: "baseline" | "candidate") {
  return `${itemId}:${side}`
}
