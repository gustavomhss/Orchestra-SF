import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, RoutineResult, SourceRef } from "../../../product/contracts/context.ts"
import type { JsonValue } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import { createRoutineResultAccess, routineArtifactDigest } from "../../../product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"
import { createRoutineReviewResultReader } from "../../../product/routines/review-result.ts"
import { createSfRoutineProduct } from "../../../product/routines/factory.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"

// Product C07 verification and factual preparation are real. The admitted run,
// execution and artifact backend below are explicit fixtures, not native execution.
export async function reviewRoutineFixture(context: TrustedDomainContext) {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source: SourceRef = { surface: "procurement", type: "requests", id: "request-1", incarnation: "request-original", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" }
  const unsigned: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "request-evidence", installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType: "requests", recordId: source.id, incarnation: source.incarnation, version: 1, fields: source.fields, period, projectionDigest: digestSfValue({ amount: 1320 }) } }
  const evidence = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
  const projection: DomainProjection = { context: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement", period, currency: "USD", sourceRefs: [source], capabilities: [] }, version: 1, engineVersion: "fixture-procurement-v1", components: [], missing: [], values: [{ id: "request.amount", value: 1320, currency: "USD", period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }] }
  const section: ReviewSection = { id: "request", title: "Procurement request", period, recordCount: 1, projection, agendaNote: "Discuss the preserved source" }
  const prepared = await prepareFactualReview({ topicRefs: [section.id], period, context, host: { readTopic: async () => ({ status: "ok", value: { projection, recordCount: 1, confirmation: null } }), revalidate: async () => true } })
  if (prepared.status !== "ok") throw new Error(prepared.reason)
  const agendaSnapshot: Omit<ReviewAgendaPreview, "selectionRef"> = { sectionRefs: [section.id], sections: [section], sectionRecordRefs: [{ sectionRef: section.id, recordRefs: ["request-1"] }], agendaNotes: [{ sectionRef: section.id, text: section.agendaNote! }], gaps: [] }
  const content = structuredClone({ ...prepared.value, draft: { ...prepared.value.draft, sections: prepared.value.draft.sections.map((value) => ({ ...value, title: section.title })) }, agendaSnapshot })
  const run: RoutineResult = { admission: "admitted", admissionRef: "fixture-admission", admissionVersion: 1, documentId: "sf-review-recipe", publishedVersion: "v1", principalRef: context.binding.principalRef, projectId: context.binding.projectId, correlationId: "fixture-correlation", sourceRefs: [source], pending: [], runRef: "fixture-run", resultRef: "fixture-result" }
  const artifact: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "fixture-run", resultRef: "fixture-result", correlationId: run.correlationId, documentId: run.documentId, publishedVersion: run.publishedVersion, principalRef: context.binding.principalRef, projectId: context.binding.projectId, inputDigest: digestSfValue({ source: "fixture-admitted" }), sourceRefs: [source], content: content as unknown as JsonValue, createdAt: "2026-11-13T00:00:00Z" }
  const output: RoutineArtifact = { ...artifact, outputDigest: routineArtifactDigest(artifact) }
  const execution: RoutineExecutionSnapshot = { runRef: run.runRef!, resultRef: run.resultRef!, state: "completed", revision: "fixture-terminal-1", outputDigest: output.outputDigest }
  const state = { allowed: true, reads: 0, afterRead: undefined as (() => void) | undefined }
  const access = createRoutineResultAccess({ routines: { readRun: async () => ({ status: "ok", value: run }) }, expectedInputDigest: async () => ({ status: "ok", value: artifact.inputDigest }), readExecution: async () => ({ status: "ok", value: execution }), readArtifact: async () => { state.reads++; const value = structuredClone(output); state.afterRead?.(); return { status: "ok", value } }, authorize: async () => state.allowed, revalidateArtifact: async () => state.allowed })
  const reader = createRoutineReviewResultReader({ openResult: access.readResult, authorizeReview: async () => state.allowed, revalidateEvidence: async (_call, refs) => state.allowed && refs.every((ref) => digestSfValue(ref) === digestSfValue(evidence)) })
  return { period, source, evidence, section, content, run, output, execution, state, access, reader, pin: { runRef: run.runRef!, resultRef: run.resultRef!, outputDigest: output.outputDigest } }
}

export function reviewRoutineProduct(fixture: Awaited<ReturnType<typeof reviewRoutineFixture>>, authority: SfDomainValidation) {
  const unused = async () => ({ status: "unavailable", reason: "not-exercised-by-this-read" } as const)
  return createSfRoutineProduct({
    publication: {} as Parameters<typeof createSfRoutineProduct>[0]["publication"],
    routines: { prepareAdmission: unused, readAdmission: unused, run: unused, readRun: async () => ({ status: "ok", value: fixture.run }) },
    capabilities: { resolveRecipe: unused, resolveCase: unused, prepareWatch: unused, authority, revalidateOutput: async () => fixture.state.allowed, requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] } },
    resultAccess: fixture.access,
    discovery: { listRunRefs: unused, revalidate: async () => fixture.state.allowed },
  })
}
