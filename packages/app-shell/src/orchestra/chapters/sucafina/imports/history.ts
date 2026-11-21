import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"

export type SfImportHistorySource = "planner" | "dashboard"
export type SfImportHistoryOwner = Readonly<{
  installationId: string
  projectId: string
  principalRef: string
  accessRevision: string
  policyVersion: string
}>
export type SfImportHistoryReference =
  Extract<SfFilesOperationOutput<"files.import-reference">, { status: "ok" }>["value"]
export type SfImportHistoryDetail =
  Extract<SfFilesOperationOutput<"files.import-detail">, { status: "ok" }>["value"]
export type SfImportHistoryError =
  "invalid" | "not-found" | "denied" | "session-expired" | "stale" | "unavailable"
export type SfImportHistoryResult =
  | Readonly<{ kind: "ready"; reference: SfImportHistoryReference; detail: SfImportHistoryDetail }>
  | Readonly<{ kind: "error"; state: SfImportHistoryError }>
  | Readonly<{ kind: "discarded" }>

type FileClient = Pick<ReturnType<typeof createSfFilesClient>,
  "files.import-reference" | "files.import-detail">
type Port<T> = Readonly<{ status: "ok"; value: T }> |
  Readonly<{ status: string; reason?: string }>
type ReadResult<T> = Readonly<{ kind: "ok"; value: T }> |
  Readonly<{ kind: "error"; state: SfImportHistoryError }>

function decode<T>(reply: SfTransportResult<Port<T>>): ReadResult<T> {
  if (reply.kind === "transport-error") {
    // Network failure and unknown outcome are not affirmative removal/revocation.
    return { kind: "error", state: "unavailable" }
  }
  if (reply.status === 401) return { kind: "error", state: "session-expired" }
  if (reply.status === 403) return { kind: "error", state: "denied" }
  if (reply.status === 404) return { kind: "error", state: "not-found" }
  if (reply.status === 409) return { kind: "error", state: "stale" }
  if (reply.body.status === "ok" && reply.status >= 200 && reply.status < 300 &&
      "value" in reply.body) return { kind: "ok", value: reply.body.value as T }
  if (reply.body.status === "denied") return { kind: "error", state: "denied" }
  if (reply.body.status === "stale" || reply.body.status === "conflict" ||
      reply.body.status === "provider-conflict") return { kind: "error", state: "stale" }
  if (reply.body.status === "invalid" || reply.body.status === "needs-input")
    return { kind: "error", state: "invalid" }
  return { kind: "error", state: "unavailable" }
}

/**
 * READ-01 import history lookup: consumes only the original authorized
 * import-reference and import-detail producers (C08). Neither this helper nor
 * the UI enumerates private documents, caches manifests, issues a grant, or
 * guesses a missing list API. A full owner-scoped index requires its separately
 * admitted producer/operation; see repair218 source-closure.
 *
 * The two responses MUST describe the same manifest, source, record version
 * and confirmed receipt. The caller fences the live owner/transport generation;
 * a late reply is never allowed to revive a previous owner's private result.
 */
export async function readSfAuthorizedImportHistoryReference(options: Readonly<{
  client: FileClient
  manifestId: string
  surface: SfImportHistorySource
  owner: SfImportHistoryOwner
  signal: AbortSignal
  isCurrent: () => boolean
}>): Promise<SfImportHistoryResult> {
  const safe = () => !options.signal.aborted && options.isCurrent()
  const id = options.manifestId
  if (!safe()) return { kind: "discarded" }
  if (!id || id.trim() !== id || id.length > 512 || /[\r\n\0]/.test(id))
    return { kind: "error", state: "invalid" }
  const referenceReply = await options.client["files.import-reference"](
    { surface: options.surface, importPreviewRef: id }, { signal: options.signal },
  )
  if (!safe()) return { kind: "discarded" }
  const referenceResult = decode<SfImportHistoryReference>(referenceReply)
  if (referenceResult.kind === "error") return referenceResult
  const reference = referenceResult.value
  const manifest = reference.manifest
  const context = manifest.context
  if (manifest.id !== id || context.surface !== options.surface ||
      context.installationId !== options.owner.installationId ||
      context.projectId !== options.owner.projectId ||
      context.principalRef !== options.owner.principalRef ||
      context.accessRevision !== options.owner.accessRevision ||
      context.policyVersion !== options.owner.policyVersion)
    return { kind: "error", state: "denied" }
  if (!Number.isSafeInteger(manifest.version) || manifest.version < 1 ||
      manifest.sourceDigest !== reference.detail.sourceDigest ||
      reference.detail.manifestId !== id ||
      reference.detail.version !== manifest.version)
    return { kind: "error", state: "stale" }
  const detailReply = await options.client["files.import-detail"]({
    surface: options.surface, manifestId: id, version: manifest.version,
  }, { signal: options.signal })
  if (!safe()) return { kind: "discarded" }
  const detailResult = decode<SfImportHistoryDetail>(detailReply)
  if (detailResult.kind === "error") return detailResult
  const detail = detailResult.value
  if (detail.digest !== reference.digest ||
      detail.detail.manifestId !== id ||
      detail.detail.version !== manifest.version ||
      detail.detail.sourceDigest !== manifest.sourceDigest)
    return { kind: "error", state: "stale" }
  const summary = reference.receipt
  const repeated = detail.receipt
  if (!!summary !== !!repeated ||
      (summary && repeated && (
        summary.receiptId !== repeated.receiptId ||
        summary.manifestId !== repeated.manifestId ||
        summary.outcome !== repeated.outcome ||
        summary.idempotencyKey !== repeated.idempotencyKey ||
        summary.commandDigest !== repeated.commandDigest ||
        summary.changedFields !== repeated.changedFields)))
    return { kind: "error", state: "stale" }
  const committed = manifest.receipts[0]
  if (manifest.state === "applied" &&
      (!manifest.domainApplied || !committed || !summary ||
       (summary.outcome !== "applied" && summary.outcome !== "unchanged")))
    return { kind: "error", state: "stale" }
  if (committed && (!summary || committed.id !== summary.receiptId ||
      committed.idempotencyKey !== summary.idempotencyKey ||
      committed.commandDigest !== summary.commandDigest))
    return { kind: "error", state: "stale" }
  if (summary && (summary.manifestId !== id ||
      (summary.outcome === "rejected" && (committed !== undefined || summary.changedFields !== 0))))
    return { kind: "error", state: "stale" }
  if (!safe()) return { kind: "discarded" }
  return { kind: "ready", reference, detail }
}
