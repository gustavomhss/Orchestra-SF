import { expect, test } from "bun:test"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { CaseLedgerEvent, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { StoredDecisionResult } from "../../../product/decisions/result-store.ts"

function fixture() {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "request", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const source: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "planner-version:v:inc:1", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "v", incarnation: "inc", version: 1, fields: ["lines"], period, projectionDigest: "a".repeat(64) } }
  source.refDigest = digestSfEvidenceRef(source)
  const request: ScenarioRequest = { baseRef: source.refId, operations: [{ kind: "replace", targetRef: "line:1", amount: 10, currency: "USD" }], assumptions: [] }
  const result: ScenarioResult = { id: "preview:one", version: 0, components: [{ id: "line:1", amount: 10, currency: "USD", period, sourceRefs: [{ surface: "planner", type: "planner-version", id: "v", incarnation: "inc", version: 1, fields: ["lines"], period, observedAt: "2026-11-13T00:00:00Z" }], evidenceState: "hypothetical" }], currency: "USD", horizon: period, sourceRefs: [source], costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "missing-category" }], evaluatedSourceRefs: [source], derivedMissingCategoryIds: ["training"], issues: ["missing-category:training"] }, comparisonStatus: "conditioned", knownSubtotal: 10, total: null, unresolvedConditions: ["training"], restrictions: ["preview-not-applied"] }
  const record: StoredDecisionResult = { schema: "sf-decision-result-v1", kind: "scenario", resultRef: "decision-result:one", caseRef: { id: "case", incarnation: "case-inc", version: 1 }, principalRef: "finance", accessRevision: "1", policyVersion: "1", requestDigest: digestSfValue(request), resultDigest: digestSfValue(result), sourceRefs: [source], createdAt: "2026-11-13T00:00:00Z", result }
  const controller = new AbortController()
  const state = { active: true, readFailure: false, replayCalls: 0, result: structuredClone(result) }
  const input: Parameters<typeof createPlannerCalculationEvidence>[0] = {
    host: { requestFor: () => new Request("https://example.test", { signal: controller.signal }), revalidate: async () => state.active },
    loadRecordOnlyRequest: async () => ({ status: "ok", value: { resultRef: record.resultRef, request, engineVersion: "planner-runtime-v1" } }),
    readForCalculation: async () => { if (state.readFailure) throw new Error("SYNTHETIC_PRIVATE_MARKER"); return { status: "ok", value: record } },
    replayRecordOnly: async () => { state.replayCalls++; return { status: "ok", value: state.result } },
  }
  return { context, source, request, result, record, controller, state, input }
}

test("record-only replay binds C10 coverage, complete source closure and both fresh observations", async () => {
  const f = fixture()
  const issuer = createPlannerCalculationEvidence(f.input)
  const issued = await issuer.issue(f.record.resultRef, f.context)
  expect(issued).toMatchObject({ status: "ok", value: { kind: "calculation", target: { resultDigest: f.record.resultDigest, inputDigest: f.record.requestDigest, sourceRefs: [f.source] } } })
  expect(f.state.replayCalls).toBe(2)
  if (issued.status === "ok") {
    expect(issued.value.refDigest).toBe(digestSfEvidenceRef(issued.value))
    expect(await issuer.resolve(issued.value.refId, f.context)).toEqual(issued)
  }
  f.state.result.costCoverage = { ...f.state.result.costCoverage, issues: ["coverage-revoked"] }
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "stale", reason: "calculation-replay-changed" })
})

test("recursive read callbacks are bounded before a second stored read, and release their guard", async () => {
  const f = fixture()
  const cycle = { enabled: true, reads: 0 }
  const issuer = createPlannerCalculationEvidence({ ...f.input, readForCalculation: async () => {
    cycle.reads++
    if (!cycle.enabled) return { status: "ok", value: f.record }
    const nested = await issuer.issue(f.record.resultRef, f.context)
    return nested.status === "ok" ? { status: "unavailable", reason: "unexpected" } : nested
  } })
  expect(await issuer.issue(f.record.resultRef, f.context)).toEqual({ status: "unavailable", reason: "calculation-replay-cycle" })
  expect(cycle.reads).toBe(1)
  expect(f.state.replayCalls).toBe(0)
  cycle.enabled = false
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "ok" })
})

test("evidence outside the persisted closure and another project never reaches replay", async () => {
  const f = fixture()
  const extra = structuredClone(f.source)
  extra.refId = "extra-source"
  extra.target.recordId = "extra"
  extra.refDigest = digestSfEvidenceRef(extra)
  f.result.costCoverage = { ...f.result.costCoverage, evaluatedSourceRefs: [f.source, extra] }
  f.record.resultDigest = digestSfValue(f.result)
  expect(await createPlannerCalculationEvidence(f.input).issue(f.record.resultRef, f.context)).toEqual({ status: "unavailable", reason: "calculation-source-closure-invalid" })
  expect(f.state.replayCalls).toBe(0)
  f.record.sourceRefs = [f.source, extra]
  extra.projectId = "foreign"
  extra.refDigest = digestSfEvidenceRef(extra)
  expect(await createPlannerCalculationEvidence(f.input).issue(f.record.resultRef, f.context)).toMatchObject({ status: "unavailable" })
  expect(f.state.replayCalls).toBe(0)
})

test("cyclic calculation references and malformed request fields are unavailable without replay", async () => {
  const f = fixture()
  const cyclic: Extract<BusinessEvidenceRef, { kind: "calculation" }> = { schema: "sf-evidence-v1", kind: "calculation", refId: "loop", installationId: "i", projectId: "p", refDigest: "a".repeat(64), evidenceLevel: "proposal", target: { calculationId: "planner:scenario", runId: "loop", engineVersion: "planner-runtime-v1", inputDigest: "b".repeat(64), resultDigest: "c".repeat(64), sourceRefs: [], period: f.result.horizon, currency: "USD" } }
  cyclic.target.sourceRefs = [cyclic]
  f.record.sourceRefs = [cyclic]
  expect(await createPlannerCalculationEvidence(f.input).issue(f.record.resultRef, f.context)).toMatchObject({ status: "unavailable" })
  expect(f.state.replayCalls).toBe(0)
  f.record.sourceRefs = [f.source]
  const badRequest = { ...f.request, actor: "admin" }
  const issuer = createPlannerCalculationEvidence({ ...f.input, loadRecordOnlyRequest: async () => ({ status: "ok", value: { resultRef: f.record.resultRef, request: badRequest, engineVersion: "planner-runtime-v1" } }) })
  expect(await issuer.issue(f.record.resultRef, f.context)).toEqual({ status: "unavailable", reason: "calculation-request-invalid" })
})

test("callback request mutation is detached and private failures never escape the resolver", async () => {
  const f = fixture()
  const before = structuredClone(f.request)
  const issuer = createPlannerCalculationEvidence({ ...f.input, replayRecordOnly: async (request) => {
    const operation = request.operations[0]
    if (operation) operation.amount = 999
    return { status: "ok", value: f.state.result }
  } })
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "ok" })
  expect(f.request).toEqual(before)
  f.state.readFailure = true
  expect(await issuer.issue(f.record.resultRef, f.context)).toEqual({ status: "unavailable", reason: "calculation-replay-unavailable" })
  f.state.readFailure = false
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "ok" })
})

test("cancellation and revocation after replay never issue calculation evidence", async () => {
  const f = fixture()
  const issuer = createPlannerCalculationEvidence({ ...f.input, replayRecordOnly: async () => {
    f.state.active = false
    f.controller.abort()
    return { status: "ok", value: f.result }
  } })
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "stale", reason: "calculation-or-authority-changed" })
  expect(await issuer.issue(f.record.resultRef, f.context)).toMatchObject({ status: "denied" })
})

/** Controlled loader/resolver boundaries exercise graph admission, not financial calculation. */
async function nestedFixture() {
  const f = fixture()
  const child = await createPlannerCalculationEvidence(f.input).issue(f.record.resultRef, f.context)
  if (child.status !== "ok") throw new Error("Record-only prerequisite failed")
  const ledger: CaseLedgerEvent = { id: "accepted-analysis", caseRef: f.record.caseRef, kind: "analysis-accepted", principalRef: "finance", at: f.record.createdAt, consideredActions: [], factualGaps: ["training"], lifecycleState: "comparing", rationale: "Analysis only", evidenceRefs: [child.value], outputDigest: digestSfValue(f.result) }
  const event: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "case-event:accepted-analysis", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "proposal", target: { caseId: f.record.caseRef.id, caseIncarnation: f.record.caseRef.incarnation, caseVersion: f.record.caseRef.version, eventId: ledger.id, outputDigest: ledger.outputDigest, evidenceRefs: ledger.evidenceRefs } }
  event.refDigest = digestSfEvidenceRef(event)
  const request: ScenarioRequest = { ...f.request, assumptions: [{ id: "prior-analysis", value: "reviewed", state: "hypothetical", evidenceRefs: [child.value, event] }] }
  const result: ScenarioResult = { ...structuredClone(f.result), id: "preview:parent", sourceRefs: [f.source, child.value, event] }
  const record: Extract<StoredDecisionResult, { kind: "scenario" }> = { ...f.record, resultRef: "decision-result:parent", requestDigest: digestSfValue(request), resultDigest: digestSfValue(result), sourceRefs: result.sourceRefs, result }
  const projection: DomainProjection = { context: { ...f.context.binding, surface: "planner", period: f.result.horizon, currency: "USD", sourceRefs: f.result.components.flatMap((component) => component.sourceRefs), capabilities: [] }, version: 1, engineVersion: "planner-runtime-v1", components: f.result.components, values: [], missing: [] }
  const state = { current: true, authorized: true, mutateRequest: false, revokeOnParentReplay: false, reads: 0, parentReplays: 0, calculationResolverCalls: 0 }
  const evidence: Pick<BusinessContextService, "resolve"> = { resolve: async (ref) => {
    if (ref.kind === "calculation") { state.calculationResolverCalls++; throw new Error("Calculation freshness cannot substitute producer replay") }
    const matches = [f.source, event].some((source) => digestSfValue(source) === digestSfValue(ref))
    return { state: state.current && matches ? "fresh" : "revoked", ref, currentRef: ref, ...(state.authorized ? { authorizedProjection: ref.kind === "case-event" ? ledger : projection } : {}), accessRevision: "1", checkedAt: f.record.createdAt }
  } }
  const replay: Parameters<typeof createPlannerCalculationEvidence>[0]["replayRecordOnly"] = async (incoming) => {
    const parent = digestSfValue(incoming) === digestSfValue(request)
    if (parent) state.parentReplays++
    if (state.mutateRequest && incoming.operations[0]) incoming.operations[0].amount = 999
    if (parent && state.revokeOnParentReplay) state.current = false
    return { status: "ok", value: parent ? record.result : f.record.result }
  }
  const input: Parameters<typeof createPlannerCalculationEvidence>[0] = {
    host: f.input.host,
    readForCalculation: async (query) => { state.reads++; return query.resultRef === record.resultRef ? { status: "ok", value: record } : query.resultRef === f.record.resultRef ? { status: "ok", value: f.record } : { status: "unavailable", reason: "unknown-result" } },
    loadRecordOnlyRequest: async (runId) => runId === record.resultRef ? { status: "ok", value: { resultRef: runId, request, engineVersion: "planner-runtime-v1" } } : runId === f.record.resultRef ? { status: "ok", value: { resultRef: runId, request: f.request, engineVersion: "planner-runtime-v1" } } : { status: "unavailable", reason: "unknown-binding" },
    replayRecordOnly: replay,
    nested: { replayScenario: replay, evidence },
  }
  return { ...f, parent: { request, record }, child: child.value, event, state, input, issuer: createPlannerCalculationEvidence(input) }
}

test("nested C17 requires replay for calculations and canonical authorization for ledger leaves", async () => {
  const f = await nestedFixture()
  expect(await createPlannerCalculationEvidence({ ...f.input, nested: undefined }).issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "unavailable", reason: "calculation-nested-evidence-unavailable" })
  expect(f.state.parentReplays).toBe(0)
  const before = structuredClone(f.parent.request)
  f.state.mutateRequest = true
  const issued = await f.issuer.issue(f.parent.record.resultRef, f.context)
  expect(issued).toMatchObject({ status: "ok", value: { target: { runId: f.parent.record.resultRef, inputDigest: f.parent.record.requestDigest, resultDigest: f.parent.record.resultDigest, sourceRefs: f.parent.record.sourceRefs } } })
  expect(f.parent.request).toEqual(before)
  expect(f.state.parentReplays).toBe(2)
  expect(f.state.calculationResolverCalls).toBe(0)
  expect(await f.issuer.verifyCalculationRequestSources(f.parent.request, f.parent.record, f.context)).toBe(true)
  expect(await f.issuer.verifyCalculationSources(f.parent.record, [f.source], f.context)).toBe(false)
  f.state.authorized = false
  expect(await f.issuer.issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "unavailable" })
})

test("nested C17 rejects a digest-valid calculation that cannot reproduce its stored result", async () => {
  const f = await nestedFixture()
  const altered = { ...f.child, target: { ...f.child.target, resultDigest: "f".repeat(64) } }
  altered.refDigest = digestSfEvidenceRef(altered)
  f.parent.request.assumptions = [{ ...f.parent.request.assumptions[0]!, evidenceRefs: [altered] }]
  f.parent.record.result.sourceRefs = [f.source, altered]
  f.parent.record.sourceRefs = f.parent.record.result.sourceRefs
  f.parent.record.requestDigest = digestSfValue(f.parent.request)
  f.parent.record.resultDigest = digestSfValue(f.parent.record.result)
  expect(await f.issuer.issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "unavailable", reason: "calculation-nested-evidence-unproven" })
  expect(f.state.parentReplays).toBe(0)
  expect(f.state.calculationResolverCalls).toBe(0)
})

test("nested C17 rejects semantic ancestor cycles and releases traversal guards", async () => {
  const f = await nestedFixture()
  const ancestor = { ...f.child, refId: `planner-calculation:${encodeURIComponent(f.parent.record.resultRef)}`, target: { ...f.child.target, runId: f.parent.record.resultRef } }
  ancestor.refDigest = digestSfEvidenceRef(ancestor)
  const before = structuredClone(f.record)
  f.record.result.sourceRefs = [f.source, ancestor]
  f.record.sourceRefs = f.record.result.sourceRefs
  f.record.resultDigest = digestSfValue(f.record.result)
  expect(await f.issuer.issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "unavailable" })
  expect(f.state.reads).toBeLessThanOrEqual(2)
  expect(f.state.parentReplays).toBe(0)
  Object.assign(f.record, before)
  expect(await f.issuer.issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "ok" })
})

test("nested C17 refuses revoked lineage after replay while the caller remains authorized", async () => {
  const f = await nestedFixture()
  f.state.revokeOnParentReplay = true
  expect(await f.issuer.issue(f.parent.record.resultRef, f.context)).toMatchObject({ status: "stale", reason: "calculation-or-authority-changed" })
  expect(await f.input.host.revalidate(f.context)).toBe(true)
  expect(await f.issuer.verifyCalculationSources(f.parent.record, f.parent.record.sourceRefs, f.context)).toBe(false)
})
