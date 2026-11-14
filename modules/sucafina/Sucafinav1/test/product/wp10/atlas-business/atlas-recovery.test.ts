// Derived from WP14 02ac8172c17ad57e830bfb23d3ff1d1b1191852b; exercises the composed WP10 store and real scanner.
import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { KNOWN_SCANNERS, NO_SCANNER_NAME } from "@orchestra/atlas-boundary/native-memory"
import { AppProcess } from "@orchestra/core/process"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { resolve } from "../../../../src/identity.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../../product/dashboard/port.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfAtlasMemory, rankSfAtlasRecall } from "../../../../product/host-binding/atlas-memory.ts"
import { createSfBusinessContext } from "../../../../product/host-binding/business-context.ts"
import { createSfCaseRecall } from "../../../../product/decision-memory/case-recall.ts"
import { deriveAuthorizedRecallFeatures } from "../../../../product/decision-memory/case-features.ts"
import { createSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfCaseEventSourceAccess, createSfDashboardContinuityProof, createSfDashboardSourceAccess, createSfSourceContinuityProof } from "../../../../product/decision-memory/source-access.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase, CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../../product/contracts/sf-execution.ts"

const binding = (id: string): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: id, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
const period = { start: "2026-01-01", end: "2026-12-31" }

test("WP10 Atlas fences writes and recovers a durable receipt after reopen without a scanner", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-atlas-source-handoff-"))
  try {
    expectSpawn(import.meta.path)
    const pinned = KNOWN_SCANNERS.find((item) => item.name === "gitleaks")
    if (!pinned) throw new Error("The pinned Atlas scanner spec is unavailable")
    const spec = { ...pinned, command: (await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit"))))).executable }
    const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = probe.stdout.toString("utf8").trim()
    if (probe.exitCode !== 0 || !version) throw new Error("Could not determine the Atlas scanner version")
    const scanner = createSfAtlasScanner({ scanners: [spec] })
    expect(scanner.name).not.toBe(NO_SCANNER_NAME)
    let store = await openLocalStore(directory, { lockTimeoutMs: 500 })
    const session = { id: "alice", active: true, evidence: true }
    const time = "2026-11-13T12:00:00Z"
    let injectSourceRace = true
    const open = async (initialize: boolean, scannerOnline = true) => {
      const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => time) })
      if (initialize) {
        for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
        await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
      }
      const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => session.active && group === "admins") : null }, environment: async () => ({ at: time, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: session.id } }), revalidate: async (call) => session.active && session.id === call.binding.principalRef && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
      const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
      const sources = createDashboardSourceHost({ host, scopedSources: persistence })
      const dashboard = createDashboardPort({ host, sources })
      const source = createSfDashboardSourceAccess({ host, issue, dashboard })
      let eventAccess: ReturnType<typeof createSfCaseEventSourceAccess>
      const resolveNested = (ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>): ReturnType<BusinessContextService["resolve"]> => ref.kind === "case-event" ? eventAccess(ref, call, ancestors) : source(ref, call)
      const resolveEvidence: BusinessContextService["resolve"] = (ref, call) => session.evidence ? resolveNested(ref, call, new Set()) : Promise.resolve({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: time })
      const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, call) => Promise.all(refs.map((ref) => resolveEvidence(ref, call))), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected nested emit") } }
      const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => { const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }); return principal && session.active ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined }, resolveTarget: async (request, snapshot, _namespace, ref) => { if (ref === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(ref); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined } })
      const cases = createDecisionCasePort({ ...{ verifyScenarioOperations: async (value: DecisionCase) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0 }, state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "unused", authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef), evidence, createId: randomUUID, now: () => time })
      eventAccess = createSfCaseEventSourceAccess({ host, state, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef), authorizeEvidence: async (refs, call, ancestors) => session.evidence && (await Promise.all(refs.map((ref) => resolveNested(ref, call, new Set(ancestors))))).every((result) => result.state === "fresh" || result.state === "historical") })
      let atlas: ReturnType<typeof createSfAtlasMemory>
      const readOriginal = (digest: string, call: TrustedDomainContext) => atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call)
      const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
      const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
      const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, call) : original.kind === "case-event" ? eventProof(original, current, call) : Promise.resolve(false)
      atlas = createSfAtlasMemory({ state: { ...state, transaction: async (request, command, work) => {
        if (injectSourceRace && command.namespace === "atlas") {
          injectSourceRace = false
          await persistence.transaction("procurement", async (snapshot) => { snapshot.data.formSettings = { currency: "USD" }; return { commit: true, value: undefined } })
        }
        return state.transaction(request, command, work)
      } }, cases, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && session.active,
        host, evidence, scanner: scannerOnline ? scanner : createSfAtlasScanner({ scanners: [] }), scannerVersion: scannerOnline ? version : "", now: () => time, proveContinuity })
      const context = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: resolveEvidence, proveContinuity,
        recall: async (request, call) => {
          const results = await Promise.all(request.caseRefs.map((ref) => atlas.recall(ref, call)))
          if (results.some((result) => result.status !== "ok")) throw new Error("Memory unavailable")
          return results.flatMap((result) => result.status === "ok" ? result.records : [])
        }, emitFromLedger: atlas.emitFromLedger })
      return { persistence, host, issue, dashboard, source, state, cases, atlas, context, eventAccess, proveContinuity }
    }
    try {
      const first = await open(true)
      const issued = await first.issue({ page: "Budget Overview", fields: ["budgetMetrics"], period }, binding("alice"))
      expect(issued.status).toBe("ok")
      if (issued.status !== "ok") return
      const source = issued.value.evidence
      const event: CaseLedgerEvent = { id: "event", caseRef: { id: "case", incarnation: "case-inc", version: 1 }, kind: "analysis-accepted", principalRef: "alice", at: time, consideredActions: ["renewal"], factualGaps: [], lifecycleState: "investigating", rationale: "Compare the authorized source", evidenceRefs: [source], outputDigest: "c".repeat(64) }
      const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "event-ref", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision", target: { caseId: "case", caseIncarnation: "case-inc", caseVersion: 1, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [source] } }
      const eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
      const nestedEvent: CaseLedgerEvent = { ...event, id: "nested-event", evidenceRefs: [eventRef], outputDigest: "f".repeat(64) }
      const nestedBase: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { ...eventRef, refId: "nested-ref", refDigest: "", target: { ...eventRef.target, eventId: nestedEvent.id, outputDigest: nestedEvent.outputDigest, evidenceRefs: [eventRef] } }
      const nestedRef = { ...nestedBase, refDigest: digestSfEvidenceRef(nestedBase) }
      const decision: DecisionCase = { id: "case", incarnation: "case-inc", version: 1, state: "investigating", objective: "Compare", horizon: period, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["alice", "bob"], sourceRefs: [source, eventRef], alternatives: [], costCoverageBases: [{ id: "renewal", version: 1, decisionType: "renewal", categoryIds: [], additionalCategoryIds: [], sourceRefs: [source] }], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [event, nestedEvent] }
      const key = JSON.stringify(["case", "case-inc", event.id])
      const seed = await first.state.transaction(new Request("https://example.test", { headers: { authorization: "alice" } }), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }], idempotencyKey: "seed", commandDigest: digestSfValue(eventRef), targetRef: "seed", targetIncarnation: "seed" }, async (state) => { state.cases.case = decision; state.outbox[key] = { eventRef, writerPrincipalRef: "alice", accessRevision: "1", createdAt: time, attempts: 0, state: "pending" }; return { commit: true, value: null } })
      expect(seed.status).toBe("ok")
      expect((await first.cases.read({ caseRef: encodeCaseRef({ id: "case", incarnation: "case-inc" }) }, binding("alice"))).status).toBe("ok")
      expect((await first.eventAccess(nestedRef, binding("alice"))).state).toBe("fresh")
      expect((await first.eventAccess(eventRef, binding("alice"), new Set([eventRef.refDigest]))).state).toBe("unavailable")
      session.evidence = false
      expect((await first.eventAccess(eventRef, binding("alice"))).state).toBe("unavailable")
      session.evidence = true
      const raced = await first.atlas.emitFromLedger(eventRef, binding("alice"))
      expect(raced.status).toBe("unavailable")
      if (raced.status !== "unavailable") throw new Error("Source race did not fail closed")
      expect(raced.reason).toBe("source-changed-before-commit")
      const empty = await first.state.read(new Request("https://example.test", { headers: { authorization: "alice" } }), "atlas", (state) => Object.keys(state.atlas).length)
      expect(empty.status === "ok" && empty.value).toBe(0)
      const committed = await first.atlas.emitFromLedger(eventRef, binding("alice"))
      expect(committed.status).toBe("committed")
      await store.dispose()
      store = await openLocalStore(directory, { lockTimeoutMs: 500 })
      session.id = "bob"
      const reopened = await open(false, false)
      session.evidence = false
      const recovered = await reopened.context.emitFromLedger(eventRef, binding("bob"))
      expect(recovered.status).toBe("already-committed")
      expect({ ...recovered, status: "committed" }).toEqual(committed)
      const altered = { ...eventRef, target: { ...eventRef.target, outputDigest: "0".repeat(64) } }
      expect((await reopened.atlas.emitFromLedger({ ...altered, refDigest: digestSfEvidenceRef(altered) }, binding("bob"))).status).toBe("conflict")
      session.id = "charlie"
      const absent = { ...eventRef, target: { ...eventRef.target, eventId: "absent-event" } }
      const unauthorized = await Promise.all([eventRef, { ...altered, refDigest: digestSfEvidenceRef(altered) }, { ...absent, refDigest: digestSfEvidenceRef(absent) }].map((ref) => reopened.context.emitFromLedger(ref, binding("charlie"))))
      expect(unauthorized.every((result) => result.status === "unavailable")).toBe(true)
      expect(unauthorized.map((result) => ({ ...result, sourceEventId: "redacted" }))).toEqual(Array(3).fill({ ...unauthorized[0], sourceEventId: "redacted" }))
      session.id = "bob"
      session.evidence = true
      const original = await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))
      expect(original).toEqual(source)
      if (!original) return
      const current = await reopened.source(original, binding("bob"))
      expect(current.state).toBe("fresh")
      if (!current.currentRef) return
      const proof = createSfDashboardContinuityProof({ host: reopened.host, issue: reopened.issue, dashboard: reopened.dashboard, readOriginal: (digest, call) => reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call) })
      expect(await proof(original, current.currentRef, binding("bob"))).toBe(true)
      const recall = await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))
      expect(recall.status).toBe("ok")
      if (recall.status === "ok") expect(recall.records).toHaveLength(1)
      const caseRecall = createSfCaseRecall({ host: reopened.host, cases: reopened.cases, memory: reopened.atlas, selectCandidates: async () => [{ id: "case", incarnation: "case-inc" }], featuresForCase: async (value, call) => deriveAuthorizedRecallFeatures(value, call), runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" }, proveContinuity: reopened.proveContinuity, rank: rankSfAtlasRecall })
      const recallRequest = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, limit: 10, scope: { query: "renewal", recallScope: { cases: [{ id: "case", incarnation: "case-inc", version: 1 }], period, includeHistorical: false } } }
      const caseMatches = await caseRecall(recallRequest, binding("bob"))
      expect(caseMatches.status).toBe("ok")
      if (caseMatches.status === "ok") { expect(caseMatches.matches).toHaveLength(1); expect(caseMatches.matches[0]?.explanation.candidateCaseRef).toEqual(recallRequest.caseRef) }
      expect((await caseRecall({ ...recallRequest, scope: { ...recallRequest.scope, recallScope: { ...recallRequest.scope.recallScope, cases: [] } } }, binding("bob"))).status).toBe("unavailable")
      session.evidence = false
      expect((await caseRecall(recallRequest, binding("bob"))).status).toBe("unavailable")
      session.evidence = true
      const forged = { ...source, refId: "forged" }
      expect(await proof({ ...forged, refDigest: digestSfEvidenceRef(forged) }, current.currentRef, binding("bob"))).toBe(false)
      const beforeRevocation = await reopened.state.read(new Request("https://example.test", { headers: { authorization: "bob" } }), "cases", (state) => state.versions.cases)
      if (beforeRevocation.status !== "ok") throw new Error("Current case authority missing")
      const revoked = await reopened.state.transaction(new Request("https://example.test", { headers: { authorization: "bob" } }), {
        namespace: "cases", expectedStorageVersion: beforeRevocation.value, idempotencyKey: "revoke-bob", commandDigest: digestSfValue("revoke-bob"), targetRef: encodeCaseRef({ id: "case", incarnation: "case-inc" }), targetIncarnation: "case-inc",
      }, async (state) => { state.cases.case!.participants = ["alice"]; return { commit: true, value: true } })
      expect(revoked.status).toBe("ok")
      expect((await reopened.atlas.emitFromLedger(eventRef, binding("bob"))).status).toBe("unavailable")
      session.active = false
      expect(await proof(original, current.currentRef, binding("bob"))).toBe(false)
      expect((await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))).status).toBe("unavailable")
      expect(await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))).toBeUndefined()
    } finally { await store.dispose() }
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 180_000)

