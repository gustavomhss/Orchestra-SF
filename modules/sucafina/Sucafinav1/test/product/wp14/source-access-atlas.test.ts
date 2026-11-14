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
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfAtlasMemory, rankSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import { createSfCaseRecall } from "../../../product/decision-memory/case-recall.ts"
import { deriveAuthorizedRecallFeatures } from "../../../product/decision-memory/case-features.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfCaseEventSourceAccess, createSfDashboardContinuityProof, createSfDashboardSourceAccess, createSfSourceContinuityProof } from "../../../product/decision-memory/source-access.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase, CaseLedgerEvent } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedCallLease, TrustedDomainContext, TrustedExecutionBinding, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const binding = (id: string): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: id, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
const period = { start: "2026-01-01", end: "2026-12-31" }

test("protected Atlas original binds cross-principal continuity after store reopen", async () => {
  const startedAt = performance.now()
  const phase = (name: string) => console.log(`SF_WP14_ATLAS_PHASE:${JSON.stringify({ phase: name, pid: process.pid, elapsedMs: Math.round(performance.now() - startedAt) })}`)
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
    phase("scanner-ready")
    let store = await openLocalStore(directory, { lockTimeoutMs: 500 })
    const session = { id: "alice", active: true, evidence: true }
    const time = "2026-11-13T12:00:00Z"
    const open = async (initialize: boolean) => {
      const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => time) })
      if (initialize) {
        await persistence.initializeSources("dashboard")
        await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
      }
      const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => session.active && group === "admins") : null }, environment: async () => ({ at: time, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: session.id } }), revalidate: async (call) => session.active && session.id === call.binding.principalRef && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
      const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
      const sources = createDashboardSourceHost({ host, scopedSources: persistence })
      const dashboard = createDashboardPort({ host, sources })
      const source = createSfDashboardSourceAccess({ host, issue, dashboard })
      let eventAccess: ReturnType<typeof createSfCaseEventSourceAccess>
      const resolveNested = (ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>): ReturnType<BusinessContextService["resolve"]> => ref.kind === "case-event" ? eventAccess(ref, call, ancestors) : source(ref, call)
      const resolveEvidence: BusinessContextService["resolve"] = (ref, call) => resolveNested(ref, call, new Set())
      const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, call) => Promise.all(refs.map((ref) => resolveEvidence(ref, call))), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected nested emit") } }
      const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => { const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }); return principal && session.active ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined }, resolveTarget: async (request, snapshot, _namespace, ref) => { if (ref === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(ref); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined } })
      const cases = createDecisionCasePort({ ...{ verifyScenarioOperations: async (value: DecisionCase) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0 }, state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "unused", authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef), evidence, createId: randomUUID, now: () => time })
      eventAccess = createSfCaseEventSourceAccess({ host, state, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef), authorizeEvidence: async (refs, call, ancestors) => session.evidence && (await Promise.all(refs.map((ref) => resolveNested(ref, call, new Set(ancestors))))).every((result) => result.state === "fresh" || result.state === "historical") })
      let atlas: ReturnType<typeof createSfAtlasMemory>
      const readOriginal = (digest: string, call: TrustedDomainContext) => atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call)
      const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
      const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
      const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, call) : original.kind === "case-event" ? eventProof(original, current, call) : Promise.resolve(false)
      // Match production's explicit current C08 authorizer. Falling back to
      // cases.read here would recursively reopen all source dependencies while
      // their continuity proof is asking for an already protected capture.
      atlas = createSfAtlasMemory({ state, cases, host, evidence, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call), scanner, scannerVersion: version, now: () => time, proveContinuity })
      return { persistence, host, issue, dashboard, source, state, cases, atlas, eventAccess, proveContinuity }
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
      const key = JSON.stringify(["case", "case-inc", nestedEvent.id])
      const seed = await first.state.transaction(new Request("https://example.test", { headers: { authorization: "alice" } }), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }], idempotencyKey: "seed", commandDigest: digestSfValue(nestedRef), targetRef: "seed", targetIncarnation: "seed" }, async (state) => { state.cases.case = decision; state.outbox[key] = { eventRef: nestedRef, writerPrincipalRef: "alice", accessRevision: "1", createdAt: time, attempts: 0, state: "pending" }; return { commit: true, value: null } })
      expect(seed.status).toBe("ok")
      phase("case-and-outbox-persisted")
      expect((await first.cases.read({ caseRef: encodeCaseRef({ id: "case", incarnation: "case-inc" }) }, binding("alice"))).status).toBe("ok")
      expect((await first.eventAccess(nestedRef, binding("alice"))).state).toBe("fresh")
      expect((await first.eventAccess(eventRef, binding("alice"), new Set([eventRef.refDigest]))).state).toBe("unavailable")
      // The host registry/current case below are synthetic. These assertions test
      // the scoped source callback; the process restart below is the Atlas proof.
      const nativeFields: Omit<TrustedExecutionBinding, symbol> = {
        installationId: "i", projectId: "p", principalRef: "alice", hostId: "host", locationId: "location", nativeSessionId: "session", runId: "run",
        caseId: "current-case", caseIncarnation: "current-inc", caseVersion: 1, profileId: "sf_finance", profileVersion: "1", manifestDigest: "manifest", skillReceipts: [],
        accessRevision: "1", policyVersion: "1", providerGeneration: 1, expiresAt: "2099-01-01T00:00:00Z", entryMode: "interactive",
      }
      const native: TrustedDomainContext = { kind: "native", binding: nativeFields as TrustedExecutionBinding, lease: {} as TrustedCallLease }
      const nativeDigest = digestSfValue(native)
      expect((await first.eventAccess(nestedRef, native)).state).toBe("unavailable")
      const selected = { incarnation: "case-inc", version: 1, allowed: true, revokeOnAwait: false, reads: 0 }
      let scopedEvents: ReturnType<typeof createSfCaseEventSourceAccess>
      scopedEvents = createSfCaseEventSourceAccess({ host: first.host, state: first.state,
        authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef),
        authorizeRecallCase: async (value, context) => {
          selected.reads += 1
          await Promise.resolve()
          if (selected.revokeOnAwait && selected.reads > 1) selected.allowed = false
          return selected.allowed && context === native && digestSfValue(context) === nativeDigest && value.id === "case" && value.incarnation === selected.incarnation && value.version === selected.version
        },
        authorizeEvidence: async (refs, context, ancestors) => (await Promise.all(refs.map((ref) => ref.kind === "case-event" ? scopedEvents(ref, context, ancestors) : first.source(ref, context)))).every((value) => value.state === "fresh"),
      })
      expect((await scopedEvents(nestedRef, native)).state).toBe("fresh")
      for (const change of [{ incarnation: "case-inc", version: 2 }, { incarnation: "replaced", version: 1 }]) {
        Object.assign(selected, change)
        const denied = await scopedEvents(nestedRef, native)
        expect(denied.state).toBe("unavailable")
        expect(denied.authorizedProjection).toBeUndefined()
        expect(denied.currentRef).toBeUndefined()
      }
      Object.assign(selected, { incarnation: "case-inc", version: 1, reads: 0, revokeOnAwait: true })
      const revokedPrecedent = await scopedEvents(nestedRef, native)
      expect(revokedPrecedent.state).toBe("unavailable")
      expect(revokedPrecedent.authorizedProjection).toBeUndefined()
      expect(revokedPrecedent.currentRef).toBeUndefined()
      expect(digestSfValue(native)).toBe(nativeDigest)
      for (const mutation of ["reference", "binding"] as const) {
        const incoming = structuredClone(eventRef)
        const checks = { count: 0 }
        const raceAccess = createSfCaseEventSourceAccess({ state: first.state, host: { ...first.host, revalidate: async (context) => {
          checks.count += 1
          const allowed = await first.host.revalidate(context)
          if (checks.count === 3 && mutation === "binding") Object.assign(native.binding, { providerGeneration: 2 })
          if (checks.count === 3 && mutation === "reference") incoming.target.outputDigest = "a".repeat(64)
          return allowed
        } }, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef),
        authorizeRecallCase: async (value, context) => context === native && digestSfValue(context) === nativeDigest && value.id === "case" && value.incarnation === "case-inc" && value.version === 1,
        authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((ref) => first.source(ref, context)))).every((value) => value.state === "fresh"),
        })
        const denied = await raceAccess(incoming, native)
        expect(checks.count).toBe(3)
        expect(denied.state).toBe("unavailable")
        expect(denied.authorizedProjection).toBeUndefined()
        expect(denied.currentRef).toBeUndefined()
        Object.assign(native.binding, { providerGeneration: 1 })
      }
      expect(digestSfValue(native)).toBe(nativeDigest)
      session.evidence = false
      expect((await first.eventAccess(eventRef, binding("alice"))).state).toBe("unavailable")
      session.evidence = true
      phase("scoped-ancestry-and-egress-regressions-verified")
      const committed = await first.atlas.emitFromLedger(nestedRef, binding("alice"))
      expect(committed.status).toBe("committed")
      phase("real-atlas-write-committed")
      const replayed = await first.atlas.emitFromLedger(nestedRef, binding("alice"))
      expect(replayed.status).toBe("already-committed")
      expect(replayed.eventId).toBe(committed.eventId)
      expect(replayed.recordDigest).toBe(committed.recordDigest)
      phase("durable-receipt-replayed")
      await store.dispose()
      phase("store-closed-child-starting")
      const restarted = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(Bun.argv[0]!, [path.join(import.meta.dir, "atlas-restart-reader.ts"), directory, spec.command, version], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
      for (const line of restarted.stdout.toString("utf8").split("\n").filter((value) => value.startsWith("SF_ATLAS_RESTART_PHASE:"))) console.log(line)
      phase("child-returned")
      if (restarted.exitCode !== 0) throw new Error(`Restart probe failed (${restarted.exitCode}): ${restarted.stderr.toString("utf8")}`)
      expect(restarted.exitCode).toBe(0)
      const line = restarted.stdout.toString("utf8").split("\n").find((value) => value.startsWith("SF_ATLAS_RESTART_PROBE:"))
      expect(line).toBeDefined()
      if (!line) throw new Error(`Restart probe did not return a receipt: ${restarted.stderr.toString("utf8")}`)
      const receipt = JSON.parse(line.slice("SF_ATLAS_RESTART_PROBE:".length))
      expect(receipt.pid).not.toBe(process.pid)
      expect(receipt).toMatchObject({ authorized: "ok", matches: 1, candidateCaseRef: { id: "case", incarnation: "case-inc", version: 1 }, outsider: "unavailable", revoked: "unavailable" })
      phase("fresh-process-recall-and-revocation-verified")
      store = await openLocalStore(directory, { lockTimeoutMs: 500 })
      session.id = "bob"
      const reopened = await open(false)
      const original = await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))
      expect(original).toEqual(source)
      if (!original) return
      const current = await reopened.source(original, binding("bob"))
      expect(current.state).toBe("fresh")
      if (!current.currentRef) return
      const proof = createSfDashboardContinuityProof({ host: reopened.host, issue: reopened.issue, dashboard: reopened.dashboard, readOriginal: (digest, call) => reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call) })
      expect(await proof(original, current.currentRef, binding("bob"))).toBe(true)
      phase("reopened-protected-original-and-continuity-verified")
      const recall = await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))
      expect(recall.status).toBe("ok")
      if (recall.status === "ok") expect(recall.records).toHaveLength(1)
      phase("reopened-direct-atlas-read-verified")
      const caseRecall = createSfCaseRecall({ host: reopened.host, cases: reopened.cases, memory: reopened.atlas, selectCandidates: async () => [{ id: "case", incarnation: "case-inc" }], featuresForCase: async (value, call) => deriveAuthorizedRecallFeatures(value, call), runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" }, proveContinuity: reopened.proveContinuity, rank: rankSfAtlasRecall })
      const recallRequest = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, limit: 10, scope: { query: "renewal", recallScope: { cases: [{ id: "case", incarnation: "case-inc", version: 1 }], period, includeHistorical: false } } }
      // The positive case-recall and its exact explanation identity were already
      // asserted from the fresh process above. Keep the distinct scope/revocation
      // fences here without repeating that entire expensive authorized chain.
      expect((await caseRecall({ ...recallRequest, scope: { ...recallRequest.scope, recallScope: { ...recallRequest.scope.recallScope, cases: [] } } }, binding("bob"))).status).toBe("unavailable")
      session.evidence = false
      expect((await caseRecall(recallRequest, binding("bob"))).status).toBe("unavailable")
      session.evidence = true
      const forged = { ...source, refId: "forged" }
      expect(await proof({ ...forged, refDigest: digestSfEvidenceRef(forged) }, current.currentRef, binding("bob"))).toBe(false)
      session.active = false
      expect(await proof(original, current.currentRef, binding("bob"))).toBe(false)
      expect((await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))).status).toBe("unavailable")
      expect(await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))).toBeUndefined()
      const scannerSha256 = new Bun.CryptoHasher("sha256").update(new Uint8Array(await Bun.file(spec.command).arrayBuffer())).digest("hex")
      console.log(`SF_WP14_ATLAS_RESTART_RECEIPT:${JSON.stringify({ kind: "sqlite-atlas-process-restart", nativeSessionWitness: false,
        scanner: { name: scanner.name, version, sha256: scannerSha256 },
        committed: { status: committed.status, eventId: committed.eventId, recordDigest: committed.recordDigest },
        replayed: { status: replayed.status, eventId: replayed.eventId, recordDigest: replayed.recordDigest },
        parentPid: process.pid, childPid: receipt.pid, authorized: receipt.authorized, matches: receipt.matches, outsider: receipt.outsider, revoked: receipt.revoked })}`)
    } finally { await store.dispose() }
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 180_000)
