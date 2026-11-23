import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfFilesOperationInput } from "@orchestra/schema/sucafina/files"

export type SfDocumentUploadKind = SfFilesOperationInput<"files.asset.upload">["upload"]
export type SfDocumentUploadTarget = Readonly<{
  record: string
  label: string
  version: number
  kind: SfDocumentUploadKind
}>
type Failure = Readonly<{ kind: "denied" | "session-expired" | "unavailable" | "stale" | "invalid" }>
type CatalogFailure = Readonly<{ status: "denied" | "unauthenticated" | "unavailable" | "needs-input" | "stale" }>
export type SfDocumentUploadTargets = Readonly<{ kind: "ready"; targets: readonly SfDocumentUploadTarget[] }> | Failure

export function sfUploadTargetOperation(kind: SfDocumentUploadKind) {
  return kind === "contract" ? "domain.page.CAP14" : kind === "supplier" ? "domain.page.CAP27" : "domain.page.CAP25"
}

// Use the original record catalogs and their explicit CAS, never an asset revision
// or an opaque document selection token. The existing Files transport owns upload.
export async function readSfUploadTargets(
  transport: SfTransport, kind: SfDocumentUploadKind, stamp: SfContextStamp, signal: AbortSignal,
): Promise<SfDocumentUploadTargets> {
  if (kind === "contract") {
    const read = unpack(await createSfDomainClient(transport)["domain.page.CAP14"]({}, { signal }), stamp)
    if (read.kind !== "ready") return read
    if (!read.value.data.contracts) return { kind: "unavailable" }
    return complete(read.value.data.contracts.map((row) =>
      target(row.id, [row.name || row.vendor, row.num || row.id], read.value.versions["contracts:" + row.id], kind)))
  }
  if (kind === "supplier") {
    const read = unpack(await createSfProcurementClient(transport)["domain.page.CAP27"]({}, { signal }), stamp)
    if (read.kind !== "ready") return read
    return complete(read.value.data.suppliers.map((row) =>
      target(row.id, [row.legalName || row.tradingName, row.number || row.id], read.value.versions["suppliers:" + row.id]?.version, kind)))
  }
  const read = unpack(await createSfProcurementClient(transport)["domain.page.CAP25"]({}, { signal }), stamp)
  if (read.kind !== "ready") return read
  return complete(read.value.data.requests.map((row) =>
    target(row.number, [row.pr?.title, row.number], read.value.versions["requests:" + row.number]?.version, kind)))
}

function unpack<Value>(
  reply: SfTransportResult<Readonly<{ status: "ok"; context: SfContextStamp; value: Value }> | CatalogFailure>,
  expected: SfContextStamp,
): Readonly<{ kind: "ready"; value: Value }> | Failure {
  if (reply.kind === "transport-error") return { kind: "unavailable" }
  if (reply.status === 401 || reply.body.status === "unauthenticated") return { kind: "session-expired" }
  if (reply.status === 403 || reply.body.status === "denied") return { kind: "denied" }
  if (reply.status === 409 || reply.body.status === "stale") return { kind: "stale" }
  if (reply.status < 200 || reply.status >= 300 || reply.body.status !== "ok") return { kind: "unavailable" }
  const context = reply.body.context
  if (context.installationId !== expected.installationId || context.projectId !== expected.projectId ||
      context.hostId !== expected.hostId || context.principalRef !== expected.principalRef ||
      context.policyVersion !== expected.policyVersion || context.accessRevision !== expected.accessRevision)
    return { kind: "stale" }
  // A03's legacy page projection contains the technical stamp only. The injected
  // transport and caller's live owner/generation still fence the full Team owner.
  // A01 also projects the Team binding, so retain that check when it is supplied.
  if (context.team !== undefined && JSON.stringify(context.team) !== JSON.stringify(expected.team)) return { kind: "stale" }
  return { kind: "ready", value: reply.body.value }
}

function target(
  record: string | number | undefined, parts: readonly (string | number | boolean | null | undefined)[],
  version: number | undefined, kind: SfDocumentUploadKind,
): SfDocumentUploadTarget | undefined {
  if (record === undefined || !String(record).trim() || String(record).length > 1024 || /[\r\n\0]/.test(String(record)) ||
      version === undefined || !Number.isSafeInteger(version) || version < 0) return undefined
  const label = parts.filter((part) => typeof part === "string" || typeof part === "number")
    .map((part) => String(part).trim()).filter(Boolean).join(" · ")
  return { record: String(record), label: label || String(record), version, kind }
}

function complete(rows: readonly (SfDocumentUploadTarget | undefined)[]): SfDocumentUploadTargets {
  const targets = rows.filter((row): row is SfDocumentUploadTarget => row !== undefined)
  if (targets.length !== rows.length || new Set(targets.map((row) => row.record)).size !== targets.length)
    return { kind: "invalid" }
  return { kind: "ready", targets }
}
