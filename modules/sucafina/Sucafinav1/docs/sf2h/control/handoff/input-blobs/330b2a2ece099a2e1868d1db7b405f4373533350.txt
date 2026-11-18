import { digestSfValue } from "../contracts/canonical.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { SfDocumentSnapshot } from "./rag-adapter.ts"

export type StoredDocumentEvidence = { schema: "sf-document-v1"; snapshot: SfDocumentSnapshot; evidence: DocumentEvidence; schemaRef: string; schemaVersion: string; confirmationVersion?: number }

export async function readDocumentEvidence(id: string, context: TrustedDomainContext, input: { state: SfProductStatePort; documents: SfDocumentReadPort; requestFor: (context: TrustedDomainContext) => Request | undefined; revalidate: (context: TrustedDomainContext) => Promise<boolean> }): Promise<PortResult<StoredDocumentEvidence>> {
  const request = input.requestFor(context)
  if (!request || !(await input.revalidate(context))) return { status: "denied", reason: "authority-unavailable" }
  const result = await input.state.read(request, "documents", (state, authority) => {
    if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
    return state.documents[id]
  })
  if (result.status !== "ok" || !result.value || typeof result.value !== "object") return { status: "unavailable", reason: "candidate-unavailable" }
  const record = result.value as StoredDocumentEvidence
  if (record.schema !== "sf-document-v1" || !record.evidence || record.evidence.id !== id || !record.snapshot || record.snapshot.evidence?.id !== id || record.evidence.ref.installationId !== context.binding.installationId || record.evidence.ref.projectId !== context.binding.projectId) return { status: "unavailable", reason: "candidate-invalid" }
  if (digestSfValue(record.snapshot.evidence) !== digestSfValue(record.evidence) || record.snapshot.confirmationVersion !== record.confirmationVersion || (record.evidence.status === "confirmed" && (!Number.isSafeInteger(record.confirmationVersion) || (record.confirmationVersion ?? 0) < 1)) || (record.evidence.status === "extracted" && record.confirmationVersion !== undefined)) return { status: "unavailable", reason: "candidate-invalid" }
  const source = await input.documents.read(record.snapshot.documentRef, context)
  if (source.status !== "ok" || source.value.documentId !== record.evidence.ref.target.documentId || source.value.incarnation !== record.snapshot.incarnation || source.value.revision !== record.snapshot.revision || source.value.blobDigest.value !== record.snapshot.blobDigest || new Bun.CryptoHasher("sha256").update(source.value.bytes).digest("hex") !== record.snapshot.blobDigest) return { status: "unavailable", reason: "source-unavailable" }
  if (!(await input.documents.revalidate(record.snapshot.documentRef, { incarnation: record.snapshot.incarnation, revision: record.snapshot.revision, blobDigest: record.snapshot.blobDigest }, context)) || !(await input.revalidate(context))) return { status: "denied", reason: "authority-changed" }
  return { status: "ok", value: record }
}
