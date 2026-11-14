import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, RoutineResult, SourceRef } from "../../../product/contracts/context.ts"
import type { JsonValue } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import { createRoutineReviewResultReader } from "../../../product/routines/review-result.ts"
import { createReviewRoutinePreparation } from "../../../product/routines/review-host.ts"
import { createRoutineResultAccess, routineArtifactDigest } from "../../../product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"

const period = { start: "2027-01-01", end: "2027-01-31" }

// Real review preparation and authenticated result adapters; native storage/provider are explicit boundary fixtures.
async function fixture() {
  const context = { kind: "ui", binding: { installationId: "installation", principalRef: "owner", projectId: "project", accessRevision: "1", policyVersion: "1" } } as TrustedDomainContext
  const source: SourceRef = { surface: "dashboard", type: "dashboard-page", id: "Budget Overview", incarnation: "source-inc", version: 1, fields: ["summary"], period, observedAt: "2026-11-14T00:00:00Z" }
  const evidenceBody: Omit<Extract<BusinessEvidenceRef, { kind: "record" }>, "refDigest"> = { schema: "sf-evidence-v1", kind: "record", refId: "source-ref", installationId: "installation", projectId: "project", evidenceLevel: "observed", target: { surface: source.surface, recordType: source.type, recordId: source.id, incarnation: source.incarnation, version: source.version, fields: source.fields, period, projectionDigest: digestSfValue({ total: 12000 }) } }
  const evidence: BusinessEvidenceRef = { ...evidenceBody, refDigest: digestSfEvidenceRef({ ...evidenceBody, refDigest: "" }) }
  const projection: DomainProjection = { context: { ...context.binding, surface: "dashboard", period, currency: "USD", sourceRefs: [source], capabilities: [] }, version: 1, engineVersion: "dashboard-v1", components: [], missing: [],
    values: [{ id: "total", value: 12000, unit: "USD", currency: "USD", period, granularity: "aggregate", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }] }
  const section: ReviewSection = { id: "budget", title: "Budget", period, recordCount: 1, projection, agendaNote: "Discuss the recorded change", comments: [{ id: "comment-1", version: 1, content: "Captured comment", authorRef: "owner", createdAt: source.observedAt, sourceRefs: [source] }],
    chart: { status: "ok", viewId: "budget", series: [{ id: "series", label: "Budget", unit: "USD", role: "value", valueIds: ["total"], values: projection.values }], limitations: [], unassigned: [] } }
  const prepared = await prepareFactualReview({ topicRefs: [section.id], period, context, host: { readTopic: async () => ({ status: "ok", value: { projection, recordCount: 1, confirmation: null } }), revalidate: async () => true } })
  if (prepared.status !== "ok") throw new Error("review preparation failed")
  const agendaSnapshot: Omit<ReviewAgendaPreview, "selectionRef"> = { sectionRefs: [section.id], sections: [section], sectionRecordRefs: [{ sectionRef: section.id, recordRefs: ["record-1"] }], agendaNotes: [{ sectionRef: section.id, text: section.agendaNote! }], gaps: [] }
  const content = { ...prepared.value, draft: { ...prepared.value.draft, sections: prepared.value.draft.sections.map((part) => ({ ...part, title: section.title })) }, agendaSnapshot }
  const run: RoutineResult = { admission: "admitted", admissionRef: "admission", admissionVersion: 1, documentId: "sf-review-recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [source], pending: [], runRef: "run", resultRef: "result" }
  const body: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "run", resultRef: "result", correlationId: "correlation", documentId: "sf-review-recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", inputDigest: digestSfValue({ source: "admitted" }), sourceRefs: [source], content: content as unknown as JsonValue, createdAt: "2026-11-14T00:00:00Z" }
  const output: RoutineArtifact = { ...body, outputDigest: routineArtifactDigest(body) }
  const execution: RoutineExecutionSnapshot = { runRef: "run", resultRef: "result", state: "completed", revision: "terminal-1", outputDigest: output.outputDigest }
  const state = { allowed: true, reviewAllowed: true, evidenceAllowed: true, evidenceReads: [] as (readonly BusinessEvidenceRef[])[], reviewReads: [] as string[][] }
  const access = createRoutineResultAccess({ routines: { readRun: async () => ({ status: "ok", value: run }) }, expectedInputDigest: async () => ({ status: "ok", value: body.inputDigest }),
    readExecution: async () => ({ status: "ok", value: execution }), readArtifact: async () => ({ status: "ok", value: output }), authorize: async () => state.allowed, revalidateArtifact: async () => state.allowed })
  const reader = createRoutineReviewResultReader({ openResult: access.readResult, authorizeReview: async (_context, snapshot) => {
    state.reviewReads.push(snapshot.comments.map((comment) => comment.id))
    return state.reviewAllowed
  }, revalidateEvidence: async (_context, refs) => {
    state.evidenceReads = [...state.evidenceReads, structuredClone(refs)]
    return state.evidenceAllowed && refs.every((ref) => ref.refDigest === evidence.refDigest)
  } })
  const seal = () => { const { outputDigest: _digest, ...changed } = output; output.outputDigest = routineArtifactDigest(changed); execution.outputDigest = output.outputDigest }
  return { context, source, projection, section, content, output, execution, state, access, reader, seal }
}

test("C07 factual review retains the entire selected agenda after the transient selection is gone", async () => {
  const f = await fixture()
  const read = await f.reader.read("run", f.context)
  expect(read.status).toBe("ok")
  if (read.status !== "ok") throw new Error(read.reason)
  expect(read.value.agendaSnapshot?.sections).toEqual([f.section])
  expect(read.value.agendaSnapshot?.sections[0]?.comments?.[0]?.content).toBe("Captured comment")
  expect(read.value.agendaSnapshot?.sections[0]?.chart).toEqual(f.section.chart)
  expect(read.value.agendaSnapshot?.agendaNotes).toEqual([{ sectionRef: "budget", text: "Discuss the recorded change" }])
  expect(read.value.agendaSnapshot).not.toHaveProperty("selectionRef")
  expect(read.value.draft.coverage.includedRecordCount).toBe(1)
  f.section.agendaNote = "Later source text"
  expect(read.value.agendaSnapshot?.sections[0]?.agendaNote).toBe("Discuss the recorded change")
})

test("old factual results remain previewable without fabricating a preservable agenda", async () => {
  const f = await fixture()
  const { agendaSnapshot: _snapshot, ...legacy } = f.content
  f.output.content = legacy as unknown as JsonValue
  f.seal()
  const read = await f.reader.read("run", f.context)
  expect(read.status).toBe("ok")
  if (read.status !== "ok") throw new Error(read.reason)
  expect(read.value).not.toHaveProperty("agendaSnapshot")
  expect(read.value.draft.sections).toHaveLength(1)
})

test.each(["count", "records", "note", "section-order"])("the immutable result rejects a mismatched %s in its agenda", async (field) => {
  const f = await fixture()
  if (field === "count") f.content.agendaSnapshot.sections[0]!.recordCount = 2
  if (field === "records") f.content.agendaSnapshot.sectionRecordRefs = [{ sectionRef: "budget", recordRefs: ["record-1", "record-2"] }]
  if (field === "note") f.content.agendaSnapshot.agendaNotes = [{ sectionRef: "budget", text: "Substituted note" }]
  if (field === "section-order") f.content.agendaSnapshot.sectionRefs = ["different-section"]
  f.seal()
  expect(await f.reader.read("run", f.context)).toEqual({ status: "unavailable", reason: "routine-review-agenda-invalid" })
})

test("a result cannot introduce a section source outside the admitted immutable source set", async () => {
  const f = await fixture()
  f.content.draft.sections[0]!.sourceRefs = [{ ...f.source, id: "private-source-sentinel" }]
  f.seal()
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "unavailable", reason: "routine-review-draft-invalid" })
  expect(JSON.stringify(read)).not.toContain("private-source-sentinel")
})

test("revocation denies factual draft, comments and charts together on every reopening", async () => {
  const f = await fixture()
  expect((await f.reader.read("run", f.context)).status).toBe("ok")
  f.state.allowed = false
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "denied", reason: "routine-result-unavailable" })
  expect(JSON.stringify(read)).not.toContain("Captured comment")
  expect(JSON.stringify(read)).not.toContain("12000")
})

test("failed native execution cannot be reclassified as a factual review even with an old result", async () => {
  const f = await fixture()
  f.execution.state = "failed"
  expect(await f.reader.read("run", f.context)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
})

test("a chart containing a different value is rejected before any review content is returned", async () => {
  const f = await fixture()
  if (f.section.chart?.status !== "ok") throw new Error("chart fixture unavailable")
  f.section.chart.series[0]!.values = [{ ...f.projection.values[0]!, value: 999999 }]
  f.seal()
  expect(await f.reader.read("run", f.context)).toEqual({ status: "unavailable", reason: "routine-review-agenda-invalid" })
})

test("revoked nested evidence denies the entire factual result even when outer source access still succeeds", async () => {
  const f = await fixture()
  f.state.evidenceAllowed = false
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "denied", reason: "routine-review-evidence-unavailable" })
  expect(f.state.evidenceReads.flat().map((ref) => ref.refId)).toContain("source-ref")
  expect(JSON.stringify(read)).not.toContain("Captured comment")
  expect(JSON.stringify(read)).not.toContain("12000")
})

test("revoked comment or decision access denies the snapshot despite authorized outer sources and C17 evidence", async () => {
  const f = await fixture()
  f.state.reviewAllowed = false
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "denied", reason: "routine-review-access-unavailable" })
  expect(f.state.reviewReads.flat()).toContain("comment-1")
  expect(JSON.stringify(read)).not.toContain("Captured comment")
  expect(JSON.stringify(read)).not.toContain("12000")
})

test.each(["projection", "value", "context", "missing", "chart", "comment", "pending"])("an authenticated artifact cannot expose unknown nested %s bytes", async (part) => {
  const f = await fixture()
  const sentinel = { privateDiagnostic: "restricted-nested-sentinel" }
  const projections = [f.content.draft.sections[0]!.content, f.content.agendaSnapshot.sections[0]!.projection]
  if (part === "projection") projections.forEach((projection) => Object.assign(projection, sentinel))
  if (part === "value") projections.forEach((projection) => Object.assign(projection.values[0]!, sentinel))
  if (part === "context") projections.forEach((projection) => Object.assign(projection.context, sentinel))
  if (part === "missing") projections.forEach((projection) => { projection.missing = [{ field: "source", reason: "missing", ...sentinel }] })
  if (part === "chart") f.content.agendaSnapshot.sections[0]!.chart = { status: "unavailable", reason: "not-selected", ...sentinel }
  if (part === "comment") Object.assign(f.content.agendaSnapshot.sections[0]!.comments![0]!, sentinel)
  if (part === "pending") f.content.draft.pendencies[0]!.missing = [{ field: "source", reason: "missing", ...sentinel }]
  f.seal()
  const read = await f.reader.read("run", f.context)
  expect(read.status).toBe("unavailable")
  expect(JSON.stringify(read)).not.toContain("restricted-nested-sentinel")
})

test.each(["drilldown", "comparison"])("a distinct nested %s is independently authorized by C17", async (part) => {
  const f = await fixture()
  const evidence = structuredClone(f.projection.values[0]!.sourceRefs[0]!)
  evidence.refId = "nested-private-evidence"
  if (evidence.kind !== "record") throw new Error("record evidence fixture required")
  evidence.target.recordId = "private-record"
  evidence.refDigest = digestSfEvidenceRef(evidence)
  for (const projection of [f.content.draft.sections[0]!.content, f.content.agendaSnapshot.sections[0]!.projection]) {
    if (part === "drilldown") projection.values[0]!.drilldown = evidence
    if (part === "comparison") projection.comparison = { metricRef: "total", comparisonRef: "private-comparison", context: projection.context,
      version: 1, engineVersion: "dashboard-v1", values: [{ ...projection.values[0]!, sourceRefs: [evidence], drilldown: evidence }] }
  }
  f.seal()
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "denied", reason: "routine-review-evidence-unavailable" })
  expect(f.state.evidenceReads.flat().map((ref) => ref.refId)).toContain("nested-private-evidence")
  expect(JSON.stringify(read)).not.toContain("12000")
})

test("a comparison cannot introduce an unadmitted source even when the outer source is valid", async () => {
  const f = await fixture()
  for (const projection of [f.content.draft.sections[0]!.content, f.content.agendaSnapshot.sections[0]!.projection]) {
    projection.comparison = { metricRef: "total", comparisonRef: "other", context: { ...projection.context, sourceRefs: [{ ...f.source, id: "unadmitted-comparison-source" }] },
      version: 1, engineVersion: "dashboard-v1", values: projection.values }
  }
  f.seal()
  const read = await f.reader.read("run", f.context)
  expect(read).toEqual({ status: "unavailable", reason: "routine-review-draft-invalid" })
  expect(JSON.stringify(read)).not.toContain("unadmitted-comparison-source")
})

test("nested evidence is rechecked after the final authenticated output reopening", async () => {
  const f = await fixture()
  const reads: string[] = []
  const reader = createRoutineReviewResultReader({ openResult: async (runRef, context) => {
    const result = await f.access.readResult(runRef, context)
    reads.push(runRef)
    if (reads.length === 2) f.state.evidenceAllowed = false
    return result
  }, authorizeReview: async () => true, revalidateEvidence: async () => f.state.evidenceAllowed })
  const read = await reader.read("run", f.context)
  expect(reads).toEqual(["run", "run"])
  expect(read).toEqual({ status: "denied", reason: "routine-review-evidence-unavailable" })
  expect(JSON.stringify(read)).not.toContain("Captured comment")
})

test.each(["unavailable-source", "period-mismatch"])("%s releases the selection instead of producing an incomplete preservable snapshot", async (cause) => {
  const f = await fixture()
  const released: string[] = []
  const prepare = createReviewRoutinePreparation({
    agenda: { create: async () => ({ status: "ok", value: { selectionRef: "selection", ...f.content.agendaSnapshot } }), release: (ref) => { released.push(ref) } },
    reviews: { preview: async () => ({ status: "ok", value: [f.section] }), read: async () => ({ status: "unavailable", reason: "no-prior-review" }) },
    confirmationFor: async () => cause === "unavailable-source" ? { status: "unavailable", reason: "source-unavailable" } : { status: "ok", value: null },
    revalidate: async () => true,
  })
  const read = await prepare({ items: [], period: cause === "period-mismatch" ? { start: "2027-02-01", end: "2027-02-28" } : period }, f.context)
  expect(read).toEqual({ status: "unavailable", reason: "review-section-unavailable" })
  expect(released).toEqual(["selection"])
  expect(read).not.toHaveProperty("value")
})

test("explicit agenda gaps remain present alongside the complete selected section snapshot", async () => {
  const f = await fixture()
  const gaps = [{ id: "empty-topic", reason: "no-selected-records" }]
  const prepare = createReviewRoutinePreparation({
    agenda: { create: async () => ({ status: "ok", value: { selectionRef: "selection", ...f.content.agendaSnapshot, gaps } }), release: () => {} },
    reviews: { preview: async () => ({ status: "ok", value: [f.section] }), read: async () => ({ status: "unavailable", reason: "no-prior-review" }) },
    confirmationFor: async () => ({ status: "ok", value: null }), revalidate: async () => true,
  })
  expect(await prepare({ items: [], period }, f.context)).toMatchObject({ status: "ok", value: {
    agendaGaps: gaps, agendaSnapshot: { sectionRefs: ["budget"], sections: [f.section], gaps }, draft: { coverage: { selectedTopics: 1, includedTopics: 1 } },
  } })
})
