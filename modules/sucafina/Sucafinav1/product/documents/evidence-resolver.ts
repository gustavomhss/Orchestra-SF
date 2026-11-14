import { citationProof, memoryStore, parseSource, readRevision, saveQuestion, withStore } from "@orchestra/rag-studio"
import type { Store } from "@orchestra/rag-studio"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

// The reader must authorize each request and return only the current document and its authorized RAG view.
export type SfDocumentReader = (documentId: string, context: TrustedDomainContext, candidateId?: string, ref?: BusinessEvidenceRef) => Promise<
  | { status: "denied" | "missing" | "unavailable"; accessRevision: string }
  | { status: "ok"; accessRevision: string; incarnation: string; revision: number; blobDigest: string; locationId: string; store: Store; evidence?: DocumentEvidence; confirmationVersion?: number; revalidate: () => Promise<boolean> }
>

export async function resolveSfDocumentEvidence(
  ref: BusinessEvidenceRef,
  context: TrustedDomainContext,
  read: SfDocumentReader,
): Promise<BusinessEvidenceResolution> {
  const checkedAt = new Date().toISOString()
  const result = (state: BusinessEvidenceResolution["state"], accessRevision = context.binding.accessRevision, authorizedProjection?: BusinessEvidenceResolution["authorizedProjection"]): BusinessEvidenceResolution => ({
    state, ref, accessRevision, checkedAt, ...(authorizedProjection === undefined ? {} : { authorizedProjection }),
  })
  if (ref.kind !== "document" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) return result("invalid")
  if (digestSfEvidenceRef(ref) !== ref.refDigest) return result("invalid")
  if (ref.schema !== "sf-evidence-v1" || ref.target.blobDigest.algorithm !== "sha256" || ref.target.segment.textDigest.algorithm !== "sha256" || ref.target.segment.unit !== "utf16") return result("invalid")
  const document = await read(ref.target.documentId, context, ref.target.fieldCandidateId, ref)
  if (document.status !== "ok") {
    if (document.status === "denied") return result("revoked", document.accessRevision)
    if (document.status === "missing") return result("missing", document.accessRevision)
    return result("unavailable", document.accessRevision)
  }
  if (document.accessRevision !== context.binding.accessRevision) return result("unavailable", document.accessRevision)
  if (document.incarnation !== ref.target.incarnation) return result("replaced", document.accessRevision)
  if (document.revision !== ref.target.revision || document.blobDigest !== ref.target.blobDigest.value) return result("stale", document.accessRevision)
  const target = ref.target
  if (target.confirmationVersion !== undefined && (!target.fieldCandidateId || !Number.isSafeInteger(target.confirmationVersion) || target.confirmationVersion < 1)) return result("invalid", document.accessRevision)
  if (target.fieldCandidateId) {
    const evidence = document.evidence
    if (!evidence || evidence.id !== target.fieldCandidateId || evidence.ref.installationId !== ref.installationId || evidence.ref.projectId !== ref.projectId || evidence.ref.schema !== ref.schema || evidence.ref.refDigest !== digestSfEvidenceRef(evidence.ref)) return result("invalid", document.accessRevision)
    const originalTarget = { ...target }
    delete originalTarget.confirmationVersion
    if (digestSfValue(originalTarget) !== digestSfValue(evidence.ref.target) || ref.refId !== evidence.ref.refId || ref.evidenceLevel !== evidence.ref.evidenceLevel) return result("invalid", document.accessRevision)
    if (target.confirmationVersion === undefined && evidence.ref.refDigest !== ref.refDigest) return result("invalid", document.accessRevision)
    if (target.confirmationVersion !== undefined && (evidence.status !== "confirmed" || document.confirmationVersion !== target.confirmationVersion)) return result("stale", document.accessRevision)
  }
  if (!target.ragSourceId || !target.ragRevisionId || !target.ragSourceHash || target.ragSourceHash.algorithm !== "blake3") return result("invalid", document.accessRevision)
  const source = document.store.sources().find((item) => item.id === target.ragSourceId)
  const revision = document.store.revision(target.ragRevisionId)
  if (!source || !revision || source.status !== "read" || source.locationId !== document.locationId || revision.locationId !== document.locationId || revision.fill !== "complete") return result("invalid", document.accessRevision)
  if (source.contentHash !== target.ragSourceHash.value || !revision.members.some((item) => item.sourceId === source.id && item.contentHash === source.contentHash)) return result("stale", document.accessRevision)
  const verifier = memoryStore({ projectRoot: "/sf-verifier" })
  const privatePath = "/sf-document/source.txt"
  verifier.writeFile(privatePath, source.text)
  verifier.putSource({ ...source, path: privatePath })
  const parsed = await withStore(verifier, () => parseSource(source.id))
  if (parsed.contentHash !== source.contentHash) return result("invalid", document.accessRevision)
  const span = target.segment
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start) return result("invalid", document.accessRevision)
  const chunk = document.store.chunks().find((item) => item.sourceId === source.id && item.sourceHash === source.contentHash && item.start <= span.start && item.end >= span.end)
  if (!chunk || chunk.end - chunk.start !== chunk.text.length || source.text.slice(chunk.start, chunk.end) !== chunk.text) return result("invalid", document.accessRevision)
  const text = chunk.text.slice(span.start - chunk.start, span.end - chunk.start)
  if (new Bun.CryptoHasher("sha256").update(text).digest("hex") !== span.textDigest.value) return result("invalid", document.accessRevision)
  const proven = await withStore(document.store, async () => {
    await readRevision(revision.id)
    const question = await saveQuestion(revision.id, "document evidence", { sourceId: source.id, start: span.start, end: span.end })
    return citationProof(question.id, text)
  })
  if (!proven) return result("invalid", document.accessRevision)
  if (!(await document.revalidate())) return result("unavailable", document.accessRevision)
  return result("fresh", document.accessRevision, document.evidence && target.fieldCandidateId ? { ...document.evidence, ref } : undefined)
}
