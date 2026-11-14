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
import type { TrustedCallLease, TrustedDomainContext, TrustedExecutionBinding, TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const binding = (id: string): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: id, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
const period = { start: "2026-01-01", end: "2026-12-31" }

test("protected Atlas original binds cross-principal continuity after store reopen", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-atlas-source-handoff-"))
  const startedAt = performance.now()
  const trace = (stage: string, detail: Record<string, unknown> = {}) => console.log(`SF_WP14_ATLAS_STAGE:${JSON.stringify({ pid: process.pid, stage, elapsedMs: Math.round(performance.now() - startedAt), ...detail })}`)
  try {
    trace("scanner-setup:start")
    expectSpawn(import.meta.path)
    const pinned = KNOWN_SCANNERS.find((item) => item.name === "gitleaks")
    if (!pinned) throw new Error("The pinned Atlas scanner spec is unavailable")
    const spec = { ...pinned, command: (await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit"))))).executable }
    const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = probe.stdout.toString("utf8").trim()
    if (probe.exitCode !== 0 || !version) throw new Error("Could not determine the Atlas scanner version")
    const scanner = createSfAtlasScanner({ scanners: [spec] })
    expect(scanner.name).not.toBe(NO_SCANNER_NAME)
    trace("scanner-setup:done", { name: scanner.name, version })
    let store = await openLocalStore(directory, { lockTimeoutMs: 500 })
    const session = { id: "alice", active: true, evidence: true }
    const time = "2026-11-13T12:00:00Z"
    const open = async (initialize: boolean) => {
      const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => time) })
      if (initialize) {
        await persistence.initializeSources("dashboard")
        await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
      }
      const requests = new WeakMap<TrustedDomainContext, Request>()
      const requestFor = (context: TrustedDomainContext) => {
        const existing = requests.get(context)
        if (existing) return existing
        const request = new Request("https://example.test", { headers: { authorization: session.id } })
        requests.set(context, request)
        return request
      }
      const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => session.active && group === "admins") : null }, environment: async () => ({ at: time, id: randomUUID, directory: [] }), requestFor, revalidate: async (call) => session.active && session.id === call.binding.principalRef && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
      const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
      const sources = createDashboardSourceHost({ host, scopedSources: persistence })
      const dashboard = createDashboardPort({ host, sources })
      const source = createSfDashboardSourceAccess({ host, issue, dashboard })
      let eventAccess: ReturnType<typeof createSfCaseEventSourceAccess>
      const resolveNested = (ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>): ReturnType<BusinessContextService["resolve"]> => ref.kind === "case-event" ? eventAccess(ref, call, ancestors) : source(ref, call)
      const resolveEvidence: BusinessContextService["resolve"] = (ref, call) => resolveNested(ref, call, new Set())
      const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, call) => Promise.all(refs.map((ref) => resolveEvidence(ref, call))), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected nested emit") } }
      const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => { const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }); return principal && session.active ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined }, resolveTarget: async (request, snapshot, _namespace, ref) => { if (ref === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(ref); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined } })
      const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call)
      const cases = createDecisionCasePort({ ...{ verifyScenarioOperations: async (value: DecisionCase) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0 }, state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "unused", authorizeCase, evidence, createId: randomUUID, now: () => time })
      eventAccess = createSfCaseEventSourceAccess({ host, state, authorizeCase, authorizeEvidence: async (refs, call, ancestors) => session.evidence && (await Promise.all(refs.map((ref) => resolveNested(ref, call, new Set(ancestors))))).every((result) => result.state === "fresh" || result.state === "historical") })
      let atlas: ReturnType<typeof createSfAtlasMemory>
      const readOriginal = (digest: string, call: TrustedDomainContext) => atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call)
      const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
      const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
      const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, call) : original.kind === "case-event" ? eventProof(original, current, call) : Promise.resolve(false)
      atlas = createSfAtlasMemory({ state, cases, authorizeCase, host, evidence, scanner, scannerVersion: version, now: () => time, proveContinuity })
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
      trace("ledger-seeded")
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
      trace("atlas-emit:start")
      const committed = await first.atlas.emitFromLedger(nestedRef, binding("alice"))
      trace("atlas-emit:done", { status: committed.status })
      expect(committed.status).toBe("committed")
      const replayed = await first.atlas.emitFromLedger(nestedRef, binding("alice"))
      expect(replayed.status).toBe("already-committed")
      expect(replayed.eventId).toBe(committed.eventId)
      expect(replayed.recordDigest).toBe(committed.recordDigest)
      trace("atlas-replay:done", { status: replayed.status })
      trace("parent-store-close:start")
      await store.dispose()
      trace("parent-store-close:done")
      trace("child-run:start")
      const restarted = await Effect.runPromise(AppProcess.Service.use((appProcess) => appProcess.run(ChildProcess.make(Bun.argv[0]!, [path.join(import.meta.dir, "atlas-restart-reader.ts"), directory, spec.command, version], { extendEnv: true, stdin: "ignore" }), {
        timeout: "120 seconds", inspect: (chunk) => process.stdout.write(chunk),
      })).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))).catch((error) => {
        trace("child-run:failed", { reason: error instanceof Error ? error.message : String(error) })
        throw error
      })
      trace("child-run:exited", { exitCode: restarted.exitCode })
      expect(restarted.stdoutTruncated).toBe(false)
      expect(restarted.stderrTruncated).toBe(false)
      expect(restarted.exitCode).toBe(0)
      const line = restarted.stdout.toString("utf8").split("\n").find((value) => value.startsWith("SF_ATLAS_RESTART_PROBE:"))
      expect(line).toBeDefined()
      if (!line) throw new Error(`Restart probe did not return a receipt: ${restarted.stderr.toString("utf8")}`)
      const receipt = JSON.parse(line.slice("SF_ATLAS_RESTART_PROBE:".length))
      expect(receipt.pid).not.toBe(process.pid)
      expect(receipt).toMatchObject({ authorized: "ok", matches: 1, candidateCaseRef: { id: "case", incarnation: "case-inc", version: 1 }, outsider: "unavailable", revoked: "unavailable" })
      store = await openLocalStore(directory, { lockTimeoutMs: 500 })
      session.id = "bob"
      const reopened = await open(false)
      trace("parent-store-reopened")
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
      trace("parent-recall:start")
      const caseMatches = await caseRecall(recallRequest, binding("bob"))
      trace("parent-recall:done", { status: caseMatches.status })
      expect(caseMatches.status).toBe("ok")
      if (caseMatches.status === "ok") { expect(caseMatches.matches).toHaveLength(1); expect(caseMatches.matches[0]?.explanation.candidateCaseRef).toEqual(recallRequest.caseRef) }
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
    } finally { trace("parent-store-dispose:start"); await store.dispose(); trace("parent-store-dispose:done") }
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 180_000)

test("confirmed C17 document is published and recalled by real Atlas, then withheld after blob revocation", async () => {
  const { createWp06Runtime } = await import("../wp06/runtime-fixture.ts")
  const { createSfProductAuthority } = await import("../../../product/integration/product-authority.ts")
  const { createSfDocumentTargetAuthority } = await import("../../../../../../apps/cli/src/sucafina-product/document-authority.ts")
  const { createSfDocumentServices } = await import("../../../../../../apps/cli/src/sucafina-product/document-services.ts")
  const { createSfBusinessServices } = await import("../../../../../../apps/cli/src/sucafina-product/business-services.ts")
  const { createSfAtlasBusiness } = await import("../../../product/host-binding/business-context.ts")
  const { createDashboardRecordEvidenceHost } = await import("../../../product/dashboard/sources.ts")
  const { createDashboardRecordSourceIssuer } = await import("../../../product/integration/dashboard-sources.ts")
  const { enqueueSfLedgerEvent } = await import("../../../product/integration/ledger-outbox.ts")
  const { uploadAsset } = await import("../../../runtime/assets.ts")
  const { object } = await import("../../../runtime/contract.ts")
  const app = await createWp06Runtime()
  let documents: ReturnType<typeof createSfDocumentServices>
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    expectSpawn(import.meta.path)
    const pinned = KNOWN_SCANNERS.find((item) => item.name === "gitleaks")
    if (!pinned) throw new Error("The pinned Atlas scanner spec is unavailable")
    const spec = { ...pinned, command: (await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(app.directory, "toolkit"))))).executable }
    const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }), { timeout: "5 seconds" })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = probe.stdout.toString("utf8").trim()
    if (probe.exitCode !== 0 || probe.stdoutTruncated || !version) throw new Error("Could not determine the Atlas scanner version")

    // These are the actual local credentials and C08 grants. Native admission is deliberately absent.
    const procurementEvidenceWrites = new WeakSet<object>()
    const authority = createSfProductAuthority({ identity: () => app.installation, installationId: app.operator.installationId,
      origin: app.origin, policyVersion: "policy", persistence: app.store, procurementEvidenceWrites, authenticate: app.runtime.authenticate, environment: app.runtime.environment,
      grants: [{ principalRef: app.principal.id, namespaces: ["documents", "receipts", "cases", "outbox", "atlas"],
        operations: ["sf_document_extract", "sf_evidence_get", "sf_case_draft", "sf_case_read", "sf_decision_recall"],
        humanActions: ["documents.schema", "documents.confirm"] }],
      createId: randomUUID, now: () => Date.parse(app.at),
      commandIdentity: async (request, operation) => {
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      },
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
      authorizeDocument: createSfDocumentTargetAuthority(app.runtime) })
    documents = createSfDocumentServices({ runtime: app.runtime, authority })
    if (!documents) throw new Error("Actual document services unavailable")
    const service = documents
    business = createSfBusinessServices({ authority, persistence: app.store, proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites, documentRead: service.documents.reader })
    const product = business
    const host = authority.host
    let selectedCase: { id: string; incarnation: string } | undefined
    const atlas = createSfAtlasBusiness({ host, authority: authority.authority, state: authority.state, cases: product.cases,
      authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call),
      dashboard: product.dashboard, dashboardIssue: createDashboardSourceIssuer({ host, scopedSources: app.store }),
      dashboardRecords: createDashboardRecordEvidenceHost({ host, scopedSources: app.store, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: app.store }) }),
      procurement: product.procurement, procurementResolve: product.resolveProcurement, documentRead: service.documents.reader,
      scanner: { spec, version }, now: () => app.at,
      caseForEvidence: async (digest, call) => {
        const ref = selectedCase
        const request = host.requestFor(call)
        if (!ref || !request || !await host.revalidate(call)) return undefined
        const current = await product.cases.read({ caseRef: encodeCaseRef(ref) }, call)
        if (current.status !== "ok") return undefined
        const saved = await authority.state.read(request, "outbox", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          Object.values(state.outbox).some((entry) => entry.eventRef.refDigest === digest && entry.eventRef.target.caseId === ref.id && entry.eventRef.target.caseIncarnation === ref.incarnation))
        return saved.status === "ok" && (saved.value || current.value.evidenceRefs.some((item) => item.refDigest === digest)) && await host.revalidate(call) ? ref : undefined
      },
      selections: {
        runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" },
        featuresForCase: async (value, call) => deriveAuthorizedRecallFeatures(value, call),
        contextSelections: async (request, call) => {
          const found = await Promise.all(request.selectionRefs.map((caseRef) => product.cases.read({ caseRef }, call)))
          if (!found.length || found.some((item) => item.status !== "ok" || digestSfValue(item.value.case.horizon) !== digestSfValue(request.period))) return undefined
          return found.flatMap((item) => item.status === "ok" ? item.value.evidenceRefs : [])
        },
        recallSelections: async (request, call) => {
          if (request.selectionRefs.length !== 1) return undefined
          const current = await product.cases.read({ caseRef: request.selectionRefs[0]! }, call)
          if (current.status !== "ok" || digestSfValue(current.value.case.horizon) !== digestSfValue(request.period)) return undefined
          const features = deriveAuthorizedRecallFeatures(current.value, call)
          return features ? { caseRefs: [{ id: current.value.case.id, incarnation: current.value.case.incarnation }], features } : undefined
        },
      } })
    product.evidence.current = atlas.context
    const ui = async <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => {
      const digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(app.request(), operation, digest)
      if (admitted.status !== "ok") throw new Error(`Actual UI admission failed: ${admitted.reason}`)
      try {
        if (!await authority.ui.validate(admitted.value, operation, digest)) throw new Error("Actual UI grant unavailable")
        return await work(admitted.value)
      } finally { authority.ui.finish(admitted.value) }
    }
    await app.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { suppliers: [{ id: "s1", name: "Document supplier" }], settings: { uploadCap: 100_000 } }
      return { commit: true, value: undefined }
    })
    // The reusable fixture substitutes the asset-ingress scan; Atlas uses the real pinned gitleaks above.
    const uploaded = await app.store.transaction("procurement", async (snapshot, blobs) => {
      const actor = await app.runtime.authenticate(app.request("procurement"), { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!actor || actor.id !== app.principal.id) throw new Error("Actual supplier principal unavailable")
      const result = await uploadAsset(snapshot, blobs, { id: actor.id, roles: actor.roles.filter((role) => role.surface === "procurement").map((role) => role.role), canWrite: actor.canWrite, assigned: [], domains: [] },
        { page: "Suppliers", action: "upload", id: "s1", version: 0, values: {} }, { at: app.at, id: () => "atlas-terms", directory: [] }, app.runtime.assets.services,
        "supplier", { name: "atlas-terms.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 42") })
      return { commit: result.ok, value: result }
    })
    expect(uploaded.ok).toBe(true)
    if (!uploaded.ok) throw new Error("Actual supplier upload failed")
    const discovered = await ui("sf_document_extract", {}, (call) => service.discover(call))
    expect(discovered.status).toBe("ok")
    if (discovered.status !== "ok") throw new Error(discovered.reason)
    const selection = discovered.value.find((item) => item.label === "atlas-terms.txt")
    if (!selection) throw new Error("Actual uploaded document was not discovered")
    const admitted = await ui("sf_document_extract", { selectionRef: selection.selectionRef }, (call) => service.admitSelection(selection.selectionRef, call))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    const schemaInput = { documentRef: admitted.value.documentId, fields: [{ id: "Price", type: "number" as const, unit: "USD" }] }
    const schemaGrant = await authority.human.admit(app.request(), "documents.schema", schemaInput)
    if (schemaGrant.status !== "ok") throw new Error(schemaGrant.reason)
    const schema = await service.schemas.register(schemaInput, schemaGrant.value).finally(() => authority.human.finish(schemaGrant.value))
    expect(schema.status).toBe("ok")
    if (schema.status !== "ok") throw new Error(schema.reason)
    const extractInput = { documentRef: admitted.value.documentId, fieldSchemaRef: schema.value.ref }
    const candidate = await ui("sf_document_extract", extractInput, (call) => service.documents.extract(extractInput, call))
    expect(candidate.status).toBe("ok")
    if (candidate.status !== "ok") throw new Error(candidate.reason)
    expect(candidate.value).toMatchObject({ status: "extracted", fieldCandidate: "Price", value: 42, unit: "USD" })
    const pending = await ui("sf_evidence_get", { evidenceRef: candidate.value.ref }, (call) => product.context.resolve(candidate.value.ref, call))
    expect(pending.state).not.toBe("fresh")
    expect(pending.authorizedProjection).toBeUndefined()
    const confirmGrant = await authority.human.admit(app.request(), "documents.confirm", candidate.value)
    if (confirmGrant.status !== "ok") throw new Error(confirmGrant.reason)
    const confirmed = await service.documents.confirm(candidate.value.id, confirmGrant.value).finally(() => authority.human.finish(confirmGrant.value))
    expect(confirmed.status).toBe("ok")
    if (confirmed.status !== "ok") throw new Error(confirmed.reason)
    expect(confirmed.value).toMatchObject({ status: "confirmed", value: 42, unit: "USD" })
    expect(confirmed.value.ref.target.confirmationVersion).toBe(1)
    const documentRef = confirmed.value.ref
    const fresh = await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => product.context.resolve(documentRef, call))
    expect(fresh).toMatchObject({ state: "fresh", currentRef: documentRef, authorizedProjection: confirmed.value })

    const draftInput = { objective: "Review the confirmed supplier price", horizon: period, currency: "USD", criteria: ["Use the confirmed document amount"], sourceRefs: [documentRef] }
    const drafted = await ui("sf_case_draft", draftInput, (call) => product.cases.draft(draftInput, call))
    expect(drafted.status).toBe("ok")
    if (drafted.status !== "ok") throw new Error(drafted.reason)
    expect(drafted.value.sourceRefs).toEqual([documentRef])
    selectedCase = { id: drafted.value.id, incarnation: drafted.value.incarnation }
    const caseRef = selectedCase
    // An accepted ledger event is the explicit test premise, not a model-acceptance witness.
    // The real C08 transaction and outbox producer commit it; all Atlas work below is production code.
    const event: CaseLedgerEvent = { id: randomUUID(), caseRef: { ...caseRef, version: drafted.value.version + 1 }, kind: "analysis-accepted",
      principalRef: app.principal.id, at: app.at, consideredActions: ["Review the confirmed supplier price"], factualGaps: [], lifecycleState: "investigating",
      rationale: "The human-confirmed supplier document records a price of 42 USD.", evidenceRefs: [documentRef], outputDigest: digestSfValue({ premise: "accepted-document-review", documentRef }) }
    const eventRef = await ui("sf_case_read", { caseRef: encodeCaseRef(caseRef) }, async (call) => {
      const request = host.requestFor(call)
      if (!request || !await host.revalidate(call)) throw new Error("Actual ledger authority unavailable")
      const cases = await authority.state.read(request, "cases", (state) => state.cases[caseRef.id])
      const outbox = await authority.state.read(request, "outbox", (state) => state.versions.outbox)
      if (cases.status !== "ok" || !cases.value || outbox.status !== "ok") throw new Error("Actual ledger storage unavailable")
      const saved = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: cases.storageVersion,
        additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }], targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation,
        idempotencyKey: `accepted-document:${event.id}`, commandDigest: digestSfValue(event) }, async (state, actor) => {
        const current = state.cases[caseRef.id]
        if (!current || current.incarnation !== caseRef.incarnation || current.version !== drafted.value.version || actor.principalRef !== call.binding.principalRef ||
          actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion || !current.participants.includes(actor.principalRef))
          throw new Error("Actual ledger premise changed")
        state.cases[current.id] = { ...current, version: event.caseRef.version, state: "investigating", ledger: [...current.ledger, event] }
        const queued = enqueueSfLedgerEvent(state, event, { installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor })
        if (queued.status !== "ok") throw new Error(queued.reason)
        return { commit: true, value: queued.value.eventRef }
      })
      expect(saved.status).toBe("ok")
      if (saved.status !== "ok") throw new Error("Actual ledger/outbox commit failed")
      return saved.value
    })
    expect(eventRef.target.evidenceRefs).toEqual([documentRef])
    const outboxKey = JSON.stringify([caseRef.id, caseRef.incarnation, event.id])
    const queued = await authority.state.read(app.request(), "outbox", (state) => state.outbox[outboxKey])
    expect(queued.status).toBe("ok")
    if (queued.status !== "ok") throw new Error("Actual outbox unavailable")
    expect(queued.value).toMatchObject({ state: "pending", eventRef, writerPrincipalRef: app.principal.id })
    const receipt = await ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => product.context.emitFromLedger(eventRef, call))
    expect(receipt).toMatchObject({ status: "committed", sourceEventId: event.id, scanner: { name: "gitleaks", version, status: "clean" } })
    if (receipt.status !== "committed" || !receipt.eventId || !receipt.recordDigest) throw new Error(`Real Atlas publication failed: ${receipt.reason ?? receipt.status}`)
    const durable = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, outbox: state.outbox[outboxKey], versions: { atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(durable.status).toBe("ok")
    if (durable.status !== "ok") throw new Error("Actual Atlas readback unavailable")
    expect(durable.value.outbox).toMatchObject({ state: "settled", eventRef, receipt })
    expect(Object.keys(durable.value.atlas)).toHaveLength(1)
    const partition = object(Object.values(durable.value.atlas)[0])
    expect(partition.events).toHaveLength(1)
    expect(Object.keys(object(partition.envelopes))).toEqual([receipt.eventId])
    expect(object(partition.envelopes)[receipt.eventId]).toMatchObject({ eventId: receipt.eventId, sourceEventId: event.id,
      evidenceRefs: [eventRef, documentRef], dependencies: [documentRef], scannerReceipt: { name: "gitleaks", version, status: "clean", digest: receipt.recordDigest } })
    expect(object(partition.originals)[documentRef.refDigest]).toEqual({ ref: documentRef, projection: confirmed.value })
    const replay = await ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => product.context.emitFromLedger(eventRef, call))
    expect(replay).toEqual({ ...receipt, status: "already-committed" })
    const afterReplay = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, outbox: state.outbox[outboxKey], versions: { atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(afterReplay.status).toBe("ok")
    if (afterReplay.status !== "ok") throw new Error("Atlas replay state unavailable")
    expect(afterReplay.value).toEqual(durable.value)
    const original = await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => atlas.memory.readOriginal(caseRef, documentRef.refDigest, call))
    expect(original).toEqual(documentRef)
    const recallInput = { selectionRefs: [encodeCaseRef(caseRef)], similarityCriteria: ["horizon"], period, limit: 10 }
    const recalled = await ui("sf_decision_recall", recallInput, (call) => atlas.memory.recall(caseRef, call))
    expect(recalled.status).toBe("ok")
    if (recalled.status !== "ok") throw new Error("Actual Atlas document recall unavailable")
    expect(recalled.records).toHaveLength(1)
    expect(recalled.records[0]?.envelope.dependencies).toEqual([documentRef])
    expect(recalled.records[0]?.envelope.evidenceRefs).toEqual([eventRef, documentRef])
    expect(recalled.records[0]?.recordDigest).toBe(receipt.recordDigest)
    expect(recalled.records[0]?.resolutions.find((item) => item.ref.refDigest === documentRef.refDigest)).toMatchObject({ state: "fresh", ref: documentRef, currentRef: documentRef, authorizedProjection: confirmed.value })
    const businessRecall = { caseRefs: [caseRef], query: "confirmed supplier price" }
    const contextRecall = await ui("sf_decision_recall", recallInput, (call) => product.context.recall(businessRecall, call))
    expect(contextRecall).toHaveLength(1)
    expect(contextRecall[0]?.envelope).toEqual(recalled.records[0]?.envelope)

    // Replace the actual bytes while the same authenticated operator remains active.
    await app.store.transaction("procurement", async (_snapshot, blobs) => {
      await blobs.put("supplier/s1/atlas-terms", new TextEncoder().encode("Price: 99"), "text/plain")
      return { commit: true, value: undefined }
    })
    const revoked = await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => product.context.resolve(documentRef, call))
    expect(revoked.state).not.toBe("fresh")
    expect(revoked.authorizedProjection).toBeUndefined()
    expect(revoked.currentRef).toBeUndefined()
    // There is still no pending item: these refusals must follow the unavailable document, not an outbox gate.
    const beforeRevokedRecall = await authority.state.read(app.request(), "outbox", (state) => Object.values(state.outbox)
      .filter((entry) => entry.eventRef.target.caseId === caseRef.id && entry.eventRef.target.caseIncarnation === caseRef.incarnation))
    expect(beforeRevokedRecall.status).toBe("ok")
    if (beforeRevokedRecall.status !== "ok") throw new Error("Actual outbox unavailable before revoked recall")
    expect(beforeRevokedRecall.value).toEqual([durable.value.outbox])
    expect(await ui("sf_decision_recall", recallInput, (call) => atlas.memory.recall(caseRef, call))).toEqual({ status: "unavailable" })
    await expect(ui("sf_decision_recall", recallInput, (call) => product.context.recall(businessRecall, call))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    const revokedEvent = await ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => product.context.resolve(eventRef, call))
    expect(revokedEvent.state).not.toBe("fresh")
    expect(revokedEvent.authorizedProjection).toBeUndefined()
    expect(revokedEvent.currentRef).toBeUndefined()
    // The private continuity callback keeps immutable metadata for this still-authorized case.
    // It does not grant current document access; BCS resolution and recall above remain withheld.
    expect(await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => atlas.memory.readOriginal(caseRef, documentRef.refDigest, call))).toEqual(documentRef)
    // C17 transaction sequence 6 recovers the prior receipt for the same key/digest, without another append.
    const recovered = await ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => product.context.emitFromLedger(eventRef, call))
    expect(recovered).toEqual({ ...receipt, status: "already-committed" })
    const afterRevocation = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, outbox: state.outbox[outboxKey], versions: { atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(afterRevocation.status).toBe("ok")
    if (afterRevocation.status !== "ok") throw new Error("Durable Atlas state unavailable after revocation")
    expect(afterRevocation.value).toEqual(durable.value)

    // A second accepted ledger event is an explicit outbox premise, not a model-acceptance witness.
    // Commit it through real authenticated C08 after source loss, then require the new Atlas append to fail.
    const pendingEvent: CaseLedgerEvent = { ...event, id: randomUUID(), caseRef: { ...caseRef, version: event.caseRef.version + 1 },
      consideredActions: ["Review the supplier price after the source bytes changed"], factualGaps: ["The original confirmed document bytes are no longer available"],
      rationale: "The prior document reference cannot support a new memory projection after its bytes change.",
      outputDigest: digestSfValue({ premise: "accepted-document-review-after-source-loss", priorEventRef: eventRef, documentRef }) }
    expect(pendingEvent.id).not.toBe(event.id)
    const pendingEventRef = await ui("sf_case_read", { caseRef: encodeCaseRef(caseRef) }, async (call) => {
      const request = host.requestFor(call)
      if (!request || !await host.revalidate(call)) throw new Error("Actual pending ledger authority unavailable")
      const cases = await authority.state.read(request, "cases", (state) => state.cases[caseRef.id])
      const outbox = await authority.state.read(request, "outbox", (state) => state.versions.outbox)
      if (cases.status !== "ok" || !cases.value || outbox.status !== "ok") throw new Error("Actual pending ledger storage unavailable")
      const saved = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: cases.storageVersion,
        additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }], targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation,
        idempotencyKey: `accepted-document:${pendingEvent.id}`, commandDigest: digestSfValue(pendingEvent) }, async (state, actor) => {
        const current = state.cases[caseRef.id]
        if (!current || current.incarnation !== caseRef.incarnation || current.version !== event.caseRef.version || actor.principalRef !== call.binding.principalRef ||
          actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion || !current.participants.includes(actor.principalRef) ||
          !current.ledger.some((entry) => entry.id === event.id && digestSfValue(entry) === digestSfValue(event)))
          throw new Error("Actual pending ledger premise changed")
        state.cases[current.id] = { ...current, version: pendingEvent.caseRef.version, ledger: [...current.ledger, pendingEvent] }
        const queued = enqueueSfLedgerEvent(state, pendingEvent, { installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor })
        if (queued.status !== "ok") throw new Error(queued.reason)
        return { commit: true, value: queued.value.eventRef }
      })
      expect(saved.status).toBe("ok")
      if (saved.status !== "ok") throw new Error("Actual pending ledger/outbox commit failed")
      return saved.value
    })
    expect(pendingEventRef.refDigest).not.toBe(eventRef.refDigest)
    expect(pendingEventRef.target).toMatchObject({ caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: pendingEvent.caseRef.version,
      eventId: pendingEvent.id, evidenceRefs: [documentRef], outputDigest: pendingEvent.outputDigest })
    const pendingOutboxKey = JSON.stringify([caseRef.id, caseRef.incarnation, pendingEvent.id])
    const beforeRejectedAppend = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, published: state.outbox[outboxKey],
      pending: state.outbox[pendingOutboxKey], decision: state.cases[caseRef.id], versions: { cases: state.versions.cases, atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(beforeRejectedAppend.status).toBe("ok")
    if (beforeRejectedAppend.status !== "ok") throw new Error("Actual pending Atlas state unavailable")
    expect(beforeRejectedAppend.value.atlas).toEqual(durable.value.atlas)
    expect(beforeRejectedAppend.value.versions.atlas).toBe(durable.value.versions.atlas)
    expect(beforeRejectedAppend.value.published).toEqual(durable.value.outbox)
    expect(beforeRejectedAppend.value.pending).toMatchObject({ state: "pending", eventRef: pendingEventRef, writerPrincipalRef: app.principal.id, attempts: 0 })
    expect(beforeRejectedAppend.value.pending?.receipt).toBeUndefined()
    expect(beforeRejectedAppend.value.decision?.ledger.filter((entry) => entry.id === pendingEvent.id)).toEqual([pendingEvent])
    const refused = await ui("sf_evidence_get", { evidenceRef: pendingEventRef }, (call) => product.context.emitFromLedger(pendingEventRef, call))
    expect(refused.status).toBe("unavailable")
    expect(refused.sourceEventId).toBe(pendingEvent.id)
    expect(refused.eventId).toBeUndefined()
    expect(refused.recordDigest).toBeUndefined()
    expect(refused.committedRevision).toBeUndefined()
    const afterRejectedAppend = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, published: state.outbox[outboxKey],
      pending: state.outbox[pendingOutboxKey], decision: state.cases[caseRef.id], versions: { cases: state.versions.cases, atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(afterRejectedAppend.status).toBe("ok")
    if (afterRejectedAppend.status !== "ok") throw new Error("Actual Atlas state unavailable after refused append")
    expect(afterRejectedAppend.value).toEqual(beforeRejectedAppend.value)
  } finally {
    try { business?.dispose() }
    finally { try { documents?.dispose() } finally { await app.dispose() } }
  }
}, 180_000)
