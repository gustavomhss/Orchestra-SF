import type { ImportManifest, StoredImportManifest } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** The host must reauthenticate and commit the domain change and its idempotency receipt
 * in one transaction. It must compare the current file, base identities, authority and
 * stored command digest before executing the same command used for preview. */
export type ImportApplyHost = {
  read: (id: string, context: TrustedDomainContext) => Promise<PortResult<StoredImportManifest>>
  confirm: (manifest: StoredImportManifest, context: TrustedDomainContext) => Promise<boolean>
  applyAtomically: (manifest: StoredImportManifest, context: TrustedDomainContext) => Promise<PortResult<ImportManifest>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}

export async function applyImport(request: { manifestId: string; version: number }, context: TrustedDomainContext, host: ImportApplyHost): Promise<PortResult<ImportManifest>> {
  if (context.kind !== "ui" || !await host.revalidate(context)) return { status: "denied", reason: "human-authority-required" }
  const stored = await host.read(request.manifestId, context)
  if (stored.status !== "ok") return stored
  if (stored.value.id !== request.manifestId || stored.value.version !== request.version || stored.value.context.principalRef !== context.binding.principalRef || stored.value.context.installationId !== context.binding.installationId || stored.value.context.projectId !== context.binding.projectId || stored.value.context.accessRevision !== context.binding.accessRevision || stored.value.context.policyVersion !== context.binding.policyVersion) return { status: "stale", reason: "preview-context-changed" }
  if (stored.value.state !== "preview" && stored.value.state !== "applied") return { status: "stale", reason: "preview-unavailable" }
  if (!await host.confirm(stored.value, context)) return { status: "denied", reason: "application-confirmation-required" }
  if (!await host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
  const applied = await host.applyAtomically(stored.value, context)
  if (applied.status !== "ok") return applied
  if (applied.value.id !== stored.value.id || applied.value.sourceDigest !== stored.value.sourceDigest || applied.value.state !== "applied" || !applied.value.domainApplied || applied.value.receipts.length !== stored.value.commands.length || stored.value.commands.some((command) => !applied.value.receipts.some((receipt) => receipt.status === "applied" && receipt.idempotencyKey === command.idempotencyKey && receipt.commandDigest === command.commandDigest && receipt.targetIncarnation === command.target.incarnation && receipt.principalRef === context.binding.principalRef))) return { status: "unavailable", reason: "receipt-inconsistent" }
  if (!await host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
  return applied
}
