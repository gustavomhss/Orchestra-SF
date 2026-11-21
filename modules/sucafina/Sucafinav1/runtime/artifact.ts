import type { Result, Snapshot } from "./contract.ts"
import { object } from "./contract.ts"
export type Artifact = {
  ok: true
  name: string
  type: string
  bytes: Uint8Array
}
export type ArtifactResult = Artifact | Exclude<Result, { ok: true }>

/** Only basenames and the matching report media type may reach a download header. */
export function validReportArtifactMetadata(artifact: Pick<Artifact, "name" | "type">, format: string) {
  if (format !== "docx" && format !== "pptx") return false
  if (typeof artifact.name !== "string" || !artifact.name || artifact.name.trim() !== artifact.name ||
    Buffer.byteLength(artifact.name, "utf8") > 255 || artifact.name.startsWith(".") ||
    /[\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ud800-\udfff]/u.test(artifact.name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(artifact.name) ||
    !artifact.name.toLowerCase().endsWith(`.${format}`)) return false
  return artifact.type === (format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation")
}

export const SF_REVIEW_ARTIFACT_BLOB_PREFIX = "sf-review-artifact:"

export function sfReviewArtifactBlobKey(ref: string) {
  if (!/^report:[a-f0-9]{64}$/.test(ref)) throw new Error("SF_REPORT_ARTIFACT_REFERENCE_INVALID")
  return SF_REVIEW_ARTIFACT_BLOB_PREFIX + ref.slice("report:".length)
}

/** Private report objects share the SQLite backup inventory, without becoming public assets. */
export function sfReviewArtifactBlobInventory(snapshot: Snapshot) {
  return Object.entries(object(object(snapshot.data.__sfProductV1).documents)).flatMap(([ref, value]) => {
    const artifact = object(value)
    if (artifact.kind !== "sf-review-artifact-v2") return []
    if (typeof artifact.byteLength !== "number" || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 1 ||
        typeof artifact.digest !== "string" || !/^[a-f0-9]{64}$/.test(artifact.digest) ||
        typeof artifact.name !== "string" || typeof artifact.mediaType !== "string" ||
        typeof artifact.format !== "string" || !validReportArtifactMetadata({ name: artifact.name, type: artifact.mediaType }, artifact.format))
      throw new Error("SF_REPORT_ARTIFACT_METADATA_INVALID")
    return [{ key: sfReviewArtifactBlobKey(ref), bytes: artifact.byteLength, sha256: artifact.digest, type: artifact.mediaType }]
  })
}

/** Check the bounded ZIP envelope and its main part without decompressing document content. */
export async function validateReportArtifact(artifact: Pick<Artifact, "name" | "type" | "bytes">, format: string, maxBytes: number) {
  if (!validReportArtifactMetadata(artifact, format) || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 ||
    !(artifact.bytes instanceof Uint8Array) || !artifact.bytes.length || artifact.bytes.length > maxBytes ||
    artifact.bytes[0] !== 0x50 || artifact.bytes[1] !== 0x4b || artifact.bytes[2] !== 0x03 || artifact.bytes[3] !== 0x04) return false
  const { default: JSZip } = await import("jszip")
  const archive = await JSZip.loadAsync(artifact.bytes).catch(() => undefined)
  if (!archive || Object.values(archive.files).some((entry) => {
    const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name
    return original !== entry.name || original.startsWith("/") || original.includes("\\") || original.split("/").some((part) => part === "." || part === "..")
  })) return false
  const main = format === "docx" ? "word/document.xml" : "ppt/presentation.xml"
  const other = format === "docx" ? "ppt/presentation.xml" : "word/document.xml"
  return !!archive.file("[Content_Types].xml") && !!archive.file("_rels/.rels") && !!archive.file(main) && !archive.file(other)
}
