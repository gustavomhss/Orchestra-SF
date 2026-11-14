import { randomUUID } from "node:crypto"
import { createWp06Runtime } from "../wp06/runtime-fixture.ts"
import { prepareAtlasScanner } from "../wp02/atlas-consumer-fixture.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfDocumentServices } from "../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardSourceIssuer, createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { enqueueSfLedgerEvent } from "../../../product/integration/ledger-outbox.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createSfAtlasBusiness } from "../../../product/host-binding/business-context.ts"
import { createSfAtlasMemory } from "../../../product/host-binding/atlas-memory.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { deriveAuthorizedRecallFeatures } from "../../../product/decision-memory/case-features.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { captureRecordAssets, deleteRecordAssets, uploadAsset } from "../../../runtime/assets.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent, DecisionCase, DocumentEvidence } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

type DocumentSource = { assetId: string; supplierId: string; bytes: Uint8Array; ref: Extract<BusinessEvidenceRef, { kind: "document" }>; evidence: DocumentEvidence }
const period = { start: "2026-01-01", end: "2026-12-31" }

/** Real local credentials, C08/SQLite, C17 extraction/confirmation, outbox and Atlas.
 * Supplier data and the accepted ledger event are explicit synthetic premises.
 * WP06 substitutes the ingress asset scan; Atlas uses qualified upstream Gitleaks.
 * There is no native Session/model-acceptance or separate-process restart claim. */
export async function withDocumentReplayFixture(work: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>, documentCount: 1 | 2 = 1) {
  const app = await createWp06Runtime()
  const resources: { documents?: ReturnType<typeof createSfDocumentServices>; business?: ReturnType<typeof createSfBusinessServices> } = {}
  try { await work(await createFixture(app, resources, documentCount)) }
  finally {
    try { resources.business?.dispose() }
    finally { try { resources.documents?.dispose() } finally { await app.dispose() } }
  }
}

async function createFixture(app: Awaited<ReturnType<typeof createWp06Runtime>>, resources: { documents?: ReturnType<typeof createSfDocumentServices>; business?: ReturnType<typeof createSfBusinessServices> }, documentCount: 1 | 2) {
  const scannerPin = await prepareAtlasScanner(app.directory)
  const procurementEvidenceWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => app.installation, installationId: app.operator.installationId,
    origin: app.origin, policyVersion: "policy", persistence: app.store, procurementEvidenceWrites,
    authenticate: app.runtime.authenticate, environment: app.runtime.environment,
    grants: [app.principal, app.otherPrincipal].map((principal) => ({ principalRef: principal.id,
      namespaces: ["documents", "receipts", "cases", "outbox", "atlas"] as const,
      operations: ["sf_document_extract", "sf_evidence_get", "sf_case_draft", "sf_case_read", "sf_decision_recall"],
      humanActions: ["documents.schema", "documents.confirm"] as const })),
    createId: randomUUID, now: () => Date.parse(app.at),
    commandIdentity: async (request, operation) => {
      const key = request.headers.get("Idempotency-Key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: createSfDocumentTargetAuthority(app.runtime) })
  const documents = createSfDocumentServices({ runtime: app.runtime, authority })
  resources.documents = documents
  if (!documents) throw new Error("Actual document services unavailable")
  const business = createSfBusinessServices({ authority, persistence: app.store, proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites, documentRead: documents.documents.reader })
  resources.business = business
  const host = authority.host
  const selected: { caseRef?: { id: string; incarnation: string } } = {}
  // Intentionally light: membership and actual host authority only. No case/source
  // resolver is hidden in this callback; replay itself must reauthorize sources.
  const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call)
  const atlas = createSfAtlasBusiness({ host, authority: authority.authority, state: authority.state, cases: business.cases, authorizeCase,
    dashboard: business.dashboard, dashboardIssue: createDashboardSourceIssuer({ host, scopedSources: app.store }),
    dashboardRecords: createDashboardRecordEvidenceHost({ host, scopedSources: app.store, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: app.store }) }),
    procurement: business.procurement, procurementResolve: business.resolveProcurement, documentRead: documents.documents.reader,
    scanner: scannerPin, now: () => app.at,
    caseForEvidence: async (digest, call) => {
      const ref = selected.caseRef
      const request = host.requestFor(call)
      if (!ref || !request || !await host.revalidate(call)) return undefined
      const current = await business.cases.read({ caseRef: encodeCaseRef(ref) }, call)
      if (current.status !== "ok") return undefined
      const saved = await authority.state.read(request, "outbox", (state, actor) =>
        actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
        Object.values(state.outbox).some((entry) => entry.eventRef.refDigest === digest && entry.eventRef.target.caseId === ref.id && entry.eventRef.target.caseIncarnation === ref.incarnation))
      return saved.status === "ok" && (saved.value || current.value.evidenceRefs.some((item) => item.refDigest === digest)) && await host.revalidate(call) ? ref : undefined
    },
    selections: {
      runtimeVersions: { boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" },
      featuresForCase: async (value, call) => deriveAuthorizedRecallFeatures(value, call),
      contextSelections: async (request, call) => {
        const found = await Promise.all(request.selectionRefs.map((caseRef) => business.cases.read({ caseRef }, call)))
        if (!found.length || found.some((item) => item.status !== "ok" || digestSfValue(item.value.case.horizon) !== digestSfValue(request.period))) return undefined
        return found.flatMap((item) => item.status === "ok" ? item.value.evidenceRefs : [])
      },
      recallSelections: async (request, call) => {
        if (request.selectionRefs.length !== 1) return undefined
        const current = await business.cases.read({ caseRef: request.selectionRefs[0]! }, call)
        if (current.status !== "ok" || digestSfValue(current.value.case.horizon) !== digestSfValue(request.period)) return undefined
        const features = deriveAuthorizedRecallFeatures(current.value, call)
        return features ? { caseRefs: [{ id: current.value.case.id, incarnation: current.value.case.incarnation }], features } : undefined
      },
    } })
  business.evidence.current = atlas.context
  const counts = { scans: 0 }
  const realScanner = createSfAtlasScanner({ scanners: [scannerPin.spec] })
  const memory = createSfAtlasMemory({ state: authority.state, cases: business.cases, authorizeCase, host,
    evidence: atlas.context, proveContinuity: atlas.proveContinuity,
    scanner: { name: realScanner.name, scan(record) { counts.scans += 1; return realScanner.scan(record) } },
    scannerVersion: scannerPin.version, now: () => app.at })
  const ui = async <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, request = app.request()) => {
    const digest = digestSfValue(payload)
    const admitted = await authority.ui.admit(request, operation, digest)
    if (admitted.status !== "ok") throw new Error(`Actual UI admission failed: ${admitted.reason}`)
    try {
      if (!await authority.ui.validate(admitted.value, operation, digest)) throw new Error("Actual UI grant unavailable")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  const definitions = Array.from({ length: documentCount }, (_, index) => ({ assetId: `m40-doc-${index}`, supplierId: `m40-supplier-${index}`, bytes: new TextEncoder().encode(`Price: ${42 + index}`) }))
  await app.store.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { suppliers: definitions.map((item) => ({ id: item.supplierId, name: `Document supplier ${item.assetId}` })), settings: { uploadCap: 100_000 } }
    return { commit: true, value: undefined }
  })
  const upload = async (item: typeof definitions[number]) => {
    const result = await app.store.transaction("procurement", async (snapshot, blobs) => {
      const actor = await app.runtime.authenticate(app.request("procurement"), { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!actor || actor.id !== app.principal.id) throw new Error("Actual supplier principal unavailable")
      const uploaded = await uploadAsset(snapshot, blobs, { id: actor.id, roles: actor.roles.filter((role) => role.surface === "procurement").map((role) => role.role), canWrite: actor.canWrite, assigned: [], domains: [] },
        { page: "Suppliers", action: "upload", id: item.supplierId, version: snapshot.versions[`suppliers:${item.supplierId}`]?.version ?? 0, values: {} },
        { at: app.at, id: () => item.assetId, directory: [] }, app.runtime.assets.services,
        "supplier", { name: `${item.assetId}.txt`, type: "text/plain", bytes: item.bytes })
      return { commit: uploaded.ok, value: uploaded }
    })
    if (!result.ok) throw new Error("Actual document upload failed")
  }
  const sources: DocumentSource[] = []
  for (const definition of definitions) {
    await upload(definition)
    const discovered = await ui("sf_document_extract", {}, (call) => documents.discover(call))
    if (discovered.status !== "ok") throw new Error(discovered.reason)
    const selection = discovered.value.find((item) => item.label === `${definition.assetId}.txt`)
    if (!selection) throw new Error("Actual uploaded document was not discovered")
    const admitted = await ui("sf_document_extract", { selectionRef: selection.selectionRef }, (call) => documents.admitSelection(selection.selectionRef, call))
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    const schemaInput = { documentRef: admitted.value.documentId, fields: [{ id: "Price", type: "number" as const, unit: "USD" }] }
    const schemaGrant = await authority.human.admit(app.request(), "documents.schema", schemaInput)
    if (schemaGrant.status !== "ok") throw new Error(schemaGrant.reason)
    const schema = await documents.schemas.register(schemaInput, schemaGrant.value).finally(() => authority.human.finish(schemaGrant.value))
    if (schema.status !== "ok") throw new Error(schema.reason)
    const extractInput = { documentRef: admitted.value.documentId, fieldSchemaRef: schema.value.ref }
    const candidate = await ui("sf_document_extract", extractInput, (call) => documents.documents.extract(extractInput, call))
    if (candidate.status !== "ok") throw new Error(candidate.reason)
    const confirmGrant = await authority.human.admit(app.request(), "documents.confirm", candidate.value)
    if (confirmGrant.status !== "ok") throw new Error(confirmGrant.reason)
    const confirmed = await documents.documents.confirm(candidate.value.id, confirmGrant.value).finally(() => authority.human.finish(confirmGrant.value))
    if (confirmed.status !== "ok" || confirmed.value.status !== "confirmed" || confirmed.value.ref.target.confirmationVersion !== 1) throw new Error("Actual document confirmation unavailable")
    sources.push({ ...definition, ref: confirmed.value.ref, evidence: confirmed.value })
  }
  const sourceRefs = sources.map((item) => item.ref)
  const draftInput = { objective: "Review confirmed supplier prices", horizon: period, currency: "USD", criteria: ["Use confirmed document amounts"], sourceRefs }
  const drafted = await ui("sf_case_draft", draftInput, (call) => business.cases.draft(draftInput, call))
  if (drafted.status !== "ok") throw new Error(drafted.reason)
  const caseRef = { id: drafted.value.id, incarnation: drafted.value.incarnation }
  selected.caseRef = caseRef
  // Fixture premise only: C08 commits the accepted event and real outbox producer.
  const event: CaseLedgerEvent = { id: randomUUID(), caseRef: { ...caseRef, version: drafted.value.version + 1 }, kind: "analysis-accepted",
    principalRef: app.principal.id, at: app.at, consideredActions: ["Review confirmed supplier prices"], factualGaps: [], lifecycleState: "investigating",
    rationale: "Human-confirmed supplier documents provide the compared prices.", evidenceRefs: sourceRefs,
    outputDigest: digestSfValue({ premise: "accepted-document-review", sourceRefs }) }
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
        actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion || !current.participants.includes(actor.principalRef)) throw new Error("Actual ledger premise changed")
      state.cases[current.id] = { ...current, version: event.caseRef.version, state: "investigating", ledger: [...current.ledger, event] }
      const queued = enqueueSfLedgerEvent(state, event, { installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor })
      if (queued.status !== "ok") throw new Error(queued.reason)
      return { commit: true, value: queued.value.eventRef }
    })
    if (saved.status !== "ok") throw new Error("Actual ledger/outbox commit failed")
    return saved.value
  })
  const replayKey = `m40-replay:${event.id}`
  const replayRequest = (cookie = app.cookie) => new Request(`${app.origin}/sucafina/dashboard`, { method: "POST", headers: { cookie, origin: app.origin, "Idempotency-Key": replayKey } })
  const replay = (request = replayRequest()) => ui("sf_evidence_get", { evidenceRef: eventRef }, (call) => memory.emitFromLedger(eventRef, call), request)
  const receipt = await replay()
  if (receipt.status !== "committed" || !receipt.eventId || !receipt.recordDigest || receipt.scanner.status !== "clean") throw new Error(`Real Atlas publication failed: ${receipt.reason ?? receipt.status}`)
  const audit = () => app.store.transaction("dashboard", async (snapshot) => {
    const state = object(snapshot.data.__sfProductV1)
    const versions = object(state.versions)
    const partitions = Object.values(object(state.atlas)).map(object)
    return { commit: false, value: structuredClone({ atlas: state.atlas, outbox: state.outbox, receipts: state.receipts, transactions: state.transactions,
      versions: { atlas: versions.atlas, outbox: versions.outbox, receipts: versions.receipts },
      counts: { events: partitions.reduce((sum, partition) => sum + (Array.isArray(partition.events) ? partition.events.length : 0), 0),
        envelopes: partitions.reduce((sum, partition) => sum + Object.keys(object(partition.envelopes)).length, 0),
        outbox: Object.keys(object(state.outbox)).length, receipts: Object.keys(object(state.receipts)).length,
        settled: Object.values(object(state.outbox)).filter((item) => object(item).state === "settled").length, scans: counts.scans } }) }
  })
  const original = (source = sources[0]!, ref = caseRef) => ui("sf_evidence_get", { evidenceRef: source.ref }, (call) => atlas.memory.readOriginal(ref, source.ref.refDigest, call))
  const resolve = (source = sources[0]!) => ui("sf_evidence_get", { evidenceRef: source.ref }, (call) => atlas.context.resolve(source.ref, call))
  const replaceBytes = (source: DocumentSource, bytes: Uint8Array) => app.store.transaction("procurement", async (_snapshot, blobs) => {
    await blobs.put(`supplier/${source.supplierId}/${source.assetId}`, bytes, "text/plain")
    return { commit: true, value: undefined }
  })
  const corruptCapture = (source: DocumentSource) => app.store.transaction("dashboard", async (snapshot) => {
    const partition = Object.values(object(object(snapshot.data.__sfProductV1).atlas)).map(object).find((item) => object(item.originals)[source.ref.refDigest])
    if (!partition) throw new Error("Capture unavailable for explicit corruption fault")
    const capture = object(object(partition.originals)[source.ref.refDigest])
    const intact = structuredClone(capture)
    capture.projection = { ...object(capture.projection), value: 999 }
    return { commit: true, value: intact }
  })
  const restoreCapture = (source: DocumentSource, capture: Record<string, unknown>) => app.store.transaction("dashboard", async (snapshot) => {
    const partition = Object.values(object(object(snapshot.data.__sfProductV1).atlas)).map(object).find((item) => object(item.originals)[source.ref.refDigest])
    if (!partition) throw new Error("Capture unavailable for explicit fault restoration")
    object(partition.originals)[source.ref.refDigest] = structuredClone(capture)
    return { commit: true, value: undefined }
  })
  const removeSource = (source: DocumentSource) => app.store.transaction("procurement", async (snapshot, blobs) => {
    const captured = captureRecordAssets(snapshot, "supplier", source.supplierId)
    const store = object(snapshot.data.store)
    store.suppliers = rows(store.suppliers).filter((supplier) => supplier.id !== source.supplierId)
    await deleteRecordAssets(snapshot, blobs, "supplier", source.supplierId, captured)
    return { commit: true, value: undefined }
  })
  const recreateSource = async (source: DocumentSource) => {
    await app.store.transaction("procurement", async (snapshot) => {
      const store = object(snapshot.data.store)
      store.suppliers = [...rows(store.suppliers), { id: source.supplierId, name: "Recreated document supplier" }]
      return { commit: true, value: undefined }
    })
    await upload(source)
    return app.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", source.assetId) }))
  }
  return { app, authority, atlas, memory, ui, sources, caseRef, eventRef, receipt, scannerPin, counts, replayKey, replayRequest, replay, audit, original, resolve, replaceBytes, corruptCapture, restoreCapture, removeSource, recreateSource }
}
