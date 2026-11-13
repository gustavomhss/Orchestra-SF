import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { admitSfDocumentAsset, createSfDocumentBytePort } from "./byte-port.ts"
import { confirmDocumentEvidence, extractDocumentEvidence, listDocumentEvidence, searchDocumentEvidence } from "./capabilities.ts"
import type { DocumentEvidenceHost } from "./capabilities.ts"
import { createPrivateDocumentParser } from "./parser.ts"
import { createSfDocumentEvidenceAdapter } from "./rag-adapter.ts"
import { readDocumentEvidence } from "./store.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { StoredDocumentEvidence } from "./store.ts"
import { createSfDocumentPresentation } from "./presentation.ts"
import { indexSfDocument } from "./index.ts"
import type { StoredDocumentIndex } from "./index.ts"

/** Composes the document capability with the host's real authorization and storage services. */
export function createSfDocumentHost(input: {
  host: DomainPortHost
  origin: string
  mount: string
  assets: AssetPersistence
  services: AssetServices
  state: SfProductStatePort
  limits: { maxBytes: number; maxTextLength: number; maxPages: number; maxXmlBytes: number; maxZipEntries: number; timeoutMs?: number }
  resolveFieldSchema: DocumentEvidenceHost["resolveFieldSchema"]
  verifyFieldSchema: DocumentEvidenceHost["verifyFieldSchema"]
  operationIdentity: DocumentEvidenceHost["operationIdentity"]
  confirmDocument: DocumentEvidenceHost["confirmDocument"]
  createId: DocumentEvidenceHost["createId"]
  now: DocumentEvidenceHost["now"]
}) {
  const documents = createSfDocumentBytePort({ ...input, maxBytes: input.limits.maxBytes })
  const parser = createPrivateDocumentParser(input.limits)
  const reader = createSfDocumentEvidenceAdapter(async (documentId, context, candidateId, ref) => {
    const request = input.host.requestFor(context)
    if (!request || !(await input.host.revalidate(context))) return { status: "denied", accessRevision: context.binding.accessRevision }
    const source = await documents.read(documentId, context)
    if (source.status !== "ok") return { status: source.status === "denied" ? "denied" : "unavailable", accessRevision: context.binding.accessRevision }
    const loaded = await input.state.read(request, "documents", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
      if (candidateId) return candidateId
      const index = state.documents[`document-index:${digestSfValue([context.binding.installationId, context.binding.projectId, documentId])}`] as StoredDocumentIndex | undefined
      if (index?.schema === "sf-document-index-v1" && index.installationId === context.binding.installationId && index.projectId === context.binding.projectId && index.snapshot.documentRef === documentId && index.snapshot.incarnation === source.value.incarnation && index.snapshot.revision === source.value.revision && index.snapshot.blobDigest === source.value.blobDigest.value && (!ref || ref.kind !== "document" || (index.snapshot.source.id === ref.target.ragSourceId && index.snapshot.ragRevision.id === ref.target.ragRevisionId))) return { snapshot: index.snapshot }
      return Object.entries(state.documents).find(([, value]) => {
        if (!value || typeof value !== "object") return false
        const record = value as StoredDocumentEvidence
        return record.schema === "sf-document-v1" && record.evidence?.ref.target.documentId === documentId && record.evidence.ref.installationId === context.binding.installationId && record.evidence.ref.projectId === context.binding.projectId && record.snapshot?.incarnation === source.value.incarnation && record.snapshot.revision === source.value.revision && record.snapshot.blobDigest === source.value.blobDigest.value && (!ref || ref.kind !== "document" || (record.snapshot.source.id === ref.target.ragSourceId && record.snapshot.ragRevision.id === ref.target.ragRevisionId))
      })?.[0]
    })
    if (loaded.status !== "ok" || !loaded.value) return { status: "unavailable", accessRevision: context.binding.accessRevision }
    if (typeof loaded.value === "object") return { status: "ok", snapshot: loaded.value.snapshot }
    const record = await readDocumentEvidence(loaded.value, context, { state: input.state, documents, requestFor: input.host.requestFor, revalidate: input.host.revalidate })
    if (record.status !== "ok" || record.value.evidence.ref.target.documentId !== documentId) return { status: "unavailable", accessRevision: context.binding.accessRevision }
    return { status: "ok", snapshot: record.value.snapshot }
  }, documents, parser)
  const capability: DocumentEvidenceHost = { ...input, documents, parser, reader }
  return {
    documents,
    reader,
    resolvePresentation: createSfDocumentPresentation({ ...input, documents, reader }),
    admit: async (selection: Parameters<typeof admitSfDocumentAsset>[0], context: Parameters<typeof admitSfDocumentAsset>[1]) => {
      const admitted = await admitSfDocumentAsset(selection, context, { ...input, maxBytes: input.limits.maxBytes })
      if (admitted.status !== "ok") return admitted
      const indexed = await indexSfDocument(admitted.value.documentId, context, { state: input.state, documents, parser, requestFor: input.host.requestFor, revalidate: input.host.revalidate, operationIdentity: input.operationIdentity })
      return indexed.status === "ok" ? admitted : indexed
    },
    extract: (request: Parameters<typeof extractDocumentEvidence>[0], context: Parameters<typeof extractDocumentEvidence>[1]) => extractDocumentEvidence(request, context, capability),
    search: (request: Parameters<typeof searchDocumentEvidence>[0], context: Parameters<typeof searchDocumentEvidence>[1]) => searchDocumentEvidence(request, context, capability),
    confirm: (id: string, context: Parameters<typeof confirmDocumentEvidence>[1]) => confirmDocumentEvidence(id, context, capability),
    list: (documentRef: string, context: Parameters<typeof listDocumentEvidence>[1]) => listDocumentEvidence(documentRef, context, capability),
  }
}
