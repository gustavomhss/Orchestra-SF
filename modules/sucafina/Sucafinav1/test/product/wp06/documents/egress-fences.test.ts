import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { rows } from "../../../../runtime/contract.ts"
import { createSfDocumentSelections } from "../../../../product/documents/selections.ts"
import { createSfRequestDocumentEvidence } from "../../../../product/documents/request-evidence.ts"
import { searchDocumentEvidence } from "../../../../product/documents/capabilities.ts"
import { createPrivateDocumentParser } from "../../../../product/documents/parser.ts"
import { sfDocumentLimits } from "../../../../product/documents/limits.ts"
import { createProcurementCollectionRegistry } from "../../../../product/procurement/sources.ts"
import { sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp06Runtime>>

async function uploadQuotes(fixture: Fixture, count: number) {
  await fixture.store.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
      r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Current Request", estAmount: 42 }, history: [] } },
    } }
    return { commit: true, value: undefined }
  })
  for (let index = 1; index <= count; index++) {
    const uploaded = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
      const version = snapshot.versions["requests:r1"]?.version ?? 0
      const value = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] }, { page: "Requests", action: "upload", id: "r1", version, values: {} }, { at: fixture.at, id: () => `asset-${index}`, directory: [] }, fixture.runtime.assets.services, "quote", { name: `terms-${index}.txt`, type: "text/plain", bytes: new TextEncoder().encode(`Price: ${index + 41}`) })
      return { commit: value.ok, value }
    })
    expect(uploaded.ok).toBe(true)
  }
}

async function admitAll(fixture: Fixture) {
  const response = await fixture.documentRequest("document-sources")
  expect(response.status).toBe(200)
  const sources = await response.json() as { value: { selectionRef: string }[] }
  const admitted: string[] = []
  for (const source of sources.value) {
    const response = await fixture.documentRequest("document-admit", { selectionRef: source.selectionRef })
    expect(response.status).toBe(200)
    const value = await response.json() as { value: { documentRef: string } }
    admitted.push(value.value.documentRef)
  }
  return admitted
}

async function changeAsset(fixture: Fixture, id: string) {
  await fixture.store.transaction("procurement", async (snapshot) => {
    const asset = rows(snapshot.data.assets).find((entry) => entry.id === id)
    if (!asset) throw new Error("Expected authorized asset")
    asset.name = "changed-source.txt"
    return { commit: true, value: undefined }
  })
}

test("discovery fences source revisions again after both surface reads finish", async () => {
  const fixture = await createWp06Runtime()
  try {
    await uploadQuotes(fixture, 1)
    let checks = 0
    const selections = createSfDocumentSelections({ host: { ...fixture.authority.host, revalidate: async (context) => {
      checks++
      if (checks === 3) await changeAsset(fixture, "asset-1")
      return fixture.authority.host.revalidate(context)
    } }, assets: fixture.store, services: fixture.runtime.assets.services, maxBytes: sfDocumentLimits.maxBytes, admit: fixture.documents.documents.admit })
    const result = await fixture.uiCall("sf_document_extract", {}, (context) => selections.discover(context))
    expect(checks).toBe(3)
    expect(result).toEqual({ status: "stale", reason: "document-selection-changed" })
    expect(JSON.stringify(result)).not.toContain("terms-1.txt")
    selections.dispose()
  } finally { await fixture.dispose() }
}, 30_000)

test("Request document evidence uses the actual Request resolver and fences an asset changed after list", async () => {
  const fixture = await createWp06Runtime()
  try {
    await uploadQuotes(fixture, 1)
    const [documentRef] = await admitAll(fixture)
    if (!documentRef) throw new Error("Document was not admitted")
    const registered = await (await fixture.documentRequest("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })).json() as { value: { ref: string } }
    const extraction = await fixture.documentRequest("document-extract", { documentRef, fieldSchemaRef: registered.value.ref })
    expect(extraction.status).toBe(200)
    const candidate = decodeSfOperationOutput("sf_document_extract", (await extraction.json()).value)
    if (!candidate.ok) throw new Error("Candidate schema mismatch")
    const registry = createProcurementCollectionRegistry({ host: fixture.authority.host, scopedSources: fixture.store, contextFor: async (context) => ({ status: "ok", value: {
      installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef,
      accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [],
    } }) })
    const requestRef = await fixture.uiCall("sf_evidence_get", { evidenceRef: candidate.value.ref }, async (context) => {
      const selected = await registry.createSelection(context)
      if (selected.status !== "ok") throw new Error(selected.reason)
      const collection = await registry.resolveRequestCollection(selected.value, context)
      if (collection.status !== "ok") throw new Error(collection.reason)
      const request = collection.value.requests.find((entry) => entry.target.recordId === "r1")
      if (!request) throw new Error("Request was not authorized")
      return request.refId
    })
    const selectedDocuments = createSfRequestDocumentEvidence({ host: fixture.authority.host, state: fixture.authority.state, services: fixture.runtime.assets.services, resolveRequest: (ref, context) => registry.resolveRequestSource(ref, context), list: fixture.documents.documents.list })
    const good = await fixture.uiCall("sf_evidence_get", { evidenceRef: candidate.value.ref }, (context) => selectedDocuments(requestRef, context))
    expect(good).toEqual({ status: "ok", value: [candidate.value.ref] })
    const before = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "procurement-request", "r1") }))
    const changedDuringList = createSfRequestDocumentEvidence({ host: fixture.authority.host, state: fixture.authority.state, services: fixture.runtime.assets.services, resolveRequest: (ref, context) => registry.resolveRequestSource(ref, context), list: async (ref, context) => {
      const result = await fixture.documents.documents.list(ref, context)
      expect(result.status).toBe("ok")
      await changeAsset(fixture, "asset-1")
      return result
    } })
    const result = await fixture.uiCall("sf_evidence_get", { evidenceRef: candidate.value.ref }, (context) => changedDuringList(requestRef, context))
    expect(result).toEqual({ status: "stale", reason: "document-selection-changed" })
    expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "procurement-request", "r1") }))).toEqual(before)
  } finally { await fixture.dispose() }
}, 90_000)

test("search suppresses an earlier match when a later document read changes its source", async () => {
  const fixture = await createWp06Runtime()
  try {
    await uploadQuotes(fixture, 2)
    const documentRefs = await admitAll(fixture)
    let changed = false
    const result = await fixture.uiCall("sf_knowledge_search", { query: "Price", documentRefs, limit: 10 }, (context) => searchDocumentEvidence({ query: "Price", documentRefs, limit: 10 }, context, {
      host: fixture.authority.host, state: fixture.authority.state, documents: fixture.documents.documents.documents,
      parser: createPrivateDocumentParser(sfDocumentLimits), resolveFieldSchema: fixture.documents.schemas.resolve, verifyFieldSchema: fixture.documents.schemas.verify,
      operationIdentity: (context) => context.kind === "ui" ? fixture.authority.ui.operationIdentity(context) : undefined,
      confirmDocument: async () => false, createId: randomUUID, now: () => fixture.at,
      reader: async (documentId, context, candidateId, ref) => {
        if (documentId === "asset-2" && !changed) { changed = true; await changeAsset(fixture, "asset-1") }
        return fixture.documents.documents.reader(documentId, context, candidateId, ref)
      },
    }))
    expect(changed).toBe(true)
    expect(result).toEqual({ status: "unavailable", reason: "authority-changed" })
  } finally { await fixture.dispose() }
}, 90_000)
