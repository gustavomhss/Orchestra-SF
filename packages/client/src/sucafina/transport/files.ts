import type { SfOperationId } from "@orchestra/schema/sucafina/common"

/** Only the five original A06 producer byte routes, no arbitrary download URLs. */
export const SF_FILE_BYTE_LIMIT = 32 * 1024 * 1024
export const SF_FILE_IMPORT_LIMIT = 16 * 1024 * 1024
export const SF_FILE_MULTIPART_LIMIT = SF_FILE_IMPORT_LIMIT + 64 * 1024
export const SF_FILE_ASSET_LIMIT = 25 * 1024 * 1024

export function sfIsByteOperation(id: SfOperationId): boolean {
  return id === "files.asset.download" || id === "files.export.xlsx" ||
    id === "files.export.suppliers" || id === "files.export.register" || id === "files.export.json"
}

export function sfIsUploadOperation(id: SfOperationId): boolean {
  return id === "files.import-admit" || id === "files.asset.upload"
}

/** MIME is a second, operation-specific check; the producer alone grants export. */
export function sfAllowedByteMime(id: SfOperationId, raw: string | null | undefined): boolean {
  if (!sfIsByteOperation(id) || typeof raw !== "string" || raw.length > 256 ||
      /[\r\n\0]/.test(raw)) return false
  const type = raw.split(";")[0]!.trim().toLowerCase()
  if (id === "files.export.xlsx") return type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  if (id === "files.export.suppliers" || id === "files.export.register") return type === "text/csv"
  if (id === "files.export.json") return type === "application/json"
  return [
    "application/pdf", "application/json", "application/octet-stream", "application/msword",
    "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv", "text/markdown", "image/png", "image/jpeg", "image/gif",
    "image/webp", "image/tiff", "image/bmp",
  ].includes(type)
}

const cleanRef = (value: unknown, max = 2048): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  !!value && typeof value === "object" && !Array.isArray(value)

/**
 * Only source-known query/format projections. The UI cannot provide raw query,
 * URL, local path, Cookie, Authorization, or headers. The caller also applies
 * the frozen metadata fixedQuery and rejects duplicate keys.
 */
export function sfFilesSourceQuery(id: SfOperationId, value: unknown): Readonly<Record<string, string>> | undefined {
  if (!record(value)) return undefined
  if (id === "files.asset.link") {
    return cleanRef(value.assetId) ? { "asset-link": value.assetId } : undefined
  }
  if (id === "files.asset.download") {
    if (!cleanRef(value.assetId) || !Number.isSafeInteger(value.expires) ||
        Number(value.expires) <= 0 || typeof value.signature !== "string" ||
        !/^[0-9a-f]{64}$/.test(value.signature)) return undefined
    return { asset: value.assetId, expires: String(value.expires), signature: value.signature }
  }
  if (id === "files.asset.upload") {
    if (!cleanRef(value.record) || !Number.isSafeInteger(value.recordVersion) ||
        Number(value.recordVersion) < 0 || !cleanRef(value.name, 255) ||
        !cleanRef(value.page, 255) ||
        !["contract", "quote", "signed-po", "supplier"].includes(String(value.upload))) return undefined
    return {
      upload: String(value.upload), record: value.record,
      recordVersion: String(value.recordVersion), name: value.name, page: value.page,
    }
  }
  if (id === "files.document-open" || id === "files.document-scenario-targets") {
    if (!record(value.ref) || value.ref.kind !== "document") return undefined
    const ref = JSON.stringify(value.ref)
    if (new TextEncoder().encode(ref).byteLength > (id === "files.document-open" ? 8192 : 32768)) return undefined
    return { ref }
  }
  return undefined
}

/** The binary is never a JSON property, IPC query parameter or logger value. */
export function sfUploadSlot(id: SfOperationId, value: unknown):
  Readonly<{ fileName: string; mediaType: string; bytes: Uint8Array }> | undefined {
  if (!sfIsUploadOperation(id) || !record(value) ||
      !(value.bytes instanceof Uint8Array) || value.bytes.byteLength === 0 ||
      !cleanRef(value.mediaType, 128) ||
      !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(value.mediaType)) return undefined
  const filename = id === "files.import-admit" ? value.fileName : value.name
  if (!cleanRef(filename, 255) || /[\\/"]/.test(filename)) return undefined
  if (id === "files.import-admit" && (
    value.bytes.byteLength > SF_FILE_IMPORT_LIMIT ||
    !/\.(xlsx|xls|json)$/i.test(filename))) return undefined
  if (id === "files.asset.upload" && value.bytes.byteLength > SF_FILE_ASSET_LIMIT) return undefined
  return { fileName: filename, mediaType: value.mediaType, bytes: new Uint8Array(value.bytes) }
}
