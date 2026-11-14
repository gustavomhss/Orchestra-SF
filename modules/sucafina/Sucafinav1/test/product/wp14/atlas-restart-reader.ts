import { randomUUID } from "node:crypto"
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
const [directory, scannerPath, scannerVersion] = process.argv.slice(2)
const pinned = KNOWN_SCANNERS.find((item) => item.name === "gitleaks")
if (!directory || !scannerPath || !scannerVersion || !pinned) throw new Error("Restart probe arguments are incomplete")
const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
try {
  const session = { id: "bob", evidence: true }
  const time = "2026-11-13T12:00:00Z"
  const call = (): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: session.id, requestId: "restart", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => time) })
  const host: DomainPortHost = { persistence, authenticate: async (request, context) => {
    const id = request.headers.get("authorization")
    return id ? resolve(id, [...context!.roleMap], (group) => group === "admins") : null
  }, environment: async () => ({ at: time, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: session.id } }), revalidate: async (context) => context.binding.principalRef === session.id && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
  const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
  const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
  const source = createSfDashboardSourceAccess({ host, issue, dashboard })
  let eventAccess: ReturnType<typeof createSfCaseEventSourceAccess>
  const resolveNested = (ref: BusinessEvidenceRef, context: TrustedDomainContext, ancestors: ReadonlySet<string>): ReturnType<BusinessContextService["resolve"]> => ref.kind === "case-event" ? eventAccess(ref, context, ancestors) : session.evidence ? source(ref, context) : Promise.resolve({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: time })
  const resolveEvidence: BusinessContextService["resolve"] = (ref, context) => resolveNested(ref, context, new Set())
  const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, context) => Promise.all(refs.map((ref) => resolveEvidence(ref, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("Read probe cannot emit") } }
  const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => {
    const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    return principal ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined
  }, resolveTarget: async (request, snapshot, _namespace, target) => {
    const ref = parseCaseRef(target)
    const value = ref && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[ref.id]
    return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined
  } })
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "unused", incarnation: "unused" }, operationIdentity: () => "read-only", authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), verifyScenarioOperations: async (value) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0, evidence, createId: randomUUID, now: () => time })
  eventAccess = createSfCaseEventSourceAccess({ host, state, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), authorizeEvidence: async (refs, context, ancestors) => session.evidence && (await Promise.all(refs.map((ref) => resolveNested(ref, context, new Set(ancestors))))).every((result) => result.state === "fresh" || result.state === "historical") })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  let memory: ReturnType<typeof createSfAtlasMemory>
  const readOriginal = (digest: string, context: TrustedDomainContext) => memory.readOriginal(caseRef, digest, context)
  const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
  const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
  const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, context: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, context) : original.kind === "case-event" ? eventProof(original, current, context) : Promise.resolve(false)
  memory = createSfAtlasMemory({ state, cases, host, evidence, scanner: createSfAtlasScanner({ scanners: [{ ...pinned, command: scannerPath }] }), scannerVersion, now: () => time, proveContinuity })
  const recall = createSfCaseRecall({ host, cases, memory, selectCandidates: async () => [caseRef], featuresForCase: async (value, context) => deriveAuthorizedRecallFeatures(value, context), runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" }, proveContinuity, rank: rankSfAtlasRecall })
  const request = { caseRef, limit: 10, scope: { query: "renewal", recallScope: { cases: [caseRef], period: { start: "2026-01-01", end: "2026-12-31" }, includeHistorical: false } } }
  const authorized = await recall(request, call())
  session.id = "carol"
  const outsider = await recall(request, call())
  session.id = "bob"
  session.evidence = false
  const revoked = await recall(request, call())
  console.log(`SF_ATLAS_RESTART_PROBE:${JSON.stringify({ pid: process.pid, authorized: authorized.status, matches: authorized.status === "ok" ? authorized.matches.length : null, outsider: outsider.status, revoked: revoked.status })}`)
} finally {
  await store.dispose()
}
