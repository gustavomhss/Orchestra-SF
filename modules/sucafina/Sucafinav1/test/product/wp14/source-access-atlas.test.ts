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
import type { TrustedDomainContext, TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const binding = (id: string): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: id, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
const period = { start: "2026-01-01", end: "2026-12-31" }

test("protected Atlas original binds cross-principal continuity after store reopen", async () => {
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
  const session = { id: "alice", active: true }
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
    const resolveEvidence: BusinessContextService["resolve"] = (ref, call) => ref.kind === "case-event" ? eventAccess(ref, call) : source(ref, call)
    const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, call) => Promise.all(refs.map((ref) => resolveEvidence(ref, call))), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected nested emit") } }
    const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request, snapshot) => { const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }); return principal && session.active ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined }, resolveTarget: async (request, snapshot, _namespace, ref) => { if (ref === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(ref); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined } })
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "unused", authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef), evidence, createId: randomUUID, now: () => time })
    eventAccess = createSfCaseEventSourceAccess({ host, cases })
    let atlas: ReturnType<typeof createSfAtlasMemory>
    const readOriginal = (digest: string, call: TrustedDomainContext) => atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call)
    const dashboardProof = createSfDashboardContinuityProof({ host, issue, dashboard, readOriginal })
    const eventProof = createSfSourceContinuityProof({ host, readOriginal, readCurrent: eventAccess })
    const proveContinuity = (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => original.kind === "record" && original.target.surface === "dashboard" ? dashboardProof(original, current, call) : original.kind === "case-event" ? eventProof(original, current, call) : Promise.resolve(false)
    atlas = createSfAtlasMemory({ state, cases, host, evidence, scanner, scannerVersion: version, now: () => time, proveContinuity })
    return { persistence, host, issue, dashboard, source, state, cases, atlas, proveContinuity }
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
    const decision: DecisionCase = { id: "case", incarnation: "case-inc", version: 1, state: "investigating", objective: "Compare", horizon: period, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["alice", "bob"], sourceRefs: [source], alternatives: [], costCoverageBases: [{ id: "renewal", version: 1, decisionType: "renewal", categoryIds: [], additionalCategoryIds: [], sourceRefs: [source] }], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [event] }
    const key = JSON.stringify(["case", "case-inc", event.id])
    const seed = await first.state.transaction(new Request("https://example.test", { headers: { authorization: "alice" } }), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }], idempotencyKey: "seed", commandDigest: digestSfValue(eventRef), targetRef: "seed", targetIncarnation: "seed" }, async (state) => { state.cases.case = decision; state.outbox[key] = { eventRef, writerPrincipalRef: "alice", accessRevision: "1", createdAt: time, attempts: 0, state: "pending" }; return { commit: true, value: null } })
    expect(seed.status).toBe("ok")
    expect((await first.atlas.emitFromLedger(eventRef, binding("alice"))).status).toBe("committed")
    await store.dispose()
    store = await openLocalStore(directory, { lockTimeoutMs: 500 })
    session.id = "bob"
    const reopened = await open(false)
    const original = await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))
    expect(original).toEqual(source)
    if (!original) return
    const current = await reopened.source(original, binding("bob"))
    expect(current.state).toBe("fresh")
    expect(current.currentRef).toBeDefined()
    if (!current.currentRef) throw new Error("Reauthorized current source reference unavailable")
    const proof = createSfDashboardContinuityProof({ host: reopened.host, issue: reopened.issue, dashboard: reopened.dashboard, readOriginal: (digest, call) => reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, digest, call) })
    expect(await proof(original, current.currentRef, binding("bob"))).toBe(true)
    const recall = await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))
    expect(recall.status).toBe("ok")
    if (recall.status === "ok") expect(recall.records).toHaveLength(1)
    const caseRecall = createSfCaseRecall({ host: reopened.host, cases: reopened.cases, memory: reopened.atlas, selectCandidates: async () => [{ id: "case", incarnation: "case-inc" }], featuresForCase: async (value, call) => deriveAuthorizedRecallFeatures(value, call), runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" }, proveContinuity: reopened.proveContinuity, rank: rankSfAtlasRecall })
    const recallRequest = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, limit: 10, scope: { query: "renewal", recallScope: { cases: [{ id: "case", incarnation: "case-inc", version: 1 }], period, includeHistorical: false } } }
    const caseMatches = await caseRecall(recallRequest, binding("bob"))
    expect(caseMatches.status).toBe("ok")
    if (caseMatches.status !== "ok") throw new Error("Actual Atlas case recall unavailable")
    expect(caseMatches.matches).toHaveLength(1)
    expect(caseMatches.matches[0]?.explanation.candidateCaseRef).toEqual(recallRequest.caseRef)
    expect((await caseRecall({ ...recallRequest, scope: { ...recallRequest.scope, recallScope: { ...recallRequest.scope.recallScope, cases: [] } } }, binding("bob"))).status).toBe("unavailable")
    const forged = { ...source, refId: "forged" }
    expect(await proof({ ...forged, refDigest: digestSfEvidenceRef(forged) }, current.currentRef, binding("bob"))).toBe(false)
    session.active = false
    expect((await caseRecall(recallRequest, binding("bob"))).status).toBe("unavailable")
    expect(await proof(original, current.currentRef, binding("bob"))).toBe(false)
    expect((await reopened.atlas.recall({ id: "case", incarnation: "case-inc" }, binding("bob"))).status).toBe("unavailable")
    expect(await reopened.atlas.readOriginal({ id: "case", incarnation: "case-inc" }, source.refDigest, binding("bob"))).toBeUndefined()
  } finally { await store.dispose() }
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
    const authority = createSfProductAuthority({ identity: () => app.installation, installationId: app.operator.installationId,
      origin: app.origin, policyVersion: "policy", persistence: app.store, authenticate: app.runtime.authenticate, environment: app.runtime.environment,
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
    business = createSfBusinessServices({ authority, persistence: app.store, proposalCoverageWrites: new WeakSet(), documentRead: service.documents.reader })
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

    // Replace the actual bytes while the same authenticated operator remains active.
    await app.store.transaction("procurement", async (_snapshot, blobs) => {
      await blobs.put("supplier/s1/atlas-terms", new TextEncoder().encode("Price: 99"), "text/plain")
      return { commit: true, value: undefined }
    })
    const revoked = await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => product.context.resolve(documentRef, call))
    expect(revoked.state).not.toBe("fresh")
    expect(revoked.authorizedProjection).toBeUndefined()
    expect(revoked.currentRef).toBeUndefined()
    expect(await ui("sf_evidence_get", { evidenceRef: documentRef }, (call) => atlas.memory.readOriginal(caseRef, documentRef.refDigest, call))).toBeUndefined()
    expect(await ui("sf_decision_recall", recallInput, (call) => atlas.memory.recall(caseRef, call))).toEqual({ status: "unavailable" })
    const refused = await ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => product.context.emitFromLedger(eventRef, call))
    expect(refused.status).toBe("unavailable")
    expect(refused.eventId).toBeUndefined()
    expect(refused.recordDigest).toBeUndefined()
    const afterRevocation = await authority.state.read(app.request(), "atlas", (state) => ({ atlas: state.atlas, outbox: state.outbox[outboxKey], versions: { atlas: state.versions.atlas, outbox: state.versions.outbox } }))
    expect(afterRevocation.status).toBe("ok")
    if (afterRevocation.status !== "ok") throw new Error("Durable Atlas state unavailable after revocation")
    expect(afterRevocation.value).toEqual(durable.value)
  } finally {
    try { business?.dispose() }
    finally { try { documents?.dispose() } finally { await app.dispose() } }
  }
}, 180_000)
