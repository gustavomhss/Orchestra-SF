import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfDocumentEvidenceAdapter } from "../../../../product/documents/rag-adapter.ts"
import { resolveSfDocumentEvidence } from "../../../../product/documents/evidence-resolver.ts"
import { readDocumentEvidence } from "../../../../product/documents/store.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { confirmDocumentEvidence, extractDocumentEvidence, listDocumentEvidence, searchDocumentEvidence } from "../../../../product/documents/capabilities.ts"
import { createPrivateDocumentParser } from "../../../../product/documents/parser.ts"
import { documentTestPersistence } from "./fixture.ts"

test("multi-field candidates commit together and confirmation retry preserves evidence", async () => {
  const storage = documentTestPersistence()
  const request = new Request("https://example.test/document")
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => ({ principalRef: "u", accessRevision: "a", policyVersion: "v" }), resolveTarget: async () => ({ incarnation: "inc" }), createId: () => "state-inc" })
  const bytes = new TextEncoder().encode("Price: 42\nActive: true")
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  storage.state.dashboard.sfSources = { schemaVersion: 1, records: { [JSON.stringify(["document-asset", "doc"])]: { incarnation: "inc", version: 1, alive: true, inputDigest: digest } } }
  const initialized = await state.transaction(request, { namespace: "documents", expectedStorageVersion: 0, idempotencyKey: "initialize", commandDigest: "a".repeat(64), targetRef: "doc", targetIncarnation: "inc" }, async (snapshot) => { snapshot.documents["asset:doc"] = { schema: "sf-asset-v1", documentId: "doc", assetId: "doc", surface: "dashboard", incarnation: "inc", revision: 1, blobDigest: digest }; return { commit: true, value: true } })
  expect(initialized.status).toBe("ok")
  let operation = "extract"
  let allowed = true
  let admittedEvidence = ""
  const input = {
    state,
    host: { requestFor: () => request, revalidate: async () => allowed },
    documents: { read: async () => ({ status: "ok" as const, value: { documentId: "doc", incarnation: "inc", revision: 1, fileName: "a.txt", mediaType: "text/plain" as const, blobDigest: { algorithm: "sha256" as const, value: digest }, bytes } }), revalidate: async () => allowed },
    parser: createPrivateDocumentParser({ maxBytes: 1000, maxTextLength: 1000, maxPages: 1, maxXmlBytes: 1000, maxZipEntries: 10 }),
    resolveFieldSchema: async () => ({ status: "ok" as const, value: { id: "schema", version: "1", fields: [{ id: "Price", type: "number" as const }, { id: "Active", type: "boolean" as const }] } }),
    verifyFieldSchema: () => true,
    operationIdentity: (_context: TrustedDomainContext, call?: { name: "sf_document_extract"; digest: string }) => {
      if (operation === "extract") expect(call).toEqual({ name: "sf_document_extract", digest: digestSfValue({ documentRef: "doc", fieldSchemaRef: "schema" }) })
      return operation
    },
    confirmDocument: async (evidence: { status: string; id: string }) => evidence.status === "extracted" && evidence.id === admittedEvidence,
    createId: () => "unused",
    now: () => "2026-01-01T00:00:00Z",
  }
  const first = await extractDocumentEvidence({ documentRef: "doc", fieldSchemaRef: "schema" }, context, input)
  expect(first.status).toBe("ok")
  if (first.status !== "ok") return
  const candidates = await listDocumentEvidence("doc", context, input)
  expect(candidates.status).toBe("ok")
  if (candidates.status !== "ok") return
  expect(candidates.value.map((entry) => entry.value)).toEqual([42, true])
  expect(candidates.value.every((entry) => entry.status === "extracted")).toBe(true)
  const search = await searchDocumentEvidence({ query: "Price", documentRefs: ["doc"], limit: 5 }, context, input)
  expect(search.status).toBe("ok")
  if (search.status !== "ok") return
  expect(search.value.matches.some((match) => match.text === "Price")).toBe(true)
  expect((await searchDocumentEvidence({ query: "Price", documentRefs: ["other"], limit: 5 }, context, input))).toMatchObject({ status: "ok", value: { matches: [] } })
  operation = "confirm"
  admittedEvidence = first.value.id
  const confirmed = await confirmDocumentEvidence(first.value.id, context, input)
  expect(confirmed.status).toBe("ok")
  if (confirmed.status !== "ok") return
  expect(confirmed.value.ref.target.confirmationVersion).toBe(1)
  expect(confirmed.value.ref.refDigest).toBe(digestSfEvidenceRef(confirmed.value.ref))
  const afterConfirmation = await listDocumentEvidence("doc", context, input)
  expect(afterConfirmation.status).toBe("ok")
  if (afterConfirmation.status !== "ok") return
  expect(afterConfirmation.value.find((entry) => entry.id === first.value.id)?.ref).toEqual(confirmed.value.ref)
  const reader = createSfDocumentEvidenceAdapter(async (_documentId, call, candidateId) => {
    if (!candidateId) return { status: "unavailable", accessRevision: call.binding.accessRevision }
    const record = await readDocumentEvidence(candidateId, call, { state, documents: input.documents, requestFor: input.host.requestFor, revalidate: input.host.revalidate })
    return record.status === "ok" ? { status: "ok", snapshot: record.value.snapshot } : { status: "unavailable", accessRevision: call.binding.accessRevision }
  }, input.documents, input.parser)
  const versioned = { ...confirmed.value.ref, target: { ...confirmed.value.ref.target, confirmationVersion: 1 }, refDigest: "" }
  const sealed = { ...versioned, refDigest: digestSfEvidenceRef(versioned) }
  const resolution = await resolveSfDocumentEvidence(sealed, context, reader)
  expect(resolution.state).toBe("fresh")
  expect(resolution.authorizedProjection).toMatchObject({ id: first.value.id, status: "confirmed", ref: { refDigest: sealed.refDigest } })
  const wrong = { ...sealed, target: { ...sealed.target, confirmationVersion: 2 }, refDigest: "" }
  expect((await resolveSfDocumentEvidence({ ...wrong, refDigest: digestSfEvidenceRef(wrong) }, context, reader)).state).toBe("stale")
  expect((await confirmDocumentEvidence(first.value.id, context, input)).status).toBe("ok")
  allowed = false
  expect((await listDocumentEvidence("doc", context, input)).status).not.toBe("ok")
})

test("an admitted document can be indexed and searched without a field candidate", async () => {
  const { indexSfDocument } = await import("../../../../product/documents/index.ts")
  const storage = documentTestPersistence()
  const request = new Request("https://example.test/document")
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => ({ principalRef: "u", accessRevision: "a", policyVersion: "v" }), resolveTarget: async () => ({ incarnation: "inc" }), createId: () => "state-inc" })
  const bytes = new TextEncoder().encode("Original contract price: 42")
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  storage.state.dashboard.sfSources = { schemaVersion: 1, records: { [JSON.stringify(["document-asset", "doc"])]: { incarnation: "inc", version: 1, alive: true, inputDigest: digest } } }
  await state.transaction(request, { namespace: "documents", expectedStorageVersion: 0, idempotencyKey: "init", commandDigest: "a".repeat(64), targetRef: "doc", targetIncarnation: "inc" }, async (snapshot) => { snapshot.documents["asset:doc"] = { schema: "sf-asset-v1", documentId: "doc", assetId: "doc", surface: "dashboard", incarnation: "inc", revision: 1, blobDigest: digest }; return { commit: true, value: true } })
  let current = true
  const documents = { read: async () => current ? { status: "ok" as const, value: { documentId: "doc", incarnation: "inc", revision: 1, fileName: "contract.txt", mediaType: "text/plain" as const, blobDigest: { algorithm: "sha256" as const, value: digest }, bytes } } : { status: "denied" as const, reason: "revoked" }, revalidate: async () => current }
  const parser = createPrivateDocumentParser({ maxBytes: 1000, maxTextLength: 1000, maxPages: 1, maxXmlBytes: 1000, maxZipEntries: 10 })
  const host = { requestFor: () => request, revalidate: async () => current }
  expect((await indexSfDocument("doc", context, { state, documents, parser, ...host, operationIdentity: () => "index" })).status).toBe("ok")
  const reader = createSfDocumentEvidenceAdapter(async (_id, call) => {
    const key = `document-index:${digestSfValue(["i", "p", "doc"])}`
    const result = await state.read(request, "documents", (snapshot) => snapshot.documents[key])
    const index = result.status === "ok" ? result.value as import("../../../../product/documents/index.ts").StoredDocumentIndex | undefined : undefined
    return index ? { status: "ok", snapshot: index.snapshot } : { status: "unavailable", accessRevision: call.binding.accessRevision }
  }, documents, parser)
  const input = { state, documents, parser, host, reader, verifyFieldSchema: () => false, resolveFieldSchema: async () => ({ status: "unavailable" as const, reason: "not-needed" }), operationIdentity: () => "index", confirmDocument: async () => false, createId: () => "unused", now: () => "2026-01-01T00:00:00Z" }
  const found = await searchDocumentEvidence({ query: "price", documentRefs: ["doc"], limit: 5 }, context, input)
  expect(found.status).toBe("ok")
  if (found.status !== "ok") return
  expect(found.value.matches).toHaveLength(1)
  expect((await resolveSfDocumentEvidence(found.value.matches[0]!.documentRef, context, reader)).state).toBe("fresh")
  current = false
  expect((await resolveSfDocumentEvidence(found.value.matches[0]!.documentRef, context, reader)).state).not.toBe("fresh")
})
