import { randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfAtlasMemory, rankSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { createDecisionCasePort, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfCaseRecall } from "../../../product/decision-memory/case-recall.ts"
import { deriveAuthorizedRecallFeatures } from "../../../product/decision-memory/case-features.ts"
import { createSfCaseEventSourceAccess, createSfDashboardContinuityProof, createSfDashboardSourceAccess, createSfSourceContinuityProof } from "../../../product/decision-memory/source-access.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

// A fresh process reconstructs production ports against the actual SQLite store.
// Identities and membership are explicitly synthetic; this is not a SessionV2 witness.
const [directory, scannerPath, scannerVersion, challenge] = process.argv.slice(2)
const pinned = KNOWN_SCANNERS.find((item) => item.name === "gitleaks")
if (!directory || !scannerPath || !scannerVersion || !challenge || !pinned) throw new Error("Restart probe arguments are incomplete")
const startedAt = performance.now()
const cancellation = new AbortController()
const counts = { caseReads: 0, evidenceReads: 0, atlasReads: 0, originalReads: 0, rankings: 0 }
const trace = (stage: string, status?: string) => console.log(`SF_WP14_RESTART_STAGE:${JSON.stringify({ pid: process.pid, stage, status, elapsedMs: Math.round(performance.now() - startedAt), counts })}`)
trace("store-open:start")
const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
trace("store-open:done")
// Recover the producer's cooperative cancellation through real host fences;
// the parent's existing 120-second child bound and 180-second test stay intact.
const deadline = setTimeout(() => { trace("deadline"); cancellation.abort(new Error("SF_ATLAS_RESTART_DEADLINE")) }, 90_000)
try {
  const session = { id: "bob", evidence: true }
  const authorizedStages: Record<string, { status: string; reason?: string }> = {}
  const recordStage = (stage: string, result: { status: string; reason?: string }) => {
    if (session.id === "bob" && session.evidence) authorizedStages[stage] = { status: result.status, ...(result.reason ? { reason: result.reason } : {}) }
  }
  const time = "2026-11-13T12:00:00Z"
  const call = (): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: session.id, requestId: challenge, policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => time) })
  const requests = new WeakMap<TrustedDomainContext, Request>()
  const requestFor = (context: TrustedDomainContext) => {
    const existing = requests.get(context)
    if (existing) return existing
    const request = new Request("https://example.test", { headers: { authorization: session.id }, signal: cancellation.signal })
    requests.set(context, request)
    return request
  }
  const host: DomainPortHost = { persistence, authenticate: async (request, context) => {
    const id = request.headers.get("authorization")
    return id ? resolve(id, [...context!.roleMap], (group) => group === "admins") : null
  }, environment: async () => ({ at: time, id: randomUUID, directory: [] }), requestFor, revalidate: async (context) => !cancellation.signal.aborted && context.binding.principalRef === session.id && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
  const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
  const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
  const source = createSfDashboardSourceAccess({ host, issue, dashboard })
  let eventAccess: ReturnType<typeof createSfCaseEventSourceAccess>
  const resolveNested = (ref: BusinessEvidenceRef, context: TrustedDomainContext, ancestors: ReadonlySet<string>): ReturnType<BusinessContextService["resolve"]> => ref.kind === "case-event" ? eventAccess(ref, context, ancestors) : session.evidence ? source(ref, context) : Promise.resolve({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: time })
  const resolveEvidence: BusinessContextService["resolve"] = (ref, context) => {
    counts.evidenceReads += 1
    if (counts.evidenceReads % 100 === 0) trace("evidence-progress")
    return resolveNested(ref, context, new Set())
  }
  const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, context) => Promise.all(refs.map((ref) => resolveEvidence(ref, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("Read probe cannot emit") } }
  const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => {
    const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    return principal ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined
  }, resolveTarget: async (request, snapshot, _namespace, target) => {
    const ref = parseCaseRef(target)
    const value = ref && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[ref.id]
    return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined
  } })
  // Use the same case ACL as the production Atlas composition. readOriginal must
  // not reopen all case evidence as a substitute for the current case ACL.
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const casePort = createDecisionCasePort({ state, host, creationTarget: { ref: "unused", incarnation: "unused" }, operationIdentity: () => "read-only", authorizeCase, verifyScenarioOperations: async (value) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0, evidence, createId: randomUUID, now: () => time })
  const cases = { ...casePort, read: async (...args: Parameters<typeof casePort.read>) => {
    counts.caseReads += 1
    trace("case-read:start")
    const result = await casePort.read(...args)
    trace("case-read:done", result.status)
    recordStage("caseRead", result)
    return result
  } }
  eventAccess = createSfCaseEventSourceAccess({ host, state, authorizeCase, authorizeEvidence: async (refs, context, ancestors) => session.evidence && (await Promise.all(refs.map((ref) => resolveNested(ref, context, new Set(ancestors))))).every((result) => result.state === "fresh" || result.state === "historical") })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  let memory: ReturnType<typeof createSfAtlasMemory>
  const readOriginal = (digest: string, context: TrustedDomainContext) => { counts.originalReads += 1; return memory.readOriginal(caseRef, digest, context) }
  const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
  const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
  const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, context: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, context) : original.kind === "case-event" ? eventProof(original, current, context) : Promise.resolve(false)
  const atlas = createSfAtlasMemory({ state, cases, authorizeCase, host, evidence, scanner: createSfAtlasScanner({ scanners: [{ ...pinned, command: scannerPath }] }), scannerVersion, now: () => time, proveContinuity })
  const observed: Array<Extract<Awaited<ReturnType<typeof atlas.recall>>, { status: "ok" }>["records"][number]> = []
  memory = { ...atlas, recall: async (...args: Parameters<typeof atlas.recall>) => {
    counts.atlasReads += 1
    trace("atlas-read:start")
    const result = await atlas.recall(...args)
    trace("atlas-read:done", result.status)
    recordStage("atlasRead", result)
    if (session.id === "bob" && session.evidence && result.status === "ok") observed.push(...result.records)
    return result
  } }
  const recall = createSfCaseRecall({ host, cases, memory, selectCandidates: async () => [caseRef], featuresForCase: async (value, context) => deriveAuthorizedRecallFeatures(value, context), runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" }, proveContinuity, rank: async (request) => {
    counts.rankings += 1
    trace("rank:start")
    const result = await rankSfAtlasRecall(request)
    trace("rank:done", result.status)
    recordStage("rank", result)
    return result
  } })
  const request = { caseRef, limit: 10, scope: { query: "renewal", recallScope: { cases: [caseRef], period: { start: "2026-01-01", end: "2026-12-31" }, includeHistorical: false } } }
  trace("authorized-recall:start")
  const authorizedCall = call()
  const authorized = await recall(request, authorizedCall)
  trace("authorized-recall:done", authorized.status)
  assert.equal(authorized.status, "ok", "The canonical consumer must authorize the persisted case")
  if (authorized.status !== "ok") throw new Error("Actual Atlas case recall unavailable")
  assert.equal(authorized.matches.length, 1)
  assert.deepEqual(authorized.matches[0]?.explanation.candidateCaseRef, caseRef)
  const record = observed.at(-1)
  assert.ok(record, "The consumer must use the canonical Atlas reader")
  assert.ok(observed.every((item) => item.recordDigest === record.recordDigest && digestSfValue(item.envelope) === digestSfValue(record.envelope)))
  assert.equal(authorized.matches[0]?.memoryRecordRef, record.envelope.eventId)
  assert.deepEqual(authorized.matches[0]?.evidenceRefs, record.envelope.evidenceRefs)
  assert.deepEqual(record.envelope.caseRef, caseRef)
  assert.equal(record.envelope.scannerReceipt.digest, record.recordDigest)
  const source = record.envelope.dependencies.find((ref) => ref.kind === "record" && ref.target.surface === "dashboard")
  assert.ok(source, "The persisted record must retain its original source dependency")
  const originalCapture = await atlas.readOriginalCapture(caseRef, source.refDigest, authorizedCall)
  assert.ok(originalCapture, "The canonical protected reader must validate the persisted capture")
  assert.deepEqual(originalCapture.ref, source)
  const persisted = { eventId: record.envelope.eventId, recordDigest: record.recordDigest, envelope: record.envelope,
    originalCapture, captureDigest: digestSfValue(originalCapture) }
  trace("canonical-record-and-capture:verified")
  session.id = "carol"
  trace("outsider-recall:start")
  const outsider = await recall(request, call())
  trace("outsider-recall:done", outsider.status)
  assert.deepEqual(outsider, { status: "unavailable" }, "Outsider must receive no matches or derived metadata")
  assert.equal(await atlas.readOriginalCapture(caseRef, source.refDigest, call()), undefined)
  session.id = "bob"
  session.evidence = false
  trace("revoked-recall:start")
  const revoked = await recall(request, call())
  trace("revoked-recall:done", revoked.status)
  assert.deepEqual(revoked, { status: "unavailable" }, "Revoked evidence must suppress the entire consumer result")
  const deniedSource = await resolveEvidence(source, call())
  assert.equal(deniedSource.state, "unavailable")
  assert.equal(deniedSource.authorizedProjection, undefined)
  assert.equal(deniedSource.currentRef, undefined)
  if (cancellation.signal.aborted) throw new Error("SF_ATLAS_RESTART_DEADLINE")
  console.log(`SF_ATLAS_RESTART_PROBE:${JSON.stringify({ schema: "sf-atlas-process-restart-v1", nativeSessionWitness: false,
    challenge, pid: process.pid, binding: { kind: authorizedCall.kind, principalRef: authorizedCall.binding.principalRef, requestId: authorizedCall.kind === "ui" ? authorizedCall.binding.requestId : undefined },
    authorized: authorized.status, matches: authorized.matches.length, candidateCaseRef: authorized.matches[0]?.explanation.candidateCaseRef,
    persisted, consumer: authorized, outsider: outsider.status, revoked: revoked.status, authorizedStages, counts, elapsedMs: Math.round(performance.now() - startedAt) })}`)
} finally {
  clearTimeout(deadline)
  trace("store-dispose:start")
  await store.dispose()
  trace("store-dispose:done")
}
