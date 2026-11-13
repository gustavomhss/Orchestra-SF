import { memoryStore, openRevision, parseSource, searchWords, withStore } from "@orchestra/rag-studio"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { EvidenceSearchResult } from "../contracts/outputs.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { DocumentExtractRequest, KnowledgeSearchRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import { resolveSfDocumentEvidence } from "./evidence-resolver.ts"
import type { SfDocumentReader } from "./evidence-resolver.ts"
import type { StoredDocumentIndex } from "./index.ts"
import { extractAuthorizedDocument } from "./extract.ts"
import type { PrivateDocumentParser } from "./extract.ts"
import { createSfDocumentEvidenceAdapter } from "./rag-adapter.ts"
import type { SfDocumentSnapshot } from "./rag-adapter.ts"
import { readDocumentEvidence } from "./store.ts"
import type { StoredDocumentEvidence } from "./store.ts"
import { documentAsset, documentSourceCurrent } from "./source-fence.ts"

export type DocumentEvidenceHost = {
  documents: SfDocumentReadPort
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  parser: PrivateDocumentParser
  reader?: SfDocumentReader
  resolveFieldSchema: (ref: string, context: TrustedDomainContext, documentRef: string) => Promise<PortResult<{ id: string; version: string; fields: readonly { id: string; type: "string" | "number" | "boolean" | "date"; unit?: string }[] }>>
  verifyFieldSchema: (state: Readonly<SfProductState>, expected: { id: string; version: string; fields: readonly { id: string; type: "string" | "number" | "boolean" | "date"; unit?: string }[] }, documentRef: string, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext, operation?: { name: "sf_document_extract"; digest: string }) => string | undefined
  confirmDocument: (evidence: DocumentEvidence, context: TrustedDomainContext) => Promise<boolean>
  createId: () => string
  now: () => string
}


export async function extractDocumentEvidence(request: DocumentExtractRequest, context: TrustedDomainContext, input: DocumentEvidenceHost): Promise<PortResult<DocumentEvidence>> {
  const hostRequest = input.host.requestFor(context)
  const operationId = input.operationIdentity(context, { name: "sf_document_extract", digest: digestSfValue(request) })
  if (!hostRequest || !operationId || !(await input.host.revalidate(context))) return { status: "denied", reason: "authority-unavailable" }
  const schema = await input.resolveFieldSchema(request.fieldSchemaRef, context, request.documentRef)
  if (schema.status !== "ok") return schema
  if (!schema.value.fields.length || schema.value.fields.length > 100 || schema.value.fields.some((field) => !field.id.trim()) || new Set(schema.value.fields.map((field) => field.id)).size !== schema.value.fields.length) return { status: "needs-input", reason: "invalid-field-schema" }
  const document = await extractAuthorizedDocument(request.documentRef, context, input.documents, input.parser, hostRequest.signal)
  if (document.status !== "ok") return document
  const fields = schema.value.fields.map((field) => {
    const lines = [...document.value.text.matchAll(/^([^\n:]+):[ \t]*([^\n]+)$/gm)].filter((match) => match[1]?.trim() === field.id)
    if (lines.length !== 1 || lines[0].index === undefined) return undefined
    const raw = lines[0][2].trim()
    const value = field.type === "string" ? raw : field.type === "number" && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw) ? Number(raw) : field.type === "boolean" && (raw === "true" || raw === "false") ? raw === "true" : field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw ? raw : null
    if (!raw || value === null || (typeof value === "number" && !Number.isFinite(value))) return undefined
    const start = lines[0].index + lines[0][0].lastIndexOf(raw)
    return { field, raw, value, start, end: start + raw.length }
  })
  if (fields.some((field) => !field)) return { status: "needs-input", reason: "field-missing-or-ambiguous" }
  const sourceId = `src_${digestSfValue([context.binding.installationId, context.binding.projectId, document.value.documentId, document.value.incarnation, document.value.revision, document.value.blobDigest]).slice(0, 32)}`
  const locationId = `sf_${digestSfValue([context.binding.installationId, context.binding.projectId]).slice(0, 32)}`
  const file = "/sf-authorized/document.txt"
  const store = memoryStore({ projectRoot: "/sf-project" })
  store.writeFile(file, document.value.text)
  store.putSource({ id: sourceId, locationId, path: file, contentHash: "", status: "not_yet_read", text: "" })
  const rag = await withStore(store, async () => { const source = await parseSource(sourceId); const revision = await openRevision(locationId); return { source, revision } })
  const records = fields.flatMap((candidate) => {
    if (!candidate) return []
    const id = `doc_${digestSfValue([context.binding.installationId, context.binding.projectId, document.value.documentId, document.value.incarnation, document.value.revision, document.value.blobDigest, candidate.field.id, candidate.start, candidate.end]).slice(0, 40)}`
    const identity = { schema: "sf-evidence-v1" as const, refId: id, installationId: context.binding.installationId, projectId: context.binding.projectId, kind: "document" as const, evidenceLevel: "claim" as const, target: { documentId: document.value.documentId, incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest, segment: { start: candidate.start, end: candidate.end, unit: "utf16" as const, textDigest: { algorithm: "sha256" as const, value: new Bun.CryptoHasher("sha256").update(candidate.raw).digest("hex") } }, ragSourceId: sourceId, ragRevisionId: rag.revision.id, ragSourceHash: { algorithm: "blake3" as const, value: rag.source.contentHash }, fieldCandidateId: id }, refDigest: "" }
    const ref = { ...identity, refDigest: digestSfEvidenceRef(identity) }
    const evidence: DocumentEvidence = { id, fileRef: request.documentRef, version: document.value.revision, location: `text:${candidate.start}-${candidate.end}`, textRange: { start: candidate.start, end: candidate.end, unit: "utf16" }, fieldCandidate: candidate.field.id, value: candidate.value, ...(candidate.field.unit ? { unit: candidate.field.unit } : {}), status: "extracted", ref }
    const snapshot: SfDocumentSnapshot = { evidence, documentRef: request.documentRef, accessRevision: context.binding.accessRevision, locationId, incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value, source: store.sources()[0], chunks: store.chunks(), ragRevision: rag.revision }
    return [{ schema: "sf-document-v1" as const, snapshot, evidence, schemaRef: schema.value.id, schemaVersion: schema.value.version }]
  })
  const loaded = await input.state.read(hostRequest, "documents", (state) => documentAsset(state, request.documentRef))
  if ("reason" in loaded) return { status: loaded.status, reason: loaded.reason }
  if (loaded.status !== "ok") return { status: "unavailable", reason: "state-preview" }
  if (!loaded.value) return { status: "unavailable", reason: "document-unavailable" }
  if (!(await input.host.revalidate(context)) || !(await input.documents.revalidate(request.documentRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, context))) return { status: "stale", reason: "document-changed" }
  const saved = await input.state.transaction(hostRequest, { namespace: "documents", domainSurface: loaded.value.surface, expectedStorageVersion: loaded.storageVersion, idempotencyKey: operationId, commandDigest: digestSfValue({ request, document: document.value.blobDigest, schema: schema.value }), targetRef: document.value.documentId, targetIncarnation: document.value.incarnation }, async (state, authority, snapshot) => {
    if (!documentSourceCurrent(state, snapshot, request.documentRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, loaded.value!.surface) || !await input.documents.revalidate(request.documentRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, context).catch(() => false) || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !input.verifyFieldSchema(state, schema.value, request.documentRef, context) || records.some((record) => state.documents[record.evidence.id])) return { commit: false, value: null as DocumentEvidence | null }
    records.forEach((record) => { state.documents[record.evidence.id] = record })
    return { commit: true, value: records[0]?.evidence ?? null }
  })
  if (saved.status !== "ok" || !saved.value) return { status: "unavailable", reason: "document-state-not-committed" }
  const currentSchema = await input.resolveFieldSchema(request.fieldSchemaRef, context, request.documentRef)
  if (currentSchema.status !== "ok" || digestSfValue(currentSchema.value) !== digestSfValue(schema.value) || !(await input.host.revalidate(context)) || !(await input.documents.revalidate(request.documentRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, context))) return { status: "stale", reason: "document-or-schema-changed" }
  return { status: "ok", value: saved.value }
}

export async function confirmDocumentEvidence(id: string, context: TrustedDomainContext, input: DocumentEvidenceHost): Promise<PortResult<DocumentEvidence>> {
  if (context.kind !== "ui") return { status: "denied", reason: "human-confirmation-required" }
  const request = input.host.requestFor(context)
  const operationId = input.operationIdentity(context)
  if (!request || !operationId || !(await input.host.revalidate(context))) return { status: "denied", reason: "authority-unavailable" }
  const loaded = await input.state.read(request, "documents", (state) => ({ record: state.documents[id], assets: state.documents }))
  if (loaded.status !== "ok" || !loaded.value?.record || typeof loaded.value.record !== "object") return { status: "unavailable", reason: "candidate-unavailable" }
  const record = loaded.value.record as StoredDocumentEvidence
  if (record.schema !== "sf-document-v1" || record.evidence.id !== id || (record.evidence.status !== "extracted" && record.evidence.status !== "confirmed") || record.evidence.ref.refDigest !== digestSfEvidenceRef(record.evidence.ref)) return { status: "conflict", reason: "candidate-invalid" }
  const admittedEvidence: DocumentEvidence = { ...record.evidence, status: "extracted" }
  if (!(await input.confirmDocument(admittedEvidence, context))) return { status: "denied", reason: "human-confirmation-required" }
  const identity = { incarnation: record.snapshot.incarnation, revision: record.snapshot.revision, blobDigest: record.snapshot.blobDigest }
  const asset = documentAsset({ documents: loaded.value.assets }, record.snapshot.documentRef)
  if (!asset) return { status: "unavailable", reason: "document-unavailable" }
  if (!(await input.documents.revalidate(record.snapshot.documentRef, identity, context)) || !(await input.host.revalidate(context))) return { status: "stale", reason: "document-changed" }
  const confirmed: DocumentEvidence = { ...record.evidence, status: "confirmed" }
  const saved = await input.state.transaction(request, { namespace: "documents", domainSurface: asset.surface, expectedStorageVersion: loaded.storageVersion, idempotencyKey: operationId, commandDigest: digestSfValue({ action: "confirm", id, ref: confirmed.ref }), targetRef: confirmed.ref.target.documentId, targetIncarnation: identity.incarnation }, async (state, authority, snapshot) => {
    const current = state.documents[id] as StoredDocumentEvidence | undefined
    if (!documentSourceCurrent(state, snapshot, record.snapshot.documentRef, identity, asset.surface) || !await input.documents.revalidate(record.snapshot.documentRef, identity, context).catch(() => false) || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !current || record.evidence.status !== "extracted" || digestSfValue(current) !== digestSfValue(record) || !await input.confirmDocument(admittedEvidence, context)) return { commit: false, value: null as DocumentEvidence | null }
    state.documents[id] = { ...record, confirmationVersion: 1, evidence: confirmed, snapshot: { ...record.snapshot, confirmationVersion: 1, evidence: confirmed } }
    return { commit: true, value: confirmed as DocumentEvidence | null }
  })
  if (saved.status !== "ok" || !saved.value) return { status: "conflict", reason: "candidate-changed" }
  if (!(await input.host.revalidate(context)) || !(await input.documents.revalidate(record.snapshot.documentRef, identity, context)) || !(await input.confirmDocument(admittedEvidence, context))) return { status: "stale", reason: "document-changed" }
  const versioned = { ...saved.value.ref, target: { ...saved.value.ref.target, confirmationVersion: 1 }, refDigest: "" }
  return { status: "ok", value: { ...saved.value, ref: { ...versioned, refDigest: digestSfEvidenceRef(versioned) } } }
}

export async function searchDocumentEvidence(request: KnowledgeSearchRequest, context: TrustedDomainContext, input: DocumentEvidenceHost): Promise<PortResult<EvidenceSearchResult>> {
  if (!request.query.trim() || request.query.length > 256 || !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) return { status: "needs-input", reason: "invalid-search" }
  const hostRequest = input.host.requestFor(context)
  if (!hostRequest || !(await input.host.revalidate(context))) return { status: "denied", reason: "authority-unavailable" }
  const loaded = await input.state.read(hostRequest, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.documents) : [])
  if (loaded.status !== "ok") return { status: "unavailable", reason: "document-state-unavailable" }
  const records = loaded.value.filter((value): value is StoredDocumentEvidence | StoredDocumentIndex => !!value && typeof value === "object" && ((value as StoredDocumentEvidence).schema === "sf-document-v1" || (value as StoredDocumentIndex).schema === "sf-document-index-v1")).filter((record) => !!record.snapshot && (!request.documentRefs || request.documentRefs.includes(record.snapshot.documentRef)))
  const matches: EvidenceSearchResult["matches"][number][] = []
  const seen = new Set<string>()
  const sources = new Map<string, () => Promise<boolean>>()
  for (const record of records.slice(0, 100)) {
    if (matches.length >= request.limit) break
    const installationId = record.schema === "sf-document-v1" ? record.evidence.ref.installationId : record.installationId
    const projectId = record.schema === "sf-document-v1" ? record.evidence.ref.projectId : record.projectId
    if (installationId !== context.binding.installationId || projectId !== context.binding.projectId) continue
    const documentId = record.schema === "sf-document-v1" ? record.evidence.ref.target.documentId : record.snapshot.documentRef
    const reader = input.reader ?? (record.schema === "sf-document-v1" ? createSfDocumentEvidenceAdapter(async (_documentId, call) => {
      const current = await readDocumentEvidence(record.evidence.id, call, { state: input.state, documents: input.documents, requestFor: input.host.requestFor, revalidate: input.host.revalidate })
      return current.status === "ok" ? { status: "ok", snapshot: current.value.snapshot } : { status: "unavailable", accessRevision: call.binding.accessRevision }
    }, input.documents, input.parser) : undefined)
    if (!reader) continue
    const document = await reader(documentId, context, undefined, record.schema === "sf-document-v1" ? record.evidence.ref : undefined)
    if (document.status !== "ok") continue
    const hits = await withStore(document.store, () => searchWords(record.snapshot.ragRevision.id, request.query))
    for (const chunk of hits) {
      if (matches.length >= request.limit) break
      const offset = chunk.text.indexOf(request.query)
      if (offset < 0) continue
      const start = chunk.start + offset
      const end = start + request.query.length
      const target = { documentId, incarnation: record.snapshot.incarnation, revision: record.snapshot.revision, blobDigest: { algorithm: "sha256" as const, value: record.snapshot.blobDigest }, ragSourceId: record.snapshot.source.id, ragRevisionId: record.snapshot.ragRevision.id, ragSourceHash: { algorithm: "blake3" as const, value: record.snapshot.source.contentHash }, segment: { start, end, unit: "utf16" as const, textDigest: { algorithm: "sha256" as const, value: new Bun.CryptoHasher("sha256").update(request.query).digest("hex") } } }
      const ref = { schema: "sf-evidence-v1" as const, kind: "document" as const, evidenceLevel: "claim" as const, installationId, projectId, refId: `doc_${digestSfValue([documentId, target.incarnation, target.revision, start, end]).slice(0, 40)}`, target, refDigest: "" }
      const checkedRef = { ...ref, refDigest: digestSfEvidenceRef(ref) }
      if (seen.has(checkedRef.refId) || (await resolveSfDocumentEvidence(checkedRef, context, reader)).state !== "fresh") continue
      if (!(await document.revalidate()) || !(await input.host.revalidate(context))) return { status: "unavailable", reason: "authority-changed" }
      seen.add(checkedRef.refId)
      matches.push({ documentRef: checkedRef, text: request.query, lexicalScore: 1 })
      sources.set(documentId, document.revalidate)
    }
  }
  if ((await Promise.all([...sources.values()].map((revalidate) => revalidate().catch(() => false)))).some((current) => !current) || hostRequest.signal.aborted || !(await input.host.revalidate(context))) return { status: "unavailable", reason: "authority-changed" }
  return { status: "ok", value: { matches, limitations: ["lexical-exact-match", ...(records.length > 100 ? ["document-scan-limited"] : [])] } }
}

export async function listDocumentEvidence(documentRef: string, context: TrustedDomainContext, input: DocumentEvidenceHost): Promise<PortResult<readonly DocumentEvidence[]>> {
  const request = input.host.requestFor(context)
  if (!request || !(await input.host.revalidate(context))) return { status: "denied", reason: "authority-unavailable" }
  const source = await input.documents.read(documentRef, context)
  if (source.status !== "ok") return source
  const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.documents) : [])
  if (loaded.status !== "ok") return { status: "unavailable", reason: "document-state-unavailable" }
  const records = loaded.value.filter((value): value is StoredDocumentEvidence => !!value && typeof value === "object" && (value as StoredDocumentEvidence).schema === "sf-document-v1").filter((record) => record.snapshot?.documentRef === documentRef && record.evidence?.ref.target.documentId === source.value.documentId && record.snapshot.incarnation === source.value.incarnation && record.snapshot.revision === source.value.revision)
  if (records.length > 100) return { status: "unavailable", reason: "candidate-limit-exceeded" }
  const values = await Promise.all(records.map((record) => readDocumentEvidence(record.evidence.id, context, { state: input.state, documents: input.documents, requestFor: input.host.requestFor, revalidate: input.host.revalidate })))
  if (values.some((value) => value.status !== "ok")) return { status: "unavailable", reason: "candidate-unavailable" }
  if (!(await input.host.revalidate(context)) || !(await input.documents.revalidate(documentRef, { incarnation: source.value.incarnation, revision: source.value.revision, blobDigest: source.value.blobDigest.value }, context))) return { status: "stale", reason: "document-changed" }
  return { status: "ok", value: values.flatMap((value) => {
    if (value.status !== "ok") return []
    if (value.value.evidence.status !== "confirmed") return [value.value.evidence]
    const versioned = { ...value.value.evidence.ref, target: { ...value.value.evidence.ref.target, confirmationVersion: value.value.confirmationVersion }, refDigest: "" }
    return [{ ...value.value.evidence, ref: { ...versioned, refDigest: digestSfEvidenceRef(versioned) } }]
  }) }
}
