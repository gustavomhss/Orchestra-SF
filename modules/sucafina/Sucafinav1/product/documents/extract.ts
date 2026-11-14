import type { SfDocumentReadPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

// The host owns the private file, bounds PDF pages and wall time, and removes it on all paths.
// No caller-supplied path crosses this boundary.
export type PrivateDocumentParser = {
  extractPdf: (bytes: Uint8Array, signal?: AbortSignal) => Promise<PortResult<string>>
  extractDocx: (bytes: Uint8Array, signal?: AbortSignal) => Promise<PortResult<string>>
  maxBytes: number
  maxTextLength: number
}

export async function extractAuthorizedDocument(
  documentRef: string,
  context: TrustedDomainContext,
  documents: SfDocumentReadPort,
  parser: PrivateDocumentParser,
  signal?: AbortSignal,
): Promise<PortResult<{ documentId: string; incarnation: string; revision: number; blobDigest: { algorithm: "sha256"; value: string }; text: string }>> {
  if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
  if (!documentRef || !Number.isSafeInteger(parser.maxBytes) || parser.maxBytes < 1 || !Number.isSafeInteger(parser.maxTextLength) || parser.maxTextLength < 1) return { status: "failed", reason: "invalid document request or limits" }
  const read = await documents.read(documentRef, context)
  if (read.status !== "ok") return read
  const document = read.value
  if (document.bytes.byteLength === 0 || document.bytes.byteLength > parser.maxBytes) return { status: "failed", reason: "document size exceeds limits or is empty" }
  if (document.blobDigest.algorithm !== "sha256" || new Bun.CryptoHasher("sha256").update(document.bytes).digest("hex") !== document.blobDigest.value) return { status: "failed", reason: "document digest mismatch" }
  const parsed = document.mediaType === "text/plain"
    ? decodeText(document.bytes)
    : document.mediaType === "application/pdf"
      ? await parser.extractPdf(document.bytes, signal)
      : document.mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? await parser.extractDocx(document.bytes, signal)
        : { status: "failed" as const, reason: "unsupported document format" }
  if (signal?.aborted) return { status: "unavailable", reason: "cancelled" }
  if (parsed.status !== "ok") return parsed
  if (!parsed.value.trim()) return { status: "failed", reason: "document has no extractable text" }
  if (parsed.value.length > parser.maxTextLength) return { status: "failed", reason: "document text exceeds limits" }
  if (!(await documents.revalidate(documentRef, { incarnation: document.incarnation, revision: document.revision, blobDigest: document.blobDigest.value }, context))) return { status: "stale", reason: "document changed or access was revoked" }
  return { status: "ok", value: { documentId: document.documentId, incarnation: document.incarnation, revision: document.revision, blobDigest: document.blobDigest, text: parsed.value } }
}

function decodeText(bytes: Uint8Array): PortResult<string> {
  try {
    return { status: "ok", value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
  } catch {
    return { status: "failed", reason: "invalid UTF-8 document" }
  }
}
