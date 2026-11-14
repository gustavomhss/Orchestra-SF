import { createHash } from "node:crypto"
import { parseWorkbookDetailed } from "../../runtime/workbooks.ts"
import type { WorkbookCellOrigin } from "../../runtime/workbooks.ts"
import type { ImportPreviewRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** The host resolves an admitted opaque reference under the caller's current authority. */
export type ImportFileHost = {
  read: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ bytes: Uint8Array; digest: string }>>
  revalidate: (ref: string, digest: string, context: TrustedDomainContext) => Promise<boolean>
}

export type ParsedImport = {
  sourceDigest: string
  format: string
  sheets?: Record<string, Record<string, unknown>[]>
  origins?: WorkbookCellOrigin[]
  data?: Record<string, unknown>
}

/** Parse only the file families supported by the original import paths. */
export async function parseAdmittedImport(request: ImportPreviewRequest, context: TrustedDomainContext, host: ImportFileHost): Promise<PortResult<ParsedImport>> {
  const file = await host.read(request.admittedFileRef, context)
  if (file.status !== "ok") return file
  if (file.value.bytes.byteLength > 16 * 1024 * 1024) return { status: "needs-input", reason: "file-too-large" }
  const digest = createHash("sha256").update(file.value.bytes).digest("hex")
  if (digest !== file.value.digest) return { status: "stale", reason: "file-digest-changed" }
  if (!await host.revalidate(request.admittedFileRef, digest, context)) return { status: "denied", reason: "file-access-unavailable" }
  if (request.format === "xlsx" || request.format === "xls") {
    const signature = Buffer.from(file.value.bytes.subarray(0, 8)).toString("hex")
    if (request.format === "xls" ? signature !== "d0cf11e0a1b11ae1" : !signature.startsWith("504b0304")) return { status: "needs-input", reason: "file-format-mismatch" }
    const parsed = await parseWorkbookDetailed(file.value.bytes)
    if (!parsed.ok) return { status: "needs-input", reason: parsed.errors.join("; ") }
    if (!await host.revalidate(request.admittedFileRef, digest, context)) return { status: "denied", reason: "file-access-unavailable" }
    return { status: "ok", value: { sourceDigest: digest, format: request.format, sheets: parsed.sheets, origins: parsed.origins } }
  }
  if (request.format === "json") {
    try {
      const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.value.bytes))
      if (data === null || typeof data !== "object" || Array.isArray(data)) return { status: "needs-input", reason: "invalid-dashboard-backup" }
      if (!await host.revalidate(request.admittedFileRef, digest, context)) return { status: "denied", reason: "file-access-unavailable" }
      return { status: "ok", value: { sourceDigest: digest, format: request.format, data: data as Record<string, unknown> } }
    } catch {
      return { status: "needs-input", reason: "invalid-dashboard-backup" }
    }
  }
  return { status: "needs-input", reason: "unsupported-import-format" }
}
