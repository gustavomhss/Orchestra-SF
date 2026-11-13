import { memoryStore } from "@orchestra/rag-studio"
import type { Store } from "@orchestra/rag-studio"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { extractAuthorizedDocument } from "./extract.ts"
import type { PrivateDocumentParser } from "./extract.ts"
import type { SfDocumentReader } from "./evidence-resolver.ts"

// The persistence owner supplies this authorized snapshot; no filesystem path is accepted from a caller.
export type SfDocumentSnapshot = {
  evidence?: DocumentEvidence
  confirmationVersion?: number
  documentRef: string
  accessRevision: string
  locationId: string
  incarnation: string
  revision: number
  blobDigest: string
  source: ReturnType<Store["sources"]>[number]
  chunks: ReturnType<Store["chunks"]>
  ragRevision: NonNullable<ReturnType<Store["revision"]>>
}

export function createSfDocumentEvidenceAdapter(read: (documentId: string, context: TrustedDomainContext, candidateId?: string, ref?: BusinessEvidenceRef) => Promise<
  | { status: "denied" | "missing" | "unavailable"; accessRevision: string }
  | { status: "ok"; snapshot: SfDocumentSnapshot }
>, documents: SfDocumentReadPort, parser: PrivateDocumentParser): SfDocumentReader {
  return async (documentId, context, candidateId, ref) => {
    const found = await read(documentId, context, candidateId, ref)
    if (found.status !== "ok") return found
    const snapshot = found.snapshot
    const current = await documents.read(snapshot.documentRef, context)
    if (current.status !== "ok") return { status: current.status === "denied" ? "denied" : "unavailable", accessRevision: snapshot.accessRevision }
    if (current.value.documentId !== documentId || current.value.incarnation !== snapshot.incarnation || current.value.revision !== snapshot.revision || current.value.blobDigest.algorithm !== "sha256" || current.value.blobDigest.value !== snapshot.blobDigest || new Bun.CryptoHasher("sha256").update(current.value.bytes).digest("hex") !== snapshot.blobDigest) return { status: "unavailable", accessRevision: snapshot.accessRevision }
    const extracted = await extractAuthorizedDocument(snapshot.documentRef, context, documents, parser)
    if (extracted.status !== "ok" || extracted.value.documentId !== documentId || extracted.value.incarnation !== snapshot.incarnation || extracted.value.revision !== snapshot.revision || extracted.value.blobDigest.value !== snapshot.blobDigest || extracted.value.text !== snapshot.source.text) return { status: "unavailable", accessRevision: snapshot.accessRevision }
    const store = memoryStore({ projectRoot: "/sf-project" })
    store.putSource(snapshot.source)
    snapshot.chunks.filter((chunk) => chunk.sourceId === snapshot.source.id).forEach((chunk) => store.putChunk(chunk))
    store.putRevision(snapshot.ragRevision)
    return { status: "ok", accessRevision: snapshot.accessRevision, incarnation: snapshot.incarnation, revision: snapshot.revision, blobDigest: snapshot.blobDigest, locationId: snapshot.locationId, store, evidence: snapshot.evidence, confirmationVersion: snapshot.confirmationVersion, revalidate: async () => {
      if (!(await documents.revalidate(snapshot.documentRef, { incarnation: snapshot.incarnation, revision: snapshot.revision, blobDigest: snapshot.blobDigest }, context))) return false
      const current = await read(documentId, context, candidateId, ref)
      return current.status === "ok" && digestSfValue(current.snapshot) === digestSfValue(snapshot)
    } }
  }
}
