import { expect, test } from "bun:test"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, Period, SourceRef } from "../../../product/contracts/context.ts"
import type { ObservedResultProjection } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewAgendaSelection } from "../../../product/reviews/selection.ts"
import type { DashboardAgendaSelectionRequest, ReviewAgendaItem, ReviewAgendaPorts } from "../../../product/reviews/selection.ts"
import type { ReviewOutcomeComparison } from "../../../product/reviews/outcome.ts"

const year = { start: "2026-01-01", end: "2026-12-31" }
const month = { start: "2026-02-01", end: "2026-02-28" }
const context = { kind: "ui", binding: { principalRef: "principal", installationId: "i", projectId: "p", accessRevision: "access", policyVersion: "policy" } } as unknown as TrustedDomainContext
const pages = {
  budget: "Budget Overview",
  projects: "Portfolio Dashboard",
  "hot-topics": "Hot Topics & Actions",
  "talent-review": "Talent Review",
  "opex-detail": "OPEX Detail",
  "capex-projects": "CAPEX Projects",
  headcount: "Headcount Overview",
  "team-structure": "Team Structure",
  "all-projects": "All Projects",
  "it-operations": "IT Operations",
  "it-security": "IT Security KPIs",
  "it-risks": "IT Risks",
  "vendor-contracts": "Vendor Contracts",
  stakeholders: "Stakeholder Management",
  executive: "Executive Dashboard",
  "it-performance": "IT Performance Contract",
} as const

function fixture(options: { now?: () => string; maxSelections?: number } = {}) {
  const state = {
    access: true,
    talentAccess: false,
    records: Object.fromEntries(Object.keys(pages).map((topic) => [topic, [`${topic}-1`, `${topic}-2`]])) as Record<string, string[]>,
    calls: [] as DashboardAgendaSelectionRequest[],
    projections: new Map<string, DomainProjection>(),
  }
  const ports: ReviewAgendaPorts = {
    planner: {} as ReviewAgendaPorts["planner"],
    procurement: {} as ReviewAgendaPorts["procurement"],
    selectDashboardAgenda: async (request) => {
      state.calls.push(request)
      if (request.topic === "talent-review" && !state.talentAccess) return { status: "denied", reason: "access-unavailable" }
      if (request.topic === "it-operations" && request.recordRefs?.length === 1) return { status: "unavailable", reason: "agenda-record-projection-unavailable" }
      const available = state.records[request.topic] ?? []
      const recordRefs = request.recordRefs ?? available
      if (recordRefs.some((ref) => !available.includes(ref))) return { status: "unavailable", reason: "agenda-record-unavailable" }
      const page = pages[request.topic as keyof typeof pages]
      if (!page) return { status: "unavailable", reason: "agenda-source-identity-unavailable" }
      const projection = dashboardProjection(request.topic, page, request.period, recordRefs)
      state.projections.set(request.selectionRef, projection)
      return { status: "ok", value: { projection, recordRefs, recordCount: recordRefs.length } }
    },
  }
  const agenda = createReviewAgendaSelection({ ports, revalidate: async () => state.access, now: options.now ?? (() => "2026-11-13T00:00:00Z"), ...(options.maxSelections === undefined ? {} : { maxSelections: options.maxSelections }) })
  return { agenda, ports, state }
}

function dashboardProjection(topic: string, page: string, period: Period, refs: readonly string[]): DomainProjection {
  const sourceRef: SourceRef = { surface: "dashboard", type: "dashboard-page", id: page, incarnation: `inc-${topic}`, version: 1, fields: ["value"], period, observedAt: "2026-11-13T00:00:00Z" }
  return {
    version: 1,
    engineVersion: "dashboard-v1",
    context: { installationId: "i", projectId: "p", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period, currency: "USD", sourceRefs: [sourceRef], capabilities: [] },
    values: refs.map((ref, index) => {
      const evidence = recordEvidence(topic, ref, period)
      return { id: `${topic}[${encodeURIComponent(ref)}].value`, value: index + 1, currency: "USD", period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }
    }),
    components: [],
    missing: [],
  }
}

function recordEvidence(topic: string, recordId: string, period: Period): BusinessEvidenceRef {
  const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: `evidence:${topic}:${recordId}`, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: topic, recordId, incarnation: `inc-${recordId}`, version: 1, fields: ["value"], period, projectionDigest: `projection:${recordId}` } }
  return { ...ref, refDigest: digestSfEvidenceRef(ref) }
}

test("agenda keeps exact records, chosen order, periods and notes without mutating Dashboard", async () => {
  const { agenda, state } = fixture()
  const before = structuredClone(state.records)
  const created = await agenda.create([
    { id: "budget", kind: "dashboard", topic: "budget", selectionRef: "budget-source", period: year, recordRefs: ["budget-1"], agendaNote: "Budget note" },
    { id: "projects", kind: "dashboard", topic: "projects", selectionRef: "project-source", period: year, recordRefs: ["projects-2"], agendaNote: "Project note" },
    { id: "hot", kind: "dashboard", topic: "hot-topics", selectionRef: "hot-source", period: year },
  ], context)
  if (created.status !== "ok") throw new Error(created.reason)
  expect(created.value.sections.map((section) => [section.id, section.recordCount, section.agendaNote, section.projection.values.length])).toEqual([
    ["budget", 1, "Budget note", 1],
    ["projects", 1, "Project note", 1],
    ["hot", 2, undefined, 2],
  ])
  expect(created.value.sections[0]?.projection.values[0]?.value).toBe(1)
  expect(created.value.agendaNotes).toEqual([{ sectionRef: "budget", text: "Budget note" }, { sectionRef: "projects", text: "Project note" }])
  expect(created.value.sectionRecordRefs).toEqual([
    { sectionRef: "budget", recordRefs: ["budget-1"] },
    { sectionRef: "projects", recordRefs: ["projects-2"] },
    { sectionRef: "hot", recordRefs: ["hot-topics-1", "hot-topics-2"] },
  ])
  expect(state.records).toEqual(before)
  const ordered = await agenda.select(created.value.selectionRef, ["hot", "projects"], context, year)
  if (ordered.status !== "ok") throw new Error(ordered.reason)
  expect(ordered.value.map((section) => section.id)).toEqual(["hot", "projects"])
  expect(ordered.value[1]?.agendaNote).toBe("Project note")
  expect(ordered.value[1]?.recordCount).toBe(1)
})

test("agenda preserves each competence, represents empty sections and handles removals", async () => {
  const { agenda, state } = fixture()
  const mixed = await agenda.create([
    { id: "annual", kind: "dashboard", topic: "budget", selectionRef: "budget-source", period: year },
    { id: "monthly", kind: "dashboard", topic: "it-security", selectionRef: "security-source", period: month },
    { id: "empty", kind: "dashboard", topic: "hot-topics", selectionRef: "hot-source", period: month, recordRefs: [] },
  ], context)
  if (mixed.status !== "ok") throw new Error(mixed.reason)
  expect(mixed.value.sections.map((section) => [section.id, section.period, section.recordCount, section.projection.values.length])).toEqual([
    ["annual", year, 2, 2],
    ["monthly", month, 2, 2],
    ["empty", month, 0, 0],
  ])
  const selected = await agenda.create([{ id: "project", kind: "dashboard", topic: "projects", selectionRef: "project-source", period: year, recordRefs: ["projects-2"] }], context)
  if (selected.status !== "ok") throw new Error(selected.reason)
  state.records.projects = ["projects-1"]
  expect((await agenda.select(selected.value.selectionRef, ["project"], context, year)).status).toBe("unavailable")
  expect((await agenda.select(selected.value.selectionRef, ["annual"], context, year)).status).toBe("needs-input")
})

test("agenda handles all Dashboard topic IDs and fails closed for unsupported or private topics", async () => {
  const { agenda, state } = fixture()
  state.talentAccess = true
  const topics = Object.keys(pages)
  const selected = await agenda.create(topics.map((topic) => ({ id: topic, kind: "dashboard" as const, topic, selectionRef: `source:${topic}`, period: year })), context)
  if (selected.status !== "ok") throw new Error(selected.reason)
  expect(selected.value.sections.map((section) => section.projection.context.sourceRefs[0]?.id)).toEqual(Object.values(pages))
  const calls = state.calls.length
  for (const topic of ["unknown-topic"]) {
    const result = await agenda.create([{ id: topic, kind: "dashboard", topic, selectionRef: `source:${topic}`, period: year }], context)
    expect(result.status).toBe("unavailable")
  }
  expect(state.calls).toHaveLength(calls)
  state.talentAccess = false
  const privateResult = await agenda.create([{ id: "private", kind: "dashboard", topic: "talent-review", selectionRef: "private-source", period: year, agendaNote: "private note" }], context)
  expect(privateResult.status).toBe("denied")
  expect("value" in privateResult).toBe(false)
  expect(state.calls.at(-1)?.topic).toBe("talent-review")
  const operationalSubset = await agenda.create([{ id: "ops", kind: "dashboard", topic: "it-operations", selectionRef: "ops-source", period: month, recordRefs: ["it-operations-1"] }], context)
  expect(operationalSubset).toEqual({ status: "unavailable", reason: "agenda-record-projection-unavailable" })
})

test("agenda rejects invalid producer counts and preserves producer failure reasons", async () => {
  const { ports, state } = fixture()
  const actual = ports.selectDashboardAgenda
  const agenda = createReviewAgendaSelection({
    ports: { ...ports, selectDashboardAgenda: async (request) => {
      const result = await actual(request, context)
      if (request.topic !== "projects" || result.status !== "ok") return result
      return { ...result, value: { ...result.value, recordCount: result.value.recordCount + 1 } }
    } },
    revalidate: async () => state.access,
    now: () => "2026-11-13T00:00:00Z",
  })
  expect((await agenda.create([{ id: "projects", kind: "dashboard", topic: "projects", selectionRef: "project-source", period: year }], context)).status).toBe("unavailable")
  state.records.projects = []
  const emptyProducer = await ports.selectDashboardAgenda({ selectionRef: "empty", topic: "projects", period: year, recordRefs: [] }, context)
  if (emptyProducer.status !== "ok") throw new Error(emptyProducer.reason)
  expect(emptyProducer.value).toMatchObject({ recordRefs: [], recordCount: 0, projection: { values: [], components: [], missing: [] } })
})

test("agenda retains C06 comments, WP05 chart capture and WP14 outcome snapshots only when requested", async () => {
  const { ports, state } = fixture()
  const observation: ObservedResultProjection = {
    caseRef: { id: "case-1", incarnation: "case-inc", version: 2 },
    expected: 90,
    observed: 95,
    cutoff: "2026-11-13T00:00:00Z",
    currency: "USD",
    sourceRefs: [recordEvidence("outcome", "result-1", year)],
    limitations: [],
  }
  const comparison: ReviewOutcomeComparison = {
    status: "comparable",
    caseRef: observation.caseRef,
    choiceId: "choice-1",
    criterionRef: "criterion-1",
    unit: "USD",
    currency: "USD",
    period: year,
    expected: 90,
    observed: 95,
    delta: 5,
    cutoff: observation.cutoff,
    sourceRefs: observation.sourceRefs,
    baselineRefs: observation.sourceRefs,
    limitations: [],
    compatibility: { compatible: true, metric: true, unit: true, period: true, currency: true, coverage: "complete" },
    summary: { facts: ["Observed result available"], pending: [], causality: "not-attributed" },
    observation,
  }
  const calls: string[] = []
  const wiredPorts: ReviewAgendaPorts = {
    ...ports,
    readBiPresentation: async (request) => {
      const projection = state.projections.get(request.selectionRef)
      return projection ? { status: "ok", value: { projection, presentation: { viewId: "BI01", series: [], limitations: [] } } } : { status: "unavailable", reason: "projection-unavailable" }
    },
    captureBiReviewChart: (_projection, presentation) => {
      calls.push(`chart:${presentation.viewId}`)
      return { status: "unavailable", reason: "no-captured-series" }
    },
    threadComments: { capture: async (threadId, sources) => {
      calls.push(`thread:${threadId}`)
      return { status: "ok", value: [{ id: "comment-1", version: 3, content: "Review context", authorRef: "author-1", createdAt: "2026-11-13T00:00:00Z", sourceRefs: sources }] }
    } },
    reviewOutcome: async (request) => request.choiceId === comparison.choiceId && request.caseRef.id === comparison.caseRef.id ? { status: "ready", observation, comparison } : { status: "unavailable" },
  }
  const agenda = createReviewAgendaSelection({ ports: wiredPorts, revalidate: async () => state.access, now: () => "2026-11-13T00:00:00Z" })
  const selected = await agenda.create([{ id: "review", kind: "dashboard", topic: "budget", selectionRef: "budget-source", period: year, agendaNote: "Agenda-only note", threadIds: ["thread-1"], biView: { viewId: "BI01", selectionRef: "budget-source" }, outcome: { caseRef: observation.caseRef, choiceId: comparison.choiceId } }], context)
  if (selected.status !== "ok") throw new Error(selected.reason)
  expect(selected.value.sections[0]).toMatchObject({ agendaNote: "Agenda-only note", chart: { status: "unavailable", reason: "no-captured-series" }, comments: [{ id: "comment-1", version: 3, content: "Review context" }], outcome: observation, outcomeComparison: comparison })
  expect(calls).toEqual(["chart:BI01", "thread:thread-1"])
  expect(selected.value.sections[0]?.projection.values[0]?.value).toBe(1)
  expect(selected.value.gaps.some((gap) => gap.id === "outcome-comparison-not-requested")).toBe(false)
  const missingAdapter = createReviewAgendaSelection({ ports, revalidate: async () => state.access, now: () => "2026-11-13T00:00:00Z" })
  expect((await missingAdapter.create([{ id: "outcome", kind: "dashboard", topic: "budget", selectionRef: "budget-source", period: year, outcome: { caseRef: observation.caseRef, choiceId: comparison.choiceId } }], context)).status).toBe("unavailable")
})

test("agenda selection is bounded, expires, revalidates authority and rejects hostile runtime inputs", async () => {
  let now = "2026-11-13T00:00:00Z"
  const { agenda } = fixture({ now: () => now, maxSelections: 1 })
  const item: ReviewAgendaItem = { id: "budget", kind: "dashboard", topic: "budget", selectionRef: "budget-source", period: year }
  const first = await agenda.create([item], context)
  if (first.status !== "ok") throw new Error(first.reason)
  expect((await agenda.create([item], context)).status).toBe("unavailable")
  expect((await agenda.preview("hostile", [null] as unknown as readonly ReviewAgendaItem[], context)).status).toBe("needs-input")
  const hostileActor = { ...item, principalRef: "other" }
  const hostileProvider = { ...item, biView: { viewId: "BI01", selectionRef: "source", provider: "external" } }
  expect((await agenda.preview("hostile", [hostileActor], context)).status).toBe("needs-input")
  expect((await agenda.preview("hostile", [hostileProvider], context)).status).toBe("needs-input")
  expect((await agenda.select(first.value.selectionRef, [null] as unknown as readonly string[], context)).status).toBe("needs-input")
  now = "2026-11-13T00:15:00Z"
  expect((await agenda.select(first.value.selectionRef, ["budget"], context)).status).toBe("denied")
  const next = await agenda.create([item], context)
  expect(next.status).toBe("ok")
})

test("agenda delegates singleton topic availability to the authenticated producer", async () => {
  const { ports } = fixture()
  const agenda = createReviewAgendaSelection({ ports: { ...ports, selectDashboardAgenda: async () => ({ status: "unavailable", reason: "agenda-source-identity-unavailable" }) }, revalidate: async () => true, now: () => "2026-11-13T00:00:00Z" })
  for (const topic of ["executive", "it-performance"]) {
    expect(await agenda.create([{ id: topic, kind: "dashboard", topic, selectionRef: "source", period: year }], context)).toEqual({ status: "unavailable", reason: "agenda-source-identity-unavailable" })
  }
})

test("agenda pins caller input before awaiting authority and does not adopt a mutated binding", async () => {
  const { ports } = fixture()
  const item: ReviewAgendaItem = { id: "projects", kind: "dashboard", topic: "projects", selectionRef: "source", period: year, agendaNote: "original" }
  const agenda = createReviewAgendaSelection({ ports, revalidate: async () => { item.id = "changed"; item.agendaNote = "changed"; return true }, now: () => "2026-11-13T00:00:00Z" })
  const created = await agenda.create([item], context)
  if (created.status !== "ok") throw new Error(created.reason)
  expect(created.value.sections.map((section) => [section.id, section.agendaNote])).toEqual([["projects", "original"]])
  expect((await agenda.select(created.value.selectionRef, ["projects"], context)).status).toBe("ok")
  const changedContext = { ...context, binding: { ...context.binding, accessRevision: "later-access" } } as TrustedDomainContext
  expect((await agenda.select(created.value.selectionRef, ["projects"], changedContext)).status).toBe("denied")
})

test("released or expired selection is refused after an in-flight producer read", async () => {
  const { ports } = fixture()
  const phase = { reading: false, now: "2026-11-13T00:00:00Z", release: () => {} }
  const agenda = createReviewAgendaSelection({ ports: { ...ports, selectDashboardAgenda: async (request, binding) => {
    const result = await ports.selectDashboardAgenda(request, binding)
    if (phase.reading) phase.release()
    return result
  } }, revalidate: async () => true, now: () => phase.now })
  const item: ReviewAgendaItem = { id: "projects", kind: "dashboard", topic: "projects", selectionRef: "source", period: year }
  const created = await agenda.create([item], context)
  if (created.status !== "ok") throw new Error(created.reason)
  phase.reading = true
  phase.release = () => agenda.release(created.value.selectionRef)
  expect((await agenda.select(created.value.selectionRef, ["projects"], context)).status).toBe("denied")
  phase.reading = false
  const next = await agenda.create([item], context)
  if (next.status !== "ok") throw new Error(next.reason)
  phase.reading = true
  phase.release = () => { phase.now = "2026-11-13T00:15:00Z" }
  expect((await agenda.select(next.value.selectionRef, ["projects"], context)).status).toBe("denied")
})

test("selection refuses changed preview content while retaining its original observation time", async () => {
  const { ports } = fixture()
  const source = { value: 1320, observedAt: "2026-11-13T00:00:00Z" }
  const agenda = createReviewAgendaSelection({ ports: { ...ports, selectDashboardAgenda: async (request, binding) => {
    const result = await ports.selectDashboardAgenda(request, binding)
    if (result.status !== "ok") return result
    return { status: "ok", value: { ...result.value, projection: { ...result.value.projection, context: { ...result.value.projection.context, sourceRefs: result.value.projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: source.observedAt })) }, values: result.value.projection.values.map((value) => ({ ...value, value: source.value })) } } }
  } }, revalidate: async () => true, now: () => "2026-11-13T00:00:00Z" })
  const item: ReviewAgendaItem = { id: "budget", kind: "dashboard", topic: "budget", selectionRef: "source", period: year }
  const initial = await agenda.create([item], context)
  if (initial.status !== "ok") throw new Error(initial.reason)
  source.observedAt = "2026-11-13T00:01:00Z"
  const unchanged = await agenda.select(initial.value.selectionRef, ["budget"], context)
  if (unchanged.status !== "ok") throw new Error(unchanged.reason)
  expect(unchanged.value[0]?.projection.context.sourceRefs[0]?.observedAt).toBe("2026-11-13T00:00:00Z")
  source.value = 1400
  expect(await agenda.select(initial.value.selectionRef, ["budget"], context)).toEqual({ status: "stale", reason: "agenda-preview-changed" })
  const refreshed = await agenda.create([item], context)
  if (refreshed.status !== "ok") throw new Error(refreshed.reason)
  expect(refreshed.value.selectionRef).not.toBe(initial.value.selectionRef)
  expect(refreshed.value.sections[0]?.projection.values[0]?.value).toBe(1400)
  expect(initial.value.sections[0]?.projection.values[0]?.value).toBe(1320)
})

